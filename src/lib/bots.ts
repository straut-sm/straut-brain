import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./supabase/admin";
import { BLOCK_COLS, EVENT_COLS, TREND_COLS, loadMetrics, loadProduction, mapBlocks, mapEvents, mapTrends } from "./data";
import { addDays, matchPosts, summarize } from "./metrics";
import { trendToBlock } from "./trends";
import { driveFileId, drivePath } from "./drive";
import { trashBlock, trashEvent, trashMedia, trashTrend } from "./trash";
import type { Block, Format, MediaKind, PostFormat, ProductionState, Status, TrendItem } from "./types";

/*
 * API dos bots (OpenBot). Especificação: straut-team/integracoes/api-dos-bots.md
 *
 * - Uma chave única (BOTS_API_KEY) + cabeçalho X-Bot com o nome do bot.
 * - Os bots criam, editam, anexam e reordenam mídias, avançam roteiros, enviam para aprovação,
 *   comentam, marcam como publicado, aceitam sugestões e apagam. Apagar manda para a lixeira
 *   (30 dias, restaurável pelo painel). Aprovar, restaurar versões e o cadastro das clientes
 *   continuam só com a Straut, pelo painel.
 * - Toda escrita entra no histórico como "Straut", com o nome do bot numa coluna própria
 *   (a cliente vê só "Straut"). Comentários dos bots são internos.
 * - Nunca devolve senha, dia de pagamento, observações internas, arquivos da cliente nem chaves.
 */

export const PANEL_URL = (process.env.PANEL_URL ?? "https://painel.strautmarketing.com").replace(/\/$/, "");
export const RATE_LIMIT = 60; // requisições por minuto, por bot

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Confere a chave em tempo constante. Sem BOTS_API_KEY configurada, a API fica fechada. */
export function checkKey(header: string | null) {
  // Tolera espaços, quebras de linha e aspas que vêm junto ao copiar e colar a chave
  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim();
  const key = clean(process.env.BOTS_API_KEY ?? "");
  if (key.length < 32) throw new ApiError(503, "API dos bots desativada (BOTS_API_KEY não configurada).");
  const got = clean((header ?? "").replace(/^Bearer\s+/i, ""));
  if (!got || !timingSafeEqual(sha(got), sha(key))) throw new ApiError(401, "Chave inválida.");
}

export function checkBot(header: string | null): string {
  const bot = (header ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(bot)) {
    throw new ApiError(400, "Informe o nome do bot no cabeçalho X-Bot (ex.: samuel, design, gestor-jose-erasmo).");
  }
  return bot;
}

export async function checkRate(bot: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await db().from("bot_requests").select("id", { count: "exact", head: true }).eq("bot", bot).gte("at", since);
  if (error) throw error;
  if ((count ?? 0) >= RATE_LIMIT) throw new ApiError(429, `Limite de ${RATE_LIMIT} requisições por minuto atingido. Tente em instantes.`);
}

export async function logRequest(r: { bot: string; method: string; route: string; blockId?: string | null; status: number }) {
  await db().from("bot_requests").insert({
    bot: r.bot.slice(0, 48), method: r.method, route: r.route.slice(0, 300), block_id: r.blockId ?? null, status: r.status,
  });
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMATS: Format[] = ["roteiro", "reels", "carrossel", "foto"];
const POST_FORMATS: PostFormat[] = ["reels", "carrossel", "foto"];
const STATUSES: Status[] = ["em_producao", "aguardando_aprovacao", "ajuste_sugerido", "aprovado", "publicado"];
const FORMAT_LABEL: Record<Format, string> = { roteiro: "Roteiro", reels: "Reels", carrossel: "Carrossel", foto: "Foto" };

export function ymdParam(v: string | null | undefined, name: string): string | undefined {
  if (v == null || v === "") return undefined;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
    && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
  if (!ok) throw new ApiError(400, `${name} inválida: use AAAA-MM-DD.`);
  return v;
}

function formatParam(v: unknown, name: string): Format | undefined {
  if (v == null || v === "") return undefined;
  if (!FORMATS.includes(v as Format)) throw new ApiError(400, `${name} inválido: use ${FORMATS.join(", ")}.`);
  return v as Format;
}

function statusParam(v: string | null): Status[] | undefined {
  if (!v) return undefined;
  const list = v.split(",").map((s) => s.trim()).filter(Boolean);
  for (const s of list) if (!STATUSES.includes(s as Status)) throw new ApiError(400, `status inválido: use ${STATUSES.join(", ")}.`);
  return list as Status[];
}

function text(v: unknown, name: string, max: number): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new ApiError(400, `${name} deve ser texto.`);
  if (v.length > max) throw new ApiError(400, `${name} passa do limite de ${max} caracteres.`);
  return v;
}

const sim = (v: string | null) => v === "sim" || v === "true" || v === "1";

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

type ClientRow = { id: string; slug: string; name: string; specialty: string; contract_posts: number };

async function activeClients(): Promise<ClientRow[]> {
  const { data, error } = await db().from("clients").select("id, slug, name, specialty, contract_posts").eq("active", true).order("name");
  if (error) throw error;
  return (data ?? []) as ClientRow[];
}

async function clientBySlug(slug: string): Promise<ClientRow> {
  const { data } = await db().from("clients").select("id, slug, name, specialty, contract_posts, active").eq("slug", slug).maybeSingle();
  if (!data || !data.active) throw new ApiError(404, "Cliente não encontrada ou inativa.");
  return data as ClientRow;
}

const MEDIA_TYPE: Record<MediaKind, string> = { video: "video", cover: "capa", image: "imagem" };

