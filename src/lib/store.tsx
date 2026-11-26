"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as A from "@/app/actions";
import type { Result } from "@/app/actions";
import { hueOf } from "./meta";
import { browserClient } from "./supabase/browser";
import type { ClientMetrics } from "./metrics";
import type { Block, CalendarEvent, Client, ClientInput, FileKind, Format, MediaKind, PostFormat, Role, Status } from "./types";

interface Data {
  clients: Client[];
  blocks: Block[];
  events: CalendarEvent[];
  /** Métricas do Instagram por cliente. */
  metrics: ClientMetrics[];
  /** Momento em que o servidor gerou estes dados. */
  loadedAt: number;
}

interface Store extends Data {
  role: Role;
  /** Há uma ação em andamento (salvando / atualizando). */
  busy: boolean;
  getClient: (slug: string) => Client | undefined;
  clientById: (id: string) => Client | undefined;
  createBlock: (clientId: string, date: string) => Promise<string | null>;
  updateBlock: (id: string, patch: Partial<Pick<Block, "title" | "caption" | "script" | "date">>) => Promise<void>;
  changeFormat: (id: string, format: Format) => Promise<void>;
  setPlannedFormat: (id: string, planned: PostFormat | null) => Promise<void>;
  advanceScript: (id: string) => Promise<void>;
  restoreVersion: (id: string, historyId: string) => Promise<void>;
  setStatus: (id: string, status: Status) => Promise<void>;
  approve: (id: string) => Promise<void>;
  suggest: (id: string, field: "caption" | "script", proposed: string) => Promise<void>;
  resolveSuggestion: (id: string, accept: boolean) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  markCommentsSeen: (id: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  createEvent: (clientId: string, date: string) => Promise<string | null>;
  updateEvent: (id: string, patch: Partial<Pick<CalendarEvent, "date" | "title" | "notes">>) => Promise<void>;
  deleteEvent: (id: string) => Promise<boolean>;
  metricsOf: (clientId: string) => ClientMetrics | undefined;
  setInstagramUrl: (id: string, url: string) => Promise<void>;
  setPostReason: (clientId: string, postId: string, reason: string) => Promise<void>;
  saveClient: (id: string | null, input: ClientInput) => Promise<{ id: string; slug: string } | null>;
  setActive: (id: string, active: boolean) => Promise<void>;
  setAvatar: (clientId: string, image: Blob | null) => Promise<void>;
  uploadMedia: (blockId: string, kind: MediaKind, files: File[]) => Promise<void>;
  removeMedia: (mediaId: string) => Promise<void>;
  attachDriveVideo: (blockId: string, link: string) => Promise<void>;
  reorderMedia: (blockId: string, ids: string[]) => Promise<void>;
  addFiles: (clientId: string, files: File[], kind: (f: File) => FileKind) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  downloadFile: (fileId: string) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

const OFFLINE = "Sem conexão com o servidor. Verifique sua internet e tente novamente.";

export function StoreProvider({ initial, role, children }: { initial: Data; role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initial);
  const [pending, setPending] = useState(0);
  const [refreshing, startTransition] = useTransition();

  // Dados novos do servidor (após router.refresh). O Next às vezes reentrega a cópia
  // antiga da página (do carregamento inicial); só aceitamos uma cópia mais nova.
  const applied = useRef(initial.loadedAt);
  useEffect(() => {
    if (initial.loadedAt > applied.current) {
      applied.current = initial.loadedAt;
      setData(initial);
    }
  }, [initial]);

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  // ---------------------------------------------------------------------------
  // Ações de bloco: a tela muda NA HORA (otimista) e o servidor grava por trás.
  // As gravações vão numa fila, na ordem dos cliques. Quando o servidor responde,
  // o bloco é trocado pela versão salva (com histórico). Se der erro, avisa e
  // recarrega os dados verdadeiros.
  // ---------------------------------------------------------------------------
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inflight = useRef(new Map<string, number>());

  const setBlock = useCallback((id: string, fn: (b: Block) => Block | null) => {
    setData((d) => ({
      ...d,
      blocks: d.blocks.flatMap((b) => {
        if (b.id !== id) return [b];
        const next = fn(b);
        return next ? [next] : [];
      }),
    }));
  }, []);

  const blockOp = useCallback(
    (id: string, optimistic: ((b: Block) => Block | null) | null, action: () => Promise<Result<Block | null>>): Promise<void> => {
      if (optimistic) setBlock(id, optimistic);
      inflight.current.set(id, (inflight.current.get(id) ?? 0) + 1);
      setPending((n) => n + 1);
      const job = queue.current.then(async () => {
        let res: Result<Block | null> | null = null;
        try {
          res = await action();
        } catch {
          res = null;
        }
        const left = (inflight.current.get(id) ?? 1) - 1;
        if (left > 0) inflight.current.set(id, left);
        else inflight.current.delete(id);
        if (!res || !res.ok) {
          alert(res ? res.error : OFFLINE);
          refresh();
        } else if (left === 0 && res.data) {
          // Só troca pela versão do servidor quando não há outra gravação deste bloco na fila
          const saved = res.data;
          setData((d) => ({
            ...d,
            blocks: d.blocks.some((b) => b.id === id) ? d.blocks.map((b) => (b.id === id ? saved : b)) : [...d.blocks, saved],
          }));
        }
        setPending((n) => n - 1);
      });
      queue.current = job;
      return job;
    },
    [setBlock, refresh],
  );

  /** Ações que mudam clientes/arquivos: espera o servidor e recarrega os dados. */
  const call = useCallback(async <T,>(fn: () => Promise<Result<T>>, reload = true): Promise<T | null> => {
    setPending((n) => n + 1);
    try {
      const res = await fn();
      if (!res.ok) {
        alert(res.error);
        return null;
      }
      if (reload) refresh();
      return res.data;
    } catch {
      alert(OFFLINE);
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  }, [refresh]);

  /** Envia um arquivo direto ao Supabase com link assinado pelo servidor. */
  const upload = useCallback(async (target: Parameters<typeof A.createUploadUrl>[0], body: Blob, contentType?: string) => {
    const signed = await A.createUploadUrl(target);
    if (!signed.ok) throw new Error(signed.error);
    const { bucket, path, token } = signed.data;
    const { error } = await browserClient().storage.from(bucket).uploadToSignedUrl(path, token, body, {
      contentType: contentType || (body as File).type || "application/octet-stream",
    });
    if (error) {
      const tooBig = /size|exceeded|too large/i.test(error.message);
      throw new Error(tooBig ? "Arquivo maior que o limite do plano atual do Supabase." : "Falha ao enviar o arquivo.");
    }
    return path;
  }, []);

  const uploading = useCallback(async (fn: () => Promise<Block | null | void>, reload: boolean) => {
    setPending((n) => n + 1);
    try {
      const saved = await fn();
      if (saved) setBlock(saved.id, () => saved);
      if (reload) refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
    } finally {
      setPending((n) => n - 1);
    }
  }, [refresh, setBlock]);

  const author = role === "straut" ? "Straut" : "Cliente";

  const store = useMemo<Store>(() => ({
    ...data,
    role,
    busy: pending > 0 || refreshing,
    getClient: (slug) => data.clients.find((c) => c.slug === slug),
    clientById: (id) => data.clients.find((c) => c.id === id),

    createBlock: async (clientId, date) => {
      const id = crypto.randomUUID();
      const draft: Block = {
        id, clientId, date, title: "Novo conteúdo", format: "roteiro", status: "em_producao",
        caption: "", script: "", media: [], hue: hueOf(id), instagramUrl: "", history: [], comments: [],
      };
      setData((d) => ({ ...d, blocks: [...d.blocks, draft] }));
      void blockOp(id, null, () => A.createBlock(id, clientId, date));
      return id; // abre o pop-up na hora
    },
    metricsOf: (clientId) => data.metrics.find((m) => m.clientId === clientId),
    setInstagramUrl: (id, url) => blockOp(id, (b) => ({ ...b, instagramUrl: url.trim() }), () => A.setInstagramUrl(id, url)),
    setPostReason: async (clientId, postId, reason) => {
      setData((d) => ({
        ...d,
        metrics: d.metrics.map((m) => m.clientId !== clientId ? m : {
          ...m, posts: m.posts.map((p) => (p.id === postId ? { ...p, reason: reason.trim(), reasonBy: "Straut" } : p)),
        }),
      }));
      const ok = await call(() => A.setPostReason(postId, reason), false);
      if (ok === null) refresh();
    },
    updateBlock: (id, patch) => blockOp(id, (b) => ({ ...b, ...patch }), () => A.updateBlock(id, patch)),
    changeFormat: (id, format) => blockOp(
      id,
      (b) => ({ ...b, format, status: format === "roteiro" && b.status === "publicado" ? "aprovado" : b.status }),
      () => A.changeFormat(id, format),
    ),
    setPlannedFormat: (id, planned) => blockOp(id, (b) => ({ ...b, plannedFormat: planned ?? undefined }), () => A.setPlannedFormat(id, planned)),
    advanceScript: (id) => blockOp(
      id,
      (b) => (b.plannedFormat ? { ...b, format: b.plannedFormat, status: "em_producao", suggestion: undefined } : b),
      () => A.advanceScript(id),
    ),
    restoreVersion: (id, historyId) => blockOp(
      id,
      (b) => {
        const v = b.history.find((h) => h.id === historyId)?.before;
        if (!v) return b;
        return {
          ...b, format: v.format, title: v.title, caption: v.caption, script: v.script, date: v.date,
          plannedFormat: v.plannedFormat === undefined ? b.plannedFormat : (v.plannedFormat ?? undefined),
          status: v.format === "roteiro" && b.status === "publicado" ? "aprovado" : b.status,
        };
      },
      () => A.restoreVersion(id, historyId),
    ),
    setStatus: (id, status) => blockOp(id, (b) => ({ ...b, status, suggestion: undefined }), () => A.setStatus(id, status)),
    approve: (id) => blockOp(id, (b) => ({ ...b, status: "aprovado" }), () => A.approve(id)),
    suggest: (id, field, proposed) => blockOp(
      id,
      (b) => ({ ...b, status: "ajuste_sugerido", suggestion: { field, original: b[field], proposed, at: new Date().toISOString() } }),
      () => A.suggest(id, field, proposed),
    ),
    resolveSuggestion: (id, accept) => blockOp(
      id,
      (b) => {
        if (!b.suggestion) return b;
        return accept
          ? { ...b, [b.suggestion.field]: b.suggestion.proposed, suggestion: undefined, status: "aprovado" }
          : { ...b, suggestion: undefined, status: "aguardando_aprovacao" };
      },
      () => A.resolveSuggestion(id, accept),
    ),
    addComment: (id, text) => blockOp(
      id,
      (b) => ({
        ...b,
        comments: [...b.comments, { id: `tmp-${crypto.randomUUID()}`, at: new Date().toISOString(), by: author, text, seen: author === "Straut" }],
      }),
      () => A.addComment(id, text),
    ),
    markCommentsSeen: (id) => blockOp(
      id,
      (b) => ({ ...b, comments: b.comments.map((c) => ({ ...c, seen: true })) }),
      () => A.markCommentsSeen(id),
    ),
    deleteBlock: (id) => blockOp(id, () => null, async () => {
      const r = await A.deleteBlock(id);
      return r.ok ? { ok: true, data: null } : r;
    }),

    createEvent: async (clientId, date) => {
      const id = crypto.randomUUID();
      const ev: CalendarEvent = { id, clientId, date, kind: "producao", title: "Produção de conteúdo", notes: "" };
      setData((d) => ({ ...d, events: [...d.events, ev] }));
      const saved = await call(() => A.createEvent(id, clientId, date), false);
      if (!saved) { setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) })); return null; }
      return id;
    },
    updateEvent: async (id, patch) => {
      setData((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
      const saved = await call(() => A.updateEvent(id, patch), false);
      if (saved) setData((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? saved : e)) }));
      else refresh();
    },
    deleteEvent: async (id) => {
      const ok = await call(() => A.deleteEvent(id), false);
      if (ok) setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }));
      return !!ok;
    },

    saveClient: (id, input) => call(() => A.saveClient(id, input)),
    setActive: async (id, active) => { await call(() => A.setActive(id, active)); },

    setAvatar: (clientId, image) => uploading(async () => {
      if (!image) {
        const r = await A.setAvatar(clientId, null);
        if (!r.ok) throw new Error(r.error);
        return;
      }
      const path = await upload({ type: "avatar", clientId }, image, "image/jpeg");
      const r = await A.setAvatar(clientId, path);
      if (!r.ok) throw new Error(r.error);
    }, true),

    uploadMedia: (blockId, kind, files) => uploading(async () => {
      // Envia os arquivos ao mesmo tempo
      const paths = await Promise.all(files.map((f) => {
        const ext = f.name.includes(".") ? f.name.split(".").pop()! : "bin";
        return upload({ type: "media", blockId, ext }, f);
      }));
      const r = await A.attachMedia(blockId, kind, paths);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    }, false),

    removeMedia: async (mediaId) => {
      const owner = data.blocks.find((b) => b.media.some((m) => m.id === mediaId));
      if (!owner) return;
      await blockOp(owner.id, (b) => ({ ...b, media: b.media.filter((m) => m.id !== mediaId) }), () => A.removeMedia(mediaId));
    },

    attachDriveVideo: (blockId, link) => blockOp(blockId, null, () => A.attachDriveVideo(blockId, link)),

    reorderMedia: (blockId, ids) => blockOp(
      blockId,
      (b) => {
        const byId = new Map(b.media.map((m) => [m.id, m]));
        const images = ids.map((id) => byId.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
        return { ...b, media: [...b.media.filter((m) => m.kind !== "image"), ...images] };
      },
      () => A.reorderMedia(blockId, ids),
    ),

    addFiles: (clientId, files, kind) => uploading(async () => {
      for (const f of files) {
        const path = await upload({ type: "file", clientId, name: f.name }, f);
        const r = await A.registerFile(clientId, { name: f.name, kind: kind(f), size: f.size, path });
        if (!r.ok) throw new Error(r.error);
      }
    }, true),

    removeFile: async (fileId) => { await call(() => A.removeFile(fileId)); },

    downloadFile: async (fileId) => {
      const url = await call(() => A.fileDownloadUrl(fileId), false);
      if (url) window.location.href = url;
    },
  }), [data, role, author, pending, refreshing, call, blockOp, upload, uploading, refresh]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
