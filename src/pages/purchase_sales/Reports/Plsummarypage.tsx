"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Eye, FileText, Filter, RotateCcw, UserRound } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount, LookupRow } from "../../../api/lookups";
import { getPLSummaryReportExcel, getPLSummaryReportHtml } from "../../../api/transactions";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { Input } from "../../../components/ui/Input";
import { MultiSelectField, type MultiSelectOption } from "../../../components/ui/MultiSelectField";

export type ReportMode =
  | "invoicewise"
  | "customerwise"
  | "salesmanwise"
  | "customergroupwise"
  | "groupcustomerwise";

type TabKey = "group" | "brand" | "category" | "type" | "manufacturer" | "customer";

interface PLSummaryReportParams {
  parameter: string;
  loginid: string;
  company_code: string;
  mode: ReportMode;
  fromdate: string;
  todate: string;
  docno: string;
  salesman: string;
  group: string;
  brand: string;
  prodcategory: string;
  prodtype: string;
  manu: string;
  cust: string;
  [key: string]: any;
}

interface Selections {
  group: string[];
  brand: string[];
  category: string[];
  type: string[];
  manufacturer: string[];
  customer: string[];
}

const EMPTY_SELECTIONS: Selections = {
  group: [], brand: [], category: [], type: [], manufacturer: [], customer: [],
};

const LOOKUP_PARAMS = {
  group: "PURCHASE_SALE_MSE_PRODGROUP",
  brand: "PURCHASE_SALE_MSE_PRODBRAND",
  category: "PURCHASE_SALE_MSE_PRODCATEGORY",
  type: "PURCHASE_SALE_MSE_PRODTYPE",
  manufacturer: "PURCHASE_SALE_MSE_MANUFACTURER",
  customer: "PURCHASE_SALE_MSE_CUSTOMER",
  salesman: "PURCHASE_SALE_MSE_SALESMAN",
  docno: "PURCHASE_SALE_SALESINVOICE_DOCNO",
} as const;

const MODE_OPTIONS: { value: ReportMode; label: string }[] = [
  { value: "invoicewise", label: "Invoice wise" },
  { value: "customerwise", label: "Customer wise" },
  { value: "salesmanwise", label: "Salesman wise" },
  { value: "customergroupwise", label: "Customer-Group wise" },
  { value: "groupcustomerwise", label: "Group-Customer wise" },
];

const TABS: { key: TabKey; label: string; lookupParam: string; valueField: string; nameField: string }[] = [
  { key: "group", label: "Group", lookupParam: LOOKUP_PARAMS.group, valueField: "group_code", nameField: "group_name" },
  { key: "brand", label: "Brand", lookupParam: LOOKUP_PARAMS.brand, valueField: "brand_code", nameField: "brand_name" },
  { key: "category", label: "Category", lookupParam: LOOKUP_PARAMS.category, valueField: "category_code", nameField: "category_name" },
  { key: "type", label: "Type", lookupParam: LOOKUP_PARAMS.type, valueField: "prodtype_code", nameField: "prodtype_name" },
  { key: "manufacturer", label: "Manufacturer", lookupParam: LOOKUP_PARAMS.manufacturer, valueField: "manu_code", nameField: "manu_name" },
  { key: "customer", label: "Customer", lookupParam: LOOKUP_PARAMS.customer, valueField: "ac_code", nameField: "ac_name" },
];

