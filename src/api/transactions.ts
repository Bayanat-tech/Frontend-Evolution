import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type TransactionType = "BP" | "BR" | "CR" | "CP" | "CN" | "DN" | "PO" | "PI" | "SI" | "SV" | "JV";

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

export async function getTransactionDocuments(docType: TransactionType, fyPeriod?: string, search?: string, page = 1, limit = 100,columnFilters?: { field: string; values: string }[]) {
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

export async function getLpoRefDocSearch(divCode: string, companyCode: string) {
  const { getDynamicFinanceLookup } = await import("./lookups");
  return getDynamicFinanceLookup({
    parameter: "Account_LPO_REF_DOC",
    code1: companyCode,
    number1: Number(divCode) || undefined,
  });
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
  invoiceDetails: Record<string, unknown>[];
  expenseDetails: Record<string, unknown>[];
  jobDetails: Record<string, unknown>[];
  loginid: string;
}) {
  const response = await api.post<ApiResponse<unknown>>("/api/finance/transactions/account-entry/bulk", payload);
  const details = (response.data as ApiResponse<unknown> & { details?: string }).details;
  if (!response.data.success) throw new Error(response.data.message || details || "Unable to save transaction");
  return response.data;
}

export async function cancelTransactionDocument(docNo: string, docType: TransactionType) {
  const response = await api.put<ApiResponse<null>>("/api/finance/transactions/cancel_cheque", null, {
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
