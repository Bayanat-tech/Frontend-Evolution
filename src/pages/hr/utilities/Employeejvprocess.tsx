import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import {
  getDynamicLookup,
  executeCommonProcedure, // TODO: fix import path if executeCommonProcedure lives elsewhere
  type DynamicQueryParams,
} from "../../../api/lookups";

// ─── Types ──────────────────────────────────────────────────────────────────

type PayPeriodRow = { PAY_MONTH: number | string; PAY_YEAR: number | string };

type EmployeeRow = {
  EMPLOYEE_CODE: string;
  RPT_NAME: string;
  SOURCE_DESC: string;
  EMPLOYEE_ID: string;
  DIV_CODE: string;
  SOURCE_FLAG: string;
  SR_NO: number | string | null;
  LVE_DOC_NO: number | string | null;
};

type Option = { value: string; label: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function uppercaseKeys<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out as T;
}

// ─── Options ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();

const SOURCE_OPTIONS: Option[] = [
  { value: "V", label: "Vacation Settlement" },
  { value: "S", label: "Final Settlement" },
  { value: "E", label: "Leave Encashment" },
  { value: "T", label: "AirFare Reimbursement" },
  { value: "A", label: "Leave Adjustment ADD" },
  { value: "D", label: "Leave Adjustment DEDUCT" },
  { value: "X", label: "NONVacation Settle AL" },
  { value: "Y", label: "UnPaid Leave AL DEDUCTN" },
  { value: "Z", label: "Special Leave" },
];

// Which procedure to run for each source (same split as the PB script):
//   S        -> SP_HR_PAYROLL_JV_PROCESS_DET
//   X, Y     -> SP_HR_PAYROLL_JV_PROCESS_MULTI   (also takes SR_NO as val1s8)
//   V,E,T,A,D,Z -> SP_HR_PAYROLL_JV_PROCESS_DET1
// TODO: these strings must match the case names your executeCommonProcedure backend expects
const JV_PROC_FINAL = "SP_HR_PAYROLL_JV_PROCESS_DET";
const JV_PROC_MULTI = "SP_HR_PAYROLL_JV_PROCESS_MULTI";
const JV_PROC_OTHER = "SP_HR_PAYROLL_JV_PROCESS_DET1";