/** Bloco no formato da API (em português, com o link direto do painel). */
function serialize(b: Block, slug: string, full: boolean) {
  const out: Record<string, unknown> = {
    id: b.id,
    cliente: slug,
    link: `${PANEL_URL}/c/${slug}?bloco=${b.id}`,
    data: b.date,
    titulo: b.title,
    formato: b.format,
    formato_planejado: b.plannedFormat ?? null,
    status: b.status,
    legenda: b.caption,
    roteiro: b.script,
    link_instagram: b.instagramUrl || null,
    midias: b.media.map((m) => ({
      id: m.id,
      tipo: MEDIA_TYPE[m.kind],
      url: m.url,
      ...(m.driveId ? { google_drive: true } : {}),
    })),
    tem_video: b.media.some((m) => m.kind === "video"),
    tem_capa: b.media.some((m) => m.kind === "cover"),
    sugestao_pendente: b.suggestion
      ? { campo: b.suggestion.field === "caption" ? "legenda" : "roteiro", original: b.suggestion.original, proposta: b.suggestion.proposed, em: b.suggestion.at }
      : null,
    comentarios_nao_lidos: b.comments.filter((c) => c.by === "Cliente" && !c.seen).length,
  };
  if (full) {
    out.comentarios = b.comments.map((c) => ({
      em: c.at, autor: c.by === "Cliente" ? "cliente" : "straut", bot: c.bot ?? null, interno: !!c.internal, lido: c.seen, texto: c.text,
    }));
    out.historico = b.history.map((h) => ({ em: h.at, autor: h.by === "Cliente" ? "cliente" : "straut", bot: h.bot ?? null, acao: h.action }));
  }
  return out;
}

async function loadBlocks(filter: (q: any) => any): Promise<Block[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await filter(db().from("blocks").select(BLOCK_COLS).is("deleted_at", null)).order("date").limit(1000);
  if (error) throw error;
  return mapBlocks(data ?? [], "straut");
}

async function blockWithClient(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, "Bloco não encontrado.");
  const { data } = await db().from("blocks").select("id, client_id, clients(slug, active)").eq("id", id).is("deleted_at", null).maybeSingle();
  const c = (data as { clients?: { slug: string; active: boolean } } | null)?.clients;
  if (!data || !c?.active) throw new ApiError(404, "Bloco não encontrado.");
  const [b] = await loadBlocks((q) => q.eq("id", id));
  return { block: b, slug: c.slug, clientId: data.client_id as string };
}

export async function listClients() {
  return (await activeClients()).map((c) => ({ slug: c.slug, nome: c.name, especialidade: c.specialty, meta_posts_mes: c.contract_posts }));
}

function monthRange(mes: string | null) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const m = mes ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new ApiError(400, "mes inválido: use AAAA-MM.");
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { mes: m, de: `${m}-01`, ate: `${m}-${String(last).padStart(2, "0")}` };
}

export async function clientSummary(slug: string, mes: string | null) {
  const c = await clientBySlug(slug);
  const r = monthRange(mes);
  const blocks = await loadBlocks((q) => q.eq("client_id", c.id).gte("date", r.de).lte("date", r.ate));
  const count = (list: Block[]) => ({
    total: list.length,
    ...Object.fromEntries(STATUSES.map((s) => [s, list.filter((b) => b.status === s).length])),
  });
  const posts = blocks.filter((b) => b.format !== "roteiro");
  return {
    cliente: c.slug,
    nome: c.name,
    mes: r.mes,
    meta_posts: c.contract_posts,
    posts: count(posts),
    roteiros: count(blocks.filter((b) => b.format === "roteiro")),
    comentarios_nao_lidos: blocks.reduce((n, b) => n + b.comments.filter((x) => x.by === "Cliente" && !x.seen).length, 0),
  };
}

export async function clientBlocks(slug: string, p: URLSearchParams) {
  const c = await clientBySlug(slug);
  const de = ymdParam(p.get("de"), "de"), ate = ymdParam(p.get("ate"), "ate");
  const status = statusParam(p.get("status"));
  const blocks = await loadBlocks((q) => {
    let x = q.eq("client_id", c.id);
    if (de) x = x.gte("date", de);
    if (ate) x = x.lte("date", ate);
    if (status) x = x.in("status", status);
    return x;
  });
  return blocks.map((b) => serialize(b, c.slug, false));
}

export async function getBlockApi(id: string) {
  const { block, slug } = await blockWithClient(id);
  return serialize(block, slug, true);
}

/** Posts de todas as clientes ativas, com filtros (rotina diária do Samuel, rotina do Design...). */
export async function searchBlocks(p: URLSearchParams) {
  const clients = await activeClients();
  const slugOf = new Map(clients.map((c) => [c.id, c.slug]));
  const data = ymdParam(p.get("data"), "data");
  const de = ymdParam(p.get("de"), "de"), ate = ymdParam(p.get("ate"), "ate");
  const formato = formatParam(p.get("formato"), "formato");
  const excluir = formatParam(p.get("excluir_formato"), "excluir_formato");
  const status = statusParam(p.get("status"));
  if (!data && !de && !ate && !formato && !status) {
    throw new ApiError(400, "Use ao menos um filtro: data, de, ate, formato ou status.");
  }
  let blocks = await loadBlocks((q) => {
    let x = q.in("client_id", [...slugOf.keys()]);
    if (data) x = x.eq("date", data);
    if (de) x = x.gte("date", de);
    if (ate) x = x.lte("date", ate);
    if (formato) x = x.eq("format", formato);
    if (excluir) x = x.neq("format", excluir);
    if (status) x = x.in("status", status);
    return x;
  });
  if (p.has("com_video")) blocks = blocks.filter((b) => b.media.some((m) => m.kind === "video") === sim(p.get("com_video")));
  if (p.has("sem_capa")) blocks = blocks.filter((b) => !b.media.some((m) => m.kind === "cover") === sim(p.get("sem_capa")));
  return blocks.map((b) => serialize(b, slugOf.get(b.clientId)!, false));
}

