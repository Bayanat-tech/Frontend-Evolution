import { getDynamicLookup } from "../../../api/lookups";
import { upsertBulkPurchaseEntryApi } from "../../../api/purchaseSales";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";
import {
  EXPENSE_AC_OPTIONS,
  PO_DOC_TYPE,
  PODocType,
  PurchaseConfig,
  PurchaseOrderEditorState,
  PurchaseOrderForm,
  PurchaseOrderLineRow,
  TteJmiConsumType,
} from "./Purchaseordertypes";

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

export const emptyLineRow = (divCode: string): PurchaseOrderLineRow => ({
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
  disc_hdr_percent: 0,
  disc_percent: 0,
  disc_price: 0,
  tax_pct: 0,
  tax_amount: 0,
  lcur_amount: 0,
  required_dt: "",
  line_remarks: "",
  tx_cat_code: "",
  tx_compntcat_code_1: "",
  tax_lcur_amount: 0,
  lcur_amount_disc: 0,
  uppp: 0,
  quantity: 0,
  ex_rate: 1,
  tx_compnt_perc_1: 0,
  tx_compnt_amt_1: 0,
  tx_compnt_1_expmt: "",
  po_prod_code: "",
  po_prod_name: "",
  po_p_uom: "",
  po_qty_puom: 0,
  po_l_uom: "",
  po_qty_luom: 0,
  po_quantity: 0,
  serial_no:0

});

export function emptyForm(editor: PurchaseOrderEditorState): PurchaseOrderForm {
  return {
    doc_no: editor?.mode === "edit" ? editor.row.doc_no : "",
    doc_date: editor?.mode === "edit" ? editor.row.doc_date || "" : new Date().toISOString().slice(0, 10),
    ref_no: editor?.mode === "edit" ? editor.row.ref_no || "" : "",
    ref_date: editor?.mode === "edit" ? editor.row.ref_date || "" : "",
    div_code: editor?.mode === "create" ? editor.divCode || "" : editor?.mode === "edit" ? editor.row.div_code : "",
    div_name: editor?.mode === "create" ? editor.divName || "" : editor?.mode === "edit" ? editor.row.div_name || "" : "",
    ac_code: editor?.mode === "edit" ? editor.row.ac_code || "" : "",
    dept_name: editor?.mode === "edit" ? editor.row.dept_name || "" : "",
    ac_name: editor?.mode === "edit" ? editor.row.ac_name || "" : "",
    party_address: editor?.mode === "edit" ? editor.row.party_address || "" : "",
    credit_period: editor?.mode === "edit" ? Number(editor.row.credit_period || 0) : 0,
    dept_code: editor?.mode === "edit" ? editor.row.dept_code || "" : "",
    party_phone: editor?.mode === "edit" ? editor.row.party_phone || "" : "",
    party_fax: editor?.mode === "edit" ? editor.row.party_fax || "" : "",
    buyer: editor?.mode === "edit" ? editor.row.buyer || "" : "",
    wo_number: editor?.mode === "edit" ? editor.row.wo_number || "NC" : "NC",
    curr_code: editor?.mode === "edit" ? editor.row.curr_code || "" : "",
    curr_name: editor?.mode === "edit" ? editor.row.curr_name || "" : "",
    ex_rate: editor?.mode === "edit" ? Number(editor.row.ex_rate || 1) : 1,
    payment_terms: editor?.mode === "edit" ? editor.row.payment_terms || "" : "",
    dlvr_term: editor?.mode === "edit" ? editor.row.dlvr_term || "" : "",
    dlvr_contact: editor?.mode === "edit" ? editor.row.dlvr_contact || "" : "",
    dlvr_mobile: editor?.mode === "edit" ? editor.row.dlvr_mobile || "" : "",
    dlvr_email: editor?.mode === "edit" ? editor.row.dlvr_email || "" : "",
    remarks: editor?.mode === "edit" ? editor.row.remarks || "" : "",
    disc_hdr_price: editor?.mode === "edit" ? Number(editor.row.disc_hdr_price || 0) : 0,
    disc_hdr_percent: editor?.mode === "edit" ? Number(editor.row.disc_hdr_percent || 0) : 0,
    tx_cat_code: editor?.mode === "edit" ? editor.row.tx_cat_code || "" : "",
    disc_price: editor?.mode === "edit" ? Number(editor.row.disc_price || 0) : 0,
    disc_percent: editor?.mode === "edit" ? Number(editor.row.disc_percent || 0) : 0,
    tax_category: editor?.mode === "edit" ? editor.row.tax_category || "" : "",
    tax_code: editor?.mode === "edit" ? editor.row.tax_code || "" : "",
    tx_compntcat_code_1: editor?.mode === "edit" ? editor.row.tx_compntcat_code_1 || "" : "",
    tax_code_name: editor?.mode === "edit" ? editor.row.tax_code_name || "" : "",
    tx_cat_name: editor?.mode === "edit" ? editor.row.tx_cat_name || "" : "",
    // expense_ac_post: editor?.mode === "edit" ? editor.row.expense_ac_post || EXPENSE_AC_OPTIONS[0] : EXPENSE_AC_OPTIONS[0],
    expense_ac_post: editor?.mode === "edit" ? editor.row.expense_ac_post || EXPENSE_AC_OPTIONS[0].value : EXPENSE_AC_OPTIONS[0].value,
    print_on_letterhead: editor?.mode === "edit" ? editor.row.print_on_letterhead || "N" : "N",
    project_name: editor?.mode === "edit" ? editor.row.project_name || "" : "",
    pr_no: editor?.mode === "edit" ? editor.row.pr_no || "" : "",
    scope_of_work: editor?.mode === "edit" ? editor.row.scope_of_work || "" : "",
    canceled: editor?.mode === "edit" ? editor.row.canceled : "N",
    flow_level_running:
      editor?.mode === "edit" ? Number(editor.row.flow_level_running ?? editor.row.flow_level ?? 0) : 0,
    next_action_by: "",
    sentback_reason: "",
    reject_reason: "",
  } as PurchaseOrderForm;
}

