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

