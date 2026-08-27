import { getDynamicLookup } from "../../../api/lookups";
import { upsertBulkPurchaseEntryApi, upsertBulkSaleseEntryApi } from "../../../api/purchaseSales";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";
import {
  EXPENSE_AC_OPTIONS,
  PurchaseConfig,
  PurchaseOrderEditorState,

  TteJmiConsumType,
} from "../purchase/Purchaseordertypes";
import { PurchaseOrderForm, SalesConfig, SalesOrderLineRow, SODocType } from "./SalesOrdertypes";

export const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function lowerRecord(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw || {}).map(([key, value]) => [key.toLowerCase(), value]));
}

export function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAmount(value: number) {
  const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return value < 0 ? `(${amount})` : amount;
}

export const emptyLineRow = (divCode: string): any => ({
  id: newId(),
  div_code: divCode,
  zone_code: "",
  prod_code: "",
  prod_name: "",
  p_uom: "",
  qty_puom: 0,
  l_uom: "",
  qty_luom: 0,
  unit_price: 0,
  disc_percent: 0,
  disc_price: 0,
  tax_pct: 0,
  tax_amount: 0,
  lcur_amount: 0,
  required_dt: "",
  line_remarks: "",
  tax_cat: "",
  tax_code: "",
  tax_lcur_amount: 0,
  lcur_amount_disc: 0,
  uppp: 0,
  quantity: 0,
  ex_rate: 1,
});

