import { ArrowLeft, Download, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executeHrRawSql } from "../../../api/hr";
import { Button } from "../../../components/ui/Button";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";

type Row = Record<string, unknown>;

export function EmployeePayslipViewPage() {
  const navigate = useNavigate();
  const { employeeId, month, year } = getPayslipParams();
  const [header, setHeader] = useState<Row | null>(null);
  const [earnings, setEarnings] = useState<Row[]>([]);
  const [deductions, setDeductions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  useEffect(() => {
    if (!employeeId || !month || !year) {
      setNotice({ type: "error", message: "Payslip route is missing employee, month, or year" });
      return;
    }
    setLoading(true);
    Promise.all([
      executeHrRawSql<Row>(headerSql(employeeId, month, year)),
      executeHrRawSql<Row>(earningsSql(employeeId, month, year)),
      executeHrRawSql<Row>(deductionsSql(employeeId, month, year)),
    ])
      .then(([headerRows, earningRows, deductionRows]) => {
        setHeader(headerRows[0] || null);
        setEarnings(earningRows);
        setDeductions(deductionRows);
      })
      .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load payslip" }))
      .finally(() => setLoading(false));
  }, [employeeId, month, year]);

  const totals = useMemo(() => {
    const totalEarnings = earnings.reduce((sum, row) => sum + Number(row.PAY_COMP_AMT || 0), 0);
    const totalDeductions = deductions.reduce((sum, row) => sum + Number(row.PAY_COMP_AMT || 0), 0);
    return { totalEarnings, totalDeductions, net: totalEarnings - totalDeductions };
  }, [earnings, deductions]);

  const downloadPdf = () => {
    document.body.classList.add("printing-payslip");
    const cleanup = () => document.body.classList.remove("printing-payslip");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
    window.setTimeout(cleanup, 30000);
  };

  return (
    <section className="payslip-page">
      <div className="payslip-page-actions">
        <div>
          <p className="leave-flow-eyebrow">HR Flow</p>
          <h1>Employee Payslip</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/workspace/ems/ems/activity/request/employee_payslip")}>
            <ArrowLeft size={15} /> Back
          </Button>
          <Button onClick={downloadPdf}>
            <Download size={15} /> Download PDF
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <article id="payslip-content" className="payslip-report">
        <header className="payslip-report-header">
          <div className="payslip-logo-mark">
            <FileText size={22} />
          </div>
          <div>
            <h2>Employee Payslip</h2>
            <p>{getMonthName(month)} {year}</p>
          </div>
        </header>

        <section className="payslip-employee-grid">
          <Metric label="Employee" value={`${employeeId || "-"} - ${String(header?.RPT_NAME || header?.EMPLOYEE_NAME || "-")}`} />
          <Metric label="Designation" value={String(header?.DESG_NAME || header?.DESIGNATION || "-")} />
          <Metric label="Division" value={String(header?.DIV_NAME || "-")} />
          <Metric label="Department" value={String(header?.DEPT_NAME || "-")} />
          <Metric label="Pay Period" value={`${month || "-"} / ${year || "-"}`} />
          <Metric label="Net Pay" value={formatMoney(totals.net)} />
        </section>

        {loading ? <p className="payslip-loading">Loading payslip...</p> : null}

        <section className="payslip-lines-grid">
          <PaySection title="Earnings" rows={earnings} total={totals.totalEarnings} />
          <PaySection title="Deductions" rows={deductions} total={totals.totalDeductions} />
        </section>

        <footer className="payslip-total-band">
          <span>Net Pay</span>
          <strong>{formatMoney(totals.net)}</strong>
        </footer>
      </article>
    </section>
  );
}

function PaySection({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <section className="payslip-pay-section">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={`${title}-${String(row.PAY_COMP_DESC || index)}`}>
              <td>{String(row.PAY_COMP_DESC || "-")}</td>
              <td>{formatMoney(row.PAY_COMP_AMT)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={2}>No {title.toLowerCase()} found</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Total {title}</td>
            <td>{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="payslip-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPayslipParams() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((part) => part.toLowerCase() === "employee_payslip_view");
  return {
    employeeId: marker >= 0 ? parts[marker + 1] : "",
    month: marker >= 0 ? parts[marker + 2] : "",
    year: marker >= 0 ? parts[marker + 3] : "",
  };
}

function headerSql(employeeId: string, month: string, year: string) {
  return `SELECT DISTINCT * FROM VW_BOHC_PAYSLIP_HDR WHERE EMPLOYEE_ID = '${escapeSql(employeeId)}' AND PAY_MONTH = '${escapeSql(month)}' AND PAY_YEAR = '${escapeSql(year)}'`;
}

function earningsSql(employeeId: string, month: string, year: string) {
  return `SELECT DISTINCT PAY_COMP_DESC, PAY_COMP_AMT, SORT_ORDER FROM VW_BOHC_PAYSLIP_DTL_EARNINGS WHERE EMPLOYEE_ID = '${escapeSql(employeeId)}' AND PAY_MONTH = '${escapeSql(month)}' AND PAY_YEAR = '${escapeSql(year)}' ORDER BY SORT_ORDER`;
}

function deductionsSql(employeeId: string, month: string, year: string) {
  return `SELECT DISTINCT PAY_COMP_DESC, PAY_COMP_AMT, SORT_ORDER FROM VW_BOHC_PAYSLIP_DTL_DEDUCTIONS WHERE EMPLOYEE_ID = '${escapeSql(employeeId)}' AND PAY_MONTH = '${escapeSql(month)}' AND PAY_YEAR = '${escapeSql(year)}' ORDER BY SORT_ORDER`;
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function formatMoney(value: unknown) {
  const number = Number(value || 0);
  return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthName(monthValue: string) {
  const monthIndex = Number(monthValue) - 1;
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[monthIndex] || monthValue || "-";
}
