import { useState, useCallback, useEffect, FormEvent } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { DynamicDropDown } from "./api/DynamicDropDown";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup, LookupRow } from "../../api/lookups";
import { DataTable } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import NoticeToast, { ToastNotice } from "../../components/ui/NoticeToast";
import { api } from "../../api/client";

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

function makeRowKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
    arrears_flag: (String(r.arrears_flag ?? "N") as "Y" | "N"),
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
// Add/Edit Row Dialog — styled to match LeaveEncashmentPage's LeaveLineEditor
// (Dialog component, 2-column form grid, h-8/text-sm fields).
// ---------------------------------------------------------------------------

interface AddSalaryIncrementDialogProps {
  open: boolean;
  initialRow?: SalaryIncrementRow | null;
  onClose: () => void;
  onSave: (row: SalaryIncrementRow) => void;
  companyCode?: string;
}

function AddSalaryIncrementDialog({
  open,
  initialRow,
  onClose,
  onSave,
  companyCode,
}: AddSalaryIncrementDialogProps) {
  const isEditing = Boolean(initialRow);

  const buildInitialForm = useCallback(
    (): SalaryIncrementRow => ({
      _rowKey: initialRow?._rowKey ?? makeRowKey(),
      is_new: initialRow?.is_new ?? true,
      slno: initialRow?.slno ?? null,
      ...EMPTY_INCREMENT_ROW,
      ...(initialRow ?? {}),
    }),
    [initialRow],
  );

  const [form, setForm] = useState<SalaryIncrementRow>(buildInitialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm());
      setError("");
    }
  }, [open, buildInitialForm]);

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
      setError("Pay Unit, Increment Type, Type, and Effective Date are required");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog
      open={open}
      title={isEditing ? "Edit Salary Increment Line" : "Add Salary Increment Line"}
      description="Apply an increment or decrement against a pay component"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          <Button type="submit" form="salary-increment-line-form">
            <Save size={14} /> {isEditing ? "Save Changes" : "Add Line"}
          </Button>
        </>
      }
    >
      <form
        id="salary-increment-line-form"
        className="grid grid-cols-2 gap-x-4 gap-y-2"
        onSubmit={submit}
      >
        {/* Row 1: Pay Unit (full width) */}
        <label className="field col-span-2">
          <span className="text-xs font-medium">Pay Unit *</span>
          <DynamicDropDown
            type="payComponent"
            value={form.pay_comp_id}
            displayName={form.pay_comp_name}
            onChange={handlePayUnitChange}
            code1={companyCode}
          />
        </label>

        {/* Row 2: Increment Type + Type */}
        <label className="field">
          <span className="text-xs font-medium">Increment Type *</span>
          <DynamicDropDown
            type="dddwIncrementStatus"
            value={form.increment_type}
            displayName={form.increment_type_desc}
            onChange={handleIncrementTypeChange}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Type *</span>
          <select
            className="ui-input h-8 rounded-md border px-2 text-sm"
            value={form.trn_type}
            onChange={handleTrnTypeChange}
          >
            <option value="">Select</option>
            {INCREMENT_TRN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.display}
              </option>
            ))}
          </select>
        </label>

        {/* Row 3: % Amount + Amount */}
        <label className="field">
          <span className="text-xs font-medium">% Amount</span>
          <Input
            type="number"
            className="h-8 text-sm"
            value={form.incr_perc}
            onChange={(e) => update("incr_perc", Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Amount</span>
          <Input
            type="number"
            className="h-8 text-sm"
            value={form.incr_amount}
            onChange={(e) => update("incr_amount", Number(e.target.value))}
          />
        </label>

        {/* Row 4: Effective Date + Arrears flag */}
        <label className="field">
          <span className="text-xs font-medium">Effective Date *</span>
          <Input
            type="date"
            className="h-8 text-sm"
            value={form.effective_date}
            onChange={(e) => update("effective_date", e.target.value)}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Arrears (Y/N)</span>
          <select
            className="ui-input h-8 rounded-md border px-2 text-sm"
            value={form.arrears_flag}
            onChange={(e) => update("arrears_flag", e.target.value as "Y" | "N")}
          >
            <option value="N">No</option>
            <option value="Y">Yes</option>
          </select>
        </label>

        {/* Row 5: Arrears amount (conditional) + Approval Status */}
        {form.arrears_flag === "Y" ? (
          <label className="field">
            <span className="text-xs font-medium">Arrears Amount</span>
            <Input
              type="number"
              className="h-8 text-sm"
              value={form.arrears_amt}
              onChange={(e) => update("arrears_amt", Number(e.target.value))}
            />
          </label>
        ) : (
          <div />
        )}

        <label className="field">
          <span className="text-xs font-medium">Approval Status</span>
          <DynamicDropDown
            type="dddwStatusFlag"
            value={form.approval_status}
            displayName={form.approval_status_desc}
            onChange={handleApprovalStatusChange}
          />
        </label>

        {/* Row 6: Salary Status + Remarks */}
        <label className="field">
          <span className="text-xs font-medium">Salary Status</span>
          <DynamicDropDown
            type="dddwStatusFlag"
            value={form.status_flag}
            displayName={form.status_flag_desc}
            onChange={handleStatusFlagChange}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Remarks</span>
          <Input
            className="h-8 text-sm"
            value={form.remarks ?? ""}
            onChange={(e) => update("remarks", e.target.value)}
          />
        </label>

        {error && <div className="alert error col-span-2 text-sm">{error}</div>}
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EmployeeSalaryIncrement() {
  const { user } = useAuth();

  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetailState>(EMPTY_STATE);
  const [currentSalary, setCurrentSalary] = useState<CurrentSalaryRow[]>([]);
  const [incrementRows, setIncrementRows] = useState<SalaryIncrementRow[]>([]);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const [modalOpen, setModalOpen] = useState(false);
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
    setCurrentSalary([]);
    setIncrementRows([]);
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
    setCurrentSalary([]);
    setIncrementRows([]);
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
    setCurrentSalary([]);
    setIncrementRows([]);
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

  // ---------- LOAD CURRENT SALARY (proc_build_dynamic_sql_common) ----------
  useEffect(() => {
    if (!employeeDetail.emp_id || !user?.company_code) {
      setCurrentSalary([]);
      return;
    }

    let cancelled = false;
    setLoadingSalary(true);

    getDynamicLookup({
      parameter: PARAM.CURRENT_SALARY,
      loginid: user.loginid,
      code1: user.company_code,
      code2: employeeDetail.emp_id,
    })
      .then((rows) => {
        if (cancelled) return;
        const mapped = (rows as LookupRow[])
          .map(mapLookupRowToCurrentSalaryRow)
          .sort((a, b) => a.sort_order - b.sort_order);
        setCurrentSalary(mapped);
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrentSalary([]);
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Unable to load current salary",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSalary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeDetail.emp_id, user?.company_code, user?.loginid]);

  // ---------- LOAD EXISTING (UNPOSTED) INCREMENT ROWS WHEN EMPLOYEE SELECTED ----------
  useEffect(() => {
    if (!employeeDetail.emp_id || !user?.company_code) {
      setIncrementRows([]);
      return;
    }

    let cancelled = false;

    getDynamicLookup({
      parameter: PARAM.SALARY_INCREMENT,
      loginid: user.loginid,
      code1: user.company_code,
      code2: employeeDetail.emp_id,
    })
      .then((rows) => {
        if (cancelled) return;
        setIncrementRows((rows as LookupRow[]).map(mapLookupRowToIncrementRow));
      })
      .catch((error) => {
        if (!cancelled) {
          setIncrementRows([]);
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Unable to load salary increment history",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [employeeDetail.emp_id, user?.company_code, user?.loginid]);

  // ---------- ADD / EDIT / DELETE ROW HANDLERS ----------
  const openAddModal = () => {
    setEditingRow(null);
    setModalOpen(true);
  };

  const openEditModal = (row: SalaryIncrementRow) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const handleModalSave = (row: SalaryIncrementRow) => {
    setIncrementRows((prev) => {
      const exists = prev.some((r) => r._rowKey === row._rowKey);
      return exists ? prev.map((r) => (r._rowKey === row._rowKey ? row : r)) : [...prev, row];
    });
    setModalOpen(false);
    setEditingRow(null);
  };

  const handleDeleteRow = (rowKey: string) => {
    setIncrementRows((prev) => prev.filter((r) => r._rowKey !== rowKey));
  };

  // ---------- SAVE (insert + update full grid) ----------
  const canSave = employeeSelected && incrementRows.length > 0;

  const handleSaveAll = async () => {
    if (!canSave || !user?.company_code) return;

    setSaving(true);
    setNotice(null);
    try {
    const payload = incrementRows.map((r) => ({
      company_code: user.company_code,
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
      revised_by: user.loginid,
      user_id: user.loginid,
      posted : 'N',
    }));

    await api.post("/api/finance/insUpdEmpSalaryIncrement", payload);


      const [salaryRows, incrementLookupRows] = await Promise.all([
        getDynamicLookup({
          parameter: PARAM.CURRENT_SALARY,
          loginid: user.loginid,
          code1: user.company_code,
          code2: employeeDetail.emp_id,
        }),
        getDynamicLookup({
          parameter: PARAM.SALARY_INCREMENT,
          loginid: user.loginid,
          code1: user.company_code,
          code2: employeeDetail.emp_id,
        }),
      ]);
      setCurrentSalary(
        (salaryRows as LookupRow[])
          .map(mapLookupRowToCurrentSalaryRow)
          .sort((a, b) => a.sort_order - b.sort_order),
      );
      setIncrementRows((incrementLookupRows as LookupRow[]).map(mapLookupRowToIncrementRow));
      setNotice({ type: "success", message: "Salary increment saved successfully" });
    } catch (err) {
      setNotice({ type: "error", message: "Unable to save salary increments" });
    } finally {
      setSaving(false);
    }
  };

  // ---------- COLUMNS ----------
  const currentSalaryColumns: ColumnDef<CurrentSalaryRow>[] = [
    { accessorKey: "pay_comp_id", header: "Pay Unit" },
    { accessorKey: "pay_comp_amt", header: "Amount" },
    { accessorKey: "pay_comp_earn_ded", header: "Earnings/Deduction" },
    { accessorKey: "comp_status", header: "Status" },
    { accessorKey: "approved_on", header: "Approved On" },
  ];

  const incrementColumns: ColumnDef<SalaryIncrementRow>[] = [
    { accessorKey: "pay_comp_name", header: "Pay Unit" },
    { accessorKey: "old_pay_comp_amt", header: "Old Amount" },
    { accessorKey: "increment_type_desc", header: "Increment Type" },
    { accessorKey: "trn_type_desc", header: "Type" },
    { accessorKey: "incr_perc", header: "% Amount" },
    { accessorKey: "incr_amount", header: "Amount" },
    { accessorKey: "effective_date", header: "Effective Date" },
    { accessorKey: "arrears_flag", header: "Arrears (Y/N)" },
    { accessorKey: "arrears_amt", header: "Arrears Amount" },
    { accessorKey: "approval_status_desc", header: "Approval Status" },
    { accessorKey: "status_flag_desc", header: "Salary Status" },
    { accessorKey: "doc_no", header: "Doc No" },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => openEditModal(row.original)}>
            <Pencil size={14} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => handleDeleteRow(row.original._rowKey)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  // ---------- Render — mirrors LeaveEncashmentPage's compact card layout ----------
  return (
    <section className="grid gap-2">
      {/* Page title + actions — compact */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="m-0 text-lg font-semibold tracking-tight">Employee Salary Increment</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {employeeSelected && (
            <Button size="sm" onClick={openAddModal}>
              <Plus size={13} /> Add
            </Button>
          )}
          <Button size="sm" disabled={!canSave || saving} onClick={() => void handleSaveAll()}>
            <Save size={13} /> Save
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Org-structure filter cascade — compact padding, matches Leave page */}
      <div className="rounded-md border bg-white p-2">
        <p className="eyebrow mb-1.5 text-xs">Employee Selection</p>
        <div className="grid gap-2 md:grid-cols-4">
          <label className="field">
            <span className="text-xs">Division *</span>
            <DynamicDropDown
              type="division"
              value={employeeDetail.div_code}
              displayName={employeeDetail.div_name}
              onChange={handleDivisionChange}
              code1={user?.company_code}
              key={`division-${employeeDetail.div_code}`}
            />
          </label>

          <label className="field">
            <span className="text-xs">Department *</span>
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
          </label>

          <label className="field">
            <span className="text-xs">Section *</span>
            <DynamicDropDown
              type="section"
              value={employeeDetail.section_code}
              displayName={employeeDetail.section_name}
              onChange={handleSectionChange}
              disabled={!employeeDetail.dept_code}
              key={`section-${employeeDetail.div_code}-${employeeDetail.dept_code}-${employeeDetail.section_code}`}
            />
          </label>

          <label className="field">
            <span className="text-xs">Employee *</span>
            <DynamicDropDown
              type="employee"
              value={employeeDetail.emp_id}
              displayName={employeeDetail.emp_name}
              onChange={handleEmployeeChange}
              code1={employeeDetail.div_code || undefined}
              code2={employeeDetail.dept_code || undefined}
              code3={employeeDetail.section_code || undefined}
              key={`employee-${employeeDetail.div_code}-${employeeDetail.dept_code}-${employeeDetail.section_code}-${employeeDetail.emp_id}`}
            />
          </label>
        </div>
      </div>

      {employeeSelected && (
        <>
          {/* Current Salary — compact card, same shape as Leave Balance card */}
          <div className="rounded-md border bg-white">
            <div className="border-b px-3 py-1.5">
              <p className="eyebrow m-0 text-xs">Current Salary</p>
            </div>
            <DataTable
              columns={currentSalaryColumns}
              data={currentSalary}
              loading={loadingSalary}
              height={200}
              density="compact"
              emptyText="No salary components found"
            />
          </div>

          {/* Salary Increment lines — same shape as Detail Lines grid */}
          <div className="rounded-md border bg-white">
            <div className="border-b px-3 py-1.5">
              <p className="eyebrow m-0 text-xs">Salary Increment</p>
            </div>
            <DataTable
              columns={incrementColumns}
              data={incrementRows}
              getRowId={(row) => row._rowKey}
              height={240}
              density="compact"
              emptyText="No increment rows added — use Add to apply an increment or decrement"
            />
          </div>
        </>
      )}

      <AddSalaryIncrementDialog
        open={modalOpen}
        initialRow={editingRow}
        onClose={() => {
          setModalOpen(false);
          setEditingRow(null);
        }}
        onSave={handleModalSave}
        companyCode={user?.company_code}
      />
    </section>
  );
}