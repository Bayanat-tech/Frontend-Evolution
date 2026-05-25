import { api } from "./client";
import type { DynamicQueryParams, LookupRow } from "./lookups";
import { fetchDropdownOptions as fetchDropdownOptionsFromRegistry } from "./dropdowns";

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

export async function getWmsMaster(master: string, options: WmsPagination & Record<string, unknown> = {}) {
  const response = await api.get<ApiResponse<WmsMasterResponse>>(`/api/wms/${master}`, {
    params: options,
  });
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data || { tableData: [], count: 0 };
}

/**
 * Fetch dropdown options by key (e.g., 'country', 'currency')
 */
export async function fetchDropdownOptions(key: string, filters?: Record<string, unknown>) {
  return fetchDropdownOptionsFromRegistry(key as any, filters);
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

export async function executeWmsInboundSql(rawSql: string) {
  const response = await api.post<ApiResponse<LookupRow[]> & { data?: LookupRow[]; totalCount?: number }>("/api/wms/inbound/executeRawSql", {
    raw_sql: rawSql,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load inbound data");
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
