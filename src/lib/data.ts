import "server-only";
import { db } from "./supabase/admin";
import { hueOf } from "./meta";
import type { Block, Client, ClientFile, Comment, HistoryEntry, MediaItem, Role, Snapshot, Suggestion } from "./types";

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
  "id, slug, name, specialty, color, contract_posts, payment_day, drive_url, instagram_url, tiktok_url, active, notes, avatar_path, client_files(id, name, kind, size_bytes, created_at)";
const BLOCK_COLS =
  "id, client_id, date, title, format, planned_format, status, caption, script, suggestion, block_media(id, kind, path, position), block_history(id, at, author, action, before), block_comments(id, at, author, text, seen)";

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
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((f): ClientFile => ({ id: f.id, name: f.name, kind: f.kind, size: formatSize(Number(f.size_bytes)), at: f.created_at })),
  }));
}

async function mapBlocks(rows: Row[]): Promise<Block[]> {
  const paths = rows.flatMap((r) => ((r.block_media ?? []) as Row[]).map((m) => m.path));
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
    media: ((r.block_media ?? []) as Row[])
      .sort((a, b) => a.position - b.position)
      .map((m): MediaItem => ({ id: m.id, kind: m.kind, url: urls.get(m.path) ?? "" })),
    history: ((r.block_history ?? []) as Row[])
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((h): HistoryEntry => ({ id: h.id, at: h.at, by: h.author, action: h.action, before: (h.before as Snapshot | null) ?? undefined })),
    comments: ((r.block_comments ?? []) as Row[])
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((c): Comment => ({ id: c.id, at: c.at, by: c.author, text: c.text, seen: c.seen })),
  }));
}

/** Tudo (painel da Straut). */
export async function loadAll() {
  const [{ data: clients, error: e1 }, { data: blocks, error: e2 }] = await Promise.all([
    db().from("clients").select(CLIENT_COLS).order("name"),
    db().from("blocks").select(BLOCK_COLS).order("date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const [c, b] = await Promise.all([mapClients(clients ?? [], "straut"), mapBlocks(blocks ?? [])]);
  return { clients: c, blocks: b, loadedAt: Date.now() };
}

/** Um bloco completo (as ações devolvem para atualizar a tela sem recarregar tudo). */
export async function loadBlock(id: string): Promise<Block | null> {
  const { data, error } = await db().from("blocks").select(BLOCK_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? (await mapBlocks([data]))[0] : null;
}

/** Uma cliente pelo endereço (slug), sem conferir acesso. */
export async function findClientBySlug(slug: string) {
  const { data } = await db().from("clients").select("id, slug, name, active").eq("slug", slug).maybeSingle();
  return data as { id: string; slug: string; name: string; active: boolean } | null;
}

/** Dados de uma cliente (página da cliente). */
export async function loadClient(clientId: string, role: Role) {
  const [{ data: client, error: e1 }, { data: blocks, error: e2 }] = await Promise.all([
    db().from("clients").select(CLIENT_COLS).eq("id", clientId).single(),
    db().from("blocks").select(BLOCK_COLS).eq("client_id", clientId).order("date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const [c, b] = await Promise.all([mapClients([client], role), mapBlocks(blocks ?? [])]);
  return { clients: c, blocks: b, loadedAt: Date.now() };
}
