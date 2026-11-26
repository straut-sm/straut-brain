"use client";

import { ArrowDownRight, ArrowUpRight, Clock, ExternalLink, Minus, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Block } from "@/lib/types";
import { MONTHS, todayYmd } from "@/lib/dates";
import { FORMATS } from "@/lib/meta";
import { type ClientMetrics, type IgPost, type Summary, fmtInt, matchPosts, summarize } from "@/lib/metrics";
import PostArt from "./PostArt";
import { SectionTitle } from "./ui";

export const UP = { line: "#5c8a62", text: "#3f6b46", bg: "#e7efe5" };
export const DOWN = { line: "#b9583a", text: "#9a4429", bg: "#f6e6df" };
export const FLAT = { line: "#424241", text: "#424241", bg: "#efedea" };

/** Abaixo de 5% para cima ou para baixo conta como estável. */
export function toneOf(delta: number | null) {
  if (delta === null || Math.abs(delta) < 5) return FLAT;
  return delta > 0 ? UP : DOWN;
}

export function DeltaPill({ delta, suffix = "" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return null;
  const t = toneOf(delta);
  const Icon = t === UP ? ArrowUpRight : t === DOWN ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: t.bg, color: t.text }}>
      <Icon size={12} strokeWidth={2.2} />
      {t === FLAT ? "estável" : `${Math.round(Math.abs(delta))}%${suffix}`}
    </span>
  );
}

/** Curva suave (Catmull-Rom → Bézier) com área clara embaixo e ponto no fim. */
export function Sparkline({ values, color, height = 52 }: { values: number[]; color: string; height?: number }) {
  const W = 280;
  const pad = 6;
  if (values.length < 2) {
    return <div style={{ height }} className="flex items-end"><div className="h-px w-full bg-mist" /></div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (W - pad * 2) + pad,
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const last = pts[pts.length - 1];
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden className="block overflow-visible">
        <path d={`${d} L${last[0]},${height} L${pts[0][0]},${height}Z`} fill={color} opacity={0.1} />
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Ponto fora do SVG para não esticar junto com a curva */}
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper"
        style={{ left: `${(last[0] / W) * 100}%`, top: last[1], background: color }}
      />
    </div>
  );
}

function periodLabel(s: Summary) {
  const m = MONTHS[Number(s.to.slice(5, 7)) - 1].toLowerCase();
  const pm = MONTHS[Number(s.prevTo.slice(5, 7)) - 1].toLowerCase();
  const d = Number(s.to.slice(8));
  return `1 a ${d} de ${m} · comparado com 1 a ${Number(s.prevTo.slice(8))} de ${pm}`;
}

