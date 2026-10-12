// AddContinuousAutoMemoForm.tsx
//
// Continuous Auto Memo form — Freight-style:
//  • forwardRef + useImperativeHandle → page header "Save as Draft" / "Submit"
//    buttons call saveDraft() / submit()
//  • SectionPanel / Field from shared Formblocks
//  • toast for validation / API feedback (no inline alert banners)
//  • No bottom button row — Close / Save as Draft / Submit live in the page header

import { CalendarRange, FileText, Mail, PenLine, UserRound } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState,
} from "react";
import { executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

/* ✅ Exposed to the parent (header buttons) */
export type ContinuousAutoMemoFormHandle = {
  saveDraft: () => Promise<void>;
  submit: () => void;
};

// Field set kept exactly as in the old form (name_from/addr_from/name_to/addr_to
// are real correspondence fields, not effective-date stand-ins).
export type TContinuousAutoMemo = {
  doc_no?: string;
  doc_date?: string;
  approved_date?: string;
  doc_type?: string; // ADD | DED
  employee_code?: string;
  employee_name?: string;
  pay_comp_id?: string;
  amount?: string;
  month_from?: string;
  year_from?: string;
  month_to?: string;
  year_to?: string;
  name_from?: string;
  addr_from?: string;
  name_to?: string;
  addr_to?: string;
  lettr_subject?: string;
  remarks_1?: string;
  remarks_2?: string;
  remarks_3?: string;
  ex_rate?: string;
  curr_code?: string;
  last_post_month?: string;
  last_post_year?: string;
  last_doc_no?: string;
  employee_id?: string;
  signatory_name?: string;
  signatory_position?: string;
};

export type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TContinuousAutoMemo> | null;
  onClose: (shouldRefetch?: boolean) => void;
  /** lets the page header disable its buttons while a save is in flight */
  onSavingChange?: (saving: boolean) => void;
};

type Key = keyof TContinuousAutoMemo;

const DOC_TYPES = [
  { value: "ADD", label: "Addition" },
  { value: "DED", label: "Deduction" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => String(currentYear - 5 + i)).map((y) => ({
  value: y,
  label: y,
}));

/** Any incoming date shape -> 'YYYY-MM-DD' for <input type="date">. */
function toDate(value: unknown): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = "",
) {
  return {
    parameter,
    loginid,
    code1: companyCode,
    code2,
    code3,
    code4,
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
  };
}

const emptyForm = (): TContinuousAutoMemo => {
  const today = toDate(new Date().toISOString());
  return {
    doc_no: "",
    doc_date: today,
    approved_date: today,
    doc_type: "ADD",
    employee_code: "",
    employee_name: "",
    pay_comp_id: "",
    amount: "0.000",
    month_from: "",
    year_from: String(currentYear),
    month_to: "",
    year_to: String(currentYear),
    name_from: "",
    addr_from: "",
    name_to: "",
    addr_to: "",
    lettr_subject: "",
    remarks_1: "",
    remarks_2: "",
    ex_rate: "1.000",
    curr_code: "",
    last_post_month: "",
    last_post_year: "",
    last_doc_no: "",
    employee_id: "",
    signatory_name: "",
    signatory_position: "",
  };
};

const buildInitial = (
  mode: FormMode,
  existingData?: Partial<TContinuousAutoMemo> | null,
): TContinuousAutoMemo => {
  const base = emptyForm();
  if (mode === "add" || !existingData) return base;
  const raw = existingData as Record<string, unknown>;
  return {
    ...base,
    ...existingData,
    employee_code: String(raw.EMPLOYEE_CODE ?? existingData.employee_code ?? ""),
    employee_name: String(raw.EMPLOYEE_NAME ?? existingData.employee_name ?? ""),
    doc_date: toDate(existingData.doc_date) || base.doc_date,
    approved_date: toDate(existingData.approved_date) || base.approved_date,
  };
};

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save / submit)
   ───────────────────────────────────────────────────────────── */
