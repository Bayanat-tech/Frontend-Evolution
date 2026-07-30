import { Save, Search, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { executeDynamicMutation, getDynamicLookup, LookupRow } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// ── Dynamic lookup parameters ────────────────────────────────────────────
// Placeholder names — replace with whatever you registered on the backend.
const MST_HR_LEAVE_TYPE_LIST = "MST_HR_LEAVE_TYPE_LIST"; // returns existing MS_HR_LEAVE_TYPES rows, used to load a record for edit
const HR_Attend_Type_Search = "HR_Attend_Type_Search";
const PAY_COMPONENT_LOOKUP = "PAY_COMPONENT_LOOKUP";

// Your own insert/update procedure. Rename to match what you built.
// Positional P_VAL1S* params below follow column order from your SELECT —
// reorder/rename to match your actual procedure signature.
const HR_MSE_LEAVE_TYPES = "HR_MSE_LEAVE_TYPES";

type TLeaveType = {
  company_code?: string;
  company_name?: string;
  leave_type?: string;
  leave_type_desc?: string;
  leave_type_short_desc?: string;
  attend_type?: string;
  attend_type_desc?: string;
  maximum_days_allow?: string;
  min_service_days_required?: string;
  carry_forward?: string; // Y/N
  half_day?: string; // Y/N
  all_employees?: string; // Y/N
  back_dated_allow?: string; // Y/N
  post_dated_allow?: string; // Y/N
  encashable?: string; // Y/N
  pay_comp_id?: string;
  pay_comp_desc?: string;
  with_pay?: string; // Y/N
  remarks?: string;
  status?: string; // Active/Inactive
};

const EMPTY: TLeaveType = {
  company_code: "",
  company_name: "",
  leave_type: "",
  leave_type_desc: "",
  leave_type_short_desc: "",
  attend_type: "",
  attend_type_desc: "",
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

const attendTypeColumns = [
  { field: "attend_type", header: "Attendance Type" },
  { field: "attend_type_desc", header: "Description" },
];
const payComponentColumns = [
  { field: "pay_comp_id", header: "Pay Unit Code" },
  { field: "pay_comp_desc", header: "Pay Unit Description" },
];

// ── Single page: "HR Pay Components - Leave Types" ───────────────────────
// Matches the PowerBuilder DataWindow exactly. No separate list/grid, no
// Add modal — the Leave Type lookup finds & loads an existing record for
// edit; typing a new code and saving inserts one. One procedure call
// (executeDynamicMutation) handles both insert and update.
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
    if (!form.leave_type_desc?.trim()) next.leave_type_desc = "Description is required";
    if (!form.status?.trim()) next.status = "Status is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Calls your own insert/update procedure directly, positional-param
  // style. Reorder/rename val1s* below to exactly match the parameter
  // order in the procedure you built.
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setNotice(null);
    try {
      await executeDynamicMutation({
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">HR Pay Components</p>
              <h2 className="m-0 text-sm font-semibold">Leave Types</h2>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
              <LeaveTypeField
                value={form.leave_type ?? ""}
                companyCode={form.company_code ?? ""}
                error={errors.leave_type}
                onTypeChange={(value) => {
                  setField("leave_type", value.toUpperCase());
                  setIsExistingRecord(false);
                }}
                onSelectExisting={(row) => {
                  // Loads the picked leave type's fields for editing. Wire
                  // in your single-record read here if you need more than
                  // leave_type_desc (e.g. the WHERE COMPANY_CODE=... AND
                  // LEAVE_TYPE=... query filling the rest of the form).
                  setField("leave_type", String(row.leave_type ?? ""));
                  setField("leave_type_desc", String(row.leave_type_desc ?? ""));
                  setIsExistingRecord(true);
                }}
              />

              <label className="field">
                <span>
                  Description <strong className="text-destructive">*</strong>
                </span>
                <Input
                  value={form.leave_type_desc ?? ""}
                  onChange={(e) => setField("leave_type_desc", e.target.value)}
                  placeholder="e.g. ANNUAL LEAVE"
                />
                {errors.leave_type_desc && (
                  <span className="text-destructive text-xs mt-0.5">{errors.leave_type_desc}</span>
                )}
              </label>

              <label className="field">
                <span>Short Desciption</span>
                <Input
                  value={form.leave_type_short_desc ?? ""}
                  onChange={(e) => setField("leave_type_short_desc", e.target.value)}
                />
              </label>
            </div>

            {/* Leave Parameters */}
            <div className="border-t pt-4">
              <h3 className="m-0 mb-3 text-sm font-semibold">Leave Parameters</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
                <Lookup
                  label="Attendance Type"
                  parameter={HR_Attend_Type_Search}
                  value={form.attend_type ?? ""}
                  displayValue={
                    form.attend_type && form.attend_type_desc
                      ? `${form.attend_type} - ${form.attend_type_desc}`
                      : form.attend_type ?? ""
                  }
                  valueField="attend_type"
                  displayFields={["attend_type", "attend_type_desc"]}
                  columns={attendTypeColumns}
                  companyCode={form.company_code ?? ""}
                  onSelect={(value, row) => {
                    setField("attend_type", value);
                    if (row) setField("attend_type_desc", String(row.attend_type_desc ?? ""));
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

                <label className="field">
                  <span>Carry Forward</span>
                  <YesNoSelect value={form.carry_forward ?? ""} onChange={(v) => setField("carry_forward", v)} />
                </label>

                <label className="field">
                  <span>Half Day Allowed(Y/N)?</span>
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
              </div>
            </div>

            {/* Salary Parameters */}
            <div className="border-t pt-4">
              <h3 className="m-0 mb-3 text-sm font-semibold">Salary Parameters</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
                <label className="field">
                  <span>Encashable(Y/N)</span>
                  <YesNoSelect value={form.encashable ?? ""} onChange={(v) => setField("encashable", v)} />
                </label>

                <label className="field">
                  <span>Leave with Pay(Y/N)</span>
                  <YesNoSelect value={form.with_pay ?? ""} onChange={(v) => setField("with_pay", v)} />
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
              </div>
            </div>

            {/* Remarks / Status */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
                <label className="field md:col-span-2">
                  <span>Remarks</span>
                  <textarea
                    className="input min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
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
            </div>
          </CardContent>
        </Card>

        {/* Footer actions — bottom right, below the page */}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={resetForm}>
            <X size={15} /> Cancel
          </Button>
          <Button disabled={saving} type="submit">
            {saving ? <span className="spinner small" /> : <Save size={15} />} {saving ? "Saving..." : isExistingRecord ? "Update" : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Leave Type field ──────────────────────────────────────────────────────
// Plain editable Input (so a brand-new code can be typed for "add"), plus
// a small search button that opens an inline dropdown of existing leave
// types fetched via getDynamicLookup — selecting one loads it for "edit".
// Kept self-contained (no dependency on LookupField's internal API, since
// it doesn't support free-text entry).
function LeaveTypeField({
  value,
  companyCode,
  error,
  onTypeChange,
  onSelectExisting,
}: {
  value: string;
  companyCode: string;
  error?: string;
  onTypeChange: (value: string) => void;
  onSelectExisting: (row: LookupRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);

  const openSearch = async () => {
    setOpen((prev) => !prev);
    if (options.length || loading) return;
    setLoading(true);
    try {
      const result = await getDynamicLookup({
        parameter: MST_HR_LEAVE_TYPE_LIST,
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
      });
      setOptions((result as unknown as LookupRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="field relative">
      <span>
        Leave Type <strong className="text-destructive">*</strong>
      </span>
      <div className="flex items-center gap-1">
        <Input value={value} onChange={(e) => onTypeChange(e.target.value)} placeholder="e.g. AL" />
        <Button type="button" variant="outline" size="icon" onClick={openSearch} title="Find existing leave type">
          <Search size={15} />
        </Button>
      </div>
      {error && <span className="text-destructive text-xs mt-0.5">{error}</span>}

      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-md">
          {loading && <div className="p-2 text-xs text-muted-foreground">Loading...</div>}
          {!loading && options.length === 0 && (
            <div className="p-2 text-xs text-muted-foreground">No leave types found.</div>
          )}
          {!loading &&
            options.map((row) => (
              <button
                key={String(row.leave_type)}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelectExisting(row);
                  setOpen(false);
                }}
              >
                {String(row.leave_type)} - {String(row.leave_type_desc ?? "")}
              </button>
            ))}
        </div>
      )}
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