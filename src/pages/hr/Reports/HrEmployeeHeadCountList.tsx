// src/pages/hr/Reports/HrEmployeeHeadCountList.tsx
//
// HR Employee Head Count List Report — full-width page matching the
// HR Retirement Report layout.
//
// Filters:
//   • From Date / To Date  (both required)
//   • Report Mode (radio, 6 options)
//
// Report modes:
//   1. Division wise Head count summary
//   2. Department wise Head count summary
//   3. Nationality wise Head count summary
//   4. Local/Expat Head count summary
//   5. Budgeted Plan Variance
//   6. ManPower Department wise
//
// The `report_mode` query-string value is one of the keys defined in
// REPORT_MODES below. The backend maps each key to the corresponding
// SQL / proc branch.

import React, {
  useCallback,
  useImperativeHandle,
  useState,
  forwardRef,
} from "react";
import { CalendarDays, Filter, Layers } from "lucide-react";
import { api } from "../../../api/client";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";

/* ✅ Expose run()/print() to the parent (header buttons) */
export type HrEmployeeHeadCountListHandle = {
  run: () => Promise<void>;
  print: () => void;
};

type Props = {
  onClose?: (shouldRefetch?: boolean) => void;
};

/* ───────────────────────── constants ───────────────────────── */

const PRINT_IFRAME_ID = "hr-employee-head-count-list-print-iframe";
const REPORT_TITLE = "HR Employee Head Count List";
const HEAD_COUNT_REPORT_URL = "/api/wms/reports/hr/employee-head-count/html";

/**
 * Report modes — order matches the UI. Each `key` is sent as `report_mode`
 * on the query string. Adjust keys if your backend uses different tokens.
 */
const REPORT_MODES = [
  { key: "DIVISION_WISE", label: "Division wise Head count summary" },
  { key: "DEPARTMENT_WISE", label: "Department wise Head count summary" },
  { key: "NATIONALITY_WISE", label: "Nationality wise Head count summary" },
  { key: "LOCAL_EXPAT", label: "Local/Expat Head count summary" },
  { key: "BUDGETED_VARIANCE", label: "Budgeted Plan Variance" },
  { key: "MANPOWER_DEPT", label: "ManPower Department wise" },
] as const;

type ReportModeKey = (typeof REPORT_MODES)[number]["key"];

/* ───────────────────────── helpers ───────────────────────── */

const firstOfYear = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
};

