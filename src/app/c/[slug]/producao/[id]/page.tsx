import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { findClientBySlug, loadClient, loadProduction } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import ProductionView from "@/components/ProductionView";

export const dynamic = "force-dynamic";

/** Dia de produção no modo Straut (marca gravados, esconde e reordena). */
export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!(await getAdmin())) redirect("/login");
  const client = await findClientBySlug(slug);
  if (!client || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, prod] = await Promise.all([loadClient(client.id, "straut"), loadProduction(id, client.id)]);
  if (!prod) notFound();
  return (
    <StoreProvider initial={data} role="straut">
      <ProductionView slug={slug} mode="straut" eventId={id} initialItems={prod.items} doneElsewhere={prod.doneElsewhere} />
    </StoreProvider>
  );
}
