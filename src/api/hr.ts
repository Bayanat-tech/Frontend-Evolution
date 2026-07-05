import { TEmployeeHr } from "../pages/hr/Employee Master/employee-hr.types";
import { api } from "./client";
import { LookupRow } from "./lookups";

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
  const response = await api.get<ApiResponse<HrMasterResponse>>(`/api/hr/${master}`, {
    params: options,
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

export async function saveHrGm(endpoint: string, payload: Record<string, unknown>, method: "post" | "put" = "post") {
  const response = await api[method]<ApiResponse<unknown>>(`/api/hr/gm/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function deleteHrMaster(master: string, ids: unknown[]) {
  const response = await api.post<ApiResponse<unknown>>(`/api/hr/${master}`, { ids });
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${master}`);
  return response.data;
}

export async function deleteHrGm(endpoint: string, ids: unknown[]) {
  const response = await api.post<ApiResponse<unknown>>(`/api/hr/gm/${endpoint}/delete`, ids);
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${endpoint}`);
  return response.data;
}

export type HrLeaveFlowResponse = {
  tableData: LookupRow[];
  count: number;
};

export async function getHrLeaveCancel(loginid: string, page = 1, limit = 100) {
  const response = await api.get<ApiResponse<HrLeaveFlowResponse>>("/api/hr/Pg_leave_flow_cancel", {
    params: { code: loginid, page, limit },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load leave cancel requests");
  return response.data.data || { tableData: [], count: 0 };
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
