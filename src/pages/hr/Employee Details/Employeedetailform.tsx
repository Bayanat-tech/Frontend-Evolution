import {
  BadgeCheck, Car, ChevronDown, Contact, Home, IdCard, MapPin, ShieldAlert, User, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Field } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import type { TEmployeeDetails } from "./EmployeeDetails.types";
import { UpdHrEmployee } from "../../../api/hr";

/* ✅ Expose save() to the parent (header Save button) */
export type EmployeeFormHandle = {
  save: () => Promise<void>;
  /** Expand every section, or collapse them all if they're already all open. */
  toggleAll: () => void;
};

interface EditEmployeeDetailsFormProps {
  existingData: TEmployeeDetails;
  onClose: (refetch?: boolean) => void;
  /** Reports whether every section is open, so the header button can label itself. */
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
} as const;

type LookupKey = keyof typeof LOOKUP_PARAMS;
type LookupRow = Record<string, unknown>;

// keys of TEmployeeDetails that hold plain strings (used by the text-field helper)
type TextKey = {
  [K in keyof TEmployeeDetails]-?: [NonNullable<TEmployeeDetails[K]>] extends [never]
    ? never
    : [NonNullable<TEmployeeDetails[K]>] extends [string]
      ? K
      : never;
}[keyof TEmployeeDetails];

// ── Sections ────────────────────────────────────────────────────────────
type SectionId =
  | "name"
  | "personal"
  | "employment"
  | "contact"
  | "reporting"
  | "permanent"
  | "local"
  | "emergency"
  | "licence";

const SECTION_IDS: SectionId[] = [
  "name", "personal", "employment", "contact", "reporting", "permanent", "local", "emergency", "licence",
];

// Sections the user is most likely to need start open; the rest start collapsed.
const DEFAULT_OPEN: Record<SectionId, boolean> = {
  name: true,
  personal: true,
  employment: true,
  contact: true,
  reporting: false,
  permanent: false,
  local: false,
  emergency: false,
  licence: false,
};

// yyyy-mm-dd (native <input type="date"> value format) <-> Date
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

