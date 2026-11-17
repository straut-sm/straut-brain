"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, Link2, Loader2, Trash2, Upload, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { driveDownloadUrl, driveFileId, driveViewUrl } from "@/lib/drive";
import type { Block, MediaItem, MediaKind } from "@/lib/types";
import PostArt from "./PostArt";

const ACCEPT: Record<MediaKind, string> = { video: "video/*", cover: "image/*", image: "image/*" };

function UploadButton({ blockId, kind, label, multiple = false }: { blockId: string; kind: MediaKind; label: string; multiple?: boolean }) {
  const store = useStore();
  const [sending, setSending] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setSending(true);
    await store.uploadMedia(blockId, kind, files);
    setSending(false);
  };
  return (
    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-sand px-2.5 py-1.5 text-xs text-graphite hover:bg-cream focus-within:ring-2 focus-within:ring-ink ${sending ? "pointer-events-none opacity-60" : ""}`}>
      {sending ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Upload size={13} /> {label}</>}
      <input type="file" accept={ACCEPT[kind]} multiple={multiple} className="sr-only" onChange={pick} disabled={sending} />
    </label>
  );
}

/** Cola o link de um vídeo do Google Drive (o painel guarda só o link). */
function DriveLinkButton({ blockId, hasVideo }: { blockId: string; hasVideo: boolean }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = !!driveFileId(link);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    await store.attachDriveVideo(blockId, link);
    setSaving(false);
    setLink("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-sand px-2.5 py-1.5 text-xs text-graphite hover:bg-cream"
      >
        <Link2 size={13} /> {hasVideo ? "Trocar por link do Drive" : "Link do Drive"}
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-mist bg-cream/50 p-2.5">
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }}
          placeholder="Cole o link do vídeo no Google Drive"
          className="min-w-0 flex-1 rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ink"
        />
        <button
          onClick={save}
          disabled={!valid || saving}
          className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-paper disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : "Salvar"}
        </button>
        <button onClick={() => setOpen(false)} aria-label="Cancelar" className="rounded-lg px-1.5 text-muted hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <p className="text-[11px] leading-snug text-muted">
        {link && !valid
          ? "Esse não parece um link de arquivo do Google Drive."
          : "No Drive, o arquivo precisa estar em \"Qualquer pessoa com o link pode ver\"."}
      </p>
    </div>
  );
}

function RemoveButton({ item, label }: { item: MediaItem; label: string }) {
  const store = useStore();
  return (
    <button
      onClick={() => confirm(item.driveId
        ? `Remover ${label}? Só o link sai do painel; o arquivo continua no Google Drive.`
        : `Remover ${label}? O arquivo será apagado.`) && store.removeMedia(item.id)}
      aria-label={`Remover ${label}`}
      className="rounded-full bg-paper/90 p-1.5 text-graphite shadow hover:text-[#b9583a]"
    >
      <Trash2 size={13} />
    </button>
  );
}

/** Nome do arquivo baixado: título do bloco + o que é + extensão original. */
function fileName(block: Block, what: string, url: string): string {
  const ext = (new URL(url, "http://x").pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase();
  const base = block.title
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")
    .toLowerCase().slice(0, 60) || "conteudo";
  return `${base}-${what}${ext ? `.${ext}` : ""}`;
}

/** O link assinado do Supabase aceita ?download= e devolve o arquivo como anexo, com esse nome. */
function downloadUrl(url: string, name: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}

function DownloadButton({ block, item, what, label, className = "" }: {
  block: Block; item: MediaItem; what: string; label: string; className?: string;
}) {
  // Vídeo do Drive: o download é feito pelo próprio Google Drive
  const drive = item.driveId ? { href: driveDownloadUrl(item.driveId), target: "_blank", rel: "noopener noreferrer" } : null;
  return (
    <a
      {...(drive ?? { href: downloadUrl(item.url, fileName(block, what, item.url)), download: true })}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Baixar ${label}`}
      title={`Baixar ${label}`}
      className={`inline-flex items-center justify-center rounded-full bg-paper/90 p-1.5 text-graphite shadow hover:bg-paper hover:text-ink ${className}`}
    >
      <Download size={13} />
    </a>
  );
}