/** Pendências de todas as clientes ativas. */
export async function pendencies() {
  const clients = await activeClients();
  const slugOf = new Map(clients.map((c) => [c.id, c.slug]));
  const ids = [...slugOf.keys()];
  const { data: unread } = await db().from("block_comments").select("block_id").eq("author", "Cliente").eq("seen", false);
  const unreadIds = [...new Set((unread ?? []).map((u) => u.block_id as string))];
  const blocks = await loadBlocks((q) => {
    const or = [`status.in.(aguardando_aprovacao,ajuste_sugerido)`, ...(unreadIds.length ? [`id.in.(${unreadIds.join(",")})`] : [])].join(",");
    return q.in("client_id", ids).or(or);
  });

  // Desde quando está aguardando: a última vez que entrou em "Aguardando aprovação"
  const enteredWaiting = (b: Block) => {
    const h = [...b.history].reverse().find((x) => /Enviado para aprovação|Recusou a sugestão|para Aguardando aprovação/.test(x.action));
    return h?.at ?? b.history[b.history.length - 1]?.at;
  };
  const now = Date.now();
  const waiting = blocks
    .filter((b) => b.status === "aguardando_aprovacao")
    .map((b) => ({ b, since: enteredWaiting(b) }))
    .map(({ b, since }) => ({ b, since, hours: since ? Math.floor((now - Date.parse(since)) / 3_600_000) : null }))
    .filter((x) => x.hours === null || x.hours >= 48);

  return {
    aguardando_aprovacao_ha_mais_de_48h: waiting.map(({ b, since, hours }) => ({
      ...serialize(b, slugOf.get(b.clientId)!, false), aguardando_desde: since ?? null, horas_aguardando: hours,
    })),
    ajustes_sugeridos: blocks.filter((b) => b.status === "ajuste_sugerido").map((b) => serialize(b, slugOf.get(b.clientId)!, false)),
    comentarios_novos: blocks
      .filter((b) => b.comments.some((c) => c.by === "Cliente" && !c.seen))
      .map((b) => ({
        ...serialize(b, slugOf.get(b.clientId)!, false),
        comentarios: b.comments.filter((c) => c.by === "Cliente" && !c.seen).map((c) => ({ em: c.at, texto: c.text })),
      })),
  };
}

// ---------------------------------------------------------------------------
// Escrita (nada destrutivo)
// ---------------------------------------------------------------------------

type Snap = { format: string; title: string; caption: string; script: string; date: string; plannedFormat: string | null };

async function rawBlock(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, "Bloco não encontrado.");
  const { data } = await db().from("blocks")
    .select("id, client_id, date, title, format, planned_format, status, caption, script, suggestion, clients(slug, active)")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  const c = (data as { clients?: { slug: string; active: boolean } } | null)?.clients;
  if (!data || !c?.active) throw new ApiError(404, "Bloco não encontrado.");
  return data as unknown as {
    id: string; client_id: string; date: string; title: string; format: Format; planned_format: PostFormat | null;
    status: Status; caption: string; script: string;
    suggestion: { field: "caption" | "script"; original: string; proposed: string; at: string } | null;
  };
}

const snap = (b: Awaited<ReturnType<typeof rawBlock>>): Snap => ({
  format: b.format, title: b.title, caption: b.caption, script: b.script, date: b.date, plannedFormat: b.planned_format ?? null,
});

async function history(blockId: string, bot: string, action: string, before?: Snap) {
  const { error } = await db().from("block_history").insert({ block_id: blockId, author: "Straut", action, before: before ?? null, bot });
  if (error) throw error;
}

