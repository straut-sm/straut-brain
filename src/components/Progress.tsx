import type { Block, Client } from "@/lib/types";

export function progressFor(client: Client, blocks: Block[], year: number, month: number) {
  const mine = blocks.filter((b) => {
    const [y, m] = b.date.split("-").map(Number);
    return b.clientId === client.id && y === year && m - 1 === month;
  });
  const posts = mine.filter((b) => b.format !== "roteiro");
  const published = posts.filter((b) => b.status === "publicado").length;
  const approved = posts.filter((b) => b.status === "aprovado").length;
  const inProgress = posts.length - published - approved;
  const scripts = mine.filter((b) => b.format === "roteiro").length;
  return { created: posts.length, published, approved, inProgress, scripts, target: client.contractPosts };
}

const C = { published: "#1c1c1c", approved: "#6f6c68", inProgress: "#cfc5b9" };

export function ProgressBar({ client, blocks, year, month }: { client: Client; blocks: Block[]; year: number; month: number }) {
  const p = progressFor(client, blocks, year, month);
  const total = Math.max(p.target, p.created);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const missing = Math.max(0, p.target - p.created);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: client.color }} />
          <span className="truncate">{client.name}</span>
        </span>
        <span className="shrink-0 font-display text-sm font-semibold tabular-nums">
          {p.created}<span className="font-normal text-muted">/{p.target}</span>
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-mist" role="img" aria-label={`${p.created} de ${p.target} posts criados`}>
        <span style={{ width: pct(p.published), background: C.published }} />
        <span style={{ width: pct(p.approved), background: C.approved }} />
        <span style={{ width: pct(p.inProgress), background: C.inProgress }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {missing > 0 ? `Faltam ${missing} posts` : "Meta do contrato atingida"}
        {p.scripts > 0 && ` · ${p.scripts} ${p.scripts === 1 ? "roteiro" : "roteiros"} em andamento`}
      </p>
    </div>
  );
}

export function ProgressLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: C.published }} /> Publicados</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: C.approved }} /> Aprovados</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: C.inProgress }} /> Em andamento</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-mist" /> Falta criar</span>
    </div>
  );
}
