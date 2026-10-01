
import { Customer, DashboardResponse, MonthlyAmount, PurchaseSalesDashboardData, Supplier } from "../pages/purchase_sales/dashboard/types";
import { InventoryDocType, IV_DOC_TYPE } from "../pages/purchase_sales/inventory/Inventorytypes";
import { PO_DOC_TYPE, PODocType } from "../pages/purchase_sales/purchase/Purchaseordertypes";
import { SO_DOC_TYPE, SODocType } from "../pages/purchase_sales/sales/SalesOrdertypes";
import { api } from "./client";
import type { LookupRow } from "./lookups";

export type TInvoice = Record<string, unknown>;
export type TInvoiceDetail = Record<string, unknown>;
export type IPrincipal = { prin_code: string; prin_name: string };

type ApiResponse<T> = {
  comparison_id: null;
  success: boolean;
  data?: T;
  message?: string;
};

export type TMfBomRowPayload = {
  company_code: string;
  prin_code: string;
  prod_code: string;
  child_prod_code: string;
  p_uom?: string | null;
  p_qty?: number | null;
  l_uom?: string | null;
  l_qty?: number | null;
  user_id?: string | null;
  user_dt?: string | null;
  quantity?: number | null;
  uppp?: number | null;
  bom_type?: string | null;
  unit_price?: number | null;
  prnt_p_code?: string | null;
};

export type TMfBomSaveResult = {
  success: boolean;
  message: string;
  data?: {
    company_code: string;
    prin_code: string;
    prod_code: string;
    records: number;
  };
  details?: string;
};

export async function upsertMfBomApi(bom: TMfBomRowPayload[]): Promise<TMfBomSaveResult> {
  const response = await api.post<ApiResponse<TMfBomSaveResult>>("/api/purchase-sales/insUpdMfBom", {
    bom,
  });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message ?? "Unable to save BOM");
  }

  return response.data.data;
}

/**
 * Direct 1:1 port of commonservices.ts → proc_build_dynamic_sql_common.
 * Does NOT throw on failure — returns [] instead, matching old behavior
 * (old code returned null on failure; callers here just get an empty array).
 */
// export async function upsertBulkPurchaseNSalesEntryApi(
//   payload: {
//     header: Record<string, unknown>;
//     details: Record<string, unknown>[];
//     company_code: string;
//     loginid: string;
//   },
//   action: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "SENTBACK" | "CLOSED" | "CANCELED"
// ) {
//   const response = await api.post<ApiResponse<unknown>>(
//     "/api/purchase-sales/insUpdTtePOrderBulk",
//     {
//       ...payload,
//       header: {
//         ...payload.header,
//         last_action: action,
//       },
//     }
//   );

//   if (!response.data.success) {
//     throw new Error(response.data.message || "Unable to perform purchase/sales entry action");
//   }

//   return response.data;
// }



export async function upsertBulkPurchaseEntryApi(
  payload: {
    header: Record<string, unknown>;
    details: Record<string, unknown>[];
    company_code: string;
    loginid: string;
  },
  action: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "SENTBACK" | "CLOSED" | "CANCELED",
  docType: PODocType
) {
const endpoint =
  docType === PO_DOC_TYPE.LPO
    ? "/api/purchase-sales/insUpdTtePOrderBulk"
    : docType === PO_DOC_TYPE.PQA
    ? "/api/purchase-sales/insUpdTtePQuotationBulk"
    : docType === PO_DOC_TYPE.GRN
    ? "/api/purchase-sales/insUpdTtePGrnBulk"
    : docType === PO_DOC_TYPE.JO
    ? "/api/purchase-sales/insUpdTteJOrderBulk"
    : docType === PO_DOC_TYPE.PIN
    ? "/api/purchase-sales/insUpdTtePInvoiceBulk"
    :""
    

  const response = await api.post<ApiResponse<unknown>>(endpoint, {
    ...payload,
    header: {
      ...payload.header,
      last_action: action,
    },
  });

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Unable to perform purchase/sales entry action"
    );
  }
  console.log("payloay",payload)

  return response.data;
}