export function emptyForm(editor: PurchaseOrderEditorState): PurchaseOrderForm {
  // Ensure EXPENSE_AC_OPTIONS is defined; fallback to empty string
  const defaultExpenseAc = EXPENSE_AC_OPTIONS?.[0]?.value ?? "";
  return {
    doc_no: editor?.mode === "edit" ? (editor.row.doc_no ?? 0) : 0,
    doc_date: editor?.mode === "edit" ? editor.row.doc_date || "" : new Date().toISOString().slice(0, 10),
    quotn_no: editor?.mode === "edit" ? editor.row.quotn_no || "" : "",
    quotn_date: editor?.mode === "edit" ? editor.row.quotn_date || "" : "",
    ref_no: editor?.mode === "edit" ? editor.row.ref_no || "" : "",
    ref_date: editor?.mode === "edit" ? editor.row.ref_date || "" : "",
    div_code: editor?.mode === "create" ? editor.divCode || "" : editor?.mode === "edit" ? editor.row.div_code : "",
    div_name: editor?.mode === "create" ? editor.divName || "" : editor?.mode === "edit" ? editor.row.div_name || "" : "",
    ac_code: editor?.mode === "edit" ? editor.row.ac_code || "" : "",
    dept_name: editor?.mode === "edit" ? editor.row.dept_name || "" : "",
    ac_name: editor?.mode === "edit" ? editor.row.ac_name || "" : "",
    party_name: editor?.mode === "edit" ? editor.row.ac_name || "" : "",
    address: editor?.mode === "edit" ? editor.row.address || "" : "",
    party_address: editor?.mode === "edit" ? editor.row.party_address || "" : "",
    credit_period: editor?.mode === "edit" ? Number(editor.row.credit_period || 0) : 0,
    dept_code: editor?.mode === "edit" ? editor.row.dept_code || "" : "",
    tel: editor?.mode === "edit" ? editor.row.tel || "" : "",
    party_phone: editor?.mode === "edit" ? editor.row.party_phone || "" : "",
    fax: editor?.mode === "edit" ? editor.row.fax || "" : "",
    party_fax: editor?.mode === "edit" ? editor.row.party_fax || "" : "",
    buyer: editor?.mode === "edit" ? editor.row.buyer || "" : "",
    wo_no: editor?.mode === "edit" ? editor.row.wo_no || "NC" : "NC",
    wo_number: editor?.mode === "edit" ? editor.row.wo_number || "NC" : "NC",
    curr_code: editor?.mode === "edit" ? editor.row.curr_code || "" : "",
    curr_name: editor?.mode === "edit" ? editor.row.curr_name || "" : "",
    ex_rate: editor?.mode === "edit" ? Number(editor.row.ex_rate || 1) : 1,
    pay_terms: editor?.mode === "edit" ? editor.row.pay_terms || "" : "",
    payment_terms: editor?.mode === "edit" ? editor.row.payment_terms || "" : "",
    delivery_term: editor?.mode === "edit" ? editor.row.delivery_term || "" : "",
    dlvr_term: editor?.mode === "edit" ? editor.row.dlvr_term || "" : "",
    delivery_contact: editor?.mode === "edit" ? editor.row.delivery_contact || "" : "",
    dlvr_contact: editor?.mode === "edit" ? editor.row.dlvr_contact || "" : "",
    delivery_tel: editor?.mode === "edit" ? editor.row.delivery_tel || "" : "",
    dlvr_mobile: editor?.mode === "edit" ? editor.row.dlvr_mobile || "" : "",
    delivery_email: editor?.mode === "edit" ? editor.row.delivery_email || "" : "",
    dlvr_email: editor?.mode === "edit" ? editor.row.dlvr_email || "" : "",
    remarks: editor?.mode === "edit" ? editor.row.remarks || "" : "",
    disc_price: editor?.mode === "edit" ? Number(editor.row.disc_price || 0) : 0,
    disc_hdr_price: editor?.mode === "edit" ? Number(editor.row.disc_hdr_price || 0) : 0,
    disc_percent: editor?.mode === "edit" ? Number(editor.row.disc_percent || 0) : 0,
    disc_hdr_percent: editor?.mode === "edit" ? Number(editor.row.disc_hdr_percent || 0) : 0,
    tax_category: editor?.mode === "edit" ? editor.row.tax_category || "" : "",
    tx_cat_code: editor?.mode === "edit" ? editor.row.tx_cat_code || "" : "",
    tx_cat_name: editor?.mode === "edit" ? editor.row.tx_cat_name || "" : "",
    tax_code: editor?.mode === "edit" ? editor.row.tax_code || "" : "",
    tax_code_name: editor?.mode === "edit" ? editor.row.tax_code_name || "" : "",
    tx_compntcat_code_1: editor?.mode === "edit" ? editor.row.tx_compntcat_code_1 || "" : "",
    expense_ac_post:
      editor?.mode === "edit"
        ? typeof editor.row.expense_ac_post === "string"
          ? editor.row.expense_ac_post
          : (editor.row.expense_ac_post as unknown as { value?: string })?.value || defaultExpenseAc
        : defaultExpenseAc,
    print_on_letterhead: editor?.mode === "edit" ? editor.row.print_on_letterhead || "N" : "N",
    project_name: editor?.mode === "edit" ? editor.row.project_name || "" : "",
    pr_no: editor?.mode === "edit" ? editor.row.pr_no || "" : "",
    scope_of_work: editor?.mode === "edit" ? editor.row.scope_of_work || "" : "",
    canceled: editor?.mode === "edit" ? editor.row.canceled || "N" : "N",
    flow_level_running:
      editor?.mode === "edit" ? Number(editor.row.flow_level_running ?? editor.row.flow_level ?? 0) : 0,
    next_action_by: "",
    sentback_reason: "",
    reject_reason: "",
  };
}

export async function fetchSalesOrderHeader(
  docNo: string,
  config: SalesConfig,
  companyCode?: string,
  loginid?: string,
): Promise<Record<string, unknown>> {
  const response: any = await getDynamicLookup({
    parameter: config.headerParameter,
    code1: companyCode,
    code2: config.docType,
    code3: docNo,
    loginid: loginid || "ADMIN",
  });

  const rows: any[] = Array.isArray(response) ? response : (response?.data ?? []);
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? lowerRecord(row) : {};
}