function syncLabel(iso: string) {
  const t = new Date(iso);
  return `Atualizado em ${t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function Card({ label, value, sub, delta, series, hero = false }: {
  label: string; value: string; sub?: React.ReactNode; delta: number | null; series: number[]; hero?: boolean;
}) {
  const t = toneOf(delta);
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-mist bg-paper p-4 md:p-5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted">{label}</p>
        <DeltaPill delta={delta} />
      </div>
      <p className={`font-display font-semibold leading-none tracking-tight tabular-nums ${hero ? "text-[38px] md:text-[44px]" : "text-[30px] md:text-[34px]"}`}>{value}</p>
      <p className="mt-1.5 min-h-[16px] text-[11px] text-muted">{sub}</p>
      <div className="mt-auto pt-3"><Sparkline values={series} color={t.line} /></div>
    </div>
  );
}

/** Seção "Desempenho no Instagram" da página da cliente. */
export default function MetricsSection({ metrics, blocks, canEdit, onOpen }: {
  metrics?: ClientMetrics; blocks: Block[]; canEdit: boolean; onOpen: (blockId: string) => void;
}) {
  const today = todayYmd();
  const s = useMemo(() => (metrics?.syncedAt ? summarize(metrics, today) : null), [metrics, today]);
  const match = useMemo(() => (metrics ? matchPosts(metrics.posts, blocks) : new Map<string, string>()), [metrics, blocks]);

  if (!metrics?.syncedAt || !s) return <Waiting />;

  const gain = s.followersGain;
  const followersDelta = gain !== null && s.followersGainPrev !== null && s.followersGainPrev > 0
    ? ((gain - s.followersGainPrev) / s.followersGainPrev) * 100 : null;

  return (
    <section className="mb-9">
      <SectionTitle right={<span className="hidden text-[11px] text-muted sm:inline">{syncLabel(metrics.syncedAt)}</span>}>
        Desempenho no Instagram
      </SectionTitle>
      <p className="-mt-2 mb-3 text-xs text-muted">{periodLabel(s)}<span className="block sm:hidden">{syncLabel(metrics.syncedAt)}</span></p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <Card
            hero
            label="Alcance médio"
            value={s.avgReach === null ? "—" : fmtInt(s.avgReach)}
            sub={s.postCount ? `por post · ${s.postCount} ${s.postCount === 1 ? "post" : "posts"} no mês` : "Nenhum post no mês ainda"}
            delta={s.avgReachDelta}
            series={s.series.reach}
          />
        </div>
        <div className="col-span-2 lg:col-span-1">
        <Card
          label="Seguidores"
          value={s.followers === null ? "—" : fmtInt(s.followers)}
          sub={gain === null ? undefined : <span style={{ color: gain > 0 ? UP.text : gain < 0 ? DOWN.text : undefined }}>{gain > 0 ? "+" : ""}{fmtInt(gain)} {s.followersSince ? `desde ${s.followersSince.slice(8)}/${s.followersSince.slice(5, 7)}` : "no mês"}</span>}
          delta={followersDelta}
          series={s.series.followers}
        />
        </div>
        <Card label="Salvamentos" value={fmtInt(s.saves)} sub="no mês" delta={s.savesDelta} series={s.series.saves} />
        <Card label="Compartilhamentos" value={fmtInt(s.shares)} sub="no mês" delta={s.sharesDelta} series={s.series.shares} />
      </div>

      {s.top.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-graphite">
            <Star size={13} className="fill-[#e0b04a] text-[#e0b04a]" /> Melhores posts do mês
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {s.top.map((p, i) => (
              <TopPost
                key={p.id}
                post={p}
                rank={i + 1}
                clientId={metrics.clientId}
                block={blocks.find((b) => b.id === match.get(p.id))}
                canEdit={canEdit}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      )}
      {s.baseline !== null && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <Star size={11} className="fill-[#e0b04a] text-[#e0b04a]" />
          No calendário, a estrela marca os posts com alcance acima de {fmtInt(s.baseline)} (média dos últimos 90 dias).
        </p>
      )}
    </section>
  );
}

function TopPost({ post, rank, clientId, block, canEdit, onOpen }: {
  post: IgPost; rank: number; clientId: string; block?: Block; canEdit: boolean; onOpen: (id: string) => void;
}) {
  const store = useStore();
  const [thumbOk, setThumbOk] = useState(!!post.thumbnailUrl);
  const [draft, setDraft] = useState(post.reason);
  const cover = block?.media.find((m) => m.kind === "cover" || m.kind === "image");
  const Icon = FORMATS[post.format].icon;
  const title = block?.title || post.caption.split("\n")[0] || "Post";

  const art = thumbOk ? (
    <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" onError={() => setThumbOk(false)} referrerPolicy="no-referrer" />
  ) : cover?.url ? (
    <img src={cover.url} alt="" className="h-full w-full object-cover" />
  ) : (
    <PostArt hue={block?.hue ?? 30} title="" small className="h-full w-full" />
  );

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-mist bg-paper p-3">
      <div className="flex gap-3">
        <button
          onClick={block ? () => onOpen(block.id) : undefined}
          disabled={!block}
          className="relative h-[84px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-cream"
          aria-label={block ? "Abrir conteúdo" : undefined}
        >
          {art}
          <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-display text-[11px] font-semibold text-paper">{rank}º</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 flex items-center gap-1 text-[11px] text-muted">
            <Icon size={12} /> {FORMATS[post.format].label} · {post.date.slice(8)}/{post.date.slice(5, 7)}
          </p>
          <p className="line-clamp-2 text-sm font-medium leading-snug">{title}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-graphite tabular-nums">
            <span><b className="font-semibold">{fmtInt(post.reach)}</b> alcance</span>
            <span><b className="font-semibold">{fmtInt(post.saves)}</b> salv.</span>
            <span><b className="font-semibold">{fmtInt(post.shares)}</b> compart.</span>
          </div>
        </div>
      </div>
      {canEdit ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft.trim() !== post.reason && store.setPostReason(clientId, post.id, draft)}
          rows={3}
          placeholder="Por que este post foi bem?"
          className="mt-2.5 w-full resize-none [field-sizing:content] rounded-lg border border-transparent bg-cream/70 px-2.5 py-2 text-xs leading-relaxed text-graphite placeholder:text-muted hover:border-mist focus:border-sand focus:bg-paper focus:outline-none"
        />
      ) : post.reason ? (
        <p className="mt-2.5 rounded-lg bg-cream/70 px-2.5 py-2 text-xs leading-relaxed text-graphite">{post.reason}</p>
      ) : null}
      {post.permalink && (
        <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 self-start text-[11px] font-medium text-muted hover:text-ink">
          Ver no Instagram <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

/** Cliente sem sincronização com o mLabs: cartões desfocados. */
function Waiting() {
  return (
    <section className="mb-9">
      <SectionTitle>Desempenho no Instagram</SectionTitle>
      <div className="relative">
        <div className="pointer-events-none grid select-none grid-cols-2 gap-3 opacity-60 blur-[6px] lg:grid-cols-4" aria-hidden>
          {[[0, 6, 4, 9, 7, 12], [3, 4, 6, 6, 8, 9], [5, 3, 6, 4, 7, 5], [2, 5, 3, 6, 4, 7]].map((v, i) => (
            <div key={i} className={i < 2 ? "col-span-2 lg:col-span-1" : ""}>
              <Card label="Carregando" value="0.000" delta={null} series={v} hero={i === 0} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-mist bg-paper">
            <Clock size={18} className="text-graphite" />
          </span>
          <p className="font-display text-base font-semibold">Aguardando sincronização</p>
          <p className="max-w-xs text-xs text-muted">Os números do Instagram aparecem aqui assim que a conta estiver ligada ao mLabs.</p>
        </div>
      </div>
    </section>
  );
}
