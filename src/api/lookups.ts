import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type LookupRow = Record<string, unknown>;

export type DynamicQueryParams = {
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

export type DynamicMutationParams = {
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

export type DynamicDeleteParams = {
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

export async function getMasterLookup(appCode: string, master: string) {
  const response = await api.get<ApiResponse<{ tableData: LookupRow[]; count: number }>>(`/api/${appCode}/${master}`);
  if (!response.data.success) throw new Error(response.data.message || `Unable to load ${master}`);
  return response.data.data?.tableData || [];
}

export async function getDynamicLookup(params: DynamicQueryParams) {
  const response = await api.post<ApiResponse<LookupRow[]>>("/api/wms/common/proc_build_dynamic_sql_common", params);
  if (!response.data.success) throw new Error(response.data.message || "Unable to load lookup data");
  return response.data.data || [];
}

export async function executeDynamicMutation(params: DynamicMutationParams) {
  const response = await api.post<ApiResponse<unknown>>("/api/wms/common/proc_build_dynamic_ins_upd_common", params);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save record");
  return response.data;
}

export async function executeDynamicDelete(params: DynamicDeleteParams) {
  const response = await api.post<ApiResponse<unknown>>("/api/wms/common/proc_build_dynamic_del_common", params);
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete record");
  return response.data;
}

export async function executeCommonProcedure(params: Record<string, unknown>) {
  const response = await api.post<ApiResponse<unknown>>("/api/wms/common/procBuildCommonProcedurewmc", params);
  if (!response.data.success) throw new Error(response.data.message || "Unable to execute procedure");
  return response.data;
}

export async function postFinance<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await api.post<ApiResponse<unknown>>(`/api/finance/${endpoint}`, payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to save finance data");
  return response.data;
}

export function getLookupValue(row: LookupRow, field: string) {
  if (field in row) return row[field];
  const lower = field.toLowerCase();
  const upper = field.toUpperCase();
  const match = Object.keys(row).find((key) => key.toLowerCase() === lower || key.toUpperCase() === upper);
  return match ? row[match] : "";
}

export function getLookupText(row: LookupRow, fields: string[]) {
  return fields
    .map((field) => getLookupValue(row, field))
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(String)
    .join(" - ");
}
