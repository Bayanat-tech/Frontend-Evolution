// VacationSettlementPage.tsx
//
// Freight-style refactor (same treatment as the salary increment pages):
//  • freight-transaction-header with title, mode badge, selected count and the
//    Reset / Settlement Process / Reverse Settlement / Process JV actions
//  • Collapsible Freight "Filters" panel using Field + LookupField
//  • useToast for all feedback (no NoticeToast banner)
//  • Data logic (react-query, skip-hydrate guard, client-side employee filter) unchanged

import {
  CalendarCheck, CheckCircle2, ChevronDown, Filter, Loader2, Receipt, RotateCcw, Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Field } from "../../components/ui/Formblocks";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { ColumnDef } from "@tanstack/react-table";
import vacationSettlementServiceInstance from "./Upsertvacationsettlement";

// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string; div_name: string };
type DeptOption     = { dept_code: string; dept_name: string };
type SectionOption  = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string; employee_name: string };

type SettledMode = "N" | "S";
type ActionType  = "PROCESS" | "REVERSE" | "JV";

// Mirrors dw_emp_list_annual_lve (PB screenshot) / VW_HR_EMP_ANNUAL_LEAVE_SEARCH.
// company_name / div_name / dept_name / section_name added per the PB grid
// design (Design - dw_emp_list_annual_lve screenshot) — these already exist
// on VW_HR_EMP_ANNUAL_LEAVE_SEARCH, just weren't selected before.
type LeaveSettlementRow = {
  _rowId:           string;
  selected:         boolean;
  employee_id:      string;
  employee_code:    string;
  rpt_name:         string;
  hdr_lve_slno:     string;
  lve_doc_no:       string;
  approval_status:  string;
  leave_start_date: string;
  leave_end_date:   string;
  leave_days:       string;
  company_name:     string;
  div_name:         string;
  dept_name:        string;
  section_name:     string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Same signature as HrEmpLanguagePage's buildParams (P_CODE1..P_CODE4 only —
// the proc has no code5 slot). Employee is therefore NOT sent to the
// procedure as its own bind param; it's applied as a client-side filter on
// the rows already scoped by company/div/dept/section (see leaveQuery below).
function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = "",
) {
  return {
    parameter,
    loginid,
    code1:   companyCode,
    code2,
    code3,
    code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

function rowId(employeeId: string, slno: string) {
  return `${employeeId}_${slno}`;
}

// ── UI building block: collapsible Freight panel ─────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={open ? "Collapse section" : "Expand section"}
        className={`freight-panel-title flex w-full cursor-pointer items-center justify-between gap-2 bg-muted/35 px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
          open ? "border-b" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div className={`freight-panel-body p-3 ${open ? "" : "hidden"}`}>{children}</div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function VacationSettlementPage() {
  const { user }    = useAuth();
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const loginid     = user?.loginid      ?? "";
  const companyCode = user?.company_code ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [division,   setDivision]   = useState<DivisionOption | null>(null);
  const [department, setDepartment] = useState<DeptOption     | null>(null);
  const [section,    setSection]    = useState<SectionOption  | null>(null);
  const [employee,   setEmployee]   = useState<EmployeeOption | null>(null);
  const [settledMode, setSettledMode] = useState<SettledMode>("N");

  const [resetKey, setResetKey] = useState(0);

  // ── Grid state ─────────────────────────────────────────────────────────────
  const [rows,   setRows]   = useState<LeaveSettlementRow[]>([]);
  const [search, setSearch] = useState("");

  // Guards against a stale invalidated fetch clobbering rows we've already
  // cleared locally after a successful Settlement/Reverse/JV action —
  // same pattern as skipHydrateForEmployeeRef in HrEmpLanguagePage, keyed
  // on the filter tuple instead of a single employee id.
  const skipHydrateForKeyRef = useRef<string | null>(null);

  const filterKey = `${division?.div_code ?? ""}|${department?.dept_code ?? ""}|${section?.section_code ?? ""}|${settledMode}`;

  const filtersComplete = !!division?.div_code && !!department?.dept_code && !!section?.section_code;

  // ── Cascading resets ─────────────────────────────────────────────────────────
  const onDivisionChange = useCallback((row: Record<string, unknown> | null) => {
    setDivision(row ? { div_code: String(row.div_code ?? ""), div_name: String(row.div_name ?? "") } : null);
    setDepartment(null);
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, []);

  const onDepartmentChange = useCallback((row: Record<string, unknown> | null) => {
    setDepartment(row ? { dept_code: String(row.dept_code ?? ""), dept_name: String(row.dept_name ?? "") } : null);
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, []);

  const onSectionChange = useCallback((row: Record<string, unknown> | null) => {
    setSection(
      row ? { section_code: String(row.section_code ?? ""), section_name: String(row.section_name ?? "") } : null,
    );
    setEmployee(null);
    setRows([]);
  }, []);

  const onEmployeeChange = useCallback((row: Record<string, unknown> | null) => {
    setEmployee(
      row
        ? {
            employee_id:   String(row.employee_id ?? ""),
            employee_name: String(row.employee_name ?? row.rpt_name ?? ""),
          }
        : null,
    );
  }, []);

  // ── Lookup loaders — identical parameters/order to HrEmpLanguagePage ───────
  const loadDivisions = useCallback(
    () => getDynamicLookup(buildParams("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST", loginid, companyCode)),
    [loginid, companyCode],
  );

  const loadDepartments = useCallback(
    () =>
      getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE", loginid, companyCode, division?.div_code ?? ""),
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

  // ── Leave list — one procedure parameter per settled mode, matching this
  // codebase's convention (one PARAMETER per distinct query) rather than a
  // boolean flag threaded through a shared parameter. ──────────────────────
  const leaveListParam =
    settledMode === "N"
      ? "EDUCATION_QUALIFICATION_VACATION_SETTLEMENT_NON_SETTLED_LEAVE_LIST_SELECT"
      : "EDUCATION_QUALIFICATION_VACATION_SETTLEMENT_SETTLED_LEAVE_LIST_SELECT";

  const leaveQuery = useQuery({
    queryKey: [
      "vacation-settlement-leave-list",
      companyCode,
      division?.div_code,
      department?.dept_code,
      section?.section_code,
      settledMode,
    ],
    enabled: filtersComplete,
    refetchOnMount: "always",
    queryFn: async () => {
      const currentKey = filterKey;
      const res = await getDynamicLookup(
        buildParams(
          leaveListParam,
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
          section?.section_code ?? "",
        ),
      );
      const data: LeaveSettlementRow[] = (Array.isArray(res) ? res : []).map(
        (r: Record<string, unknown>) => ({
          _rowId:           rowId(String(r.employee_id ?? ""), String(r.hdr_lve_slno ?? "")),
          selected:         false,
          employee_id:      String(r.employee_id ?? ""),
          employee_code:    String(r.employee_code ?? r.employee_id ?? ""),
          rpt_name:         String(r.rpt_name ?? ""),
          hdr_lve_slno:     String(r.hdr_lve_slno ?? ""),
          lve_doc_no:       String(r.lve_doc_no ?? ""),
          approval_status:  String(r.approval_status ?? ""),
          leave_start_date: String(r.leave_start_date ?? ""),
          leave_end_date:   String(r.leave_end_date ?? ""),
          leave_days:       String(r.leave_days ?? ""),
          company_name:     String(r.company_name ?? ""),
          div_name:         String(r.div_name ?? ""),
          dept_name:        String(r.dept_name ?? ""),
          section_name:     String(r.section_name ?? ""),
        }),
      );

      if (skipHydrateForKeyRef.current !== null && skipHydrateForKeyRef.current === currentKey) {
        skipHydrateForKeyRef.current = null;
      } else {
        setRows(data);
      }
      return data;
    },
  });

  // Employee is an optional narrower on top of the mandatory div/dept/section
  // triplet — applied client-side so the proc signature stays at 4 codes.
  const visibleRows = useMemo(
    () => (employee?.employee_id ? rows.filter((r) => r.employee_id === employee.employee_id) : rows),
    [rows, employee?.employee_id],
  );

  // ── Row selection ────────────────────────────────────────────────────────────
  const toggleRow = useCallback((rowIdVal: string) => {
    setRows((prev) => prev.map((r) => (r._rowId === rowIdVal ? { ...r, selected: !r.selected } : r)));
  }, []);

  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => r.selected);
  const toggleAll = useCallback(() => {
    const idsInView = new Set(visibleRows.map((r) => r._rowId));
    setRows((prev) =>
      prev.map((r) => (idsInView.has(r._rowId) ? { ...r, selected: !allSelected } : r)),
    );
  }, [visibleRows, allSelected]);

  const selectedRows = useMemo(() => visibleRows.filter((r) => r.selected), [visibleRows]);

  // ── Columns ── matches Design - dw_emp_list_annual_lve column order:
  // Employee Code, Name, Leave SlNo, Leave Doc No, Leave Status,
  // Leave Start Date, Leave End Date, Leave Days, Company, Div Name,
  // Dept Name, Section Name ────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<LeaveSettlementRow>[]>(
    () => [
      {
        id:     "select",
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            style={{ accentColor: "#00378C", width: "15px", height: "15px" }}
            className="cursor-pointer"
          />
        ),
        size:   40,
        enableSorting: false,
        enableColumnFilter: false,
        cell:   ({ row }) => (
          <input
            type="checkbox"
            checked={row.original.selected}
            onChange={() => toggleRow(row.original._rowId)}
            style={{ accentColor: "#00378C", width: "15px", height: "15px" }}
            className="cursor-pointer"
          />
        ),
      },
      { accessorKey: "employee_code",    header: "Employee Code",    size: 140, enableSorting: false },
      { accessorKey: "rpt_name",         header: "Name",             size: 220, enableSorting: false },
      { accessorKey: "hdr_lve_slno",     header: "Leave SlNo",       size: 110, enableSorting: false },
      { accessorKey: "lve_doc_no",       header: "Leave Doc No",     size: 140, enableSorting: false },
      { accessorKey: "approval_status",  header: "Leave Status",     size: 130, enableSorting: false },
      { accessorKey: "leave_start_date", header: "Leave Start Date", size: 150, enableSorting: false },
      { accessorKey: "leave_end_date",   header: "Leave End Date",   size: 150, enableSorting: false },
      { accessorKey: "leave_days",       header: "Leave Days",       size: 110, enableSorting: false },
      { accessorKey: "company_name",     header: "Company",          size: 180, enableSorting: false },
      { accessorKey: "div_name",         header: "Div Name",         size: 160, enableSorting: false },
      { accessorKey: "dept_name",        header: "Dept Name",        size: 160, enableSorting: false },
      { accessorKey: "section_name",     header: "Section Name",     size: 160, enableSorting: false },
    ],
    [allSelected, toggleAll, toggleRow],
  );

  // ── Actions: Settlement Process / Reverse Settlement / Process JV ──────────
  const settlementMutation = useMutation({
    mutationFn: async (action: ActionType) => {
      if (selectedRows.length === 0) throw new Error("Select at least one record");

      const settlement_details = selectedRows.map((r) => ({
        employee_id:  r.employee_id,
        hdr_lve_slno: r.hdr_lve_slno,
        lve_doc_no:   r.lve_doc_no,
        company_code: companyCode,
        user_id:      loginid,
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
      toast.success(`${label} completed successfully`);

      // Drop the just-processed rows from the local grid immediately so the
      // user sees the result without waiting on the refetch, then skip the
      // very next hydrate for this filter tuple (mirrors HrEmpLanguagePage's
      // skipHydrateForEmployeeRef around its own onSuccess).
      const processedIds = new Set(selectedRows.map((r) => r._rowId));
      setRows((prev) => prev.filter((r) => !processedIds.has(r._rowId)));

      skipHydrateForKeyRef.current = filterKey;
      queryClient.invalidateQueries({ queryKey: ["vacation-settlement-leave-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Action failed");
    },
  });

  const isBusy = settlementMutation.isPending || leaveQuery.isFetching;
  const pendingAction = settlementMutation.isPending ? settlementMutation.variables : undefined;

  // Header Reset — clears every filter and the grid (previously labelled "Refresh")
  const handleReset = () => {
    setDivision(null);
    setDepartment(null);
    setSection(null);
    setEmployee(null);
    setRows([]);
    setSearch("");
    setResetKey((k) => k + 1);

    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === "vacation-settlement-leave-list",
    });
    skipHydrateForKeyRef.current = null;
  };

  const changeMode = (mode: SettledMode) => {
    if (mode === settledMode) return;
    setSettledMode(mode);
    setRows([]);
  };

  const actionIcon = (action: ActionType, Icon: LucideIcon) =>
    pendingAction === action ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarCheck size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR - Leave Vacation Settlement
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {settledMode === "N" ? "Non Settled" : "Settled"}
              </span>
              <span className="text-xs text-muted-foreground">
                {visibleRows.length.toLocaleString()} Record{visibleRows.length === 1 ? "" : "s"}
                {selectedRows.length > 0 ? ` · ${selectedRows.length} selected` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={settlementMutation.isPending}>
            <RotateCcw size={14} /> Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isBusy || settledMode !== "N" || selectedRows.length === 0}
            onClick={() => settlementMutation.mutate("PROCESS")}
          >
            {actionIcon("PROCESS", CheckCircle2)} Settlement Process
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || settledMode !== "S" || selectedRows.length === 0}
            onClick={() => settlementMutation.mutate("REVERSE")}
          >
            {actionIcon("REVERSE", Undo2)} Reverse Settlement
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || selectedRows.length === 0}
            onClick={() => settlementMutation.mutate("JV")}
          >
            {actionIcon("JV", Receipt)} Process JV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <CollapsibleSection title="Filters" icon={Filter}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Division" required>
            <LookupField
              key={`division-${resetKey}`}
              compact
              dense
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
              placeholder="Select division"
            />
          </Field>

          <Field label="Department" required>
            <LookupField
              key={`department-${resetKey}-${division?.div_code ?? ""}`}
              compact
              dense
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
              placeholder="Select department"
            />
          </Field>

          <Field label="Section" required>
            <LookupField
              key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
              compact
              dense
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
              placeholder="Select section"
            />
          </Field>

          {/* Emp Code — optional, matches the PB screen's non-mandatory field */}
          <Field label="Emp Code">
            <LookupField
              key={`employee-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}-${section?.section_code ?? ""}`}
              compact
              dense
              label="Emp Code"
              value={employee?.employee_id ?? ""}
              displayValue={employee ? `${employee.employee_id} - ${employee.employee_name}` : ""}
              columns={[
                { field: "employee_id",   header: "Code"     },
                { field: "employee_name", header: "Employee" },
              ]}
              valueField="employee_id"
              displayFields={["employee_id", "employee_name"]}
              loadOptions={loadEmployees}
              onChange={(_, row) => onEmployeeChange(row)}
              placeholder="All employees"
            />
          </Field>

          {/* Settled / Non Settled toggle */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Settlement Status</span>
            <div className="flex h-8 items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] font-medium text-slate-700">
                <input
                  type="radio"
                  name="settledMode"
                  checked={settledMode === "N"}
                  onChange={() => changeMode("N")}
                  style={{ accentColor: "#00378C" }}
                />
                Non Settled
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] font-medium text-slate-700">
                <input
                  type="radio"
                  name="settledMode"
                  checked={settledMode === "S"}
                  onChange={() => changeMode("S")}
                  style={{ accentColor: "#00378C" }}
                />
                Settled
              </label>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Leave grid */}
      <DataTable
        columns={columns}
        data={visibleRows}
        title={`${visibleRows.length.toLocaleString()} Record${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle={settledMode === "N" ? "Non Settled Leave Records" : "Settled Leave Records"}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employee, name..."
        loading={leaveQuery.isFetching}
        emptyText={
          filtersComplete
            ? "No leave records found"
            : "Select Division, Department and Section to load leave records"
        }
        height={420}
        minWidth={1800}
        density="grid"
        enablePagination={false}
        getRowId={(row) => row._rowId}
      />
    </section>
  );
}