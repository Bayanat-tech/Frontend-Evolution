import { ArrowRight, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {  getHrEmployees,getPayslipreport , type HrEmployee } from "../../../api/hr";
import type { LookupRow } from "../../../api/lookups";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField"; // adjust path if LookupField lives elsewhere
import { useAuth } from "../../../state/AuthContext";
import { openPayslipReport } from "./payslipPreviewStore";
import { PayslipReportPreview } from "./PayslipReportPreview";

// LookupField takes an async loader; for lists we already hold in memory we just return them.
const loadStatic = (rows: LookupRow[]) => async () => rows;

export function EmployeePayslipPage() {
  const { user } = useAuth();
  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState(previousMonthPeriod());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);
  
  const bounds = useMemo(() => {
    const now = new Date();
    return {
      min: `${now.getFullYear() - 1}-01`,
      max: previousMonthPeriod(), 
    };
  }, []);

  useEffect(() => {
    if (!loginId) return;
    setLoading(true);
    getHrEmployees(loginId)
      .then((rows) => {
        const self = { EMPLOYEE_ID: loginId, RPT_NAME: "Current User" } as HrEmployee;
        const safeRows = rows.length ? rows : [self];
        const merged = safeRows.some((row) => String(row.EMPLOYEE_ID || row.EMPLOYEE_CODE || "") === loginId) ? safeRows : [self, ...safeRows];
        setEmployees(merged);
        setEmployeeId(loginId);
      })
      .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employees" }))
      .finally(() => setLoading(false));
  }, [loginId]);

  // ---------- Rows + display text for the Employee LookupField ----------
  const employeeRows = useMemo<LookupRow[]>(
    () =>
      employees.map((employee) => ({
        CODE: String(employee.EMPLOYEE_ID || ""),
        NAME: String(employee.RPT_NAME || employee.EMPLOYEE_NAME || ""),
      })),
    [employees]
  );

  const employeeDisplay = useMemo(() => {
    if (!employeeId) return "";
    const match = employees.find((employee) => String(employee.EMPLOYEE_ID || "") === employeeId);
    if (!match) return employeeId;
    const name = String(match.RPT_NAME || match.EMPLOYEE_NAME || "");
    return name ? `${employeeId} - ${name}` : employeeId;
  }, [employees, employeeId]);

  const viewPayslip = async () => {
    if (!employeeId || !period) {
      setNotice({ type: "error", message: "Select employee and pay period" });
      return;
    }

    if (period > bounds.max || period < bounds.min) {
    setNotice({ type: "error", message: "Selected pay period is not available." });
    return;
    }

    const [year, month] = period.split("-");

    const preview = openPayslipReport("Employee Payslip");
    const filename = `Payslip_${employeeId}_${month}_${year}`;
    setLoading(true);
    try {
      const html = await getPayslipreport({ loginid: loginId, employeeId, month, year, embed: true });
      if (!html.includes('id="payslip-content"')) {
        setNotice({ type: "error", message: "No data found" });
        preview.fail("No data found");  
        return;
      }
      preview.ready({ html, filename, orientation: "portrait" });
    } catch (error: any) {
        const body = error?.response?.data;
        let message = error instanceof Error ? error.message : "Unable to generate payslip.";

        if (body && typeof body === "object" && body.message) {
          message = body.message;
        } else if (typeof body === "string" && body.trimStart().startsWith("{")) {
          try { message = JSON.parse(body).message || message; } catch { /* keep default */ }
        }

        if (error?.response?.status === 404) message = "No data found";

        setNotice({ type: "error", message });
        preview.fail(message);
      } finally {
      setLoading(false);
    }
  };

  return (
    <section className="payslip-freight-view grid gap-4 max-w-2xl mx-auto py-4">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Employee Payslip
          </h2>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Modern Lookup Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm grid gap-5">
        <div className="flex items-center gap-3 border-b border-border/40 pb-4">
          <div className="h-10 w-10 rounded-xl bg-[#00378C]/10 text-[#00378C] flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="m-0 text-sm font-semibold text-foreground">Payslip Lookup</h3>
            <p className="m-0 text-xs text-muted-foreground mt-0.5">Choose employee and payroll month to generate payslip.</p>
          </div>
        </div>

        <div className="grid gap-4">
          {/* Employee lookup (LookupField renders its own label) */}
          <LookupField
            label="Employee"
            value={employeeId}
            displayValue={employeeDisplay}
            columns={[
              { field: "CODE", header: "Emp ID", width: 120 },
              { field: "NAME", header: "Name" },
            ]}
            valueField="CODE"
            displayFields={["CODE", "NAME"]}
            loadOptions={loadStatic(employeeRows)}
            onChange={(code) => setEmployeeId(code)}
            disabled={loading}
            placeholder={loading ? "Loading employees" : "Select employee"}
          />

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            <span>Pay Period</span>
            <Input
              type="month"
              value={period}
              min={bounds.min}
              max={bounds.max}
              onChange={(event) => {
                const value = event.target.value;
                if (value && value > bounds.max) {
                  setNotice({ type: "error", message: "Current month's payslip is not available yet." });
                  return;
                }
                setPeriod(value);
              }}
              className="rounded-xl h-10 text-xs"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={viewPayslip}
          disabled={loading || !employeeId || !period}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00378C] text-white hover:opacity-95 transition-all text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50 mt-2"
        >
          <Search size={14} />
          View Payslip
          <ArrowRight size={14} />
        </button>
      </div>
      <PayslipReportPreview />
    </section>
  );
}

// function currentPeriod() {
//   const now = new Date();
//   return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
// }


// helper: previous month as "YYYY-MM" (handles January -> December of last year)
function previousMonthPeriod() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}