import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart2, ChevronLeft, Eye, Loader2, RefreshCw, X } from "lucide-react";

import { useAuth } from "../../../state/AuthContext";
import { api } from "../../../api/client";
import { getBalanceSheetReportHtml, getBalanceSheetReportExcelDownload } from "../../../api/transactions";
import { getDynamicLookup } from "../../../api/lookups";
import { closeFinanceReportPreview, openFinanceReport } from "../../../components/finance/reports/financeReportPreviewStore";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

// ─── Small presentational helpers (mirroring the Freight report layout) ──

const BG = "#EEF5FD";
const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 12,
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function FloatLabel({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ position: "relative", marginTop: 6, display: "block" }}>
      <span style={{ position: "absolute", top: -8, left: 10, zIndex: 1, padding: "0 4px", background: BG, color: "#6b7280", fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Iframe renderer ──────────────────────────────────────────────────────────
// Used for the main report AND every drill-down level. Scripts injected into
// HTML only execute inside a real iframe (not via dangerouslySetInnerHTML),
// so a single renderer keeps postMessage drill-down clicks working everywhere.

function IframeReportRenderer({
  required_values,
}: {
  required_values: { html: string };
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const win = iframe.contentWindow as any;

    let originalPrint: (() => void) | undefined;
    if (win) {
      originalPrint = win.print;
      win.print = () => {};
    }

    doc.open();
    doc.write(required_values.html);
    doc.close();

    const restorePrint = () => {
      if (win && originalPrint) win.print = originalPrint;
    };
    if (doc.readyState === "complete") {
      restorePrint();
    } else {
      iframe.addEventListener("load", restorePrint, { once: true });
    }
  }, [required_values.html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", minHeight: "70vh", border: "none" }}
      title="report"
    />
  );
}

// ─── Drill breadcrumb bar ─────────────────────────────────────────────────────

interface DrillBreadcrumbProps {
  stack:      DrillEntry[];
  onNavigate: (index: number) => void;
}

function DrillBreadcrumb({ stack, onNavigate }: DrillBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-1 py-1.5 text-[10px]">
      <button
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 text-primary/80 hover:text-primary font-medium"
      >
        <ChevronLeft size={11} /> Balance Sheet
      </button>
      {stack.map((entry, i) => (
        <span key={entry.id} className="flex items-center gap-1">
          <span className="text-muted-foreground">/</span>
          <button
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

// ─── Transition overlay ────────────────────────────────────────────────────────
// Shown for the moment between the old report being removed and the next one
// being ready to display, so a fetch delay never looks like a frozen/broken dialog.

function ViewTransitionOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="flex items-center gap-2 rounded-md bg-white px-4 py-3 text-[12px] text-muted-foreground shadow-lg">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        {label}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [asOnDate,      setAsOnDate]      = useState<string>(getToday());
  const [divisionCode,  setDivisionCode]  = useState<string>("");

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisions,        setDivisions]        = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportHtml,    setReportHtml]    = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState<string | null>(null);

  // ── Drill-down state ───────────────────────────────────────────────────────
  const [drillStack, setDrillStack]     = useState<DrillEntry[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError]     = useState<string | null>(null);
  const drillIdCounter                  = useRef(0);

  // ── View transition lifecycle ──────────────────────────────────────────────
  // A view is only ever shown once fully ready. Generating a new report,
  // drilling into a row, or navigating the breadcrumb always removes
  // whatever's currently displayed FIRST (dialogVisible → false), and only
  // shows the next report once it's ready (dialogVisible → true). The dialog
  // never silently swaps its content while staying mounted.
  const [dialogVisible, setDialogVisible] = useState(false);

  // Guards against a stale async response — a generate/drill call the user
  // has since navigated away from — reopening a view it no longer owns.
  const viewSeq = useRef(0);

  // ── Listen for DRILL_DOWN messages posted by report iframes ───────────────
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

      const id = ++viewSeq.current;
      setDrillLoading(true);
      setDrillError(null);
      const preview = openFinanceReport(`${DRILL_TITLES[drillLevel]} · ${code}`);

      try {
        const { data } = await api.post<string>(endpoint, payload, {
          headers:      { Accept: "text/html" },
          responseType: "text",
        });

        if (id !== viewSeq.current) return; // superseded while this was in flight

        const entry: DrillEntry = {
          id:      ++drillIdCounter.current,
          level:   drillLevel,
          label:   `${DRILL_TITLES[drillLevel]} · ${code}`,
          html:    data,
          payload,
        };

        setDrillStack(prev => [...prev, entry]);
        preview.ready({
          html: data,
          filename: `${DRILL_TITLES[drillLevel]}_${code}`,
          orientation: "landscape",
          excelEndpoint: DRILL_EXCEL_ENDPOINTS[drillLevel],
          excelPayload: payload,
        });
        setDialogVisible(true);
      } catch (err: any) {
        if (id !== viewSeq.current) return; // superseded — don't resurrect a stale error
        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          err?.message ||
          "Failed to load drill-down";
        setDrillError(String(msg));
        preview.fail(String(msg));
        setDialogVisible(true);
      } finally {
        if (id === viewSeq.current) setDrillLoading(false);
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReset = () => {
    ++viewSeq.current; // invalidate anything still in flight
    closeFinanceReportPreview();
    setAsOnDate(getToday());
    setDivisionCode("");
    setDialogVisible(false);
    setReportHtml(null);
    setReportError(null);
    setDrillStack([]);
    setDrillError(null);
  };

  const buildPayload = useCallback(() => ({
    parameter:    "Account_Report_BalanceSheet",
    company_code: user?.company_code ?? "",
    division_code: divisionCode || "All",
    as_on_date:   asOnDate,
    loginid:      user?.loginid ?? "ADMIN",
  }), [user, divisionCode, asOnDate]);

  const handleGenerateReport = async () => {
    if (!asOnDate) {
      setReportError("Please select an As On Date before generating.");
      return;
    }

    const id = ++viewSeq.current;
    setReportLoading(true);
    setReportError(null);
    const preview = openFinanceReport(pageTitle);
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);

    try {
      const data = await getBalanceSheetReportHtml(buildPayload());
      if (id !== viewSeq.current) return; // superseded — don't reopen a stale view
      setReportHtml(data);
      preview.ready({
        html: data,
        filename: pageTitle,
        orientation: "landscape",
        excelEndpoint: "/api/finance/transactions/report/balancesheet/excel",
        excelPayload: buildPayload(),
      });
      setDialogVisible(true);
    } catch (err: any) {
      if (id !== viewSeq.current) return;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to generate report";
      setReportError(String(msg));
      preview.fail(String(msg));
    } finally {
      if (id === viewSeq.current) setReportLoading(false);
    }
  };

  const handleExcel = async () => {
    try {
      await getBalanceSheetReportExcelDownload(buildPayload());
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to download Excel";
      setReportError(String(msg));
    }
  };

  // ── Excel download for whichever drill level is currently visible ─────────
  const handleDrillExcel = async () => {
    const topDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
    if (!topDrill) return;
    const endpoint = DRILL_EXCEL_ENDPOINTS[topDrill.level];
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
    }
  };

  const handleCloseReport = () => {
    ++viewSeq.current; // invalidate anything still in flight
    closeFinanceReportPreview();
    setDialogVisible(false);
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);
  };

  /**
   * Navigate the drill breadcrumb:
   *   index === -1  → back to main report (clear drill stack)
   *   index ===  n  → truncate stack to [0..n]
   *
   * The target content is already cached, but navigation still removes the
   * currently shown report before showing the target one, for the same
   * "one report visible at a time" behavior as generate/drill-down.
   */
  const handleDrillNavigate = (index: number) => {
    const id = ++viewSeq.current; // invalidate any in-flight drill fetch
    setDialogVisible(false); // remove the currently shown report
    if (index === -1) {
      setDrillStack([]);
    } else {
      setDrillStack(prev => prev.slice(0, index + 1));
    }
    setDrillError(null);
    requestAnimationFrame(() => {
      if (id === viewSeq.current) setDialogVisible(true); // show the target report
    });
  };

  const canGenerate = Boolean(asOnDate);
  const hasGenerated = reportHtml !== null;
  const pageTitle   = "Balance Sheet";

  // ── Derive what to show inside ReportDialogPage ────────────────────────────
  const topDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="balance-sheet-report-screen" style={{ minHeight: "100vh", padding: "6px 10px", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={17} color="#185FA5" />
                <h1 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{pageTitle}</h1>
                {hasGenerated && <span style={{ fontSize: 10, background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: 12, fontWeight: 500 }}>Report Generated</span>}
              </div>
            </div>

            {reportError && (
              <div style={{ marginBottom: 10, padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{reportError}</span>
                <button type="button" onClick={() => setReportError(null)} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}><X size={12} /></button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: BG, borderRadius: 8, padding: "10px 12px" }}>
                <FloatLabel label="As On Date" required>
                  <input type="date" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} style={inputBaseStyle} />
                </FloatLabel>
                <FloatLabel label="Division">
                  <select value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} disabled={divisionsLoading} style={{ ...inputBaseStyle, cursor: "pointer", opacity: divisionsLoading ? 0.6 : 1 }}>
                    <option value="">All Divisions</option>
                    {divisions.map((d) => <option key={d.div_code} value={d.div_code}>{d.div_code} | {d.div_name}</option>)}
                  </select>
                </FloatLabel>
              </div>
            </div>

            {hasGenerated && (
              <div style={{ marginTop: 10, padding: "8px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, color: "#065f46", fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 16 }}>✓</span> Report generated successfully</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
              <button type="button" onClick={handleReset} disabled={reportLoading} style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: reportLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#111827" }}>
                <RefreshCw size={13} /> Reset
              </button>
              <button type="button" onClick={handleGenerateReport} disabled={!canGenerate || reportLoading} style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: reportLoading ? "#94a3b8" : "#185FA5", cursor: reportLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff" }}>
                {reportLoading ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} {reportLoading ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>

        {/* Empty state placeholder while no report is generated */}
        {reportHtml === null && !reportLoading && (
          <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-xl border bg-white p-10 text-[13px] text-muted-foreground shadow-sm select-none">
            Set the parameters above and click&nbsp;
            <strong className="font-semibold text-foreground ml-1">Generate Report</strong>
          </div>
        )}

        {/* Loading placeholder */}
        {reportLoading && (
          <div className="mt-4 flex min-h-[220px] items-center justify-center gap-2 rounded-xl border bg-white p-10 text-[13px] text-muted-foreground shadow-sm">
            <Loader2 size={16} className="animate-spin" />
            Generating report…
          </div>
        )}

        </div>
      </section>

      {/* Transition overlay: shown for the moment between the old report
          being removed and the next one being ready (drill-down / breadcrumb) */}
      {reportHtml !== null && !dialogVisible && drillLoading && (
        <ViewTransitionOverlay label="Loading drill-down…" />
      )}

    </>
  );
}