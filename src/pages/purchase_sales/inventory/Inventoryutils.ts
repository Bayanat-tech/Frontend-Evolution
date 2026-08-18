import { getDynamicLookup } from "../../../api/lookups";
import { upsertBulkInventoryEntryApi, upsertBulkPurchaseEntryApi, upsertBulkSaleseEntryApi } from "../../../api/purchaseSales";
import { PurchaseOrderLineRow } from "../purchase/Purchaseordertypes";
import {
  EXPENSE_AC_OPTIONS,
  InventoryDocType,
  InventoryConfig,
  PurchaseOrderEditorState,
  PurchaseOrderForm,
  InventoryLineRow,
  
} from "./Inventorytypes";

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

export const emptyLineRow = (divCode: string): InventoryLineRow => ({
  id: newId(),
  div_code: divCode,
  zone: "",
  prod_code: "",
  prod_name: "",
  p_uom: "",
  qty_puom: 0,
  l_uom: "",
  qty_luom: 0,
  unit_price: 0,
  disc_precent: 0,
  disc_price: 0,
  qty: 0,
  tax_pct: 0,
  tax_amount: 0,
  lcurr_amount: 0,
  req_date: "",
  line_remarks: "",
  tax_cat: "",
  tax_code: "",
  tax_lcurr_amount: 0,
  lcurr_amount_disc: 0,
  sign_ind:0,
  sale_price:0,
  uppp : 0,
  dept_code: "",
  job_no: "",
  remarks: "",
});

export function emptyForm(editor: PurchaseOrderEditorState): PurchaseOrderForm {
  return {
    doc_no: editor?.mode === "edit" ? editor.row.doc_no : "",
    doc_date: editor?.mode === "edit" ? editor.row.doc_date || "" : new Date().toISOString().slice(0, 10),
    quotn_no: editor?.mode === "edit" ? editor.row.quotn_no || "" : "",
    quotn_date: editor?.mode === "edit" ? editor.row.quotn_date || "" : "",
    div_code: editor?.mode === "create" ? editor.divCode || "" : editor?.mode === "edit" ? editor.row.div_code : "",
    div_name: editor?.mode === "create" ? editor.divName || "" : editor?.mode === "edit" ? editor.row.div_name || "" : "",
    ac_code: editor?.mode === "edit" ? editor.row.ac_code || "" : "",
    ac_name: editor?.mode === "edit" ? editor.row.ac_name || "" : "",
    address: editor?.mode === "edit" ? editor.row.address || "" : "",
    credit_period: editor?.mode === "edit" ? Number(editor.row.credit_period || 0) : 0,
    dept_code: editor?.mode === "edit" ? editor.row.dept_code || "" : "",
    tel: editor?.mode === "edit" ? editor.row.tel || "" : "",
    fax: editor?.mode === "edit" ? editor.row.fax || "" : "",
    buyer: editor?.mode === "edit" ? editor.row.buyer || "" : "",
    wo_no: editor?.mode === "edit" ? editor.row.wo_no || "NC" : "NC",
    curr_code: editor?.mode === "edit" ? editor.row.curr_code || "" : "",
    curr_name: editor?.mode === "edit" ? editor.row.curr_name || "" : "",
    ex_rate: editor?.mode === "edit" ? Number(editor.row.ex_rate || 1) : 1,
    pay_terms: editor?.mode === "edit" ? editor.row.pay_terms || "" : "",
    delivery_term: editor?.mode === "edit" ? editor.row.delivery_term || "" : "",
    delivery_contact: editor?.mode === "edit" ? editor.row.delivery_contact || "" : "",
    delivery_tel: editor?.mode === "edit" ? editor.row.delivery_tel || "" : "",
    delivery_email: editor?.mode === "edit" ? editor.row.delivery_email || "" : "",
    remarks: editor?.mode === "edit" ? editor.row.remarks || "" : "",
    disc_price: editor?.mode === "edit" ? Number(editor.row.disc_price || 0) : 0,
    disc_precent: editor?.mode === "edit" ? Number(editor.row.disc_precent || 0) : 0,
    tax_category: editor?.mode === "edit" ? editor.row.tax_category || "" : "",
    tax_code: editor?.mode === "edit" ? editor.row.tax_code || "" : "",
    expense_ac_post: editor?.mode === "edit" ? editor.row.expense_ac_post || EXPENSE_AC_OPTIONS[0] : EXPENSE_AC_OPTIONS[0],
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
    issued_by:"",
    received_by:"",
  };
}

