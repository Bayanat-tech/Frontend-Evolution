import { SalesOrderRow } from "./SalesorderPage";

export type PurchaseOrderEditorState =
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: SalesOrderRow }
  | null;

export type ActionKey = "draft" | "submit" | "sendBack" | "reject" | "cancel" | "close";

export interface SalesOrderLineRow {
  id: string;
  div_code: string;
  prod_code: string;
  prod_name: string;
  p_uom: string;
  qty_puom: number;
  l_uom: string;
  qty_luom: number;
  unit_price: number;
  disc_percent: number;
  quantity: number;
  tax_pct: number;
  tax_amount: number;
  lcur_amount: number;
  required_dt: string;
  line_remarks: string;
  tax_cat: string;
  tax_code: string;
  tax_lcur_amount: number;
  lcur_amount_disc: number;
  zone_code?: string;
  zone_name?: string;
  uom_name?: string;
  uom_code?: string;
  disc_hdr_percent?: number;
  disc_hdr_price?: number;
  disc_price?: number;
  uppp?: number;
  ex_rate?: number;
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
  disc_amt: number;
  disc_pct: number;
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
}

export interface SendBackUserOption {
  code: string;
  name: string;
  level_no: number;
}

export const SO_DOC_TYPE = {
  SO: "SO",
  SDN: "SDN",
  STR: "STR",
  SAJ :"SAJ",
  SIN: "SIN",
} as const;
export const PROCESSSO ='sales_order'
export const PROCESSSDN ='sales_dn'
export const EXPENSE_AC_OPTIONS = ["Inventory A/c", "Expense A/c", "Fixed Asset A/c"];
export type SODocType = typeof SO_DOC_TYPE[keyof typeof SO_DOC_TYPE];

export interface SalesConfig {
  docType: SODocType;
  headerParameter: string;
  detailParameter: string;
}

export const SO_CONFIG: SalesConfig = {
  docType: SO_DOC_TYPE.SO,
  headerParameter: "PS_SORDER_ENTRY_HEADER_PAGE",
  detailParameter: "PS_SORDER_ENTRY_DETAIL_PAGE",
};

export const SDN_CONFIG: SalesConfig = {
  docType: SO_DOC_TYPE.SDN,
  headerParameter: "PS_SDN_ENTRY_HEADER_PAGE",
  detailParameter: "PS_SDN_ENTRY_DETAIL_PAGE",
};

export const STR_CONFIG: SalesConfig = {
  docType: SO_DOC_TYPE.STR,
  headerParameter: "PS_GRN_ENTRY_HEADER_PAGE",
  detailParameter: "PS_GRN_ENTRY_DETAIL_PAGE",
};

export const SAJ_CONFIG: SalesConfig = {
  docType: SO_DOC_TYPE.SAJ,
  headerParameter: "PS_JORDER_ENTRY_HEADER_PAGE",
  detailParameter: "PS_JORDER_ENTRY_DETAIL_PAGE",
};

export const SIN_CONFIG: SalesConfig = {
  docType: SO_DOC_TYPE.SIN,
  headerParameter: "PS_SALE_PURCHASE_ENTRY_SINV_HEADER_PAGE",
  detailParameter: "PS_SALE_PURCHASE_ENTRY_SINV_DETAIL_PAGE",
};