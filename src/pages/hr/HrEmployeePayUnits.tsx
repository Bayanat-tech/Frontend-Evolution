import { useCallback, useEffect, useState } from "react";
import { getDynamicLookup, type LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import {
  upsertHrEmpComponentsApi,
  type THrEmpComponentPayload,
} from "../../api/wms";

// ════════════════════════════════════════════════════════════════════════
// SCREEN — HR Employee - Pay Units
// ════════════════════════════════════════════════════════════════════════

type THeaderFilters = {
  div_code: string;
  div_name: string;
  dept_code: string;
  dept_name: string;
  section_code: string;
  section_name: string;
  employee_id: string;
  employee_display: string;
};

const EMPTY_HEADER: THeaderFilters = {
  div_code: "",
  div_name: "",
  dept_code: "",
  dept_name: "",
  section_code: "",
  section_name: "",
  employee_id: "",
  employee_display: "",
};

const PAY_UNIT_STATUS_OPTIONS: { code: string; label: string }[] = [
  { code: "A", label: "Approved" },
  { code: "R", label: "Rejected" },
  { code: "P", label: "Pending" },
];

const STATUS_OPTIONS: { code: string; label: string }[] = [
  { code: "A", label: "Active" },
  { code: "I", label: "Inactive" },
];

const labelToPayUnitStatusCode = (label: string) =>
  PAY_UNIT_STATUS_OPTIONS.find((o) => o.label === label)?.code ?? "P";
const labelToStatusCode = (label: string) =>
  STATUS_OPTIONS.find((o) => o.label === label)?.code ?? "A";

// ─── Date helpers (DD/MM/YYYY) ───────────────────────────────────────────
const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (value: string): string => {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const toInputDate = (value: string): string => {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return toISODate(d);
};

const fromInputDate = (value: string): string => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

type TPayUnitRow = {
  row_id: string;
  pay_unit_code: string;
  pay_unit_name: string;
  amount: string;
  pay_unit_status: string;
  approved_on: string; // DD/MM/YYYY
  status: string;
  remarks: string;
  dirty: boolean;
  is_new: boolean;
};

const makeNewRow = (): TPayUnitRow => ({
  row_id: `new-${crypto.randomUUID()}`,
  pay_unit_code: "",
  pay_unit_name: "",
  amount: "0",
  pay_unit_status: "Pending",
  approved_on: formatDisplayDate(new Date().toISOString()), // default = today
  status: "Active",
  remarks: "",
  dirty: true,
  is_new: true,
});

const DIVISION_LOOKUP_PARAMETER = "MST_HR_ACCOUNT_DIVISION";
const DIVISION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "div_code", header: "Division Code" },
  { field: "div_name", header: "Division Name" },
];

const DEPARTMENT_LOOKUP_PARAMETER = "MST_HR_MS_HR_DEPARTMENT";
const DEPARTMENT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "dept_code", header: "Department Code" },
  { field: "dept_name", header: "Department Name" },
];

const SECTION_LOOKUP_PARAMETER = "MST_HR_MS_HR_SECTION_DDL";
const SECTION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "section_code", header: "Section Code" },
  { field: "section_name", header: "Section Name" },
];

const EMPLOYEE_LOOKUP_PARAMETER = "MST_HR_VW_HR_EMP_MASTER_DDL";
const EMPLOYEE_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "employee_code", header: "Employee Code" },
  { field: "rpt_name", header: "Employee Name" },
  { field: "div_name", header: "Division" },
  { field: "dept_name", header: "Department" },
  { field: "section_name", header: "Section" },
];

const PAY_UNITS_RETRIEVE_PARAMETER = "MST_HR_EMPLOYEE_PAY_UNITS_SELECT";