export async function upsertBulkSaleseEntryApi(
  payload: {
    header: Record<string, unknown>;
    details: Record<string, unknown>[];
    company_code: string;
    loginid: string;
  },
  action: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "SENTBACK" | "CLOSED" | "CANCELED",
  docType: SODocType
) {
const endpoint =
  docType === SO_DOC_TYPE.SO
    ?"/api/purchase-sales/insUpdTteSOrderBulk"
    :docType === SO_DOC_TYPE.SDN
    ?"/api/purchase-sales/insUpdTteSdnBulk"
     :docType === SO_DOC_TYPE.SIN
    ?"/api/purchase-sales/insUpdTteSinvoice"
    :""
    

  const response = await api.post<ApiResponse<unknown>>(endpoint, {
    ...payload,
    header: {
      ...payload.header,
      last_action: action,
    },
  });

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Unable to perform purchase/sales entry action"
    );
  }

  return response.data;
}

export async function upsertBulkInventoryEntryApi(
  payload: {
    header: Record<string, unknown>;
    details: Record<string, unknown>[];
    company_code: string;
    loginid: string;
  },
  action: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "SENTBACK" | "CLOSED" | "CANCELED",
  docType: InventoryDocType
) {
const endpoint =
  docType === IV_DOC_TYPE.STR
    ?"/api/purchase-sales/insUpdTteTransferBulk"
    :docType === IV_DOC_TYPE.SAJ
    ?"/api/purchase-sales/insUpdTteAdjustmentBulk"
    :""
    

  const response = await api.post<ApiResponse<unknown>>(endpoint, {
    ...payload,
    header: {
      ...payload.header,
      last_action: action,
    },
  });

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Unable to perform purchase/sales entry action"
    );
  }

  return response.data;
}

export async function upsertBulkJobProductionEntryApi(
  payload: {
    header: Record<string, unknown>;
    details: Record<string, unknown>[];
     jmiConsumDetails:Record<string, unknown>[];
     expenseDetails:Record<string, unknown>[];
    company_code: string;
    loginid: string;
  },
  action: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "SENTBACK" | "CLOSED" | "CANCELED",
  docType: PODocType
) {
const endpoint =
  docType === PO_DOC_TYPE.FGP
    ? "/api/purchase-sales/insUpdJobProduction"
    :""
    

  const response = await api.post<ApiResponse<unknown>>(endpoint, {
    ...payload,
    header: {
      ...payload.header,
      last_action: action,
    },
  });

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Unable to perform purchase/sales entry action"
    );
  }

  return response.data;
}

export const insertQuotationComparison = async (data: {
  company_code: string;
  div_code: string;
  quotation_nos: string;
  user_id: string;
}) => {
  const response = await api.post<ApiResponse<unknown>>(
    "/api/purchase-sales/insertQuotationComparison",
    data
  );

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Quotation comparison failed"
    );
  }

  return response.data;
};

// export async function getPurchaseSalesDashboard(
//   companyCode: string,
//   signal?: AbortSignal
// ): Promise<PurchaseSalesDashboardData> {
//   const res = await api.get<DashboardResponse>("/api/purchase-sales/dashboard/purchase-sales", {
//     params: { company_code: companyCode },
//     signal,
//   });
//   if (!res.data?.success) {
//     throw new Error(res.data?.message || "Failed to load dashboard data");
//   }
//   const d = res.data.data;
//   return {
//     summary: d.summary,
//     topSuppliers: d.topSuppliers ?? [],
//     topCustomers: d.topCustomers ?? [],
//     monthlyPurchase: d.monthlyPurchase ?? [],
//     monthlySales: d.monthlySales ?? [],
//   };
// }

const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
  return undefined;
};
const num = (v: unknown) => Number(v ?? 0) || 0;
 
const toMonthly = (rows: any[] = []): MonthlyAmount[] =>
  rows.map((r) => ({
    month: String(pick(r, "month", "MONTH") ?? ""),
    totalAmount: num(pick(r, "totalAmount", "TOTAL_AMOUNT")),
  }));
 
