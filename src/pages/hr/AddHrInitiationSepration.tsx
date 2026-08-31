import { Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
// Adjust this import to your real save service
// import hrSeparationServiceInstance from "./insUpdHrSeparation";

// ── Types ────────────────────────────────────────────────────────────────────

export type THrSeparation = {
  company_code?: string;
  employee_id?: string | number;
  emp_code?: string;
  emp_name?: string;
  division?: string;
  department?: string;
  section?: string;
  separation_initiation_date?: string;
  separation_reason?: string;
  reason_category?: string;
  pay_month?: string;
  pay_year?: string;
  in_notice_period?: string;
  notice_period?: string | number;
  notice_period_start_date?: string;
  notice_period_end_date?: string;
  settlement_date?: string;       // Settlement Due Date
  act_separation_date?: string;
  remarks?: string;
  status_flag?: string;
  settlement_status?: string;
  visa_cancelled?: string;
  labour_card_cancelled?: string;
  final_settlement_done?: string;
};

type Props = {
  mode: "add" | "edit" | "view";
  existingData?: Partial<THrSeparation>;
  onClose: (shouldRefetch?: boolean) => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Unwrap { success, data } or plain array from getDynamicLookup */
function extractRows(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.rows)) return o.rows as Record<string, unknown>[];
  }
  return [];
}

const normalizeKey = (k: string) => k.toLowerCase().replace(/[_\s]/g, "");

function pick(obj: Record<string, unknown>, ...aliases: string[]): string {
  if (!obj) return "";
  const wanted = aliases.map(normalizeKey);
  for (const raw of Object.keys(obj)) {
    if (wanted.includes(normalizeKey(raw))) {
      const v = obj[raw];
      if (v !== undefined && v !== null && v !== "") return String(v);
    }
  }
  return "";
}

const EMPTY: THrSeparation = {
  employee_id: "",
  division: "",
  department: "",
  section: "",
  separation_initiation_date: toDate(new Date()),
  separation_reason: "",
  reason_category: "",
  pay_month: "",
  pay_year: "",
  in_notice_period: "Y",
  notice_period: "",
  notice_period_start_date: "",
  notice_period_end_date: "",
  settlement_date: "",
  act_separation_date: "",
  remarks: "",
  status_flag: "N", // New
};

// ── Main Form ────────────────────────────────────────────────────────────────

