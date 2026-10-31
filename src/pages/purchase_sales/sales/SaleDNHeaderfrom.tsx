import { ReactNode, useEffect, useRef } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";

import { PurchaseOrderForm, SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";
import { lowerRecord, numberOrZero, text } from "./SalesOrderutils";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderLineRow } from "../purchase/Purchaseordertypes";
import { DiscAmountPercentage, TotalDiscAmount } from "../purchase/Purchaseorderutils";
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

export function SalesDNHeaderForm({
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
    calculateDiscount?: (type: "amount" | "percent", value: number) => void;
}) {
    const loginIdOrAdmin = loginid || "ADMIN";
    const discountScope = form.so_discount_scoope || "ITEM";
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// light placeholder on empty date inputs (Chrome/Edge/Safari)
const dateCls = (v?: string | null) =>
    `h-7 text-xs ${v ? "" : "[&::-webkit-datetime-edit]:text-slate-400"}`;
    // phone / fax: digits, + ( ) - and space only, max 20 chars
    const cleanPhone = (v: string) => v.replace(/[^0-9+()\-\s]/g, "").slice(0, 20);
    const emailInvalid = !!form.e_mail && !EMAIL_RE.test(String(form.e_mail).trim());
    const dlvrEmailInvalid = !!form.so_dlvr_email && !EMAIL_RE.test(String(form.so_dlvr_email).trim());

    const lookupValue = (row: Record<string, unknown>, ...fields: string[]) => {
        for (const field of fields) {
            const value = getLookupValue(row, field);
            if (value !== "" && value !== null && value !== undefined) return value;
        }
        return "";
    };
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
        numberOrZero(current.so_disc_hdr_price) === price &&
            numberOrZero(current.so_disc_hdr_percent) === percent
            ? current
            : { ...current, so_disc_hdr_price: price, so_disc_hdr_percent: percent }
    );
}, [qtySignature]);
    return (
        <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
            {/* HEADER SECTION */}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.0fr)_minmax(0,1.4fr)] gap-1.5 p-1.5 items-stretch">

                {/* LEFT COLUMN — Customer Details */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Customer Details" icon={<Building2 size={11} />} gridCols="grid-cols-1" grow>
                        <div className="col-span-5">
                            <LookupField
                                required
                                label="A/c code"
                                value={form.ac_code}
                                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }]}
                                valueField="ac_code"
                                displayFields={["ac_code", "ac_name"]}
                                loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_For_suppier_customer", code1: companyCode, loginid: loginIdOrAdmin })}
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) => setForm((current) => ({
                                    ...current,
                                    ac_code: value,
                                    ac_name: text(getLookupValue(row || {}, "ac_name")),
                                    party_address: text(getLookupValue(row || {}, "address")) || current.party_address,
                                    party_phone: text(getLookupValue(row || {}, "tel")) || current.party_phone,
                                    party_fax: text(getLookupValue(row || {}, "fax")) || current.party_fax,
                                    address1: text(getLookupValue(row || {}, "address1")),
                                    address2: text(getLookupValue(row || {}, "address2")),
                                    address3: text(getLookupValue(row || {}, "address3")),
                                    curr_code: text(getLookupValue(row || {}, "curr_code")) || current.curr_code,
                                    curr_name: text(getLookupValue(row || {}, "curr_name")) || current.curr_name,
                                    dept_code: text(getLookupValue(row || {}, "dept_code")) || current.dept_code,
                                    dept_name: text(getLookupValue(row || {}, "dept_name")) || current.dept_name,
                                    e_mail: text(getLookupValue(row || {}, "e_mail")),
                                    credit_period: numberOrZero(getLookupValue(row || {}, "credit_period")),
                                    credit_amount: numberOrZero(getLookupValue(row || {}, "credit_amount")),
                                }))}
                            />
                        </div>

                        <CField label="Address" className="col-span-5">
                            <Input className="h-7 text-xs" readOnly disabled={headerAndLineDisabled} value={form.address1 || form.party_address || ""} />
                        </CField>
                        <CField label="" className="col-span-5">
                            <Input className="h-7 text-xs" readOnly disabled={headerAndLineDisabled} value={form.address2 || ""} />
                        </CField>
                        <CField label="" className="col-span-5">
                            <Input className="h-7 text-xs" readOnly disabled={headerAndLineDisabled} value={form.address3 || ""} />
                        </CField>
                        <CField label="Tel no" className="col-span-3">
                            <Input className="h-7 text-xs" type="tel" maxLength={20} readOnly disabled={headerAndLineDisabled} value={form.party_phone || ""} />
                        </CField>
                        <CField label="Fax" className="col-span-2">
                            <Input className="h-7 text-xs" type="tel" maxLength={20} readOnly disabled={headerAndLineDisabled} value={form.party_fax || ""} />
                        </CField>

                        <div className="col-span-5 grid grid-cols-3 gap-x-2">
                            <CField label="Email">
                                <Input
                                    className={`h-7 text-xs ${emailInvalid ? "border-destructive" : ""}`}
                                    type="email"
                                    readOnly
                                    maxLength={100}
                                    disabled={headerAndLineDisabled}
                                    value={form.e_mail || ""}
                                />
                                {emailInvalid && <span className="text-[10px] text-destructive">Invalid email</span>}
                            </CField>
                            <CField label="Credit Period">
                                <Input className="h-7 text-xs text-right" inputMode="numeric" readOnly disabled={headerAndLineDisabled} value={form.credit_period ?? ""} />
                            </CField>
                            <CField label="Credit Amount">
                                <Input className="h-7 text-xs text-right" inputMode="decimal" readOnly disabled={headerAndLineDisabled} value={form.credit_amount ?? ""} />
                            </CField>
                        </div>
                    </HeaderBlock>
                </div>

                {/* MIDDLE COLUMN — Other Details */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Other Details" icon={<FileText size={11} />} gridCols="grid-cols-6" grow>
                        <div className="col-span-2">
                            <LookupField
                                label="SO No*"

                                placeholder="SO No"
                                value={String(form.so_doc_no ?? "")}
                                displayValue={String(form.so_doc_no ?? "")}
                                columns={[
                                    { field: "so_doc_no", header: "SDN No" },
                                    { field: "ac_code", header: "A/c Code" },
                                ]}
                                valueField="so_doc_no"
                                displayFields={["so_doc_no"]}
                                loadOptions={async () => {
                                    const options = await getDynamicLookup({
                                        parameter: "PS_SDN_ENTRY_SO_NO_DETAIL",
                                        code1: companyCode,
                                        loginid: loginIdOrAdmin,
                                        code2: form.div_code,
                                        code4: form.ac_code
                                    });
                                    return options.map((option) => ({
                                        ...option,
                                        so_doc_no: lookupValue(option, "so_doc_no", "doc_no", "sorder_doc_no"),
                                        so_payment_terms: lookupValue(option, "so_payment_terms", "payment_terms", "pay_terms"),
                                        total_so_amount: lookupValue(option, "total_so_amount", "so_amount", "total_amount", "amount"),
                                    }));
                                }}
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
                                    const selectedRow = row || {};
                                    const soDocNo = text(lookupValue(selectedRow, "so_doc_no", "doc_no", "sorder_doc_no")) || value;
                                    setForm((current) => ({
                                        ...current,
                                        so_doc_no: soDocNo,
                                        ac_code: text(lookupValue(selectedRow, "ac_code", "ac_code")),
                                        ac_name: text(lookupValue(selectedRow, "ac_name", "ac_name")),
                                        so_doc_date: toDateInputValue(
                                            lookupValue(selectedRow, "so_doc_date", "doc_date")
                                        ),
                                        so_payment_terms: text(
                                            lookupValue(selectedRow, "so_payment_terms", "payment_terms", "pay_terms")
                                        ),
                                        so_dlvr_term: text(
                                            lookupValue(selectedRow, "so_dlvr_term", "dlvr_term", "delivery_term")
                                        ),
                                        total_so_amount: numberOrZero(
                                            lookupValue(selectedRow, "total_so_amount", "so_amount", "total_amount", "amount")
                                        ),
                                        so_remarks: text(getLookupValue(row || {}, "so_remarks")).slice(0, 250),
                                        ref_date: text(getLookupValue(row || {}, "ref_date")),
                                        curr_code: text(getLookupValue(row || {}, "curr_code") || accountRow?.curr_code),
                                        curr_name: text(getLookupValue(row || {}, "curr_name") || accountRow?.curr_name),
                                        dept_code: text(getLookupValue(row || {}, "dept_code") || accountRow?.dept_code),
                                        dept_name: text(getLookupValue(row || {}, "dept_name") || accountRow?.dept_name),
                                        so_ex_rate: numberOrZero(getLookupValue(row || {}, "so_ex_rate")),
                                        other_expense_cost: numberOrZero(getLookupValue(row || {}, "other_expense_cost")),
                                        so_disc_hdr_percent: numberOrZero(getLookupValue(row || {}, "so_disc_hdr_percent")),
                                        so_disc_hdr_price: numberOrZero(getLookupValue(row || {}, "so_disc_hdr_price")),
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
                                        so_dlvr_contact: text(getLookupValue(row || {}, "so_dlvr_contact")),
                                        so_dlvr_email: text(getLookupValue(row || {}, "so_dlvr_email")),
                                        so_dlvr_mobile: text(getLookupValue(row || {}, "so_dlvr_mobile")),
                                        salesman_code: text(getLookupValue(row || {}, "salesman_code")),
                                        zone_code: text(getLookupValue(row || {}, "zone_code")),
                                        so_tx_compntcat_code_1: text(getLookupValue(row || {}, "so_tx_compntcat_code_1")),
                                        so_tx_compntcat_name_1: text(getLookupValue(row || {}, "so_tx_compntcat_name_1")),
                                        so_tx_cat_code: text(getLookupValue(row || {}, "so_tx_cat_code")),
                                        so_tx_cat_name: text(getLookupValue(row || {}, "so_tx_cat_name")),
                                        project_name: text(getLookupValue(row || {}, "project_name")),
                                        pr_no: text(getLookupValue(row || {}, "pr_no")),
                                        scope_of_work: text(getLookupValue(row || {}, "scope_of_work")),
                                        // so_discount_scoope:text(getLookupValue(row || {}, "so_discount_scoope")),
                                        so_tx_compnt_1_expmt: text(getLookupValue(row || {}, "so_tx_compnt_1_expmt")),
                                        so_discount_scoope:
                                            text(getLookupValue(row || {}, "so_discount_scoope")) === "PO"
                                                ? "PO"
                                                : text(getLookupValue(row || {}, "so_discount_scoope")) === "ITEM"
                                                    ? "ITEM"
                                                    : current.discount_scoope || "ITEM",


                                    }));


                                    // Fetch and populate line details — same logic as the lines table
                                    try {
                                        const divCodeForFetch = text(lookupValue(selectedRow, "div_code", "so_div_code")) || form.div_code;

                                        const details = await getDynamicLookup({
                                            parameter: "PS_SDN_ENTRY_SO_NO_DETAIL_DET",
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
                                            so_div_code: text(getLookupValue(item, "so_div_code")),
                                            so_prod_code: text(getLookupValue(item, "so_prod_code")),
                                            so_prod_name: text(getLookupValue(item, "so_prod_name")),
                                            so_p_uom: text(getLookupValue(item, "so_p_uom")),
                                            so_qty_puom: numberOrZero(getLookupValue(item, "so_qty_puom")),
                                            so_l_uom: text(getLookupValue(item, "so_l_uom")),
                                            so_qty_luom: numberOrZero(getLookupValue(item, "so_qty_luom")),
                                            so_unit_price: numberOrZero(getLookupValue(item, "so_unit_price")),
                                            disc_hdr_percent: numberOrZero(getLookupValue(item, "disc_hdr_percent")),
                                            disc_percent: numberOrZero(getLookupValue(item, "disc_percent")),
                                            disc_price: numberOrZero(getLookupValue(item, "disc_price")),
                                            tax_pct: numberOrZero(getLookupValue(item, "tax_pct")),
                                            tax_amount: numberOrZero(getLookupValue(item, "tax_amount")),
                                            lcur_amount: numberOrZero(getLookupValue(item, "lcur_amount")),
                                            required_dt: text(getLookupValue(item, "required_dt")),
                                            line_remarks: text(getLookupValue(item, "remarks")),
                                            tax_cat: text(getLookupValue(item, "tx_cat_code")),
                                            tax_code: text(getLookupValue(item, "tx_compntcat_code_1")),
                                            tax_lcur_amount: numberOrZero(getLookupValue(item, "tx_compnt_lcuramt_1")),
                                            lcur_amount_disc: numberOrZero(getLookupValue(item, "lcur_amount_discounted")),
                                            zone_code: text(getLookupValue(item, "zone_code")),
                                            zone_name: text(getLookupValue(item, "zone_name")),
                                            uom_name: text(getLookupValue(item, "uom_name")),
                                            uom_code: text(getLookupValue(item, "uom_code")),
                                            job_no: text(getLookupValue(item, "job_no")),
                                            dept: text(getLookupValue(item, "dept_code")),
                                            sign_ind: numberOrZero(getLookupValue(item, "sign_ind")),
                                            uppp: numberOrZero(getLookupValue(item, "uppp")),
                                            quantity: numberOrZero(getLookupValue(item, "quantity")),
                                            so_quantity: numberOrZero(getLookupValue(item, "so_quantity")),
                                            ex_rate: numberOrZero(getLookupValue(item, "ex_rate")),
                                            ref_doc_dt: text(lookupValue(selectedRow, "ref_date", "so_ref_date")),
                                            so_zone_code: text(getLookupValue(item, "so_zone_code")),
                                            so_zone_name: text(getLookupValue(item, "so_zone_name")),
                                            serial_no: numberOrZero(getLookupValue(item, "serial_no")),
                                            tx_compnt_perc_1: numberOrZero(getLookupValue(item, "tx_compnt_perc_1")),
                                            sorder_remarks: text(getLookupValue(item, "sorder_remarks"))
                                        }));
                                        console.log("Mapped length:", mappedDetails?.length);
                                        setdetails?.(mappedDetails);
                                    } catch (error) {
                                        console.error("ERROR LOADING SDN DETAILS FROM HEADER:", error);
                                        setdetails?.([]);
                                    }
                                }}
                            />
                        </div>

                        <CField label="SO Date" required className="col-span-2">
                            <Input className={dateCls(form.so_doc_date)} type="date" disabled={headerAndLineDisabled} required value={form.so_doc_date} onChange={(event) => updateField("so_doc_date", event.target.value)} />
                        </CField>

                        <CField label="SO Amount" required className="col-span-2">
                            <Input className="h-7 text-xs text-right" type="text" disabled={headerAndLineDisabled} required value={form.total_so_amount} onChange={(event) => updateField("total_so_amount", event.target.value)} />
                        </CField>

                        <CField label="DN Date" required className="col-span-2">
                            <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(event) => updateField("doc_date", event.target.value)} />
                        </CField>

                        <CField label="Ref Date" className="col-span-2">
                            <Input className={dateCls(form.ref_date)} type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(event) => updateField("ref_date", event.target.value)} />
                        </CField>

                        <CField label="Expense Account" className="col-span-2">
                            <Select className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </CField>

                        <CField label="Payment Terms" className="col-span-6">
                            <Input className="h-7 text-xs" disabled={headerAndLineDisabled} maxLength={250} value={form.so_payment_terms} onChange={(event) => updateField("so_payment_terms", event.target.value)} />
                        </CField>

                        <CField label="Remarks" className="col-span-6">
                            <textarea
                                className="h-[100px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs"
                                disabled={headerAndLineDisabled}
                                maxLength={250}
                                value={form.so_remarks || ""}
                                onChange={(event) => updateField("so_remarks", event.target.value)}
                            />
                        </CField>

                        {/* <div className="col-span-2">
                    <LookupField
                        label="Division *"
                        value={form.div_code}
                        displayValue={form.div_name ? `${form.div_code} - ${form.div_name}` : form.div_code}
                        columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
                        valueField="div_code"
                        displayFields={["div_code", "div_name"]}
                        loadOptions={() => getDynamicLookup({ parameter: "Account_division", code1: companyCode, loginid: loginIdOrAdmin })}
                        disabled={headerAndLineDisabled}
                        onChange={(value, row) => setForm((current) => ({
                            ...current,
                            div_code: value,
                            div_name: text(getLookupValue(row || {}, "div_name")),
                        }))}
                    />
                </div> */}
                    </HeaderBlock>
                </div>

                {/* RIGHT COLUMN — Currency, Delivery Terms, Discount, Tax */}
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
                        <CField label="Delivery Contact Person"><Input className="h-7 text-xs" maxLength={70} disabled={headerAndLineDisabled} value={form.so_dlvr_contact} onChange={(e) => updateField("so_dlvr_contact", e.target.value)} /></CField>
                        <CField label="Delivery Telephone"><Input className="h-7 text-xs" type="tel" disabled={headerAndLineDisabled} value={form.so_dlvr_mobile} maxLength={20} onChange={(e) => updateField("so_dlvr_mobile", cleanPhone(e.target.value))} /></CField>
                        <CField label="Delivery Email Address"><Input className={`h-7 text-xs ${dlvrEmailInvalid ? "border-destructive" : ""}`} type="email" maxLength={100} disabled={headerAndLineDisabled} value={form.so_dlvr_email} onChange={(e) => updateField("so_dlvr_email", e.target.value)} /></CField>
                        <CField label="Delivery Term"><Input className="h-7 text-xs" maxLength={250} disabled={headerAndLineDisabled} value={form.so_dlvr_term} onChange={(e) => updateField("so_dlvr_term", e.target.value)} /></CField>
                    </HeaderBlock>

                    {/* Discount + Tax side by side */}
                    <div className="grid grid-cols-2 gap-1.5 items-stretch flex-1">
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
                                                const seededPercent = DiscAmountPercentage(form as any, rows || []);
                                                setForm((current) => ({
                                                    ...current,
                                                    so_discount_scoope: "PO",
                                                    so_disc_hdr_price: seededPrice,
                                                    so_disc_hdr_percent: seededPercent,
                                                }));
                                            }}
                                        />
                                        Entire SO
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                                        <input
                                            type="radio"
                                            name="discount_scoope"
                                            value="ITEM"
                                            checked={discountScope === "ITEM"}
                                            disabled={headerAndLineDisabled}
                                            onChange={() => setForm((current) => ({ ...current, so_discount_scoope: "ITEM" }))}
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
                                    value={numberOrZero(form.so_disc_hdr_price).toFixed(3)}
                                    onChange={(e) => {
                                        const value = Number(e.target.value || 0);
                                        updateField("so_disc_hdr_price", value);
                                        calculateDiscount?.("amount", value);
                                    }}
                                />
                            </CField>
                            <CField label="Disc %">
                                <Input
                                    className="h-7 text-xs text-right"
                                    type="number"
                                    step="0.001"
                                    disabled={headerAndLineDisabled || discountScope === "ITEM"}
                                    value={numberOrZero(form.so_disc_hdr_percent).toFixed(2)}
                                    onChange={(e) => {
                                        const value = Number(e.target.value || 0);
                                        updateField("so_disc_hdr_percent", value);
                                        calculateDiscount?.("percent", value);
                                    }}
                                />
                            </CField>
                        </HeaderBlock>

                        <HeaderBlock label="Tax" icon={<Receipt size={11} />} gridCols="grid-cols-2">
                            <CField label="Tax Type">
                                <Select className="h-7 text-xs" value={form.so_tx_compnt_1_expmt || "N"} onChange={(e) => {
                                    const taxType = e.target.value;
                                    setForm((current) => ({ ...current, so_tx_compnt_1_expmt: taxType, so_tx_compnt_1_pct: taxType === "S" ? 5 : 0 }));
                                }}
                                    disabled={headerAndLineDisabled}>
                                    <option value="N">No Tax</option><option value="S">Std Tax</option><option value="Z">Zero</option><option value="E">Exempt</option>
                                </Select>
                            </CField>

                            <LookupField
                                label="Tax Category"
                                value={form.so_tx_cat_name
                                    ? `${form.so_tx_cat_code} - ${form.so_tx_cat_name}`
                                    : form.so_tx_cat_code || ""}
                                displayValue={
                                    form.so_tx_cat_name
                                        ? `${form.so_tx_cat_code} - ${form.so_tx_cat_name}`
                                        : form.so_tx_cat_code
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
                                        so_tx_cat_code: text(value).split(" - ")[0].trim(),
                                        so_tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),
                                    }))
                                }
                            />

                            <LookupField
                                label="Tax Code"
                                value={form.so_tx_compntcat_name_1
                                    ? `${form.so_tx_compntcat_code_1} - ${form.so_tx_compntcat_name_1}`
                                    : form.so_tx_compntcat_code_1 || ""}
                                displayValue={
                                    form.so_tx_compntcat_name_1
                                        ? `${form.so_tx_compntcat_code_1} - ${form.so_tx_compntcat_name_1}`
                                        : form.so_tx_compntcat_code_1
                                }
                                columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
                                valueField="tx_compntcat_code"
                                displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
                                loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) => setForm((current) => ({
                                    ...current,
                                    so_tx_compntcat_code_1: value,
                                    so_tx_compntcat_name_1: text(getLookupValue(row || {}, "tx_compntcat_name")),
                                }))}
                            />
                        </HeaderBlock>
                    </div>
                </div>

            </div>
        </div>
    );
}