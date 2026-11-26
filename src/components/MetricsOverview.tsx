"use client";

import { AlertCircle, ArrowRight, Clock, Star } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { Client } from "@/lib/types";
import { MONTHS, todayYmd } from "@/lib/dates";
import { type ClientMetrics, type Summary, fmtInt, summarize } from "@/lib/metrics";
import { DOWN, DeltaPill, FLAT, Sparkline, UP, toneOf } from "./Metrics";
import { SectionTitle } from "./ui";

/** Resumo do desempenho de todas as clientes (página principal da Straut). */
export default function MetricsOverview({ clients, metrics }: { clients: Client[]; metrics: ClientMetrics[] }) {
  const today = todayYmd();
  const rows = useMemo(() => clients.map((c) => {
    const m = metrics.find((x) => x.clientId === c.id);
    return { client: c, s: m?.syncedAt ? summarize(m, today) : null, syncedAt: m?.syncedAt ?? null };
  }).sort((a, b) => Number(!!b.s) - Number(!!a.s) || a.client.name.localeCompare(b.client.name)), [clients, metrics, today]);

  if (!rows.length) return null;
  const last = rows.map((r) => r.syncedAt).filter(Boolean).sort().pop();
  const month = MONTHS[Number(today.slice(5, 7)) - 1].toLowerCase();
  const synced = rows.filter((r) => r.s);
  const waiting = rows.filter((r) => !r.s);

  return (
    <section className="mb-8">
      <SectionTitle right={last && <span className="text-[11px] text-muted">mLabs {syncShort(last)}</span>}>
        Desempenho no Instagram <span className="ml-1 font-normal normal-case tracking-normal text-muted">· 1 a {Number(today.slice(8))} de {month}</span>
      </SectionTitle>
      {synced.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {synced.map(({ client, s }) => <ClientMetricCard key={client.id} client={client} s={s!} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {waiting.slice(0, 4).map(({ client }) => <WaitingCard key={client.id} client={client} />)}
        </div>
      )}
      {synced.length > 0 && waiting.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Clock size={13} /> Aguardando sincronização com o mLabs:
          {waiting.map(({ client }) => (
            <Link key={client.id} href={`/c/${client.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-paper px-2.5 py-0.5 text-graphite hover:border-sand hover:text-ink">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: client.color }} /> {client.name}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

function syncShort(iso: string) {
  const t = new Date(iso);
  const sameDay = t.toDateString() === new Date().toDateString();
  const hm = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `hoje, ${hm}` : `${t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hm}`;
}

function Avatar({ client }: { client: Client }) {
  const initials = client.name.replace(/^(Dra?\.?\s+)/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return client.avatarUrl ? (
    <img src={client.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-paper" style={{ background: client.color }}>{initials}</span>
  );
}

function Mini({ label, value, extra, color }: { label: string; value: string; extra?: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="truncate text-sm font-medium tabular-nums">
        {value} {extra && <span className="text-[11px] font-medium" style={{ color }}>{extra}</span>}
      </p>
    </div>
  );
}

const arrow = (d: number | null) => {
  if (d === null) return undefined;
  const t = toneOf(d);
  return t === FLAT ? "=" : `${t === UP ? "↑" : "↓"}${Math.round(Math.abs(d))}%`;
};

function ClientMetricCard({ client, s }: { client: Client; s: Summary }) {
  const t = toneOf(s.avgReachDelta);
  const gain = s.followersGain;
  const monthStars = s.starredThisMonth;
  const falling = s.avgReachDelta !== null && s.avgReachDelta <= -15;
  const prevMonth = MONTHS[Number(s.prevTo.slice(5, 7)) - 1].toLowerCase();

  return (
    <Link
      href={`/c/${client.slug}`}
      className="group flex min-w-0 flex-col rounded-2xl border border-mist bg-paper p-4 transition hover:border-sand hover:shadow-[0_6px_20px_-12px_rgba(28,28,28,0.3)]"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar client={client} />
        <p className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">{client.name}</p>
        <DeltaPill delta={s.avgReachDelta} />
      </div>
      <p className="text-[11px] text-muted">Alcance médio por post</p>
      <p className="font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums">{s.avgReach === null ? "—" : fmtInt(s.avgReach)}</p>
      <div className="my-2"><Sparkline values={s.series.reach} color={t.line} height={44} /></div>
      <div className="grid grid-cols-3 gap-2 border-t border-mist/70 pt-2.5">
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
        <p className="mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: "#fbf1ec", color: DOWN.text }}>
          <AlertCircle size={13} className="shrink-0" /> Alcance {Math.round(Math.abs(s.avgReachDelta!))}% menor que em {prevMonth}
        </p>
      ) : monthStars > 0 ? (
        <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-[11px] text-graphite">
          <Star size={12} className="shrink-0 fill-[#e0b04a] text-[#e0b04a]" /> {monthStars} {monthStars === 1 ? "post acima" : "posts acima"} da média este mês
        </p>
      ) : (
        <p className="mt-2.5 flex items-center gap-1 text-[11px] text-muted group-hover:text-ink">Ver detalhes <ArrowRight size={12} /></p>
      )}
    </Link>
  );
}

function WaitingCard({ client }: { client: Client }) {
  return (
    <Link href={`/c/${client.slug}`} className="relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-mist bg-paper p-4 hover:border-sand">
      <div className="pointer-events-none select-none opacity-50 blur-[5px]" aria-hidden>
        <div className="mb-3 flex items-center gap-2.5"><Avatar client={client} /><p className="font-display font-semibold">{client.name}</p></div>
        <p className="font-display text-[32px] font-semibold leading-none">0.000</p>
        <div className="my-2"><Sparkline values={[3, 5, 4, 6, 5, 7]} color="#8a8580" height={44} /></div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-mist bg-paper"><Clock size={17} className="text-graphite" /></span>
        <p className="font-display text-[15px] font-semibold">{client.name}</p>
        <p className="text-[11px] text-muted">Aguardando sincronização com o mLabs</p>
      </div>
    </Link>
  );
}
