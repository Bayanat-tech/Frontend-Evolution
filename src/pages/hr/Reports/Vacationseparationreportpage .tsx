"use client";

import React, { useCallback, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { useAuth } from "../../../state/AuthContext";


import { NewReportDialog } from "../../../components/new_report_format";
import { getVacationSeparationReportExcelDownload, getVacationSeparationReportHtml } from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = "VACATION" | "SEPARATION";

interface Params {
  reportType: ReportType;
  payMonth: number;
  payYear: number;
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }));

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VacationSeparationReportPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  const now = new Date();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>("VACATION");
  const [payMonth, setPayMonth] = useState<string>(String(now.getMonth() + 1));
  const [payYear, setPayYear] = useState<string>(String(now.getFullYear()));

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Select Pay Month / Pay Year and run the report.");

  const lastParamsRef = useRef<Params | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const yearNum = Number(payYear);
  const monthNum = Number(payMonth);
  const inputValid =
    monthNum >= 1 && monthNum <= 12 && Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2200;

  const reportTitle = reportType === "VACATION" ? "Vacation Report" : "Separation Report";

  const buildPayload = (p: Params) => ({
    parameter: "Hr_Report_VACATION_SEPARATION_REPORT",
    loginid: loginId,
    code1: companyCode,
    code2: p.reportType, // VACATION | SEPARATION
    number1: p.payMonth, // :vl_paymonth
    number2: p.payYear, // :vl_payyear
  });

  // ── Fetch report HTML → NewReportDialog ───────────────────────────────────
  const fetchReport = useCallback(
    async (p: Params) => {
      setLoading(true);
      setError("");
      setMessage("");
      lastParamsRef.current = p;

      setReportHtml(null);
      setPreviewOpen(true);

      try {
        const html = await getVacationSeparationReportHtml(buildPayload(p));
        setReportHtml(html);
        setMessage("Report generated successfully.");
      } catch (err: any) {
        const msg = err?.message ?? "Failed to load report. Please try again.";
        setError(msg);
        setMessage(msg);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loginId, companyCode]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!inputValid) return;
    fetchReport({ reportType, payMonth: monthNum, payYear: yearNum });
  };

  const handleClearAll = () => {
    setReportType("VACATION");
    setPayMonth(String(now.getMonth() + 1));
    setPayYear(String(now.getFullYear()));
    setError("");
    setMessage("Select Pay Month / Pay Year and run the report.");
  };

  const handleExcel = async () => {
  if (!lastParamsRef.current) return;
  setExporting(true);
  try {
    await getVacationSeparationReportExcelDownload(buildPayload(lastParamsRef.current));
  } catch (err) {
    console.error("Excel export error:", err);
  } finally {
    setExporting(false);
  }
};

  const handleOpenInNewWindow = () => {
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

  const handleDownloadPdf = () => {
    if (!reportHtml) return;
    const PRINT_IFRAME_ID = "vacation-separation-print-iframe";
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-modals");
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

  const closePreview = () => {
    setPreviewOpen(false);
    setReportHtml(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>HR Reports - Vacation / Separation Details</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={handleClearAll} />

        {/* Row 1: Pay Month / Pay Year */}
        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Pay Month">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={payMonth}
              onChange={(e) => setPayMonth(e.target.value)}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pay Year">
            <input
              type="number"
              min={1900}
              max={2200}
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={payYear}
              onChange={(e) => setPayYear(e.target.value)}
            />
          </Field>
        </div>

        {/* Row 2: Vacation / Separation */}
        <div className="freight-report-fields flex flex-wrap items-center gap-6 px-3 pb-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="vacation-separation-type"
              checked={reportType === "VACATION"}
              onChange={() => setReportType("VACATION")}
            />
            Vacation
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="vacation-separation-type"
              checked={reportType === "SEPARATION"}
              onChange={() => setReportType("SEPARATION")}
            />
            Separation
          </label>
        </div>

        {!inputValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            Enter a valid Pay Month and Pay Year.
          </p>
        )}

        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !inputValid}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{" "}
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
        {error && !previewOpen ? <p className="px-3 pb-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <NewReportDialog
        open={previewOpen}
        onClose={closePreview}
        title={reportTitle}
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        meta={{
          companyName: companyCode,
          user: loginId,
          period: `${MONTHS[monthNum - 1] ?? ""} ${payYear}`,
          generatedAt: new Date().toLocaleString(),
        }}
        onExportExcel={handleExcel}
        exportingExcel={exporting}
        onOpenInNewWindow={handleOpenInNewWindow}
        onDownloadPdf={handleDownloadPdf}
      />
    </section>
  );
}