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
  disc_hdr_percent: number;
  disc_percent: number;
  disc_price: number;
  tax_pct: number;
  tax_amount: number;
  lcur_amount: number;
  required_dt: string;
  line_remarks: string;
  tax_lcur_amount: number;
  lcur_amount_disc: number;

  zone_code?: string;
  zone_name?: string;
  uom_name?: string;
  uom_code?: string;
  job_no?: string;
  dept?: string;
  sign_ind?: number;
  uppp?: number;
  quantity: number;
  ex_rate: number;

  tx_cat_code: string;
  tx_compntcat_code_1: string;
  tx_compnt_perc_1: number;
  tx_compnt_amt_1: number;
  tx_compnt_1_expmt: string;

  tx_cat_name?: string;
  tx_compntcat_name_1?: string;

  // SO
  so_p_uom?: string;
  so_qty_puom?: number;
  so_l_uom?: string;
  so_qty_luom?: number;
  so_unit_price?: number;
  so_quantity?: number;
  so_prod_code?: string;
  so_prod_name?: string;
  so_div_code?: string;
  so_zone_code?: string;
  so_zone_name?: string;
  so_doc_no?: string;

  // SI
  si_doc_no?: string;

  // SORDER
  sorder_p_uom?: string;
  sorder_qty_puom?: number;
  sorder_l_uom?: string;
  sorder_qty_luom?: number;
  sorder_unit_price?: number;
  sorder_quantity?: number;
  sorder_prod_code?: string;
  sorder_prod_name?: string;
  sorder_div_code?: string;
  sorder_zone_code?: string;
  sorder_zone_name?: string;
  sorder_doc_no?: string;

  sorder_disc_percent?: number;
  sorder_disc_price?: number;

  sorder_tx_cat_code?: string;
  sorder_tx_compntcat_code_1?: string;
  sorder_tx_compnt_perc_1?: number;
  sorder_tx_compnt_amt_1?: number;
  sorder_tx_compnt_1_expmt?: string;
  sorder_tx_cat_name?: string;
  sorder_tx_compntcat_name_1?: string;
  sorder_remarks?:string

  sorder_required_dt?: string;

  serial_no?: number;
}

export interface PurchaseOrderForm {
  doc_no: number | string;
    // doc_no: string;
  doc_type?: string;
  doc_date: string;
  quotn_no: string;
  quotn_date: string;
  ref_no: string;
  ref_date: string;
  div_code: string;
  div_name: string;
  ac_code: string;
  ac_name: string;
  party_address: string;
  credit_period: number;
  party_name: string;
  dept_code: string;
  dept_name: string;
  party_phone: string;
  party_fax: string;
  buyer: string;
  wo_no: string;
  wo_number: string;
  curr_code: string;
  curr_name: string;
  tax_code: string;
  tx_compntcat_code_1: string;
  tax_code_name: string;
  tx_cat_name: string;
  tx_cat_code: string;
  ex_rate: number;
  payment_terms: string;
  dlvr_term: string;
  dlvr_contact: string;
  dlvr_mobile: string;
  dlvr_email: string;
  remarks: string;
  disc_hdr_price: number;
  disc_hdr_percent: number;
  disc_price: number;
  disc_percent: number;
  tax_category: string;
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
  address: string;
  tel: string;
  fax: string;
  pay_terms: string;
  delivery_term: string;
  delivery_contact: string;
  delivery_tel: string;
  delivery_email: string;

  // SDN
  sdn_company_code?: string;
  sdn_doc_no?: number | string;
  sdn_payment_terms?: string;
  sdn_dlvr_term?: string;
  sdn_doc_date?: string;
  sdn_ac_code?: string;
  sdn_div_code?: string;

  // SO
  so_company_code?: string;
  so_doc_no?: number | string;
  so_payment_terms?: string;
  so_dlvr_term?: string;
  so_doc_date?: string;
  so_ac_code?: string;
  so_div_code?: string;
  so_ref_no?: string;
  so_ref_date?: string;
  so_div_name?: string;
  so_ac_name?: string;
  so_party_address?: string;
  so_credit_period?: number;
  so_party_name?: string;
  so_dept_code?: string;
  so_dept_name?: string;
  so_party_phone?: string;
  so_party_fax?: string;
  so_buyer?: string;
  so_wo_no?: string;
  so_wo_number?: string;
  so_curr_code?: string;
  so_curr_name?: string;
  so_tax_code?: string;
  so_tx_compntcat_code_1?: string;
  so_tax_code_name?: string;
  so_tx_cat_name?: string;
  so_tx_cat_code?: string;
  so_ex_rate?: number;
  so_dlvr_contact?: string;
  so_dlvr_mobile?: string;
  so_dlvr_email?: string;
  so_remarks?: string;
  so_disc_hdr_price?: number;
  so_disc_hdr_percent?: number;
  so_disc_price?: number;
  so_disc_percent?: number;
  so_tax_category?: string;
  so_expense_ac_post?: string;
  so_print_on_letterhead?: string;
  so_project_name?: string;
  so_pr_no?: string;
  so_scope_of_work?: string;
  total_so_amount?:number;

  // SI
  si_doc_no?: number | string;
  si_doc_type?: string;
  si_doc_date?: string;
  si_quotn_no?: string;
  si_quotn_date?: string;
  si_ref_no?: string;
  si_ref_date?: string;
  si_div_code?: string;
  si_div_name?: string;
  si_ac_code?: string;
  si_ac_name?: string;
  si_party_address?: string;
  si_credit_period?: number;
  si_party_name?: string;
  si_dept_code?: string;
  si_dept_name?: string;
  si_party_phone?: string;
  si_party_fax?: string;
  si_buyer?: string;
  si_wo_no?: string;
  si_wo_number?: string;
  si_curr_code?: string;
  si_curr_name?: string;
  si_tax_code?: string;
  si_tx_compntcat_code_1?: string;
  si_tax_code_name?: string;
  si_tx_cat_name?: string;
  si_tx_cat_code?: string;
  si_ex_rate?: number;
  si_payment_terms?: string;
  si_dlvr_term?: string;
  si_dlvr_contact?: string;
  si_dlvr_mobile?: string;
  si_dlvr_email?: string;
  si_remarks?: string;
  si_disc_hdr_price?: number;
  si_disc_hdr_percent?: number;
  si_disc_price?: number;
  si_disc_percent?: number;
  si_tax_category?: string;
  si_expense_ac_post?: string;
  si_print_on_letterhead?: string;
  si_project_name?: string;
  si_pr_no?: string;
  si_scope_of_work?: string;
  si_canceled?: string;
  si_flow_level_running?: number;
  si_next_action_by?: string;
  si_sentback_reason?: string;
  si_reject_reason?: string;
  si_address?: string;
  si_tel?: string;
  si_fax?: string;
  si_pay_terms?: string;
  si_delivery_term?: string;
  si_delivery_contact?: string;
  si_delivery_tel?: string;
  si_delivery_email?: string;
  si_grn_no?: number | string;
  si_ref_doc_no?: number | string;
  si_ref_doc_dt?: string;
  si_tx_compntcat_name_1?: string;

  inv_no?: string;
  inv_date?: string;
  tx_compnt_1_expmt?: string;
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