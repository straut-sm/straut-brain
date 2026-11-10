"use client";

import {
  Check, ChevronDown, Copy, ExternalLink, History, MessageCircle, Pencil, Send, Trash2, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Block, Format, HistoryEntry } from "@/lib/types";
import { FORMATS, FORMAT_ORDER } from "@/lib/meta";
import { formatDateTime, formatLong } from "@/lib/dates";
import { wordDiff } from "@/lib/diff";
import { Button, FormatBadge, StatusPill } from "./ui";
import Media from "./Media";

export type ModalMode = "straut" | "cliente" | "visualizacao";

type Draft = { title: string; caption: string; script: string; date: string };

export default function BlockModal({
  blockId, mode, onClose, showClient = false,
}: { blockId: string; mode: ModalMode; onClose: () => void; showClient?: boolean }) {
  const store = useStore();
  const block = store.blocks.find((b) => b.id === blockId);
  const client = block ? store.clientById(block.clientId) : undefined;
  const [editing, setEditing] = useState<null | "straut" | "suggest">(null);
  const [draft, setDraft] = useState<Draft>({ title: "", caption: "", script: "", date: "" });

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // A Straut, ao abrir, marca comentários da cliente como lidos
  useEffect(() => {
    if (mode === "straut" && block?.comments.some((c) => !c.seen)) store.markCommentsSeen(block.id);
  }, [mode, block, store]);

  if (!block) return null;
  const primary: "caption" | "script" = block.format === "roteiro" ? "script" : "caption";

  const startEdit = (kind: "straut" | "suggest") => {
    setDraft({ title: block.title, caption: block.caption, script: block.script, date: block.date });
    setEditing(kind);
  };
  const save = () => {
    if (editing === "straut") store.updateBlock(block.id, "Straut", draft);
    if (editing === "suggest") store.suggest(block.id, primary, draft[primary]);
    setEditing(null);
  };

  const field = (name: "caption" | "script", label: string) => (
    <TextSection
      label={label}
      block={block}
      name={name}
      mode={mode}
      editable={editing === "straut" || (editing === "suggest" && name === primary)}
      suggesting={editing === "suggest" && name === primary}
      value={editing ? draft[name] : block[name]}
      onChange={(v) => setDraft((d) => ({ ...d, [name]: v }))}
      onResolve={(accept) => store.resolveSuggestion(block.id, accept)}
    />
  );

  const info = (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
            {block.format === "roteiro" ? "Data prevista" : "Dia de postagem"}
          </p>
          {editing === "straut" ? (
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className="w-full rounded-lg border border-sand bg-paper px-2 py-1.5 text-sm"
            />
          ) : (
            <p className="text-sm text-ink first-letter:uppercase">{formatLong(block.date)}</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">Status</p>
          <StatusPill status={block.status} format={block.format} />
        </div>
      </div>

      {!editing && <Actions block={block} mode={mode} onSuggest={() => startEdit("suggest")} />}

      {block.format === "roteiro" ? (block.caption || editing === "straut") && field("caption", "Legenda") : field("caption", "Legenda")}

      {mode !== "visualizacao" && !editing && <Comments block={block} mode={mode} />}

      {mode === "visualizacao" && client && (
        <Link
          href={`/c/${client.slug}?bloco=${block.id}`}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-graphite underline-offset-4 hover:text-ink hover:underline"
        >
          Editar na página da cliente <ExternalLink size={14} />
        </Link>
      )}
    </div>
  );

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px] md:items-center md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={block.title}
        className="animate-pop flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-paper shadow-2xl md:h-auto md:max-h-[90vh] md:rounded-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 border-b border-mist px-4 py-3.5 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {mode === "straut" && !editing ? (
                <FormatSelect value={block.format} onChange={(f) => store.changeFormat(block.id, f)} />
              ) : (
                <FormatBadge format={block.format} />
              )}
              {showClient && client && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: client.color }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: client.color }} /> {client.name}
                </span>
              )}
            </div>
            {editing === "straut" ? (
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full rounded-lg border border-sand px-2 py-1 font-display text-xl font-semibold"
                aria-label="Título"
              />
            ) : (
              <h2 className="font-display text-xl font-semibold leading-tight md:text-2xl">{block.title}</h2>
            )}
          </div>
          {mode === "straut" && !editing && (
            <Button variant="outline" onClick={() => startEdit("straut")} className="hidden sm:inline-flex">
              <Pencil size={14} /> Editar
            </Button>
          )}
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-graphite hover:bg-cream">
            <X size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="thin-scroll flex-1 overflow-y-auto">
          <div className={`grid gap-6 px-4 py-5 md:gap-8 md:px-6 md:py-6 ${block.format === "roteiro" ? "md:grid-cols-[1fr_1.15fr]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"}`}>
            {block.format === "roteiro" ? (
              <>
                {info}
                <div>{field("script", "Roteiro")}</div>
              </>
            ) : (
              <>
                <div><Media block={block} canUpload={mode === "straut"} /></div>
                {info}
              </>
            )}
          </div>
          {mode === "straut" && !editing && (
            <div className="flex gap-2 px-4 pb-4 sm:hidden">
              <Button variant="outline" onClick={() => startEdit("straut")} className="flex-1"><Pencil size={14} /> Editar</Button>
            </div>
          )}
        </div>

        {/* Barra de edição */}
        {editing && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist bg-cream px-4 py-3 md:px-6">
            <p className="text-xs text-graphite">
              {editing === "suggest"
                ? "Edite o texto diretamente. A Straut revisa sua sugestão antes de aplicar."
                : "As alterações ficam salvas no histórico do bloco."}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" onClick={save}>
                {editing === "suggest" ? <><Send size={14} /> Enviar sugestão</> : <><Check size={14} /> Salvar</>}
              </Button>
            </div>
          </div>
        )}

        {/* Histórico */}
        {!editing && (
          <HistoryFooter
            history={block.history}
            onDelete={mode === "straut" ? () => { if (confirm("Excluir este bloco? Esta ação não pode ser desfeita.")) { store.deleteBlock(block.id); onClose(); } } : undefined}
          />
        )}
      </div>
    </div>
  );
}

