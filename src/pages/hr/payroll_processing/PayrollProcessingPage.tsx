import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Users, Lock, X, Download, Layers, Save } from "lucide-react";

import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { MultiSelectField } from "../../../components/ui/MultiSelectField"; // adjust path if needed
import { useAuth } from "../../../state/AuthContext";
import { DynamicDropDown } from "../api/DynamicDropDown";
import { DynamicQueryParams, getDynamicLookup } from "../../../api/lookups";
import { api } from "../../../api/client";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDateForInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateDMY(d: Date | string | null | undefined): string {
  const iso = formatDateForInput(d);
  return iso ? iso.split("-").reverse().join("/") : "";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Reads a value from an Oracle row regardless of key casing. */
function pick(row: any, key: string): any {
  if (!row) return undefined;
  return row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
}

const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();

/** Every identifier a lookup row might carry for an employee. */
function employeeIdCandidates(row: any, fallback: string): string[] {
  const keys = ["employee_id", "employee_code", "emp_code", "emp_id", "code", "value", "id"];
  const list = [fallback, ...keys.map((k) => pick(row, k))].map(norm).filter(Boolean);
  return Array.from(new Set(list));
}

/** Employee name: the main grid returns rpt_name, the employee lookup returns emp_name. */
function nameOf(row: any): string {
  return String(
    pick(row, "rpt_name") || pick(row, "emp_name") || pick(row, "employee_name") || ""
  ).trim();
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface PayrollEmployeeRow {
  select_emp?: number | boolean;
  employee_code: string;
  rpt_name: string;
  emp_name?: string;
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
  _employeeLocked?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AddDedRow {
  doc_type: string | null;
  doc_no: string | number | null;
  doc_date: string | Date | null;
  employee_code: string;
  employee_name: string;
  pay_comp_desc: string | null;
  pay_comp_earn_ded: string | null; // E / D
  recover_mth_amt: number;
  cancel_status: "Y" | "N";
  pay_comp_code: string | null;
  pay_comp_id: string | number | null;
  serial_no: string | number | null;
  _rowKey: string;
}

type TxnType = "E" | "D" | "ALL";

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Sync employee pay components before salary is processed.
 * Runs PROC_SYNC_HR_EMP_COMPONENTS through the dynamic SQL common proc
 * (same getDynamicLookup path as the other lookups on this page).
 *   code1 = company code                    (P_CODE1)
 *   code2 = employee ids, comma separated   (P_CODE2)  e.g. "101,102,103"
 */
async function syncEmpComponents(
  companyCode: string,
  employeeIds: string,
  loginId: string
): Promise<void> {
  const queryParams: DynamicQueryParams = {
    parameter: "PROC_SYNC_HR_EMP_COMPONENTS",
    loginid: loginId || "",
    code1: companyCode || "",
    code2: employeeIds,
  };

  try {
    await getDynamicLookup(queryParams);
  } catch (e: any) {
    // surface the backend's message (axios hides it inside e.response)
    const d = e?.response?.data;
    throw new Error(
      d?.details || d?.message || e?.message || "Failed to sync employee components"
    );
  }
}

async function processBulkSalary(
  companyCode: string,
  employeeIds: string,
  divCode: string,
  loginId: string
): Promise<ApiResponse> {
  const res = await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
    parameter: "PROC_BULK_PROCESS_SALARY",
    loginid: loginId || "",
    val1s1: companyCode || "", // P_VAL1S1 (Company Code)
    val1s2: employeeIds, // P_VAL1S2 (Employee IDs - comma separated)
    // val1s3 is the OUT parameter (L_PROCESS_FLAG), so we skip it
    val1s4: divCode || "", // P_VAL1S4 (Division Code)
  });

  if (!res.data.success)
    throw new Error(res.data.message || "Failed to bulk process salary");

  return res.data;
}

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
    code2: `${params.divCode || ""}|${params.deptCode || ""}`,
    code3: params.sectionCode || "",
    code4: params.payDate,
  };

  const rows = await getDynamicLookup(queryParams);
  return (rows ?? []) as unknown as PayrollEmployeeRow[];
}

