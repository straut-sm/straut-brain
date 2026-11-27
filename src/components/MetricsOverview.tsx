"use client";

import { AlertCircle, Clock, Star } from "lucide-react";
import type { Client } from "@/lib/types";
import { MONTHS } from "@/lib/dates";
import { type Summary, fmtInt } from "@/lib/metrics";
import { DOWN, DeltaPill, FLAT, Sparkline, UP, toneOf } from "./Metrics";

/*
 * Desempenho no Instagram dentro do cartão de cada cliente (página principal da Straut).
 * O cálculo vem de summarize() em src/lib/metrics.ts.
 */

export function syncShort(iso: string) {
  const t = new Date(iso);
  const sameDay = t.toDateString() === new Date().toDateString();
  const hm = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `hoje, ${hm}` : `${t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hm}`;
}

export function ClientAvatar({ client }: { client: Client }) {
  const initials = client.name.replace(/^(Dra?\.?\s+)/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return client.avatarUrl ? (
    <img src={client.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-paper" style={{ background: client.color }}>{initials}</span>
  );
}

function Mini({ label, value, extra, color }: { label: string; value: string; extra?: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] text-muted">{label}</p>
      <p className="truncate text-[13px] font-medium tabular-nums">
        {value} {extra && <span className="text-[10px] font-medium" style={{ color }}>{extra}</span>}
      </p>
    </div>
  );
}

const arrow = (d: number | null) => {
  if (d === null) return undefined;
  const t = toneOf(d);
  return t === FLAT ? "=" : `${t === UP ? "↑" : "↓"}${Math.round(Math.abs(d))}%`;
};

/** Números do mês: alcance médio, gráfico, seguidores, salvamentos, compartilhamentos e um aviso. */
export function CardMetrics({ s }: { s: Summary }) {
  const t = toneOf(s.avgReachDelta);
  const gain = s.followersGain;
  const monthStars = s.starredThisMonth;
  const falling = s.avgReachDelta !== null && s.avgReachDelta <= -15;
  const prevMonth = MONTHS[Number(s.prevTo.slice(5, 7)) - 1].toLowerCase();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">Alcance médio por post</p>
        <DeltaPill delta={s.avgReachDelta} />
      </div>
      <p className="mt-0.5 font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums">{s.avgReach === null ? "—" : fmtInt(s.avgReach)}</p>
      <div className="my-1.5"><Sparkline values={s.series.reach} color={t.line} height={36} /></div>
      <div className="grid grid-cols-3 gap-2">
        <Mini
          label="Seguidores"
          value={s.followers === null ? "—" : fmtInt(s.followers)}
          extra={gain === null ? undefined : `${gain > 0 ? "+" : ""}${fmtInt(gain)}`}
          color={gain !== null && gain < 0 ? DOWN.text : UP.text}
        />
        <Mini label="Salvamentos" value={fmtInt(s.saves)} extra={arrow(s.savesDelta)} color={toneOf(s.savesDelta).text} />
        <Mini label="Compart." value={fmtInt(s.shares)} extra={arrow(s.sharesDelta)} color={toneOf(s.sharesDelta).text} />
      </div>
      {falling ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]" style={{ background: "#fbf1ec", color: DOWN.text }}>
          <AlertCircle size={12} className="shrink-0" /> {Math.round(Math.abs(s.avgReachDelta!))}% menor que em {prevMonth}
        </p>
      ) : monthStars > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-cream px-2 py-1 text-[11px] text-graphite">
          <Star size={12} className="shrink-0 fill-[#e0b04a] text-[#e0b04a]" /> {monthStars} {monthStars === 1 ? "post acima" : "posts acima"} da média
        </p>
      ) : null}
    </div>
  );
}

/** Cliente ainda sem dados do mLabs. */
export function CardMetricsWaiting() {
  return (
    <div className="flex min-h-[132px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sand text-center">
      <Clock size={16} className="text-muted" />
      <p className="text-[11px] text-muted">Aguardando sincronização<br />com o mLabs</p>
    </div>
  );
}
