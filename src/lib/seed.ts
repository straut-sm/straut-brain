import type { Block, Client, Format, HistoryEntry, Status } from "./types";
import { pad } from "./dates";

/**
 * Dados FICTÍCIOS para o protótipo de visualização.
 * Nenhuma informação real de clientes da Straut.
 */

const DRIVE = "https://drive.google.com/";

export const SEED_CLIENTS: Client[] = [
  {
    id: "c1", slug: "dra-ana-souza", name: "Dra. Ana Souza", specialty: "Dermatologia",
    color: "#b5785c", contractPosts: 16, paymentDay: 5, driveUrl: DRIVE, active: true, password: "straut", notes: "",
    files: [
      { id: "f1", name: "Contrato de prestação de serviços 2026.pdf", kind: "contrato", size: "312 KB" },
      { id: "f2", name: "Apresentação de posicionamento.pdf", kind: "apresentacao", size: "8,4 MB" },
      { id: "f3", name: "Vídeos gravados — novembro.zip", kind: "video", size: "2,1 GB" },
      { id: "f4", name: "Fotos do consultório.zip", kind: "foto", size: "184 MB" },
    ],
  },
  {
    id: "c2", slug: "dr-rafael-lima", name: "Dr. Rafael Lima", specialty: "Ortopedia",
    color: "#6f846d", contractPosts: 12, paymentDay: 10, driveUrl: DRIVE, active: true, password: "straut", notes: "",
    files: [
      { id: "f5", name: "Contrato 2026.pdf", kind: "contrato", size: "298 KB" },
      { id: "f6", name: "Estratégia de conteúdo.pdf", kind: "apresentacao", size: "5,9 MB" },
    ],
  },
  {
    id: "c3", slug: "dra-beatriz-campos", name: "Dra. Beatriz Campos", specialty: "Ginecologia",
    color: "#9a6f8c", contractPosts: 16, paymentDay: 10, driveUrl: DRIVE, active: true, password: "straut", notes: "",
    files: [
      { id: "f7", name: "Contrato 2026.pdf", kind: "contrato", size: "301 KB" },
      { id: "f8", name: "Apresentação de marca.pdf", kind: "apresentacao", size: "11,2 MB" },
      { id: "f9", name: "Fotos — ensaio outubro.zip", kind: "foto", size: "240 MB" },
    ],
  },
  {
    id: "c4", slug: "dr-marcelo-antunes", name: "Dr. Marcelo Antunes", specialty: "Cardiologia",
    color: "#5f7b98", contractPosts: 12, paymentDay: 15, driveUrl: DRIVE, active: true, password: "straut", notes: "",
    files: [{ id: "f10", name: "Contrato 2026.pdf", kind: "contrato", size: "305 KB" }],
  },
  {
    id: "c5", slug: "dra-juliana-prado", name: "Dra. Juliana Prado", specialty: "Nutrologia",
    color: "#b09452", contractPosts: 12, paymentDay: 20, driveUrl: DRIVE, active: true, password: "straut", notes: "",
    files: [
      { id: "f11", name: "Contrato 2026.pdf", kind: "contrato", size: "297 KB" },
      { id: "f12", name: "Apresentação de posicionamento.pdf", kind: "apresentacao", size: "7,1 MB" },
    ],
  },
];

