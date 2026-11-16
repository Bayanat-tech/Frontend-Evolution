// CreditRequestRegisterPage.tsx
// Credit Request Register (listing report) - same layout/behaviour as PrRegisterPage.
"use client";

import React, { useState, useCallback } from "react";
import { Loader2, Search, X } from "lucide-react";
// NOTE: import paths below follow the folder of your "../../../components/..." imports.
// If the screen shows a "module not found" error, adjust the number of "../" only.
import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { PurchaseReportPreview } from "../../purchase_sales/Reports/Purchasereportpreview";
import { openPurchaseReport } from "../../purchase_sales/Reports/PurchaseReportPreviewState";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { getCRListingReportExcel, getCRListingReportHtml } from "../../../api/transactions";
interface CrRegisterParams {
  loginid: string;
  company_code: string;
  from_date: string; // yyyy-mm-dd
  to_date: string;   // yyyy-mm-dd
  status: string;
  request_number: string;
  [key: string]: any;
}

// Display Value -> Data Value (data value is compared with LAST_ACTION in the procedure)
const STATUS_OPTIONS: { displayValue: string; dataValue: string }[] = [
  { displayValue: "ALL", dataValue: "ALL" },
  { displayValue: "PENDING", dataValue: "PENDING" },
  { displayValue: "IN PROGRESS", dataValue: "INPROGRESS" },
  { displayValue: "APPROVED", dataValue: "APPROVED" },
  { displayValue: "REJECTED", dataValue: "REJECTED" },
  { displayValue: "SENT BACK", dataValue: "SENTBACK" },
  { displayValue: "CANCELED", dataValue: "CANCELED" },
  { displayValue: "CLOSED", dataValue: "CLOSED" },
];

// ─── Field wrapper ──────────────────────────────────────────────────────────
// NOTE: this is a <div>, not a <label>. A <label> forwards clicks to the first
// input inside it, which interferes with the BiscDatePicker calendar.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-1">
      <span className="text-xs font-semibold text-slate-500">{children}</span>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Converts whatever BiscDatePicker gives (string / Date / event) into yyyy-mm-dd.
// Parsed manually so dd/mm/yyyy is never mis-read as mm/dd/yyyy.
const pickValue = (v: any): string => {
  if (v === null || v === undefined || v === "") return "";

  // Date object -> use LOCAL parts (toISOString would shift the day in India time)
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? "" : toIso(v);
  }

  // Event object
  if (typeof v === "object") return pickValue(v?.target?.value);

  const s = String(v).trim();

  // yyyy-mm-dd (also yyyy-mm-ddTHH:mm...)
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;

  // dd/mm/yyyy or dd-mm-yyyy
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;

  return "";
};

// The backend answers "no data" / errors with a JSON body and status 200.
// Returns the message when `body` is such a JSON string, otherwise null.
function jsonErrorMessage(body: string): string | null {
  const t = String(body ?? "").trimStart();
  if (!t.startsWith("{")) return null;
  try {
    const p = JSON.parse(t);
    if (p && p.success === false) return String(p.message || "Unable to generate report");
  } catch {
    /* it is the HTML report */
  }
  return null;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CreditRequestRegisterPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  const now = new Date();
  const defaultFrom = toIso(new Date(now.getFullYear(), 0, 1)); // 1 Jan of this year
  const defaultTo = toIso(now);

  // Dates are stored as yyyy-mm-dd
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  // Request Number (lookup on CR_REPORT_REQUEST_NO; blank = all)
  const [requestNo, setRequestNo] = useState("");

  // Status (Display Value -> Data Value)
  const [status, setStatus] = useState(STATUS_OPTIONS[0].dataValue);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Select filters and run the report.");

  // Both dates are required by the report (the procedure filters on REQUEST_DATE)
  const datesFilled = !!fromDate && !!toDate;
  const dateRangeValid = !datesFilled || fromDate <= toDate;

  const buildRequestParams = (): CrRegisterParams => ({
    loginid: loginId,
    company_code: companyCode,
    from_date: fromDate,
    to_date: toDate,
    status: status || "ALL",
    request_number: requestNo.trim(),
  });

  const handleGenerateReport = useCallback(async () => {
    if (!datesFilled) {
      setMessage("Please select From and To dates.");
      return;
    }
    if (!dateRangeValid) return;

    const params = buildRequestParams();

    setLoading(true);
    setMessage("");

    const preview = openPurchaseReport("Credit Request Register");

    try {
      const html = await getCRListingReportHtml(params);

      // "No data" / errors come back as JSON, not HTML
      const errMsg = jsonErrorMessage(html);
      if (errMsg) {
        preview.fail(new Error(errMsg));
        setMessage(errMsg);
        return;
      }

      preview.ready({
        html,
        filename: `credit_request_register_${new Date().toISOString().slice(0, 10)}`,
        orientation: "landscape",
        onExcel: async () => {
          await getCRListingReportExcel(params);
        },
      });
      setMessage("Report generated.");
    } catch (err: any) {
      const errorMessage = err?.message ?? "Failed to load report. Please try again.";
      preview.fail(new Error(errorMessage));
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesFilled, dateRangeValid, fromDate, toDate, requestNo, status, companyCode, loginId]);

  function resetFilters() {
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setRequestNo("");
    setStatus(STATUS_OPTIONS[0].dataValue);
    setMessage("Select filters and run the report.");
  }

  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>Credit Request Register</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={resetFilters} />

        <div className="freight-report-fields grid gap-x-4 gap-y-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SectionTitle>Filters</SectionTitle>

          <Field label="From Date">
            <ClearableDate value={fromDate} onClear={() => setFromDate("")}>
              <BiscDatePicker
                value={fromDate}
                onChange={(v: any) => setFromDate(pickValue(v))}
              />
            </ClearableDate>
          </Field>

          <Field label="To Date">
            <ClearableDate value={toDate} onClear={() => setToDate("")}>
              <BiscDatePicker
                value={toDate}
                onChange={(v: any) => setToDate(pickValue(v))}
              />
            </ClearableDate>
            {!dateRangeValid && (
              <span className="text-[11px] font-normal text-red-600">
                "To" date must be on or after "From" date
              </span>
            )}
          </Field>

          <Field label="Request Number">
            <LookupField
              label=""
              value={requestNo}
              displayValue={requestNo}
              columns={[{ field: "REQUEST_NUMBER", header: "Request Number" }]}
              valueField="REQUEST_NUMBER"
              displayFields={["REQUEST_NUMBER"]}
              loadOptions={() =>
                getDynamicLookup({
                  parameter: "PS_CREDITREQUEST_ENTRY_REQUEST_NO",
                  loginid: loginId,
                  code1: companyCode,
                })
              }
              disabled={false}
              onChange={(value: string) => setRequestNo(value ?? "")}
            />
          </Field>

          <Field label="Current Status">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.dataValue} value={opt.dataValue}>
                  {opt.displayValue}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="freight-report-actions flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerateReport}
            disabled={loading || !dateRangeValid}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
          </Button>
        </div>
        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <PurchaseReportPreview />
    </section>
  );
}

function ClearableDate({
  value,
  onClear,
  children,
}: {
  value: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {value && (
        <button
          type="button"
          aria-label="Clear date"
          title="Clear"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
          className="absolute right-9 top-1/2 z-10 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-black transition-colors hover:bg-slate-200"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}