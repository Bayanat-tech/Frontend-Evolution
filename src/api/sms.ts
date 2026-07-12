import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type SmsRow = Record<string, unknown>;

export type SmsMasterResponse = {
  tableData: SmsRow[];
  count: number;
};

export type SmsMasterData = {
  companies?: SmsRow[];
  services?: SmsRow[];
  segments?: SmsRow[];
  salesmen?: SmsRow[];
  reasons?: SmsRow[];
  deals?: SmsRow[];
  probabilities?: SmsRow[];
};

export async function getSmsMaster(master: string, options: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<SmsMasterResponse>>(`/api/sms/${master}`, { params: options });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

export async function getSmsMasterData() {
  const response = await api.get<ApiResponse<SmsMasterData>>("/api/sms/masters/all");
  if (!response.data.success) throw new Error(response.data.message || "Unable to load SMS master data");
  return response.data.data || {};
}

export async function saveSmsGm(endpoint: string, payload: unknown, method: "post" | "put" | "patch" = "post") {
  const response = await api[method]<ApiResponse<unknown>>(`/api/sms/gm/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || `Unable to save ${endpoint}`);
  return response.data;
}

export async function deleteSmsMaster(master: string, ids: unknown[]) {
  const response = await api.post<ApiResponse<unknown>>(`/api/sms/${master}`, { ids });
  if (!response.data.success) throw new Error(response.data.message || `Unable to delete ${master}`);
  return response.data;
}

export async function getSmsDashboard(endpoint: string, params: Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<unknown>>(`/api/sms/dashboard/${endpoint}`, { params });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${endpoint}`);
  return response.data.data;
}
