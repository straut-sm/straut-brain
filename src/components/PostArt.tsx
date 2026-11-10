/**
 * Arte de exemplo para o protótipo (substitui fotos/vídeos reais).
 * Na versão funcional, aqui entra a mídia enviada pela Straut.
 */
export default function PostArt({
  hue,
  title,
  label,
  index,
  className = "",
  compact = false,
  small = false,
}: {
  hue: number;
  title: string;
  label?: string;
  index?: number;
  className?: string;
  compact?: boolean;
  /** Versão miniatura (feed): título pequeno. */
  small?: boolean;
}) {
  const h2 = (hue + 28) % 360;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(150deg, hsl(${hue} 22% 86%) 0%, hsl(${h2} 16% 72%) 100%)`,
      }}
    >
      <img
        src="/brand/monogram.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-[8%] -bottom-[6%] h-[70%] opacity-[0.12]"
      />
      <div className={`absolute inset-0 flex flex-col justify-between ${compact || small ? "p-2" : "p-5"}`}>
        {label ? (
          <span className={`font-display uppercase tracking-[0.18em] text-ink/60 ${compact || small ? "text-[8px]" : "text-[10px]"}`}>
            {label}
          </span>
        ) : <span />}
        {!compact && (
          <p className={`max-w-[85%] font-display font-semibold leading-tight text-ink/85 ${small ? "line-clamp-3 text-[11px]" : "text-xl"}`}>
            {index !== undefined && index > 0 ? `${index + 1}. ` : ""}
            {title}
          </p>
        )}
      </div>
    </div>
  );
}
