import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyAmount } from "./types";
import { COLORS, EmptyState, Panel, fmtAmt, fmtCompact, monthKey } from "./UiPage";

type Key = "purchase" | "sales";
type Row = { month: string; purchase: number; sales: number };

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const shortLabel = (m: string) => {
  const s = (m || "").slice(0, 3).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function PurchaseSalesChart({
  purchase, sales,
}: { purchase: MonthlyAmount[]; sales: MonthlyAmount[] }) {
  const [hidden, setHidden] = useState<Record<Key, boolean>>({ purchase: false, sales: false });

  const { data, totals, hasData } = useMemo(() => {
    const map = new Map<string, Row>();
    purchase.forEach((p) => map.set(p.month, { month: p.month, purchase: p.totalAmount, sales: 0 }));
    sales.forEach((s) => {
      const row = map.get(s.month) ?? { month: s.month, purchase: 0, sales: 0 };
      row.sales = s.totalAmount;
      map.set(s.month, row);
    });
    let rows = [...map.values()].sort((a, b) => monthKey(a.month) - monthKey(b.month));

    // A line needs 2+ points: when all data is in one year, show Jan–Dec (missing = 0).
    const years = new Set(rows.map((r) => r.month.split("-")[1]));
    if (years.size === 1) {
      const year = [...years][0];
      rows = MONTHS.map((m) => map.get(`${m}-${year}`) ?? { month: `${m}-${year}`, purchase: 0, sales: 0 });
    }
    return {
      data: rows,
      hasData: map.size > 0,
      totals: {
        purchase: rows.reduce((a, r) => a + r.purchase, 0),
        sales: rows.reduce((a, r) => a + r.sales, 0),
      },
    };
  }, [purchase, sales]);

  const chips: { key: Key; label: string; color: string }[] = [
    { key: "purchase", label: "Purchase", color: COLORS.purchase },
    { key: "sales", label: "Sales", color: COLORS.sales },
  ];

  return (
    <Panel title="Purchase vs sales by month" subtitle="Click a legend chip to hide a line" className="h-full">
      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-2 flex shrink-0 flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setHidden((h) => ({ ...h, [c.key]: !h[c.key] }))}
                className={`inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200 ${hidden[c.key] ? "opacity-40" : ""}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label} {fmtCompact(totals[c.key])}
              </button>
            ))}
          </div>
          <div className="relative min-h-[110px] flex-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPurchase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.purchase} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={COLORS.purchase} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.sales} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={COLORS.sales} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={shortLabel} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                  <Tooltip formatter={(v: any) => fmtAmt(Number(v ?? 0))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  {!hidden.purchase && (
                    <Area type="monotone" dataKey="purchase" name="Purchase" stroke={COLORS.purchase} strokeWidth={2} fill="url(#gPurchase)" dot={false} activeDot={{ r: 4 }} />
                  )}
                  {!hidden.sales && (
                    <Area type="monotone" dataKey="sales" name="Sales" stroke={COLORS.sales} strokeWidth={2} fill="url(#gSales)" dot={false} activeDot={{ r: 4 }} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}