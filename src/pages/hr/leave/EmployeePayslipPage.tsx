import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHrEmployees, type HrEmployee } from "../../../api/hr";
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
    <section className="payslip-lookup-page">
      <div className="payslip-page-actions">
        <div>
          <p className="leave-flow-eyebrow">HR Flow</p>
          <h1>Employee Payslip</h1>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <Card className="payslip-lookup-card border-border/80 shadow-sm">
        <CardContent className="payslip-lookup-content">
          <div className="payslip-lookup-title">
            <div className="payslip-logo-mark">
              <FileText size={18} />
            </div>
            <div>
              <p>Payslip Lookup</p>
              <span>Choose employee and payroll month.</span>
            </div>
          </div>

          <label className="field payslip-lookup-field">
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

          <label className="field payslip-lookup-field">
            <span>Pay Period</span>
            <Input type="month" value={period} min={bounds.min} max={bounds.max} onChange={(event) => setPeriod(event.target.value)} />
          </label>

          <Button className="payslip-lookup-submit" onClick={viewPayslip} disabled={loading || !employeeId || !period}>
            <Search size={15} /> View Payslip
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