const lastOfYear = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-12-31`;
};

const fmtDisplayDate = (v: string): string => {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-GB"); // dd/mm/yyyy
  } catch {
    return v;
  }
};

/* ───────────────────────── shared styles ───────────────────────── */

function FloatLabel({
  label,
  required,
  children,
  bgColor = "#fff",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  bgColor?: string;
}) {
  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <span
        style={{
          position: "absolute",
          top: -8,
          left: 10,
          fontSize: 11,
          color: "#6b7280",
          background: bgColor,
          padding: "0 4px",
          zIndex: 1,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
      >
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {children}
    </div>
  );
}

function SummaryStripItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2 shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={14} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">
          {label}
        </div>
        <div className="truncate text-[12.5px] font-semibold text-slate-800" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────────────────────── */
export const HrEmployeeHeadCountList = forwardRef<
  HrEmployeeHeadCountListHandle,
  Props
>(function HrEmployeeHeadCountList(_props, ref) {
  const { user } = useAuth() as any;
  const loginid: string =
    user?.loginId ?? user?.loginid ?? user?.userId ?? user?.username ?? "";
  const companyCode: string = user?.companyCode ?? user?.company_code ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");

  // ── Filter state ─────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState<string>(firstOfYear());
  const [toDate, setToDate] = useState<string>(lastOfYear());
  const [reportMode, setReportMode] = useState<ReportModeKey>("DIVISION_WISE");

  // ── Build payload for the report endpoint ────────────────────────────────
  const buildReportQuery = () => ({
    company_code: companyCode || "All",
    from_date: fromDate || "",
    to_date: toDate || "",
    report_mode: reportMode,
    print: "false",
  });

  // ── Report fetch ─────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setLoading(true);
    setError("");

    try {
      const payload = buildReportQuery();
      const qs = new URLSearchParams(payload as any).toString();
      const res = await api.get(`${HEAD_COUNT_REPORT_URL}?${qs}`, {
        responseType: "text",
      });
      setReportHtml(res.data);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? "Failed to load report. Please try again.";
      setReportPreviewError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, fromDate, toDate, reportMode]);

  const closeReportPreview = () => {
    setReportPreviewOpen(false);
    setReportHtml(null);
    setReportPreviewError("");
  };

  const handleOpenReportInNewWindow = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } else {
      window.URL.revokeObjectURL(url);
    }
  };

  const handleDownloadReportPdf = () => {
    if (!reportHtml) return;
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute(
        "sandbox",
        "allow-same-origin allow-scripts allow-modals",
      );
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    const doPrint = () => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        /* ignore */
      }
    };

    if (iframe.contentDocument?.readyState === "complete") {
      setTimeout(doPrint, 300);
    } else {
      iframe.onload = () => setTimeout(doPrint, 300);
      setTimeout(doPrint, 700);
    }
  };

  const validate = (): string | null => {
    if (!companyCode) return "Company is required";
    if (!fromDate) return "'From Date' is required";
    if (!toDate) return "'To Date' is required";
    if (new Date(fromDate) > new Date(toDate))
      return "'From Date' cannot be greater than 'To Date'";
    return null;
  };

  const handleRun = useCallback(async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    await fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, reportMode, fetchReport]);

  const handlePrint = useCallback(() => {
    void handleRun();
  }, [handleRun]);

  useImperativeHandle(ref, () => ({
    run: handleRun,
    print: handlePrint,
  }));

  const handleReset = () => {
    setFromDate(firstOfYear());
    setToDate(lastOfYear());
    setReportMode("DIVISION_WISE");
    setError("");
  };

  const BG = "#EEF5FD";
  const activeModeLabel =
    REPORT_MODES.find((m) => m.key === reportMode)?.label ?? "—";

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <section
      className="freight-ui-standard freight-report-screen"
      style={{ width: "100%" }}
    >
      <div className="freight-report-card" style={{ width: "100%" }}>
        <style>{`
          .action-btn-primary:hover { background: #1e40af !important; }
          .field-row { background: ${BG}; border-radius: 8px; padding: 10px 12px; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

          .hcl-radio {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 13px;
            line-height: 1.3;
            color: #1f2937;
            cursor: pointer;
            padding: 4px 6px;
            border-radius: 4px;
            transition: background 0.12s ease;
            min-width: 0;
          }
          .hcl-radio:hover { background: rgba(30, 64, 175, 0.06); }
          .hcl-radio input[type="radio"] {
            width: 15px;
            height: 15px;
            flex-shrink: 0;
            margin: 1px 0 0 0;
            accent-color: #1e40af;
            cursor: pointer;
          }

          /* Only stack to 1 column on very narrow screens */
          @media (max-width: 640px) {
            .hcl-mode-grid {
              grid-template-columns: minmax(0, 1fr) !important;
              grid-template-rows: none !important;
              grid-auto-flow: row !important;
            }
          }
        `}</style>

        {/* Title bar */}
        <div className="freight-report-titlebar">
          <h1>HR Employee Head Count List</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
          <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
            <div className="rounded-md border bg-muted/40 px-3 py-1.5 text-foreground">
              <div className="text-[9px] font-semibold uppercase text-muted-foreground">
                Filters
              </div>
              <div className="text-[12px] font-semibold">Ready</div>
            </div>
          </div>
        </div>

        <ReportFilterHeader onClear={handleReset} label="Report Filters" />

        {/* Summary strip */}
        <div className="freight-report-summary grid grid-cols-3 gap-2 border-b bg-muted/10 p-3">
          <SummaryStripItem
            icon={CalendarDays}
            label="From Date"
            value={fmtDisplayDate(fromDate)}
          />
          <SummaryStripItem
            icon={CalendarDays}
            label="To Date"
            value={fmtDisplayDate(toDate)}
          />
          <SummaryStripItem
            icon={Layers}
            label="Report Mode"
            value={activeModeLabel}
          />
        </div>

        {/* Errors */}
        {error && (
          <div
            style={{
              margin: "10px 12px",
              padding: "8px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              color: "#dc2626",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            {error}
            <button
              onClick={() => setError("")}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "#dc2626",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Field rows */}
        <div style={{ padding: "0 12px" }}>
          {/* Row 1: From Date / To Date */}
          <div
            className="field-row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 6,
              width: "100%",
              alignItems: "end",
            }}
          >
            <FloatLabel label="From Date" required bgColor={BG}>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </FloatLabel>

            <FloatLabel label="To Date" required bgColor={BG}>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </FloatLabel>

            <div />
            <div />
          </div>

          {/* Row 2: Report Mode radios — 3 columns, top-to-bottom per column */}
          <div className="field-row" style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              Report Mode
            </div>

            <div
              className="hcl-mode-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gridTemplateRows: "repeat(2, auto)",
                gridAutoFlow: "column",
                gap: "2px 16px",
                alignItems: "start",
              }}
            >
              {REPORT_MODES.map((mode) => (
                <label key={mode.key} className="hcl-radio">
                  <input
                    type="radio"
                    name="head_count_report_mode"
                    value={mode.key}
                    checked={reportMode === mode.key}
                    onChange={() => setReportMode(mode.key)}
                  />
                  <span>{mode.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="freight-report-actions">
          <Button
            className="action-btn-primary"
            size="sm"
            onClick={() => void handleRun()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    marginRight: 6,
                  }}
                />
                Generating…
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </div>
      </div>

      {/* Report preview dialog */}
      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title={REPORT_TITLE}
        htmlContent={reportHtml}
        loading={loading}
        error={reportPreviewError || null}
        onOpenInNewWindow={handleOpenReportInNewWindow}
        onDownloadPdf={handleDownloadReportPdf}
      />
    </section>
  );
});

export default HrEmployeeHeadCountList;