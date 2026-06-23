import { api } from "./client";
import type { DynamicQueryParams, LookupRow } from "./lookups";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type WmsMasterResponse = {
  tableData: LookupRow[];
  count: number;
};

export type WmsPagination = {
  page?: number;
  limit?: number;
};
export type AdjHeaderCreatePayload = {
  ADJ_CODE: string;
  PRIN_CODE: string;
  REMARKS: string;
  ADJ_DATE: string;
  CONFIRMED: string;
  USER_ID: string;
  COMPANY_CODE: string;
};
export type AdjDetailPayload = {
  ADJ_NO: number;
  ADJ_SERIALNO?: number;
  PRIN_CODE: string;
  PROD_CODE: string;
  SITE_CODE?: string;
  LOCATION_CODE?: string;
  P_UOM?: string;
  L_UOM?: string;
  JOB_NO?: string;
  KEY_NUMBER?: string;
  QTY_PUOM: number;
  QTY_LUOM?: number;
  QUANTITY: number;
  ADJ_TYPE: string;
  PALLET_ID?: string;
  MFG_DATE?: string | null;
  EXP_DATE?: string | null;
  BATCH_NO?: string | null;
  LOT_NO?: string | null;
};

export type ProcessStockAdjustmentPayload = {
  COMPANY_CODE: string;
  PRIN_CODE: string;
  ADJ_NO: number;
  USERID: string;
  P_ADJ_SERIALNO: string;
};

export type ConfirmStockAdjustmentPayload = {
  P_COMPANY_CODE: string;
  P_PRIN_CODE: string;
  P_ADJ_NO: string;
  P_ADJ_SERIALNO: string;
};

export type DeleteAdjDetailPayload = {
  ADJ_NO: number;
  JOB_NO?: string;
  ADJ_SERIALNO?: number;
  COMPANY_CODE?: string;
};

export type StockAdjustmentListResponse = {
  headers: LookupRow[];
  details: LookupRow[];
};

/** GET — backend always returns ALL headers + ALL details, filter client-side */
export async function getStockAdjustmentData() {
  const response = await getWmsStockAdjustment<StockAdjustmentListResponse>();
  return response || { headers: [], details: [] };
}

export async function getAllStockAdjustments() {
  const data = await getStockAdjustmentData();
  return data.headers || [];
}

// export async function getAllStockAdjustments(company_code: string) {
//   return getWmsStockAdjustment<LookupRow[]>({ view: "headers", company_code });
// }

export async function getStockAdjustmentDetails(
  adj_no: string,
  company_code: string,
  prin_code: string,
  tab: "create" | "process" | "confirmed"
) {
  return getWmsStockAdjustment<LookupRow[]>({ view: "details", adj_no, company_code, prin_code, tab });
}


export async function createAdjHeader(payload: AdjHeaderCreatePayload) {
  return postWmsStockAdjustment("createAdjHeader", payload as unknown as Record<string, unknown>);
}

/** POST create adjustment detail line */
export async function createAdjDetail(payload: AdjDetailPayload) {
  return postWmsStockAdjustment("createAdjDetail", payload as unknown as Record<string, unknown>);
}

/** POST edit adjustment detail line */
export async function editAdjDetail(payload: AdjDetailPayload) {
  return postWmsStockAdjustment("editAdjDetail", payload as unknown as Record<string, unknown>);
}

/** POST delete adjustment detail line */
export async function deleteAdjDetail(payload: DeleteAdjDetailPayload) {
  return postWmsStockAdjustment("deleteAdjDetail", payload as unknown as Record<string, unknown>);
}

/** POST process stock adjustment (runs SP_WM_ADJUSTMNT_PROCESS) */
export async function processStockAdjustment(payload: ProcessStockAdjustmentPayload) {
  return postWmsStockAdjustment("process-adjustment", payload as unknown as Record<string, unknown>);
}

/** POST confirm stock adjustment */
export async function confirmStockAdjustment(payload: ConfirmStockAdjustmentPayload) {
  return postWmsStockAdjustment("confirm-adj-detail", payload as unknown as Record<string, unknown>);
}

