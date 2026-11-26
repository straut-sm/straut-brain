import "server-only";
import { db } from "./supabase/admin";
import { isDrivePath } from "./drive";

/*
 * Lixeira: apagar = marcar deleted_at. O item some do painel, da página da cliente e da API,
 * fica 30 dias na lixeira (restaurável) e depois é apagado de vez, com os arquivos.
 * Quem apagou fica em deleted_by: "Straut" ou "bot <nome>".
 */

export const TRASH_DAYS = 30;
export type TrashKind = "bloco" | "midia" | "arquivo" | "evento";

const now = () => new Date().toISOString();
const cutoff = () => new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();

export async function trashBlock(id: string, by: string) {
  const { error } = await db().from("blocks").update({ deleted_at: now(), deleted_by: by }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

export async function trashMedia(ids: string[], by: string) {
  if (!ids.length) return;
  const { error } = await db().from("block_media").update({ deleted_at: now(), deleted_by: by }).in("id", ids).is("deleted_at", null);
  if (error) throw error;
}

export async function trashFile(id: string, by: string) {
  const { error } = await db().from("client_files").update({ deleted_at: now(), deleted_by: by }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

export async function trashEvent(id: string, by: string) {
  const { error } = await db().from("events").update({ deleted_at: now(), deleted_by: by }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

async function removeStorage(bucket: string, paths: string[]) {
  const stored = paths.filter((p) => p && !isDrivePath(p));
  for (let i = 0; i < stored.length; i += 100) {
    const { error } = await db().storage.from(bucket).remove(stored.slice(i, i + 100));
    if (error) throw error;
  }
}

/** Apaga de vez um item da lixeira (e os arquivos dele). */
export async function purgeItem(kind: TrashKind, id: string) {
  if (kind === "evento") {
    const { error } = await db().from("events").delete().eq("id", id).not("deleted_at", "is", null);
    if (error) throw error;
    return;
  }
  if (kind === "bloco") {
    const { data: b } = await db().from("blocks").select("id").eq("id", id).not("deleted_at", "is", null).maybeSingle();
    if (!b) return;
    const { data: media } = await db().from("block_media").select("path").eq("block_id", id);
    await removeStorage("midia", (media ?? []).map((m) => m.path));
    const { error } = await db().from("blocks").delete().eq("id", id);
    if (error) throw error;
  } else if (kind === "midia") {
    const { data: m } = await db().from("block_media").select("path").eq("id", id).not("deleted_at", "is", null).maybeSingle();
    if (!m) return;
    await removeStorage("midia", [m.path]);
    const { error } = await db().from("block_media").delete().eq("id", id);
    if (error) throw error;
  } else {
    const { data: f } = await db().from("client_files").select("path").eq("id", id).not("deleted_at", "is", null).maybeSingle();
    if (!f) return;
    await removeStorage("arquivos", [f.path]);
    const { error } = await db().from("client_files").delete().eq("id", id);
    if (error) throw error;
  }
}

/** Esvazia o que passou de 30 dias na lixeira. */
export async function purgeExpired() {
  const limit = cutoff();
  const [blocks, media, files, events] = await Promise.all([
    db().from("blocks").select("id").lt("deleted_at", limit).limit(200),
    db().from("block_media").select("id").lt("deleted_at", limit).limit(500),
    db().from("client_files").select("id").lt("deleted_at", limit).limit(200),
    db().from("events").select("id").lt("deleted_at", limit).limit(200),
  ]);
  for (const e of events.data ?? []) await purgeItem("evento", e.id);
  for (const b of blocks.data ?? []) await purgeItem("bloco", b.id);
  for (const m of media.data ?? []) await purgeItem("midia", m.id);
  for (const f of files.data ?? []) await purgeItem("arquivo", f.id);
  return { blocos: blocks.data?.length ?? 0, midias: media.data?.length ?? 0, arquivos: files.data?.length ?? 0, eventos: events.data?.length ?? 0 };
}

let lastPurge = 0;
/** Limpeza oportunista (no máximo 1 vez por hora por servidor), além da rotina diária. */
export function purgeSoon() {
  if (Date.now() - lastPurge < 3_600_000) return;
  lastPurge = Date.now();
  purgeExpired().catch((e) => console.error("[lixeira] limpeza", e));
}

/** Restaura um item. Mídia única (vídeo, capa, foto) troca de lugar com a atual, que vai para a lixeira. */
export async function restoreItem(kind: TrashKind, id: string, by: string) {
  if (kind === "bloco") {
    const { error } = await db().from("blocks").update({ deleted_at: null, deleted_by: null }).eq("id", id);
    if (error) throw error;
    return;
  }
  if (kind === "evento") {
    const { error } = await db().from("events").update({ deleted_at: null, deleted_by: null }).eq("id", id);
    if (error) throw error;
    return;
  }
  if (kind === "arquivo") {
    const { error } = await db().from("client_files").update({ deleted_at: null, deleted_by: null }).eq("id", id);
    if (error) throw error;
    return;
  }
  const { data: m } = await db().from("block_media").select("id, block_id, kind, blocks(format, deleted_at)").eq("id", id).maybeSingle();
  if (!m) return;
  const block = (m as unknown as { blocks: { format: string; deleted_at: string | null } }).blocks;
  if (block.deleted_at) {
    // O bloco também está na lixeira: restaura o bloco junto
    await db().from("blocks").update({ deleted_at: null, deleted_by: null }).eq("id", m.block_id);
  }
  const single = m.kind === "video" || m.kind === "cover" || (m.kind === "image" && block.format === "foto");
  if (single) {
    const { data: current } = await db().from("block_media").select("id").eq("block_id", m.block_id).eq("kind", m.kind).is("deleted_at", null);
    await trashMedia((current ?? []).map((c) => c.id), by);
  }
  const { data: last } = await db().from("block_media").select("position").eq("block_id", m.block_id).eq("kind", m.kind)
    .is("deleted_at", null).order("position", { ascending: false }).limit(1);
  const { error } = await db().from("block_media")
    .update({ deleted_at: null, deleted_by: null, position: (last?.[0]?.position ?? -1) + 1 }).eq("id", id);
  if (error) throw error;
}

export type TrashEntry = {
  kind: TrashKind;
  id: string;
  label: string;
  detail: string;
  client: string;
  clientColor: string;
  deletedAt: string;
  deletedBy: string;
  daysLeft: number;
  blockId?: string;
  clientSlug?: string;
};

const FORMAT: Record<string, string> = { roteiro: "Roteiro", reels: "Reels", carrossel: "Carrossel", foto: "Foto" };
const MEDIA: Record<string, string> = { video: "Vídeo", cover: "Capa", image: "Imagem" };
const daysLeft = (at: string) => Math.max(0, Math.ceil((Date.parse(at) + TRASH_DAYS * 86_400_000 - Date.now()) / 86_400_000));

type Rel = { name: string; color: string; slug: string };

export async function listTrash(): Promise<TrashEntry[]> {
  const [blocks, media, files, events] = await Promise.all([
    db().from("blocks").select("id, title, format, date, deleted_at, deleted_by, clients(name, color, slug)").not("deleted_at", "is", null),
    db().from("block_media").select("id, kind, path, deleted_at, deleted_by, block_id, blocks(title, deleted_at, clients(name, color, slug))").not("deleted_at", "is", null),
    db().from("client_files").select("id, name, deleted_at, deleted_by, clients(name, color, slug)").not("deleted_at", "is", null),
    db().from("events").select("id, title, date, deleted_at, deleted_by, clients(name, color, slug)").not("deleted_at", "is", null),
  ]);
  const out: TrashEntry[] = [];
  for (const b of (blocks.data ?? []) as unknown as { id: string; title: string; format: string; date: string; deleted_at: string; deleted_by: string | null; clients: Rel }[]) {
    out.push({
      kind: "bloco", id: b.id, label: b.title, detail: `${FORMAT[b.format] ?? b.format} · ${b.date.split("-").reverse().join("/")}`,
      client: b.clients.name, clientColor: b.clients.color, clientSlug: b.clients.slug, deletedAt: b.deleted_at, deletedBy: b.deleted_by ?? "Straut", daysLeft: daysLeft(b.deleted_at),
    });
  }
  for (const m of (media.data ?? []) as unknown as { id: string; kind: string; path: string; deleted_at: string; deleted_by: string | null; block_id: string; blocks: { title: string; deleted_at: string | null; clients: Rel } }[]) {
    if (m.blocks.deleted_at) continue; // aparece junto com o bloco
    out.push({
      kind: "midia", id: m.id, label: `${MEDIA[m.kind] ?? m.kind}${isDrivePath(m.path) ? " (link do Google Drive)" : ""}`, detail: `do bloco "${m.blocks.title}"`,
      client: m.blocks.clients.name, clientColor: m.blocks.clients.color, clientSlug: m.blocks.clients.slug, blockId: m.block_id,
      deletedAt: m.deleted_at, deletedBy: m.deleted_by ?? "Straut", daysLeft: daysLeft(m.deleted_at),
    });
  }
  for (const f of (files.data ?? []) as unknown as { id: string; name: string; deleted_at: string; deleted_by: string | null; clients: Rel }[]) {
    out.push({
      kind: "arquivo", id: f.id, label: f.name, detail: "arquivo da cliente",
      client: f.clients.name, clientColor: f.clients.color, clientSlug: f.clients.slug, deletedAt: f.deleted_at, deletedBy: f.deleted_by ?? "Straut", daysLeft: daysLeft(f.deleted_at),
    });
  }
  for (const e of (events.data ?? []) as unknown as { id: string; title: string; date: string; deleted_at: string; deleted_by: string | null; clients: Rel }[]) {
    out.push({
      kind: "evento", id: e.id, label: e.title, detail: `evento · ${e.date.split("-").reverse().join("/")}`,
      client: e.clients.name, clientColor: e.clients.color, clientSlug: e.clients.slug, deletedAt: e.deleted_at, deletedBy: e.deleted_by ?? "Straut", daysLeft: daysLeft(e.deleted_at),
    });
  }
  return out.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
}