const toSuppliers = (rows: any[] = []): Supplier[] =>
  rows.map((r) => ({
    supplierCode: String(pick(r, "supplierCode", "SUPPLIER_CODE") ?? ""),
     supplierName: String(pick(r, "supplierName", "SUPPLIER_NAME") ?? ""),
    totalAmount: num(pick(r, "totalAmount", "TOTAL_AMOUNT")),
  }));
 
const toCustomers = (rows: any[] = []): Customer[] =>
  rows.map((r) => ({
    customerCode: String(pick(r, "customerCode", "CUSTOMER_CODE") ?? ""),
       customerName: String(pick(r, " customerName", "CUSTOMER_NAME") ?? ""),
    totalAmount: num(pick(r, "totalAmount", "TOTAL_AMOUNT")),
  }));
 
// export async function getPurchaseSalesDashboard(
//   companyCode: string,
//   signal?: AbortSignal
// ): Promise<PurchaseSalesDashboardData> {

//   const currentDate = new Date();

//   const year = currentDate.getFullYear();
//   const month = currentDate.getMonth() + 1;

//   const res = await api.get<DashboardResponse>(
//     "/api/purchase-sales/dashboard/purchase-sales",
//     {
//       params: {
//         company_code: companyCode,
//         year,
//         month,
//       },
//       signal,
//     }
//   );

//   if (!res.data?.success) {
//     throw new Error(res.data?.message || "Failed to load dashboard data");
//   }

//   const d: any = res.data.data;
//   const s = d.summary ?? {};

//   return {
//     summary: {
//       totalPRequest: num(s.totalPRequest),
//       totalQuotation: num(s.totalQuotation),
//       totalPOrder: num(s.totalPOrder),
//       totalGrn: num(s.totalGrn),
//       pOrderGrnPending: num(s.pOrderGrnPending),
//       totalInvoice: num(s.totalInvoice),
//       invoicePending: num(s.invoicePending),
//       totalSOrder: num(s.totalSOrder),
//       totalSdn: num(s.totalSdn),
//       sOrderSdnPending: num(s.sOrderSdnPending),
//       totalSInvoice: num(s.totalSInvoice),
//       sInvoicePending: num(s.sInvoicePending),
//     },

//     topSuppliers: toSuppliers(d.topSuppliers),
//     topCustomers: toCustomers(d.topCustomers),
//     monthlyPurchase: toMonthly(d.monthlyPurchase),
//     monthlySales: toMonthly(d.monthlySales),
//   };
// }

export async function getPurchaseSalesDashboard(
  companyCode: string,
  year: number,
  month: number, // 0 = full year, 1-12 = month
  signal?: AbortSignal
): Promise<PurchaseSalesDashboardData> {

  const res = await api.get<DashboardResponse>(
    "/api/purchase-sales/dashboard/purchase-sales",
    {
      params: {
        company_code: companyCode,
        year,
        month,
      },
      signal,
    }
  );

  if (!res.data?.success) {
    throw new Error(res.data?.message || "Failed to load dashboard data");
  }

  const d: any = res.data.data;
  const s = d.summary ?? {};

  return {
    summary: {
      totalPRequest: num(s.totalPRequest),
      totalQuotation: num(s.totalQuotation),
      totalPOrder: num(s.totalPOrder),
      totalGrn: num(s.totalGrn),
      pOrderGrnPending: num(s.pOrderGrnPending),
      totalInvoice: num(s.totalInvoice),
      invoicePending: num(s.invoicePending),
      totalSOrder: num(s.totalSOrder),
      totalSdn: num(s.totalSdn),
      sOrderSdnPending: num(s.sOrderSdnPending),
      totalSInvoice: num(s.totalSInvoice),
      sInvoicePending: num(s.sInvoicePending),
    },

    topSuppliers: toSuppliers(d.topSuppliers),
    topCustomers: toCustomers(d.topCustomers),
    monthlyPurchase: toMonthly(d.monthlyPurchase),
    monthlySales: toMonthly(d.monthlySales),
  };
}