async function patchBlock(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from("blocks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function createBlockApi(slug: string, bot: string, body: Record<string, unknown>) {
  const c = await clientBySlug(slug);
  const date = ymdParam(body.data as string, "data");
  if (!date) throw new ApiError(400, "Informe a data (AAAA-MM-DD).");
  const format = formatParam(body.formato, "formato") ?? "roteiro";
  let planned: PostFormat | null = null;
  if (body.formato_planejado != null && body.formato_planejado !== "") {
    if (format !== "roteiro") throw new ApiError(400, "formato_planejado só vale para roteiros.");
    if (!POST_FORMATS.includes(body.formato_planejado as PostFormat)) throw new ApiError(400, `formato_planejado inválido: use ${POST_FORMATS.join(", ")}.`);
    planned = body.formato_planejado as PostFormat;
  }
  const title = (text(body.titulo, "titulo", 200) ?? "").trim() || "Novo conteúdo";
  const script = text(body.roteiro, "roteiro", 20000) ?? "";
  const caption = text(body.legenda, "legenda", 5000) ?? "";
  const id = randomUUID();
  const { error } = await db().from("blocks").insert({
    id, client_id: c.id, date, format, planned_format: planned, status: "em_producao", title, script, caption,
  });
  if (error) throw error;
  await history(id, bot, `Bloco criado como ${FORMAT_LABEL[format]}`);
  return getBlockApi(id);
}

const FIELD_NAMES = { title: "título", caption: "legenda", script: "roteiro", date: "data de postagem" } as const;

export async function updateBlockApi(id: string, bot: string, body: Record<string, unknown>) {
  const b = await rawBlock(id);
  const next = {
    title: text(body.titulo, "titulo", 200)?.trim(),
    caption: text(body.legenda, "legenda", 5000),
    script: text(body.roteiro, "roteiro", 20000),
    date: ymdParam(body.data as string | undefined, "data"),
  };
  if (next.title === "") throw new ApiError(400, "O título não pode ficar vazio.");
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== undefined && next[k] !== b[k]);
  if (changed.length) {
    await patchBlock(id, Object.fromEntries(changed.map((k) => [k, next[k]])));
    await history(id, bot, `Editou ${changed.map((k) => FIELD_NAMES[k]).join(", ")}`, snap(b));
  }
  // Link do post publicado (liga o bloco às métricas). "" ou null tira o link.
  if (body.link_instagram !== undefined) {
    const url = (body.link_instagram === null ? "" : text(body.link_instagram, "link_instagram", 300) ?? "").trim();
    if (url && b.format === "roteiro") throw new ApiError(409, "Roteiro não tem post publicado: avance o bloco antes.");
    if (url && !/^https:\/\/(www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/[\w-]+/i.test(url)) {
      throw new ApiError(400, "link_instagram inválido: use o link do post (instagram.com/p/... ou /reel/...).");
    }
    const { data: cur } = await db().from("blocks").select("instagram_url").eq("id", id).single();
    if ((cur?.instagram_url ?? "") !== url) {
      await patchBlock(id, { instagram_url: url });
      await history(id, bot, url ? "Ligou o bloco ao post do Instagram" : "Tirou o link do Instagram");
    }
  }
  return getBlockApi(id);
}

const UPLOAD_EXT = ["jpg", "jpeg", "png", "webp", "heic", "gif", "mp4", "mov", "m4v", "webm"];

export async function uploadUrls(id: string, body: Record<string, unknown>) {
  const b = await rawBlock(id);
  const files = body.arquivos;
  if (!Array.isArray(files) || files.length === 0 || files.length > 20) {
    throw new ApiError(400, 'Envie "arquivos": [{ "extensao": "jpg" }, ...] (de 1 a 20).');
  }
  const out = [];
  for (const f of files) {
    const ext = String((f as { extensao?: unknown })?.extensao ?? "").toLowerCase().replace(/^\./, "");
    if (!UPLOAD_EXT.includes(ext)) throw new ApiError(400, `Extensão não aceita: "${ext}". Use ${UPLOAD_EXT.join(", ")}.`);
    const path = `${b.client_id}/${b.id}/${randomUUID()}.${ext}`;
    const { data, error } = await db().storage.from("midia").createSignedUploadUrl(path);
    if (error) throw error;
    out.push({ caminho: path, upload_url: data.signedUrl });
  }
  return {
    arquivos: out,
    como_enviar: "Faça PUT do arquivo em upload_url (cabeçalho Content-Type do arquivo). Depois chame POST /api/bots/blocos/:id/midias com os caminhos, na ordem.",
  };
}

const KIND: Record<string, MediaKind> = { imagem: "image", video: "video", capa: "cover" };

export async function attachMediaApi(id: string, bot: string, body: Record<string, unknown>) {
  const b = await rawBlock(id);
  const kind = KIND[String(body.tipo ?? "")];
  if (!kind) throw new ApiError(400, 'tipo inválido: use "imagem", "video" ou "capa".');
  if ((kind === "video" || kind === "cover") && b.format !== "reels") throw new ApiError(409, "Vídeo e capa só em blocos de Reels.");
  if (kind === "image" && b.format !== "carrossel" && b.format !== "foto") throw new ApiError(409, "Imagens só em blocos de Carrossel ou Foto.");

  let paths: string[];
  if (body.link_drive !== undefined) {
    if (kind !== "video") throw new ApiError(400, "link_drive só vale para vídeo.");
    const fileId = driveFileId(String(body.link_drive));
    if (!fileId) throw new ApiError(400, "link_drive inválido: use o link de compartilhamento do arquivo no Google Drive.");
    paths = [drivePath(fileId)];
  } else {
    const list = body.caminhos;
    if (!Array.isArray(list) || list.length === 0 || list.length > 20) throw new ApiError(400, 'Envie "caminhos" (de 1 a 20) devolvidos por upload-url.');
    paths = list.map(String);
    const prefix = `${b.client_id}/${b.id}/`;
    if (!paths.every((p) => p.startsWith(prefix) && /^[0-9a-f-]+\.[a-z0-9]+$/.test(p.slice(prefix.length)))) {
      throw new ApiError(400, "Caminho inválido: use os caminhos devolvidos por upload-url para este bloco.");
    }
    // Confere que os arquivos foram mesmo enviados
    const { data: listed, error } = await db().storage.from("midia").list(`${b.client_id}/${b.id}`, { limit: 1000 });
    if (error) throw error;
    const have = new Set((listed ?? []).map((o) => `${prefix}${o.name}`));
    const missing = paths.filter((p) => !have.has(p));
    if (missing.length) throw new ApiError(409, `Arquivo ainda não enviado: ${missing.join(", ")}`);
  }

  const { data: existing } = await db().from("block_media").select("id, position").eq("block_id", id).eq("kind", kind).is("deleted_at", null);
  const single = kind === "video" || kind === "cover" || b.format === "foto";
  if (single && (paths.length > 1 || (existing?.length ?? 0) > 0)) {
    throw new ApiError(409, "Este bloco já tem esse arquivo (ou só aceita um). Apague o atual antes (DELETE /blocos/:id/midias/:midiaId; ele vai para a lixeira).");
  }
  const start = Math.max(-1, ...(existing ?? []).map((m) => m.position as number)) + 1;
  const { error } = await db().from("block_media").insert(paths.map((path, i) => ({ block_id: id, kind, path, position: start + i })));
  if (error) throw error;
  const label = kind === "video" ? (body.link_drive ? "Adicionou o vídeo pelo Google Drive" : "Enviou o vídeo")
    : kind === "cover" ? "Enviou a capa" : paths.length > 1 ? `Adicionou ${paths.length} imagens` : "Adicionou 1 imagem";
  await history(id, bot, label);
  return getBlockApi(id);
}

export async function reorderApi(id: string, bot: string, body: Record<string, unknown>) {
  await rawBlock(id);
  const ids = body.ids;
  if (!Array.isArray(ids)) throw new ApiError(400, 'Envie "ids": a lista completa das imagens, na nova ordem.');
  const { data: cur } = await db().from("block_media").select("id").eq("block_id", id).eq("kind", "image").is("deleted_at", null);
  const known = new Set((cur ?? []).map((m) => m.id as string));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((x) => known.has(String(x)))) {
    throw new ApiError(409, "A lista precisa ter exatamente todas as imagens do bloco, sem repetir.");
  }
  for (const [i, mid] of ids.entries()) {
    const { error } = await db().from("block_media").update({ position: i }).eq("id", String(mid)).eq("block_id", id);
    if (error) throw error;
  }
  await history(id, bot, "Mudou a ordem das imagens");
  return getBlockApi(id);
}

