import { api } from "./client";

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
