import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";

import { PurchaseOrderForm, SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";
import { numberOrZero, text } from "./SalesOrderutils";
import { PODocType } from "../purchase/Purchaseordertypes";

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
                {required && <span className="ml-1 text-destructive">*</span>}
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
    setdetails
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
}) {
    const loginIdOrAdmin = loginid || "ADMIN";

    const lookupValue = (row: Record<string, unknown>, ...fields: string[]) => {
        for (const field of fields) {
            const value = getLookupValue(row, field);
            if (value !== "" && value !== null && value !== undefined) return value;
        }
        return "";
    };

    return (
        <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1">
                <div>
                    <p className="eyebrow m-0 text-[10px] leading-tight">Header</p>
                    <h3 className="m-0 text-xs font-semibold leading-tight">Purchase Order Information</h3>
                </div>
            </div>

            <CompactSection label="Document & Party">
                <div className="col-span-2">
                    <LookupField
                        label="A/c code *"
                        value={form.ac_code}
                        displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                        columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "address", header: "Address" }, { field: "tel", header: "Tel" }, { field: "fax", header: "Fax" }]}
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
                        }))}
                    />
                </div>

                <div>
                    <label>SO No</label>
                    <LookupField
                        label="SO No"
                        compact
                        placeholder="SO No"
                        value={String(form.so_doc_no ?? "")}
                        displayValue={String(form.so_doc_no ?? "")}
                        columns={[
                            { field: "so_doc_no", header: "SDN No" },
                            { field: "so_ac_code", header: "A/c Code" },
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
                            const selectedRow = row || {};
                            const soDocNo = text(lookupValue(selectedRow, "so_doc_no", "doc_no", "sorder_doc_no")) || value;
                            setForm((current) => ({
                                ...current,
                                so_doc_no: soDocNo,
                                so_ac_code: text(lookupValue(selectedRow, "so_ac_code", "ac_code")),
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
                            }));


                            // Fetch and populate line details — same logic as the lines table
                            try {
                                const divCodeForFetch = text(lookupValue(selectedRow, "div_code", "so_div_code")) || form.div_code;

                                const details = await getDynamicLookup({
                                    parameter: "PS_SDN_ENTRY_SO_NO_DETAIL_DET",
                                    code1: companyCode,
                                    code2: divCodeForFetch,
                                    number1: Number(value),
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

                <CField label="SO Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.so_doc_date} onChange={(event) => updateField("so_doc_date", event.target.value)} />
                </CField>

                <CField label="SO Amount *">

                    <Input type="text" disabled={headerAndLineDisabled} required value={form.total_so_amount} onChange={(event) => updateField("total_so_amount", event.target.value)} />
                </CField>

                {editMode && <CField label="DN No"><Input disabled value={form.doc_no || ""} /></CField>}
                <CField label="DN Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(event) => updateField("doc_date", event.target.value)} />
                </CField>


                <div className="col-span-2">
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
                </div>




                <CField label="Pay Terms" className="col-span-2">
                    <Input disabled={headerAndLineDisabled} value={form.so_payment_terms} onChange={(event) => updateField("so_payment_terms", event.target.value)} />
                </CField>

                <CField label="Remarks" className="col-span-2">
                    <Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
                </CField>

                <CField label="Delivery Term" className="col-span-1">
                    <Input disabled={headerAndLineDisabled} value={form.so_dlvr_term} onChange={(event) => updateField("so_dlvr_term", event.target.value)} />
                </CField>

            </CompactSection>


        </div>
    );
}