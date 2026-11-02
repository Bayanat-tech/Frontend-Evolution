import {
  BookOpen, Car, Contact, Home, MapPin, ShieldAlert, User, Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import type { TEmployeeDetails } from "./EmployeeDetails.types";
import { UpdHrEmployee } from "../../../api/hr";

export type EmployeeFormHandle = {
  save: () => Promise<void>;
  toggleAll: () => void;
};

interface EditEmployeeDetailsFormProps {
  existingData: TEmployeeDetails;
  onClose: (refetch?: boolean) => void;
  onAllOpenChange?: (allOpen: boolean) => void;
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
  supervisor: "HR_DROPDOWN_MS_HR_EMPLOYEE",
} as const;

type LookupKey = keyof typeof LOOKUP_PARAMS;
type LookupRow = Record<string, unknown>;

type TextKey = {
  [K in keyof TEmployeeDetails]-?: [NonNullable<TEmployeeDetails[K]>] extends [never]
    ? never
    : [NonNullable<TEmployeeDetails[K]>] extends [string]
      ? K
      : never;
}[keyof TEmployeeDetails];

const CTL = "h-7 text-xs";

/* ── date helpers ─────────────────────────────────────────────── */
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

/* ── UI primitives (mirrors AddEmployeeHrForm) ────────────────── */
function HeaderBlock({
  label, icon, children, gridCols = "grid-cols-2", bodyClass, className = "",
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
  label, required, className = "", children,
}: {
  label: string;
  required?: boolean;
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
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Form
   ───────────────────────────────────────────────────────────── */
export const EditEmployeeDetailsForm = forwardRef<EmployeeFormHandle, EditEmployeeDetailsFormProps>(
  function EditEmployeeDetailsForm({ existingData, onClose, onAllOpenChange }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [form, setForm] = useState<TEmployeeDetails>(existingData);

    const [lookupOptions, setLookupOptions] = useState<Record<LookupKey, LookupRow[]>>({
      title: [], gender: [], blood: [], religion: [], caste: [], marital: [], supervisor: [],
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
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Notify parent once — sections are always visually open now.
    useEffect(() => {
      onAllOpenChange?.(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadCached = (key: LookupKey) => async () => lookupOptions[key];

    const set = <K extends keyof TEmployeeDetails>(key: K, value: TEmployeeDetails[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

    /* ── Field builders (add-form visual language) ──────────── */
    const textField = (
      key: TextKey,
      label: string,
      opts?: { required?: boolean; className?: string; type?: string },
    ) => (
      <CField label={label} required={opts?.required} className={opts?.className}>
        <Input
          type={opts?.type}
          className={CTL}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value as never)}
        />
      </CField>
    );

    const dateField = (
      key: "health_expiry" | "ppt_valid_from" | "ppt_valid_to" | "dl_issue_date" | "dl_valid_upto",
      label: string,
      className?: string,
    ) => (
      <CField label={label} className={className}>
        <Input
          type="date"
          className={CTL}
          value={toInputDate(form[key])}
          onChange={(e) => set(key, fromInputDate(e.target.value))}
        />
      </CField>
    );

    const lookupField = (
      key: TextKey,
      label: string,
      lookupKey: LookupKey,
      codeField: string,
      nameField: string,
      required?: boolean,
      className?: string,
    ) => (
      <CField label={label} required={required} className={className}>
        <LookupField
          compact
          dense
          value={String(form[key] ?? "")}
          valueField={codeField}
          displayFields={[codeField, nameField]}
          columns={[
            { field: codeField, header: "Code" },
            { field: nameField, header: label },
          ]}
          loadOptions={loadCached(lookupKey)}
          onChange={(value) => set(key, value as never)}
          placeholder={`Select ${label.toLowerCase()}`}
        />
      </CField>
    );

    /* ── Validation ─────────────────────────────────────────── */
    const validate = (): string | null => {
      if (!form.title) return "Title is required";
      if (!form.first_name?.trim()) return "First Name is required";
      if (!form.gender) return "Gender is required";
      return null;
    };

    /* ── Save ───────────────────────────────────────────────── */
    const handleSubmit = async () => {
      const error = validate();
      if (error) { toast.warning(error); return; }

      try {
        const finalPayload = {
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
          // NATIONALITY: form.nationality,
          RELIGION_CODE: form.religion_code,
          CASTE_CODE: form.caste_code,
          // COUNTRY_CODE: form.country_code,
          // COUNTRY_LIVING_IN: form.country_living_in,

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
      }
    };

    useImperativeHandle(ref, () => ({
      save: handleSubmit,
      toggleAll: () => {}, // no-op — sections are always open now
    }));

    /* ── Render ─────────────────────────────────────────────── */
    return (
      <div
        style={{ zoom: 0.8 }}
        className="freight-workspace-ui freight-dense-form freight-ui-standard grid items-start gap-1.5"
      >
        {/* ══════════ TOP HALF ══════════ */}
        <div className="grid items-start gap-1.5 xl:grid-cols-2">
          {/* Personal Information (2 cols) */}
          <div className="xl:col-span-2">
            <HeaderBlock
              label="Personal Information"
              icon={<User size={11} />}
              bodyClass="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-3 gap-y-2 p-2"
            >
              {/* Row 1 */}
              {lookupField("title", "Title", "title", "value_code", "value_desc", true)}
              {textField("first_name", "First Name", { required: true })}
              {textField("second_name", "Second Name")}
              {textField("third_name", "Third Name")}

              {/* Row 2 */}
              {textField("fourth_name", "Fourth Name")}
              {textField("last_name", "Last Name")}
              {textField("family_name", "Family Name")}

              {/* Row 3 */}
              {lookupField("gender", "Gender", "gender", "value_code", "value_desc", true)}
              {lookupField("religion_code", "Religion", "religion", "religion_code", "religion_name")}
              {textField("birth_place", "Place of Birth")}
              {lookupField("blood_group", "Blood Group", "blood", "value_code", "value_desc")}
              {lookupField("caste_code", "Caste", "caste", "caste_code", "caste_name")}

              {/* Row 4 */}
              {textField("father_name", "Father's Name")}
              {textField("mother_name", "Mother's Name")}

              {/* Row 5 */}
              {lookupField("marrital_status", "Marital Status", "marital", "value_code", "value_desc")}
              {textField("spouse_name", "Spouse Name")}
              <CField label="Children">
                <Input
                  type="number"
                  className={CTL}
                  value={String(form.no_of_children)}
                  onChange={(e) => set("no_of_children", Number(e.target.value) || 0)}
                />
              </CField>
              {dateField("health_expiry", "Health Card Expiry")}
              {textField("mobile_no", "Mobile No")}
              {textField("mobile_no2", "Mobile Alt")}
              {textField("email_official", "Email", { type: "email" })}
              <CField label="OT Applicable">
                <Select
                  className={CTL}
                  value={form.ot_applicable}
                  onChange={(e) => set("ot_applicable", e.target.value)}
                >
                  <option value="">Select...</option>
                  {OT_APPLICABLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </CField>
              {lookupField("supervisor_empid", "Supervisor", "supervisor", "employee_id", "rpt_name", true,)}
              {lookupField("dept_head_emp_id", "Dept Head", "supervisor", "employee_id", "rpt_name", true,)}
              {lookupField("manager_code", "Manager Code", "supervisor", "employee_id", "rpt_name", true,)}
            </HeaderBlock>
          </div>

        </div>

        {/* ══════════ BOTTOM HALF (4 Columns) ══════════ */}
        <div className="grid gap-1.5 xl:grid-cols-4">

          {/* Col 2: Permanent + Driving Licence */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock
              className="flex-1"
              label="Permanent Address"
              icon={<Home size={11} />} 
              gridCols="grid-cols-1 sm:grid-cols-2"
            >
              {textField("perm_address1", "Address Line 1", { className: "sm:col-span-2" })}
              {textField("perm_address2", "", { className: "sm:col-span-2" })}
              {textField("perm_address3", "", { className: "sm:col-span-2" })}
              {textField("perm_phone", "Phone")}
              {textField("perm_mobile", "Mobile")}
            </HeaderBlock>
          </div>

          {/* Col 3: Local Address */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock
              className="flex-1"
              label="Local Address"
              icon={<MapPin size={11} />}
              gridCols="grid-cols-1 sm:grid-cols-2"
            >
              {textField("local_address1", "Address Line 1", { className: "sm:col-span-2" })}
              {textField("local_address2", "", { className: "sm:col-span-2" })}
              {textField("local_address3", "", { className: "sm:col-span-2" })}
              {textField("local_phone", "Phone")}
              {textField("local_mobile", "Mobile")}
            </HeaderBlock>
          </div>

          {/* Col 4: Emergency Contact */}
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock
              className="flex-1"
              label="Emergency Contact"
              icon={<ShieldAlert size={11} />}
              gridCols="grid-cols-1 sm:grid-cols-2"
            >
              {textField("emgr_address1", "Address Line 1", { className: "sm:col-span-2" })}
              {textField("emgr_address2", "", { className: "sm:col-span-2" })}
              {textField("emgr_address3", "", { className: "sm:col-span-2" })}
              {textField("emgr_phone", "Phone")}
              {textField("emgr_mobile", "Mobile")}
              {textField("emgr_contact_person", "Contact Person", { className: "sm:col-span-2" })}
            </HeaderBlock>
          </div>

          <HeaderBlock
              className="flex-1"
              label="Driving Licence"
              icon={<Car size={11} />}
              gridCols="grid-cols-1 sm:grid-cols-2"
            >
              {textField("driving_license_no", "Licence No", { className: "sm:col-span-2" })}
              {textField("dl_issue_place", "Place of Issue", { className: "sm:col-span-2" })}
              {dateField("dl_issue_date", "Date of Issue")}
              {dateField("dl_valid_upto", "Valid Upto")}
          </HeaderBlock>
          
        </div>
      </div>
    );
  },
);

export default EditEmployeeDetailsForm;