// Métricas do Instagram: cálculo feito no navegador (usa o dia de hoje do horário local).
// Regras aprovadas:
// - Mês atual (dia 1 até hoje) comparado com os mesmos dias do mês anterior.
// - Estrela: alcance acima da média da própria cliente nos últimos 90 dias.
// - Post ↔ bloco: pelo link do Instagram no bloco; sem link, pela data e pelo formato.
// - Top 3 do mês: maior soma de alcance + salvamentos + compartilhamentos.
import type { Block, PostFormat } from "./types";

export interface IgPost {
  id: string;
  date: string; // YYYY-MM-DD
  format: PostFormat;
  permalink: string;
  caption: string;
  thumbnailUrl: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reason: string;
  reasonBy?: string;
}

export interface FollowerPoint { date: string; followers: number }

export interface ClientMetrics {
  clientId: string;
  /** Última sincronização com o mLabs. Vazio = "aguardando sincronização". */
  syncedAt: string | null;
  posts: IgPost[];
  followers: FollowerPoint[];
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Código do post no link do Instagram (instagram.com/p/<código>/ ou /reel/<código>/). */
export function shortcode(url: string) {
  return /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i.exec(url)?.[1] ?? null;
}

/** Liga cada post do Instagram a um bloco da cliente. Devolve post → bloco. */
export function matchPosts(posts: IgPost[], blocks: Block[]) {
  const byPost = new Map<string, string>();
  const used = new Set<string>();
  const byCode = new Map<string, string>();
  for (const b of blocks) {
    const c = b.instagramUrl ? shortcode(b.instagramUrl) : null;
    if (c) byCode.set(c, b.id);
  }
  // 1) link colado no bloco
  for (const p of posts) {
    const c = shortcode(p.permalink);
    const b = c ? byCode.get(c) : undefined;
    if (b && !used.has(b)) { byPost.set(p.id, b); used.add(b); }
  }
  // 2) mesmo dia e mesmo formato (blocos com link ficam de fora: já foram ligados à mão)
  const rank = (b: Block) => (b.status === "publicado" ? 0 : b.status === "aprovado" ? 1 : 2);
  for (const p of [...posts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (byPost.has(p.id)) continue;
    const cand = blocks
      .filter((b) => !used.has(b.id) && !b.instagramUrl && b.date === p.date && b.format === p.format)
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))[0];
    if (cand) { byPost.set(p.id, cand.id); used.add(cand.id); }
  }
  return byPost;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
/** Variação em % (null quando não dá para comparar). */
const pct = (cur: number | null, prev: number | null) =>
  cur === null || prev === null || prev === 0 ? null : ((cur - prev) / prev) * 100;

export const score = (p: IgPost) => p.reach + p.saves + p.shares;

export interface Summary {
  /** Período atual e o de comparação. */
  from: string; to: string; prevFrom: string; prevTo: string;
  postCount: number;
  avgReach: number | null; avgReachDelta: number | null;
  followers: number | null; followersGain: number | null; followersGainPrev: number | null;
  /** Sem registro antes do dia 1: o ganho conta a partir deste dia. */
  followersSince: string | null;
  saves: number; savesDelta: number | null;
  shares: number; sharesDelta: number | null;
  /** Média de alcance dos últimos 90 dias (régua da estrela). */
  baseline: number | null;
  starred: Set<string>; // ids de posts
  /** Posts do mês atual com estrela. */
  starredThisMonth: number;
  top: IgPost[];
  series: { reach: number[]; followers: number[]; saves: number[]; shares: number[] };
}

function followersAt(points: FollowerPoint[], date: string) {
  let v: number | null = null;
  for (const p of points) if (p.date <= date) v = p.followers; else break;
  return v;
}

export function summarize(m: ClientMetrics, today: string): Summary {
  const d = Number(today.slice(8));
  const from = `${today.slice(0, 8)}01`;
  const prevMonthEnd = addDays(from, -1);
  const prevFrom = `${prevMonthEnd.slice(0, 8)}01`;
  const prevTo = `${prevMonthEnd.slice(0, 8)}${String(Math.min(d, Number(prevMonthEnd.slice(8)))).padStart(2, "0")}`;

  const posts = [...m.posts].sort((a, b) => a.date.localeCompare(b.date));
  const cur = posts.filter((p) => p.date >= from && p.date <= today);
  const prev = posts.filter((p) => p.date >= prevFrom && p.date <= prevTo);

  const avgReach = avg(cur.map((p) => p.reach));
  const prevAvg = avg(prev.map((p) => p.reach));
  const saves = sum(cur.map((p) => p.saves));
  const shares = sum(cur.map((p) => p.shares));

  const pts = [...m.followers].sort((a, b) => a.date.localeCompare(b.date));
  const followers = followersAt(pts, today);
  // Base do mês: último registro antes do dia 1 (ou o primeiro do mês, se não houver)
  const before = followersAt(pts, addDays(from, -1));
  const firstIn = pts.find((p) => p.date >= from && p.date <= today);
  const base = before ?? firstIn?.followers ?? null;
  const prevBase = followersAt(pts, addDays(prevFrom, -1)) ?? pts.find((p) => p.date >= prevFrom)?.followers ?? null;
  const prevAtTo = followersAt(pts, prevTo);

  const window90 = posts.filter((p) => p.date > addDays(today, -90) && p.date <= today);
  const baseline = window90.length >= 3 ? avg(window90.map((p) => p.reach)) : null;
  const starred = new Set(baseline === null ? [] : window90.filter((p) => p.reach > baseline).map((p) => p.id));

  const last30 = posts.filter((p) => p.date > addDays(today, -30) && p.date <= today);
  return {
    from, to: today, prevFrom, prevTo,
    postCount: cur.length,
    avgReach, avgReachDelta: pct(avgReach, prevAvg),
    followers,
    followersGain: followers !== null && base !== null ? followers - base : null,
    followersSince: before === null && firstIn && firstIn.date > from ? firstIn.date : null,
    followersGainPrev: prevAtTo !== null && prevBase !== null ? prevAtTo - prevBase : null,
    saves, savesDelta: prev.length ? pct(saves, sum(prev.map((p) => p.saves))) : null,
    shares, sharesDelta: prev.length ? pct(shares, sum(prev.map((p) => p.shares))) : null,
    baseline, starred, starredThisMonth: cur.filter((p) => starred.has(p.id)).length,
    top: [...cur].sort((a, b) => score(b) - score(a)).slice(0, 3),
    series: {
      reach: last30.map((p) => p.reach),
      followers: pts.filter((p) => p.date > addDays(today, -30) && p.date <= today).map((p) => p.followers),
      saves: last30.map((p) => p.saves),
      shares: last30.map((p) => p.shares),
    },
  };
}

/** Ids dos blocos com estrela (post acima da média). */
export function starredBlocks(m: ClientMetrics | undefined, blocks: Block[], today: string) {
  if (!m?.syncedAt) return new Set<string>();
  const s = summarize(m, today);
  const match = matchPosts(m.posts, blocks);
  return new Set([...s.starred].map((id) => match.get(id)).filter((x): x is string => !!x));
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
