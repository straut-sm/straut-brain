import { NextResponse, type NextRequest } from "next/server";
import { purgeExpired } from "@/lib/trash";

/**
 * Rotina diária da Vercel (vercel.json → crons): apaga de vez o que está há mais de 30 dias na lixeira.
 * Só mexe no que já venceu, então chamar de novo não causa estrago. Se CRON_SECRET estiver
 * configurada, a Vercel manda "Authorization: Bearer <CRON_SECRET>" e ela é exigida.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const apagados = await purgeExpired();
    return NextResponse.json({ ok: true, apagados });
  } catch (e) {
    console.error("[cron/lixeira]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