export function AddHrInitiationSepration({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<THrSeparation>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const set = (field: keyof THrSeparation, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const baseParams = useCallback(
    (parameter: string, code2 = "", code3 = "", code4 = "") => ({
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
      date1: null as null,
      date2: null as null,
      date3: null as null,
      date4: null as null,
    }),
    [loginid, companyCode]
  );

  // ── Prefill on edit/view ─────────────────────────────────────────────────
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        ...existingData,
        separation_initiation_date: toDate(existingData.separation_initiation_date),
        notice_period_start_date: toDate(existingData.notice_period_start_date),
        notice_period_end_date: toDate(existingData.notice_period_end_date),
        settlement_date: toDate(existingData.settlement_date),
        act_separation_date: toDate(existingData.act_separation_date),
        in_notice_period: existingData.in_notice_period || "Y",
        status_flag: existingData.status_flag || "N",
      });
    }
  }, [isEdit, readonly, existingData]);

  // ── LookupField data loaders ──────────────────────────────────────────────
  // Each loader is called by its LookupField on open; cascading fields read
  // the latest form.* value via closure, so parent selections stay in sync.

  const loadDivisionOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!companyCode) return [];
    const res = await getDynamicLookup(baseParams("MST_HR_ACCOUNT_DIVISION"));
    return extractRows(res).map((r) => ({
      div_code: pick(r, "div_code"),
      div_name: pick(r, "div_name"),
    }));
  }, [baseParams, companyCode]);

  const loadDepartmentOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!form.division || !companyCode) return [];
    const res = await getDynamicLookup(baseParams("MST_HR_MS_HR_DEPARTMENT", form.division));
    return extractRows(res).map((r) => ({
      dept_code: pick(r, "dept_code"),
      dept_name: pick(r, "dept_name"),
    }));
  }, [baseParams, companyCode, form.division]);

  const loadSectionOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!form.division || !form.department || !companyCode) return [];
    const res = await getDynamicLookup(
      baseParams("MST_HR_MS_HR_SECTION_DDL", form.division, form.department)
    );
    return extractRows(res).map((r) => ({
      section_code: pick(r, "section_code"),
      section_name: pick(r, "section_name"),
    }));
  }, [baseParams, companyCode, form.division, form.department]);

  const loadEmployeeOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!companyCode) return [];
    const res = await getDynamicLookup(baseParams("MST_HR_VW_HR_EMP_MASTER_DDL"));
    let rows = extractRows(res);
    if (form.division) rows = rows.filter((r) => pick(r, "div_code") === form.division);
    if (form.department) rows = rows.filter((r) => pick(r, "dept_code") === form.department);
    if (form.section) rows = rows.filter((r) => pick(r, "section_code") === form.section);
    return rows.map((r) => ({
      employee_id: pick(r, "employee_id"),
      employee_code: pick(r, "employee_code"),
      rpt_name: pick(r, "rpt_name"),
    }));
  }, [baseParams, companyCode, form.division, form.department, form.section]);

  const loadReasonOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!companyCode) return [];
    const res = await getDynamicLookup(baseParams("MST_HR_SEPARATION_REASON_LIST"));
    return extractRows(res).map((r) => ({
      sep_reason_code: pick(r, "sep_reason_code"),
      sep_reason_desc: pick(r, "sep_reason_desc"),
    }));
  }, [baseParams, companyCode]);

  const loadStatusOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!companyCode) return [];
    const res = await getDynamicLookup(baseParams("MST_HR_CODE_STATUS")); // GROUP_CODE = 6
    const rows = extractRows(res);
    if (!rows.length) {
      return [
        { value_code: "N", value_desc: "New" },
        { value_code: "A", value_desc: "Approved" },
        { value_code: "C", value_desc: "Cancelled" },
      ];
    }
    return rows.map((r) => ({
      value_code: pick(r, "value_code"),
      value_desc: pick(r, "value_desc"),
    }));
  }, [baseParams, companyCode]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.division) {
      setApiError("Division is required");
      return;
    }
    if (!form.department) {
      setApiError("Department is required");
      return;
    }
    if (!form.section) {
      setApiError("Section is required");
      return;
    }
    if (!form.employee_id) {
      setApiError("Employee is required");
      return;
    }
    if (!form.separation_initiation_date) {
      setApiError("Request Date is required");
      return;
    }
    if (!form.separation_reason) {
      setApiError("Separation Reason is required");
      return;
    }
    if (!form.reason_category) {
      setApiError("Reason Category is required");
      return;
    }
    if (!form.notice_period && form.notice_period !== 0) {
      setApiError("Notice Period (Days) is required");
      return;
    }
    if (!form.status_flag) {
      setApiError("Status is required");
      return;
    }

    setSaving(true);
    setApiError("");
    try {
      // Maps 1:1 to the WHEN 'mst_hr_emp_separations_ins_upd' branch in
      // PROC_BUILD_DYNAMIC_INS_UPD_COLUMN90 — that branch keys off
      // COMPANY_CODE + EMPLOYEE_ID (no DOC_NO on this table) and auto
      // detects insert vs update, so the same call is used for add and edit.
      await executeDynamicMutationColumn90({
        parameter: "MST_HR_EMP_SEPARATIONS_INS_UPD",
        loginid,
        val1s1: companyCode,                              // COMPANY_CODE
        val1s2: String(form.employee_id ?? ""),           // EMPLOYEE_ID
        val1s3: form.pay_month ?? "",                     // PAY_MONTH
        val1s4: form.pay_year ?? "",                      // PAY_YEAR
        val1s5: form.separation_initiation_date ?? "",    // SEPARATION_INITIATION_DATE
        val1s6: form.in_notice_period ?? "Y",              // IN_NOTICE_PERIOD
        val1s7: form.notice_period_start_date ?? "",       // NOTICE_PERIOD_START_DATE
        val1s8: form.notice_period_end_date ?? "",         // NOTICE_PERIOD_END_DATE
        val1s9: form.act_separation_date ?? "",             // ACT_SEPARATION_DATE
        val1s10: form.settlement_date ?? "",                // SETTLEMENT_DATE
        val1s11: form.separation_reason ?? "",               // SEPARATION_REASON
        val1s12: form.reason_category ?? "",                 // REASON_CATEGORY
        val1s13: form.remarks ?? "",                          // REMARKS
        val1s14: form.status_flag ?? "N",                     // STATUS_FLAG
        val1n1: Number(form.notice_period) || 0,               // NOTICE_PERIOD (days)
      });

      onClose(true);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to save separation record"
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4 overflow-hidden">
      <NoticeToast
        notice={apiError ? { type: "error", message: apiError } : null}
        onClose={() => setApiError("")}
      />

      <Card>
        {/* Row 1: Division / Department / Section / Employee */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <LookupField
            label="Division"
            required
            disabled={readonly}
            value={form.division ?? ""}
            columns={[
              { field: "div_code", header: "Code" },
              { field: "div_name", header: "Name" },
            ]}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            loadOptions={loadDivisionOptions}
            onChange={(value) => {
              set("division", value);
              set("department", "");
              set("section", "");
              set("employee_id", "");
            }}
            placeholder="Select Division"
          />

          <LookupField
            label="Department"
            required
            disabled={readonly || !form.division}
            value={form.department ?? ""}
            columns={[
              { field: "dept_code", header: "Code" },
              { field: "dept_name", header: "Name" },
            ]}
            valueField="dept_code"
            displayFields={["dept_code", "dept_name"]}
            loadOptions={loadDepartmentOptions}
            onChange={(value) => {
              set("department", value);
              set("section", "");
              set("employee_id", "");
            }}
            placeholder="Select Department"
          />

          <LookupField
            label="Section"
            required
            disabled={readonly || !form.department}
            value={form.section ?? ""}
            columns={[
              { field: "section_code", header: "Code" },
              { field: "section_name", header: "Name" },
            ]}
            valueField="section_code"
            displayFields={["section_code", "section_name"]}
            loadOptions={loadSectionOptions}
            onChange={(value) => {
              set("section", value);
              set("employee_id", "");
            }}
            placeholder="Select Section"
          />

          <LookupField
            label="Employee"
            required
            disabled={readonly}
            value={String(form.employee_id ?? "")}
            displayValue={
              form.employee_id
                ? [form.emp_code, form.emp_name].filter(Boolean).join(" - ")
                : ""
            }
            columns={[
              { field: "employee_code", header: "Code" },
              { field: "rpt_name", header: "Name" },
            ]}
            valueField="employee_id"
            displayFields={["employee_code", "rpt_name"]}
            loadOptions={loadEmployeeOptions}
            onChange={(value, row) => {
              set("employee_id", value);
              set("emp_code", row ? pick(row as Record<string, unknown>, "employee_code") : "");
              set("emp_name", row ? pick(row as Record<string, unknown>, "rpt_name") : "");
            }}
            placeholder="Select Employee"
          />
        </CardContent>

        {/* Row 2: Request Date / Reason / Month / Year */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>
              Request Date <strong className="text-destructive">*</strong>
            </span>
            <Input
              type="date"
              disabled={readonly}
              value={form.separation_initiation_date ?? ""}
              onChange={(e) => set("separation_initiation_date", e.target.value)}
            />
          </label>

          <LookupField
            label="Separation Reason"
            required
            disabled={readonly}
            value={form.separation_reason ?? ""}
            columns={[
              { field: "sep_reason_code", header: "Code" },
              { field: "sep_reason_desc", header: "Description" },
            ]}
            valueField="sep_reason_code"
            displayFields={["sep_reason_code", "sep_reason_desc"]}
            loadOptions={loadReasonOptions}
            onChange={(value) => set("separation_reason", value)}
            placeholder="Select Reason"
          />

          <label className="field">
            <span>Payroll Month</span>
            <Input
              disabled={readonly}
              value={form.pay_month ?? ""}
              onChange={(e) => set("pay_month", e.target.value)}
              placeholder="e.g. 08"
            />
          </label>

          <label className="field">
            <span>Payroll Year</span>
            <Input
              disabled={readonly}
              value={form.pay_year ?? ""}
              onChange={(e) => set("pay_year", e.target.value)}
              placeholder="e.g. 2026"
            />
          </label>
        </CardContent>

        {/* Row 3: Reason Category / Status */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>
              Reason Category <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly}
              value={form.reason_category ?? ""}
              onChange={(e) => set("reason_category", e.target.value)}
            >
              <option value="">Select Reason Category</option>
              {/* Values capped at 5 chars — REASON_CATEGORY is VARCHAR2(5) */}
              <option value="RESGN">Resignation</option>
              <option value="TERM">Termination</option>
              <option value="RETIR">Retirement</option>
              <option value="OTHER">Other</option>
            </Select>
          </label>

          <LookupField
            label="Status"
            required
            disabled={readonly}
            value={form.status_flag ?? "N"}
            columns={[
              { field: "value_code", header: "Code" },
              { field: "value_desc", header: "Description" },
            ]}
            valueField="value_code"
            displayFields={["value_code", "value_desc"]}
            loadOptions={loadStatusOptions}
            onChange={(value) => set("status_flag", value)}
            placeholder="Select Status"
          />
        </CardContent>

        {/* Row 4: Notice period block */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>In Notice Period</span>
            <Select
              disabled={readonly}
              value={form.in_notice_period ?? "Y"}
              onChange={(e) => set("in_notice_period", e.target.value)}
            >
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </label>

          <label className="field">
            <span>
              Notice Period (Days) <strong className="text-destructive">*</strong>
            </span>
            <Input
              type="number"
              disabled={readonly}
              value={form.notice_period ?? ""}
              onChange={(e) => set("notice_period", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Notice Period Start Date</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.notice_period_start_date ?? ""}
              onChange={(e) => set("notice_period_start_date", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Notice Period End Date</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.notice_period_end_date ?? ""}
              onChange={(e) => set("notice_period_end_date", e.target.value)}
            />
          </label>
        </CardContent>

        {/* Row 5: Settlement / Actual dates */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Settlement Due Date</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.settlement_date ?? ""}
              onChange={(e) => set("settlement_date", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Actual Separation Date</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.act_separation_date ?? ""}
              onChange={(e) => set("act_separation_date", e.target.value)}
            />
          </label>
        </CardContent>

        {/* Remarks */}
        <CardContent>
          <label className="field">
            <span>Remarks</span>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={readonly}
              value={form.remarks ?? ""}
              onChange={(e) => set("remarks", e.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      {/* Actions */}
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