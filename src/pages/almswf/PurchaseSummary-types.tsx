// PurchaseSummary-types.ts
export type TPurchaseSummaryTxn = {
  REQUEST_NUMBER: string;
  REMARKS_HISTRY?: string;
  SUPPLIER_NAME?: string;
  REQUEST_DATE?: string;
  SUPPLIER?: string;
  DESCRIPTION?: string;
  REMARKS?: string;
  AMOUNT?: number;
  DEPARTMENT_CODE?: string;
  FLOW_CODE?: string;
  FLOW_LEVEL_INITIAL?: string;
  FLOW_LEVEL_RUNNING?: string;
  FLOW_LEVEL_FINAL?: string;
  COMPANY_CODE?: string;
  CURRENCY_RATE?: number;
  TX_CAT_CODE?: string;
  TX_COMPNTCAT_CODE_1?: string;
  TX_COMPNT_1_EXPMT?: string;
  USER_DT?: string;
  USER_ID?: string;
  CREATE_USER?: string;
  CREATE_DATE?: string;
  FA_UPLOADED?: string;
  FINAL_APPROVED?: string;
  PURCH_STATUS?: string;
  SORT_ORDER?: number;
  CURRENCY_CODE?: string;
  MYTK_VIEW?: string;
  LAST_ACTION?: string;
  LAST_UPDATED?: string;
  REQ_DIV_CODE?: string;
  CANCEL_FLAG?: string;
  REQUEST_HOD_USER?: string;
};

export interface TPRHeader {
  DOC_NO: string;
  WORK_ORDER_NUMBER: string;
  REQUEST_NUMBER: string;
  REQUEST_DATE: string | null;
  SUPPLIER: string | null;
  DESCRIPTION: string | null;
  REMARKS: string | null;
  AMOUNT: number | null;
  TX_CAT_CODE: string | null;
  TX_COMPNTCAT_CODE_1: string | null;
  FLOW_CODE: string | null;
  FLOW_LEVEL_INITIAL: number | null;
  FLOW_LEVEL_RUNNING: number | null;
  FLOW_LEVEL_FINAL: number | null;

  COMPANY_CODE: string;
  CURRENCY_RATE: number | null;

  USER_DT: string | null;
  USER_ID: string | null;

  FINAL_APPROVED: string | null;
  CURR_CODE: string | null;

  CREATE_USER: string | null;
  CREATE_DATE: string | null;
  LAST_UPDATED: string | null;
  LAST_ACTION: string | null;

  PO_AMOUNT: number | null;
  DOC_DATE: string | null;

  CANCEL_FLAG: string | null;
  CANCEL_DATE: string | null;
  CANCEL_USER: string | null;

  FA_USER: string | null;
  HOD_USER: string | null;

  PDO_TYPE: string | null;
}

export type TPRItem = {
  // === IDENTIFIERS ===
  ID?: string;
  REQUEST_NUMBER: string;
  ITEM_SRNO: number;
  COMPANY_CODE: string;

  // === ITEM INFO ===
  ITEM_CODE: string;
  ITEM_DESP: string;

  // === COST ===
  COST_CODE: string;
  COST_NAME: string;

  // === SUPPLIER ===
  SUPPLIER: string;

  // === QUANTITY & PRICING ===
  REQUEST_QUANTITY: number;
  ALLOCATED_APPROVED_QUANTITY: number;
  ITEM_QTY: number;
  ITEM_RATE: number;
  DISCOUNT_AMOUNT: number;
  FINAL_RATE: number;
  AMOUNT: number;
  LCURR_AMT: number;

  // === DERIVED AMOUNTS ===
  BASE_AMOUNT: number;

  // === CURRENCY ===
  CURR_CODE: string;
  CURRENCY_RATE: number;

  // === TAX ===
  TX_CAT_CODE: string;
  TX_COMPNTCAT_CODE_1: string;
  TX_COMPNT_PERC_1: number;
  TX_COMPNT_AMT_1: number;
  TX_COMPNT_LCURAMT_1: number;

  // === TAX TYPE ===
  TAX_TYPE: string;

  // === TAX (optional display fields) ===
  TAX_CAT_NAME?: string;
  TAX_CODE_NAME?: string;
  TX_COMPNTCAT_CODE?: string;
  TX_COMPNTCAT_NAME?: string;

  // === META ===
  USER_DT: string | null;
  USER_ID: string;
  REMARKS?: string;
};

export type TPRterm = {
  SUPPLIER_CODE: '';
  SUPPLIER_NAME: '';
  TERM_CODE: '';
  TERM_DESC: '';
  TERM_VALUE: '';
  IS_MANDATORY: 'N';
  REMARKS: '';
};