export async function fetchSalesOrderDetail(
  docNo: string,
  config: SalesConfig,
  companyCode?: string,
  loginid?: string,
): Promise<SalesOrderLineRow[]> {
  const response: any = await getDynamicLookup({
    parameter: config.detailParameter,
    code1: companyCode,
    code2: config.docType,
    code3: docNo,
    loginid: loginid || "ADMIN",
  });

  const rows: any[] = Array.isArray(response) ? response : (response?.data ?? []);

  return rows.map((raw) => {
    const row = lowerRecord(raw as Record<string, unknown>);
    return {
      id: newId(),
      div_code: text(row.so_div_code ?? row.div_code),
      zone_code: text(row.so_zone_code ?? row.zone_code),
      prod_code: text(row.prod_code),
      prod_name: text(row.prod_name),
      p_uom: text(row.so_p_uom ?? row.p_uom),
      qty_puom: numberOrZero(row.qty_puom),
      l_uom: text(row.so_l_uom ?? row.l_uom),
      qty_luom: numberOrZero(row.qty_luom),
      unit_price: numberOrZero( row.unit_price),
      disc_hdr_percent: numberOrZero(row.disc_hdr_percent),
      disc_percent: numberOrZero(row.disc_percent),
      disc_price: numberOrZero(row.disc_price),
      tax_pct: numberOrZero(row.tax_pct ?? row.tax_percent),
      tax_amount: numberOrZero(row.tax_amount),
      lcur_amount: numberOrZero(row.lcur_amount),
      required_dt: toDateInputValue(raw.required_dt) || "",
      line_remarks: text(row.remarks ?? row.line_remarks),
      tax_lcur_amount: numberOrZero(row.tax_lcur_amount),
      lcur_amount_disc: numberOrZero(row.lcur_amount_disc ?? row.lcur_amount_discount),
      uppp: numberOrZero(row.uppp),
      quantity: numberOrZero(row.quantity),
      ex_rate: numberOrZero(row.ex_rate),
      tx_cat_code: text(row.tx_cat_code),
      tx_compntcat_code_1: text(row.tx_compntcat_code_1),
      tx_compnt_perc_1: numberOrZero(row.tx_compnt_perc_1),
      tx_compnt_amt_1: numberOrZero(row.tx_compnt_amt_1),
      tx_compnt_1_expmt: text(row.tx_compnt_1_expmt),
      so_prod_code: text(row.so_prod_code ?? row.prod_code),
      so_prod_name: text(row.so_prod_name ?? row.prod_name),
      so_p_uom: text(row.so_p_uom ?? row.p_uom),
      so_qty_puom: numberOrZero(row.so_qty_puom ?? row.qty_puom),
      so_l_uom: text(row.so_l_uom ?? row.l_uom),
      so_qty_luom: numberOrZero(row.so_qty_luom ?? row.qty_luom),
      so_quantity: numberOrZero(row.so_quantity ?? row.quantity),
      so_unit_price: numberOrZero(row.so_unit_price ?? row.unit_price),
      so_div_code: text(row.so_div_code ?? row.div_code),
      so_zone_code: text(row.so_zone_code),
      so_zone_name: text(row.so_zone_name),
      sorder_prod_code: text(row.sorder_prod_code),
      sorder_prod_name: text(row.sorder_prod_name),
      sorder_div_code: text(row.sorder_div_code),
      sorder_p_uom: text(row.sorder_p_uom),
      sorder_qty_puom: numberOrZero(row.sorder_qty_puom),
      sorder_l_uom: text(row.sorder_l_uom),
      sorder_qty_luom: numberOrZero(row.sorder_qty_luom),
      sorder_quantity: numberOrZero(row.sorder_quantity),
      sorder_unit_price: numberOrZero(row.sorder_unit_price),
      sorder_disc_percent: numberOrZero(row.sorder_disc_percent),
      sorder_disc_price: numberOrZero(row.sorder_disc_price),
      sorder_zone_code: text(row.sorder_zone_code),
      sorder_zone_name: text(row.sorder_zone_name),
      sorder_required_dt: toDateInputValue(row.sorder_required_dt) || "",
      sorder_tx_cat_code: text(row.sorder_tx_cat_code),
      sorder_tx_cat_name: text(row.sorder_tx_cat_name),
      sorder_tx_compntcat_code_1: text(row.sorder_tx_compntcat_code_1),
      sorder_tx_compntcat_name_1: text(row.sorder_tx_compntcat_name_1),
      sorder_tx_compnt_perc_1: numberOrZero(row.sorder_tx_compnt_perc_1),
      sorder_tx_compnt_amt_1: numberOrZero(row.sorder_tx_compnt_amt_1),
      sorder_tx_compnt_1_expmt: text(row.sorder_tx_compnt_1_expmt),
      serial_no: numberOrZero(row.serial_no),
      sorder_remarks: text(row.sorder_remarks),
    } satisfies SalesOrderLineRow;
  });
}

