import { ReactNode } from 'react';
import { Ban, Download, Paperclip, Printer, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type DocBadge = { label: string; value: ReactNode };

type DocumentPageShellProps = {
  eyebrow: string;           // e.g. "EDIT DOCUMENT" / "ADD DOCUMENT"
  title: string;             // e.g. "Absent Memo"
  badges?: DocBadge[];
  onClose: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
  onFiles?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function DocumentPageShell({
  eyebrow,
  title,
  badges = [],
  onClose,
  onCancel,
  onPrint,
  onDownload,
  onFiles,
  children,
  footer,
  className,
}: DocumentPageShellProps) {
  return (
    <div className={cn('fixed inset-0 z-[70] flex flex-col bg-[#eef2f7]', className)}>
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e4f8f] px-5 py-3 text-white shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="pr-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-200">
              {eyebrow}
            </div>
            <div className="text-lg font-semibold leading-tight">{title}</div>
          </div>

          {badges.map((b) => (
            <div
              key={b.label}
              className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5"
            >
              <div className="text-[9px] font-semibold uppercase tracking-wider text-blue-200">
                {b.label}
              </div>
              <div className="text-sm font-semibold text-white">{b.value ?? '—'}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {onPrint && (
            <ToolbarButton icon={<Printer size={14} />} label="Print" onClick={onPrint} />
          )}
          {onDownload && <ToolbarIconButton icon={<Download size={14} />} onClick={onDownload} />}
          {onCancel && (
            <ToolbarButton icon={<Ban size={14} />} label="Cancel" onClick={onCancel} />
          )}
          {onFiles && (
            <ToolbarButton icon={<Paperclip size={14} />} label="Files" onClick={onFiles} />
          )}
          <ToolbarIconButton icon={<X size={16} />} onClick={onClose} />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-300 bg-white px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
    >
      {icon}
      {label}
    </button>
  );
}

function ToolbarIconButton({ icon, onClick }: { icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
    >
      {icon}
    </button>
  );
}

// ─── Section wrapper: "HEADER" / "DETAILS" blue label + card ───────────────

export function DocumentSection({
  label,
  subtitle,
  action,
  children,
  className,
}: {
  label: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'mb-4 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0e4f8f]">
            {label}
          </div>
          {subtitle && <div className="text-sm font-semibold text-slate-800">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Field: label above, bordered input box below ──────────────────────────

export function DocField({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1', className)}>
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export const docInputClass =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition-colors focus:border-[#0e4f8f] focus:ring-1 focus:ring-[#0e4f8f] disabled:bg-slate-50 disabled:text-slate-500';

export const docTextareaClass =
  'w-full min-h-[70px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition-colors focus:border-[#0e4f8f] focus:ring-1 focus:ring-[#0e4f8f]';

// ─── Blue-header table wrapper (wraps <DataTable/>) ─────────────────────────

export function DocumentTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('doc-table', className)}>
      <style>{`
        .doc-table thead tr { background: #0e4f8f !important; }
        .doc-table thead th {
          color: #ffffff !important;
          font-weight: 600 !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .doc-table thead th svg { color: #cfe0f5 !important; }
      `}</style>
      {children}
    </div>
  );
}