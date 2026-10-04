// Employee form — new UI
//  • forwardRef + useImperativeHandle → page header "Save" button calls save()
//  • SectionPanel / Field from shared Formblocks, toast for all feedback
//  • Single form state (no formik, no wizard)

import {
  forwardRef, useImperativeHandle, useState, type ChangeEvent,
} from "react";
import { BookOpen, Building2, FileText, IdCard, Plane, ShieldCheck, User, Wallet } from "lucide-react";
import type {
  TAirfareHr, TContractHr, TEmployeeHr, TILPHr, TIsuranceHr,
  TPassportHr, TPayrollHr, TPersnolHr, TSponsorHr,
} from "./employee-hr.types";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { ParamLookup, MasterLookup } from "../../../components/ui/HrLookups";
import { useToast } from "../../../components/ui/AlertToast";
import { useAuth } from "../../../state/AuthContext";
import { insUpdHrEmployee } from "../../../api/hr";
import { fromInputDate, toInputDatenull } from "../../../hooks/apiDate";
import ImageCrop from "./ImageCrop";

/* ================= TYPES ================= */

/** Exposed to the page so the header Save button can trigger save() */
export type EmployeeFormHandle = {
  save: () => Promise<void>;
};

type Props = {
  isEditMode: boolean;
  existingData?: TEmployeeHr;
  /** called after a successful save */
  onSaved: () => void;
};

type TEmployeeForm = TPersnolHr & TPayrollHr & TPassportHr & TContractHr &
  TSponsorHr & TIsuranceHr & TILPHr & TAirfareHr;
type K = keyof TEmployeeForm;

/* ================= HELPERS ================= */

const nil = null as never; // empty Date / number slots (types don't allow null)

const buildInitial = (companyCode: string): TEmployeeForm => ({
  // personal
  company_code: companyCode, employer_code: companyCode, div_code: "", dept_code: "", section_code: "",
  emp_photo: "", employee_code: "", employee_id: "", alternate_id: "", rpt_name: "", grade_code: "",
  desg_code: "", labour_desg_code: "", category_code: "", birth_date: nil, join_date: nil,
  probation_end_date: nil, probation_confirm_date: nil, emp_status: "", country_code: "",
  // payroll
  include_in_payroll: "", payroll_start_date: nil, payment_mode: "", company_bank_code: "",
  salary_acct_no: "", salary_bank_code: "", currency_id: "", exch_rate: nil, emp_iban_no: "",
  // passport
  ppt_no: "", ppt_name: "", ppt_country: "", ppt_status: "", ppt_valid_from: nil, ppt_valid_to: nil, passport_with: "",
  // contract
  contract_type: "", contract_start_date: nil, contract_end_date: nil, contract_renewable: "",
  // sponsor
  sponsor_id: nil, visa_type: "", visa_valid_from: nil, visa_valid_to: nil,
  // insurance
  ins_card_no: "", ins_card_issue_dt: nil, ins_card_exp_dt: nil, ins_card_type: "",
  // id / labour card
  labourcard_no: "", pasi_no: "", labourcard_valid_from: nil, labourcard_valid_to: nil, labourcard_status: "",
  // airfare
  airport_code: "", ticket_eligibility: "", ticket_dpend_adult: nil, ta_no: nil, tc_no: nil, ti_no: nil, ticket_eligible_period: nil,
});

/** Overlay an existing row on the blank form, keep only form keys, turn epoch dates into empty. */
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

// [field, label] — same required set as the old per-step checks
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

