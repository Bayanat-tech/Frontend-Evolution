import type { ColumnDef } from "@tanstack/react-table";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { BarChart3, Boxes, CalendarDays, Download, FileSpreadsheet, Filter, Loader2, Printer, RefreshCw, Search, Ship, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { executeWmsInboundSqlCached } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

export type FreightReportKey =
  | "enquiry_list"
  | "rfq_list"
  | "quotation_list"
  | "freight_job_list"
  | "freight_profit"
  | "freight_expense"
  | "freight_revenue"
  | "freight_brokerage"
  | "deposits"
  | "container_deposit";

type ReportColumn = { key: string; label: string; kind?: "date" | "amount" | "status" | "mode" | "type" };
type FilterKey = "date" | "principal" | "job" | "mode" | "type" | "status" | "search";
type ReportConfig = {
  title: string;
  subtitle: string;
  family: string;
  icon: typeof FileSpreadsheet;
  columns: ReportColumn[];
  amountFields: string[];
  filters: FilterKey[];
  primaryMetric: string;
};

const reportConfigs: Record<FreightReportKey, ReportConfig> = {
  enquiry_list: {
    title: "Enquiry List",
    subtitle: "Customer freight requirements captured before RFQ or quotation.",
    family: "Commercial Register",
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "principal", "mode", "type", "status", "search"],
    primaryMetric: "Enquiries",
    columns: [
      { key: "ENQUIRY_NR", label: "Enquiry No" },
      { key: "ENQUIRY_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "DEPT_CODE", label: "Dept" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "ORIGIN_PORT", label: "Origin" },
      { key: "DESTINATION_PORT", label: "Destination" },
      { key: "STATUS", label: "Status", kind: "status" },
      { key: "REMARKS", label: "Remarks" },
    ],
  },
  rfq_list: {
    title: "RFQ List",
    subtitle: "Request-for-quote register sourced from approved enquiries.",
    family: "Supplier Rate Request",
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "principal", "mode", "type", "status", "search"],
    primaryMetric: "RFQs",
    columns: [
      { key: "RFQ_NO", label: "RFQ No" },
      { key: "RFQ_DATE", label: "Date", kind: "date" },
      { key: "SOURCE_ENQUIRY", label: "Source Enquiry" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "STATUS", label: "Status", kind: "status" },
      { key: "REMARKS", label: "Remarks" },
    ],
  },
  quotation_list: {
    title: "Quotation List",
    subtitle: "Customer quotation register with cost, sell, and margin.",
    family: "Commercial Offer",
    icon: BarChart3,
    amountFields: ["TOTAL_SELL", "TOTAL_COST", "PROFIT"],
    filters: ["date", "principal", "mode", "type", "status", "search"],
    primaryMetric: "Quotations",
    columns: [
      { key: "QUOTATION_NO", label: "Quotation No" },
      { key: "QUOTATION_DATE", label: "Date", kind: "date" },
      { key: "SOURCE_REF", label: "Source" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "STATUS", label: "Status", kind: "status" },
      { key: "TOTAL_SELL", label: "Sell", kind: "amount" },
      { key: "TOTAL_COST", label: "Cost", kind: "amount" },
      { key: "PROFIT", label: "Profit", kind: "amount" },
    ],
  },
  freight_job_list: {
    title: "Freight Job List",
    subtitle: "Operational jobs created from approved freight quotations.",
    family: "Operations",
    icon: Ship,
    amountFields: [],
    filters: ["date", "principal", "job", "mode", "type", "status", "search"],
    primaryMetric: "Jobs",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "ORIGIN_PORT", label: "Origin" },
      { key: "DESTINATION_PORT", label: "Destination" },
      { key: "PACKLIST_DATE", label: "Pack List", kind: "date" },
      { key: "CONFIRM_DATE", label: "Confirm", kind: "date" },
      { key: "INVOICE_DATE", label: "Invoice", kind: "date" },
    ],
  },
  freight_profit: {
    title: "Freight Profit",
    subtitle: "PowerBuilder-style job profitability: revenue minus expense.",
    family: "Finance Control",
    icon: BarChart3,
    amountFields: ["REVENUE", "EXPENSE", "PROFIT"],
    filters: ["date", "principal", "job", "mode", "type", "search"],
    primaryMetric: "Profit",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "REVENUE", label: "Revenue", kind: "amount" },
      { key: "EXPENSE", label: "Expense", kind: "amount" },
      { key: "PROFIT", label: "Profit", kind: "amount" },
      { key: "CONFIRM_DATE", label: "Confirm", kind: "date" },
    ],
  },
  freight_expense: {
    title: "Freight Expense",
    subtitle: "Cost lines posted against freight job activities.",
    family: "Cost Report",
    icon: BarChart3,
    amountFields: ["EXPENSE"],
    filters: ["date", "principal", "job", "mode", "type", "search"],
    primaryMetric: "Expense",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "SRNO", label: "Line" },
      { key: "ACT_CODE", label: "Activity" },
      { key: "ACTIVITY", label: "Activity Name" },
      { key: "SUPPLIER_CODE", label: "Supplier" },
      { key: "EXPENSE", label: "Expense", kind: "amount" },
      { key: "CURR_CODE", label: "Currency" },
    ],
  },
  freight_revenue: {
    title: "Freight Revenue",
    subtitle: "Billing and revenue lines posted against freight jobs.",
    family: "Revenue Report",
    icon: BarChart3,
    amountFields: ["REVENUE"],
    filters: ["date", "principal", "job", "mode", "type", "search"],
    primaryMetric: "Revenue",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "SRNO", label: "Line" },
      { key: "ACT_CODE", label: "Activity" },
      { key: "ACTIVITY", label: "Activity Name" },
      { key: "REVENUE", label: "Revenue", kind: "amount" },
      { key: "CURR_CODE", label: "Currency" },
      { key: "REMARKS", label: "Remarks" },
    ],
  },
  freight_brokerage: {
    title: "Freight Brokerage",
    subtitle: "Broker-linked jobs and brokerage base values.",
    family: "Brokerage",
    icon: WalletCards,
    amountFields: ["BROKERAGE_BASE"],
    filters: ["date", "principal", "job", "mode", "type", "search"],
    primaryMetric: "Brokerage",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "BROKER_CODE", label: "Broker" },
      { key: "BROKER_NAME", label: "Broker Name" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "BROKERAGE_BASE", label: "Base", kind: "amount" },
    ],
  },
  deposits: {
    title: "Deposits",
    subtitle: "Shipment deposits and demurrage values by job.",
    family: "Settlement",
    icon: WalletCards,
    amountFields: ["AMOUNT", "DEMURAGE_AMOUNT"],
    filters: ["date", "principal", "job", "mode", "type", "search"],
    primaryMetric: "Deposit",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "BE_NO", label: "BE No" },
      { key: "BE_DATE", label: "BE Date", kind: "date" },
      { key: "AMOUNT", label: "Amount", kind: "amount" },
      { key: "DEMURAGE_AMOUNT", label: "Demurrage", kind: "amount" },
      { key: "REMARKS", label: "Remarks" },
    ],
  },
  container_deposit: {
    title: "Container Deposit",
    subtitle: "Container deposit follow-up by job and container.",
    family: "Settlement",
    icon: Boxes,
    amountFields: ["AMOUNT", "DEMURAGE_AMOUNT"],
    filters: ["date", "principal", "job", "mode", "type", "search"],
    primaryMetric: "Container Deposit",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "CONTAINER_NO", label: "Container" },
      { key: "CONTAINER_TYPE", label: "Type" },
      { key: "AMOUNT", label: "Amount", kind: "amount" },
      { key: "DEMURAGE_AMOUNT", label: "Demurrage", kind: "amount" },
      { key: "REMARKS", label: "Remarks" },
    ],
  },
};

