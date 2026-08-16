import { InventoryDocType, IV_DOC_TYPE } from "../pages/purchase_sales/inventory/Inventorytypes";
import { PO_DOC_TYPE, PODocType } from "../pages/purchase_sales/purchase/Purchaseordertypes";
import { SO_DOC_TYPE, SODocType } from "../pages/purchase_sales/sales/SalesOrdertypes";
import { api } from "./client";
import type { LookupRow } from "./lookups";

export type TInvoice = Record<string, unknown>;
export type TInvoiceDetail = Record<string, unknown>;
export type IPrincipal = { prin_code: string; prin_name: string };

type ApiResponse<T> = {
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
