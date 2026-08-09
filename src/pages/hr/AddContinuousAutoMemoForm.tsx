import { Save, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// ─── Old field set — kept exactly as in the old form (no repurposed/workaround
// mapping: name_from/addr_from/name_to/addr_to are real correspondence fields,
// not effective-date stand-ins). ───────────────────────────────────────────
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

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TContinuousAutoMemo>;
  onClose: (shouldRefetch?: boolean) => void;
};

// ── Employee dropdown option — only code + name shown, same as before ──────
type EmployeeOption = {
  employee_code: string;
  employee_name: string;
};

const DOC_TYPES = [
  { value: "ADD", label: "Addition" },
  { value: "DED", label: "Deduction" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => String(currentYear - 5 + i));

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

const EMPTY: TContinuousAutoMemo = {
  doc_no: "",
  doc_date: toDate(new Date().toISOString()),
  approved_date: toDate(new Date().toISOString()),
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

const MODE_BADGE: Record<FormMode, { label: string; className: string }> = {
  add: { label: "New", className: "bg-emerald-100 text-emerald-700" },
  edit: { label: "Editing", className: "bg-blue-100 text-blue-700" },
  view: { label: "Read Only", className: "bg-slate-100 text-slate-600" },
};

export function AddContinuousAutoMemoForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [form, setForm] = useState<TContinuousAutoMemo>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TContinuousAutoMemo, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const [payComponents, setPayComponents] = useState<any[]>([]);
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);

  // ── Employee dropdown state — same data source as before
  // ("HR_CAM_HR_Employee_Code"), just rendered as a LookupField dropdown
  // (search + select in one control) instead of a separate search Dialog. ──
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // ── Load existing record into form ─────────────────────────────────────
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      const empCode =
        (existingData as any).EMPLOYEE_CODE ?? existingData.employee_code ?? "";
      const empName =
        (existingData as any).EMPLOYEE_NAME ?? existingData.employee_name ?? "";
      setForm({
        ...EMPTY,
        ...existingData,
        employee_code: empCode,
        employee_name: empName,
        doc_date: toDate(existingData.doc_date) || EMPTY.doc_date,
        approved_date: toDate(existingData.approved_date) || EMPTY.approved_date,
      });
      if (empCode) {
        setEmployee({ employee_code: String(empCode), employee_name: String(empName) });
      }
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TContinuousAutoMemo, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

  // ── Fetch Months — parameter "HR_CAM_HR_CODE_VALUES_37" ─────────────────
  useEffect(() => {
    if (!companyCode) return;
    (async () => {
      try {
        const response = await getDynamicLookup({
          ...buildParams("HR_CAM_HR_CODE_VALUES_37", loginid, companyCode, "37", "A"),
        });
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

  // ── Employee lookup — SAME parameter/source as the original page
  // ("HR_CAM_HR_Employee_Code" -> VW_HR_EMP_REGISTER), just consumed by a
  // LookupField dropdown instead of the old search Dialog. ────────────────
  const loadEmployees = useCallback(
    () => getDynamicLookup(buildParams("HR_CAM_HR_Employee_Code", loginid, companyCode)),
    [loginid, companyCode],
  );

  const handleEmployeeChange = useCallback((_: string, row: Record<string, unknown> | null) => {
    if (!row) {
      setEmployee(null);
      setForm((prev) => ({ ...prev, employee_code: "", employee_name: "" }));
      return;
    }
    const code = String(row.employee_code ?? (row as any).EMPLOYEE_CODE ?? "");
    const name = String(row.rpt_name ?? (row as any).RPT_NAME ?? row.employee_name ?? "");
    setEmployee({ employee_code: code, employee_name: name });
    setForm((prev) => ({ ...prev, employee_code: code, employee_name: name }));
    setErrors((prev) => ({ ...prev, employee_code: undefined }));
  }, []);

  // ── Validation ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: Partial<Record<keyof TContinuousAutoMemo, string>> = {};
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
    return Object.keys(next).length === 0;
  };

  // ── Save — parameter "hr_cam_emp_cont_memo_ins_upd". Slot mapping must
  // stay in lockstep with the WHEN 'hr_cam_emp_cont_memo_ins_upd' branch in
  // PROC_BUILD_DYNAMIC_INS_UPD_COLUMN90 (val1n1=doc_no, val1s2=doc_type,
  // val1s3=doc_date, val1s4-7=name/addr from/to, val1s8=lettr_subject,
  // val1s9-11=remarks 1-3, val1s12=curr_code, val1n2=ex_rate, val1n3=amount,
  // val1s13-14=signatory name/position, val1s15=employee_id,
  // val1s16=employee_code, val1s17=pay_comp_id, val1s18=employee_name,
  // val1n4-7=month_from/year_from/month_to/year_to, val1s19=approved_date,
  // val1n8-10=last_post_month/last_post_year/last_doc_no). ──────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
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
      onClose(true);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to save continuous auto memo",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClick = () => {
    if (!validate()) return;
    setConfirmSubmitOpen(true);
  };
  const confirmSubmit = async () => {
    setConfirmSubmitOpen(false);
    await handleSave();
  };

  // ── Field helpers (min-w-0 on every cell prevents grid children from
  // forcing horizontal overflow when content is wider than the column) ────
  const field = (
    label: string,
    key: keyof TContinuousAutoMemo,
    type: "text" | "date" | "number" = "text",
    required = false,
    disabledOverride = false,
  ) => (
    <label className="field min-w-0" key={key}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      <Input
        type={type}
        disabled={readonly || disabledOverride}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
      {errors[key] && <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>}
    </label>
  );

  const selectField = (
    label: string,
    key: keyof TContinuousAutoMemo,
    options: { value: string; label: string }[],
    required = false,
  ) => (
    <label className="field min-w-0" key={key}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
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
      {errors[key] && <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>}
    </label>
  );

  const payComponentOptions = useMemo(
    () =>
      (payComponents ?? []).map((pc: any) => ({
        value: pc.pay_comp_id,
        label: `${pc.pay_comp_id ?? ""} - ${pc.pay_comp_short_desc ?? ""}`,
      })),
    [payComponents],
  );

  return (
    <div className="grid gap-y-3 gap-x-4 overflow-hidden">
      {apiError && <div className="alert error">{apiError}</div>}

      {/* ── Header strip ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 border-b pb-2">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold">Continuous Auto Memo</h2>
          <p className="m-0 text-sm font-semibold text-primary truncate">
            {form.doc_no || "Doc No"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${MODE_BADGE[mode].className}`}
        >
          {MODE_BADGE[mode].label}
        </span>
      </div>

      {/* ── One flowing grid — same fields/order as the original page ────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 min-w-0 sm:grid-cols-4">
        {field("Doc Date", "doc_date", "date", true)}
        {selectField("Doc Type", "doc_type", DOC_TYPES, true)}
        {field("Approved Date", "approved_date", "date")}

        <label className="field min-w-0">
          <span>
            Employee Code <strong className="text-destructive">*</strong>
          </span>
          <LookupField
            key={`employee-${resetKey}`}
            compact
            label="Employee"
            disabled={readonly}
            value={employee?.employee_code ?? ""}
            // Only Code + Name shown, in the dropdown and as the display value
            displayValue={
              employee ? `${employee.employee_code} - ${employee.employee_name}` : ""
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
          {errors.employee_code && (
            <span className="text-destructive text-xs mt-0.5">{errors.employee_code}</span>
          )}
        </label>

        {/* <label className="field min-w-0" key="employee_name">
          <span>Employee Name</span>
          <Input disabled value={form.employee_name ?? ""} />
        </label> */}
        {selectField("Pay Component", "pay_comp_id", payComponentOptions, true)}
        {field("Amount", "amount", "number", true)}
        {selectField("Effective From (Month)", "month_from", months, true)}

        {selectField(
          "Year",
          "year_from",
          YEARS.map((y) => ({ value: y, label: y })),
          true,
        )}
        {selectField("Effective To (Month)", "month_to", months, true)}
        {selectField(
          "Year",
          "year_to",
          YEARS.map((y) => ({ value: y, label: y })),
          true,
        )}
        {field("Name From", "name_from")}

        {field("Addr From", "addr_from")}
        {field("Name To", "name_to")}
        {field("Addr To", "addr_to")}
        <label className="field min-w-0 col-span-2 sm:col-span-1">
          <span>Signatory Name</span>
          <Input
            disabled={readonly}
            value={form.signatory_name ?? ""}
            onChange={(e) => set("signatory_name", e.target.value)}
          />
        </label>

        <label className="field min-w-0 col-span-2 sm:col-span-4">
          <span>Letter Subject</span>
          <Input
            disabled={readonly}
            value={form.lettr_subject ?? ""}
            onChange={(e) => set("lettr_subject", e.target.value)}
          />
        </label>

        {field("Remarks 1", "remarks_1")}
        {field("Remarks 2", "remarks_2")}
        {field("Signatory Position", "signatory_position")}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          variant="outline"
          onClick={() => {
            setResetKey((k) => k + 1);
            onClose(false);
          }}
        >
          <X size={15} /> {readonly ? "Close" : "Cancel"}
        </Button>
        {!readonly && (
          <>
            <Button variant="outline" disabled={saving} onClick={handleSave}>
              <Save size={15} /> {saving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button disabled={saving} onClick={handleSubmitClick}>
              <Send size={15} /> Submit
            </Button>
          </>
        )}
      </div>

      {/* ── Submit confirmation ──────────────────────────────────────────── */}
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
            <Button onClick={confirmSubmit} disabled={saving}>
              Yes
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This will submit document <strong>{form.doc_no || "(new)"}</strong>.
        </p>
      </Dialog>
    </div>
  );
}