/**
 * Populate Addition / Deductions
 * PROC_PAY_CONSOLIDATE -> PAY_CONSOLIDATE_VW_HR_SALARY_ADVDED_FROM
 *   code1 = company code      (P_CODE1)
 *   code2 = division code     (P_CODE2)
 *   code3 = employee code     (P_CODE3)  -> a code, or "ALL"
 *   code4 = PAY_COMP_EARN_DED (P_CODE4)  -> E / D / ALL
 */
async function fetchAddDedData(params: {
  companyCode: string;
  divCode: string;
  employeeCode: string;
  txnType: TxnType;
  loginId?: string;
}): Promise<AddDedRow[]> {
  const queryParams: DynamicQueryParams = {
    parameter: "PAY_CONSOLIDATE_VW_HR_SALARY_ADVDED_FROM",
    loginid: params.loginId || "",
    code1: params.companyCode || "",
    code2: params.divCode || "",
    code3: params.employeeCode || "",
    code4: params.txnType,
  };

  const rows = (await getDynamicLookup(queryParams)) ?? [];

  return (rows as any[]).map((r, i) => ({
    doc_type: pick(r, "DOC_TYPE") ?? null,
    doc_no: pick(r, "DOC_NO") ?? null,
    doc_date: pick(r, "DOC_DATE") ?? null,
    employee_code: String(pick(r, "EMPLOYEE_CODE") ?? ""),
    employee_name: String(
      pick(r, "EMPLOYEE_NAME") || pick(r, "EMP_NAME") || pick(r, "RPT_NAME") || ""
    ),
    pay_comp_code: pick(r, "PAY_COMP_CODE") ?? null,
    pay_comp_id: pick(r, "PAY_COMP_ID") ?? pick(r, "PAY_COMP_CODE") ?? null,
    pay_comp_desc: pick(r, "PAY_COMP_DESC") ?? null,
    pay_comp_earn_ded: pick(r, "PAY_COMP_EARN_DED") ?? null,
    recover_mth_amt: Number(pick(r, "RECOVER_MTH_AMT") ?? 0) || 0,
    serial_no: pick(r, "SERIAL_NO") ?? null,
    // always start as "No"; the user switches a row to "Yes" to cancel it
    cancel_status: "N" as const,
    _rowKey: `adv-${pick(r, "DOC_NO") ?? i}-${i}`,
  }));
}

/**
 * Save the ticked rows in ONE request (PUT /api/hr/consolidate/cancel).
 * The backend builds an Oracle collection from `records` and calls
 * PROC_UPDATE_CONSOLIDATE_CANCEL_FLAG.
 */
async function saveConsolidation(params: {
  companyCode: string;
  divCode: string;
  rows: AddDedRow[];
  loginId?: string;
}): Promise<void> {
  // the procedure needs these on every record
  const bad = params.rows.find(
    (r) => !r.doc_type || r.doc_no == null || r.pay_comp_id == null || r.serial_no == null
  );
  if (bad) {
    throw new Error(
      "DOC_TYPE, DOC_NO, PAY_COMP_ID and SERIAL_NO must be returned by the populate query."
    );
  }

  try {
    const res = await api.put("/api/hr/consolidate/cancel", {
      loginid: params.loginId || "",
      company_code: params.companyCode,
      records: params.rows.map((r) => ({
        company_code: params.companyCode,
        doc_type: r.doc_type,
        doc_no: r.doc_no,
        pay_comp_id: r.pay_comp_id,
        serial_no: r.serial_no,
        updated_by: params.loginId || "",
        cancel_status: r.cancel_status, // "Y" | "N"
      })),
    });
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Failed to save");
    }
  } catch (e: any) {
    // surface the backend's message (axios hides it inside e.response)
    const d = e?.response?.data;
    throw new Error(d?.details || d?.message || e?.message || "Failed to save");
  }
}

