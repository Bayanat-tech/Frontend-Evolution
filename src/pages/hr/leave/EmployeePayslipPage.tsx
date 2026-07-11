import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executeHrRawSql, type HrEmployee } from "../../../api/hr";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { Select } from "../../../components/ui/Select";
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
    executeHrRawSql<HrEmployee>(employeeTreeSql(loginId))
      .then((rows) => {
        const self = { EMPLOYEE_ID: loginId, RPT_NAME: "Current User" } as HrEmployee;
        const merged = rows.some((row) => String(row.EMPLOYEE_ID || "") === loginId) ? rows : [self, ...rows];
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
    <section className="grid gap-4">
      <div>
        <p className="eyebrow">HR Flow</p>
        <h1 className="m-0 text-2xl font-semibold text-foreground">Employee Payslip</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Select an employee and pay period to view the payslip.</p>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <Card className="max-w-2xl border-border/80 shadow-sm">
        <CardContent className="grid gap-4 p-5">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-primary">
              <FileText size={18} />
            </div>
            <div>
              <p className="m-0 text-sm font-semibold text-foreground">Payslip Lookup</p>
              <p className="m-0 text-xs text-muted-foreground">Current and previous year are available.</p>
            </div>
          </div>

          <label className="field">
            <span>Employee</span>
            <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={loading}>
              <option value="">{loading ? "Loading employees..." : "Select employee"}</option>
              {employees.map((employee) => (
                <option key={String(employee.EMPLOYEE_ID || "")} value={String(employee.EMPLOYEE_ID || "")}>
                  {String(employee.EMPLOYEE_ID || "")} - {String(employee.RPT_NAME || employee.EMPLOYEE_NAME || "")}
                </option>
              ))}
            </Select>
          </label>

          <label className="field">
            <span>Pay Period</span>
            <Input type="month" value={period} min={bounds.min} max={bounds.max} onChange={(event) => setPeriod(event.target.value)} />
          </label>

          <Button onClick={viewPayslip} disabled={loading || !employeeId || !period}>
            <Search size={15} /> View Payslip
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function employeeTreeSql(loginId: string) {
  const safeLogin = loginId.replace(/'/g, "''");
  return `
    SELECT DISTINCT *
    FROM (
      SELECT *
      FROM VW_HR_EMPLOYEE_AWARE
      WHERE EMP_STATUS <> 'S'
      START WITH
        EMPLOYEE_ID = '${safeLogin}'
        OR SUPERVISOR_EMPID = '${safeLogin}'
        OR DEPT_HEAD_EMPID = '${safeLogin}'
        OR MANGR_EMPID = '${safeLogin}'
      CONNECT BY NOCYCLE PRIOR EMPLOYEE_ID = SUPERVISOR_EMPID
        OR PRIOR EMPLOYEE_ID = DEPT_HEAD_EMPID
        OR PRIOR EMPLOYEE_ID = MANGR_EMPID
    )
  `;
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
