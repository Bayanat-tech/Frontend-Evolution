import { api } from "./client";
import type { LookupRow } from "./lookups";

export type TInvoice = Record<string, unknown>;
export type TInvoiceDetail = Record<string, unknown>;
export type IPrincipal = { prin_code: string; prin_name: string };

type DynamicSqlResponse = {
  success: boolean;
  data?: LookupRow[];
  message?: string;
};

/**
 * Direct 1:1 port of commonservices.ts → proc_build_dynamic_sql_common.
 * Does NOT throw on failure — returns [] instead, matching old behavior
 * (old code returned null on failure; callers here just get an empty array).
 */
async function fetchDynamicSql(params: {
  parameter: string;
  loginid?: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  number1?: number;
  number2?: number;
  number3?: number;
  number4?: number;
  date1?: string | null;
  date2?: string | null;
  date3?: string | null;
  date4?: string | null;
}): Promise<LookupRow[]> {
  try {
    const response = await api.post<DynamicSqlResponse>(
      "/api/wms/common/proc_build_dynamic_sql_common",
      params
    );
    if (response.data?.success && response.data?.data) return response.data.data;
    return [];
  } catch (error) {
    console.error("Error in fetchDynamicSql:", error instanceof Error ? error.message : error);
    return [];
  }
}

/* ================= INVOICE HEADERS ================= */

export async function getAllInvoices(company_code: string, loginid: string) {
  return fetchDynamicSql({
    parameter: "TBILL_bill_creation",
    loginid,
    code1: company_code,
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
  });
}

/* ================= PRINCIPAL DROPDOWN ================= */

export async function getPrincipalDropdown(company_code: string, loginid: string): Promise<IPrincipal[]> {
  const rows = await fetchDynamicSql({
    parameter: "TBILL_dd_Prodmaster",
    loginid,
    code1: company_code,
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
  });
  return rows as unknown as IPrincipal[];
}

/* ================= INVOICE DETAIL LINES ================= */

export async function getInvoiceDetailLines(params: {
  loginid: string;
  company_code: string;
  prin_code: string;
  invoice_no?: string;
  job_no?: string;
}) {
  return fetchDynamicSql({
    parameter: "TBILL_invoice_detail_lines",
    loginid: params.loginid,
    code1: params.company_code,
    code2: params.prin_code,
    code3: params.invoice_no || "",
    code4: params.job_no || "",
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
  });
}

/* ================= JOB SELECTION ================= */

export async function getInvoiceJobSelection(params: {
  loginid: string;
  company_code: string;
  prin_code: string;
  from_date?: string;
  to_date?: string;
  invoice_no?: string;
}) {
  return fetchDynamicSql({
    parameter: "TBILL_invoice_job_selection",
    loginid: params.loginid,
    code1: params.company_code,
    code2: `${params.prin_code}$$$$${params.invoice_no ?? ""}`,
    code3: params.from_date || "",
    code4: params.to_date || "",
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
  });
}

/* ================= DELETE INVOICE ================= */

export async function deleteInvoice(params: {
  loginid: string;
  company_code: string;
  invoice_no: string;
  prin_code: string;
}): Promise<boolean> {
  try {
    const response = await api.post<{ success: boolean; message?: string }>(
      "/api/wms/common/proc_build_dynamic_del_common",
      {
        parameter: "delete_invoice",
        loginid: params.loginid,
        code1: params.company_code,
        code2: params.invoice_no,
        code3: params.prin_code,
        code4: "NULL",
      }
    );
    return !!response.data?.success;
  } catch (error) {
    console.error("Error in deleteInvoice:", error instanceof Error ? error.message : error);
    return false;
  }
}

/* ================= STORAGE SELECTION (TBILL_invoice_storage_selection) ================= */

export type StorageSelectionRow = {
  SELECTED: string;
  STORAGE_NO: string;
  PRIN_CODE: string;
  SITE_IND: string;
  RCPT_DATE: string | null;
  TXN_DATE: string | null;
  QTY: number;
  VOLUME: number;
  AMOUNT: number;
  PROD_CODE: string;
  SEQ_NUMBER: number;
  CONSOLIDATED_INVNO: string;
  ACTIVITY: string;
};

export async function getStorageSelection(params: {
  loginid: string;
  company_code: string;
  prin_code: string;
  consolidated_invno?: string;
  from_date?: string; // DD/MM/YYYY
  to_date?: string; // DD/MM/YYYY
}): Promise<LookupRow[]> {
  return fetchDynamicSql({
    parameter: "TBILL_invoice_storage_selection",
    loginid: params.loginid,
    code1: params.company_code,
    code2: `${params.prin_code}$$${params.consolidated_invno ?? ""}`,
    code3: params.from_date || "",
    code4: params.to_date || "",
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
  });
}

/** Normalize a raw storage row into the exact T_MNSTORAGE_DET_SELECT_BILLING shape */
export function normalizeStorageRow(row: any, consolidatedInvNo: string): StorageSelectionRow {
  const get = (key: string) => row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  return {
    SELECTED: String(get("selected") ?? "N"),
    STORAGE_NO: String(get("storage_no") ?? ""),
    PRIN_CODE: String(get("prin_code") ?? ""),
    SITE_IND: String(get("site_ind") ?? ""),
    RCPT_DATE: get("rcpt_date") ?? null,
    TXN_DATE: get("txn_date") ?? null,
    QTY: Number(get("qty") ?? 0),
    VOLUME: Number(get("volume") ?? 0),
    AMOUNT: Number(get("amount") ?? 0),
    PROD_CODE: String(get("prod_code") ?? ""),
    SEQ_NUMBER: Number(get("seq_number") ?? 0),
    CONSOLIDATED_INVNO: consolidatedInvNo,
    ACTIVITY: String(get("activity") ?? ""),
  };
}

/* ================= SAVE INVOICE (header + lines + storage + job selection) ================= */

export async function updateBillingApi(params: {
  invoiceHeader: TInvoice[];
  invoiceDetails: TInvoiceDetail[];
  storageSelection?: StorageSelectionRow[];
  jobSelection?: Record<string, unknown>[];
}): Promise<{ success: boolean; message: string }> {
  if (!params?.invoiceHeader?.length) {
    return { success: false, message: "Missing invoice header data." };
  }
  try {
    const response = await api.post<{ message?: string; success?: boolean }>(
      "/api/wms/billing/updatebilling",
      {
        invoiceHeader: params.invoiceHeader,
        invoiceDetails: params.invoiceDetails,
        storageSelection: params.storageSelection ?? [],
        jobSelection: params.jobSelection ?? [],
      }
    );
    const ok = response.data?.message === "Invoice updated successfully" || response.data?.success === true;
    return { success: ok, message: response.data?.message || (ok ? "Saved." : "Save did not return success.") };
  } catch (error: any) {
    const apiMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Network or server error while saving invoice.";
    console.error("Error in updateBillingApi:", error);
    return { success: false, message: apiMessage };
  }
}