export const AddContinuousAutoMemoForm = forwardRef<ContinuousAutoMemoFormHandle, Props>(
  function AddContinuousAutoMemoForm({ mode, existingData, onClose, onSavingChange }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";
    const loginid = user?.loginid ?? "";
    const companyCode = user?.company_code ?? "";

    const [form, setForm] = useState<TContinuousAutoMemo>(() => buildInitial(mode, existingData));
    const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
    const [saving, setSaving] = useState(false);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

    const [payComponents, setPayComponents] = useState<any[]>([]);
    const [months, setMonths] = useState<{ value: string; label: string }[]>([]);

    const set = (field: Key, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

    // ── Fetch Pay Components — parameter "PAY_COMPONENT_PAYUNIT_Dep_UnitId" ──
    useEffect(() => {
      if (!companyCode) return;
      (async () => {
        try {
          const response = await getDynamicLookup(
            buildParams("PAY_COMPONENT_PAYUNIT_Dep_UnitId", loginid, companyCode),
          );
          setPayComponents(Array.isArray(response) ? response : []);
        } catch (error) {
          console.error("Failed to load pay components:", error);
        }
      })();
    }, [companyCode, loginid]);

    // ── Fetch Months — parameter "HR_CAM_HR_CODE_VALUES_37" ──────────────────
    useEffect(() => {
      if (!companyCode) return;
      (async () => {
        try {
          const response = await getDynamicLookup(
            buildParams("HR_CAM_HR_CODE_VALUES_37", loginid, companyCode, "37", "A"),
          );
          const data = Array.isArray(response) ? response : [];
          const sorted = [...data]
            .sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order))
            .map((item: any) => ({ value: item.value_code, label: item.value_desc }));
          setMonths(sorted);
        } catch (error) {
          console.error("Failed to load months:", error);
        }
      })();
    }, [companyCode, loginid]);

    // ── Employee lookup — "HR_CAM_HR_Employee_Code" (VW_HR_EMP_REGISTER) ─────
    const loadEmployees = useCallback(
      () => getDynamicLookup(buildParams("HR_CAM_HR_Employee_Code", loginid, companyCode)),
      [loginid, companyCode],
    );

    const handleEmployeeChange = useCallback(
      (_: string, row: Record<string, unknown> | null) => {
        if (!row) {
          setForm((prev) => ({ ...prev, employee_code: "", employee_name: "" }));
          return;
        }
        const r = row as Record<string, any>;
        const code = String(r.employee_code ?? r.EMPLOYEE_CODE ?? "");
        const name = String(r.rpt_name ?? r.RPT_NAME ?? r.employee_name ?? "");
        const id = r.employee_id ?? r.EMPLOYEE_ID;
        setForm((prev) => ({
          ...prev,
          employee_code: code,
          employee_name: name,
          // pick up the id from the lookup row when it's there; otherwise keep what we had
          employee_id: id != null && id !== "" ? String(id) : prev.employee_id,
        }));
        setErrors((prev) => ({ ...prev, employee_code: undefined }));
      },
      [],
    );

    // ── Validation ───────────────────────────────────────────────────────────
    const validate = (): string | null => {
      const next: Partial<Record<Key, string>> = {};
      if (!form.employee_code?.trim()) next.employee_code = "Employee is required";
      if (!form.doc_date) next.doc_date = "Doc Date is required";
      if (!form.doc_type?.trim()) next.doc_type = "Doc Type is required";
      if (!form.pay_comp_id?.trim()) next.pay_comp_id = "Pay Component is required";
      if (!form.amount || Number(form.amount) <= 0) next.amount = "Amount must be greater than 0";
      if (!form.month_from) next.month_from = "Effective From Month is required";
      if (!form.year_from) next.year_from = "Effective From Year is required";
      if (!form.month_to) next.month_to = "Effective To Month is required";
      if (!form.year_to) next.year_to = "Effective To Year is required";
      setErrors(next);
      return Object.values(next)[0] ?? null;
    };

    // ── Save — parameter "hr_cam_emp_cont_memo_ins_upd". Slot mapping must
    // stay in lockstep with the WHEN 'hr_cam_emp_cont_memo_ins_upd' branch in
    // PROC_BUILD_DYNAMIC_INS_UPD_COLUMN90 (val1n1=doc_no, val1s2=doc_type,
    // val1s3=doc_date, val1s4-7=name/addr from/to, val1s8=lettr_subject,
    // val1s9-11=remarks 1-3, val1s12=curr_code, val1n2=ex_rate, val1n3=amount,
    // val1s13-14=signatory name/position, val1s15=employee_id,
    // val1s16=employee_code, val1s17=pay_comp_id, val1s18=employee_name,
    // val1n4-7=month_from/year_from/month_to/year_to, val1s19=approved_date,
    // val1n8-10=last_post_month/last_post_year/last_doc_no). ──────────────────
    const handleSave = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }

      setSaving(true);
      onSavingChange?.(true);
      try {
        await executeDynamicMutationColumn90({
          parameter: "hr_cam_emp_cont_memo_ins_upd",
          loginid,

          val1s1: companyCode,
          val1s2: form.doc_type ?? "ADD",
          val1n1: form.doc_no ? Number(form.doc_no) : undefined,
          val1s3: toDate(form.doc_date),

          val1s4: form.name_from || "",
          val1s5: form.addr_from || "",
          val1s6: form.name_to || "",
          val1s7: form.addr_to || "",

          val1s8: form.lettr_subject || "",

          val1s9: form.remarks_1 || "",
          val1s10: form.remarks_2 || "",
          val1s11: form.remarks_3 || "",

          val1s12: form.curr_code || "",
          val1n2: Number(form.ex_rate ?? 1),
          val1n3: Number(form.amount ?? 0),

          val1s13: form.signatory_name || "",
          val1s14: form.signatory_position || "",

          val1s15: form.employee_id || "",
          val1s16: form.employee_code ?? "",
          val1s17: form.pay_comp_id ?? "",
          val1s18: form.employee_name || "",

          val1n4: Number(form.month_from || 0),
          val1n5: Number(form.year_from || 0),
          val1n6: Number(form.month_to || 0),
          val1n7: Number(form.year_to || 0),

          // NOTE: val1s19/val1n8/val1n9/val1n10 aren't declared on
          // DynamicMutationParams (which only goes up to val1s18/val1n7).
          // Sent as-is to match the DB proc's slot mapping — extend the
          // type in api/lookups.ts to type these properly.
          ...({
            val1s19: toDate(form.approved_date), // APPROVED_DATE
            val1n8: Number(form.last_post_month || 0),
            val1n9: Number(form.last_post_year || 0),
            val1n10: Number(form.last_doc_no || 0),
          } as any),
        });
        toast.success(isEdit ? "Memo updated successfully" : "Memo saved successfully");
        onClose(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save continuous auto memo");
      } finally {
        setSaving(false);
        onSavingChange?.(false);
      }
    };

    // Submit = validate first, then confirm, then the same save call
    const handleSubmitClick = () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }
      setConfirmSubmitOpen(true);
    };

    const confirmSubmit = async () => {
      setConfirmSubmitOpen(false);
      await handleSave();
    };

    /* ✅ Expose to parent */
    useImperativeHandle(ref, () => ({
      saveDraft: handleSave,
      submit: handleSubmitClick,
    }));

    // ── Field helpers (built on the shared Field) ────────────────────────────
    const field = (
      label: string,
      key: Key,
      type: "text" | "date" | "number" = "text",
      required = false,
      className?: string,
    ) => (
      <Field label={label} required={required} error={errors[key]} className={className}>
        <Input
          type={type}
          disabled={readonly}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      </Field>
    );

    const selectField = (
      label: string,
      key: Key,
      options: { value: string; label: string }[],
      required = false,
    ) => (
      <Field label={label} required={required} error={errors[key]}>
        <Select
          disabled={readonly}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    );

    const payComponentOptions = useMemo(
      () =>
        (payComponents ?? []).map((pc: any) => ({
          value: pc.pay_comp_id,
          label: `${pc.pay_comp_id ?? ""} - ${pc.pay_comp_short_desc ?? ""}`,
        })),
      [payComponents],
    );

    // ── UI ───────────────────────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <SectionPanel title="Document Information" icon={FileText}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Doc No">
              <Input disabled value={form.doc_no || "Autogenerated"} />
            </Field>
            {field("Doc Date", "doc_date", "date", true)}
            {selectField("Doc Type", "doc_type", DOC_TYPES, true)}
            {field("Approved Date", "approved_date", "date")}
          </div>
        </SectionPanel>

        <SectionPanel title="Employee & Payment" icon={UserRound}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Employee" required error={errors.employee_code}>
              <LookupField
                compact
                label="Employee"
                disabled={readonly}
                value={form.employee_code ?? ""}
                // Only Code + Name shown, in the dropdown and as the display value
                displayValue={
                  form.employee_code
                    ? `${form.employee_code}${form.employee_name ? ` - ${form.employee_name}` : ""}`
                    : ""
                }
                columns={[
                  { field: "employee_code", header: "Code" },
                  { field: "rpt_name", header: "Name" },
                ]}
                valueField="employee_code"
                displayFields={["employee_code", "rpt_name"]}
                loadOptions={loadEmployees}
                onChange={handleEmployeeChange}
              />
            </Field>
            {selectField("Pay Component", "pay_comp_id", payComponentOptions, true)}
            {field("Amount", "amount", "number", true)}
          </div>
        </SectionPanel>

        <SectionPanel title="Effective Period" icon={CalendarRange}>
          <div className="grid gap-3 md:grid-cols-4">
            {selectField("Effective From (Month)", "month_from", months, true)}
            {selectField("From Year", "year_from", YEARS, true)}
            {selectField("Effective To (Month)", "month_to", months, true)}
            {selectField("To Year", "year_to", YEARS, true)}
          </div>
        </SectionPanel>

        <SectionPanel title="Letter & Correspondence" icon={Mail}>
          <div className="grid gap-3 md:grid-cols-2">
            {field("Name From", "name_from")}
            {field("Addr From", "addr_from")}
            {field("Name To", "name_to")}
            {field("Addr To", "addr_to")}
            {field("Letter Subject", "lettr_subject", "text", false, "md:col-span-2")}
            {field("Remarks 1", "remarks_1")}
            {field("Remarks 2", "remarks_2")}
          </div>
        </SectionPanel>

        <SectionPanel title="Signatory" icon={PenLine}>
          <div className="grid gap-3 md:grid-cols-2">
            {field("Signatory Name", "signatory_name")}
            {field("Signatory Position", "signatory_position")}
          </div>
        </SectionPanel>

        {/* ── Submit confirmation ── */}
        <Dialog
          open={confirmSubmitOpen}
          title="Submit"
          description="Are you sure you want to Submit?"
          compact
          onClose={() => setConfirmSubmitOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>
                No
              </Button>
              <Button onClick={() => void confirmSubmit()} disabled={saving}>
                Yes
              </Button>
            </>
          }
        >
          <p className="m-0 text-sm text-muted-foreground">
            This will submit document <strong>{form.doc_no || "(new)"}</strong>.
          </p>
        </Dialog>
      </div>
    );
  },
);