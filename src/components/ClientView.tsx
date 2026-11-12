"use client";

import {
  ArrowLeft, ArrowRight, Check, Download, Eye, FileText, FolderOpen, Grid3x3, Image as ImageIcon, Link2, Loader2, Plus,
  Power, Presentation, Settings2, Trash2, Upload, Video, X, File,
} from "lucide-react";
import FeedView from "@/components/FeedView";
import ClientForm from "@/components/ClientForm";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Block, Client, FileKind, PostFormat } from "@/lib/types";
import { MONTHS, formatShort, inMonth, todayYmd } from "@/lib/dates";
import { FORMATS, PLANNED, PLANNED_ORDER, statusLabel } from "@/lib/meta";
import Calendar, { StatusLegend } from "@/components/Calendar";
import BlockModal from "@/components/BlockModal";
import { Button, Logo, SectionTitle, StatusDot } from "@/components/ui";

/** Página da cliente. mode "straut" = edição (/c/[slug]); "cliente" = link compartilhado (/p/[slug]). */
export default function ClientView({ slug, mode }: { slug: string; mode: "straut" | "cliente" }) {
  const params = useSearchParams();
  const store = useStore();
  const client = store.getClient(slug);
  const isClient = mode === "cliente";

  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [focusPending, setFocusPending] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  // O pop-up aberto fica só na memória da tela. Mudar o endereço (?bloco=) fazia o Next
  // remontar a página com os dados do carregamento, desfazendo o que acabou de mudar.
  // O endereço só é lido na entrada (links do "Precisa da sua atenção").
  const [openId, setOpenId] = useState<string | null>(() => params.get("bloco"));
  // Bloco recém-criado (abre em edição; some se fechar sem alterar nada)
  const [freshId, setFresh] = useState<string | null>(null);
  // Sequência das setas do pop-up. null = todos os conteúdos do calendário, por data.
  const [navList, setNavList] = useState<string[] | null>(null);
  const [scriptFilter, setScriptFilter] = useState<PostFormat | "sem" | "todos">("todos");

  /** Abre um bloco. "list" define a sequência das setas (padrão: calendário inteiro). */
  const setOpen = (id: string | null, list: string[] | null = null) => {
    setOpenId(id);
    setNavList(list);
  };

  // Ao abrir um bloco pelo link (ex.: "Precisa da sua atenção"), vai para o mês dele
  useEffect(() => {
    const b = store.blocks.find((x) => x.id === openId);
    if (b) {
      const [y, m] = b.date.split("-").map(Number);
      setYm({ y, m: m - 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const blocks = useMemo(() => store.blocks.filter((b) => b.clientId === client?.id), [store.blocks, client]);
  const pending = blocks.filter((b) => b.status === "aguardando_aprovacao");
  const suggestions = blocks.filter((b) => b.status === "ajuste_sugerido");
  const scripts = blocks
    .filter((b) => b.format === "roteiro" && b.date >= todayYmd().slice(0, 8) + "01")
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthPosts = blocks.filter((b) => inMonth(b.date, ym.y, ym.m) && b.format !== "roteiro").length;

  const scriptKey = (b: Block) => b.plannedFormat ?? "sem";
  const scriptCounts = scripts.reduce<Record<string, number>>((acc, b) => ({ ...acc, [scriptKey(b)]: (acc[scriptKey(b)] ?? 0) + 1 }), {});
  // Se o formato filtrado deixar de ter roteiros, volta para "Todos"
  const activeFilter = scriptFilter !== "todos" && scriptCounts[scriptFilter] ? scriptFilter : "todos";
  const shownScripts = activeFilter === "todos" ? scripts : scripts.filter((b) => scriptKey(b) === activeFilter);

  // Setas do pop-up
  const calendarOrder = useMemo(
    () => [...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((b) => b.id),
    [blocks],
  );
  const seq = (navList ?? calendarOrder).filter((id) => blocks.some((b) => b.id === id));
  const idx = openId ? seq.indexOf(openId) : -1;
  const step = (d: number) => {
    const id = seq[idx + d];
    if (id) { setOpenId(id); setFresh(null); }
  };

  if (!client) return null;

  // Abre direto o primeiro conteúdo que espera aprovação; as setas passam pelos demais pendentes
  const reviewNow = () => {
    const queue = [...pending].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((b) => b.id);
    if (!queue[0]) return;
    // Ao fechar, o calendário fica destacando os pendentes
    setFocusPending(true);
    setOpen(queue[0], queue);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${client.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignora */ }
  };

  const addBlock = async (date: string) => {
    const id = await store.createBlock(client.id, date);
    if (id) { setFresh(id); setOpen(id); }
  };

  return (
    <div className="min-h-dvh pb-24">
      {/* Topo */}
      <header className="border-b border-mist bg-paper">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3.5 md:px-8">
          <div className="flex items-center gap-3">
            {!isClient && (
              <Link href="/" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-graphite hover:bg-cream">
                <ArrowLeft size={14} /> Painel
              </Link>
            )}
            <Logo className="h-4" />
            {store.busy && <Loader2 size={15} className="animate-spin text-muted" aria-label="Salvando" />}
          </div>
          <div className="flex items-center gap-2">
            {!isClient && (
              <>
                <Button variant="ghost" onClick={copyLink} className="text-xs">
                  {copied ? <Check size={14} /> : <Link2 size={14} />}
                  <span className="hidden sm:inline">{copied ? "Link copiado" : "Copiar link da cliente"}</span>
                </Button>
                <Link
                  href={`/p/${client.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-graphite hover:bg-cream"
                  aria-label="Ver como a cliente"
                >
                  <Eye size={14} /> <span className="hidden sm:inline">Ver como a cliente</span>
                </Link>
                <Button variant="ghost" onClick={() => setManageOpen(true)} className="text-xs" aria-label="Gestão da cliente">
                  <Settings2 size={14} /> <span className="hidden sm:inline">Gestão</span>
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setFilesOpen(true)} className="text-xs">
              <FolderOpen size={14} /> Arquivos
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 pt-7 md:px-8 md:pt-10">
        {!isClient && !client.active && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3 text-sm text-graphite">
            <span className="flex items-center gap-2"><Power size={15} /> Página desativada. A cliente não consegue acessar o link.</span>
            <Button variant="outline" onClick={() => setManageOpen(true)} className="text-xs">Reativar</Button>
          </div>
        )}
        {/* Cabeçalho da cliente */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: client.color }} /> {client.specialty}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-[44px] md:leading-[1.05]">{client.name}</h1>
              <SocialLinks client={client} />
            </div>
          </div>

          {/* Aviso de aprovação */}
          {isClient ? (
            pending.length > 0 ? (
              <button
                onClick={reviewNow}
                className="group flex w-full items-center gap-4 rounded-2xl bg-ink px-5 py-4 text-left text-paper shadow-[0_10px_30px_-12px_rgba(28,28,28,0.5)] transition hover:bg-graphite sm:w-auto"
              >
                <span className="font-display text-4xl font-semibold leading-none">{pending.length}</span>
                <span className="text-sm leading-snug">
                  {pending.length === 1 ? "conteúdo aguardando" : "conteúdos aguardando"}<br />a sua aprovação
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-paper/10 px-3 py-1.5 text-xs font-medium sm:ml-4">
                  Revisar agora <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                </span>
              </button>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl bg-[#e9f1e9] px-4 py-3 text-sm text-[#3f6b45]"><Check size={16} /> Tudo aprovado por aqui!</p>
            )
          ) : (
            <div className="flex gap-2">
              <MiniStat n={pending.length} label="aguardando a cliente" />
              <MiniStat n={suggestions.length} label="sugestões para revisar" accent={suggestions.length > 0} />
            </div>
          )}
        </div>

        {/* Roteiros para a próxima gravação */}
        {scripts.length > 0 && (
          <section className="mb-9">
            <SectionTitle
              right={
                Object.keys(scriptCounts).length > 1 && (
                  <div className="inline-flex flex-wrap gap-1 rounded-xl border border-mist bg-cream/60 p-1" role="group" aria-label="Filtrar roteiros por formato">
                    {(["todos", ...PLANNED_ORDER, "sem"] as const)
                      .filter((k) => k === "todos" || scriptCounts[k])
                      .map((k) => (
                        <button
                          key={k}
                          onClick={() => setScriptFilter(k)}
                          aria-pressed={activeFilter === k}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${activeFilter === k ? "bg-ink text-paper" : "text-graphite hover:bg-paper"}`}
                        >
                          {k === "todos" ? "Todos" : k === "sem" ? "Sem formato" : PLANNED[k]}
                          <span className="ml-1 opacity-60">{k === "todos" ? scripts.length : scriptCounts[k]}</span>
                        </button>
                      ))}
                  </div>
                )
              }
            >
              Roteiros para a próxima gravação
            </SectionTitle>
            <div className="thin-scroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {shownScripts.map((s) => {
                const Icon = s.plannedFormat ? FORMATS[s.plannedFormat].icon : FileText;
                return (
                <button
                  key={s.id}
                  onClick={() => setOpen(s.id, shownScripts.map((x) => x.id))}
                  className="flex w-[260px] shrink-0 snap-start flex-col rounded-2xl border border-mist bg-paper p-4 text-left transition hover:border-sand hover:shadow-[0_6px_20px_-12px_rgba(28,28,28,0.3)] md:w-[300px]"
                >
                  <span className="mb-3 flex items-center justify-between text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {s.plannedFormat ? `Roteiro de ${PLANNED[s.plannedFormat].toLowerCase()}` : "Roteiro"} · {formatShort(s.date)}</span>
                    <span className="inline-flex items-center gap-1.5"><StatusDot status={s.status} size={6} /> {statusLabel(s.status, s.format)}</span>
                  </span>
                  <span className="mb-2 font-display text-lg font-semibold leading-snug">{s.title}</span>
                  <span className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted">{s.script.split("\n").filter((l) => { const t = l.replace(/\(.*?\)/g, "").trim(); return t && t !== t.toUpperCase(); }).slice(0, 3).join("\n")}</span>
                </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Calendário */}
        <section ref={calRef} className="scroll-mt-4">
          <SectionTitle
            right={
              <div className="flex items-center gap-2">
                {focusPending && (
                  <button onClick={() => setFocusPending(false)} className="hidden items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs text-paper md:inline-flex">
                    Mostrando pendentes <X size={12} />
                  </button>
                )}
                <Button variant="outline" onClick={() => setFeedOpen(true)} className="py-1.5 text-xs">
                  <Grid3x3 size={14} /> Visualização de feed
                </Button>
              </div>
            }
          >
            Calendário de conteúdos
          </SectionTitle>
          <Calendar
            key={focusPending ? "foco" : "todos"}
            blocks={blocks}
            year={ym.y}
            month={ym.m}
            onMonthChange={(y, m) => setYm({ y, m })}
            onOpen={setOpen}
            onAdd={isClient ? undefined : addBlock}
            focusPending={focusPending}
            showNews={!isClient}
            headerExtra={
              <span className="text-xs text-muted">
                <span className="font-semibold text-ink">{monthPosts}</span> posts em {MONTHS[ym.m].toLowerCase()}
                {!isClient && <> · meta {client.contractPosts}</>}
              </span>
            }
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <StatusLegend />
            {!isClient && (
              <span className="hidden items-center gap-1 text-[11px] text-muted md:inline-flex"><Plus size={12} /> Passe o mouse em um dia para criar um conteúdo</span>
            )}
          </div>
        </section>
      </main>

      {filesOpen && <FilesDrawer client={client} canEdit={!isClient} onClose={() => setFilesOpen(false)} />}
      {feedOpen && (
        <FeedView client={client} blocks={blocks} onClose={() => setFeedOpen(false)} onOpen={setOpen} paused={!!openId} />
      )}
      {manageOpen && <ClientForm client={client} onClose={() => setManageOpen(false)} />}
      {openId && (
        <BlockModal
          key={openId}
          blockId={openId}
          mode={mode}
          fresh={openId === freshId}
          onClose={() => { setOpen(null); setFresh(null); }}
          onPrev={idx > 0 ? () => step(-1) : undefined}
          onNext={idx >= 0 && idx < seq.length - 1 ? () => step(1) : undefined}
          position={idx >= 0 && seq.length > 1 ? `${idx + 1} de ${seq.length}` : undefined}
        />
      )}
    </div>
  );
}

function MiniStat({ n, label, accent = false }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${accent ? "border-[#ecd3c8] bg-[#fdf8f6]" : "border-mist bg-paper"}`}>
      <p className={`font-display text-xl font-semibold leading-none ${accent ? "text-[#b9583a]" : ""}`}>{n}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

const FILE_ICON: Record<FileKind, typeof FileText> = {
  contrato: FileText, apresentacao: Presentation, documento: File, video: Video, foto: ImageIcon,
};
const FILE_LABEL: Record<FileKind, string> = {
  contrato: "Contrato", apresentacao: "Apresentação", documento: "Documento", video: "Vídeo", foto: "Foto",
};

function inferKind(file: globalThis.File): FileKind {
  const n = file.name.toLowerCase();
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "foto";
  if (/contrato/.test(n)) return "contrato";
  if (/\.(pptx?|key)$/.test(n) || /apresenta/.test(n)) return "apresentacao";
  return "documento";
}

function FilesDrawer({ client, onClose, canEdit }: { client: Client; onClose: () => void; canEdit: boolean }) {
  const store = useStore();
  const [kind, setKind] = useState<FileKind | "auto">("auto");
  const [added, setAdded] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const [sending, setSending] = useState(false);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setSending(true);
    await store.addFiles(client.id, files, (f) => (kind === "auto" ? inferKind(f) : kind));
    setSending(false);
    setAdded(files.length);
  };

  return (
    <div className="animate-fade fixed inset-0 z-50 flex justify-end bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="animate-pop flex h-full w-full max-w-md flex-col bg-paper shadow-2xl" aria-label="Arquivos">
        <div className="flex items-center justify-between border-b border-mist px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Arquivos</h2>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-graphite hover:bg-cream"><X size={18} /></button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto p-5">
          {client.driveUrl && (
            <a
              href={client.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-5 flex items-center gap-3 rounded-2xl bg-ink p-4 text-paper hover:bg-graphite"
            >
              <FolderOpen size={20} />
              <span className="flex-1">
                <span className="block text-sm font-medium">Pasta no Google Drive</span>
                <span className="block text-xs text-paper/60">Todos os materiais brutos</span>
              </span>
              <ArrowRight size={16} />
            </a>
          )}
          {canEdit && (
            <div className="mb-5 rounded-2xl border border-dashed border-sand p-4">
              <p className="mb-3 text-sm font-medium">Adicionar documento</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as FileKind | "auto")}
                  aria-label="Tipo do arquivo"
                  className="rounded-xl border border-sand bg-paper px-2.5 py-2 text-xs text-graphite outline-none focus:ring-2 focus:ring-mist"
                >
                  <option value="auto">Tipo automático</option>
                  {(Object.keys(FILE_LABEL) as FileKind[]).map((k) => <option key={k} value={k}>{FILE_LABEL[k]}</option>)}
                </select>
                <label className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-medium text-paper hover:bg-graphite focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2 ${sending ? "pointer-events-none opacity-60" : ""}`}>
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : <><Upload size={14} /> Escolher arquivos</>}
                  <input type="file" multiple className="sr-only" onChange={upload} disabled={sending} />
                </label>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {sending ? "Não feche esta janela até terminar o envio." : added ?`${added} ${added === 1 ? "arquivo adicionado" : "arquivos adicionados"}.` : "Contratos, apresentações, vídeos ou fotos. A cliente vê os arquivos aqui para baixar."}
              </p>
            </div>
          )}
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">Para baixar</p>
          {client.files.length === 0 && <p className="rounded-xl bg-cream p-4 text-sm text-muted">Nenhum arquivo ainda.</p>}
          <ul className="flex flex-col gap-2">
            {client.files.map((f) => {
              const I = FILE_ICON[f.kind];
              return (
                <li key={f.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => store.downloadFile(f.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-mist p-3 text-left hover:bg-cream"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream text-graphite"><I size={17} strokeWidth={1.7} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{f.name}</span>
                      <span className="text-[11px] text-muted">{FILE_LABEL[f.kind]} · {f.size}</span>
                    </span>
                    <Download size={16} className="shrink-0 text-muted" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => confirm(`Remover "${f.name}" da página da cliente? O arquivo será apagado.`) && store.removeFile(f.id)}
                      aria-label={`Remover ${f.name}`}
                      className="rounded-lg p-2 text-muted hover:bg-[#f6e3dc] hover:text-[#b9583a]"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}


function SocialLinks({ client }: { client: Client }) {
  const links = [
    { url: client.instagramUrl, label: "Instagram", icon: <InstagramIcon /> },
    { url: client.tiktokUrl, label: "TikTok", icon: <TikTokIcon /> },
  ].filter((l) => l.url);
  if (!links.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${l.label} de ${client.name}`}
          title={l.label}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-sand text-graphite transition hover:border-graphite/30 hover:bg-cream hover:text-ink"
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 3c.3 2.3 1.7 3.9 4 4.1v3.1c-1.5.1-2.8-.4-4-1.2v6.1c0 3.8-3.3 6.4-7 5.6-4.4-1-5.6-6.9-1.7-9.3 1-.6 2.2-.9 3.5-.8v3.2c-.4-.1-.8-.1-1.2 0-1.6.4-2.3 2.4-1.2 3.7 1.1 1.3 3.4.9 3.8-.9.1-.3.1-.6.1-.9V3h3.7z" />
    </svg>
  );
}