export function buildHeaderPayload(form: PurchaseOrderForm, companyCode?: string, loginid?: string, docType?: SODocType) {
  const refDocNo =
    docType === "SDN"
      ? form.so_doc_no
      : docType === "SIN"
        ? text(form.sdn_doc_no)
        : undefined;
  return {
    doc_no: form.doc_no || undefined,
    doc_type: docType,
    doc_date: form.doc_date,
    ref_no: form.ref_no,
    ref_date: form.ref_date,
    inv_no: form.inv_no,
    inv_date: form.inv_date,

    div_code: form.div_code,
    div_name: form.div_name,
    ac_code: form.ac_code,
    ac_name: form.ac_name,
    party_name: form.ac_name,
    party_address: form.party_address,
    credit_period: form.credit_period,
    dept_code: form.dept_code,
    party_phone: form.party_phone,
    party_fax: form.party_fax,
    buyer: form.buyer,
    wo_number: form.wo_number,

    curr_code: form.curr_code,
    curr_name: form.curr_name,
    ex_rate: form.ex_rate,

    payment_terms: form.payment_terms,
    dlvr_term: form.dlvr_term,
    dlvr_contact: form.dlvr_contact,
    dlvr_mobile: form.dlvr_mobile,
    dlvr_email: form.dlvr_email,

    remarks: form.remarks,

    disc_hdr_price: form.disc_hdr_price,
    disc_hdr_percent: form.disc_hdr_percent,

    tx_cat_code: form.tx_cat_code,
    tx_compntcat_code_1: form.tx_compntcat_code_1,

    purchase_actype: form.expense_ac_post,

    project_name: form.project_name,
    pr_no: form.pr_no,
    scope_of_work: form.scope_of_work,

    cancelled: form.canceled || "N",

    company_code: companyCode,
    user_id: loginid,

    next_action_by: form.next_action_by || undefined,
    sentback_reason: form.sentback_reason || undefined,
    reject_reason: form.reject_reason || undefined,
    flow_level_running: form.flow_level_running || 0,

    ref_doc_no: refDocNo,

    // SDN
    sdn_doc_no: numberOrZero(form.doc_no) || undefined,

    // SO
    si_div_code: form.so_div_code,
    si_div_name: form.so_div_name,
    si_ac_code: form.so_ac_code,
    si_ac_name: form.so_ac_name,
    si_party_address: form.so_party_address,
    si_credit_period: form.so_credit_period,
    si_party_name: form.so_party_name,
    si_dept_code: form.so_dept_code,
    si_dept_name: form.so_dept_name,
    si_party_phone: form.so_party_phone,
    si_party_fax: form.so_party_fax,
    si_buyer: form.so_buyer,
    si_wo_no: form.so_wo_no,
    si_wo_number: form.so_wo_number,
    si_curr_code: form.so_curr_code,
    si_curr_name: form.so_curr_name,
    si_tax_code: form.so_tax_code,
    si_tx_compntcat_code_1: form.so_tx_compntcat_code_1,
    si_tax_code_name: form.so_tax_code_name,
    si_tx_cat_name: form.so_tx_cat_name,
    si_tx_cat_code: form.so_tx_cat_code,
    si_ex_rate: form.so_ex_rate,
    si_payment_terms: form.so_payment_terms,
    si_dlvr_term: form.so_dlvr_term,
    si_dlvr_contact: form.so_dlvr_contact,
    si_dlvr_mobile: form.so_dlvr_mobile,
    si_dlvr_email: form.so_dlvr_email,
    si_remarks: form.so_remarks,
    si_disc_hdr_price: form.so_disc_hdr_price,
    si_disc_hdr_percent: form.so_disc_hdr_percent,
    si_disc_price: form.so_disc_price,
    si_disc_percent: form.so_disc_percent,
    si_tax_category: form.so_tax_category,
    si_expense_ac_post: form.so_expense_ac_post,
    si_print_on_letterhead: form.so_print_on_letterhead,
    si_project_name: form.so_project_name,
    si_pr_no: form.so_pr_no,
    si_scope_of_work: form.so_scope_of_work,

    // SDN reference
    si_ref_doc_no: form.sdn_doc_no,
  };
}

