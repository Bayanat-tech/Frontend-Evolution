import type { ComponentType } from "react";
import { ShoppingCart, Truck } from "lucide-react";
import type { DashboardSummary, MonthlyAmount } from "./types";
import Donut, { type Slice } from "./Donut";
import { CARD, COLORS, Panel, fmt, fmtAmt, fmtCompact } from "./UiPage";

const sum = (rows: MonthlyAmount[]) => rows.reduce((a, r) => a + (r.totalAmount || 0), 0);

function Legend({ slices, footerLabel, footerValue }: { slices: Slice[]; footerLabel?: string; footerValue?: string }) {
  return (
    <ul className="flex-1 space-y-1.5 text-xs">
      {slices.map((s) => (
        <li key={s.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmt(s.value)}</span>
        </li>
      ))}
      {footerLabel && (
        <li className="flex items-center justify-between gap-3 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">{footerLabel}</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{footerValue}</span>
        </li>
      )}
    </ul>
  );
}

function FlowCard({
  icon: Icon, tint, title, total, totalLabel, slices, footerLabel, footerValue,
}: {
  icon: ComponentType<{ className?: string }>;
  tint: string; title: string; total: number; totalLabel: string;
  slices: Slice[]; footerLabel: string; footerValue: string;
}) {
  const all = slices.reduce((a, s) => a + s.value, 0);
  const pct = all > 0 ? Math.round((slices[slices.length - 1].value / all) * 100) : 0;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: tint }}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(total)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{totalLabel}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Donut data={slices} top={`${pct}%`} bottom="invoiced" size={96} format={fmt} />
        <Legend slices={slices} footerLabel={footerLabel} footerValue={footerValue} />
      </div>
    </div>
  );
}

export function PurchaseCard({ s, amount }: { s: DashboardSummary; amount: number }) {
  return (
    <FlowCard
      icon={ShoppingCart} tint={COLORS.purchase} title="Purchase" total={s.totalPOrder} totalLabel="purchase orders"
      slices={[
        { name: "GRN pending", value: s.pOrderGrnPending, color: COLORS.pending },
        { name: "Invoice pending", value: s.invoicePending, color: COLORS.confirm },
        { name: "Invoiced", value: s.totalInvoice, color: COLORS.done },
      ]}
      footerLabel="Amount" footerValue={fmtAmt(amount)}
    />
  );
}

export function SalesCard({ s, amount }: { s: DashboardSummary; amount: number }) {
  return (
    <FlowCard
      icon={Truck} tint={COLORS.sales} title="Sales" total={s.totalSOrder} totalLabel="sales orders"
      slices={[
        { name: "SDN pending", value: s.sOrderSdnPending, color: COLORS.pending },
        { name: "Invoice pending", value: s.sInvoicePending, color: COLORS.confirm },
        { name: "Invoiced", value: s.totalSInvoice, color: COLORS.done },
      ]}
      footerLabel="Amount" footerValue={fmtAmt(amount)}
    />
  );
}

export function SplitCard({ purchase, sales }: { purchase: MonthlyAmount[]; sales: MonthlyAmount[] }) {
  const p = sum(purchase);
  const s = sum(sales);
  const total = p + s;
  const rows: Slice[] = [
    { name: "Purchase", value: p, color: COLORS.purchase },
    { name: "Sales", value: s, color: COLORS.sales },
  ];
  return (
    <Panel title="Amount split" subtitle="Purchase vs sales" className="h-full">
      <div className="flex items-center gap-4">
        <Donut data={rows} top={fmtCompact(total)} bottom="total" size={96} format={fmtAmt} />
        <ul className="flex-1 space-y-2.5 text-xs">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                  {r.name}
                </span>
                <span className="text-slate-500">{total > 0 ? Math.round((r.value / total) * 100) : 0}%</span>
              </div>
              <p className="pl-4 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmtAmt(r.value)}</p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}