"use client";

import { ChevronLeft, ChevronRight, Loader2, Trash2, Upload, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
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

function RemoveButton({ item, label }: { item: MediaItem; label: string }) {
  const store = useStore();
  return (
    <button
      onClick={() => confirm(`Remover ${label}? O arquivo será apagado.`) && store.removeMedia(item.id)}
      aria-label={`Remover ${label}`}
      className="rounded-full bg-paper/90 p-1.5 text-graphite shadow hover:text-[#b9583a]"
    >
      <Trash2 size={13} />
    </button>
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

function Lightbox({ images, index, onClose, onIndex }: { images: MediaItem[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
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
      <button aria-label="Fechar" className="absolute right-4 top-4 rounded-full bg-paper/10 p-2 text-paper hover:bg-paper/20" onClick={onClose}>
        <X size={20} />
      </button>
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
            {video ? (
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
            {canUpload && video && <div className="absolute right-2 top-2"><RemoveButton item={video} label="o vídeo" /></div>}
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
            </div>
          </div>
        </div>
        {canUpload && (
          <div className="flex flex-wrap gap-2">
            <UploadButton blockId={block.id} kind="video" label={video ? "Trocar vídeo" : "Enviar vídeo"} />
            <UploadButton blockId={block.id} kind="cover" label={cover ? "Trocar capa" : "Enviar capa"} />
          </div>
        )}
        {zoom !== null && cover && <Lightbox images={[cover]} index={0} onIndex={() => {}} onClose={() => setZoom(null)} />}
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
          </div>
        )}
        {total > 0 && (
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
            {images.map((m, i) => (
              <div key={m.id} className="group relative">
                <button onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} className={`block w-full overflow-hidden rounded-md ring-2 transition ${i === current ? "ring-ink" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                  <img src={m.url} alt="" className="aspect-[4/5] w-full object-cover" />
                </button>
                {canUpload && <div className="absolute -right-1.5 -top-1.5 hidden group-hover:block"><RemoveButton item={m} label={`o slide ${i + 1}`} /></div>}
              </div>
            ))}
          </div>
        )}
        {canUpload && <div><UploadButton blockId={block.id} kind="image" label={total ? "Adicionar imagens" : "Enviar imagens"} multiple /></div>}
        {zoom !== null && total > 0 && <Lightbox images={images} index={zoom} onIndex={(i) => { setZoom(i); setSlide(i); }} onClose={() => setZoom(null)} />}
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
      {zoom !== null && photo && <Lightbox images={[photo]} index={0} onIndex={() => {}} onClose={() => setZoom(null)} />}
    </div>
  );
}