/** [start, end] pairs where end must not be before start */
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

    /* ── state helpers ── */
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

    /* ── input prop builders ── */
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

    /* ── Save (called by the page header Save button) ── */
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

    /* ── UI ── */
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        {/* ── Personal ── */}
        <SectionPanel title="Personal Information" icon={User}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:row-span-2 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPhotoDialog(true)}
                title={form.emp_photo ? "Change Picture" : "Upload Profile Picture"}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border hover:border-primary"
              >
                {form.emp_photo ? (
                  <img src={form.emp_photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Upload</span>
                )}
              </button>
              <span className="text-xs text-muted-foreground">Profile Picture</span>
            </div>

            <Field label="Name" required error={errors.rpt_name} className="md:col-span-2">
              <Input {...text("rpt_name")} />
            </Field>
            <Field label="Date Of Birth" required error={errors.birth_date}>
              <Input {...date("birth_date")} />
            </Field>

            {isEditMode && (
              <Field label="Employee Code">
                <Input value={form.employee_code} disabled readOnly />
              </Field>
            )}
            <Field label="Alternate Id" required error={errors.alternate_id}>
              <Input {...text("alternate_id")} disabled={isEditMode} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <Field label="Division" required error={errors.div_code}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_DIVISION" valueField="div_code" descField="div_name" descHeader="Division"
                value={form.div_code}
                onChange={(v) => patch({ div_code: v, dept_code: "", section_code: "" })}
              />
            </Field>
            <Field label="Department" required error={errors.dept_code}>
              <ParamLookup
                key={form.div_code} // reload options when the parent changes
                parameter="MS_EMP_HR_EMPLOYEE_DEPARTMENT" code2={form.div_code ?? ""}
                valueField="dept_code" descField="dept_name" descHeader="Department"
                value={form.dept_code} disabled={!form.div_code}
                onChange={(v) => patch({ dept_code: v, section_code: "" })}
              />
            </Field>
            <Field label="Section" required error={errors.section_code}>
              <ParamLookup
                key={form.dept_code}
                parameter="MS_EMP_HR_EMPLOYEE_SECTION" code2={form.dept_code ?? ""}
                valueField="section_code" descField="section_name" descHeader="Section"
                value={form.section_code} disabled={!form.dept_code}
                onChange={pick("section_code")}
              />
            </Field>
            <Field label="Category" required error={errors.category_code}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_CATEGORY" valueField="category_code" descField="category_name" descHeader="Category"
                value={form.category_code} onChange={pick("category_code")}
              />
            </Field>

            <Field label="Grade" required error={errors.grade_code}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_GRADE" valueField="grade_code" descField="grade_name" descHeader="Grade"
                value={form.grade_code} onChange={pick("grade_code")}
              />
            </Field>
            <Field label="Designation" required error={errors.desg_code}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_DESIGNATION" valueField="desg_code" descField="desg_name" descHeader="Designation"
                value={form.desg_code} onChange={pick("desg_code")}
              />
            </Field>
            <Field label="Formal Designation" required error={errors.labour_desg_code}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_LABOUR_DESG" valueField="labour_desg_code" descField="labour_desg_name" descHeader="Formal Designation"
                value={form.labour_desg_code} onChange={pick("labour_desg_code")}
              />
            </Field>
            <Field label="Employment Status" required error={errors.emp_status}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_STATUS" valueField="empstatus_code" descField="empstatus_name" descHeader="Status"
                value={form.emp_status} onChange={pick("emp_status")}
              />
            </Field>

            <Field label="Country" required error={errors.country_code}>
              <MasterLookup master="country" value={form.country_code} onChange={pick("country_code")} />
            </Field>
            <Field label="Date Of Joining" required error={errors.join_date}>
              <Input {...date("join_date")} max={toInputDatenull(form.probation_end_date)} />
            </Field>
            <Field label="Probation End Date" required error={errors.probation_end_date}>
              <Input {...date("probation_end_date")} min={toInputDatenull(form.join_date)} />
            </Field>
            <Field label="Confirmation Date" required error={errors.probation_confirm_date}>
              <Input {...date("probation_confirm_date")} />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Payroll ── */}
        <SectionPanel title="Payroll Information" icon={Wallet}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Include In Payment" required error={errors.include_in_payroll}>
              <ParamLookup
                parameter="MS_EMP_HR_INCLUDE_PAYROLL" valueField="value_code" descField="value_desc"
                value={form.include_in_payroll} onChange={pick("include_in_payroll")}
              />
            </Field>
            <Field label="Payroll Start Date">
              <Input {...date("payroll_start_date")} />
            </Field>
            <Field label="Mode Of Payment">
              <ParamLookup
                parameter="MS_EMP_HR_PAYMENT_MODE" valueField="value_code" descField="value_desc"
                value={form.payment_mode} onChange={pick("payment_mode")}
              />
            </Field>
            <Field label="Paying Bank">
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_BANK" valueField="bank_code" descField="bank_name" descHeader="Bank"
                value={form.company_bank_code} onChange={pick("company_bank_code")}
              />
            </Field>

            <Field label="Employee Bank">
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_BANK" valueField="bank_code" descField="bank_name" descHeader="Bank"
                value={form.salary_bank_code} onChange={pick("salary_bank_code")}
              />
            </Field>
            <Field label="Bank Account No.">
              <Input {...text("salary_acct_no")} />
            </Field>
            <Field label="Bank IBAN No.">
              <Input {...text("emp_iban_no")} />
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <Field label="Currency">
                <MasterLookup master="currency" value={form.currency_id} onChange={pick("currency_id")} />
              </Field>
              <Field label="Exch. Rate">
                <Input {...num("exch_rate")} className="text-right" />
              </Field>
            </div>
          </div>
        </SectionPanel>

        {/* ── Passport ── */}
        <SectionPanel title="Passport Information" icon={BookOpen}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Passport No."><Input {...text("ppt_no")} /></Field>
            <Field label="Passport Name"><Input {...text("ppt_name")} /></Field>
            <Field label="Issued Country">
              <MasterLookup master="country" value={form.ppt_country} onChange={pick("ppt_country")} />
            </Field>
            <Field label="Passport In Hand">
              <ParamLookup
                parameter="MS_EMP_HR_PASSPORT_WITH" valueField="value_code" descField="value_desc"
                value={form.passport_with} onChange={pick("passport_with")}
              />
            </Field>
            <Field label="Valid From"><Input {...date("ppt_valid_from")} /></Field>
            <Field label="Valid To" error={errors.ppt_valid_to}>
              <Input {...date("ppt_valid_to")} min={toInputDatenull(form.ppt_valid_from)} disabled={!form.ppt_valid_from} />
            </Field>
            <Field label="Status">
              <ParamLookup
                parameter="MS_EMP_HR_PASSPORT_STATUS" valueField="value_code" descField="value_desc"
                value={form.ppt_status} onChange={pick("ppt_status")}
              />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Contract ── */}
        <SectionPanel title="Contract Information" icon={FileText}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Contract Type" required error={errors.contract_type}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_CONTRACT" valueField="contract_type" descField="contract_type_desc"
                value={form.contract_type} onChange={pick("contract_type")}
              />
            </Field>
            <Field label="Start Date" required error={errors.contract_start_date}>
              <Input {...date("contract_start_date")} />
            </Field>
            <Field label="End Date" required error={errors.contract_end_date}>
              <Input {...date("contract_end_date")} min={toInputDatenull(form.contract_start_date)} disabled={!form.contract_start_date} />
            </Field>
            <Field label="Renewable" required error={errors.contract_renewable}>
              <ParamLookup
                parameter="MS_EMP_HR_CONTRACT_RENEWABLE" valueField="value_code" descField="value_desc"
                value={form.contract_renewable} onChange={pick("contract_renewable")}
              />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Sponsor ── */}
        <SectionPanel title="Sponsor Information" icon={Building2}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Sponsor Name" required error={errors.sponsor_id}>
              <ParamLookup
                parameter="MS_EMP_HR_EMPLOYEE_SPONSOR" valueField="sponsor_code" descField="sponsor_name" descHeader="Sponsor"
                value={form.sponsor_id} onChange={pick("sponsor_id")}
              />
            </Field>
            <Field label="Visa Type" required error={errors.visa_type}>
              <ParamLookup
                parameter="MS_EMP_HR_VISA_TYPE" valueField="value_code" descField="value_desc"
                value={form.visa_type} onChange={pick("visa_type")}
              />
            </Field>
            <Field label="Valid From" required error={errors.visa_valid_from}>
              <Input {...date("visa_valid_from")} />
            </Field>
            <Field label="Valid To" required error={errors.visa_valid_to}>
              <Input {...date("visa_valid_to")} min={toInputDatenull(form.visa_valid_from)} disabled={!form.visa_valid_from} />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Insurance ── */}
        <SectionPanel title="Insurance Information" icon={ShieldCheck}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Card No.">
              <Input
                value={form.ins_card_no ?? ""}
                onChange={(e) => e.target.value.charAt(0) !== "-" && set("ins_card_no", e.target.value)}
              />
            </Field>
            <Field label="Type"><Input {...text("ins_card_type")} /></Field>
            <Field label="Valid From"><Input {...date("ins_card_issue_dt")} /></Field>
            <Field label="Valid To" error={errors.ins_card_exp_dt}>
              <Input {...date("ins_card_exp_dt")} min={toInputDatenull(form.ins_card_issue_dt)} disabled={!form.ins_card_issue_dt} />
            </Field>
          </div>
        </SectionPanel>

        {/* ── ID / Labour card ── */}
        <SectionPanel title="Id / Labour Card / PASI No." icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="ID/Labourcard No." required error={errors.labourcard_no}>
              <Input {...text("labourcard_no")} />
            </Field>
            <Field label="PASI No."><Input {...text("pasi_no")} /></Field>
            <Field label="Valid From" required error={errors.labourcard_valid_from}>
              <Input {...date("labourcard_valid_from")} />
            </Field>
            <Field label="Valid To" required error={errors.labourcard_valid_to}>
              <Input {...date("labourcard_valid_to")} min={toInputDatenull(form.labourcard_valid_from)} disabled={!form.labourcard_valid_from} />
            </Field>
            <Field label="Status" required error={errors.labourcard_status}>
              <ParamLookup
                parameter="MS_EMP_HR_LABOUR_CARD_STATUS" valueField="value_code" descField="value_desc"
                value={form.labourcard_status} onChange={pick("labourcard_status")}
              />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Airfare ── */}
        <SectionPanel title="Airfare Information" icon={Plane}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Fare Code">
              <ParamLookup
                parameter="MS_EMP_HR_AIRPORT" valueField="airport_code" descField="airport_name" descHeader="Airport"
                value={form.airport_code} onChange={pick("airport_code")}
              />
            </Field>
            <Field label="Eligibility">
              <ParamLookup
                parameter="MS_EMP_HR_TICKET_ELIGIBILITY" valueField="value_code" descField="value_desc"
                value={form.ticket_eligibility} onChange={pick("ticket_eligibility")}
              />
            </Field>
            <Field label="No. of Adult Depended"><Input {...num("ticket_dpend_adult")} /></Field>
            <Field label="Ticket Once in Months"><Input {...num("ticket_eligible_period")} /></Field>
            <Field label="Total No. of Adults"><Input {...num("ta_no")} /></Field>
            <Field label="No. of Childrens"><Input {...num("tc_no")} /></Field>
            <Field label="No. of Infants"><Input {...num("ti_no")} /></Field>
          </div>
        </SectionPanel>

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