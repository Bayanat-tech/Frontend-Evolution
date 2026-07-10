// src/pages/hr/AddGradeMasterForm.tsx
//
// Add / Edit / View form for a single Grade record. Structured the same
// way as Addinterviewevalform.tsx (Card/CardContent sections, field()
// helper, useAuth, save via a dedicated service instance) but laid out to
// match the legacy "HR General Masters - Grades" screen:
//   Company | Grade Code | Name | Short Name | OT Eligibility | Grade Status
//   Airfare Entitlement (Self/Spouse/Dependent)
//   Medical Entitlement (Self/Spouse/Dependent)
//   Remarks | Status
//   Grade Components grid: SlNo, Pay Unit, Min Pay Amount, Max Pay Amount, Approved Date

import { Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import hrGradeServiceInstance from "./upsertHrGradeApi";
import type { GradeRow } from "./GradeMasterPage";

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

type GradeComponentFormRow = {
  id: string;
  pay_comp_id: string;
  pay_comp_desc?: string;
  min_pay_amt: number;
  max_pay_amt: number;
  approved_date: string;
};

type PayComponentOption = {
  pay_comp_id: string;
  pay_comp_desc: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<GradeRow>;
  onClose: (shouldRefetch?: boolean) => void;
};

type GradeFormState = {
  grade_code: string;
  grade_name: string;
  grade_short_name: string;
  ot_eligibility: string;
  grade_status: string;
  airfare_entitlement: string;
  spouse_af_entitlement: string;
  dep_af_entitlement: string;
  medical_entitlement: string;
  spouse_med_entitlement: string;
  dep_med_entitlement: string;
  remarks: string;
  status: string;
};

const EMPTY: GradeFormState = {
  grade_code: "",
  grade_name: "",
  grade_short_name: "",
  ot_eligibility: "N",
  grade_status: "",
  airfare_entitlement: "N",
  spouse_af_entitlement: "N",
  dep_af_entitlement: "N",
  medical_entitlement: "N",
  spouse_med_entitlement: "N",
  dep_med_entitlement: "N",
  remarks: "",
  status: "A",
};

function toDate(value: unknown): string {
  if (!value) return "";
  const normalized = String(value).trim();
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function AddGradeMasterForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<GradeFormState>({ ...EMPTY });
  const [components, setComponents] = useState<GradeComponentFormRow[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof GradeFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [payComponents, setPayComponents] = useState<PayComponentOption[]>([]);

  // ── Load pay components for the "Pay Unit" dropdown ────────────────────
  // NOTE: parameter name is a guess (mirrors the HR_CAM_DEPARTMENT_DEPTCODE
  // pattern used elsewhere) — swap it for whatever your actual pay
  // component lookup proc is called.
  const loadPayComponents = useCallback(async () => {
    try {
      const res = await getDynamicLookup({
        parameter: "HR_PAY_COMPONENT_LOOKUP",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
        code2: "",
        code3: "",
        code4: "",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
      setPayComponents(
        list.map((p) => ({
          pay_comp_id: String(p.PAY_COMP_ID ?? p.pay_comp_id ?? ""),
          pay_comp_desc: String(p.PAY_COMP_DESC ?? p.pay_comp_desc ?? ""),
        })),
      );
    } catch {
      // non-critical; dropdown will be empty and fall back to manual code entry
    }
  }, [user?.loginid, user?.company_code]);

  useEffect(() => {
    void loadPayComponents();
  }, [loadPayComponents]);

  // ── Load grade components for edit/view ─────────────────────────────────
  // NOTE: parameter name is a guess — swap for your actual grade-components
  // select proc. insUpdHrGrade only covers save, so a separate read call is
  // needed here to populate the detail grid.
  const loadComponents = useCallback(async () => {
    if (!(isEdit || readonly) || !existingData?.grade_code) return;
    try {
      const res = await getDynamicLookup({
        parameter: "MST_HR_MS_HR_GRADE_COMPONENTS_SELECT",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
        code2: String(existingData.grade_code ?? ""),
        code3: "",
        code4: "",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
      setComponents(
        list.map((c) => ({
          id: newId(),
          pay_comp_id: String(c.PAY_COMP_ID ?? c.pay_comp_id ?? ""),
          pay_comp_desc: String(c.PAY_COMP_DESC ?? c.pay_comp_desc ?? ""),
          min_pay_amt: Number(c.MIN_PAY_AMT ?? c.min_pay_amt ?? 0),
          max_pay_amt: Number(c.MAX_PAY_AMT ?? c.max_pay_amt ?? 0),
          approved_date: toDate(c.APPROVED_DATE ?? c.approved_date),
        })),
      );
    } catch {
      // non-critical; grid opens empty if the read fails
    }
  }, [isEdit, readonly, existingData?.grade_code, user?.loginid, user?.company_code]);

  useEffect(() => {
    void loadComponents();
  }, [loadComponents]);

  // ── Populate header on edit / view ──────────────────────────────────────
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        grade_code: String(existingData.grade_code ?? ""),
        grade_name: String(existingData.grade_name ?? ""),
        grade_short_name: String(existingData.grade_short_name ?? ""),
        ot_eligibility: String(existingData.ot_eligibility ?? "N"),
        grade_status: String(existingData.grade_status ?? ""),
        airfare_entitlement: String(existingData.airfare_entitlement ?? "N"),
        spouse_af_entitlement: String(existingData.spouse_af_entitlement ?? "N"),
        dep_af_entitlement: String(existingData.dep_af_entitlement ?? "N"),
        medical_entitlement: String(existingData.medical_entitlement ?? "N"),
        spouse_med_entitlement: String(existingData.spouse_med_entitlement ?? "N"),
        dep_med_entitlement: String(existingData.dep_med_entitlement ?? "N"),
        remarks: String(existingData.remarks ?? ""),
        status: String(existingData.status ?? "A"),
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof GradeFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setChecked = (field: keyof GradeFormState, checked: boolean) =>
    set(field, checked ? "Y" : "N");

  // ── Component row handlers ──────────────────────────────────────────────
  const addComponentRow = () => {
    setComponents((prev) => [
      ...prev,
      { id: newId(), pay_comp_id: "", min_pay_amt: 0, max_pay_amt: 0, approved_date: "" },
    ]);
  };

  const updateComponentRow = (id: string, patch: Partial<GradeComponentFormRow>) => {
    setComponents((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeComponentRow = (id: string) => {
    setComponents((prev) => prev.filter((row) => row.id !== id));
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: Partial<Record<keyof GradeFormState, string>> = {};
    if (!isEdit && form.grade_code.trim() === "" && false) {
      // grade_code is optional on add (server auto-generates if blank) —
      // left here in case your setup requires manual entry; flip the
      // `false` above to enforce it.
    }
    if (!form.grade_name.trim()) next.grade_name = "Name is required";
    if (!form.status) next.status = "Status is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const result = await hrGradeServiceInstance.upsertHrGradeApi({
        header: {
          company_code: user?.company_code ?? "",
          grade_code: isEdit ? form.grade_code : form.grade_code || undefined,
          grade_name: form.grade_name,
          grade_short_name: form.grade_short_name || undefined,
          ot_eligibility: form.ot_eligibility,
          grade_status: form.grade_status || undefined,
          airfare_entitlement: form.airfare_entitlement,
          spouse_af_entitlement: form.spouse_af_entitlement,
          dep_af_entitlement: form.dep_af_entitlement,
          medical_entitlement: form.medical_entitlement,
          spouse_med_entitlement: form.spouse_med_entitlement,
          dep_med_entitlement: form.dep_med_entitlement,
          remarks: form.remarks || undefined,
          status: form.status,
          user_id: user?.loginid ?? "ADMIN",
          user_dt: todayStr,
        },
        details: components.map((c, index) => ({
          company_code: user?.company_code ?? "",
          pay_comp_id: c.pay_comp_id || undefined,
          min_pay_amt: c.min_pay_amt,
          max_pay_amt: c.max_pay_amt,
          approved_date: c.approved_date || null,
          sort_order: index + 1,
        })),
        loginid: user?.loginid ?? "ADMIN",
      });

      if (!result.success) throw new Error(result.message || "Save failed");
      onClose(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save grade");
    } finally {
      setSaving(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4">
      {apiError && <div className="alert error">{apiError}</div>}

      <Card>
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <label className="field">
            <span>Company <strong className="text-destructive">*</strong></span>
            <Input disabled value={user?.company_name || user?.company_code || ""} />
          </label>

          <label className="field">
            <span>Grade Code <strong className="text-destructive">*</strong></span>
            <Input
              disabled={readonly || isEdit}
              placeholder="Auto-generated if left blank"
              value={form.grade_code}
              onChange={(e) => set("grade_code", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Name <strong className="text-destructive">*</strong></span>
            <Input
              disabled={readonly}
              value={form.grade_name}
              onChange={(e) => set("grade_name", e.target.value)}
            />
            {errors.grade_name && (
              <span className="text-destructive text-xs mt-0.5">{errors.grade_name}</span>
            )}
          </label>

          <label className="field">
            <span>Short Name</span>
            <Input
              disabled={readonly}
              value={form.grade_short_name}
              onChange={(e) => set("grade_short_name", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Eligibility for OT (Y/N)?</span>
            <Select
              disabled={readonly}
              value={form.ot_eligibility}
              onChange={(e) => set("ot_eligibility", e.target.value)}
            >
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </Select>
          </label>

          <label className="field">
            <span>Grade Status</span>
            <Select
              disabled={readonly}
              value={form.grade_status}
              onChange={(e) => set("grade_status", e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="A">Approved</option>
              <option value="P">Pending</option>
            </Select>
          </label>
        </CardContent>

        <CardContent className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold">Airfare Entitlement</legend>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Self</span>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.airfare_entitlement === "Y"}
                onChange={(e) => setChecked("airfare_entitlement", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Spouse</span>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.spouse_af_entitlement === "Y"}
                onChange={(e) => setChecked("spouse_af_entitlement", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Dependent</span>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.dep_af_entitlement === "Y"}
                onChange={(e) => setChecked("dep_af_entitlement", e.target.checked)}
              />
            </label>
          </fieldset>

          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold">Medical Entitlement</legend>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Self</span>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.medical_entitlement === "Y"}
                onChange={(e) => setChecked("medical_entitlement", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Spouse</span>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.spouse_med_entitlement === "Y"}
                onChange={(e) => setChecked("spouse_med_entitlement", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Dependent</span>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.dep_med_entitlement === "Y"}
                onChange={(e) => setChecked("dep_med_entitlement", e.target.checked)}
              />
            </label>
          </fieldset>
        </CardContent>

        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <label className="field">
            <span>Remarks</span>
            <textarea
              className="input"
              rows={3}
              disabled={readonly}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </label>

          <label className="field">
            <span>Status <strong className="text-destructive">*</strong></span>
            <Select
              disabled={readonly}
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="A">Active</option>
              <option value="N">Inactive</option>
            </Select>
            {errors.status && (
              <span className="text-destructive text-xs mt-0.5">{errors.status}</span>
            )}
          </label>
        </CardContent>
      </Card>

      {/* ── Grade Components ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-sm font-semibold text-primary">Grade Components</h3>
            {!readonly && (
              <Button size="sm" variant="outline" onClick={addComponentRow}>
                <Plus size={14} /> Add Line
              </Button>
            )}
          </div>

          <div className="overflow-auto rounded-md border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="px-2 py-2 text-left w-16">SlNo.</th>
                  <th className="px-2 py-2 text-left">Pay Unit</th>
                  <th className="px-2 py-2 text-left w-40">Min Pay Amount</th>
                  <th className="px-2 py-2 text-left w-40">Max Pay Amount</th>
                  <th className="px-2 py-2 text-left w-44">Approved Date</th>
                  {!readonly && <th className="px-2 py-2 text-left w-16">Action</th>}
                </tr>
              </thead>
              <tbody>
                {components.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-muted-foreground"
                      colSpan={readonly ? 5 : 6}
                    >
                      No components added
                    </td>
                  </tr>
                ) : (
                  components.map((row, index) => (
                    <tr className="border-t" key={row.id}>
                      <td className="px-2 py-1 text-xs">{index + 1}</td>
                      <td className="px-2 py-1">
                        <Select
                          disabled={readonly}
                          value={row.pay_comp_id}
                          onChange={(e) => {
                            const selected = payComponents.find(
                              (p) => p.pay_comp_id === e.target.value,
                            );
                            updateComponentRow(row.id, {
                              pay_comp_id: e.target.value,
                              pay_comp_desc: selected?.pay_comp_desc ?? "",
                            });
                          }}
                        >
                          <option value="">-- Select Pay Unit --</option>
                          {payComponents.map((p) => (
                            <option key={p.pay_comp_id} value={p.pay_comp_id}>
                              {p.pay_comp_id} - {p.pay_comp_desc}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          step="0.001"
                          disabled={readonly}
                          value={row.min_pay_amt}
                          onChange={(e) =>
                            updateComponentRow(row.id, { min_pay_amt: Number(e.target.value || 0) })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          step="0.001"
                          disabled={readonly}
                          value={row.max_pay_amt}
                          onChange={(e) =>
                            updateComponentRow(row.id, { max_pay_amt: Number(e.target.value || 0) })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="date"
                          disabled={readonly}
                          value={row.approved_date}
                          onChange={(e) => updateComponentRow(row.id, { approved_date: e.target.value })}
                        />
                      </td>
                      {!readonly && (
                        <td className="px-2 py-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeComponentRow(row.id)}
                          >
                            <X size={14} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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