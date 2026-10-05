import { RefreshCw } from "lucide-react";
import type { PurchaseSalesDashboardData } from "./types";
import { fmt, fmtCompact } from "./UiPage";

const sum = (rows: { totalAmount: number }[]) => rows.reduce((a, r) => a + (r.totalAmount || 0), 0);

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
      <p className="text-[11px] text-blue-100">{label}</p>
      <p className="text-xl font-bold leading-tight tabular-nums text-white">{value}</p>
      <p className="truncate text-[11px] text-blue-200/80">{sub}</p>
    </div>
  );
}

export default function DashboardHeader({
  companyCode, data, loading, updatedAt, onRefresh,
}: {
  companyCode: string;
  data: PurchaseSalesDashboardData | null;
  loading: boolean;
  updatedAt: Date | null;
  onRefresh: () => void;
}) {
  const s = data?.summary;
  const pending = s ? s.pOrderGrnPending + s.invoicePending + s.sOrderSdnPending + s.sInvoicePending : 0;
  const dash = "—";
  return (
    <div className="grid gap-3 rounded-2xl bg-gradient-to-r from-[#0b2a7b] to-[#1e56d8] p-3.5 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,2.6fr)] lg:items-center">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Purchase &amp; Sales overview</h1>
          <p className="text-[11px] text-blue-100">
            Company {companyCode}
            {updatedAt && ` · Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile label="Total purchase" value={data ? fmtCompact(sum(data.monthlyPurchase)) : dash} sub={s ? `${fmt(s.totalPOrder)} orders, ${fmt(s.totalGrn)} GRNs` : " "} />
        <Tile label="Total sales" value={data ? fmtCompact(sum(data.monthlySales)) : dash} sub={s ? `${fmt(s.totalSOrder)} orders, ${fmt(s.totalSdn)} SDNs` : " "} />
        <Tile label="Invoiced" value={s ? fmt(s.totalInvoice + s.totalSInvoice) : dash} sub={s ? `${fmt(s.totalInvoice)} purchase, ${fmt(s.totalSInvoice)} sales` : " "} />
        <Tile label="Needs action" value={s ? fmt(pending) : dash} sub="Awaiting GRN, SDN or invoice" />
      </div>
    </div>
  );
}