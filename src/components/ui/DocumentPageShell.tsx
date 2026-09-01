import { ReactNode } from 'react';
import { Ban, Download, Paperclip, Printer, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type DocBadge = { label: string; value: ReactNode };

type DocumentPageShellProps = {
  eyebrow: string;
  title: string;
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

/**
 * Renders as a full-height panel INSIDE the app content area.
 * Does NOT cover the global navbar (no fixed inset-0).
 * Parent route/layout should be position:relative with a defined height
 * (e.g. the main content wrapper that already sits below the navbar).
 */
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
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-lg bg-[#eef2f7]',
        className,
      )}
    >
      {/* Toolbar – fixed, no scroll */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-[#0e4f8f] px-4 py-2 text-white shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="pr-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-blue-200">
              {eyebrow}
            </div>
            <div className="text-base font-semibold leading-tight">{title}</div>
          </div>
          {badges.map((b) => (
            <div
              key={b.label}
              className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1"
            >
              <div className="text-[8px] font-semibold uppercase tracking-wider text-blue-200">
                {b.label}
              </div>
              <div className="text-xs font-semibold text-white">{b.value ?? '—'}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {onPrint && (
            <ToolbarButton icon={<Printer size={13} />} label="Print" onClick={onPrint} />
          )}
          {onDownload && (
            <ToolbarIconButton icon={<Download size={13} />} onClick={onDownload} />
          )}
          {onCancel && (
            <ToolbarButton icon={<Ban size={13} />} label="Cancel" onClick={onCancel} />
          )}
          {onFiles && (
            <ToolbarButton icon={<Paperclip size={13} />} label="Files" onClick={onFiles} />
          )}
          <ToolbarIconButton icon={<X size={15} />} onClick={onClose} />
        </div>
      </div>

      {/* ONLY this area scrolls */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{children}</div>

      {/* Footer – fixed */}
      {footer && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-300 bg-white px-4 py-2">
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
      className="flex items-center gap-1 rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20"
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
      className="grid h-7 w-7 place-items-center rounded-md border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
    >
      {icon}
    </button>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────

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
        'mb-2 grid gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#0e4f8f]">
            {label}
          </div>
          {subtitle && (
            <div className="text-xs font-semibold text-slate-800">{subtitle}</div>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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
    <div className={cn('grid gap-0.5', className)}>
      <label className="text-[11px] font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export const docInputClass =
  'h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition-colors focus:border-[#0e4f8f] focus:ring-1 focus:ring-[#0e4f8f] disabled:bg-slate-50 disabled:text-slate-500';

export const docTextareaClass =
  'w-full min-h-[32px] max-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm outline-none transition-colors focus:border-[#0e4f8f] focus:ring-1 focus:ring-[#0e4f8f] resize-none';

export function DocumentTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('doc-table overflow-hidden rounded-xl border border-slate-200', className)}>
      <style>{`
        .doc-table thead tr {
          background: #0e4f8f !important;
        }
        .doc-table thead th {
          color: #ffffff !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          border-color: rgba(255,255,255,0.15) !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
        }
        .doc-table thead th:first-child {
          border-top-left-radius: 0.75rem;
        }
        .doc-table thead th:last-child {
          border-top-right-radius: 0.75rem;
        }
        .doc-table thead th svg {
          color: #cfe0f5 !important;
        }
        .doc-table tbody td {
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }
      `}</style>
      {children}
    </div>
  );
}