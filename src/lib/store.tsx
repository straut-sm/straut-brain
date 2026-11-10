"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import * as A from "@/app/actions";
import type { Result } from "@/app/actions";
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

export function StoreProvider({ initial, role, children }: { initial: Data; role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initial);
  const [pending, setPending] = useState(0);
  const [refreshing, startTransition] = useTransition();

  // Dados novos do servidor (após router.refresh)
  useEffect(() => setData(initial), [initial]);

  const call = useCallback(async <T,>(fn: () => Promise<Result<T>>, refresh = true): Promise<T | null> => {
    setPending((n) => n + 1);
    try {
      const res = await fn();
      if (!res.ok) {
        alert(res.error);
        return null;
      }
      if (refresh) startTransition(() => router.refresh());
      return res.data;
    } catch {
      alert("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  }, [router]);

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

  const uploading = useCallback(async (fn: () => Promise<void>) => {
    setPending((n) => n + 1);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
    } finally {
      setPending((n) => n - 1);
    }
  }, [router]);

  const store = useMemo<Store>(() => ({
    ...data,
    role,
    busy: pending > 0 || refreshing,
    getClient: (slug) => data.clients.find((c) => c.slug === slug),
    clientById: (id) => data.clients.find((c) => c.id === id),

    createBlock: (clientId, date) => call(() => A.createBlock(clientId, date)),
    updateBlock: async (id, patch) => { await call(() => A.updateBlock(id, patch)); },
    changeFormat: async (id, format) => { await call(() => A.changeFormat(id, format)); },
    setStatus: async (id, status) => { await call(() => A.setStatus(id, status)); },
    approve: async (id) => { await call(() => A.approve(id)); },
    suggest: async (id, field, proposed) => { await call(() => A.suggest(id, field, proposed)); },
    resolveSuggestion: async (id, accept) => { await call(() => A.resolveSuggestion(id, accept)); },
    addComment: async (id, text) => { await call(() => A.addComment(id, text)); },
    markCommentsSeen: async (id) => { await call(() => A.markCommentsSeen(id)); },
    deleteBlock: async (id) => { await call(() => A.deleteBlock(id)); },
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
    }),

    uploadMedia: (blockId, kind, files) => uploading(async () => {
      const paths: string[] = [];
      for (const f of files) {
        const ext = f.name.includes(".") ? f.name.split(".").pop()! : "bin";
        paths.push(await upload({ type: "media", blockId, ext }, f));
      }
      const r = await A.attachMedia(blockId, kind, paths);
      if (!r.ok) throw new Error(r.error);
    }),

    removeMedia: async (mediaId) => { await call(() => A.removeMedia(mediaId)); },

    addFiles: (clientId, files, kind) => uploading(async () => {
      for (const f of files) {
        const path = await upload({ type: "file", clientId, name: f.name }, f);
        const r = await A.registerFile(clientId, { name: f.name, kind: kind(f), size: f.size, path });
        if (!r.ok) throw new Error(r.error);
      }
    }),

    removeFile: async (fileId) => { await call(() => A.removeFile(fileId)); },

    downloadFile: async (fileId) => {
      const url = await call(() => A.fileDownloadUrl(fileId), false);
      if (url) window.location.href = url;
    },
  }), [data, role, pending, refreshing, call, upload, uploading]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
