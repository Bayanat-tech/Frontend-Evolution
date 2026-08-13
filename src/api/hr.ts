import { TEmployeeHr } from "../pages/hr/Employee Master/employee-hr.types";
import { api } from "./client";
import { LookupRow } from "./lookups";

const HR_API_PREFIX = "/api/hr";
const EMS_API_PREFIX = "/api/ems";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type HrMasterResponse = {
  tableData: Record<string, unknown>[];
  count: number;
};

export async function getHrMaster(master: string, options: Record<string, unknown> = {}) {
  const response = await withHrFallback((prefix) => api.get<ApiResponse<HrMasterResponse>>(`${prefix}/${master}`, { params: options }));
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

export async function saveHrGm(endpoint: string, payload: Record<string, unknown>, method: "post" | "put" = "post") {
  const response = await withHrFallback((prefix) => api[method]<ApiResponse<unknown>>(`${prefix}/gm/${endpoint}`, payload));
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function deleteHrMaster(master: string, ids: unknown[]) {
  const response = await withHrFallback((prefix) => api.post<ApiResponse<unknown>>(`${prefix}/${master}`, { ids }));
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${master}`);
  return response.data;
}

export async function deleteHrGm(endpoint: string, ids: unknown[]) {
  const response = await withHrFallback((prefix) => api.post<ApiResponse<unknown>>(`${prefix}/gm/${endpoint}/delete`, ids));
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${endpoint}`);
  return response.data;
}

export type HrLeaveFlowResponse = {
  tableData: LookupRow[];
  count: number;
};

export type HrEmployee = {
  EMPLOYEE_ID?: string;
  EMPLOYEE_CODE?: string;
  ALTERNATE_ID?: string;
  RPT_NAME?: string;
  EMPLOYEE_NAME?: string;
  SUPERVISOR_EMPID?: string;
  DEPT_HEAD_EMPID?: string;
  MANGR_EMPID?: string;
  IMMEDIATE_SUPERVISOR?: string;
  DEPT_HEAD?: string;
  HOD?: string;
  [key: string]: unknown;
};

export type HrLeaveEntitlement = {
  LEAVE_TYPE?: string;
  LEAVE_DESC?: string;
  LEAVE_TYPE_DESC?: string;
  [key: string]: unknown;
};

export async function getHrLeaveCancel(loginid: string, page = 1, limit = 100) {
  const response = await withHrFallback((prefix) => api.get<ApiResponse<HrLeaveFlowResponse>>(`${prefix}/Pg_leave_flow_cancel`, {
    params: { code: loginid, page, limit },
  }));
  if (!response.data.success) throw new Error(response.data.message || "Unable to load leave cancel requests");
  return response.data.data || { tableData: [], count: 0 };
}

export async function getHrLeaveFlow(master: string, loginid: string, page = 1, limit = 1000) {
  const response = await withHrFallback((prefix) => api.get<ApiResponse<HrLeaveFlowResponse>>(`${prefix}/${master}`, {
    params: { code: loginid, page, limit },
  }));
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

export async function getHrEmployees(loginId?: string) {
  const response = await withHrFallback((prefix) => api.get<ApiResponse<HrEmployee[]> | HrEmployee[]>(`${prefix}/gm/employees`, {
    params: loginId ? { loginid: loginId } : undefined,
  }));
  return normalizeApiRows<HrEmployee>(response.data, "Unable to load employees");
}

export async function getHrLeaveEntitlement(employeeId: string) {
  const response = await withHrFallback((prefix) => api.get<ApiResponse<HrLeaveEntitlement[]> | HrLeaveEntitlement[]>(`${prefix}/gm/leaveentitle/${employeeId}`));
  return normalizeApiRows<HrLeaveEntitlement>(response.data, "Unable to load leave entitlement");
}

export type ValidateLeavePayload = {
  companyCode: string;
  employeeId: string;
  leaveStartDate: string;
  leaveEndDate: string;
  leaveType: string;
  leaveDays: number;
};

export async function validateHrLeave(payload: ValidateLeavePayload) {
  const response = await withHrFallback((prefix) => api.get<unknown>(`${prefix}/gm/validateleave`, {
    params: payload,
  }));
  return response.data;
}

export async function saveHrLeaveApproval(payload: Record<string, unknown>) {
  const response = await withHrFallback((prefix) => api.put<ApiResponse<unknown> & { request_number?: unknown }>(`${prefix}/gm/upsertLeaveApprovalHandler`, payload));
  if (!response.data.success) throw new Error(response.data.message || "Unable to save leave request");
  return response.data;
}

export async function uploadHrEmployeeAttachment(requestNumber: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("request_number", requestNumber);
  formData.append("type", "Employees");
  const response = await api.post<ApiResponse<string>>("/api/files/uploadEmployeeAttachment", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to upload ${file.name}`);
  return response.data.data || "";
}

export async function saveHrLeaveFiles(requestNumber: string, files: Record<string, unknown>[]) {
  const response = await withHrFallback((prefix) => api.post<ApiResponse<unknown>>(`${prefix}/gm/saveFile`, {
    request_number: requestNumber,
    files,
  }));
  if (!response.data.success) throw new Error(response.data.message || "Unable to save leave attachments");
  return response.data;
}

export type HrAttachmentFile = {
  company_code?: string;
  companyCode?: string;
  request_number?: string;
  requestNumber?: string;
  sr_no?: number;
  srNo?: number;
  file_name?: string;
  fileName?: string;
  org_file_name?: string;
  orgFileName?: string;
  aws_file_locn?: string;
  awsFileLocn?: string;
  flow_level?: number;
  flowLevel?: number;
  modules?: string;
  updated_by?: string;
  updatedBy?: string;
  created_by?: string;
  createdBy?: string;
  extensions?: string;
  user_file_name?: string;
  userFileName?: string;
  type?: string;
};

export async function getHrEmployeeFiles(requestNumber: string) {
  if (!requestNumber) return [];
  const response = await api.get<ApiResponse<HrAttachmentFile[]>>(`/api/files/employees/${encodeURIComponent(requestNumber)}`, {
    params: { modules: "hr" },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load leave attachments");
  return (response.data.data || []).map(normalizeHrAttachment);
}

export async function renameHrEmployeeFile(requestNumber: string, awsFileLocn: string, userFileName: string) {
  const response = await api.put<ApiResponse<unknown>>("/api/files/editEmployeeFile", {
    request_number: requestNumber,
    aws_file_locn: awsFileLocn,
    user_file_name: userFileName,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to rename leave attachment");
  return response.data;
}

export async function deleteHrEmployeeFile(requestNumber: string, srNo: number) {
  const response = await api.delete<ApiResponse<unknown>>(`/api/files/deleteEmployeeFiles/${encodeURIComponent(requestNumber)}/${encodeURIComponent(String(srNo))}`);
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete leave attachment");
  return response.data;
}

export async function executeHrRawSql<T = Record<string, unknown>>(rawSql: string) {
  const response = await withHrFallback((prefix) => api.post<ApiResponse<T[]> | { data?: T[]; success?: boolean; error?: string }>(`${prefix}/gm/executeRawSql`, {
    raw_sql: rawSql,
  }));
  const payload = response.data;
  if (payload.success === false) throw new Error(("error" in payload && payload.error) || "Unable to execute HR query");
  return normalizeApiRows<T>(payload, "Unable to execute HR query");
}

export async function getHrLeaveHistory(params: {
  employeeId: string;
  leaveType?: string;
  leaveStartDateFrom?: string;
  leaveEndDateTo?: string;
}) {
  const response = await withHrFallback((prefix) => api.get<ApiResponse<Record<string, unknown>[]> | Record<string, unknown>[]>(`${prefix}/gm/leavehistory`, {
    params,
  }));
  return normalizeApiRows<Record<string, unknown>>(response.data, "Unable to load leave history");
}

async function withHrFallback<T>(request: (prefix: string) => Promise<T>) {
  try {
    return await request(HR_API_PREFIX);
  } catch (error) {
    if (isNotFound(error)) return request(EMS_API_PREFIX);
    throw error;
  }
}

function isNotFound(error: unknown) {
  return Boolean(error && typeof error === "object" && "response" in error && (error as { response?: { status?: number } }).response?.status === 404);
}

function normalizeApiRows<T>(payload: unknown, fallbackMessage: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  if (record.success === false) throw new Error(String(record.message || record.error || fallbackMessage));

  const data = record.data;
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as T[];
    if (Array.isArray(nested.rows)) return nested.rows as T[];
    if (Array.isArray(nested.tableData)) return nested.tableData as T[];
  }

  if (Array.isArray(record.rows)) return record.rows as T[];
  if (Array.isArray(record.tableData)) return record.tableData as T[];
  return [];
}

function normalizeHrAttachment(file: HrAttachmentFile) {
  return {
    company_code: text(file.company_code ?? file.companyCode),
    request_number: text(file.request_number ?? file.requestNumber),
    sr_no: numberValue(file.sr_no ?? file.srNo) ?? 0,
    file_name: text(file.file_name ?? file.fileName),
    org_file_name: text(file.org_file_name ?? file.orgFileName),
    aws_file_locn: text(file.aws_file_locn ?? file.awsFileLocn),
    flow_level: numberValue(file.flow_level ?? file.flowLevel) ?? 0,
    modules: text(file.modules),
    updated_by: text(file.updated_by ?? file.updatedBy),
    created_by: text(file.created_by ?? file.createdBy),
    extensions: text(file.extensions),
    user_file_name: text(file.user_file_name ?? file.userFileName ?? file.org_file_name ?? file.orgFileName),
    type: text(file.type),
  };
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

export async function saveHrPayComponent(payload: { header: Record<string, unknown>; details: Record<string, unknown>[] }) {
  const response = await api.post<ApiResponse<unknown>>("/api/finance/insUpdHrPayComponent", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save pay unit");
  return response.data;
}

export async function saveHrPayCompDepend(payload: { header: Record<string, unknown>[]; details: Record<string, unknown>[] }) {
  const response = await api.post<ApiResponse<unknown>>("/api/finance/insUpdHrPayCompDepend", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save pay units dependant");
  return response.data;
};

export async function insUpdHrEmployee(employee: TEmployeeHr): Promise<boolean> {
    try {
      const response = await api.post('/api/finance/insUpdHrEmployee',{ employee });  
      return response.data?.success === true;
    } catch (err) {
      console.error('Failed to save employee:', err);
      return false;
    }
  };

export async function uploadFile(file: Blob | File, filename?: string) {
    const chatFileUpload = new FormData();
    chatFileUpload.append(`file`, file);
    const response = await api.post<ApiResponse<unknown>>('api/files/upload', chatFileUpload, {headers: {'Content-Type': 'multipart/form-data' }})
    if (!response.data.success) throw new Error(response.data.message || "Unable to save Image");
    return response.data;
};

export type TAccrualAcctSetupPayload = {
  company_code: string;
  div_code: string;
  dept_code: string;
  section_code: string;
  pay_comp_id: string;
  ac_code_db?: string | null;
  ac_code_cr?: string | null;
  exp_type_code?: string | null;
  exp_subtype_code?: string | null;
  pay_comp_type?: string | null;
  pay_comp_earn_ded?: string | null;
  sepn_flag?: "Y" | "N";
  remarks?: string | null;
  user_id?: string | null;
  user_dt?: string | null;
};

export async function upsertAccrualAcctSetupApi(paycompAc: TAccrualAcctSetupPayload) {
  const response = await api.post<ApiResponse<unknown>>("/api/hr/insUpdAccrualAcctSetup", {
    paycomp_ac: paycompAc,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to save accrual account setup");
  return response.data;
}