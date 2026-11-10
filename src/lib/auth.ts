import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./supabase/admin";
import { authClient } from "./supabase/server";

export class AccessError extends Error {}

/** Usuária logada da Straut, se estiver na lista de administradores. */
export const getAdmin = cache(async () => {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: row } = await db().from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return row ? { id: user.id, email: user.email ?? "" } : null;
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new AccessError("Acesso restrito à Straut. Faça login novamente.");
  return admin;
}

// ---------------------------------------------------------------------------
// Acesso das clientes (link + senha, sem conta)
// Cookie assinado com HMAC: "<clientId>.<expira-em-segundos>.<assinatura>"
// ---------------------------------------------------------------------------

const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export const clientCookieName = (slug: string) => `straut_p_${slug}`;

function secret() {
  const s = process.env.CLIENT_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Configuração ausente: CLIENT_SESSION_SECRET.");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeClientToken(clientId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${clientId}.${exp}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE };
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [clientId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${clientId}.${exp}`));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return clientId;
}

/** A cliente (ou a Straut) pode ver esta página? */
export async function hasClientAccess(client: { id: string; slug: string; active: boolean }) {
  if (await getAdmin()) return true;
  if (!client.active) return false;
  const store = await cookies();
  return readToken(store.get(clientCookieName(client.slug))?.value) === client.id;
}

/** Para ações da cliente: confere o acesso ao bloco/cliente e diz quem está agindo. */
export async function requireClientAccess(clientId: string): Promise<"Straut" | "Cliente"> {
  if (await getAdmin()) return "Straut";
  const { data: client } = await db().from("clients").select("id, slug, active").eq("id", clientId).maybeSingle();
  if (!client || !client.active) throw new AccessError("Página indisponível.");
  const store = await cookies();
  if (readToken(store.get(clientCookieName(client.slug))?.value) !== client.id) {
    throw new AccessError("Sua sessão expirou. Entre novamente com a senha.");
  }
  return "Cliente";
}
