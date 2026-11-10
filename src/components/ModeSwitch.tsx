"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Barra flutuante do PROTÓTIPO para alternar entre a visão da Straut e da cliente. */
export default function ModeSwitch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  if (!pathname.startsWith("/c/")) return null;
  const cliente = params.get("visao") === "cliente";

  const set = (v: "straut" | "cliente") => {
    const p = new URLSearchParams(params.toString());
    if (v === "cliente") p.set("visao", "cliente");
    else p.delete("visao");
    p.delete("bloco");
    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 md:left-auto md:right-5 md:translate-x-0">
      <div className="flex items-center gap-1 rounded-full border border-graphite/20 bg-ink/90 p-1 pl-3 text-xs text-paper shadow-xl backdrop-blur">
        <span className="hidden pr-1 text-paper/60 sm:inline">Protótipo · ver como</span>
        <button
          onClick={() => set("straut")}
          className={`rounded-full px-3 py-1.5 font-medium transition ${!cliente ? "bg-paper text-ink" : "text-paper/80 hover:text-paper"}`}
        >
          Straut
        </button>
        <button
          onClick={() => set("cliente")}
          className={`rounded-full px-3 py-1.5 font-medium transition ${cliente ? "bg-paper text-ink" : "text-paper/80 hover:text-paper"}`}
        >
          Cliente
        </button>
      </div>
    </div>
  );
}
