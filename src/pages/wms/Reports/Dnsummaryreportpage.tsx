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
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount } from "../../../api/lookups";
import {
  getDnSummaryReportHtml,
  getDnSummaryReportExcelDownload,
} from "../../../api/transactions";

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
  const [previewUrl, setPreviewUrl] = useState("");
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const dateRangeValid =
    !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

  // ── Fetch report HTML → inline blob URL for the dialog iframe ───────────
  const fetchReport = useCallback(
    async (p: Params) => {
      setLoading(true);
      setError("");
      setMessage("");
      lastParamsRef.current = p;

      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
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
    [loginId, companyCode, previewUrl]
  );

  // ── Keep blob URL in sync with reportHtml ───────────────────────────────
  useEffect(() => {
    if (!previewOpen) return;
    if (loading) return;
    if (reportHtml === null || reportHtml === undefined) return;

    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) window.URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, reportHtml, loading]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  // Excel — only used by ReportPreviewDialog's internal Excel button
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

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewOpen(false);
    setPreviewUrl("");
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

      {/* ── Inline preview dialog (Print/Excel inside dialog only) ────── */}
      {previewOpen && (
        <ReportPreviewDialog
          title="DN Summary Report"
          pdfUrl={previewUrl}
          error={error || undefined}
          exporting={exporting}
          onExcel={handleExcel}
          onClose={closePreview}
          onDownload={() => {}}
          downloadName="dn_summary_report.html"
        />
      )}
    </section>
  );
}