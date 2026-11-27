import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./supabase/admin";
import type { PostFormat } from "./types";

/*
 * Regras da aba Tendências usadas pelo painel (actions.ts) e pela API dos bots (bots.ts).
 */

type TrendRow = {
  id: string; client_id: string; kind: string; title: string; body: string; handle: string;
  link: string; stat: string; adapt: string; steps: unknown;
};

/** Formato do roteiro que nasce de um item: Reels, a não ser que a referência seja carrossel ou foto. */
export function plannedFormatOf(t: Pick<TrendRow, "kind" | "link" | "stat">): PostFormat | null {
  if (t.kind === "stories") return null;
  if (t.kind !== "referencia" || /\/reels?\//i.test(t.link)) return "reels";
  if (/carross/i.test(t.stat)) return "carrossel";
  if (/foto|imagem/i.test(t.stat)) return "foto";
  if (/\/p\//i.test(t.link)) return "carrossel"; // post do feed sem tipo informado
  return "reels";
}

/** Texto do roteiro a partir do item (o que o post faz, como adaptar, passos e o link). */
export function scriptOf(t: TrendRow) {
  const steps = (Array.isArray(t.steps) ? t.steps : []).map((x, i) => `${i + 1}. ${String(x)}`);
  const ref = t.kind === "referencia" ? [t.handle, t.stat].filter(Boolean).join(" · ") : "";
  return [
    t.body,
    t.adapt && `${t.kind === "referencia" ? "Como adaptar" : "Dica"}: ${t.adapt}`,
    steps.length && steps.join("\n"),
    (t.link || ref) && `Referência: ${[ref, t.link].filter(Boolean).join(" — ")}`,
  ].filter(Boolean).join("\n\n");
}

/** Cria o roteiro no calendário e registra no histórico. Devolve o id do bloco. */
export async function trendToBlock(t: TrendRow, date: string, bot?: string) {
  const blockId = randomUUID();
  const title = t.title || (t.handle ? `Ideia inspirada em ${t.handle}` : "Ideia da aba Tendências");
  const { error } = await db().from("blocks").insert({
    id: blockId, client_id: t.client_id, date, title: title.slice(0, 200), script: scriptOf(t),
    planned_format: plannedFormatOf(t),
  });
  if (error) throw error;
  const { error: e2 } = await db().from("block_history").insert({
    block_id: blockId, author: "Straut", action: "Bloco criado como Roteiro a partir da aba Tendências", bot: bot ?? null,
  });
  if (e2) throw e2;
  return blockId;
}
