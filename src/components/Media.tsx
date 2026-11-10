"use client";

import { ChevronLeft, ChevronRight, Play, Upload, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Block } from "@/lib/types";
import PostArt from "./PostArt";

function UploadHint({ label }: { label: string }) {
  return (
    <button
      onClick={() => alert("No protótipo o upload ainda não está ativo. Ele entra na versão funcional.")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-sand px-2.5 py-1.5 text-xs text-graphite hover:bg-cream"
    >
      <Upload size={13} /> {label}
    </button>
  );
}

function Lightbox({
  block, index, onClose, onIndex,
}: { block: Block; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const total = block.format === "carrossel" ? block.slides : 1;
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
        <PostArt
          hue={(block.hue + index * 14) % 360}
          title={index === 0 ? block.title : `Ponto ${index} sobre o tema`}
          label={total > 1 ? `Slide ${index + 1}/${total}` : "Foto"}
          index={index}
          className="aspect-[4/5] h-[min(80vh,720px)] max-w-[90vw] rounded-xl"
        />
        {total > 1 && <p className="text-sm text-paper/70">{index + 1} de {total}</p>}
      </div>
    </div>
  );
}

export default function Media({ block, canUpload }: { block: Block; canUpload: boolean }) {
  const [slide, setSlide] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  if (block.format === "reels") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <div className="relative w-full max-w-[300px] flex-1">
            <PostArt hue={block.hue} title="" label="Vídeo final · 0:52" className="aspect-[9/16] w-full rounded-xl" />
            <button
              aria-label="Reproduzir vídeo"
              onClick={() => alert("No protótipo os vídeos são ilustrativos. Na versão funcional, o vídeo editado é reproduzido aqui.")}
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 text-ink shadow-lg backdrop-blur transition hover:scale-105"
            >
              <Play size={22} className="ml-0.5" fill="currentColor" />
            </button>
          </div>
          <div className="w-[84px] shrink-0">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Capa</p>
            <PostArt hue={(block.hue + 40) % 360} title={block.title} compact className="aspect-[9/16] w-full rounded-lg ring-1 ring-mist" />
          </div>
        </div>
        {canUpload && (
          <div className="flex flex-wrap gap-2">
            <UploadHint label="Enviar vídeo" />
            <UploadHint label="Enviar capa" />
          </div>
        )}
      </div>
    );
  }

  if (block.format === "carrossel") {
    const total = block.slides;
    return (
      <div className="flex flex-col gap-3">
        <div className="relative">
          <button onClick={() => setZoom(slide)} className="group block w-full" aria-label="Ampliar slide">
            <PostArt
              hue={(block.hue + slide * 14) % 360}
              title={slide === 0 ? block.title : `Ponto ${slide} sobre o tema`}
              label={`Slide ${slide + 1}/${total}`}
              index={slide}
              className="aspect-[4/5] w-full rounded-xl"
            />
            <span className="absolute right-3 top-3 rounded-full bg-paper/80 p-1.5 text-ink opacity-0 transition group-hover:opacity-100">
              <ZoomIn size={15} />
            </span>
          </button>
          <button aria-label="Slide anterior" onClick={() => setSlide((slide - 1 + total) % total)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-paper/85 p-1.5 text-ink shadow hover:bg-paper">
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Próximo slide" onClick={() => setSlide((slide + 1) % total)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-paper/85 p-1.5 text-ink shadow hover:bg-paper">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} className={`overflow-hidden rounded-md ring-2 transition ${i === slide ? "ring-ink" : "ring-transparent opacity-70 hover:opacity-100"}`}>
              <PostArt hue={(block.hue + i * 14) % 360} title="" compact label={`${i + 1}`} className="aspect-[4/5] w-full" />
            </button>
          ))}
        </div>
        {canUpload && <div><UploadHint label="Enviar imagens" /></div>}
        {zoom !== null && <Lightbox block={block} index={zoom} onIndex={(i) => { setZoom(i); setSlide(i); }} onClose={() => setZoom(null)} />}
      </div>
    );
  }

  // foto
  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setZoom(0)} className="group relative block w-full" aria-label="Ampliar foto">
        <PostArt hue={block.hue} title={block.title} label="Foto" className="aspect-[4/5] w-full rounded-xl" />
        <span className="absolute right-3 top-3 rounded-full bg-paper/80 p-1.5 text-ink opacity-0 transition group-hover:opacity-100">
          <ZoomIn size={15} />
        </span>
      </button>
      {canUpload && <div><UploadHint label="Enviar foto" /></div>}
      {zoom !== null && <Lightbox block={block} index={0} onIndex={() => {}} onClose={() => setZoom(null)} />}
    </div>
  );
}