export async function fetchPurchaseOrderHeader(
  docNo: string,
  config: PurchaseConfig,
  companyCode?: string,
  loginid?: string,
): Promise<Record<string, unknown>> {
  const rows = await getDynamicLookup({
    parameter: config.headerParameter,
    code1: companyCode,
    code2: config.docType,
    code3: docNo,
    loginid: loginid || "ADMIN",
  });

  const row = (rows || [])[0] as Record<string, unknown> | undefined;

  return row ? lowerRecord(row) : {};
}

export async function fetchPurchaseOrderDetail(
  docNo: string,
  config: PurchaseConfig,
  companyCode?: string,
  loginid?: string,
): Promise<PurchaseOrderLineRow[]> {
  const rows = await getDynamicLookup({
    parameter: config.detailParameter,
    code1: companyCode,
    code2: config.docType,
    code3: docNo,
    loginid: loginid || "ADMIN",
  });

  return (rows || []).map((raw) => {
    const row = lowerRecord(raw as Record<string, unknown>);
    return {
      id: newId(),
      div_code: text(row.div_code),
      zone_code: text(row.zone_code),
      prod_code: text(row.prod_code),
      prod_name: text(row.prod_name),
      p_uom: text(row.p_uom),
      qty_puom: numberOrZero(row.qty_puom),
      l_uom: text(row.l_uom),
      qty_luom: numberOrZero(row.qty_luom),
      unit_price: numberOrZero(row.unit_price),
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

      // GRN-side (po_*) — used by PurchaseGrnDetailsTable
      po_prod_code: text(row.po_prod_code),
      po_prod_name: text(row.po_prod_name),
      po_p_uom: text(row.po_p_uom),
      po_qty_puom: numberOrZero(row.po_qty_puom),
      po_l_uom: text(row.po_l_uom),
      po_qty_luom: numberOrZero(row.po_qty_luom),
      po_quantity: numberOrZero(row.po_quantity),
      po_unit_price: numberOrZero(row.po_unit_price),
      po_div_code: text(row.po_div_code),

      // PO-order-reference side (porder_*) — used by PurchaseInvoiceLinesTable
      porder_prod_code: text(row.porder_prod_code),
      porder_prod_name: text(row.porder_prod_name),
      porder_div_code: text(row.porder_div_code),
      porder_p_uom: text(row.porder_p_uom),
      porder_qty_puom: numberOrZero(row.porder_qty_puom),
      porder_l_uom: text(row.porder_l_uom),
      porder_qty_luom: numberOrZero(row.porder_qty_luom),
      porder_quantity: numberOrZero(row.porder_quantity),
      porder_unit_price: numberOrZero(row.porder_unit_price),
      porder_disc_percent: numberOrZero(row.porder_disc_percent),
      porder_disc_price: numberOrZero(row.porder_disc_price),
      porder_zone_code: text(row.porder_zone_code),
      porder_required_dt: toDateInputValue(row.porder_required_dt) || "",
      porder_tx_cat_code: text(row.porder_tx_cat_code),
      porder_tx_cat_name: text(row.porder_tx_cat_name),
      porder_tx_compntcat_code_1: text(row.porder_tx_compntcat_code_1),
      porder_tx_compntcat_name_1: text(row.porder_tx_compntcat_name_1),
      porder_tx_compnt_perc_1: numberOrZero(row.porder_tx_compnt_perc_1),
      porder_tx_compnt_amt_1: numberOrZero(row.porder_tx_compnt_amt_1),
      porder_tx_compnt_1_expmt: text(row.porder_tx_compnt_1_expmt),
      porder_remarks : text(row.porder_remarks),
      serial_no: numberOrZero(row.serial_no),
    } satisfies PurchaseOrderLineRow;
  });
}

