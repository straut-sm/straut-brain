"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientLogin } from "@/app/actions";
import { Button, Logo } from "./ui";

export default function PasswordGate({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setLoading(true);
    const res = await clientLogin(slug, pw).catch(() => ({ ok: false as const, error: "Sem conexão. Tente novamente." }));
    if (res.ok) {
      router.refresh();
    } else {
      setErr(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4">
      <img src="/brand/monogram.svg" alt="" aria-hidden className="pointer-events-none fixed -right-10 bottom-0 h-[80vh] opacity-[0.06] invert" />
      <form onSubmit={submit} className="animate-pop relative w-full max-w-sm rounded-3xl bg-paper p-7 shadow-2xl">
        <Logo className="mb-8 h-4" />
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">Área exclusiva</p>
        <h1 className="mb-6 font-display text-2xl font-semibold leading-tight">{name}</h1>
        <label className="mb-1.5 block text-xs font-medium text-graphite" htmlFor="pw">Senha de acesso</label>
        <div className="relative mb-2">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="pw"
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            autoFocus
            autoComplete="current-password"
            className={`w-full rounded-xl border bg-paper py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-mist ${err ? "border-[#b9583a]" : "border-sand"}`}
          />
        </div>
        <p className={`mb-4 min-h-4 text-xs ${err ? "text-[#b9583a]" : "text-muted"}`}>
          {err || "Use a senha enviada pela equipe Straut."}
        </p>
        <Button variant="primary" type="submit" className="w-full py-2.5" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