export async function fetchSalesOrderHeader(
  docNo: string,
  config: InventoryConfig,
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

export async function fetchSalesOrderDetail(
  docNo: string,
  config: InventoryConfig,
  companyCode?: string,
  loginid?: string,
): Promise<InventoryLineRow[]> {
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
      zone: text(row.zone),
      prod_code: text(row.prod_code),
      prod_name: text(row.prod_name),
      p_uom: text(row.p_uom),
      qty_puom: numberOrZero(row.qty_puom),
      l_uom: text(row.l_uom),
      qty_luom: numberOrZero(row.qty_luom),
      unit_price: numberOrZero(row.unit_price),
      disc_precent: numberOrZero(row.disc_precent),
      qty: numberOrZero(row.qty ?? row.quantity),
      tax_pct: numberOrZero(row.tax_pct ?? row.tax_percent),
      tax_amount: numberOrZero(row.tax_amount),
      lcurr_amount: numberOrZero(row.lcurr_amount),
      req_date: text(row.req_date),
      line_remarks: text(row.remarks ?? row.line_remarks),
      tax_cat: text(row.tax_cat ?? row.tax_category),
      tax_code: text(row.tax_code),
      tax_lcurr_amount: numberOrZero(row.tax_lcurr_amount),
      lcurr_amount_disc: numberOrZero(row.lcurr_amount_disc ?? row.lcurr_amount_discount),
      sign_ind : numberOrZero(row.sign_ind),
       sale_price: numberOrZero(row.sale_price),
       uppp:numberOrZero(row.uppp),
       dept_code: text(row.dept_code),
       job_no: text(row.job_no),
       remarks: text(row.remarks),
    } satisfies InventoryLineRow;
  });
}

export function buildHeaderPayload(form: PurchaseOrderForm, companyCode?: string, loginid?: string, docType?: InventoryDocType) {
  return {
    doc_no: form.doc_no || undefined,
    doc_type: docType,
    doc_date: form.doc_date,
    quotn_no: form.quotn_no,
    quotn_date: form.quotn_date,
    div_code: form.div_code,
    div_name: form.div_name,
    ac_code: form.ac_code,
    ac_name: form.ac_name,
    address: form.address,
    credit_period: form.credit_period,
    dept_code: form.dept_code,
    tel: form.tel,
    fax: form.fax,
    buyer: form.buyer,
    wo_no: form.wo_no,
    curr_code: form.curr_code,
    curr_name: form.curr_name,
    ex_rate: form.ex_rate,
    pay_terms: form.pay_terms,
    delivery_term: form.delivery_term,
    delivery_contact: form.delivery_contact,
    delivery_tel: form.delivery_tel,
    delivery_email: form.delivery_email,
    remarks: form.remarks,
    disc_price: form.disc_price,
    disc_precent: form.disc_precent,
    tax_category: form.tax_category,
    tax_code: form.tax_code,
    expense_ac_post: form.expense_ac_post,
    print_on_letterhead: form.print_on_letterhead,
    project_name: form.project_name,
    pr_no: form.pr_no,
    scope_of_work: form.scope_of_work,
    canceled: form.canceled || "N",
    company_code: companyCode,
    user_id: loginid,
    next_action_by: form.next_action_by || undefined,
    sentback_reason: form.sentback_reason || undefined,
    reject_reason: form.reject_reason || undefined,
    flow_level_running: form.flow_level_running || 0,
    issued_by : form.issued_by,
    received_by : form.received_by,
    from_zone_code:form.from_zone_code,
    to_zone_code: form.to_zone_code,
    zone_code: form.zone_code
  };
}

export function lineAmount(row: InventoryLineRow) {
  return row.qty_puom * row.unit_price;
}
export function lineDiscPrice(row: InventoryLineRow) {
  return lineAmount(row) * (row.disc_precent / 100);
}
export function lineNetAmount(row: InventoryLineRow) {
  return lineAmount(row) - lineDiscPrice(row);
}
export function lineTaxAmount(row: InventoryLineRow) {
  return lineNetAmount(row) * (row.tax_pct / 100);
}





export function buildDetailsPayload(rows: InventoryLineRow[]) {
  return rows.map((row) => ({
    div_code: row.div_code,
    zone_code: row.zone_code,
    prod_code: row.prod_code,
    prod_name: row.prod_name,
    p_uom: row.p_uom,
    qty_puom: row.qty_puom,
    l_uom: row.l_uom,
    qty_luom: row.qty_luom,
    unit_price: row.unit_price,
    amount: lineAmount(row),
    disc_precent: row.disc_precent,
    disc_price: lineDiscPrice(row),
    net_amount: lineNetAmount(row),
    qty: row.qty,
    tax_pct: row.tax_pct,
    tax_amount: lineTaxAmount(row),
    lcurr_amount: row.lcurr_amount,
    req_date: row.req_date,
    tax_cat: row.tax_cat,
    tax_code: row.tax_code,
    tax_lcurr_amount: row.tax_lcurr_amount,
    lcurr_amount_disc: row.lcurr_amount_disc,
    sign_ind : row.sign_ind,
    sale_price: row.sale_price,
    uppp: row.uppp,
    quantity:row.quantity,
    job_no: row.job_no,
    dept_code: row.dept_code,
    remarks: row.remarks,
    
  }));
}

export async function runWorkflow(
  status: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "CLOSED" | "CANCELED" | "SENTBACK",
    docType: InventoryDocType,
  form: PurchaseOrderForm,
  rows: InventoryLineRow[],
  companyCode?: string,
  loginid?: string,
) {
  return upsertBulkInventoryEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid, docType),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    status,
    docType
  );
}