export async function advanceApi(id: string, bot: string) {
  const b = await rawBlock(id);
  if (b.format !== "roteiro") throw new ApiError(409, "Este bloco já não é um roteiro.");
  if (b.status !== "aprovado") throw new ApiError(409, "Só roteiros aprovados avançam.");
  if (!b.planned_format) throw new ApiError(409, "O roteiro não tem formato planejado (vídeo, carrossel ou foto).");
  await patchBlock(id, { format: b.planned_format, status: "em_producao", suggestion: null });
  await history(id, bot, `Roteiro avançado para ${FORMAT_LABEL[b.planned_format]}`, snap(b));
  return getBlockApi(id);
}

export async function sendForApprovalApi(id: string, bot: string) {
  const b = await rawBlock(id);
  if (b.status !== "em_producao") throw new ApiError(409, "Só blocos em produção podem ser enviados para aprovação.");
  await patchBlock(id, { status: "aguardando_aprovacao" });
  await history(id, bot, "Enviado para aprovação");
  return getBlockApi(id);
}

export async function commentApi(id: string, bot: string, body: Record<string, unknown>) {
  await rawBlock(id);
  const t = (text(body.texto, "texto", 4000) ?? "").trim();
  if (!t) throw new ApiError(400, 'Envie "texto".');
  const { error } = await db().from("block_comments").insert({ block_id: id, author: "Straut", text: t, seen: true, bot, internal: true });
  if (error) throw error;
  return getBlockApi(id);
}

/** Roteiro não é publicado; o post precisa estar aprovado pela cliente. */
export async function publishApi(id: string, bot: string) {
  const b = await rawBlock(id);
  if (b.format === "roteiro") throw new ApiError(409, "Roteiros não são publicados.");
  if (b.status !== "aprovado") throw new ApiError(409, "Só posts aprovados podem ser marcados como publicados.");
  await patchBlock(id, { status: "publicado" });
  await history(id, bot, "Marcado como publicado");
  return getBlockApi(id);
}

/** Aceita a sugestão pendente da cliente: aplica o texto dela e o bloco fica aprovado. */
export async function acceptSuggestionApi(id: string, bot: string) {
  const b = await rawBlock(id);
  if (!b.suggestion || b.status !== "ajuste_sugerido") throw new ApiError(409, "Este bloco não tem sugestão pendente da cliente.");
  await patchBlock(id, { [b.suggestion.field]: b.suggestion.proposed, suggestion: null, status: "aprovado" });
  await history(id, bot, "Aceitou a sugestão da cliente", snap(b));
  return getBlockApi(id);
}

/** Apagar = mandar para a lixeira (30 dias). O Guilherme pode restaurar pelo painel. */
export async function deleteBlockApi(id: string, bot: string) {
  const b = await rawBlock(id);
  await trashBlock(id, `bot ${bot}`);
  await history(id, bot, "Moveu o bloco para a lixeira");
  return { apagado: true, id: b.id, lixeira: "Fica 30 dias na Lixeira do painel e pode ser restaurado pelo Guilherme." };
}

export async function deleteMediaApi(id: string, mediaId: string, bot: string) {
  await rawBlock(id);
  if (!UUID.test(mediaId)) throw new ApiError(404, "Mídia não encontrada.");
  const { data: m } = await db().from("block_media").select("id, kind").eq("id", mediaId).eq("block_id", id).is("deleted_at", null).maybeSingle();
  if (!m) throw new ApiError(404, "Mídia não encontrada neste bloco.");
  await trashMedia([mediaId], `bot ${bot}`);
  await history(id, bot, `Moveu ${m.kind === "video" ? "o vídeo" : m.kind === "cover" ? "a capa" : "uma imagem"} para a lixeira`);
  return getBlockApi(id);
}

// ---------------------------------------------------------------------------
// Métricas do Instagram (só leitura; os números vêm do mLabs pela rotina do Claude)
// ---------------------------------------------------------------------------

