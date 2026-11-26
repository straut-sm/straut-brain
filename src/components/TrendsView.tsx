"use client";

import {
  ArrowLeft, Check, ChevronDown, CircleDashed, Copy, ExternalLink, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Sparkles,
  Trash2, Video, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { deleteTrendItem, markTrendsSeen, publishTrendWeek, saveTrendItem, trendToScript } from "@/app/actions";
import { Logo } from "@/components/ui";
import { MONTHS, todayYmd } from "@/lib/dates";
import { addDays } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { TrendInput, TrendItem, TrendKind } from "@/lib/types";

const CLAY = "#b9583a";
const GREEN_TEXT = "#3f6b46";
const WA_GREEN = "#25603a";

/** Segunda-feira da semana de uma data. */
function mondayOf(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(ymd, -((wd + 6) % 7));
}
const weekLabel = (w: string) => `${Number(w.slice(8))} de ${MONTHS[Number(w.slice(5, 7)) - 1].toLowerCase()}`;
const KIND_LABEL: Record<TrendKind, string> = {
  mercado: "Tendência do mês", referencia: "Referência", gravar: "Ideia para gravar", stories: "Stories",
};

/** Aba Tendências: conteúdo da semana pesquisado pela Straut. A cliente só lê (e só o que foi liberado). */
export default function TrendsView({ slug, mode, initialItems }: { slug: string; mode: "straut" | "cliente"; initialItems: TrendItem[] }) {
  const router = useRouter();
  const store = useStore();
  const client = store.getClient(slug);
  const canEdit = mode === "straut";
  const base = canEdit ? `/c/${slug}` : `/p/${slug}`;

  const [items, setItems] = useState(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);
  const [saving, setSaving] = useState(0);
  const [editing, setEditing] = useState<{ item?: TrendItem; kind: TrendKind; week: string } | null>(null);
  const [storiesWeek, setStoriesWeek] = useState<string | null>(null);
  const [olderOpen, setOlderOpen] = useState<string | null>(null);

  // A cliente abriu a aba: some o aviso "nova"
  useEffect(() => {
    if (!canEdit && client) void markTrendsSeen(client.id);
  }, [canEdit, client]);

  const weeks = useMemo(() => [...new Set(items.map((i) => i.weekOf))].sort().reverse(), [items]);
  const current = weeks[0] ?? mondayOf(todayYmd());
  const older = weeks.slice(1);

  const save = async <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T | null> => {
    setSaving((n) => n + 1);
    try {
      const r = await fn();
      if (!r.ok) { alert(r.error); router.refresh(); return null; }
      return r.data;
    } catch {
      alert("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
      return null;
    } finally {
      setSaving((n) => n - 1);
    }
  };

  if (!client) return null;

  const submit = async (input: TrendInput) => {
    if (!editing) return;
    const saved = await save(() => saveTrendItem(editing.item?.id ?? null, client.id, editing.week, input));
    if (!saved) return;
    setItems((list) => (editing.item ? list.map((i) => (i.id === saved.id ? saved : i)) : [...list, saved]));
    setEditing(null);
  };
  const remove = async (item: TrendItem) => {
    if (!confirm("Excluir este item? Ele fica 30 dias na Lixeira do painel.")) return;
    setItems((list) => list.filter((i) => i.id !== item.id));
    setEditing(null);
    await save(() => deleteTrendItem(item.id));
  };
  const publish = async (week: string, on: boolean) => {
    setItems((list) => list.map((i) => (i.weekOf === week ? { ...i, published: on } : i)));
    await save(() => publishTrendWeek(client.id, week, on));
  };
  const toScript = async (item: TrendItem) => {
    const id = await save(() => trendToScript(item.id, todayYmd()));
    if (id) router.push(`/c/${slug}?bloco=${id}`);
  };

  const weekProps = { canEdit, onEdit: (item: TrendItem) => setEditing({ item, kind: item.kind, week: item.weekOf }), onToScript: toScript };

  return (
    <div className="min-h-dvh pb-24">
      <header className="border-b border-mist bg-paper">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-3.5 md:px-8">
          <div className="flex items-center gap-3">
            <Link href={base} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-graphite hover:bg-cream">
              <ArrowLeft size={14} /> Calendário
            </Link>
            <Logo className="h-4" />
            {(saving > 0 || store.busy) && <Loader2 size={15} className="animate-spin text-muted" aria-label="Salvando" />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-4 pt-7 md:px-8 md:pt-10">
        <p className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: client.color }} /> {client.name}
        </p>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              <Sparkles size={26} style={{ color: CLAY }} /> Tendências
            </h1>
            <p className="mt-1 text-sm text-muted">Semana de {weekLabel(current)}</p>
          </div>
        </div>

        {weeks.length === 0 && !canEdit ? (
          <div className="rounded-2xl border border-dashed border-sand bg-paper px-6 py-14 text-center">
            <Sparkles size={22} className="mx-auto mb-3" style={{ color: CLAY }} />
            <p className="font-display text-lg font-semibold">As tendências chegam toda semana</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Aqui você vai encontrar o que está em alta no seu mercado, referências e ideias de Stories para gravar.</p>
          </div>
        ) : (
          <Week
            week={current}
            items={items.filter((i) => i.weekOf === current)}
            {...weekProps}
            onAdd={(kind) => setEditing({ kind, week: current })}
            onPublish={(on) => publish(current, on)}
            onOpenStories={() => setStoriesWeek(current)}
          />
        )}

        {older.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-graphite">Semanas anteriores</h2>
            <div className="flex flex-col gap-2">
              {older.map((w) => (
                <div key={w} className="rounded-2xl border border-mist bg-paper">
                  <button
                    onClick={() => setOlderOpen(olderOpen === w ? null : w)}
                    aria-expanded={olderOpen === w}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                  >
                    Semana de {weekLabel(w)}
                    <ChevronDown size={16} className={`text-muted transition ${olderOpen === w ? "rotate-180" : ""}`} />
                  </button>
                  {olderOpen === w && (
                    <div className="border-t border-mist px-4 pb-5 pt-4">
                      <Week
                        week={w}
                        items={items.filter((i) => i.weekOf === w)}
                        {...weekProps}
                        onAdd={(kind) => setEditing({ kind, week: w })}
                        onPublish={(on) => publish(w, on)}
                        onOpenStories={() => setStoriesWeek(w)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {editing && (
        <Editor
          kind={editing.kind}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSave={submit}
          onDelete={editing.item ? () => remove(editing.item!) : undefined}
        />
      )}
      {storiesWeek && (
        <StoriesModal
          clientName={client.name}
          week={storiesWeek}
          items={items.filter((i) => i.weekOf === storiesWeek && i.kind === "stories").sort((a, b) => a.position - b.position)}
          canEdit={canEdit}
          onClose={() => setStoriesWeek(null)}
          onEdit={(item) => { setStoriesWeek(null); setEditing({ item, kind: "stories", week: item.weekOf }); }}
          onAdd={() => { const w = storiesWeek; setStoriesWeek(null); setEditing({ kind: "stories", week: w }); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Week({ items, canEdit, onEdit, onAdd, onPublish, onOpenStories, onToScript }: {
  week?: string; items: TrendItem[]; canEdit: boolean;
  onEdit: (i: TrendItem) => void; onAdd: (k: TrendKind) => void; onPublish: (on: boolean) => void;
  onOpenStories: () => void; onToScript: (i: TrendItem) => void;
}) {
  const by = (k: TrendKind) => items.filter((i) => i.kind === k).sort((a, b) => a.position - b.position);
  const mercado = by("mercado");
  const refs = by("referencia");
  const gravar = by("gravar");
  const stories = by("stories");
  const published = items.length > 0 && items.every((i) => i.published);

  return (
    <div className="flex flex-col gap-7">
      {canEdit && items.length > 0 && (
        published ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#e9f1e9] px-4 py-3 text-sm" style={{ color: GREEN_TEXT }}>
            <span className="flex items-center gap-2"><Eye size={15} /> Liberada: a cliente já vê esta semana.</span>
            <button onClick={() => onPublish(false)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-paper/60">
              <EyeOff size={13} /> Esconder da cliente
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "#e9cfc2", background: "#fbf3ee", color: "#9a4429" }}>
            <span className="flex items-center gap-2"><EyeOff size={15} /> A cliente ainda não vê esta semana. Revise e libere.</span>
            <button onClick={() => onPublish(true)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-paper" style={{ background: CLAY }}>
              <Check size={13} /> Liberar para a cliente
            </button>
          </div>
        )
      )}

      {/* Tendência do mês */}
      {(mercado.length > 0 || canEdit) && (
        <section>
          <SectionHead title="Tendência do mês no mercado" onAdd={canEdit && !mercado.length ? () => onAdd("mercado") : undefined} />
          {mercado.map((m) => (
            <div key={m.id} className="relative rounded-2xl bg-ink p-5 text-paper md:p-6">
              {canEdit && <EditBtn dark onClick={() => onEdit(m)} />}
              <p className="mb-2 pr-8 font-display text-xl font-semibold leading-snug md:text-2xl">{m.title}</p>
              {m.body && <p className="whitespace-pre-line text-sm leading-relaxed text-paper/75">{m.body}</p>}
              {m.adapt && <p className="mt-3 rounded-xl bg-paper/10 px-3 py-2 text-sm text-paper/90"><b className="font-semibold">Para você:</b> {m.adapt}</p>}
            </div>
          ))}
          {!mercado.length && <Empty text="Nenhuma tendência do mês ainda." />}
        </section>
      )}

      {/* Referências */}
      {(refs.length > 0 || canEdit) && (
        <section>
          <SectionHead title="Referências de outros perfis" onAdd={canEdit ? () => onAdd("referencia") : undefined} />
          <div className="grid gap-3 md:grid-cols-3">
            {refs.map((r) => (
              <div key={r.id} className="relative flex min-w-0 flex-col rounded-2xl border border-mist bg-paper p-4">
                {canEdit && <EditBtn onClick={() => onEdit(r)} />}
                <p className="truncate pr-8 text-sm font-semibold">{r.handle || r.title}</p>
                {r.stat && <p className="mb-2 text-[11px] text-muted">{r.stat}</p>}
                {r.handle && r.title && <p className="mb-1 text-sm font-medium leading-snug">{r.title}</p>}
                {r.body && <p className="whitespace-pre-line text-[13px] leading-relaxed text-graphite">{r.body}</p>}
                {r.adapt && <p className="mt-2.5 rounded-lg bg-[#eef4ec] px-2.5 py-2 text-xs leading-relaxed" style={{ color: GREEN_TEXT }}><b className="font-semibold">Como adaptar:</b> {r.adapt}</p>}
                {r.link && (
                  <a href={r.link} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 self-start pt-3 text-xs font-medium text-muted hover:text-ink">
                    Ver referência <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
          {!refs.length && <Empty text="Nenhuma referência ainda." />}
        </section>
      )}

      {/* Para gravar */}
      {(gravar.length > 0 || canEdit) && (
        <section>
          <SectionHead title="Para gravar" onAdd={canEdit ? () => onAdd("gravar") : undefined} />
          <div className="flex flex-col gap-2">
            {gravar.map((g) => (
              <div key={g.id} className="flex flex-col gap-3 rounded-2xl border border-mist bg-paper p-4 sm:flex-row sm:items-start">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "#f4ece6", color: "#9a4429" }}>
                  <Video size={17} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{g.title}</p>
                  {g.body && <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-graphite">{g.body}</p>}
                  {g.steps.length > 0 && (
                    <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[13px] text-graphite">
                      {g.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  )}
                  {g.adapt && <p className="mt-2 text-xs" style={{ color: GREEN_TEXT }}><b className="font-semibold">Dica:</b> {g.adapt}</p>}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => onToScript(g)} className="inline-flex items-center gap-1.5 rounded-xl border border-sand px-3 py-1.5 text-xs font-medium hover:bg-cream">
                      <FileText size={13} /> Virar roteiro
                    </button>
                    <button onClick={() => onEdit(g)} aria-label="Editar" className="rounded-xl p-2 text-muted hover:bg-cream hover:text-ink"><Pencil size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!gravar.length && <Empty text="Nenhuma ideia para gravar ainda." />}
        </section>
      )}

      {/* Stories */}
      {(stories.length > 0 || canEdit) && (
        <button
          onClick={stories.length ? onOpenStories : () => onAdd("stories")}
          className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-px"
          style={{ borderColor: "#e9cfc2", background: "#fbf3ee" }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-paper" style={{ background: CLAY }}>
            <CircleDashed size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Stories da semana</span>
            <span className="block text-xs text-muted">
              {stories.length ? `${stories.length} ${stories.length === 1 ? "ideia" : "ideias"} com passo a passo` : "Adicionar a primeira ideia de Stories"}
            </span>
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "#f4ece6", color: "#9a4429" }}>
            {stories.length ? "Abrir" : <Plus size={13} />}
          </span>
        </button>
      )}
    </div>
  );
}

function SectionHead({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-graphite">{title}</h2>
      {onAdd && (
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-paper hover:text-ink">
          <Plus size={13} /> Adicionar
        </button>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-sand px-4 py-5 text-center text-xs text-muted">{text}</p>;
}

function EditBtn({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Editar"
      className={`absolute right-3 top-3 rounded-lg p-1.5 ${dark ? "text-paper/60 hover:bg-paper/10 hover:text-paper" : "text-muted hover:bg-cream hover:text-ink"}`}
    >
      <Pencil size={14} />
    </button>
  );
}

// ---------------------------------------------------------------------------

function useEscape(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
}

function Overlay({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEscape(onClose);
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={label} className="animate-pop thin-scroll max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 shadow-2xl sm:rounded-2xl">
        {children}
      </div>
    </div>
  );
}

/** Copia texto; se o navegador negar a área de transferência, usa o jeito antigo (seleção + copiar). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function storiesText(clientName: string, week: string, items: TrendItem[]) {
  const lines = [`*Stories da semana · ${clientName}*`, `Semana de ${weekLabel(week)}`, ""];
  items.forEach((s, i) => {
    lines.push(`*${i + 1}. ${s.title}*`);
    if (s.body) lines.push(s.body);
    s.steps.forEach((st, j) => lines.push(`${j + 1}) ${st}`));
    if (s.adapt) lines.push(`_Dica: ${s.adapt}_`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

function StoriesModal({ clientName, week, items, canEdit, onClose, onEdit, onAdd }: {
  clientName: string; week: string; items: TrendItem[]; canEdit: boolean;
  onClose: () => void; onEdit: (i: TrendItem) => void; onAdd: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(storiesText(clientName, week, items))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else alert("Não foi possível copiar. Tente de novo.");
  };
  return (
    <Overlay onClose={onClose} label="Stories da semana">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">Stories da semana</p>
          <p className="text-xs text-muted">Semana de {weekLabel(week)}</p>
        </div>
        <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-1.5 text-graphite hover:bg-cream"><X size={18} /></button>
      </div>
      {canEdit && (
        <button onClick={copy} className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-paper sm:w-auto" style={{ background: WA_GREEN }}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado! Cole no WhatsApp" : "Copiar para WhatsApp"}
        </button>
      )}
      <ol className="flex flex-col gap-3">
        {items.map((s, i) => (
          <li key={s.id} className="relative rounded-xl border border-mist p-3.5">
            {canEdit && <EditBtn onClick={() => onEdit(s)} />}
            <p className="pr-8 text-sm font-semibold">{i + 1}. {s.title}</p>
            {s.body && <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-graphite">{s.body}</p>}
            {s.steps.length > 0 && (
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[13px] text-graphite">
                {s.steps.map((st, j) => <li key={j}>{st}</li>)}
              </ol>
            )}
            {s.adapt && <p className="mt-2 text-xs" style={{ color: GREEN_TEXT }}><b className="font-semibold">Dica:</b> {s.adapt}</p>}
          </li>
        ))}
      </ol>
      {canEdit && (
        <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><Plus size={13} /> Adicionar ideia de Stories</button>
      )}
    </Overlay>
  );
}

function Editor({ kind, item, onClose, onSave, onDelete }: {
  kind: TrendKind; item?: TrendItem; onClose: () => void; onSave: (i: TrendInput) => void; onDelete?: () => void;
}) {
  const [v, setV] = useState({
    title: item?.title ?? "", body: item?.body ?? "", handle: item?.handle ?? "", link: item?.link ?? "",
    stat: item?.stat ?? "", adapt: item?.adapt ?? "", steps: (item?.steps ?? []).join("\n"),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const isRef = kind === "referencia";
  const hasSteps = kind === "gravar" || kind === "stories";
  const input = "w-full rounded-lg border border-mist bg-paper px-3 py-2 text-sm focus:border-sand focus:outline-none";
  const label = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.title.trim() && !v.handle.trim()) { alert("Preencha o título."); return; }
    onSave({ kind, ...v, steps: v.steps.split("\n").map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean) });
  };
  return (
    <Overlay onClose={onClose} label={`Editar ${KIND_LABEL[kind]}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">{item ? "Editar" : "Nova"} · {KIND_LABEL[kind].toLowerCase()}</p>
          <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-1.5 text-graphite hover:bg-cream"><X size={18} /></button>
        </div>
        {isRef && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Perfil</label><input value={v.handle} onChange={set("handle")} placeholder="@perfil" className={input} /></div>
            <div><label className={label}>Destaque</label><input value={v.stat} onChange={set("stat")} placeholder="Reels · 120 mil visualizações" className={input} /></div>
          </div>
        )}
        <div><label className={label}>Título</label><input value={v.title} onChange={set("title")} className={input} autoFocus /></div>
        <div><label className={label}>{isRef ? "O que o post faz" : "Explicação"}</label><textarea value={v.body} onChange={set("body")} rows={3} className={input} /></div>
        {hasSteps && (
          <div><label className={label}>Passo a passo (um por linha)</label><textarea value={v.steps} onChange={set("steps")} rows={4} className={input} /></div>
        )}
        <div>
          <label className={label}>{isRef ? "Como adaptar para a cliente" : kind === "mercado" ? "Para a cliente (opcional)" : "Dica (opcional)"}</label>
          <textarea value={v.adapt} onChange={set("adapt")} rows={2} className={input} />
        </div>
        {isRef && <div><label className={label}>Link da referência</label><input value={v.link} onChange={set("link")} placeholder="https://www.instagram.com/p/..." className={input} /></div>}
        <div className="mt-2 flex items-center justify-between gap-2">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted hover:bg-[#f6e3dc] hover:text-[#b9583a]">
              <Trash2 size={14} /> Excluir
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-3.5 py-2 text-sm text-graphite hover:bg-cream">Cancelar</button>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-sm font-medium text-paper hover:bg-graphite"><Check size={14} /> Salvar</button>
          </div>
        </div>
      </form>
    </Overlay>
  );
}
