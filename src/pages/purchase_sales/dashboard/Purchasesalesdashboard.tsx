import { useCallback, useEffect, useState } from "react";
import { MonthlyAmount, PurchaseSalesDashboardData } from "./types";
import { getPurchaseSalesDashboard } from "../../../api/purchaseSales";
import DashboardHeader from "./Dashboardheader";
import { ErrorState, Skeleton } from "./UiPage";
import { PurchaseCard, SalesCard } from "./FlowCard";
import PurchaseSalesChart from "./Purchasesaleschart";
import StageChart from "./Stagechart";
import TopParties from "./Topparties";
import { PurchaseWorkflow, SalesWorkflow } from "./Workflow";

const sum = (rows: MonthlyAmount[]) => rows.reduce((a, r) => a + (r.totalAmount || 0), 0);

const MONTHS = [
  "Full Year", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const selectCls =
  "h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";
// label is light so it reads on the blue banner
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/80";

function FilterSelect({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="w-40">
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <select
          className={selectCls}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}

export default function PurchaseSalesDashboard({ companyCode = "BSG" }: { companyCode?: string }) {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1); // 0 = full year

  const [data, setData] = useState<PurchaseSalesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setData(await getPurchaseSalesDashboard(companyCode, year, month, signal));
        setUpdatedAt(new Date());
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        setError(e?.response?.data?.message || e?.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    },
    [companyCode, year, month]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Fills the visible area; scrolls only if the content is taller than the screen (no overlap).
  // 7.5rem = app header + breadcrumb above this page. Adjust if your shell differs.
  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3 overflow-y-auto p-3 md:p-4">
      {/* CHANGED: filters passed into the banner via the filters prop */}
      <div className="shrink-0">
        <DashboardHeader
          companyCode={companyCode}
          data={data}
          loading={loading}
          updatedAt={updatedAt}
          onRefresh={() => load()}
          filters={
            <>
              <FilterSelect label="Financial Year" value={year} onChange={setYear} disabled>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Month" value={month} onChange={setMonth}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </FilterSelect>
            </>
          }
        />
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading && !data ? (
        <>
          <div className="grid shrink-0 gap-3 lg:grid-cols-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44 lg:col-span-2" />
          </div>
          <div className="grid min-h-[230px] flex-1 gap-3 lg:grid-cols-3">
            <Skeleton className="h-full lg:col-span-2" />
            <Skeleton className="h-full" />
          </div>
          <div className="grid shrink-0 gap-3 lg:grid-cols-5">
            <Skeleton className="h-44 lg:col-span-3" />
            <Skeleton className="h-44 lg:col-span-2" />
          </div>
        </>
      ) : data ? (
        <>
          <div className="grid shrink-0 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <PurchaseCard s={data.summary} amount={sum(data.monthlyPurchase)} />
            <SalesCard s={data.summary} amount={sum(data.monthlySales)} />
            <div className="md:col-span-2">
              <TopParties suppliers={data.topSuppliers} customers={data.topCustomers} />
            </div>
          </div>
          <div className="grid min-h-[230px] flex-1 gap-3 lg:grid-cols-3">
            <div className="min-h-0 lg:col-span-2">
              <PurchaseSalesChart purchase={data.monthlyPurchase} sales={data.monthlySales} />
            </div>
            <div className="min-h-0">
              <StageChart summary={data.summary} />
            </div>
          </div>
          <div className="grid shrink-0 gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3"><PurchaseWorkflow summary={data.summary} /></div>
            <div className="lg:col-span-2"><SalesWorkflow summary={data.summary} /></div>
          </div>
        </>
      ) : null}
    </div>
  );
}