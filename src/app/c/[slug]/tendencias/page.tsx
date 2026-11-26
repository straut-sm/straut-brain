import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { findClientBySlug, loadClient, loadTrends } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import TrendsView from "@/components/TrendsView";

export const dynamic = "force-dynamic";

/** Aba Tendências no modo Straut (edição e liberação). */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getAdmin())) redirect("/login");
  const client = await findClientBySlug(slug);
  if (!client) notFound();
  const [data, items] = await Promise.all([loadClient(client.id, "straut"), loadTrends(client.id, "straut")]);
  return (
    <StoreProvider initial={data} role="straut">
      <TrendsView slug={slug} mode="straut" initialItems={items} />
    </StoreProvider>
  );
}
