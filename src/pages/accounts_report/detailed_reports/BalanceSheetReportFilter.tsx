import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

import { useAuth } from "../../../state/AuthContext";
import { api } from "../../../api/client";
import { getBalanceSheetReportHtml, getBalanceSheetReportExcelDownload } from "../../../api/transactions";
import { getDynamicLookup } from "../../../api/lookups";
import { NewReportPage } from "../../../components/new_report_format/NewReportPage";
import { NewReportDialog } from "../../../components/new_report_format";
import type { ReportFieldConfig, ReportOption } from "../../../components/new_report_format/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Division = { div_code: string; div_name: string };

type DrillLevel = "ac" | "detail";

const DRILL_ENDPOINTS: Record<DrillLevel, string> = {
  ac:     "api/finance/transactions/report/balancesheet/drilldown/ac",
  detail: "api/finance/transactions/report/balancesheet/drilldown/detail",
};

const DRILL_EXCEL_ENDPOINTS: Record<DrillLevel, string> = {
  ac:     "api/finance/transactions/report/balancesheet/drilldown/ac/excel",
  detail: "api/finance/transactions/report/balancesheet/drilldown/detail/excel",
};

const DRILL_TITLES: Record<DrillLevel, string> = {
  ac:     "Account Breakdown",
  detail: "Transaction Detail",
};

interface DrillEntry {
  id:      number;
  level:   DrillLevel;
  label:   string;
  html:    string;
  payload: Record<string, unknown>;
}

interface Params {
  as_on_date:    string;
  division_code: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const DEFAULT_PARAMS: Params = {
  as_on_date:    getToday(),
  division_code: "",
};

// ─── Drill breadcrumb bar (same pattern as TrialBalancePage) ─────────────────

interface DrillBreadcrumbProps {
  stack:      DrillEntry[];
  onNavigate: (index: number) => void;
}

function DrillBreadcrumb({ stack, onNavigate }: DrillBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-4 py-1.5 text-[10px]">
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 text-primary/80 hover:text-primary font-medium"
      >
        <ChevronLeft size={11} /> Balance Sheet
      </button>
      {stack.map((entry, i) => (
        <span key={entry.id} className="flex items-center gap-1">
          <span className="text-muted-foreground">/</span>
          <button
            type="button"
            onClick={() => onNavigate(i)}
            className={[
              "font-medium",
              i === stack.length - 1
                ? "text-foreground cursor-default"
                : "text-primary/80 hover:text-primary",
            ].join(" ")}
          >
            {entry.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisions, setDivisions]               = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportHtml,    setReportHtml]    = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // ── Drill-down state ───────────────────────────────────────────────────────
  const [drillStack, setDrillStack]     = useState<DrillEntry[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError]     = useState<string | null>(null);
  const drillIdCounter                  = useRef(0);

  // ── Listen for DRILL_DOWN messages posted by report iframes ───────────────
  // Works with NewReportDialog page iframes (sandbox: allow-scripts allow-same-origin)
  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      if (!ev.data || ev.data.type !== "DRILL_DOWN") return;

      const {
        drillLevel,
        company_code,
        as_on_date,
        division_code,
        code,
        codeField,
      } = ev.data as {
        drillLevel:    DrillLevel;
        company_code:  string;
        as_on_date:    string;
        division_code: string;
        code:          string;
        codeField:     string;
      };

      const endpoint = DRILL_ENDPOINTS[drillLevel];
      if (!endpoint) return;

      const payload: Record<string, unknown> = {
        company_code,
        as_on_date,
        division_code,
        [codeField]: [code],
      };

      setDrillLoading(true);
      setDrillError(null);

      try {
        const { data } = await api.post<string>(endpoint, payload, {
          headers:      { Accept: "text/html" },
          responseType: "text",
        });

        const entry: DrillEntry = {
          id:      ++drillIdCounter.current,
          level:   drillLevel,
          label:   `${DRILL_TITLES[drillLevel]} · ${code}`,
          html:    data,
          payload,
        };

        setDrillStack(prev => [...prev, entry]);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          err?.message ||
          "Failed to load drill-down";
        setDrillError(String(msg));
      } finally {
        setDrillLoading(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Fetch divisions ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setDivisionsLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: "Account_division",
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setDivisions(res as Division[]);
      } catch {
        setDivisions([]);
      } finally {
        setDivisionsLoading(false);
      }
    };
    fetch();
  }, [user]);

  const divisionOptions: ReportOption[] = divisions.map((d) => ({
    value: d.div_code,
    label: `${d.div_code} | ${d.div_name}`,
  }));

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setParam = (key: string, val: any) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setReportHtml(null);
    setReportError(null);
    setDrillStack([]);
    setDrillError(null);
  };