// ---- Utility functions for calculations ----

export function isSameUom(row: SalesOrderLineRow): boolean {
  return sameUom(row.p_uom, row.l_uom);
}

export function isSamePoUom(row: SalesOrderLineRow): boolean {
  return sameUom(row.so_p_uom, row.so_l_uom);
}

function sameUom(primaryUom?: string | null, looseUom?: string | null): boolean {
  const primary = text(primaryUom).trim().toUpperCase();
  const loose = text(looseUom).trim().toUpperCase();
  return !!primary && primary === loose;
}

export function computeQuantity(row: SalesOrderLineRow): number {
  const qtyPuom = numberOrZero(row.qty_puom);
  const qtyLuom = numberOrZero(row.qty_luom);
  const uppp = numberOrZero(row.uppp);
  return isSameUom(row) ? qtyLuom : qtyPuom * uppp + qtyLuom;
}

export function computePoQuantity(row: SalesOrderLineRow): number {
  const qtyPuom = numberOrZero(row.so_qty_puom);
  const qtyLuom = numberOrZero(row.so_qty_luom);
  const uppp = numberOrZero(row.uppp);
  return isSamePoUom(row) ? qtyLuom : qtyPuom * uppp + qtyLuom;
}

export function computePQuantity(row: SalesOrderLineRow): number {
  const qtyPuom = numberOrZero(row.qty_puom);
  const qtyLuom = numberOrZero(row.qty_luom);
  const uppp = numberOrZero(row.uppp);
  return isSamePoUom(row) ? qtyLuom : qtyPuom * uppp + qtyLuom;
}


// Gross amount = unit price * quantity (no discount applied yet)



// Total discount for the whole line (was missing * quantity before)
export function lineDiscPrice(row: SalesOrderLineRow) {
  // return row.unit_price * (row.disc_hdr_percent / 100) ;
  return row.unit_price * (row.disc_percent / 100);
}

export function lineDiscPoPrice(row: SalesOrderLineRow) {
  return (row.sorder_unit_price ?? 0) * ((row.sorder_disc_percent ?? 0) / 100);
}

export function finalRate(row: SalesOrderLineRow) {
  return Math.abs(lineDiscPrice(row) - row.unit_price);
}

export function finalPORate(row: SalesOrderLineRow) {
  return Math.abs(lineDiscPoPrice(row) - (row.sorder_unit_price ?? 0));
}

export function lineAmount(row: SalesOrderLineRow) {
  return finalRate(row) * computeQuantity(row);
}

export function linePOAmount(row: SalesOrderLineRow) {
  return finalPORate(row) * computeQuantity(row);
}


// Net = gross - discount (single subtraction, no double-counting)
export function lineNetAmount(row: SalesOrderLineRow) {
  return lineAmount(row) - lineDiscPrice(row);
}

