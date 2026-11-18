"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { Button } from "../../../components/ui/Button";
import {
  MultiSelectField,
  type MultiSelectOption,
} from "../../../components/ui/MultiSelectField";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";

import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount } from "../../../api/lookups";
import {
  getDnSummaryReportHtml,
  getDnSummaryReportExcelDownload,
} from "../../../api/transactions";
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
  prin_code: string;
  from_date: string;
  to_date: string;
}

const ALL_PARAMS: Params = { prin_code: "All", from_date: "All", to_date: "All" };
const ALL_SENTINEL = "__ALL__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toApiDateString = (isoDate: string): string => {
  if (!isoDate) return "All";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

const toApiCodeString = (selected: string[]): string => {
  if (selected.length === 0) return "All";
  if (selected.includes(ALL_SENTINEL)) return "All";
  return selected.join(",");
};

const toDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "All";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

// ─── Field wrapper (same style as Freight) ────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DNSummaryReportPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Lookup: Principal ────────────────────────────────────────────────────
  const [principalOptions, setPrincipalOptions] = useState<MultiSelectOption[]>([]);
  const [principalLoading, setPrincipalLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPrincipalLoading(true);
      try {
        const rows = await getDynamicLookupaccount({
          parameter: "WMS_Stock_principal",
          loginid: loginId,
          code1: companyCode,
          code2: "",
          code3: "",
          code4: "",
          number1: 0,
          number2: 0,
          number3: 0,
          number4: 0,
          date1: null,
          date2: null,
          date3: null,
          date4: null,
        });
        if (!alive) return;
        setPrincipalOptions(
          (Array.isArray(rows) ? rows : [])
            .map((r: any) => {
              const code = String(r.prin_code ?? r.PRIN_CODE ?? "").trim();
              const name = String(r.prin_name ?? r.PRIN_NAME ?? "").trim();
              if (!code) return null;
              return {
                value: code,
                label: name ? `${code} - ${name}` : code,
              } as MultiSelectOption;
            })
            .filter(Boolean) as MultiSelectOption[]
        );
      } catch {
        if (alive) setPrincipalOptions([]);
      } finally {
        if (alive) setPrincipalLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loginId, companyCode]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState("Select filters and run the report.");

  // ── Filter values ────────────────────────────────────────────────────────
  const [principalCodes, setPrincipalCodes] = useState<string[]>([]);
  const [fromDateIso, setFromDateIso] = useState<string>("");
  const [toDateIso, setToDateIso] = useState<string>("");

  const lastParamsRef = useRef<Params>(ALL_PARAMS);

  // ── Inline preview dialog state (no new window) ─────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const dateRangeValid =
    !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

  // ── Fetch report HTML → fed straight into NewReportDialog ───────────────
  const fetchReport = useCallback(
    async (p: Params) => {
      setLoading(true);
      setError("");
      setMessage("");
      lastParamsRef.current = p;

      setReportHtml(null);
      setPreviewOpen(true);

      try {
        const html = await getDnSummaryReportHtml({
          parameter: "WMS_Stock_DN_Summary_Report",
          loginid: loginId,
          code1: companyCode,
          code2: p.prin_code,
          code3: p.from_date,
          code4: p.to_date,
        });

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
    [loginId, companyCode]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGenerateReport = () => {
    if (!dateRangeValid) return;
    fetchReport({
      prin_code: toApiCodeString(principalCodes),
      from_date: toApiDateString(fromDateIso),
      to_date: toApiDateString(toDateIso),
    });
  };

  const handleClearAll = () => {
    setPrincipalCodes([]);
    setFromDateIso("");
    setToDateIso("");
    setError("");
    setMessage("Select filters and run the report.");
  };

  // Excel export — wired to NewReportDialog's onExportExcel
  const handleExcel = async () => {
    setExporting(true);
    try {
      await getDnSummaryReportExcelDownload({
        parameter: "WMS_Stock_DN_Summary_Report",
        loginid: loginId,
        code1: companyCode,
        code2: lastParamsRef.current.prin_code,
        code3: lastParamsRef.current.from_date,
        code4: lastParamsRef.current.to_date,
      });
    } catch (err) {
      console.error("Excel export error:", err);
      setError("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Open report in a new browser tab
  const handleOpenInNewWindow = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    // Revoke after the new tab has had a chance to load it
    if (win) {
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } else {
      window.URL.revokeObjectURL(url);
    }
  };

  // Trigger browser print dialog (Save as PDF) for the current report
  const handleDownloadPdf = () => {
    if (!reportHtml) return;
    const PRINT_IFRAME_ID = "dn-summary-print-iframe";
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

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        {/* ── Title bar ─────────────────────────────────────────────────── */}
        <div className="freight-report-titlebar">
          <h1>DN Summary Report</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        {/* ── Report Filters header with Clear All ──────────────────────── */}
        <ReportFilterHeader onClear={handleClearAll} />

        {/* ── Filter fields ─────────────────────────────────────────────── */}
        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          <MultiSelectField
            className="freight-report-multi-select"
            label="Principal"
            options={principalOptions}
            loading={principalLoading}
            value={principalCodes}
            onChange={setPrincipalCodes}
          />

          <Field label="From Date">
            <BiscDatePicker
              value={fromDateIso}
              onChange={(value) => {
                if (!toDateIso || value <= toDateIso) setFromDateIso(value);
              }}
            />
          </Field>

          <Field label="To Date">
            <BiscDatePicker
              value={toDateIso}
              onChange={(value) => {
                if (!fromDateIso || value >= fromDateIso) setToDateIso(value);
              }}
            />
          </Field>
        </div>

        {/* ── Date validation warning ───────────────────────────────────── */}
        {!dateRangeValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            From date must be on or before To date.
          </p>
        )}

        {/* ── Actions bar (only Generate Report) ────────────────────────── */}
        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerateReport}
            disabled={loading || !dateRangeValid}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}{" "}
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        {/* ── Message ───────────────────────────────────────────────────── */}
        {message ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
        {error && !previewOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      {/* ── Report preview dialog (uses NewReportDialog + NewReportDialogProps) ── */}
      <NewReportDialog
        open={previewOpen}
        onClose={closePreview}
        title="DN Summary Report"
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        meta={{
          companyName: companyCode,
          user: loginId,
          principal:
            principalCodes.length > 0 ? toApiCodeString(principalCodes) : "All",
          period: `${toDisplayDate(fromDateIso)} - ${toDisplayDate(toDateIso)}`,
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