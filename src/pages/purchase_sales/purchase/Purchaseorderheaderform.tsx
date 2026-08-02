import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PurchaseOrderForm } from "./Purchaseordertypes";
import { text } from "./Purchaseorderutils";

function CompactSection({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border-t px-3 py-1.5 first:border-t-0 ${className || ""}`}>
      {/* <p className="m-0 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p> */}
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

export function PurchaseOrderHeaderForm({
  form,
  setForm,
  updateField,
  disabled,
  headerAndLineDisabled,
  editMode,
  companyCode,
  loginid,
}: {
  form: PurchaseOrderForm;
  setForm: (updater: (current: PurchaseOrderForm) => PurchaseOrderForm) => void;
  updateField: (field: keyof PurchaseOrderForm, value: string | number) => void;
  disabled: boolean;
  headerAndLineDisabled: boolean;
  editMode: boolean;
  companyCode?: string;
  loginid?: string;
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
      {/* <h3 className="m-0 text-sm font-semibold leading-tight">Request Information</h3> */}

      <CompactSection label="Document & Party">
        {editMode && <CField label="Doc No"><Input disabled value={form.doc_no || ""} /></CField>}
        <CField label="Doc Date *">
          <Input type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(event) => updateField("doc_date", event.target.value)} />
        </CField>
        <CField label="Quotn No">
          <Input disabled={headerAndLineDisabled} value={form.ref_no} onChange={(event) => updateField("ref_no", event.target.value)} />
        </CField>
        <CField label="Quotn Date">
          <Input type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(event) => updateField("ref_date", event.target.value)} />
        </CField>

        <div className="col-span-1">
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

        <div className="col-span-1">
          <LookupField
            label="A/c code *"
            value={form.ac_code}
            displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
            columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "address", header: "Address" }, { field: "tel", header: "Tel" }, { field: "fax", header: "Fax" }]}
            valueField="ac_code"
            displayFields={["ac_code", "ac_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_HDR", code1: companyCode, loginid: loginIdOrAdmin })}
            disabled={headerAndLineDisabled}
            onChange={(value, row) => setForm((current) => ({
              ...current,
              ac_code: value,
              ac_name: text(getLookupValue(row || {}, "ac_name")),
              address: text(getLookupValue(row || {}, "address")) || current.address,
              tel: text(getLookupValue(row || {}, "tel")) || current.tel,
              fax: text(getLookupValue(row || {}, "fax")) || current.fax,
            }))}
          />
        </div>

        <CField label="Credit Period">
          <Input disabled={headerAndLineDisabled} type="number" step="1" value={form.credit_period} onChange={(event) => updateField("credit_period", Number(event.target.value || 0))} />
        </CField>
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
        <CField label="Tel">
          <Input disabled={headerAndLineDisabled} value={form.tel} onChange={(event) => updateField("tel", event.target.value)} />
        </CField>
        <CField label="Address" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.address} onChange={(event) => updateField("address", event.target.value)} />
        </CField>

        <CField label="Fax">
          <Input disabled={headerAndLineDisabled} value={form.fax} onChange={(event) => updateField("fax", event.target.value)} />
        </CField>
      </CompactSection>


      <CompactSection label="Order, Currency & Tax">
        <CField label="Buyer">
          <Input disabled={headerAndLineDisabled} value={form.buyer} onChange={(event) => updateField("buyer", event.target.value)} />
        </CField>
        <CField label="WO No">
          <Input disabled={headerAndLineDisabled} value={form.wo_no} onChange={(event) => updateField("wo_no", event.target.value)} />
        </CField>

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
              ex_rate: Number(getLookupValue(row || {}, "ex_rate") || (row as Record<string, unknown>)?.ex_rate || current.ex_rate || 1),
            }))}
          />
        </div>

        <CField label="Ex Rate" className="w-18">
          <Input disabled={headerAndLineDisabled} type="number" step="0.000001" value={form.ex_rate} onChange={(event) => updateField("ex_rate", Number(event.target.value || 1))} />
        </CField>
        <CField label="Disc Amt">
          <Input disabled={headerAndLineDisabled} type="number" step="0.01" value={form.disc_amt} onChange={(event) => updateField("disc_amt", Number(event.target.value || 0))} />
        </CField>
        <CField label="Disc %">
          <Input disabled={headerAndLineDisabled} type="number" step="0.01" value={form.disc_pct} onChange={(event) => updateField("disc_pct", Number(event.target.value || 0))} />
        </CField>
        <div>
          <label className="mb-1 block text-xs font-semibold text-primary-foreground/80">Tax Category</label>
          <LookupField
            label="Tax Category"
            compact
            placeholder="Tax code"
            value={form.tax_category || ""}
            displayValue={form.tax_category || ""}
            columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
            valueField="tx_compntcat_code"
            displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
            disabled={disabled}
            // onChange={(value) => setForm((current) => ({ ...current, tax_category: value }))}
            onChange={(value, row) => setForm((current) => ({
              ...current,
              tax_category: value,
              tax_code: text(getLookupValue(row || {}, "tx_compntcat_code")),
            }))}
          />
        </div>

        <CField label="TAX Code">
          <Input disabled={headerAndLineDisabled} value={form.tax_code} onChange={(event) => updateField("tax_code", event.target.value)} />
        </CField>


        <CField label="Pay Terms" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.pay_terms} onChange={(event) => updateField("pay_terms", event.target.value)} />
        </CField>

        <CField label="Remarks" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
        </CField>

        <CField label="Delivery Term" className="col-span-1">
          <Input disabled={headerAndLineDisabled} value={form.delivery_term} onChange={(event) => updateField("delivery_term", event.target.value)} />
        </CField>
        <CField label="Expense A/c Post">
  <Select disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(event) => updateField("expense_ac_post", event.target.value)}>
    {EXPENSE_AC_OPTIONS.map((option) => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ))}
  </Select>
</CField>
      </CompactSection>

      <CompactSection label="Project, Scope & Delivery" className="border-b-0">
        {/* <div className="col-span-1">
          <LookupField
            label="Project Name"
            value={form.project_name}
            displayValue={form.project_name}
            columns={[{ field: "project_name", header: "Project" }]}
            valueField="project_name"
            displayFields={["project_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "MS_PROJECT_SEARCH", code1: companyCode, loginid: loginIdOrAdmin })}
            disabled={headerAndLineDisabled}
            onChange={(value) => setForm((current) => ({ ...current, project_name: value }))}
          />
        </div> */}

        <CField label="Project Name" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.project_name} onChange={(event) => updateField("project_name", event.target.value)} />
        </CField>
        <CField label="PR No">
          <Input disabled={headerAndLineDisabled} value={form.pr_no} onChange={(event) => updateField("pr_no", event.target.value)} />
        </CField>
        <CField label="Scope of Work" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(event) => updateField("scope_of_work", event.target.value)} />
        </CField>
        <CField label="Delivery Contact">
          <Input disabled={headerAndLineDisabled} value={form.delivery_contact} onChange={(event) => updateField("delivery_contact", event.target.value)} />
        </CField>
        <CField label="Delivery Tel">
          <Input disabled={headerAndLineDisabled} value={form.delivery_tel} onChange={(event) => updateField("delivery_tel", event.target.value)} />
        </CField>
        <CField label="Delivery Email" className="col-span-1">
          <Input disabled={headerAndLineDisabled} type="email" value={form.delivery_email} onChange={(event) => updateField("delivery_email", event.target.value)} />
        </CField>
      </CompactSection>
    </div>
  );
}