const todaySP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const round = (n: number | null, d = 0) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Resumo do mês (mesmas regras da página da cliente), top 3, posts e seguidores. */
export async function clientMetrics(slug: string, p: URLSearchParams) {
  const c = await clientBySlug(slug);
  const today = todaySP();
  const dias = Math.min(150, Math.max(1, Number(p.get("dias") ?? 90) || 90));
  const [[m], blocks] = await Promise.all([
    loadMetrics([c.id]),
    loadBlocks((q) => q.eq("client_id", c.id).neq("format", "roteiro").gte("date", addDays(today, -150))),
  ]);
  if (!m?.syncedAt) {
    return { cliente: c.slug, sincronizado_em: null, aguardando_sincronizacao: true, resumo_do_mes: null, top3: [], posts: [], seguidores: [] };
  }
  const s = summarize(m, today);
  const blockOf = matchPosts(m.posts, blocks);
  const post = (x: (typeof m.posts)[number]) => ({
    id: x.id,
    data: x.date,
    formato: x.format,
    link: x.permalink,
    legenda: x.caption,
    alcance: x.reach,
    visualizacoes: x.views,
    curtidas: x.likes,
    comentarios: x.comments,
    salvamentos: x.saves,
    compartilhamentos: x.shares,
    estrela: s.starred.has(x.id),
    bloco_id: blockOf.get(x.id) ?? null,
  });
  const since = addDays(today, -dias);
  return {
    cliente: c.slug,
    sincronizado_em: m.syncedAt,
    aguardando_sincronizacao: false,
    resumo_do_mes: {
      periodo: { de: s.from, ate: s.to },
      comparado_com: { de: s.prevFrom, ate: s.prevTo },
      posts: s.postCount,
      alcance_medio: round(s.avgReach),
      alcance_medio_variacao_pct: round(s.avgReachDelta, 1),
      seguidores: s.followers,
      seguidores_ganhos: s.followersGain,
      seguidores_ganhos_desde: s.followersSince,
      seguidores_ganhos_mes_anterior: s.followersGainPrev,
      salvamentos: s.saves,
      salvamentos_variacao_pct: round(s.savesDelta, 1),
      compartilhamentos: s.shares,
      compartilhamentos_variacao_pct: round(s.sharesDelta, 1),
      media_alcance_90_dias: round(s.baseline),
      posts_com_estrela_no_mes: s.starredThisMonth,
    },
    top3: s.top.map((x) => ({ ...post(x), motivo: x.reason || null })),
    posts: m.posts.filter((x) => x.date >= since).sort((a, b) => b.date.localeCompare(a.date)).map(post),
    seguidores: m.followers.map((f) => ({ data: f.date, seguidores: f.followers })),
    regras: "Mês atual (dia 1 até hoje) contra os mesmos dias do mês anterior. Estrela = alcance acima da média dos últimos 90 dias. Top 3 = maior alcance + salvamentos + compartilhamentos.",
  };
}

// ---------------------------------------------------------------------------
// Dias de produção (evento no calendário com a lista de roteiros para gravar)
// ---------------------------------------------------------------------------

const PROD_STATES: ProductionState[] = ["pendente", "gravado", "oculto"];

async function eventWithClient(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, "Dia de produção não encontrado.");
  const { data } = await db().from("events").select(`${EVENT_COLS}, clients(slug, active)`).eq("id", id).is("deleted_at", null).maybeSingle();
  const c = (data as { clients?: { slug: string; active: boolean } } | null)?.clients;
  if (!data || !c?.active) throw new ApiError(404, "Dia de produção não encontrado.");
  return { event: mapEvents([data])[0], slug: c.slug };
}

const serializeEvent = (e: ReturnType<typeof mapEvents>[number], slug: string) => ({
  id: e.id, cliente: slug, data: e.date, titulo: e.title, observacoes: e.notes, link: `${PANEL_URL}/c/${slug}/producao/${e.id}`,
});

export async function clientProductionDays(slug: string, p: URLSearchParams) {
  const c = await clientBySlug(slug);
  const de = ymdParam(p.get("de"), "de"), ate = ymdParam(p.get("ate"), "ate");
  let q = db().from("events").select(EVENT_COLS).eq("client_id", c.id).eq("kind", "producao").is("deleted_at", null);
  if (de) q = q.gte("date", de);
  if (ate) q = q.lte("date", ate);
  const { data, error } = await q.order("date");
  if (error) throw error;
  return mapEvents(data ?? []).map((e) => serializeEvent(e, c.slug));
}

