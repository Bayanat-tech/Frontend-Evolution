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
  val1n6?: number;
  val1n7?: number;
  val1n8?: number;
  val1n9?: number;
  val1n10?: number;
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
  val2s1?: string;  // Details JSON
  val2s2?: string;  // Terms JSON
};

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

export async function almsSavePrequestBulk(payload: {
  header: Record<string, any>;
  details: Record<string, any>[];
  terms: Record<string, any>[];
}) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/ALMS/gm/insUpdTtePRequestBulk",
    payload
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to save ALMS record");
  return {                            
    ...response.data,
    data: uppercaseData([response.data.data])[0],
  };
}


export async function almsSave(params: AlmsProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/ALMS/gm/insUpdTtePRequestBulk",
    normalizeParams(params)
  );
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to save ALMS record");
  return {
    ...response.data,
    data: uppercaseData([response.data.data])[0],
  };
}

export async function almsGeneratePOFromPR(params: {
  companyCode: string;
  requestNumber: string;
  docType?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await api.post<ApiResponse<unknown>>(
      "/api/ALMS/gm/generatePOFromPR",
      {
        companyCode: params.companyCode,
        requestNumber: params.requestNumber,
        docType: params.docType || "LPO",
      }
    );
    if (!response.data.success) {
      return {
        success: false,
        message: response.data.message || "Failed to generate PO from PR.",
      };
    }
    return { success: true, message: response.data.message };
  } catch (error: unknown) {
    return {
      success: false,
      message: (error as { message?: string })?.message || "Failed to generate PO from PR.",
    };
  }
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

// FIXED: normalizeParams should preserve Date objects
function normalizeParams(params: AlmsProcedureParams) {
  // Create a new object with defaults
  const normalized: Record<string, any> = {
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
  };

  // Copy all properties from params (including Date objects)
  // Using Object.keys with type assertion
  (Object.keys(params) as Array<keyof AlmsProcedureParams>).forEach((key) => {
    const value = params[key];
    if (value !== undefined) {
      normalized[key as string] = value;
    }
  });

  return normalized;
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