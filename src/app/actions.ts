"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccessError, clientCookieName, makeClientToken, requireAdmin, requireClientAccess } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { authClient } from "@/lib/supabase/server";
import { FORMATS, PLANNED } from "@/lib/meta";
import { loadBlock } from "@/lib/data";
import type { Block, ClientInput, FileKind, Format, MediaKind, PostFormat, Snapshot, Status } from "@/lib/types";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não foi possível concluir. Tente novamente." };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getBlock(id: string) {
  const { data, error } = await db()
    .from("blocks")
    .select("id, client_id, date, title, format, planned_format, status, caption, script, suggestion")
    .eq("id", id)
    .single();
  if (error || !data) throw new AccessError("Conteúdo não encontrado.");
  return data as any;
}

const snap = (b: any): Snapshot => ({
  format: b.format, title: b.title, caption: b.caption, script: b.script, date: b.date, plannedFormat: b.planned_format ?? null,
});

const POST_FORMATS: PostFormat[] = ["reels", "carrossel", "foto"];

async function log(blockId: string, author: "Straut" | "Cliente", action: string, before?: Snapshot) {
  const { error } = await db().from("block_history").insert({ block_id: blockId, author, action, before: before ?? null });
  if (error) throw error;
}

async function update(table: string, id: string, patch: Record<string, unknown>) {
  const { error } = await db().from(table).update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function signIn(email: string, password: string): Promise<Result> {
  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: "E-mail ou senha incorretos." };
  return { ok: true, data: null };
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function clientLogin(slug: string, password: string): Promise<Result> {
  return run(async () => {
    const { data: client } = await db().from("clients").select("id, password_hash, active").eq("slug", slug).maybeSingle();
    // Mesma resposta para "não existe" e "senha errada"
    const ok = client?.active && (await bcrypt.compare(password, client.password_hash));
    if (!client || !ok) {
      await new Promise((r) => setTimeout(r, 600)); // desacelera tentativas
      throw new AccessError("Senha incorreta.");
    }
    const token = makeClientToken(client.id);
    (await cookies()).set(clientCookieName(slug), token.value, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: token.maxAge,
    });
    return null;
  });
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

// Cada ação devolve o bloco atualizado: a tela troca só aquele bloco, sem recarregar o painel.
type BlockResult = Promise<Result<Block | null>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O id vem do navegador para o bloco aparecer na hora, antes de o servidor responder. */
export async function createBlock(id: string, clientId: string, date: string): BlockResult {
  return run(async () => {
    if (!UUID.test(id)) throw new AccessError("Identificador inválido.");
    await requireAdmin();
    const { error } = await db().from("blocks").insert({ id, client_id: clientId, date });
    if (error) throw error;
    await log(id, "Straut", "Bloco criado como Roteiro");
    return loadBlock(id);
  });
}

const FIELD_NAMES: Record<string, string> = { title: "título", caption: "legenda", script: "roteiro", date: "data de postagem" };

export async function updateBlock(id: string, patch: { title?: string; caption?: string; script?: string; date?: string }): BlockResult {
  return run(async () => {
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && patch[k] !== b[k]);
    if (changed.length) {
      const clean = Object.fromEntries(changed.map((k) => [k, patch[k]]));
      await Promise.all([
        update("blocks", id, clean),
        log(id, "Straut", `Editou ${changed.map((k) => FIELD_NAMES[k]).join(", ")}`, snap(b)),
      ]);
    }
    return loadBlock(id);
  });
}

export async function changeFormat(id: string, format: Format): BlockResult {
  return run(async () => {
    if (!(format in FORMATS)) throw new AccessError("Formato inválido.");
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    if (b.format !== format) {
      // Roteiro não tem "Publicado": volta para "Aprovado"
      const fix = format === "roteiro" && b.status === "publicado" ? { status: "aprovado" } : {};
      await Promise.all([
        update("blocks", id, { format, ...fix }),
        log(id, "Straut", `Formato alterado de ${FORMATS[b.format as Format].label} para ${FORMATS[format].label}`, snap(b)),
      ]);
    }
    return loadBlock(id);
  });
}

/** Roteiro: escolhe o formato que ele vai virar (null = ainda não definido). */
export async function setPlannedFormat(id: string, planned: PostFormat | null): BlockResult {
  return run(async () => {
    if (planned !== null && !POST_FORMATS.includes(planned)) throw new AccessError("Formato inválido.");
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    if ((b.planned_format ?? null) !== planned) {
      await Promise.all([
        update("blocks", id, { planned_format: planned }),
        log(id, "Straut", planned ? `Roteiro definido como ${PLANNED[planned]}` : "Formato planejado removido"),
      ]);
    }
    return loadBlock(id);
  });
}

