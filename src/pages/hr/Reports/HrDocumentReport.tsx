// src/pages/hr/Reports/HrDocumentReport.tsx
//
// HR Document Report — full-width page matching the HR Retirement Report layout.
//
// Filters (per the design):
//   • Division  → EDUCATION_QUALIFICATION_DIVISION_LIST  (code1 = company)
//   • Doc Type  → MST_HR_MS_HR_DOCTYPES                  (code1 = company)
//   • Date From / To  (expiry date range)
//   • Listing (checkbox)
//   • Cancelled Transactions (checkbox)
//
// Layout mirrors HrRetirementReport: 4-column grid rows, so inputs keep the
// same width as the Retirement page.

import React, {
  useCallback,
  useImperativeHandle,
  useState,
  forwardRef,
} from "react";
import {
  CalendarDays,
  Filter,
  FileText,
  Users,
} from "lucide-react";
import { api } from "../../../api/client";
import {
  DynamicQueryParams,
  getDynamicLookup,
  LookupRow,
} from "../../../api/lookups";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";

/* ✅ Expose run()/print() to the parent (header buttons) */
export type HrDocumentReportHandle = {
  run: () => Promise<void>;
  print: () => void;
};

type Props = {
  onClose?: (shouldRefetch?: boolean) => void;
};

/* ───────────────────────── constants ───────────────────────── */

const PRINT_IFRAME_ID = "hr-document-report-print-iframe";
const REPORT_TITLE = "HR Document Report";
const DOCUMENT_REPORT_URL = "/api/wms/reports/hr/document/html";

/* ── Dynamic-lookup parameter names (must match PROC_BUILD_DYNAMIC_SQL_MST_HR) ── */
const PARAM_DIVISION_LIST = "EDUCATION_QUALIFICATION_DIVISION_LIST";
const PARAM_DOC_TYPE_LIST = "MST_HR_MS_HR_DOCTYPES"; // ✅ switched to the HR doc-types proc branch

/* ───────────────────────── helpers ───────────────────────── */

const firstOfYear = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
};
const lastOfYear = (): string => {
  const now = new Date();
  return `${now.getFullYear() + 5}-12-31`;
};

const buildPayload = (
  parameter: string,
  loginid: string,
  extra: Partial<Omit<DynamicQueryParams, "parameter" | "loginid">> = {},
): DynamicQueryParams => ({ parameter, loginid, ...extra });

const matches = (rows: LookupRow[], q?: string) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)),
  );
};

const val = (row: LookupRow | null | undefined, ...keys: string[]): string => {
  if (!row) return "";
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
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

function CheckBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        userSelect: "none",
        fontSize: 12,
        color: "#1e293b",
        fontWeight: 500,
        padding: "6px 0",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, cursor: "pointer" }}
      />
      {label}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────────────────────── */
