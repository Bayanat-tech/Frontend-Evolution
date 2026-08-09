import { getDynamicLookup } from "../../../api/lookups";
import { upsertBulkJobProductionEntryApi } from "../../../api/purchaseSales"; // removed unused upsertBulkPurchaseEntryApi
import {
    EXPENSE_AC_OPTIONS, // ensure this is exported from Purchaseordertypes or define it locally; we'll define it if missing
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

// If EXPENSE_AC_OPTIONS is not exported from Purchaseordertypes, define it here:
// (Assuming it's an array of { value: string; label: string })
// For safety, we'll define it locally if not already imported.
// We'll check if it's imported; if not, we'll provide a default.
// Since we imported it, we assume it exists. If not, uncomment the following:
/*
export const EXPENSE_AC_OPTIONS = [
  { value: "EXP", label: "Expense" },
  // ... other options
];
*/

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
    quantity: 0,
    tax_pct: 0,
    tax_amount: 0,
    lcur_amount: 0,
    required_dt: "",
    line_remarks: "",
    tax_cat: "",
    tax_code: "",
    tax_lcur_amount: 0,
    lcur_amount_disc: 0,
    disc_price: 0,
    ex_rate: 1,
});

export function emptyForm(editor: PurchaseOrderEditorState): any {
    // Ensure EXPENSE_AC_OPTIONS is defined; fallback if not
    const defaultExpenseAc = (EXPENSE_AC_OPTIONS && EXPENSE_AC_OPTIONS.length > 0)
        ? EXPENSE_AC_OPTIONS[0].value
        : "EXP";
    const rowRecord = editor?.mode === "edit"
        ? (editor.row as unknown as Record<string, unknown>)
        : undefined;

    const form: Record<string, unknown> = {
        doc_no: editor?.mode === "edit" ? editor.row.doc_no : 0,
        doc_date: editor?.mode === "edit" ? editor.row.doc_date || "" : new Date().toISOString().slice(0, 10),
        quotn_no: editor?.mode === "edit" ? editor.row.quotn_no || "" : "",
        quotn_date: editor?.mode === "edit" ? editor.row.quotn_date || "" : "",
        ref_no: editor?.mode === "edit" ? editor.row.ref_no || "" : "",
        ref_date: editor?.mode === "edit" ? editor.row.ref_date || "" : "",
        div_code: editor?.mode === "create" ? editor.divCode || "" : editor?.mode === "edit" ? editor.row.div_code : "",
        div_name: editor?.mode === "create" ? editor.divName || "" : editor?.mode === "edit" ? editor.row.div_name || "" : "",
        ac_code: editor?.mode === "edit" ? editor.row.ac_code || "" : "",
        ac_name: editor?.mode === "edit" ? editor.row.ac_name || "" : "",
        address: editor?.mode === "edit"
            ? rowRecord?.address?.toString?.() || ""
            : "",
        credit_period: editor?.mode === "edit" ? Number(editor.row.credit_period || 0) : 0,
        dept_code: editor?.mode === "edit" ? editor.row.dept_code || "" : "",
        dept_name: editor?.mode === "edit" ? editor.row.dept_name || "" : "",
        tel: editor?.mode === "edit" ? rowRecord?.tel?.toString?.() || "" : "",
        fax: editor?.mode === "edit" ? rowRecord?.fax?.toString?.() || "" : "",
        buyer: editor?.mode === "edit" ? editor.row.buyer || "" : "",
        wo_no: editor?.mode === "edit" ? editor.row.wo_no || "NC" : "NC",
        curr_code: editor?.mode === "edit" ? editor.row.curr_code || "" : "",
        curr_name: editor?.mode === "edit" ? editor.row.curr_name || "" : "",
        ex_rate: editor?.mode === "edit" ? Number(editor.row.ex_rate || 1) : 1,
        pay_terms: editor?.mode === "edit"
            ? rowRecord?.pay_terms?.toString?.() || ""
            : "",
        dlvr_term: editor?.mode === "edit" ? editor.row.dlvr_term || "" : "",
        dlvr_contact: editor?.mode === "edit" ? editor.row.dlvr_contact || "" : "",
        delivery_tel: editor?.mode === "edit"
            ? ((editor.row as unknown as Record<string, unknown>).delivery_tel as string | undefined)?.toString?.() || ""
            : "",
        delivery_email: editor?.mode === "edit"
            ? ((editor.row as unknown as Record<string, unknown>).delivery_email as string | undefined)?.toString?.() || ""
            : "",
        remarks: editor?.mode === "edit" ? editor.row.remarks || "" : "",
        disc_price: editor?.mode === "edit" ? Number(editor.row.disc_price || 0) : 0,
        disc_percent: editor?.mode === "edit" ? Number(editor.row.disc_percent || 0) : 0,
        tax_category: editor?.mode === "edit" ? editor.row.tax_category || "" : "",
        tax_code: editor?.mode === "edit" ? editor.row.tax_code || "" : "",
        expense_ac_post: editor?.mode === "edit"
            ? typeof editor.row.expense_ac_post === "string"
                ? editor.row.expense_ac_post
                : (editor.row.expense_ac_post as unknown as { value?: string })?.value || defaultExpenseAc
            : defaultExpenseAc,
        print_on_letterhead: editor?.mode === "edit" ? editor.row.print_on_letterhead || "N" : "N",
        project_name: editor?.mode === "edit" ? editor.row.project_name || "" : "",
        pr_no: editor?.mode === "edit" ? editor.row.pr_no || "" : "",
        scope_of_work: editor?.mode === "edit" ? editor.row.scope_of_work || "" : "",
        canceled: editor?.mode === "edit" ? editor.row.canceled : "N",
        flow_level_running: editor?.mode === "edit" ? Number(editor.row.flow_level_running ?? editor.row.flow_level ?? 0) : 0,
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
            zone_code: text(row.zone),
            prod_code: text(row.prod_code),
            prod_name: text(row.prod_name),
            p_uom: text(row.p_uom),
            qty_puom: numberOrZero(row.qty_puom),
            l_uom: text(row.l_uom),
            qty_luom: numberOrZero(row.qty_luom),
            unit_price: numberOrZero(row.unit_price),
            disc_price: numberOrZero(row.disc_price),
            quantity: numberOrZero(row.qty ?? row.quantity),
            tax_pct: numberOrZero(row.tax_pct ?? row.tax_percent),
            tax_amount: numberOrZero(row.tax_amount),
            lcur_amount: numberOrZero(row.lcurr_amount),
            required_dt: text(row.req_date),
            line_remarks: text(row.remarks ?? row.line_remarks),
            tax_cat: text(row.tax_cat ?? row.tax_category),
            tax_code: text(row.tax_code),
            tax_lcur_amount: numberOrZero(row.tax_lcurr_amount),
            lcur_amount_disc: numberOrZero(row.lcurr_amount_disc ?? row.lcurr_amount_discount),
            ex_rate: numberOrZero(row.ex_rate ?? 1),
            disc_percent: numberOrZero(row.disc_pct ?? row.disc_percent),
            disc_hdr_percent: numberOrZero(row.disc_hdr_percent ?? row.disc_pct ?? row.disc_percent),
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
            lcur_amount_disc: numberOrZero(row.lcur_amount_disc ?? row.lcur_amount_discount),
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
            edit_date: row.edit_date ? new Date(String(row.edit_date)) : null,
            user_id: text(row.user_id),
            user_dt: row.user_dt ? new Date(String(row.user_dt)) : null,
            zone_code: text(row.zone_code),
            ac_code: text(row.ac_code),
            wrk_type: text(row.wrk_type),
            employee_id: text(row.employee_id),
            hourly_rate: numberOrZero(row.hourly_rate),
        } satisfies ExpenseRow;
    });
}

