import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  Compass,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
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
    <section className="freight-control-center">
      {/* 1. Master Header Card */}
      <div className="freight-landing-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bisc-master-icon-box">
            <Compass size={22} className="text-[#00378C]" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-lg font-bold leading-tight text-slate-900">Freight Control Center</h1>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Refresh dashboard"
          onClick={loadWorkspace}
          className="h-8 w-8 rounded-lg border-[#cbd5e1] hover:bg-[#eff6ff] hover:text-[#00378C] text-slate-600 transition-colors cursor-pointer"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </Button>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className="freight-kpi-grid">
        <Metric icon={BriefcaseBusiness} label="Open Jobs" value={valueText(summary.OPEN_JOBS)} tone="blue" />
        <Metric icon={ClipboardList} label="Pending Enquiry" value={valueText(summary.PENDING_ENQUIRIES)} tone="amber" />
        <Metric icon={FileText} label="Active RFQ" value={valueText(summary.ACTIVE_RFQ)} tone="violet" />
        <Metric icon={FileSpreadsheet} label="Quotations" value={valueText(summary.ACTIVE_QUOTATIONS)} tone="emerald" />
      </div>

      {/* 3. Global Search & Data Shell */}
      <div className="freight-search-shell">
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
          className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] bg-slate-50/60 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void searchFreight(smartSearch);
          }}
        >
          <div className="relative flex-1 min-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              className="freight-control-search-input w-full"
              value={smartSearch}
              onChange={(event) => {
                const value = event.target.value;
                setSmartSearch(value);
                if (!value.trim()) void searchFreight("");
              }}
              placeholder="Search AI/00001/00008, RFQ no, quotation no, job no, HBL, house/BL number, principal..."
            />
            {smartSearch && (
              <button
                type="button"
                onClick={() => {
                  setSmartSearch("");
                  void searchFreight("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-[38px] px-5 bg-[#00378C] text-white hover:bg-[#002d72] font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[38px] w-[38px] rounded-lg border-[#cbd5e1] hover:bg-[#eff6ff] hover:text-[#00378C] cursor-pointer"
            title="Reset search"
            onClick={() => {
              setSmartSearch("");
              void searchFreight("");
            }}
          >
            <RefreshCw size={15} />
          </Button>
        </form>

        <div className="max-h-[calc(100vh-325px)] min-h-[220px] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th style={{ width: "95px" }}>Type</th>
                <th style={{ width: "160px" }}>Reference</th>
                <th style={{ width: "100px" }}>Date</th>
                <th>Principal</th>
                <th style={{ width: "180px" }}>Movement</th>
                <th style={{ width: "120px" }}>House / BL</th>
                <th style={{ width: "110px", textAlign: "center" }}>Status</th>
                <th style={{ width: "95px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 size={18} className="mx-auto mb-2 animate-spin text-[#00378C]" /> Searching freight records
                  </td>
                </tr>
              ) : smartRows.length ? (
                smartRows.slice(0, 25).map((row, index) => (
                  <tr key={`${row.RECORD_TYPE || "ROW"}-${row.RECORD_NO || index}`} className="transition-colors">
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold uppercase border ${getRecordTypeBadge(String(row.RECORD_TYPE || ""))}`}>
                        {text(row.RECORD_TYPE)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="font-bold text-[#00378C] hover:underline cursor-pointer text-left leading-tight block"
                        onClick={() => openSearchRow(row)}
                      >
                        {text(row.RECORD_NO)}
                      </button>
                      {text(row.SOURCE_REF) && (
                        <div className="text-[11px] font-medium text-slate-400 mt-0.5">{text(row.SOURCE_REF)}</div>
                      )}
                    </td>
                    <td className="text-slate-600 font-mono text-[11.5px] whitespace-nowrap">{formatDate(row.RECORD_DATE)}</td>
                    <td>
                      <div className="font-bold text-slate-900 leading-snug">{text(row.PRIN_NAME || row.PRIN_CODE)}</div>
                      {text(row.PRIN_CODE) && text(row.PRIN_NAME) && (
                        <div className="text-[11px] font-medium text-slate-400">{text(row.PRIN_CODE)}</div>
                      )}
                    </td>
                    <td>
                      <div className="font-bold text-slate-900 leading-snug">
                        {jobTypeLabel(row.JOB_TYPE)} / {modeLabel(row.TRANSPORT_MODE)}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">
                        {text(row.ORIGIN_PORT) || "—"} to {text(row.DESTINATION_PORT) || "—"}
                      </div>
                    </td>
                    <td className="text-slate-700 font-medium">{text(row.HOUSE_BL_NO) || "—"}</td>
                    <td className="text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(String(row.STATUS || ""))}`}>
                        {text(row.STATUS) || "Active"}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="freight-open-btn"
                        onClick={() => openSearchRow(row)}
                        title={`Open ${text(row.RECORD_NO)}`}
                      >
                        Open <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-slate-400 font-medium">
                    {message || "Search for an enquiry, RFQ, quotation, job, HBL, or principal."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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

function PanelHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#eff6ff] text-[#00378C] border border-[#dbeafe]">
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-[#00378C]">{title}</h2>
          <p className="m-0 truncate text-[11px] font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "blue" | "amber" | "violet" | "emerald";
}) {
  const toneConfig = {
    blue: { bg: "bg-[#eff6ff]", border: "border-[#bfdbfe]", text: "text-[#00378C]" },
    amber: { bg: "bg-[#fffbeb]", border: "border-[#fde68a]", text: "text-[#b45309]" },
    violet: { bg: "bg-[#f5f3ff]", border: "border-[#ddd6fe]", text: "text-[#6d28d9]" },
    emerald: { bg: "bg-[#ecfdf5]", border: "border-[#a7f3d0]", text: "text-[#047857]" },
  }[tone];

  return (
    <div className="freight-kpi-card">
      <span className={`freight-kpi-icon border ${toneConfig.bg} ${toneConfig.border} ${toneConfig.text}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate text-xl font-black text-slate-900 mt-0.5 leading-none">{value}</div>
      </div>
    </div>
  );
}

function ResultPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "amber" | "emerald";
}) {
  const toneClass = {
    blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#00378C]",
    amber: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
    emerald: "border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]",
  }[tone];

  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-bold uppercase ${toneClass}`}>
      {label}
      <strong className="text-xs leading-none">{value}</strong>
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

function getRecordTypeBadge(value: string) {
  const type = value.toUpperCase();
  if (type === "JOB") return "bg-[#eff6ff] text-[#00378C] border-[#bfdbfe]";
  if (type === "QUOTATION") return "bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]";
  if (type === "RFQ") return "bg-[#fffbeb] text-[#b45309] border-[#fde68a]";
  if (type === "ENQUIRY") return "bg-[#f3e8ff] text-[#7e22ce] border-[#e9d5ff]";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getStatusBadge(value: string) {
  const s = value.toLowerCase();
  if (s.includes("complete") || s.includes("approved")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (s.includes("confirm")) {
    return "bg-blue-50 text-[#00378C] border-blue-200";
  }
  if (s.includes("cancel")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (s.includes("draft") || s.includes("progress") || s.includes("pending")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
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