/* ─────────────────────────────────────────────────────────────
   SectionPanel — Freight structure, collapsible.
   Controlled by the form so "Expand all / Collapse all" and
   validation can open sections. Body is hidden (not unmounted),
   so entered values are never lost.
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? "Collapse section" : "Expand section"}
        className={`freight-panel-title flex w-full cursor-pointer items-center justify-between gap-2 bg-muted/35 px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
          open ? "border-b" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div className={`freight-panel-body p-3 ${open ? "" : "hidden"}`}>{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
export const EditEmployeeDetailsForm = forwardRef<EmployeeFormHandle, EditEmployeeDetailsFormProps>(
  function EditEmployeeDetailsForm({ existingData, onClose, onAllOpenChange }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [form, setForm] = useState<TEmployeeDetails>(existingData);
    const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>(DEFAULT_OPEN);

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadCached = (key: LookupKey) => async () => lookupOptions[key];

    const set = <K extends keyof TEmployeeDetails>(key: K, value: TEmployeeDetails[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

    // ── Section open/close ───────────────────────────────────────────────
    const toggleSection = (id: SectionId) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    const setAllSections = (open: boolean) =>
      setOpenSections(Object.fromEntries(SECTION_IDS.map((id) => [id, open])) as Record<SectionId, boolean>);
    const allOpen = SECTION_IDS.every((id) => openSections[id]);

    useEffect(() => {
      onAllOpenChange?.(allOpen);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allOpen]);

    const section = (id: SectionId, title: string, icon: LucideIcon, children: ReactNode) => (
      <SectionPanel title={title} icon={icon} open={openSections[id]} onToggle={() => toggleSection(id)}>
        {children}
      </SectionPanel>
    );

    // ── Field helpers ────────────────────────────────────────────────────
    const textField = (key: TextKey, label: string, opts?: { required?: boolean; className?: string; type?: string }) => (
      <Field label={label} required={opts?.required} className={opts?.className}>
        <Input
          type={opts?.type}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value as never)}
        />
      </Field>
    );

    const dateField = (key: "health_expiry" | "dl_issue_date" | "dl_valid_upto", label: string) => (
      <Field label={label}>
        <Input
          type="date"
          value={toInputDate(form[key])}
          onChange={(e) => set(key, fromInputDate(e.target.value))}
        />
      </Field>
    );

    const lookupField = (
      key: TextKey,
      label: string,
      lookupKey: LookupKey,
      codeField: string,
      nameField: string,
      required?: boolean,
    ) => (
      <Field label={label} required={required}>
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
      </Field>
    );

    // ── Validation (starred fields) ──────────────────────────────────────
    // Returns the message plus the section holding the field, so the section
    // can be expanded if the user had collapsed it.
    const validate = (): { message: string; section: SectionId } | null => {
      if (!form.title) return { message: "Title is required", section: "name" };
      if (!form.first_name?.trim()) return { message: "First Name is required", section: "name" };
      if (!form.gender) return { message: "Gender is required", section: "personal" };
      return null;
    };

    // ── Submit (called by the page header Save button) ───────────────────
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        setOpenSections((prev) => ({ ...prev, [error.section]: true }));
        toast.warning(error.message);
        return;
      }

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
      }
    };

    /* ✅ Expose save() to parent */
    useImperativeHandle(ref, () => ({
      save: handleSubmit,
      toggleAll: () => setAllSections(!allOpen),
    }));

    // ── UI ────────────────────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        {section(
          "name",
          "Name",
          User,
          <div className="grid gap-3 md:grid-cols-4">
            {lookupField("title", "Title", "title", "value_code", "value_desc", true)}
            {textField("first_name", "First Name", { required: true })}
            {textField("second_name", "Second Name")}
            {textField("third_name", "Third Name")}
            {textField("fourth_name", "Fourth Name")}
            {textField("last_name", "Last Name")}
            {textField("family_name", "Family Name")}
            {/* Alias Name intentionally hidden (was commented out in the old form) */}
          </div>,
        )}

        {section(
          "personal",
          "Personal Information",
          IdCard,
          <div className="grid gap-3 md:grid-cols-4">
            {lookupField("gender", "Gender", "gender", "value_code", "value_desc", true)}
            {/* Date of Birth intentionally hidden (was commented out in the old form) */}
            {textField("birth_place", "Place of Birth")}
            {lookupField("blood_group", "Blood Group", "blood", "value_code", "value_desc")}
            {lookupField("marrital_status", "Marital Status", "marital", "value_code", "value_desc")}

            {textField("father_name", "Father's Name")}
            {textField("mother_name", "Mother's Name")}
            {lookupField("religion_code", "Religion", "religion", "religion_code", "religion_name")}
            {lookupField("caste_code", "Caste", "caste", "caste_code", "caste_name")}

            {textField("spouse_name", "Spouse Name")}
            <Field label="Children">
              <Input
                type="number"
                value={String(form.no_of_children)}
                onChange={(e) => set("no_of_children", Number(e.target.value) || 0)}
              />
            </Field>
          </div>,
        )}

        {section(
          "employment",
          "Employment & Health",
          BadgeCheck,
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="OT Applicable">
              <Select value={form.ot_applicable} onChange={(e) => set("ot_applicable", e.target.value)}>
                <option value="">Select...</option>
                {OT_APPLICABLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
            {dateField("health_expiry", "Health Card Expiry")}
          </div>,
        )}

        {section(
          "contact",
          "Contact Details",
          Contact,
          <div className="grid gap-3 md:grid-cols-4">
            {textField("mobile_no", "Mobile No")}
            {textField("mobile_no2", "Mobile No (Alt)")}
            {textField("email_official", "Official Email", { type: "email" })}
            {textField("email_personal", "Personal Email", { type: "email" })}
          </div>,
        )}

        {section(
          "reporting",
          "Reporting",
          Users,
          <div className="grid gap-3 md:grid-cols-4">
            {textField("supervisor_empid", "Supervisor")}
            {textField("dept_head_emp_id", "Dept Head")}
            {textField("manager_code", "Manager Code")}
          </div>,
        )}

        {section(
          "permanent",
          "Permanent Address",
          Home,
          <div className="grid gap-3 md:grid-cols-4">
            {textField("perm_address1", "Address Line 1", { className: "md:col-span-2" })}
            {textField("perm_address2", "Address Line 2", { className: "md:col-span-2" })}
            {textField("perm_address3", "Address Line 3", { className: "md:col-span-2" })}
            {textField("perm_phone", "Phone")}
            {textField("perm_mobile", "Mobile")}
          </div>,
        )}

        {section(
          "local",
          "Local Address",
          MapPin,
          <div className="grid gap-3 md:grid-cols-4">
            {textField("local_address1", "Address Line 1", { className: "md:col-span-2" })}
            {textField("local_address2", "Address Line 2", { className: "md:col-span-2" })}
            {textField("local_address3", "Address Line 3", { className: "md:col-span-2" })}
            {textField("local_phone", "Phone")}
            {textField("local_mobile", "Mobile")}
          </div>,
        )}

        {section(
          "emergency",
          "Emergency Contact",
          ShieldAlert,
          <div className="grid gap-3 md:grid-cols-4">
            {textField("emgr_address1", "Address Line 1", { className: "md:col-span-2" })}
            {textField("emgr_address2", "Address Line 2", { className: "md:col-span-2" })}
            {textField("emgr_address3", "Address Line 3", { className: "md:col-span-2" })}
            {textField("emgr_phone", "Phone")}
            {textField("emgr_mobile", "Mobile")}
            {textField("emgr_contact_person", "Contact Person", { className: "md:col-span-2" })}
          </div>,
        )}

        {section(
          "licence",
          "Driving Licence",
          Car,
          <div className="grid gap-3 md:grid-cols-4">
            {textField("driving_license_no", "Licence No")}
            {textField("dl_issue_place", "Place of Issue")}
            {dateField("dl_issue_date", "Date of Issue")}
            {dateField("dl_valid_upto", "Valid Upto")}
          </div>,
        )}
      </div>
    );
  },
);

export default EditEmployeeDetailsForm;