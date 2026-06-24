import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type VendorRow = Record<string, unknown>;

function unwrapRows(value: unknown): VendorRow[] {
  if (Array.isArray(value)) return value as VendorRow[];
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["tableData", "data", "Data", "rows", "Rows", "result", "Result"]) {
    if (Array.isArray(record[key])) return record[key] as VendorRow[];
  }

  return [record];
}

async function getVendor<T = unknown>(endpoint: string, params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<T>>(`/api/vendor/gm/${endpoint}`, { params });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${endpoint}`);
  return response.data.data as T;
}

async function postVendor<T = unknown>(endpoint: string, payload: Record<string, unknown>) {
  const response = await api.post<ApiResponse<T>>(`/api/vendor/gm/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data.data as T;
}

function unwrapData<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value as T;
}

export async function getVendorAccounts(companyCode: string, acCode?: string) {
  return unwrapRows(await getVendor("accounts", { company_code: companyCode, ac_code: acCode || undefined }));
}

export async function getVendorDivisions() {
  return unwrapRows(await getVendor("divisions"));
}

export async function getPendingVendorLpo(companyCode: string, acCode: string) {
  return unwrapRows(await getVendor("pending-lpo", { company_code: companyCode, ac_code: acCode }));
}

export async function getPendingVendorLpoDetail(companyCode: string, acCode: string, docNo: string) {
  return unwrapRows(await getVendor("pending-lpo-detail", { company_code: companyCode, ac_code: acCode, doc_no: docNo }));
}

export async function getVendorOutstanding(companyCode: string, acCode: string) {
  return unwrapRows(await getVendor("party-outstanding", { company_code: companyCode, ac_code: acCode }));
}

export async function getVendorInvoiceStatus(companyCode: string, acCode: string, fromDate: string, toDate: string) {
  return unwrapRows(
    await getVendor("getInvoiceStatus", {
      company_code: companyCode,
      ac_code: acCode,
      po_date_from: fromDate,
      po_date_to: toDate,
    }),
  );
}

export async function createVendorRegistration(companyCode: string, payload: VendorRow) {
  return postVendor("createVendor", {
    ...payload,
    COMPANY_CODE: companyCode,
    company_code: companyCode,
  });
}

export async function executeVendorSql(rawSql: string) {
  const response = await api.post<ApiResponse<VendorRow[]> & { data?: VendorRow[]; totalCount?: number; error?: string; details?: string }>(
    "/api/vendor/gm/executeRawSql",
    { raw_sql: rawSql },
  );
  if (!response.data.success) throw new Error(response.data.message || response.data.details || response.data.error || "Unable to load vendor data");
  return unwrapRows(response.data.data);
}

export async function executeVendorSqlBody(query_parameter: string, query_where: string, query_updatevalues = "") {
  const response = await api.post<ApiResponse<VendorRow[]> & { data?: VendorRow[]; totalCount?: number; error?: string; details?: string }>(
    "/api/vendor/gm/executeRawSqlbody",
    { query_parameter, query_where, query_updatevalues },
  );
  if (!response.data.success) throw new Error(response.data.message || response.data.details || response.data.error || "Unable to execute vendor update");
  return unwrapRows(response.data.data);
}

export async function getVendorRequest(docNo: string) {
  const response = await api.get<ApiResponse<VendorRow>>(`/api/vendor/gm/getVendorrequest/${encodeURIComponent(docNo)}`);
  if (!response.data.success) throw new Error(response.data.message || "Unable to load vendor request");
  return unwrapData<VendorRow>(response.data.data, {});
}

export async function saveVendorRequest(payload: VendorRow) {
  const response = await api.post<ApiResponse<{ requestNumber?: string }>>("/api/vendor/gm/postLpoRequestHandler", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save vendor request");
  return response.data.data || {};
}

export async function updateVendorLpoStatus(payload: {
  doc_no: string;
  company_code: string;
  flow_level: number;
  remarks: string;
  action: "SENTBACK" | "REJECTED";
}) {
  const response = await api.post<ApiResponse<unknown>>("/api/vendor/gm/updateLpoStatus", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to update vendor status");
  return response.data;
}

export async function getVendorClosedInvoices(loginid: string) {
  return unwrapRows(await getVendor("tmp-ac-header-with-erp-doc", { loginid }));
}

export async function saveVendorFiles(requestNumber: string, files: VendorRow[]) {
  const response = await api.post<ApiResponse<unknown>>("/api/vendor/gm/saveFile", {
    request_number: requestNumber,
    files,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to save vendor files");
  return response.data;
}

export async function executeVendorInvoicePrint(companyCode: string, docNo: string, loginUser: string) {
  const response = await api.post<ApiResponse<unknown>>("/api/vendor/gm/executeVendorInvoicePrintHandler", {
    COMPANY_CODE: companyCode,
    DOC_NO: docNo,
    LOGIN_USER: loginUser,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to execute vendor invoice print");
  return response.data;
}
