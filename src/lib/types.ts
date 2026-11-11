export type Format = "roteiro" | "reels" | "carrossel" | "foto";

export type Status =
  | "em_producao"
  | "aguardando_aprovacao"
  | "ajuste_sugerido"
  | "aprovado"
  | "publicado";

export type Author = "Straut" | "Cliente";

export type Role = "straut" | "cliente";

export type FileKind = "contrato" | "apresentacao" | "documento" | "video" | "foto";

export interface ClientFile {
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  at: string;
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
  /** Dia do mês do pagamento (1–31). 0 na visão da cliente (não é exibido). */
  paymentDay: number;
  driveUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  /** Página ativa. Desativada = contrato cancelado: o link deixa de funcionar. */
  active: boolean;
  /** Observações internas — vazio na visão da cliente. */
  notes: string;
  /** Link temporário da foto de perfil. */
  avatarUrl?: string;
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

export type MediaKind = "video" | "cover" | "image";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  url: string;
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
  media: MediaItem[];
  /** Variação de cor do espaço reservado quando ainda não há mídia. */
  hue: number;
  history: HistoryEntry[];
  suggestion?: Suggestion;
  comments: Comment[];
}

export interface ClientInput {
  name: string;
  specialty: string;
  color: string;
  contractPosts: number;
  paymentDay: number;
  driveUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  notes: string;
  active: boolean;
  /** Nova senha da página. Vazio = manter a atual (na edição). */
  password: string;
}