export function lineNetPOAmount(row: SalesOrderLineRow) {
  return linePOAmount(row) - lineDiscPoPrice(row);
}

export function lineTaxAmount(row: SalesOrderLineRow) {
  return lineNetAmount(row) * (row.tx_compnt_perc_1 / 100);
}
export function lineTaxpoAmount(row: SalesOrderLineRow) {
  return lineNetPOAmount(row) * ((row.sorder_tx_compnt_perc_1 ?? 0) / 100);
}

// Lcurr = net amount converted at ex_rate (was net * finalRate * ex_rate — double rate applied)
export function lineLcurrAmount(row: SalesOrderLineRow, ex_rate?: number) {
  return lineAmount(row) * (ex_rate || 1);
}

export function lineLcurrPOAmount(row: SalesOrderLineRow, ex_rate?: number) {
  return linePOAmount(row) * (ex_rate || 1);
}


export function taxLcurrAmount(row: SalesOrderLineRow, ex_rate?: number) {
  return lineTaxAmount(row) * (ex_rate || 1);

}

export function taxLcurrpoAmount(row: SalesOrderLineRow, ex_rate?: number) {
  return lineTaxpoAmount(row) * (ex_rate || 1);

}

export function LcurrDisAmount(row: SalesOrderLineRow) {
  return lineLcurrAmount(row) + taxLcurrAmount(row)

}

// buildDetailsPayload — uses computed values
export function buildDetailsPayload(rows: SalesOrderLineRow[], ex_rate?: number) {
  return rows.map((row) => ({
    div_code: row.div_code,
    zone_code: row.zone_code,
    prod_code: row.prod_code,
    prod_name: row.prod_name,
    p_uom: row.p_uom,
    uppp: row.uppp,
    qty_puom: row.qty_puom,
    l_uom: row.l_uom,
    qty_luom: row.qty_luom,
    serial_no: row.serial_no,

    unit_price: row.unit_price,
    unit_price_net: finalRate(row),
    amount: lineAmount(row),

    disc_hdr_percent: row.disc_hdr_percent,
    disc_hdr_price: lineDiscPrice(row),

    disc_percent: row.disc_percent,
    disc_price: lineDiscPrice(row),

    net_amount: lineNetAmount(row),

    quantity: computeQuantity(row),

    tax_pct: row.tax_pct,
    tax_amount: lineTaxAmount(row),

    lcur_amount: lineLcurrAmount(row, ex_rate),

    required_dt: row.required_dt,
    remarks: row.line_remarks,

    tx_cat_code: row.tx_cat_code,
    tx_compntcat_code_1: row.tx_compntcat_code_1,

    tax_lcur_amount: taxLcurrAmount(row, ex_rate),

    lcur_amount_disc: row.lcur_amount_disc,

    tx_compnt_amt_1: lineTaxAmount(row),
    tx_compnt_perc_1: row.tx_compnt_perc_1,
    tx_compnt_1_expmt: row.tx_compnt_1_expmt,

    // SO
    so_p_uom: row.so_p_uom,
    so_qty_puom: row.so_qty_puom,
    so_l_uom: row.so_l_uom,
    so_qty_luom: row.so_qty_luom,
    so_unit_price: row.so_unit_price,
    so_quantity: row.so_quantity,
    so_prod_code: row.so_prod_code,
    so_prod_name: row.so_prod_name,
    so_div_code: row.so_div_code,
    so_zone_code: row.so_zone_code,
    so_zone_name: row.so_zone_name,

    ref_doc_no: numberOrZero(row.so_doc_no) || undefined,

  }));
}

export async function runWorkflow(
  status: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "CLOSED" | "CANCELED" | "SENTBACK",
  docType: SODocType,
  form: PurchaseOrderForm,
  rows: SalesOrderLineRow[],
  companyCode?: string,
  loginid?: string,
) {
  return upsertBulkSaleseEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid, docType),
      details: buildDetailsPayload(rows, form.ex_rate),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    status,
    docType,
  );
}