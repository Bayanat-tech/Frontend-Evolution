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
    <section className="payslip-freight-view grid gap-4 max-w-4xl mx-auto py-3">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/workspace/ems/ems/activity/request/employee_payslip")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary text-xs font-medium cursor-pointer transition-all shadow-sm"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
          >
            <Download size={13} /> Download PDF
          </button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <article id="payslip-content" className="rounded-2xl border border-border bg-card shadow-sm p-6 grid gap-5">
        <header className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#00378C]/10 text-[#00378C] flex items-center justify-center shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="m-0 text-base font-semibold text-foreground">Employee Payslip</h3>
              <p className="m-0 text-xs text-muted-foreground mt-0.5">Official Payroll Statement</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-xl border border-[#00378C]/20 bg-[#00378C]/10 px-3 py-1 text-xs font-bold text-[#00378C]">
            {getMonthName(month)} {year}
          </span>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Metric label="Employee" value={`${employeeId || "-"} - ${String(header?.RPT_NAME || header?.EMPLOYEE_NAME || "-")}`} />
          <Metric label="Designation" value={String(header?.DESG_NAME || header?.DESIGNATION || "-")} />
          <Metric label="Division" value={String(header?.DIV_NAME || "-")} />
          <Metric label="Department" value={String(header?.DEPT_NAME || "-")} />
          <Metric label="Pay Period" value={`${month || "-"} / ${year || "-"}`} />
          <Metric label="Net Pay" value={formatMoney(totals.net)} highlight />
        </section>

        {loading ? <p className="text-center py-6 text-xs text-muted-foreground">Loading payslip...</p> : null}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PaySection title="Earnings" rows={earnings} total={totals.totalEarnings} />
          <PaySection title="Deductions" rows={deductions} total={totals.totalDeductions} />
        </section>

        <footer className="flex items-center justify-between rounded-xl bg-[#00378C] text-white px-5 py-3 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider">Net Salary Payable</span>
          <strong className="text-lg font-bold">{formatMoney(totals.net)}</strong>
        </footer>
      </article>
    </section>
  );
}

function PaySection({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <section className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="bg-muted/60 px-3.5 py-2 border-b border-border">
        <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-[#00378C]">{title}</h4>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/20 text-[11px] text-muted-foreground uppercase">
            <th className="text-left font-semibold px-3.5 py-1.5">Component</th>
            <th className="text-right font-semibold px-3.5 py-1.5">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${title}-${String(row.PAY_COMP_DESC || index)}`} className="hover:bg-muted/10">
                <td className="px-3.5 py-1.5 text-foreground">{String(row.PAY_COMP_DESC || "-")}</td>
                <td className="px-3.5 py-1.5 text-right font-medium text-foreground">{formatMoney(row.PAY_COMP_AMT)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-3.5 py-3 text-center text-muted-foreground text-xs">
                No {title.toLowerCase()} found
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30 font-semibold">
            <td className="px-3.5 py-2 text-foreground">Total {title}</td>
            <td className="px-3.5 py-2 text-right text-foreground">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2.5 rounded-xl border ${highlight ? "border-[#00378C]/30 bg-[#00378C]/5" : "border-border/70 bg-card"} flex flex-col gap-0.5`}>
      <span className="text-[10.5px] uppercase font-semibold text-muted-foreground">{label}</span>
      <strong className={`text-xs font-semibold truncate ${highlight ? "text-[#00378C]" : "text-foreground"}`} title={value}>{value}</strong>
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
