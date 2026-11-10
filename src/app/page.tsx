"use client";

import {
  ArrowUpRight, Bell, Check, ChevronDown, Link2, MessageCircle, Pencil, Plus, RotateCcw, Settings2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Client } from "@/lib/types";
import { FORMATS } from "@/lib/meta";
import { MONTHS, formatShort, inMonth } from "@/lib/dates";
import Calendar, { StatusLegend } from "@/components/Calendar";
import BlockModal from "@/components/BlockModal";
import ClientForm from "@/components/ClientForm";
import { ProgressBar, ProgressLegend } from "@/components/Progress";
import { Logo, SectionTitle } from "@/components/ui";

type Kind = "todos" | "posts" | "roteiros";

export default function ControlPage() {
  const store = useStore();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [kind, setKind] = useState<Kind>("todos");
  /** Clientes selecionadas no filtro. Vazio = todas visíveis. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState<null | "new" | string>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = store.clients.filter((c) => c.active);
  const inactive = store.clients.filter((c) => !c.active);
  const activeIds = useMemo(() => new Set(active.map((c) => c.id)), [active]);
  const activeBlocks = useMemo(() => store.blocks.filter((b) => activeIds.has(b.clientId)), [store.blocks, activeIds]);

  const filtered = useMemo(
    () => activeBlocks.filter((b) =>
      (selected.size === 0 || selected.has(b.clientId)) &&
      (kind === "todos" || (kind === "roteiros" ? b.format === "roteiro" : b.format !== "roteiro"))),
    [activeBlocks, selected, kind],
  );

  const attention = useMemo(() => {
    const items: { blockId: string; clientId: string; title: string; text: string; icon: "sug" | "com" }[] = [];
    activeBlocks.forEach((b) => {
      if (b.suggestion) items.push({ blockId: b.id, clientId: b.clientId, title: b.title, text: `Sugeriu alteração ${b.suggestion.field === "caption" ? "na legenda" : "no roteiro"}`, icon: "sug" });
      const unseen = b.comments.filter((c) => !c.seen && c.by === "Cliente");
      if (unseen.length) items.push({ blockId: b.id, clientId: b.clientId, title: b.title, text: `“${unseen[unseen.length - 1].text}”`, icon: "com" });
    });
    return items;
  }, [activeBlocks]);

  const monthPosts = activeBlocks.filter((b) => inMonth(b.date, ym.y, ym.m) && b.format !== "roteiro");
  const pendingClient = activeBlocks.filter((b) => b.status === "aguardando_aprovacao").length;
  const toPublish = monthPosts.filter((b) => b.status === "aprovado").length;

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${slug}?visao=cliente`);
      setCopied(slug);
      setTimeout(() => setCopied(null), 1600);
    } catch { /* ignora */ }
  };

  // 1º clique: mostra só aquela cliente. Cliques seguintes somam ou retiram clientes.
  // Quando todas (ou nenhuma) ficam selecionadas, volta a mostrar todas.
  const toggleClient = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n.size === active.length ? new Set() : n;
    });

  const editing = form && form !== "new" ? store.clientById(form) : undefined;

  return (
    <div className="min-h-dvh pb-24">
      {/* Topo */}
      <header className="border-b border-mist bg-paper">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Logo className="h-[18px]" />
          <button
            onClick={() => confirm("Restaurar os dados de exemplo do protótipo? As alterações feitas serão perdidas.") && store.reset()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-cream hover:text-ink"
          >
            <RotateCcw size={13} /> <span className="hidden sm:inline">Restaurar exemplo</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pt-6 md:px-8 md:pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-muted">Painel de controle</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Olá, Straut</h1>
          </div>
          <div className="flex gap-2 text-sm">
            <Stat n={pendingClient} label="aguardando cliente" />
            <Stat n={attention.length} label="pedem sua atenção" accent={attention.length > 0} />
            <Stat n={toPublish} label="prontos para postar" />
          </div>
        </div>

        {/* Clientes */}
        <section className="mb-8">
          <SectionTitle
            right={
              <button
                onClick={() => setForm("new")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-graphite"
              >
                <Plus size={14} /> Nova cliente
              </button>
            }
          >
            Clientes ativas <span className="ml-1 font-normal text-muted">({active.length})</span>
          </SectionTitle>
          <div className="thin-scroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-5">
            {active.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                pending={store.blocks.filter((b) => b.clientId === c.id && b.status === "aguardando_aprovacao").length}
                copied={copied === c.slug}
                onCopy={() => copyLink(c.slug)}
                onManage={() => setForm(c.id)}
              />
            ))}
            {active.length === 0 && (
              <button onClick={() => setForm("new")} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sand p-6 text-sm text-graphite hover:bg-paper md:col-span-3">
                <Plus size={16} /> Cadastrar a primeira cliente
              </button>
            )}
          </div>

          {inactive.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowInactive(!showInactive)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink" aria-expanded={showInactive}>
                Páginas desativadas ({inactive.length}) <ChevronDown size={13} className={`transition ${showInactive ? "rotate-180" : ""}`} />
              </button>
              {showInactive && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {inactive.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => setForm(c.id)} className="inline-flex items-center gap-2 rounded-xl border border-mist bg-paper px-3 py-2 text-xs text-muted hover:border-sand hover:text-ink">
                        <span className="h-2 w-2 rounded-full bg-sand" /> {c.name} · {c.specialty}
                        <Settings2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Calendário geral */}
          <section className="min-w-0">
            <SectionTitle>Calendário geral</SectionTitle>
            <Calendar
              blocks={filtered}
              year={ym.y}
              month={ym.m}
              onMonthChange={(y, m) => setYm({ y, m })}
              onOpen={setOpen}
              clientsById={store.clientById}
              showNews
              headerExtra={
                <div className="inline-flex rounded-xl border border-mist bg-cream/60 p-1">
                  {(["todos", "posts", "roteiros"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${kind === k ? "bg-ink text-paper" : "text-graphite hover:bg-paper"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              }
              toolbar={
                <div className="flex flex-wrap items-center gap-1.5">
                  {active.map((c) => {
                    const on = selected.size === 0 || selected.has(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleClient(c.id)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-sand bg-paper text-ink" : "border-transparent bg-mist/60 text-muted line-through"}`}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: on ? c.color : "#bdb8b2" }} />
                        {c.name.replace(/^Dra?\. /, "")}
                      </button>
                    );
                  })}
                  {selected.size > 0 && (
                    <button onClick={() => setSelected(new Set())} className="rounded-full px-2.5 py-1 text-xs font-medium text-graphite underline-offset-2 hover:underline">
                      Mostrar todas
                    </button>
                  )}
                  <span className="ml-auto text-xs text-muted">
                    {filtered.filter((b) => inMonth(b.date, ym.y, ym.m)).length} itens em {MONTHS[ym.m].toLowerCase()}
                  </span>
                </div>
              }
            />
            <div className="mt-3"><StatusLegend /></div>
          </section>

          {/* Lateral */}
          <aside className="flex flex-col gap-8">
            <section>
              <SectionTitle right={attention.length > 0 && <span className="rounded-full bg-[#b9583a] px-2 text-[11px] font-semibold leading-[18px] text-paper">{attention.length}</span>}>
                Precisa da sua atenção
              </SectionTitle>
              <div className="rounded-2xl border border-mist bg-paper">
                {attention.length === 0 ? (
                  <p className="flex items-center gap-2 p-4 text-sm text-muted"><Bell size={15} /> Nenhuma sugestão ou comentário novo.</p>
                ) : (
                  <ul className="divide-y divide-mist">
                    {attention.map((a) => {
                      const c = store.clientById(a.clientId)!;
                      const b = store.blocks.find((x) => x.id === a.blockId)!;
                      return (
                        <li key={a.blockId + a.icon}>
                          <Link href={`/c/${c.slug}?bloco=${a.blockId}`} className="flex gap-3 p-4 hover:bg-cream/60">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6e3dc] text-[#b9583a]">
                              {a.icon === "sug" ? <Pencil size={13} /> : <MessageCircle size={13} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.color }}>{c.name}</span>
                              <span className="block truncate text-sm text-ink">{a.title}</span>
                              <span className="line-clamp-2 text-xs text-muted">{a.text} · {FORMATS[b.format].label} de {formatShort(b.date)}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>Posts do mês x contrato</SectionTitle>
              <div className="flex flex-col gap-4 rounded-2xl border border-mist bg-paper p-4">
                <p className="-mb-1 text-xs text-muted">{MONTHS[ym.m]} de {ym.y}</p>
                {active.map((c) => (
                  <ProgressBar key={c.id} client={c} blocks={store.blocks} year={ym.y} month={ym.m} />
                ))}
                <div className="border-t border-mist pt-3"><ProgressLegend /></div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {open && <BlockModal blockId={open} mode="visualizacao" showClient onClose={() => setOpen(null)} />}
      {form === "new" && <ClientForm onClose={() => setForm(null)} />}
      {editing && <ClientForm key={editing.id} client={editing} onClose={() => setForm(null)} />}
    </div>
  );
}

function ClientCard({ client: c, pending, copied, onCopy, onManage }: {
  client: Client; pending: number; copied: boolean; onCopy: () => void; onManage: () => void;
}) {
  return (
    <div className="group relative w-[250px] shrink-0 snap-start rounded-2xl border border-mist bg-paper p-4 transition hover:border-sand md:w-auto">
      <span className="absolute left-4 right-4 top-0 h-[3px] rounded-b" style={{ background: c.color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-tight">{c.name}</p>
          <p className="text-xs text-muted">{c.specialty}</p>
        </div>
        <button
          onClick={onManage}
          aria-label={`Gestão de ${c.name}`}
          title="Gestão da cliente"
          className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-muted hover:bg-cream hover:text-ink"
        >
          <Settings2 size={15} />
        </button>
      </div>
      <p className="mb-3 mt-2.5 flex items-center justify-between text-xs text-graphite">
        <span>{pending > 0 ? <><span className="font-semibold">{pending}</span> aguardando aprovação</> : "Tudo aprovado"}</span>
        <span className="text-muted" title="Dia de pagamento">Pgto. dia {c.paymentDay}</span>
      </p>
      <div className="flex gap-1.5">
        <Link href={`/c/${c.slug}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-paper hover:bg-graphite">
          Abrir página <ArrowUpRight size={13} />
        </Link>
        <button
          onClick={onCopy}
          aria-label="Copiar link da cliente"
          title="Copiar link para a cliente"
          className="inline-flex items-center justify-center rounded-lg border border-sand px-2 text-graphite hover:bg-cream"
        >
          {copied ? <Check size={14} /> : <Link2 size={14} />}
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label, accent = false }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${accent ? "border-[#ecd3c8] bg-[#fdf8f6]" : "border-mist bg-paper"}`}>
      <p className={`font-display text-xl font-semibold leading-none ${accent ? "text-[#b9583a]" : ""}`}>{n}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}
