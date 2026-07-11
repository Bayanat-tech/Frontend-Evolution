import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, RefreshCw, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { executeHrRawSql, getHrLeaveHistory, type HrEmployee } from "../../../api/hr";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { Input } from "../../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";

type Row = Record<string, unknown>;

export function LeaveRegisterPage() {
  const { user } = useAuth();
  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [balances, setBalances] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  useEffect(() => {
    if (!loginId) return;
    setLoading(true);
    executeHrRawSql<HrEmployee>(employeeTreeSql(loginId))
      .then((rows) => {
        setEmployees(rows);
        const self = rows.find((row) => String(row.EMPLOYEE_ID || "") === loginId) || rows[0];
        if (self) setEmployeeId(String(self.EMPLOYEE_ID || ""));
      })
      .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employees" }))
      .finally(() => setLoading(false));
  }, [loginId]);

  useEffect(() => {
    if (!employeeId) return;
    void loadRegister(false);
  }, [employeeId]);

  const leaveTypes = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((row) => {
      const code = String(row.LEAVE_TYPE || "");
      if (code) map.set(code, String(row.LEAVE_TYPE_DESC || code));
    });
    balances.forEach((row) => {
      const code = String(row.LEAVE_TYPE || "");
      if (code) map.set(code, String(row.LEAVE_TYPE_DESC || code));
    });
    return Array.from(map, ([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [history, balances]);

  const loadRegister = async (showNotice = true) => {
    if (!employeeId) return;
    setLoading(true);
    if (showNotice) setNotice(null);
    try {
      const [balanceRows, historyRows] = await Promise.all([
        executeHrRawSql<Row>(leaveBalanceSql(employeeId)),
        getHrLeaveHistory({
          employeeId,
          leaveType: leaveType === "ALL" ? undefined : leaveType,
          leaveStartDateFrom: fromDate || undefined,
          leaveEndDateTo: toDate || undefined,
        }),
      ]);
      setBalances(balanceRows);
      setHistory(historyRows);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave register" });
    } finally {
      setLoading(false);
    }
  };

  const selectedEmployee = employees.find((employee) => String(employee.EMPLOYEE_ID || "") === employeeId);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">HR Flow</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Leave Register</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Employee leave register and balance lookup.</p>
        </div>
        <Button variant="outline" onClick={() => void loadRegister()} disabled={loading || !employeeId}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-5">
        <label className="field md:col-span-2">
          <span>Employee</span>
          <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={loading}>
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={String(employee.EMPLOYEE_ID || "")} value={String(employee.EMPLOYEE_ID || "")}>
                {String(employee.EMPLOYEE_ID || "")} - {String(employee.RPT_NAME || employee.EMPLOYEE_NAME || "")}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>Leave Type</span>
          <Select value={leaveType} onChange={(event) => setLeaveType(event.target.value)} disabled={!employeeId}>
            <option value="ALL">All Leave Types</option>
            {leaveTypes.map((type) => (
              <option key={type.code} value={type.code}>
                {type.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>From Date</span>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="field">
          <span>To Date</span>
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <div className="flex items-end gap-2 md:col-span-5">
          <Button onClick={() => void loadRegister()} disabled={loading || !employeeId}>
            <Search size={15} /> View
          </Button>
          <Button variant="outline" onClick={() => { setLeaveType("ALL"); setFromDate(""); setToDate(""); }}>
            Clear
          </Button>
          <Badge variant="outline" className="ml-auto gap-1">
            <UserRound size={12} /> {selectedEmployee ? String(selectedEmployee.RPT_NAME || selectedEmployee.EMPLOYEE_NAME || employeeId) : "-"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {balances.length ? balances.map((row) => (
          <Card key={`${String(row.LEAVE_TYPE)}-${String(row.EMPLOYEE_ID)}`} className="border-border/80 shadow-sm">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-medium uppercase text-muted-foreground">{String(row.LEAVE_TYPE_DESC || row.LEAVE_TYPE || "Leave")}</p>
              <p className="m-0 mt-1 text-2xl font-semibold text-foreground">{formatNumber(row.NO_OF_LEAVES_AVAILABLE)}</p>
              <p className="m-0 mt-1 text-xs text-muted-foreground">Available balance</p>
            </CardContent>
          </Card>
        )) : (
          <Card className="border-border/80 shadow-sm md:col-span-4">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <CalendarDays size={16} /> No balance rows found for the selected employee.
            </CardContent>
          </Card>
        )}
      </div>

      <DataTable
        columns={historyColumns}
        data={history}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search leave history..."
        loading={loading}
        emptyText="No leave history found"
        density="grid"
        height="calc(100vh - 455px)"
        minWidth={980}
        enablePagination
        enableExport
        exportFilename="leave_register.csv"
        pageSize={50}
      />
    </section>
  );
}

const historyColumns: ColumnDef<Row>[] = [
  { accessorKey: "LEAVE_REQUEST_DATE", header: "Request Date", cell: ({ row }) => formatDate(row.original.LEAVE_REQUEST_DATE) },
  { accessorKey: "LEAVE_TYPE_DESC", header: "Leave Type" },
  { accessorKey: "LEAVE_START_DATE", header: "Start Date", cell: ({ row }) => formatDate(row.original.LEAVE_START_DATE) },
  { accessorKey: "LEAVE_END_DATE", header: "End Date", cell: ({ row }) => formatDate(row.original.LEAVE_END_DATE) },
  { accessorKey: "LEAVE_DAYS", header: "Days" },
  { accessorKey: "DUTY_RESUME_DATE", header: "Duty Resume Date", cell: ({ row }) => formatDate(row.original.DUTY_RESUME_DATE) },
  { accessorKey: "APPROVAL_STATUS", header: "Approval Status" },
  { accessorKey: "VERIFIED_STATUS", header: "Verified Status" },
];

function employeeTreeSql(loginId: string) {
  return `
    SELECT DISTINCT *
    FROM (
      SELECT *
      FROM VW_HR_EMPLOYEE_AWARE
      WHERE EMP_STATUS <> 'S'
      START WITH
        EMPLOYEE_ID = '${escapeSql(loginId)}'
        OR SUPERVISOR_EMPID = '${escapeSql(loginId)}'
        OR DEPT_HEAD_EMPID = '${escapeSql(loginId)}'
        OR MANGR_EMPID = '${escapeSql(loginId)}'
      CONNECT BY NOCYCLE PRIOR EMPLOYEE_ID = SUPERVISOR_EMPID
        OR PRIOR EMPLOYEE_ID = DEPT_HEAD_EMPID
        OR PRIOR EMPLOYEE_ID = MANGR_EMPID
    )
  `;
}

function leaveBalanceSql(employeeId: string) {
  return `
    SELECT EMPLOYEE_ID, LEAVE_TYPE, LEAVE_TYPE_DESC,
      NVL(NO_OF_LEAVES_AVAILABLE, 0) AS NO_OF_LEAVES_AVAILABLE
    FROM VW_HR_LEAVE_YEARLY_BAL_SYSDATE_AWARE
    WHERE EMPLOYEE_ID = '${escapeSql(employeeId)}'
      AND LEAVE_TYPE NOT IN ('001', '008', 'ABS')
  `;
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}
