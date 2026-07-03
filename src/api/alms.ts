import { api } from "./client";

type ApiResponse<T> = {
  includes(arg0: string): unknown;
  success: boolean;
  data?: T;
  message?: string;
};

export type AlmsProcedureParams = {
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

// export async function almsSelect<T = Record<string, unknown>>(
//   params: AlmsProcedureParams
// ): Promise<T[]> {
//   const response = await api.post<ApiResponse<T[]>>(
//     "/api/alms/gm/proc_build_dynamic_sql_amlspf",
//     normalizeParams(params)
//   );
//   if (!response.data.success)
//     throw new Error(response.data.message || "Unable to load ALMS data");
//   return Array.isArray(response.data.data) ? response.data.data : [];
// }

export async function almsCommonSelect<T = Record<string, unknown>>(
  params: AlmsProcedureParams
): Promise<T[]> {
  if (!params?.parameter) return [];
  try {
    const response = await api.post<ApiResponse<T[]>>(
      "/api/wms/common/proc_build_dynamic_sql_common",
      params
    );
    if (response.data?.success && Array.isArray(response.data?.data))
      return uppercaseData(response.data.data);
    return [];
  } catch (error: unknown) {
    console.error(
      "Error in almsCommonSelect:",
      (error as { message: string }).message
    );
    return [];
  }
}

export async function almsSave(params: AlmsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/proc_build_dynamic_ins_upd_common",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to save ALMS record");
  return {
    ...response.data,
    data: uppercaseData([response.data.data])[0],
  };
}

export async function almsDelete(params: AlmsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/proc_build_dynamic_del_common",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to delete ALMS record");
  return {
    ...response.data,
    data: uppercaseData([response.data.data])[0],
  };
}

export async function almsCommonProcedure(params: AlmsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/wms/common/procBuildCommonProcedurewmc",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to run process");
  return {
    ...response.data,
    data: uppercaseData([response.data.data])[0],
  };
}

function normalizeParams(params: AlmsProcedureParams) {
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

// Recursively uppercase all keys AND string values (frontend-only transform)
function uppercaseData<T = Record<string, unknown>>(data: T[]): T[] {
  const transformValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.toUpperCase();
    }
    if (Array.isArray(value)) {
      return value.map(transformValue);
    }
    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>)) {
        result[key.toUpperCase()] = transformValue(
          (value as Record<string, unknown>)[key]
        );
      }
      return result;
    }
    return value;
  };

  return data.map((row) => transformValue(row) as T);
}