const TOPICS: Record<string, string[]> = {
  c1: [
    "Protetor solar: quanto passar de verdade", "3 mitos sobre acne adulta", "Rotina noturna em 4 passos",
    "Melasma tem cura?", "Antes e depois: tratamento de manchas", "Vitamina C: quando usar",
    "Bastidores do consultório", "Queda de cabelo no verão", "Retinol para iniciantes",
    "Skincare masculino básico", "Perguntas da semana", "Pele oleosa precisa de hidratante?",
    "Cuidados pós-praia", "Botox preventivo: vale a pena?",
  ],
  c2: [
    "Dor no joelho ao subir escada", "Postura no home office", "Tênis certo para corrida",
    "Lesão no ombro: sinais de alerta", "Alongamento de 5 minutos", "Coluna e celular",
    "Bastidores da cirurgia", "Fisioterapia depois da artroscopia", "Mitos sobre artrose",
    "Perguntas da semana", "Dor nas costas ao acordar",
  ],
  c3: [
    "Primeira consulta ginecológica", "Anticoncepcional: mitos e verdades", "Endometriose: sintomas",
    "Check-up anual da mulher", "Menopausa sem tabu", "Planejamento da gravidez",
    "Bastidores do consultório", "Ciclo menstrual irregular", "HPV e vacinação",
    "Perguntas da semana", "Saúde íntima no verão", "Exames do pré-natal", "Cólica forte é normal?",
  ],
  c4: [
    "Pressão alta silenciosa", "Exercício e coração", "Sinais de infarto na mulher",
    "Check-up cardiológico", "Colesterol bom e ruim", "Café faz mal ao coração?",
    "Bastidores do ecocardiograma", "Palpitação: quando se preocupar", "Perguntas da semana",
    "Estresse e saúde cardíaca",
  ],
  c5: [
    "Jejum intermitente funciona?", "Proteína no café da manhã", "Suplementos que valem a pena",
    "Fome emocional", "Montando um prato equilibrado", "Vitamina D e imunidade",
    "Bastidores da consulta", "Ceia de fim de ano sem culpa", "Perguntas da semana",
    "Hidratação além da água", "Açúcar escondido nos rótulos",
  ],
};

const DAYS_A = [2, 4, 6, 9, 11, 13, 16, 18, 18, 20, 23, 25, 27, 30];
const DAYS_B = [3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28];
const FORMAT_CYCLE: Format[] = ["reels", "carrossel", "reels", "foto", "reels", "carrossel", "reels"];

const TODAY = 10;
const YEAR = 2026;
const MONTH = 11; // novembro (1-based para strings)

function iso(day: number, hour = 10, month = MONTH) {
  return `${YEAR}-${pad(month)}-${pad(day)}T${pad(hour)}:00:00.000-03:00`;
}

function statusFor(day: number, idx: number): Status {
  if (day < TODAY) return "publicado";
  if (day <= 14) return "aprovado";
  if (day <= 21) return idx % 5 === 3 ? "aprovado" : "aguardando_aprovacao";
  return idx % 3 === 0 ? "em_producao" : "aguardando_aprovacao";
}

function captionFor(title: string, specialty: string) {
  return `${title} 👇\n\nEssa é uma das dúvidas que mais recebo no consultório. Neste conteúdo explico, de forma simples, o que a ciência diz e como isso se aplica ao seu dia a dia.\n\nSalve para consultar depois e envie para alguém que precisa ver isso.\n\n#${specialty.toLowerCase()} #saude #medicina`;
}

function scriptFor(title: string) {
  return `GANCHO (0–3s)\n"${title}" — e a resposta talvez te surpreenda.\n\nDESENVOLVIMENTO\n1. Contextualize a dúvida mais comum dos pacientes.\n2. Explique o que realmente acontece, com linguagem simples.\n3. Traga um exemplo prático do consultório.\n\nFECHAMENTO\n"Se esse conteúdo te ajudou, salve e compartilhe com quem precisa."\n\nOBSERVAÇÕES DE GRAVAÇÃO\n• Plano médio, olhando para a câmera.\n• Usar teleprompter.\n• Duração estimada: 45 a 60 segundos.`;
}