export const HrDocumentReport = forwardRef<HrDocumentReportHandle, Props>(
  function HrDocumentReport(_props, ref) {
    const { user } = useAuth() as any;
    const loginid: string =
      user?.loginId ?? user?.loginid ?? user?.userId ?? user?.username ?? "";
    const companyCode: string =
      user?.companyCode ?? user?.company_code ?? "";

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
    const [reportHtml, setReportHtml] = useState<string | null>(null);
    const [reportPreviewError, setReportPreviewError] = useState("");

    // ── Filter state ─────────────────────────────────────────────────────────
    const [listing, setListing] = useState(false);
    const [divCode, setDivCode] = useState("");
    const [divDisplay, setDivDisplay] = useState("");
    const [docType, setDocType] = useState("");
    const [docTypeDisplay, setDocTypeDisplay] = useState("");
    const [fromDate, setFromDate] = useState<string>(firstOfYear());
    const [toDate, setToDate] = useState<string>(lastOfYear());
    const [cancelledTxn, setCancelledTxn] = useState(false);

    // ── Lookup loaders ───────────────────────────────────────────────────────
    const loadDivisions = useCallback(
      async (q?: string) => {
        if (!companyCode) return [];
        const data = await getDynamicLookup(
          buildPayload(PARAM_DIVISION_LIST, loginid, {
            code1: companyCode,
          }),
        );
        return matches(data, q);
      },
      [companyCode, loginid],
    );

    const loadDocTypes = useCallback(
      async (q?: string) => {
        if (!companyCode) return [];
        try {
          // ✅ Same parameter the HR master uses → MS_HR_DOCTYPES
          const data = await getDynamicLookup(
            buildPayload(PARAM_DOC_TYPE_LIST, loginid, {
              code1: companyCode,
            }),
          );
          return matches(data, q);
        } catch {
          // Fallback parameter name used by similar HR lookups
          const data = await getDynamicLookup(
            buildPayload("HR_COMPANY_DOCUMENTS_DOC_TYPE", loginid, {
              code1: companyCode,
            }),
          );
          return matches(data, q);
        }
      },
      [companyCode, loginid],
    );

    // ── Selection handlers ───────────────────────────────────────────────────
    const resetMessages = () => setError("");

    const handleDivisionChange = (value: string, row: LookupRow | null) => {
      resetMessages();
      setDivCode(value);
      setDivDisplay(
        row ? `${val(row, "DIV_CODE")} ${val(row, "DIV_NAME")}`.trim() : "",
      );
    };

    const handleDocTypeChange = (value: string, row: LookupRow | null) => {
      resetMessages();
      setDocType(value);
      // MS_HR_DOCTYPES returns: DOC_TYPE, DOCTYPE_NAME, DOCTYPE_SHORT_DESC
      setDocTypeDisplay(
        row
          ? `${val(row, "DOC_TYPE")} ${val(row, "DOCTYPE_NAME")}`.trim()
          : "",
      );
    };

    // ── Build payload for the report endpoint ────────────────────────────────
    const buildReportQuery = () => ({
      company_code: companyCode || "All",
      div_code: divCode || "All",
      doc_type: docType || "All",
      from_date: fromDate || "",
      to_date: toDate || "",
      listing: listing ? "Y" : "N",
      cancelled: cancelledTxn ? "Y" : "N",
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
        const res = await api.get(`${DOCUMENT_REPORT_URL}?${qs}`, {
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
    }, [
      companyCode,
      divCode,
      docType,
      fromDate,
      toDate,
      listing,
      cancelledTxn,
    ]);

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
      if (!fromDate) return "Date From is required";
      if (!toDate) return "Date To is required";
      if (new Date(fromDate) > new Date(toDate))
        return "'Date From' cannot be greater than 'Date To'";
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
    }, [companyCode, fromDate, toDate, fetchReport]);

    const handlePrint = useCallback(() => {
      void handleRun();
    }, [handleRun]);

    useImperativeHandle(ref, () => ({
      run: handleRun,
      print: handlePrint,
    }));

    const handleReset = () => {
      setListing(false);
      setDivCode("");
      setDivDisplay("");
      setDocType("");
      setDocTypeDisplay("");
      setFromDate(firstOfYear());
      setToDate(lastOfYear());
      setCancelledTxn(false);
      setError("");
    };

    const labelFor = (v: string | undefined): string => v || "All";
    const divShow = labelFor(divDisplay);
    const docTypeShow = labelFor(docTypeDisplay);

    const BG = "#EEF5FD";

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
          `}</style>

          {/* Title bar */}
          <div className="freight-report-titlebar">
            <h1>HR Document Report</h1>
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
          <div className="freight-report-summary grid grid-cols-4 gap-2 border-b bg-muted/10 p-3">
            <SummaryStripItem icon={Users} label="Division" value={divShow} />
            <SummaryStripItem icon={FileText} label="Doc Type" value={docTypeShow} />
            <SummaryStripItem
              icon={Filter}
              label="Date Range"
              value={`${fromDate || "—"} → ${toDate || "—"}`}
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
            {/* Row 1: Division / Doc Type / Date From / Date To — 4 in a row */}
            <div
              className="field-row"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginTop: 6,
                width: "100%",
              }}
            >
              <FloatLabel label="Division" bgColor={BG}>
                <LookupField
                  compact
                  label=""
                  value={divCode}
                  displayValue={divDisplay || undefined}
                  columns={[
                    { field: "DIV_CODE", header: "Code" },
                    { field: "DIV_NAME", header: "Name" },
                  ]}
                  valueField="DIV_CODE"
                  displayFields={["DIV_CODE", "DIV_NAME"]}
                  loadOptions={loadDivisions}
                  onChange={handleDivisionChange}
                  placeholder="Select division"
                />
              </FloatLabel>

              <FloatLabel label="Doc Type" bgColor={BG}>
                <LookupField
                  compact
                  label=""
                  value={docType}
                  displayValue={docTypeDisplay || undefined}
                  // ✅ Columns returned by MST_HR_MS_HR_DOCTYPES → MS_HR_DOCTYPES
                  columns={[
                    { field: "DOC_TYPE", header: "Code" },
                    { field: "DOCTYPE_NAME", header: "Name" },
                  ]}
                  valueField="DOC_TYPE"
                  displayFields={["DOC_TYPE", "DOCTYPE_NAME"]}
                  loadOptions={loadDocTypes}
                  onChange={handleDocTypeChange}
                  placeholder="Select doc type"
                />
              </FloatLabel>

              <FloatLabel label="Date From" required bgColor={BG}>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </FloatLabel>

              <FloatLabel label="Date To" required bgColor={BG}>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </FloatLabel>
            </div>

            {/* Row 2: Listing / Cancelled Transactions checkboxes */}
            <div
              className="field-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                marginTop: 10,
                marginBottom: 6,
              }}
            >
              <CheckBox label="Listing" checked={listing} onChange={setListing} />
              <CheckBox
                label="Cancelled Transactions"
                checked={cancelledTxn}
                onChange={setCancelledTxn}
              />
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
  },
);

export default HrDocumentReport;