function splitCsv(value: string) {
  return value ? value.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

function toApiCodeString(values: string[]) {
  return values.length ? values.join(",") : "All";
}

function firstValue(values: string[]) {
  return values[0] || "";
}

function setFilter<T extends Record<string, any>>(setter: React.Dispatch<React.SetStateAction<T>>, key: keyof T, value: string) {
  setter((current) => ({ ...current, [key]: value }));
}

function optionLabel(options: { label: string; value: string }[], value: string) {
  return options.find((x) => x.value === value)?.label || "All";
}

function toInputDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function toDisplayDate(value: string) {
  const v = toInputDate(value);
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

function formatAmount(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function firstExisting(row: LookupRow, key: string) {
  return row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
}

function formatText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function buildTotals(rows: LookupRow[]) {
  const fields = ["REVENUE", "EXPENSE", "PROFIT"];
  return fields
    .map((field) => ({
      label: field.replace(/_/g, " "),
      value: rows.reduce((sum, row) => sum + Number(firstExisting(row, field) || 0), 0),
    }))
    .filter((x) => x.value !== 0);
}

async function loadLookup(parameter: string, companyCode: string) {
  const rows = await getDynamicLookupaccount({
    parameter,
    loginid: "ADMIN",
    code1: companyCode,
    code2: "", code3: "", code4: "",
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  });
  return Array.isArray(rows) ? rows : [];
}

function usePLLookup(parameter: string, companyCode: string, valueField: string, nameField: string, loginId: string) {
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDynamicLookupaccount({
      parameter,
      loginid: loginId,
      code1: companyCode,
      code2: "", code3: "", code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    })
      .then((rows) => {
        if (!alive) return;
        const safeRows = Array.isArray(rows) ? rows : [];
        setOptions(safeRows.map((row: LookupRow) => {
          const value = String(firstExisting(row, valueField) ?? "");
          const name = String(firstExisting(row, nameField) ?? "");
          return { value, label: name && name !== value ? `${value} - ${name}` : value };
        }).filter((x) => x.value));
      })
      .catch(() => alive && setOptions([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [parameter, companyCode, valueField, nameField, loginId]);

  return { options, loading };
}

export default function PLSummaryPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [salesman, setSalesman] = useState("");
  const [mode, setMode] = useState<ReportMode>("invoicewise");
  const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Select filters and run the report.");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const lastRequestRef = useRef<PLSummaryReportParams | null>(null);

  const invoiceLookup = usePLLookup(LOOKUP_PARAMS.docno, companyCode, "doc_no", "inv_no", loginId);
  const salesmanLookup = usePLLookup(LOOKUP_PARAMS.salesman, companyCode, "salesman_code", "salesman_name", loginId);

  const dateRangeValid = !fromDate || !toDate || fromDate <= toDate;
  const totals = useMemo(() => buildTotals(rows), [rows]);
  const invoiceDisplay = invoiceLookup.options.find((x) => x.value === invoiceNo)?.label || "All invoices";
  const salesmanDisplay = salesmanLookup.options.find((x) => x.value === salesman)?.label || "All sales persons";

  useEffect(() => () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const buildRequestParams = useCallback((): PLSummaryReportParams => ({
    parameter: "PL_SUMMARY_REPORT",
    loginid: loginId,
    company_code: companyCode,
    mode,
    fromdate: fromDate || "All",
    todate: toDate || "All",
    docno: invoiceNo || "0",
    salesman: salesman || "All",
    group: toApiCodeString(selections.group),
    brand: toApiCodeString(selections.brand),
    prodcategory: toApiCodeString(selections.category),
    prodtype: toApiCodeString(selections.type),
    manu: toApiCodeString(selections.manufacturer),
    cust: toApiCodeString(selections.customer),
  }), [companyCode, fromDate, invoiceNo, loginId, mode, salesman, selections, toDate]);

  const fetchReport = useCallback(async (params: PLSummaryReportParams) => {
    setLoading(true);
    setError("");
    setMessage("");
    lastRequestRef.current = params;
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewOpen(true);

    try {
      const html = await getPLSummaryReportHtml(params);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      setPreviewUrl(window.URL.createObjectURL(blob));
      setRows([]);
      setHasGeneratedReport(true);
      setMessage("Report generated successfully.");
    } catch (err: any) {
      const msg = err?.message || "Failed to load report. Please try again.";
      setError(msg);
      setPreviewError(msg);
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [previewUrl]);

  function handleGenerate() {
    if (!dateRangeValid) return;
    void fetchReport(buildRequestParams());
  }

  function handleReset() {
    setFromDate("");
    setToDate("");
    setInvoiceNo("");
    setSalesman("");
    setMode("invoicewise");
    setSelections(EMPTY_SELECTIONS);
    setRows([]);
    setError("");
    setMessage("Select filters and run the report.");
    setHasGeneratedReport(false);
  }

  function closePreview() {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewOpen(false);
    setPreviewUrl("");
    setPreviewError("");
  }

  async function handleExcel() {
    if (!lastRequestRef.current) {
      setError("Generate the report at least once before exporting to Excel.");
      return;
    }
    setExporting(true);
    try {
      await getPLSummaryReportExcel(lastRequestRef.current);
    } catch {
      setPreviewError("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>P&amp;L Summary Report</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
          <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
            <SummaryBadge label="Records" value={String(rows.length)} />
            {totals.map((item) => <SummaryBadge key={item.label} label={item.label} value={formatAmount(item.value)} strong />)}
          </div>
        </div>

        <ReportFilterHeader onClear={handleReset} />

        {error && <div className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠️ {error}</div>}
        {!dateRangeValid && <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">From date must be on or before To date.</div>}

        <div className="freight-report-summary grid grid-cols-2 gap-2 border-b bg-muted/10 p-3 md:grid-cols-4">
          <SummaryStripItem icon={CalendarDays} label="Period" value={`${toDisplayDate(fromDate) || "Start"} – ${toDisplayDate(toDate) || "Today"}`} />
          <SummaryStripItem icon={UserRound} label="Sales Person" value={salesmanDisplay} />
          <SummaryStripItem icon={FileText} label="Invoice" value={invoiceDisplay} />
          <SummaryStripItem icon={Filter} label="Report Type" value={optionLabel(MODE_OPTIONS, mode)} />
        </div>

        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="From"><BiscDatePicker value={toInputDate(fromDate)} onChange={setFromDate} /></Field>
          <Field label="To"><BiscDatePicker value={toInputDate(toDate)} onChange={setToDate} /></Field>

          <MultiSelectField
            className="freight-report-multi-select"
            label="Invoice No"
            options={invoiceLookup.options}
            loading={invoiceLookup.loading}
            value={splitCsv(invoiceNo)}
            onChange={(next) => setInvoiceNo(firstValue(next))}
          />

          <MultiSelectField
            className="freight-report-multi-select"
            label="Sales Person"
            options={salesmanLookup.options}
            loading={salesmanLookup.loading}
            value={splitCsv(salesman)}
            onChange={(next) => setSalesman(firstValue(next))}
          />

          <Field label="Report Criteria">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as ReportMode)}
            >
              {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="freight-report-fields grid gap-3 border-t bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-3">
          {TABS.map((tab) => (
            <PLMultiSelect
              key={tab.key}
              tab={tab}
              companyCode={companyCode}
              loginId={loginId}
              value={selections[tab.key]}
              onChange={(next) => setSelections((current) => ({ ...current, [tab.key]: next }))}
            />
          ))}
        </div>

        <div className="freight-report-actions flex items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !dateRangeValid}>
            <Eye size={14} /> {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        {hasGeneratedReport && <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>}
      </div>

      {previewOpen && (
        <ReportPreviewDialog
          title="P&L Summary Report"
          pdfUrl={previewUrl}
          error={previewError}
          exporting={exporting}
          onExcel={handleExcel}
          onClose={closePreview}
          onDownload={() => {}}
          downloadName="PL_Summary_Report.html"
        />
      )}
    </section>
  );
}

function PLMultiSelect({
  tab, companyCode, loginId, value, onChange,
}: {
  tab: { key: TabKey; label: string; lookupParam: string; valueField: string; nameField: string };
  companyCode: string;
  loginId: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const lookup = usePLLookup(tab.lookupParam, companyCode, tab.valueField, tab.nameField, loginId);
  return (
    <MultiSelectField
      className="freight-report-multi-select"
      label={tab.label}
      options={lookup.options}
      loading={lookup.loading}
      value={value}
      onChange={onChange}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">{label}{children}</label>;
}

function SummaryBadge({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-1.5 ${strong ? "border-primary/20 bg-primary/10 text-primary" : "bg-muted/40 text-foreground"}`}>
      <div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={16} /></span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
        <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>{value}</div>
      </div>
    </div>
  );
}