/** Roteiro aprovado vira o post do formato planejado, que entra em produção. */
export async function advanceScript(id: string): BlockResult {
  return run(async () => {
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    if (b.format !== "roteiro") throw new AccessError("Este bloco já não é um roteiro.");
    const target = b.planned_format as PostFormat | null;
    if (!target) throw new AccessError("Escolha antes se o roteiro é de vídeo, carrossel ou foto.");
    await Promise.all([
      update("blocks", id, { format: target, status: "em_producao", suggestion: null }),
      log(id, "Straut", `Roteiro avançado para ${FORMATS[target].label}`, snap(b)),
    ]);
    return loadBlock(id);
  });
}

/** Volta o bloco para a versão guardada numa entrada do histórico (como um "desfazer"). */
export async function restoreVersion(id: string, historyId: string): BlockResult {
  return run(async () => {
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    const { data: h } = await db().from("block_history").select("action, before").eq("id", historyId).eq("block_id", id).maybeSingle();
    const v = h?.before as Snapshot | null | undefined;
    if (!h || !v) throw new AccessError("Versão não encontrada.");
    const format = v.format in FORMATS ? v.format : b.format;
    const patch: Record<string, unknown> = { format, title: v.title, caption: v.caption, script: v.script, date: v.date };
    if (v.plannedFormat !== undefined) patch.planned_format = v.plannedFormat;
    // Roteiro não tem "Publicado"
    if (format === "roteiro" && b.status === "publicado") patch.status = "aprovado";
    await Promise.all([
      update("blocks", id, patch),
      log(id, "Straut", `Restaurou a versão anterior a "${h.action}"`, snap(b)),
    ]);
    return loadBlock(id);
  });
}

/** Status que a Straut pode escolher. "Ajuste sugerido" só surge pela sugestão da cliente. */
const SETTABLE: Status[] = ["em_producao", "aguardando_aprovacao", "aprovado", "publicado"];

const STATUS_LABEL: Record<Status, string> = {
  em_producao: "Em produção",
  aguardando_aprovacao: "Aguardando aprovação",
  ajuste_sugerido: "Ajuste sugerido",
  aprovado: "Aprovado",
  publicado: "Publicado",
};

function statusAction(from: Status, to: Status) {
  if (to === "aguardando_aprovacao" && from === "em_producao") return "Enviado para aprovação";
  if (to === "publicado" && from === "aprovado") return "Marcado como publicado";
  if (to === "aprovado" && from === "publicado") return "Publicação desfeita";
  return `Status alterado de ${STATUS_LABEL[from]} para ${STATUS_LABEL[to]}`;
}

export async function setStatus(id: string, status: Status): BlockResult {
  return run(async () => {
    if (!SETTABLE.includes(status)) throw new AccessError("Status inválido.");
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    if (status === "publicado" && b.format === "roteiro") throw new AccessError("Roteiros não são publicados.");
    if (b.status !== status) {
      // Sair de "Ajuste sugerido" pela escolha manual descarta a sugestão pendente
      await Promise.all([
        update("blocks", id, b.suggestion ? { status, suggestion: null } : { status }),
        log(id, "Straut", statusAction(b.status as Status, status)),
      ]);
    }
    return loadBlock(id);
  });
}

export async function approve(id: string): BlockResult {
  return run(async () => {
    const b = await getBlock(id);
    const who = await requireClientAccess(b.client_id);
    if (b.status !== "aguardando_aprovacao") throw new AccessError("Este conteúdo não está aguardando aprovação.");
    await Promise.all([
      update("blocks", id, { status: "aprovado" }),
      log(id, who, b.format === "roteiro" ? "Roteiro aprovado" : "Post aprovado"),
    ]);
    return loadBlock(id);
  });
}

export async function suggest(id: string, field: "caption" | "script", proposed: string): BlockResult {
  return run(async () => {
    const b = await getBlock(id);
    const who = await requireClientAccess(b.client_id);
    if (field !== "caption" && field !== "script") throw new AccessError("Campo inválido.");
    if (b.status !== "aguardando_aprovacao") throw new AccessError("Este conteúdo não está aguardando aprovação.");
    if (proposed.trim() !== String(b[field]).trim()) {
      await Promise.all([
        update("blocks", id, {
          status: "ajuste_sugerido",
          suggestion: { field, original: b[field], proposed, at: new Date().toISOString() },
        }),
        log(id, who, `Sugeriu alteração ${field === "caption" ? "na legenda" : "no roteiro"}`),
      ]);
    }
    return loadBlock(id);
  });
}

