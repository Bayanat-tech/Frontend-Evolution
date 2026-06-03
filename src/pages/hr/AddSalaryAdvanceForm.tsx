import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { executeDynamicMutationColumn90 } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

export type TSalaryAdvance = {
  doc_no?: string;
  doc_type?: string;
  doc_date?: string;
  ref_no?: string;
  employee_code?: string;
  name_from?: string;
  addr_from?: string;
  lettr_subject?: string;
  remarks_1?: string;
  remarks_2?: string;
  signatory_name?: string;
  signatory_position?: string;
  amount?: number | null;
  recover_mth_amt?: number | null;
  recover_from_dt?: string;
  recovery_period?: number | null;
  balance_amt?: number | null;
  deduct_from_leave?: string;
  doc_status?: string;
  pay_month?: string;
  pay_year?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TSalaryAdvance>;
  onClose: (shouldRefetch?: boolean) => void;
};

function toDate(value: unknown): string {
  if (!value) return "";
  const normalized = String(value).trim();
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const EMPTY: TSalaryAdvance = {
  doc_no: "",
  doc_type: "SA",
  doc_date: "",
  ref_no: "",
  employee_code: "",
  name_from: "",
  addr_from: "",
  lettr_subject: "",
  remarks_1: "",
  remarks_2: "",
  signatory_name: "",
  signatory_position: "",
  amount: null,
  recover_mth_amt: null,
  recover_from_dt: "",
  recovery_period: null,
  balance_amt: null,
  deduct_from_leave: "N",
  doc_status: "A",
  pay_month: "",
  pay_year: "",
};

export function AddSalaryAdvanceForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<TSalaryAdvance>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TSalaryAdvance, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        ...existingData,
        doc_date: toDate(existingData.doc_date),
        recover_from_dt: toDate(existingData.recover_from_dt),
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TSalaryAdvance, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof TSalaryAdvance, string>> = {};
    if (!form.employee_code?.trim()) next.employee_code = "Employee Code is required";
    if (!form.doc_date) next.doc_date = "Doc Date is required";
    if (!form.recover_from_dt) next.recover_from_dt = "Recover From Date is required";
    if (!form.doc_type) next.doc_type = "Doc Type is required";
    if (!form.doc_status) next.doc_status = "Status is required";
    if (!form.recover_mth_amt || num(form.recover_mth_amt) <= 0)
      next.recover_mth_amt = "Recover/Month must be > 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      await executeDynamicMutationColumn90({
        parameter: "hr_salary_advance_ins_upd",
        loginid: user?.loginid ?? "",
        val1s1: user?.company_code ?? "",
        val1s2: form.doc_no || "",
        val1s3: form.doc_type ?? "SA",
        val1s4: toDate(form.doc_date),
        val1s5: form.ref_no || "",
        val1s6: form.employee_code ?? "",
        val1s7: form.name_from || "",
        val1s8: form.addr_from || "",
        val1s9: form.lettr_subject || "",
        val1s10: form.remarks_1 || "",
        val1s11: form.remarks_2 || "",
        val1s12: form.signatory_name || "",
        val1s13: form.signatory_position || "",
        val1s14: toDate(form.recover_from_dt),
        val1s15: form.deduct_from_leave || "N",
        val1s16: form.doc_status ?? "A",
        wval1s1: form.pay_month || "",
        wval1s2: form.pay_year || "",
        val1n1: num(form.amount),
        val1n2: num(form.recover_mth_amt),
        val1n3: num(form.recovery_period),
        val1n4: num(form.balance_amt) || num(form.amount),
      });
      onClose(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save salary advance");
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof TSalaryAdvance,
    type: "text" | "number" | "date" | "textarea" = "text",
    extraDisabled = false
  ) => (
    <label className="field">
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea
          className="input"
          rows={3}
          disabled={readonly || extraDisabled}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      ) : (
        <Input
          type={type}
          disabled={readonly || extraDisabled}
          value={type === "number" ? (form[key] ?? "") : String(form[key] ?? "")}
          onChange={(e) =>
            set(key, type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
          }
        />
      )}
      {errors[key] && <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>}
    </label>
  );

  return (
    <div className="grid gap-4">
      {apiError && <div className="alert error">{apiError}</div>}

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Document</p>
            <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="field">
            <span>Doc No</span>
            <Input disabled value={form.doc_no || "Autogenerated"} />
          </label>
          <label className="field">
            <span>Doc Type <strong className="text-destructive">*</strong></span>
            <Select disabled={readonly} value={form.doc_type ?? "SA"} onChange={(e) => set("doc_type", e.target.value)}>
              <option value="SA">Salary Advance</option>
            </Select>
            {errors.doc_type && <span className="text-destructive text-xs mt-0.5">{errors.doc_type}</span>}
          </label>
          <label className="field">
            <span>Status <strong className="text-destructive">*</strong></span>
            <Select disabled={readonly} value={form.doc_status ?? "A"} onChange={(e) => set("doc_status", e.target.value)}>
              <option value="A">Active</option>
              <option value="C">Cancelled</option>
            </Select>
          </label>
          <label className="field">
            <span>Doc Date <strong className="text-destructive">*</strong></span>
            <Input type="date" disabled={readonly} value={form.doc_date ?? ""} onChange={(e) => set("doc_date", e.target.value)} />
            {errors.doc_date && <span className="text-destructive text-xs mt-0.5">{errors.doc_date}</span>}
          </label>
          {field("Ref No", "ref_no")}
          <label className="field">
            <span>Employee Code <strong className="text-destructive">*</strong></span>
            <Input
              disabled={readonly || isEdit}
              value={form.employee_code ?? ""}
              onChange={(e) => set("employee_code", e.target.value)}
            />
            {errors.employee_code && <span className="text-destructive text-xs mt-0.5">{errors.employee_code}</span>}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Parties</p>
            <h2 className="m-0 text-sm font-semibold">Name, Address & Signatory</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {field("Name From", "name_from")}
          {field("Signatory Name", "signatory_name")}
          {field("Address From", "addr_from", "textarea")}
          {field("Signatory Position", "signatory_position")}
          <label className="field md:col-span-2">
            <span>Letter Subject</span>
            <Input
              disabled={readonly}
              value={form.lettr_subject ?? ""}
              onChange={(e) => set("lettr_subject", e.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Financials</p>
            <h2 className="m-0 text-sm font-semibold">Amounts & Recovery</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {field("Amount", "amount", "number")}
          <label className="field">
            <span>Recover / Month <strong className="text-destructive">*</strong></span>
            <Input
              type="number"
              disabled={readonly}
              value={form.recover_mth_amt ?? ""}
              onChange={(e) => set("recover_mth_amt", e.target.value === "" ? null : Number(e.target.value))}
            />
            {errors.recover_mth_amt && <span className="text-destructive text-xs mt-0.5">{errors.recover_mth_amt}</span>}
          </label>
          {field("Recovery Period (Months)", "recovery_period", "number")}
          <label className="field">
            <span>Recover From Date <strong className="text-destructive">*</strong></span>
            <Input type="date" disabled={readonly} value={form.recover_from_dt ?? ""} onChange={(e) => set("recover_from_dt", e.target.value)} />
            {errors.recover_from_dt && <span className="text-destructive text-xs mt-0.5">{errors.recover_from_dt}</span>}
          </label>
          {(isEdit || readonly) && (
            <label className="field">
              <span>Balance Amount</span>
              <Input disabled value={form.balance_amt ?? ""} />
            </label>
          )}
          <label className="field">
            <span>Deduct From Leave</span>
            <Select disabled={readonly} value={form.deduct_from_leave ?? "N"} onChange={(e) => set("deduct_from_leave", e.target.value)}>
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </label>
          {field("Pay Month", "pay_month")}
          {field("Pay Year", "pay_year")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Notes</p>
            <h2 className="m-0 text-sm font-semibold">Remarks</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {field("Remarks 1", "remarks_1", "textarea")}
          {field("Remarks 2", "remarks_2", "textarea")}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onClose(false)}>
          <X size={15} /> {readonly ? "Close" : "Cancel"}
        </Button>
        {!readonly && (
          <Button disabled={saving} onClick={handleSubmit}>
            <Save size={15} /> {saving ? "Saving..." : isEdit ? "Update" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}
