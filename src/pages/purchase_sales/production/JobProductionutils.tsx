import { getDynamicLookup } from "../../../api/lookups";
import { upsertBulkJobProductionEntryApi, upsertBulkPurchaseEntryApi } from "../../../api/purchaseSales";
import {
    EXPENSE_AC_OPTIONS,
    ExpenseRow,
    JobProductionConfig,
    PO_DOC_TYPE,
    PODocType,
    PurchaseConfig,
    PurchaseOrderEditorState,
    PurchaseOrderForm,
    PurchaseOrderLineRow,
    TteJmiConsumType,
} from "../purchase/Purchaseordertypes";

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
  tax_cat: "",
  tax_code: "",
  tax_lcur_amount: 0,
  lcur_amount_disc: 0,
  uppp:0,
  quantity:0,
  ex_rate:1
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
  };
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
      required_dt: text(row.required_dt),
      line_remarks: text(row.remarks ?? row.line_remarks),
      tax_cat: text(row.tax_cat ?? row.tax_category),
      tax_code: text(row.tax_code),
      tax_lcur_amount: numberOrZero(row.tax_lcur_amount),
      lcur_amount_disc: numberOrZero(row.lcur_amount_disc ?? row.lcur_amount_discount),
      uppp:numberOrZero(row.uppp),
      quantity:numberOrZero(row.quantity),
      ex_rate:numberOrZero(row.ex_rate),
    } satisfies PurchaseOrderLineRow;
  });
}

export async function fetchjmiConsumDetailsDetail(
    docNo: string,
    config: JobProductionConfig,
    companyCode?: string,
    loginid?: string,
): Promise<TteJmiConsumType[]> {
    const rows = await getDynamicLookup({
        parameter: config.jmiConsumDetails,
        code1: companyCode,
        code2: config.docType,
        code3: docNo,
        loginid: loginid || "ADMIN",
    });

    return (rows || []).map((raw) => {
        const row = lowerRecord(raw as Record<string, unknown>);

        return {
            id: newId(),

            company_code: text(row.company_code),
            doc_type: text(row.doc_type),
            doc_no: numberOrZero(row.doc_no),

            mi_doc_no: numberOrZero(row.mi_doc_no),

            prod_code: text(row.prod_code),
            prod_name: text(row.prod_name),

            quantity: numberOrZero(row.quantity),
            qty: numberOrZero(row.qty ?? row.quantity),

            p_uom: text(row.p_uom),
            l_uom: text(row.l_uom),

            qty_puom: numberOrZero(row.qty_puom),
            qty_luom: numberOrZero(row.qty_luom),

            serial_no: numberOrZero(row.serial_no),

            qty_consumd: numberOrZero(row.qty_consumd),
            qty_scrapped: numberOrZero(row.qty_scrapped),

            cost_rate: numberOrZero(row.cost_rate),
            cost_amount: numberOrZero(row.cost_amount),

            scrap_amount: numberOrZero(row.scrap_amount),

            div_code: text(row.div_code),

            unit_price: numberOrZero(row.unit_price),

            tax_pct: numberOrZero(row.tax_pct ?? row.tax_percent),
            tax_amount: numberOrZero(row.tax_amount),

            lcur_amount: numberOrZero(row.lcur_amount),

            required_dt: text(row.required_dt),

            line_remarks: text(row.remarks ?? row.line_remarks),

            tax_cat: text(row.tax_cat ?? row.tax_category),

            tax_lcur_amount: numberOrZero(row.tax_lcur_amount),

            lcur_amount_disc: numberOrZero(
                row.lcur_amount_disc ?? row.lcur_amount_discount
            ),
            uppp: numberOrZero(row.uppp),
            ex_rate: numberOrZero(row.ex_rate ?? 1),
            disc_percent: numberOrZero(row.disc_pct ?? row.disc_percent),
            disc_price: numberOrZero(row.disc_price),
            tax_code: text(row.tax_code),

            zone_code: text(row.zone_code),
            zone_name: text(row.zone_name),

            uom_name: text(row.uom_name),
            uom_code: text(row.uom_code),
        } satisfies TteJmiConsumType;
    });
}

export async function fetchexpenseDetailsDetail(
    docNo: string,
    config: JobProductionConfig,
    companyCode?: string,
    loginid?: string,
): Promise<ExpenseRow[]> {
    const rows = await getDynamicLookup({
        parameter: config.expenseDetails,
        code1: companyCode,
        code2: config.docType,
        code3: docNo,
        loginid: loginid || "ADMIN",
    });

    return (rows || []).map((raw) => {
        const row = lowerRecord(raw as Record<string, unknown>);

        return {
            id: newId(),
            company_code: text(row.company_code),
            doc_type: text(row.doc_type),
            doc_no: text(row.doc_no),

            doc_date: row.doc_date ? new Date(String(row.doc_date)) : null,

            div_code: text(row.div_code),
            dept_code: text(row.dept_code),

            serial_no: numberOrZero(row.serial_no),

            exp_code: text(row.exp_code),

            remarks: text(row.remarks),

            amount: numberOrZero(row.amount),

            curr_code: text(row.curr_code),

            ex_rate: numberOrZero(row.ex_rate),

            lcur_amount: numberOrZero(row.lcur_amount),

            ref_doc_type: text(row.ref_doc_type),

            ref_doc_no: numberOrZero(row.ref_doc_no),

            ref_doc_serial: numberOrZero(row.ref_doc_serial),

            edit_user: text(row.edit_user),

            edit_date: row.edit_date
                ? new Date(String(row.edit_date))
                : null,

            user_id: text(row.user_id),

            user_dt: row.user_dt
                ? new Date(String(row.user_dt))
                : null,

            zone_code: text(row.zone_code),

            ac_code: text(row.ac_code),

            wrk_type: text(row.wrk_type),

            employee_id: text(row.employee_id),

            hourly_rate: numberOrZero(row.hourly_rate),

        } satisfies ExpenseRow;
    });
}