export function buildHeaderPayload(form: PurchaseOrderForm, companyCode?: string, loginid?: string, docType?: PODocType) {
  const refDocNo =
    docType === "GRN"
      ? numberOrZero(form.po_doc_no)
      : docType === "PIN"
        ? text(form.grn_doc_no)
        : undefined;

  console.log("REF DOC NO:", refDocNo);
  return {
    doc_no: numberOrZero(form.doc_no) || undefined,
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

    curr_code:  form.curr_code,
    curr_name:  form.curr_name,
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
    grn_no: numberOrZero(form.doc_no) || undefined,
    pi_div_code: form.po_div_code,
    pi_div_name: form.po_div_name,
    pi_ac_code: form.po_ac_code,
    pi_ac_name: form.po_ac_name,
    pi_party_address: form.po_party_address,
    pi_credit_period: form.po_credit_period,
    pi_party_name: form.po_party_name,
    pi_dept_code: form.po_dept_code,
    pi_dept_name: form.po_dept_name,
    pi_party_phone: form.po_party_phone,
    pi_party_fax: form.po_party_fax,
    pi_buyer: form.po_buyer,
    pi_wo_no: form.po_wo_no,
    pi_wo_number: form.po_wo_number,
    pi_curr_code: form.po_curr_code,
    pi_curr_name: form.po_curr_name,
    pi_tax_code: form.po_tax_code,
    pi_tx_compntcat_code_1: form.po_tx_compntcat_code_1,
    pi_tax_code_name: form.po_tax_code_name,
    pi_tx_cat_name: form.po_tx_cat_name,
    pi_tx_cat_code: form.po_tx_cat_code,
    pi_ex_rate: form.po_ex_rate,
    pi_payment_terms: form.po_payment_terms,
    pi_dlvr_term: form.po_dlvr_term,
    pi_dlvr_contact: form.po_dlvr_contact,
    pi_dlvr_mobile: form.po_dlvr_mobile,
    pi_dlvr_email: form.po_dlvr_email,
    pi_remarks: form.po_remarks,
    pi_disc_hdr_price: form.po_disc_hdr_price,
    pi_disc_hdr_percent: form.po_disc_hdr_percent,
    pi_disc_price: form.po_disc_price,
    pi_disc_percent: form.po_disc_percent,
    pi_tax_category: form.po_tax_category,
    pi_expense_ac_post: form.po_expense_ac_post,
    pi_print_on_letterhead: form.po_print_on_letterhead,
    pi_project_name: form.po_project_name,
    pi_pr_no: form.po_pr_no,
    pi_scope_of_work: form.po_scope_of_work,
    pi_ref_doc_no: form.grn_doc_no

  };
}


// Purchaseorderutils.ts

export function isSameUom(row: PurchaseOrderLineRow): boolean {
  return sameUom(row.p_uom, row.l_uom);
}

export function isSamePoUom(row: PurchaseOrderLineRow): boolean {
  return sameUom(row.po_p_uom, row.po_l_uom);
}

function sameUom(primaryUom?: string | null, looseUom?: string | null): boolean {
  const primary = text(primaryUom).trim().toUpperCase();
  const loose = text(looseUom).trim().toUpperCase();
  return !!primary && primary === loose;
}

export function computeQuantity(row: PurchaseOrderLineRow): number {
  const qtyPuom = numberOrZero(row.qty_puom);
  const qtyLuom = numberOrZero(row.qty_luom);
  const uppp = numberOrZero(row.uppp);
  return isSameUom(row) ? qtyLuom : qtyPuom * uppp + qtyLuom;
}

export function computePoQuantity(row: PurchaseOrderLineRow): number {
  const qtyPuom = numberOrZero(row.po_qty_puom);
  const qtyLuom = numberOrZero(row.po_qty_luom);
  const uppp = numberOrZero(row.uppp);
  return isSamePoUom(row) ? qtyLuom : qtyPuom * uppp + qtyLuom;
}

