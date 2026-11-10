"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as A from "@/app/actions";
import type { Result } from "@/app/actions";
import { hueOf } from "./meta";
import { browserClient } from "./supabase/browser";
import type { Block, Client, ClientInput, FileKind, Format, MediaKind, Role, Status } from "./types";

interface Data {
  clients: Client[];
  blocks: Block[];
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
  setStatus: (id: string, status: Status) => Promise<void>;
  approve: (id: string) => Promise<void>;
  suggest: (id: string, field: "caption" | "script", proposed: string) => Promise<void>;
  resolveSuggestion: (id: string, accept: boolean) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  markCommentsSeen: (id: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  saveClient: (id: string | null, input: ClientInput) => Promise<{ id: string; slug: string } | null>;
  setActive: (id: string, active: boolean) => Promise<void>;
  setAvatar: (clientId: string, image: Blob | null) => Promise<void>;
  uploadMedia: (blockId: string, kind: MediaKind, files: File[]) => Promise<void>;
  removeMedia: (mediaId: string) => Promise<void>;
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

  // Dados novos do servidor (após router.refresh)
  useEffect(() => setData(initial), [initial]);

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
        caption: "", script: "", media: [], hue: hueOf(id), history: [], comments: [],
      };
      setData((d) => ({ ...d, blocks: [...d.blocks, draft] }));
      void blockOp(id, null, () => A.createBlock(id, clientId, date));
      return id; // abre o pop-up na hora
    },
    updateBlock: (id, patch) => blockOp(id, (b) => ({ ...b, ...patch }), () => A.updateBlock(id, patch)),
    changeFormat: (id, format) => blockOp(id, (b) => ({ ...b, format }), () => A.changeFormat(id, format)),
    setStatus: (id, status) => blockOp(id, (b) => ({ ...b, status }), () => A.setStatus(id, status)),
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
  }), [data, role, author, pending, refreshing, call, blockOp, upload, uploading]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