export async function resolveSuggestion(id: string, accept: boolean): BlockResult {
  return run(async () => {
    const [, b] = await Promise.all([requireAdmin(), getBlock(id)]);
    if (b.suggestion) {
      await Promise.all(accept
        ? [
            update("blocks", id, { [b.suggestion.field]: b.suggestion.proposed, suggestion: null, status: "aprovado" }),
            log(id, "Straut", "Aceitou a sugestão da cliente", snap(b)),
          ]
        : [
            update("blocks", id, { suggestion: null, status: "aguardando_aprovacao" }),
            log(id, "Straut", "Recusou a sugestão da cliente"),
          ]);
    }
    return loadBlock(id);
  });
}

export async function addComment(id: string, text: string): BlockResult {
  return run(async () => {
    const b = await getBlock(id);
    const who = await requireClientAccess(b.client_id);
    const t = text.trim().slice(0, 4000);
    if (t) {
      const { error } = await db().from("block_comments").insert({ block_id: id, author: who, text: t, seen: who === "Straut" });
      if (error) throw error;
    }
    return loadBlock(id);
  });
}

export async function markCommentsSeen(id: string): BlockResult {
  return run(async () => {
    await requireAdmin();
    const { error } = await db().from("block_comments").update({ seen: true }).eq("block_id", id).eq("seen", false);
    if (error) throw error;
    return loadBlock(id);
  });
}

export async function deleteBlock(id: string): Promise<Result> {
  return run(async () => {
    await requireAdmin();
    const { data: media } = await db().from("block_media").select("path").eq("block_id", id);
    const { error } = await db().from("blocks").delete().eq("id", id);
    if (error) throw error;
    if (media?.length) await db().storage.from("midia").remove(media.map((m) => m.path));
    return null;
  });
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

function slugify(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/^dra?\.?\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
}

/** Aceita "@usuario", "usuario" ou o link completo do perfil. */
function socialUrl(value: string | undefined, base: string) {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?(instagram|tiktok)\.com/i.test(v)) return `https://${v}`;
  return base + v.replace(/^@/, "").replace(/\/+$/, "");
}

