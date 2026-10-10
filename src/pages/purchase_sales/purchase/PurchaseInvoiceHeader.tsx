import { ReactNode } from "react";
import { Briefcase, Building2, FileText, Percent, Receipt, Truck } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";
import { DiscAmountPercentage, lowerRecord, numberOrZero, text, TotalDiscAmount } from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";

// Group block — finance-payment-header-block > finance-section-title (icon + label) > fields.
function HeaderBlock({
    label,
    icon,
    children,
    gridCols = "grid-cols-2",
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
            <div className="finance-section-title flex items-center">
                <span className="finance-section-icon">{icon}</span>
                <span>{label}</span>
            </div>
            <div className={`grid gap-x-2 gap-y-1 px-2.5 py-1.5 ${gridCols} max-md:grid-cols-1`}>
                {children}
            </div>
        </div>
    );
}

// Label above the control (as in the reference design).
function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
    return (
        <label className={`field flex flex-col gap-0.5 ${className || ""}`}>
            <span className="text-[10px] font-semibold">
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </span>
            {children}
        </label>
    );
}

export function PurchaseInvoiceHeaderForm({
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
    calculateDiscount,
    rows,

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
    calculateDiscount: (type: "amount" | "percent", value: number) => void;
    rows?: PurchaseOrderLineRow[];
}) {
    const loginIdOrAdmin = loginid || "ADMIN";

    const discountScope = form.discount_scoope || "ITEM";
    const docTypeUpper = String(docType ?? "").trim().toUpperCase();

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const emailInvalid = !!form.e_mail && !EMAIL_RE.test(String(form.e_mail).trim());

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

    return (
        <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
            {/* THREE COLUMNS (same as PO header):
                left   = Supplier Details
                middle = Other Details
                right  = Currency & Department, Delivery Terms, Discount, Tax, Project & Scope */}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.0fr)_minmax(0,1.4fr)] gap-1.5 p-1.5 items-stretch">

                {/* LEFT COLUMN — Supplier Details */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Supplier Details" icon={<Building2 size={11} />} gridCols="grid-cols-1" grow>
                        <div className="col-span-5">
                            <LookupField
                                label="Supplier*"
                                value={form.ac_code}
                                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "address", header: "Address" }, { field: "tel", header: "Tel" }, { field: "fax", header: "Fax" }]}
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
                                        party_phone: text(
                                            getLookupValue(row || {}, "party_phone")
                                        ),

                                        party_fax: text(
                                            getLookupValue(row || {}, "party_fax")
                                        ),

                                        curr_code: text(
                                            getLookupValue(row || {}, "curr_code")
                                        ),
                                        curr_name: text(
                                            getLookupValue(row || {}, "curr_name")
                                        ),
                                        dept_name: text(
                                            getLookupValue(row || {}, "dept_name")
                                        ),

                                        dept_code: text(
                                            getLookupValue(row || {}, "dept_code")
                                        ),
                                        e_mail: text(getLookupValue(row || {}, "e_mail")),
                                        prin_name: text(getLookupValue(row || {}, "prin_name")),
                                        credit_period: numberOrZero(getLookupValue(row || {}, "credit_period")),
                                        credit_amount: numberOrZero(getLookupValue(row || {}, "credit_amount")),
                                    }))
                                }
                            />
                        </div>

                        <CField label="Address" className="col-span-5">
                            <Input className="h-7 text-xs"  readOnly={true} disabled={headerAndLineDisabled} value={form.address1} onChange={(e) => updateField("address1", e.target.value)} />
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
                                 readOnly={true}
                                maxLength={20}
                                disabled={headerAndLineDisabled}
                                value={form.po_party_phone || ""}
                                onChange={(e) => updateField("po_party_phone", cleanPhone(e.target.value))}
                            />
                        </CField>
                        <CField label="Fax" className="col-span-2">
                            <Input
                                className="h-7 text-xs"
                                type="tel"
                                 readOnly={true}
                                maxLength={20}
                                disabled={headerAndLineDisabled}
                                value={form.po_party_fax || ""}
                                onChange={(e) => updateField("po_party_fax", cleanPhone(e.target.value))}
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
                    </HeaderBlock>
                </div>

                {/* MIDDLE COLUMN — Other Details */}
                <div className="flex flex-col gap-1.5">
                    <HeaderBlock label="Other Details" icon={<FileText size={11} />} gridCols="grid-cols-6" grow>
                        {/* <CField label="Doc No" className="col-span-2">
                            <Input className="h-7 text-xs" disabled value={form.pi_doc_no || ""} placeholder={editMode ? "" : "Auto"} />
                        </CField> */}
                        <CField label="Doc Date" required className="col-span-2">
                            <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
                        </CField>

                        {(docTypeUpper === "PIN" || docTypeUpper === "SIN") && (
                            <div className="col-span-2">
                                <LookupField
                                    label="GRN No"
                                    placeholder="GRN No"
                                    value={String(form.grn_doc_no ?? "")}
                                    displayValue={String(form.grn_doc_no ?? "")}
                                    columns={[
                                        { field: "doc_no", header: "GRN No" },
                                        { field: "ac_code", header: "A/c Code" },
                                    ]}
                                    valueField="doc_no"
                                    displayFields={["doc_no"]}
                                    loadOptions={() =>
                                        getDynamicLookup({
                                            parameter: "PS_INVOICE_ENTRY_GRN_NO_DETAIL",
                                            code1: companyCode,
                                            loginid: loginIdOrAdmin,
                                            code2: 'GRN',
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
                                        // Populate header fields immediately from the selected row
                                        setForm((current) => ({
                                            ...current,
                                            grn_doc_no: value,
                                            doc_date: toDateInputValue(getLookupValue(row || {}, "doc_date")),
                                            po_doc_date: toDateInputValue(getLookupValue(row || {}, "po_doc_date")),
                                            po_doc_no: text(getLookupValue(row || {}, "po_doc_no")),
                                            ac_code: text(getLookupValue(row || {}, "ac_code")),
                                            ac_name: text(getLookupValue(row || {}, "ac_name")),
                                            dept_code: text(getLookupValue(row || {}, "dept_code")),
                                            dept_name: text(getLookupValue(row || {}, "dept_name")),
                                            remarks: text(getLookupValue(row || {}, "remarks")),
                                            po_remarks: text(getLookupValue(row || {}, "po_remarks")),
                                            po_ref_no: text(getLookupValue(row || {}, "po_ref_no")),
                                            po_ref_date: text(getLookupValue(row || {}, "po_ref_date")),
                                            curr_code: text(getLookupValue(row || {}, "curr_code")),
                                            curr_name: text(getLookupValue(row || {}, "curr_name")),
                                            ex_rate: numberOrZero(getLookupValue(row || {}, "ex_rate")),
                                            address1: text(getLookupValue(row || {}, "address1") || accountRow?.address1),
                                            address2: text(getLookupValue(row || {}, "address2") || accountRow?.address2),
                                            address3: text(getLookupValue(row || {}, "address3") || accountRow?.address3),
                                            e_mail: text(getLookupValue(row || {}, "e_mail") || accountRow?.e_mail),
                                            credit_amount: numberOrZero(getLookupValue(row || {}, "credit_amount")),
                                            po_other_expense_cost: numberOrZero(getLookupValue(row || {}, "po_other_expense_cost")),
                                            disc_hdr_percent: numberOrZero(getLookupValue(row || {}, "disc_hdr_percent")),
                                            disc_hdr_price: numberOrZero(getLookupValue(row || {}, "disc_hdr_price")),
                                            po_payment_terms: text(getLookupValue(row || {}, "po_payment_terms")),
                                            po_credit_period: numberOrZero(getLookupValue(row || {}, "po_credit_period")),
                                            po_due_date: getLookupValue(row || {}, "po_due_date"),
                                            po_party_name: text(getLookupValue(row || {}, "po_party_name")),
                                            po_party_address: text(getLookupValue(row || {}, "po_party_address")),
                                            po_party_phone: text(getLookupValue(row || {}, "po_party_phone")),
                                            po_party_fax: text(getLookupValue(row || {}, "po_party_fax")),
                                            po_delivery_to: text(getLookupValue(row || {}, "po_delivery_to")),
                                            po_dlvr_contact: text(getLookupValue(row || {}, "po_dlvr_contact")),
                                            po_dlvr_email: text(getLookupValue(row || {}, "po_dlvr_email")),
                                            po_dlvr_mobile: text(getLookupValue(row || {}, "po_dlvr_mobile")),
                                            po_dlvr_term: text(getLookupValue(row || {}, "po_dlvr_term")),
                                            po_salesman_code: text(getLookupValue(row || {}, "po_salesman_code")),
                                            po_zone_code: text(getLookupValue(row || {}, "po_zone_code")),
                                            tx_compntcat_code_1: text(getLookupValue(row || {}, "tx_compntcat_code_1")),
                                            tx_cat_code: text(getLookupValue(row || {}, "tx_cat_code")),
                                            grn_payment_terms: text(getLookupValue(row || {}, "grn_payment_terms")),
                                            grn_dlvr_term: text(getLookupValue(row || {}, "grn_dlvr_term")),
                                            po_project_name: text(getLookupValue(row || {}, "po_project_name")),
                                            po_pr_no: text(getLookupValue(row || {}, "po_pr_no")),
                                            po_scope_of_work: text(getLookupValue(row || {}, "po_scope_of_work")),
                                            total_po_amount: numberOrZero(getLookupValue(row || {}, "total_po_amount")),
                                            inv_no: text(getLookupValue(row || {}, "inv_no")),
                                            inv_date: toDateInputValue(getLookupValue(row || {}, "inv_date")),
                                            pinvoice_total_amount: numberOrZero(getLookupValue(row || {}, "pinvoice_total_amount")),
                                            tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),
                                            tx_compntcat_name_1: text(getLookupValue(row || {}, "tx_compntcat_name_1")),
                                            tx_compnt_perc_1: numberOrZero(getLookupValue(row || {}, "tx_compnt_perc_1")),
                                            discount_scoope:
                                                text(getLookupValue(row || {}, "discount_scoope")) === "PO"
                                                    ? "PO"
                                                    : text(getLookupValue(row || {}, "discount_scoope")) === "ITEM"
                                                        ? "ITEM"
                                                        : current.discount_scoope || "ITEM",

                                        }));

                                        // Fetch and populate line details — same logic as the lines table
                                        try {
                                            const divCodeForFetch = text(getLookupValue(row || {}, "div_code")) || form.div_code;

                                            const details = await getDynamicLookup({
                                                parameter: "PS_INVOICE_ENTRY_GRN_NO_DETAIL_DET",
                                                code1: companyCode,
                                                code2: value,
                                            });

                                            const mappedDetails = (details || []).map((item: any, index: number) => ({
                                                id: `${value}-${index + 1}`,
                                                porder_div_code: text(getLookupValue(item, "porder_div_code")),
                                                prod_code: text(getLookupValue(item, "prod_code")),
                                                prod_name: text(getLookupValue(item, "prod_name")),
                                                p_uom: text(getLookupValue(item, "p_uom")),
                                                qty_puom: numberOrZero(getLookupValue(item, "qty_puom")),
                                                porder_qty_puom: numberOrZero(getLookupValue(item, "porder_qty_puom")),
                                                l_uom: text(getLookupValue(item, "l_uom")),
                                                qty_luom: numberOrZero(getLookupValue(item, "qty_luom")),
                                                porder_qty_luom: numberOrZero(getLookupValue(item, "porder_qty_luom")),
                                                unit_price: numberOrZero(getLookupValue(item, "unit_price")),
                                                porder_unit_price: numberOrZero(getLookupValue(item, "porder_unit_price")),
                                                disc_hdr_percent: numberOrZero(getLookupValue(item, "disc_hdr_percent")),
                                                disc_hdr_price: numberOrZero(getLookupValue(item, "disc_hdr_price")),
                                                disc_percent: numberOrZero(getLookupValue(item, "disc_percent")),
                                                porder_disc_percent: numberOrZero(getLookupValue(item, "porder_disc_percent")),
                                                disc_price: numberOrZero(getLookupValue(item, "disc_price")),
                                                tax_pct: numberOrZero(getLookupValue(item, "tax_pct")),
                                                tax_amount: numberOrZero(getLookupValue(item, "tax_amount")),
                                                lcur_amount: numberOrZero(getLookupValue(item, "lcur_amount")),
                                                required_dt: text(getLookupValue(item, "required_dt")),
                                                line_remarks: text(getLookupValue(item, "remarks")),
                                                tx_cat_code: text(getLookupValue(item, "tx_cat_code")),
                                                tx_compntcat_code_1: text(getLookupValue(item, "tx_compntcat_code_1")),
                                                tax_lcur_amount: numberOrZero(getLookupValue(item, "tx_compnt_lcuramt_1")),
                                                lcur_amount_disc: numberOrZero(getLookupValue(item, "lcur_amount_discounted")),
                                                porder_zone_code: text(getLookupValue(item, "porder_zone_code")),
                                                zone_name: text(getLookupValue(item, "zone_name")),
                                                uom_name: text(getLookupValue(item, "uom_name")),
                                                uom_code: text(getLookupValue(item, "uom_code")),
                                                job_no: text(getLookupValue(item, "job_no")),
                                                dept: text(getLookupValue(item, "dept_code")),
                                                sign_ind: numberOrZero(getLookupValue(item, "sign_ind")),
                                                uppp: numberOrZero(getLookupValue(item, "uppp")),
                                                quantity: numberOrZero(getLookupValue(item, "quantity")),
                                                ex_rate: numberOrZero(getLookupValue(item, "ex_rate")),
                                                porder_tx_compnt_amt_1: text(getLookupValue(item, "porder_tx_compnt_amt_1")),
                                                tx_compnt_perc_1: numberOrZero(getLookupValue(item, "tx_compnt_perc_1")),
                                                porder_tx_cat_code: text(getLookupValue(item, "porder_tx_cat_code")),
                                                porder_tx_compntcat_code_1: text(getLookupValue(item, "porder_tx_compntcat_code_1")),
                                                porder_required_dt: text(getLookupValue(item, "porder_required_dt")),
                                                tx_compnt_1_expmt: text(getLookupValue(item, "tx_compnt_1_expmt")),
                                                porder_remarks: text(getLookupValue(item, "porder_remarks")),
                                                serial_no: numberOrZero(getLookupValue(item, "serial_no")),

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

                        <CField label="INV No" required className="col-span-2">
                            <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} required value={form.inv_no} onChange={(e) => updateField("inv_no", e.target.value)} />
                        </CField>
                        <CField label="INV Date" required className="col-span-2">
                            <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} required value={form.inv_date} onChange={(e) => updateField("inv_date", e.target.value)} />
                        </CField>
                        <CField label="GRN Date" required className="col-span-2">
                            <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
                        </CField>

                        <CField label="PO No" required className="col-span-2">
                            <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} required value={form.po_doc_no} onChange={(e) => updateField("po_doc_no", e.target.value)} />
                        </CField>
                        <CField label="PO Date" required className="col-span-2">
                            <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} required value={form.po_doc_date} onChange={(e) => updateField("po_doc_date", e.target.value)} />
                        </CField>
                        <CField label="PO Inv Amount" required className="col-span-2">
                            <Input className="h-7 text-xs text-right" type="text" disabled={headerAndLineDisabled} required value={form.pinvoice_total_amount} onChange={(e) => updateField("pinvoice_total_amount", e.target.value)} />
                        </CField>
                        <CField label="Purchase Req No" className="col-span-2">
                            <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} value={form.pr_no} onChange={(e) => updateField("pr_no", e.target.value)} />
                        </CField>

                        <CField label="Ref Date" className="col-span-2">
                            <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(e) => updateField("ref_date", e.target.value)} />
                        </CField>

                        <CField label="WO No" className="col-span-2">
                            <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} value={form.po_wo_number} onChange={(e) => updateField("po_wo_number", e.target.value)} />
                        </CField>
                        <CField label="Expense A/c Post" className="col-span-2">
                            <Select className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </CField>
                        <CField label="Payment Terms" className="col-span-6">
                            <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.po_payment_terms} onChange={(e) => updateField("po_payment_terms", e.target.value)} />
                        </CField>

                        <CField label="GRN Remarks" className="col-span-6">
                            <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} />
                        </CField>
                        <CField label="Remarks" className="col-span-6">
                            <textarea
                                className="h-[70px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs"
                                disabled={headerAndLineDisabled}
                                value={form.po_remarks || ""}
                                onChange={(e) => updateField("po_remarks", e.target.value)}
                            />
                        </CField>
                    </HeaderBlock>
                </div>

                {/* RIGHT COLUMN — Currency & Department, Delivery Terms, Discount, Tax, Project & Scope */}
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
                    </HeaderBlock>

                    <HeaderBlock label="Delivery Terms" icon={<Truck size={11} />} gridCols="grid-cols-4">
                        <CField label="Delivery Contact Person"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.po_dlvr_contact} onChange={(e) => updateField("dlvr_contact", e.target.value)} /></CField>
                        <CField label="Delivery Telephone"><Input className="h-7 text-xs" type="tel" disabled={headerAndLineDisabled} value={form.po_dlvr_mobile} onChange={(e) => updateField("dlvr_mobile", e.target.value)} /></CField>
                        <CField label="Delivery Email Address"><Input className="h-7 text-xs" type="email" disabled={headerAndLineDisabled} value={form.po_dlvr_email} onChange={(e) => updateField("dlvr_email", e.target.value)} /></CField>
                        <CField label="Delivery Term"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.po_dlvr_term} onChange={(e) => updateField("po_dlvr_term", e.target.value)} /></CField>
                    </HeaderBlock>

                    {/* Discount + Tax side by side */}
                    <div className="grid grid-cols-2 gap-1.5 items-stretch">
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
                                                    discount_scoope: "PO",
                                                    disc_hdr_price: seededPrice,
                                                    disc_hdr_percent: seededPercent,
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
                                            onChange={() => setForm((current) => ({ ...current, discount_scoope: "ITEM" }))}
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
                                    value={
                                        discountScope === "ITEM"
                                            ? TotalDiscAmount(rows || []).toFixed(3)
                                            : numberOrZero(form.disc_hdr_price).toFixed(3)
                                    }
                                    onChange={(e) => {
                                        const value = Number(e.target.value || 0);
                                        updateField("disc_hdr_price", value);
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
                                    value={
                                        discountScope === "ITEM"
                                            ? DiscAmountPercentage(form, rows || []).toFixed(3)
                                            : numberOrZero(form.disc_hdr_percent).toFixed(3)
                                    }
                                    onChange={(e) => {
                                        const value = Number(e.target.value || 0);
                                        updateField("disc_hdr_percent", value);
                                        calculateDiscount("percent", value);
                                    }}
                                />
                            </CField>
                        </HeaderBlock>

                        <HeaderBlock label="Tax" icon={<Receipt size={11} />} gridCols="grid-cols-2">
                            <CField label="Tax Type">
                                <Select className="h-7 text-xs" value={form.tx_compnt_1_expmt || "N"} onChange={(e) => {
                                    const taxType = e.target.value;
                                    setForm((current) => ({ ...current, tx_compnt_1_expmt: taxType, tx_compnt_1_pct: taxType === "S" ? 5 : 0 }));
                                }}>
                                    <option value="N">No Tax</option><option value="S">Std Tax</option><option value="Z">Zero</option><option value="E">Exempt</option>
                                </Select>
                            </CField>

                            <LookupField
                                label="Tax Category"
                                value={form.tx_cat_name
                                    ? `${form.tx_cat_code} - ${form.tx_cat_name}`
                                    : form.tx_cat_code}
                                displayValue={
                                    form.tx_cat_name
                                        ? `${form.tx_cat_code} - ${form.tx_cat_name}`
                                        : form.tx_cat_code
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
                                disabled={disabled}
                                onChange={(value, row) =>
                                    setForm((current) => ({
                                        ...current,
                                        tx_cat_code: text(value).split(" - ")[0].trim(),
                                        tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),
                                    }))
                                }
                            />

                            <LookupField
                                label="Tax Code"
                                value={form.tx_compntcat_name_1
                                    ? `${form.tx_compntcat_code_1} - ${form.tx_compntcat_name_1}`
                                    : form.tx_compntcat_code_1}
                                displayValue={
                                    form.tx_compntcat_name_1
                                        ? `${form.tx_compntcat_code_1} - ${form.tx_compntcat_name_1}`
                                        : form.tx_compntcat_code_1
                                }
                                columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
                                valueField="tx_compntcat_code"
                                displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
                                loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
                                disabled={headerAndLineDisabled}
                                onChange={(value) => setForm((current) => ({ ...current, tx_compntcat_code_1: value }))}
                            />
                        </HeaderBlock>
                    </div>

                    <HeaderBlock label="Project & Scope" icon={<Briefcase size={11} />} gridCols="grid-cols-3">
                        <CField label="Project Name"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.project_name} onChange={(e) => updateField("project_name", e.target.value)} /></CField>
                        <CField label="PR No"><Input className="h-7 text-xs text-right" disabled={headerAndLineDisabled} value={form.pr_no} onChange={(e) => updateField("pr_no", e.target.value)} /></CField>
                        <CField label="Scope of Work"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(e) => updateField("scope_of_work", e.target.value)} /></CField>
                    </HeaderBlock>
                </div>

            </div>
        </div>
    );
}