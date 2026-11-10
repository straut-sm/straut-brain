"use client";

import { Clapperboard, GalleryHorizontal, Grid3x3, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Block, Client } from "@/lib/types";
import { STATUSES, statusLabel } from "@/lib/meta";
import { formatShort } from "@/lib/dates";
import PostArt from "./PostArt";
import { initialsOf } from "./ClientForm";

/** Hue da imagem que aparece no feed: capa (Reels), 1ª imagem (Carrossel) ou a foto. */
function feedHue(b: Block) {
  return b.format === "reels" ? (b.hue + 40) % 360 : b.hue;
}

/**
 * Prévia do feed do Instagram: só a imagem de capa de cada post,
 * do mais recente (topo) ao mais antigo (embaixo), em 3 colunas.
 */
export default function FeedView({ client, blocks, onClose, onOpen, paused }: {
  client: Client;
  blocks: Block[];
  onClose: () => void;
  onOpen: (id: string) => void;
  /** Quando um bloco está aberto por cima, o Esc fecha só ele. */
  paused: boolean;
}) {
  const [onlyApproved, setOnlyApproved] = useState(false);

  useEffect(() => {
    if (paused) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, paused]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const posts = useMemo(
    () => blocks
      .filter((b) => b.format !== "roteiro")
      .filter((b) => !onlyApproved || b.status === "aprovado" || b.status === "publicado")
      .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date))),
    [blocks, onlyApproved],
  );
  const published = blocks.filter((b) => b.format !== "roteiro" && b.status === "publicado").length;
  const initials = initialsOf(client.name);

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px] md:items-center md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Visualização de feed" className="animate-pop flex h-[94dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-2xl bg-paper shadow-2xl md:h-[88vh] md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-mist px-4 py-3">
          <p className="flex items-center gap-2 font-display text-base font-semibold"><Grid3x3 size={17} /> Visualização de feed</p>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-graphite hover:bg-cream"><X size={19} /></button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto">
          {/* Perfil */}
          <div className="flex items-center gap-4 px-5 pb-4 pt-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-xl font-semibold text-paper ring-2 ring-paper outline outline-2 outline-sand" style={{ background: client.color }}>
              {client.avatar ? <img src={client.avatar} alt={client.name} className="h-full w-full object-cover" /> : initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{client.name}</p>
              <p className="text-xs text-muted">{client.specialty}</p>
              <p className="mt-1.5 text-xs text-graphite">
                <span className="font-semibold">{published}</span> publicados · <span className="font-semibold">{posts.length}</span> no feed
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 px-5 pb-3">
            <button onClick={() => setOnlyApproved(false)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!onlyApproved ? "bg-ink text-paper" : "bg-cream text-graphite"}`}>
              Todos os planejados
            </button>
            <button onClick={() => setOnlyApproved(true)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${onlyApproved ? "bg-ink text-paper" : "bg-cream text-graphite"}`}>
              Só aprovados
            </button>
          </div>

          <div className="grid grid-cols-3 gap-[2px] border-t border-mist">
            {posts.map((b) => {
              const Icon = b.format === "reels" ? Clapperboard : b.format === "carrossel" ? GalleryHorizontal : null;
              const done = b.status === "publicado";
              return (
                <button
                  key={b.id}
                  onClick={() => onOpen(b.id)}
                  className="group relative block aspect-[3/4] overflow-hidden"
                  title={`${b.title} · ${formatShort(b.date)} · ${statusLabel(b.status, b.format)}`}
                >
                  <PostArt hue={feedHue(b)} title={b.title} compact className="h-full w-full transition group-hover:scale-[1.03]" />
                  {Icon && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-paper/85 p-1 text-ink backdrop-blur">
                      <Icon size={12} />
                    </span>
                  )}
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-paper/85 px-1.5 py-0.5 text-[9.5px] font-medium text-ink backdrop-blur">
                    {!done && <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUSES[b.status].color }} />}
                    {formatShort(b.date)}
                  </span>
                </button>
              );
            })}
          </div>
          {posts.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted">Nenhum post para mostrar.</p>}
          <p className="px-5 py-4 text-center text-[11px] text-muted">Do mais recente (topo) ao mais antigo, como no Instagram.</p>
        </div>
      </div>
    </div>
  );
}