export async function saveClient(id: string | null, input: ClientInput): Promise<Result<{ id: string; slug: string }>> {
  return run(async () => {
    await requireAdmin();
    const row: Record<string, unknown> = {
      name: input.name.trim(),
      specialty: input.specialty.trim(),
      color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#b5785c",
      contract_posts: Math.round(input.contractPosts),
      payment_day: Math.round(input.paymentDay),
      drive_url: input.driveUrl.trim(),
      instagram_url: socialUrl(input.instagramUrl, "https://www.instagram.com/"),
      tiktok_url: socialUrl(input.tiktokUrl, "https://www.tiktok.com/@"),
      notes: input.notes,
      active: input.active,
    };
    if (!row.name) throw new AccessError("Informe o nome da cliente.");
    if (input.password) {
      if (input.password.length < 4) throw new AccessError("A senha precisa ter pelo menos 4 caracteres.");
      row.password_hash = await bcrypt.hash(input.password, 10);
    }
    if (id) {
      await update("clients", id, row);
      const { data } = await db().from("clients").select("slug").eq("id", id).single();
      return { id, slug: data!.slug as string };
    }
    if (!row.password_hash) throw new AccessError("Defina a senha da página da cliente.");
    const base = slugify(input.name);
    const { data: existing } = await db().from("clients").select("slug").like("slug", `${base}%`);
    const taken = new Set((existing ?? []).map((r) => r.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const { data, error } = await db().from("clients").insert({ ...row, slug }).select("id, slug").single();
    if (error) throw error;
    return { id: data.id as string, slug: data.slug as string };
  });
}

export async function setActive(id: string, active: boolean): Promise<Result> {
  return run(async () => {
    await requireAdmin();
    await update("clients", id, { active });
    return null;
  });
}

export async function setAvatar(clientId: string, path: string | null): Promise<Result> {
  return run(async () => {
    await requireAdmin();
    const { data: old } = await db().from("clients").select("avatar_path").eq("id", clientId).single();
    if (path && !path.startsWith(`avatars/${clientId}/`)) throw new AccessError("Caminho inválido.");
    await update("clients", clientId, { avatar_path: path });
    if (old?.avatar_path && old.avatar_path !== path) await db().storage.from("midia").remove([old.avatar_path]);
    return null;
  });
}

// ---------------------------------------------------------------------------
// Uploads (o navegador envia direto ao Supabase com um link assinado)
// ---------------------------------------------------------------------------

type UploadTarget =
  | { type: "media"; blockId: string; ext: string }
  | { type: "avatar"; clientId: string }
  | { type: "file"; clientId: string; name: string };

const safeExt = (e: string) => (/^[a-z0-9]{1,8}$/i.test(e) ? e.toLowerCase() : "bin");
const safeName = (n: string) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "arquivo";

export async function createUploadUrl(target: UploadTarget): Promise<Result<{ bucket: string; path: string; token: string }>> {
  return run(async () => {
    await requireAdmin();
    let bucket = "midia";
    let path: string;
    if (target.type === "media") {
      const b = await getBlock(target.blockId);
      path = `${b.client_id}/${b.id}/${randomUUID()}.${safeExt(target.ext)}`;
    } else if (target.type === "avatar") {
      path = `avatars/${target.clientId}/${randomUUID()}.jpg`;
    } else {
      bucket = "arquivos";
      path = `${target.clientId}/${randomUUID()}-${safeName(target.name)}`;
    }
    const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw error;
    return { bucket, path, token: data.token };
  });
}

export async function attachMedia(blockId: string, kind: MediaKind, paths: string[]): BlockResult {
  return run(async () => {
    await requireAdmin();
    const b = await getBlock(blockId);
    if (!paths.every((p) => p.startsWith(`${b.client_id}/${b.id}/`))) throw new AccessError("Caminho inválido.");
    if (kind === "video" || kind === "cover" || (kind === "image" && b.format === "foto")) {
      // Substitui o arquivo anterior
      const { data: old } = await db().from("block_media").select("id, path").eq("block_id", blockId).eq("kind", kind);
      if (old?.length) {
        await db().storage.from("midia").remove(old.map((o) => o.path));
        await db().from("block_media").delete().in("id", old.map((o) => o.id));
      }
    }
    const { data: last } = await db().from("block_media").select("position").eq("block_id", blockId).eq("kind", kind)
      .order("position", { ascending: false }).limit(1);
    const start = (last?.[0]?.position ?? -1) + 1;
    const { error } = await db().from("block_media").insert(paths.map((path, i) => ({ block_id: blockId, kind, path, position: start + i })));
    if (error) throw error;
    const label = { video: "Enviou o vídeo", cover: "Enviou a capa", image: paths.length > 1 ? `Enviou ${paths.length} imagens` : "Enviou imagem" }[kind];
    await log(blockId, "Straut", label);
    return loadBlock(blockId);
  });
}

export async function removeMedia(mediaId: string): BlockResult {
  return run(async () => {
    await requireAdmin();
    const { data: m } = await db().from("block_media").select("id, path, block_id").eq("id", mediaId).single();
    if (!m) return null;
    await db().storage.from("midia").remove([m.path]);
    await db().from("block_media").delete().eq("id", mediaId);
    await log(m.block_id, "Straut", "Removeu uma mídia");
    return loadBlock(m.block_id);
  });
}

export async function registerFile(clientId: string, file: { name: string; kind: FileKind; size: number; path: string }): Promise<Result> {
  return run(async () => {
    await requireAdmin();
    if (!file.path.startsWith(`${clientId}/`)) throw new AccessError("Caminho inválido.");
    const { error } = await db().from("client_files").insert({
      client_id: clientId, name: file.name.slice(0, 200), kind: file.kind, size_bytes: file.size, path: file.path,
    });
    if (error) throw error;
    return null;
  });
}

export async function removeFile(fileId: string): Promise<Result> {
  return run(async () => {
    await requireAdmin();
    const { data: f } = await db().from("client_files").select("path").eq("id", fileId).single();
    if (f) await db().storage.from("arquivos").remove([f.path]);
    await db().from("client_files").delete().eq("id", fileId);
    return null;
  });
}

export async function fileDownloadUrl(fileId: string): Promise<Result<string>> {
  return run(async () => {
    const { data: f } = await db().from("client_files").select("client_id, name, path").eq("id", fileId).single();
    if (!f) throw new AccessError("Arquivo não encontrado.");
    await requireClientAccess(f.client_id);
    const { data, error } = await db().storage.from("arquivos").createSignedUrl(f.path, 120, { download: f.name });
    if (error) throw error;
    return data.signedUrl;
  });
}
