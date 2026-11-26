import { notFound, redirect } from "next/navigation";
import { hasClientAccess } from "@/lib/auth";
import { findClientBySlug, loadClient, loadTrends } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import TrendsView from "@/components/TrendsView";

export const dynamic = "force-dynamic";

/** Aba Tendências na página da cliente: só o que a Straut liberou, sem edição. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await findClientBySlug(slug);
  if (!client || !client.active) notFound();
  if (!(await hasClientAccess(client))) redirect(`/p/${slug}`);
  const [data, items] = await Promise.all([loadClient(client.id, "cliente"), loadTrends(client.id, "cliente")]);
  return (
    <StoreProvider initial={data} role="cliente">
      <TrendsView slug={slug} mode="cliente" initialItems={items} />
    </StoreProvider>
  );
}