async function deleteAccrualTempData(
  companyCode: string,
  divCode: string,
  loginId?: string
): Promise<ApiResponse> {
  const res = await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
    parameter: "PROC_PROLLPROC_HR_ACCRUAL_TEMP_DATA_DEL",
    loginid: loginId ?? "",
    val1s1: companyCode,
    val1s2: divCode,
  });
  if (!res.data.success)
    throw new Error(res.data.message || "Failed to clear accrual temp data");
  return res.data;
}

async function processEmployeePayroll(
  companyCode: string,
  divCode: string,
  employeeId: string | number,
  loginId: string,
  sourceFlag: string
): Promise<ApiResponse> {
  const res = await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
    parameter: "SP_HR_EMP_PAYROLL_PROCESS",
    loginid: loginId,
    val1s1: companyCode,
    val1s2: divCode,
    val1s3: String(employeeId),
    val1s4: loginId,
    val1s5: sourceFlag,
  });
  if (!res.data.success)
    throw new Error(res.data.message || "Failed to process employee payroll");
  return res.data;
}

async function calcEmployeeSalary(
  companyCode: string,
  divCode: string,
  employeeId: string | number,
  loginId: string,
  sourceFlag: string
): Promise<ApiResponse> {
  const res = await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
    parameter: "SP_HR_PAY_CALC_EMP_SAL",
    loginid: loginId,
    val1s1: companyCode,
    val1s2: divCode,
    val1s3: String(employeeId),
    val1s4: loginId,
    val1s5: sourceFlag,
  });
  if (!res.data.success)
    throw new Error(res.data.message || "Failed to calculate employee salary");
  return res.data;
}

async function adjustPayColaForCompany(
  companyCode: string,
  loginId: string
): Promise<ApiResponse> {
  const res = await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
    parameter: "SP_HR_PAY_COLA_ADJUST",
    loginid: loginId,
    val1s1: companyCode,
  });
  if (!res.data.success)
    throw new Error(res.data.message || "Failed to adjust pay COLA");
  return res.data;
}

/* -------------------------------------------------------------------------- */
/* Populate Addition / Deductions modal                                       */
/* -------------------------------------------------------------------------- */

interface PopulateAddDedModalProps {
  open: boolean;
  companyCode: string;
  loginId: string;
  initialDivCode: string;
  initialDivName: string;
  /** Employees ticked in the main grid (pre-selected when the modal opens) */
  initialEmployees: { employee_code: string; rpt_name?: string }[];
  onClose: () => void;
}

