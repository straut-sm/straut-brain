"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Block, Client } from "@/lib/types";
import { FORMATS, STATUSES, statusLabel } from "@/lib/meta";
import { MONTHS, WEEKDAYS_SHORT, formatLong, inMonth, monthWeeks, todayYmd, ymd } from "@/lib/dates";
import { StatusDot } from "./ui";

export type CalendarProps = {
  blocks: Block[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onOpen: (id: string) => void;
  onAdd?: (date: string) => void;
  /** Quando existe, os blocos podem ser arrastados para outro dia (só no desktop). */
  onMove?: (id: string, date: string) => void;
  clientsById?: (id: string) => Client | undefined;
  /** Destaca só o que está aguardando aprovação (os demais ficam esmaecidos). */
  focusPending?: boolean;
  /** Mostra a bolinha de novidade (sugestão/comentário da cliente) — só para a Straut. */
  showNews?: boolean;
  headerExtra?: React.ReactNode;
  /** Filtros exibidos dentro do cartão, abaixo do cabeçalho do mês. */
  toolbar?: React.ReactNode;
};

const isPending = (b: Block) => b.status === "aguardando_aprovacao";

function sortBlocks(a: Block, b: Block) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.clientId.localeCompare(b.clientId);
}

export default function Calendar(props: CalendarProps) {
  const { year, month, onMonthChange, blocks, headerExtra, toolbar } = props;
  const monthBlocks = useMemo(
    () => blocks.filter((b) => inMonth(b.date, year, month)).sort(sortBlocks),
    [blocks, year, month],
  );

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <div className="rounded-2xl border border-mist bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist px-4 py-3 md:px-5">
        <div className="flex items-center gap-1">
          <button aria-label="Mês anterior" onClick={() => go(-1)} className="rounded-lg p-1.5 text-graphite hover:bg-cream">
            <ChevronLeft size={18} />
          </button>
          <h3 className="min-w-[150px] text-center font-display text-lg font-semibold">
            {MONTHS[month]} <span className="font-normal text-muted">{year}</span>
          </h3>
          <button aria-label="Próximo mês" onClick={() => go(1)} className="rounded-lg p-1.5 text-graphite hover:bg-cream">
            <ChevronRight size={18} />
          </button>
        </div>
        {headerExtra}
      </div>
      {toolbar && <div className="border-b border-mist px-4 py-2.5 md:px-5">{toolbar}</div>}
      <div className="hidden md:block">
        <DesktopGrid {...props} monthBlocks={monthBlocks} />
      </div>
      <div className="md:hidden">
        <MobileView {...props} monthBlocks={monthBlocks} />
      </div>
    </div>
  );
}