export function HrEmployeePayUnits() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [header, setHeader] = useState<THeaderFilters>({ ...EMPTY_HEADER });
  const [rows, setRows] = useState<TPayUnitRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const setHeaderField = (field: keyof THeaderFilters, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const employeeReady = !!companyCode && !!header.employee_id;

  const loadLookupRows = useCallback(
    async (
      parameter: string,
      code1: string,
      code2 = "NULL",
      code3 = "NULL",
      code4 = "NULL",
    ): Promise<LookupRow[]> => {
      const response = await getDynamicLookup({
        parameter,
        loginid,
        code1,
        code2,
        code3,
        code4,
        code5: "NULL",
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      return Array.isArray(response) ? (response as LookupRow[]) : [];
    },
    [loginid],
  );

  const loadEmployeeOptions = useCallback(async (): Promise<LookupRow[]> => {
    const all = await loadLookupRows(EMPLOYEE_LOOKUP_PARAMETER, companyCode);
    return all.filter((row) => {
      const r = row as Record<string, unknown>;
      if (header.div_code && (r.div_code as string) !== header.div_code) return false;
      if (header.dept_code && (r.dept_code as string) !== header.dept_code) return false;
      if (header.section_code && (r.section_code as string) !== header.section_code) return false;
      return true;
    });
  }, [loadLookupRows, companyCode, header.div_code, header.dept_code, header.section_code]);

  const handleRetrieve = useCallback(async () => {
    if (!companyCode || !header.employee_id) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await getDynamicLookup({
        parameter: PAY_UNITS_RETRIEVE_PARAMETER,
        loginid,
        code1: companyCode,
        code2: header.employee_id,
        code3: "NULL",
        code4: "NULL",
        code5: "NULL",
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(response) ? response : [];
      const mapped: TPayUnitRow[] = list.map((r: any, idx: number) => ({
        row_id: `${r.pay_unit_code ?? "row"}-${idx}`,
        pay_unit_code: r.pay_unit_code ?? "",
        pay_unit_name: r.pay_unit_name ?? "",
        amount: r.amount != null ? String(r.amount) : "0",
        pay_unit_status: r.pay_unit_status ?? "Pending",
        approved_on: formatDisplayDate(r.approved_on ?? ""),
        status: r.status ?? "Active",
        remarks: r.remarks ?? "",
        dirty: false,
        is_new: false,
      }));
      setRows(mapped);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load pay units",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode, header.employee_id]);

  useEffect(() => {
    if (employeeReady) {
      handleRetrieve();
    } else {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, header.employee_id]);

  const updateRow = (row_id: string, patch: Partial<TPayUnitRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.row_id === row_id ? { ...r, ...patch, dirty: true } : r)),
    );

  const addRow = () => {
    if (!employeeReady) return;
    setRows((prev) => [makeNewRow(), ...prev]);
  };

  const removeNewRow = (row_id: string) =>
    setRows((prev) => prev.filter((r) => r.row_id !== row_id));

  const handleSave = useCallback(async () => {
    if (!employeeReady) return;

    const dirtyRows = rows.filter((r) => r.dirty);
    if (dirtyRows.length === 0) {
      setNotice({ type: "error", message: "No changes to save." });
      return;
    }

    const missingCode = dirtyRows.find((r) => !r.pay_unit_code.trim());
    if (missingCode) {
      setNotice({ type: "error", message: "Pay Unit is required on every row." });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const today = new Date().toISOString();

      const payloads: THrEmpComponentPayload[] = dirtyRows.map((row) => ({
        employee_id: header.employee_id,
        pay_comp_id: row.pay_unit_code,
        pay_comp_amt: Number(row.amount) || 0,
        pay_roll_status: labelToPayUnitStatusCode(row.pay_unit_status),
        status_flag: labelToStatusCode(row.status),
        remarks: row.remarks,
        company_code: companyCode,
        user_id: loginid,
        user_dt: today,
        entered_on: today,
        entered_by: loginid,
        approved_on: row.approved_on
          ? new Date(toInputDate(row.approved_on) + "T00:00:00").toISOString()
          : today,
      }));

      const results = await upsertHrEmpComponentsApi(payloads);

      const failed = results
        .map((r, i) => ({ result: r, row: dirtyRows[i] }))
        .filter(({ result }) => !result.success);

      if (failed.length === 0) {
        setRows((prev) =>
          prev.map((r) => (r.dirty ? { ...r, dirty: false, is_new: false } : r)),
        );
        setNotice({ type: "success", message: "Pay units saved." });
      } else {
        console.error("Pay unit save failures:", failed);
        const firstReason =
          "error" in failed[0].result
            ? failed[0].result.error
            : failed[0].result.details || failed[0].result.message;
        setNotice({
          type: "error",
          message:
            failed.length === 1
              ? `Failed to save "${failed[0].row.pay_unit_code}": ${firstReason}`
              : `${failed.length} of ${dirtyRows.length} pay unit(s) failed to save. First error: ${firstReason}`,
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save pay units",
      });
    } finally {
      setSaving(false);
    }
  }, [rows, header, companyCode, loginid, employeeReady]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">HR Employee - Pay Units</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            View and manage an employee&apos;s pay unit amounts, status and remarks.
          </p>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      {/* ── Header band ── */}
      <div className="rounded-md border bg-card p-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Division: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!companyCode}
                value={header.div_code}
                columns={DIVISION_LOOKUP_COLUMNS}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() => loadLookupRows(DIVISION_LOOKUP_PARAMETER, companyCode)}
                onChange={(value, row) => {
                  setHeaderField("div_code", value);
                  setHeaderField("div_name", (row?.div_name as string) ?? "");
                  setHeaderField("dept_code", "");
                  setHeaderField("dept_name", "");
                  setHeaderField("section_code", "");
                  setHeaderField("section_name", "");
                  setHeaderField("employee_id", "");
                  setHeaderField("employee_display", "");
                }}
                placeholder="Division code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Department: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!header.div_code}
                value={header.dept_code}
                columns={DEPARTMENT_LOOKUP_COLUMNS}
                valueField="dept_code"
                displayFields={["dept_code", "dept_name"]}
                loadOptions={() =>
                  loadLookupRows(DEPARTMENT_LOOKUP_PARAMETER, companyCode, header.div_code)
                }
                onChange={(value, row) => {
                  setHeaderField("dept_code", value);
                  setHeaderField("dept_name", (row?.dept_name as string) ?? "");
                  setHeaderField("section_code", "");
                  setHeaderField("section_name", "");
                  setHeaderField("employee_id", "");
                  setHeaderField("employee_display", "");
                }}
                placeholder="Department code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Section: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!header.dept_code}
                value={header.section_code}
                columns={SECTION_LOOKUP_COLUMNS}
                valueField="section_code"
                displayFields={["section_code", "section_name"]}
                loadOptions={() =>
                  loadLookupRows(
                    SECTION_LOOKUP_PARAMETER,
                    companyCode,
                    header.div_code,
                    header.dept_code,
                  )
                }
                onChange={(value, row) => {
                  setHeaderField("section_code", value);
                  setHeaderField("section_name", (row?.section_name as string) ?? "");
                  setHeaderField("employee_id", "");
                  setHeaderField("employee_display", "");
                }}
                placeholder="Section code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Employee: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!companyCode}
                value={header.employee_id}
                columns={EMPLOYEE_LOOKUP_COLUMNS}
                valueField="employee_id"
                displayFields={["employee_code", "rpt_name"]}
                loadOptions={loadEmployeeOptions}
                onChange={(value, row) => {
                  setHeaderField("employee_id", value);
                  const code = (row?.employee_code as string) ?? "";
                  const name = (row?.rpt_name as string) ?? "";
                  setHeaderField("employee_display", [code, name].filter(Boolean).join(" - "));
                }}
                placeholder="Employee code or name"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2">
          <Button size="sm" variant="secondary" disabled={!employeeReady} onClick={addRow}>
            Add
          </Button>
          <Button size="sm" disabled={!employeeReady || loading} onClick={handleRetrieve}>
            {loading ? "Retrieving..." : "Retrieve"}
          </Button>
        </div>
      </div>

      {/* ── Pay units grid ── */}
      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-medium text-foreground">
            {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={!employeeReady || saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="min-w-[220px] px-2 py-1.5 font-medium">Pay Unit</th>
                <th className="min-w-[140px] px-2 py-1.5 font-medium">Amount</th>
                <th className="min-w-[150px] px-2 py-1.5 font-medium">Pay Unit Status</th>
                <th className="min-w-[150px] px-2 py-1.5 font-medium">Approved On</th>
                <th className="min-w-[120px] px-2 py-1.5 font-medium">Status</th>
                <th className="min-w-[200px] px-2 py-1.5 font-medium">Remarks</th>
                <th className="w-10 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.row_id} className="border-b last:border-b-0">
                  <td className="px-2 py-1">
                    {row.is_new ? (
                      <Input
                        className="h-7 text-sm px-2"
                        value={row.pay_unit_code}
                        onChange={(e) => updateRow(row.row_id, { pay_unit_code: e.target.value })}
                        placeholder="Pay unit code"
                      />
                    ) : (
                      <>
                        <span className="font-medium">{row.pay_unit_code}</span>
                        {row.pay_unit_name && row.pay_unit_name !== row.pay_unit_code && (
                          <span className="ml-1 text-muted-foreground">{row.pay_unit_name}</span>
                        )}
                      </>
                    )}
                    {row.dirty && (
                      <span className="ml-1 text-warning" title="Unsaved change">
                        ●
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-1">
                    <Input
                      className="h-7 text-sm px-2 text-right"
                      type="number"
                      value={row.amount}
                      onChange={(e) => updateRow(row.row_id, { amount: e.target.value })}
                    />
                  </td>

                  <td className="px-2 py-1">
                    <select
                      className="h-7 w-full rounded border bg-background px-2 text-sm"
                      value={row.pay_unit_status}
                      onChange={(e) =>
                        updateRow(row.row_id, {
                          pay_unit_status:
                            PAY_UNIT_STATUS_OPTIONS.find((o) => o.label === e.target.value)
                              ?.label ?? row.pay_unit_status,
                        })
                      }
                    >
                      {PAY_UNIT_STATUS_OPTIONS.map((o) => (
                        <option key={o.code} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Approved On - editable, DD/MM/YYYY, default today */}
                  <td className="px-2 py-1">
                    <input
                      type="date"
                      className="h-7 w-full rounded border bg-background px-2 text-sm"
                      value={toInputDate(row.approved_on)}
                      onChange={(e) =>
                        updateRow(row.row_id, {
                          approved_on: fromInputDate(e.target.value),
                        })
                      }
                    />
                  </td>

                  <td className="px-2 py-1">
                    <select
                      className="h-7 w-full rounded border bg-background px-2 text-sm"
                      value={row.status}
                      onChange={(e) =>
                        updateRow(row.row_id, {
                          status:
                            STATUS_OPTIONS.find((o) => o.label === e.target.value)?.label ??
                            row.status,
                        })
                      }
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.code} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-2 py-1">
                    <Input
                      className="h-7 text-sm px-2"
                      value={row.remarks}
                      onChange={(e) => updateRow(row.row_id, { remarks: e.target.value })}
                      placeholder="Remarks"
                    />
                  </td>

                  <td className="px-2 py-1 text-center">
                    {row.is_new && (
                      <button
                        type="button"
                        onClick={() => removeNewRow(row.row_id)}
                        className="text-destructive hover:opacity-70"
                        aria-label="Remove row"
                        title="Remove unsaved row"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    {employeeReady
                      ? loading
                        ? "Loading..."
                        : "No pay units found for this employee."
                      : "Select Employee to begin."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function payUnitRowToRawCodes(row: TPayUnitRow) {
  return {
    pay_comp_id: row.pay_unit_code,
    pay_comp_amt: Number(row.amount) || 0,
    pay_roll_status: labelToPayUnitStatusCode(row.pay_unit_status),
    status_flag: labelToStatusCode(row.status),
    remarks: row.remarks,
  };
}