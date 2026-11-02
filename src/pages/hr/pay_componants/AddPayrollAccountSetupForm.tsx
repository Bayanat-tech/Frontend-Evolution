// Payroll Account Setup form — new UI
//  • forwardRef + useImperativeHandle → the parent page's header "Save" button calls save()
//  • SectionPanel / Field from shared FormBlocks, toast for feedback (no alert banner)
//  • No modal shell, no top bar, no bottom Submit bar — List / Close / Save live in the page header
//  • Formik + the detail useQuery removed; edit/view populate from the list row

import { Landmark, MapPin } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { uppercaseKeys } from "../../../components/ui/Uselookupoptions";
import { useAuth } from "../../../state/AuthContext";

export type TPayrollAccountForm = {
  COMPANY_CODE: string;
  DIV_CODE: string;
  DEPT_CODE: string;
  SECTION_CODE: string;
  PAY_COMP_ID: string;
  AC_CODE_DB: string;
  AC_CODE_CR: string;
  EXP_TYPE_CODE: string;
  EXP_SUBTYPE_CODE: string;
  PAY_COMP_EARN_DED: string;
  REMARKS: string;
};

/** Exposed to the parent so the header Save button can trigger save() */
export type PayrollAccountFormHandle = {
  save: () => Promise<void>;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  /** The selected list row (UPPERCASE keys) — used for edit / view */
  existingData?: Partial<TPayrollAccountForm>;
  company_code: string;
  div_code: string;
  dept_code: string;
  section_code: string;
  onClose: (shouldRefetch?: boolean) => void;
};

const str = (v: unknown) => (v == null ? "" : String(v));

