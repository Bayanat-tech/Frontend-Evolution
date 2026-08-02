import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { PurchaseOrderForm, IV_DOC_TYPE, InventoryDocType } from "./Inventorytypes";
import { text } from "./Inventoryutils";

function CompactSection({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={`border-t px-3 py-1.5 first:border-t-0 ${className || ""}`}>
            <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="grid grid-cols-8 gap-x-2 gap-y-1 pt-1 max-2xl:grid-cols-6 max-xl:grid-cols-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
                {children}
            </div>
        </div>
    );
}

function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
    return (
        <label className={`field ${className || ""}`}>
            <span className="text-[10px]">
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </span>
            {children}
        </label>
    );
}

export function StockHeaderForm({
    form,
    setForm,
    updateField,
    disabled,
    headerAndLineDisabled,
    editMode,
    companyCode,
    loginid,
    docType

}: {
    form: PurchaseOrderForm;
    setForm: (updater: (current: PurchaseOrderForm) => PurchaseOrderForm) => void;
    updateField: (field: keyof PurchaseOrderForm, value: string | number) => void;
    disabled: boolean;
    headerAndLineDisabled: boolean;
    editMode: boolean;
    companyCode?: string;
    loginid?: string;
    docType?: InventoryDocType
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
                {editMode && <CField label="Doc No"><Input disabled value={form.doc_no || ""} /></CField>}
                <CField label="Doc Date *">
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
                {docType === IV_DOC_TYPE.SAJ ? (
                    <>
                        <div className="col-span-1">
                            <LookupField
                                label="Department"
                                value={form.dept_code || ""}
                                displayValue={
                                    form.dept_name
                                        ? `${form.dept_code} - ${form.dept_name}`
                                        : form.dept_code
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
                                        dept_code: value,
                                        dept_name: text(getLookupValue(row || {}, "dept_name")),
                                    }))
                                }
                            />
                        </div>

                        <div className="col-span-1">
                            <LookupField
                                label="Zone"
                                value={form.zone_code || ""}
                                displayValue={
                                    form.zone_name
                                        ? `${form.zone_code} - ${form.zone_name}`
                                        : form.zone_code
                                }
                                columns={[
                                    { field: "zone_code", header: "Code" },
                                    { field: "zone_name", header: "Name" },
                                ]}
                                valueField="zone_code"
                                displayFields={["zone_code", "zone_name"]}
                                loadOptions={() =>
                                    getDynamicLookup({
                                        parameter: "PS_POORDER_ENTRY_ZONE_LIST",
                                        code1: companyCode,
                                        loginid: loginid || "ADMIN",
                                    })
                                }
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) =>
                                    setForm((current) => ({
                                        ...current,
                                        zone_code: value,
                                        zone_name: text(getLookupValue(row || {}, "zone_name")),
                                    }))
                                }
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="col-span-1">
                            <LookupField
                                label="From Zone"
                                value={form.from_zone_code || ""}
                                displayValue={
                                    form.zone_name
                                        ? `${form.from_zone_code} - ${form.zone_name}`
                                        : form.from_zone_code
                                }
                                columns={[
                                    { field: "zone_code", header: "Code" },
                                    { field: "zone_name", header: "Name" },
                                ]}
                                valueField="zone_code"
                                displayFields={["zone_code", "zone_name"]}
                                loadOptions={() =>
                                    getDynamicLookup({
                                        parameter: "PS_POORDER_ENTRY_ZONE_LIST",
                                        code1: companyCode,
                                        loginid: loginid || "ADMIN",
                                    })
                                }
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) =>
                                    setForm((current) => ({
                                        ...current,
                                        from_zone_code: value,
                                        zone_name: text(getLookupValue(row || {}, "zone_name")),
                                    }))
                                }
                            />
                        </div>

                        <div className="col-span-1">
                            <LookupField
                                label="To Zone"
                                value={form.to_zone_code || ""}
                                displayValue={
                                    form.zone_name
                                        ? `${form.to_zone_code} - ${form.zone_name}`
                                        : form.to_zone_code
                                }
                                columns={[
                                    { field: "zone_code", header: "Code" },
                                    { field: "zone_name", header: "Name" },
                                ]}
                                valueField="zone_code"
                                displayFields={["zone_code", "zone_name"]}
                                loadOptions={() =>
                                    getDynamicLookup({
                                        parameter: "PS_POORDER_ENTRY_ZONE_LIST",
                                        code1: companyCode,
                                        loginid: loginid || "ADMIN",
                                    })
                                }
                                disabled={headerAndLineDisabled}
                                onChange={(value, row) =>
                                    setForm((current) => ({
                                        ...current,
                                        to_zone_code: value,
                                        zone_name: text(getLookupValue(row || {}, "zone_name")),
                                    }))
                                }
                            />
                        </div>
                    </>
                )}
                  {docType !== IV_DOC_TYPE.STR &&  docType !== IV_DOC_TYPE.SAJ &&<CField label="Issued By" className="col-span-1">
                    <Input disabled={headerAndLineDisabled} value={form.issued_by} onChange={(event) => updateField("issued_by", event.target.value)} />
                </CField>}
                {docType !== IV_DOC_TYPE.STR  &&  docType !== IV_DOC_TYPE.SAJ && <CField label="Received By" className="col-span-1">
                    <Input disabled={headerAndLineDisabled} value={form.received_by} onChange={(event) => updateField("received_by", event.target.value)} />
                </CField>}
                <CField label="Remarks" className="col-span-3">
                    <Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
                </CField>


            </CompactSection>
             
        </div>
    );
}