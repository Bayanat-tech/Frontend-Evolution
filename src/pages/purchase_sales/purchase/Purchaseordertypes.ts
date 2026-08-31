import { PurchaseOrderRow } from "./Purchaseorderpage";

export type PurchaseOrderEditorState =
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: PurchaseOrderRow }
  | null;

export type ActionKey = "draft" | "submit" | "sendBack" | "reject" | "cancel" | "close";

export interface PurchaseOrderLineRow {
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
  sign_ind?: number
  uppp?: number,
  quantity: number,
  ex_rate: number,
  tx_cat_code: string,
  tx_compntcat_code_1: string,
  tx_compnt_perc_1: number,
  tx_compnt_amt_1: number,
  tx_compnt_1_expmt: string,
  tx_cat_name?: string
  tx_compntcat_name_1?: string

  po_p_uom?: string;
  po_qty_puom?: number;
  po_l_uom?: string;
  po_qty_luom?: number;
  po_unit_price?: number;
  po_quantity?: number,
  po_prod_code?: string;
  po_prod_name?: string;
  po_div_code?: string;
  po_zone_code?: string;
  po_zone_name?: string;
  po_doc_no?: string,
  pi_doc_no?: string

  porder_p_uom?: string;
  porder_qty_puom?: number;
  porder_l_uom?: string;
  porder_qty_luom?: number;
  porder_unit_price?: number;
  porder_quantity?: number,
  porder_prod_code?: string;
  porder_prod_name?: string;
  porder_div_code?: string;
  porder_zone_code?: string;
  porder_zone_name?: string;
  porder_doc_no?: string,
   porder_disc_percent?: number;
   porder_disc_price?: number;
     porder_tx_cat_code?: string,
   porder_tx_compntcat_code_1?: string,
   porder_tx_compnt_perc_1?: number,
   porder_tx_compnt_amt_1?: number,
   porder_tx_compnt_1_expmt?: string,
   porder_tx_cat_name?: string
   porder_tx_compntcat_name_1?: string,
   porder_required_dt?: string;
   serial_no?: number;
   porder_remarks?: string




}

export interface PurchaseOrderForm {
  doc_no: string;
  doc_type?: string
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
  grn_no?: number | string;
  ref_doc_no?: number | string;
  ref_doc_dt?: string;
  tx_compntcat_name_1?: string;
  po_company_code?: string;
  po_doc_no?: number | string;
  po_payment_terms?: string;
  po_dlvr_term?: string;
  po_doc_date?: string;
  total_po_amount?: number
  po_ac_code?: string;
  po_div_code?: string;
  grn_company_code?: string;
  grn_doc_no?: number | string;
  grn_payment_terms?: string;
  grn_dlvr_term?: string;
  grn_doc_date?: string;
  grn_ac_code?: string;
  grn_div_code?: string;
  po_ref_no?: string;
  po_ref_date?: string;
  po_div_name?: string;
  po_ac_name?: string;
  po_party_address?: string;
  po_credit_period?: number;
  po_party_name?: string;
  po_dept_code?: string;
  po_dept_name?: string;
  po_party_phone?: string;
  po_party_fax?: string;
  po_buyer?: string;
  po_wo_no?: string;
  po_wo_number?: string;
  po_curr_code?: string;
  po_curr_name?: string;
  po_tax_code?: string;
  po_tx_compntcat_code_1?: string;
  po_tax_code_name?: string;
  po_tx_cat_name?: string;
  po_tx_cat_code?: string;
  po_ex_rate?: number;
  po_dlvr_contact?: string;
  po_dlvr_mobile?: string;
  po_dlvr_email?: string;
  po_remarks?: string;
  po_disc_hdr_price?: number;
  po_disc_hdr_percent?: number;
  po_disc_price?: number;
  po_disc_percent?: number;
  po_tax_category?: string;
  po_expense_ac_post?: string;
  po_print_on_letterhead?: string;
  po_project_name?: string;
  po_pr_no?: string;
  po_scope_of_work?: string;
  pi_doc_no?: number | string;
  pi_doc_type?: string;
  pi_doc_date?: string;
  pi_quotn_no?: string;
  pi_quotn_date?: string;
  pi_ref_no?: string;
  pi_ref_date?: string;
  pi_div_code?: string;
  pi_div_name?: string;
  pi_ac_code?: string;
  pi_ac_name?: string;
  pi_party_address?: string;
  pi_credit_period?: number;
  pi_party_name?: string;
  pi_dept_code?: string;
  pi_dept_name?: string;
  pi_party_phone?: string;
  pi_party_fax?: string;
  pi_buyer?: string;
  pi_wo_no?: string;
  pi_wo_number?: string;
  pi_curr_code?: string;
  pi_curr_name?: string;
  pi_tax_code?: string;
  pi_tx_compntcat_code_1?: string;
  pi_tax_code_name?: string;
  pi_tx_cat_name?: string;
  pi_tx_cat_code?: string;
  pi_ex_rate?: number;
  pi_payment_terms?: string;
  pi_dlvr_term?: string;
  pi_dlvr_contact?: string;
  pi_dlvr_mobile?: string;
  pi_dlvr_email?: string;
  pi_remarks?: string;
  pi_disc_hdr_price?: number;
  pi_disc_hdr_percent?: number;
  pi_disc_price?: number;
  pi_disc_percent?: number;
  pi_tax_category?: string;
  pi_expense_ac_post?: string;
  pi_print_on_letterhead?: string;
  pi_project_name?: string;
  pi_pr_no?: string;
  pi_scope_of_work?: string;
  pi_canceled?: string;
  pi_flow_level_running?: number;
  pi_next_action_by?: string;
  pi_sentback_reason?: string;
  pi_reject_reason?: string;
  pi_address?: string;
  pi_tel?: string;
  pi_fax?: string;
  pi_pay_terms?: string;
  pi_delivery_term?: string;
  pi_delivery_contact?: string;
  pi_delivery_tel?: string;
  pi_delivery_email?: string;
  pi_grn_no?: number | string;
  pi_ref_doc_no?: number | string;
  pi_ref_doc_dt?: string;
  pi_tx_compntcat_name_1?: string;
  inv_no?: string;
  inv_date?: string;
  tx_compnt_1_expmt?: string

}