  const buildPayload = useCallback(() => ({
    parameter:     "Account_Report_BalanceSheet",
    company_code:  user?.company_code ?? "",
    division_code: params.division_code || "All",
    as_on_date:    params.as_on_date,
    loginid:       user?.loginid ?? "ADMIN",
  }), [user, params.division_code, params.as_on_date]);

  const handleGenerateReport = async () => {
    if (!params.as_on_date) {
      setReportError("Please select an As On Date before generating.");
      return;
    }

    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);

    try {
      const data = await getBalanceSheetReportHtml(buildPayload());
      setReportHtml(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to generate report";
      setReportError(String(msg));
    } finally {
      setReportLoading(false);
    }
  };

  const handleExcel = async () => {
    setExportingExcel(true);
    try {
      await getBalanceSheetReportExcelDownload(buildPayload());
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to download Excel";
      setReportError(String(msg));
    } finally {
      setExportingExcel(false);
    }
  };

  // ── Excel download for whichever drill level is currently visible ─────────
  const handleDrillExcel = async () => {
    const topDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
    if (!topDrill) return;
    const endpoint = DRILL_EXCEL_ENDPOINTS[topDrill.level];
    setExportingExcel(true);
    try {
      const response = await api.post(endpoint, topDrill.payload, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `${topDrill.label.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to download Excel";
      setDrillError(String(msg));
    } finally {
      setExportingExcel(false);
    }
  };

  const handleCloseReport = () => {
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);
  };

  /**
   * Navigate the drill breadcrumb:
   *   index === -1  → back to main report (clear drill stack)
   *   index ===  n  → truncate stack to [0..n]
   */
  const handleDrillNavigate = (index: number) => {
    if (index === -1) {
      setDrillStack([]);
    } else {
      setDrillStack(prev => prev.slice(0, index + 1));
    }
    setDrillError(null);
  };

  const pageTitle = "Balance Sheet";

  const fields: ReportFieldConfig[] = [
    {
      key: "as_on_date",
      label: "As On Date",
      type: "date",
      required: true,
    },
    {
      key: "division_code",
      label: "Division",
      type: "select",
      options: divisionOptions,
      loading: divisionsLoading,
      placeholder: "All Divisions",
    },
  ];

  // ── Derive what to show inside NewReportDialog ─────────────────────────────
  const topDrill    = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
  const dialogTitle = topDrill ? topDrill.label : pageTitle;
  const dialogHtml  = topDrill ? topDrill.html : reportHtml;
  const dialogOpen  = reportHtml !== null;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <NewReportPage
        title={pageTitle}
        fields={fields}
        values={params}
        onChange={setParam}
        onClearAll={handleReset}
        onGenerate={handleGenerateReport}
        loading={reportLoading}
        optionsLoading={divisionsLoading}
        error={reportError}
        onClearError={() => setReportError(null)}
        fieldsPerRow={3}
      >
        {reportHtml !== null && (
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                fontSize: 12,
                color: "#065f46",
                background: "#d1fae5",
                padding: "3px 10px",
                borderRadius: 12,
                fontWeight: 500,
              }}
            >
              Report generated successfully
            </span>
          </div>
        )}
      </NewReportPage>

      {/* ── New Report Dialog (with drill support via headerSlot) ── */}
      <NewReportDialog
        open={dialogOpen}
        onClose={handleCloseReport}
        title={dialogTitle}
        htmlContent={dialogHtml}
        loading={drillLoading}
        error={drillError}
        onExportExcel={topDrill ? handleDrillExcel : handleExcel}
        exportingExcel={exportingExcel}
        headerSlot={
          (drillLoading || drillError || drillStack.length > 0) ? (
            <div className="flex flex-col gap-0">
              {drillLoading && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-border text-[10px] text-primary">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading drill-down…
                </div>
              )}

              {drillError && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-destructive/10 border-b border-destructive/20 text-[10px] text-destructive">
                  <span className="font-semibold">Drill-down error:</span> {drillError}
                  <button type="button" onClick={() => setDrillError(null)} className="ml-auto">
                    <X size={11} />
                  </button>
                </div>
              )}

              {drillStack.length > 0 && (
                <div className="border-b border-border bg-muted/20">
                  <DrillBreadcrumb stack={drillStack} onNavigate={handleDrillNavigate} />
                </div>
              )}
            </div>
          ) : undefined
        }
      />
    </>
  );
}