/** O dia com a lista do mesmo jeito que o painel mostra: para gravar (na ordem), gravados e escondidos. */
export async function getProductionDay(id: string) {
  const { event, slug } = await eventWithClient(id);
  const prod = await loadProduction(id, event.clientId);
  if (!prod) throw new ApiError(404, "Dia de produção não encontrado.");
  const items = new Map(prod.items.map((i) => [i.blockId, i]));
  const elsewhere = new Set(prod.doneElsewhere);
  const blocks = (await loadBlocks((q) => q.eq("client_id", event.clientId))).filter((b) => {
    const it = items.get(b.id);
    return b.format === "roteiro" ? !elsewhere.has(b.id) || !!it : it?.state === "gravado";
  });
  const pos = (b: Block) => items.get(b.id)?.position ?? Number.MAX_SAFE_INTEGER;
  blocks.sort((a, b) => pos(a) - pos(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const st = (b: Block) => items.get(b.id)?.state ?? "pendente";
  const row = (b: Block) => ({ ...serialize(b, slug, false), estado: st(b) });
  return {
    ...serializeEvent(event, slug),
    para_gravar: blocks.filter((b) => st(b) === "pendente").map(row),
    gravados: blocks.filter((b) => st(b) === "gravado").map(row),
    escondidos: blocks.filter((b) => st(b) === "oculto").map(row),
  };
}

export async function createProductionDayApi(slug: string, body: Record<string, unknown>) {
  const c = await clientBySlug(slug);
  const date = ymdParam(body.data as string, "data");
  if (!date) throw new ApiError(400, "Informe a data (AAAA-MM-DD).");
  const title = (text(body.titulo, "titulo", 120) ?? "").trim() || "Produção de conteúdo";
  const notes = text(body.observacoes, "observacoes", 4000) ?? "";
  const { data, error } = await db().from("events").insert({ client_id: c.id, date, kind: "producao", title, notes }).select("id").single();
  if (error) throw error;
  return getProductionDay(data.id);
}

export async function updateProductionDayApi(id: string, body: Record<string, unknown>) {
  await eventWithClient(id);
  const patch: Record<string, string> = {};
  const date = ymdParam(body.data as string | undefined, "data");
  if (date) patch.date = date;
  const t = text(body.titulo, "titulo", 120);
  if (t !== undefined) patch.title = t.trim() || "Produção de conteúdo";
  const n = text(body.observacoes, "observacoes", 4000);
  if (n !== undefined) patch.notes = n;
  if (Object.keys(patch).length) {
    const { error } = await db().from("events").update(patch).eq("id", id);
    if (error) throw error;
  }
  return getProductionDay(id);
}

export async function deleteProductionDayApi(id: string, bot: string) {
  await eventWithClient(id);
  await trashEvent(id, `bot ${bot}`);
  return { apagado: true, id, lixeira: "Fica 30 dias na Lixeira do painel e pode ser restaurado pelo Guilherme." };
}

/** Marca um roteiro do dia: pendente (para gravar), gravado ou oculto. Só visual: o bloco não muda. */
export async function setProductionStateApi(id: string, blockId: string, body: Record<string, unknown>) {
  const { event } = await eventWithClient(id);
  const state = String(body.estado ?? "") as ProductionState;
  if (!PROD_STATES.includes(state)) throw new ApiError(400, `estado inválido: use ${PROD_STATES.join(", ")}.`);
  if (!UUID.test(blockId)) throw new ApiError(404, "Bloco não encontrado.");
  const { data: b } = await db().from("blocks").select("id").eq("id", blockId).eq("client_id", event.clientId).is("deleted_at", null).maybeSingle();
  if (!b) throw new ApiError(404, "Bloco não encontrado nesta cliente.");
  const { data: cur } = await db().from("production_items").select("position").eq("event_id", id).eq("block_id", blockId).maybeSingle();
  let position = cur?.position as number | undefined;
  if (position === undefined) {
    const { data: last } = await db().from("production_items").select("position").eq("event_id", id).order("position", { ascending: false }).limit(1);
    position = (last?.[0]?.position ?? -1) + 1;
  }
  const { error } = await db().from("production_items").upsert(
    { event_id: id, block_id: blockId, position, state, updated_at: new Date().toISOString() },
    { onConflict: "event_id,block_id" },
  );
  if (error) throw error;
  return getProductionDay(id);
}

/** Nova ordem da lista "para gravar" (ids dos roteiros). Não muda a data de publicação. */
export async function setProductionOrderApi(id: string, body: Record<string, unknown>) {
  const { event } = await eventWithClient(id);
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => UUID.test(String(x))) || new Set(ids).size !== ids.length) {
    throw new ApiError(400, 'Envie "ids": a lista de roteiros na nova ordem, sem repetir.');
  }
  if (ids.length) {
    const list = ids.map(String);
    const { data } = await db().from("blocks").select("id").eq("client_id", event.clientId).in("id", list);
    if ((data ?? []).length !== list.length) throw new ApiError(404, "Algum bloco não é desta cliente.");
    const { data: current } = await db().from("production_items").select("block_id, state").eq("event_id", id).in("block_id", list);
    const state = new Map((current ?? []).map((c) => [c.block_id as string, c.state as string]));
    const rows = list.map((x, position) => ({
      event_id: id, block_id: x, position, state: state.get(x) ?? "pendente", updated_at: new Date().toISOString(),
    }));
    const { error } = await db().from("production_items").upsert(rows, { onConflict: "event_id,block_id" });
    if (error) throw error;
  }
  return getProductionDay(id);
}

// ---------------------------------------------------------------------------
// Aba Tendências. Os bots leem tudo e criam ou editam rascunhos; liberar para a
// cliente continua só com a Straut, pelo painel.
// ---------------------------------------------------------------------------

const TREND_KINDS = ["mercado", "referencia", "stories"] as const;
const TREND_GROUP: Record<string, string> = { mercado: "tendencia_do_mes", referencia: "referencias", stories: "stories" };

const serializeTrend = (t: TrendItem) => ({
  id: t.id, semana: t.weekOf, tipo: t.kind, titulo: t.title, texto: t.body, perfil: t.handle || null, link: t.link || null,
  destaque: t.stat || null, como_adaptar: t.adapt || null, passos: t.steps, posicao: t.position, criado_por: t.createdBy,
  liberado: t.published,
});

function mondayOf(ymd: string) {
  const wd = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return addDays(ymd, -((wd + 6) % 7));
}

type TrendRow = Parameters<typeof trendToBlock>[0] & { published_at: string | null };

