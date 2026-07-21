import { api } from "./client";

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string;
  totalCount?: number;
};

export type VendorRow = Record<string, unknown>;

export type VendorRequestPayload = {
  COMPANY_CODE?: string;
  DOC_NO?: string;
  DOC_DATE?: string;
  AC_CODE?: string;
  AC_NAME?: string;
  AC_DESC?: string;
  DIV_CODE?: string;
  DIV_NAME?: string;
  DIVN_CODE?: string;
  REF_DOC_NO?: string;
  REF_DOC1?: string;
  REF_DOC2?: string;
  REF_DOC3?: string;
  INVOICE_NUMBER?: string;
  INVOICE_DATE?: string;
  REMARKS?: string;
  LAST_ACTION?: string;
  items?: VendorRow[];
  [key: string]: unknown;
};

function unwrapRows(payload: unknown): VendorRow[] {
  const data = (payload as { data?: unknown })?.data ?? payload;
  if (Array.isArray(data)) return data as VendorRow[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  for (const key of ["tableData", "data", "Data", "rows", "Rows", "result", "Result"]) {
    if (Array.isArray(record[key])) return record[key] as VendorRow[];
  }
  return [];
}

function assertSuccess<T>(response: ApiResponse<T>, fallback: string) {
  if (response.success === false) {
    throw new Error(response.message || response.details || response.error || fallback);
  }
}

export async function getVendorAccounts(search = "", companyCode?: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/accounts", {
    params: {
      ...(search ? { ac_code: search } : {}),
      ...(companyCode ? { company_code: companyCode } : {}),
    },
  });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load vendor accounts");
  return unwrapRows(data);
}

export async function getVendorDivisions() {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/divisions");
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load divisions");
  return unwrapRows(data);
}

export async function getPendingVendorLpo(params?: Record<string, string>) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/pending-lpo", { params });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load pending ref documents");
  return unwrapRows(data);
}

export async function getPendingVendorLpoDetail(docNo: string, acCode?: string, companyCode?: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/pending-lpo-detail", {
    params: { doc_no: docNo, ac_code: acCode, company_code: companyCode },
  });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load pending invoice details");
  return unwrapRows(data);
}

export async function getVendorRequest(docNo: string) {
  const { data } = await api.get<ApiResponse<VendorRequestPayload>>(`/api/vendor/gm/getVendorrequest/${encodeURIComponent(docNo)}`);
  assertSuccess(data, "Unable to load vendor request");
  return (data.data ?? data) as VendorRequestPayload;
}

export async function saveVendorRequest(payload: VendorRequestPayload) {
  const { data } = await api.post<ApiResponse<{ requestNumber?: string }> & { requestNumber?: string }>("/api/vendor/gm/postLpoRequestHandler", payload);
  assertSuccess(data, "Unable to save vendor request");
  return data;
}

export async function updateVendorLpoStatus(payload: {
  doc_no: string;
  company_code: string;
  flow_level: string | number;
  remarks: string;
  action: string;
  DOC_NO?: string;
  LAST_ACTION?: string;
  REMARKS?: string;
  COMPANY_CODE?: string;
  FLOW_LEVEL?: number | string;
}) {
  const normalizedPayload = {
    ...payload,
    flow_level: Number(payload.flow_level),
  };
  const { data } = await api.post<ApiResponse<unknown>>("/api/vendor/gm/updateLpoStatus", normalizedPayload);
  assertSuccess(data, "Unable to update vendor status");
  return data;
}

export async function createVendorRegistration(payload: VendorRow) {
  const { data } = await api.post<ApiResponse<unknown>>("/api/vendor/gm/createVendor", payload);
  assertSuccess(data, "Unable to save vendor");
  return data;
}

export async function executeVendorSql(rawSql: string) {
  const { data } = await api.post<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/executeRawSql", { raw_sql: rawSql });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load vendor data");
  return unwrapRows(data);
}

export async function executeVendorSqlBody(query_parameter: string, query_where: string, query_updatevalues = "") {
  const { data } = await api.post<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/executeRawSqlbody", {
    query_parameter,
    query_where,
    query_updatevalues,
  });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to execute vendor update");
  return unwrapRows(data);
}

export async function saveVendorFiles(requestNumber: string, files: VendorRow[]) {
  const { data } = await api.post<ApiResponse<unknown>>("/api/vendor/gm/saveFile", { request_number: requestNumber, files });
  assertSuccess(data, "Unable to save vendor files");
  return data;
}

export async function uploadVendorAttachment(requestNumber: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_no", requestNumber);
  formData.append("request_number", requestNumber);

  const { data } = await api.post<ApiResponse<string>>("/api/files/uploadVendorAttachment", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  assertSuccess(data, "Unable to upload vendor attachment");
  return String(data.data || "");
}

export async function deleteVendorAttachment(requestNumber: string, srNo: number, attachmentSrNo?: number) {
  const url = attachmentSrNo !== undefined
    ? `/api/files/deleteVendorAttachment/${encodeURIComponent(requestNumber)}/${encodeURIComponent(String(srNo))}/${encodeURIComponent(String(attachmentSrNo))}`
    : `/api/files/deleteVendorAttachment/${encodeURIComponent(requestNumber)}/${encodeURIComponent(String(srNo))}`;
  const { data } = await api.delete<ApiResponse<unknown>>(url);
  assertSuccess(data, "Unable to delete vendor attachment");
  return data;
}

export async function getAllVendorFiles(requestNumber: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>(`/api/files/getAllVendorFiles/${encodeURIComponent(requestNumber)}`);
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load vendor files");
  const payload = (data as ApiResponse<unknown>).data ?? data;
  if (payload && typeof payload === "object" && Array.isArray((payload as any).allFiles)) {
    return (payload as any).allFiles as VendorRow[];
  }
  return unwrapRows(data);
}

export async function getVendorOutstanding(acCode: string, companyCode?: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/party-outstanding", {
    params: { ac_code: acCode, company_code: companyCode },
  });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load vendor outstanding");
  return unwrapRows(data);
}

export async function getVendorInvoiceStatus(acCode: string, fromDate?: string, toDate?: string, companyCode?: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/getInvoiceStatus", {
    params: { ac_code: acCode, company_code: companyCode, po_date_from: fromDate, po_date_to: toDate },
  });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load invoice status");
  return unwrapRows(data);
}

export async function getVendorStatement(acCode: string, fromDate?: string, toDate?: string, companyCode?: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/party-account-statement", {
    params: { ac_code: acCode, company_code: companyCode, doc_date_from: fromDate, doc_date_to: toDate },
  });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load vendor statement");
  return unwrapRows(data);
}

export async function getVendorClosedInvoices(loginid: string) {
  const { data } = await api.get<ApiResponse<VendorRow[]> | VendorRow[]>("/api/vendor/gm/tmp-ac-header-with-erp-doc", { params: { loginid } });
  assertSuccess(data as ApiResponse<VendorRow[]>, "Unable to load closed invoices");
  return unwrapRows(data);
}

export async function executeVendorInvoicePrint(companyCode: string, docNo: string, loginUser: string) {
  const { data } = await api.post<ApiResponse<unknown>>("/api/vendor/gm/executeVendorInvoicePrintHandler", {
    COMPANY_CODE: companyCode,
    DOC_NO: docNo,
    LOGIN_USER: loginUser,
  });
  assertSuccess(data, "Unable to execute vendor invoice print");
  return data;
}
