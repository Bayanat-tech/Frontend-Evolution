import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Play, Users, Lock } from "lucide-react";

import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../state/AuthContext";
import { DynamicDropDown } from "../api/DynamicDropDown";
import { DynamicQueryParams, getDynamicLookup } from "../../../api/lookups";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDateForInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function newRowKey(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface PayrollEmployeeRow {
  select_emp?: number | boolean;
  employee_code: string;
  rpt_name: string;
  grade_name: string | null;
  desg_name: string | null;
  div_name: string | null;
  dept_name: string | null;
  section_name: string | null;
  employee_id: string | number;
  desg_code: string | null;
  grade_code: string | null;
  gender: string | null;
  nationality: string | null;
  mobile_no: string | null;
  payment_mode: string | null;
  category_code: string | null;
  category_name: string | null;
  airport_code: string | null;
  company_code: string;
  comp_name: string | null;
  div_code: string | null;
  dept_code: string | null;
  section_code: string | null;
  user_id: string | null;
  user_dt: string | Date | null;
  join_date: string | Date | null;
  div_payroll_date: string | Date | null;
  emp_status: string | null;
  include_in_payroll: string | null;
  processed?: number | boolean;
  sal_processed: number | string | null;
  adv_paid: string | number | null;
  _isNew?: boolean;
  _rowKey?: string;
  /** True when this row's employee came from the header Emp Code filter and
   *  therefore doesn't need to be (re)selected at the row level. */
  _employeeLocked?: boolean;
}

export interface PayrollProcessingSavePayload {
  companyCode: string;
  divCode: string;
  deptCode: string;
  sectionCode: string;
  payDate: string;
  userId: string;
  rows: PayrollEmployeeRow[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

async function fetchPayrollProcessingData(params: {
  companyCode: string;
  divCode: string;
  deptCode: string;
  sectionCode: string;
  payDate: string;
  loginId?: string;
}): Promise<PayrollEmployeeRow[]> {
  const queryParams: DynamicQueryParams = {
    parameter: "MST_HR_PAYROLL_PROCESSING_MAIN_PAGE_DATA",
    loginid: params.loginId || "",
    code1: params.companyCode || "",
    code2: `${params.divCode || ""}|${params.deptCode || ""}`, // div|dept combined
    code3: params.sectionCode || "",
    code4: params.payDate, // date as 'YYYY-MM-DD' text, no P_DATE1 involved
  };

  const rows = await getDynamicLookup(queryParams);
  return (rows ?? []) as [];
}

async function savePayrollProcessing(
  payload: PayrollProcessingSavePayload
): Promise<ApiResponse> {
  // keep your existing save endpoint or adapt as needed
  const { data } = await (await import("axios")).default.post<ApiResponse>(
    "/api/hr/payroll-processing/save",
    payload
  );
  if (!data.success) throw new Error(data.message || "Failed to save");
  return data;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function PayrollProcessingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const companyCode = user?.company_code ?? "";

  // Filters
  const [divCode, setDivCode] = useState("");
  const [divName, setDivName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  // Full employee record from the header dropdown — lets new rows inherit
  // every field (grade, designation, etc.) without a second lookup.
  const [empRow, setEmpRow] = useState<any | null>(null);
  const [payDate, setPayDate] = useState(todayISO());

  // Table state
  const [rows, setRows] = useState<PayrollEmployeeRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<PayrollEmployeeRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const filtersReady = Boolean(companyCode && payDate);
  const hasHeaderEmployee = Boolean(empId && empRow);

  /* ── Auto-load when filters change ─────────────────────────────────────── */
  const loadQuery = useQuery({
    queryKey: [
      "payrollProcessing",
      companyCode,
      divCode || "",
      deptCode || "",
      sectionCode || "",
      payDate,
    ],
    queryFn: () =>
      fetchPayrollProcessingData({
        loginId: user?.loginid ?? "",
        companyCode,
        divCode: divCode || "",
        deptCode: deptCode || "",
        sectionCode: sectionCode || "",
        payDate,
      }),
    enabled: filtersReady,
    staleTime: 0,
  });

  // Sync query result → local editable rows (and optional emp filter)
  useEffect(() => {
    if (!loadQuery.data) return;

    let list = loadQuery.data.map((r, i) => ({
      ...r,
      select_emp: r.select_emp ?? 0,
      processed: r.processed ?? 0,
      _rowKey: `db-${r.employee_id ?? i}-${i}`,
      _isNew: false,
    }));

    if (empId) {
      list = list.filter(
        (r) =>
          String(r.employee_id) === String(empId) ||
          String(r.employee_code) === String(empId)
      );
    }

    setRows(list);
    setHasLoaded(true);
  }, [loadQuery.data, empId]);

  /* ── Save ──────────────────────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: savePayrollProcessing,
    onSuccess: (res) => {
      alert(res.message || "Saved successfully.");
      queryClient.invalidateQueries({ queryKey: ["payrollProcessing"] });
    },
    onError: (err: Error) => {
      alert(err.message || "Save failed.");
    },
  });

  const handleSave = useCallback(() => {
    if (!companyCode || !payDate) {
      alert("Company and Payroll Date are required.");
      return;
    }
    const invalid = rows.filter(
      (r) => r._isNew && !r.employee_id && !r.employee_code
    );
    if (invalid.length) {
      alert("Please select an employee for every newly added row before saving.");
      return;
    }
    saveMutation.mutate({
      companyCode,
      divCode: divCode || "",
      deptCode: deptCode || "",
      sectionCode: sectionCode || "",
      payDate,
      userId: user?.loginid ?? "",
      rows,
    });
  }, [
    companyCode,
    divCode,
    deptCode,
    sectionCode,
    payDate,
    rows,
    user,
    saveMutation,
  ]);

  /* ── Add blank row ─────────────────────────────────────────────────────── */
  const handleAdd = useCallback(() => {
    const base: PayrollEmployeeRow = {
      select_emp: 1,
      employee_code: "",
      rpt_name: "",
      grade_name: null,
      desg_name: null,
      div_name: divName || null,
      dept_name: deptName || null,
      section_name: sectionName || null,
      employee_id: "",
      desg_code: null,
      grade_code: null,
      gender: null,
      nationality: null,
      mobile_no: null,
      payment_mode: null,
      category_code: null,
      category_name: null,
      airport_code: null,
      company_code: companyCode,
      comp_name: null,
      div_code: divCode || null,
      dept_code: deptCode || null,
      section_code: sectionCode || null,
      user_id: user?.loginid ?? null,
      user_dt: new Date(),
      join_date: null,
      div_payroll_date: null,
      emp_status: null,
      include_in_payroll: "Y",
      processed: 0,
      sal_processed: 0,
      adv_paid: "N",
      _isNew: true,
      _rowKey: newRowKey(),
    };

    // If an employee is already selected at the header (Emp Code filter),
    // the new row inherits it directly — no second selection needed.
    const blank: PayrollEmployeeRow = hasHeaderEmployee
      ? {
          ...base,
          employee_id: empRow?.employee_id ?? empRow?.value ?? empId,
          employee_code: empRow?.employee_code ?? "",
          rpt_name: empRow?.rpt_name ?? empName,
          grade_name: empRow?.grade_name ?? null,
          grade_code: empRow?.grade_code ?? null,
          desg_name: empRow?.desg_name ?? null,
          desg_code: empRow?.desg_code ?? null,
          div_code: empRow?.div_code ?? base.div_code,
          div_name: empRow?.div_name ?? base.div_name,
          dept_code: empRow?.dept_code ?? base.dept_code,
          dept_name: empRow?.dept_name ?? base.dept_name,
          section_code: empRow?.section_code ?? base.section_code,
          section_name: empRow?.section_name ?? base.section_name,
          company_code: empRow?.company_code ?? base.company_code,
          join_date: empRow?.join_date ?? null,
          emp_status: empRow?.emp_status ?? null,
          include_in_payroll: empRow?.include_in_payroll ?? "Y",
          gender: empRow?.gender ?? null,
          nationality: empRow?.nationality ?? null,
          mobile_no: empRow?.mobile_no ?? null,
          _employeeLocked: true,
        }
      : base;

    setRows((prev) => [blank, ...prev]);
    setHasLoaded(true);
  }, [
    companyCode,
    divCode,
    divName,
    deptCode,
    deptName,
    sectionCode,
    sectionName,
    user,
    hasHeaderEmployee,
    empRow,
    empId,
    empName,
  ]);

  /* ── Cascade handlers ──────────────────────────────────────────────────── */
  const onDivChange = (value: string, row: any) => {
    setDivCode(value);
    setDivName(row?.div_name ?? row?.name ?? "");
    setDeptCode("");
    setDeptName("");
    setSectionCode("");
    setSectionName("");
    setEmpId("");
    setEmpName("");
    setEmpRow(null);
  };

  const onDeptChange = (value: string, row: any) => {
    setDeptCode(value);
    setDeptName(row?.dept_name ?? row?.name ?? "");
    setSectionCode("");
    setSectionName("");
    setEmpId("");
    setEmpName("");
    setEmpRow(null);
  };

  const onSectionChange = (value: string, row: any) => {
    setSectionCode(value);
    setSectionName(row?.section_name ?? row?.name ?? "");

    // The section lookup only returns div_code/dept_code, not their names.
    // Auto-select Division/Department from those codes so a user can pick
    // Section first without choosing Division/Department beforehand.
    // Fall back to showing the code itself until DynamicDropDown resolves
    // the real name for that value (or until row-level data supplies it).
    if (row?.div_code) {
      setDivCode(row.div_code);
      setDivName(row.div_name ?? row.div_code);
    }
    if (row?.dept_code) {
      setDeptCode(row.dept_code);
      setDeptName(row.dept_name ?? row.dept_code);
    }

    setEmpId("");
    setEmpName("");
    setEmpRow(null);
  };

  // Header-level employee selector — this is the single source of truth.
  // Selecting here "locks" the employee for any row subsequently added,
  // so the same person never has to be picked again at the row level.
  //
  // It also back-fills Division / Department / Section from the employee's
  // own record. This lets a user pick the employee FIRST — without having
  // selected Division/Department beforehand — and have those fields
  // auto-select themselves from the employee's assigned org unit.
  const onEmpChange = (value: string, row: any) => {
    setEmpId(value);
    setEmpName(row?.rpt_name ?? row?.name ?? "");
    setEmpRow(row ?? null);

    if (row?.div_code) {
      setDivCode(row.div_code);
      setDivName(row.div_name ?? "");
    }
    if (row?.dept_code) {
      setDeptCode(row.dept_code);
      setDeptName(row.dept_name ?? "");
    }
    if (row?.section_code) {
      setSectionCode(row.section_code);
      setSectionName(row.section_name ?? "");
    }
  };

  const clearHeaderEmployee = useCallback(() => {
    setEmpId("");
    setEmpName("");
    setEmpRow(null);
  }, []);

  /* ── Inline updates ────────────────────────────────────────────────────── */
  const updateRow = useCallback(
    (rowKey: string, patch: Partial<PayrollEmployeeRow>) => {
      setRows((prev) =>
        prev.map((r) => (r._rowKey === rowKey ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const updateNewRowEmployee = useCallback((rowKey: string, empRow: any) => {
    setRows((prev) =>
      prev.map((r) =>
        r._rowKey === rowKey
          ? {
              ...r,
              employee_id: empRow?.employee_id ?? empRow?.value ?? "",
              employee_code: empRow?.employee_code ?? "",
              rpt_name: empRow?.rpt_name ?? "",
              grade_name: empRow?.grade_name ?? null,
              grade_code: empRow?.grade_code ?? null,
              desg_name: empRow?.desg_name ?? null,
              desg_code: empRow?.desg_code ?? null,
              div_code: empRow?.div_code ?? r.div_code,
              div_name: empRow?.div_name ?? r.div_name,
              dept_code: empRow?.dept_code ?? r.dept_code,
              dept_name: empRow?.dept_name ?? r.dept_name,
              section_code: empRow?.section_code ?? r.section_code,
              section_name: empRow?.section_name ?? r.section_name,
              company_code: empRow?.company_code ?? r.company_code,
              join_date: empRow?.join_date ?? null,
              emp_status: empRow?.emp_status ?? null,
              include_in_payroll: empRow?.include_in_payroll ?? "Y",
              gender: empRow?.gender ?? null,
              nationality: empRow?.nationality ?? null,
              mobile_no: empRow?.mobile_no ?? null,
            }
          : r
      )
    );
  }, []);

  /* ── Columns (editable) ────────────────────────────────────────────────── */
  const columns = useMemo<ColumnDef<PayrollEmployeeRow, any>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            className="accent-[#4F46E5]"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="accent-[#4F46E5]"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "employee_code",
        header: "Employee Code",
        cell: ({ row }) => {
          const r = row.original;

          // Employee already fixed by the header Emp Code filter —
          // display only, nothing to select here.
          if (r._isNew && r._employeeLocked) {
            return (
              <div className="flex min-w-[180px] items-center gap-1.5 text-[13px] text-[#101828]">
                <Lock className="h-3 w-3 shrink-0 text-[#98A2B3]" />
                <span className="truncate">
                  {r.employee_code || r.rpt_name || "—"}
                </span>
              </div>
            );
          }

          if (r._isNew) {
            return (
              <div className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                <DynamicDropDown
                  type="employee"
                  value={String(r.employee_id ?? "")}
                  displayName={r.rpt_name || r.employee_code || ""}
                  code1={divCode || ""}
                  code2={deptCode || ""}
                  code3={sectionCode || ""}
                  code4={companyCode}
                  onChange={(_val, empRow) => {
                    if (empRow) updateNewRowEmployee(r._rowKey!, empRow);
                  }}
                  label=""
                />
              </div>
            );
          }
          return r.employee_code ?? "";
        },
        size: 160,
      },
      {
        accessorKey: "rpt_name",
        header: "Employee Name",
        cell: ({ row }) => row.original.rpt_name ?? "",
        size: 180,
      },
      {
        accessorKey: "grade_name",
        header: "Grade",
        cell: ({ row }) => row.original.grade_name ?? "",
        size: 100,
      },
      {
        accessorKey: "desg_name",
        header: "Designation",
        cell: ({ row }) => row.original.desg_name ?? "",
        size: 130,
      },
      {
        accessorKey: "div_name",
        header: "Division",
        cell: ({ row }) => row.original.div_name ?? "",
        size: 110,
      },
      {
        accessorKey: "dept_name",
        header: "Department",
        cell: ({ row }) => row.original.dept_name ?? "",
        size: 110,
      },
      {
        accessorKey: "section_name",
        header: "Section",
        cell: ({ row }) => row.original.section_name ?? "",
        size: 110,
      },
      {
        accessorKey: "join_date",
        header: "Join Date",
        cell: ({ row }) => {
          const v = row.original.join_date;
          if (!v) return "";
          try {
            return formatDateForInput(v).split("-").reverse().join("/");
          } catch {
            return String(v);
          }
        },
        size: 100,
      },
      {
        accessorKey: "include_in_payroll",
        header: "In Payroll",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <select
              className="h-7 w-full rounded-md border border-[#E3E6EB] bg-white px-1.5 text-xs text-[#101828] outline-none transition-colors focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15"
              value={r.include_in_payroll ?? "Y"}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                updateRow(r._rowKey!, { include_in_payroll: e.target.value })
              }
            >
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          );
        },
        size: 90,
      },
      {
        accessorKey: "sal_processed",
        header: "Sal Processed",
        cell: ({ row }) => String(row.original.sal_processed ?? 0),
        size: 90,
      },
      {
        accessorKey: "adv_paid",
        header: "Adv Paid",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <select
              className="h-7 w-full rounded-md border border-[#E3E6EB] bg-white px-1.5 text-xs text-[#101828] outline-none transition-colors focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15"
              value={String(r.adv_paid ?? "N")}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                updateRow(r._rowKey!, { adv_paid: e.target.value })
              }
            >
              <option value="N">N</option>
              <option value="Y">Y</option>
            </select>
          );
        },
        size: 80,
      },
      {
        accessorKey: "processed",
        header: "Processed",
        cell: ({ row }) => {
          const r = row.original;
          const checked = Boolean(Number(r.processed));
          return (
            <input
              type="checkbox"
              className="accent-[#4F46E5]"
              checked={checked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                updateRow(r._rowKey!, {
                  processed: e.target.checked ? 1 : 0,
                  select_emp: e.target.checked ? 1 : 0,
                })
              }
            />
          );
        },
        size: 80,
      },
    ],
    [companyCode, divCode, deptCode, sectionCode, updateNewRowEmployee, updateRow]
  );

  const loading = loadQuery.isFetching || saveMutation.isPending;
  const employeeCount = rows.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-[#F7F8FA] p-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-[#101828]">
            Payroll Processing
          </h1>
          <p className="text-[13px] text-[#667085]">
            Review, adjust, and process payroll for a selected period.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-[#E3E6EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {/* Division */}
          <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
            <span>
              Division <span className="text-[#DC2626]">*</span>
            </span>
            <DynamicDropDown
              type="division"
              value={divCode}
              displayName={divName}
              onChange={onDivChange}
              code1={companyCode}
              required
            />
          </label>

          {/* Department */}
          <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
            <span>
              Department <span className="text-[#DC2626]">*</span>
            </span>
            <DynamicDropDown
              type="departmentBasedOnDivision"
              value={deptCode}
              displayName={deptName}
              onChange={onDeptChange}
              code1={companyCode}
              code2={divCode || ""}
              required
            />
          </label>

          {/* Section */}
          <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
            <span>
              Section <span className="text-[#DC2626]">*</span>
            </span>
            <DynamicDropDown
              type="section"
              value={sectionCode}
              displayName={sectionName}
              onChange={onSectionChange}
              code1={divCode || ""}
              code2={deptCode || ""}
              code3={companyCode}
              required
            />
          </label>

          {/* Emp Code — header-level employee. Once set, new rows inherit
              it automatically and skip employee selection entirely.
              Selecting an employee also auto-fills Division/Department/
              Section from that employee's own record. */}
          <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#98A2B3]" />
              Emp Code
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <DynamicDropDown
                  type="employee"
                  value={empId}
                  displayName={empName}
                  onChange={onEmpChange}
                  code1={divCode || ""}
                  code2={deptCode || ""}
                  code3={sectionCode || ""}
                  code4={companyCode}
                />
              </div>
              {hasHeaderEmployee && (
                <button
                  type="button"
                  onClick={clearHeaderEmployee}
                  className="h-8 shrink-0 rounded-md border border-[#E3E6EB] px-2 text-[11px] font-medium text-[#667085] transition-colors hover:bg-[#F2F4F7]"
                  title="Clear selected employee"
                >
                  Clear
                </button>
              )}
            </div>
          </label>

          {/* Payroll Date */}
          <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
            <span>
              Payroll Date <span className="text-[#DC2626]">*</span>
            </span>
            <Input
              type="date"
              className="h-8 rounded-md border-[#E3E6EB] text-[13px] focus-visible:ring-[#4F46E5]/15"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </label>
        </div>

        {hasHeaderEmployee && (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-[#EEF0FF] px-2.5 py-1.5 text-[12px] text-[#4338CA]">
            <Lock className="h-3 w-3" />
            New rows will use <strong className="font-semibold">{empName}</strong>{" "}
            automatically — no need to select an employee per row.
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#EDEFF2] pt-4">
          {loading && (
            <span className="mr-auto flex items-center gap-1.5 text-[12px] text-[#667085]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#E3E6EB] text-[#344054] hover:bg-[#F2F4F7]"
            disabled={loading}
            onClick={handleAdd}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>

          <Button
            type="button"
            size="sm"
            className="bg-[#4F46E5] text-white hover:bg-[#4338CA]"
            disabled={!hasLoaded || loading}
            onClick={handleSave}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save
          </Button>

          <Button
            type="button"
            size="sm"
            className="bg-[#101828] text-white hover:bg-[#1D2939]"
            disabled={!hasLoaded || loading || selectedRows.length === 0}
            onClick={() => {
              setRows((prev) =>
                prev.map((r) =>
                  selectedRows.some(
                    (s) =>
                      (s._rowKey && s._rowKey === r._rowKey) ||
                      (s.employee_id && s.employee_id === r.employee_id)
                  )
                    ? { ...r, processed: 1, select_emp: 1 }
                    : r
                )
              );
              alert(
                `${selectedRows.length} employee(s) marked for process. Click Save to persist.`
              );
            }}
          >
            <Play className="mr-1.5 h-4 w-4" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#E3E6EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <DataTable
          columns={columns}
          data={rows}
          loading={loadQuery.isFetching}
          loaderType="circle"
          density="compact"
          height={480}
          stickyFirstColumn
          stickyLastColumn={false}
          enablePagination
          pageSize={100}
          enableExport
          exportFilename="payroll-processing"
          getRowId={(row, index) =>
            row._rowKey ?? String(row.employee_id ?? index)
          }
          onRowSelectionChange={setSelectedRows}
          emptyText={
            hasLoaded
              ? "No employees found for the selected criteria."
              : "Select Division / Department / Section and Payroll Date to load employees."
          }
          searchPlaceholder="Search employees…"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-lg border border-[#E3E6EB] bg-white px-4 py-2.5 text-[13px] text-[#667085]">
        <span>
          Employee Payroll Count:{" "}
          <strong className="font-semibold text-[#101828]">{employeeCount}</strong>
        </span>
        {selectedRows.length > 0 && (
          <span>
            Selected:{" "}
            <strong className="font-semibold text-[#101828]">
              {selectedRows.length}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}