function buildBlocks(): Block[] {
  const blocks: Block[] = [];
  SEED_CLIENTS.forEach((client, ci) => {
    const topics = TOPICS[client.id];
    const days = ci % 2 === 0 ? DAYS_A : DAYS_B;
    const total = Math.min(topics.length, days.length) - 3; // deixa algumas para roteiros
    for (let i = 0; i < total; i++) {
      const day = days[i];
      const title = topics[i];
      const format = FORMAT_CYCLE[(i + ci) % FORMAT_CYCLE.length];
      const status = statusFor(day, i + ci);
      const script = format === "reels" ? scriptFor(title) : "";
      const caption = captionFor(title, client.specialty);
      const history: HistoryEntry[] = [];
      const created = Math.max(1, day - 12);
      if (format === "reels") {
        const before = { format: "roteiro" as Format, title, caption: "", script, date: `${YEAR}-${pad(MONTH)}-${pad(day)}` };
        history.push(
          { id: `${client.id}-${i}-h1`, at: iso(created, 9, day - 12 < 1 ? 10 : MONTH), by: "Straut", action: "Bloco criado como Roteiro" },
          { id: `${client.id}-${i}-h2`, at: iso(Math.max(1, created + 1), 15, day - 12 < 1 ? 10 : MONTH), by: "Cliente", action: "Roteiro aprovado" },
          { id: `${client.id}-${i}-h3`, at: iso(Math.max(1, created + 4), 11, day - 12 < 1 ? 10 : MONTH), by: "Straut", action: "Formato alterado de Roteiro para Reels", before },
        );
      } else {
        history.push({ id: `${client.id}-${i}-h1`, at: iso(created, 9, day - 12 < 1 ? 10 : MONTH), by: "Straut", action: `Bloco criado como ${format === "foto" ? "Foto" : "Carrossel"}` });
      }
      if (status !== "em_producao") {
        history.push({ id: `${client.id}-${i}-h4`, at: iso(Math.max(1, Math.min(day, TODAY) - 2), 17), by: "Straut", action: "Enviado para aprovação" });
      }
      if (status === "aprovado" || status === "publicado") {
        history.push({ id: `${client.id}-${i}-h5`, at: iso(Math.max(1, Math.min(day, TODAY) - 1), 19), by: "Cliente", action: "Post aprovado" });
      }
      if (status === "publicado") {
        history.push({ id: `${client.id}-${i}-h6`, at: iso(day, 12), by: "Straut", action: "Marcado como publicado" });
      }
      blocks.push({
        id: `${client.id}-b${i}`,
        clientId: client.id,
        date: `${YEAR}-${pad(MONTH)}-${pad(day)}`,
        title, format, status, caption, script,
        slides: format === "carrossel" ? 5 + ((i + ci) % 3) : 1,
        hue: (i * 37 + ci * 71) % 360,
        history,
        comments: [],
      });
    }
    // Roteiros para a próxima gravação (não contam no contrato)
    const recDays = [`${YEAR}-11-24`, `${YEAR}-11-26`, `${YEAR}-12-01`];
    for (let r = 0; r < 3; r++) {
      const title = topics[total + r] ?? `Roteiro extra ${r + 1}`;
      const status: Status = r === 0 ? "aprovado" : "aguardando_aprovacao";
      const history: HistoryEntry[] = [
        { id: `${client.id}-r${r}-h1`, at: iso(6 + r, 10), by: "Straut", action: "Bloco criado como Roteiro" },
        { id: `${client.id}-r${r}-h2`, at: iso(8, 18), by: "Straut", action: "Enviado para aprovação" },
      ];
      if (status === "aprovado") history.push({ id: `${client.id}-r${r}-h3`, at: iso(9, 20), by: "Cliente", action: "Roteiro aprovado" });
      blocks.push({
        id: `${client.id}-r${r}`,
        clientId: client.id,
        date: recDays[r],
        title, format: "roteiro", status,
        caption: captionFor(title, client.specialty),
        script: scriptFor(title),
        slides: 1, hue: 0, history, comments: [],
      });
    }
  });

  // Exemplo de ajuste sugerido pela cliente (Dra. Ana Souza)
  const sug = blocks.find((b) => b.clientId === "c1" && b.status === "aguardando_aprovacao" && b.format !== "roteiro");
  if (sug) {
    const proposed = sug.caption
      .replace("Essa é uma das dúvidas que mais recebo no consultório.", "Essa é a pergunta que eu mais escuto das minhas pacientes.")
      .replace("de forma simples,", "sem complicação,");
    sug.status = "ajuste_sugerido";
    sug.suggestion = { field: "caption", original: sug.caption, proposed, at: iso(10, 8) };
    sug.history.push({ id: `${sug.id}-sug`, at: iso(10, 8), by: "Cliente", action: "Sugeriu alteração na legenda" });
  }
  // Exemplo de comentário novo
  const com = blocks.find((b) => b.clientId === "c3" && b.format === "roteiro" && b.status === "aguardando_aprovacao");
  if (com) {
    com.comments.push({ id: `${com.id}-c1`, at: iso(10, 7), by: "Cliente", text: "Gostei! Podemos incluir uma fala sobre a importância do acompanhamento anual?", seen: false });
  }
  return blocks;
}

export const SEED_BLOCKS: Block[] = buildBlocks();