function Chip({ block, client, dim, onOpen, showNews, draggable = false, dragging = false, onDragStart, onDragEnd }: {
  block: Block; client?: Client; dim: boolean; onOpen: () => void; showNews?: boolean;
  draggable?: boolean; dragging?: boolean; onDragStart?: () => void; onDragEnd?: () => void;
}) {
  const F = FORMATS[block.format];
  const Icon = F.icon;
  const accent = client ? client.color : STATUSES[block.status].color;
  const hasNews = !!showNews && (!!block.suggestion || block.comments.some((c) => !c.seen && c.by === "Cliente"));
  return (
    <button
      onClick={onOpen}
      draggable={draggable}
      onDragStart={draggable ? (e) => {
        e.dataTransfer.setData("text/plain", block.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      } : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      title={draggable ? "Arraste para outro dia para mudar a data" : undefined}
      className={`group/chip relative w-full rounded-lg border border-mist bg-paper py-1.5 pl-2.5 pr-2 text-left transition hover:-translate-y-px hover:border-sand hover:shadow-[0_2px_10px_-4px_rgba(28,28,28,0.18)] ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : dim ? "opacity-30 hover:opacity-100" : ""}`}
    >
      <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r" style={{ background: accent }} />
      {client && (
        <span className="mb-0.5 block truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: client.color }}>
          {client.name}
        </span>
      )}
      <span className="flex items-start gap-1.5 text-[12px] leading-snug text-ink">
        <Icon size={12} strokeWidth={1.8} className="mt-[3px] shrink-0 text-muted" />
        <span className="line-clamp-2">{block.title}</span>
      </span>
      <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted">
        <StatusDot status={block.status} size={6} />
        <span className="truncate">{statusLabel(block.status, block.format)}</span>
        {hasNews && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9583a]" title="Novidade da cliente" />}
      </span>
    </button>
  );
}

function DesktopGrid({
  year, month, monthBlocks, onOpen, onAdd, onMove, clientsById, focusPending, showNews,
}: CalendarProps & { monthBlocks: Block[] }) {
  const weeks = monthWeeks(year, month);
  const today = todayYmd();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dragFrom = dragId ? monthBlocks.find((b) => b.id === dragId)?.date : undefined;
  const endDrag = () => { setDragId(null); setOver(null); };
  const byDay = useMemo(() => {
    const m = new Map<string, Block[]>();
    monthBlocks.forEach((b) => m.set(b.date, [...(m.get(b.date) ?? []), b]));
    return m;
  }, [monthBlocks]);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-mist">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-mist last:border-b-0">
          {week.map((day, di) => {
            if (day === null) return <div key={di} className="min-h-[112px] border-r border-mist bg-cream/50 last:border-r-0" />;
            const date = ymd(year, month, day);
            const items = byDay.get(date) ?? [];
            const isToday = date === today;
            return (
              <div
                key={di}
                onDragOver={onMove && dragId ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== date) setOver(date);
                } : undefined}
                onDragLeave={onMove && dragId ? (e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === date ? null : o));
                } : undefined}
                onDrop={onMove && dragId ? (e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  if (id && date !== dragFrom) onMove(id, date);
                  endDrag();
                } : undefined}
                className={`group/day relative min-h-[112px] border-r border-mist p-1.5 transition-colors last:border-r-0 ${over === date && date !== dragFrom ? "bg-cream ring-2 ring-inset ring-sand" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${isToday ? "bg-ink font-semibold text-paper" : "text-graphite"}`}
                  >
                    {day}
                  </span>
                  {onAdd && (
                    <button
                      aria-label={`Criar conteúdo em ${day}`}
                      onClick={() => onAdd(date)}
                      className="rounded-md p-0.5 text-muted opacity-0 transition hover:bg-cream hover:text-ink group-hover/day:opacity-100 focus:opacity-100"
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((b) => (
                    <Chip
                      key={b.id}
                      block={b}
                      client={clientsById?.(b.clientId)}
                      dim={!!focusPending && !isPending(b)}
                      showNews={showNews}
                      onOpen={() => onOpen(b.id)}
                      draggable={!!onMove}
                      dragging={dragId === b.id}
                      onDragStart={() => setDragId(b.id)}
                      onDragEnd={endDrag}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MobileView({
  year, month, monthBlocks, onOpen, onAdd, clientsById, focusPending,
}: CalendarProps & { monthBlocks: Block[] }) {
  const [onlyPending, setOnlyPending] = useState(!!focusPending);
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const weeks = monthWeeks(year, month);
  const today = todayYmd();
  const pendingCount = monthBlocks.filter(isPending).length;

  const shown = onlyPending ? monthBlocks.filter(isPending) : monthBlocks;
  const groups = useMemo(() => {
    const m = new Map<string, Block[]>();
    shown.forEach((b) => m.set(b.date, [...(m.get(b.date) ?? []), b]));
    return [...m.entries()];
  }, [shown]);

  const byDay = useMemo(() => {
    const m = new Map<string, Block[]>();
    monthBlocks.forEach((b) => m.set(b.date, [...(m.get(b.date) ?? []), b]));
    return m;
  }, [monthBlocks]);

  const pick = (date: string) => {
    setSelected(date);
    if (onlyPending && !(byDay.get(date) ?? []).some(isPending)) setOnlyPending(false);
    requestAnimationFrame(() => {
      document.getElementById(`dia-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div>
      {/* Mês inteiro em miniatura */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-muted">
          {WEEKDAYS_SHORT.map((d) => <div key={d} className="py-1">{d.slice(0, 1)}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              if (day === null) return <div key={di} />;
              const date = ymd(year, month, day);
              const items = byDay.get(date) ?? [];
              const isSel = selected === date;
              return (
                <button
                  key={di}
                  onClick={() => (items.length ? pick(date) : onAdd ? onAdd(date) : undefined)}
                  className={`flex h-12 flex-col items-center justify-start gap-1 rounded-lg pt-1.5 ${isSel ? "bg-cream ring-1 ring-sand" : ""}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${date === today ? "bg-ink font-semibold text-paper" : "text-graphite"}`}>
                    {day}
                  </span>
                  <span className="flex max-w-full flex-wrap justify-center gap-[3px] px-0.5">
                    {items.slice(0, 6).map((b) => (
                      <span
                        key={b.id}
                        className={`h-[5px] w-[5px] rounded-full ${onlyPending && !isPending(b) ? "opacity-25" : ""}`}
                        style={{ background: STATUSES[b.status].color }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sticky top-0 z-10 flex gap-2 border-y border-mist bg-paper/95 px-3 py-2.5 backdrop-blur">
        <button
          onClick={() => setOnlyPending(false)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${!onlyPending ? "bg-ink text-paper" : "bg-cream text-graphite"}`}
        >
          Todos ({monthBlocks.length})
        </button>
        <button
          onClick={() => setOnlyPending(true)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${onlyPending ? "bg-ink text-paper" : "bg-cream text-graphite"}`}
        >
          Aguardando aprovação ({pendingCount})
        </button>
      </div>

      <div ref={listRef} className="px-3 pb-4">
        {groups.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">Nada por aqui neste mês.</p>
        )}
        {groups.map(([date, items]) => (
          <div key={date} id={`dia-${date}`} className="scroll-mt-14 pt-4">
            <p className={`mb-2 text-xs font-semibold first-letter:uppercase ${selected === date ? "text-ink" : "text-muted"}`}>{formatLong(date)}</p>
            <div className="flex flex-col gap-2">
              {items.map((b) => {
                const client = clientsById?.(b.clientId);
                const Icon = FORMATS[b.format].icon;
                return (
                  <button
                    key={b.id}
                    onClick={() => onOpen(b.id)}
                    className="relative flex items-center gap-3 rounded-xl border border-mist bg-paper py-3 pl-4 pr-3 text-left active:bg-cream"
                  >
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r" style={{ background: client ? client.color : STATUSES[b.status].color }} />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream text-graphite">
                      <Icon size={17} strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      {client && (
                        <span className="block truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: client.color }}>{client.name}</span>
                      )}
                      <span className="block truncate text-sm text-ink">{b.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                        <StatusDot status={b.status} size={6} /> {statusLabel(b.status, b.format)} · {FORMATS[b.format].label}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
      {(Object.keys(STATUSES) as (keyof typeof STATUSES)[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <StatusDot status={s} size={7} />
          {STATUSES[s].label}
        </span>
      ))}
    </div>
  );
}
