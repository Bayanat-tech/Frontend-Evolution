// EmployeeSalaryIncrement.tsx
//
// Freight-style refactor (modelled on SalaryAdvanceRecoveryPage / GradeMasterPage):
//  • freight-transaction-header with title, context text and Refresh / Save actions
//  • Collapsible Freight panels (Employee Selection, Current Salary, Salary Increment)
//  • Field / Select / Input building blocks, useToast for all feedback (no banners)
//  • Line add/edit opens as an inline panel above the Salary Increment grid (no dialog)
//  • Lookup loading de-duplicated into one loadEmployeeData() helper

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronDown, Edit2, ListChecks, Loader2, Plus, RefreshCw, Save, Trash2, TrendingUp,
  Users, Wallet, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DynamicDropDown } from "./api/DynamicDropDown";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup, type LookupRow } from "../../api/lookups";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Field } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/AlertToast";

// ---------------------------------------------------------------------------
// Lookup procedure parameter names (proc_build_dynamic_sql_common)
// ---------------------------------------------------------------------------

const PARAM = {
  CURRENT_SALARY: "EMPLOYEE_SALARY_INCREMENT_CURRENT_SALARY",
  SALARY_INCREMENT: "EMPLOYEE_SALARY_INCREMENT_SALARY_INCREMENT",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeDetailState {
  div_code: string;
  div_name: string;
  dept_code: string;
  dept_name: string;
  section_code: string;
  section_name: string;
  emp_id: string;
  emp_code: string;
  emp_name: string;
}

const EMPTY_STATE: EmployeeDetailState = {
  div_code: "",
  div_name: "",
  dept_code: "",
  dept_name: "",
  section_code: "",
  section_name: "",
  emp_id: "",
  emp_code: "",
  emp_name: "",
};

interface CurrentSalaryRow {
  pay_comp_id: string;
  pay_comp_amt: number;
  pay_comp_earn_ded: string;
  comp_status: string;
  approved_on: string;
  sort_order: number;
}

interface SalaryIncrementRow {
  _rowKey: string;
  is_new: boolean;
  slno: number | null;

  pay_comp_id: string;
  pay_comp_name: string;

  old_pay_comp_amt: number;

  increment_type: string;
  increment_type_desc: string;

  trn_type: string;
  trn_type_desc: string;

  incr_perc: number;
  incr_amount: number;

  effective_date: string;
  actual_effective_date: string;
  arrears_flag: "Y" | "N";
  arrears_amt: number;
  arrears_perc: number;

  approval_status: string;
  approval_status_desc: string;

  status_flag: string;
  status_flag_desc: string;

  pay_month: string;
  pay_year: string;
  doc_no: string;
  posted: string;

  remarks?: string;
}

type ApiResponse = {
  success?: boolean;
  message?: string;
  details?: string;
};

const EMPTY_INCREMENT_ROW: Omit<SalaryIncrementRow, "_rowKey" | "is_new" | "slno"> = {
  pay_comp_id: "",
  pay_comp_name: "",
  old_pay_comp_amt: 0,
  increment_type: "",
  increment_type_desc: "",
  trn_type: "",
  trn_type_desc: "",
  incr_perc: 0,
  incr_amount: 0,
  effective_date: "",
  actual_effective_date: "",
  arrears_flag: "N",
  arrears_amt: 0,
  arrears_perc: 0,
  approval_status: "",
  approval_status_desc: "",
  status_flag: "",
  status_flag_desc: "",
  pay_month: "",
  pay_year: "",
  doc_no: "",
  posted: "",
  remarks: "",
};

// Hardcoded per the "Type" code table (Increment / Decrement)
const INCREMENT_TRN_TYPES = [
  { display: "Increment", value: "1" },
  { display: "Decrement", value: "-1" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRowKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const fmtAmount = (value: unknown) => Number(value || 0).toFixed(3);

function getErrorMessage(error: unknown, fallback: string): string {
  const anyErr = error as {
    response?: { data?: { details?: string; message?: string } };
    message?: string;
  };
  const data = anyErr?.response?.data;
  const backendMessage = data?.details || data?.message;
  if (backendMessage && typeof backendMessage === "string") return backendMessage;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function mapLookupRowToCurrentSalaryRow(r: LookupRow): CurrentSalaryRow {
  return {
    pay_comp_id: String(r.pay_comp_id ?? ""),
    pay_comp_amt: Number(r.pay_comp_amt ?? 0),
    pay_comp_earn_ded: String(r.pay_comp_earn_ded ?? ""),
    comp_status: String(r.comp_status ?? ""),
    approved_on: r.approved_on ? String(r.approved_on).slice(0, 10) : "",
    sort_order: Number(r.sort_order ?? 0),
  };
}

function mapLookupRowToIncrementRow(r: LookupRow): SalaryIncrementRow {
  return {
    _rowKey: makeRowKey(),
    is_new: false,
    slno: r.slno != null ? Number(r.slno) : null,
    pay_comp_id: String(r.pay_comp_id ?? ""),
    pay_comp_name: String((r as any).pay_comp_name ?? r.pay_comp_id ?? ""),
    old_pay_comp_amt: Number(r.old_pay_comp_amt ?? 0),
    increment_type: String(r.increment_source ?? ""),
    increment_type_desc: String((r as any).increment_source_desc ?? ""),
    trn_type: String(r.trn_type ?? ""),
    trn_type_desc: INCREMENT_TRN_TYPES.find((t) => t.value === String(r.trn_type))?.display ?? "",
    incr_perc: Number(r.incr_perc ?? 0),
    incr_amount: Number(r.incr_amount ?? 0),
    effective_date: r.effective_date ? String(r.effective_date).slice(0, 10) : "",
    actual_effective_date: r.actual_effective_date ? String(r.actual_effective_date).slice(0, 10) : "",
    arrears_flag: String(r.arrears_flag ?? "N") as "Y" | "N",
    arrears_amt: Number(r.arrears_amt ?? 0),
    arrears_perc: Number(r.arrears_perc ?? 0),
    approval_status: String(r.approval_status ?? ""),
    approval_status_desc: String((r as any).approval_status_desc ?? ""),
    status_flag: String(r.status_flag ?? ""),
    status_flag_desc: String((r as any).status_flag_desc ?? ""),
    pay_month: r.pay_month != null ? String(r.pay_month) : "",
    pay_year: r.pay_year != null ? String(r.pay_year) : "",
    doc_no: r.doc_no != null ? String(r.doc_no) : "",
    posted: String(r.posted ?? ""),
    remarks: r.remarks != null ? String(r.remarks) : "",
  };
}

// ---------------------------------------------------------------------------
// UI building block: collapsible Freight panel
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Add / Edit line form — inline Freight panel, rendered above the Salary
// Increment grid (no dialog). Remounted via `key` so state resets per line.
// ---------------------------------------------------------------------------

interface SalaryIncrementLineFormProps {
  initialRow?: SalaryIncrementRow | null;
  onClose: () => void;
  onSave: (row: SalaryIncrementRow) => void;
  companyCode?: string;
}

function SalaryIncrementLineForm({
  initialRow,
  onClose,
  onSave,
  companyCode,
}: SalaryIncrementLineFormProps) {
  const { toast } = useToast();
  const isEditing = Boolean(initialRow);
  const panelRef = useRef<HTMLElement>(null);

  const [form, setForm] = useState<SalaryIncrementRow>(() => ({
    _rowKey: initialRow?._rowKey ?? makeRowKey(),
    is_new: initialRow?.is_new ?? true,
    slno: initialRow?.slno ?? null,
    ...EMPTY_INCREMENT_ROW,
    ...(initialRow ?? {}),
  }));

  // Bring the form into view when it opens (e.g. editing a row far down the page)
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const update = <K extends keyof SalaryIncrementRow>(key: K, value: SalaryIncrementRow[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // NOTE: "payComponent" type does not exist yet in DROPDOWN_CONFIG.
  // Add it there before using this dropdown.
  const handlePayUnitChange = (value: string, row: LookupRow | null) => {
    update("pay_comp_id", value);
    update("pay_comp_name", row ? String((row as any).name ?? "") : "");
  };

  const handleIncrementTypeChange = (value: string, row: LookupRow | null) => {
    update("increment_type", value);
    update("increment_type_desc", row ? String((row as any).name ?? "") : "");
  };

  const handleApprovalStatusChange = (value: string, row: LookupRow | null) => {
    update("approval_status", value);
    update("approval_status_desc", row ? String((row as any).name ?? "") : "");
  };

  const handleStatusFlagChange = (value: string, row: LookupRow | null) => {
    update("status_flag", value);
    update("status_flag_desc", row ? String((row as any).name ?? "") : "");
  };

  const handleTrnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const found = INCREMENT_TRN_TYPES.find((t) => t.value === value);
    update("trn_type", value);
    update("trn_type_desc", found?.display ?? "");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.pay_comp_id || !form.increment_type || !form.trn_type || !form.effective_date) {
      toast.warning("Pay Unit, Increment Type, Type and Effective Date are required");
      return;
    }
    onSave(form);
  };

  return (
    <section
      ref={panelRef}
      className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm"
    >
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">{isEditing ? <Edit2 size={16} /> : <Plus size={16} />}</span>
          <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">
            {isEditing ? "Edit Salary Increment Line" : "Add Salary Increment Line"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="h-6 w-6 grid place-items-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <form className="freight-panel-body grid gap-3 p-3" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Pay Unit" required className="md:col-span-2">
            <DynamicDropDown
              type="payComponent"
              value={form.pay_comp_id}
              displayName={form.pay_comp_name}
              onChange={handlePayUnitChange}
              code1={companyCode}
            />
          </Field>

          <Field label="Increment Type" required>
            <DynamicDropDown
              type="dddwIncrementStatus"
              value={form.increment_type}
              displayName={form.increment_type_desc}
              onChange={handleIncrementTypeChange}
            />
          </Field>

          <Field label="Type" required>
            <Select value={form.trn_type} onChange={handleTrnTypeChange}>
              <option value="">-- Select --</option>
              {INCREMENT_TRN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.display}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="% Amount">
            <Input
              type="number"
              step="0.001"
              className="text-right"
              value={form.incr_perc}
              onChange={(e) => update("incr_perc", Number(e.target.value))}
            />
          </Field>

          <Field label="Amount">
            <Input
              type="number"
              step="0.001"
              className="text-right"
              value={form.incr_amount}
              onChange={(e) => update("incr_amount", Number(e.target.value))}
            />
          </Field>

          <Field label="Effective Date" required>
            <Input
              type="date"
              value={form.effective_date}
              onChange={(e) => update("effective_date", e.target.value)}
            />
          </Field>

          <Field label="Arrears">
            <Select
              value={form.arrears_flag}
              onChange={(e) => update("arrears_flag", e.target.value as "Y" | "N")}
            >
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </Select>
          </Field>

          {form.arrears_flag === "Y" && (
            <Field label="Arrears Amount">
              <Input
                type="number"
                step="0.001"
                className="text-right"
                value={form.arrears_amt}
                onChange={(e) => update("arrears_amt", Number(e.target.value))}
              />
            </Field>
          )}

          <Field label="Approval Status">
            <DynamicDropDown
              type="dddwStatusFlag"
              value={form.approval_status}
              displayName={form.approval_status_desc}
              onChange={handleApprovalStatusChange}
            />
          </Field>

          <Field label="Salary Status">
            <DynamicDropDown
              type="dddwStatusFlag"
              value={form.status_flag}
              displayName={form.status_flag_desc}
              onChange={handleStatusFlagChange}
            />
          </Field>

          <Field label="Remarks" className="md:col-span-2">
            <Input value={form.remarks ?? ""} onChange={(e) => update("remarks", e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          <Button type="submit" size="sm">
            <Save size={14} /> {isEditing ? "Save Changes" : "Add Line"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EmployeeSalaryIncrement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetailState>(EMPTY_STATE);
  const [currentSalary, setCurrentSalary] = useState<CurrentSalaryRow[]>([]);
  const [incrementRows, setIncrementRows] = useState<SalaryIncrementRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SalaryIncrementRow | null>(null);

  const employeeSelected = Boolean(employeeDetail.emp_id);

  // ---------- DIVISION ----------
  const handleDivisionChange = useCallback((value: string, row: LookupRow | null) => {
    setEmployeeDetail((prev) => ({
      ...prev,
      div_code: value,
      div_name: row ? String(row.div_name ?? "") : "",
      dept_code: "",
      dept_name: "",
      section_code: "",
      section_name: "",
      emp_id: "",
      emp_code: "",
      emp_name: "",
    }));
  }, []);

  // ---------- DEPARTMENT ----------
  const handleDepartmentChange = useCallback((value: string, row: LookupRow | null) => {
    setEmployeeDetail((prev) => ({
      ...prev,
      dept_code: value,
      dept_name: row ? String(row.dept_name ?? "") : "",
      section_code: "",
      section_name: "",
      emp_id: "",
      emp_code: "",
      emp_name: "",
    }));
  }, []);

  // ---------- SECTION ----------
  const handleSectionChange = useCallback((value: string, row: LookupRow | null) => {
    setEmployeeDetail((prev) => ({
      ...prev,
      section_code: value,
      section_name: row ? String(row.section_name ?? "") : "",
      emp_id: "",
      emp_code: "",
      emp_name: "",
    }));
  }, []);

  // ---------- EMPLOYEE ----------
  const handleEmployeeChange = useCallback((value: string, row: LookupRow | null) => {
    setEmployeeDetail((prev) => {
      if (!row) {
        return { ...prev, emp_id: "", emp_code: "", emp_name: "" };
      }

      const rowDiv = row.div_code != null ? String(row.div_code) : "";
      const rowDept = row.dept_code != null ? String(row.dept_code) : "";
      const rowSection = row.section_code != null ? String(row.section_code) : "";

      const divChanged = rowDiv !== "" && rowDiv !== prev.div_code;
      const deptChanged = rowDept !== "" && rowDept !== prev.dept_code;
      const sectionChanged = rowSection !== "" && rowSection !== prev.section_code;

      return {
        ...prev,
        emp_id: value,
        emp_code: String(row.employee_code ?? ""),
        emp_name: String(row.rpt_name ?? ""),

        div_code: rowDiv || prev.div_code,
        div_name: divChanged ? String(row.div_name ?? "") : prev.div_name,

        dept_code: rowDept || prev.dept_code,
        dept_name: deptChanged ? String(row.dept_name ?? "") : prev.dept_name,

        section_code: rowSection || prev.section_code,
        section_name: sectionChanged ? String(row.section_name ?? "") : prev.section_name,
      };
    });
  }, []);

  // ---------- LOAD CURRENT SALARY + INCREMENT ROWS (single helper) ----------
  const loadEmployeeData = useCallback(
    async (empId: string, isCancelled: () => boolean = () => false) => {
      if (!empId || !companyCode) {
        setCurrentSalary([]);
        setIncrementRows([]);
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      const params = (parameter: string) => ({
        parameter,
        loginid,
        code1: companyCode,
        code2: empId,
      });

      const [salaryRes, incrementRes] = await Promise.allSettled([
        getDynamicLookup(params(PARAM.CURRENT_SALARY)),
        getDynamicLookup(params(PARAM.SALARY_INCREMENT)),
      ]);
      if (isCancelled()) return;

      if (salaryRes.status === "fulfilled") {
        setCurrentSalary(
          (salaryRes.value as LookupRow[])
            .map(mapLookupRowToCurrentSalaryRow)
            .sort((a, b) => a.sort_order - b.sort_order),
        );
      } else {
        setCurrentSalary([]);
        toast.error(getErrorMessage(salaryRes.reason, "Unable to load current salary"));
      }

      if (incrementRes.status === "fulfilled") {
        setIncrementRows((incrementRes.value as LookupRow[]).map(mapLookupRowToIncrementRow));
      } else {
        setIncrementRows([]);
        toast.error(getErrorMessage(incrementRes.reason, "Unable to load salary increment history"));
      }

      setLoadingData(false);
    },
    [companyCode, loginid, toast],
  );

  useEffect(() => {
    let cancelled = false;
    void loadEmployeeData(employeeDetail.emp_id, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [employeeDetail.emp_id, loadEmployeeData]);

  // ---------- ADD / EDIT / DELETE ROW HANDLERS ----------
  const openAddForm = useCallback(() => {
    setEditingRow(null);
    setLineFormOpen(true);
  }, []);

  const openEditForm = useCallback((row: SalaryIncrementRow) => {
    setEditingRow(row);
    setLineFormOpen(true);
  }, []);

  const closeLineForm = () => {
    setLineFormOpen(false);
    setEditingRow(null);
  };

  const handleLineSave = (row: SalaryIncrementRow) => {
    setIncrementRows((prev) => {
      const exists = prev.some((r) => r._rowKey === row._rowKey);
      return exists ? prev.map((r) => (r._rowKey === row._rowKey ? row : r)) : [...prev, row];
    });
    closeLineForm();
  };

  const handleDeleteRow = useCallback((rowKey: string) => {
    setIncrementRows((prev) => prev.filter((r) => r._rowKey !== rowKey));
  }, []);

  // ---------- SAVE (insert + update full grid) ----------
  const canSave = employeeSelected && incrementRows.length > 0;

  const handleSaveAll = async () => {
    if (!canSave) return;
    if (!companyCode) {
      toast.warning("Company code is missing. Please re-login.");
      return;
    }

    setSaving(true);
    try {
      const payload = incrementRows.map((r) => ({
        company_code: companyCode,
        employee_id: employeeDetail.emp_id,
        slno: r.slno,
        pay_comp_id: r.pay_comp_id,
        increment_type: r.increment_type,
        trn_type: Number(r.trn_type),
        incr_perc: r.incr_perc,
        incr_amount: r.incr_amount,
        effective_date: r.effective_date,
        arrears_flag: r.arrears_flag,
        arrears_amt: r.arrears_amt,
        approval_status: r.approval_status,
        status_flag: r.status_flag,
        remarks: r.remarks,
        is_new: r.is_new,
        revised_by: loginid,
        user_id: loginid,
        posted: r.posted || "N",
      }));

      const response = await api.post<ApiResponse>("/api/finance/insUpdEmpSalaryIncrement", payload);
      if (response.data?.success === false) {
        throw new Error(
          response.data.details || response.data.message || "Unable to save salary increments",
        );
      }

      toast.success("Salary increment saved successfully");
      await loadEmployeeData(employeeDetail.emp_id);
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to save salary increments"));
    } finally {
      setSaving(false);
    }
  };

  // ---------- COLUMNS ----------
  const currentSalaryColumns = useMemo<ColumnDef<CurrentSalaryRow>[]>(
    () => [
      { accessorKey: "pay_comp_id", header: "Pay Unit", size: 160, enableSorting: false },
      {
        accessorKey: "pay_comp_amt",
        header: "Amount",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => <span className="tabular-nums">{fmtAmount(getValue())}</span>,
      },
      { accessorKey: "pay_comp_earn_ded", header: "Earnings/Deduction", size: 160, enableSorting: false },
      { accessorKey: "comp_status", header: "Status", size: 110, enableSorting: false },
      { accessorKey: "approved_on", header: "Approved On", size: 120, enableSorting: false },
    ],
    [],
  );

  const incrementColumns = useMemo<ColumnDef<SalaryIncrementRow>[]>(
    () => [
      {
        id: "sno",
        header: "SNo",
        size: 55,
        enableSorting: false,
        cell: ({ row }) => <span className="text-xs font-medium text-muted-foreground">{row.index + 1}</span>,
      },
      { accessorKey: "pay_comp_name", header: "Pay Unit", size: 170, enableSorting: false },
      {
        accessorKey: "old_pay_comp_amt",
        header: "Old Amount",
        size: 115,
        enableSorting: false,
        cell: ({ getValue }) => <span className="tabular-nums">{fmtAmount(getValue())}</span>,
      },
      { accessorKey: "increment_type_desc", header: "Increment Type", size: 150, enableSorting: false },
      { accessorKey: "trn_type_desc", header: "Type", size: 100, enableSorting: false },
      {
        accessorKey: "incr_perc",
        header: "% Amount",
        size: 100,
        enableSorting: false,
        cell: ({ getValue }) => <span className="tabular-nums">{fmtAmount(getValue())}</span>,
      },
      {
        accessorKey: "incr_amount",
        header: "Amount",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => <span className="tabular-nums">{fmtAmount(getValue())}</span>,
      },
      { accessorKey: "effective_date", header: "Effective Date", size: 120, enableSorting: false },
      {
        accessorKey: "arrears_flag",
        header: "Arrears",
        size: 80,
        enableSorting: false,
        cell: ({ getValue }) => (String(getValue()) === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "arrears_amt",
        header: "Arrears Amount",
        size: 125,
        enableSorting: false,
        cell: ({ getValue }) => <span className="tabular-nums">{fmtAmount(getValue())}</span>,
      },
      { accessorKey: "approval_status_desc", header: "Approval Status", size: 140, enableSorting: false },
      { accessorKey: "status_flag_desc", header: "Salary Status", size: 130, enableSorting: false },
      { accessorKey: "doc_no", header: "Doc No", size: 90, enableSorting: false },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditForm(row.original)}
              title="Edit line"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => handleDeleteRow(row.original._rowKey)}
              title="Remove line"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [openEditForm, handleDeleteRow],
  );

  const unsavedCount = incrementRows.filter((r) => r.is_new).length;

  // ---------- Render ----------
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                Employee Salary Increment
              </h1>
              {employeeSelected && (
                <span className="text-xs text-muted-foreground">
                  {employeeDetail.emp_code}
                  {employeeDetail.emp_name ? ` - ${employeeDetail.emp_name}` : ""}
                </span>
              )}
              {unsavedCount > 0 && (
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {unsavedCount} unsaved
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadEmployeeData(employeeDetail.emp_id)}
            disabled={!employeeSelected || loadingData || saving}
          >
            {loadingData ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveAll()} disabled={!canSave || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Org-structure filter cascade */}
      <CollapsibleSection title="Employee Selection" icon={Users}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Division">
            <DynamicDropDown
              type="division"
              value={employeeDetail.div_code}
              displayName={employeeDetail.div_name}
              onChange={handleDivisionChange}
              code1={user?.company_code}
              key={`division-${employeeDetail.div_code}`}
            />
          </Field>

          <Field label="Department">
            <DynamicDropDown
              type="departmentBasedOnDivision"
              value={employeeDetail.dept_code}
              displayName={employeeDetail.dept_name}
              onChange={handleDepartmentChange}
              code1={user?.company_code}
              code2={employeeDetail.div_code}
              disabled={!employeeDetail.div_code}
              key={`department-${employeeDetail.div_code}-${employeeDetail.dept_code}`}
            />
          </Field>

          <Field label="Section">
            <DynamicDropDown
              type="section"
              value={employeeDetail.section_code}
              displayName={employeeDetail.section_name}
              onChange={handleSectionChange}
              disabled={!employeeDetail.dept_code}
              code1={employeeDetail.div_code || undefined}
              code2={employeeDetail.dept_code || undefined}
              code3={user?.company_code || undefined}
              key={`section-${employeeDetail.div_code}-${employeeDetail.dept_code}-${employeeDetail.section_code}`}
            />
          </Field>

          <Field label="Employee" required>
            <DynamicDropDown
              type="employee"
              value={employeeDetail.emp_id}
              displayName={employeeDetail.emp_name}
              onChange={handleEmployeeChange}
              code1={employeeDetail.div_code || undefined}
              code2={employeeDetail.dept_code || undefined}
              code3={employeeDetail.section_code || undefined}
              code4={user?.company_code || undefined}
              key={`employee-${employeeDetail.div_code}-${employeeDetail.dept_code}-${employeeDetail.section_code}-${employeeDetail.emp_id}`}
            />
          </Field>
        </div>
      </CollapsibleSection>

      {employeeSelected && (
        <>
          <CollapsibleSection title={`Current Salary (${currentSalary.length})`} icon={Wallet}>
            <DataTable
              columns={currentSalaryColumns}
              data={currentSalary}
              loading={loadingData}
              emptyText="No salary components found"
              height={200}
              minWidth={680}
              density="grid"
              getRowId={(row, index) => `${row.pay_comp_id}-${index}`}
            />
          </CollapsibleSection>

          {lineFormOpen && (
            <SalaryIncrementLineForm
              key={editingRow?._rowKey ?? "new"}
              initialRow={editingRow}
              onClose={closeLineForm}
              onSave={handleLineSave}
              companyCode={user?.company_code}
            />
          )}

          <CollapsibleSection title={`Salary Increment (${incrementRows.length})`} icon={ListChecks}>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Add or edit lines, then press Save to apply them.
                </div>
                <Button type="button" size="sm" variant="outline" onClick={openAddForm}>
                  <Plus size={14} /> Add Row
                </Button>
              </div>

              <DataTable
                columns={incrementColumns}
                data={incrementRows}
                loading={loadingData}
                getRowId={(row) => row._rowKey}
                emptyText="No increment rows. Click Add Row to apply an increment or decrement."
                height={280}
                minWidth={1500}
                density="grid"
              />
            </div>
          </CollapsibleSection>
        </>
      )}

    </section>
  );
}