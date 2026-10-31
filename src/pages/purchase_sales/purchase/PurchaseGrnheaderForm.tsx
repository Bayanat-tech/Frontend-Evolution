import { ReactNode, useEffect, useRef } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";
import { DiscAmountPercentage, lowerRecord, numberOrZero, text, TotalDiscAmount } from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";
import { Building2, FileText, Percent, Receipt, Truck } from "lucide-react";


function HeaderBlock({
    label,
    icon,
    children,
    gridCols = "grid-cols-4",
    grow = false,
}: {
    label: string;
    icon: ReactNode;
    children: ReactNode;
    gridCols?: string;
    grow?: boolean;
}) {
    return (
        <div className={`finance-payment-header-block ${grow ? "flex-1" : ""}`}>
            <div className="finance-section-title">
                <span className="finance-section-icon">{icon}</span>
                <span>{label}</span>
            </div>
            <div className={`grid gap-x-1 gap-y-1 px-2.5 py-1.5 ${gridCols} max-md:grid-cols-1`}>
                {children}
            </div>
        </div>
    );
}
function CompactSection({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={`border-t px-3 py-1.5 first:border-t-0 ${className || ""}`}>
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-foreground">{label}</p>
            <div className="grid grid-cols-8 gap-x-2 gap-y-1 pt-1 max-2xl:grid-cols-6 max-xl:grid-cols-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
                {children}
            </div>
        </div>
    );
}

function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
    return (
        <label className={`field ${className || ""}`}>
            <span className="text-[10px]   font-semibold">
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
            </span>
            {children}
        </label>
    );
}

