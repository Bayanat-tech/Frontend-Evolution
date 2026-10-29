import { Save, X, CalendarClock, SlidersHorizontal, StickyNote, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup, LookupRow } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

// ── Dynamic lookup parameters ────────────────────────────────────────────
const MST_HR_LEAVE_TYPE_LIST = "MST_HR_LEAVE_TYPE_LIST";
const MST_HR_ATTENDANCE_TYPE_LIST = "MST_HR_ATTENDANCE_TYPE_LIST";
const PAY_COMPONENT_LOOKUP = "PAY_COMPONENT_LOOKUP";
const HR_MSE_LEAVE_TYPES = "HR_MSE_LEAVE_TYPES";

const CTL = "h-7 text-xs";

type TLeaveType = {
  company_code?: string;
  company_name?: string;
  leave_type?: string;
  leave_type_desc?: string;
  leave_type_short_desc?: string;
  attend_type?: string;
  attend_desc?: string;
  maximum_days_allow?: string;
  min_service_days_required?: string;
  carry_forward?: string;
  half_day?: string;
  all_employees?: string;
  back_dated_allow?: string;
  post_dated_allow?: string;
  encashable?: string;
  pay_comp_id?: string;
  pay_comp_desc?: string;
  with_pay?: string;
  remarks?: string;
  status?: string;
};

const EMPTY: TLeaveType = {
  company_code: "",
  company_name: "",
  leave_type: "",
  leave_type_desc: "",
  leave_type_short_desc: "",
  attend_type: "",
  attend_desc: "",
  maximum_days_allow: "",
  min_service_days_required: "",
  carry_forward: "",
  half_day: "",
  all_employees: "",
  back_dated_allow: "",
  post_dated_allow: "",
  encashable: "",
  pay_comp_id: "",
  pay_comp_desc: "",
  with_pay: "",
  remarks: "",
  status: "Active",
};

