import type { Format, Status } from "@/lib/types";
import { FORMATS, STATUSES, statusLabel } from "@/lib/meta";

export function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: STATUSES[status].color }}
    />
  );
}

export function StatusPill({ status, format }: { status: Status; format: Format }) {
  const s = STATUSES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: s.soft, color: status === "publicado" ? "#1c1c1c" : s.color }}
    >
      <StatusDot status={status} size={7} />
      {statusLabel(status, format)}
    </span>
  );
}

export function FormatBadge({ format }: { format: Format }) {
  const F = FORMATS[format];
  const Icon = F.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-cream px-2.5 py-1 text-xs font-medium text-graphite">
      <Icon size={13} strokeWidth={1.8} />
      {F.label}
    </span>
  );
}

export function Button({
  variant = "outline",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-graphite",
    outline: "border border-sand bg-paper text-ink hover:bg-cream hover:border-graphite/30",
    ghost: "text-graphite hover:bg-cream",
    danger: "border border-[#e6c8bd] bg-paper text-[#b9583a] hover:bg-[#f6e3dc]",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${styles} ${className}`}
    />
  );
}

export function Logo({ className = "h-5", invert = false }: { className?: string; invert?: boolean }) {
  return (
    <img
      src="/brand/logo.svg"
      alt="Straut"
      className={`${className} w-auto ${invert ? "invert" : ""}`}
    />
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-graphite">{children}</h2>
      {right}
    </div>
  );
}
