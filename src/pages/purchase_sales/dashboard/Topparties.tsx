import { useState } from "react";
import type { Customer, Supplier } from "./types";
import { COLORS, EmptyState, Panel, fmtAmt } from "./UiPage";

type Tab = "suppliers" | "customers";

export default function TopParties({
  suppliers, customers,
}: { suppliers: Supplier[]; customers: Customer[] }) {
  const [tab, setTab] = useState<Tab>("suppliers");
  const rows = (tab === "suppliers"
    ? suppliers.map((s) => ({ code: s.supplierCode,name: s.supplierName, amount: s.totalAmount }))
    : customers.map((c) => ({ code: c.customerCode,name: c.customerName, amount: c.totalAmount }))
  ).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const color = tab === "suppliers" ? COLORS.purchase : COLORS.sales;

  const toggle = (
    <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
      {(["suppliers", "customers"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`rounded-full px-3 py-0.5 capitalize ${
            tab === t ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );

  // One line per party (rank, code, bar, amount) so 5 rows stay about 130px tall.
  return (
    <Panel title={`Top 5 ${tab}`} action={toggle} className="h-full">
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const pct = total > 0 ? (r.amount / total) * 100 : 0;
            return (
              <li key={r.code} className="flex h-6 items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: color }}>
                  {i + 1}
                </span>
                <span className="w-32 shrink-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={r.name}>
                  {r.name}
                </span>
                <div className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="w-28 shrink-0 text-right text-sm tabular-nums text-slate-900 dark:text-slate-100">
                  {fmtAmt(r.amount)} <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}