export function computePQuantity(row: PurchaseOrderLineRow): number {
  const qtyPuom = numberOrZero(row.qty_puom);
  const qtyLuom = numberOrZero(row.qty_luom);
  const uppp = numberOrZero(row.uppp);
  return isSamePoUom(row) ? qtyLuom : qtyPuom * uppp + qtyLuom;
}


// Gross amount = unit price * quantity (no discount applied yet)



// Total discount for the whole line (was missing * quantity before)
export function lineDiscPrice(row: PurchaseOrderLineRow) {
  return row.unit_price * computeQuantity(row) * (row.disc_percent / 100);
}

export function lineDiscPoPrice(row: PurchaseOrderLineRow) {
  return (row.porder_unit_price ?? 0) * computeQuantity(row) * ((row.porder_disc_percent ?? 0) / 100);
}

export function finalRate(row: PurchaseOrderLineRow) {
  return Number(
    (row.unit_price * (1 - row.disc_percent / 100)).toFixed(6)
  );
}

export function finalPORate(row: PurchaseOrderLineRow) {
  return (row.porder_unit_price ?? 0) * (1 - (row.porder_disc_percent ?? 0) / 100);
}

export function lineAmount(row: PurchaseOrderLineRow) {
  return row.unit_price * computeQuantity(row);
}

export function linePOAmount(row: PurchaseOrderLineRow) {
  return (row.porder_unit_price ?? 0) * computeQuantity(row);
}


// Net = gross - discount (single subtraction, no double-counting)
export function lineNetAmount(row: PurchaseOrderLineRow) {
  return lineAmount(row);
}

export function lineNetPOAmount(row: PurchaseOrderLineRow) {
  return linePOAmount(row) - lineDiscPoPrice(row);
}

export function lineTaxAmount(row: PurchaseOrderLineRow) {
  return lineNetAmount(row) * (row.tx_compnt_perc_1 / 100);
}
export function lineTaxpoAmount(row: PurchaseOrderLineRow) {
  return lineNetPOAmount(row) * ((row.porder_tx_compnt_perc_1 ?? 0) / 100);
}

// Lcurr = net amount converted at ex_rate (was net * finalRate * ex_rate — double rate applied)
export function lineLcurrAmount(row: PurchaseOrderLineRow, ex_rate?: number) {
  return lineNetAmount(row) * (ex_rate || 1);
}

export function lineLcurrPOAmount(row: PurchaseOrderLineRow, ex_rate?: number) {
  return lineNetPOAmount(row) * (ex_rate || 1);
}


export function taxLcurrAmount(row: PurchaseOrderLineRow, ex_rate?: number) {
  return lineTaxAmount(row) * (ex_rate || 1);

}

export function taxLcurrpoAmount(row: PurchaseOrderLineRow, ex_rate?: number) {
  return lineTaxpoAmount(row) * (ex_rate || 1);

}
export function LcurrDisAmount(row: PurchaseOrderLineRow, ex_rate?: number) {
  return lineLcurrAmount(row, ex_rate) + taxLcurrAmount(row, ex_rate);
}


// buildDetailsPayload — use computed values instead of stale row.qty / row.lcur_amount
export function buildDetailsPayload(
  rows: PurchaseOrderLineRow[],
  ex_rate?: number,
  docType?: string
) {
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
    serial_no:row.serial_no,
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

    lcur_amount_disc: LcurrDisAmount(row),

    tx_compnt_amt_1: lineTaxAmount(row),
    tx_compnt_perc_1: row.tx_compnt_perc_1,
    tx_compnt_1_expmt: row.tx_compnt_1_expmt,

    po_p_uom: row.po_p_uom,
    po_qty_puom: row.po_qty_puom,
    po_l_uom: row.po_l_uom,
    po_qty_luom: row.po_qty_luom,
    po_unit_price: row.po_unit_price,
    po_quantity: row.po_quantity,
    po_prod_code: row.po_prod_code,
    po_prod_name: row.po_prod_name,
    po_div_code: row.po_div_code,
    po_zone_code: row.po_zone_code,
    po_zone_name: row.po_zone_name,
    ref_doc_no: numberOrZero(row.po_doc_no) || undefined,
  }));
}

export async function runWorkflow(
  status: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "CLOSED" | "CANCELED" | "SENTBACK",
  docType: PODocType,
  form: PurchaseOrderForm,
  rows: PurchaseOrderLineRow[],
  companyCode?: string,
  loginid?: string,
) {
  return upsertBulkPurchaseEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid, docType),
      details: buildDetailsPayload(rows, form.ex_rate),

      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    status,
    docType
  );
}