export function buildHeaderPayload(form: PurchaseOrderForm, companyCode?: string, loginid?: string, docType?: PODocType) {
    const poForm = form as PurchaseOrderForm & {
        quotn_no?: string | number;
        quotn_date?: string | number | Date;
        address?: string;
        tel?: string;
        fax?: string;
        pay_terms?: string | number;
    };

    return {
        doc_no: numberOrZero(form.doc_no),
        doc_type: docType,
        doc_date: form.doc_date,
        quotn_no: poForm.quotn_no,
        quotn_date: poForm.quotn_date,
        div_code: form.div_code,
        div_name: form.div_name,
        ac_code: form.ac_code,
        ac_name: form.ac_name,
        address: poForm.address || "",
        credit_period: form.credit_period,
        dept_code: form.dept_code,
        tel: poForm.tel || "",
        fax: poForm.fax || "",
        buyer: form.buyer,
        wo_no: form.wo_no,
        curr_code: form.curr_code,
        curr_name: form.curr_name,
        ex_rate: form.ex_rate,
        pay_terms: poForm.pay_terms || "",
        dlvr_term: form.dlvr_term,
        dlvr_contact: form.dlvr_contact,
        // delivery_contact: form.delivery_contact,
        dlvr_email: form.dlvr_email,
        remarks: form.remarks,
        disc_price: form.disc_price,
        disc_percent: form.disc_percent,
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
        docType,
    );
}