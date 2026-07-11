import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executeHrRawSql } from "../../../api/hr";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
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

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">HR Flow</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Employee Payslip View</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employeeId || "-"} · {month || "-"} / {year || "-"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/workspace/ems/ems/activity/request/employee_payslip")}>
            <ArrowLeft size={15} /> Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <Card className="border-border/80 shadow-sm">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <Metric label="Employee" value={String(header?.EMPLOYEE_NAME || header?.RPT_NAME || employeeId || "-")} />
          <Metric label="Pay Period" value={`${month || "-"} / ${year || "-"}`} />
          <Metric label="Total Earnings" value={formatMoney(totals.totalEarnings)} />
          <Metric label="Net Pay" value={formatMoney(totals.net)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          columns={payColumns}
          data={earnings}
          searchPlaceholder="Search earnings..."
          loading={loading}
          emptyText="No earnings found"
          density="grid"
          height="420px"
          minWidth={520}
          enablePagination
          pageSize={25}
        />
        <DataTable
          columns={payColumns}
          data={deductions}
          searchPlaceholder="Search deductions..."
          loading={loading}
          emptyText="No deductions found"
          density="grid"
          height="420px"
          minWidth={520}
          enablePagination
          pageSize={25}
        />
      </div>
    </section>
  );
}

const payColumns: ColumnDef<Row>[] = [
  { accessorKey: "PAY_COMP_DESC", header: "Component" },
  { accessorKey: "PAY_COMP_AMT", header: "Amount", cell: ({ row }) => formatMoney(row.original.PAY_COMP_AMT) },
];

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="m-0 truncate text-lg font-semibold text-foreground">{value}</p>
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
