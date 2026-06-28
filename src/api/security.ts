import { api } from "./client";

export type SecurityMasterResponse = {
  tableData: Record<string, unknown>[];
  count: number;
};

export type SecurityMasterParams = {
  page?: number;
  limit?: number;
  search?: string;
  columnFilters?: { field: string; value: string }[];
};

export async function getSecurityMaster(master: string, params: SecurityMasterParams = {}): Promise<SecurityMasterResponse> {
  const filter: Record<string, unknown> = {};
  const firstColumnFilter = params.columnFilters?.find((item) => item.value);
  if (firstColumnFilter) {
    filter.search = { field: firstColumnFilter.field, value: firstColumnFilter.value, values: firstColumnFilter.value };
  } else if (params.search?.trim()) {
    filter.search = { value: params.search.trim(), values: params.search.trim() };
  }

  const response = await api.get(`/api/security/${master}`, {
    params: {
      page: params.page || 1,
      limit: params.limit || 100,
      ...(Object.keys(filter).length ? { filter: JSON.stringify(filter) } : {}),
    },
  });
  return response.data.data || { tableData: [], count: 0 };
}

export async function saveSecurityMaster(endpoint: string, payload: Record<string, unknown>, method: "post" | "put") {
  const response = await api[method](`/api/security/gm/${endpoint}`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Unable to save security record");
  }
  return response.data;
}

export async function saveSecurityGm(endpoint: string, payload: Record<string, unknown>, method: "post" | "put" | "patch" = "post") {
  const response = await api[method](`/api/security/gm/${endpoint}`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Unable to save security record");
  }
  return response.data;
}

export async function getSecurityGm<T = unknown>(endpoint: string) {
  const response = await api.get(`/api/security/gm/${endpoint}`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Unable to load security record");
  }
  return response.data.data as T;
}

export async function getSecurityGmWithParams<T = unknown>(endpoint: string, params: Record<string, unknown>) {
  const response = await api.get(`/api/security/gm/${endpoint}`, { params });
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Unable to load security record");
  }
  return response.data.data as T;
}

export async function deleteSecurityGm(endpoint: string, payload: Record<string, unknown>) {
  const response = await api.post(`/api/security/gm/${endpoint}`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Unable to delete security record");
  }
  return response.data;
}

export async function deleteSecurityMaster(master: string, ids: Array<string | number>) {
  const response = await api.post(`/api/security/${master}`, { ids });
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Unable to delete security record");
  }
  return response.data;
}
