export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function todayYmd() {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
}

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** Semanas do mês (domingo a sábado). Dias fora do mês são null. */
export function monthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function inMonth(date: string, year: number, month: number) {
  const p = parseYmd(date);
  return p.y === year && p.m === month;
}

export function formatLong(date: string) {
  const { y, m, d } = parseYmd(date);
  const wd = new Date(y, m, d).toLocaleDateString("pt-BR", { weekday: "long" });
  return `${wd}, ${d} de ${MONTHS[m].toLowerCase()}`;
}

export function formatShort(date: string) {
  const { m, d } = parseYmd(date);
  return `${pad(d)}/${pad(m + 1)}`;
}

export function formatDateTime(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
