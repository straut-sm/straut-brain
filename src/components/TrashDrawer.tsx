"use client";

import { CalendarDays, Sparkles, FileText, Image as ImageIcon, LayoutGrid, Loader2, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getTrash, purgeFromTrash, restoreFromTrash } from "@/app/actions";
import type { TrashEntry } from "@/lib/trash";
import { formatDateTime } from "@/lib/dates";
import type { Client } from "@/lib/types";

const ICON = { bloco: LayoutGrid, midia: ImageIcon, arquivo: FileText, evento: CalendarDays, tendencia: Sparkles } as const;

/**
 * Lixeira do painel: o que foi apagado fica 30 dias, pode ser restaurado ou apagado de vez.
 * No fim ficam as páginas desativadas (não somem; reativar pela Gestão da cliente).
 */
export default function TrashDrawer({ onClose, inactive = [], onManageClient }: {
  onClose: () => void; inactive?: Client[]; onManageClient?: (id: string) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<TrashEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await getTrash();
    if (r.ok) setItems(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const act = async (e: TrashEntry, what: "restore" | "purge") => {
    if (what === "purge" && !confirm(`Apagar "${e.label}" de vez? Não será possível recuperar.`)) return;
    setBusy(`${e.kind}:${e.id}`);
    const r = what === "restore" ? await restoreFromTrash(e.kind, e.id) : await purgeFromTrash(e.kind, e.id);
    setBusy(null);
    if (!r.ok) return alert(r.error);
    setItems((list) => list?.filter((x) => !(x.kind === e.kind && x.id === e.id)) ?? null);
    if (what === "restore") router.refresh();
  };

  return (
    <div className="animate-fade fixed inset-0 z-50 flex justify-end bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="animate-pop flex h-full w-full max-w-md flex-col bg-paper shadow-2xl" aria-label="Lixeira">
        <div className="flex items-center justify-between border-b border-mist px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Lixeira</h2>
            <p className="text-xs text-muted">O que é apagado fica aqui 30 dias e depois some de vez.</p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-graphite hover:bg-cream"><X size={18} /></button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto p-5">
          {error && <p className="rounded-xl bg-cream p-3 text-sm text-[#b9583a]">{error}</p>}
          {!items && !error && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Carregando…</p>}
          {items?.length === 0 && !inactive.length && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted">
              <Trash2 size={28} className="text-sand" />
              A lixeira está vazia.
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {items?.map((e) => {
              const Icon = ICON[e.kind];
              const key = `${e.kind}:${e.id}`;
              return (
                <li key={key} className="rounded-2xl border border-mist p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg bg-cream p-1.5 text-graphite"><Icon size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{e.label}</p>
                      <p className="truncate text-xs text-muted">{e.detail}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span className="inline-flex items-center gap-1 font-medium" style={{ color: e.clientColor }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.clientColor }} /> {e.client}
                        </span>
                        <span>Apagado por {e.deletedBy} em {formatDateTime(e.deletedAt)}</span>
                      </p>
                      <p className={`mt-0.5 text-[11px] font-medium ${e.daysLeft <= 3 ? "text-[#b9583a]" : "text-graphite"}`}>
                        {e.daysLeft === 0 ? "Some hoje" : `Some em ${e.daysLeft} ${e.daysLeft === 1 ? "dia" : "dias"}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => act(e, "restore")}
                      disabled={!!busy}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50"
                    >
                      {busy === key ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restaurar
                    </button>
                    <button
                      onClick={() => act(e, "purge")}
                      disabled={!!busy}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-cream hover:text-[#b9583a] disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Apagar de vez
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {inactive.length > 0 && (
            <section className={items?.length ? "mt-8" : ""}>
              <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Páginas desativadas <span className="font-normal">({inactive.length})</span></h3>
              <p className="mb-3 mt-1 text-xs text-muted">Ficam guardadas sem prazo. Para reativar, abra a Gestão da cliente.</p>
              <ul className="flex flex-col gap-2">
                {inactive.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onManageClient?.(c.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-mist p-3 text-left hover:border-sand hover:bg-cream/50"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                        <span className="block truncate text-xs text-muted">{c.specialty}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-graphite"><Settings2 size={13} /> Gestão</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