const modeOptions = [
  { label: "All", value: "" },
  { label: "Air", value: "A" },
  { label: "Sea", value: "S" },
  { label: "Land", value: "R" },
];

const jobTypeOptions = [
  { label: "All", value: "" },
  { label: "Import", value: "IMP" },
  { label: "Export", value: "EXP" },
  { label: "Re-export", value: "IRE" },
];

const statusOptions = [
  { label: "All", value: "" },
  { label: "Approved", value: "A" },
  { label: "Not Approved", value: "N" },
  { label: "Cancelled", value: "C" },
  { label: "Open", value: "O" },
  { label: "Closed", value: "Y" },
];

export function FreightReportPage({ reportKey }: { reportKey: FreightReportKey }) {
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const config = reportConfigs[reportKey];
  const Icon = config.icon;
  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    prin_code: "",
    job_no: "",
    transport_mode: "",
    job_type: "",
    status: "",
    search: "",
  });
  const [principalText, setPrincipalText] = useState("");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Select filters and run the report.");
  const [search, setSearch] = useState("");

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => buildColumns(config), [config]);
  const totals = useMemo(() => buildTotals(rows, config.amountFields), [config.amountFields, rows]);
  const visibleFilters = config.filters;

  async function runReport() {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[]; totalCount?: number }>("/api/freight/reports/run", {
        company_code: companyCode,
        report_key: reportKey,
        ...filters,
      });
      const nextRows = (response.data.data || []).map(normalizeRow);
      setRows(nextRows);
      setMessage(nextRows.length ? `${nextRows.length} records loaded from Oracle.` : "No records found for selected filters.");
    } catch (error: any) {
      setRows([]);
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Unable to generate Freight report.");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilters({ from_date: "", to_date: "", prin_code: "", job_no: "", transport_mode: "", job_type: "", status: "", search: "" });
    setPrincipalText("");
    setRows([]);
    setSearch("");
    setMessage("Select filters and run the report.");
  }

  function printReport() {
    const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
    if (!win) return;
    win.document.write(reportHtml(config, companyCode, rows, totals));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  return (
    <section className="grid gap-3">
      <div className="rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{config.family}</p>
              <h1 className="m-0 truncate text-xl font-semibold leading-tight text-foreground">{config.title}</h1>
              <p className="m-0 text-xs text-muted-foreground">{config.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SummaryBadge label={config.primaryMetric} value={String(rows.length)} />
            {totals.map((item) => <SummaryBadge key={item.label} label={item.label} value={formatAmount(item.value)} strong />)}
            <Button type="button" variant="outline" size="sm" onClick={printReport} disabled={!rows.length}>
              <Printer size={14} /> Print
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!rows.length} onClick={() => exportCsv(config.title, rows)}>
              <Download size={14} /> CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-2 p-3 xl:grid-cols-[1fr_1fr_1.35fr_0.9fr_0.8fr_0.8fr_0.85fr_auto]">
          {visibleFilters.includes("date") && (
            <>
              <Field label="From"><DateField value={filters.from_date} onChange={(value) => setFilter(setFilters, "from_date", value)} /></Field>
              <Field label="To"><DateField value={filters.to_date} onChange={(value) => setFilter(setFilters, "to_date", value)} /></Field>
            </>
          )}
          {visibleFilters.includes("principal") && (
            <Field label="Principal">
              <LookupField
                value={filters.prin_code}
                displayValue={principalText}
                onChange={(value, row) => {
                  setFilter(setFilters, "prin_code", value);
                  setPrincipalText(row ? `${lookupText(row, "PRIN_CODE")} - ${lookupText(row, "PRIN_NAME")}` : "");
                }}
                loadOptions={() => loadLookup(`SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE='${sqlEscape(companyCode)}' ORDER BY PRIN_CODE`)}
                valueField="PRIN_CODE"
                displayFields={["PRIN_CODE", "PRIN_NAME"]}
                columns={[{ field: "PRIN_CODE", header: "Code" }, { field: "PRIN_NAME", header: "Principal" }]}
                compact
              />
            </Field>
          )}
          {visibleFilters.includes("job") && <Field label="Job No"><Input className="h-8" value={filters.job_no} onChange={(event) => setFilter(setFilters, "job_no", event.target.value)} /></Field>}
          {visibleFilters.includes("mode") && <Field label="Mode"><Select value={filters.transport_mode} options={modeOptions} onChange={(value) => setFilter(setFilters, "transport_mode", value)} /></Field>}
          {visibleFilters.includes("type") && <Field label="Type"><Select value={filters.job_type} options={jobTypeOptions} onChange={(value) => setFilter(setFilters, "job_type", value)} /></Field>}
          {visibleFilters.includes("status") && <Field label="Status"><Select value={filters.status} options={statusOptions} onChange={(value) => setFilter(setFilters, "status", value)} /></Field>}
          <div className="flex items-end gap-2">
            <Button type="button" size="sm" className="h-8" onClick={runReport} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Run
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={resetFilters} title="Reset">
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {visibleFilters.includes("search") && (
          <div className="border-t bg-muted/20 p-3">
            <Field label="Oracle Search">
              <Input className="h-8" value={filters.search} onChange={(event) => setFilter(setFilters, "search", event.target.value)} placeholder="Document, job, principal..." />
            </Field>
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <ReportTile icon={CalendarDays} label="Period" value={`${toDisplayDate(filters.from_date) || "Start"} - ${toDisplayDate(filters.to_date) || "Today"}`} />
        <ReportTile icon={UserRound} label="Principal" value={principalText || "All principals"} />
        <ReportTile icon={Ship} label="Movement" value={`${optionLabel(modeOptions, filters.transport_mode)} / ${optionLabel(jobTypeOptions, filters.job_type)}`} />
        <ReportTile icon={Filter} label="Status" value={visibleFilters.includes("status") ? optionLabel(statusOptions, filters.status) : "Not applicable"} />
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-foreground">{config.title} Output</h2>
            <p className="m-0 text-xs text-muted-foreground">{message}</p>
          </div>
          <Input className="h-8 w-72 max-w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter visible rows..." />
        </div>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          density="grid"
          height="calc(100vh - 375px)"
          minWidth={Math.max(900, config.columns.length * 112)}
          enableExport={false}
          emptyText="No report rows found"
        />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">{label}{children}</label>;
}

function Select({ value, options, onChange }: { value: string; options: { label: string; value: string }[]; onChange: (value: string) => void }) {
  return <select className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select>;
}

function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [displayValue, setDisplayValue] = useState(() => toDisplayDate(value));
  useEffect(() => setDisplayValue(toDisplayDate(value)), [value]);
  function commit(next = displayValue) {
    const parsed = parseDisplayDate(next);
    if (parsed || !next.trim()) onChange(parsed);
    setDisplayValue(parsed ? toDisplayDate(parsed) : next);
  }
  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  }
  return (
    <div className="relative">
      <Input
        className="h-8 pr-9"
        placeholder="dd/mm/yyyy"
        value={displayValue}
        onChange={(event) => setDisplayValue(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      <button
        type="button"
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded border bg-background text-muted-foreground hover:bg-muted hover:text-primary"
        onMouseDown={(event) => event.preventDefault()}
        onClick={openPicker}
        title="Select date"
      >
        <CalendarDays size={14} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="pointer-events-none absolute right-1 top-1 h-6 w-6 opacity-0"
        tabIndex={-1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SummaryBadge({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`rounded-md border px-3 py-1.5 ${strong ? "border-primary/20 bg-primary/10 text-primary" : "bg-muted/40 text-foreground"}`}><div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div><div className="text-sm font-semibold">{value}</div></div>;
}

function ReportTile({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={16} /></span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function buildColumns(config: ReportConfig): ColumnDef<LookupRow>[] {
  return config.columns.map((column) => ({
    accessorKey: column.key,
    header: column.label,
    cell: ({ row, getValue }) => {
      const value = getValue() ?? firstExisting(row.original, column.key);
      if (column.kind === "amount") return <span className="block text-right font-semibold text-foreground">{formatAmount(Number(value || 0))}</span>;
      if (column.kind === "date") return formatCellDate(value);
      if (column.kind === "status") return <StatusPill value={String(value ?? "")} />;
      if (column.kind === "mode") return modeLabel(String(value ?? ""));
      if (column.kind === "type") return typeLabel(String(value ?? ""));
      return formatText(value);
    },
  }));
}

function StatusPill({ value }: { value: string }) {
  const code = value.trim().toUpperCase();
  const text = statusLabel(code);
  const className = code === "A" || code === "Y"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : code === "C"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${className}`}>{text}</span>;
}

function buildTotals(rows: LookupRow[], amountFields: string[]) {
  return amountFields
    .map((field) => ({ label: label(field), value: rows.reduce((sum, row) => sum + Number(firstExisting(row, field) || 0), 0) }))
    .filter((item) => item.value !== 0)
    .slice(0, 3);
}

function setFilter<T extends Record<string, string>>(setter: Dispatch<SetStateAction<T>>, key: keyof T, value: string) {
  setter((current) => ({ ...current, [key]: value }));
}

async function loadLookup(sql: string) {
  const rows = await executeWmsInboundSqlCached(sql);
  return (Array.isArray(rows) ? rows : []).map(normalizeLookupRow);
}

function normalizeRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function normalizeLookupRow(row: LookupRow) {
  const normalized = normalizeRow(row);
  Object.entries(normalized).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function firstExisting(row: LookupRow, key: string) {
  return row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
}

function lookupText(row: LookupRow | null | undefined, key: string) {
  if (!row) return "";
  const value = firstExisting(row, key);
  return value === null || value === undefined ? "" : String(value).trim();
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}

function label(key: string) {
  return key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAmount(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatCellDate(value: unknown) {
  const text = formatText(value);
  return toDisplayDate(text) || text;
}

function optionLabel(options: { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label || "All";
}

function modeLabel(value: string) {
  const code = value.trim().toUpperCase();
  if (code === "A" || code === "AIR") return "Air";
  if (code === "S" || code === "SEA") return "Sea";
  if (code === "R" || code === "L" || code === "ROAD" || code === "LAND") return "Land";
  return value;
}

function typeLabel(value: string) {
  const code = value.trim().toUpperCase();
  if (code === "IMP" || code === "IMPORT") return "Import";
  if (code === "EXP" || code === "EXPORT") return "Export";
  if (code === "IRE" || code.includes("RE")) return "Re-export";
  return value;
}

function statusLabel(value: string) {
  if (value === "A") return "Approved";
  if (value === "C") return "Cancelled";
  if (value === "Y") return "Closed";
  if (value === "O") return "Open";
  if (value === "N") return "Pending";
  return value || "Pending";
}

function toInputDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(value: string) {
  const normalized = toInputDate(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function parseDisplayDate(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const candidate = `${year}-${month}-${day}`;
  const date = new Date(`${candidate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  if (date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return "";
  return candidate;
}

function exportCsv(title: string, rows: LookupRow[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${title.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function reportHtml(config: ReportConfig, companyCode: string, rows: LookupRow[], totals: { label: string; value: number }[]) {
  const tableRows = rows.map((row) => `<tr>${config.columns.map((column) => `<td>${escapeHtml(formatPrintValue(row, column))}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><title>${escapeHtml(config.title)}</title><style>
    body{font-family:Arial,sans-serif;margin:24px;color:#111827} h1{margin:0;font-size:22px}.meta{color:#64748b;font-size:12px;margin:4px 0 16px}
    .totals{display:flex;gap:8px;margin-bottom:12px}.pill{border:1px solid #dbe3ef;border-radius:6px;padding:8px 12px}.pill b{display:block}
    table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #dbe3ef;padding:5px 7px;text-align:left}th{background:#f1f5f9}
  </style></head><body><h1>${escapeHtml(config.title)}</h1><div class="meta">Company ${escapeHtml(companyCode)} | ${new Date().toLocaleString()}</div><div class="totals">${totals.map((item) => `<div class="pill">${escapeHtml(item.label)}<b>${formatAmount(item.value)}</b></div>`).join("")}</div><table><thead><tr>${config.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

function formatPrintValue(row: LookupRow, column: ReportColumn) {
  const value = firstExisting(row, column.key);
  if (column.kind === "date") return formatCellDate(value);
  if (column.kind === "amount") return formatAmount(Number(value || 0));
  if (column.kind === "mode") return modeLabel(String(value ?? ""));
  if (column.kind === "type") return typeLabel(String(value ?? ""));
  if (column.kind === "status") return statusLabel(String(value ?? "").trim().toUpperCase());
  return formatText(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}
