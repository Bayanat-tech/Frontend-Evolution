import { Cell, Pie, PieChart, Tooltip } from "recharts";

export interface Slice { name: string; value: number; color: string }

export default function Donut({
  data, top, bottom, size = 132, format = (n: number) => String(n),
}: { data: Slice[]; top: string; bottom: string; size?: number; format?: (n: number) => string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const shown = total === 0 ? [{ name: "None", value: 1, color: "#e2e8f0" }] : data.filter((d) => d.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie data={shown} dataKey="value" innerRadius={size * 0.36} outerRadius={size * 0.5} paddingAngle={total === 0 ? 0 : 2} stroke="none" startAngle={90} endAngle={-270}>
          {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        {total > 0 && (
          <Tooltip formatter={(v) => format(Number(v ?? 0))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        )}
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">{top}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{bottom}</span>
      </div>
    </div>
  );
}