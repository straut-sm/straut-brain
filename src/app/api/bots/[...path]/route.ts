import { NextResponse, type NextRequest } from "next/server";
import {
  ApiError, UUID, acceptSuggestionApi, advanceApi, attachMediaApi, checkBot, checkKey, checkRate, clientBlocks,
  clientSummary, commentApi, createBlockApi, deleteBlockApi, deleteMediaApi, getBlockApi, listClients, logRequest,
  pendencies, publishApi, reorderApi, searchBlocks, sendForApprovalApi, updateBlockApi, uploadUrls,
} from "@/lib/bots";

/*
 * API dos bots: /api/bots/...
 * Documentação: straut-team/integracoes/api-dos-bots.md
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };
type Handler = (a: { seg: string[]; q: URLSearchParams; bot: string; body: () => Promise<Record<string, unknown>> }) => Promise<unknown>;

const routes: { method: string; pattern: string[]; run: Handler; status?: number }[] = [
  // Leitura
  { method: "GET", pattern: ["clientes"], run: () => listClients() },
  { method: "GET", pattern: ["clientes", ":slug", "resumo"], run: ({ seg, q }) => clientSummary(seg[1], q.get("mes")) },
  { method: "GET", pattern: ["clientes", ":slug", "blocos"], run: ({ seg, q }) => clientBlocks(seg[1], q) },
  { method: "GET", pattern: ["pendencias"], run: () => pendencies() },
  { method: "GET", pattern: ["blocos"], run: ({ q }) => searchBlocks(q) },
  { method: "GET", pattern: ["blocos", ":id"], run: ({ seg }) => getBlockApi(seg[1]) },
  // Escrita (nada destrutivo)
  { method: "POST", pattern: ["clientes", ":slug", "blocos"], status: 201, run: async ({ seg, bot, body }) => createBlockApi(seg[1], bot, await body()) },
  { method: "PATCH", pattern: ["blocos", ":id"], run: async ({ seg, bot, body }) => updateBlockApi(seg[1], bot, await body()) },
  { method: "POST", pattern: ["blocos", ":id", "upload-url"], run: async ({ seg, body }) => uploadUrls(seg[1], await body()) },
  { method: "POST", pattern: ["blocos", ":id", "midias"], run: async ({ seg, bot, body }) => attachMediaApi(seg[1], bot, await body()) },
  { method: "PUT", pattern: ["blocos", ":id", "ordem-midias"], run: async ({ seg, bot, body }) => reorderApi(seg[1], bot, await body()) },
  { method: "POST", pattern: ["blocos", ":id", "avancar"], run: ({ seg, bot }) => advanceApi(seg[1], bot) },
  { method: "POST", pattern: ["blocos", ":id", "enviar-para-aprovacao"], run: ({ seg, bot }) => sendForApprovalApi(seg[1], bot) },
  { method: "POST", pattern: ["blocos", ":id", "comentarios"], run: async ({ seg, bot, body }) => commentApi(seg[1], bot, await body()) },
  { method: "POST", pattern: ["blocos", ":id", "publicar"], run: ({ seg, bot }) => publishApi(seg[1], bot) },
  { method: "POST", pattern: ["blocos", ":id", "aceitar-sugestao"], run: ({ seg, bot }) => acceptSuggestionApi(seg[1], bot) },
  // Apagar = lixeira (30 dias, restaurável pelo painel)
  { method: "DELETE", pattern: ["blocos", ":id"], run: ({ seg, bot }) => deleteBlockApi(seg[1], bot) },
  { method: "DELETE", pattern: ["blocos", ":id", "midias", ":midia"], run: ({ seg, bot }) => deleteMediaApi(seg[1], seg[3], bot) },
];

const matches = (pattern: string[], seg: string[]) =>
  pattern.length === seg.length && pattern.every((p, i) => p.startsWith(":") || p === seg[i]);

async function handle(req: NextRequest, ctx: Ctx) {
  const seg = (await ctx.params).path ?? [];
  const route = `/${seg.join("/")}`;
  const blockId = seg[0] === "blocos" && UUID.test(seg[1] ?? "") ? seg[1] : null;
  let bot = "desconhecido";
  let status = 200;
  let payload: unknown;
  let authed = false;

  try {
    checkKey(req.headers.get("authorization"));
    authed = true;
    bot = checkBot(req.headers.get("x-bot"));
    await checkRate(bot);

    const candidates = routes.filter((r) => matches(r.pattern, seg));
    const r = candidates.find((x) => x.method === req.method);
    if (!r) {
      throw candidates.length
        ? new ApiError(405, `Método não aceito aqui. Use: ${candidates.map((x) => x.method).join(", ")}.`)
        : new ApiError(404, "Rota não encontrada. Veja a documentação em straut-team/integracoes/api-dos-bots.md.");
    }
    const body = async () => {
      try {
        const j = await req.json();
        if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error();
        return j as Record<string, unknown>;
      } catch {
        throw new ApiError(400, "Corpo da requisição precisa ser um JSON (objeto).");
      }
    };
    payload = { ok: true, dados: await r.run({ seg, q: req.nextUrl.searchParams, bot, body }) };
    status = r.status ?? 200;
  } catch (e) {
    if (e instanceof ApiError) {
      status = e.status;
      payload = { ok: false, erro: e.message };
    } else {
      console.error("[api/bots]", req.method, route, e);
      status = 500;
      payload = { ok: false, erro: "Erro interno. Tente de novo; se continuar, avise o Guilherme." };
    }
  }

  // Registro (só de quem tem a chave, para ninguém encher a tabela de fora)
  if (authed) await logRequest({ bot, method: req.method, route, blockId, status }).catch((e) => console.error("[api/bots] log", e));

  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