export function buildHeaderPayload(form: PurchaseOrderForm, companyCode?: string, loginid?: string, docType?: PODocType) {
  return {
    doc_no: numberOrZero(form.doc_no) || undefined,
    doc_type: docType,
    doc_date: form.doc_date,
    ref_no: form.ref_no,
    ref_date: form.ref_date,
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
    
  
    tx_compntcat_code_1: form.tax_code,
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
  };
}


export function lineAmount(row: PurchaseOrderLineRow) {
    return row.qty_puom * row.unit_price;
}
export function lineDiscPrice(row: PurchaseOrderLineRow) {
    return lineAmount(row) * (row.disc_percent / 100);
}
export function lineNetAmount(row: PurchaseOrderLineRow) {
    return lineAmount(row) - lineDiscPrice(row);
}
export function lineTaxAmount(row: PurchaseOrderLineRow) {
    return lineNetAmount(row) * (row.tax_pct / 100);
}

export function buildDetailsPayload(rows: PurchaseOrderLineRow[]) {
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
        disc_percent: row.disc_percent,
        disc_price: lineDiscPrice(row),
        net_amount: lineNetAmount(row),
        quantity: row.quantity,
        tax_pct: row.tax_pct,
        tax_amount: lineTaxAmount(row),
        lcur_amount: row.lcur_amount,
        required_dt: row.required_dt,
        remarks: row.line_remarks,
        tax_cat: row.tax_cat,
        tax_code: row.tax_code,
        tax_lcur_amount: row.tax_lcur_amount,
        lcur_amount_disc: row.lcur_amount_disc,
    }));
}

export function buildTteJmiConsumPayload(rows: TteJmiConsumType[]) {
    return rows.map((row) => ({
        id: row.id,
        company_code: row.company_code,
        doc_type: row.doc_type,
        doc_no: row.doc_no,

        mi_doc_no: row.mi_doc_no,

        prod_code: row.prod_code,
        prod_name: row.prod_name,

        quantity: row.quantity,
        qty: row.qty,

        p_uom: row.p_uom,
        l_uom: row.l_uom,

        qty_puom: row.qty_puom,
        qty_luom: row.qty_luom,

        serial_no: row.serial_no,

        qty_consumd: row.qty_consumd,
        qty_scrapped: row.qty_scrapped,

        cost_rate: row.cost_rate,
        cost_amount: row.cost_amount,

        scrap_amount: row.scrap_amount,

        div_code: row.div_code,

        unit_price: row.unit_price,
        tax_pct: row.tax_pct,
        tax_amount: row.tax_amount,
        lcur_amount: row.lcur_amount,
        required_dt: row.required_dt,
        line_remarks: row.line_remarks,
        tax_cat: row.tax_cat,
        tax_lcur_amount: row.tax_lcur_amount,
        lcur_amount_disc: row.lcur_amount_disc,

        zone_code: row.zone_code,
        zone_name: row.zone_name,
        uom_name: row.uom_name,
        uom_code: row.uom_code,
    }));
}

export function buildExpensePayload(rows: ExpenseRow[]) {
    return rows.map((row) => ({
        id: row.id,

        company_code: row.company_code,
        doc_type: row.doc_type,
        doc_no: numberOrZero(row.doc_no),
        doc_date: row.doc_date,

        div_code: row.div_code,
        dept_code: row.dept_code,

        serial_no: row.serial_no,

        exp_code: row.exp_code,

        remarks: row.remarks,

        amount: row.amount,

        curr_code: row.curr_code,
        ex_rate: row.ex_rate,
        lcur_amount: row.lcur_amount,

        ref_doc_type: row.ref_doc_type,
        ref_doc_no: row.ref_doc_no,
        ref_doc_serial: row.ref_doc_serial,

        edit_user: row.edit_user,
        edit_date: row.edit_date,

        user_id: row.user_id,
        user_dt: row.user_dt,

        zone_code: row.zone_code,

        ac_code: row.ac_code,

        wrk_type: row.wrk_type,

        employee_id: row.employee_id,

        hourly_rate: row.hourly_rate,
    }));
}

export async function runWorkflow(
    status: "SAVEASDRAFT" | "SUBMITTED" | "REJECTED" | "CLOSED" | "CANCELED" | "SENTBACK",
    docType: PODocType,
    form: PurchaseOrderForm,
    rows: PurchaseOrderLineRow[],
    subrow: TteJmiConsumType[],
    expenserow: ExpenseRow[],
    companyCode?: string,
    loginid?: string,
) {
    return upsertBulkJobProductionEntryApi(
        {
            header: buildHeaderPayload(form, companyCode, loginid, docType),
            details: buildDetailsPayload(rows),
            jmiConsumDetails: buildTteJmiConsumPayload(subrow),
            expenseDetails: buildExpensePayload(expenserow),
            company_code: companyCode || "",
            loginid: loginid || "ADMIN",
        },
        status,
        docType
    );
}

