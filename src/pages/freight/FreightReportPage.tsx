import type { ColumnDef } from "@tanstack/react-table";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { BarChart3, Download, FileSpreadsheet, Filter, Loader2, Printer, RefreshCw, Search, Ship, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
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

const reportMeta: Record<FreightReportKey, { title: string; subtitle: string; icon: typeof FileSpreadsheet; amountFields: string[] }> = {
  enquiry_list: { title: "Enquiry List", subtitle: "Customer freight requirements", icon: FileSpreadsheet, amountFields: [] },
  rfq_list: { title: "RFQ List", subtitle: "Request for quote register", icon: FileSpreadsheet, amountFields: [] },
  quotation_list: { title: "Quotation List", subtitle: "Customer quote register and margin", icon: BarChart3, amountFields: ["TOTAL_SELL", "TOTAL_COST", "PROFIT"] },
  freight_job_list: { title: "Freight Job List", subtitle: "Operational freight jobs", icon: Ship, amountFields: [] },
  freight_profit: { title: "Freight Profit", subtitle: "Revenue, expense, and job profit", icon: BarChart3, amountFields: ["REVENUE", "EXPENSE", "PROFIT"] },
  freight_expense: { title: "Freight Expense", subtitle: "Job activity cost lines", icon: BarChart3, amountFields: ["EXPENSE"] },
  freight_revenue: { title: "Freight Revenue", subtitle: "Job activity billing lines", icon: BarChart3, amountFields: ["REVENUE"] },
  freight_brokerage: { title: "Freight Brokerage", subtitle: "Broker-linked freight jobs", icon: BarChart3, amountFields: ["BROKERAGE_BASE"] },
  deposits: { title: "Deposits", subtitle: "BE and job deposit register", icon: WalletCards, amountFields: ["AMOUNT", "DEMURAGE_AMOUNT"] },
  container_deposit: { title: "Container Deposit", subtitle: "Container deposit ledger", icon: WalletCards, amountFields: ["AMOUNT", "DEMURAGE_AMOUNT"] },
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
  { label: "Cancelled", value: "Y" },
  { label: "Open", value: "O" },
  { label: "Closed", value: "C" },
];

export function FreightReportPage({ reportKey }: { reportKey: FreightReportKey }) {
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const meta = reportMeta[reportKey];
  const Icon = meta.icon;
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
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Generate report to view live Oracle data.");
  const [search, setSearch] = useState("");

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => buildColumns(rows, meta.amountFields), [meta.amountFields, rows]);
  const totals = useMemo(() => buildTotals(rows, meta.amountFields), [meta.amountFields, rows]);

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
      setMessage(nextRows.length ? `${nextRows.length} records loaded.` : "No records found for selected filters.");
    } catch (error: any) {
      setRows([]);
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Unable to generate Freight report.");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilters({ from_date: "", to_date: "", prin_code: "", job_no: "", transport_mode: "", job_type: "", status: "", search: "" });
    setRows([]);
    setSearch("");
    setMessage("Generate report to view live Oracle data.");
  }

  function printReport() {
    const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
    if (!win) return;
    win.document.write(reportHtml(meta.title, companyCode, rows, totals));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  const compactHeight = "calc(100vh - 385px)";

  return (
    <section className="grid gap-3">
      <div className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-white/10">
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">Freight Report</p>
              <h1 className="m-0 truncate text-2xl font-semibold leading-tight">{meta.title}</h1>
              <p className="m-0 text-sm text-slate-200">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill label="Rows" value={String(rows.length)} />
            {totals.map((item) => <Pill key={item.label} label={item.label} value={formatAmount(item.value)} />)}
            <Button type="button" variant="secondary" size="sm" onClick={printReport} disabled={!rows.length}>
              <Printer size={14} /> Print
            </Button>
          </div>
        </div>

        <div className="grid gap-2 p-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.8fr_0.8fr_0.8fr_auto]">
          <Field label="Date From"><Input className="h-8" type="date" value={filters.from_date} onChange={(event) => setFilter(setFilters, "from_date", event.target.value)} /></Field>
          <Field label="Date To"><Input className="h-8" type="date" value={filters.to_date} onChange={(event) => setFilter(setFilters, "to_date", event.target.value)} /></Field>
          <Field label="Principal">
            <LookupField
              value={filters.prin_code}
              onChange={(value) => setFilter(setFilters, "prin_code", value)}
              loadOptions={() => loadLookup(`SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE='${sqlEscape(companyCode)}' ORDER BY PRIN_CODE`)}
              valueField="PRIN_CODE"
              displayFields={["PRIN_CODE", "PRIN_NAME"]}
              columns={[{ field: "PRIN_CODE", header: "Code" }, { field: "PRIN_NAME", header: "Principal" }]}
            />
          </Field>
          <Field label="Job No"><Input className="h-8" value={filters.job_no} onChange={(event) => setFilter(setFilters, "job_no", event.target.value)} /></Field>
          <Field label="Mode"><Select value={filters.transport_mode} options={modeOptions} onChange={(value) => setFilter(setFilters, "transport_mode", value)} /></Field>
          <Field label="Type"><Select value={filters.job_type} options={jobTypeOptions} onChange={(value) => setFilter(setFilters, "job_type", value)} /></Field>
          <div className="flex items-end gap-2">
            <Button type="button" size="sm" className="h-8" onClick={runReport} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Run
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={resetFilters} title="Reset">
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="grid gap-2 border-t bg-muted/20 p-3 md:grid-cols-[0.8fr_1fr_auto]">
          <Field label="Status"><Select value={filters.status} options={statusOptions} onChange={(value) => setFilter(setFilters, "status", value)} /></Field>
          <Field label="Server Search"><Input className="h-8" value={filters.search} onChange={(event) => setFilter(setFilters, "search", event.target.value)} placeholder="Document, job, principal..." /></Field>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={!rows.length} onClick={() => exportCsv(meta.title, rows)}>
              <Download size={14} /> CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-primary" />
            <div>
              <h2 className="m-0 text-sm font-semibold text-foreground">Report Output</h2>
              <p className="m-0 text-xs text-muted-foreground">{message}</p>
            </div>
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
          height={compactHeight}
          minWidth={columns.length > 8 ? 1100 : 860}
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

function Pill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5"><div className="text-[9px] font-semibold uppercase text-cyan-100">{label}</div><div className="text-sm font-semibold text-white">{value}</div></div>;
}

function buildColumns(rows: LookupRow[], amountFields: string[]): ColumnDef<LookupRow>[] {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 24);
  const fallback = ["JOB_NO", "JOB_DATE", "PRIN_CODE", "PRIN_NAME", "TRANSPORT_MODE", "JOB_TYPE", "STATUS"];
  return (keys.length ? keys : fallback).map((key) => ({
    accessorKey: key,
    header: label(key),
    cell: ({ getValue }) => amountFields.includes(key) ? <span className="block text-right font-semibold">{formatAmount(Number(getValue() || 0))}</span> : String(getValue() ?? ""),
  }));
}