function FormatSelect({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const Icon = FORMATS[value].icon;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-cream px-2.5 py-1 text-xs font-medium text-graphite hover:border-graphite/30"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon size={13} strokeWidth={1.8} /> {FORMATS[value].label} <ChevronDown size={12} />
      </button>
      {open && (
        <div role="listbox" className="animate-fade absolute left-0 top-full z-10 mt-1 w-52 rounded-xl border border-mist bg-paper p-1 shadow-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted">Alterar formato</p>
          {FORMAT_ORDER.map((f) => {
            const I = FORMATS[f].icon;
            return (
              <button
                key={f}
                role="option"
                aria-selected={f === value}
                onClick={() => { onChange(f); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-cream ${f === value ? "font-medium" : ""}`}
              >
                <I size={15} strokeWidth={1.7} /> {FORMATS[f].label}
                {f === value && <Check size={14} className="ml-auto" />}
              </button>
            );
          })}
          <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] leading-snug text-muted">O conteúdo e o histórico do bloco são mantidos.</p>
        </div>
      )}
    </div>
  );
}

function Actions({ block, mode, onSuggest }: { block: Block; mode: ModalMode; onSuggest: () => void }) {
  const store = useStore();
  const kind = block.format === "roteiro" ? "roteiro" : "post";

  if (mode === "cliente") {
    if (block.status === "aguardando_aprovacao") {
      return (
        <div className="rounded-xl border border-[#ecdcbf] bg-[#fbf5ea] p-4">
          <p className="mb-3 text-sm text-graphite">Este {kind} está aguardando a sua aprovação.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => store.approve(block.id)}><Check size={15} /> Aprovar {kind}</Button>
            <Button variant="outline" onClick={onSuggest}><Pencil size={14} /> Sugerir alteração</Button>
          </div>
        </div>
      );
    }
    if (block.status === "ajuste_sugerido")
      return <Note>Sua sugestão foi enviada. A Straut vai revisar e te avisar.</Note>;
    if (block.status === "aprovado")
      return <Note tone="ok">Você aprovou este {kind}. Obrigado!</Note>;
    if (block.status === "publicado")
      return <Note tone="ok">Este post já foi publicado.</Note>;
    return <Note>A Straut está produzindo este conteúdo. Ele aparecerá para aprovação em breve.</Note>;
  }

  if (mode === "straut") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.status === "em_producao" && (
          <Button variant="primary" onClick={() => store.setStatus(block.id, "aguardando_aprovacao", "Straut", "Enviado para aprovação")}>
            <Send size={14} /> Enviar para aprovação
          </Button>
        )}
        {block.status === "aprovado" && block.format !== "roteiro" && (
          <Button variant="primary" onClick={() => store.setStatus(block.id, "publicado", "Straut", "Marcado como publicado")}>
            <Check size={15} /> Marcar como publicado
          </Button>
        )}
        {block.status === "publicado" && (
          <Button variant="ghost" onClick={() => store.setStatus(block.id, "aprovado", "Straut", "Publicação desfeita")}>
            Desfazer publicação
          </Button>
        )}
        {block.status === "aguardando_aprovacao" && <Note>Aguardando aprovação da cliente.</Note>}
        {block.status === "ajuste_sugerido" && <Note tone="warn">A cliente sugeriu uma alteração. Revise abaixo.</Note>}
      </div>
    );
  }
  return null;
}

function Note({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const s = {
    neutral: "bg-cream text-graphite",
    ok: "bg-[#e9f1e9] text-[#3f6b45]",
    warn: "bg-[#f6e3dc] text-[#9b4429]",
  }[tone];
  return <p className={`rounded-xl px-3.5 py-2.5 text-sm ${s}`}>{children}</p>;
}

function TextSection({
  label, block, name, mode, editable, suggesting, value, onChange, onResolve,
}: {
  label: string; block: Block; name: "caption" | "script"; mode: ModalMode;
  editable: boolean; suggesting: boolean; value: string;
  onChange: (v: string) => void; onResolve: (accept: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const sug = block.suggestion?.field === name ? block.suggestion : undefined;
  const parts = useMemo(() => (sug ? wordDiff(sug.original, sug.proposed) : []), [sug]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block[name]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sem permissão de área de transferência */
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
        {name === "script" && !editable && block.script && (
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-2.5 py-1 text-xs font-medium text-graphite hover:bg-cream">
            {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar roteiro</>}
          </button>
        )}
      </div>

      {editable ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={name === "script" ? 16 : 8}
          autoFocus={suggesting}
          className={`w-full resize-y rounded-xl border bg-paper p-3.5 text-sm leading-relaxed outline-none focus:ring-2 ${suggesting ? "border-[#e2c9a0] focus:ring-[#ecdcbf]" : "border-sand focus:ring-mist"}`}
        />
      ) : sug ? (
        <div className="rounded-xl border border-[#ecd3c8] bg-[#fdf8f6] p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#b9583a]">
            <Pencil size={12} /> Sugestão da cliente · {formatDateTime(sug.at)}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {parts.map((p, i) =>
              p.type === "same" ? <span key={i}>{p.text}</span>
              : p.type === "del" ? <del key={i} className="mx-px rounded-sm bg-[#f6dcd3] px-0.5 text-[#9b4429] decoration-[#b9583a]">{p.text}</del>
              : <ins key={i} className="mx-px rounded-sm bg-[#dcebdc] px-0.5 text-[#2f5d36] no-underline">{p.text}</ins>,
            )}
          </p>
          {mode === "straut" && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[#ecd3c8] pt-3">
              <Button variant="primary" onClick={() => onResolve(true)}><Check size={14} /> Aceitar sugestão</Button>
              <Button variant="danger" onClick={() => onResolve(false)}><X size={14} /> Recusar</Button>
            </div>
          )}
          {mode !== "straut" && <p className="mt-3 text-xs text-muted">Aguardando revisão da Straut.</p>}
        </div>
      ) : value ? (
        <p className={`whitespace-pre-wrap text-sm leading-relaxed text-ink ${name === "script" ? "rounded-xl bg-cream p-4" : ""}`}>{value}</p>
      ) : (
        <p className="text-sm italic text-muted">Ainda sem {label.toLowerCase()}.</p>
      )}
    </div>
  );
}

function Comments({ block, mode }: { block: Block; mode: ModalMode }) {
  const store = useStore();
  const [text, setText] = useState("");
  const me = mode === "straut" ? "Straut" : "Cliente";
  const send = () => {
    if (!text.trim()) return;
    store.addComment(block.id, me, text.trim());
    setText("");
  };
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
        <MessageCircle size={12} /> Comentários {block.comments.length > 0 && `(${block.comments.length})`}
      </p>
      <div className="flex flex-col gap-2">
        {block.comments.map((c) => (
          <div key={c.id} className={`rounded-xl px-3 py-2 text-sm ${c.by === "Cliente" ? "bg-cream" : "border border-mist"}`}>
            <p className="mb-0.5 text-[11px] text-muted"><span className="font-semibold text-graphite">{c.by}</span> · {formatDateTime(c.at)}</p>
            <p className="text-ink">{c.text}</p>
          </div>
        ))}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Escrever um comentário…"
            className="min-h-[40px] flex-1 resize-none rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mist"
          />
          <Button variant="outline" onClick={send} disabled={!text.trim()} aria-label="Enviar comentário" className="h-10 px-3">
            <Send size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function HistoryFooter({ history, onDelete }: { history: HistoryEntry[]; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const versions = history.filter((h) => h.before).length + 1;
  const list = [...history].reverse();
  return (
    <div className="border-t border-mist bg-cream/60">
      <div className="flex items-center justify-between px-4 md:px-6">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 py-2.5 text-xs font-medium text-graphite hover:text-ink" aria-expanded={open}>
          <History size={14} /> Histórico · {versions} {versions === 1 ? "versão" : "versões"}
          <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
        {onDelete && (
          <button onClick={onDelete} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-[#f6e3dc] hover:text-[#b9583a]">
            <Trash2 size={13} /> Excluir
          </button>
        )}
      </div>
      {open && (
        <ol className="thin-scroll max-h-56 overflow-y-auto px-4 pb-4 md:px-6">
          {list.map((h) => (
            <li key={h.id} className="relative border-l border-sand py-1.5 pl-4">
              <span className={`absolute -left-[4.5px] top-3 h-2 w-2 rounded-full ${h.by === "Cliente" ? "bg-[#c4882c]" : "bg-ink"}`} />
              <p className="text-xs text-ink">
                <span className="text-muted">{formatDateTime(h.at)}</span> · <span className="font-semibold">{h.by}</span> · {h.action}
                {h.before && (
                  <button onClick={() => setPeek(peek === h.id ? null : h.id)} className="ml-2 text-[11px] font-medium text-graphite underline underline-offset-2">
                    {peek === h.id ? "ocultar" : "ver versão anterior"}
                  </button>
                )}
              </p>
              {peek === h.id && h.before && (
                <div className="mt-1.5 rounded-lg border border-mist bg-paper p-3 text-xs leading-relaxed text-graphite">
                  <p className="mb-1"><span className="font-semibold">Formato:</span> {FORMATS[h.before.format].label} · <span className="font-semibold">Título:</span> {h.before.title}</p>
                  {h.before.script && <p className="line-clamp-4 whitespace-pre-wrap"><span className="font-semibold">Roteiro:</span> {h.before.script}</p>}
                  {h.before.caption && <p className="mt-1 line-clamp-3 whitespace-pre-wrap"><span className="font-semibold">Legenda:</span> {h.before.caption}</p>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
