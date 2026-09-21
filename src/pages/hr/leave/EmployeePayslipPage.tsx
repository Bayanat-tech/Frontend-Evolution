import { ArrowRight, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHrEmployees, type HrEmployee } from "../../../api/hr";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../state/AuthContext";

export function EmployeePayslipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const bounds = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    return {
      min: `${currentYear - 1}-01`,
      max: `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`,
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

  const viewPayslip = () => {
    if (!employeeId || !period) {
      setNotice({ type: "error", message: "Select employee and pay period" });
      return;
    }
    const [year, month] = period.split("-");
    navigate(`/workspace/ems/ems/activity/request/employee_payslip_view/${employeeId}/${month}/${year}`);
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
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            <span>Employee</span>
            <Select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={loading}
              className="rounded-xl h-10"
            >
              <option value="">{loading ? "Loading employees..." : "Select employee"}</option>
              {employees.map((employee) => (
                <option key={String(employee.EMPLOYEE_ID || "")} value={String(employee.EMPLOYEE_ID || "")}>
                  {String(employee.EMPLOYEE_ID || "")} - {String(employee.RPT_NAME || employee.EMPLOYEE_NAME || "")}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            <span>Pay Period</span>
            <Input
              type="month"
              value={period}
              min={bounds.min}
              max={bounds.max}
              onChange={(event) => setPeriod(event.target.value)}
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
    </section>
  );
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

