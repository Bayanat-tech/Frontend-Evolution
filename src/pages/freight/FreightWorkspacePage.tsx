import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

type FreightProcess = "enquiry" | "rfq" | "quotation";

type FreightWorkspaceTarget = {
  process?: FreightProcess;
  direction?: string;
  mode?: string;
  action?: string;
};

type FreightSearchRow = {
  RECORD_TYPE?: string;
  RECORD_NO?: string;
  RECORD_DATE?: string;
  PRIN_CODE?: string;
  PRIN_NAME?: string;
  DEPT_CODE?: string;
  TRANSPORT_MODE?: string;
  JOB_TYPE?: string;
  ORIGIN_PORT?: string;
  DESTINATION_PORT?: string;
  HOUSE_BL_NO?: string;
  SOURCE_REF?: string;
  STATUS?: string;
  ROUTE_PATH?: string;
  DESCRIPTION?: string;
  [key: string]: unknown;
};

type WorkspaceSummary = {
  OPEN_JOBS?: number;
  PENDING_ENQUIRIES?: number;
  ACTIVE_RFQ?: number;
  ACTIVE_QUOTATIONS?: number;
  [key: string]: unknown;
};

export function FreightWorkspacePage({ target: _target }: { target?: FreightWorkspaceTarget }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [smartSearch, setSmartSearch] = useState("");
  const [smartRows, setSmartRows] = useState<FreightSearchRow[]>([]);
  const [summary, setSummary] = useState<WorkspaceSummary>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");

  const resultStats = useMemo(() => {
    const rows = smartRows || [];
    return {
      total: rows.length,
      jobs: rows.filter((row) => String(row.RECORD_TYPE || "").toUpperCase() === "JOB").length,
      commercial: rows.filter((row) => ["ENQUIRY", "RFQ", "QUOTATION"].includes(String(row.RECORD_TYPE || "").toUpperCase())).length,
    };
  }, [smartRows]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post<{ success?: boolean; data?: { summary?: WorkspaceSummary }; message?: string }>(
        "/api/freight/workspace/summary",
        { company_code: companyCode, user_id: userId },
      );
      setSummary(response.data.data?.summary || {});
    } catch (error: any) {
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Freight workspace summary is not available.");
    } finally {
      setLoading(false);
    }
  }, [companyCode, userId]);

  const searchFreight = useCallback(async (nextSearch = "") => {
    const term = nextSearch.trim();
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post<{ success?: boolean; data?: FreightSearchRow[]; totalCount?: number; message?: string }>(
        "/api/freight/workspace/global-search",
        { company_code: companyCode, user_id: userId, search: term || null },
      );
      const rows = response.data.data || [];
      setSmartRows(rows);
      if (!rows.length) setMessage(term ? "No freight record found for this search." : "No recent freight records found.");
    } catch (error: any) {
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Freight global search is not available.");
      setSmartRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyCode, userId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    void searchFreight("");
    // Search callback also depends on the typed query; initial load should only follow company/user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, userId]);

  return (
    <section className="grid gap-2">
      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="grid gap-3 border-b bg-white px-4 py-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Freight Management</div>
            <h1 className="m-0 text-[21px] font-extrabold leading-tight text-slate-950">Freight Control Center</h1>
            <p className="m-0 max-w-3xl text-[12px] font-medium text-slate-500">
              Search enquiry, RFQ, quotation, job, house BL, HBL, or principal from one clean workspace.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Refresh dashboard"
            onClick={loadWorkspace}
            className="h-9 w-9 rounded-md border-blue-100 bg-blue-50 text-primary hover:bg-blue-100"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </Button>
        </div>
        <div className="grid gap-2 bg-slate-50/70 p-2 md:grid-cols-4">
          <Metric icon={BriefcaseBusiness} label="Open Jobs" value={valueText(summary.OPEN_JOBS)} tone="blue" />
          <Metric icon={ClipboardList} label="Pending Enquiry" value={valueText(summary.PENDING_ENQUIRIES)} tone="amber" />
          <Metric icon={FileText} label="Active RFQ" value={valueText(summary.ACTIVE_RFQ)} tone="violet" />
          <Metric icon={FileSpreadsheet} label="Quotations" value={valueText(summary.ACTIVE_QUOTATIONS)} tone="emerald" />
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <PanelHeader
          icon={Search}
          title="Global Freight Search"
          subtitle="Commercial and operations records"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <ResultPill label="Records" value={String(resultStats.total)} tone="blue" />
              <ResultPill label="Jobs" value={String(resultStats.jobs)} tone="emerald" />
              <ResultPill label="Commercial" value={String(resultStats.commercial)} tone="amber" />
            </div>
          }
        />
        <form
          className="grid gap-2 border-b bg-slate-50/50 p-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void searchFreight(smartSearch);
          }}
        >
          <div className="relative freight-smart-search-field">
            <Search className="freight-smart-search-icon pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              className="freight-smart-search-input h-10 rounded-md border-slate-200 bg-white pl-11 pr-4 text-[14px] font-semibold shadow-sm placeholder:font-semibold placeholder:text-slate-500 focus-visible:ring-primary/25"
              value={smartSearch}
              onChange={(event) => {
                const value = event.target.value;
                setSmartSearch(value);
                if (!value.trim()) void searchFreight("");
              }}
              placeholder="Search AI/00001/00008, RFQ no, quotation no, job no, HBL, house/BL number, principal..."
            />
          </div>
          <Button type="submit" className="h-10 min-w-28 rounded-md text-sm font-bold">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-md"
            title="Reset search"
            onClick={() => {
              setSmartSearch("");
              void searchFreight("");
            }}
          >
            <RefreshCw size={16} />
          </Button>
        </form>
        <div className="max-h-[calc(100vh-325px)] min-h-[220px] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-blue-50 text-xs uppercase text-blue-950">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Type</th>
                <th className="px-4 py-3 text-left font-bold">Reference</th>
                <th className="px-4 py-3 text-left font-bold">Date</th>
                <th className="px-4 py-3 text-left font-bold">Principal</th>
                <th className="px-4 py-3 text-left font-bold">Movement</th>
                <th className="px-4 py-3 text-left font-bold">House / BL</th>
                <th className="px-4 py-3 text-left font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 size={18} className="mx-auto mb-2 animate-spin" /> Searching freight records
                  </td>
                </tr>
              ) : smartRows.length ? (
                smartRows.slice(0, 18).map((row, index) => (
                  <tr key={`${row.RECORD_TYPE || "ROW"}-${row.RECORD_NO || index}`} className="border-t hover:bg-blue-50/40">
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase ${recordTypeClass(row.RECORD_TYPE)}`}>
                        {text(row.RECORD_TYPE)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" className="font-bold text-primary hover:underline" onClick={() => openSearchRow(row)}>
                        {text(row.RECORD_NO)}
                      </button>
                      <div className="text-xs font-medium text-muted-foreground">{text(row.SOURCE_REF)}</div>
                    </td>
                    <td className="px-4 py-3">{formatDate(row.RECORD_DATE)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{text(row.PRIN_NAME || row.PRIN_CODE)}</div>
                      <div className="text-xs font-medium text-muted-foreground">{text(row.PRIN_CODE)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{jobTypeLabel(row.JOB_TYPE)} / {modeLabel(row.TRANSPORT_MODE)}</div>
                      <div className="text-xs font-medium text-muted-foreground">{text(row.ORIGIN_PORT)} to {text(row.DESTINATION_PORT)}</div>
                    </td>
                    <td className="px-4 py-3">{text(row.HOUSE_BL_NO)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{text(row.STATUS)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openSearchRow(row)}>
                        Open <ArrowRight size={13} />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    {message || "Search for an enquiry, RFQ, quotation, job, HBL, or principal."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );

  function openSearchRow(row: FreightSearchRow) {
    const routePath = text(row.ROUTE_PATH).replace(/^\/+/, "");
    const recordNo = text(row.RECORD_NO);
    if (!routePath || routePath === "-") return;
    const query = recordNo && recordNo !== "-" ? `?open=${encodeURIComponent(recordNo)}` : "";
    navigate(`/workspace/fms/${routePath}${query}`, { state: { freightSearchRecord: row } });
  }
}

function PanelHeader({ title, subtitle, icon: Icon, action }: { title: string; subtitle: string; icon: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-50 text-primary">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-[13px] font-bold leading-tight text-slate-950">{title}</h2>
          <p className="m-0 truncate text-xs font-medium text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "blue" | "amber" | "violet" | "emerald" }) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className="flex items-center gap-2.5 rounded-md border bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
      <span className={`grid h-8 w-8 place-items-center rounded-md border ${toneClass}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate text-base font-extrabold text-slate-950">{value}</div>
      </div>
    </div>
  );
}

function ResultPill({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" | "emerald" }) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
  }[tone];

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold uppercase ${toneClass}`}>
      {label}
      <strong className="text-sm leading-none">{value}</strong>
    </span>
  );
}

function valueText(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function text(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
}

function recordTypeClass(value: unknown) {
  const type = String(value || "").toUpperCase();
  if (type === "JOB") return "bg-blue-100 text-blue-800";
  if (type === "QUOTATION") return "bg-emerald-100 text-emerald-800";
  if (type === "RFQ") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-800";
}

function modeLabel(value: unknown) {
  const mode = String(value || "").toUpperCase();
  if (mode === "A" || mode.includes("AIR")) return "Air";
  if (mode === "S" || mode.includes("SEA")) return "Sea";
  if (mode === "R" || mode === "L" || mode.includes("ROAD") || mode.includes("LAND")) return "Land";
  return text(value);
}

function jobTypeLabel(value: unknown) {
  const jobType = String(value || "").toUpperCase();
  if (jobType === "IMP" || jobType.includes("IMPORT")) return "Import";
  if (jobType === "EXP" || jobType.includes("EXPORT")) return "Export";
  if (jobType === "IRE" || jobType.includes("REEXPORT") || jobType.includes("RE-EXPORT")) return "Re-export";
  return text(value);
}

export type { FreightWorkspaceTarget };