export const AddPayrollAccountSetupForm = forwardRef<PayrollAccountFormHandle, Props>(
  function AddPayrollAccountSetupForm(
    { mode, existingData, company_code, div_code, dept_code, section_code, onClose },
    ref,
  ) {
    const { user } = useAuth();
    const { toast } = useToast();
    const loginid = user?.loginid ?? "";
    const readonly = mode === "view";
    const isEdit = mode === "edit" || mode === "view";

    // Fields without an input on this screen (EXP_TYPE_CODE, EXP_SUBTYPE_CODE,
    // PAY_COMP_EARN_DED, REMARKS) are carried through unchanged, exactly as before.
    const [form, setForm] = useState<TPayrollAccountForm>(() => ({
      COMPANY_CODE: company_code,
      DIV_CODE: div_code,
      DEPT_CODE: dept_code,
      SECTION_CODE: section_code,
      PAY_COMP_ID: str(existingData?.PAY_COMP_ID),
      AC_CODE_DB: str(existingData?.AC_CODE_DB),
      AC_CODE_CR: str(existingData?.AC_CODE_CR),
      EXP_TYPE_CODE: str(existingData?.EXP_TYPE_CODE),
      EXP_SUBTYPE_CODE: str(existingData?.EXP_SUBTYPE_CODE),
      PAY_COMP_EARN_DED: str(existingData?.PAY_COMP_EARN_DED) || "E",
      REMARKS: str(existingData?.REMARKS),
    }));
    const [errors, setErrors] = useState<Partial<Record<keyof TPayrollAccountForm, string>>>({});

    const set = (field: keyof TPayrollAccountForm, value: string) =>
      setForm((prev) => ({ ...prev, [field]: value }));

    // ── Lookup: Pay Component ──
    const loadPayComponentOptions = async (search?: string) => {
      const response = await getDynamicLookup({
        parameter: "PAY_COMPONENT_Encashment",
        code1: company_code,
        code2: loginid,
      });
      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const rows = rawRows.map(uppercaseKeys);
      if (!search) return rows;
      const trimmed = search.trim().toLowerCase();
      return rows.filter((row) =>
        [row.PAY_COMP_ID, row.PAY_COMP_DESC].some((val) => String(val ?? "").toLowerCase().includes(trimmed)),
      );
    };

    // ── Lookup: Account Code (shared by DB and CR) ──
    const loadAccountCodeOptions = async (search?: string) => {
      const response = await getDynamicLookup({
        parameter: "AC_PREPAID_GET_DEBIT_AC",
        code1: company_code,
        code2: search ?? "",
      });
      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    };

    // ── Validation ──
    const validate = (): string | null => {
      const next: Partial<Record<keyof TPayrollAccountForm, string>> = {};
      if (!form.PAY_COMP_ID) next.PAY_COMP_ID = "Pay Component ID is required";
      if (!form.AC_CODE_DB) next.AC_CODE_DB = "DB Account Code is required";
      if (!form.AC_CODE_CR) next.AC_CODE_CR = "CR Account Code is required";
      setErrors(next);
      return Object.values(next)[0] ?? null;
    };

    // ── Submit (called by the page header Save button) ──
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }
      try {
        await executeDynamicMutationColumn90({
          parameter: "Payroll_accountsetup_ins_upd",
          loginid,
          val1s1: form.COMPANY_CODE,
          val1s2: form.DIV_CODE,
          val1s3: form.DEPT_CODE,
          val1s4: form.SECTION_CODE,
          val1s5: form.PAY_COMP_ID,
          val1s6: form.AC_CODE_DB,
          val1s7: form.AC_CODE_CR,
          val1s8: form.EXP_TYPE_CODE,
          val1s9: form.EXP_SUBTYPE_CODE,
          val1s10: "P",
          val1s11: form.PAY_COMP_EARN_DED,
          val1s12: form.REMARKS,
        });
        toast.success(isEdit ? "Payroll account setup updated successfully" : "Payroll account setup saved successfully");
        onClose(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save payroll account setup");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSubmit }));

    // ── UI ──
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <SectionPanel title="Location" icon={MapPin}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Company">
              <Input disabled value={company_code} />
            </Field>
            <Field label="Division">
              <Input disabled value={div_code} />
            </Field>
            <Field label="Department">
              <Input disabled value={dept_code} />
            </Field>
            <Field label="Section">
              <Input disabled value={section_code} />
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel title="Pay Component Account Mapping" icon={Landmark}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Pay Component ID" required error={errors.PAY_COMP_ID}>
              <LookupField
                value={form.PAY_COMP_ID}
                onChange={(val: string) => set("PAY_COMP_ID", val)}
                disabled={readonly || isEdit}
                valueField="PAY_COMP_ID"
                displayFields={["PAY_COMP_ID", "PAY_COMP_DESC"]}
                columns={[
                  { field: "PAY_COMP_ID", header: "Pay Component ID" },
                  { field: "PAY_COMP_DESC", header: "Description" },
                ]}
                loadOptions={loadPayComponentOptions}
              />
            </Field>

            <Field label="DB Account Code" required error={errors.AC_CODE_DB}>
              <LookupField
                value={form.AC_CODE_DB}
                onChange={(val: string) => set("AC_CODE_DB", val)}
                disabled={readonly}
                valueField="AC_CODE"
                displayFields={["AC_CODE", "AC_NAME"]}
                columns={[
                  { field: "AC_CODE", header: "Account Code" },
                  { field: "AC_NAME", header: "Account Name" },
                ]}
                loadOptions={loadAccountCodeOptions}
              />
            </Field>

            <Field label="CR Account Code" required error={errors.AC_CODE_CR}>
              <LookupField
                value={form.AC_CODE_CR}
                onChange={(val: string) => set("AC_CODE_CR", val)}
                disabled={readonly}
                valueField="AC_CODE"
                displayFields={["AC_CODE", "AC_NAME"]}
                columns={[
                  { field: "AC_CODE", header: "Account Code" },
                  { field: "AC_NAME", header: "Account Name" },
                ]}
                loadOptions={loadAccountCodeOptions}
              />
            </Field>
          </div>
        </SectionPanel>
      </div>
    );
  },
);

export default AddPayrollAccountSetupForm;