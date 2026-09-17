import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { executeHrRawSql, getHrEmployees, getHrLeaveHistory, type HrEmployee } from "../../../api/hr";
import { Badge } from "../../../components/ui/Badge";
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
  const [activeFilterPill, setActiveFilterPill] = useState("ALL");

  useEffect(() => {
    if (!loginId) return;
    setLoading(true);
    getHrEmployees(loginId)
      .then((rows) => {
        const fallbackSelf = { EMPLOYEE_ID: loginId, EMPLOYEE_CODE: loginId, RPT_NAME: String(user?.username || user?.USERNAME || loginId) } as HrEmployee;
        const safeRows = rows.length ? rows : [fallbackSelf];
        const mergedRows = safeRows.some((row) => String(row.EMPLOYEE_ID || row.EMPLOYEE_CODE || "") === loginId)
          ? safeRows
          : [fallbackSelf, ...safeRows];
        setEmployees(mergedRows);
        const self = mergedRows.find((row) => String(row.EMPLOYEE_ID || row.EMPLOYEE_CODE || "") === loginId) || mergedRows[0];
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

  // Quick filter pills based on history leave types
  const quickPills = useMemo(() => {
    const countsMap: Record<string, number> = {};
    history.forEach((row) => {
      const type = String(row.LEAVE_TYPE_DESC || row.LEAVE_TYPE || "Other");
      countsMap[type] = (countsMap[type] || 0) + 1;
    });

    const list = Object.entries(countsMap).map(([label, count]) => ({
      key: label,
      label,
      count,
    }));

    return [{ key: "ALL", label: "All", count: history.length }, ...list];
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (activeFilterPill === "ALL") return history;
    return history.filter((row) => {
      const type = String(row.LEAVE_TYPE_DESC || row.LEAVE_TYPE || "Other");
      return type === activeFilterPill;
    });
  }, [history, activeFilterPill]);

  const historyColumns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "LEAVE_REQUEST_DATE",
        header: "REQUEST DATE",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.LEAVE_REQUEST_DATE)}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_TYPE_DESC",
        header: "LEAVE TYPE",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[11.5px] font-medium text-foreground">
            {String(row.original.LEAVE_TYPE_DESC || row.original.LEAVE_TYPE || "-")}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_START_DATE",
        header: "START DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.LEAVE_START_DATE)}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_END_DATE",
        header: "END DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.LEAVE_END_DATE)}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_DAYS",
        header: "DAYS",
        size: 70,
        cell: ({ row }) => (
          <span className="text-[11.5px] font-semibold text-foreground">
            {String(row.original.LEAVE_DAYS || "-")}
          </span>
        ),
      },
      {
        accessorKey: "DUTY_RESUME_DATE",
        header: "RESUME DATE",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.DUTY_RESUME_DATE)}
          </span>
        ),
      },
      {
        accessorKey: "APPROVAL_STATUS",
        header: "APPROVAL STATUS",
        size: 130,
        cell: ({ row }) => {
          const status = String(row.original.APPROVAL_STATUS || "-");
          return <span className={registerStatusBadge(status)}>{status}</span>;
        },
      },
      {
        accessorKey: "VERIFIED_STATUS",
        header: "VERIFIED STATUS",
        size: 130,
        cell: ({ row }) => {
          const status = String(row.original.VERIFIED_STATUS || "-");
          return <span className={registerStatusBadge(status)}>{status}</span>;
        },
      },
    ],
    []
  );

  return (
    <section className="leave-register-freight-view grid gap-2">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Leave Register
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && (
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {notice.message}
            </span>
          )}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Modern Filter Card */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm grid gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            <span>Employee</span>
            <Select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={loading}
              className="rounded-xl"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={String(employee.EMPLOYEE_ID || "")} value={String(employee.EMPLOYEE_ID || "")}>
                  {String(employee.EMPLOYEE_ID || "")} - {String(employee.RPT_NAME || employee.EMPLOYEE_NAME || "")}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            <span>Leave Type</span>
            <Select
              value={leaveType}
              onChange={(event) => setLeaveType(event.target.value)}
              disabled={!employeeId}
              className="rounded-xl"
            >
              <option value="ALL">All Leave Types</option>
              {leaveTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            <span>From Date</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded-xl text-xs h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            <span>To Date</span>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded-xl text-xs h-9"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRegister()}
              disabled={loading || !employeeId}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Search size={13} /> View History
            </button>
            <button
              type="button"
              onClick={() => {
                setLeaveType("ALL");
                setFromDate("");
                setToDate("");
                setActiveFilterPill("ALL");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary text-xs font-medium cursor-pointer transition-all shadow-sm"
              title="Clear filters"
            >
              <X size={13} /> Clear
            </button>
          </div>
          {selectedEmployee && (
            <Badge variant="outline" className="gap-1.5 rounded-xl py-1 px-2.5 text-xs">
              <UserRound size={12} className="text-primary" />
              <span>{String(selectedEmployee.RPT_NAME || selectedEmployee.EMPLOYEE_NAME || employeeId)}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Leave Balances Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {balances.length ? (
          balances.map((row) => (
            <Card
              key={`${String(row.LEAVE_TYPE)}-${String(row.EMPLOYEE_ID)}`}
              className="border border-border/80 shadow-sm rounded-xl overflow-hidden bg-card"
            >
              <CardContent className="p-2.5">
                <p className="m-0 text-[11px] font-semibold uppercase text-muted-foreground truncate" title={String(row.LEAVE_TYPE_DESC || row.LEAVE_TYPE || "Leave")}>
                  {String(row.LEAVE_TYPE_DESC || row.LEAVE_TYPE || "Leave")}
                </p>
                <p className="m-0 text-lg font-bold text-foreground mt-0.5">
                  {formatNumber(row.NO_OF_LEAVES_AVAILABLE)}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border border-border/80 shadow-sm rounded-xl col-span-full">
            <CardContent className="flex items-center gap-2 p-2.5 text-xs text-muted-foreground">
              <CalendarDays size={14} /> No leave balance records found.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Freight-style Filter Pill Tabs (if history has records) */}
      {quickPills.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {quickPills.map((pill) => {
            const active = activeFilterPill === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setActiveFilterPill(pill.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-[#00378C] text-white shadow-sm font-semibold"
                    : "border border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main DataTable */}
      <DataTable
        columns={historyColumns}
        data={filteredHistory}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search leave history..."
        loading={loading}
        emptyText="No leave history found"
        density="grid"
        height="calc(100dvh - 300px)"
        minWidth={980}
        enablePagination
        enableExport
        exportFilename="leave_register.csv"
        pageSize={25}
      />
    </section>
  );
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
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
}

function formatNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}

function registerStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("approv") || s.includes("yes") || s === "y") {
    return "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-emerald-700";
  }
  if (s.includes("reject") || s.includes("no") || s === "n") {
    return "inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-red-700";
  }
  return "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700";
}

