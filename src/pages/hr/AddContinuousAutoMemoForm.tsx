import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { executeDynamicMutationColumn90 } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

export type TContinuousAutoMemo = {
  doc_no?: string;
  doc_type?: string;
  doc_date?: string;
  employee_code?: string;
  employee_name?: string;
  name_from?: string;
  addr_from?: string;
  name_to?: string;     // stored in NAME_TO  — repurposed for "effective_from_dt" display
  addr_to?: string;     // stored in ADDR_TO  — repurposed for "effective_to_dt" display
  lettr_subject?: string;
  remarks_1?: string;   // stored in REMARKS_1 — repurposed for memo_type
  remarks_2?: string;   // stored in REMARKS_2 — repurposed for memo_category
  remarks_3?: string;   // stored in REMARKS_3 — repurposed for memo_text
  signatory_name?: string;
  signatory_position?: string;
  doc_status?: string;  // stored in CANCEL_BY (workaround)
  ref_no?: string;      // stored in CURR_CODE (workaround)
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TContinuousAutoMemo>;
  onClose: (shouldRefetch?: boolean) => void;
};

function toDate(value: unknown): string {
  if (!value) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

const EMPTY: TContinuousAutoMemo = {
  doc_no: "",
  doc_type: "CAM",
  doc_date: "",
  employee_code: "",
  employee_name: "",
  name_from: "",
  addr_from: "",
  name_to: "",       // effective_from_dt
  addr_to: "",       // effective_to_dt
  lettr_subject: "",
  remarks_1: "",     // memo_type
  remarks_2: "",     // memo_category
  remarks_3: "",     // memo_text
  signatory_name: "",
  signatory_position: "",
  doc_status: "A",
  ref_no: "",
};

export function AddContinuousAutoMemoForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<TContinuousAutoMemo>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TContinuousAutoMemo, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        ...existingData,
        doc_date: toDate(existingData.doc_date),
        name_to:  toDate(existingData.name_to),   // effective_from_dt
        addr_to:  toDate(existingData.addr_to),    // effective_to_dt
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TContinuousAutoMemo, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof TContinuousAutoMemo, string>> = {};
    if (!form.employee_code?.trim()) next.employee_code = "Employee Code is required";
    if (!form.doc_date)              next.doc_date       = "Doc Date is required";
    if (!form.doc_type?.trim())      next.doc_type       = "Doc Type is required";
    if (!form.doc_status?.trim())    next.doc_status     = "Status is required";
    if (!form.name_to)               next.name_to        = "Effective From Date is required";
    if (!form.remarks_3?.trim())     next.remarks_3      = "Memo Text is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      await executeDynamicMutationColumn90({
        parameter: "HR_CAM_EMP_CONT_MEMO_INS_UPD",
        loginid: user?.loginid ?? "",

        // Slot mapping — must match WHEN branch in procedure:
        val1s1:  user?.company_code ?? "",       // COMPANY_CODE
        val1s2:  form.doc_no || "",              // DOC_NO  (empty = insert)
        val1s3:  form.doc_type ?? "CAM",         // DOC_TYPE
        val1s4:  toDate(form.doc_date),          // DOC_DATE  ← guarded in proc
        val1s5:  form.ref_no || "",              // REF_NO    → CURR_CODE
        val1s6:  form.employee_code ?? "",       // EMPLOYEE_CODE
        val1s7:  form.name_from || "",           // NAME_FROM
        val1s8:  form.addr_from || "",           // ADDR_FROM
        val1s9:  form.lettr_subject || "",       // LETTR_SUBJECT
        val1s10: form.remarks_1 || "",           // MEMO_TYPE   → REMARKS_1
        val1s11: form.remarks_2 || "",           // MEMO_CATEGORY → REMARKS_2
        val1s12: form.remarks_3 || "",           // MEMO_TEXT   → REMARKS_3
        val1s13: form.signatory_name || "",      // SIGNATORY_NAME
        val1s14: form.signatory_position || "",  // SIGNATORY_POSITION
        val1s15: form.employee_name || "",       // EMPLOYEE_NAME
        val1s16: form.doc_status ?? "A",         // DOC_STATUS  → CANCEL_BY
        val1s17: toDate(form.name_to),           // EFFECTIVE_FROM_DT → NAME_TO (varchar)
        val1s18: toDate(form.addr_to),           // EFFECTIVE_TO_DT   → ADDR_TO (varchar)
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

  const field = (
    label: string,
    key: keyof TContinuousAutoMemo,
    type: "text" | "date" | "textarea" = "text",
    required = false,
    extraDisabled = false,
  ) => (
    <label className="field" key={key}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
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
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
      {errors[key] && (
        <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>
      )}
    </label>
  );

  return (
    <div className="grid gap-4">
      {apiError && <div className="alert error">{apiError}</div>}

      {/* ── Document ──────────────────────────────────────────────────────── */}
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
            <span>
              Doc Type <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly}
              value={form.doc_type ?? "CAM"}
              onChange={(e) => set("doc_type", e.target.value)}
            >
              <option value="CAM">Continuous Auto Memo</option>
            </Select>
            {errors.doc_type && (
              <span className="text-destructive text-xs mt-0.5">{errors.doc_type}</span>
            )}
          </label>

          <label className="field">
            <span>
              Status <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly}
              value={form.doc_status ?? "A"}
              onChange={(e) => set("doc_status", e.target.value)}
            >
              <option value="A">Active</option>
              <option value="C">Cancelled</option>
            </Select>
            {errors.doc_status && (
              <span className="text-destructive text-xs mt-0.5">{errors.doc_status}</span>
            )}
          </label>

          <label className="field">
            <span>
              Doc Date <strong className="text-destructive">*</strong>
            </span>
            <Input
              type="date"
              disabled={readonly}
              value={form.doc_date ?? ""}
              onChange={(e) => set("doc_date", e.target.value)}
            />
            {errors.doc_date && (
              <span className="text-destructive text-xs mt-0.5">{errors.doc_date}</span>
            )}
          </label>

          {field("Ref No", "ref_no")}

          <label className="field">
            <span>
              Employee Code <strong className="text-destructive">*</strong>
            </span>
            <Input
              disabled={readonly || isEdit}
              value={form.employee_code ?? ""}
              onChange={(e) => set("employee_code", e.target.value)}
            />
            {errors.employee_code && (
              <span className="text-destructive text-xs mt-0.5">{errors.employee_code}</span>
            )}
          </label>

          {field("Employee Name", "employee_name")}
        </CardContent>
      </Card>

      {/* ── Memo Details ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Memo</p>
            <h2 className="m-0 text-sm font-semibold">Memo Details</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {field("Memo Type", "remarks_1")}
          {field("Memo Category", "remarks_2")}

          {/* name_to = effective_from_dt (stored in NAME_TO column) */}
          <label className="field">
            <span>
              Effective From <strong className="text-destructive">*</strong>
            </span>
            <Input
              type="date"
              disabled={readonly}
              value={form.name_to ?? ""}
              onChange={(e) => set("name_to", e.target.value)}
            />
            {errors.name_to && (
              <span className="text-destructive text-xs mt-0.5">{errors.name_to}</span>
            )}
          </label>

          {/* addr_to = effective_to_dt (stored in ADDR_TO column) */}
          <label className="field">
            <span>Effective To</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.addr_to ?? ""}
              onChange={(e) => set("addr_to", e.target.value)}
            />
          </label>

          <label className="field md:col-span-2 xl:col-span-3">
            <span>Letter Subject</span>
            <Input
              disabled={readonly}
              value={form.lettr_subject ?? ""}
              onChange={(e) => set("lettr_subject", e.target.value)}
            />
          </label>

          {/* remarks_3 = memo_text (stored in REMARKS_3 column) */}
          <label className="field md:col-span-2 xl:col-span-3">
            <span>
              Memo Text <strong className="text-destructive">*</strong>
            </span>
            <textarea
              className="input"
              rows={4}
              disabled={readonly}
              value={form.remarks_3 ?? ""}
              onChange={(e) => set("remarks_3", e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            {errors.remarks_3 && (
              <span className="text-destructive text-xs mt-0.5">{errors.remarks_3}</span>
            )}
          </label>
        </CardContent>
      </Card>

      {/* ── Parties ───────────────────────────────────────────────────────── */}
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
        </CardContent>
      </Card>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
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