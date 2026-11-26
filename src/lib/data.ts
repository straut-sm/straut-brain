import "server-only";
import { db } from "./supabase/admin";
import { hueOf } from "./meta";
import { driveIdOf, drivePreviewUrl, isDrivePath } from "./drive";
import { purgeSoon } from "./trash";
import type { ClientMetrics } from "./metrics";
import type { Block, CalendarEvent, ProductionItem, Client, ClientFile, Comment, HistoryEntry, MediaItem, Role, Snapshot, Suggestion } from "./types";

// ---------------------------------------------------------------------------
// Links assinados (mídias privadas). Guardados em memória por ~50 min para
// que as imagens/vídeos não sejam baixados de novo a cada atualização.
// ---------------------------------------------------------------------------
const TTL = 60 * 60; // 1 h
const urlCache = new Map<string, { url: string; until: number }>();

async function signMany(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = urlCache.get(`${bucket}/${p}`);
    if (hit && hit.until > now) out.set(p, hit.url);
    else missing.push(p);
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    const { data, error } = await db().storage.from(bucket).createSignedUrls(chunk, TTL);
    if (error) throw error;
    data?.forEach((d) => {
      if (d.signedUrl && d.path) {
        out.set(d.path, d.signedUrl);
        urlCache.set(`${bucket}/${d.path}`, { url: d.signedUrl, until: now + (TTL - 600) * 1000 });
      }
    });
  }
  return out;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const CLIENT_COLS =
  "id, slug, name, specialty, color, contract_posts, payment_day, drive_url, instagram_url, tiktok_url, active, notes, avatar_path, client_files(id, name, kind, size_bytes, created_at, deleted_at)";
export const BLOCK_COLS =
  "id, client_id, date, title, format, planned_format, status, caption, script, suggestion, instagram_url, block_media(id, kind, path, position, deleted_at), block_history(id, at, author, action, before, bot), block_comments(id, at, author, text, seen, bot, internal)";

async function mapClients(rows: Row[], role: Role): Promise<Client[]> {
  const avatars = await signMany("midia", rows.map((r) => r.avatar_path).filter(Boolean));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    specialty: r.specialty,
    color: r.color,
    contractPosts: r.contract_posts,
    paymentDay: role === "straut" ? r.payment_day : 0,
    driveUrl: r.drive_url,
    instagramUrl: r.instagram_url ?? "",
    tiktokUrl: r.tiktok_url ?? "",
    active: r.active,
    notes: role === "straut" ? r.notes : "",
    avatarUrl: r.avatar_path ? avatars.get(r.avatar_path) : undefined,
    files: ((r.client_files ?? []) as Row[])
      .filter((f) => !f.deleted_at)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((f): ClientFile => ({ id: f.id, name: f.name, kind: f.kind, size: formatSize(Number(f.size_bytes)), at: f.created_at })),
  }));
}

/** viewer "cliente": sem comentários internos e sem o nome dos bots. */
export async function mapBlocks(rows: Row[], viewer: Role = "straut"): Promise<Block[]> {
  const staff = viewer === "straut";
  const paths = rows.flatMap((r) => ((r.block_media ?? []) as Row[]).filter((m) => !m.deleted_at).map((m) => m.path)).filter((p) => !isDrivePath(p));
  const urls = await signMany("midia", paths);
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    date: r.date,
    title: r.title,
    format: r.format,
    plannedFormat: r.planned_format ?? undefined,
    status: r.status,
    caption: r.caption,
    script: r.script,
    suggestion: (r.suggestion as Suggestion | null) ?? undefined,
    hue: hueOf(r.id),
    instagramUrl: r.instagram_url ?? "",
    media: ((r.block_media ?? []) as Row[])
      .filter((m) => !m.deleted_at)
      .sort((a, b) => a.position - b.position)
      .map((m): MediaItem => isDrivePath(m.path)
        ? { id: m.id, kind: m.kind, url: drivePreviewUrl(driveIdOf(m.path)), driveId: driveIdOf(m.path) }
        : { id: m.id, kind: m.kind, url: urls.get(m.path) ?? "" }),
    history: ((r.block_history ?? []) as Row[])
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((h): HistoryEntry => ({
        id: h.id, at: h.at, by: h.author, action: h.action, before: (h.before as Snapshot | null) ?? undefined,
        ...(staff && h.bot ? { bot: h.bot } : {}),
      })),
    comments: ((r.block_comments ?? []) as Row[])
      .filter((c) => staff || !c.internal)
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((c): Comment => ({
        id: c.id, at: c.at, by: c.author, text: c.text, seen: c.seen,
        ...(c.bot ? { bot: c.bot } : {}), ...(c.internal ? { internal: true } : {}),
      })),
  }));
}

export const EVENT_COLS = "id, client_id, date, kind, title, notes";

export function mapEvents(rows: Row[]): CalendarEvent[] {
  return rows.map((r) => ({ id: r.id, clientId: r.client_id, date: r.date, kind: r.kind, title: r.title, notes: r.notes ?? "" }));
}