function Empty({ block, ratio, text }: { block: Block; ratio: string; text: string }) {
  return (
    <div className="relative">
      <PostArt hue={block.hue} title="" className={`${ratio} w-full rounded-xl`} />
      <p className="absolute inset-x-0 bottom-4 text-center text-xs font-medium text-ink/60">{text}</p>
    </div>
  );
}

function Lightbox({ block, what, images, index, onClose, onIndex }: {
  block: Block; what: (i: number) => string; images: MediaItem[]; index: number; onClose: () => void; onIndex: (i: number) => void;
}) {
  const total = images.length;
  const prev = useCallback(() => onIndex((index - 1 + total) % total), [index, total, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % total), [index, total, onIndex]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose, prev, next]);

  return (
    <div className="animate-fade fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4" onClick={onClose}>
      <div className="absolute right-4 top-4 flex gap-2">
        <a
          href={downloadUrl(images[index].url, fileName(block, what(index), images[index].url))}
          download
          onClick={(e) => e.stopPropagation()}
          aria-label="Baixar imagem"
          title="Baixar imagem"
          className="rounded-full bg-paper/10 p-2 text-paper hover:bg-paper/20"
        >
          <Download size={20} />
        </a>
        <button aria-label="Fechar" className="rounded-full bg-paper/10 p-2 text-paper hover:bg-paper/20" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {total > 1 && (
        <>
          <button aria-label="Anterior" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 rounded-full bg-paper/10 p-2.5 text-paper hover:bg-paper/20 md:left-8">
            <ChevronLeft size={22} />
          </button>
          <button aria-label="Próximo" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 rounded-full bg-paper/10 p-2.5 text-paper hover:bg-paper/20 md:right-8">
            <ChevronRight size={22} />
          </button>
        </>
      )}
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
        <img src={images[index].url} alt={`Imagem ${index + 1}`} className="max-h-[82vh] max-w-[90vw] rounded-xl object-contain" />
        {total > 1 && <p className="text-sm text-paper/70">{index + 1} de {total}</p>}
      </div>
    </div>
  );
}

/**
 * Miniaturas do carrossel. Com o mouse, clique e arraste; no toque, segure um instante e arraste
 * (assim a rolagem normal da tela continua funcionando). A ordem só é gravada ao soltar.
 */
