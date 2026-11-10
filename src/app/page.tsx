import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { loadAll } from "@/lib/data";
import { StoreProvider } from "@/lib/store";
import ControlPanel from "@/components/ControlPanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getAdmin())) redirect("/login");
  const data = await loadAll();
  return (
    <StoreProvider initial={data} role="straut">
      <ControlPanel />
    </StoreProvider>
  );
}
