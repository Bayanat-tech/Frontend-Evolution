import { InventoryOrderRow } from "./StockTransferPage";

export type PurchaseOrderEditorState =
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: InventoryOrderRow }
  | null;

export type ActionKey = "draft" | "submit" | "sendBack" | "reject" | "cancel" | "close";

export interface InventoryLineRow {
  id: string;
  div_code: string;
  zone: string;
  prod_code: string;
  prod_name: string;
  p_uom: string;
  qty_puom: number;
  l_uom: string;
  qty_luom: number;
  unit_price: number;
  disc_precent: number;
  qty: number;
  tax_pct: number;
  tax_amount: number;
  lcurr_amount: number;
  req_date: string;
  line_remarks: string;
  tax_cat: string;
  tax_code: string;
  tax_lcurr_amount: number;
  lcurr_amount_disc: number;
  zone_code?: string;
  zone_name?: string;
  uom_name?: string;
  uom_code?: string;
  // STR (Stock Transfer) only
  remarks?: string;
  dept_code?: string;
  job_no?: string;
 
  // SAJ (Stock Adjustment) only
  sign_ind?: number; // '+' Increase / '-' Decrease
  sale_price?:number;
  quantity?:number;
  uppp?:number;
  ex_rate?: number;
  disc_price?: number;
  
  
}

export interface PurchaseOrderForm {
  doc_no: string;
  doc_date: string;
  quotn_no: string;
  quotn_date: string;
  div_code: string;
  div_name: string;
  ac_code: string;
  ac_name: string;
  address: string;
  credit_period: number;
  dept_code: string;
  tel: string;
  fax: string;
  buyer: string;
  wo_no: string;
  curr_code: string;
  curr_name: string;
  ex_rate: number;
  pay_terms: string;
  delivery_term: string;
  delivery_contact: string;
  delivery_tel: string;
  delivery_email: string;
  remarks: string;
  disc_price: number;
  disc_precent: number;
  tax_category: string;
  tax_code: string;
  expense_ac_post: string;
  print_on_letterhead: string;
  project_name: string;
  pr_no: string;
  scope_of_work: string;
  canceled?: string;
  flow_level_running?: number;
  next_action_by?: string;
  sentback_reason?: string;
  reject_reason?: string;
  from_zone_code?:string,
  to_zone_code?:string,
  issued_by ?: string,
  received_by?: string,
  zone_name?: string,
  dept_name?: string,
  zone_code? : string
  job_no?: string;

}

export interface SendBackUserOption {
  code: string;
  name: string;
  level_no: number;
}

export const IV_DOC_TYPE = {
  STR: "STR",
  SAJ :"SAJ"
} as const;
export const PROCESSST ='stock_transfer'
export const PROCESSSA ='stock_adjustment'
export const EXPENSE_AC_OPTIONS = ["Inventory A/c", "Expense A/c", "Fixed Asset A/c"];
export type InventoryDocType = typeof IV_DOC_TYPE[keyof typeof IV_DOC_TYPE];

export interface InventoryConfig {
  docType: InventoryDocType;
  headerParameter: string;
  detailParameter: string;
}


export const STR_CONFIG: InventoryConfig = {
  docType: IV_DOC_TYPE.STR,
  headerParameter: "PS_TRANSFER_ENTRY_HEADER_PAGE",
  detailParameter: "PS_TRANSFER_ENTRY_DETAIL_PAGE",
};

export const SAJ_CONFIG: InventoryConfig = {
  docType: IV_DOC_TYPE.SAJ,
  headerParameter: "PS_ADJUSTMENT_ENTRY_HEADER_PAGE",
  detailParameter: "PS_ADJUSTMENT_ENTRY_DETAIL_PAGE",
};