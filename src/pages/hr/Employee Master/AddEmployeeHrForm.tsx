import {
  forwardRef, useImperativeHandle, useState, type ChangeEvent,
} from "react";
import { BookOpen, Building2, FileText, IdCard, Plane, ShieldCheck, User, Wallet } from "lucide-react";
import type {
  TAirfareHr, TContractHr, TEmployeeHr, TILPHr, TIsuranceHr,
  TPassportHr, TPayrollHr, TPersnolHr, TSponsorHr,
} from "./employee-hr.types";
import { Input } from "../../../components/ui/Input";
import { ParamLookup, MasterLookup } from "../../../components/ui/HrLookups";
import { useToast } from "../../../components/ui/AlertToast";
import { useAuth } from "../../../state/AuthContext";
import { insUpdHrEmployee } from "../../../api/hr";
import { fromInputDate, toInputDatenull } from "../../../hooks/apiDate";
import ImageCrop from "./ImageCrop";
import type { ReactNode } from "react";

/* ================= TYPES ================= */

export type EmployeeFormHandle = {
  save: () => Promise<void>;
};

type Props = {
  isEditMode: boolean;
  existingData?: TEmployeeHr;
  onSaved: () => void;
};

type TEmployeeForm = TPersnolHr & TPayrollHr & TPassportHr & TContractHr &
  TSponsorHr & TIsuranceHr & TILPHr & TAirfareHr;
type K = keyof TEmployeeForm;

/* ================= HELPERS ================= */

const CTL = "h-7 text-xs";
const nil = null as never; 

const buildInitial = (companyCode: string): TEmployeeForm => ({
  company_code: companyCode, employer_code: companyCode, div_code: "", dept_code: "", section_code: "",
  emp_photo: "", employee_code: "", employee_id: "", alternate_id: "", rpt_name: "", grade_code: "",
  desg_code: "", labour_desg_code: "", category_code: "", birth_date: nil, join_date: nil,
  probation_end_date: nil, probation_confirm_date: nil, emp_status: "", country_code: "",
  include_in_payroll: "", payroll_start_date: nil, payment_mode: "", company_bank_code: "",
  salary_acct_no: "", salary_bank_code: "", currency_id: "", exch_rate: nil, emp_iban_no: "",
  ppt_no: "", ppt_name: "", ppt_country: "", ppt_status: "", ppt_valid_from: nil, ppt_valid_to: nil, passport_with: "",
  contract_type: "", contract_start_date: nil, contract_end_date: nil, contract_renewable: "",
  sponsor_id: nil, visa_type: "", visa_valid_from: nil, visa_valid_to: nil,
  ins_card_no: "", ins_card_issue_dt: nil, ins_card_exp_dt: nil, ins_card_type: "",
  labourcard_no: "", pasi_no: "", labourcard_valid_from: nil, labourcard_valid_to: nil, labourcard_status: "",
  airport_code: "", ticket_eligibility: "", ticket_dpend_adult: nil, ta_no: nil, tc_no: nil, ti_no: nil, ticket_eligible_period: nil,
});

const mergeExisting = (base: TEmployeeForm, existing?: TEmployeeHr): TEmployeeForm => {
  if (!existing) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const v = (existing as Record<string, unknown>)[key];
    if (v === undefined) continue;
    out[key] = v instanceof Date && v.getTime() === 0 ? null : v;
  }
  return out as TEmployeeForm;
};

const REQUIRED: [K, string][] = [
  ["alternate_id", "Alternate Id"], ["rpt_name", "Name"], ["birth_date", "Date Of Birth"],
  ["div_code", "Division"], ["dept_code", "Department"], ["section_code", "Section"],
  ["grade_code", "Grade"], ["desg_code", "Designation"], ["labour_desg_code", "Formal Designation"],
  ["category_code", "Category"], ["join_date", "Date Of Joining"], ["probation_end_date", "Probation End Date"],
  ["probation_confirm_date", "Confirmation Date"], ["emp_status", "Employment Status"], ["country_code", "Country"],
  ["include_in_payroll", "Include In Payment"],
  ["contract_type", "Contract Type"], ["contract_start_date", "Start Date"], ["contract_end_date", "End Date"], ["contract_renewable", "Renewable"],
  ["sponsor_id", "Sponsor"], ["visa_type", "Visa Type"], ["visa_valid_from", "Valid From"], ["visa_valid_to", "Valid To"],
  ["labourcard_no", "ID/Labourcard No."], ["labourcard_valid_from", "Valid From"], ["labourcard_valid_to", "Valid To"], ["labourcard_status", "Status"],
];