export interface TteJmiConsumType {
  id: string;
  company_code: string;
  doc_type: string;
  doc_no: number;
  uppp: number;
  mi_doc_no: number;

  prod_code: string;
  prod_name: string;

  quantity: number;
  qty: number;
  disc_percent: number;
  disc_price: number;
  p_uom: string;
  l_uom: string;
  tax_code: string;
  ex_rate: number;

  qty_puom: number;
  qty_luom: number;

  serial_no: number;

  qty_consumd: number;
  qty_scrapped: number;

  cost_rate: number;
  cost_amount: number;

  scrap_amount: number;

  div_code: string;

  unit_price: number;
  tax_pct: number;
  tax_amount: number;
  lcur_amount: number;
  required_dt: string;
  line_remarks: string;
  tax_cat: string;
  tax_lcur_amount: number;
  lcur_amount_disc: number;

  zone_code?: string;
  zone_name?: string;
  uom_name?: string;
  uom_code?: string;
}

export interface ExpenseRow {
  id: string;
  company_code: string | null;
  doc_type: string | null;
  doc_no: string | null;
  doc_date: Date | null;
  div_code: string | null;
  dept_code: string | null;
  serial_no: number;
  exp_code: string | null;
  remarks: string | null;
  amount: number;
  curr_code: string | null;
  ex_rate: number;
  lcur_amount: number;
  ref_doc_type: string | null;
  ref_doc_no: number;
  ref_doc_serial: number;
  edit_user: string | null;
  edit_date: Date | null;
  user_id: string | null;
  user_dt: Date | null;
  zone_code: string | null;
  ac_code: string | null;
  wrk_type: string | null;
  employee_id: string | null;
  hourly_rate: number;
}
export interface SendBackUserOption {
  code: string;
  name: string;
  level_no: number;
}

export const PO_DOC_TYPE = {
  LPO: "LPO",
  PQA: "PQA",
  GRN: "GRN",
  JO: "JO",
  FGP: "FGP",
  PIN: "PIN",

} as const;
export const PROCESS = "purchase_order";
export const PROCESSQUOTATION = 'purchase_quotation'
export const PROCESSGRN = 'purchase_grn'
export const PROCESSJO = 'production_joborder'
export const PROCESSJP = 'job_production'
export const EXPENSE_AC_OPTIONS = [
  { label: "Inventory A/c", value: "I" },
  { label: "Direct Expense A/c", value: "D" },
];
export type PODocType = typeof PO_DOC_TYPE[keyof typeof PO_DOC_TYPE];

export interface JobProductionConfig {
  docType: PODocType;
  headerParameter: string;
  detailParameter: string;
  jmiConsumDetails: string;
  expenseDetails: string
}

export interface PurchaseConfig {
  docType: PODocType;
  headerParameter: string;
  detailParameter: string;
}

export const LPO_CONFIG: PurchaseConfig = {
  docType: PO_DOC_TYPE.LPO,
  headerParameter: "PS_POORDER_ENTRY_HEADER_PAGE",
  detailParameter: "PS_POORDER_ENTRY_DETAIL_PAGE",
};

export const PQA_CONFIG: PurchaseConfig = {
  docType: PO_DOC_TYPE.PQA,
  headerParameter: "PS_QUOTATION_ENTRY_HEADER_PAGE",
  detailParameter: "PS_QUOTATION_ENTRY_DETAIL_PAGE",
};

export const GRN_CONFIG: PurchaseConfig = {
  docType: PO_DOC_TYPE.GRN,
  headerParameter: "PS_GRN_ENTRY_HEADER_PAGE",
  detailParameter: "PS_GRN_ENTRY_DETAIL_PAGE",
};

export const JO_CONFIG: PurchaseConfig = {
  docType: PO_DOC_TYPE.JO,
  headerParameter: "PS_JORDER_ENTRY_HEADER_PAGE",
  detailParameter: "PS_JORDER_ENTRY_DETAIL_PAGE",
};

export const JP_CONFIG: JobProductionConfig = {
  docType: PO_DOC_TYPE.FGP,
  headerParameter: "PS_GRN_ENTRY_HEADER_PAGE",
  detailParameter: "PS_GRN_ENTRY_DETAIL_PAGE",
  expenseDetails: "PS_GRN_ENTRY_VW_TTE_PGRN_EXP_DET",
  jmiConsumDetails: "PS_GRN_ENTRY_VW_TTE_JMI_CONSUM"
};

export const PIN_CONFIG: PurchaseConfig = {
  docType: PO_DOC_TYPE.PIN,
  headerParameter: "PS_INVOICE_ENTRY_HEADER_PAGE",
  detailParameter: "PS_INVOICE_ENTRY_DETAIL_PAGE",
};