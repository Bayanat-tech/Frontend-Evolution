import { Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
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

type Option = { value: string; label: string };

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

  // Dropdown options
  const [divOptions, setDivOptions] = useState<Option[]>([]);
  const [deptOptions, setDeptOptions] = useState<Option[]>([]);
  const [sectOptions, setSectOptions] = useState<Option[]>([]);
  const [empOptions, setEmpOptions] = useState<Option[]>([]);
  const [reasonOptions, setReasonOptions] = useState<Option[]>([]);
  const [statusOptions, setStatusOptions] = useState<Option[]>([]);

  const [divLoading, setDivLoading] = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [sectLoading, setSectLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [reasonLoading, setReasonLoading] = useState(false);

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

  // ── Load Division + Reason + Status (independent) ────────────────────────
  useEffect(() => {
    if (!companyCode) return;

    const loadIndependent = async () => {
      setDivLoading(true);
      setReasonLoading(true);
      try {
        const [divRes, reasonRes, statusRes] = await Promise.all([
          getDynamicLookup(baseParams("MST_HR_ACCOUNT_DIVISION")),
          getDynamicLookup(baseParams("MST_HR_SEPARATION_REASON_LIST")),
          getDynamicLookup(baseParams("MST_HR_CODE_STATUS")), // GROUP_CODE = 6
        ]);

        setDivOptions(
          extractRows(divRes).map((r) => ({
            value: pick(r, "div_code"),
            label: pick(r, "div_name") || pick(r, "div_code"),
          }))
        );

        setReasonOptions(
          extractRows(reasonRes).map((r) => ({
            value: pick(r, "sep_reason_code"),
            label: pick(r, "sep_reason_desc") || pick(r, "sep_reason_code"),
          }))
        );

        const statusRows = extractRows(statusRes);
        setStatusOptions(
          statusRows.length
            ? statusRows.map((r) => ({
                value: pick(r, "value_code"),
                label: pick(r, "value_desc") || pick(r, "value_code"),
              }))
            : [
                { value: "N", label: "New" },
                { value: "A", label: "Approved" },
                { value: "C", label: "Cancelled" },
              ]
        );
      } catch (e) {
        console.error("Independent lookups failed", e);
      } finally {
        setDivLoading(false);
        setReasonLoading(false);
      }
    };

    void loadIndependent();
  }, [baseParams, companyCode]);

  // ── Cascading: Department when Division changes ──────────────────────────
  useEffect(() => {
    if (!form.division || !companyCode) {
      setDeptOptions([]);
      return;
    }
    const loadDept = async () => {
      setDeptLoading(true);
      try {
        const res = await getDynamicLookup(
          baseParams("MST_HR_MS_HR_DEPARTMENT", form.division)
        );
        setDeptOptions(
          extractRows(res).map((r) => ({
            value: pick(r, "dept_code"),
            label: pick(r, "dept_name") || pick(r, "dept_code"),
          }))
        );
      } catch (e) {
        console.error("Department lookup failed", e);
        setDeptOptions([]);
      } finally {
        setDeptLoading(false);
      }
    };
    void loadDept();
  }, [form.division, baseParams, companyCode]);

  // ── Cascading: Section when Department changes ───────────────────────────
  useEffect(() => {
    if (!form.division || !form.department || !companyCode) {
      setSectOptions([]);
      return;
    }
    const loadSect = async () => {
      setSectLoading(true);
      try {
        const res = await getDynamicLookup(
          baseParams("MST_HR_MS_HR_SECTION_DDL", form.division, form.department)
        );
        setSectOptions(
          extractRows(res).map((r) => ({
            value: pick(r, "section_code"),
            label: pick(r, "section_name") || pick(r, "section_code"),
          }))
        );
      } catch (e) {
        console.error("Section lookup failed", e);
        setSectOptions([]);
      } finally {
        setSectLoading(false);
      }
    };
    void loadSect();
  }, [form.division, form.department, baseParams, companyCode]);

  // ── Employee list (company-wide; filter client-side if needed) ───────────
  useEffect(() => {
    if (!companyCode) return;
    const loadEmp = async () => {
      setEmpLoading(true);
      try {
        const res = await getDynamicLookup(
          baseParams("MST_HR_VW_HR_EMP_MASTER_DDL")
        );
        let rows = extractRows(res);

        // Optional client-side cascade filter
        if (form.division) {
          rows = rows.filter((r) => pick(r, "div_code") === form.division);
        }
        if (form.department) {
          rows = rows.filter((r) => pick(r, "dept_code") === form.department);
        }
        if (form.section) {
          rows = rows.filter((r) => pick(r, "section_code") === form.section);
        }

        setEmpOptions(
          rows.map((r) => ({
            value: pick(r, "employee_id"),
            label:
              `${pick(r, "employee_code")} - ${pick(r, "rpt_name")}`.trim() ||
              pick(r, "employee_id"),
          }))
        );
      } catch (e) {
        console.error("Employee lookup failed", e);
        setEmpOptions([]);
      } finally {
        setEmpLoading(false);
      }
    };
    void loadEmp();
  }, [form.division, form.department, form.section, baseParams, companyCode]);

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
      // TODO: replace with your real insert/update service
      // await hrSeparationServiceInstance.insUpd({
      //   ...form,
      //   company_code: companyCode,
      //   user_id: loginid,
      //   loginid,
      // });

      // Temporary: log payload so you can wire the real API
      console.log("Separation payload", {
        company_code: companyCode,
        employee_id: form.employee_id,
        pay_month: form.pay_month,
        pay_year: form.pay_year,
        separation_initiation_date: form.separation_initiation_date,
        in_notice_period: form.in_notice_period,
        notice_period: form.notice_period,
        notice_period_start_date: form.notice_period_start_date || null,
        notice_period_end_date: form.notice_period_end_date || null,
        act_separation_date: form.act_separation_date || null,
        settlement_date: form.settlement_date || null,
        separation_reason: form.separation_reason,
        reason_category: form.reason_category,
        remarks: form.remarks,
        status_flag: form.status_flag,
        user_id: loginid,
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
          <label className="field">
            <span>
              Division <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly || divLoading}
              value={form.division ?? ""}
              onChange={(e) => {
                set("division", e.target.value);
                set("department", "");
                set("section", "");
                set("employee_id", "");
              }}
            >
              <option value="">
                {divLoading ? "Loading..." : "Select Division"}
              </option>
              {divOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="field">
            <span>
              Department <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly || deptLoading || !form.division}
              value={form.department ?? ""}
              onChange={(e) => {
                set("department", e.target.value);
                set("section", "");
                set("employee_id", "");
              }}
            >
              <option value="">
                {deptLoading ? "Loading..." : "Select Department"}
              </option>
              {deptOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="field">
            <span>
              Section <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly || sectLoading || !form.department}
              value={form.section ?? ""}
              onChange={(e) => {
                set("section", e.target.value);
                set("employee_id", "");
              }}
            >
              <option value="">
                {sectLoading ? "Loading..." : "Select Section"}
              </option>
              {sectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="field">
            <span>
              Employee <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly || empLoading}
              value={String(form.employee_id ?? "")}
              onChange={(e) => set("employee_id", e.target.value)}
            >
              <option value="">
                {empLoading ? "Loading..." : "Select Employee"}
              </option>
              {empOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
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

          <label className="field">
            <span>
              Separation Reason <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly || reasonLoading}
              value={form.separation_reason ?? ""}
              onChange={(e) => set("separation_reason", e.target.value)}
            >
              <option value="">
                {reasonLoading ? "Loading..." : "Select Reason"}
              </option>
              {reasonOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>

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

        {/* Row 3: Reason Category */}
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
              {/* Replace with real lookup if you have one; common values: */}
              <option value="RESIGNATION">Resignation</option>
              <option value="TERMINATION">Termination</option>
              <option value="RETIREMENT">Retirement</option>
              <option value="OTHER">Other</option>
            </Select>
          </label>
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

        {/* Status */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>
              Status <strong className="text-destructive">*</strong>
            </span>
            <Select
              disabled={readonly}
              value={form.status_flag ?? "N"}
              onChange={(e) => set("status_flag", e.target.value)}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
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