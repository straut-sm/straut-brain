// Grava no painel os números do mLabs de uma cliente (usado pela rotina diária do Claude).
//
//   node --env-file=.env.local scripts/sync-metrics.mjs <slug> <mlabs_profile_id> <arquivo.json>...
//
// Cada arquivo pode ser:
// - a resposta de list_published_posts ou list_published_reels do mLabs ({ posts: [...] } ou { reels: [...] }),
//   inclusive o arquivo que o Claude Code salva quando a resposta é grande ([{ type: "text", text: "..." }]);
// - a resposta de get_follower_growth ({ timeline: [{ date, followerCount }] });
// - um resumo escrito à mão: { "flat": [[link, data ISO, tipo, alcance, visualizações, curtidas, comentários,
//   salvamentos, compartilhamentos, primeira linha da legenda], ...], "followers": [["2026-11-24", 1198], ...] }.
//
// Nunca mexe no motivo do top 3 (ig_posts.reason) nem apaga nada.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const [slug, profileId, ...files] = process.argv.slice(2);
if (!slug || !profileId || !files.length) {
  console.error("uso: node --env-file=.env.local scripts/sync-metrics.mjs <slug> <mlabs_profile_id> <arquivo.json>...");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const FMT = { video: "reels", reel: "reels", reels: "reels", carousel: "carrossel", carousel_album: "carrossel", photo: "foto", image: "foto" };
/** Dia no horário de São Paulo (UTC-3, sem horário de verão). */
const spDate = (iso) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const { data: client, error: ce } = await db.from("clients").select("id, name").eq("slug", slug).single();
if (ce || !client) throw new Error(`Cliente não encontrada: ${slug}`);

const posts = new Map();
const followers = new Map();
for (const f of files) {
  let j = JSON.parse(fs.readFileSync(f, "utf8"));
  if (Array.isArray(j) && j[0]?.text) j = JSON.parse(j[0].text);
  const flat = (j.flat ?? []).map(([href, date, type, reach, views, likes, comments, saves, shares, name]) => ({
    href, date, type, name,
    interactions: Object.entries({ reach, views, likes, comments, saves, shares }).map(([n, value]) => ({ name: n, value })),
  }));
  for (const p of [...(j.posts ?? []), ...(j.reels ?? []), ...flat]) {
    const it = Object.fromEntries((p.interactions ?? []).map((i) => [i.name, i.value]));
    const format = FMT[String(p.type).toLowerCase()];
    const code = /\/(?:p|reel|reels|tv)\/([\w-]+)/.exec(p.href ?? "")?.[1];
    if (!format || !code || !p.date) { console.error("ignorado:", p.type, p.href); continue; }
    posts.set(code, {
      client_id: client.id, external_id: code, permalink: p.href, published_at: p.date, date: spDate(p.date), format,
      caption: String(p.name ?? "").split(/\n/)[0].slice(0, 160),
      thumbnail_url: "", // os links de imagem do Instagram expiram; o painel usa a capa do bloco
      reach: it.reach ?? 0, views: it.views ?? it.video_view ?? 0, likes: it.likes ?? it.like_count ?? 0,
      comments: it.comments ?? it.comments_count ?? 0, saves: Math.max(it.saves ?? 0, it.saved ?? 0), shares: it.shares ?? 0,
      updated_at: new Date().toISOString(),
    });
  }
  for (const t of j.timeline ?? []) followers.set(String(t.date).slice(0, 10), t.followerCount);
  for (const [d, n] of j.followers ?? []) followers.set(d, n);
}

if (posts.size) {
  const { error } = await db.from("ig_posts").upsert([...posts.values()], { onConflict: "client_id,external_id" });
  if (error) throw error;
}
if (followers.size) {
  const rows = [...followers].map(([date, n]) => ({ client_id: client.id, date, followers: n }));
  const { error } = await db.from("ig_followers").upsert(rows, { onConflict: "client_id,date" });
  if (error) throw error;
}
const { error: ue } = await db.from("clients")
  .update({ mlabs_profile_id: profileId, metrics_synced_at: new Date().toISOString() }).eq("id", client.id);
if (ue) throw ue;
console.log(`${client.name}: ${posts.size} posts e ${followers.size} dias de seguidores gravados.`);