// ---------------------------------------------------------------------------
// Métricas do Instagram (gravadas pela rotina do mLabs)
// ---------------------------------------------------------------------------
const POST_COLS = "id, client_id, date, format, permalink, caption, thumbnail_url, reach, views, likes, comments, saves, shares, reason, reason_by";

/** Posts dos últimos ~5 meses e seguidores dos últimos ~70 dias. Sem clientIds = todas. */
export async function loadMetrics(clientIds?: string[]): Promise<ClientMetrics[]> {
  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let qc = db().from("clients").select("id, metrics_synced_at");
  let qp = db().from("ig_posts").select(POST_COLS).gte("date", since(150)).order("date");
  let qf = db().from("ig_followers").select("client_id, date, followers").gte("date", since(70)).order("date");
  if (clientIds) {
    qc = qc.in("id", clientIds);
    qp = qp.in("client_id", clientIds);
    qf = qf.in("client_id", clientIds);
  }
  const [{ data: cs, error: e1 }, { data: ps, error: e2 }, { data: fs, error: e3 }] = await Promise.all([qc, qp, qf]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  return (cs ?? []).map((c) => ({
    clientId: c.id,
    syncedAt: c.metrics_synced_at ?? null,
    posts: (ps ?? []).filter((p) => p.client_id === c.id).map((p) => ({
      id: p.id, date: p.date, format: p.format, permalink: p.permalink, caption: p.caption, thumbnailUrl: p.thumbnail_url,
      reach: p.reach, views: p.views, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares,
      reason: p.reason, ...(p.reason_by ? { reasonBy: p.reason_by } : {}),
    })),
    followers: (fs ?? []).filter((x) => x.client_id === c.id).map((x) => ({ date: x.date, followers: x.followers })),
  }));
}

/** Tudo (painel da Straut). */
export async function loadAll() {
  purgeSoon(); // esvazia o que passou de 30 dias na lixeira
  const [{ data: clients, error: e1 }, { data: blocks, error: e2 }, { data: events, error: e3 }] = await Promise.all([
    db().from("clients").select(CLIENT_COLS).order("name"),
    db().from("blocks").select(BLOCK_COLS).is("deleted_at", null).order("date"),
    db().from("events").select(EVENT_COLS).is("deleted_at", null).order("date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  const [c, b, m] = await Promise.all([mapClients(clients ?? [], "straut"), mapBlocks(blocks ?? [], "straut"), loadMetrics()]);
  return { clients: c, blocks: b, events: mapEvents(events ?? []), metrics: m, loadedAt: Date.now() };
}

/** Um bloco completo (as ações devolvem para atualizar a tela sem recarregar tudo). */
export async function loadBlock(id: string, viewer: Role = "straut"): Promise<Block | null> {
  const { data, error } = await db().from("blocks").select(BLOCK_COLS).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data ? (await mapBlocks([data], viewer))[0] : null;
}

/** Uma cliente pelo endereço (slug), sem conferir acesso. */
export async function findClientBySlug(slug: string) {
  const { data } = await db().from("clients").select("id, slug, name, active").eq("slug", slug).maybeSingle();
  return data as { id: string; slug: string; name: string; active: boolean } | null;
}

/** Dados de uma cliente (página da cliente). */
export async function loadClient(clientId: string, role: Role) {
  const [{ data: client, error: e1 }, { data: blocks, error: e2 }, { data: events, error: e3 }] = await Promise.all([
    db().from("clients").select(CLIENT_COLS).eq("id", clientId).single(),
    db().from("blocks").select(BLOCK_COLS).eq("client_id", clientId).is("deleted_at", null).order("date"),
    db().from("events").select(EVENT_COLS).eq("client_id", clientId).is("deleted_at", null).order("date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  const [c, b, m] = await Promise.all([mapClients([client], role), mapBlocks(blocks ?? [], role), loadMetrics([clientId])]);
  return { clients: c, blocks: b, events: mapEvents(events ?? []), metrics: m, loadedAt: Date.now() };
}

/** Dia de produção: o evento, as marcações dele e os roteiros já gravados em outros dias de produção. */
export async function loadProduction(eventId: string, clientId: string) {
  const { data: ev, error } = await db().from("events").select(EVENT_COLS).eq("id", eventId).eq("client_id", clientId)
    .is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!ev) return null;
  const [{ data: items, error: e1 }, { data: done, error: e2 }] = await Promise.all([
    db().from("production_items").select("block_id, position, state").eq("event_id", eventId),
    db().from("production_items").select("block_id, events!inner(client_id, deleted_at)").eq("state", "gravado")
      .neq("event_id", eventId).eq("events.client_id", clientId).is("events.deleted_at", null),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    event: mapEvents([ev])[0],
    items: (items ?? []).map((i) => ({ blockId: i.block_id, position: i.position, state: i.state })) as ProductionItem[],
    doneElsewhere: [...new Set((done ?? []).map((d) => d.block_id as string))],
  };
}
