import type { Metadata } from "next";
import { Suspense } from "react";
import { hasClientAccess } from "@/lib/auth";
import { findClientBySlug, loadClient } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import ClientView from "@/components/ClientView";
import PasswordGate from "@/components/PasswordGate";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const client = await findClientBySlug(slug);
  return { title: client?.active ? `${client.name} · Straut` : "Straut" };
}

/** Link compartilhado com a cliente: senha da página, sem conta. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await findClientBySlug(slug);

  if (!client || !client.active) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-paper">
        <Logo className="h-5" invert />
        <p className="max-w-sm text-sm text-paper/70">Esta página não está disponível. Em caso de dúvidas, fale com a equipe Straut.</p>
      </div>
    );
  }

  if (!(await hasClientAccess(client))) return <PasswordGate slug={client.slug} name={client.name} />;

  const data = await loadClient(client.id, "cliente");
  return (
    <StoreProvider initial={data} role="cliente">
      <Suspense>
        <ClientView slug={slug} mode="cliente" />
      </Suspense>
    </StoreProvider>
  );
}
