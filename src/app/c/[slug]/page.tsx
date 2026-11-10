import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth";
import { findClientBySlug, loadClient } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import ClientView from "@/components/ClientView";

export const dynamic = "force-dynamic";

/** Página da cliente no modo Straut (edição). */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getAdmin())) redirect("/login");
  const client = await findClientBySlug(slug);
  if (!client) notFound();
  const data = await loadClient(client.id, "straut");
  return (
    <StoreProvider initial={data} role="straut">
      <Suspense>
        <ClientView slug={slug} mode="straut" />
      </Suspense>
    </StoreProvider>
  );
}