function buildTotals(rows: LookupRow[], amountFields: string[]) {
  return amountFields
    .filter((field) => rows.some((row) => row[field] !== undefined && row[field] !== null))
    .map((field) => ({ label: label(field), value: rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) }))
    .slice(0, 3);
}

function setFilter<T extends Record<string, string>>(setter: Dispatch<SetStateAction<T>>, key: keyof T, value: string) {
  setter((current) => ({ ...current, [key]: value }));
}

async function loadLookup(sql: string) {
  const response = await api.post<{ data?: LookupRow[] }>("/api/freight/lookup", { sql });
  return (response.data.data || []).map(normalizeRow);
}

function normalizeRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
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

function reportHtml(title: string, companyCode: string, rows: LookupRow[], totals: { label: string; value: number }[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const tableRows = rows.map((row) => `<tr>${headers.map((key) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;margin:24px;color:#111827} h1{margin:0;font-size:22px} .meta{color:#64748b;font-size:12px;margin:4px 0 16px}
    .totals{display:flex;gap:8px;margin-bottom:12px}.pill{border:1px solid #dbe3ef;border-radius:6px;padding:8px 12px}.pill b{display:block}
    table{border-collapse:collapse;width:100%;font-size:11px} th,td{border:1px solid #dbe3ef;padding:5px 7px;text-align:left} th{background:#f1f5f9}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">Company ${escapeHtml(companyCode)} | ${new Date().toLocaleString()}</div><div class="totals">${totals.map((item) => `<div class="pill">${escapeHtml(item.label)}<b>${formatAmount(item.value)}</b></div>`).join("")}</div><table><thead><tr>${headers.map((key) => `<th>${escapeHtml(label(key))}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}
