export type Format = "roteiro" | "reels" | "carrossel" | "foto";

export type Status =
  | "em_producao"
  | "aguardando_aprovacao"
  | "ajuste_sugerido"
  | "aprovado"
  | "publicado";

export type Author = "Straut" | "Cliente";

export type FileKind = "contrato" | "apresentacao" | "documento" | "video" | "foto";

export interface ClientFile {
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  /** Data de envio (ISO). */
  at?: string;
}

export interface Client {
  id: string;
  slug: string;
  name: string;
  /** Nicho / especialidade */
  specialty: string;
  color: string;
  /** Quantidade de postagens por mês, conforme contrato */
  contractPosts: number;
  /** Dia do mês do pagamento (1–31) */
  paymentDay: number;
  /** Senha da página compartilhada com a cliente */
  password: string;
  driveUrl: string;
  /** Página ativa. Desativada = contrato cancelado: o link deixa de funcionar. */
  active: boolean;
  notes: string;
  /** Foto de perfil (data URL no protótipo; arquivo no servidor na versão funcional). */
  avatar?: string;
  files: ClientFile[];
}

export interface Snapshot {
  format: Format;
  title: string;
  caption: string;
  script: string;
  date: string;
}

export interface HistoryEntry {
  id: string;
  at: string; // ISO
  by: Author;
  action: string;
  /** Versão do bloco ANTES desta ação (quando a ação alterou conteúdo). */
  before?: Snapshot;
}

export interface Suggestion {
  field: "caption" | "script";
  original: string;
  proposed: string;
  at: string;
}

export interface Comment {
  id: string;
  at: string;
  by: Author;
  text: string;
  /** Lido pela Straut (para a caixa "Precisa da sua atenção"). */
  seen: boolean;
}

export interface Block {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  title: string;
  format: Format;
  status: Status;
  caption: string;
  script: string;
  /** Quantidade de slides (carrossel) — mídias são placeholders no protótipo. */
  slides: number;
  /** Variação visual do placeholder de mídia. */
  hue: number;
  history: HistoryEntry[];
  suggestion?: Suggestion;
  comments: Comment[];
}