/** GET all stock adjustment reports for the print dialog */
export async function getAllStockAdjReports() {
  return getWmsStockAdjustment<{ reportid: string; reportname: string }[]>({ view: "reports" });
}

export async function getWmsMaster(master: string, options: WmsPagination & Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<WmsMasterResponse>>(`/api/wms/${master}`, {
    params: options,
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}



export async function deleteWmsMaster(master: string, ids: unknown[]) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/${master}`, { ids });
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${master}`);
  return response.data;
}

export async function saveWmsGm(endpoint: string, payload: Record<string, unknown>, method: "post" | "put" = "post") {
  const response = await api[method]<ApiResponse<unknown>>(`/api/wms/gm/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function deleteWmsGm(endpoint: string, payload: unknown) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/gm/${endpoint}/delete`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${endpoint}`);
  return response.data;
}

export async function deleteWmsGmRaw(endpoint: string, payload: unknown, method: "post" | "delete" = "post") {
  const response =
    method === "delete"
      ? await api.delete<ApiResponse<unknown>>(`/api/wms/gm/${endpoint}`, { data: payload })
      : await api.post<ApiResponse<unknown>>(`/api/wms/gm/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${endpoint}`);
  return response.data;
}

export async function getWmsDynamicLookup(params: DynamicQueryParams) {
  const response = await api.post<ApiResponse<LookupRow[]>>("/api/wms/inbound/proc_build_dynamic_sql_wms", params);
  if (!response.data.success) throw new Error(response.data.message || "Unable to load WMS lookup data");
  return response.data.data || [];
}

export async function getWmsInbound<T = unknown>(endpoint: string, params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<T>>(`/api/wms/inbound/${endpoint}`, { params });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${endpoint}`);
  return response.data.data as T;
}

export async function postWmsInbound<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/inbound/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function putWmsInbound<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.put<ApiResponse<unknown>>(`/api/wms/inbound/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to update ${endpoint}`);
  return response.data;
}

export async function patchWmsInbound<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.patch<ApiResponse<unknown>>(`/api/wms/inbound/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to update ${endpoint}`);
  return response.data;
}

export async function executeWmsInboundSql(rawSql: string, signal?: AbortSignal) {
  const response = await api.post<ApiResponse<LookupRow[]>>(
    "/api/wms/inbound/executeRawSql",
    { raw_sql: rawSql },
    { signal }  // 👈 Signal goes here (Axios config)
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load inbound data");
  return response.data.data || [];
}

export async function executeWmsInboundSqlBody(query_parameter: string, query_where: string, query_updatevalues: string) {
  const response = await api.post<ApiResponse<LookupRow[]> & { data?: LookupRow[]; totalCount?: number; error?: string; details?: string }>("/api/wms/inbound/executeRawSqlbody", {
    query_parameter,
    query_where,
    query_updatevalues,
  });
  if (!response.data.success) throw new Error(response.data.message || response.data.details || response.data.error || "Unable to execute WMS update");
  return response.data.data || [];
}

export async function getWmsOutbound<T = unknown>(endpoint: string, params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<T>>(`/api/wms/outbound/${endpoint}`, { params });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${endpoint}`);
  return response.data.data as T;
}

export async function postWmsOutbound<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/outbound/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data; 
}

export async function putWmsOutbound<TPayload extends Record<string, unknown> | unknown[]>(endpoint: string, payload: TPayload, params: Record<string, unknown> = {}) {
  const response = await api.put<ApiResponse<unknown>>(`/api/wms/outbound/${endpoint}`, payload, { params });
  if (!response.data.success) throw new Error(response.data.message || `Unable to update ${endpoint}`);
  return response.data;
}

export async function getWmsStockTransfer<T = unknown>(endpoint: string, params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<T>>(`/api/wms/stocktransfer/${endpoint}`, { params });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${endpoint}`);
  return response.data.data as T;
}

export async function postWmsStockTransfer<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/stocktransfer/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function getWmsStockAdjustment<T = unknown>(params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<T>>("/api/wms/stock-adjustment", { params });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load stock adjustments");
  return response.data.data as T;
}

