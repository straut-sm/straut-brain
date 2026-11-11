"use client";

import { Check, Crop, Eye, EyeOff, Loader2, Power, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Client, ClientInput } from "@/lib/types";
import { Button } from "./ui";
import AvatarCropper from "./AvatarCropper";

export const CLIENT_COLORS = [
  "#b5785c", "#6f846d", "#9a6f8c", "#5f7b98", "#b09452",
  "#8c6a52", "#5e8a86", "#a0655f", "#7a7397", "#6b6b6b",
];

const EMPTY: ClientInput = {
  name: "", specialty: "", contractPosts: 12, paymentDay: 10, color: CLIENT_COLORS[0],
  driveUrl: "", instagramUrl: "", tiktokUrl: "", password: "", active: true, notes: "",
};

/** Formulário de nova cliente (client = undefined) ou de gestão de uma cliente existente. */
export default function ClientForm({ client, onClose }: {
  client?: Client;
  onClose: () => void;
}) {
  const store = useStore();
  const isNew = !client;
  const [v, setV] = useState<ClientInput>(() => {
    if (!client) {
      const used = new Set(store.clients.map((c) => c.color));
      return { ...EMPTY, color: CLIENT_COLORS.find((c) => !used.has(c)) ?? CLIENT_COLORS[0] };
    }
    return {
      name: client.name, specialty: client.specialty, contractPosts: client.contractPosts,
      paymentDay: client.paymentDay, color: client.color, driveUrl: client.driveUrl,
      instagramUrl: client.instagramUrl, tiktokUrl: client.tiktokUrl,
      password: "", active: client.active, notes: client.notes,
    };
  });
  // Foto: undefined = sem mudança · null = remover · Blob = nova foto
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(client?.avatarUrl);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null | undefined>(undefined);
  const [showPw, setShowPw] = useState(false);
  const [tried, setTried] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const set = <K extends keyof ClientInput>(k: K, val: ClientInput[K]) => setV((s) => ({ ...s, [k]: val }));

  const errors = {
    name: !v.name.trim() ? "Informe o nome." : "",
    specialty: !v.specialty.trim() ? "Informe o nicho." : "",
    contractPosts: !(v.contractPosts >= 1 && v.contractPosts <= 99) ? "Entre 1 e 99." : "",
    paymentDay: !(v.paymentDay >= 1 && v.paymentDay <= 31) ? "Dia entre 1 e 31." : "",
    password:
      isNew && v.password.trim().length < 4 ? "Mínimo de 4 caracteres."
      : !isNew && v.password.trim() && v.password.trim().length < 4 ? "Mínimo de 4 caracteres."
      : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid || saving) return;
    setSaving(true);
    const clean = { ...v, name: v.name.trim(), specialty: v.specialty.trim(), password: v.password.trim() };
    const saved = await store.saveClient(client?.id ?? null, clean);
    if (saved && avatarBlob !== undefined) await store.setAvatar(saved.id, avatarBlob);
    setSaving(false);
    if (saved) onClose();
  };

  const toggleActive = async () => {
    if (!client) return;
    await store.setActive(client.id, !client.active);
    setV((s) => ({ ...s, active: !client.active }));
    setConfirmOff(false);
  };

  const err = (k: keyof typeof errors) =>
    tried && errors[k] ? <p className="mt-1 text-[11px] text-[#b9583a]">{errors[k]}</p> : null;

  const input = "w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mist";

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px] md:items-center md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Nova cliente" : `Gestão de ${client.name}`}
        className="animate-pop flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-paper shadow-2xl md:rounded-2xl"
        noValidate
      >
        <div className="flex items-start justify-between gap-3 border-b border-mist px-5 py-4 md:px-6">
          <div>
            <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              {isNew ? "Cadastro" : "Gestão da cliente"}
            </p>
            <h2 className="font-display text-xl font-semibold">{isNew ? "Nova cliente" : client.name}</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-graphite hover:bg-cream"><X size={20} /></button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5 md:px-6">
          {!isNew && !client.active && (
            <p className="mb-5 flex items-center gap-2 rounded-xl bg-mist px-3.5 py-2.5 text-sm text-graphite">
              <Power size={15} /> Página desativada: a cliente não consegue acessar o link.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AvatarField
              name={v.name}
              color={v.color}
              value={avatarPreview}
              onChange={(preview, blob) => { setAvatarPreview(preview); setAvatarBlob(blob); }}
            />
            <Field label="Nome da cliente" className="sm:col-span-2">
              <input className={input} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Dra. Ana Souza" autoFocus={isNew} />
              {err("name")}
            </Field>
            <Field label="Nicho / especialidade">
              <input className={input} value={v.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="Ex.: Dermatologia" />
              {err("specialty")}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Posts por mês">
                <input type="number" min={1} max={99} className={input} value={v.contractPosts || ""} onChange={(e) => set("contractPosts", Number(e.target.value))} />
                {err("contractPosts")}
              </Field>
              <Field label="Dia de pagamento">
                <input type="number" min={1} max={31} className={input} value={v.paymentDay || ""} onChange={(e) => set("paymentDay", Number(e.target.value))} />
                {err("paymentDay")}
              </Field>
            </div>
            <Field label={isNew ? "Senha da página da cliente" : "Nova senha da página (opcional)"}>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className={`${input} pr-10`}
                  value={v.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                  placeholder={isNew ? "" : "Deixe em branco para manter a atual"}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {err("password") ?? <p className="mt-1 text-[11px] text-muted">A senha fica guardada de forma criptografada. Anote antes de enviar à cliente.</p>}
            </Field>
            <Field label="Link da pasta no Drive">
              <input type="url" className={input} value={v.driveUrl} onChange={(e) => set("driveUrl", e.target.value)} placeholder="https://drive.google.com/…" />
            </Field>
            <Field label="Instagram">
              <input className={input} value={v.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="@usuario ou link do perfil" />
            </Field>
            <Field label="TikTok">
              <input className={input} value={v.tiktokUrl} onChange={(e) => set("tiktokUrl", e.target.value)} placeholder="@usuario ou link do perfil" />
            </Field>
            <Field label="Cor da cliente no calendário" className="sm:col-span-2" group>
              <div className="flex flex-wrap gap-2">
                {CLIENT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("color", c)}
                    aria-label={`Cor ${c}`}
                    aria-pressed={v.color === c}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition ${v.color === c ? "ring-2 ring-ink" : "hover:scale-110"}`}
                    style={{ background: c }}
                  >
                    {v.color === c && <Check size={14} className="text-paper" />}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Observações internas" className="sm:col-span-2">
              <textarea rows={3} className={`${input} resize-y`} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Preferências, tom de voz, contatos… (não aparece para a cliente)" />
            </Field>
          </div>

          {!isNew && (
            <div className="mt-6 rounded-2xl border border-mist p-4">
              <p className="mb-1 text-sm font-medium">{client.active ? "Desativar página" : "Reativar página"}</p>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                {client.active
                  ? "Use quando o contrato for cancelado. A cliente perde o acesso ao link, e ela sai do painel e do calendário geral. Os conteúdos e o histórico ficam guardados."
                  : "A cliente volta para o painel e o link volta a funcionar com a mesma senha."}
              </p>
              {client.active ? (
                confirmOff ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-graphite">Confirmar desativação?</span>
                    <Button type="button" variant="danger" onClick={toggleActive}><Power size={14} /> Sim, desativar</Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmOff(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button type="button" variant="danger" onClick={() => setConfirmOff(true)}><Power size={14} /> Desativar página</Button>
                )
              ) : (
                <Button type="button" variant="outline" onClick={toggleActive}><Power size={14} /> Reativar página</Button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-mist bg-cream px-5 py-3 md:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {isNew ? "Cadastrar cliente" : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Reduz a foto para 320px (quadrado, recorte central). */
export function initialsOf(name: string) {
  return name.replace(/^Dra?\.\s*/, "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function AvatarField({ name, color, value, onChange }: {
  name: string; color: string; value?: string; onChange: (preview: string | undefined, blob: Blob | null) => void;
}) {
  const [error, setError] = useState("");
  // Imagem original (em alta) usada no ajuste; a foto salva é só o recorte.
  const [original, setOriginal] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [loading, setLoading] = useState(false);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Escolha um arquivo de imagem."); return; }
    setError("");
    setOriginal(URL.createObjectURL(file));
    setCropping(true);
  };

  // Reajustar a foto já salva: baixa a imagem atual para recortar de novo.
  const adjust = async () => {
    if (original) { setCropping(true); return; }
    if (!value) return;
    setLoading(true);
    try {
      const res = await fetch(value);
      if (!res.ok) throw new Error();
      setOriginal(URL.createObjectURL(await res.blob()));
      setCropping(true);
      setError("");
    } catch {
      setError("Não foi possível abrir a foto atual. Envie a foto de novo.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-xl font-semibold text-paper ring-2 ring-paper outline outline-2 outline-sand"
        style={{ background: color }}
      >
        {value ? <img src={value} alt="Foto da cliente" className="h-full w-full object-cover" /> : initialsOf(name) || "?"}
      </span>
      <div>
        <p className="mb-1.5 text-xs font-medium text-graphite">Foto da cliente</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-sand bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream focus-within:ring-2 focus-within:ring-ink">
            <Upload size={13} /> {value ? "Trocar foto" : "Adicionar foto"}
            <input type="file" accept="image/*" className="sr-only" onChange={pick} />
          </label>
          {value && (
            <button type="button" onClick={adjust} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-sand bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Crop size={13} />} Ajustar
            </button>
          )}
          {value && (
            <button type="button" onClick={() => { onChange(undefined, null); setOriginal(null); }} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-cream hover:text-ink">
              Remover
            </button>
          )}
        </div>
        {cropping && original && (
          <AvatarCropper
            src={original}
            onCancel={() => setCropping(false)}
            onDone={(blob) => { onChange(URL.createObjectURL(blob), blob); setCropping(false); }}
          />
        )}
        <p className={`mt-1 text-[11px] ${error ? "text-[#b9583a]" : "text-muted"}`}>
          {error || "Aparece na visualização de feed. Sem foto, usamos as iniciais."}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, className = "", group = false }: { label: string; children: React.ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`block ${className}`} {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-1.5 block text-xs font-medium text-graphite">{label}</span>
      {children}
    </Tag>
  );
}
