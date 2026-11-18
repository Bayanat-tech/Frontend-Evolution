import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSummary } from "./types";
import { COLORS, Panel } from "./UiPage";

export default function StageChart({ summary: s }: { summary: DashboardSummary }) {
  const data = [
    { stage: "Orders", purchase: s.totalPOrder, sales: s.totalSOrder },
    { stage: "Delivered", purchase: s.totalGrn, sales: s.totalSdn },
    { stage: "Invoiced", purchase: s.totalInvoice, sales: s.totalSInvoice },
  ];
  return (
    <Panel title="Documents by stage" subtitle="Orders, GRN or SDN, invoices" className="h-full">
      <div className="mb-2 flex shrink-0 flex-wrap gap-2">
        {[["Purchase", COLORS.purchase], ["Sales", COLORS.sales]].map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
            {l}
          </span>
        ))}
      </div>
      <div className="relative min-h-[110px] flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="purchase" name="Purchase" fill={COLORS.purchase} radius={[4, 4, 0, 0]} maxBarSize={22}>
                <LabelList dataKey="purchase" position="top" style={{ fontSize: 10, fill: "#64748b" }} />
              </Bar>
              <Bar dataKey="sales" name="Sales" fill={COLORS.sales} radius={[4, 4, 0, 0]} maxBarSize={22}>
                <LabelList dataKey="sales" position="top" style={{ fontSize: 10, fill: "#64748b" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  );
}