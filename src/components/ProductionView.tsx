"use client";

import {
  ArrowLeft, Camera, Check, ChevronDown, EyeOff, FileText, GripVertical, Loader2, RotateCcw, Trash2, Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { setProductionOrder, setProductionState } from "@/app/actions";
import BlockModal from "@/components/BlockModal";
import { Logo, StatusDot } from "@/components/ui";
import { formatLong, formatShort } from "@/lib/dates";
import { FORMATS, PLANNED, statusLabel } from "@/lib/meta";
import { useStore } from "@/lib/store";
import type { Block, ProductionItem, ProductionState } from "@/lib/types";

const GREEN = "#5c8a62";
const SWIPE = 90; // px para confirmar o gesto

/**
 * Dia de produção: os roteiros ainda não gravados da cliente, em lista.
 * A ordem e as marcações (gravado / escondido) são só para organizar a gravação:
 * não mudam a data nem o status do bloco.
 */
export default function ProductionView({ slug, mode, eventId, initialItems, doneElsewhere }: {
  slug: string; mode: "straut" | "cliente"; eventId: string; initialItems: ProductionItem[]; doneElsewhere: string[];
}) {
  const router = useRouter();
  const store = useStore();
  const client = store.getClient(slug);
  const event = store.events.find((e) => e.id === eventId);
  const canEdit = mode === "straut";
  const base = canEdit ? `/c/${slug}` : `/p/${slug}`;

  const [items, setItems] = useState(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);
  const [saving, setSaving] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.blockId, i])), [items]);

  // Quem entra na lista: roteiros ainda não gravados em outro dia de produção,
  // mais o que já foi marcado aqui (mesmo que o roteiro já tenha avançado para reels).
  const { pending, done, hidden } = useMemo(() => {
    const elsewhere = new Set(doneElsewhere);
    const list = store.blocks.filter((b) => {
      if (b.clientId !== client?.id) return false;
      const it = itemMap.get(b.id);
      if (b.format === "roteiro") return !elsewhere.has(b.id) || !!it;
      return it?.state === "gravado";
    });
    const pos = (b: Block) => itemMap.get(b.id)?.position ?? Number.MAX_SAFE_INTEGER;
    list.sort((a, b) => pos(a) - pos(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const st = (b: Block): ProductionState => itemMap.get(b.id)?.state ?? "pendente";
    return {
      pending: list.filter((b) => st(b) === "pendente"),
      done: list.filter((b) => st(b) === "gravado"),
      hidden: list.filter((b) => st(b) === "oculto"),
    };
  }, [store.blocks, client, itemMap, doneElsewhere]);

  const save = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setSaving((n) => n + 1);
    try {
      const r = await fn();
      if (!r.ok) { alert(r.error ?? "Não foi possível salvar."); router.refresh(); }
    } catch {
      alert("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
      router.refresh();
    } finally {
      setSaving((n) => n - 1);
    }
  };

  const mark = (blockId: string, state: ProductionState) => {
    setItems((list) => {
      const cur = list.find((i) => i.blockId === blockId);
      if (cur) return list.map((i) => (i.blockId === blockId ? { ...i, state } : i));
      const max = list.reduce((m, i) => Math.max(m, i.position), -1);
      return [...list, { blockId, state, position: max + 1 }];
    });
    void save(() => setProductionState(eventId, blockId, state));
  };

  const reorder = (ids: string[]) => {
    setItems((list) => {
      const byId = new Map(list.map((i) => [i.blockId, i]));
      const moved = ids.map((id, position) => ({ blockId: id, position, state: byId.get(id)?.state ?? "pendente" as ProductionState }));
      const others = list.filter((i) => !ids.includes(i.blockId)).map((i) => ({ ...i, position: i.position + ids.length }));
      return [...moved, ...others];
    });
    void save(() => setProductionOrder(eventId, ids));
  };

  if (!client) return null;

  if (!event) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">Este dia de produção não existe mais.</p>
        <Link href={base} className="text-sm font-medium underline">Voltar para o calendário</Link>
      </div>
    );
  }

  const total = pending.length + done.length;
  const seq = [...pending, ...done, ...hidden].map((b) => b.id);
  const idx = openId ? seq.indexOf(openId) : -1;

  const removeEvent = async () => {
    if (!confirm("Excluir este dia de produção? Ele fica 30 dias na Lixeira do painel e pode ser restaurado. Os roteiros não mudam.")) return;
    if (await store.deleteEvent(event.id)) router.push(base);
  };

  return (
    <div className="min-h-dvh pb-24">
      <header className="border-b border-mist bg-paper">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-3.5 md:px-8">
          <div className="flex items-center gap-3">
            <Link href={base} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-graphite hover:bg-cream">
              <ArrowLeft size={14} /> Calendário
            </Link>
            <Logo className="h-4" />
            {(saving > 0 || store.busy) && <Loader2 size={15} className="animate-spin text-muted" aria-label="Salvando" />}
          </div>
          {canEdit && (
            <button onClick={removeEvent} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted hover:bg-[#f6e3dc] hover:text-[#b9583a]">
              <Trash2 size={14} /> <span className="hidden sm:inline">Excluir dia de produção</span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 pt-7 md:px-8 md:pt-10">
        <p className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: client.color }} /> {client.name}
        </p>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 font-display text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.05]">
              <Camera className="shrink-0" size={30} strokeWidth={1.6} /> {event.title}
            </h1>
            {canEdit ? (
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-graphite">
                <span className="first-letter:uppercase">{formatLong(event.date)}</span>
                <input
                  type="date"
                  value={event.date}
                  onChange={(e) => e.target.value && store.updateEvent(event.id, { date: e.target.value })}
                  aria-label="Mudar a data da produção"
                  className="min-w-0 appearance-none rounded-lg border border-sand bg-paper px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-mist"
                />
              </label>
            ) : (
              <p className="mt-2 text-sm text-graphite first-letter:uppercase">{formatLong(event.date)}</p>
            )}
          </div>
          <div className="w-full rounded-2xl border border-mist bg-paper px-4 py-3 sm:w-[220px]">
            <p className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Gravados</span>
              <span><span className="font-display text-2xl font-semibold" style={{ color: GREEN }}>{done.length}</span> <span className="text-muted">de {total}</span></span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
              <div className="h-full rounded-full transition-all" style={{ width: `${total ? (done.length / total) * 100 : 0}%`, background: GREEN }} />
            </div>
          </div>
        </div>

        {canEdit ? (
          <NotesField value={event.notes} onSave={(notes) => store.updateEvent(event.id, { notes })} />
        ) : event.notes ? (
          <p className="mb-6 whitespace-pre-line rounded-2xl bg-cream px-4 py-3 text-sm text-graphite">{event.notes}</p>
        ) : null}

        {/* Para gravar */}
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
            Para gravar <span className="text-sm font-normal text-muted">{pending.length}</span>
          </h2>
          {canEdit && (
            <p className="mb-3 text-[11px] leading-relaxed text-muted">
              <span className="md:hidden">Deslize para a direita para marcar como gravado e para a esquerda para esconder. Segure ⠿ e arraste para mudar a ordem.</span>
              <span className="hidden md:inline">Use ✓ para marcar como gravado e o olho para esconder (ou deslize o bloco para os lados). Arraste pelo ⠿ para mudar a ordem. Nada disso muda a data ou o status do conteúdo.</span>
            </p>
          )}
          {pending.length === 0 ? (
            <p className="rounded-2xl bg-cream p-5 text-center text-sm text-muted">
              {total ? "Tudo gravado! 🎬" : "Nenhum roteiro esperando gravação."}
            </p>
          ) : (
            <PendingList
              blocks={pending}
              canEdit={canEdit}
              onOpen={setOpenId}
              onDone={(id) => mark(id, "gravado")}
              onHide={(id) => mark(id, "oculto")}
              onReorder={reorder}
            />
          )}
        </section>

        {/* Gravados */}
        {done.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold" style={{ color: GREEN }}>
              <Check size={18} strokeWidth={2.4} /> Gravados <span className="text-sm font-normal text-muted">{done.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {done.map((b) => (
                <li key={b.id}>
                  <Row block={b} onOpen={() => setOpenId(b.id)} tone="done"
                    action={canEdit ? { label: "Desfazer: voltar para gravar", icon: Undo2, onClick: () => mark(b.id, "pendente") } : undefined} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Escondidos */}
        {hidden.length > 0 && (
          <section className="mb-8">
            <button
              onClick={() => setHiddenOpen(!hiddenOpen)}
              aria-expanded={hiddenOpen}
              className="flex w-full items-center gap-2 rounded-xl border border-mist bg-paper px-4 py-3 text-left text-sm font-medium text-graphite hover:bg-cream"
            >
              <EyeOff size={16} className="text-muted" />
              {canEdit ? "Escondidos" : "Fora deste dia de produção"} <span className="font-normal text-muted">{hidden.length}</span>
              <ChevronDown size={16} className={`ml-auto text-muted transition ${hiddenOpen ? "rotate-180" : ""}`} />
            </button>
            {hiddenOpen && (
              <ul className="mt-2 flex flex-col gap-2">
                {hidden.map((b) => (
                  <li key={b.id}>
                    <Row block={b} onOpen={() => setOpenId(b.id)} tone="hidden"
                      action={canEdit ? { label: "Recuperar para a lista", icon: RotateCcw, onClick: () => mark(b.id, "pendente"), text: "Recuperar" } : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {openId && (
        <BlockModal
          key={openId}
          blockId={openId}
          mode={mode}
          onClose={() => setOpenId(null)}
          onPrev={idx > 0 ? () => setOpenId(seq[idx - 1]) : undefined}
          onNext={idx >= 0 && idx < seq.length - 1 ? () => setOpenId(seq[idx + 1]) : undefined}
          position={idx >= 0 && seq.length > 1 ? `${idx + 1} de ${seq.length}` : undefined}
        />
      )}
    </div>
  );
}

function NotesField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onSave(text)}
      rows={text ? 3 : 2}
      placeholder="Observações do dia (local, horário, figurino, equipe…)"
      className="mb-6 w-full resize-y rounded-2xl border border-mist bg-paper px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-sand focus:ring-2 focus:ring-mist"
    />
  );
}

type RowAction = { label: string; icon: typeof Check; onClick: () => void; text?: string };

function RowContent({ block }: { block: Block }) {
  const Icon = block.plannedFormat ? FORMATS[block.plannedFormat].icon : block.format === "roteiro" ? FileText : FORMATS[block.format].icon;
  const kind = block.format === "roteiro"
    ? block.plannedFormat ? `Roteiro de ${PLANNED[block.plannedFormat].toLowerCase()}` : "Roteiro"
    : FORMATS[block.format].label;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream text-graphite">
        <Icon size={17} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{block.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
          <span>{kind}</span>·<span>publicação {formatShort(block.date)}</span>·
          <span className="inline-flex items-center gap-1"><StatusDot status={block.status} size={6} /> {statusLabel(block.status, block.format)}</span>
        </span>
      </span>
    </>
  );
}

function Row({ block, onOpen, tone, action }: { block: Block; onOpen: () => void; tone: "done" | "hidden"; action?: RowAction }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border bg-paper py-2.5 pl-3 pr-2 ${tone === "done" ? "border-[#cfe0d0] bg-[#f3f8f3]" : "border-mist opacity-80"}`}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {tone === "done" && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-paper" style={{ background: GREEN }}>
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        <RowContent block={block} />
      </button>
      {action && (
        <button
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-xs font-medium text-graphite hover:bg-cream"
        >
          <action.icon size={15} /> {action.text && <span className="hidden sm:inline">{action.text}</span>}
        </button>
      )}
    </div>
  );
}

/**
 * Lista "Para gravar": arrastar pelo ⠿ muda a ordem; deslizar para os lados marca.
 *
 * O arraste não troca os elementos de lugar enquanto o dedo está na tela (isso fazia o navegador
 * perder o ponteiro): o bloco segue o dedo com transform, os outros abrem espaço com animação,
 * e a nova ordem só é gravada ao soltar. Perto da borda da tela, a página rola sozinha.
 */
const DROP_MS = 200;
const EDGE = 72; // px da borda da tela em que a página começa a rolar

type Geo = { from: number; rects: { top: number; bottom: number }[]; gap: number };
type Drag = { id: string; to: number; dy: number; dropping: boolean };

function PendingList({ blocks, canEdit, onOpen, onDone, onHide, onReorder }: {
  blocks: Block[]; canEdit: boolean; onOpen: (id: string) => void;
  onDone: (id: string) => void; onHide: (id: string) => void; onReorder: (ids: string[]) => void;
}) {
  const ids = blocks.map((b) => b.id);
  const listRef = useRef<HTMLUListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const geo = useRef<Geo | null>(null);
  const live = useRef<{ id: string; startY: number; clientY: number; to: number; moved: boolean; raf: number; stop: () => void } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  // iPhone: sem isso, segurar o ⠿ seleciona o texto ou abre o menu do sistema.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !canEdit) return;
    const block = (e: TouchEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-drag-handle]")) e.preventDefault();
    };
    el.addEventListener("touchstart", block, { passive: false });
    return () => el.removeEventListener("touchstart", block);
  }, [canEdit]);

  useEffect(() => () => live.current?.stop(), []);

  const compute = () => {
    const s = live.current;
    const g = geo.current;
    if (!s || !g) return;
    const r = g.rects;
    const me = r[g.from];
    const min = r[0].top - me.top;
    const max = r[r.length - 1].bottom - me.bottom;
    const dy = Math.max(min, Math.min(max, s.clientY + window.scrollY - s.startY));
    const center = (me.top + me.bottom) / 2 + dy;
    let to = g.from;
    r.forEach((x, i) => {
      const mid = (x.top + x.bottom) / 2;
      if (i < g.from && center < mid) to = Math.min(to, i);
      if (i > g.from && center > mid) to = Math.max(to, i);
    });
    s.to = to;
    setDrag({ id: s.id, to, dy, dropping: false });
  };

  const start = (id: string, e: React.PointerEvent) => {
    if (!canEdit || live.current || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation(); // não deixa o gesto de deslizar do bloco começar junto
    window.getSelection()?.removeAllRanges();

    const rects = ids.map((x) => {
      const r = rows.current.get(x)?.getBoundingClientRect();
      return { top: (r?.top ?? 0) + window.scrollY, bottom: (r?.bottom ?? 0) + window.scrollY };
    });
    const from = ids.indexOf(id);
    geo.current = { from, rects, gap: rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0 };

    const pointerId = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !live.current) return;
      ev.preventDefault();
      live.current.clientY = ev.clientY;
      live.current.moved = true;
    };
    const onEnd = (ev: PointerEvent) => { if (ev.pointerId === pointerId) finish(); };
    const tick = () => {
      const s = live.current;
      if (!s) return;
      const h = window.innerHeight;
      const v = s.clientY < EDGE ? -Math.ceil((EDGE - s.clientY) / 4) : s.clientY > h - EDGE ? Math.ceil((s.clientY - (h - EDGE)) / 4) : 0;
      if (v) window.scrollBy(0, v);
      if (v || s.moved) { s.moved = false; compute(); }
      s.raf = requestAnimationFrame(tick);
    };
    const prevSelect = document.body.style.userSelect;
    const stop = () => {
      if (live.current) cancelAnimationFrame(live.current.raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.body.style.userSelect = prevSelect;
      document.body.style.removeProperty("-webkit-user-select");
    };

    live.current = { id, startY: e.clientY + window.scrollY, clientY: e.clientY, to: from, moved: false, raf: 0, stop };
    document.body.style.userSelect = "none";
    document.body.style.setProperty("-webkit-user-select", "none");
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    live.current.raf = requestAnimationFrame(tick);
    navigator.vibrate?.(8);
    setDrag({ id, to: from, dy: 0, dropping: false });
  };

  const finish = () => {
    const s = live.current;
    const g = geo.current;
    if (!s || !g) return;
    s.stop();
    live.current = null;
    const { from, rects } = g;
    const to = s.to;
    // Leva o bloco até o lugar novo antes de gravar a ordem.
    const slot = to > from ? rects[to].bottom - rects[from].bottom : to < from ? rects[to].top - rects[from].top : 0;
    setDrag({ id: s.id, to, dy: slot, dropping: true });
    window.setTimeout(() => {
      if (to !== from) {
        const next = [...ids];
        next.splice(from, 1);
        next.splice(to, 0, s.id);
        onReorder(next);
      }
      geo.current = null;
      setDrag(null);
    }, DROP_MS);
  };

  const styleFor = (id: string, i: number): React.CSSProperties | undefined => {
    const g = geo.current;
    if (!drag || !g) return undefined;
    if (id === drag.id) {
      return {
        position: "relative",
        zIndex: 20,
        transform: `translate3d(0, ${drag.dy}px, 0) scale(${drag.dropping ? 1 : 1.02})`,
        transition: drag.dropping ? `transform ${DROP_MS}ms cubic-bezier(.2,.8,.2,1)` : "none",
        willChange: "transform",
      };
    }
    const size = g.rects[g.from].bottom - g.rects[g.from].top + g.gap;
    const shift = i > g.from && i <= drag.to ? -size : i < g.from && i >= drag.to ? size : 0;
    return { transform: shift ? `translate3d(0, ${shift}px, 0)` : undefined, transition: `transform ${DROP_MS}ms ease` };
  };

  return (
    <ul ref={listRef} className={`flex flex-col gap-2 ${canEdit ? "select-none [-webkit-touch-callout:none]" : ""}`}>
      {blocks.map((b, i) => (
        <li key={b.id} style={styleFor(b.id, i)} ref={(el) => { if (el) rows.current.set(b.id, el); else rows.current.delete(b.id); }}>
          <SwipeRow
            block={b}
            canEdit={canEdit}
            lifted={drag?.id === b.id && !drag.dropping}
            onOpen={() => onOpen(b.id)}
            onDone={() => onDone(b.id)}
            onHide={() => onHide(b.id)}
            handle={canEdit ? (
              <span
                role="button"
                data-drag-handle
                aria-label="Arraste para mudar a ordem"
                title="Arraste para mudar a ordem"
                onPointerDown={(e) => start(b.id, e)}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex h-11 w-9 shrink-0 touch-none select-none items-center justify-center rounded-lg text-muted hover:bg-cream ${drag?.id === b.id ? "cursor-grabbing bg-cream text-ink" : "cursor-grab"}`}
              >
                <GripVertical size={18} />
              </span>
            ) : null}
          />
        </li>
      ))}
    </ul>
  );
}

function SwipeRow({ block, canEdit, lifted, onOpen, onDone, onHide, handle }: {
  block: Block; canEdit: boolean; lifted: boolean; onOpen: () => void; onDone: () => void; onHide: () => void; handle: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const g = useRef<{ x: number; y: number; id: number; mode: "?" | "swipe" | "scroll" } | null>(null);
  const swiped = useRef(false);

  const down = (e: React.PointerEvent) => {
    if (!canEdit || e.button !== 0) return;
    g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: "?" };
    swiped.current = false;
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.mode === "?") {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) {
        s.mode = "swipe";
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 10) s.mode = "scroll";
    }
    if (s.mode === "swipe") {
      swiped.current = true;
      setDx(Math.max(-160, Math.min(160, mx)));
    }
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (s?.mode === "swipe") {
      if (dx >= SWIPE) onDone();
      else if (dx <= -SWIPE) onHide();
    }
    setDx(0);
  };

  const reveal = dx > 0 ? "done" : dx < 0 ? "hide" : null;
  const armed = Math.abs(dx) >= SWIPE;

  return (
    <div className={`relative overflow-hidden rounded-xl ${lifted ? "z-10 shadow-[0_10px_30px_-10px_rgba(28,28,28,0.35)]" : ""}`}>
      {reveal && (
        <div
          className={`absolute inset-0 flex items-center px-5 text-sm font-medium text-paper ${reveal === "done" ? "justify-start" : "justify-end"}`}
          style={{ background: reveal === "done" ? (armed ? GREEN : "#9fbfa3") : (armed ? "#6f6a64" : "#a39d96") }}
        >
          {reveal === "done" ? <span className="inline-flex items-center gap-2"><Check size={18} strokeWidth={2.6} /> Gravado</span>
            : <span className="inline-flex items-center gap-2">Esconder <EyeOff size={18} /></span>}
        </div>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 180ms ease", touchAction: "pan-y" }}
        className={`relative flex items-center gap-1 border bg-paper py-1.5 pl-1 pr-2 ${lifted ? "border-sand" : "border-mist"} rounded-xl`}
      >
        {handle}
        <button
          onClick={() => { if (!swiped.current) onOpen(); swiped.current = false; }}
          className={`flex min-w-0 flex-1 items-center gap-3 py-1 text-left ${handle ? "" : "pl-2"}`}
        >
          <RowContent block={block} />
        </button>
        {canEdit && (
          <span className="hidden shrink-0 items-center gap-1 md:flex">
            <button onClick={onHide} aria-label="Esconder deste dia" title="Esconder deste dia (não vamos gravar)" className="rounded-lg p-2 text-muted hover:bg-cream hover:text-ink">
              <EyeOff size={16} />
            </button>
            <button onClick={onDone} aria-label="Marcar como gravado" title="Marcar como gravado" className="rounded-lg p-2 text-muted hover:bg-[#e4eee4]" style={{ color: undefined }}>
              <Check size={17} strokeWidth={2.4} className="text-[#5c8a62]" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