async function trendWithClient(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, "Item não encontrado.");
  const { data } = await db().from("trend_items").select(`${TREND_COLS}, clients(slug, active)`)
    .eq("id", id).is("deleted_at", null).in("kind", [...TREND_KINDS]).maybeSingle();
  const c = (data as { clients?: { slug: string; active: boolean } } | null)?.clients;
  if (!data || !c?.active) throw new ApiError(404, "Item não encontrado.");
  return { row: data as unknown as TrendRow, item: mapTrends([data])[0], slug: c.slug };
}

/** Semanas da cliente (a mais recente primeiro), com os itens agrupados por tipo. */
export async function clientTrends(slug: string, p: URLSearchParams) {
  const c = await clientBySlug(slug);
  const semana = ymdParam(p.get("semana"), "semana");
  let q = db().from("trend_items").select(TREND_COLS).eq("client_id", c.id).is("deleted_at", null).in("kind", [...TREND_KINDS]);
  if (semana) q = q.eq("week_of", mondayOf(semana));
  const { data, error } = await q.order("week_of", { ascending: false }).order("position").limit(500);
  if (error) throw error;
  const items = mapTrends(data ?? []);
  const max = Math.min(12, Math.max(1, Number(p.get("semanas") ?? 4) || 4));
  const weeks = [...new Set(items.map((i) => i.weekOf))].slice(0, max);
  return weeks.map((w) => {
    const list = items.filter((i) => i.weekOf === w);
    return {
      semana: w,
      liberada: list.length > 0 && list.every((i) => i.published),
      link: `${PANEL_URL}/c/${c.slug}/tendencias`,
      ...Object.fromEntries(TREND_KINDS.map((k) => [TREND_GROUP[k], list.filter((i) => i.kind === k).map(serializeTrend)])),
    };
  });
}

function trendFields(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || body.tipo !== undefined) {
    if (!TREND_KINDS.includes(body.tipo as (typeof TREND_KINDS)[number])) throw new ApiError(400, `tipo inválido: use ${TREND_KINDS.join(", ")}.`);
    out.kind = body.tipo;
  }
  const map: [string, string, number][] = [
    ["titulo", "title", 200], ["texto", "body", 3000], ["perfil", "handle", 80], ["link", "link", 400], ["destaque", "stat", 80], ["como_adaptar", "adapt", 1000],
  ];
  for (const [api, col, max] of map) {
    const v = body[api] === null ? "" : text(body[api], api, max);
    if (v !== undefined) out[col] = v.trim();
  }
  if (typeof out.handle === "string" && out.handle) out.handle = `@${out.handle.replace(/^@/, "")}`;
  if (typeof out.link === "string" && out.link && !/^https?:\/\//i.test(out.link)) throw new ApiError(400, "link precisa começar com https://");
  if (body.passos !== undefined) {
    if (!Array.isArray(body.passos) || body.passos.length > 12) throw new ApiError(400, '"passos" deve ser uma lista de até 12 textos.');
    out.steps = body.passos.map((x) => String(x).trim().slice(0, 400)).filter(Boolean);
  }
  return out;
}

export async function createTrendApi(slug: string, bot: string, body: Record<string, unknown>) {
  const c = await clientBySlug(slug);
  const week = mondayOf(ymdParam(body.semana as string | undefined, "semana") ?? todaySP());
  const fields = trendFields(body, false);
  if (!fields.title && !fields.handle) throw new ApiError(400, "Informe o titulo (ou o perfil, para referências).");
  if (fields.kind === "referencia" && !fields.link) throw new ApiError(400, "Referência precisa do link do post real.");
  const { data: weekItems } = await db().from("trend_items").select("position, published_at").eq("client_id", c.id).eq("week_of", week).is("deleted_at", null);
  if ((weekItems ?? []).some((w) => w.published_at)) {
    throw new ApiError(409, "Esta semana já foi liberada para a cliente. Peça ao Guilherme para esconder a semana antes de mudar.");
  }
  const position = (weekItems ?? []).reduce((m, w) => Math.max(m, w.position as number), -1) + 1;
  const { data, error } = await db().from("trend_items")
    .insert({ ...fields, client_id: c.id, week_of: week, position, created_by: `bot ${bot}`, published_at: null })
    .select(TREND_COLS).single();
  if (error) throw error;
  return { ...serializeTrend(mapTrends([data])[0]), cliente: c.slug };
}

export async function getTrendApi(id: string) {
  const { item, slug } = await trendWithClient(id);
  return { ...serializeTrend(item), cliente: slug };
}

/** Só rascunhos: o que a cliente já vê fica com a Straut. */
async function draftOnly(id: string) {
  const t = await trendWithClient(id);
  if (t.row.published_at) throw new ApiError(409, "Este item já foi liberado para a cliente. Só a Straut muda, pelo painel.");
  return t;
}

export async function updateTrendApi(id: string, body: Record<string, unknown>) {
  await draftOnly(id);
  const fields = trendFields(body, true);
  if (Object.keys(fields).length) {
    const { error } = await db().from("trend_items").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }
  return getTrendApi(id);
}

export async function deleteTrendApi(id: string, bot: string) {
  await draftOnly(id);
  await trashTrend(id, `bot ${bot}`);
  return { apagado: true, id, lixeira: "Fica 30 dias na Lixeira do painel e pode ser restaurado pelo Guilherme." };
}

/** Referência (ou outro item) vira roteiro no calendário. */
export async function trendToScriptApi(id: string, bot: string, body: Record<string, unknown>) {
  const { row } = await trendWithClient(id);
  const date = ymdParam(body.data as string | undefined, "data") ?? todaySP();
  const blockId = await trendToBlock(row, date, bot);
  return getBlockApi(blockId);
}
