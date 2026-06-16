import { api } from "./client";

type ApiResponse<T> = {
  includes(arg0: string): unknown;
  success: boolean;
  data?: T;
  message?: string;
};

export type PamsProcedureParams = {
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
  val1d1?: string | Date | null;
  val1d2?: string | Date | null;
  val1d3?: string | Date | null;
  val1d4?: string | Date | null;
  val1d5?: string | Date | null;
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
  wval1d1?: string | Date | null;
  wval1d2?: string | Date | null;
  wval1d3?: string | Date | null;
  wval1d4?: string | Date | null;
  wval1d5?: string | Date | null;
};

// ── PAMS procedure (proc_build_dynamic_sql_pams) ──────────────
export async function pamsSelect<T = Record<string, unknown>>(
  params: PamsProcedureParams
): Promise<T[]> {
  const response = await api.post<ApiResponse<T[]>>(
    "/api/pams/gm/proc_build_dynamic_sql_pams",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to load PAMS data");
  return Array.isArray(response.data.data) ? response.data.data : [];
}

// ── Common procedure (PROC_BUILD_DYNAMIC_SQL_COMMON) ─────────
export async function pamsCommonSelect<T = Record<string, unknown>>(
  params: PamsProcedureParams
): Promise<T[]> {
  if (!params?.parameter) return [];
  try {
    const response = await api.post<ApiResponse<T[]>>(
      "/api/wms/common/proc_build_dynamic_sql_common",
      params
    );
    if (response.data?.success && Array.isArray(response.data?.data))
      return response.data.data;
    return [];
  } catch (error: unknown) {
    console.error(
      "Error in pamsCommonSelect:",
      (error as { message: string }).message
    );
    return [];
  }
}

export async function pamsSave(params: PamsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/pams/gm/proc_build_dynamic_ins_upd_pams",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to save PAMS record");
  return response.data;
}

export async function pamsDelete(params: PamsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/pams/gm/proc_build_dynamic_del_pams",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to delete PAMS record");
  return response.data;
}

export async function pamsCommonProcedure(params: PamsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/procBuildCommonProcedurewmc",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to run process");
  return response.data;
}

export async function pamsUpdateRatings(rows: Record<string, unknown>[]) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/pams/gm/update-ratings",
    { rows }
  );
  if (
    !response.data.success &&
    response.data.message !== "Ratings updated successfully"
  ) {
    throw new Error(response.data.message || "Unable to update ratings");
  }
  return response.data;
}

export async function pamsPopulateDepartmentKpi(params: {
  company_code: string;
  employee_code: string;
  item_type: string;
}) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/pams/gm/proc_populate_ms_eam_dept_kpi",
    params
  );
  if (!response.data.success)
    throw new Error(
      response.data.message || "Unable to populate assignment data"
    );
  return response.data;
}

function normalizeParams(params: PamsProcedureParams) {
  return {
    code2: "NULL",
    code3: "NULL",
    code4: "NULL",
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
    ...params,
  };
}