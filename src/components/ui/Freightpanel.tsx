import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────
   SectionPanel — Freight structure (optional `actions` slot in the title bar)
   ───────────────────────────────────────────────────────────── */
export function SectionPanel({
  title,
  icon: Icon,
  actions,
  children
}: {
  title: string;
  icon: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — Freight label styling (error wins over helperText)
   ───────────────────────────────────────────────────────────── */
export function Field({
  label,
  required,
  error,
  helperText,
  children,
  className
}: {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
      {error ? (
        <span className="text-destructive text-[10.5px]">{error}</span>
      ) : helperText ? (
        <span className="text-[10.5px] text-muted-foreground">{helperText}</span>
      ) : null}
    </label>
  );
}