function ThumbStrip({ block, images, current, canReorder, canRemove, onSelect }: {
  block: Block; images: MediaItem[]; current: number; canReorder: boolean; canRemove: boolean; onSelect: (i: number) => void;
}) {
  const store = useStore();
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const justDragged = useRef(false);
  const byId = new Map(images.map((m) => [m.id, m]));
  const shown = order ? order.map((id) => byId.get(id)).filter((m): m is MediaItem => !!m) : images;
  const currentId = images[current]?.id;

  const start = (e: React.PointerEvent, id: string) => {
    if (!canReorder || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a, [data-nodrag]")) return;
    const touch = e.pointerType !== "mouse";
    const x0 = e.clientX, y0 = e.clientY;
    let active = false;
    let list = images.map((m) => m.id);

    const activate = () => {
      active = true;
      setDragId(id);
      setOrder(list);
      if (touch && navigator.vibrate) navigator.vibrate(15);
    };
    const timer = touch ? window.setTimeout(activate, 300) : 0;

    const move = (ev: PointerEvent) => {
      if (!active) {
        const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        if (touch && dist > 8) return cleanup(); // é rolagem, não arraste
        if (!touch && dist > 5) activate();
        if (!active) return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-thumb]");
      const over = el?.dataset.thumb;
      if (!over || over === id) return;
      const next = list.filter((x) => x !== id);
      const at = next.indexOf(over);
      const from = list.indexOf(id), to = list.indexOf(over);
      next.splice(from < to ? at + 1 : at, 0, id);
      list = next;
      setOrder(next);
    };
    const block_ = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
    const up = () => {
      const changed = active && list.some((x, i) => x !== images[i]?.id);
      if (active) {
        justDragged.current = true;
        window.setTimeout(() => { justDragged.current = false; }, 0);
      }
      cleanup();
      if (changed) {
        if (currentId) onSelect(list.indexOf(currentId));
        store.reorderMedia(block.id, list);
      }
    };
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("touchmove", block_);
      setDragId(null);
      setOrder(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("touchmove", block_, { passive: false });
  };

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
      {shown.map((m) => {
        const i = images.indexOf(m);
        const pos = shown.indexOf(m);
        const selected = m.id === currentId;
        return (
          <div
            key={m.id}
            data-thumb={m.id}
            onPointerDown={(e) => start(e, m.id)}
            onContextMenu={(e) => canReorder && e.preventDefault()}
            className={`group relative select-none [-webkit-touch-callout:none] ${canReorder ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === m.id ? "z-10 scale-105 opacity-60" : ""} transition-transform`}
          >
            <button
              onClick={() => { if (!justDragged.current) onSelect(i); }}
              aria-label={`Slide ${pos + 1}`}
              className={`block w-full overflow-hidden rounded-md ring-2 transition ${selected ? "ring-ink" : "ring-transparent opacity-70 hover:opacity-100"} ${dragId === m.id ? "ring-sand" : ""}`}
            >
              <img src={m.url} alt="" draggable={false} className="pointer-events-none aspect-[4/5] w-full object-cover" />
            </button>
            {canRemove && !dragId && (
              <div data-nodrag className="absolute -right-1.5 -top-1.5 hidden group-hover:block">
                <RemoveButton item={m} label={`o slide ${pos + 1}`} />
              </div>
            )}
            {!dragId && (
              <DownloadButton block={block} item={m} what={`slide-${pos + 1}`} label={`o slide ${pos + 1}`} className="absolute -bottom-1.5 -right-1.5 !p-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Media({ block, canUpload }: { block: Block; canUpload: boolean }) {
  const [slide, setSlide] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const video = block.media.find((m) => m.kind === "video");
  const cover = block.media.find((m) => m.kind === "cover");
  const images = block.media.filter((m) => m.kind === "image");

  if (block.format === "reels") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <div className="relative w-full max-w-[300px] flex-1">
            {video?.driveId ? (
              <iframe
                key={video.id}
                src={video.url}
                title="Vídeo no Google Drive"
                allow="autoplay; fullscreen"
                allowFullScreen
                className="aspect-[9/16] w-full rounded-xl border-0 bg-ink"
              />
            ) : video ? (
              <video
                key={video.id}
                src={video.url}
                poster={cover?.url}
                controls
                playsInline
                preload="metadata"
                className="aspect-[9/16] w-full rounded-xl bg-ink object-contain"
              />
            ) : (
              <Empty block={block} ratio="aspect-[9/16]" text={canUpload ? "Envie o vídeo final" : "Vídeo em produção"} />
            )}
            {video && (
              <div className="absolute right-2 top-2 flex gap-1.5">
                <DownloadButton block={block} item={video} what="video" label="o vídeo" />
                {canUpload && <RemoveButton item={video} label="o vídeo" />}
              </div>
            )}
          </div>
          <div className="w-[84px] shrink-0">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Capa</p>
            <div className="relative">
              {cover ? (
                <button onClick={() => setZoom(0)} aria-label="Ampliar capa" className="block w-full">
                  <img src={cover.url} alt="Capa" className="aspect-[9/16] w-full rounded-lg object-cover ring-1 ring-mist" />
                </button>
              ) : (
                <PostArt hue={(block.hue + 40) % 360} title="" compact className="aspect-[9/16] w-full rounded-lg ring-1 ring-mist" />
              )}
              {canUpload && cover && <div className="absolute -right-2 -top-2"><RemoveButton item={cover} label="a capa" /></div>}
              {cover && <div className="absolute -bottom-2 -right-2"><DownloadButton block={block} item={cover} what="capa" label="a capa" /></div>}
            </div>
          </div>
        </div>
        {video?.driveId && (
          <a
            href={driveViewUrl(video.driveId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 self-start text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Vídeo no Google Drive <ExternalLink size={11} />
          </a>
        )}
        {canUpload && (
          <div className="flex flex-wrap gap-2">
            <UploadButton blockId={block.id} kind="video" label={video ? "Trocar vídeo" : "Enviar vídeo"} />
            <UploadButton blockId={block.id} kind="cover" label={cover ? "Trocar capa" : "Enviar capa"} />
            <DriveLinkButton blockId={block.id} hasVideo={!!video} />
          </div>
        )}
        {zoom !== null && cover && <Lightbox block={block} what={() => "capa"} images={[cover]} index={0} onIndex={() => {}} onClose={() => setZoom(null)} />}
      </div>
    );
  }

  if (block.format === "carrossel") {
    const total = images.length;
    const current = Math.min(slide, Math.max(0, total - 1));
    return (
      <div className="flex flex-col gap-3">
        {total === 0 ? (
          <Empty block={block} ratio="aspect-[4/5]" text={canUpload ? "Envie as imagens do carrossel" : "Carrossel em produção"} />
        ) : (
          <div className="relative">
            <button onClick={() => setZoom(current)} className="group block w-full" aria-label="Ampliar slide">
              <img src={images[current].url} alt={`Slide ${current + 1}`} className="aspect-[4/5] w-full rounded-xl bg-mist object-cover" />
              <span className="absolute right-3 top-3 rounded-full bg-paper/80 p-1.5 text-ink opacity-0 transition group-hover:opacity-100">
                <ZoomIn size={15} />
              </span>
            </button>
            {total > 1 && (
              <>
                <button aria-label="Slide anterior" onClick={() => setSlide((current - 1 + total) % total)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-paper/85 p-1.5 text-ink shadow hover:bg-paper">
                  <ChevronLeft size={18} />
                </button>
                <button aria-label="Próximo slide" onClick={() => setSlide((current + 1) % total)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-paper/85 p-1.5 text-ink shadow hover:bg-paper">
                  <ChevronRight size={18} />
                </button>
              </>
            )}
            <span className="absolute bottom-3 left-3 rounded-full bg-paper/85 px-2 py-0.5 text-[11px] font-medium text-ink">{current + 1}/{total}</span>
            <DownloadButton block={block} item={images[current]} what={`slide-${current + 1}`} label={`o slide ${current + 1}`} className="absolute bottom-3 right-3" />
          </div>
        )}
        {total > 0 && (
          <ThumbStrip
            block={block}
            images={images}
            current={current}
            canReorder={canUpload && total > 1}
            canRemove={canUpload}
            onSelect={setSlide}
          />
        )}
        {canUpload && total > 1 && (
          <p className="-mt-1 text-[11px] text-muted">Arraste as miniaturas para mudar a ordem (no celular, segure e arraste).</p>
        )}
        {canUpload && <div><UploadButton blockId={block.id} kind="image" label={total ? "Adicionar imagens" : "Enviar imagens"} multiple /></div>}
        {zoom !== null && total > 0 && <Lightbox block={block} what={(i) => `slide-${i + 1}`} images={images} index={zoom} onIndex={(i) => { setZoom(i); setSlide(i); }} onClose={() => setZoom(null)} />}
      </div>
    );
  }

  // foto
  const photo = images[0];
  return (
    <div className="flex flex-col gap-3">
      {photo ? (
        <div className="relative">
          <button onClick={() => setZoom(0)} className="group relative block w-full" aria-label="Ampliar foto">
            <img src={photo.url} alt="Foto" className="aspect-[4/5] w-full rounded-xl bg-mist object-cover" />
            <span className="absolute right-3 top-3 rounded-full bg-paper/80 p-1.5 text-ink opacity-0 transition group-hover:opacity-100">
              <ZoomIn size={15} />
            </span>
          </button>
          <DownloadButton block={block} item={photo} what="foto" label="a foto" className="absolute bottom-3 right-3" />
        </div>
      ) : (
        <Empty block={block} ratio="aspect-[4/5]" text={canUpload ? "Envie a foto" : "Foto em produção"} />
      )}
      {canUpload && (
        <div className="flex gap-2">
          <UploadButton blockId={block.id} kind="image" label={photo ? "Trocar foto" : "Enviar foto"} />
          {photo && <RemoveButton item={photo} label="a foto" />}
        </div>
      )}
      {zoom !== null && photo && <Lightbox block={block} what={() => "foto"} images={[photo]} index={0} onIndex={() => {}} onClose={() => setZoom(null)} />}
    </div>
  );
}
