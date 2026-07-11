import { api } from "./client";
import { LookupRow } from "./lookups";

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
  const response = await api.get<ApiResponse<HrMasterResponse>>(`${EMS_API_PREFIX}/${master}`, {
    params: options,
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

export async function saveHrGm(endpoint: string, payload: Record<string, unknown>, method: "post" | "put" = "post") {
  const response = await api[method]<ApiResponse<unknown>>(`${EMS_API_PREFIX}/gm/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function deleteHrMaster(master: string, ids: unknown[]) {
  const response = await api.post<ApiResponse<unknown>>(`${EMS_API_PREFIX}/${master}`, { ids });
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${master}`);
  return response.data;
}

export async function deleteHrGm(endpoint: string, ids: unknown[]) {
  const response = await api.post<ApiResponse<unknown>>(`${EMS_API_PREFIX}/gm/${endpoint}/delete`, ids);
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
  const response = await api.get<ApiResponse<HrLeaveFlowResponse>>(`${EMS_API_PREFIX}/Pg_leave_flow_cancel`, {
    params: { code: loginid, page, limit },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load leave cancel requests");
  return response.data.data || { tableData: [], count: 0 };
}

export async function getHrLeaveFlow(master: string, loginid: string, page = 1, limit = 1000) {
  const response = await api.get<ApiResponse<HrLeaveFlowResponse>>(`${EMS_API_PREFIX}/${master}`, {
    params: { code: loginid, page, limit },
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

export async function getHrEmployees(loginId?: string) {
  const response = await api.get<ApiResponse<HrEmployee[]> | HrEmployee[]>(`${EMS_API_PREFIX}/gm/employees`, {
    params: loginId ? { loginid: loginId } : undefined,
  });
  return normalizeApiRows<HrEmployee>(response.data, "Unable to load employees");
}

export async function getHrLeaveEntitlement(employeeId: string) {
  const response = await api.get<ApiResponse<HrLeaveEntitlement[]> | HrLeaveEntitlement[]>(`${EMS_API_PREFIX}/gm/leaveentitle/${employeeId}`);
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
  const response = await api.get<unknown>(`${EMS_API_PREFIX}/gm/validateleave`, {
    params: payload,
  });
  return response.data;
}

export async function saveHrLeaveApproval(payload: Record<string, unknown>) {
  const response = await api.put<ApiResponse<unknown> & { request_number?: unknown }>(`${EMS_API_PREFIX}/gm/upsertLeaveApprovalHandler`, payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save leave request");
  return response.data;
}

export async function executeHrRawSql<T = Record<string, unknown>>(rawSql: string) {
  const response = await api.post<ApiResponse<T[]> | { data?: T[]; success?: boolean; error?: string }>(`${EMS_API_PREFIX}/gm/executeRawSql`, {
    raw_sql: rawSql,
  });
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
  const response = await api.get<ApiResponse<Record<string, unknown>[]> | Record<string, unknown>[]>(`${EMS_API_PREFIX}/gm/leavehistory`, {
    params,
  });
  return normalizeApiRows<Record<string, unknown>>(response.data, "Unable to load leave history");
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

export async function saveHrPayComponent(payload: { header: Record<string, unknown>; details: Record<string, unknown>[] }) {
  const response = await api.post<ApiResponse<unknown>>("/api/finance/insUpdHrPayComponent", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save pay unit");
  return response.data;
}

export async function saveHrPayCompDepend(payload: { header: Record<string, unknown>[]; details: Record<string, unknown>[] }) {
  const response = await api.post<ApiResponse<unknown>>("/api/finance/insUpdHrPayCompDepend", payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save pay units dependant");
  return response.data;
}