const DATE_RANGES: [K, K][] = [
  ["join_date", "probation_end_date"],
  ["ppt_valid_from", "ppt_valid_to"],
  ["contract_start_date", "contract_end_date"],
  ["visa_valid_from", "visa_valid_to"],
  ["ins_card_issue_dt", "ins_card_exp_dt"],
  ["labourcard_valid_from", "labourcard_valid_to"],
];

const validate = (v: TEmployeeForm): Partial<Record<K, string>> => {
  const errors: Partial<Record<K, string>> = {};
  REQUIRED.forEach(([k]) => {
    if (v[k] === null || v[k] === undefined || v[k] === "") errors[k] = "Required";
  });
  DATE_RANGES.forEach(([from, to]) => {
    if (v[from] && v[to] && new Date(v[to] as Date) < new Date(v[from] as Date)) {
      errors[to] = "Must be after start date";
    }
  });
  return errors;
};

/* ─────────────── UI building blocks ─────────────── */

function HeaderBlock({
  label,
  icon,
  children,
  gridCols = "grid-cols-2",
  bodyClass,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  gridCols?: string;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md border border-[#cbd5e1] bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-slate-50 px-2.5 py-1">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
          {icon}
        </span>
        <span className="text-xs font-bold text-[#00378C]">{label}</span>
      </div>
      <div
        className={
          bodyClass ?? `grid gap-x-2 gap-y-1.5 px-2.5 py-2 ${gridCols} max-md:grid-cols-1`
        }
      >
        {children}
      </div>
    </div>
  );
}

function CField({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </label>
  );
}

/* ================= FORM ================= */

export const AddEmployeeHrForm = forwardRef<EmployeeFormHandle, Props>(
  function AddEmployeeHrForm({ isEditMode, existingData, onSaved }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [form, setForm] = useState<TEmployeeForm>(() =>
      mergeExisting(buildInitial(user?.company_code ?? "BSG"), isEditMode ? existingData : undefined),
    );
    const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
    const [photoDialog, setPhotoDialog] = useState(false);

    const patch = (p: Partial<TEmployeeForm>) => {
      setForm((prev) => ({ ...prev, ...p }));
      setErrors((prev) => {
        const next = { ...prev };
        (Object.keys(p) as K[]).forEach((k) => delete next[k]);
        return next;
      });
    };
    const set = (name: K, value: unknown) => patch({ [name]: value } as Partial<TEmployeeForm>);
    const pick = (name: K) => (v: string) => set(name, v);

    const text = (name: K) => ({
      value: (form[name] as string | null) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, e.target.value),
    });
    const date = (name: K) => ({
      type: "date" as const,
      value: toInputDatenull(form[name] as Date | null),
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, fromInputDate(e.target.value)),
    });
    const num = (name: K) => ({
      type: "number" as const,
      min: 0,
      value: (form[name] as number | null) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        set(name, e.target.value === "" ? null : Math.max(0, Number(e.target.value))),
    });

    const handleSave = async () => {
      const found = validate(form);
      setErrors(found);
      if (Object.keys(found).length) {
        toast.warning("Please fill all required fields");
        return;
      }
      try {
        const response = await insUpdHrEmployee(form);
        if (response) {
          toast.success(isEditMode ? "Employee updated successfully" : "Employee added successfully");
          onSaved();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save employee");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard grid items-start gap-1.5">
        
        {/* ══════════ TOP HALF ══════════ */}
        <div className="grid items-start gap-1.5 xl:grid-cols-3">
          {/* Personal Information (Spans 2 cols) */}
          <div className="xl:col-span-2">
            <HeaderBlock
              label="Personal Information"
              icon={<User size={11} />}
              bodyClass="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_150px] gap-x-3 gap-y-2 p-2"
            >
              {/* Row 1 */}
              <CField label="Division" required error={errors.div_code}>
                <ParamLookup parameter="MS_EMP_HR_EMPLOYEE_DIVISION" valueField="div_code" descField="div_name" descHeader="Division" value={form.div_code} onChange={(v) => patch({ div_code: v, dept_code: "", section_code: "" })} />
              </CField>
              <CField label="Department" required error={errors.dept_code}>
                <ParamLookup key={form.div_code} parameter="MS_EMP_HR_EMPLOYEE_DEPARTMENT" code2={form.div_code ?? ""} valueField="dept_code" descField="dept_name" descHeader="Department" value={form.dept_code} disabled={!form.div_code} onChange={(v) => patch({ dept_code: v, section_code: "" })} />
              </CField>
              <CField label="Section" required error={errors.section_code}>
                <ParamLookup key={form.dept_code} parameter="MS_EMP_HR_EMPLOYEE_SECTION" code2={form.dept_code ?? ""} valueField="section_code" descField="section_name" descHeader="Section" value={form.section_code} disabled={!form.dept_code} onChange={pick("section_code")} />
              </CField>
              <CField label="Employee Code">
                <Input className={CTL} value={form.employee_code || (isEditMode ? "" : "Auto")} disabled readOnly />
              </CField>

              {/* Row 2 */}
              <CField label="Alternate Id" required error={errors.alternate_id}>
                <Input className={CTL} {...text("alternate_id")} disabled={isEditMode} />
              </CField>
              <CField label="Name" required error={errors.rpt_name}>
                <Input className={CTL} {...text("rpt_name")} />
              </CField>
              <CField label="Grade" required error={errors.grade_code}>
                <ParamLookup parameter="MS_EMP_HR_EMPLOYEE_GRADE" valueField="grade_code" descField="grade_name" descHeader="Grade" value={form.grade_code} onChange={pick("grade_code")} />
              </CField>
              <CField label="Designation" required error={errors.desg_code}>
                <ParamLookup parameter="MS_EMP_HR_EMPLOYEE_DESIGNATION" valueField="desg_code" descField="desg_name" descHeader="Designation" value={form.desg_code} onChange={pick("desg_code")} />
              </CField>

              {/* Row 3 */}
              <CField label="Formal Designation" required error={errors.labour_desg_code}>
                <ParamLookup parameter="MS_EMP_HR_EMPLOYEE_LABOUR_DESG" valueField="labour_desg_code" descField="labour_desg_name" descHeader="Formal Designation" value={form.labour_desg_code} onChange={pick("labour_desg_code")} />
              </CField>
              <CField label="Category" required error={errors.category_code}>
                <ParamLookup parameter="MS_EMP_HR_EMPLOYEE_CATEGORY" valueField="category_code" descField="category_name" descHeader="Category" value={form.category_code} onChange={pick("category_code")} />
              </CField>
              <CField label="Date Of Birth" required error={errors.birth_date}>
                {/* Removed explicit type="date" here to fix duplicate prop error */}
                <Input className={CTL} {...date("birth_date")} />
              </CField>
              <CField label="Date Of Joining" required error={errors.join_date}>
                <Input className={CTL} {...date("join_date")} max={toInputDatenull(form.probation_end_date)} />
              </CField>

              {/* Row 4 */}
              <CField label="Probation End Date" required error={errors.probation_end_date}>
                <Input className={CTL} {...date("probation_end_date")} min={toInputDatenull(form.join_date)} />
              </CField>
              <CField label="Confirmation Date" required error={errors.probation_confirm_date}>
                <Input className={CTL} {...date("probation_confirm_date")} />
              </CField>
              <CField label="Employment Status" required error={errors.emp_status}>
                <ParamLookup parameter="MS_EMP_HR_EMPLOYEE_STATUS" valueField="empstatus_code" descField="empstatus_name" descHeader="Status" value={form.emp_status} onChange={pick("emp_status")} />
              </CField>
              <CField label="Country" required error={errors.country_code}>
                <MasterLookup master="country" value={form.country_code} onChange={pick("country_code")} />
              </CField>

              {/* Photo - 5th Column */}
              <div className="flex justify-center items-center sm:col-span-2 lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:row-span-4 py-2">
                <button
                  type="button"
                  onClick={() => setPhotoDialog(true)}
                  title={form.emp_photo ? "Change Picture" : "Upload Profile Picture"}
                  className="flex h-[190px] w-[140px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border hover:border-primary"
                >
                  {form.emp_photo ? (
                    <img src={form.emp_photo} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-center text-xs leading-tight text-muted-foreground">Upload</span>
                  )}
                </button>
              </div>
            </HeaderBlock>
          </div>

          {/* Passport Information (Spans 1 col) */}
          <div>
            <HeaderBlock label="Passport Information" icon={<BookOpen size={11} />} gridCols="grid-cols-2">
              <CField label="Passport No."><Input className={CTL} {...text("ppt_no")} /></CField>
              <CField label="Passport Name"><Input className={CTL} {...text("ppt_name")} /></CField>
              <CField label="Issued Country"><MasterLookup master="country" value={form.ppt_country} onChange={pick("ppt_country")} /></CField>
              <CField label="Passport In Hand"><ParamLookup parameter="MS_EMP_HR_PASSPORT_WITH" valueField="value_code" descField="value_desc" value={form.passport_with} onChange={pick("passport_with")} /></CField>
              <CField label="Valid From"><Input className={CTL} {...date("ppt_valid_from")} /></CField>
              <CField label="Valid To" error={errors.ppt_valid_to}><Input className={CTL} {...date("ppt_valid_to")} min={toInputDatenull(form.ppt_valid_from)} disabled={!form.ppt_valid_from} /></CField>
              <CField label="Status" className="col-span-2"><ParamLookup parameter="MS_EMP_HR_PASSPORT_STATUS" valueField="value_code" descField="value_desc" value={form.ppt_status} onChange={pick("ppt_status")} /></CField>
            </HeaderBlock>
          </div>
        </div>

        {/* ══════════ BOTTOM HALF (4 Columns) ══════════ */}
        <div className="grid gap-1.5 xl:grid-cols-4">
          
          {/* Column 1: Payroll */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock className="flex-1" label="Payroll Information" icon={<Wallet size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
              <CField label="Include In Payment" required error={errors.include_in_payroll}><ParamLookup parameter="MS_EMP_HR_INCLUDE_PAYROLL" valueField="value_code" descField="value_desc" value={form.include_in_payroll} onChange={pick("include_in_payroll")} /></CField>
              <CField label="Payroll Start Date"><Input className={CTL} {...date("payroll_start_date")} /></CField>
              <CField label="Mode Of Payment"><ParamLookup parameter="MS_EMP_HR_PAYMENT_MODE" valueField="value_code" descField="value_desc" value={form.payment_mode} onChange={pick("payment_mode")} /></CField>
              <CField label="Paying Bank"><ParamLookup parameter="MS_EMP_HR_EMPLOYEE_BANK" valueField="bank_code" descField="bank_name" descHeader="Bank" value={form.company_bank_code} onChange={pick("company_bank_code")} /></CField>
              <CField label="Employee Bank"><ParamLookup parameter="MS_EMP_HR_EMPLOYEE_BANK" valueField="bank_code" descField="bank_name" descHeader="Bank" value={form.salary_bank_code} onChange={pick("salary_bank_code")} /></CField>
              <CField label="Bank Account No."><Input className={CTL} {...text("salary_acct_no")} /></CField>
              <CField label="Bank IBAN No." className="sm:col-span-2"><Input className={CTL} {...text("emp_iban_no")} /></CField>
              <div className="sm:col-span-2 grid grid-cols-[1fr_5rem] gap-2">
                <CField label="Currency"><MasterLookup master="currency" value={form.currency_id} onChange={pick("currency_id")} /></CField>
                <CField label="Exch. Rate"><Input {...num("exch_rate")} className={`${CTL} text-right`} /></CField>
              </div>
            </HeaderBlock>
          </div>

          {/* Column 2: Contract + Insurance */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock label="Contract Information" icon={<FileText size={11} />} gridCols="grid-cols-1 sm:grid-cols-3">
              <CField label="Contract Type" required error={errors.contract_type}><ParamLookup parameter="MS_EMP_HR_EMPLOYEE_CONTRACT" valueField="contract_type" descField="contract_type_desc" value={form.contract_type} onChange={pick("contract_type")} /></CField>
              <CField label="Start Date" required error={errors.contract_start_date}><Input className={CTL} {...date("contract_start_date")} /></CField>
              <CField label="End Date" required error={errors.contract_end_date}><Input className={CTL} {...date("contract_end_date")} min={toInputDatenull(form.contract_start_date)} disabled={!form.contract_start_date} /></CField>
              <CField label="Renewable" required error={errors.contract_renewable} className="sm:col-span-3"><ParamLookup parameter="MS_EMP_HR_CONTRACT_RENEWABLE" valueField="value_code" descField="value_desc" value={form.contract_renewable} onChange={pick("contract_renewable")} /></CField>
            </HeaderBlock>

            <HeaderBlock className="flex-1" label="Insurance Information" icon={<ShieldCheck size={11} />} gridCols="grid-cols-1 sm:grid-cols-3">
              <CField label="Card No." className="sm:col-span-2"><Input className={CTL} value={form.ins_card_no ?? ""} onChange={(e) => e.target.value.charAt(0) !== "-" && set("ins_card_no", e.target.value)} /></CField>
              <CField label="Type"><Input className={CTL} {...text("ins_card_type")} /></CField>
              <CField label="Valid From"><Input className={CTL} {...date("ins_card_issue_dt")} /></CField>
              <CField label="Valid To" error={errors.ins_card_exp_dt}><Input className={CTL} {...date("ins_card_exp_dt")} min={toInputDatenull(form.ins_card_issue_dt)} disabled={!form.ins_card_issue_dt} /></CField>
            </HeaderBlock>
          </div>

          {/* Column 3: Sponsor + ID / Labour */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock label="Sponsor Information" icon={<Building2 size={11} />} gridCols="grid-cols-1 sm:grid-cols-3">
              <CField label="Sponsor Name" required error={errors.sponsor_id} className="sm:col-span-2"><ParamLookup parameter="MS_EMP_HR_EMPLOYEE_SPONSOR" valueField="sponsor_code" descField="sponsor_name" descHeader="Sponsor" value={form.sponsor_id} onChange={pick("sponsor_id")} /></CField>
              <CField label="Visa Type" required error={errors.visa_type}><ParamLookup parameter="MS_EMP_HR_VISA_TYPE" valueField="value_code" descField="value_desc" value={form.visa_type} onChange={pick("visa_type")} /></CField>
              <CField label="Valid From" required error={errors.visa_valid_from}><Input className={CTL} {...date("visa_valid_from")} /></CField>
              <CField label="Valid To" required error={errors.visa_valid_to}><Input className={CTL} {...date("visa_valid_to")} min={toInputDatenull(form.visa_valid_from)} disabled={!form.visa_valid_from} /></CField>
            </HeaderBlock>

            <HeaderBlock className="flex-1" label="Id / Labour Card / PASI No." icon={<IdCard size={11} />} gridCols="grid-cols-1 sm:grid-cols-3">
              <CField label="ID/Labourcard No." required error={errors.labourcard_no} className="sm:col-span-1"><Input className={CTL} {...text("labourcard_no")} /></CField>
              <CField label="PASI No." className="sm:col-span-2"><Input className={CTL} {...text("pasi_no")} /></CField>
              <CField label="Valid From" required error={errors.labourcard_valid_from}><Input className={CTL} {...date("labourcard_valid_from")} /></CField>
              <CField label="Valid To" required error={errors.labourcard_valid_to}><Input className={CTL} {...date("labourcard_valid_to")} min={toInputDatenull(form.labourcard_valid_from)} disabled={!form.labourcard_valid_from} /></CField>
              <CField label="Status" required error={errors.labourcard_status}><ParamLookup parameter="MS_EMP_HR_LABOUR_CARD_STATUS" valueField="value_code" descField="value_desc" value={form.labourcard_status} onChange={pick("labourcard_status")} /></CField>
            </HeaderBlock>
          </div>

          {/* Column 4: Airfare */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock className="flex-1" label="Airfare Information" icon={<Plane size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
              <CField label="Fare Code"><ParamLookup parameter="MS_EMP_HR_AIRPORT" valueField="airport_code" descField="airport_name" descHeader="Airport" value={form.airport_code} onChange={pick("airport_code")} /></CField>
              <CField label="Eligibility"><ParamLookup parameter="MS_EMP_HR_TICKET_ELIGIBILITY" valueField="value_code" descField="value_desc" value={form.ticket_eligibility} onChange={pick("ticket_eligibility")} /></CField>
              <CField label="Adult Dependent"><Input className={CTL} {...num("ticket_dpend_adult")} /></CField>
              <CField label="Ticket Once (Months)"><Input className={CTL} {...num("ticket_eligible_period")} /></CField>
              <CField label="Total Adults"><Input className={CTL} {...num("ta_no")} /></CField>
              <CField label="Childrens"><Input className={CTL} {...num("tc_no")} /></CField>
              <CField label="Infants" className="sm:col-span-2"><Input className={CTL} {...num("ti_no")} /></CField>
            </HeaderBlock>
          </div>
        </div>

        {photoDialog && (
          <ImageCrop
            Image={form.emp_photo}
            open={photoDialog}
            onClose={() => setPhotoDialog(false)}
            onSubmit={(url: string) => {
              set("emp_photo", url);
              setPhotoDialog(false);
            }}
            dialogTitle="Upload Profile Picture"
          />
        )}
      </div>
    );
  },
);

export default AddEmployeeHrForm;