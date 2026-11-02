import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

export const COLORS = {
  purchase: "#2563eb", // blue
  sales: "#f59e0b",    // orange
  pending: "#f59e0b",
  confirm: "#6366f1",  // purple
  done: "#10b981",     // green
};

const count = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const amount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
export const fmt = (n: number) => count.format(n ?? 0);
export const fmtAmt = (n: number) => amount.format(n ?? 0);
export const fmtCompact = (n: number) => compact.format(n ?? 0);

export const CARD =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function Panel({
  title, subtitle, action, children, className = "",
}: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${CARD} flex flex-col p-4 ${className}`}>
      <header className="mb-2 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800 ${className}`} />;
}

export function EmptyState({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-1 flex-col items-center justify-center gap-2 text-slate-400">
      <Inbox className="h-6 w-6" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-red-600" />
      <h2 className="text-base font-semibold text-red-900">Could not load the dashboard</h2>
      <p className="text-sm text-red-700">{message}</p>
      <button onClick={onRetry} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
        Retry
      </button>
    </div>
  );
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
/** "SEP-2026" -> sortable number */
export function monthKey(m: string): number {
  const [mon, yr] = (m || "").toUpperCase().split("-");
  const i = MONTHS.indexOf(mon);
  return (parseInt(yr, 10) || 0) * 12 + (i < 0 ? 0 : i);
}