export function PurchaseGrnHeaderForm({
    form,
    setForm,
    updateField,
    disabled,
    headerAndLineDisabled,
    editMode,
    companyCode,
    loginid,
    docType,
    setdetails,
    rows,
    calculateDiscount
}: {
    form: PurchaseOrderForm;
    setForm: (updater: (current: PurchaseOrderForm) => PurchaseOrderForm) => void;
    updateField: (field: keyof PurchaseOrderForm, value: string | number) => void;
    disabled: boolean;
    headerAndLineDisabled: boolean;
    editMode: boolean;
    companyCode?: string;
    loginid?: string;
    docType: PODocType | SODocType
    setdetails?: (details: any[]) => void;
    rows?: PurchaseOrderLineRow[];
    calculateDiscount: (type: "amount" | "percent", value: number) => void;
}) {
    const loginIdOrAdmin = loginid || "ADMIN";
    const discountScope = form.po_discount_scoope || "ITEM";
    const docTypeUpper = String(docType ?? "").trim().toUpperCase();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// light placeholder on empty date inputs (Chrome/Edge/Safari)
const dateCls = (v?: string | null) =>
    `h-7 text-xs ${v ? "" : "[&::-webkit-datetime-edit]:text-slate-400"}`;
    // phone / fax: digits, + ( ) - and space only, max 20 chars
    const cleanPhone = (v: string) => v.replace(/[^0-9+()\-\s]/g, "").slice(0, 20);

    // whole number only, max 4 digits
    const cleanInt = (v: string, max = 4) => v.replace(/\D/g, "").slice(0, max);

    // positive number, max 3 decimals
    const cleanAmount = (v: string) => {
        const cleaned = v.replace(/[^0-9.]/g, "");
        const [int, ...rest] = cleaned.split(".");
        return rest.length ? `${int}.${rest.join("").slice(0, 3)}` : int;
    };
    const emailInvalid = !!form.e_mail && !EMAIL_RE.test(String(form.e_mail).trim());

    // Keep header discount in sync with the lines (rvd qty changes -> line disc changes -> header changes)
    // Update header discount ONLY when received quantity changes (not on load / other row edits)
    const qtySignature = (rows || []).map((r) => `${r.qty_puom}|${r.qty_luom}`).join(",");
    const prevQtySignature = useRef<string | null>(null);

    useEffect(() => {
        if (!rows || rows.length === 0) return;
        // first time we see loaded rows: remember the quantities, don't touch the header
        if (prevQtySignature.current === null || prevQtySignature.current === qtySignature) {
            prevQtySignature.current = qtySignature;
            return;
        }
        prevQtySignature.current = qtySignature;

        const price = TotalDiscAmount(rows);
        const percent = DiscAmountPercentage(form, rows);
        setForm((current) =>
            numberOrZero(current.po_disc_hdr_price) === price &&
                numberOrZero(current.po_disc_hdr_percent) === percent
                ? current
                : { ...current, po_disc_hdr_price: price, po_disc_hdr_percent: percent }
        );
    }, [qtySignature]);
    return (
        <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
            {/* HEADER SECTION - HEIGHT UNCHANGED */}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.0fr)_minmax(0,1.4fr)] gap-1.5 p-1.5 items-stretch">

                {/* LEFT COLUMN — Supplier Details */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Supplier Details" icon={<Building2 size={11} />} gridCols="grid-cols-1" grow>
                        <div className="col-span-5">
                            <LookupField
                                label="Supplier*"
                                value={form.ac_code}
                                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }]}
                                valueField="ac_code"
                                displayFields={["ac_code", "ac_name"]}
                                loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_For_suppier_customer", code1: companyCode, loginid: loginIdOrAdmin })}
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) =>
                                    setForm((current) => ({
                                        ...current,

                                        ac_code: value,
                                        ac_name: text(getLookupValue(row || {}, "ac_name")),
                                        address1: text(getLookupValue(row || {}, "address1")),
                                        address2: text(getLookupValue(row || {}, "address2")),
                                        address3: text(getLookupValue(row || {}, "address3")),
                                        party_phone: text(getLookupValue(row || {}, "party_phone")),
                                        party_fax: text(getLookupValue(row || {}, "party_fax")),
                                        curr_code: text(getLookupValue(row || {}, "curr_code")),
                                        dept_code: text(getLookupValue(row || {}, "dept_code")),
                                        e_mail: text(getLookupValue(row || {}, "e_mail")),
                                        prin_name: text(getLookupValue(row || {}, "prin_name")),
                                        curr_name: text(getLookupValue(row || {}, "curr_name")),
                                        dept_name: text(getLookupValue(row || {}, "dept_name")),
                                        credit_period: numberOrZero(getLookupValue(row || {}, "credit_period")),
                                        credit_amount: numberOrZero(getLookupValue(row || {}, "credit_amount")),
                                    }))
                                }
                            />
                        </div>

                        <CField label="Address" className="col-span-5">
                            <Input className="h-7 text-xs" readOnly={true} disabled={headerAndLineDisabled} value={form.address1} onChange={(e) => updateField("address1", e.target.value)} />
                        </CField>
                        <CField label="" className="col-span-5">
                            <Input className="h-7 text-xs" readOnly={true} disabled={headerAndLineDisabled} value={form.address2} onChange={(e) => updateField("address2", e.target.value)} />
                        </CField>
                        <CField label="" className="col-span-5">
                            <Input className="h-7 text-xs" readOnly={true} disabled={headerAndLineDisabled} value={form.address3} onChange={(e) => updateField("address3", e.target.value)} />
                        </CField>
                        <CField label="Tel no" className="col-span-3">
                            <Input
                                className="h-7 text-xs"
                                type="tel"
                                maxLength={20}
                                readOnly={true}
                                disabled={headerAndLineDisabled}
                                value={form.party_phone || ""}
                                onChange={(e) => updateField("party_phone", cleanPhone(e.target.value))}
                            />
                        </CField>
                        <CField label="Fax" className="col-span-2">
                            <Input
                                className="h-7 text-xs"
                                type="tel"
                                maxLength={20}
                                readOnly={true}
                                disabled={headerAndLineDisabled}
                                value={form.party_fax || ""}
                                onChange={(e) => updateField("party_fax", cleanPhone(e.target.value))}
                            />
                        </CField>

                        <div className="col-span-5 grid grid-cols-3 gap-x-2">
                            <CField label="Email">
                                <Input
                                    className={`h-7 text-xs ${emailInvalid ? "border-destructive" : ""}`}
                                    type="email"
                                    readOnly={true}
                                    maxLength={100}
                                    disabled={headerAndLineDisabled}
                                    value={form.e_mail || ""}
                                    onChange={(e) => updateField("e_mail", e.target.value.trim())}
                                />
                                {emailInvalid && <span className="text-[10px] text-destructive">Invalid email</span>}
                            </CField>

                            <CField label="Credit Period">
                                <Input
                                    className="h-7 text-xs text-right"
                                    inputMode="numeric"
                                    readOnly={true}
                                    disabled={headerAndLineDisabled}
                                    value={form.credit_period ?? ""}
                                    onChange={(e) => updateField("credit_period", cleanInt(e.target.value))}
                                />
                            </CField>
                            <CField label="Credit Amount">
                                <Input
                                    className="h-7 text-xs text-right"
                                    inputMode="decimal"
                                    readOnly={true}
                                    disabled={headerAndLineDisabled}
                                    value={form.credit_amount ?? ""}
                                    onChange={(e) => updateField("credit_amount", cleanAmount(e.target.value))}
                                />
                            </CField>
                        </div>

                        {/* <CField label="Account" className="col-span-3">
              <Select className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </CField> */}
                    </HeaderBlock>
                </div>
                {/* MIDDLE COLUMN — Other Details */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Other Details" icon={<FileText size={11} />} gridCols="grid-cols-6" grow>
                        {/* <CField label="Doc No" className="col-span-2"><Input className="h-7 text-xs" disabled value={form.doc_no || ""} /></CField> */}
                        <CField label="Doc Date" required className="col-span-2">
                            <Input className={dateCls(form.doc_date)} type="date" disabled={headerAndLineDisabled} value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
                        </CField>

                        {(String(docType ?? "").trim().toUpperCase() === "GRN" &&
                            <div className="col-span-2">
                                <LookupField
                                    required
                                    label="PO No*"

                                    placeholder="PO No"
                                    value={String(form.po_doc_no ?? "")}
                                    displayValue={String(form.po_doc_no ?? "")}
                                    columns={[
                                        { field: "po_doc_no", header: "GRN No" },
                                        { field: "ac_code", header: "A/c Code" },
                                    ]}
                                    valueField="po_doc_no"
                                    displayFields={["po_doc_no"]}
                                    loadOptions={() =>
                                        getDynamicLookup({
                                            parameter: "PS_GRN_ENTRY_PO_NO_DETAIL",
                                            code1: companyCode,
                                            loginid: loginIdOrAdmin,
                                            code2: form.div_code,
                                            code4: form.ac_code
                                        })
                                    }
                                    disabled={disabled}
                                    onChange={async (value, row) => {
                                        const selectedAcCode = text(getLookupValue(row || {}, "ac_code"));
                                        let accountRow: Record<string, unknown> | undefined;
                                        if (selectedAcCode) {
                                            try {
                                                const accountRows = await getDynamicLookup({
                                                    parameter: "Account_AC_CODE_Serach_For_suppier_customer",
                                                    code1: companyCode,
                                                    loginid: loginIdOrAdmin,
                                                });
                                                accountRow = (accountRows || [])
                                                    .map((account) => lowerRecord(account as Record<string, unknown>))
                                                    .find((account) => text(account.ac_code).trim().toUpperCase() === selectedAcCode.trim().toUpperCase());
                                            } catch {
                                                accountRow = undefined;
                                            }
                                        }
                                        setForm((current) => ({
                                            ...current,
                                            po_doc_no: value,
                                            ac_code: text(getLookupValue(row || {}, "ac_code")),
                                            ac_name: text(getLookupValue(row || {}, "ac_name")),
                                            po_doc_date: toDateInputValue(getLookupValue(row || {}, "po_doc_date")),
                                            po_dlvr_term: text(getLookupValue(row || {}, "po_dlvr_term")),
                                            total_po_amount: numberOrZero(getLookupValue(row || {}, "total_po_amount")),
                                            po_remarks: text(getLookupValue(row || {}, "po_remarks")).slice(0, 250),
                                            ref_date: text(getLookupValue(row || {}, "ref_date")),
                                            curr_code: text(getLookupValue(row || {}, "curr_code") || accountRow?.curr_code),
                                            curr_name: text(getLookupValue(row || {}, "curr_name") || accountRow?.curr_name),
                                            dept_code: text(getLookupValue(row || {}, "dept_code") || accountRow?.dept_code),
                                            dept_name: text(getLookupValue(row || {}, "dept_name") || accountRow?.dept_name),
                                            po_ex_rate: numberOrZero(getLookupValue(row || {}, "po_ex_rate")),
                                            other_expense_cost: numberOrZero(getLookupValue(row || {}, "other_expense_cost")),
                                            po_disc_hdr_percent: numberOrZero(getLookupValue(row || {}, "po_disc_hdr_percent")),
                                            po_disc_hdr_price: numberOrZero(getLookupValue(row || {}, "po_disc_hdr_price")),
                                            po_payment_terms: text(getLookupValue(row || {}, "po_payment_terms")).slice(0, 250),
                                            credit_period: numberOrZero(getLookupValue(row || {}, "credit_period") || accountRow?.credit_period),
                                            due_date: getLookupValue(row || {}, "due_date"),
                                            party_name: text(getLookupValue(row || {}, "party_name")),
                                            party_address: text(getLookupValue(row || {}, "party_address")),
                                            address1: text(getLookupValue(row || {}, "address1") || accountRow?.address1),
                                            address2: text(getLookupValue(row || {}, "address2") || accountRow?.address2),
                                            address3: text(getLookupValue(row || {}, "address3") || accountRow?.address3),
                                            e_mail: text(getLookupValue(row || {}, "e_mail") || accountRow?.e_mail),
                                            credit_amount: numberOrZero(getLookupValue(row || {}, "credit_amount") || accountRow?.credit_amount),
                                            prin_name: text(getLookupValue(row || {}, "prin_name") || accountRow?.prin_name),

                                            party_phone: text(getLookupValue(row || {}, "party_phone")),
                                            party_fax: text(getLookupValue(row || {}, "party_fax")),
                                            delivery_to: text(getLookupValue(row || {}, "delivery_to")),
                                            po_dlvr_contact: text(getLookupValue(row || {}, "po_dlvr_contact")),
                                            po_dlvr_email: text(getLookupValue(row || {}, "po_dlvr_email")),
                                            po_dlvr_mobile: text(getLookupValue(row || {}, "po_dlvr_mobile")),
                                            salesman_code: text(getLookupValue(row || {}, "salesman_code")),
                                            zone_code: text(getLookupValue(row || {}, "zone_code")),
                                            po_tx_compntcat_code_1: text(getLookupValue(row || {}, "po_tx_compntcat_code_1")),
                                            po_tx_compntcat_name_1: text(getLookupValue(row || {}, "po_tx_compntcat_name_1")),
                                            po_tx_cat_code: text(getLookupValue(row || {}, "po_tx_cat_code")),
                                            po_tx_cat_name: text(getLookupValue(row || {}, "po_tx_cat_name")),
                                            project_name: text(getLookupValue(row || {}, "project_name")),
                                            pr_no: text(getLookupValue(row || {}, "pr_no")),
                                            scope_of_work: text(getLookupValue(row || {}, "scope_of_work")),
                                            // po_discount_scoope:text(getLookupValue(row || {}, "po_discount_scoope")),
                                            po_tx_compnt_1_expmt: text(getLookupValue(row || {}, "po_tx_compnt_1_expmt")),
                                            po_discount_scoope:
                                                text(getLookupValue(row || {}, "po_discount_scoope")) === "PO"
                                                    ? "PO"
                                                    : text(getLookupValue(row || {}, "po_discount_scoope")) === "ITEM"
                                                        ? "ITEM"
                                                        : current.discount_scoope || "ITEM",


                                        }));
                                        // Fetch and populate line details — same logic as the lines table
                                        try {
                                            const divCodeForFetch = text(getLookupValue(row || {}, "div_code")) || form.div_code;

                                            const details = await getDynamicLookup({
                                                parameter: "PS_GRN_ENTRY_PO_NO_DETAIL_DET",
                                                code1: companyCode,
                                                code2: divCodeForFetch,
                                                code3: value,
                                            });

                                            const mappedDetails = (details || []).map((item: any, index: number) => ({

                                                id: `${value}-${index + 1}`,
                                                div_code: text(getLookupValue(item, "div_code")),
                                                prod_code: text(getLookupValue(item, "prod_code")),
                                                prod_name: text(getLookupValue(item, "prod_name")),
                                                p_uom: text(getLookupValue(item, "p_uom")),
                                                qty_puom: numberOrZero(getLookupValue(item, "qty_puom")),
                                                l_uom: text(getLookupValue(item, "l_uom")),
                                                qty_luom: numberOrZero(getLookupValue(item, "qty_luom")),
                                                unit_price: numberOrZero(getLookupValue(item, "unit_price")),
                                                po_div_code: text(getLookupValue(item, "po_div_code")),
                                                po_prod_code: text(getLookupValue(item, "po_prod_code")),
                                                po_prod_name: text(getLookupValue(item, "po_prod_name")),
                                                po_p_uom: text(getLookupValue(item, "po_p_uom")),
                                                po_qty_puom: numberOrZero(getLookupValue(item, "po_qty_puom")),
                                                po_l_uom: text(getLookupValue(item, "po_l_uom")),
                                                po_qty_luom: numberOrZero(getLookupValue(item, "po_qty_luom")),
                                                po_unit_price: numberOrZero(getLookupValue(item, "po_unit_price")),
                                                po_disc_hdr_percent: numberOrZero(getLookupValue(item, "po_disc_hdr_percent")),
                                                disc_percent: numberOrZero(getLookupValue(item, "disc_percent")),
                                                disc_price: numberOrZero(getLookupValue(item, "disc_price")),
                                                po_tax_pct: numberOrZero(getLookupValue(item, "po_tax_pct")),
                                                po_tax_amount: numberOrZero(getLookupValue(item, "po_tax_amount")),
                                                po_lcur_amount: numberOrZero(getLookupValue(item, "po_lcur_amount")),
                                                po_required_dt: text(getLookupValue(item, "po_required_dt")),
                                                po_line_remarks: text(getLookupValue(item, "po_remarks")),
                                                po_tax_cat: text(getLookupValue(item, "po_tx_cat_code")),
                                                po_tax_code: text(getLookupValue(item, "po_tx_compntcat_code_1")),
                                                po_amount: numberOrZero(getLookupValue(item, "po_amount")),
                                                po_tax_lcur_amount: numberOrZero(getLookupValue(item, "po_tx_compnt_lcuramt_1")),
                                                po_lcur_amount_disc: numberOrZero(getLookupValue(item, "po_lcur_amount_discounted")),
                                                po_zone_code: text(getLookupValue(item, "po_zone_code")),
                                                po_zone_name: text(getLookupValue(item, "po_zone_name")),
                                                po_uom_name: text(getLookupValue(item, "po_uom_name")),
                                                po_uom_code: text(getLookupValue(item, "po_uom_code")),
                                                po_job_no: text(getLookupValue(item, "po_job_no")),
                                                po_dept: text(getLookupValue(item, "po_dept_code")),
                                                po_sign_ind: numberOrZero(getLookupValue(item, "po_sign_ind")),
                                                uppp: numberOrZero(getLookupValue(item, "uppp")),
                                                po_quantity: numberOrZero(getLookupValue(item, "po_quantity")),
                                                po_po_quantity: numberOrZero(getLookupValue(item, "po_po_quantity")),
                                                po_ex_rate: numberOrZero(getLookupValue(item, "po_ex_rate")),
                                                po_ref_doc_dt: text(getLookupValue(row || {}, "po_ref_date")),
                                                zone_code: text(getLookupValue(item, "zone_code")),
                                                zone_name: text(getLookupValue(item, "zone_name")),
                                                serial_no: numberOrZero(getLookupValue(item, "serial_no")),
                                                tx_compnt_perc_1: numberOrZero(getLookupValue(item, "tx_compnt_perc_1")),
                                                po_disc_percent: numberOrZero(getLookupValue(item, "po_disc_percent")),
                                                po_disc_price: numberOrZero(getLookupValue(item, "po_disc_price")),
                                            }));
                                            console.log("Mapped length:", mappedDetails?.length);
                                            setdetails?.(mappedDetails);
                                        } catch (error) {
                                            console.error("ERROR LOADING GRN DETAILS FROM HEADER:", error);
                                            setdetails?.([]);
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {(docTypeUpper === "SO" || docTypeUpper === "PQO") && (
                            <CField label="Reference No" className="col-span-2">
                                <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} value={form.ref_no || ""} onChange={(e) => updateField("ref_no", e.target.value)} />
                            </CField>
                        )}
                        {docTypeUpper === "PQO" && (<CField label="Purchase Req No" className="col-span-2">
                            <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} value={form.pr_req_no} onChange={(e) => updateField("pr_req_no", e.target.value)} />
                        </CField>)}

                        <CField label="Ref Date" className="col-span-2">
                            <Input className={dateCls(form.ref_date)} type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(e) => updateField("ref_date", e.target.value)} />
                        </CField>

                        {docTypeUpper === "LPO" && (
                            <>
                                <CField label="Buyer" className="col-span-2"><Input className="h-7 text-xs" maxLength={50} disabled={headerAndLineDisabled} value={form.buyer} onChange={(e) => updateField("buyer", e.target.value)} /></CField>
                                <CField label="WO No" className="col-span-2"><Input className="h-7 text-xs" maxLength={50} disabled={headerAndLineDisabled} value={form.wo_number} onChange={(e) => updateField("wo_number", e.target.value)} /></CField>
                            </>
                        )}

                        {docTypeUpper !== "JO" && (<CField label="Expense Account" className="col-span-2">
                            <Select className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </CField>)}
                        {docTypeUpper === "LPO" && (
                            <>
                                <CField label="Project Name" className="col-span-2" ><Input className="h-7 text-xs" maxLength={200} disabled={headerAndLineDisabled} value={form.project_name} onChange={(e) => updateField("project_name", e.target.value)} /></CField>
                                <CField label="PR No" className="col-span-2"><Input className="h-7 text-xs text-right" maxLength={200} disabled={headerAndLineDisabled} value={form.pr_no} onChange={(e) => updateField("pr_no", e.target.value)} /></CField>
                                <CField label="Scope of Work" className="col-span-2"><Input className="h-7 text-xs" maxLength={200} disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(e) => updateField("scope_of_work", e.target.value)} /></CField>
                            </>
                        )}
                        <CField
                            label="Payment Terms"
                            className={String(docType ?? "").trim().toUpperCase() === "LPO" ? "col-span-4" : "col-span-6"}
                        >
                            <Input className="h-7 text-xs" disabled={headerAndLineDisabled} maxLength={250} value={form.po_payment_terms} onChange={(e) => updateField("po_payment_terms", e.target.value)} />
                        </CField>

                        <CField label="Remarks" className="col-span-6">
                            <textarea
                                className={`${String(docType ?? "").trim().toUpperCase() === "LPO" ? "h-[70px]" : "h-[100px]"} w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs`}
                                disabled={headerAndLineDisabled}
                                maxLength={250}
                                value={form.po_remarks || ""}
                                onChange={(e) => updateField("remarks", e.target.value)}
                            />
                        </CField>
                    </HeaderBlock>
                </div>
                {/* RIGHT COLUMN — Reference Details, Delivery Terms, Discount, Tax */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Currency & Department" icon={<FileText size={11} />} gridCols="grid-cols-3">
                        <LookupField
                            label="Currency *"
                            value={form.curr_code}
                            displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
                            columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                            valueField="curr_code"
                            displayFields={["curr_code", "curr_name"]}
                            loadOptions={() => getDynamicLookup({ parameter: "Account_Currency_CODE_Serach", code1: companyCode, loginid: loginIdOrAdmin })}
                            disabled={headerAndLineDisabled}
                            onChange={(value, row) => setForm((current) => ({
                                ...current,
                                curr_code: value,
                                curr_name: text(getLookupValue(row || {}, "curr_name")),
                                ex_rate: Number(getLookupValue(row || {}, "ex_rate") || (row as any)?.ex_rate || current.ex_rate || 1),
                            }))}
                        />
                        <CField label="Ex Rate">
                            <Input
                                className="h-7 text-xs text-right"
                                type="number"
                                disabled={headerAndLineDisabled}
                                step="0.000001"
                                value={form.ex_rate}
                                onChange={(e) => updateField("ex_rate", Number(e.target.value || 1))}
                            />
                        </CField>
                        <LookupField
                            label="Department"
                            value={form.dept_code || ""}
                            displayValue={form.dept_name ? `${form.dept_code} - ${form.dept_name}` : form.dept_code}
                            columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Name" }]}
                            valueField="dept_code"
                            displayFields={["dept_code", "dept_name"]}
                            loadOptions={() => getDynamicLookup({ parameter: "DROP_DOWN_DEPT_BASED_ON_DIV", code1: companyCode, code2: form.div_code, loginid: loginIdOrAdmin })}
                            disabled={headerAndLineDisabled}
                            onChange={(value, row) => setForm((current) => ({ ...current, dept_code: value, dept_name: text(getLookupValue(row || {}, "dept_name")) }))}
                        />

                    </HeaderBlock>

                    <HeaderBlock label="Delivery Terms" icon={<Truck size={11} />} gridCols="grid-cols-4">
                        {(docTypeUpper === "LPO" || docTypeUpper === "SO" || docTypeUpper === "PQO" || docTypeUpper === "JO" || docTypeUpper === "GRN") && (
                            <>
                                <CField label="Delivery Contact Person"><Input className="h-7 text-xs" maxLength={70} disabled={headerAndLineDisabled} value={form.po_dlvr_contact} onChange={(e) => updateField("po_dlvr_contact", e.target.value)} /></CField>
                                {(docTypeUpper === "JO" && <CField label="Delivery Date" ><Input className={dateCls(form.dlvr_date)} type="date" disabled={headerAndLineDisabled} value={form.dlvr_date} onChange={(e) => updateField("dlvr_date", e.target.value)} /></CField>)}
                                <CField label="Delivery Telephone"><Input className="h-7 text-xs" type="tel" disabled={headerAndLineDisabled} value={form.po_dlvr_mobile} maxLength={20} onChange={(e) => updateField("po_dlvr_mobile", cleanPhone(e.target.value))} /></CField>
                                <CField label="Delivery Email Address"><Input className={`h-7 text-xs ${emailInvalid ? "border-destructive" : ""}`} type="email" maxLength={100} disabled={headerAndLineDisabled} value={form.po_dlvr_email} onChange={(e) => updateField("po_dlvr_email", (e.target.value))} /></CField>
                                <CField label="Delivery Term"><Input className="h-7 text-xs" maxLength={250} disabled={headerAndLineDisabled} value={form.po_dlvr_term} onChange={(e) => updateField("po_dlvr_term", e.target.value)} /></CField>
                            </>
                        )}
                    </HeaderBlock>

                    {/* Discount + Tax side by side */}
                    <div className={`grid grid-cols-2 gap-1.5 items-stretch ${docTypeUpper === "LPO" ? "" : "flex-1"}`}>
                        <HeaderBlock label="Discount" icon={<Percent size={11} />} gridCols="grid-cols-2">
                            <div className="col-span-2 flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold">Discount Applied To</span>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                                        <input
                                            type="radio"
                                            name="discount_scoope"
                                            value="PO"
                                            checked={discountScope === "PO"}
                                            disabled={headerAndLineDisabled}
                                            onChange={() => {
                                                const seededPrice = TotalDiscAmount(rows || []);
                                                const seededPercent = DiscAmountPercentage(form, rows || []);
                                                setForm((current) => ({
                                                    ...current,
                                                    po_discount_scoope: "PO",
                                                    po_disc_hdr_price: seededPrice,
                                                    po_disc_hdr_percent: seededPercent,
                                                }));
                                            }}
                                        />
                                        Entire PO
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                                        <input
                                            type="radio"
                                            name="discount_scoope"
                                            value="ITEM"
                                            checked={discountScope === "ITEM"}
                                            disabled={headerAndLineDisabled}
                                            onChange={() => setForm((current) => ({ ...current, po_discount_scoope: "ITEM" }))}
                                        />
                                        Individual Items
                                    </label>
                                </div>
                            </div>

                            <CField label="Disc Amt">
                                <Input
                                    className="h-7 text-xs text-right"
                                    type="number"
                                    step="0.01"
                                    disabled={headerAndLineDisabled || discountScope === "ITEM"}
                                    value={numberOrZero(form.po_disc_hdr_price).toFixed(3)}
                                    onChange={(e) => {
                                        const value = Number(e.target.value || 0);
                                        updateField("po_disc_hdr_price", value);
                                        calculateDiscount("amount", value);
                                    }}
                                />
                            </CField>
                            <CField label="Disc %">
                                <Input
                                    className="h-7 text-xs text-right"
                                    type="number"
                                    step="0.001"
                                    disabled={headerAndLineDisabled || discountScope === "ITEM"}
                                    value={numberOrZero(form.po_disc_hdr_percent).toFixed(2)}
                                    onChange={(e) => {
                                        const value = Number(e.target.value || 0);
                                        updateField("po_disc_hdr_percent", value);
                                        calculateDiscount("percent", value);
                                    }}
                                />
                            </CField>
                        </HeaderBlock>

                        <HeaderBlock label="Tax" icon={<Receipt size={11} />} gridCols="grid-cols-2">
                            <CField label="Tax Type">
                                <Select className="h-7 text-xs" value={form.po_tx_compnt_1_expmt || "N"} onChange={(e) => {
                                    const taxType = e.target.value;
                                    setForm((current) => ({ ...current, po_tx_compnt_1_expmt: taxType, po_tx_compnt_1_pct: taxType === "S" ? 5 : 0 }));
                                }}
                                    disabled={headerAndLineDisabled}>
                                    <option value="N">No Tax</option><option value="S">Std Tax</option><option value="Z">Zero</option><option value="E">Exempt</option>
                                </Select>
                            </CField>

                            <LookupField
                                label="Tax Category"
                                value={form.po_tx_cat_name
                                    ? `${form.po_tx_cat_code} - ${form.po_tx_cat_name}`
                                    : form.po_tx_cat_code || ""}
                                displayValue={
                                    form.po_tx_cat_name
                                        ? `${form.po_tx_cat_code} - ${form.po_tx_cat_name}`
                                        : form.po_tx_cat_code
                                }
                                columns={[
                                    { field: "tx_cat_code", header: "Code" },
                                    { field: "tx_cat_name", header: "Name" }
                                ]}
                                valueField="tx_cat_code"
                                displayFields={["tx_cat_code", "tx_cat_name"]}
                                loadOptions={() =>
                                    getDynamicLookup({
                                        parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CATEGORY",
                                        code1: companyCode,
                                        loginid: loginIdOrAdmin
                                    })
                                }
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) =>
                                    setForm((current) => ({
                                        ...current,
                                        po_tx_cat_code: text(value).split(" - ")[0].trim(),
                                        po_tx_cat_name: text(getLookupValue(row || {}, "po_tx_cat_name")),
                                    }))
                                }
                            />

                            <LookupField
                                label="Tax Code"
                                value={form.po_tx_compntcat_name_1
                                    ? `${form.po_tx_compntcat_code_1} - ${form.po_tx_compntcat_name_1}`
                                    : form.po_tx_compntcat_code_1 || ""}
                                displayValue={
                                    form.tx_compntcat_name_1
                                        ? `${form.po_tx_compntcat_code_1} - ${form.po_tx_compntcat_name_1}`
                                        : form.po_tx_compntcat_code_1
                                }
                                columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
                                valueField="tx_compntcat_code"
                                displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
                                loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
                                disabled={headerAndLineDisabled}
                                onChange={(value) => setForm((current) => ({ ...current, po_tx_compntcat_code_1: value }))}
                            />
                        </HeaderBlock>
                    </div>

                    {/* Project & Scope (LPO only) */}
                    {/* {docTypeUpper === "LPO" && (
            <HeaderBlock label="Project & Scope" icon={<Briefcase size={11} />} gridCols="grid-cols-2">
              <CField label="Project Name"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.project_name} onChange={(e) => updateField("project_name", e.target.value)} /></CField>
              <CField label="Scope of Work"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(e) => updateField("scope_of_work", e.target.value)} /></CField>
            </HeaderBlock>
          )} */}
                </div>

            </div>
        </div>
    );
}