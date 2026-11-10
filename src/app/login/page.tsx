"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/app/actions";
import { Button, Logo } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn(email, password).catch(() => ({ ok: false as const, error: "Sem conexão. Tente novamente." }));
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setErr(res.error);
      setLoading(false);
    }
  };

  const input = "w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-mist";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-mist bg-paper p-7 shadow-[0_20px_60px_-30px_rgba(28,28,28,0.35)]">
        <Logo className="mb-8 h-5" />
        <h1 className="mb-6 font-display text-2xl font-semibold">Entrar no painel</h1>
        <label className="mb-1.5 block text-xs font-medium text-graphite" htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" className={`${input} mb-4`} value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} required autoFocus />
        <label className="mb-1.5 block text-xs font-medium text-graphite" htmlFor="password">Senha</label>
        <input id="password" type="password" autoComplete="current-password" className={`${input} mb-2`} value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} required />
        <p className="mb-4 min-h-4 text-xs text-[#b9583a]">{err}</p>
        <Button variant="primary" type="submit" className="w-full py-2.5" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
