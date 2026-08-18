import { TProduct } from "../pages/wms/Masters/Product_Master/product-wms.types";
import { TTsStnDetailEdi } from "../pages/wms/stock transfer/StockediType";
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

export type DynamicSqlSecurityParams = {
  parameter: string;
  loginid?: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  number1?: number;
  number2?: number;
  number3?: number;
  number4?: number;
  date1?: string | null;
  date2?: string | null;
  date3?: string | null;
  date4?: string | null;
};

type BulkApiResponse = {
  success: boolean;
  message?: string;
  details?: string[];
};

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

/** GET — backend always returns ALL headers + ALL details, filter client-side */
export async function getStockAdjustmentData() {
  const response = await getWmsStockAdjustment<StockAdjustmentListResponse>();
  return response || { headers: [], details: [] };
}

export async function getAllStockAdjustments() {
  const data = await getStockAdjustmentData();
  return data.headers || [];
}

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

// ---------Sales Order Report----------------


export async function getSalesOrderReportHtml(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/outbound/reports/salesorder/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function getSalesOrderSheetReportExcelDownload(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/outbound/reports/salesorder/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `sales_order_report_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


// ---------Stock Adjusment Report----------------

export async function getStockAdjusmentReportHtml(prinCode: string, adjNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/outbound/reports/stockadjusment/${adjNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Stock Adjusment Report");
  return response.data;
}
 
export async function getStockAdjusmentReportExcelDownload(
  prinCode: string,
  adjNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/outbound/reports/stockadjusment/${adjNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `stock_adjusment_report_${adjNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function procBuildDynamicSqlSecurity(params: DynamicSqlSecurityParams) {
  const response = await api.post<ApiResponse<LookupRow[]>>(
    "/api/wms/common/proc_build_dynamic_sql_common", // TODO: confirm this matches your actual route
    params
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load data");
  return response.data.data || [];
}
 
// ─── Flow Assignment (Approver Levels + Role Users) ───────────────────────
 
export type TFlowProcess = { PROCESS: string };
 
export type TFlowLevelDetail = {
  COMPANY_CODE?: string;
  PROCESS?: string;
  LEVEL1?: string;
  LEVEL2?: string;
  LEVEL3?: string;
  LEVEL4?: string;
  LEVEL5?: string;
  COUNT?: number | string;
  [key: string]: unknown;
};
 
export type TFlowRole = { ROLE_ID: string; ROLE_DESC: string };
 
export type TFlowRoleUser = {
  SERIAL_NO_OR_ROLE_ID?: string;
  LOGINID?: string;
  USERNAME?: string;
  COMPANY_CODE?: string;
  [key: string]: unknown;
};
 
/** Process dropdown */
export async function getFlowAssignProcesses(companyCode: string) {
  return procBuildDynamicSqlSecurity({
    parameter: "PROC_FUN_ASSIGN_PROCESS",
    code1: companyCode,
  }) as Promise<TFlowProcess[]>;
}
 
/** Level details (LEVEL1-5 + COUNT) for the selected process */
export async function getFlowAssignLevelDetails(companyCode: string, process: string) {
  if (!process) return [] as TFlowLevelDetail[];
  return procBuildDynamicSqlSecurity({
    parameter: "PROC_FUN_ASSIGN_LEVEL_DETAILS",
    code1: companyCode,
    code2: process,
  }) as Promise<TFlowLevelDetail[]>;
}
 
/** Role Name dropdown */
export async function getFlowAssignRoles(companyCode: string) {
  return procBuildDynamicSqlSecurity({
    parameter: "PROC_FUN_ASSIGN_ROLE_DROPDOWN",
    code1: companyCode,
  }) as Promise<TFlowRole[]>;
}
 
/** Users currently assigned to the selected role */
export async function getFlowAssignRoleUsers(companyCode: string, roleId: string) {
  if (!roleId) return [] as TFlowRoleUser[];
  return procBuildDynamicSqlSecurity({
    parameter: "PROC_FUN_ASSIGN_ROLE_USERS",
    code1: companyCode,
    code2: roleId,
  }) as Promise<TFlowRoleUser[]>;
}
export const saveFlowAssignLevels = async (
  companyCode: string,
  process: string,
  rows: {
    level1_role: string;
    level2_role: string;
    level3_role?: string;
    level4_role?: string;
    level5_role?: string;
    last_level: number;
    flow_code?: string;
  }[]
) => {
  const payload = {
    rows: rows.map((r) => ({
      company_code: companyCode,
      process: process,
      level1_role: r.level1_role,
      level2_role: r.level2_role,
      level3_role: r.level3_role || null,
      level4_role: r.level4_role || null,
      level5_role: r.level5_role || null,
      last_level: r.last_level,
      flow_code: r.flow_code || "NA",
    })),
  };

  const res = await api.post("/api/finance/insUpdMsApproverLevels", payload);
  return res.data;
};
// ─── Add / Remove user from role ──────────────────────────────────────────
export async function addUserToRole(companyCode: string, roleId: string, loginidToAdd: string, actorLoginId: string) {
  const res = await insSecRoleFunctionAccessUser([
    {
      company_code: companyCode,
      loginid: loginidToAdd,
      serial_no_or_role_id: roleId,
      userid: loginidToAdd,
      create_user: actorLoginId,
    },
  ]);
  if (!res?.success) throw new Error(res?.message || "Unable to add user to role");
  return res;
}

 export const insSecRoleFunctionAccessUser = async (rows: any[]) => {
  const res = await api.post("/api/finance/insSecRoleFunctionAccessUser", { rows });
  return res.data;
};
export async function removeUserFromRole(companyCode: string, roleId: string, loginid: string, actorLoginId: string) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/proc_build_dynamic_del_common", // TODO: confirm route + parameter name with backend
    {
      parameter: "PROC_FUN_ASSIGN_DEL_ROLE_USER", // TODO: backend needs to add this branch
      loginid: actorLoginId,
      code1: companyCode,
      code2: roleId,
      code3: loginid,
    }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to remove user from role");
  return response.data;
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

export async function addProduct (values: TProduct){
  const response = await api.post<ApiResponse<null>>('api/wms/gm/product', values);
  if (!response.data.success) throw new Error(response.data.message || "Unable add Product");
  return response.data.data || [];
}

export async function editProduct (values: TProduct){
  const response = await api.put<ApiResponse<null>>('api/wms/gm/product', values);
  if (!response.data.success) throw new Error(response.data.message || "Unable edit Product");
  return response.data.data || [];
}

export async function insUpdTsStnDetailEdiBlkApi (  params: {rows: TTsStnDetailEdi[];loginid?: string;}){
  const response = await api.post<BulkApiResponse>('/api/wms/inbound/insUpdTsStnDetailEdiBulk',{rows: params.rows,loginid: params.loginid});
  if (!response.data.success) throw new Error(response.data.message || "Failed to Process");
  return response.data || [];
}

export async function deleteProduct(product: { prod_code: string;prin_code: string;group_code: string;brand_code: string;company_code?: string;}) {
  const response = await api.delete<ApiResponse<unknown>>("api/wms/gm/delproduct",{data: product,});
  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to delete Product");
  }
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
    { signal }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load inbound data");
  return response.data.data || [];
}

const rawSqlLookupCache = new Map<string, { expiresAt: number; rows: LookupRow[] }>();
const RAW_SQL_LOOKUP_TTL_MS = 5 * 60 * 1000;

export async function executeWmsInboundSqlCached(rawSql: string, signal?: AbortSignal) {
  const cacheKey = rawSql.replace(/\s+/g, " ").trim();
  const cached = rawSqlLookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const rows = await executeWmsInboundSql(rawSql, signal);
  rawSqlLookupCache.set(cacheKey, { expiresAt: Date.now() + RAW_SQL_LOOKUP_TTL_MS, rows });
  return rows;
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
    { responseType: "arraybuffer" }
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
  link.download = `Grn_report_job_no_${jobNo}.xlsx`;
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

export async function getInbServiceActivityReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/inb-serviceactivity/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function downloadInbServiceActivityReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/inb-serviceactivity/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Inbound_activity_service_report_jobno_${jobNo}.xlsx`;
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
  link.download = `DN_report_jobno_${jobNo}.xlsx`;
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
  link.download = `Outbound_Picking_report_jobno_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getOubServiceActivityReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/outbound/reports/Oub-serviceactivity/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}
 
export async function downloadOubServiceActivityReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/outbound/reports/Oub-serviceactivity/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Outbound_activity_service_report_jobno_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getOubJobDetReport(prinCode: string, jobNo: string): Promise<string> {
  const response = await api.get(
    `/api/wms/outbound/reports/Oub_jobDet-report/${jobNo}?prin_code=${prinCode}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}

export async function downloadOubJobDetReportExcel(
  prinCode: string,
  jobNo: string
): Promise<void> {
  const response = await api.get(
    `/api/wms/outbound/reports/Oub_jobDet-report/${jobNo}/excel?prin_code=${prinCode}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Outbound_Job_Details_report_jobno_${jobNo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getAdjConfirmReport(prin_code: string, adj_no: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/AdjConfirmation_report/${adj_no}?prin_code=${prin_code}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Job Details Report");
  return response.data;
}

export async function downloadAdjConfirmReportExcel(prin_code: string, adj_no: string): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/AdjConfirmation_report/${adj_no}?prin_code=${prin_code}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Adj_confirm_report_adjno_${adj_no}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getGrnSummaryReportHtml(params: ReportParams): Promise<string> {
  const response = await api.post(
    `/api/finance/transactions/reports/GrnSummaryReport/html`,
    params,
    { responseType: "text" }
  );
  return response.data as string;
}

export async function getGrnSummaryReportExcelDownload(params: ReportParams): Promise<void> {
  const response = await api.post(
    `/api/finance/transactions/reports/GrnSummaryReport/excel`,
    params,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Grn_Summary.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getInvocieDetailReport(prin_code: string, invoice_no: string, company_code: string, report_type: string): Promise<string> {
  const response = await api.get(
    `/api/wms/inbound/reports/invoice-detail/html?prin_code=${prin_code}&invoice_no=${invoice_no}&company_code=${company_code}&report_type=${report_type}`,
    { responseType: "text" }
  );
  if (!response.data) throw new Error("Unable to fetch Invoice Detail Report");
  return response.data;
}

export async function downloadInvocieDetailReportExcel(prin_code: string, invoice_no: string): Promise<void> {
  const response = await api.get(
    `/api/wms/inbound/reports/invoice-detail/excel?${prin_code}&invoice_no=${invoice_no}`,
    { responseType: "arraybuffer" }
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Invoice_Detail_report_InvocieNo_${invoice_no}.xlsx`;
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
// ─── Common Dynamic SQL Procedures (ported from commonservices.ts) ───────────

export type DynamicSqlCommonParams = {
  parameter: string;
  loginid?: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  code5?: string;
  code6?: string;
  code7?: string;
  code8?: string;
  code9?: string;
  code10?: string;
  number1?: number;
  number2?: number;
  number3?: number;
  number4?: number;
  date1?: string | null;
  date2?: string | null;
  date3?: string | null;
  date4?: string | null;
};

/** GET-style dynamic SELECT via stored proc (code1-10, number1-4, date1-4) */
export async function procBuildDynamicSqlCommon(params: DynamicSqlCommonParams) {
  const response = await api.post<ApiResponse<LookupRow[]>>(
    "/api/wms/common/proc_build_dynamic_sql_common20",
    params
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load data");
  return response.data.data || [];
}

export type DynamicInsUpdCommonParams = {
  parameter: string;
  loginid: string;

  val1s1?: string;
  val1s2?: string;
  val1s3?: string;
  val1s4?: string;
  val1s5?: string;
  val1s6?: string;
  val1s7?: string;
  val1s8?: string;
  val1s9?: string;
  val1s10?: string;

  val1n1?: number;
  val1n2?: number;
  val1n3?: number;
  val1n4?: number;
  val1n5?: number;
  val1n6?: number;
  val1n7?: number;

  val1d1?: string | null;
  val1d2?: string | null;
  val1d3?: string | null;
  val1d4?: string | null;
  val1d5?: string | null;

  wval1s1?: string;
  wval1s2?: string;
  wval1s3?: string;
  wval1s4?: string;
  wval1s5?: string;

  wval1n1?: number;
  wval1n2?: number;
  wval1n3?: number;
  wval1n4?: number;
  wval1n5?: number;

  wval1d1?: string | null;
  wval1d2?: string | null;
  wval1d3?: string | null;
  wval1d4?: string | null;
  wval1d5?: string | null;
};

/** POST — generic dynamic INSERT/UPDATE via stored proc */
export async function procBuildDynamicInsUpdCommon(params: DynamicInsUpdCommonParams) {
  if (!params?.parameter) throw new Error("No values provided");
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/proc_build_dynamic_ins_upd_common",
    params
  );
  if (!response.data.success) throw new Error(response.data.message || "Insert / Update failed");
  return response.data;
}

export type DynamicDelCommonParams = {
  parameter: string;
  loginid: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  code5?: string;
  number1?: number;
  number2?: number;
  number3?: number;
  number4?: number;
  date1?: string | null;
  date2?: string | null;
  date3?: string | null;
  date4?: string | null;
};

/** POST — generic dynamic DELETE via stored proc */
export async function procBuildDynamicDelCommon(params: DynamicDelCommonParams) {
  if (!params?.parameter) throw new Error("No values provided");
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/proc_build_dynamic_del_common",
    params
  );
  if (!response.data.success) throw new Error(response.data.message || "Delete failed");
  return response.data;
}

/** GET-style dynamic SELECT via stored proc — base variant (code1-4, number1-4, date1-4) */
export async function procBuildDynamicSqlCommonBase(params: {
  parameter: string;
  loginid?: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  number1?: number;
  number2?: number;
  number3?: number;
  number4?: number;
  date1?: string | null;
  date2?: string | null;
  date3?: string | null;
  date4?: string | null;
}) {
  const response = await api.post<ApiResponse<LookupRow[]>>(
    "/api/wms/common/proc_build_dynamic_sql_common",
    params
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load data");
  return response.data.data || [];
}

// ─── Stock Count ──────────────────────────────────────────────────────────

export type TStockCountHeader = {
  prin_code: string;
  master_count_no?: string;
  parent_count_no?: string;
  company_code: string;
  count_no: string;
  count_type?: string;
  counted_by?: string;
  remarks?: string;
  prod_group_from?: string;
  prod_group_to?: string;
  prod_brand_from?: string;
  prod_brand_to?: string;
  prod_code_from?: string;
  prod_code_to?: string;
  site_code_from?: string;
  site_code_to?: string;
  from_location?: string;
  to_location?: string;
  aisle_from?: string | null;
  aisle_to?: string | null;
  col_from?: string | null;
  col_to?: string | null;
  height_from?: string | null;
  height_to?: string | null;
  user_id?: string;
  count_date?: string;
  amls_rep?: string;
  amls_des?: string;
  client_rep?: string;
  client_des?: string;
};

export type TStockCountPrinDetail = {
  company_code: string;
  count_no: string;
  prin_code: string;
  user_id?: string;
  user_dt?: string;
};

export type SaveStockCountPayload = {
  headers: TStockCountHeader[];
  details: TStockCountPrinDetail[];
  loginid: string;
};

export async function getWmsStockCount<T = unknown>(params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<T>>("/api/wms/stock-count", { params });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load stock count data");
  return response.data.data as T;
}

export async function postWmsStockCount<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/wms/inbound/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

// ════════════════════════════════════════════════════════════════════════
// HR Employee Pay Components — talks to PROC_INS_UPD_HR_EMP_COMPONENTS via
// POST /api/hr/employee/pay-components/upsert → insUpdHrEmpPayunits
// controller. That controller reads req.body?.component (SINGULAR — one
// row), and the underlying proc's p_component table type only accepts one
// row per call. Bulk saves must therefore issue one request per row.
// ════════════════════════════════════════════════════════════════════════

export type THrEmpComponentPayload = {
  employee_id: string;
  pay_comp_id: string;
  pay_comp_amt?: number | null;
  pay_comp_perc?: number | null;
  pay_comp_amt_old?: number | null;
  entered_on?: string | null;
  entered_by?: string | null;
  verified_on?: string | null;
  verified_by?: string | null;
  approved_on?: string | null;
  approved_by?: string | null;
  revised_on?: string | null;
  revised_by?: string | null;
  freezed_on?: string | null;
  freezed_reason?: string | null;
  freezed_till?: string | null;
  remarks?: string | null;
  status_flag?: string | null;
  user_id?: string | null;
  user_dt?: string | null;
  company_code: string;
  pay_comp_earn_ded?: string | null;
  pay_roll_status?: string | null;
  comp_status?: string | null;
  arrears_amt?: number | null;
  arrears_type?: string | null;
  arrears_posted?: string | null;
  ref_doc_type?: string | null;
  ref_doc_no?: string | null;
  pay_comp_amt_vac?: number | null;
  vac_updated?: string | null;
  source_from?: string | null;
  source_updated?: string | null;
  curr_code?: string | null;
  doc_no?: string | null;
};

export type THrEmpComponentSaveResult = {
  success: boolean;
  message?: string;
  data?: {
    company_code: string;
    employee_id: string;
    pay_comp_id: string;
    curr_code: string;
  };
  details?: string;
};

/**
 * POSTs a single HR_EMP_COMPONENTS row. The backend reads req.body?.component
 * (singular), so the row is wrapped as { component } here — sending the raw
 * payload directly (as the previous version of this function did) means
 * `component` arrives as undefined and the backend 400s.
 */
export async function insUpdHrEmpComponentApi<TPayload extends Record<string, unknown>>(component: TPayload) {
  const response = await api.post<THrEmpComponentSaveResult>(
    `/api/hr/employee/pay-components/upsert`,
    { component },
  );
  if (!response.data.success) throw new Error(response.data.details || response.data.message || `Unable to save`);
  return response.data;
}

/**
 * Bulk-style helper: saves multiple HR_EMP_COMPONENTS rows by issuing one
 * insUpdHrEmpComponentApi call per row (the backend proc is single-row).
 * Returns per-row results in the same order as the input array; rejected
 * rows carry an `error` string instead of throwing, so one bad row doesn't
 * abort the rest.
 */
export async function upsertHrEmpComponentsApi<TPayload extends Record<string, unknown>>(
  components: TPayload[],
) {
  return Promise.all(
    components.map((component) =>
      insUpdHrEmpComponentApi(component).catch((error: unknown) => ({
        success: false as const,
        error: error instanceof Error ? error.message : "Unable to save pay component",
      })),
    ),
  );
}

/**
 * GET — principal detail rows for a given count_no (edit mode).
 * Ported 1:1 from the old page's `STOCKCOUNT_prin_page` call via
 * common.proc_build_dynamic_sql_common — which is the *non-"20"* variant,
 * already exposed here as procBuildDynamicSqlCommonBase.
 */
export async function getStockCountPrincipals(companyCode: string, countNo: string) {
  if (!companyCode || !countNo) return [];
  const data = await procBuildDynamicSqlCommonBase({
    parameter: "STOCKCOUNT_prin_page",
    code1: companyCode,
    code2: countNo,
  });
  return data || [];
}

/**
 * POST — save stock count header + principal details.
 * Ported from the old insUpdTcStockCountApi. On a fresh "add" (empty count_no
 * in the header payload), the old page did a follow-up raw SQL
 * `SELECT MAX(COUNT_NO)...` to grab the newly generated count number — that
 * behavior is preserved here so the caller can just read `result.count_no`.
 */
export async function saveStockCount(payload: SaveStockCountPayload) {
  const header = payload.headers?.[0];
  const result = await postWmsStockCount("insUpdTcStockCountBulk", payload as unknown as Record<string, unknown>);

  const isFreshAdd = !header?.count_no;
  if (isFreshAdd && header?.company_code && payload.loginid) {
    try {
      const rows = await executeWmsInboundSql(
        `SELECT MAX(COUNT_NO) as COUNT_NO FROM TC_STOCKCOUNT WHERE COMPANY_CODE = '${header.company_code.replace(/'/g, "''")}' AND USER_ID = '${payload.loginid.replace(/'/g, "''")}'`
      );
      const fetchedCountNo = (rows?.[0] as any)?.COUNT_NO ?? (rows?.[0] as any)?.count_no ?? "";
      return { ...result, count_no: fetchedCountNo };
    } catch (error) {
      console.error("Error fetching generated count_no:", error);
      return result;
    }
  }

  return result;
}
saveFlowAssignLevels 
/** All users for the company (used by the Add User modal) */
export async function getFlowAssignAllUsers(companyCode: string) {
  return procBuildDynamicSqlSecurity({
    parameter: "PROC_FUN_ASSIGN_ALL_USERS", // TODO: backend needs to add this branch, mirroring PROC_FUN_ASSIGN_ROLE_USERS but without the role filter
    code1: companyCode,
  }) as Promise<TFlowRoleUser[]>;
}