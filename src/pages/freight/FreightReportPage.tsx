import type { Dispatch, ReactNode, SetStateAction } from "react";
import { BarChart3, Boxes, CalendarDays, Download, FileSpreadsheet, Filter, Loader2, Printer, RefreshCw, Search, Ship, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { freightSelect } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
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
  | "query_report"
  | "deposits"
  | "container_deposit"
  | "freight_summary";

type ReportColumn = { key: string; label: string; kind?: "date" | "amount" | "status" | "mode" | "type" };
type FilterKey = "date" | "principal" | "job" | "mode" | "type" | "status" | "search";
type AdvancedFilterKey =
  | "principalRange" | "documentRange" | "jobRange" | "confirmDate" | "scheduleDate" | "collectionDate" | "depositDate" | "expiryDate" | "etaDate" | "ataDate"
  | "division" | "departmentRange" | "portRange" | "brokerRange" | "periodMode" | "variant" | "invoice" | "vessel" | "voyage" | "container" | "bl" | "be"
  | "claimExit" | "cleared" | "docRef" | "po" | "summaryParties" | "classification";
type ReportConfig = {
  title: string;
  subtitle: string;
  family: string;
  icon: typeof FileSpreadsheet;
  columns: ReportColumn[];
  amountFields: string[];
  filters: FilterKey[];
  advancedFilters?: AdvancedFilterKey[];
  primaryMetric: string;
};
type ReportFilters = {
  from_date: string;
  to_date: string;
  prin_code: string;
  prin_code_from: string;
  prin_code_to: string;
  job_no: string;
  job_no_from: string;
  job_no_to: string;
  doc_no_from: string;
  doc_no_to: string;
  broker_code_from: string;
  broker_code_to: string;
  dept_code_from: string;
  dept_code_to: string;
  div_code: string;
  origin_port: string;
  destination_port: string;
  schedule_from_date: string;
  schedule_to_date: string;
  confirm_from_date: string;
  confirm_to_date: string;
  collection_from_date: string;
  collection_to_date: string;
  deposit_from_date: string;
  deposit_to_date: string;
  expiry_from_date: string;
  expiry_to_date: string;
  eta_from_date: string;
  eta_to_date: string;
  ata_from_date: string;
  ata_to_date: string;
  transport_mode: string;
  job_type: string;
  status: string;
  report_period: string;
  report_mode: string;
  report_variant: string;
  invoice_no: string;
  vessel_name: string;
  voyage_no: string;
  container_no: string;
  bl_no: string;
  be_no: string;
  claim_ref: string;
  exit_bill1: string;
  exit_bill2: string;
  cleared_flag: string;
  consignee_name: string;
  shipper_name: string;
  job_category: string;
  member_type: string;
  sale_type: string;
  inco_terms: string;
  forwarder_code: string;
  doc_ref: string;
  po_no: string;
  search: string;
};

const reportConfigs: Record<FreightReportKey, ReportConfig> = {
  enquiry_list: {
    title: "Enquiry List",
    subtitle: "Customer freight requirements captured before RFQ or quotation.",
    family: "Commercial Register",
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "mode", "type", "status", "search"],
    advancedFilters: ["principalRange", "documentRange", "portRange", "scheduleDate", "variant"],
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
    filters: ["date", "mode", "type", "status", "search"],
    advancedFilters: ["principalRange", "documentRange", "portRange", "scheduleDate", "variant"],
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
    filters: ["date", "mode", "type", "status", "search"],
    advancedFilters: ["principalRange", "documentRange", "portRange", "scheduleDate", "variant"],
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
    filters: ["date", "mode", "type", "status", "search"],
    advancedFilters: ["jobRange", "principalRange", "confirmDate", "departmentRange", "variant"],
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
    subtitle: "Job profitability with revenue, expense, and margin control.",
    family: "Finance Control",
    icon: BarChart3,
    amountFields: ["REVENUE", "EXPENSE", "PROFIT"],
    filters: ["date", "search"],
    advancedFilters: ["principalRange", "division", "periodMode", "variant"],
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
    filters: ["date", "search"],
    advancedFilters: ["principalRange", "division", "periodMode"],
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
    filters: ["date", "search"],
    advancedFilters: ["principalRange", "division", "periodMode", "variant"],
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
    filters: ["date", "search"],
    advancedFilters: ["brokerRange", "division", "periodMode", "variant"],
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
  query_report: {
    title: "Query Report",
    subtitle: "Shipment query with invoice, vessel, BL, container, and date filters.",
    family: "Operations Query",
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "mode", "type", "search"],
    advancedFilters: ["principalRange", "jobRange", "invoice", "vessel", "voyage", "container", "bl", "be", "etaDate", "ataDate", "scheduleDate", "portRange", "docRef", "po"],
    primaryMetric: "Rows",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "JOB_DATE", label: "Job Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "INVOICE_NO", label: "Invoice No" },
      { key: "VESSEL_NAME", label: "Vessel" },
      { key: "VOYAGE_NO", label: "Voyage" },
      { key: "CONTAINER_NO", label: "Container" },
      { key: "BL_NO", label: "BL No" },
      { key: "BE_NO", label: "BE No" },
    ],
  },
  deposits: {
    title: "Deposits",
    subtitle: "Shipment deposits and demurrage values by job.",
    family: "Settlement",
    icon: WalletCards,
    amountFields: ["AMOUNT", "DEMURAGE_AMOUNT"],
    filters: ["date", "search"],
    advancedFilters: ["principalRange", "be", "collectionDate", "variant"],
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
    filters: ["date", "type", "search"],
    advancedFilters: ["jobRange", "depositDate", "expiryDate", "be", "claimExit", "cleared", "variant"],
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
  freight_summary: {
    title: "Freight Summary Report",
    subtitle: "Mode-wise summary/detail report with PB commercial filters.",
    family: "Modewise Summary",
    icon: BarChart3,
    amountFields: ["REVENUE", "EXPENSE", "PROFIT"],
    filters: ["date", "mode", "type", "search"],
    advancedFilters: ["principalRange", "division", "summaryParties", "classification", "periodMode", "variant"],
    primaryMetric: "Rows",
    columns: [
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "JOB_NO", label: "Job No" },
      { key: "REVENUE", label: "Revenue", kind: "amount" },
      { key: "EXPENSE", label: "Expense", kind: "amount" },
      { key: "PROFIT", label: "Profit", kind: "amount" },
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

const periodOptions = [
  { label: "Daily", value: "D" },
  { label: "Monthly", value: "M" },
  { label: "Yearly", value: "Y" },
];

const reportModeOptions = [
  { label: "Detail", value: "D" },
  { label: "Grouped", value: "G" },
];

const reportVariantOptions = [
  { label: "Standard", value: "" },
  { label: "Analysis", value: "ANALYSIS" },
  { label: "Summary", value: "SUMMARY" },
  { label: "Ledger", value: "LEDGER" },
  { label: "Pending", value: "PENDING" },
  { label: "Collected", value: "COLLECTED" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Non Confirmed", value: "NONCONFIRMED" },
  { label: "Cross Tab", value: "CROSSTAB" },
  { label: "With Child Jobs", value: "WITH_CHILD" },
  { label: "Non Invoiced", value: "NONINVOICED" },
];

const yesNoOptions = [
  { label: "All", value: "" },
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
];

const emptyFilters: ReportFilters = {
  from_date: "",
  to_date: "",
  prin_code: "",
  prin_code_from: "",
  prin_code_to: "",
  job_no: "",
  job_no_from: "",
  job_no_to: "",
  doc_no_from: "",
  doc_no_to: "",
  broker_code_from: "",
  broker_code_to: "",
  dept_code_from: "",
  dept_code_to: "",
  div_code: "",
  origin_port: "",
  destination_port: "",
  schedule_from_date: "",
  schedule_to_date: "",
  confirm_from_date: "",
  confirm_to_date: "",
  collection_from_date: "",
  collection_to_date: "",
  deposit_from_date: "",
  deposit_to_date: "",
  expiry_from_date: "",
  expiry_to_date: "",
  eta_from_date: "",
  eta_to_date: "",
  ata_from_date: "",
  ata_to_date: "",
  transport_mode: "",
  job_type: "",
  status: "",
  report_period: "D",
  report_mode: "D",
  report_variant: "",
  invoice_no: "",
  vessel_name: "",
  voyage_no: "",
  container_no: "",
  bl_no: "",
  be_no: "",
  claim_ref: "",
  exit_bill1: "",
  exit_bill2: "",
  cleared_flag: "",
  consignee_name: "",
  shipper_name: "",
  job_category: "",
  member_type: "",
  sale_type: "",
  inco_terms: "",
  forwarder_code: "",
  doc_ref: "",
  po_no: "",
  search: "",
};

export function FreightReportPage({ reportKey }: { reportKey: FreightReportKey }) {
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const config = reportConfigs[reportKey];
  const Icon = config.icon;
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [principalText, setPrincipalText] = useState("");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Select filters and run the report.");

  const totals = useMemo(() => buildTotals(rows, config.amountFields), [config.amountFields, rows]);
  const visibleFilters = config.filters;
  const userName = String(userRecord.user_id || userRecord.USER_ID || userRecord.username || userRecord.USERNAME || "Admin");

  async function runReport() {
    setLoading(true);
    setMessage("");
    const reportWindow = openReportShell(config.title);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[]; totalCount?: number }>("/api/freight/reports/run", {
        company_code: companyCode,
        report_key: reportKey,
        ...filters,
      });
      const nextRows = (response.data.data || []).map(normalizeRow);
      setRows(nextRows);
      setMessage(nextRows.length ? `${nextRows.length} records loaded from Oracle.` : "No records found for selected filters.");
      writeReportWindow(reportWindow, reportHtml(config, companyCode, userName, filters, principalText, nextRows, buildTotals(nextRows, config.amountFields), true));
    } catch (error: any) {
      setRows([]);
      const errorMessage = error?.response?.data?.details || error?.response?.data?.message || "Unable to generate Freight report.";
      setMessage(errorMessage);
      writeReportWindow(reportWindow, reportErrorHtml(config.title, errorMessage));
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setPrincipalText("");
    setRows([]);
    setMessage("Select filters and run the report.");
  }

  function printReport() {
    if (!rows.length) {
      setMessage("Run the report and load records before printing.");
      return;
    }
    const reportWindow = openReportShell(config.title);
    writeReportWindow(reportWindow, reportHtml(config, companyCode, userName, filters, principalText, rows, totals, true));
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rows.length}
              onClick={() => exportReportExcel(config.title, reportHtml(config, companyCode, userName, filters, principalText, rows, totals, false))}
            >
              <Download size={14} /> Excel
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
                loadOptions={() => loadLookup("freight_principal", companyCode)}
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
            <Field label="Search">
              <Input className="h-8" value={filters.search} onChange={(event) => setFilter(setFilters, "search", event.target.value)} placeholder="Document, job, principal..." />
            </Field>
          </div>
        )}

        {!!config.advancedFilters?.length && (
          <AdvancedReportFilters config={config} companyCode={companyCode} filters={filters} setFilters={setFilters} />
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <ReportTile icon={CalendarDays} label="Period" value={`${toDisplayDate(filters.from_date) || "Start"} - ${toDisplayDate(filters.to_date) || "Today"}`} />
        <ReportTile icon={UserRound} label="Principal" value={principalText || "All principals"} />
        <ReportTile icon={Ship} label="Movement" value={`${optionLabel(modeOptions, filters.transport_mode)} / ${optionLabel(jobTypeOptions, filters.job_type)}`} />
        <ReportTile icon={Filter} label="Status" value={visibleFilters.includes("status") ? optionLabel(statusOptions, filters.status) : "Not applicable"} />
      </div>

      <ReportLaunchPanel
        config={config}
        rows={rows}
        totals={totals}
        loading={loading}
        message={message}
        onOpen={() => printReport()}
      />
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">{label}{children}</label>;
}

function Select({ value, options, onChange }: { value: string; options: { label: string; value: string }[]; onChange: (value: string) => void }) {
  return <select className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select>;
}

function AdvancedReportFilters({
  config,
  companyCode,
  filters,
  setFilters,
}: {
  config: ReportConfig;
  companyCode: string;
  filters: ReportFilters;
  setFilters: Dispatch<SetStateAction<ReportFilters>>;
}) {
  const items = config.advancedFilters || [];
  return (
    <div className="border-t bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Advanced Filters</div>
          {/* <div className="text-xs text-muted-foreground">Refine the report with shipment, commercial, and document criteria.</div> */}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.includes("principalRange") && (
          <RangeLookup label="Principal" companyCode={companyCode} parameter="freight_principal" valueField="PRIN_CODE" displayFields={["PRIN_CODE", "PRIN_NAME"]} columns={[{ field: "PRIN_CODE", header: "Code" }, { field: "PRIN_NAME", header: "Principal" }]} fromKey="prin_code_from" toKey="prin_code_to" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("brokerRange") && (
          <RangeLookup label="Broker" companyCode={companyCode} parameter="freight_broker" valueField="BROKER_CODE" displayFields={["BROKER_CODE", "BROKER_NAME"]} columns={[{ field: "BROKER_CODE", header: "Code" }, { field: "BROKER_NAME", header: "Broker" }]} fromKey="broker_code_from" toKey="broker_code_to" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("jobRange") && <RangeText label="Job No" fromKey="job_no_from" toKey="job_no_to" filters={filters} setFilters={setFilters} />}
        {/* {items.includes("documentRange") && <RangeText label={config.title === "Quotation List" ? "Quotation No" : config.title === "RFQ List" ? "RFQ No" : "Enquiry No"} fromKey="doc_no_from" toKey="doc_no_to" filters={filters} setFilters={setFilters} />} */}
        {items.includes("documentRange") && (
     config.title === "Quotation List" ? (
     <div className="grid grid-cols-2 gap-2">
      <Field label="Quotation No From">
        <LookupField
          value={filters.doc_no_from}
          displayValue={filters.doc_no_from}
          onChange={(value) => setFilter(setFilters, "doc_no_from", value)}
          loadOptions={(query) => loadQuotationSourceLookup(companyCode, filters.transport_mode, filters.job_type, query)}
          valueField="QUOTATION_NR"
          displayFields={["QUOTATION_NR", "PRIN_CODE"]}
          columns={[{ field: "QUOTATION_NR", header: "Quotation No" }, { field: "PRIN_CODE", header: "Principal" }]}
          compact
        />
      </Field>
      <Field label="Quotation No To">
        <LookupField
          value={filters.doc_no_to}
          displayValue={filters.doc_no_to}
          onChange={(value) => setFilter(setFilters, "doc_no_to", value)}
          loadOptions={(query) => loadQuotationSourceLookup(companyCode, filters.transport_mode, filters.job_type, query)}
          valueField="QUOTATION_NR"
          displayFields={["QUOTATION_NR", "PRIN_CODE"]}
          columns={[{ field: "QUOTATION_NR", header: "Quotation No" }, { field: "PRIN_CODE", header: "Principal" }]}
          compact
        />
      </Field>
    </div>
   ) : (
    <RangeLookup
      label={config.title === "RFQ List" ? "RFQ No" : "Enquiry No"}
      companyCode={companyCode}
      // parameter={config.title === "RFQ List" ? "freight_quotation_source" : "freight_approved_enquiry"}
      parameter={config.title === "RFQ List" ? "freight_rfq_report" : "freight_approved_enquiry"}
      valueField="ENQUIRY_NR"
      displayFields={["ENQUIRY_NR", "PRIN_CODE"]}
      columns={[{ field: "ENQUIRY_NR", header: config.title === "RFQ List" ? "RFQ No" : "Enquiry No" }, { field: "PRIN_CODE", header: "Principal" }]}
      fromKey="doc_no_from"
      toKey="doc_no_to"
      filters={filters}
      setFilters={setFilters}
    />
  )
  )}
        {items.includes("departmentRange") && <RangeText label="Department" fromKey="dept_code_from" toKey="dept_code_to" filters={filters} setFilters={setFilters} />}
        {items.includes("portRange") && (
          <>
            <LookupFilter label="Origin Port" companyCode={companyCode} parameter="freight_port" value={filters.origin_port} valueField="PORT_CODE" displayFields={["PORT_CODE", "PORT_NAME"]} columns={[{ field: "PORT_CODE", header: "Code" }, { field: "PORT_NAME", header: "Port" }]} onChange={(value) => setFilter(setFilters, "origin_port", value)} />
            <LookupFilter label="Destination Port" companyCode={companyCode} parameter="freight_port" value={filters.destination_port} valueField="PORT_CODE" displayFields={["PORT_CODE", "PORT_NAME"]} columns={[{ field: "PORT_CODE", header: "Code" }, { field: "PORT_NAME", header: "Port" }]} onChange={(value) => setFilter(setFilters, "destination_port", value)} />
          </>
        )}
        {items.includes("division") && <LookupFilter label="Division" companyCode={companyCode} parameter="freight_division" value={filters.div_code} valueField="DIV_CODE" displayFields={["DIV_CODE", "DIV_NAME"]} columns={[{ field: "DIV_CODE", header: "Code" }, { field: "DIV_NAME", header: "Division" }]} onChange={(value) => setFilter(setFilters, "div_code", value)} />}
        {items.includes("scheduleDate") && <RangeDate label="Schedule" fromKey="schedule_from_date" toKey="schedule_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("confirmDate") && <RangeDate label="Confirm" fromKey="confirm_from_date" toKey="confirm_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("collectionDate") && <RangeDate label="Collection" fromKey="collection_from_date" toKey="collection_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("depositDate") && <RangeDate label="Deposit" fromKey="deposit_from_date" toKey="deposit_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("expiryDate") && <RangeDate label="Expiry" fromKey="expiry_from_date" toKey="expiry_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("etaDate") && <RangeDate label="ETA" fromKey="eta_from_date" toKey="eta_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("ataDate") && <RangeDate label="ATA" fromKey="ata_from_date" toKey="ata_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("periodMode") && (
          <>
            <Field label="Period"><Select value={filters.report_period} options={periodOptions} onChange={(value) => setFilter(setFilters, "report_period", value)} /></Field>
            <Field label="Report Mode"><Select value={filters.report_mode} options={reportModeOptions} onChange={(value) => setFilter(setFilters, "report_mode", value)} /></Field>
          </>
        )}
        {items.includes("variant") && <Field label="Report Variant"><Select value={filters.report_variant} options={reportVariantOptions} onChange={(value) => setFilter(setFilters, "report_variant", value)} /></Field>}
        {items.includes("invoice") && <TextFilter label="Invoice No" fieldKey="invoice_no" filters={filters} setFilters={setFilters} />}
        {items.includes("vessel") && <TextFilter label="Vessel Name" fieldKey="vessel_name" filters={filters} setFilters={setFilters} />}
        {items.includes("voyage") && <TextFilter label="Voyage No" fieldKey="voyage_no" filters={filters} setFilters={setFilters} />}
        {items.includes("container") && <TextFilter label="Container No" fieldKey="container_no" filters={filters} setFilters={setFilters} />}
        {items.includes("bl") && <TextFilter label="BL No" fieldKey="bl_no" filters={filters} setFilters={setFilters} />}
        {items.includes("be") && <TextFilter label="BE No" fieldKey="be_no" filters={filters} setFilters={setFilters} />}
        {items.includes("docRef") && <TextFilter label="Document Ref" fieldKey="doc_ref" filters={filters} setFilters={setFilters} />}
        {items.includes("po") && <TextFilter label="PO No" fieldKey="po_no" filters={filters} setFilters={setFilters} />}
        {items.includes("claimExit") && (
          <>
            <TextFilter label="Claim Ref" fieldKey="claim_ref" filters={filters} setFilters={setFilters} />
            <TextFilter label="Exit Bill 1" fieldKey="exit_bill1" filters={filters} setFilters={setFilters} />
            <TextFilter label="Exit Bill 2" fieldKey="exit_bill2" filters={filters} setFilters={setFilters} />
          </>
        )}
        {items.includes("cleared") && <Field label="Show Cleared"><Select value={filters.cleared_flag} options={yesNoOptions} onChange={(value) => setFilter(setFilters, "cleared_flag", value)} /></Field>}
        {items.includes("summaryParties") && (
          <>
            <TextFilter label="Consignee" fieldKey="consignee_name" filters={filters} setFilters={setFilters} />
            <TextFilter label="Shipper" fieldKey="shipper_name" filters={filters} setFilters={setFilters} />
            <LookupFilter label="Forwarder" companyCode={companyCode} parameter="freight_forwarder" value={filters.forwarder_code} valueField="FORWARDER_CODE" displayFields={["FORWARDER_CODE", "FORWARDER_NAME"]} columns={[{ field: "FORWARDER_CODE", header: "Code" }, { field: "FORWARDER_NAME", header: "Forwarder" }]} onChange={(value) => setFilter(setFilters, "forwarder_code", value)} />
          </>
        )}
        {items.includes("classification") && (
          <>
            <Field label="Job Category"><Select value={filters.job_category} options={[{ label: "All", value: "" }, { label: "International", value: "International" }, { label: "Combined Services", value: "Combined services" }]} onChange={(value) => setFilter(setFilters, "job_category", value)} /></Field>
            <Field label="Member Type"><Input className="h-8" value={filters.member_type} onChange={(event) => setFilter(setFilters, "member_type", event.target.value)} /></Field>
            <Field label="Sale Type"><Input className="h-8" value={filters.sale_type} onChange={(event) => setFilter(setFilters, "sale_type", event.target.value)} /></Field>
            <Field label="INCO Terms"><Input className="h-8" value={filters.inco_terms} onChange={(event) => setFilter(setFilters, "inco_terms", event.target.value)} /></Field>
          </>
        )}
      </div>
    </div>
  );
}

function RangeText({ label, fromKey, toKey, filters, setFilters }: { label: string; fromKey: keyof ReportFilters; toKey: keyof ReportFilters; filters: ReportFilters; setFilters: Dispatch<SetStateAction<ReportFilters>> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <TextFilter label={`${label} From`} fieldKey={fromKey} filters={filters} setFilters={setFilters} />
      <TextFilter label={`${label} To`} fieldKey={toKey} filters={filters} setFilters={setFilters} />
    </div>
  );
}

function RangeDate({ label, fromKey, toKey, filters, setFilters }: { label: string; fromKey: keyof ReportFilters; toKey: keyof ReportFilters; filters: ReportFilters; setFilters: Dispatch<SetStateAction<ReportFilters>> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={`${label} From`}><DateField value={String(filters[fromKey] || "")} onChange={(value) => setFilter(setFilters, fromKey, value)} /></Field>
      <Field label={`${label} To`}><DateField value={String(filters[toKey] || "")} onChange={(value) => setFilter(setFilters, toKey, value)} /></Field>
    </div>
  );
}

function TextFilter({ label, fieldKey, filters, setFilters }: { label: string; fieldKey: keyof ReportFilters; filters: ReportFilters; setFilters: Dispatch<SetStateAction<ReportFilters>> }) {
  return <Field label={label}><Input className="h-8" value={String(filters[fieldKey] || "")} onChange={(event) => setFilter(setFilters, fieldKey, event.target.value)} /></Field>;
}

function RangeLookup({
  label,
  fromKey,
  toKey,
  filters,
  setFilters,
  ...lookup
}: {
  label: string;
  fromKey: keyof ReportFilters;
  toKey: keyof ReportFilters;
  filters: ReportFilters;
  setFilters: Dispatch<SetStateAction<ReportFilters>>;
  companyCode: string;
  parameter: string;
  valueField: string;
  displayFields: string[];
  columns: { field: string; header: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <LookupFilter label={`${label} From`} value={String(filters[fromKey] || "")} onChange={(value) => setFilter(setFilters, fromKey, value)} {...lookup} />
      <LookupFilter label={`${label} To`} value={String(filters[toKey] || "")} onChange={(value) => setFilter(setFilters, toKey, value)} {...lookup} />
    </div>
  );
}

function LookupFilter({
  label,
  companyCode,
  parameter,
  value,
  valueField,
  displayFields,
  columns,
  onChange,
}: {
  label: string;
  companyCode: string;
  parameter: string;
  value: string;
  valueField: string;
  displayFields: string[];
  columns: { field: string; header: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <LookupField
        value={value}
        displayValue={value}
        onChange={(nextValue) => onChange(nextValue)}
        loadOptions={(query) => loadLookup(parameter, companyCode, query)}
        valueField={valueField}
        displayFields={displayFields}
        columns={columns}
        compact
      />
    </Field>
  );
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

function ReportLaunchPanel({
  config,
  rows,
  totals,
  loading,
  message,
  onOpen,
}: {
  config: ReportConfig;
  rows: LookupRow[];
  totals: { label: string; value: number }[];
  loading: boolean;
  message: string;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="m-0 text-sm font-semibold text-foreground">Report Viewer</h2>
          <p className="m-0 text-xs text-muted-foreground">{message}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpen} disabled={!rows.length || loading}>
          <Printer size={14} /> Open Report Window
        </Button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[1.1fr_1fr_1fr]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{config.family}</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{config.title}</div>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Run opens a formatted report viewer with print and Excel actions.</p>
        </div>
        <div className="rounded-md border bg-background p-4">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">{config.primaryMetric}</div>
          <div className="mt-2 text-3xl font-bold text-foreground">{loading ? "..." : rows.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Records loaded</div>
        </div>
        <div className="rounded-md border bg-background p-4">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">Totals</div>
          {totals.length ? (
            <div className="mt-2 grid gap-1">
              {totals.map((item) => <div key={item.label} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.label}</span><strong>{formatAmount(item.value)}</strong></div>)}
            </div>
          ) : (
            <div className="mt-2 text-sm font-semibold text-foreground">No amount totals</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportPreview({
  config,
  companyCode,
  userName,
  filters,
  principalText,
  rows,
  totals,
  loading,
  message,
}: {
  config: ReportConfig;
  companyCode: string;
  userName: string;
  filters: ReportFilters;
  principalText: string;
  rows: LookupRow[];
  totals: { label: string; value: number }[];
  loading: boolean;
  message: string;
}) {
  return (
    <div className="rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <h2 className="m-0 text-sm font-semibold text-foreground">Report Preview</h2>
          <p className="m-0 text-xs text-muted-foreground">{message}</p>
        </div>
        {loading && <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary"><Loader2 size={14} className="animate-spin" /> Loading Oracle report</span>}
      </div>
      <div className="overflow-auto bg-muted/20 p-3">
        <div className="mx-auto min-w-[1120px] max-w-[1320px] border bg-white px-5 py-4 text-slate-900 shadow-sm">
          <ReportHeader config={config} companyCode={companyCode} userName={userName} filters={filters} principalText={principalText} rows={rows} totals={totals} />
          {loading ? (
            <div className="grid min-h-56 place-items-center text-sm font-semibold text-slate-500">Generating report...</div>
          ) : rows.length ? (
            <ReportBody config={config} rows={rows} />
          ) : (
            <div className="grid min-h-56 place-items-center rounded border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">No report rows found for selected filters.</div>
          )}
          <div className="mt-4 border-t pt-2 text-center text-[11px] font-semibold text-slate-500">End of report</div>
        </div>
      </div>
    </div>
  );
}

function ReportHeader({
  config,
  companyCode,
  userName,
  filters,
  principalText,
  rows,
  totals,
}: {
  config: ReportConfig;
  companyCode: string;
  userName: string;
  filters: ReportFilters;
  principalText: string;
  rows: LookupRow[];
  totals: { label: string; value: number }[];
}) {
  return (
    <>
      <div className="border-b-2 border-slate-400 pb-2">
        <div className="mb-2 flex h-14 items-center justify-between border-b border-slate-300">
          <div className="flex items-center gap-3">
            <img src="/bayanat-logo.png" alt="Bayanat Technology" className="h-9 w-9 object-contain" />
            <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-primary">Bayanat Technology</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[1.35fr_1fr] gap-4 border-b border-slate-300 py-2">
        <div>
          <h3 className="m-0 text-xl font-bold uppercase tracking-wide text-slate-950">{config.title}</h3>
          <p className="m-0 text-[11px] text-slate-500">
            {config.family} | Company {companyCode}
            {rows.length ? ` | ${rows.length} record${rows.length === 1 ? "" : "s"}` : ""}
            {totals.map((item) => ` | ${item.label}: ${formatAmount(item.value)}`).join("")}
          </p>
        </div>
        <div className="grid justify-end gap-0.5 text-right text-[11px] text-slate-700">
          <div><span className="inline-block w-14 text-left font-semibold text-slate-900">Date :</span> {formatReportDateTime(new Date())}</div>
          <div><span className="inline-block w-14 text-left font-semibold text-slate-900">User :</span> {userName}</div>
          <div><span className="inline-block w-14 text-left font-semibold text-slate-500">Report :</span> {config.title}</div>
          <div><span className="font-semibold text-slate-900">Page 1 of 1</span></div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-x-4 border-b border-slate-300 py-2 text-[11px] text-slate-700">
        <div><span className="font-semibold text-slate-900">Period:</span> {toDisplayDate(filters.from_date) || "Start"} - {toDisplayDate(filters.to_date) || "Today"}</div>
        <div><span className="font-semibold text-slate-900">Principal:</span> {principalText || "All"}</div>
        <div><span className="font-semibold text-slate-900">Movement:</span> {optionLabel(modeOptions, filters.transport_mode)} / {optionLabel(jobTypeOptions, filters.job_type)}</div>
        <div><span className="font-semibold text-slate-900">Status:</span> {optionLabel(statusOptions, filters.status)}</div>
      </div>
    </>
  );
}

function PrintChip({ label: chipLabel, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded border px-3 py-2 ${strong ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-slate-50"}`}>
      <div className="text-[10px] font-semibold uppercase text-slate-500">{chipLabel}</div>
      <div className="truncate text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function ReportBody({ config, rows }: { config: ReportConfig; rows: LookupRow[] }) {
  if (config.title === "Enquiry List" || config.title === "RFQ List") return <CommercialReport config={config} rows={rows} />;
  if (config.title === "Freight Profit") return <FinanceReport rows={rows} variant="profit" />;
  if (config.title === "Freight Expense") return <FinanceReport rows={rows} variant="expense" />;
  if (config.title === "Freight Revenue") return <FinanceReport rows={rows} variant="revenue" />;
  if (config.title === "Freight Brokerage") return <BrokerageReport rows={rows} />;
  if (config.title === "Container Deposit") return <ContainerReport rows={rows} />;
  return <GenericReport config={config} rows={rows} />;
}

function CommercialReport({ config, rows }: { config: ReportConfig; rows: LookupRow[] }) {
  return (
    <GroupedReport rows={rows}>
      {(groupRows) => (
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="border-y border-slate-500 bg-slate-100 text-center text-[10px] text-slate-900">
              <th className="px-1.5 py-2">Enquiry Nr.</th><th className="px-1.5 py-2">Date</th><th className="px-1.5 py-2">Type</th><th className="px-1.5 py-2">Mode</th>
              <th className="px-1.5 py-2">Origin Port</th><th className="px-1.5 py-2">Destination Port</th><th className="px-1.5 py-2">Cargo Detail</th><th className="px-1.5 py-2">Commodity</th><th className="px-1.5 py-2">Dimension</th><th className="px-1.5 py-2 text-right">Gross Wt</th><th className="px-1.5 py-2 text-right">Volume</th>
            </tr>
          </thead>
          <tbody>
            {groupRows.map((row, index) => (
              <>
                <tr key={`${index}-main`} className="align-top">
                  <td className="px-1.5 py-1.5 text-center font-bold text-primary">{textFrom(row, config.title === "RFQ List" ? ["RFQ_NO", "ENQUIRY_NR"] : ["ENQUIRY_NR"])}</td>
                  <td className="px-1.5 py-1.5">{dateFrom(row, ["RFQ_DATE", "ENQUIRY_DATE"])}</td>
                  <td className="px-1.5 py-1.5 text-center">{typeLabel(textFrom(row, ["JOB_TYPE"]))}</td>
                  <td className="px-1.5 py-1.5 text-center">{modeLabel(textFrom(row, ["TRANSPORT_MODE"]))}</td>
                  <td className="px-1.5 py-1.5">{textFrom(row, ["ORIGIN_PORT", "PORT_CODE"])}</td>
                  <td className="px-1.5 py-1.5">{textFrom(row, ["DESTINATION_PORT"])}</td>
                  <td className="px-1.5 py-1.5">{textFrom(row, ["CARGO_DETAIL", "REMARKS"])}</td>
                  <td className="px-1.5 py-1.5">{textFrom(row, ["COMMODITY"])}</td>
                  <td className="px-1.5 py-1.5">{textFrom(row, ["DIMENSION"])}</td>
                  <td className="px-1.5 py-1.5 text-right">{amountFrom(row, ["GROSS_WT", "WEIGHT"])}</td>
                  <td className="px-1.5 py-1.5 text-right">{amountFrom(row, ["VOLUME"])}</td>
                </tr>
                <tr key={`${index}-sub`} className="border-b border-slate-400 text-slate-700">
                  <td colSpan={11} className="px-1.5 pb-2 pt-0">
                    <span className="font-semibold">Ref Number:</span> {textFrom(row, ["REF_ENQUIRY_TYPE"])} {textFrom(row, ["SOURCE_ENQUIRY", "REF_ENQUIRY_NR", "REFERENCE_ENQUIRY_NR", "JOB_NUMBER"]) || "-"}
                    <span className="ml-8 font-semibold">Carrier:</span> {textFrom(row, ["CARRIER"]) || "-"}
                    <span className="ml-8 font-semibold">Transit Time:</span> {textFrom(row, ["TRANSIT_TIME"]) || "-"}
                    <span className="ml-8 font-semibold">Via:</span> {textFrom(row, ["VIA"]) || "-"}
                    <span className="ml-8 font-semibold">Schedule Date:</span> {dateFrom(row, ["SCHEDULE_DATE"]) || "-"}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      )}
    </GroupedReport>
  );
}

function FinanceReport({ rows, variant }: { rows: LookupRow[]; variant: "profit" | "expense" | "revenue" }) {
  const columns = variant === "profit"
    ? ["Date", "Job No", "Remarks", "Customs Duty", "Demurrage", "Actual Cost", "Partner Cost", "Transport Cost", "Revenue", "Profit"]
    : variant === "expense"
      ? ["Date", "Job No", "Remarks", "Customs Duty", "Expense"]
      : ["Date", "Job No", "Remarks", "Invoice No", "Customs Duty", "Revenue"];
  return (
    <GroupedReport rows={rows}>
      {(groupRows) => (
        <table className="w-full border-collapse text-[11px]">
          <thead><tr className="border-y border-slate-300 bg-slate-100 text-left text-[10px] uppercase text-slate-600">{columns.map((column) => <th key={column} className={`px-2 py-2 ${isAmountHeader(column) ? "text-right" : ""}`}>{column}</th>)}</tr></thead>
          <tbody>
            {groupRows.map((row, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-2 py-2">{dateFrom(row, ["INVOICE_DATE", "JOB_DATE"])}</td>
                <td className="px-2 py-2 font-semibold text-primary">{textFrom(row, ["JOB_NO"])}</td>
                <td className="px-2 py-2">{textFrom(row, ["REMARKS", "ACTIVITY"])}</td>
                {variant === "profit" && <>
                  <AmountCell row={row} keys={["FFCON_BILL", "CUSTOMS_DUTY"]} />
                  <AmountCell row={row} keys={["FFDEM_BILL", "DEMURRAGE"]} />
                  <AmountCell row={row} keys={["ACTUAL_COST", "COST_RATE", "EXPENSE"]} />
                  <AmountCell row={row} keys={["PARTNERS_PRICE", "PARTNER_COST"]} />
                  <AmountCell row={row} keys={["TRANSPORT_PRICE", "TRANSPORT_COST"]} />
                  <AmountCell row={row} keys={["BILL_RATE", "REVENUE"]} />
                  <AmountCell row={row} keys={["PROFIT"]} highlight />
                </>}
                {variant === "expense" && <>
                  <AmountCell row={row} keys={["FFCON_BILL", "CUSTOMS_DUTY"]} />
                  <AmountCell row={row} keys={["ACTUAL_COST", "EXPENSE", "COST_RATE"]} />
                </>}
                {variant === "revenue" && <>
                  <td className="px-2 py-2">{textFrom(row, ["CONSOLIDATED_INVNO", "INVOICE_NO"])}</td>
                  <AmountCell row={row} keys={["FFCON_BILL", "CUSTOMS_DUTY"]} />
                  <AmountCell row={row} keys={["BILL_RATE", "REVENUE"]} />
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GroupedReport>
  );
}

function BrokerageReport({ rows }: { rows: LookupRow[] }) {
  return (
    <GroupedReport rows={rows} groupKeys={["BROKER_CODE", "BROKER_NAME", "PRIN_CODE", "PRIN_NAME"]}>
      {(groupRows) => (
        <SimpleReportTable
          rows={groupRows}
          columns={[
            { key: "JOB_DATE", label: "Date", kind: "date" },
            { key: "JOB_NO", label: "Job No" },
            { key: "REMARKS", label: "Remarks" },
            { key: "COST_RATE", label: "Partner Reimbursable", kind: "amount" },
            { key: "PARTNERS_PRICE", label: "Partner Price", kind: "amount" },
            { key: "BROKERAGE_BASE", label: "Total Payable", kind: "amount" },
          ]}
        />
      )}
    </GroupedReport>
  );
}

function ContainerReport({ rows }: { rows: LookupRow[] }) {
  return (
    <GroupedReport rows={rows}>
      {(groupRows) => (
        <SimpleReportTable
          rows={groupRows}
          columns={[
            { key: "CONTAINER_NO", label: "Container No" },
            { key: "CONTAINER_TYPE", label: "Type" },
            { key: "T_F", label: "Size" },
            { key: "GROSS_WEIGHT", label: "Gross Wt", kind: "amount" },
            { key: "VOLUME", label: "Volume", kind: "amount" },
            { key: "DOC_REF", label: "B/L No" },
            { key: "VESSEL_NAME", label: "Vessel / Airline" },
            { key: "VOYAGE_NO", label: "Voyage" },
            { key: "CONFIRM_DATE", label: "Confirm Date", kind: "date" },
            { key: "JOB_NO", label: "Job No" },
          ]}
        />
      )}
    </GroupedReport>
  );
}

function GenericReport({ config, rows }: { config: ReportConfig; rows: LookupRow[] }) {
  return <GroupedReport rows={rows}>{(groupRows) => <SimpleReportTable rows={groupRows} columns={config.columns} />}</GroupedReport>;
}

function GroupedReport({
  rows,
  children,
  groupKeys = ["PRIN_CODE", "PRIN_NAME"],
}: {
  rows: LookupRow[];
  children: (rows: LookupRow[]) => ReactNode;
  groupKeys?: string[];
}) {
  const groups = groupRows(rows, groupKeys);
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="mb-1 rounded bg-slate-100 px-2 py-1 text-sm font-bold text-slate-900">{group.label}</div>
          {children(group.rows)}
        </div>
      ))}
    </div>
  );
}

function SimpleReportTable({ rows, columns }: { rows: LookupRow[]; columns: ReportColumn[] }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead><tr className="border-y border-slate-300 bg-slate-100 text-left text-[10px] uppercase text-slate-600">{columns.map((column) => <th key={column.key} className={`px-2 py-2 ${column.kind === "amount" ? "text-right" : ""}`}>{column.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-slate-100">
            {columns.map((column) => <td key={column.key} className={`px-2 py-2 ${column.kind === "amount" ? "text-right font-semibold" : ""}`}>{formatPrintValue(row, column)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AmountCell({ row, keys, highlight }: { row: LookupRow; keys: string[]; highlight?: boolean }) {
  return <td className={`px-2 py-2 text-right font-semibold ${highlight ? "text-emerald-700" : ""}`}>{amountFrom(row, keys)}</td>;
}

function groupRows(rows: LookupRow[], keys: string[]) {
  const map = new Map<string, LookupRow[]>();
  rows.forEach((row) => {
    const keyValue = keys.map((key) => textFrom(row, [key])).filter(Boolean).join(" - ") || "Unassigned";
    const existing = map.get(keyValue) || [];
    existing.push(row);
    map.set(keyValue, existing);
  });
  return Array.from(map.entries()).map(([key, value]) => ({ key, label: key, rows: value }));
}

function textFrom(row: LookupRow, keys: string[]) {
  for (const key of keys) {
    const value = firstExisting(row, key);
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function dateFrom(row: LookupRow, keys: string[]) {
  const value = textFrom(row, keys);
  return formatCellDate(value);
}

function amountFrom(row: LookupRow, keys: string[]) {
  for (const key of keys) {
    const value = Number(firstExisting(row, key) || 0);
    if (value !== 0) return formatAmount(value);
  }
  return formatAmount(0);
}

function isAmountHeader(text: string) {
  return /cost|revenue|profit|duty|demurrage|expense/i.test(text);
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

async function loadLookup(parameter: string, companyCode: string, query = "") {
  const rows = await freightSelect<LookupRow>({ parameter, code1: companyCode, code2: query || "NULL", number1: 50 });
  return (Array.isArray(rows) ? rows : []).map(normalizeLookupRow);
}

async function loadQuotationSourceLookup(companyCode: string, transportMode: string, jobType: string, query = "") {
  console.log("Loading quotation source lookup with:", { companyCode, transportMode, jobType, query });
  const rows = await freightSelect<LookupRow>({
    parameter: "frt_quotation_reports",
    code1: companyCode,
    code2: transportMode || "NULL",
    code3: jobType || "NULL",
    code4: query || "NULL",
    number1: 50,
  });
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

function formatReportDateTime(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  let hours = value.getHours();
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${suffix}`;
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
  const blob = new Blob([exportRowsAsCsvString(rows)], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${title.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportReportExcel(title: string, html: string) {
  const excelHtml = html
    .replace(/<body(.*?)>/i, '<body$1 class="excel-export">')
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<div class="viewerbar"[\s\S]*?<\/div><div class="sheet">/i, '<div class="sheet">');
  const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${title.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportRowsAsCsvString(rows: LookupRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))];
  return lines.join("\n");
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function openReportShell(title: string) {
  const win = window.open("", `freight_report_${Date.now()}`, "popup=yes,width=1320,height=860,left=80,top=40,resizable=yes,scrollbars=yes");
  if (!win) return null;
  writeReportWindow(win, reportLoadingHtml(title));
  win.focus();
  return win;
}

function writeReportWindow(win: Window | null, html: string) {
  if (!win) return;
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } catch {
    window.alert("Report popup opened, but browser blocked report rendering. Please allow popups for this site and run again.");
  }
}

function reportLoadingHtml(title: string) {
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{margin:0;font-family:Arial,sans-serif;background:#eef3f9;color:#0f172a}
    .bar{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:white;border-bottom:1px solid #dbe3ef;box-shadow:0 8px 22px rgba(15,23,42,.06)}
    .bar strong{font-size:16px}.bar span{font-size:12px;color:#64748b}
    .loading{height:calc(100vh - 58px);display:grid;place-items:center;text-align:center}
    .box{width:430px;border:1px solid #dbe3ef;background:white;border-radius:12px;padding:30px 34px;box-shadow:0 18px 45px rgba(15,23,42,.10)}
    .spinner{width:32px;height:32px;border:3px solid #dbe3ef;border-top-color:#0b4ca1;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
    .title{font-size:20px;font-weight:800}.sub{margin-top:7px;color:#64748b;font-size:13px}.hint{margin-top:18px;border-radius:8px;background:#f8fafc;padding:10px;color:#475569;font-size:12px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style></head><body><div class="bar"><strong>Freight Report Viewer</strong><span>${escapeHtml(title)}</span></div><div class="loading"><div class="box"><div class="spinner"></div><div class="title">Generating ${escapeHtml(title)}</div><div class="sub">Fetching report data from Oracle...</div><div class="hint">Please keep this window open. The formatted report will appear here automatically.</div></div></div></body></html>`;
}

function reportErrorHtml(title: string, message: string) {
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a}.wrap{height:100vh;display:grid;place-items:center}.card{max-width:720px;border:1px solid #fecdd3;background:white;border-radius:10px;padding:24px;box-shadow:0 12px 30px rgba(15,23,42,.08)}
    h1{margin:0 0 8px;font-size:22px;color:#be123c}pre{white-space:pre-wrap;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px}
    button{height:34px;border:1px solid #cbd5e1;border-radius:8px;background:white;font-weight:700;padding:0 14px;cursor:pointer}
  </style></head><body><div class="wrap"><div class="card"><h1>Report failed</h1><p>Oracle did not return the report data.</p><pre>${escapeHtml(message)}</pre><button onclick="window.close()">Close</button></div></div></body></html>`;
}

function reportHtml(
  config: ReportConfig,
  companyCode: string,
  userName: string,
  filters: ReportFilters,
  principalText: string,
  rows: LookupRow[],
  totals: { label: string; value: number }[],
  interactive = false,
) {
  const body = reportBodyHtml(config, rows);
  const csv = escapeHtml(exportRowsAsCsvString(rows));
  const logoUrl = `${window.location.origin}/bayanat-logo.png`;
  const generatedAt = formatReportDateTime(new Date());
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(config.title)}</title><style>
    @page{size:landscape;margin:14mm}
    body{font-family:Arial,sans-serif;margin:0;color:#0f172a;background:${interactive ? "#eef3f9" : "#fff"}}
    .viewerbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-bottom:1px solid #dbe3ef;padding:10px 18px;box-shadow:0 8px 22px rgba(15,23,42,.06)}
    .viewerbar h1{margin:0;font-size:16px}.viewerbar p{margin:2px 0 0;color:#64748b;font-size:12px}.actions{display:flex;gap:8px}.actions button{height:34px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#0f172a;font-weight:700;padding:0 13px;cursor:pointer}.actions button.primary{background:#0b4ca1;border-color:#0b4ca1;color:white}
    .sheet{padding:${interactive ? "18px" : "0"}}.paper{max-width:1280px;margin:0 auto;background:white;padding:14px;${interactive ? "border:1px solid #dbe3ef;box-shadow:0 18px 42px rgba(15,23,42,.08)" : ""}}
    .logo{height:54px;border-bottom:1px solid #94a3b8;display:flex;align-items:center;justify-content:space-between}.brand-wrap{display:flex;align-items:center;gap:10px}.brand-wrap img{width:36px;height:36px;object-fit:contain}.brand{font-size:12px;font-weight:800;letter-spacing:.28em;color:#0b4ca1;text-transform:uppercase}.system{font-size:10px;font-weight:700;letter-spacing:.18em;color:#64748b;text-transform:uppercase}
    .top{display:grid;grid-template-columns:1.35fr 1fr;gap:20px;border-bottom:1px solid #94a3b8;padding:8px 0}.title{font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin:0}.sub{font-size:11px;color:#64748b;margin-top:2px}
    .meta{margin-left:auto;display:grid;grid-template-columns:max-content 1fr;column-gap:6px;font-size:11px;color:#334155;line-height:1.45}
    .meta>div{display:contents}
    .meta b{color:#0f172a;text-align:left}.params{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;border-bottom:1px solid #cbd5e1;padding:7px 0;font-size:11px;color:#334155}.params b{color:#0f172a}
    .group{margin-top:10px}.group-title{background:#f1f5f9;padding:4px 6px;font-size:13px;font-weight:800}
    table{border-collapse:collapse;width:100%;font-size:10.5px;margin-top:3px}th{background:#f1f5f9;color:#0f172a;font-size:10px;border-top:1px solid #475569;border-bottom:1px solid #475569;padding:6px 5px;text-align:center;font-weight:700}td{padding:4px 5px;vertical-align:top}
    .line2 td,.rowline{border-bottom:1px solid #64748b}.right{text-align:right}.center{text-align:center}.primary-text{color:#0b4ca1;font-weight:800}.profit{color:#047857;font-weight:700}.muted{color:#64748b}.empty{border:1px dashed #cbd5e1;background:#f8fafc;text-align:center;padding:56px;margin-top:14px;color:#64748b;font-weight:700}
    .footer{margin-top:14px;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;font-size:11px;font-weight:700}.aware{text-align:right;font-size:9px;letter-spacing:.22em;color:#0b4ca1;text-transform:uppercase;font-weight:800}
    .excel-export{background:white}.excel-export .sheet{padding:0}.excel-export .paper{max-width:none;width:1600px;margin:0;padding:18px;border:0;box-shadow:none}.excel-export .logo{height:auto;display:block;padding-bottom:8px}.excel-export .brand-wrap{display:block}.excel-export .brand-wrap img{display:none}.excel-export .brand{font-size:18px;letter-spacing:.18em}.excel-export .system{font-size:12px;margin-top:4px}.excel-export .top{display:block;padding:10px 0}.excel-export .title{font-size:24px}.excel-export .sub,.excel-export .meta,.excel-export .params{font-size:12px}.excel-export .meta{text-align:left;margin-top:8px}.excel-export .params{display:block;padding:8px 0}.excel-export .params div{display:inline-block;min-width:300px;margin-right:18px}.excel-export .group-title{font-size:15px;padding:7px 8px}.excel-export table{width:1550px;font-size:12px;mso-displayed-decimal-separator:".";mso-displayed-thousand-separator:","}.excel-export th{font-size:11px;padding:7px 6px}.excel-export td{padding:6px 6px}.excel-export .footer{font-size:12px}.excel-export .aware{font-size:10px}
    @media print{body{background:white}.viewerbar{display:none}.sheet{padding:0}.paper{border:0;box-shadow:none;max-width:none}}
  </style></head><body>${interactive ? `<div class="viewerbar"><div><h1>${escapeHtml(config.title)}</h1><p>${rows.length} rows | ${escapeHtml(principalText || "All principals")} | ${escapeHtml(generatedAt)}</p></div><div class="actions"><button class="primary" onclick="window.print()">Print</button><button onclick="downloadExcel()">Excel</button><button onclick="window.close()">Close</button></div></div>` : ""}<div class="sheet"><div class="paper">
    <div class="logo"><div class="brand-wrap"><img src="${escapeHtml(logoUrl)}" alt="Bayanat Technology"><div class="brand">Bayanat Technology</div></div></div>
    <div class="top"><div><div class="title">${escapeHtml(config.title)}</div><div class="sub">${escapeHtml(config.family)} | Company ${escapeHtml(companyCode)} | ${rows.length} record${rows.length === 1 ? "" : "s"}${totals.map((item) => ` | ${item.label}: ${formatAmount(item.value)}`).join("")}</div></div>
    <div class="meta"><div><b>Date:</b> ${escapeHtml(generatedAt)}</div><div><b>User:</b> ${escapeHtml(userName)}</div><div><b>Report:</b> ${escapeHtml(config.title)}</div><div><b>Page:</b> 1 of 1</div></div></div>
    <div class="params"><div><b>Period:</b> ${escapeHtml(toDisplayDate(filters.from_date) || "Start")} - ${escapeHtml(toDisplayDate(filters.to_date) || "Today")}</div><div><b>Principal:</b> ${escapeHtml(principalText || "All")}</div><div><b>Movement:</b> ${escapeHtml(`${optionLabel(modeOptions, filters.transport_mode)} / ${optionLabel(jobTypeOptions, filters.job_type)}`)}</div><div><b>Status:</b> ${escapeHtml(optionLabel(statusOptions, filters.status))}</div></div>
    ${rows.length ? body : `<div class="empty">No report rows found for selected filters.</div>`}
    <div class="footer">End of report</div><div class="aware"></div>
  </div></div><script>
    const csvText = ${JSON.stringify(csv)};
    function cleanHtmlForExcel(){
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('script,.viewerbar').forEach((node) => node.remove());
      clone.querySelector('body')?.classList.add('excel-export');
      return '<!doctype html>' + clone.outerHTML;
    }
    function downloadExcel(){
      const text = cleanHtmlForExcel();
      const blob = new Blob([text], {type:'application/vnd.ms-excel;charset=utf-8'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = ${JSON.stringify(`${config.title.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xls`)};
      link.click();
      URL.revokeObjectURL(link.href);
    }
  </script></body></html>`;
}

function reportBodyHtml(config: ReportConfig, rows: LookupRow[]) {
  if (config.title === "Enquiry List" || config.title === "RFQ List") return commercialReportHtml(config, rows);
  if (config.title === "Freight Profit") return financeReportHtml(rows, "profit");
  if (config.title === "Freight Expense") return financeReportHtml(rows, "expense");
  if (config.title === "Freight Revenue") return financeReportHtml(rows, "revenue");
  const groups = groupRows(rows, config.title === "Freight Brokerage" ? ["BROKER_CODE", "BROKER_NAME", "PRIN_CODE", "PRIN_NAME"] : ["PRIN_CODE", "PRIN_NAME"]);
  return groups.map((group) => `<div class="group"><div class="group-title">${escapeHtml(group.label)}</div>${simpleTableHtml(group.rows, config.columns)}</div>`).join("");
}

function commercialReportHtml(config: ReportConfig, rows: LookupRow[]) {
  return groupRows(rows, ["PRIN_CODE", "PRIN_NAME"]).map((group) => `<div class="group"><div class="group-title">${escapeHtml(group.label)}</div><table><thead><tr><th>Enquiry Nr.</th><th>Date</th><th>Type</th><th>Mode</th><th>Origin Port</th><th>Destination Port</th><th>Cargo Detail</th><th>Commodity</th><th>Dimension</th><th class="right">Gross Wt</th><th class="right">Volume</th></tr></thead><tbody>${group.rows.map((row) => `<tr><td class="primary-text center">${escapeHtml(textFrom(row, config.title === "RFQ List" ? ["RFQ_NO", "ENQUIRY_NR"] : ["ENQUIRY_NR"]))}</td><td>${escapeHtml(dateFrom(row, ["RFQ_DATE", "ENQUIRY_DATE"]))}</td><td class="center">${escapeHtml(typeLabel(textFrom(row, ["JOB_TYPE"])))}</td><td class="center">${escapeHtml(modeLabel(textFrom(row, ["TRANSPORT_MODE"])))}</td><td>${escapeHtml(textFrom(row, ["ORIGIN_PORT", "PORT_CODE"]))}</td><td>${escapeHtml(textFrom(row, ["DESTINATION_PORT"]))}</td><td>${escapeHtml(textFrom(row, ["CARGO_DETAIL", "REMARKS"]))}</td><td>${escapeHtml(textFrom(row, ["COMMODITY"]))}</td><td>${escapeHtml(textFrom(row, ["DIMENSION"]))}</td><td class="right">${amountFrom(row, ["GROSS_WT", "WEIGHT"])}</td><td class="right">${amountFrom(row, ["VOLUME"])}</td></tr><tr class="line2"><td colspan="11"><b>Ref Number:</b> ${escapeHtml(`${textFrom(row, ["REF_ENQUIRY_TYPE"])} ${textFrom(row, ["SOURCE_ENQUIRY", "REF_ENQUIRY_NR", "REFERENCE_ENQUIRY_NR", "JOB_NUMBER"]) || "-"}`)} <span style="margin-left:26px"><b>Carrier:</b> ${escapeHtml(textFrom(row, ["CARRIER"]) || "-")}</span> <span style="margin-left:26px"><b>Transit Time:</b> ${escapeHtml(textFrom(row, ["TRANSIT_TIME"]) || "-")}</span> <span style="margin-left:26px"><b>Via:</b> ${escapeHtml(textFrom(row, ["VIA"]) || "-")}</span> <span style="margin-left:26px"><b>Schedule Date:</b> ${escapeHtml(dateFrom(row, ["SCHEDULE_DATE"]) || "-")}</span></td></tr>`).join("")}</tbody></table></div>`).join("");
}

function financeReportHtml(rows: LookupRow[], variant: "profit" | "expense" | "revenue") {
  const headers = variant === "profit"
    ? ["Date", "Job No", "Remarks", "Customs Duty", "Demurrage", "Actual Cost", "Partner Cost", "Transport Cost", "Revenue", "Profit"]
    : variant === "expense"
      ? ["Date", "Job No", "Remarks", "Customs Duty", "Expense"]
      : ["Date", "Job No", "Remarks", "Invoice No", "Customs Duty", "Revenue"];
  return groupRows(rows, ["PRIN_CODE", "PRIN_NAME"]).map((group) => `<div class="group"><div class="group-title">${escapeHtml(group.label)}</div><table><thead><tr>${headers.map((header) => `<th class="${isAmountHeader(header) ? "right" : ""}">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${group.rows.map((row) => {
    const common = `<td>${escapeHtml(dateFrom(row, ["INVOICE_DATE", "JOB_DATE"]))}</td><td class="primary-text">${escapeHtml(textFrom(row, ["JOB_NO"]))}</td><td>${escapeHtml(textFrom(row, ["REMARKS", "ACTIVITY"]))}</td>`;
    if (variant === "profit") return `<tr>${common}<td class="right">${amountFrom(row, ["FFCON_BILL", "CUSTOMS_DUTY"])}</td><td class="right">${amountFrom(row, ["FFDEM_BILL", "DEMURRAGE"])}</td><td class="right">${amountFrom(row, ["ACTUAL_COST", "COST_RATE", "EXPENSE"])}</td><td class="right">${amountFrom(row, ["PARTNERS_PRICE", "PARTNER_COST"])}</td><td class="right">${amountFrom(row, ["TRANSPORT_PRICE", "TRANSPORT_COST"])}</td><td class="right">${amountFrom(row, ["BILL_RATE", "REVENUE"])}</td><td class="right profit">${amountFrom(row, ["PROFIT"])}</td></tr>`;
    if (variant === "expense") return `<tr>${common}<td class="right">${amountFrom(row, ["FFCON_BILL", "CUSTOMS_DUTY"])}</td><td class="right">${amountFrom(row, ["ACTUAL_COST", "EXPENSE", "COST_RATE"])}</td></tr>`;
    return `<tr>${common}<td>${escapeHtml(textFrom(row, ["CONSOLIDATED_INVNO", "INVOICE_NO"]))}</td><td class="right">${amountFrom(row, ["FFCON_BILL", "CUSTOMS_DUTY"])}</td><td class="right">${amountFrom(row, ["BILL_RATE", "REVENUE"])}</td></tr>`;
  }).join("")}</tbody></table></div>`).join("");
}

function simpleTableHtml(rows: LookupRow[], columns: ReportColumn[]) {
  return `<table><thead><tr>${columns.map((column) => `<th class="${column.kind === "amount" ? "right" : ""}">${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td class="${column.kind === "amount" ? "right" : ""}">${escapeHtml(formatPrintValue(row, column))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
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
