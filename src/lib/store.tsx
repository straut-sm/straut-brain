"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SEED_BLOCKS, SEED_CLIENTS } from "./seed";
import type { Author, Block, Client, ClientFile, Format, Snapshot, Status } from "./types";
import { FORMATS } from "./meta";

const STORAGE_KEY = "straut-brain-prototipo-v2";

export type ClientInput = Omit<Client, "id" | "slug" | "files">;

export function slugify(name: string) {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
}

interface State {
  clients: Client[];
  blocks: Block[];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function snap(b: Block): Snapshot {
  return { format: b.format, title: b.title, caption: b.caption, script: b.script, date: b.date };
}

function now() {
  return new Date().toISOString();
}

interface Store extends State {
  ready: boolean;
  getClient: (slug: string) => Client | undefined;
  clientById: (id: string) => Client | undefined;
  createBlock: (clientId: string, date: string) => string;
  updateBlock: (id: string, by: Author, patch: Partial<Pick<Block, "title" | "caption" | "script" | "date">>) => void;
  changeFormat: (id: string, format: Format) => void;
  setStatus: (id: string, status: Status, by: Author, action: string) => void;
  approve: (id: string) => void;
  suggest: (id: string, field: "caption" | "script", proposed: string) => void;
  resolveSuggestion: (id: string, accept: boolean) => void;
  addComment: (id: string, by: Author, text: string) => void;
  markCommentsSeen: (id: string) => void;
  deleteBlock: (id: string) => void;
  addClient: (input: ClientInput) => Client;
  updateClient: (id: string, input: Partial<ClientInput>) => void;
  addFile: (clientId: string, file: Omit<ClientFile, "id" | "at">) => void;
  removeFile: (clientId: string, fileId: string) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ clients: SEED_CLIENTS, blocks: SEED_BLOCKS });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* armazenamento indisponível: segue com os dados de exemplo */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state, ready]);

  const mutate = useCallback((id: string, fn: (b: Block) => Block) => {
    setState((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === id ? fn(b) : b)) }));
  }, []);

  const store = useMemo<Store>(() => ({
    ...state,
    ready,
    getClient: (slug) => state.clients.find((c) => c.slug === slug),
    clientById: (id) => state.clients.find((c) => c.id === id),

    createBlock: (clientId, date) => {
      const id = `n-${uid()}`;
      const block: Block = {
        id, clientId, date, title: "Novo conteúdo", format: "roteiro", status: "em_producao",
        caption: "", script: "", slides: 5, hue: Math.floor(Math.random() * 360),
        history: [{ id: uid(), at: now(), by: "Straut", action: "Bloco criado como Roteiro" }],
        comments: [],
      };
      setState((s) => ({ ...s, blocks: [...s.blocks, block] }));
      return id;
    },

    updateBlock: (id, by, patch) =>
      mutate(id, (b) => {
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== b[k]);
        if (!changed.length) return b;
        const names: Record<string, string> = { title: "título", caption: "legenda", script: "roteiro", date: "data de postagem" };
        return {
          ...b, ...patch,
          history: [...b.history, { id: uid(), at: now(), by, action: `Editou ${changed.map((k) => names[k]).join(", ")}`, before: snap(b) }],
        };
      }),

    changeFormat: (id, format) =>
      mutate(id, (b) => b.format === format ? b : ({
        ...b, format,
        history: [...b.history, { id: uid(), at: now(), by: "Straut", action: `Formato alterado de ${FORMATS[b.format].label} para ${FORMATS[format].label}`, before: snap(b) }],
      })),

    setStatus: (id, status, by, action) =>
      mutate(id, (b) => ({ ...b, status, history: [...b.history, { id: uid(), at: now(), by, action }] })),

    approve: (id) =>
      mutate(id, (b) => ({
        ...b, status: "aprovado",
        history: [...b.history, { id: uid(), at: now(), by: "Cliente", action: b.format === "roteiro" ? "Roteiro aprovado" : "Post aprovado" }],
      })),

    suggest: (id, field, proposed) =>
      mutate(id, (b) => {
        const original = b[field];
        if (proposed.trim() === original.trim()) return b;
        return {
          ...b, status: "ajuste_sugerido",
          suggestion: { field, original, proposed, at: now() },
          history: [...b.history, { id: uid(), at: now(), by: "Cliente", action: `Sugeriu alteração ${field === "caption" ? "na legenda" : "no roteiro"}` }],
        };
      }),

    resolveSuggestion: (id, accept) =>
      mutate(id, (b) => {
        if (!b.suggestion) return b;
        const { field, proposed } = b.suggestion;
        if (accept) {
          return {
            ...b, [field]: proposed, suggestion: undefined, status: "aprovado",
            history: [...b.history, { id: uid(), at: now(), by: "Straut", action: "Aceitou a sugestão da cliente", before: snap(b) }],
          };
        }
        return {
          ...b, suggestion: undefined, status: "aguardando_aprovacao",
          history: [...b.history, { id: uid(), at: now(), by: "Straut", action: "Recusou a sugestão da cliente" }],
        };
      }),

    addComment: (id, by, text) =>
      mutate(id, (b) => ({ ...b, comments: [...b.comments, { id: uid(), at: now(), by, text, seen: by === "Straut" }] })),

    markCommentsSeen: (id) =>
      mutate(id, (b) => b.comments.some((c) => !c.seen) ? { ...b, comments: b.comments.map((c) => ({ ...c, seen: true })) } : b),

    deleteBlock: (id) => setState((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) })),

    addClient: (input) => {
      const base = slugify(input.name);
      let slug = base;
      let n = 2;
      while (state.clients.some((c) => c.slug === slug)) slug = `${base}-${n++}`;
      const client: Client = { ...input, id: `cl-${uid()}`, slug, files: [] };
      setState((s) => ({ ...s, clients: [...s.clients, client] }));
      return client;
    },

    updateClient: (id, input) =>
      setState((s) => ({ ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, ...input } : c)) })),

    addFile: (clientId, file) =>
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) =>
          c.id === clientId ? { ...c, files: [{ ...file, id: `f-${uid()}`, at: now() }, ...c.files] } : c),
      })),

    removeFile: (clientId, fileId) =>
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => (c.id === clientId ? { ...c, files: c.files.filter((f) => f.id !== fileId) } : c)),
      })),

    reset: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignora */ }
      setState({ clients: SEED_CLIENTS, blocks: SEED_BLOCKS });
    },
  }), [state, ready, mutate]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
