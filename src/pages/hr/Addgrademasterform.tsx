// src/pages/hr/Addgrademasterform.tsx
//
// Grade Master form — new UI (modelled on ProductWmsForm):
//  • forwardRef + useImperativeHandle → parent header "Save" button calls save()
//  • Freight-style tabs + SectionPanel / Field / CheckboxField building blocks
//  • toast for validation / API feedback (no inline alert banners)
//  • No bottom Cancel/Submit row — List / Close / Save live in the page header

import {
  IdCard, ListChecks, Plane, HeartPulse, Search, StickyNote, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useState,
} from "react";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import type { GradeRow } from "./Grademasterpage";
import hrGradeServiceInstance from "./Upserthrgradeapi";

/* ✅ Expose save() to the parent (header Save button) */
export type GradeFormHandle = {
  save: () => Promise<void>;
};

const TABS = ["Grade Details", "Grade Components"];

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

type GradeLookupRow = {
  grade_code: string;
  grade_name: string;
  grade_short_name?: string;
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

/* ─────────────────────────────────────────────────────────────
   SectionPanel — Freight structure
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — Freight label styling
   ───────────────────────────────────────────────────────────── */
function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
      {error && <span className="text-destructive text-[10.5px]">{error}</span>}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Checkbox — native, blue, side-by-side (uses DIV, not label)
   ───────────────────────────────────────────────────────────── */
function CheckboxField({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#00378C", width: "15px", height: "15px" }}
        className="shrink-0 cursor-pointer rounded border border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00378C]/25 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label && (
        <span
          onClick={() => !disabled && onChange(!checked)}
          className={`text-[11.5px] font-medium text-slate-700 leading-none transition-colors ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-slate-900"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
export const AddGradeMasterForm = forwardRef<GradeFormHandle, Props>(
  function AddGradeMasterForm({ mode, existingData, onClose }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";
    const isAdd = mode === "add";

    const [tab, setTab] = useState(0);
    const [form, setForm] = useState<GradeFormState>({ ...EMPTY });
    const [components, setComponents] = useState<GradeComponentFormRow[]>([]);
    const [componentsError, setComponentsError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Partial<Record<keyof GradeFormState, string>>>({});
    const [payComponents, setPayComponents] = useState<PayComponentOption[]>([]);

    // ── Grade Code search/lookup (Add mode "template copy") ──────────────
    const [gradeLookupOpen, setGradeLookupOpen] = useState(false);
    const [gradeLookupRows, setGradeLookupRows] = useState<GradeLookupRow[]>([]);
    const [gradeLookupLoading, setGradeLookupLoading] = useState(false);
    const [gradeLookupSearch, setGradeLookupSearch] = useState("");

    const lookupParams = useCallback(
      (parameter: string, code2 = "") => ({
        parameter,
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
        code2,
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
      }),
      [user?.loginid, user?.company_code],
    );

    // ── Pay components for the "Pay Unit" dropdown ───────────────────────
    // NOTE: parameter name is a guess — swap for your actual pay component
    // lookup proc.
    const loadPayComponents = useCallback(async () => {
      try {
        const res = await getDynamicLookup(lookupParams("PAY_COMPONENT_LOOKUP"));
        const list = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
        setPayComponents(
          list.map((p) => ({
            pay_comp_id: String(p.PAY_COMP_ID ?? p.pay_comp_id ?? ""),
            pay_comp_desc: String(p.PAY_COMP_DESC ?? p.pay_comp_desc ?? ""),
          })),
        );
      } catch {
        // non-critical; dropdown will just be empty
      }
    }, [lookupParams]);

    useEffect(() => {
      void loadPayComponents();
    }, [loadPayComponents]);

    // ── Grade Components: fetch by the live grade_code, debounced ────────
    const loadComponents = useCallback(
      async (code: string) => {
        if (!code) {
          setComponents([]);
          setComponentsError(null);
          return;
        }
        setComponentsError(null);
        try {
          const res = await getDynamicLookup(
            lookupParams("MST_HR_MS_HR_Grade_Components_Page", code),
          );
          const list = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
          if (list.length === 0) {
            setComponentsError(
              `No component rows came back for grade code "${code}" (company "${user?.company_code ?? ""}"). ` +
                `If this is unexpected, check that "MST_HR_MS_HR_Grade_Components_Page" is wired up in the backend dynamic-lookup dispatcher.`,
            );
          }
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
        } catch (err) {
          setComponents([]);
          setComponentsError(
            err instanceof Error
              ? `Failed to load grade components: ${err.message}`
              : "Failed to load grade components.",
          );
        }
      },
      [lookupParams, user?.company_code],
    );

    // Debounced: covers edit/view population AND add-mode typing/lookup pick
    useEffect(() => {
      const code = form.grade_code.trim();
      const timer = window.setTimeout(() => {
        void loadComponents(code);
      }, 350);
      return () => window.clearTimeout(timer);
    }, [form.grade_code, loadComponents]);

    // ── Populate header on edit / view ───────────────────────────────────
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

    // ── Grade Code search/lookup (Add mode only) ─────────────────────────
    const loadGradeLookupList = useCallback(async () => {
      setGradeLookupLoading(true);
      try {
        const res = await getDynamicLookup(lookupParams("MST_HR_MS_HR_Grade_Page"));
        const list = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
        setGradeLookupRows(
          list.map((r) => ({
            grade_code: String(r.grade_code ?? r.GRADE_CODE ?? ""),
            grade_name: String(r.grade_name ?? r.GRADE_NAME ?? ""),
            grade_short_name: String(r.grade_short_name ?? r.GRADE_SHORT_NAME ?? ""),
          })),
        );
      } catch {
        setGradeLookupRows([]);
        toast.error("Unable to load grade list");
      } finally {
        setGradeLookupLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lookupParams]);

    const openGradeLookup = () => {
      setGradeLookupSearch("");
      setGradeLookupOpen(true);
      void loadGradeLookupList();
    };

    const filteredGradeLookupRows = gradeLookupRows.filter((r) =>
      `${r.grade_code} ${r.grade_name}`.toLowerCase().includes(gradeLookupSearch.toLowerCase()),
    );

    // Template-copy: loads that grade's components and auto-fills Name / Short Name
    const selectGradeFromLookup = (code: string) => {
      const picked = gradeLookupRows.find((r) => r.grade_code === code);
      setForm((prev) => ({
        ...prev,
        grade_code: code,
        grade_name: picked?.grade_name ?? prev.grade_name,
        grade_short_name: picked?.grade_short_name ?? prev.grade_short_name,
      }));
      setGradeLookupOpen(false);
    };

    // ── Component row handlers ───────────────────────────────────────────
    const updateComponentRow = (id: string, patch: Partial<GradeComponentFormRow>) => {
      setComponents((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const removeComponentRow = (id: string) => {
      setComponents((prev) => prev.filter((row) => row.id !== id));
    };

    // ── Validation ───────────────────────────────────────────────────────
    const validate = (): string | null => {
      const next: Partial<Record<keyof GradeFormState, string>> = {};
      if (!form.grade_name.trim()) next.grade_name = "Name is required";
      if (!form.status) next.status = "Status is required";
      setErrors(next);

      const first = Object.values(next)[0];
      if (first) setTab(0); // errors live on the details tab
      return first ?? null;
    };

    // ── Submit (called by the page header Save button) ───────────────────
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }
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
        toast.success(isEdit ? "Grade updated successfully" : "Grade saved successfully");
        onClose(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save grade");
      }
    };

    /* ✅ Expose save() to parent */
    useImperativeHandle(ref, () => ({
      save: handleSubmit,
    }));

    // ── UI ────────────────────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        {/* ── Tabs shell (Freight style) ── */}
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
          <div className="freight-tabs-list flex overflow-x-auto">
            {TABS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(index)}
                aria-pressed={tab === index}
                className={`freight-workspace-tab ${tab === index ? "active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="freight-tabs-panel border-t p-3 grid gap-3">
            {/* ══ TAB 0 — Grade Details ══ */}
            {tab === 0 && (
              <>
                <SectionPanel title="Identification" icon={IdCard}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Grade Code">
                      <div className="flex items-center gap-1">
                        <Input
                          disabled={readonly || isEdit}
                          placeholder="Auto-generated if left blank"
                          value={form.grade_code}
                          onChange={(e) => set("grade_code", e.target.value)}
                        />
                        {isAdd && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Search existing grade (loads its components as a template)"
                            onClick={openGradeLookup}
                          >
                            <Search size={14} />
                          </Button>
                        )}
                      </div>
                    </Field>

                    <Field label="Name" required error={errors.grade_name}>
                      <Input
                        disabled={readonly}
                        value={form.grade_name}
                        onChange={(e) => set("grade_name", e.target.value)}
                      />
                    </Field>

                    <Field label="Short Name">
                      <Input
                        disabled={readonly}
                        value={form.grade_short_name}
                        onChange={(e) => set("grade_short_name", e.target.value)}
                      />
                    </Field>

                    <Field label="Eligibility for OT">
                      <Select
                        disabled={readonly}
                        value={form.ot_eligibility}
                        onChange={(e) => set("ot_eligibility", e.target.value)}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </Field>

                    <Field label="Grade Status">
                      <Select
                        disabled={readonly}
                        value={form.grade_status}
                        onChange={(e) => set("grade_status", e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        <option value="A">Approved</option>
                        <option value="P">Pending</option>
                      </Select>
                    </Field>

                    <Field label="Status" required error={errors.status}>
                      <Select
                        disabled={readonly}
                        value={form.status}
                        onChange={(e) => set("status", e.target.value)}
                      >
                        <option value="A">Active</option>
                        <option value="N">Inactive</option>
                      </Select>
                    </Field>
                  </div>
                </SectionPanel>

                <div className="grid gap-3 md:grid-cols-2">
                  <SectionPanel title="Airfare Entitlement" icon={Plane}>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <CheckboxField
                        label="Self"
                        disabled={readonly}
                        checked={form.airfare_entitlement === "Y"}
                        onChange={(v) => setChecked("airfare_entitlement", v)}
                      />
                      <CheckboxField
                        label="Spouse"
                        disabled={readonly}
                        checked={form.spouse_af_entitlement === "Y"}
                        onChange={(v) => setChecked("spouse_af_entitlement", v)}
                      />
                      <CheckboxField
                        label="Dependent"
                        disabled={readonly}
                        checked={form.dep_af_entitlement === "Y"}
                        onChange={(v) => setChecked("dep_af_entitlement", v)}
                      />
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Medical Entitlement" icon={HeartPulse}>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <CheckboxField
                        label="Self"
                        disabled={readonly}
                        checked={form.medical_entitlement === "Y"}
                        onChange={(v) => setChecked("medical_entitlement", v)}
                      />
                      <CheckboxField
                        label="Spouse"
                        disabled={readonly}
                        checked={form.spouse_med_entitlement === "Y"}
                        onChange={(v) => setChecked("spouse_med_entitlement", v)}
                      />
                      <CheckboxField
                        label="Dependent"
                        disabled={readonly}
                        checked={form.dep_med_entitlement === "Y"}
                        onChange={(v) => setChecked("dep_med_entitlement", v)}
                      />
                    </div>
                  </SectionPanel>
                </div>

                <SectionPanel title="Notes" icon={StickyNote}>
                  <Field label="Remarks">
                    <textarea
                      className="input"
                      rows={3}
                      disabled={readonly}
                      value={form.remarks}
                      onChange={(e) => set("remarks", e.target.value)}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                    />
                  </Field>
                </SectionPanel>
              </>
            )}

            {/* ══ TAB 1 — Grade Components ══ */}
            {tab === 1 && (
              <SectionPanel title={`Grade Components (${components.length})`} icon={ListChecks}>
                <div className="grid gap-2">
                  {componentsError && (
                    <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                      {componentsError}
                    </div>
                  )}

                  <div className="overflow-auto rounded-md border">
                    <table className="w-full min-w-[720px] text-[12px]">
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
                                    updateComponentRow(row.id, {
                                      min_pay_amt: Number(e.target.value || 0),
                                    })
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
                                    updateComponentRow(row.id, {
                                      max_pay_amt: Number(e.target.value || 0),
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  type="date"
                                  disabled={readonly}
                                  value={row.approved_date}
                                  onChange={(e) =>
                                    updateComponentRow(row.id, { approved_date: e.target.value })
                                  }
                                />
                              </td>
                              {!readonly && (
                                <td className="px-2 py-1">
                                  <button
                                    type="button"
                                    title="Remove row"
                                    onClick={() => removeComponentRow(row.id)}
                                    className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <X size={13} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionPanel>
            )}
          </div>
        </div>

        {/* ── Grade Code search/lookup dialog (Add mode) ── */}
        {gradeLookupOpen && (
          <Dialog open title="Select Grade Code" compact onClose={() => setGradeLookupOpen(false)}>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 rounded border border-input bg-background px-2">
                <Search size={13} className="text-muted-foreground flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search grade code, name..."
                  value={gradeLookupSearch}
                  onChange={(e) => setGradeLookupSearch(e.target.value)}
                  className="h-8 w-full bg-transparent text-[12px] text-foreground outline-none"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded border border-border">
                {gradeLookupLoading ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">Loading…</div>
                ) : filteredGradeLookupRows.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No grades found
                  </div>
                ) : (
                  filteredGradeLookupRows.map((r) => (
                    <button
                      key={r.grade_code}
                      type="button"
                      className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-[12px] last:border-b-0 hover:bg-muted/40"
                      onClick={() => selectGradeFromLookup(r.grade_code)}
                    >
                      <span className="w-16 flex-shrink-0 font-medium">{r.grade_code}</span>
                      <span className="truncate text-muted-foreground">{r.grade_name}</span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selecting a code auto-fills <strong>Name</strong> / <strong>Short Name</strong> and
                loads its <strong>Grade Components</strong> as a starting template.
              </p>
            </div>
          </Dialog>
        )}
      </div>
    );
  },
);