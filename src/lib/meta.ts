import { Clapperboard, FileText, GalleryHorizontal, Image as ImageIcon } from "lucide-react";
import type { Format, PostFormat, Status } from "./types";

export const FORMATS: Record<Format, { label: string; icon: typeof FileText }> = {
  roteiro: { label: "Roteiro", icon: FileText },
  reels: { label: "Reels", icon: Clapperboard },
  carrossel: { label: "Carrossel", icon: GalleryHorizontal },
  foto: { label: "Foto", icon: ImageIcon },
};

export const FORMAT_ORDER: Format[] = ["roteiro", "reels", "carrossel", "foto"];

/** Como o formato planejado de um roteiro aparece (o roteiro "é de" vídeo, carrossel ou foto). */
export const PLANNED: Record<PostFormat, string> = { reels: "Vídeo", carrossel: "Carrossel", foto: "Foto" };
export const PLANNED_ORDER: PostFormat[] = ["reels", "carrossel", "foto"];

export const STATUSES: Record<Status, { label: string; color: string; soft: string }> = {
  em_producao: { label: "Em produção", color: "#a39d96", soft: "#efece8" },
  aguardando_aprovacao: { label: "Aguardando aprovação", color: "#c4882c", soft: "#f8eedd" },
  ajuste_sugerido: { label: "Ajuste sugerido", color: "#b9583a", soft: "#f6e3dc" },
  aprovado: { label: "Aprovado", color: "#5c8a62", soft: "#e4eee4" },
  publicado: { label: "Publicado", color: "#1c1c1c", soft: "#e8e7e6" },
};

export function statusLabel(status: Status, format: Format): string {
  if (format === "roteiro" && status === "aprovado") return "Roteiro aprovado";
  return STATUSES[status].label;
}

/** Tom de cor estável derivado do id do bloco (usado nas artes de exemplo). */
export function hueOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
