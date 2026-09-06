import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { ColumnDef } from "@tanstack/react-table";
import vacationSettlementServiceInstance from "./Upsertvacationsettlement";


// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string; div_name: string };
type DeptOption = { dept_code: string; dept_name: string };
type SectionOption = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string; employee_name: string; };

type SettledMode = "N" | "S";

// Mirrors columns of dw_emp_list_annual_lve (Image 2) / VW_HR_EMP_ANNUAL_LEAVE_SEARCH
type LeaveSettlementRow = {
    _rowId: string;
    selected: boolean;
    employee_id: string;
    rpt_name: string;
    hdr_lve_slno: string;
    lve_doc_no: string;
    approval_status: string;
    leave_start_date: string;
    leave_end_date: string;
    leave_days: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Same shape as HrEmpDependantsPage's buildParams, extended with code5 to carry
// the Employee filter (the underlying view/proc takes company, div, dept,
// section AND employee — see VW_HR_EMP_ANNUAL_LEAVE_SEARCH's 5 bind params).
// If the lookup endpoint only accepts code1-4, drop code5 and fold employee
// filtering into a dedicated parameter/proc instead.
function buildParams(
    parameter: string,
    loginid: string,
    companyCode: string,
    code2 = "",
    code3 = "",
    code4 = "",
    code5 = "",
) {
    return {
        parameter,
        loginid,
        code1: companyCode,
        code2,
        code3,
        code4,
        code5,
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
    };
}

function rowId(employeeId: string, slno: string) {
    return `${employeeId}_${slno}`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function VacationSettlementPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const loginid = user?.loginid ?? "";
    const companyCode = user?.company_code ?? "";

    // ── Filter state ───────────────────────────────────────────────────────────
    const [division, setDivision] = useState<DivisionOption | null>(null);
    const [department, setDepartment] = useState<DeptOption | null>(null);
    const [section, setSection] = useState<SectionOption | null>(null);
    const [employee, setEmployee] = useState<EmployeeOption | null>(null);
    const [settledMode, setSettledMode] = useState<SettledMode>("N");

    // ── Grid / notice state ────────────────────────────────────────────────────
    const [rows, setRows] = useState<LeaveSettlementRow[]>([]);
    const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // ── Lookup loaders (identical params to HrEmpDependantsPage) ────────────────
    const loadDivisions = useCallback(
        () =>
            getDynamicLookup(
                buildParams("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST", loginid, companyCode),
            ),
        [loginid, companyCode],
    );

    const loadDepartments = useCallback(
        () =>
            getDynamicLookup(
                buildParams(
                    "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
                    loginid,
                    companyCode,
                    division?.div_code ?? "",
                ),
            ),
        [loginid, companyCode, division?.div_code],
    );

    const loadSections = useCallback(
        () =>
            getDynamicLookup(
                buildParams(
                    "EDUCATION_QUALIFICATION_MS_HR_SECTION",
                    loginid,
                    companyCode,
                    division?.div_code ?? "",
                    department?.dept_code ?? "",
                ),
            ),
        [loginid, companyCode, division?.div_code, department?.dept_code],
    );

    const loadEmployees = useCallback(
        () =>
            getDynamicLookup(
                buildParams(
                    "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
                    loginid,
                    companyCode,
                    division?.div_code ?? "",
                    department?.dept_code ?? "",
                    section?.section_code ?? "",
                ),
            ),
        [loginid, companyCode, division?.div_code, department?.dept_code, section?.section_code],
    );

    // ── Cascading resets (same pattern as dependants page) ──────────────────────
    const onDivisionChange = (row: Record<string, unknown> | null) => {
        setDivision(
            row ? { div_code: String(row.div_code ?? ""), div_name: String(row.div_name ?? "") } : null,
        );
        setDepartment(null);
        setSection(null);
        setEmployee(null);
        setRows([]);
    };

    const onDepartmentChange = (row: Record<string, unknown> | null) => {
        setDepartment(
            row ? { dept_code: String(row.dept_code ?? ""), dept_name: String(row.dept_name ?? "") } : null,
        );
        setSection(null);
        setEmployee(null);
        setRows([]);
    };

    const onSectionChange = (row: Record<string, unknown> | null) => {
        setSection(
            row
                ? { section_code: String(row.section_code ?? ""), section_name: String(row.section_name ?? "") }
                : null,
        );
        setEmployee(null);
        setRows([]);
    };

    const onEmployeeChange = (row: Record<string, unknown> | null) => {
        setEmployee(
            row
                ? {
                    employee_id: String(row.employee_id ?? ""),
                    employee_name: String(row.employee_name ?? row.rpt_name ?? ""),
                }
                : null,
        );
        setRows([]);
    };

    // ── Leave list for the selected Division/Department/Section (+ optional Employee) ──
    // Two distinct lookup parameters (Non Settled vs Settled) rather than a flag,
    // matching this codebase's convention of one PARAMETER per query.
    const leaveListParam =
        settledMode === "N"
            ? "HR_VACATION_SETTLEMENT_NON_SETTLED_LEAVE_LIST_SELECT"
            : "HR_VACATION_SETTLEMENT_SETTLED_LEAVE_LIST_SELECT";

    const leaveQuery = useQuery({
        queryKey: [
            "vacation-settlement-leave-list",
            companyCode,
            division?.div_code,
            department?.dept_code,
            section?.section_code,
            employee?.employee_id,
            settledMode,
        ],
        enabled: !!division?.div_code && !!department?.dept_code && !!section?.section_code,
        refetchOnMount: "always",
        queryFn: async () => {
            const res = await getDynamicLookup(
                buildParams(
                    leaveListParam,
                    loginid,
                    companyCode,
                    division?.div_code ?? "All",
                    department?.dept_code ?? "All",
                    section?.section_code ?? "All",
                    employee?.employee_id ?? "All",
                ),
            );
            const data: LeaveSettlementRow[] = (Array.isArray(res) ? res : []).map(
                (r: Record<string, unknown>) => ({
                    _rowId: rowId(String(r.employee_id ?? ""), String(r.hdr_lve_slno ?? "")),
                    selected: false,
                    employee_id: String(r.employee_id ?? ""),
                    employee_code: String(r.employee_code ?? ""),
                    rpt_name: String(r.rpt_name ?? ""),
                    hdr_lve_slno: String(r.hdr_lve_slno ?? ""),
                    lve_doc_no: String(r.lve_doc_no ?? ""),
                    approval_status: String(r.approval_status ?? ""),
                    leave_start_date: String(r.leave_start_date ?? ""),
                    leave_end_date: String(r.leave_end_date ?? ""),
                    leave_days: String(r.leave_days ?? ""),
                }),
            );
            setRows(data);
            return data;
        },
    });

    // ── Row selection ────────────────────────────────────────────────────────────
    const toggleRow = useCallback((rowIdVal: string) => {
        setRows((prev) =>
            prev.map((r) => (r._rowId === rowIdVal ? { ...r, selected: !r.selected } : r)),
        );
    }, []);

    const allSelected = rows.length > 0 && rows.every((r) => r.selected);
    const toggleAll = useCallback(() => {
        setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
    }, [allSelected]);

    const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns = useMemo<ColumnDef<LeaveSettlementRow>[]>(
        () => [
            {
                id: "select",
                header: () => (
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                ),
                size: 40,
                cell: ({ row }) => (
                    <input
                        type="checkbox"
                        checked={row.original.selected}
                        onChange={() => toggleRow(row.original._rowId)}
                    />
                ),
            },
            {
                accessorKey: "employee_code",
                header: "Employee Code",
                size: 140,
                cell: ({ row }) => row.original.employee_id,
            },
            {
                accessorKey: "rpt_name",
                header: "Name",
                size: 260,
                cell: ({ row }) => row.original.rpt_name,
            },
            {
                accessorKey: "hdr_lve_slno",
                header: "Leave SlNo",
                size: 110,
                cell: ({ row }) => row.original.hdr_lve_slno,
            },
            {
                accessorKey: "lve_doc_no",
                header: "Leave Doc No",
                size: 140,
                cell: ({ row }) => row.original.lve_doc_no,
            },
            {
                accessorKey: "approval_status",
                header: "Leave Status",
                size: 130,
                cell: ({ row }) => row.original.approval_status,
            },
            {
                accessorKey: "leave_start_date",
                header: "Leave Start Date",
                size: 150,
                cell: ({ row }) => row.original.leave_start_date,
            },
            {
                accessorKey: "leave_end_date",
                header: "Leave End Date",
                size: 150,
                cell: ({ row }) => row.original.leave_end_date,
            },
            {
                accessorKey: "leave_days",
                header: "Leave Days",
                size: 110,
                cell: ({ row }) => row.original.leave_days,
            },
        ],
        [allSelected, toggleAll, toggleRow],
    );

    // ── Actions: Settlement Process / Reverse Settlement / Process JV ──────────
    const settlementMutation = useMutation({
        mutationFn: async (action: "PROCESS" | "REVERSE" | "JV") => {
            if (selectedRows.length === 0) throw new Error("Select at least one record");

            const settlement_details = selectedRows.map((r) => ({
                employee_id: r.employee_id,
                hdr_lve_slno: r.hdr_lve_slno,
                lve_doc_no: r.lve_doc_no,
                company_code: companyCode,
                user_id: loginid,
            }));

            const success = await vacationSettlementServiceInstance.upsertVacationSettlementApi({
                company_code: companyCode,
                loginid,
                action,
                settlement_details,
            });

            if (!success) throw new Error("Action failed. Please try again.");
            return action;
        },
        onSuccess: (action) => {
            const label =
                action === "PROCESS" ? "Settlement" : action === "REVERSE" ? "Reverse settlement" : "Process JV";
            setNotice({ type: "success", message: `${label} completed successfully.` });
            queryClient.invalidateQueries({ queryKey: ["vacation-settlement-leave-list"] });
        },
        onError: (err: Error) => {
            setNotice({ type: "error", message: err.message ?? "Action failed." });
        },
    });

    const isBusy = settlementMutation.isPending || leaveQuery.isFetching;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <section className="grid gap-4">

            {/* ── Page Header ──────────────────────────────────────────────────── */}
            <div>
                <h1 className="m-0 text-2xl font-semibold text-foreground">
                    HR - Leave Vacation Settlement
                </h1>
            </div>

            <NoticeToast notice={notice} onClose={() => setNotice(null)} />

            {/* ── Filter Bar ───────────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <div>
                        <p className="eyebrow">Filters</p>
                        <h2 className="m-0 text-sm font-semibold">Select Employee(s)</h2>
                    </div>
                </CardHeader>

                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                    {/* Division */}
                    <label className="field">
                        <span>
                            Division: <strong className="text-destructive">*</strong>
                        </span>
                        <LookupField
                            compact
                            label="Division"
                            value={division?.div_code ?? ""}
                            displayValue={division ? `${division.div_code} - ${division.div_name}` : ""}
                            columns={[
                                { field: "div_code", header: "Code" },
                                { field: "div_name", header: "Division" },
                            ]}
                            valueField="div_code"
                            displayFields={["div_code", "div_name"]}
                            loadOptions={loadDivisions}
                            onChange={(_, row) => onDivisionChange(row)}
                        />
                    </label>

                    {/* Department */}
                    <label className="field">
                        <span>
                            Department: <strong className="text-destructive">*</strong>
                        </span>
                        <LookupField
                            key={`department-${division?.div_code ?? ""}`}
                            compact
                            label="Department"
                            value={department?.dept_code ?? ""}
                            displayValue={department ? `${department.dept_code} - ${department.dept_name}` : ""}
                            columns={[
                                { field: "dept_code", header: "Code" },
                                { field: "dept_name", header: "Department" },
                            ]}
                            valueField="dept_code"
                            displayFields={["dept_code", "dept_name"]}
                            loadOptions={loadDepartments}
                            onChange={(_, row) => onDepartmentChange(row)}
                        />
                    </label>

                    {/* Section */}
                    <label className="field">
                        <span>
                            Section: <strong className="text-destructive">*</strong>
                        </span>
                        <LookupField
                            key={`section-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
                            compact
                            label="Section"
                            value={section?.section_code ?? ""}
                            displayValue={section ? `${section.section_code} - ${section.section_name}` : ""}
                            columns={[
                                { field: "section_code", header: "Code" },
                                { field: "section_name", header: "Section" },
                            ]}
                            valueField="section_code"
                            displayFields={["section_code", "section_name"]}
                            loadOptions={loadSections}
                            onChange={(_, row) => onSectionChange(row)}
                        />
                    </label>

                    {/* Emp Code (optional — matches SQL's 'All' fallback) */}
                    <label className="field">
                        <span>Emp Code:</span>
                        <LookupField
                            key={`employee-${division?.div_code ?? ""}-${department?.dept_code ?? ""}-${section?.section_code ?? ""}`}
                            compact
                            label="Emp Code"
                            value={employee?.employee_id ?? ""}
                            displayValue={employee ? `${employee.employee_id} - ${employee.employee_name}` : ""}
                            columns={[
                                { field: "employee_id", header: "Code" },
                                { field: "employee_name", header: "Employee" },
                            ]}
                            valueField="employee_id"
                            displayFields={["employee_id", "employee_name"]}
                            loadOptions={loadEmployees}
                            onChange={(_, row) => onEmployeeChange(row)}
                        />
                    </label>
                </CardContent>
            </Card>

            {/* ── Mode toggle + actions ────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-sm">
                        <input
                            type="radio"
                            name="settledMode"
                            checked={settledMode === "N"}
                            onChange={() => setSettledMode("N")}
                        />
                        Non Settled
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                        <input
                            type="radio"
                            name="settledMode"
                            checked={settledMode === "S"}
                            onChange={() => setSettledMode("S")}
                        />
                        Settled
                    </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        disabled={isBusy || settledMode !== "N" || selectedRows.length === 0}
                        onClick={() => settlementMutation.mutate("PROCESS")}
                    >
                        Settlement Process
                    </Button>
                    <Button
                        variant="outline"
                        disabled={isBusy || settledMode !== "S" || selectedRows.length === 0}
                        onClick={() => settlementMutation.mutate("REVERSE")}
                    >
                        Reverse Settlement
                    </Button>
                    <Button
                        variant="outline"
                        disabled={isBusy || selectedRows.length === 0}
                        onClick={() => settlementMutation.mutate("JV")}
                    >
                        Process JV
                    </Button>
                </div>
            </div>

            {/* ── Leave Grid ───────────────────────────────────────────────────── */}
            <DataTable
                columns={columns}
                data={rows}
                title={`${rows.length} Record${rows.length !== 1 ? "s" : ""}`}
                subtitle={settledMode === "N" ? "Non Settled Leave Records" : "Settled Leave Records"}
                searchPlaceholder="Search employee, name..."
                height={420}
                minWidth={1400}
                density="grid"
                enablePagination={false}
                getRowId={(row) => row._rowId}
            />
        </section>
    );
}