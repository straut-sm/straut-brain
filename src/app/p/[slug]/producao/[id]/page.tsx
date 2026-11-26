import { notFound, redirect } from "next/navigation";
import { hasClientAccess } from "@/lib/auth";
import { findClientBySlug, loadClient, loadProduction } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import ProductionView from "@/components/ProductionView";

export const dynamic = "force-dynamic";

/** Dia de produção na página da cliente: só visualização. */
export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const client = await findClientBySlug(slug);
  if (!client || !client.active || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Sem a senha da página, volta para a entrada da cliente (que pede a senha)
  if (!(await hasClientAccess(client))) redirect(`/p/${slug}`);
  const [data, prod] = await Promise.all([loadClient(client.id, "cliente"), loadProduction(id, client.id)]);
  if (!prod) notFound();
  return (
    <StoreProvider initial={data} role="cliente">
      <ProductionView slug={slug} mode="cliente" eventId={id} initialItems={prod.items} doneElsewhere={prod.doneElsewhere} />
    </StoreProvider>
  );
}
