import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Contact,
  Home,
  MapPin,
  ShieldAlert,
  User,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { LookupField } from "../../../components/ui/LookupField";

import { getDynamicLookup} from "../../../api/lookups";
import { TEmployeeDetails } from "./EmployeeDetails.types";
import { UpdHrEmployee } from "../../../api/hr";

interface EditEmployeeDetailsFormProps {
  existingData: TEmployeeDetails;
  onClose: (refetch?: boolean) => void;
}

const OT_APPLICABLE_OPTIONS = [
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
];


const LOOKUP_PARAMS = {
  title: "MS_HR_EMPDETAIL_TITLE",
  gender: "MS_HR_EMPDETAIL_GENDER",
  blood: "MS_HR_EMPDETAIL_BLOOD",
  religion: "MS_HR_EMPDETAIL_RELIGION",
  caste: "MS_HR_EMPDETAIL_CASTE",
  marital: "MS_HR_EMPDETAIL_MARITAL",
} as const;

type LookupKey = keyof typeof LOOKUP_PARAMS;
type LookupRow = Record<string, unknown>;

// dd/mm/yyyy <-> yyyy-mm-dd (native <input type="date"> value format)
function toInputDate(value: Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromInputDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function FormRow({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}


interface StepConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StepperHeader({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: StepConfig[];
  activeStep: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <div className="flex items-start  rounded-lg border border-border bg-muted/30 px-4 py-3">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex flex-1 items-start last:flex-none">
           
            <button
              type="button"
              onClick={() => onStepClick(index)}
              className="flex flex-col items-center gap-1.5 focus:outline-none"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={`w-20 text-center text-[10px] font-medium leading-tight ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div className={`mt-4 h-0.5 flex-1 ${isDone ? "bg-primary/60" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EditEmployeeDetailsForm({ existingData, onClose }: EditEmployeeDetailsFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TEmployeeDetails>(existingData);
  const [activeStep, setActiveStep] = useState(0);

  const [lookupOptions, setLookupOptions] = useState<Record<LookupKey, LookupRow[]>>({
    title: [],
    gender: [],
    blood: [],
    religion: [],
    caste: [],
    marital: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          (Object.entries(LOOKUP_PARAMS) as [LookupKey, string][]).map(async ([key, parameter]) => {
            const res = await getDynamicLookup({
              parameter,
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return [key, Array.isArray(res) ? (res as LookupRow[]) : []] as const;
          }),
        );
        if (!cancelled) {
          setLookupOptions(Object.fromEntries(entries) as Record<LookupKey, LookupRow[]>);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load dropdown options");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCached = (key: LookupKey) => async () => lookupOptions[key];

  const set = <K extends keyof TEmployeeDetails>(key: K, value: TEmployeeDetails[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { 
      const finalPayload ={
          COMPANY_CODE: user?.company_code,
          EMPLOYEE_CODE: form.employee_code,
          ALTERNATE_ID: form.alternate_id,
          TITLE: form.title,
          FIRST_NAME: form.first_name,
          SECOND_NAME: form.second_name,
          THIRD_NAME: form.third_name,
          FOURTH_NAME: form.fourth_name,
          LAST_NAME: form.last_name,
          FAMILY_NAME: form.family_name,
          ALIAS_NAME: form.alias_name,

          GENDER: form.gender,
          BIRTH_DATE: form.birth_date,
          BIRTH_PLACE: form.birth_place,
          FATHER_NAME: form.father_name,
          MOTHER_NAME: form.mother_name,
          MARRITAL_STATUS: form.marrital_status,
          SPOUSE_NAME: form.spouse_name,
          NO_OF_CHILDREN: form.no_of_children,
          BLOOD_GROUP: form.blood_group,
          NATIONALITY: form.nationality,
          RELIGION_CODE: form.religion_code,
          CASTE_CODE: form.caste_code,
          COUNTRY_CODE: form.country_code,
          COUNTRY_LIVING_IN: form.country_living_in,

          PPT_NAME: form.ppt_name,
          PPT_NO: form.ppt_no,
          PPT_COUNTRY: form.ppt_country,
          PPT_VALID_FROM: form.ppt_valid_from,
          PPT_VALID_TO: form.ppt_valid_to,
          PPT_STATUS: form.ppt_status,
          PASSPORT_WITH: form.passport_with,

          PHONE_OFFICE: form.phone_office,
          PHONE_OFFICE_EXTN: form.phone_office_extn,
          MOBILE_NO: form.mobile_no,
          MOBILE_NO2: form.mobile_no2,
          EMAIL_OFFICIAL: form.email_official,
          EMAIL_PERSONAL: form.email_personal,

          PERM_ADDRESS1: form.perm_address1,
          PERM_ADDRESS2: form.perm_address2,
          PERM_ADDRESS3: form.perm_address3,
          PERM_PHONE: form.perm_phone,
          PERM_MOBILE: form.perm_mobile,

          LOCAL_ADDRESS1: form.local_address1,
          LOCAL_ADDRESS2: form.local_address2,
          LOCAL_ADDRESS3: form.local_address3,
          LOCAL_PHONE: form.local_phone,
          LOCAL_MOBILE: form.local_mobile,

          EMGR_ADDRESS1: form.emgr_address1,
          EMGR_ADDRESS2: form.emgr_address2,
          EMGR_ADDRESS3: form.emgr_address3,
          EMGR_PHONE: form.emgr_phone,
          EMGR_MOBILE: form.emgr_mobile,
          EMGR_CONTACT_PERSON: form.emgr_contact_person,

          DRIVING_LICENSE_NO: form.driving_license_no,
          DL_ISSUE_PLACE: form.dl_issue_place,
          DL_ISSUE_DATE: form.dl_issue_date,
          DL_VALID_UPTO: form.dl_valid_upto,

          EMP_STATUS: form.emp_status,
          OT_APPLICABLE: form.ot_applicable,
          HEALTH_EXPIRY: form.health_expiry,
          DEPT_HEAD_EMP_ID: form.dept_head_emp_id,
          SUPERVISOR_EMPID: form.supervisor_empid,
          MANAGER_CODE: form.manager_code,
        };

      await UpdHrEmployee(finalPayload);
      toast.success("Employee details updated successfully");
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update employee details");
    } finally {
      setSaving(false);
    }
  };

  const steps: StepConfig[] = [
    { id: "personal", label: "Personal", icon: User },
    { id: "passport", label: "Passport", icon: BadgeCheck },
    { id: "contact", label: "Contact", icon: Contact },
    { id: "permanent", label: "Permanent Addr.", icon: Home },
    { id: "local", label: "Local Addr.", icon: MapPin },
    { id: "emergency", label: "Emergency", icon: ShieldAlert },
    { id: "licence", label: "Driving Licence", icon: Car },
  ];

  const isLastStep = activeStep === steps.length - 1;
  const ActiveIcon = steps[activeStep].icon;

  const goNext = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  const goPrev = () => setActiveStep((s) => Math.max(s - 1, 0));

  const stepContent = useMemo(() => {
    switch (steps[activeStep].id) {
      case "personal":
        return (
          <div className="grid grid-cols-4 gap-4">
            <LookupField
              label="Title"
              value={form.title ?? ""}
              valueField="value_code"
              displayFields={["value_code", "value_desc"]}
              columns={[
                { field: "value_code", header: "Code" },
                { field: "value_desc", header: "Title" },
              ]}
              loadOptions={loadCached("title")}
              onChange={(value) => set("title", value)}
              required
            />
            <FormRow label="First Name" required>
              <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </FormRow>
            <FormRow label="Second Name">
              <Input value={form.second_name} onChange={(e) => set("second_name", e.target.value)} />
            </FormRow>
            <FormRow label="Third Name">
              <Input value={form.third_name} onChange={(e) => set("third_name", e.target.value)} />
            </FormRow>

            <FormRow label="Fourth Name">
              <Input value={form.fourth_name} onChange={(e) => set("fourth_name", e.target.value)} />
            </FormRow>
            <FormRow label="Last Name">
              <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </FormRow>
            <FormRow label="Family Name">
              <Input value={form.family_name} onChange={(e) => set("family_name", e.target.value)} />
            </FormRow>
            <FormRow label="Alias Name">
              <Input value={form.alias_name} onChange={(e) => set("alias_name", e.target.value)} />
            </FormRow>

            <LookupField
              label="Gender"
              value={form.gender ?? ""}
              valueField="value_code"
              displayFields={["value_code", "value_desc"]}
              columns={[
                { field: "value_code", header: "Code" },
                { field: "value_desc", header: "Gender" },
              ]}
              loadOptions={loadCached("gender")}
              onChange={(value) => set("gender", value)}
              required
            />
            <FormRow label="Date of Birth">
              <Input type="date" value={toInputDate(form.birth_date)} onChange={(e) => set("birth_date", fromInputDate(e.target.value))} />
            </FormRow>
            <FormRow label="Place of Birth">
              <Input value={form.birth_place} onChange={(e) => set("birth_place", e.target.value)} />
            </FormRow>
            <LookupField
              label="Blood Group"
              value={form.blood_group ?? ""}
              valueField="value_code"
              displayFields={["value_code", "value_desc"]}
              columns={[
                { field: "value_code", header: "Code" },
                { field: "value_desc", header: "Blood Group" },
              ]}
              loadOptions={loadCached("blood")}
              onChange={(value) => set("blood_group", value)}
            />

            <FormRow label="Father's Name">
              <Input value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
            </FormRow>
            <FormRow label="Mother's Name">
              <Input value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} />
            </FormRow>
            <LookupField
              label="Religion"
              value={form.religion_code ?? ""}
              valueField="religion_code"
              displayFields={["religion_code", "religion_name"]}
              columns={[
                { field: "religion_code", header: "Code" },
                { field: "religion_name", header: "Religion" },
              ]}
              loadOptions={loadCached("religion")}
              onChange={(value) => set("religion_code", value)}
            />
            <LookupField
              label="Caste"
              value={form.caste_code ?? ""}
              valueField="caste_code"
              displayFields={["caste_code", "caste_name"]}
              columns={[
                { field: "caste_code", header: "Code" },
                { field: "caste_name", header: "Caste" },
              ]}
              loadOptions={loadCached("caste")}
              onChange={(value) => set("caste_code", value)}
            />

            <LookupField
              label="Marital Status"
              value={form.marrital_status ?? ""}
              valueField="value_code"
              displayFields={["value_code", "value_desc"]}
              columns={[
                { field: "value_code", header: "Code" },
                { field: "value_desc", header: "Marital Status" },
              ]}
              loadOptions={loadCached("marital")}
              onChange={(value) => set("marrital_status", value)}
            />
            <FormRow label="Spouse Name">
              <Input value={form.spouse_name} onChange={(e) => set("spouse_name", e.target.value)} />
            </FormRow>
            <FormRow label="No. of Children">
              <Input type="number" value={String(form.no_of_children)} onChange={(e) => set("no_of_children", Number(e.target.value) || 0)} />
            </FormRow>
            <FormRow label="Nationality">
              <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </FormRow>

            <FormRow label="Country">
              <Input value={form.country_code} onChange={(e) => set("country_code", e.target.value)} />
            </FormRow>
            <FormRow label="Country Living In">
              <Input value={form.country_living_in} onChange={(e) => set("country_living_in", e.target.value)} />
            </FormRow>
            <FormRow label="OT Applicable">
              <Select value={form.ot_applicable} onChange={(e) => set("ot_applicable", e.target.value)}>
                <option value="">Select...</option>
                {OT_APPLICABLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Health Card Expiry">
              <Input type="date" value={toInputDate(form.health_expiry)} onChange={(e) => set("health_expiry", fromInputDate(e.target.value))} />
            </FormRow>
          </div>
        );

      case "passport":
        return (
          <div className="grid grid-cols-4 gap-4">
            <FormRow label="Passport Name">
              <Input value={form.ppt_name} onChange={(e) => set("ppt_name", e.target.value)} />
            </FormRow>
            <FormRow label="Passport No">
              <Input value={form.ppt_no} onChange={(e) => set("ppt_no", e.target.value)} />
            </FormRow>
            <FormRow label="Passport Country">
              <Input value={form.ppt_country} onChange={(e) => set("ppt_country", e.target.value)} />
            </FormRow>
            <FormRow label="Passport Status">
              <Input value={form.ppt_status} onChange={(e) => set("ppt_status", e.target.value)} />
            </FormRow>

            <FormRow label="Passport Valid From">
              <Input type="date" value={toInputDate(form.ppt_valid_from)} onChange={(e) => set("ppt_valid_from", fromInputDate(e.target.value))} />
            </FormRow>
            <FormRow label="Passport Valid To">
              <Input type="date" value={toInputDate(form.ppt_valid_to)} onChange={(e) => set("ppt_valid_to", fromInputDate(e.target.value))} />
            </FormRow>
            <FormRow label="Passport With">
              <Input value={form.passport_with} onChange={(e) => set("passport_with", e.target.value)} />
            </FormRow>
          </div>
        );

      case "contact":
        return (
          <div className="grid grid-cols-4 gap-4">
            <FormRow label="Mobile No">
              <Input value={form.mobile_no} onChange={(e) => set("mobile_no", e.target.value)} />
            </FormRow>
            <FormRow label="Mobile No (Alt)">
              <Input value={form.mobile_no2} onChange={(e) => set("mobile_no2", e.target.value)} />
            </FormRow>
            <FormRow label="Office Phone">
              <Input value={form.phone_office} onChange={(e) => set("phone_office", e.target.value)} />
            </FormRow>
            <FormRow label="Office Phone Extn">
              <Input value={form.phone_office_extn} onChange={(e) => set("phone_office_extn", e.target.value)} />
            </FormRow>

            <FormRow label="Official Email">
              <Input type="email" value={form.email_official} onChange={(e) => set("email_official", e.target.value)} />
            </FormRow>
            <FormRow label="Personal Email">
              <Input type="email" value={form.email_personal} onChange={(e) => set("email_personal", e.target.value)} />
            </FormRow>
            <FormRow label="Dept Head (Emp ID)">
              <Input value={form.dept_head_emp_id} onChange={(e) => set("dept_head_emp_id", e.target.value)} />
            </FormRow>
            <FormRow label="Supervisor (Emp ID)">
              <Input value={form.supervisor_empid} onChange={(e) => set("supervisor_empid", e.target.value)} />
            </FormRow>

            <FormRow label="Manager Code">
              <Input value={form.manager_code} onChange={(e) => set("manager_code", e.target.value)} />
            </FormRow>
          </div>
        );

      case "permanent":
        return (
          <div className="grid grid-cols-4 gap-4">
            <FormRow label="Address Line 1" className="col-span-2">
              <Input value={form.perm_address1} onChange={(e) => set("perm_address1", e.target.value)} />
            </FormRow>
            <FormRow label="Address Line 2" className="col-span-2">
              <Input value={form.perm_address2} onChange={(e) => set("perm_address2", e.target.value)} />
            </FormRow>
            <FormRow label="Address Line 3" className="col-span-2">
              <Input value={form.perm_address3} onChange={(e) => set("perm_address3", e.target.value)} />
            </FormRow>
            <FormRow label="Phone">
              <Input value={form.perm_phone} onChange={(e) => set("perm_phone", e.target.value)} />
            </FormRow>
            <FormRow label="Mobile">
              <Input value={form.perm_mobile} onChange={(e) => set("perm_mobile", e.target.value)} />
            </FormRow>
          </div>
        );

      case "local":
        return (
          <div className="grid grid-cols-4 gap-4">
            <FormRow label="Address Line 1" className="col-span-2">
              <Input value={form.local_address1} onChange={(e) => set("local_address1", e.target.value)} />
            </FormRow>
            <FormRow label="Address Line 2" className="col-span-2">
              <Input value={form.local_address2} onChange={(e) => set("local_address2", e.target.value)} />
            </FormRow>
            <FormRow label="Address Line 3" className="col-span-2">
              <Input value={form.local_address3} onChange={(e) => set("local_address3", e.target.value)} />
            </FormRow>
            <FormRow label="Phone">
              <Input value={form.local_phone} onChange={(e) => set("local_phone", e.target.value)} />
            </FormRow>
            <FormRow label="Mobile">
              <Input value={form.local_mobile} onChange={(e) => set("local_mobile", e.target.value)} />
            </FormRow>
          </div>
        );

      case "emergency":
        return (
          <div className="grid grid-cols-4 gap-4">
            <FormRow label="Address Line 1" className="col-span-2">
              <Input value={form.emgr_address1} onChange={(e) => set("emgr_address1", e.target.value)} />
            </FormRow>
            <FormRow label="Address Line 2" className="col-span-2">
              <Input value={form.emgr_address2} onChange={(e) => set("emgr_address2", e.target.value)} />
            </FormRow>
            <FormRow label="Address Line 3" className="col-span-2">
              <Input value={form.emgr_address3} onChange={(e) => set("emgr_address3", e.target.value)} />
            </FormRow>
            <FormRow label="Phone">
              <Input value={form.emgr_phone} onChange={(e) => set("emgr_phone", e.target.value)} />
            </FormRow>
            <FormRow label="Mobile">
              <Input value={form.emgr_mobile} onChange={(e) => set("emgr_mobile", e.target.value)} />
            </FormRow>
            <FormRow label="Contact Person" className="col-span-2">
              <Input value={form.emgr_contact_person} onChange={(e) => set("emgr_contact_person", e.target.value)} />
            </FormRow>
          </div>
        );

      case "licence":
        return (
          <div className="grid grid-cols-4 gap-4">
            <FormRow label="Licence No">
              <Input value={form.driving_license_no} onChange={(e) => set("driving_license_no", e.target.value)} />
            </FormRow>
            <FormRow label="Place of Issue">
              <Input value={form.dl_issue_place} onChange={(e) => set("dl_issue_place", e.target.value)} />
            </FormRow>
            <FormRow label="Date of Issue">
              <Input type="date" value={toInputDate(form.dl_issue_date)} onChange={(e) => set("dl_issue_date", fromInputDate(e.target.value))} />
            </FormRow>
            <FormRow label="Valid Upto">
              <Input type="date" value={toInputDate(form.dl_valid_upto)} onChange={(e) => set("dl_valid_upto", fromInputDate(e.target.value))} />
            </FormRow>
          </div>
        );

      default:
        return null;
    }
  }, [activeStep, form, lookupOptions]);

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[78vh] flex-col gap-4">
      {/* ── Employee context (read-only) ── */}
      {/* <div className="grid grid-cols-4 gap-3 rounded-lg border border-border bg-muted/40 p-3 pb-0">
        <ReadOnlyField label="Employee Code" value={form.employee_code} />
        <ReadOnlyField label="Employee ID" value={form.employee_id} />
        <ReadOnlyField label="Department" value={form.dept_code} />
        <ReadOnlyField label="Section" value={form.section_code} />
      </div> */}

      {/* ── Stepper ── */}
      <StepperHeader steps={steps} activeStep={activeStep} onStepClick={setActiveStep} />

      {/* ── Active step card ── */}
      <div className="flex-1  rounded-lg border border-border p-3 shadow-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ActiveIcon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">{steps[activeStep].label} Details</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            Step {activeStep + 1} of {steps.length}
          </span>
        </div>
        {stepContent}
      </div>

      {/* ── Navigation + actions ── */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background pt-3 ">
        <Button type="button" variant="outline" onClick={goPrev} disabled={activeStep === 0}>
          <ChevronLeft size={15} /> Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onClose()} disabled={saving}>
            Cancel
          </Button>
          {!isLastStep && (
            <Button type="button" onClick={goNext}>
              Next <ChevronRight size={15} />
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default EditEmployeeDetailsForm;