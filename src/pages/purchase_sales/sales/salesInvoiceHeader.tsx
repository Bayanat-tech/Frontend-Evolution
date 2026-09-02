import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";

import { PurchaseOrderForm, SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";
import { numberOrZero, text } from "./SalesOrderutils";
import { EXPENSE_AC_OPTIONS, PODocType } from "../purchase/Purchaseordertypes";

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

export function SalesInvoiceHeaderForm({
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

                {(String(docType ?? "").trim().toUpperCase() === "PIN" ||
                    String(docType ?? "").trim().toUpperCase() === "SIN") && (
                        <div>
                            <label>DN No</label>
                            <LookupField
                                label="DN No"
                                compact
                                placeholder="DN No"
                                // value={String(editMode ? form.doc_no ?? "" : form.sdn_doc_no ?? "")}
                                // displayValue={String(editMode ? form.doc_no ?? "" : form.sdn_doc_no ?? "")}
                                value={String(form.sdn_doc_no ?? "")}
                                displayValue={String(form.sdn_doc_no ?? "")}
                                columns={[
                                    { field: "doc_no", header: "SDN No" },
                                    { field: "ac_code", header: "A/c Code" },
                                ]}
                                valueField="doc_no"
                                displayFields={["doc_no"]}
                                loadOptions={() =>
                                    getDynamicLookup({
                                        parameter: "PS_SALE_PURCHASE_ENTRY_SINV_SDN_NO_DETAIL",
                                        code1: companyCode,
                                        loginid: loginIdOrAdmin,
                                        code2: 'SDN',
                                        code4: form.ac_code
                                    })
                                }
                                disabled={disabled}
                                onChange={async (value, row) => {
                                    // Populate header fields immediately from the selected row
                                    setForm((current) => ({
                                        ...current,
                                        // ...(editMode
                                        //     ? { doc_no: value }
                                        //     : { sdn_doc_no: value }),
                                        sdn_doc_no: value,
                                        doc_date: toDateInputValue(getLookupValue(row || {}, "doc_date")),
                                        so_doc_date: toDateInputValue(getLookupValue(row || {}, "so_doc_date")),
                                        so_doc_no: text(getLookupValue(row || {}, "so_doc_no")),
                                        ac_code: text(getLookupValue(row || {}, "ac_code")),
                                        ac_name: text(getLookupValue(row || {}, "ac_name")),
                                        so_dept_code: text(getLookupValue(row || {}, "so_dept_code")),
                                        remarks: text(getLookupValue(row || {}, "remarks")),
                                        so_remarks: text(getLookupValue(row || {}, "so_remarks")),
                                        so_ref_no: text(getLookupValue(row || {}, "so_ref_no")),
                                        so_ref_date: text(getLookupValue(row || {}, "so_ref_date")),
                                        curr_code: text(getLookupValue(row || {}, "curr_code")),
                                        curr_name: text(getLookupValue(row || {}, "curr_name")),
                                        ex_rate: numberOrZero(getLookupValue(row || {}, "ex_rate")),
                                        so_other_expense_cost: numberOrZero(getLookupValue(row || {}, "so_other_expense_cost")),
                                        disc_hdr_percent: numberOrZero(getLookupValue(row || {}, "disc_hdr_percent")),
                                        disc_hdr_price: numberOrZero(getLookupValue(row || {}, "disc_hdr_price")),
                                        so_payment_terms: text(getLookupValue(row || {}, "so_payment_terms")),
                                        so_credit_period: numberOrZero(getLookupValue(row || {}, "so_credit_period")),
                                        so_due_date: getLookupValue(row || {}, "so_due_date"),
                                        so_party_name: text(getLookupValue(row || {}, "so_party_name")),
                                        so_party_address: text(getLookupValue(row || {}, "so_party_address")),
                                        so_party_phone: text(getLookupValue(row || {}, "so_party_phone")),
                                        so_party_fax: text(getLookupValue(row || {}, "so_party_fax")),
                                        so_delivery_to: text(getLookupValue(row || {}, "so_delivery_to")),
                                        so_dlvr_contact: text(getLookupValue(row || {}, "so_dlvr_contact")),
                                        so_dlvr_email: text(getLookupValue(row || {}, "so_dlvr_email")),
                                        so_dlvr_mobile: text(getLookupValue(row || {}, "so_dlvr_mobile")),
                                        so_dlvr_term: text(getLookupValue(row || {}, "so_dlvr_term")),
                                        so_salesman_code: text(getLookupValue(row || {}, "so_salesman_code")),
                                        so_zone_code: text(getLookupValue(row || {}, "so_zone_code")),
                                        so_tx_compntcat_code_1: text(getLookupValue(row || {}, "so_tx_compntcat_code_1")),
                                        so_tx_cat_code: `${text(getLookupValue(row || {}, "so_tx_cat_code"))} - ${text(
                                            getLookupValue(row || {}, "so_tx_cat_name")
                                        )}`,
                                        SDN_payment_terms: text(getLookupValue(row || {}, "SDN_payment_terms")),
                                        SDN_dlvr_term: text(getLookupValue(row || {}, "SDN_dlvr_term")),
                                        so_project_name: text(getLookupValue(row || {}, "so_project_name")),
                                        so_pr_no: text(getLookupValue(row || {}, "so_pr_no")),
                                        so_scope_of_work: text(getLookupValue(row || {}, "so_scope_of_work")),
                                        total_so_amount: numberOrZero(getLookupValue(row || {}, "total_so_amount")),
                                        si_doc_no: text(getLookupValue(row || {}, "si_doc_no")),
                                        si_doc_date: toDateInputValue(getLookupValue(row || {}, "si_doc_date")),
                                        inv_no: text(getLookupValue(row || {}, "inv_no")),
                                        inv_date: toDateInputValue(getLookupValue(row || {}, "inv_date")),


                                    }));

                                    // Fetch and populate line details — same logic as the lines table
                                    try {
                                        const divCodeForFetch = text(getLookupValue(row || {}, "div_code")) || form.div_code;

                                        const details = await getDynamicLookup({
                                            parameter: "PS_SALE_PURCHASE_ENTRY_SINV_SDN_NO_DETAIL_DET",
                                            code1: companyCode,
                                            code2: value,
                                        });

                                        const mappedDetails = (details || []).map((item: any, index: number) => ({
                                            id: `${value}-${index + 1}`,
                                            sorder_div_code: text(getLookupValue(item, "sorder_div_code")),
                                            prod_code: text(getLookupValue(item, "prod_code")),
                                            prod_name: text(getLookupValue(item, "prod_name")),
                                            p_uom: text(getLookupValue(item, "p_uom")),
                                            qty_puom: numberOrZero(getLookupValue(item, "qty_puom")),
                                            sorder_qty_puom: numberOrZero(getLookupValue(item, "sorder_qty_puom")),
                                            l_uom: text(getLookupValue(item, "l_uom")),
                                            qty_luom: numberOrZero(getLookupValue(item, "qty_luom")),
                                            sorder_qty_luom: numberOrZero(getLookupValue(item, "sorder_qty_luom")),
                                            unit_price: numberOrZero(getLookupValue(item, "unit_price")),
                                            sorder_unit_price: numberOrZero(getLookupValue(item, "sorder_unit_price")),
                                            disc_hdr_percent: numberOrZero(getLookupValue(item, "disc_hdr_percent")),
                                            disc_percent: numberOrZero(getLookupValue(item, "disc_percent")),
                                            sorder_disc_percent: numberOrZero(getLookupValue(item, "sorder_disc_percent")),
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
                                            sorder_zone_code: text(getLookupValue(item, "sorder_zone_code")),
                                            zone_name: text(getLookupValue(item, "zone_name")),
                                            uom_name: text(getLookupValue(item, "uom_name")),
                                            uom_code: text(getLookupValue(item, "uom_code")),
                                            job_no: text(getLookupValue(item, "job_no")),
                                            dept: text(getLookupValue(item, "dept_code")),
                                            sign_ind: numberOrZero(getLookupValue(item, "sign_ind")),
                                            uppp: numberOrZero(getLookupValue(item, "uppp")),
                                            quantity: numberOrZero(getLookupValue(item, "quantity")),
                                            ex_rate: numberOrZero(getLookupValue(item, "ex_rate")),
                                            sorder_tx_compnt_amt_1: text(getLookupValue(item, "sorder_tx_compnt_amt_1")),
                                            sorder_tx_compnt_perc_1: text(getLookupValue(item, "sorder_tx_compnt_perc_1")),
                                            sorder_tx_cat_code: text(getLookupValue(item, "sorder_tx_cat_code")),
                                            sorder_tx_compntcat_code_1: text(getLookupValue(item, "sorder_tx_compntcat_code_1")),
                                            sorder_required_dt: text(getLookupValue(item, "sorder_required_dt")),
                                            sorder_tx_compnt_1_expmt: text(getLookupValue(item, "sorder_tx_compnt_1_expmt")),
                                            sorder_remarks: text(getLookupValue(item, "sorder_remarks")),
                                            serial_no: numberOrZero(getLookupValue(item, "serial_no")),

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
                    )}
                <CField label="SDN Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(event) => updateField("doc_date", event.target.value)} />
                </CField>
                <CField label="SO NO *">
                    <Input type="text" disabled={headerAndLineDisabled} required value={form.so_doc_no} onChange={(event) => updateField("so_doc_no", event.target.value)} />
                </CField>
                <CField label="SO Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.so_doc_date} onChange={(event) => updateField("so_doc_date", event.target.value)} />
                </CField>
                <CField label="SO Amount *">
                    <Input type="text" disabled={headerAndLineDisabled} required value={form.total_so_amount} onChange={(event) => updateField("total_so_amount", event.target.value)} />
                </CField>
                <CField label="INV NO *">
                    <Input type="text" disabled={headerAndLineDisabled} required value={form.inv_no} onChange={(event) => updateField("inv_no", event.target.value)} />
                </CField>
                <CField label="INV Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.inv_date} onChange={(event) => updateField("inv_date", event.target.value)} />
                </CField>
                {editMode && <CField label="Doc No"><Input disabled value={form.si_doc_no || ""} /></CField>}
                <CField label="Doc Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.si_doc_date} onChange={(event) => updateField("si_doc_date", event.target.value)} />
                </CField>

                <CField label="Pay Terms" className="col-span-2">
                    <Input disabled={headerAndLineDisabled} value={form.so_payment_terms} onChange={(event) => updateField("so_payment_terms", event.target.value)} />
                </CField>

                <CField label="SDN Remarks" className="col-span-2">
                    <Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
                </CField>

                <CField label="Delivery Term" className="col-span-1">
                    <Input disabled={headerAndLineDisabled} value={form.so_dlvr_term} onChange={(event) => updateField("so_dlvr_term", event.target.value)} />
                </CField>

                {/* 
                <CField label="Quotn No">
                    <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.so_ref_no} onChange={(event) => updateField("so_ref_no", event.target.value)} />
                </CField>
                <CField label="Quotn Date">
                    <Input type="date" disabled={headerAndLineDisabled} value={form.so_ref_date} onChange={(event) => updateField("so_ref_date", event.target.value)} />
                </CField> */}
                <CField label="Credit Period">
                    <Input disabled={headerAndLineDisabled} className="text-right" type="number" step="1" value={form.so_credit_period} onChange={(event) => updateField("so_credit_period", Number(event.target.value || 0))} />
                </CField>
                <div className="col-span-2">
                    <LookupField
                        label="Department"
                        value={form.so_dept_code || ""}
                        displayValue={
                            form.so_dept_name
                                ? `${form.so_dept_code} - ${form.so_dept_name}`
                                : form.so_dept_code
                        }
                        columns={[
                            { field: "dept_code", header: "Code" },
                            { field: "dept_name", header: "Name" },
                        ]}
                        valueField="dept_code"
                        displayFields={["dept_code", "dept_name"]}
                        loadOptions={() =>
                            getDynamicLookup({
                                parameter: "DROP_DOWN_DEPT_BASED_ON_DIV",
                                code1: companyCode,
                                code2: form.div_code,
                                loginid: loginid || "ADMIN",
                            })
                        }
                        disabled={headerAndLineDisabled}
                        onChange={(value, row) =>
                            setForm((current) => ({
                                ...current,
                                so_dept_code: value,
                                so_dept_name: text(getLookupValue(row || {}, "dept_name")),
                            }))
                        }
                    />
                </div>
                <CField label="Tel">
                    <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.so_party_phone} onChange={(event) => updateField("so_party_phone", event.target.value)} />
                </CField>
                <CField label="Address" className="col-span-2">
                    <Input
                        disabled={headerAndLineDisabled}
                        value={form.so_party_address}
                        onChange={(event) => updateField("so_party_address", event.target.value)}
                    />
                </CField>

                <CField label="Fax">
                    <Input
                        className="text-right"
                        type="number"
                        disabled={headerAndLineDisabled}
                        value={form.so_party_fax}
                        onChange={(event) => updateField("so_party_fax", event.target.value)}
                    />
                </CField>
            </CompactSection>


            <CompactSection label="Order, Currency & Tax">

                <div className="col-span-1">
                    <LookupField
                        label="Currency *"
                        value={form.curr_code || ""}
                        displayValue={
                            form.so_curr_name
                                ? `${form.curr_code} - ${form.curr_name}`
                                : form.curr_code
                        }
                        columns={[
                            { field: "curr_code", header: "Code" },
                            { field: "curr_name", header: "Name" }
                        ]}
                        valueField="curr_code"
                        displayFields={["curr_code", "curr_name"]}
                        loadOptions={() =>
                            getDynamicLookup({
                                parameter: "Account_Currency_CODE_Serach",
                                code1: companyCode,
                                loginid: loginIdOrAdmin
                            })
                        }
                        disabled={headerAndLineDisabled}
                        onChange={(value, row) =>
                            setForm((current) => ({
                                ...current,
                                curr_code: value,
                                curr_name: text(
                                    getLookupValue(row || {}, "curr_name")
                                ),
                                ex_rate: Number(
                                    getLookupValue(row || {}, "ex_rate") ||
                                    (row as Record<string, unknown>)?.ex_rate ||
                                    current.ex_rate ||
                                    1
                                ),
                            }))
                        }
                    />
                </div>

                <CField label="Ex Rate" className="w-18">
                    <Input
                        className="text-right"
                        type="number"
                        disabled={headerAndLineDisabled}
                        step="0.000001"
                        value={form.ex_rate}
                        onChange={(event) =>
                            updateField(
                                "ex_rate",
                                Number(event.target.value || 1)
                            )
                        }
                    />
                </CField>

                <CField label="Disc Amt">
                    <Input
                        className="text-right"
                        type="number"
                        step="0.01"
                        disabled={headerAndLineDisabled}
                        value={form.so_disc_hdr_price}
                        onChange={(event) =>
                            updateField(
                                "so_disc_hdr_price",
                                Number(event.target.value || 0)
                            )
                        }
                    />
                </CField>

                <CField label="Disc %">
                    <Input
                        className="text-right"
                        type="number"
                        step="0.01"
                        disabled={headerAndLineDisabled}
                        value={form.so_disc_hdr_percent}
                        onChange={(event) =>
                            updateField(
                                "so_disc_hdr_percent",
                                Number(event.target.value || 0)
                            )
                        }
                    />
                </CField>

                <div>
                    <label>Tax Category</label>

                    <LookupField
                        label="Tax Category"
                        compact
                        placeholder="Tax code"
                        value={form.so_tx_cat_code || ""}
                        displayValue={
                            form.so_tx_cat_name
                                ? `${form.so_tx_cat_code} - ${form.so_tx_cat_name}`
                                : form.so_tx_cat_code
                        }
                        columns={[
                            { field: "tx_cat_code_1", header: "Code" },
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
                                so_tx_cat_code: value,
                                so_tx_cat_name: text(
                                    getLookupValue(row || {}, "tx_cat_name")
                                ),
                            }))
                        }
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-primary-foreground/80">
                        Tax Code
                    </label>

                    <LookupField
                        label="Tax Code"
                        compact
                        placeholder="Tax code"
                        value={form.so_tx_compntcat_code_1 || ""}
                        displayValue={form.so_tx_compntcat_code_1 || ""}
                        columns={[
                            { field: "tx_compntcat_code", header: "Code" },
                            { field: "tx_compntcat_name", header: "Name" }
                        ]}
                        valueField="tx_compntcat_code"
                        displayFields={[
                            "tx_compntcat_code",
                            "tx_compntcat_name"
                        ]}
                        loadOptions={() =>
                            getDynamicLookup({
                                parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE",
                                code1: companyCode,
                                loginid: loginIdOrAdmin
                            })
                        }
                        disabled={headerAndLineDisabled}
                        onChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                so_tx_compntcat_code_1: value
                            }))
                        }
                    />
                </div>

                <CField label="Pay Terms" className="col-span-2">
                    <Input
                        disabled={headerAndLineDisabled}
                        value={form.so_payment_terms}
                        onChange={(event) =>
                            updateField("so_payment_terms", event.target.value)
                        }
                    />
                </CField>

                <CField label="Remarks" className="col-span-2">
                    <Input
                        disabled={headerAndLineDisabled}
                        value={form.so_remarks}
                        onChange={(event) =>
                            updateField("so_remarks", event.target.value)
                        }
                    />
                </CField>

                <CField label="Delivery Term" className="col-span-1">
                    <Input
                        disabled={headerAndLineDisabled}
                        value={form.so_dlvr_term}
                        onChange={(event) =>
                            updateField("so_dlvr_term", event.target.value)
                        }
                    />
                </CField>

                <CField label="Expense A/c Post">
                    <Select
                        disabled={headerAndLineDisabled}
                        value={form.so_expense_ac_post}
                        onChange={(event) =>
                            updateField(
                                "so_expense_ac_post",
                                event.target.value
                            )
                        }
                    >
                        {EXPENSE_AC_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </Select>
                </CField>
                <CField label="Delivery Contact">
                    <Input
                        disabled={headerAndLineDisabled}
                        value={form.so_dlvr_contact}
                        onChange={(event) =>
                            updateField("so_dlvr_contact", event.target.value)
                        }
                    />
                </CField>

                <CField label="Delivery Tel">
                    <Input
                        disabled={headerAndLineDisabled}
                        value={form.so_dlvr_mobile}
                        onChange={(event) =>
                            updateField("so_dlvr_mobile", event.target.value)
                        }
                    />
                </CField>

                <CField label="Delivery Email" className="col-span-2">
                    <Input
                        disabled={headerAndLineDisabled}
                        type="email"
                        value={form.so_dlvr_email}
                        onChange={(event) =>
                            updateField("so_dlvr_email", event.target.value)
                        }
                    />
                </CField>
            </CompactSection>


            {/* <CompactSection
                label="Delivery"
                className="border-b-0"
            >
                
            </CompactSection> */}
        </div>
    );
}