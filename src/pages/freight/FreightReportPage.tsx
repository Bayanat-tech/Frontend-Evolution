import { openFreightReport } from "../../components/freight/reportPreviewStore";
import { ReportFilterHeader } from "../../components/reports/ReportFilterHeader";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { BarChart3, Boxes, CalendarDays, Download, FileSpreadsheet, Filter, Loader2, Printer, RefreshCw, Search, Ship, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { freightSelect } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
import { Input } from "../../components/ui/Input";
import { MultiSelectField, type MultiSelectOption } from "../../components/ui/MultiSelectField";
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
  | "freight_summary"
  | "freight_tracking"
  | "daily_activity_report"
  | "etd_report"
  | "eta_report"
  | "petty_cash_report";

type ReportColumn = { key: string; label: string; kind?: "date" | "amount" | "status" | "mode" | "type" };
type FilterKey = "date" | "principal" | "job" | "mode" | "type" | "status" | "search";
type AdvancedFilterKey =
  | "principalRange" | "documentRange" | "jobRange" | "confirmDate" | "scheduleDate" | "collectionDate" | "depositDate" | "expiryDate" | "etaDate" | "ataDate"
  | "division" | "departmentRange" | "portRange" | "brokerRange" | "periodMode" | "variant" | "invoice" | "vessel" | "voyage" | "container" | "bl" | "be"
  | "claimExit" | "cleared" | "docRef" | "po" | "summaryParties" | "classification" | "cashier" | "pettyDocumentRange";
type ReportConfig = {
  title: string;
  subtitle: string;
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
  cashier_id: string;
  search: string;
};

const reportConfigs: Record<FreightReportKey, ReportConfig> = {
  enquiry_list: {
    title: "Enquiry List",
    subtitle: "Customer freight requirements captured before RFQ or quotation.",
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "mode", "type", "status"],
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
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "mode", "type", "status"],
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
    icon: BarChart3,
    amountFields: ["TOTAL_SELL", "TOTAL_COST", "PROFIT"],
    filters: ["date", "mode", "type", "status"],
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
    icon: Ship,
    amountFields: [],
    filters: ["date", "mode", "type", "status"],
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
    icon: BarChart3,
    amountFields: ["REVENUE", "EXPENSE", "PARTNERS_SHARE", "TRANSPORT_PRICE", "PROFIT"],
    filters: ["date"],
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
    icon: BarChart3,
    amountFields: ["EXPENSE"],
    filters: ["date"],
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
    icon: BarChart3,
    amountFields: ["REVENUE"],
    filters: ["date"],
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
    icon: WalletCards,
    amountFields: ["BROKERAGE_BASE"],
    filters: ["date"],
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
    icon: FileSpreadsheet,
    amountFields: [],
    filters: ["date", "mode", "type"],
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
    icon: WalletCards,
    amountFields: ["AMOUNT"],
    filters: ["date", "status"],
    advancedFilters: ["principalRange", "jobRange"],
    primaryMetric: "Deposit",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "DEPOSIT_DATE", label: "Deposit Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "BE_NO", label: "BE No" },
      { key: "DEPOSIT_EXPIRY_DATE", label: "Expiry Date", kind: "date" },
      { key: "AMOUNT", label: "Amount", kind: "amount" },
      { key: "CURRENCY", label: "Currency" },
      { key: "STATUS", label: "Status", kind: "status" },
      { key: "DEPOSIT_REMARKS", label: "Remarks" },
    ],
  },
  container_deposit: {
    title: "Container Deposit",
    subtitle: "Container deposit follow-up, expiry, claim, and collection status.",
    icon: Boxes,
    amountFields: ["AMOUNT", "DEMURAGE_AMOUNT"],
    filters: ["date", "type", "status"],
    advancedFilters: ["principalRange", "jobRange"],
    primaryMetric: "Container Deposit",
    columns: [
      { key: "JOB_NO", label: "Job No" },
      { key: "DEPOSIT_DATE", label: "Deposit Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "PRIN_NAME", label: "Principal Name" },
      { key: "DEPOSIT_EXPIRY_DATE", label: "Expiry Date", kind: "date" },
      { key: "BE_NO", label: "BE No" },
      { key: "CLAIM_REF_NO", label: "Claim Ref" },
      { key: "AMOUNT", label: "Amount", kind: "amount" },
      { key: "DEMURAGE_AMOUNT", label: "Demurrage", kind: "amount" },
      { key: "CURRENCY", label: "Currency" },
      { key: "STATUS", label: "Status", kind: "status" },
    ],
  },
  freight_summary: {
    title: "Freight Summary Report",
    subtitle: "Mode-wise summary/detail report with PB commercial filters.",
    icon: BarChart3,
    amountFields: ["REVENUE", "EXPENSE", "PROFIT"],
    filters: ["date", "mode", "type"],
    advancedFilters: ["principalRange", "division", "summaryParties", "classification", "periodMode", "variant"],
    primaryMetric: "Rows",
    columns: [
      { key: "TRANS_MONTH", label: "Month" },
      { key: "TRANS_YEAR", label: "Year" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" },
      { key: "PRIN_CODE", label: "Principal" },
      { key: "GROSS_WT", label: "Gross Weight", kind: "amount" },
      { key: "VOLUME", label: "Volume", kind: "amount" },
      { key: "TEUS", label: "TEUs", kind: "amount" },
      { key: "FEUS", label: "FEUs", kind: "amount" },
      { key: "REVENUE", label: "Revenue", kind: "amount" },
      { key: "EXPENSE", label: "Expense", kind: "amount" },
      { key: "PARTNERS_SHARE", label: "Partner Share", kind: "amount" },
      { key: "TRANSPORT_PRICE", label: "Transport", kind: "amount" },
      { key: "PROFIT", label: "Profit", kind: "amount" },
    ],
  },
  freight_tracking: {
    title: "Freight Tracking",
    subtitle: "PowerBuilder shipment tracking details by principal and freight job.",
    icon: Ship,
    amountFields: [],
    filters: [],
    advancedFilters: ["principalRange", "jobRange"],
    primaryMetric: "Shipments",
    columns: [
      { key: "JOB_NO", label: "Job No" }, { key: "PRIN_CODE", label: "Principal" },
      { key: "DOC_REF", label: "Document Ref" }, { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "TRANSPORT_MODE", label: "Mode", kind: "mode" }, { key: "SHIPPER_NAME", label: "Shipper" },
      { key: "CONSIGNEE_NAME", label: "Consignee" }, { key: "CONTAINER_NO", label: "Container No" },
      { key: "VESSEL_NAME", label: "Vessel" }, { key: "PORT_CODE", label: "Origin" },
      { key: "DESTINATION_PORT", label: "Destination" }, { key: "ETA", label: "ETA", kind: "date" },
      { key: "ETD", label: "ETD", kind: "date" }, { key: "GROSS_WT", label: "Gross Weight", kind: "amount" },
    ],
  },
  daily_activity_report: {
    title: "Daily Activity Report",
    subtitle: "Confirmed freight jobs and daily container/document activity.",
    icon: CalendarDays,
    amountFields: [],
    filters: ["date"],
    advancedFilters: ["principalRange", "jobRange"],
    primaryMetric: "Jobs",
    columns: [
      { key: "JOB_NO", label: "Job No" }, { key: "CONFIRM_DATE", label: "Confirm Date", kind: "date" },
      { key: "PRIN_CODE", label: "Principal" }, { key: "PRIN_NAME", label: "Principal Name" },
      { key: "DOC_REF", label: "Document Ref" }, { key: "JOB_TYPE", label: "Type", kind: "type" },
      { key: "CONTAINER_SIZE", label: "Container Size" }, { key: "NO_OF_CONTAINERS", label: "Containers" },
      { key: "NO_OF_DOCUMENTS", label: "Documents" }, { key: "REMARKS", label: "Remarks" },
    ],
  },
  etd_report: {
    title: "ETD Report",
    subtitle: "PowerBuilder expected-time-of-departure report for export shipments.",
    icon: Ship,
    amountFields: [],
    filters: ["date", "status"],
    advancedFilters: ["principalRange", "jobRange", "portRange"],
    primaryMetric: "Shipments",
    columns: [
      { key: "JOB_NO", label: "Job No" }, { key: "ORDER_NO", label: "Order No" },
      { key: "MOVEMENT", label: "Movement" }, { key: "LOADING_PORT", label: "Loading Port" },
      { key: "DISCHARGE_PORT", label: "Discharge Port" }, { key: "CONTAINER_NO", label: "Container No" },
      { key: "BL_NO", label: "BL No" }, { key: "ETD", label: "ETD", kind: "date" },
      { key: "ETA", label: "ETA", kind: "date" }, { key: "ATA", label: "ATA", kind: "date" },
      { key: "TRANSIT_TIME", label: "Transit Time" }, { key: "DOC_RCVD", label: "Documents Received" },
    ],
  },
  eta_report: {
    title: "ETA Report",
    subtitle: "PowerBuilder expected-time-of-arrival report for sea-import shipments.",
    icon: Ship,
    amountFields: [],
    filters: ["date", "status"],
    advancedFilters: ["principalRange", "jobRange", "portRange"],
    primaryMetric: "Shipments",
    columns: [
      { key: "JOB_NO", label: "Job No" }, { key: "PO_NO", label: "PO No" },
      { key: "CONTAINER_NO", label: "Container No" }, { key: "DOC_REF", label: "Document Ref" },
      { key: "COUNTRY_ORIGIN", label: "Country Origin" }, { key: "PORT_CODE", label: "Origin Port" },
      { key: "DESTINATION_PORT", label: "Destination Port" }, { key: "ETD", label: "ETD", kind: "date" },
      { key: "ETA", label: "ETA", kind: "date" }, { key: "ATA", label: "ATA", kind: "date" },
      { key: "HEALTH_STATUS", label: "Health Status", kind: "status" }, { key: "REMARKS", label: "Remarks" },
    ],
  },
  petty_cash_report: {
    title: "Petty Cash Report",
    subtitle: "PowerBuilder representative-wise petty cash statement and running balance.",
    icon: WalletCards,
    amountFields: ["CREDIT", "DEBIT", "BALANCE"],
    filters: ["date"],
    advancedFilters: ["principalRange", "jobRange", "pettyDocumentRange", "cashier"],
    primaryMetric: "Balance",
    columns: [
      { key: "CASHIER_ID", label: "Representative" }, { key: "DOC_NO", label: "Document No" },
      { key: "CONFIRM_DATE", label: "Document Date", kind: "date" }, { key: "HAWB", label: "Receipt / Ref No" },
      { key: "OTHER_SERVICES", label: "Description" }, { key: "JOB_NO", label: "Job No" },
      { key: "REMARKS", label: "Remarks" }, { key: "PRIN_CODE", label: "Principal / Customer" },
      { key: "CREDIT", label: "Credit", kind: "amount" }, { key: "DEBIT", label: "Debit", kind: "amount" },
      { key: "BALANCE", label: "Balance", kind: "amount" },
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

const shipmentHealthStatusOptions = [
  { label: "All", value: "" },
  { label: "Cleared For Export", value: "CL" },
  { label: "Under Process", value: "UP" },
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
  cashier_id: "",
  search: "",
};

/** Strip MultiSelect "All" so Oracle gets empty/null (no filter). */
function clearAllSentinel(csv: string) {
  if (!csv || csv === "All") return "";
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "All")
    .join(",");
}

/**
 * Fetch company logo directly from MS_COMPANY using raw SQL via API endpoint
 * This is a lightweight query that only fetches logo fields
 */
async function getCompanyLogoDirect(companyCode: string): Promise<string> {
  try {
    // Use the API endpoint that executes raw SQL query on MS_COMPANY
    const response = await api.get<{ 
      success?: boolean; 
      data?: { COMPANY_LOGO_AWSURL?: string; COMPANY_LOGO?: string } 
    }>('/api/freight/company-logo', {
      params: { company_code: companyCode }
    });
    
    const row = response.data?.data ?? {};
    return String(row.COMPANY_LOGO || row.COMPANY_LOGO_AWSURL || "");
  } catch (error) {
    console.error('Failed to fetch company logo:', error);
    return "";
  }
}

export function FreightReportPage({ reportKey }: { reportKey: FreightReportKey }) {
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const config = reportConfigs[reportKey];
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  // Fetch company logo directly from MS_COMPANY using raw SQL via API endpoint
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = await getCompanyLogoDirect(companyCode);
        if (alive) setCompanyLogoUrl(url);
      } catch (error) {
        console.warn('Could not fetch company logo:', error);
        if (alive) setCompanyLogoUrl("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [companyCode]);

  const { options: principalOptions, loading: principalOptionsLoading } = useLookupOptions(
    "freight_principal",
    companyCode,
    "PRIN_CODE",
    ["PRIN_NAME"],
  );
  const principalOptionsMap = useMemo(
    () => Object.fromEntries(principalOptions.map((option) => [option.value, option.label])),
    [principalOptions],
  );
  const principalSelectedCodes = useMemo(() => {
    const advanced = splitCsv(filters.prin_code_from);
    if (advanced.length) return advanced;
    return splitCsv(filters.prin_code);
  }, [filters.prin_code_from, filters.prin_code]);
  const principalDisplayText = principalSelectedCodes
    .map((code) => principalOptionsMap[code] || code)
    .join(", ");

  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Select filters and run the report.");

  const totals = useMemo(() => buildTotals(rows, config.amountFields), [config.amountFields, rows]);
  const visibleFilters = config.filters;
  const userName = String(userRecord.user_id || userRecord.USER_ID || userRecord.username || userRecord.USERNAME || "Admin");

  async function runReport() {
    setLoading(true);
    setMessage("");
    const preview = openFreightReport(config.title);
    try {
      const payload = {
        company_code: companyCode,
        report_key: reportKey,
        ...filters,
        prin_code_from: clearAllSentinel(filters.prin_code_from || filters.prin_code),
        prin_code_to: "",
        job_no_from: clearAllSentinel(filters.job_no_from),
        job_no_to: "",
        dept_code_from: clearAllSentinel(filters.dept_code_from),
        dept_code_to: "",
        doc_no_from: clearAllSentinel(filters.doc_no_from),
        doc_no_to: "",
      };
      const response = await api.post<{ success?: boolean; data?: LookupRow[]; totalCount?: number }>("/api/freight/reports/run", payload);
      if (response.data.success === false) throw new Error("Unable to generate report.");
      const nextRows = (response.data.data || []).map(normalizeRow);
      setRows(nextRows);
      setMessage(nextRows.length ? `${nextRows.length} records in the report.` : "No records found for selected filters.");
      const companyResponse = await api.get<{ data?: Record<string, string> }>("/api/freight/company-logo", { params: { company_code: companyCode } });
      const companyRow = companyResponse.data.data || {};
      const company = {
        name: companyRow.COMPANY_NAME || String(userRecord.company_name || userRecord.COMPANY_NAME || companyCode),
        logo: companyRow.COMPANY_LOGO || companyRow.COMPANY_LOGO_AWSURL || "",
        address: [companyRow.ADDRESS1, companyRow.ADDRESS2, companyRow.ADDRESS3, [companyRow.CITY, companyRow.COUNTRY].filter(Boolean).join(", ")].filter(Boolean),
      };
      // Prioritize portrait first; switch to landscape only when columns exceed 9
      // Columns > 6 will cut in portrait (e.g. Job List has 9 cols), so default to landscape! Narrow reports (Revenue, Expense) default to portrait.
      const isLandscape = config.columns.filter((c) => !["PRIN_CODE", "PRIN_NAME"].includes(c.key.toUpperCase())).length > 6;
      const orientation: "portrait" | "landscape" = isLandscape ? "landscape" : "portrait";
      preview.ready({ company, html: reportHtml(config, companyCode, userName, filters, principalDisplayText, nextRows, buildTotals(nextRows, config.amountFields), false, companyLogoUrl, orientation), filename: config.title, orientation });
    } catch (error: any) {
      setRows([]);
      const errorMessage = error?.response?.data?.details || error?.response?.data?.message || "Unable to generate Freight report.";
      setMessage(errorMessage);
      preview.fail(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setRows([]);
    setMessage("Select filters and run the report.");
  }


  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>{config.title}</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
          <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
            <SummaryBadge label="Records" value={String(rows.length)} />
            {totals.map((item) => (
              <SummaryBadge key={item.label} label={item.label} value={formatAmount(item.value)} strong />
            ))}
          </div>
        </div>

        <ReportFilterHeader onClear={resetFilters} />

        <div className="freight-report-summary grid grid-cols-2 gap-2 border-b bg-muted/10 p-3 md:grid-cols-4">
          <SummaryStripItem icon={CalendarDays} label="Period" value={`${toDisplayDate(filters.from_date) || "Start"} – ${toDisplayDate(filters.to_date) || "Today"}`} />
          <SummaryStripItem icon={UserRound} label="Principal" value={principalDisplayText || "All principals"} />
          <SummaryStripItem icon={Ship} label="Movement" value={`${optionLabel(modeOptions, filters.transport_mode)} / ${optionLabel(jobTypeOptions, filters.job_type)}`} />
          <SummaryStripItem icon={Filter} label="Status" value={visibleFilters.includes("status") ? optionLabel(statusOptions, filters.status) : "Not applicable"} />
        </div>

        {!!config.advancedFilters?.length && (
          <AdvancedReportFilters
            phase="before"
            config={config}
            companyCode={companyCode}
            filters={filters}
            setFilters={setFilters}
            principalOptions={principalOptions}
            principalOptionsLoading={principalOptionsLoading}
          />
        )}

        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleFilters.includes("date") && (
            <>
              <Field label="From">
                <DateField value={filters.from_date} onChange={(value) => setFilter(setFilters, "from_date", value)} />
              </Field>
              <Field label="To">
                <DateField value={filters.to_date} onChange={(value) => setFilter(setFilters, "to_date", value)} />
              </Field>
            </>
          )}
          {visibleFilters.includes("principal") && (
            <MultiSelectField
              className="freight-report-multi-select"
              label="Principal"
              options={principalOptions}
              loading={principalOptionsLoading}
              value={splitCsv(filters.prin_code)}
              onChange={(next) => setFilter(setFilters, "prin_code", next.join(","))}
            />
          )}
          {visibleFilters.includes("job") && (
            <Field label="Job No">
              <Input className="h-8" value={filters.job_no} onChange={(event) => setFilter(setFilters, "job_no", event.target.value)} />
            </Field>
          )}
          {visibleFilters.includes("mode") && (
            <Field label="Mode">
              <Select value={filters.transport_mode} options={modeOptions} onChange={(value) => setFilter(setFilters, "transport_mode", value)} />
            </Field>
          )}
          {visibleFilters.includes("type") && (
            <Field label="Type">
              <Select value={filters.job_type} options={jobTypeOptions} onChange={(value) => setFilter(setFilters, "job_type", value)} />
            </Field>
          )}
          {visibleFilters.includes("status") && (
            <Field label="Status">
              <Select
                value={filters.status}
                options={reportKey === "eta_report" || reportKey === "etd_report" ? shipmentHealthStatusOptions : statusOptions}
                onChange={(value) => setFilter(setFilters, "status", value)}
              />
            </Field>
          )}
        </div>

        {visibleFilters.includes("search") && (
          <div className="freight-report-search border-t bg-muted/20 p-3">
            <Field label="Search">
              <Input
                className="h-8"
                value={filters.search}
                onChange={(event) => setFilter(setFilters, "search", event.target.value)}
                placeholder="Document, job, principal..."
              />
            </Field>
          </div>
        )}

        {!!config.advancedFilters?.length && (
          <AdvancedReportFilters
            phase="after"
            config={config}
            companyCode={companyCode}
            filters={filters}
            setFilters={setFilters}
            principalOptions={principalOptions}
            principalOptionsLoading={principalOptionsLoading}
          />
        )}

        <div className="freight-report-actions">
          <Button type="button" size="sm" onClick={runReport} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
          </Button>
        </div>
        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function AdvancedReportFilters({
  phase,
  config,
  companyCode,
  filters,
  setFilters,
  principalOptions,
  principalOptionsLoading,
}: {
  phase: "before" | "after";
  config: ReportConfig;
  companyCode: string;
  filters: ReportFilters;
  setFilters: Dispatch<SetStateAction<ReportFilters>>;
  principalOptions: MultiSelectOption[];
  principalOptionsLoading: boolean;
}) {
  const leadingItems = new Set<AdvancedFilterKey>([
    "principalRange",
    "brokerRange",
    "jobRange",
    "documentRange",
    "departmentRange",
    "portRange",
  ]);
  const items = (config.advancedFilters || []).filter((item) =>
    phase === "before" ? leadingItems.has(item) : !leadingItems.has(item),
  );
  if (!items.length) return null;
  return (
    <div className="freight-report-criteria bg-background px-3 pb-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.includes("principalRange") && (
          <MultiSelectField
            className="freight-report-multi-select"
            label="Principal"
            options={principalOptions}
            loading={principalOptionsLoading}
            value={splitCsv(filters.prin_code_from)}
            onChange={(next) => setFilter(setFilters, "prin_code_from", next.join(","))}
          />
        )}
        {items.includes("brokerRange") && (
  <LookupMultiFilter
    label="Broker"
    companyCode={companyCode}
    parameter="freight_broker"
    value={filters.broker_code_from}
    valueField="BROKER_CODE"
    displayFields={["BROKER_CODE", "BROKER_NAME"]}
    onChange={(value) => setFilter(setFilters, "broker_code_from", value)}
  />
)}
        {items.includes("jobRange") && (
          <LookupMultiFilter
            label="Job No"
            companyCode={companyCode}
            parameter="frt_jobNo"
            value={filters.job_no_from}
            valueField="JOB_NO"
            displayFields={["JOB_NO"]}
            onChange={(value) => setFilter(setFilters, "job_no_from", value)}
          />
        )}
        {items.includes("documentRange") &&
          (config.title === "Quotation List" ? (
            <div className="grid grid-cols-2 gap-2">
              <QuotationMultiField
                label="Quotation No From"
                companyCode={companyCode}
                transportMode={filters.transport_mode}
                jobType={filters.job_type}
                value={filters.doc_no_from}
                onChange={(value) => setFilter(setFilters, "doc_no_from", value)}
              />
              <QuotationMultiField
                label="Quotation No To"
                companyCode={companyCode}
                transportMode={filters.transport_mode}
                jobType={filters.job_type}
                value={filters.doc_no_to}
                onChange={(value) => setFilter(setFilters, "doc_no_to", value)}
              />
            </div>
          ) : (
          //   <RangeLookup
          //     label={config.title === "RFQ List" ? "RFQ No" : "Enquiry No"}
          //     companyCode={companyCode}
          //     parameter={config.title === "RFQ List" ? "freight_rfq_report" : "freight_approved_enquiry"}
          //     valueField="ENQUIRY_NR"
          //     displayFields={["ENQUIRY_NR", "PRIN_CODE"]}
          //     fromKey="doc_no_from"
          //     toKey="doc_no_to"
          //     filters={filters}
          //     setFilters={setFilters}
          //   />
          // ))}

          <LookupMultiFilter
            label={config.title === "RFQ List" ? "RFQ No" : "Enquiry No"}
            companyCode={companyCode}
            parameter={config.title === "RFQ List" ? "freight_rfq_report" : "freight_approved_enquiry"}
            valueField="ENQUIRY_NR"
            displayFields={["ENQUIRY_NR", "PRIN_CODE"]}
            value={filters.doc_no_from}
            onChange={(value) => setFilter(setFilters, "doc_no_from", value)}
           />
         ))}
        {items.includes("departmentRange") && (
          <LookupMultiFilter
            label="Department"
            companyCode={companyCode}
            parameter="freight_department"
            value={filters.dept_code_from}
            valueField="DEPT_CODE"
            displayFields={["DEPT_CODE", "DEPT_NAME"]}
            onChange={(value) => setFilter(setFilters, "dept_code_from", value)}
          />
        )}
        {items.includes("portRange") && (
          <>
            <LookupMultiFilter
              label="Origin Port"
              companyCode={companyCode}
              parameter="freight_port"
              value={filters.origin_port}
              valueField="PORT_CODE"
              displayFields={["PORT_CODE", "PORT_NAME"]}
              onChange={(value) => setFilter(setFilters, "origin_port", value)}
            />
            <LookupMultiFilter
              label="Destination Port"
              companyCode={companyCode}
              parameter="freight_port"
              value={filters.destination_port}
              valueField="PORT_CODE"
              displayFields={["PORT_CODE", "PORT_NAME"]}
              onChange={(value) => setFilter(setFilters, "destination_port", value)}
            />
          </>
        )}
        {items.includes("division") && (
          <LookupMultiFilter
            label="Division"
            companyCode={companyCode}
            parameter="freight_division"
            value={filters.div_code}
            valueField="DIV_CODE"
            displayFields={["DIV_CODE", "DIV_NAME"]}
            onChange={(value) => setFilter(setFilters, "div_code", value)}
          />
        )}
        {items.includes("scheduleDate") && (
          <RangeDate label="Schedule" fromKey="schedule_from_date" toKey="schedule_to_date" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("confirmDate") && (
          <RangeDate label="Confirm" fromKey="confirm_from_date" toKey="confirm_to_date" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("collectionDate") && (
          <RangeDate label="Collection" fromKey="collection_from_date" toKey="collection_to_date" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("depositDate") && (
          <RangeDate label="Deposit" fromKey="deposit_from_date" toKey="deposit_to_date" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("expiryDate") && (
          <RangeDate label="Expiry" fromKey="expiry_from_date" toKey="expiry_to_date" filters={filters} setFilters={setFilters} />
        )}
        {items.includes("etaDate") && <RangeDate label="ETA" fromKey="eta_from_date" toKey="eta_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("ataDate") && <RangeDate label="ATA" fromKey="ata_from_date" toKey="ata_to_date" filters={filters} setFilters={setFilters} />}
        {items.includes("periodMode") && (
          <>
            <Field label="Period">
              <Select value={filters.report_period} options={periodOptions} onChange={(value) => setFilter(setFilters, "report_period", value)} />
            </Field>
            <Field label="Report Mode">
              <Select value={filters.report_mode} options={reportModeOptions} onChange={(value) => setFilter(setFilters, "report_mode", value)} />
            </Field>
          </>
        )}
        {items.includes("variant") && (
          <Field label="Report Variant">
            <Select value={filters.report_variant} options={reportVariantOptions} onChange={(value) => setFilter(setFilters, "report_variant", value)} />
          </Field>
        )}
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
        {items.includes("cleared") && (
          <Field label="Show Cleared">
            <Select value={filters.cleared_flag} options={yesNoOptions} onChange={(value) => setFilter(setFilters, "cleared_flag", value)} />
          </Field>
        )}
        {items.includes("summaryParties") && (
          <>
            <TextFilter label="Consignee" fieldKey="consignee_name" filters={filters} setFilters={setFilters} />
            <TextFilter label="Shipper" fieldKey="shipper_name" filters={filters} setFilters={setFilters} />
            <LookupMultiFilter
              label="Forwarder"
              companyCode={companyCode}
              parameter="freight_forwarder"
              value={filters.forwarder_code}
              valueField="FORWARDER_CODE"
              displayFields={["FORWARDER_CODE", "FORWARDER_NAME"]}
              onChange={(value) => setFilter(setFilters, "forwarder_code", value)}
            />
          </>
        )}
        {items.includes("classification") && (
          <>
            <Field label="Job Category">
              <Select
                value={filters.job_category}
                options={[
                  { label: "All", value: "" },
                  { label: "International", value: "International" },
                  { label: "Combined Services", value: "Combined services" },
                ]}
                onChange={(value) => setFilter(setFilters, "job_category", value)}
              />
            </Field>
            <Field label="Member Type">
              <Input className="h-8" value={filters.member_type} onChange={(event) => setFilter(setFilters, "member_type", event.target.value)} />
            </Field>
            <Field label="Sale Type">
              <Input className="h-8" value={filters.sale_type} onChange={(event) => setFilter(setFilters, "sale_type", event.target.value)} />
            </Field>
            <Field label="INCO Terms">
              <Input className="h-8" value={filters.inco_terms} onChange={(event) => setFilter(setFilters, "inco_terms", event.target.value)} />
            </Field>
          </>
        )}
        {items.includes("cashier") && <TextFilter label="Representative / Cashier" fieldKey="cashier_id" filters={filters} setFilters={setFilters} />}
        {items.includes("pettyDocumentRange") && (
          <RangeText label="Document No" fromKey="doc_no_from" toKey="doc_no_to" filters={filters} setFilters={setFilters} />
        )}
      </div>
    </div>
  );
}

function RangeText({
  label,
  fromKey,
  toKey,
  filters,
  setFilters,
}: {
  label: string;
  fromKey: keyof ReportFilters;
  toKey: keyof ReportFilters;
  filters: ReportFilters;
  setFilters: Dispatch<SetStateAction<ReportFilters>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <TextFilter label={`${label} From`} fieldKey={fromKey} filters={filters} setFilters={setFilters} />
      <TextFilter label={`${label} To`} fieldKey={toKey} filters={filters} setFilters={setFilters} />
    </div>
  );
}

function RangeDate({
  label,
  fromKey,
  toKey,
  filters,
  setFilters,
}: {
  label: string;
  fromKey: keyof ReportFilters;
  toKey: keyof ReportFilters;
  filters: ReportFilters;
  setFilters: Dispatch<SetStateAction<ReportFilters>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={`${label} From`}>
        <DateField value={String(filters[fromKey] || "")} onChange={(value) => setFilter(setFilters, fromKey, value)} />
      </Field>
      <Field label={`${label} To`}>
        <DateField value={String(filters[toKey] || "")} onChange={(value) => setFilter(setFilters, toKey, value)} />
      </Field>
    </div>
  );
}

function TextFilter({
  label,
  fieldKey,
  filters,
  setFilters,
}: {
  label: string;
  fieldKey: keyof ReportFilters;
  filters: ReportFilters;
  setFilters: Dispatch<SetStateAction<ReportFilters>>;
}) {
  return (
    <Field label={label}>
      <Input className="h-8" value={String(filters[fieldKey] || "")} onChange={(event) => setFilter(setFilters, fieldKey, event.target.value)} />
    </Field>
  );
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
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <LookupMultiFilter label={`${label} From`} value={String(filters[fromKey] || "")} onChange={(value) => setFilter(setFilters, fromKey, value)} {...lookup} />
      <LookupMultiFilter label={`${label} To`} value={String(filters[toKey] || "")} onChange={(value) => setFilter(setFilters, toKey, value)} {...lookup} />
    </div>
  );
}

function LookupMultiFilter({
  label,
  companyCode,
  parameter,
  value,
  valueField,
  displayFields,
  onChange,
}: {
  label: string;
  companyCode: string;
  parameter: string;
  value: string;
  valueField: string;
  displayFields: string[];
  onChange: (value: string) => void;
}) {
  const { options, loading } = useLookupOptions(parameter, companyCode, valueField, displayFields);
  return (
    <MultiSelectField
      className="freight-report-multi-select"
      label={label}
      options={options}
      loading={loading}
      value={splitCsv(value)}
      onChange={(next) => onChange(next.join(","))}
    />
  );
}

function QuotationMultiField({
  label,
  companyCode,
  transportMode,
  jobType,
  value,
  onChange,
}: {
  label: string;
  companyCode: string;
  transportMode: string;
  jobType: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadQuotationSourceLookup(companyCode, transportMode, jobType)
      .then((rows) => {
        if (!alive) return;
        setOptions(
          rows.map((row) => ({
            value: lookupText(row, "QUOTATION_NR"),
            label: [lookupText(row, "QUOTATION_NR"), lookupText(row, "PRIN_CODE")].filter(Boolean).join(" - "),
          })),
        );
      })
      .catch(() => {
        if (alive) setOptions([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [companyCode, transportMode, jobType]);

  return (
    <MultiSelectField
      className="freight-report-multi-select"
      label={label}
      options={options}
      loading={loading}
      value={splitCsv(value)}
      onChange={(next) => onChange(next.join(","))}
    />
  );
}

function useLookupOptions(parameter: string, companyCode: string, valueField: string, labelFields: string[]) {
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadLookup(parameter, companyCode)
      .then((rows) => {
        if (!alive) return;
        setOptions(
          rows.map((row) => {
            const value = lookupText(row, valueField);
            const labelParts = labelFields.map((field) => lookupText(row, field)).filter(Boolean);
            const label =
              labelParts.length === 0
                ? value
                : labelParts.length === 1 && labelParts[0] === value
                  ? value
                  : labelParts.join(" - ");
            return { value, label };
          }),
        );
      })
      .catch(() => {
        if (alive) setOptions([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [parameter, companyCode, valueField, labelFields.join("|")]);

  return { options, loading };
}

function splitCsv(value: string) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <BiscDatePicker value={toInputDate(value)} onChange={onChange} />;
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
        <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function setFilter<T extends Record<string, string>>(setter: Dispatch<SetStateAction<T>>, key: keyof T, value: string) {
  setter((current) => ({ ...current, [key]: value }));
}

async function loadLookup(parameter: string, companyCode: string, query = "") {
  const rows = await freightSelect<LookupRow>({ parameter, code1: companyCode, code2: query || "NULL", number1: 50 });
  return (Array.isArray(rows) ? rows : []).map(normalizeLookupRow);
}

async function loadQuotationSourceLookup(companyCode: string, transportMode: string, jobType: string, query = "") {
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

function buildTotals(rows: LookupRow[], amountFields: string[]) {
  return amountFields
    .map((field) => ({
      label: label(field),
      value: rows.reduce((sum, row) => sum + Number(firstExisting(row, field) || 0), 0),
    }))
    .filter((item) => item.value !== 0)
    .slice(0, 3);
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
  companyLogoUrl = "",
  orientation: "portrait" | "landscape" = "portrait",
) {
  const body = reportBodyHtml(config, rows);
  const logoUrl = companyLogoUrl || `${window.location.origin}/bayanat-logo.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(config.title)}</title><style>
    @page{size:${orientation};margin:12mm}
    body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;color:#0f172a;background:${interactive ? "#eef3f9" : "#fff"}}
    .viewerbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-bottom:1px solid #dbe3ef;padding:10px 18px}
    .viewerbar h1{margin:0;font-size:16px;color:#00378c;font-weight:700}.viewerbar p{margin:2px 0 0;color:#64748b;font-size:12px}
    .actions{display:flex;gap:8px}.actions button{height:34px;border:1px solid #cbd5e1;border-radius:8px;background:white;font-weight:700;padding:0 13px;cursor:pointer}
    .actions button.primary{background:#00378c;border-color:#00378c;color:white}
    .sheet{padding:${interactive ? "18px" : "0"}}.paper{max-width:${orientation === "landscape" ? "1280px" : "850px"};margin:0 auto;background:white;padding:14px;${interactive ? "border:1px solid #dbe3ef;box-shadow:0 18px 42px rgba(15,23,42,.08)" : ""}}
    .logo{height:54px;border-bottom:1.5px solid #00378c;display:flex;align-items:center;justify-content:space-between}
    .brand-wrap{display:flex;align-items:center;gap:10px}.brand-wrap img{width:36px;height:36px;object-fit:contain}
    .brand{font-size:12px;font-weight:800;letter-spacing:.28em;color:#00378c;text-transform:uppercase}
    .top{border-bottom:1.5px solid #00378c;padding:10px 0 6px 0}
    .title{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin:0;color:#00378c}
    .group{margin-top:14px}
    .group-title{background:#eaf0f8;padding:5px 8px;font-size:11px;font-weight:700;color:#00378c;border-left:3px solid #00378c;border-radius:2px}
    table{border-collapse:collapse;width:100%;font-size:9.5px;margin-top:4px}
    th{background:#00378c;color:#ffffff;font-size:9.5px;border:1px solid #00378c;padding:5px 6px;text-align:center;font-weight:700;letter-spacing:.02em}
    td{padding:4px 6px;vertical-align:top;border-bottom:1px solid #e2e8f0;font-size:9.5px}.right{text-align:right}.center{text-align:center}.primary-text{color:#00378c;font-weight:700}
    .subtotal-row{background:#f8fafc;font-weight:700;color:#00378c}
    .subtotal-row td{border-top:1px solid #94a3b8;border-bottom:1px solid #94a3b8;padding:5px 6px;font-weight:700;color:#00378c}
    .grand-total-wrap{margin-top:18px}
    .grand-total-title{background:#00378c;color:#ffffff;border-left:none;font-weight:800;font-size:11px;padding:6px 8px}
    .grand-total-row{background:#e2e8f0;font-weight:800;color:#00378c;font-size:10px}
    .grand-total-row td{border-top:2px solid #00378c;border-bottom:2px solid #00378c;padding:6px 6px;font-weight:800;color:#00378c}
    .font-bold{font-weight:700}
    .empty{border:1px dashed #cbd5e1;background:#f8fafc;text-align:center;padding:56px;margin-top:14px;color:#64748b;font-weight:700}
    .footer{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:6px;text-align:center;font-size:10px;font-weight:600;color:#64748b}
    @media print{body{background:white}.viewerbar{display:none}.sheet{padding:0}.paper{border:0;box-shadow:none;max-width:none}}
  </style></head><body>${
    interactive
      ? `<div class="viewerbar"><div><h1>${escapeHtml(config.title)}</h1></div><div class="actions"><button class="primary" onclick="window.print()">Print</button><button onclick="downloadExcel()">Excel</button><button onclick="window.close()">Close</button></div></div>`
      : ""
  }<div class="sheet"><div class="paper">
    <div class="logo"><div class="brand-wrap"><img src="${escapeHtml(logoUrl)}" alt="Company logo"><div class="brand">Bayanat Technology</div></div></div>
    <div class="top"><div><div class="title">${escapeHtml(config.title)}</div></div></div>
    ${rows.length ? body : `<div class="empty">No report rows found for selected filters.</div>`}
    <div class="footer">End of report</div>
  </div></div></body></html>`;
}

function reportBodyHtml(config: ReportConfig, rows: LookupRow[]) {
  if (config.title === "Enquiry List" || config.title === "RFQ List") return commercialReportHtml(config, rows);
  if (config.title === "Freight Profit") return financeReportHtml(rows, "profit");
  if (config.title === "Freight Expense") return financeReportHtml(rows, "expense");
  if (config.title === "Freight Revenue") return financeReportHtml(rows, "revenue");

  const groups = groupRows(rows, config.title === "Freight Brokerage" ? ["BROKER_CODE", "BROKER_NAME", "PRIN_CODE", "PRIN_NAME"] : ["PRIN_CODE", "PRIN_NAME"]);
  const filteredColumns = config.columns.filter((column) => !["PRIN_CODE", "PRIN_NAME"].includes(column.key.toUpperCase()));

  const groupsHtml = groups
    .map((group) => `<div class="group"><div class="group-title">${escapeHtml(group.label)}</div>${simpleTableHtml(group.rows, filteredColumns, group.label)}</div>`)
    .join("");

  const grandTotalHtml = renderSimpleGrandTotal(rows, filteredColumns);
  return groupsHtml + grandTotalHtml;
}

function commercialReportHtml(config: ReportConfig, rows: LookupRow[]) {
  const groups = groupRows(rows, ["PRIN_CODE", "PRIN_NAME"]);
  const headers = ["Enquiry Nr.", "Date", "Type", "Mode", "Origin Port", "Destination Port", "Cargo Detail", "Commodity", "Dimension", "Gross Wt", "Volume"];
  if (config.title === "RFQ List") headers[0] = "RFQ No";
  const hasAmounts = config.amountFields.length > 0;

  const groupsHtml = groups
    .map((group) => {
      let groupGrossWt = 0;
      let groupVolume = 0;

      const rowsHtml = group.rows
        .map((row) => {
          const wt = numFrom(row, ["GROSS_WT", "WEIGHT"]);
          const vol = numFrom(row, ["VOLUME"]);
          groupGrossWt += wt;
          groupVolume += vol;

          return `<tr><td class="primary-text center">${escapeHtml(textFrom(row, config.title === "RFQ List" ? ["RFQ_NO", "ENQUIRY_NR"] : ["ENQUIRY_NR"]))}</td><td>${escapeHtml(dateFrom(row, ["RFQ_DATE", "ENQUIRY_DATE"]))}</td><td class="center">${escapeHtml(typeLabel(textFrom(row, ["JOB_TYPE"])))}</td><td class="center">${escapeHtml(modeLabel(textFrom(row, ["TRANSPORT_MODE"])))}</td><td>${escapeHtml(textFrom(row, ["ORIGIN_PORT", "PORT_CODE"]))}</td><td>${escapeHtml(textFrom(row, ["DESTINATION_PORT"]))}</td><td>${escapeHtml(textFrom(row, ["CARGO_DETAIL", "REMARKS"]))}</td><td>${escapeHtml(textFrom(row, ["COMMODITY"]))}</td><td>${escapeHtml(textFrom(row, ["DIMENSION"]))}</td><td class="right">${formatAmount(wt)}</td><td class="right">${formatAmount(vol)}</td></tr>`;
        })
        .join("");

      const subtotalRow = hasAmounts
        ? `<tr class="subtotal-row"><td colspan="9" class="right"><b>Sub Total (${escapeHtml(group.label)}):</b></td><td class="right font-bold">${formatAmount(groupGrossWt)}</td><td class="right font-bold">${formatAmount(groupVolume)}</td></tr>`
        : "";

      return `<div class="group"><div class="group-title">${escapeHtml(group.label)}</div><table><thead><tr>${headers.map((h, i) => `<th class="${i >= 9 ? "right" : i < 4 ? "center" : ""}">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rowsHtml}${subtotalRow}</tbody></table></div>`;
    })
    .join("");

  if (!hasAmounts) return groupsHtml;

  let grandGrossWt = 0;
  let grandVolume = 0;
  rows.forEach((row) => {
    grandGrossWt += numFrom(row, ["GROSS_WT", "WEIGHT"]);
    grandVolume += numFrom(row, ["VOLUME"]);
  });

  const grandTotalHtml = `
    <div class="group grand-total-wrap">
      <div class="group-title grand-total-title">Report Grand Total</div>
      <table>
        <thead>
          <tr>${headers.map((h, i) => `<th class="${i >= 9 ? "right" : i < 4 ? "center" : ""}">${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          <tr class="grand-total-row">
            <td colspan="9" class="right"><b>GRAND TOTAL (${rows.length} Records):</b></td>
            <td class="right font-bold">${formatAmount(grandGrossWt)}</td>
            <td class="right font-bold">${formatAmount(grandVolume)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  return groupsHtml + grandTotalHtml;
}

function financeReportHtml(rows: LookupRow[], variant: "profit" | "expense" | "revenue") {
  const headers =
    variant === "profit"
      ? ["Date", "Job No", "Remarks", "Customs Duty", "Demurrage", "Actual Cost", "Partner Cost", "Transport Cost", "Revenue", "Profit"]
      : variant === "expense"
        ? ["Date", "Job No", "Remarks", "Customs Duty", "Expense"]
        : ["Date", "Job No", "Remarks", "Invoice No", "Customs Duty", "Revenue"];

  const groups = groupRows(rows, ["PRIN_CODE", "PRIN_NAME"]);

  const groupsHtml = groups
    .map((group) => {
      let groupDuty = 0;
      let groupDemurrage = 0;
      let groupCost = 0;
      let groupPartner = 0;
      let groupTransport = 0;
      let groupRevenue = 0;
      let groupProfit = 0;
      let groupExpense = 0;

      const rowsHtml = group.rows
        .map((row) => {
          const duty = numFrom(row, ["FFCON_BILL", "CUSTOMS_DUTY"]);
          const demurrage = numFrom(row, ["FFDEM_BILL", "DEMURRAGE"]);
          const cost = numFrom(row, ["ACTUAL_COST", "COST_RATE", "EXPENSE"]);
          const partner = numFrom(row, ["PARTNERS_PRICE", "PARTNER_COST"]);
          const transport = numFrom(row, ["TRANSPORT_PRICE", "TRANSPORT_COST"]);
          const rev = numFrom(row, ["BILL_RATE", "REVENUE"]);
          const prof = numFrom(row, ["PROFIT"]);
          const exp = numFrom(row, ["ACTUAL_COST", "EXPENSE", "COST_RATE"]);

          groupDuty += duty;
          groupDemurrage += demurrage;
          groupCost += cost;
          groupPartner += partner;
          groupTransport += transport;
          groupRevenue += rev;
          groupProfit += prof;
          groupExpense += exp;

          const common = `<td class="center">${escapeHtml(dateFrom(row, ["INVOICE_DATE", "JOB_DATE"]))}</td><td class="primary-text center font-semibold">${escapeHtml(textFrom(row, ["JOB_NO"]))}</td><td>${escapeHtml(textFrom(row, ["REMARKS", "ACTIVITY"]))}</td>`;

          if (variant === "profit") {
            return `<tr>${common}<td class="right">${formatAmount(duty)}</td><td class="right">${formatAmount(demurrage)}</td><td class="right">${formatAmount(cost)}</td><td class="right">${formatAmount(partner)}</td><td class="right">${formatAmount(transport)}</td><td class="right">${formatAmount(rev)}</td><td class="right">${formatAmount(prof)}</td></tr>`;
          }
          if (variant === "expense") {
            return `<tr>${common}<td class="right">${formatAmount(duty)}</td><td class="right">${formatAmount(exp)}</td></tr>`;
          }
          return `<tr>${common}<td>${escapeHtml(textFrom(row, ["CONSOLIDATED_INVNO", "INVOICE_NO"]))}</td><td class="right">${formatAmount(duty)}</td><td class="right">${formatAmount(rev)}</td></tr>`;
        })
        .join("");

      let subtotalRow = "";
      if (variant === "profit") {
        subtotalRow = `<tr class="subtotal-row"><td colspan="3" class="right"><b>Sub Total (${escapeHtml(group.label)}):</b></td><td class="right font-bold">${formatAmount(groupDuty)}</td><td class="right font-bold">${formatAmount(groupDemurrage)}</td><td class="right font-bold">${formatAmount(groupCost)}</td><td class="right font-bold">${formatAmount(groupPartner)}</td><td class="right font-bold">${formatAmount(groupTransport)}</td><td class="right font-bold">${formatAmount(groupRevenue)}</td><td class="right font-bold">${formatAmount(groupProfit)}</td></tr>`;
      } else if (variant === "expense") {
        subtotalRow = `<tr class="subtotal-row"><td colspan="3" class="right"><b>Sub Total (${escapeHtml(group.label)}):</b></td><td class="right font-bold">${formatAmount(groupDuty)}</td><td class="right font-bold">${formatAmount(groupExpense)}</td></tr>`;
      } else {
        subtotalRow = `<tr class="subtotal-row"><td colspan="4" class="right"><b>Sub Total (${escapeHtml(group.label)}):</b></td><td class="right font-bold">${formatAmount(groupDuty)}</td><td class="right font-bold">${formatAmount(groupRevenue)}</td></tr>`;
      }

      return `<div class="group"><div class="group-title">${escapeHtml(group.label)}</div><table><thead><tr>${headers.map((h, i) => `<th class="${/cost|revenue|profit|duty|demurrage|expense/i.test(h) ? "right" : (i < 2 ? "center" : "")}">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rowsHtml}${subtotalRow}</tbody></table></div>`;
    })
    .join("");

  let grandDuty = 0;
  let grandDemurrage = 0;
  let grandCost = 0;
  let grandPartner = 0;
  let grandTransport = 0;
  let grandRevenue = 0;
  let grandProfit = 0;
  let grandExpense = 0;

  rows.forEach((row) => {
    grandDuty += numFrom(row, ["FFCON_BILL", "CUSTOMS_DUTY"]);
    grandDemurrage += numFrom(row, ["FFDEM_BILL", "DEMURRAGE"]);
    grandCost += numFrom(row, ["ACTUAL_COST", "COST_RATE", "EXPENSE"]);
    grandPartner += numFrom(row, ["PARTNERS_PRICE", "PARTNER_COST"]);
    grandTransport += numFrom(row, ["TRANSPORT_PRICE", "TRANSPORT_COST"]);
    grandRevenue += numFrom(row, ["BILL_RATE", "REVENUE"]);
    grandProfit += numFrom(row, ["PROFIT"]);
    grandExpense += numFrom(row, ["ACTUAL_COST", "EXPENSE", "COST_RATE"]);
  });

  let grandTotalRow = "";
  if (variant === "profit") {
    grandTotalRow = `<tr class="grand-total-row"><td colspan="3" class="right"><b>GRAND TOTAL (${rows.length} Records):</b></td><td class="right font-bold">${formatAmount(grandDuty)}</td><td class="right font-bold">${formatAmount(grandDemurrage)}</td><td class="right font-bold">${formatAmount(grandCost)}</td><td class="right font-bold">${formatAmount(grandPartner)}</td><td class="right font-bold">${formatAmount(grandTransport)}</td><td class="right font-bold">${formatAmount(grandRevenue)}</td><td class="right font-bold">${formatAmount(grandProfit)}</td></tr>`;
  } else if (variant === "expense") {
    grandTotalRow = `<tr class="grand-total-row"><td colspan="3" class="right"><b>GRAND TOTAL (${rows.length} Records):</b></td><td class="right font-bold">${formatAmount(grandDuty)}</td><td class="right font-bold">${formatAmount(grandExpense)}</td></tr>`;
  } else {
    grandTotalRow = `<tr class="grand-total-row"><td colspan="4" class="right"><b>GRAND TOTAL (${rows.length} Records):</b></td><td class="right font-bold">${formatAmount(grandDuty)}</td><td class="right font-bold">${formatAmount(grandRevenue)}</td></tr>`;
  }

  const grandTotalHtml = `
    <div class="group grand-total-wrap">
      <div class="group-title grand-total-title">Report Grand Total</div>
      <table>
        <thead>
          <tr>${headers.map((h, i) => `<th class="${/cost|revenue|profit|duty|demurrage|expense/i.test(h) ? "right" : (i < 2 ? "center" : "")}">${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${grandTotalRow}
        </tbody>
      </table>
    </div>`;

  return groupsHtml + grandTotalHtml;
}

function simpleTableHtml(rows: LookupRow[], columns: ReportColumn[], groupLabel?: string) {
  const thead = `<thead><tr>${columns
    .map((column) => {
      let alignClass = "";
      if (column.kind === "amount") alignClass = "right";
      else if (column.kind === "date" || column.kind === "mode" || column.kind === "type" || column.kind === "status") alignClass = "center";
      return `<th class="${alignClass}">${escapeHtml(column.label)}</th>`;
    })
    .join("")}</tr></thead>`;

  const tbodyRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => {
            let alignClass = "";
            if (column.kind === "amount") alignClass = "right";
            else if (column.kind === "date" || column.kind === "mode" || column.kind === "type" || column.kind === "status") alignClass = "center";
            const isDoc = /job_no|quotation_no|invoice_no|rfq_no|enquiry/i.test(column.key);
            const extraClass = isDoc ? " primary-text center font-semibold" : "";
            return `<td class="${alignClass}${extraClass}">${escapeHtml(formatPrintValue(row, column))}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");

  let subtotalRow = "";
  const firstAmountIdx = columns.findIndex((c) => c.kind === "amount");
  // Only render subtotal row if the report has numeric amount columns
  if (groupLabel && firstAmountIdx >= 0) {
    const colSums = columns.map((col) => {
      if (col.kind === "amount") {
        return rows.reduce((sum, r) => sum + (Number(firstExisting(r, col.key) || 0) || 0), 0);
      }
      return null;
    });

    if (firstAmountIdx > 0) {
      const spanCell = `<td colspan="${firstAmountIdx}" class="right"><b>Sub Total (${escapeHtml(groupLabel)}):</b></td>`;
      const amountCells = columns.slice(firstAmountIdx).map((col, idx) => {
        const colSum = colSums[firstAmountIdx + idx];
        if (colSum !== null) return `<td class="right font-bold">${formatAmount(colSum)}</td>`;
        return `<td></td>`;
      }).join("");
      subtotalRow = `<tr class="subtotal-row">${spanCell}${amountCells}</tr>`;
    } else {
      const cells = columns.map((col, idx) => {
        const colSum = colSums[idx];
        if (colSum !== null) return `<td class="right font-bold">${formatAmount(colSum)}</td>`;
        return `<td></td>`;
      }).join("");
      subtotalRow = `<tr class="subtotal-row">${cells}</tr>`;
    }
  }

  return `<table>${thead}<tbody>${tbodyRows}${subtotalRow}</tbody></table>`;
}

function renderSimpleGrandTotal(rows: LookupRow[], columns: ReportColumn[]) {
  const firstAmountIdx = columns.findIndex((c) => c.kind === "amount");
  // If report has no amount columns (like Freight Job List, Tracking, Query, etc.), do NOT show grand total
  if (firstAmountIdx < 0) return "";

  const thead = `<thead><tr>${columns
    .map((column) => {
      let alignClass = "";
      if (column.kind === "amount") alignClass = "right";
      else if (column.kind === "date" || column.kind === "mode" || column.kind === "type" || column.kind === "status") alignClass = "center";
      return `<th class="${alignClass}">${escapeHtml(column.label)}</th>`;
    })
    .join("")}</tr></thead>`;

  const colSums = columns.map((col) => {
    if (col.kind === "amount") {
      return rows.reduce((sum, r) => sum + (Number(firstExisting(r, col.key) || 0) || 0), 0);
    }
    return null;
  });

  let grandTotalRow = "";
  if (firstAmountIdx > 0) {
    const spanCell = `<td colspan="${firstAmountIdx}" class="right"><b>GRAND TOTAL (${rows.length} Records):</b></td>`;
    const amountCells = columns.slice(firstAmountIdx).map((col, idx) => {
      const colSum = colSums[firstAmountIdx + idx];
      if (colSum !== null) return `<td class="right font-bold">${formatAmount(colSum)}</td>`;
      return `<td></td>`;
    }).join("");
    grandTotalRow = `<tr class="grand-total-row">${spanCell}${amountCells}</tr>`;
  } else {
    const cells = columns.map((col, idx) => {
      const colSum = colSums[idx];
      if (colSum !== null) return `<td class="right font-bold">${formatAmount(colSum)}</td>`;
      return `<td></td>`;
    }).join("");
    grandTotalRow = `<tr class="grand-total-row">${cells}</tr>`;
  }

  return `
    <div class="group grand-total-wrap">
      <div class="group-title grand-total-title">Report Grand Total</div>
      <table>${thead}<tbody>${grandTotalRow}</tbody></table>
    </div>`;
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

function numFrom(row: LookupRow, keys: string[]) {
  for (const key of keys) {
    const value = firstExisting(row, key);
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

function dateFrom(row: LookupRow, keys: string[]) {
  return formatCellDate(textFrom(row, keys));
}

function amountFrom(row: LookupRow, keys: string[]) {
  return formatAmount(numFrom(row, keys));
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