function PopulateAddDedModal({
  open,
  companyCode,
  loginId,
  initialDivCode,
  initialDivName,
  initialEmployees,
  onClose,
}: PopulateAddDedModalProps) {
  const [mDivCode, setMDivCode] = useState("");
  const [mDivName, setMDivName] = useState("");
  const [mEmpCodes, setMEmpCodes] = useState<string[]>([]);
  const [txnType, setTxnType] = useState<TxnType>("ALL");

  const [data, setData] = useState<AddDedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [populated, setPopulated] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Employee list for the chosen division (feeds the multi-select)
  const empQuery = useQuery({
    queryKey: ["addDedEmployees", companyCode, mDivCode],
    queryFn: () =>
      getDynamicLookup({
        parameter: "HR_LEAVE_ENCASHMENT_EMPLOYEE_DROP_DOWN",
        loginid: loginId,
        code1: mDivCode,
        code2: "",
        code3: "",
        code4: companyCode,
      }),
    enabled: open && !!mDivCode,
    staleTime: 0,
  });

  const empOptions = useMemo(
    () =>
      ((empQuery.data ?? []) as any[])
        .map((r) => {
          const code = String(pick(r, "employee_code") ?? "").trim();
          return { value: code, code, label: nameOf(r) };
        })
        .filter((o) => o.value),
    [empQuery.data]
  );

  // every employee in the list is ticked
  const allEmp = empOptions.length > 0 && empOptions.every((o) => mEmpCodes.includes(o.value));

  // Reset every time the modal opens, pre-filling from page filters
  useEffect(() => {
    if (!open) return;
    setMDivCode(initialDivCode);
    setMDivName(initialDivName);
    setMEmpCodes((initialEmployees ?? []).map((e) => String(e.employee_code)).filter(Boolean));
    setTxnType("ALL");
    setSuccess("");
    setSelectedKeys(new Set());
    setData([]);
    setPopulated(false);
    setError("");
    setLoading(false);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handlePopulate = useCallback(async () => {
    setError("");
    setSuccess("");
    if (!mDivCode) {
      setError("Division is required.");
      return;
    }
    if (mEmpCodes.length === 0) {
      setError("Select at least one employee.");
      return;
    }

    setLoading(true);
    try {
      // everything ticked → one "ALL" request, otherwise one request per employee
      const codes = allEmp ? ["ALL"] : mEmpCodes;
      const results = await Promise.all(
        codes.map((c) =>
          fetchAddDedData({
            companyCode,
            divCode: mDivCode,
            employeeCode: c,
            txnType,
            loginId,
          })
        )
      );
      const rows = results.flat().map((r, i) => ({ ...r, _rowKey: `${r._rowKey}-${i}` }));
      setData(rows);
      setSelectedKeys(new Set());
      setPopulated(true);
    } catch (e) {
      setData([]);
      setPopulated(true);
      setError((e as Error).message || "Failed to populate data.");
    } finally {
      setLoading(false);
    }
  }, [companyCode, loginId, mDivCode, mEmpCodes, txnType, allEmp]);

  const updateCancelStatus = useCallback((rowKey: string, value: "Y" | "N") => {
    setData((prev) =>
      prev.map((r) => (r._rowKey === rowKey ? { ...r, cancel_status: value } : r))
    );
    // changing a row ticks it, so it is included in Save
    setSelectedKeys((prev) => new Set(prev).add(rowKey));
  }, []);

  const total = useMemo(
    () => data.reduce((sum, r) => sum + (Number(r.recover_mth_amt) || 0), 0),
    [data]
  );

  const selectedList = useMemo(
    () => data.filter((r) => selectedKeys.has(r._rowKey)),
    [data, selectedKeys]
  );
  const allSelected = data.length > 0 && selectedKeys.size === data.length;
  const someSelected = selectedKeys.size > 0 && !allSelected;

  const toggleRow = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = () =>
    setSelectedKeys(allSelected ? new Set() : new Set(data.map((r) => r._rowKey)));

  const handleSave = async () => {
    if (selectedList.length === 0) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await saveConsolidation({
        companyCode,
        divCode: mDivCode,
        rows: selectedList,
        loginId,
      });
      setSuccess(`${selectedList.length} record(s) updated.`);
      setSelectedKeys(new Set());
    } catch (e) {
      setError((e as Error).message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const th =
    "sticky top-0 z-10 whitespace-nowrap border-b border-[#E3E6EB] bg-[#F9FAFB] px-3 py-2 text-left text-[12px] font-semibold text-[#344054]";
  const td = "whitespace-nowrap border-b border-[#EDEFF2] px-3 py-1.5 text-[13px] text-[#101828]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Populate Addition / Deductions"
    >
      <div className="flex max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-[#E3E6EB] bg-white shadow-[0_20px_40px_rgba(16,24,40,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EDEFF2] px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[#101828]">
              Populate Addition / Deductions
            </h2>
            <p className="text-[12px] text-[#667085]">
              Select division, employees and transaction type, populate, tick the rows and save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#667085] transition-colors hover:bg-[#F2F4F7]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-[#EDEFF2] bg-[#F7F8FA] px-5 py-4">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
              <span>
                Division <span className="text-[#DC2626]">*</span>
              </span>
              <DynamicDropDown
                type="division"
                value={mDivCode}
                displayName={mDivName}
                onChange={(value: string, row: any) => {
                  setMDivCode(value);
                  setMDivName(row?.div_name ?? row?.name ?? "");
                  // employees depend on division
                  setMEmpCodes([]);
                  setData([]);
                  setPopulated(false);
                }}
                code1={companyCode}
                required
              />
            </label>

            {/* div (not label) so the click is not forwarded to the trigger twice */}
            <div className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#98A2B3]" />
                Employee <span className="text-[#DC2626]">*</span>
              </span>
              <MultiSelectField
                label=""
                compact
                toggleAllItems
                showCheckboxes
                options={empOptions}
                value={mEmpCodes}
                loading={empQuery.isFetching}
                disabled={!mDivCode}
                placeholder="Select employees…"
                codeColumnLabel="Code"
                labelColumnLabel="Name"
                onChange={(v) => {
                  setMEmpCodes(v);
                  setData([]);
                  setPopulated(false);
                  setSuccess("");
                }}
              />
            </div>

            <label className="grid gap-1.5 text-[12px] font-medium text-[#344054]">
              <span>
                Type of Transaction <span className="text-[#DC2626]">*</span>
              </span>
              <select
                className="h-8 w-full rounded-md border border-[#E3E6EB] bg-white px-2 text-[13px] text-[#101828] outline-none transition-colors focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15"
                value={txnType}
                onChange={(e) => {
                  setTxnType(e.target.value as TxnType);
                  setData([]);
                  setPopulated(false);
                }}
              >
                <option value="ALL">All</option>
                <option value="E">Earning</option>
                <option value="D">Deduction</option>
              </select>
            </label>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="bg-[#4F46E5] text-white hover:bg-[#4338CA]"
                disabled={loading || !mDivCode || mEmpCodes.length === 0}
                onClick={handlePopulate}
              >
                {loading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Populate
              </Button>
            </div>
          </div>

          {success && (
            <div className="mt-3 rounded-md bg-[#ECFDF3] px-2.5 py-1.5 text-[12px] text-[#067647]">
              {success}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-md bg-[#FEF3F2] px-2.5 py-1.5 text-[12px] text-[#B42318]">
              {error}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="max-h-[48vh] min-h-[220px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-10`}>
                  <input
                    type="checkbox"
                    className="accent-[#4F46E5]"
                    aria-label="Select all rows"
                    disabled={data.length === 0}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className={th}>Doc No</th>
                <th className={th}>Doc Date</th>
                <th className={th}>Employee Code</th>
                <th className={th}>Employee Name</th>
                <th className={th}>Pay Component</th>
                <th className={th}>Type</th>
                <th className={`${th} text-right`}>Recover Month Amt</th>
                <th className={th}>Cancel Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[13px] text-[#667085]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </span>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[13px] text-[#667085]">
                    {populated
                      ? "No records found for the selected criteria."
                      : "Select Division, Employees and Type, then click Populate."}
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr
                    key={r._rowKey}
                    className={
                      selectedKeys.has(r._rowKey) ? "bg-[#F5F6FF]" : "hover:bg-[#F9FAFB]"
                    }
                  >
                    <td className={td}>
                      <input
                        type="checkbox"
                        className="accent-[#4F46E5]"
                        aria-label="Select row"
                        checked={selectedKeys.has(r._rowKey)}
                        onChange={() => toggleRow(r._rowKey)}
                      />
                    </td>
                    <td className={td}>{r.doc_no ?? ""}</td>
                    <td className={td}>{formatDateDMY(r.doc_date)}</td>
                    <td className={td}>{r.employee_code}</td>
                    <td className={td}>{r.employee_name}</td>
                    <td className={td}>{r.pay_comp_desc ?? ""}</td>
                    <td className={td}>
                      {String(r.pay_comp_earn_ded).toUpperCase() === "E"
                        ? "Addition"
                        : "Deduction"}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {r.recover_mth_amt.toLocaleString(undefined, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td className={td}>
                      <select
                        className="h-7 w-20 rounded-md border border-[#E3E6EB] bg-white px-1.5 text-xs text-[#101828] outline-none transition-colors focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15"
                        value={r.cancel_status}
                        onChange={(e) =>
                          updateCancelStatus(r._rowKey, e.target.value as "Y" | "N")
                        }
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between border-t border-[#EDEFF2] bg-[#F9FAFB] px-5 py-2.5 text-[13px] text-[#667085]">
          <span>
            Record Count:{" "}
            <strong className="font-semibold text-[#101828]">{data.length}</strong>
            <span className="mx-2 text-[#D0D5DD]">|</span>
            Selected:{" "}
            <strong className="font-semibold text-[#101828]">{selectedKeys.size}</strong>
          </span>
          <span>
            Total:{" "}
            <strong className="font-semibold tabular-nums text-[#101828]">
              {total.toLocaleString(undefined, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            </strong>
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#EDEFF2] px-5 py-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#101828] text-white hover:bg-[#1D2939]"
            disabled={saving || selectedKeys.size === 0}
            title={
              selectedKeys.size === 0
                ? "Tick at least one row to enable Save"
                : `Save ${selectedKeys.size} selected record(s)`
            }
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function PayrollProcessingPage() {
  const { user } = useAuth();

  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  // Filters
  const [divCode, setDivCode] = useState("");
  const [divName, setDivName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [empRow, setEmpRow] = useState<any | null>(null);
  const [payDate, setPayDate] = useState(todayISO());

  // Table state
  const [rows, setRows] = useState<PayrollEmployeeRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<PayrollEmployeeRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Modal
  const [addDedOpen, setAddDedOpen] = useState(false);

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
        loginId: loginid,
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
      rpt_name: nameOf(r),
      emp_name: nameOf(r),
      select_emp: r.select_emp ?? 0,
      processed: r.processed ?? 0,
      _rowKey: `db-${r.employee_id ?? i}-${i}`,
      _isNew: false,
    }));

    if (empId) {
      const ids = employeeIdCandidates(empRow, empId);
      let matched = list.filter(
        (r) => ids.includes(norm(r.employee_id)) || ids.includes(norm(r.employee_code))
      );
      // fallback: the lookup value may not be an id/code, so try the name
      if (matched.length === 0 && empName) {
        matched = list.filter((r) => norm(r.rpt_name) === norm(empName));
      }
      list = matched;
    }

    setRows(list);
    setHasLoaded(true);
  }, [loadQuery.data, empId, empRow, empName]);

  /* ── Process Payroll (runs directly) ───────────────────────────────────── */
  const handleProcessPayroll = useCallback(async () => {
    if (!divCode) {
      alert("Division is required.");
      return;
    }
    if (selectedRows.length === 0) return;

    try {
      await deleteAccrualTempData(companyCode, divCode, loginid);

      const checkRows = await getDynamicLookup({
        parameter: "PAYROLL_Process",
        code1: companyCode,
      });

      const checkValue = Number(
        (checkRows?.[0] as any)?.check_value ?? (checkRows?.[0] as any)?.CHECK_VALUE ?? 0
      );

      if (checkValue !== 0) {
        alert("Memo mismatch found. Please resolve before processing payroll.");
        return;
      }

      // 1. Extract employee IDs and join them into a comma-separated string
      const employeeIdsStr = selectedRows
        .map((row) => row.employee_id)
        .filter(Boolean)
        .join(",");

      // 2. Sync employee pay components (company code + comma-separated employee IDs)
      await syncEmpComponents(companyCode, employeeIdsStr, loginid);

      // 3. Call the bulk process procedure
      await processBulkSalary(companyCode, employeeIdsStr, divCode, loginid);

      // 4. Adjust Pay COLA for the company
      await adjustPayColaForCompany(companyCode, loginid);

      // 5. Update local state
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

      alert(`${selectedRows.length} employee(s) marked for process.`);
    } catch (err) {
      alert((err as Error).message || "Failed to process payroll.");
    }
  }, [divCode, companyCode, loginid, selectedRows]);

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

  const onEmpChange = (value: string, row: any) => {
    setEmpId(value);
    setEmpName(row?.emp_name ?? row?.rpt_name ?? row?.name ?? "");
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
  const updateRow = useCallback((rowKey: string, patch: Partial<PayrollEmployeeRow>) => {
    setRows((prev) => prev.map((r) => (r._rowKey === rowKey ? { ...r, ...patch } : r)));
  }, []);

  const updateNewRowEmployee = useCallback((rowKey: string, empRow: any) => {
    setRows((prev) =>
      prev.map((r) =>
        r._rowKey === rowKey
          ? {
              ...r,
              employee_id: empRow?.employee_id ?? empRow?.value ?? "",
              employee_code: empRow?.employee_code ?? "",
              rpt_name: empRow?.rpt_name ?? empRow?.emp_name ?? "",
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

          if (r._isNew && r._employeeLocked) {
            return (
              <div className="flex min-w-[180px] items-center gap-1.5 text-[13px] text-[#101828]">
                <Lock className="h-3 w-3 shrink-0 text-[#98A2B3]" />
                <span className="truncate">{r.employee_code || r.rpt_name || "—"}</span>
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
              onChange={(e) => updateRow(r._rowKey!, { include_in_payroll: e.target.value })}
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
              onChange={(e) => updateRow(r._rowKey!, { adv_paid: e.target.value })}
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

  const loading = loadQuery.isFetching;
  const employeeCount = rows.length;

  return (
    <div className="flex min-h-full flex-col gap-4 bg-[#F7F8FA] p-4">
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
            size="sm"
            variant="outline"
            disabled={loading || !companyCode}
            onClick={() => setAddDedOpen(true)}
          >
            <Layers className="mr-1.5 h-4 w-4" />
            Consolidate
          </Button>

          <Button
            type="button"
            size="sm"
            className="bg-[#101828] text-white hover:bg-[#1D2939]"
            disabled={!hasLoaded || loading || selectedRows.length === 0}
            onClick={handleProcessPayroll}
          >
            <Play className="mr-1.5 h-4 w-4" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[#E3E6EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <DataTable
          columns={columns}
          data={rows}
          loading={loadQuery.isFetching}
          loaderType="circle"
          density="compact"
          height={420}
          stickyFirstColumn
          stickyLastColumn={false}
          enablePagination
          pageSize={100}
          enableExport
          exportFilename="payroll-processing"
          getRowId={(row, index) => row._rowKey ?? String(row.employee_id ?? index)}
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
            <strong className="font-semibold text-[#101828]">{selectedRows.length}</strong>
          </span>
        )}
      </div>

      {/* Populate Addition / Deductions modal */}
      <PopulateAddDedModal
        open={addDedOpen}
        companyCode={companyCode}
        loginId={loginid}
        initialDivCode={selectedRows[0]?.div_code || divCode}
        initialDivName={selectedRows[0]?.div_name || divName}
        initialEmployees={
          selectedRows.length > 0
            ? selectedRows.map((r) => ({ employee_code: r.employee_code, rpt_name: r.rpt_name }))
            : empRow?.employee_code
            ? [{ employee_code: empRow.employee_code, rpt_name: empName }]
            : []
        }
        onClose={() => setAddDedOpen(false)}
      />
    </div>
  );
}