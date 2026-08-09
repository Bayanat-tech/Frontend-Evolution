import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: string;
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
  code20?:string;
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
  val1s11?: string;
  val1s12?: string;
  val1s13?: string;
  val1s14?: string;
  val1s15?: string;
  val1s16?: string;
  val1s17?: string;
  val1s18?: string;
  val1s19?: string;
  val1s20?: string;
  val1s21?: string;
  val1s22?: string;
  val1s23?: string;
  val1s24?: string;
  val1s25?: string;
  val1s26?: string;
  val1s27?: string;
  val1s28?: string;
  val1s29?: string;
  val1s30?: string;
  val1s31?: string;
  val1s32?: string;
  val1s33?: string;
  val1s34?: string;
  val1s35?: string;
  val1s36?: string;
  val1s37?: string;
  val1s38?: string;
  val1s39?: string;
  val1s40?: string;
  val1s41?: string;
  val1s42?: string;
  val1s43?: string;
  val1s44?: string;
  val1s45?: string;
  val1s46?: string;
  val1s47?: string;
  val1s48?: string;
  val1s49?: string;
  val1s50?: string;

  val1s90?: string;

  val1n1?: number;
  val1n2?: number;
  val1n3?: number;
  val1n4?: number;
  val1n5?: number;
  val1n6?: number;
  val1n7?: number;
  val1n8?: number;
  val1n9?: number;
  val1n10?: number;

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

function extractApiErrorMessage(error: unknown, fallback: string) {
  const anyErr = error as any;
  const data = anyErr?.response?.data;
  // `details` carries the specific underlying error (e.g. the raw Oracle
  // error text, such as "ORA-00001: unique constraint ... violated");
  // `message` is often just a generic wrapper like "Failed to execute
  // insert/update". Prefer `details` so the real cause reaches the user.
  const backendMessage = data?.details || data?.message;
  if (backendMessage && typeof backendMessage === "string") return backendMessage;
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function getMasterLookup(appCode: string, master: string) {
  try {
    const response = await api.get<ApiResponse<{ tableData: LookupRow[]; count: number }>>(`/api/${appCode}/${master}`);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || `Unable to load ${master}`);
    return response.data.data?.tableData || [];
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, `Unable to load ${master}`));
  }
}

export async function getDynamicLookup(params: DynamicQueryParams) {
  try {
    const response = await api.post<ApiResponse<LookupRow[]>>("/api/wms/common/proc_build_dynamic_sql_common", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to load lookup data");
    return response.data.data || [];
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to load lookup data"));
  }
}

export async function getDynamicLookupaccount(params: DynamicQueryParams) {
  try {
    const response = await api.post<ApiResponse<LookupRow[]>>("/api/wms/common/proc_build_dynamic_sql_common20", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to load lookup data");
    return response.data.data || [];
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to load lookup data"));
  }
}

export async function getDynamicFinanceLookup(params: DynamicQueryParams) {
  try {
    const response = await api.post<ApiResponse<LookupRow[]>>("api/finance/proc_common_sql_finance", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to load Financelookup data");
    return response.data.data || [];
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to load Financelookup data"));
  }
}

export async function executeDynamicMutation(params: DynamicMutationParams) {
  try {
    const response = await api.post<ApiResponse<unknown>>("/api/wms/common/proc_build_dynamic_ins_upd_common", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to save record");
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to save record"));
  }
}

export async function executeDynamicMutationColumn90(params: DynamicMutationParams) {
  try {
    const response = await api.post<ApiResponse<unknown>>("/api/wms/common/proc_build_dynamic_ins_upd_column90", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to save record");
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to save record"));
  }
}

export async function executeDynamicDelete(params: DynamicDeleteParams) {
  try {
    const response = await api.post<ApiResponse<unknown>>("/api/wms/common/proc_build_dynamic_del_common", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to delete record");
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to delete record"));
  }
}

export async function executeCommonProcedure(params: Record<string, unknown>) {
  try {
    const response = await api.post<ApiResponse<unknown>>("/api/wms/common/procBuildCommonProcedurewmc", params);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to execute procedure");
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to execute procedure"));
  }
}

export async function postFinance<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  try {
    const response = await api.post<ApiResponse<unknown>>(`/api/finance/${endpoint}`, payload);
    if (!response.data.success) throw new Error(response.data.details || response.data.message || "Unable to save finance data");
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to save finance data"));
  }
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
    .map((field) => formatLookupDisplayValue(field, getLookupValue(row, field)))
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(String)
    .join(" - ");
}

export function formatLookupDisplayValue(field: string, value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/date/i.test(field)) return text;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const oracleMatch = text.match(/^(\d{2})-([A-Z]{3})-(\d{2,4})(?:\s.*)?$/i);
  if (oracleMatch) return `${oracleMatch[1]}-${oracleMatch[2].toUpperCase()}-${oracleMatch[3]}`;

  return text;
}