const getJvProcedure = (sourceFlag: string): string => {
  if (sourceFlag === "S") return JV_PROC_FINAL;
  if (sourceFlag === "X" || sourceFlag === "Y") return JV_PROC_MULTI;
  return JV_PROC_OTHER;
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const labelCls = "grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground";
const controlCls =
  "h-8 w-full rounded-md px-3 text-sm font-normal normal-case text-foreground shadow-sm outline-none focus:border-blue-600";
const controlStyle: React.CSSProperties = { border: "1px solid #aebdce", background: "#f4f7fb" };

// ─── Component ──────────────────────────────────────────────────────────────

const EmployeeJVProcess: React.FC = () => {
  const { user } = useAuth();
  const loginid = (user as any)?.loginid ?? "";
  const companyCode: string = ((user as any)?.company_code as string)?.trim() || "All";

  const [payMonth, setPayMonth] = useState(String(new Date().getMonth() + 1));
  const [payYear, setPayYear] = useState(String(currentYear));
  const [employee, setEmployee] = useState(""); // option value: employeeId::sourceFlag::srNo
  const [source, setSource] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // company's current pay period (reset target for Clear All)
  const [companyPeriod, setCompanyPeriod] = useState<{ month: string; year: string } | null>(null);

  // employee lookup
  const [employeeOptions, setEmployeeOptions] = useState<Option[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const employeeRowsRef = useRef<Record<string, EmployeeRow>>({}); // option value -> full row
  const empRequestRef = useRef(0);

  // ── Pay month / year ──
  const loadPayPeriod = useCallback(async () => {
    try {
      const rows = await getDynamicLookup({
        parameter: "HR_JV_PROCESS_PAY_MONTH_YEAR",
        loginid,
        code1: companyCode,
      } as DynamicQueryParams);

      const row = rows?.[0] ? uppercaseKeys<PayPeriodRow>(rows[0] as Record<string, any>) : null;
      if (!row) return;

      const period = { month: String(Number(row.PAY_MONTH)), year: String(Number(row.PAY_YEAR)) };
      setCompanyPeriod(period);
      setPayMonth(period.month);
      setPayYear(period.year);
    } catch (e: any) {
      console.error("Failed to load pay month/year", e);
      setError(e?.message ?? "Failed to load pay month/year");
    }
  }, [companyCode, loginid]);

  useEffect(() => {
    loadPayPeriod();
  }, [loadPayPeriod]);

  // ── Employees (reload whenever company / month / year changes) ──
  const loadEmployees = useCallback(async () => {
    const requestId = ++empRequestRef.current;
    setEmpLoading(true);

    try {
      const rows = await getDynamicLookup({
        parameter: "HR_JV_PROCESS_EMPLOYEE_SEARCH",
        loginid,
        code1: companyCode,
        code2: payMonth,
        code3: payYear,
      } as DynamicQueryParams);

      if (requestId !== empRequestRef.current) return;

      const map: Record<string, EmployeeRow> = {};
      const options: Option[] = [];
      (rows || []).forEach((r) => {
        const row = uppercaseKeys<EmployeeRow>(r as Record<string, any>);
        if (!row.EMPLOYEE_ID) return;
        // same employee can appear once per source, so source + sr_no are part of the key
        const value = `${row.EMPLOYEE_ID}::${row.SOURCE_FLAG}::${row.SR_NO ?? ""}`;
        if (map[value]) return;
        map[value] = row;
        options.push({
          value,
          label: `${row.EMPLOYEE_CODE} - ${row.RPT_NAME}${row.SOURCE_DESC ? ` (${row.SOURCE_DESC})` : ""}`,
        });
      });

      employeeRowsRef.current = map;
      setEmployeeOptions(options);
    } catch (e: any) {
      if (requestId !== empRequestRef.current) return;
      console.error("Failed to load employees", e);
      setError(e?.message ?? "Failed to load employees");
    } finally {
      if (requestId === empRequestRef.current) setEmpLoading(false);
    }
  }, [companyCode, loginid, payMonth, payYear]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Always include the company's pay year in the list
  const baseYear = Number(companyPeriod?.year) || currentYear;
  const years = [baseYear - 2, baseYear - 1, baseYear, baseYear + 1];

  const handlePeriodChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    // employee list depends on month/year, so drop the old selection
    setEmployee("");
    setSource("");
  };

  // Picking an employee fills Source from that row
  const handleEmployeeChange = (value: string) => {
    setEmployee(value);
    const row = employeeRowsRef.current[value];
    setSource(row?.SOURCE_FLAG ?? "");
  };

  const handleClearAll = () => {
    setPayMonth(companyPeriod?.month ?? String(new Date().getMonth() + 1));
    setPayYear(companyPeriod?.year ?? String(currentYear));
    setEmployee("");
    setSource("");
    setError("");
    setSuccessMsg("");
  };

  const processJV = async () => {
    setSuccessMsg("");
    const row = employeeRowsRef.current[employee];
    if (!employee || !row) {
      setError("Select Employee");
      return;
    }
    if (!source) {
      setError("Select Source");
      return;
    }
    if (!window.confirm("Press OK if all values are correct for passing JV")) return;

    setLoading(true);
    setError("");
    try {
      // company, div, employee, paymonth, payyear, userid, source [, sr_no]
      const args: Record<string, any> = {
        parameter: getJvProcedure(source),
        loginid,
        val1s1: companyCode,
        val1s2: row.DIV_CODE,
        val1s3: row.EMPLOYEE_ID,
        val1s4: payMonth,
        val1s5: payYear,
        val1s6: loginid,
        val1s7: source,
      };
      if (source === "X" || source === "Y") args.val1s8 = row.SR_NO;

      await executeCommonProcedure(args as any);

      setSuccessMsg(`JV Process Success For the Employee ${row.RPT_NAME}`);
      setEmployee("");
      setSource("");
      await loadEmployees(); // processed entry should drop out of the list
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to process JV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-4">
      <div className="rounded-md border bg-white shadow-sm">
        {/* Header */}
        <div className="border-b px-4 py-3">
          <h1 className="text-base font-semibold">Employee JV Process</h1>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <span>{error}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setError("")}
                className="ml-3 text-red-700 hover:text-red-900"
              >
                ×
              </button>
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <label className={labelCls}>
              Pay Month
              <select
                value={payMonth}
                onChange={(e) => handlePeriodChange(setPayMonth)(e.target.value)}
                className={controlCls}
                style={controlStyle}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelCls}>
              Pay Year
              <select
                value={payYear}
                onChange={(e) => handlePeriodChange(setPayYear)(e.target.value)}
                className={controlCls}
                style={controlStyle}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelCls}>
              Employee
              <select
                value={employee}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                disabled={empLoading}
                className={controlCls}
                style={controlStyle}
              >
                <option value="">{empLoading ? "Loading..." : "Select employee"}</option>
                {employeeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelCls}>
              Source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={controlCls}
                style={controlStyle}
              >
                <option value="">Select source</option>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {successMsg && (
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "#065f46",
                  background: "#d1fae5",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontWeight: 500,
                }}
              >
                {successMsg}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={processJV}
              disabled={loading}
              className="h-8 rounded-md bg-blue-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Process JV"}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={loading}
              className="h-8 rounded-md border bg-white px-4 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeJVProcess;