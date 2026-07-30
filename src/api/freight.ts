import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type FreightProcedureParams = {
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
  number5?: number;
  date1?: string | null;
  date2?: string | null;
  date3?: string | null;
  date4?: string | null;
  date5?: string | null;
  [key: `code${number}`]: string | undefined;
  [key: `number${number}`]: number | undefined;
  [key: `date${number}`]: string | null | undefined;
  [key: `val1s${number}`]: string | undefined;
  [key: `val1n${number}`]: number | undefined;
  [key: `val1d${number}`]: string | Date | null | undefined;
  [key: `wval1s${number}`]: string | undefined;
  [key: `wval1n${number}`]: number | undefined;
  [key: `wval1d${number}`]: string | Date | null | undefined;
};

export async function freightSelect<T = Record<string, unknown>>(
  params: FreightProcedureParams
): Promise<T[]> {
  const response = await api.post<ApiResponse<T[]>>(
    "/api/freight/gm/proc_build_dynamic_sql_freight",
    normalizeParams(params)
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to load Freight data");
  }
  return Array.isArray(response.data.data) ? response.data.data : [];
}

export async function freightSave(params: FreightProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/freight/gm/proc_build_dynamic_ins_upd_freight",
    normalizeParams(params)
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to save Freight record");
  }
  return response.data;
}

export async function freightDelete(params: FreightProcedureParams) {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/freight/gm/proc_build_dynamic_del_freight",
    normalizeParams(params)
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Unable to delete Freight record");
  }
  return response.data;
}

function normalizeParams(params: FreightProcedureParams) {
  return {
    code1: "NULL",
    code2: "NULL",
    code3: "NULL",
    code4: "NULL",
    code5: "NULL",
    code6: "NULL",
    code7: "NULL",
    code8: "NULL",
    code9: "NULL",
    code10: "NULL",
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    number5: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
    date5: null,
    ...params,
  };
}
