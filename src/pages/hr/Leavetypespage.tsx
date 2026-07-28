import { Save, X, CalendarClock, SlidersHorizontal, StickyNote } from "lucide-react";
import { FormEvent, useState } from "react";
import { executeDynamicMutation, executeDynamicMutationColumn90, getDynamicLookup, LookupRow } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// ── Dynamic lookup parameters ────────────────────────────────────────────
const MST_HR_LEAVE_TYPE_LIST = "MST_HR_LEAVE_TYPE_LIST";
const MST_HR_ATTENDANCE_TYPE_LIST = "MST_HR_ATTENDANCE_TYPE_LIST";
const PAY_COMPONENT_LOOKUP = "PAY_COMPONENT_LOOKUP";

const HR_MSE_LEAVE_TYPES = "HR_MSE_LEAVE_TYPES";

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
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof TLeaveType, string>> = {};
    if (!form.leave_type?.trim()) next.leave_type = "Leave Type is required";
    if (!form.status?.trim()) next.status = "Status is required";
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

      setNotice({ type: "success", message: isExistingRecord ? "Leave type updated." : "Leave type added." });
      setIsExistingRecord(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save leave type record" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3">
        <p className="eyebrow m-0 text-xs text-muted-foreground">HR Pay Components</p>
        <h2 className="m-0 text-base font-semibold">Leave Types</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Leave Details ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-muted-foreground" />
              <h3 className="m-0 text-sm font-semibold">Leave Details</h3>
            </div>
          </CardHeader>
          <CardContent>
            <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Lookup
                  label="Leave Type"
                  required
                  parameter={MST_HR_LEAVE_TYPE_LIST}
                  value={form.leave_type ?? ""}
                  displayValue={
                    form.leave_type && form.leave_type_desc
                      ? `${form.leave_type} - ${form.leave_type_desc}`
                      : form.leave_type ?? ""
                  }
                  valueField="leave_type"
                  displayFields={["leave_type", "leave_type_desc"]}
                  columns={leaveTypeColumns}
                  companyCode={form.company_code ?? ""}
                  error={errors.leave_type}
                  onSelect={(value, row) => {
                    setField("leave_type", value);
                    if (row) setField("leave_type_desc", String(row.leave_type_desc ?? ""));
                    setIsExistingRecord(Boolean(row));
                  }}
                />
              </div>

              <label className="field">
                <span>Short Description</span>
                <Input
                  value={form.leave_type_short_desc ?? ""}
                  onChange={(e) => setField("leave_type_short_desc", e.target.value)}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ── Parameters (Leave + Salary combined, 4-col grid) ───────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-muted-foreground" />
              <h3 className="m-0 text-sm font-semibold">Parameters</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <Lookup
                label="Attendance Type"
                parameter={MST_HR_ATTENDANCE_TYPE_LIST}
                value={form.attend_type ?? ""}
                displayValue={
                  form.attend_type && form.attend_desc
                    ? `${form.attend_type} - ${form.attend_desc}`
                    : form.attend_type ?? ""
                }
                valueField="attend_type"
                displayFields={["attend_type", "attend_desc"]}
                columns={attendTypeColumns}
                companyCode={form.company_code ?? ""}
                onSelect={(value, row) => {
                  setField("attend_type", value);
                  if (row) setField("attend_desc", String(row.attend_desc ?? ""));
                }}
              />

              <label className="field">
                <span>Max. Days Allowed</span>
                <Input
                  type="number"
                  value={form.maximum_days_allow ?? ""}
                  onChange={(e) => setField("maximum_days_allow", e.target.value)}
                />
              </label>

              <label className="field">
                <span>Min Service Days Reqd.</span>
                <Input
                  type="number"
                  value={form.min_service_days_required ?? ""}
                  onChange={(e) => setField("min_service_days_required", e.target.value)}
                />
              </label>

              <Lookup
                label="Pay Unit"
                parameter={PAY_COMPONENT_LOOKUP}
                value={form.pay_comp_id ?? ""}
                displayValue={
                  form.pay_comp_id && form.pay_comp_desc ? `${form.pay_comp_id} - ${form.pay_comp_desc}` : form.pay_comp_id ?? ""
                }
                valueField="pay_comp_id"
                displayFields={["pay_comp_id", "pay_comp_desc"]}
                columns={payComponentColumns}
                companyCode={form.company_code ?? ""}
                onSelect={(value, row) => {
                  setField("pay_comp_id", value);
                  if (row) setField("pay_comp_desc", String(row.pay_comp_desc ?? ""));
                }}
              />

              <label className="field">
                <span>Carry Forward</span>
                <YesNoSelect value={form.carry_forward ?? ""} onChange={(v) => setField("carry_forward", v)} />
              </label>

              <label className="field">
                <span>Half Day Allowed</span>
                <YesNoSelect value={form.half_day ?? ""} onChange={(v) => setField("half_day", v)} />
              </label>

              <label className="field">
                <span>All Employees</span>
                <YesNoSelect value={form.all_employees ?? ""} onChange={(v) => setField("all_employees", v)} />
              </label>

              <label className="field">
                <span>Back Dated</span>
                <YesNoSelect value={form.back_dated_allow ?? ""} onChange={(v) => setField("back_dated_allow", v)} />
              </label>

              <label className="field">
                <span>Future Date</span>
                <YesNoSelect value={form.post_dated_allow ?? ""} onChange={(v) => setField("post_dated_allow", v)} />
              </label>

              <label className="field">
                <span>Encashable</span>
                <YesNoSelect value={form.encashable ?? ""} onChange={(v) => setField("encashable", v)} />
              </label>

              <label className="field">
                <span>Leave with Pay</span>
                <YesNoSelect value={form.with_pay ?? ""} onChange={(v) => setField("with_pay", v)} />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ── Remarks & Status ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <StickyNote size={16} className="text-muted-foreground" />
              <h3 className="m-0 text-sm font-semibold">Remarks &amp; Status</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
              <label className="field md:col-span-2">
                <span>Remarks</span>
                <textarea
                  className="input min-h-[60px] w-full rounded-md border px-3 py-2 text-sm"
                  value={form.remarks ?? ""}
                  onChange={(e) => setField("remarks", e.target.value)}
                />
              </label>

              <label className="field">
                <span>
                  Status <strong className="text-destructive">*</strong>
                </span>
                <select
                  className="input rounded-md border px-3 py-2 text-sm"
                  value={form.status ?? "Active"}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                {errors.status && <span className="text-destructive text-xs mt-0.5">{errors.status}</span>}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={resetForm}>
            <X size={15} /> Cancel
          </Button>
          <Button disabled={saving} type="submit">
            {saving ? <span className="spinner small" /> : <Save size={15} />} {saving ? "Saving..." : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Small shared helpers ────────────────────────────────────────────────
function YesNoSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select className="input rounded-md border px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Select --</option>
      <option value="Y">Yes</option>
      <option value="N">No</option>
    </select>
  );
}

function Lookup({
  label,
  required,
  parameter,
  value,
  displayValue,
  valueField,
  displayFields,
  columns,
  companyCode,
  error,
  onSelect,
}: {
  label: string;
  required?: boolean;
  parameter: string;
  value: string;
  displayValue: string;
  valueField: string;
  displayFields: string[];
  columns: { field: string; header: string }[];
  companyCode: string;
  error?: string;
  onSelect: (value: string, row: LookupRow | null) => void;
}) {
  return (
    <div className="field">
      <LookupField
        label={required ? `${label} *` : label}
        value={value}
        displayValue={displayValue}
        columns={columns}
        valueField={valueField}
        displayFields={displayFields}
        loadOptions={() =>
          getDynamicLookup({
            parameter,
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
          })
        }
        onChange={onSelect}
      />
      {error && <span className="text-destructive text-xs mt-0.5">{error}</span>}
    </div>
  );
}