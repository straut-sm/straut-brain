"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

const VIEW = 260; // tamanho da área de corte na tela (px)
const OUT = 400; // tamanho da foto salva (px)
const MAX_ZOOM = 4;

/**
 * Janela para enquadrar a foto de perfil: arrastar para posicionar e zoom para aproximar.
 * `src` é um link local (blob:) da imagem. Devolve a foto quadrada já recortada (JPEG).
 */
export default function AvatarCropper({ src, onCancel, onDone }: {
  src: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // canto superior esquerdo da imagem, relativo à área
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      const s = VIEW / Math.min(i.naturalWidth, i.naturalHeight);
      setPos({ x: (VIEW - i.naturalWidth * s) / 2, y: (VIEW - i.naturalHeight * s) / 2 });
    };
    i.onerror = () => setFailed(true);
    i.src = src;
  }, [src]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onCancel]);

  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : VIEW;
  const h = img ? img.naturalHeight * scale : VIEW;

  /** Mantém a imagem cobrindo toda a área (sem sobrar fundo vazio no círculo). */
  const clamp = useCallback((x: number, y: number, ww: number, hh: number) => ({
    x: Math.min(0, Math.max(VIEW - ww, x)),
    y: Math.min(0, Math.max(VIEW - hh, y)),
  }), []);

  const changeZoom = (z: number) => {
    if (!img) return;
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    const ns = base * nz;
    const r = ns / scale;
    // Aproxima a partir do centro da área
    const nx = VIEW / 2 - (VIEW / 2 - pos.x) * r;
    const ny = VIEW / 2 - (VIEW / 2 - pos.y) * r;
    setZoom(nz);
    setPos(clamp(nx, ny, img.naturalWidth * ns, img.naturalHeight * ns));
  };

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPos(clamp(d.x + e.clientX - d.px, d.y + e.clientY - d.py, w, h));
  };
  const up = () => { drag.current = null; };

  const save = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT);
    canvas.toBlob((b) => b && onDone(b), "image/jpeg", 0.88);
  };

  return (
    <div className="animate-fade fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label="Ajustar foto" className="animate-pop w-full max-w-sm rounded-2xl bg-paper p-5 shadow-2xl">
        <h3 className="font-display text-lg font-semibold">Ajustar foto</h3>
        <p className="mb-4 text-xs text-muted">Arraste a imagem para posicionar e use o zoom para aproximar.</p>

        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-xl bg-mist"
          style={{ width: VIEW, height: VIEW, cursor: img ? (drag.current ? "grabbing" : "grab") : "default" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(e) => changeZoom(zoom - e.deltaY * 0.0015)}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ left: pos.x, top: pos.y, width: w, height: h }}
            />
          )}
          {/* Máscara circular: escurece o que fica fora da foto de perfil */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(28,28,28,0.45)] ring-2 ring-paper/90" />
          {!img && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">
              {failed ? "Não foi possível abrir a imagem." : "Carregando…"}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" aria-label="Diminuir zoom" onClick={() => changeZoom(zoom - 0.25)} className="rounded-lg p-1.5 text-graphite hover:bg-cream"><Minus size={15} /></button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-ink"
          />
          <button type="button" aria-label="Aumentar zoom" onClick={() => changeZoom(zoom + 0.25)} className="rounded-lg p-1.5 text-graphite hover:bg-cream"><Plus size={15} /></button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="button" variant="primary" onClick={save} disabled={!img}><Check size={14} /> Usar foto</Button>
        </div>
      </div>
    </div>
  );
}
