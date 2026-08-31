import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderForm } from "./Purchaseordertypes";
import { numberOrZero, text } from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";

// Updated CompactSection to be more flexible for the two-column layout
function CompactSection({ label, children, className, gridCols = "grid-cols-4" }: { label: string; children: ReactNode; className?: string; gridCols?: string }) {
  return (
    <div className={`px-2 py-1.5 ${className || ""}`}>
      <p className="m-0 mb-1.5 text-[9px] font-bold uppercase tracking-wide text-foreground/60 border-b border-gray-100 pb-1">{label}</p>
      <div className={`grid gap-x-2 gap-y-1.5 pt-0.5 ${gridCols} max-md:grid-cols-1`}>
        {children}
      </div>
    </div>
  );
}

// SideBox for the right-hand column sections
function SideBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border-2 border-gray-100  p-2.5 mb-2.5 ${className || ""}`}>
      <p className="m-0 mb-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {children}
      </div>
    </div>
  );
}

function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={`field flex flex-col gap-0.5 ${className || ""}`}>
      <span className="text-[9px] font-semibold text-foreground/75">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

export function PurchaseOrderHeaderForm({
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
    <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
      {/* HEADER SECTION - HEIGHT UNCHANGED */}
      <div className="flex items-center justify-between border-b-2 border-gray-100 bg-gray-50 px-3 py-1">
        <div>
          <p className="eyebrow m-0 text-[9px] leading-tight uppercase opacity-70 font-semibold">Header</p>
          <h3 className="m-0 text-sm font-bold leading-tight">Purchase Order Information</h3>
        </div>
      </div>

      {/* TWO COLUMN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* LEFT COLUMN: PRIMARY INFO */}
        <div className="lg:col-span-8 border-r-2 border-gray-100 divide-y divide-gray-200">
          
          {/* Document & Party Section */}
          <CompactSection label="Document & Party" gridCols="grid-cols-6">
            {editMode && <CField label="Doc No"><Input disabled value={form.doc_no || ""} /></CField>}
            <CField label="Doc Date *" required>
              <Input type="date" disabled={headerAndLineDisabled} value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
            </CField>
            <CField label="Quotn No">
              <Input className="text-right" type="text" disabled={headerAndLineDisabled} value={form.ref_no} onChange={(e) => updateField("ref_no", e.target.value)} />
            </CField>
            <CField label="Quotn Date">
              <Input type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(e) => updateField("ref_date", e.target.value)} />
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
              <div className="col-span-1">
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
            </div>
              <CField label="Ex Rate"><Input className="text-right" type="number" disabled={headerAndLineDisabled} step="0.000001" value={form.ex_rate} onChange={(e) => updateField("ex_rate", Number(e.target.value || 1))} /></CField>

            <CField label="Credit Period">
              <Input disabled={headerAndLineDisabled} className="text-right" type="number" value={form.credit_period} onChange={(e) => updateField("credit_period", Number(e.target.value || 0))} />
            </CField>
            <div className="col-span-2">
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
            </div>
            <CField label="Tel"><Input className="text-right" disabled={headerAndLineDisabled} value={form.party_phone} onChange={(e) => updateField("party_phone", e.target.value)} /></CField>
            <CField label="Address" className="col-span-3"><Input disabled={headerAndLineDisabled} value={form.party_address} onChange={(e) => updateField("party_address", e.target.value)} /></CField>
            <CField label="Fax"><Input className="text-right" disabled={headerAndLineDisabled} value={form.party_fax} onChange={(e) => updateField("party_fax", e.target.value)} /></CField>
 {(String(docType ?? "").trim().toUpperCase() === "LPO" && (
              <>
                <CField label="Buyer"><Input disabled={headerAndLineDisabled} value={form.buyer} onChange={(e) => updateField("buyer", e.target.value)} /></CField>
                <CField label="WO No"><Input disabled={headerAndLineDisabled} value={form.wo_number} onChange={(e) => updateField("wo_number", e.target.value)} /></CField>
              </>
            ))}

            
          </CompactSection>

          {/* Order, Currency & Tax (Core Fields) */}
          <CompactSection label="Order & Currency" gridCols="grid-cols-6">
          
          
            <CField label="Disc Amt"><Input className="text-right" type="number" step="0.01" disabled={headerAndLineDisabled} value={form.disc_hdr_price} onChange={(e) => updateField("disc_hdr_price", Number(e.target.value || 0))} /></CField>
            <CField label="Disc %"><Input className="text-right" type="number" step="0.01" disabled={headerAndLineDisabled} value={form.disc_hdr_percent} onChange={(e) => updateField("disc_hdr_percent", Number(e.target.value || 0))} /></CField>
            
            <CField label="Pay Terms" className="col-span-2"><Input disabled={headerAndLineDisabled} value={form.payment_terms} onChange={(e) => updateField("payment_terms", e.target.value)} /></CField>
            <CField label="Remarks" className="col-span-2"><Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} /></CField>
   {(String(docType ?? "").trim().toUpperCase() === "LPO" && (
              <><CField label="Delivery Contact Person"><Input disabled={headerAndLineDisabled} value={form.dlvr_contact} onChange={(e) => updateField("dlvr_contact", e.target.value)} /></CField>
            <CField label=" Delivery Telephone"><Input disabled={headerAndLineDisabled} value={form.dlvr_mobile} onChange={(e) => updateField("dlvr_mobile", e.target.value)} /></CField>
            <CField label="Delivery Email Address"className="col-span-1"><Input type="email" disabled={headerAndLineDisabled} value={form.dlvr_email} onChange={(e) => updateField("dlvr_email", e.target.value)} /></CField>
             <CField label="Delivery Term"><Input disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} /></CField>
                      </>
            ))}

          </CompactSection>
          
        </div>

        {/* RIGHT COLUMN: BOXED SECTIONS */}
        <div className="lg:col-span-4 p-2 flex flex-col gap-2">
          
          {/* Tax Section */}
          <SideBox label="Tax Configuration">
            <CField label="Tax Type">
              <Select value={form.tx_compnt_1_expmt || "N"} onChange={(e) => {
                const taxType = e.target.value;
                setForm((current) => ({ ...current, tx_compnt_1_expmt: taxType, tx_compnt_1_pct: taxType === "S" ? 5 : 0 }));
              }}>
                <option value="N">No Tax</option><option value="S">Std Tax</option><option value="Z">Zero</option><option value="E">Exempt</option>
              </Select>
            </CField>
            
            <LookupField
              label="Tax Category"
              value={form.tx_cat_code || ""}
              displayValue={form.tx_cat_name ? `${form.tx_cat_code} - ${form.tx_cat_name}` : form.tx_cat_code}
              columns={[{ field: "tx_cat_code_1", header: "Code" }, { field: "tx_cat_name", header: "Name" }]}
              valueField="tx_cat_code"
              displayFields={["tx_cat_code", "tx_cat_name"]}
              loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CATEGORY", code1: companyCode, loginid: loginIdOrAdmin })}
              disabled={disabled}
              onChange={(value, row) => setForm((current) => ({ ...current, tx_cat_code: value, tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")) }))}
            />

            <LookupField
              label="Tax Code"
              value={form.tx_compntcat_code_1 || ""}
              displayValue={form.tx_compntcat_code_1 || ""}
              columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
              valueField="tx_compntcat_code"
              displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
              loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
              disabled={headerAndLineDisabled}
              onChange={(value) => setForm((current) => ({ ...current, tx_compntcat_code_1: value }))}
            />
            
            <CField label="Expense A/c Post">
              <Select disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </CField>
          </SideBox>

          {/* Project & Scope Section */}
          {(String(docType ?? "").trim().toUpperCase() === "LPO") && (
            <SideBox label="Project & Scope">
              <CField label="Project Name"><Input disabled={headerAndLineDisabled} value={form.project_name} onChange={(e) => updateField("project_name", e.target.value)} /></CField>
              <CField label="PR No"><Input className="text-right" disabled={headerAndLineDisabled} value={form.pr_no} onChange={(e) => updateField("pr_no", e.target.value)} /></CField>
              <CField label="Scope of Work"><Input disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(e) => updateField("scope_of_work", e.target.value)} /></CField>
            </SideBox>
          )}

          {/* Delivery Section */}
          {(String(docType ?? "").trim().toUpperCase() === "SO" && (
              <><SideBox label="Delivery Details">
              <CField label="Delivery Contact Person"><Input disabled={headerAndLineDisabled} value={form.dlvr_contact} onChange={(e) => updateField("dlvr_contact", e.target.value)} /></CField>
            <CField label=" Delivery Telephone"><Input disabled={headerAndLineDisabled} value={form.dlvr_mobile} onChange={(e) => updateField("dlvr_mobile", e.target.value)} /></CField>
            <CField label="Delivery Email Address"className="col-span-1"><Input type="email" disabled={headerAndLineDisabled} value={form.dlvr_email} onChange={(e) => updateField("dlvr_email", e.target.value)} /></CField>
             <CField label="Delivery Term"><Input disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} /></CField>
          </SideBox>
                   </>
            ))}


        </div>
      </div>
    </div>
  );
}