const leaveTypeColumns = [
  { field: "leave_type", header: "Leave Type" },
  { field: "leave_type_desc", header: "Description" },
];
const attendTypeColumns = [
  { field: "attend_type", header: "Attendance Type" },
  { field: "attend_desc", header: "Description" },
];
const payComponentColumns = [
  { field: "pay_comp_id", header: "Pay Unit Code" },
  { field: "pay_comp_desc", header: "Pay Unit Description" },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function buildLookupOptions(parameter: string, companyCode: string) {
  return () =>
    getDynamicLookup({
      parameter,
      loginid: "",
      code1: companyCode,
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
    } as Parameters<typeof getDynamicLookup>[0]);
}

export function LeaveTypesPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";

  const [form, setForm] = useState<TLeaveType>(() => ({ ...EMPTY, company_code: companyCode }));
  const [isExistingRecord, setIsExistingRecord] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TLeaveType, string>>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const setField = (field: keyof TLeaveType, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm({ ...EMPTY, company_code: companyCode });
    setIsExistingRecord(false);
    setErrors({});
    setNotice(null);
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof TLeaveType, string>> = {};
    if (!form.leave_type?.trim()) next.leave_type = "Required";
    if (!form.status?.trim()) next.status = "Required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setNotice(null);
    try {
      await executeDynamicMutationColumn90({
        parameter: HR_MSE_LEAVE_TYPES,
        loginid: user?.loginid ?? "ADMIN",
        val1s1: form.company_code ?? "",
        val1s2: form.leave_type?.trim() ?? "",
        val1s3: form.leave_type_desc?.trim() ?? "",
        val1s4: form.leave_type_short_desc?.trim() ?? "",
        val1s5: form.attend_type ?? "",
        val1s6: form.maximum_days_allow ?? "",
        val1s7: form.min_service_days_required ?? "",
        val1s8: form.carry_forward ?? "",
        val1s9: form.half_day ?? "",
        val1s10: form.all_employees ?? "",
        val1s11: form.back_dated_allow ?? "",
        val1s12: form.post_dated_allow ?? "",
        val1s13: form.encashable ?? "",
        val1s14: form.pay_comp_id ?? "",
        val1s15: form.with_pay ?? "",
        val1s16: form.remarks ?? "",
        val1s17: form.status ?? "Active",
      } as any);

      setNotice({
        type: "success",
        message: isExistingRecord ? "Leave type updated." : "Leave type added.",
      });
      setIsExistingRecord(true);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save leave type record",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* ══ Header — freight-transaction-header (Employee Master style) ══ */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarClock size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                Leave Types
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {isExistingRecord ? "Editing" : "New"}
              </span>
              {form.leave_type && (
                <span className="text-xs text-muted-foreground">
                  {form.leave_type}
                  {form.leave_type_desc ? ` - ${form.leave_type_desc}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetForm}
            disabled={saving}
          >
            <X size={14} /> Cancel
          </Button>
          <Button type="submit" form="leave-types-form" size="sm" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {saving ? "Saving" : "Submit"}
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <form id="leave-types-form" onSubmit={handleSubmit} className="grid gap-2">
        {/* ── Leave Details ──────────────────────────────────────────── */}
        <SectionPanel title="Leave Details" icon={CalendarClock}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Leave Type"
              required
              error={errors.leave_type}
              className="md:col-span-2"
            >
              <LookupField
                compact
                label="Leave Type"
                value={form.leave_type ?? ""}
                displayValue={
                  form.leave_type && form.leave_type_desc
                    ? `${form.leave_type} - ${form.leave_type_desc}`
                    : form.leave_type ?? ""
                }
                valueField="leave_type"
                displayFields={["leave_type", "leave_type_desc"]}
                columns={leaveTypeColumns}
                loadOptions={buildLookupOptions(MST_HR_LEAVE_TYPE_LIST, form.company_code ?? "")}
                onChange={(value, row: LookupRow | null) => {
                  setField("leave_type", value);
                  if (row) setField("leave_type_desc", String(row.leave_type_desc ?? ""));
                  setIsExistingRecord(Boolean(row));
                }}
              />
            </Field>

            <Field label="Short Description">
              <Input
                className={CTL}
                value={form.leave_type_short_desc ?? ""}
                onChange={(e) => setField("leave_type_short_desc", e.target.value)}
              />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Parameters ─────────────────────────────────────────────── */}
        <SectionPanel title="Parameters" icon={SlidersHorizontal}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Attendance Type">
              <LookupField
                compact
                label="Attendance Type"
                value={form.attend_type ?? ""}
                displayValue={
                  form.attend_type && form.attend_desc
                    ? `${form.attend_type} - ${form.attend_desc}`
                    : form.attend_type ?? ""
                }
                valueField="attend_type"
                displayFields={["attend_type", "attend_desc"]}
                columns={attendTypeColumns}
                loadOptions={buildLookupOptions(MST_HR_ATTENDANCE_TYPE_LIST, form.company_code ?? "")}
                onChange={(value, row: LookupRow | null) => {
                  setField("attend_type", value);
                  if (row) setField("attend_desc", String(row.attend_desc ?? ""));
                }}
              />
            </Field>

            <Field label="Max. Days Allowed">
              <Input
                className={CTL}
                type="number"
                value={form.maximum_days_allow ?? ""}
                onChange={(e) => setField("maximum_days_allow", e.target.value)}
              />
            </Field>

            <Field label="Min Service Days Reqd.">
              <Input
                className={CTL}
                type="number"
                value={form.min_service_days_required ?? ""}
                onChange={(e) => setField("min_service_days_required", e.target.value)}
              />
            </Field>

            <Field label="Pay Unit">
              <LookupField
                compact
                label="Pay Unit"
                value={form.pay_comp_id ?? ""}
                displayValue={
                  form.pay_comp_id && form.pay_comp_desc
                    ? `${form.pay_comp_id} - ${form.pay_comp_desc}`
                    : form.pay_comp_id ?? ""
                }
                valueField="pay_comp_id"
                displayFields={["pay_comp_id", "pay_comp_desc"]}
                columns={payComponentColumns}
                loadOptions={buildLookupOptions(PAY_COMPONENT_LOOKUP, form.company_code ?? "")}
                onChange={(value, row: LookupRow | null) => {
                  setField("pay_comp_id", value);
                  if (row) setField("pay_comp_desc", String(row.pay_comp_desc ?? ""));
                }}
              />
            </Field>

            <Field label="Carry Forward">
              <YesNoSelect
                value={form.carry_forward ?? ""}
                onChange={(v) => setField("carry_forward", v)}
              />
            </Field>

            <Field label="Half Day Allowed">
              <YesNoSelect
                value={form.half_day ?? ""}
                onChange={(v) => setField("half_day", v)}
              />
            </Field>

            <Field label="All Employees">
              <YesNoSelect
                value={form.all_employees ?? ""}
                onChange={(v) => setField("all_employees", v)}
              />
            </Field>

            <Field label="Back Dated">
              <YesNoSelect
                value={form.back_dated_allow ?? ""}
                onChange={(v) => setField("back_dated_allow", v)}
              />
            </Field>

            <Field label="Future Date">
              <YesNoSelect
                value={form.post_dated_allow ?? ""}
                onChange={(v) => setField("post_dated_allow", v)}
              />
            </Field>

            <Field label="Encashable">
              <YesNoSelect
                value={form.encashable ?? ""}
                onChange={(v) => setField("encashable", v)}
              />
            </Field>

            <Field label="Leave with Pay">
              <YesNoSelect
                value={form.with_pay ?? ""}
                onChange={(v) => setField("with_pay", v)}
              />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Remarks & Status ───────────────────────────────────────── */}
        <SectionPanel title="Remarks & Status" icon={StickyNote}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Remarks" className="md:col-span-2">
              <textarea
                className="min-h-[60px] w-full rounded-md border px-3 py-2 text-sm"
                value={form.remarks ?? ""}
                onChange={(e) => setField("remarks", e.target.value)}
              />
            </Field>

            <Field label="Status" required error={errors.status}>
              <Select
                className={CTL}
                value={form.status ?? "Active"}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </Field>
          </div>
        </SectionPanel>
      </form>
    </section>
  );
}

// ── Small shared helpers ────────────────────────────────────────────────
function YesNoSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select className={CTL} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Select --</option>
      <option value="Y">Yes</option>
      <option value="N">No</option>
    </Select>
  );
}