export async function postWmsStockAdjustment<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/stock-adjustment/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function postWmsBillingActivity<TPayload extends Record<string , unknown>>(payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/gm/createPrincipalActivity` ,payload);
  if(!response.data.success) throw new Error(response.data.message || `Unable to save Billing Activity`);
  return response.data;
}

export async function upsertMsActivityBillingApi<TPayload extends Record<string , unknown>>(payload: TPayload) {
  const response = await api.put<ApiResponse<unknown>>(`/api/wms/inbound/upsertMsActivityBilling` ,payload);
  if(!response.data.success) throw new Error(response.data.message || `Unable to update Billing Activity`);
  return response.data;
}
 
export async function getJobDetailsReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/job-details/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function downloadJobDetailsReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/job-details/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }  // arraybuffer, not "blob" — avoids axios blob quirks
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Job_${jobNo}_Details.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getPutawayReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/tally-putaway/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function downloadPutawayReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/tally-putaway/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }  // arraybuffer, not "blob" — avoids axios blob quirks
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Putaway_job_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getGrnReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/Grn-report/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function downloadGrnReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/Grn-report/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Job_${jobNo}_Details.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getTallyReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/Tally-report/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function downloadTallyReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/Tally-report/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Tally_Details_report_jobno_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getDnReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/outbound/reports/Dn-report/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}

export async function downloadDnReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/outbound/reports/Dn-report/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Tally_Details_report_jobno_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getOubPickReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/outbound/reports/Oubpick/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}

export async function downloadOubPickReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/outbound/reports/Oubpick/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Tally_Details_report_jobno_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


export async function getAllStockTransfers() {
  const response = await api.get<ApiResponse<unknown[]>>("/api/wms/stocktransfer/getAllStockTransfers");
  if (!response.data.success) throw new Error(response.data.message || "Unable to load stock transfers");
  return response.data.data || [];
}



export async function createSTN(payload: {
  prin_code: string;
  description: string;
  stn_date: string;
  user_id: string;
  company_code: string;
}) {
  const response = await api.post<ApiResponse<unknown>>("/api/wms/stocktransfer/createSTN", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to create STN");
  return response.data;
}
// ─── Types ────────────────────────────────────────────────────────────────────

export type StnCreatePayload = {
  prin_code: string;
  description: string;
  stn_date: string; // ISO date string "YYYY-MM-DD"
  user_id: string;
  company_code: string;
};

export type StnEditPayload = {
  prin_code?: string;
  description?: string;
  stn_date?: string;
  allocated?: string;
  confirmed?: string;
  cancelled?: string;
  date_cancelled?: string;
  user_id?: string;
};

export type StockTransferDetailPayload = {
  COMPANY_CODE: string;
  PRIN_CODE: string;
  STN_NO: string | number;
  SERIAL_NO?: number;
  SEQ_NUMBER?: number;
  PROD_CODE: string;
  JOB_NO?: string;
  DOC_REF?: string | null;
  FROM_SITE?: string;
  TO_SITE?: string;
  FROM_LOC_START?: string | null;
  FROM_LOC_END?: string | null;
  TO_LOC_START?: string | null;
  TO_LOC_END?: string | null;
  LOT_NO_FROM?: string | null;
  LOT_NO_TO?: string | null;
  BATCH_NO_FROM?: string | null;
  BATCH_NO_TO?: string | null;
  MFG_DATE_FROM?: string | null;
  MFG_DATE_TO?: string | null;
  EXP_DATE_FROM?: string | null;
  EXP_DATE_TO?: string | null;
  P_UOM?: string;
  L_UOM?: string;
  QTY_PUOM?: number;
  QTY_LUOM?: number;
  QUANTITY: number;
  KEY_NUMBER?: string;
  PALLET_ID_FROM?: string | null;
  PALLET_ID_TO?: string | null;
  USER_ID: string;
  ALLOCATED?: string;
  CONFIRMED?: string;
  SELECTED?: string;
  PROCESSED?: string;
  RECEIPT_TYPE?: string;
  MIXED_PUTAWAY?: string;
  MULTI_SERIES?: string;
};

export type ProcessStockTransferPayload = {
  company_code: string;
  prin_code: string;
  stn_no: string | number;
  user_id: string;
};

export type ConfirmStockTransferPayload = {
  company_code: string;
  principal_code: string;
  stn_no: number;
};

export type DeleteStockTransferDetailPayload = {
  COMPANY_CODE: string;
  STN_NO: string | number;
  KEY_NUMBER?: string;
};

// ─── Service functions ────────────────────────────────────────────────────────

/** GET all STN headers */
export async function fetchAllStockTransfers() {
  return getAllStockTransfers();
}

/** POST create STN header */
export async function createStockTransferHeader(payload: StnCreatePayload) {
  return createSTN(payload);
}

/** PUT edit STN header */
export async function editStockTransferHeader(
  stn_no: number,
  company_code: string,
  payload: StnEditPayload
) {
  // PUT /api/wms/stocktransfer/editSTN/:stn_no/:company_code
  return putWmsOutbound(`stocktransfer/editSTN/${stn_no}/${company_code}`, payload as Record<string, unknown>);
}

/** GET STN with all details */
export async function fetchSTNWithDetails(
  stn_no: string,
  company_code: string,
  prin_code: string
) {
  return getWmsStockTransfer<LookupRow[]>("getTSSTNWithDetails", {
    stn_no,
    company_code,
    prin_code,
  });
}

/** GET all transfer details for a specific STN */
export async function getAllStockTransferDetails(
  stn_no: string,
  company_code: string,
  prin_code: string
) {
  return getWmsStockTransfer<{ details: LookupRow[]; count: number }>(
    "getTSSTNWithDetails",
    { stn_no, company_code, prin_code }
  );
}

/** POST create STN detail line */
export async function createStockTransferDetail(payload: StockTransferDetailPayload) {
  return postWmsStockTransfer("createSTNDetail", payload as unknown as Record<string, unknown>);
}

/** PATCH edit STN detail line */
export async function editStockTransferDetail(payload: StockTransferDetailPayload) {
  // uses PATCH — postWmsStockTransfer only does POST, so we call patchWmsInbound pattern
  // but stocktransfer has no patch helper — use putWmsOutbound with the correct prefix
  // endpoint: api/wms/stocktransfer/editstocktransfer
  return putWmsOutbound("stocktransfer/editstocktransfer", payload as unknown as Record<string, unknown>);
}

/** POST process stock transfer */
export async function processStockTransfer(payload: ProcessStockTransferPayload) {
  return postWmsStockTransfer("processStockTransfer", payload as Record<string, unknown>);
}

/** POST confirm stock transfer */
export async function confirmStockTransfer(payload: ConfirmStockTransferPayload) {
  return postWmsStockTransfer("confirmStockTransfer", payload as Record<string, unknown>);
}

/** DELETE stock transfer detail */
export async function deleteStockTransferDetail(payload: DeleteStockTransferDetailPayload) {
  // DELETE /api/wms/stocktransfer/deleteStockTransfer with body
  // No deleteWmsStockTransfer helper exists — use deleteWmsGmRaw pattern from wms.ts
  // But to keep it in the stocktransfer namespace we call the api client directly via putWmsOutbound trick.
  // Safest: import api client and call delete with data:
  const { api } = await import("./client");
  const response = await api.delete<{ success: boolean; message?: string }>(
    "/api/wms/stocktransfer/deleteStockTransfer",
    { data: payload }
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to delete stock transfer detail");
  return response.data;
}

/** GET product stock for a principal (used in lookup dropdowns) */
export async function getProductStock(prin_code: string) {
  return getWmsStockTransfer<LookupRow[]>("getProductStock", { prin_code });
}

/** GET TFI batch rows for confirm tab */
export async function getTfiBatchRows(prin_code: string, stn_no: string) {
  return getWmsStockTransfer<LookupRow[]>("getTfiBatchRows", { prin_code, stn_no });
}

/** GET all available stock transfer reports (for print dialog) */
export async function getAllStockTransReports() {
  return getWmsStockTransfer<{ reportid: string; reportname: string }[]>(
    "getAllStockTransReports"
  );
}