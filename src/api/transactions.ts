import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type TransactionType = "BP" | "BR" | "CR" | "CP" | "CN" | "DN" | "PO" | "PI" | "SI" | "SV" | "JV" | "RJV";

export type TransactionDocumentRow = {
  company_code?: string;
  doc_type: TransactionType;
  doc_no: string;
  doc_date?: string;
  div_code: string;
  div_name?: string;
  ac_code?: string;
  ac_name?: string;
  ac_payee?: string;
  remarks?: string;
  cheque_no?: string;
  cheque_date?: string;
  cheque_bank?: string;
  amount?: number;
  net_amount?: number;
  canceled?: string;
  fy_period?: string;
};

export type TransactionHeader = {
  doc_no?: string;
  doc_type: TransactionType;
  doc_date: string;
  inv_no?: string;
  inv_date?: string;
  ref_no?: string;
  ref_date?: string;
  ac_code: string;
  ac_name?: string;
  party_address?: string;
  party_phone?: string;
  party_fax?: string;
  bank_ac_code?: string;
  bank_ac_name?: string;
  curr_code: string;
  curr_name?: string;
  ex_rate: number;
  div_code: string;
  div_name?: string;
  remarks?: string;
  cheque_no?: string;
  cheque_date?: string;
  cheque_bank?: string;
  ac_payee?: string;
  tx_compntcat_code_1?: string;
  tx_compnt_1_expmt?: string;
  files?: unknown[];
  detail: TransactionDetail[];
  children: Record<string, unknown[]>;
  canceled?: string;
};

export type TransactionDetail = {
  id: string;
  isEditMode?: boolean;
  company_code?: string;
  doc_type: TransactionType;
  doc_no: string;
  serial_no: number;
  doc_date: string;
  ac_code: string;
  ac_name?: string;
  remarks?: string;
  curr_code: string;
  curr_name?: string;
  ex_rate: number;
  amount: number;
  sign_ind: 1 | -1;
  div_code: string;
  tx_compntcat_code_1?: string;
  tx_cat_code?: string;
  tx_compnt_1_expmt?: string;
  tx_compnt_lcuramt_1?: number | null;
  tx_compnt_perc_1?: number | null;
  tx_compnt_amt_1?: number | null;
  job_no?: string;
  dept_code?: string;
  dept_name?: string;
  lcur_amount?: number;
  child_table?: "invoice" | "job" | "expense" | "";
  child_code?: string;
};

export type TransactionChildRow = Record<string, unknown> & {
  id: string;
  dtl_sr_no: number;
  serial_no: number;
  doc_no: string;
  doc_type: TransactionType;
  div_code: string;
  doc_date: string;
  company_code?: string;
  ac_code: string;
  sign_ind: 1 | -1;
  amount: number;
  lcur_amount?: number;
  isEditMode?: boolean;
  IsDeletable?: boolean;
};

export type TransactionDefaultData = {
  ac_code?: string;
  Account?: { ac_code?: string; ac_name?: string };
  curr_code?: string;
  Currency?: { curr_code?: string; curr_name?: string };
  div_code?: string;
  Division?: { div_code?: string; div_name?: string };
  ex_rate?: number;
  Accountsetup?: { tax_perc?: number; lcur_decimal_nos?: number };
  MS_AC_BANKCODE?: { ac_code?: string; ac_name?: string; Account?: { ac_name?: string } };
  bank_ac_code?: string;
  bank_ac_name?: string;
};

export type FyPeriod = {
  fy_period: string;
  date_from?: string;
  date_to?: string;
  sort_order?: number;
};

export type Division = {
  div_code: string;
  div_name: string;
};

export type CompanyInfo = {
  company_code?: string;
  ac_fy_period?: string;
};

export type FinanceOutstandingBalance = {
  inv_no: string;
  original_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_percentage: number;
  is_fully_paid: boolean;
  error?: string;
};

export async function getCompanyInfo() {
  const response = await api.get<ApiResponse<CompanyInfo>>("/api/finance/transactions/company_info");
  if (!response.data.success) throw new Error(response.data.message || "Unable to load company settings");
  return response.data.data || {};
}

