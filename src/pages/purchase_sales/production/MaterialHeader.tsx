import { ReactNode } from "react";
import { Briefcase, Building2, FileText } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { PODocType, PurchaseOrderForm, PurchaseOrderLineRow } from "../../purchase_sales/purchase/Purchaseordertypes";
import { numberOrZero, text } from "../../purchase_sales/purchase/Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";

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

export function MaterialHeaderForm({
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
    const docTypeUpper = String(docType ?? "").trim().toUpperCase();

  return (
    <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
      {/* THREE COLUMNS (same fields as the old Material Issue screen):
          left   = Document Details  (Doc No, Doc Date, Ref No, Ref Date, Division, JobCard No)
          middle = Account Details   (A/c code, Dept, Currency, Ex Rate, Delivery Term)
          right  = Other Details     (Remarks, Order Details, Confirm, Print on Letter Head) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)] gap-1.5 p-1.5 items-stretch">

        {/* LEFT COLUMN — Document Details */}
        <div className="flex flex-col gap-1.5">
          <HeaderBlock label="Document Details" icon={<FileText size={11} />} gridCols="grid-cols-2" grow>
            <div className="col-span-1">
              <LookupField
                label="A/c Code*"
                value={form.ac_code}
                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "party_address", header: "Address" }, { field: "party_phone", header: "Tel" }, { field: "party_fax", header: "Fax" }]}
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
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 col-span-1">
            <CField label="Doc Date" required>
              <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
            </CField>
            <CField label="Ref No">
              <Input className="h-7 text-xs" type="text" disabled={headerAndLineDisabled} value={form.ref_no} onChange={(e) => updateField("ref_no", e.target.value)} />
            </CField>
            <CField label="Ref Date">
              <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(e) => updateField("ref_date", e.target.value)} />
            </CField>
            </div>
             <CField label="Remarks" className="col-span-2">
              <textarea
                className="h-[48px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs"
                disabled={headerAndLineDisabled}
                value={form.remarks || ""}
                onChange={(e) => updateField("remarks", e.target.value)}
              />
            </CField>
        
        
          </HeaderBlock>
        </div>

        {/* MIDDLE COLUMN — Account Details */}
        <div className="flex flex-col gap-1.5">
          <HeaderBlock label="Account Details" icon={<Building2 size={11} />} gridCols="grid-cols-3" grow>
          

                    <div className="col-span-1 grid grid-cols-[minmax(0,1fr)_80px] gap-x-2">
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
            </div>

            <div className="col-span-1">
              <LookupField
                label="Dept Code"
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
                 <LookupField
              label="JobCard No"
              value={form.job_no || ""}
              displayValue={form.job_name ? `${form.job_no} - ${form.job_name}` : form.job_no || ""}
              columns={[{ field: "job_no", header: "Job No" }, { field: "job_name", header: "Name" }]}
              valueField="job_no"
              displayFields={["job_no", "job_name"]}
              loadOptions={() => getDynamicLookup({ parameter: "PS_JOB_CARD_NO_LIST", code1: companyCode, code2: form.div_code, loginid: loginIdOrAdmin })}
              disabled={headerAndLineDisabled}
              onChange={(value, row) =>
                setForm((current) => ({
                  ...current,
                  job_no: text(value),
                  job_name: text(getLookupValue(row || {}, "job_name")),
                }))
              }
            />
              <CField label="Delivery Term" className="col-span-1">
              <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} />
            </CField>
           { docTypeUpper === "MIS" && (
              <CField label="Order Details" className="col-span-2">
                <Input
                  className="h-7 w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs"
                  disabled={headerAndLineDisabled}
                  value={form.order_details || ""}
                  onChange={(e) => updateField("order_details" as keyof PurchaseOrderForm, e.target.value)}
              />
            </CField>)}

          
          </HeaderBlock>
        </div>

        {/* RIGHT COLUMN — Other Details */}
        {/* <div className="flex flex-col gap-1.5">
          <HeaderBlock label="Other Details" icon={<Briefcase size={11} />} gridCols="grid-cols-2" grow>
              <LookupField
              label="JobCard No"
              value={form.job_no || ""}
              displayValue={form.job_name ? `${form.job_no} - ${form.job_name}` : form.job_no || ""}
              columns={[{ field: "job_no", header: "Job No" }, { field: "job_name", header: "Name" }]}
              valueField="job_no"
              displayFields={["job_no", "job_name"]}
              loadOptions={() => getDynamicLookup({ parameter: "PS_JOB_CARD_NO_LIST", code1: companyCode, code2: form.div_code, loginid: loginIdOrAdmin })}
              disabled={headerAndLineDisabled}
              onChange={(value, row) =>
                setForm((current) => ({
                  ...current,
                  job_no: text(value),
                  job_name: text(getLookupValue(row || {}, "job_name")),
                }))
              }
            />
              <CField label="Delivery Term" className="col-span-2">
              <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} />
            </CField>
            <CField label="Order Details" className="col-span-2">
              <textarea
                className="h-[48px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs"
                disabled={headerAndLineDisabled}
                value={form.order_details || ""}
                onChange={(e) => updateField("order_details" as keyof PurchaseOrderForm, e.target.value)}
              />
            </CField>
           
           
          </HeaderBlock>
        </div> */}

      </div>
    </div>
  );
}