export function getDefaultFyPeriod(periods: FyPeriod[], companyInfo?: CompanyInfo) {
  const companyPeriod = String(companyInfo?.ac_fy_period || "").trim();
  if (companyPeriod && periods.some((period) => String(period.fy_period) === companyPeriod)) {
    return companyPeriod;
  }

  const today = new Date();
  const currentPeriod = periods.find((period) => {
    if (!period.date_from || !period.date_to) return false;
    const from = new Date(period.date_from);
    const to = new Date(period.date_to);
    return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && today >= from && today <= to;
  });
  if (currentPeriod?.fy_period) return currentPeriod.fy_period;

  const yearSuffix = String(today.getFullYear()).slice(-2);
  const matchingYear = periods.find((period) => String(period.fy_period).endsWith(yearSuffix));
  return matchingYear?.fy_period || periods[periods.length - 1]?.fy_period || periods[0]?.fy_period || "";
}

export async function getTransactionDocuments(docType: TransactionType, fyPeriod?: string, search?: string, page = 1, limit = 100, columnFilters?: { field: string; values: string }[]) {
  const filters: unknown[] = [[{ field_name: "doc_type", field_value: docType, operator: "exactmatch" }]];
  if (fyPeriod) filters.push([{ field_name: "fy_period", field_value: fyPeriod, operator: "exactmatch" }]);
  if (search?.trim()) {
    filters.push([
      { field_name: "doc_no", field_value: search.trim(), operator: "contains" },
      { field_name: "ac_name", field_value: search.trim(), operator: "contains" },
      { field_name: "ref_no", field_value: search.trim(), operator: "contains" },
    ]);
  }

  if (columnFilters?.length) {
    columnFilters.forEach(({ field, values }) => {
      if (values.trim()) {
        filters.push([{ field_name: field, field_value: values.trim(), operator: "contains" }]);
      }
    });
  }

  const response = await api.get<ApiResponse<{ tableData: TransactionDocumentRow[]; count: number }>>("/api/finance/doc", {
    params: {
      page,
      limit,
      filter: JSON.stringify({ search: filters }),
    },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load documents");
  return response.data.data || { tableData: [], count: 0 };
}

export async function getFyPeriods() {
  const response = await api.get<ApiResponse<{ tableData: FyPeriod[]; count: number }>>("/api/finance/fy_period", {
    params: { page: 1, limit: 50 },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load fiscal periods");
  return response.data.data?.tableData || [];
}

export async function getDivisions() {
  const response = await api.get<ApiResponse<{ tableData: Division[]; count: number }>>("/api/wms/division", {
    params: { page: 1, limit: 1000 },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load divisions");
  return response.data.data?.tableData || [];
}

export async function getTransactionDefaultData(docType: TransactionType, isEditMode = false) {
  const response = await api.get<ApiResponse<TransactionDefaultData>>("/api/finance/transactions/default_details", {
    params: { doc_id: docType, isEditMode },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load defaults");
  return response.data.data || {};
}

export async function getTransactionHeader(docNo: string, docType: TransactionType) {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(`/api/finance/transactions/header/${encodeURIComponent(docNo)}`, {
    params: { doc_type: docType },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load document header");
  return response.data.data || {};
}

export async function getInvoicesTransactionHeader(docNo: string, docType: TransactionType) {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(`/api/finance/transactions/header/${encodeURIComponent(docNo)}`, {
    params: { doc_type: docType },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load document header");
  return response.data.data || {};
}

export async function getTransactionDetail(docNo: string, divCode: string, docType: TransactionType) {
  const response = await api.get<ApiResponse<Record<string, unknown>[]>>(`/api/finance/transactions/detail/${encodeURIComponent(docNo)}`, {
    params: { div_code: divCode, doc_type: docType },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load document details");
  return response.data.data || [];
}

export async function getDocAccounts(docType: TransactionType, hdrDtl: "H" | "D" | "HDR" | "DTL", divCode: string) {
  const normalizedHdrDtl = hdrDtl === "HDR" ? "H" : hdrDtl === "DTL" ? "D" : hdrDtl;
  const response = await api.get<ApiResponse<Record<string, unknown>[]>>("/api/finance/transactions/doc_accounts", {
    params: { doc_id: docType, hdr_dtl: normalizedHdrDtl, div_code: divCode },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load accounts");
  return response.data.data || [];
}

export async function getTransactionChildren(docNo: string, divCode: string, docType: TransactionType) {
  const response = await api.get<ApiResponse<{ invoice: Record<string, unknown>[]; job: Record<string, unknown>[]; expense: Record<string, unknown>[] }>>(
    `/api/finance/transactions/children/${encodeURIComponent(docNo)}`,
    { params: { div_code: divCode, doc_type: docType } },
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load child allocations");
  return response.data.data || { invoice: [], job: [], expense: [] };
}

export async function getFinanceOutstanding(divCode: string, invNos: string | string[]) {
  const response = await api.get<ApiResponse<{ balances: FinanceOutstandingBalance[]; count: number }>>(
    "/api/finance/transactions/invoice_outstanding",
    {
      params: {
        div_code: divCode,
        inv_nos: Array.isArray(invNos) ? invNos.join(",") : invNos,
      },
    },
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load invoice outstanding balances");
  return response.data.data || { balances: [], count: 0 };
}

export async function getCheque(acCode: string) {
  const response = await api.get<ApiResponse<Record<string, unknown>>>("/api/finance/transactions/cheque_detail", {
    params: { ac_code: acCode },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load cheque detail");
  return response.data.data || {};
}

export async function getChildTableName(acCode: string) {
  const response = await api.get<ApiResponse<{ table: "invoice" | "job" | "expense"; code?: string }>>(
    `/api/finance/transactions/table_name/${encodeURIComponent(acCode)}`,
  );
  if (!response.data.success) throw new Error(response.data.message || "Account has no child allocation");
  return response.data.data;
}

export async function getFinanceMasterRows(
  master: string,
  options: {
    filter?: Record<string, unknown>;
    code?: string;
    extra_param1?: string;
    extra_param2?: string;
    extra_param3?: string;
    extra_param4?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const response = await api.get<ApiResponse<{ tableData: Record<string, unknown>[]; count: number }>>(`/api/finance/${master}`, {
    params: {
      page: options.page || 1,
      limit: options.limit || 100,
      ...(options.filter && { filter: JSON.stringify(options.filter) }),
      ...(options.code && { code: options.code }),
      ...(options.extra_param1 && { extra_param1: options.extra_param1 }),
      ...(options.extra_param2 && { extra_param2: options.extra_param2 }),
      ...(options.extra_param3 && { extra_param3: options.extra_param3 }),
      ...(options.extra_param4 && { extra_param4: options.extra_param4 }),
    },
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data?.tableData || [];
}

export async function getLpoDocuments(
  fyPeriod?: string,
  search?: string,
  page = 1,
  limit = 100,
) {
  const response = await api.get<
    ApiResponse<TransactionDocumentRow[]>
  >("/api/finance/transactions/lpo", {
    params: {
      fy_period: fyPeriod,
      search,
      page,
      limit,
    },
  });

  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to load LPO documents");
  }

  const list = response.data.data || [];

  // backend may or may not send pagination → handle safely
  const pagination = (response as any).data?.pagination;

  return {
    tableData: list,
    count: pagination?.total ?? list.length ?? 0,
  };
}
export async function getLpoHeader(docNo: string, docType: string) {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(
    `/api/finance/transactions/lpo/${encodeURIComponent(docNo)}`,
    {
      params: { doc_type: docType },
    },
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to load LPO header");
  }

  return response.data.data || {};
}

export async function getLpoDetail(docNo: string, docType: string) {
  const response = await api.get<ApiResponse<Record<string, unknown>[]>>(
    `/api/finance/transactions/lpo/${encodeURIComponent(docNo)}/detail`,
    {
      params: { doc_type: docType },
    },
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to load LPO details");
  }

  return response.data.data || [];
}


// Get lpo (Ref_Doc) in PI
export async function getPurchaseHeader(docNo: string, docType: string) {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(
    `/api/finance/transactions/purchaseheader/${encodeURIComponent(docNo)}`,
    { params: { doc_type: docType } }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load purchase header");
  return response.data.data || {};
}

export async function saveTransactionDocument(payload: TransactionHeader, editMode: boolean) {
  const response = editMode
    ? await api.put<ApiResponse<{ doc_no: string; doc_type: TransactionType }>>("/api/finance/transactions/document", payload)
    : await api.post<ApiResponse<{ doc_no: string; doc_type: TransactionType }>>("/api/finance/transactions/document", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save document");
  return response.data.data;
}

export async function upsertBulkAccountEntryApi(payload: {
  header: Record<string, unknown>;
  details: Record<string, unknown>[];
  invoiceDetails?: Record<string, unknown>[];
  expenseDetails: Record<string, unknown>[];
  jobDetails: Record<string, unknown>[];
  loginid: string;
}) {
  const response = await api.post<ApiResponse<unknown>>("/api/finance/transactions/account-entry/bulk", payload);
  const details = (response.data as ApiResponse<unknown> & { details?: string }).details;
  if (!response.data.success) throw new Error(response.data.message || details || "Unable to save transaction");
  return response.data;
}
export async function upsertBulkAccountBudgetEntryApi(
  payload: {
    header: Record<string, unknown>;
    details: Record<string, unknown>[];
    company_code: string;
    loginid: string;
  },
  action: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "SENTBACK" | "CLOSED" | "CANCELED"
) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/finance/insUpdBudgetRequestBulk",
    {
      ...payload,
      header: {
        ...payload.header,
        last_action: action,
      },
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to perform budget request action");
  }

  return response.data;
}

export async function upsertBulkExcelBudgetEntryApi(
  payload: {
     details: Record<string, unknown>[];
   
  },
  ) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/finance/insLoadBudgetData",
    {
      ...payload,
      details: payload.details,
      
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to perform budget request ");
  }

  return response.data;
}

export async function cancelTransactionDocument(docNo: string, docType: TransactionType) {
  const response = await api.put<ApiResponse<null>>("/api/finance/transactions/cancel_cheque", {}, {
    params: { doc_no: docNo, doc_type: docType },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to cancel document");
  return response.data;
}

export async function deleteTransactionDocument(docNos: string[], docType: TransactionType) {
  const response = await api.delete<ApiResponse<unknown>>(`/api/finance/transactions/document/${docType}`, {
    params: { doc_no: JSON.stringify(docNos) },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete document");
  return response.data;
}

export function getDocumentReportUrl(docType: TransactionType | string, docNo: string, format: "pdf" | "excel" = "pdf") {
  const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
  const encodedType = encodeURIComponent(docType);
  const encodedNo = encodeURIComponent(docNo);
  if (format === "excel") {
    return `${baseUrl}/api/finance/transactions/report/${encodedType}/${encodedNo}/excel`;
  }
  return `${baseUrl}/api/finance/transactions/report/${encodedType}/${encodedNo}`;
}

export async function openDocumentReport(docType: TransactionType | string, docNo: string) {
  if (!docNo) return;
  const response = await api.get(`/api/finance/transactions/report/${encodeURIComponent(docType)}/${encodeURIComponent(docNo)}`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the Cheque Book Monitoring Report in a new tab
 */
/**
 * Opens the Cheque Book Monitoring Report using common code parameters
 */


interface ReportParams {
  parameter: string;
  loginid: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  code5?: string;
  code6?: string;
  code7?: string | number;
  code8?: string | number;
  code9?: string;
  code10?: string;
  code20?: string;
  [key: string]: any;
}

// ── generic helper (same blob → new tab pattern) ──────────────────────────
async function openReportInTab(endpoint: string, params: ReportParams): Promise<void> {
  try {
    const response = await api.post(endpoint, params, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const reportWindow = window.open(url, "_blank", "noopener,noreferrer");

    if (!reportWindow) console.error("Please allow popups to view this report");

    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    console.error(`Failed to open report [${endpoint}]:`, error);
    throw error; // re-throw so the frontend can show an error banner
  }
}


// ── GRN Print Report ───────────────────────────────────────────────────────
export async function openGrnPrintReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/getGrnPrintReport/html`,
    params
  );
}

// ── 1. Cheque Book Monitoring ─────────────────────────────────────────────
// export async function openChequeMonitoringReport(params: ReportParams) {
//     await openReportInTab(
//         `/api/finance/transactions/reports/cheque-monitoring/html`,
//         params
//     );
// }

export async function openChequeDateWiseReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/cheque-date-wise/html`,
    params
  );
}

// ── 2. Detail Dump ────────────────────────────────────────────────────────
// export async function openDetailDumpReport(params: ReportParams) {
//     await openReportInTab(
//         `/api/finance/transactions/reports/detail-dump/html`,
//         params
//     );
// }

// ── 3. Ledger With Details ────────────────────────────────────────────────
export async function openLedgerWithDetailsReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/ledger-with-details/html`,
    params
  );
}

// ── 4. Ledger With Opposite Entry ─────────────────────────────────────────
export async function openLedgerOppositeEntryReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/ledger-opposite-entry/html`,
    params
  );
}

// // ── 5. Summary Dump ───────────────────────────────────────────────────────
// export async function openSummaryDumpReport(params: ReportParams) {
//     await openReportInTab(
//         `/api/finance/transactions/reports/summary-dump/html`,
//         params
//     );
// }

// ── 6. Account Payee Wise ─────────────────────────────────────────────────
export async function openAccountPayeeWiseReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/account-payee-wise/html`,
    params
  );
}
// -------Ageing Report----------------------
export async function openInvdatewiseDetailReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/InvdatewiseDetail/html`,
    params
  );
}

export async function openInvdatewiseSummaryReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/InvdatewiseSummary/html`,
    params
  );
}

export async function openDuedatewiseDetailReport(params: ReportParams) {
  await openReportInTab(

    `/api/finance/transactions/reports/DuedatewiseDetail/html`,
    params
  )
}

export async function openDuedatewiseSummaryReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/DuedatewiseSummary/html",
    params
  );
}

// ─── PeriodWise Excel Export Functions ───────────────────────────────────────

export async function exportInvDetailExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/InvdatewiseDetail/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PeriodWise_InvDetail.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportInvSummaryExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/InvdatewiseSummary/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PeriodWise_InvSummary.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportDueDetailExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/DuedatewiseDetail/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PeriodWise_DueDetail.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportDueSummaryExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/DuedatewiseSummary/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PeriodWise_DueSummary.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportOutstandingListExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/OutstandingList/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PeriodWise_OutstandingList.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportLedgerWithDetailsExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/ledger-with-details/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ledgerbasicwithdetails.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}





export async function openOutstandingListReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/OutstandingList/html",
    params
  );
}

export async function taxOutInReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/tax-vat-out-ledger/html",
    params

  )
}

// ---------AC_statement report-----
export async function openAcStatementReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/AcStatementReport/html",
    params
  );
}

// Capex Approval Report and Excel route
export async function openCapexApprovalReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/CapexApprovalReport/html", 
    params
  );
}

export async function exportCapexApprovalExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/CapexApprovalReport/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CapexApproval_${params.code2 || "Report"}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}


export async function openPRPurchaseReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/PRPurchaseReport/html",
    params
  );
}






// AC Statement Excel Export
export async function exportAcStatementExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/AcStatement/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "AcStatement.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}



export async function taxOutInSummaryReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/tax-vat-out-ledger-summary/html",
    params
  );
}
export async function openOutstandingStatementDetailReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/OutstandingDetailReport/html",
    params
  );
}


export async function openOutstandingStatementSummaryReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/OutstandingSummaryReport/html",
    params
  );
}

// Outstanding Statement Excel Export
export async function exportOutstandingDetailExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/OutstandingDetail/excel`,
    params, { responseType: "blob" }
  );
  const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "OutstandingDetail.xlsx";
  document.body.appendChild(link); link.click();
  link.remove(); window.URL.revokeObjectURL(url);
}

export async function exportOutstandingSummaryExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/OutstandingSummary/excel`,
    params, { responseType: "blob" }
  );
  const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "OutstandingSummary.xlsx";
  document.body.appendChild(link); link.click();
  link.remove(); window.URL.revokeObjectURL(url);
}



export async function jobListingReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/wms-joblisting/html",
    params
  );
}

export async function exportJobListingExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/wms-joblisting`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "DN_Summary.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getBalanceSheetReportHtml(params: ReportParams): Promise<string> {
  const response = await api.post(
    `/api/finance/transactions/report/balancesheet/html`,
    params,
    { responseType: "text" }
  );
  return response.data as string;
}


export async function getBalanceSheetReportExcelDownload(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/report/balancesheet/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "BalanceSheet.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}



// ---------Profit & Loss Report----------------

// transactions.ts

export async function getProfitLossReportHtml(params: ReportParams): Promise<string> {
  const response = await api.post(
    `/api/finance/transactions/reports/profitloss/html`,
    params,
    { responseType: "text" }

  )
  return response.data as string;
}
export async function getTaxInvoiceExcelReport(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/tax-vat-out-ledger/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Tax_Invoice_Report.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportTaxInvoiceSummaryExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/tax-vat-out-ledger-summary/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Tax_Invoice_summary_Report.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportChequeDateWiseExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/cheque-date-wise/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ChequeDateWiseReport.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportAccountPayeeWiseExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/account-payee-wise/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "AccountPayeeWiseReport.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// export async function openProfitLossReport(params: ReportParams) {
//     await openReportInTab(
//         `/api/finance/transactions/reports/getProfitLossReport/html`,
//         params
//     );
//     return response.data as string;
// }

export async function getProfitLossReportExcelDownload(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/profitloss/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ProfitLoss.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}



// ----------Visa Expiry Listing Report----------------
export async function openVisaExpiryReport(params: ReportParams) {
  await openReportInTab(
    `/api/finance/transactions/reports/getVisaExpiryReport/html`,
    params
  );
}

export async function TransationReport(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/wms-TransactionProductReport/html",
    params
  );
}


export async function TransationReportwithoutTransafer(params: ReportParams) {
  await openReportInTab(
    "/api/finance/transactions/reports/wms-TransactionProductWithoutTransfersReport/html",
    params
  );
}

export async function exportTransactionProductExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/wms-exportTransactionProductExcel/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "TransactionProduct.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}


export async function exportTransactionWithoutTransfersExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/wms-exportTransactionWithoutTransfersExcel/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "TransactionWithoutTransfers.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

//----------PL(Profit/Loss) analysis summary Report----------------

export async function getPLSummaryReportHtml(params: ReportParams): Promise<string> {
  const response = await api.post(
    `/api/finance/transactions/reports/getPLSummaryReport/html`,      
    params,
    { responseType: "text" }
  );
  return response.data as string;
}

export async function getPLSummaryReportExcel(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/getPLSummaryReport/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PL_Summary_Report.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---------DN Summary Report----------------


export async function getDnSummaryReportHtml(params: ReportParams): Promise<string> {
  const response = await api.post(
    `/api/finance/transactions/reports/getDnSummaryReport/html`,
    params,
    { responseType: "text" }
  );
  return response.data as string;
}

export async function getDnSummaryReportExcelDownload(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/getDnSummaryReport/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "DN_Summary.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// export async function exportTransactionProductExcel(params: ReportParams): Promise<void> {
//     const response = await api.post(
//         `/api/finance/transactions/reports/wms-exportTransactionProductExcel/excel`,
//         params,
//         { responseType: "blob" }
//     );
//     const blob = new Blob([response.data], {
//         type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     });
//     const url = window.URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = "DN_Summary.xlsx";
//     document.body.appendChild(link);
//     link.click();
//     link.remove();
//     window.URL.revokeObjectURL(url);
// }


// export const openInvdatewiseDetailReport = async (params: any): Promise<void> => {
//     const response = await fetch("/api/finance/transactions/reports/InvdatewiseDetail/html", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(params),
//     });
//     if (!response.ok) throw new Error(`Report failed: ${response.statusText}`);
//     const html = await response.text();
//     const win = window.open("", "_blank");
//     if (win) { win.document.write(html); win.document.close(); }
// };



export async function downloadDocumentReportExcel(docType: TransactionType | string, docNo: string) {
  if (!docNo) return;
  const response = await api.get(`/api/finance/transactions/report/${encodeURIComponent(docType)}/${encodeURIComponent(docNo)}/excel`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${docType}_${docNo}_report.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
