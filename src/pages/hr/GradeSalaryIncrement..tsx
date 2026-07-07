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
// Lookup procedure parameter names (proc_build_dynamic_grade_salary_increment)
// ---------------------------------------------------------------------------

const PARAM = {
  CURRENT_PAY_UNIT: "GRADE_SALARY_INCREMENT_CURRENT_PAY_UNIT",
  // NOTE: this parameter name is defined exactly this way inside
  // PROC_BUILD_DYNAMIC_GRADE_SALARY_INCREMENT (looks like a copy/paste leftover
  // from the employee-level procedure). Kept verbatim so the lookup resolves —
  // flag with the backend team to rename to GRADE_SALARY_INCREMENT_PAY_UNIT_INCREMENT
  // for consistency.
  PAY_UNIT_INCREMENT: "GRADE_SALARY_INCREMENT_PAY_UNIT_INCREMENT",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GradeDetailState {
  grade_code: string;
  grade_name: string;
}

const EMPTY_GRADE: GradeDetailState = {
  grade_code: "",
  grade_name: "",
};

interface CurrentPayUnitRow {
  pay_comp_id: string;
  pay_comp_name: string;
  min_pay_amt: number;
  medium_pay_amt: number;
  max_pay_amt: number;
  approval_status: string;
  status: string;
}

function mapLookupRowToCurrentPayUnitRow(r: LookupRow): CurrentPayUnitRow {
  return {
    pay_comp_id: String(r.pay_comp_id ?? ""),
    pay_comp_name: String((r as any).pay_comp_name ?? r.pay_comp_id ?? ""),
    min_pay_amt: Number(r.min_pay_amt ?? 0),
    medium_pay_amt: Number(r.medium_pay_amt ?? 0),
    max_pay_amt: Number(r.max_pay_amt ?? 0),
    approval_status: String(r.approval_status ?? ""),
    status: String(r.status ?? ""),
  };
}

interface GradeIncrementRow {
  _rowKey: string;
  is_new: boolean;
  slno: number | null;

  pay_comp_id: string;
  pay_comp_name: string;

  old_grade_amt: number;

  increment_type: string;
  increment_type_desc: string;

  perc_increment: number;
  amt_increment: number;

  effective_date: string;
  actual_effective_date: string;
  arrears_flag: "Y" | "N";
  arrears_amt: number;
  arrears_percent: number;

  approval_status: string;
  approval_status_desc: string;

  status: string;
  status_desc: string;

  incremented_by: string;
  incremented_on: string;
  approved_by: string;
  approved_on: string;
  verified_by: string;
  verified_on: string;

  posted: string;
  remarks?: string;
}

const EMPTY_INCREMENT_ROW: Omit<GradeIncrementRow, "_rowKey" | "is_new" | "slno"> = {
  pay_comp_id: "",
  pay_comp_name: "",
  old_grade_amt: 0,
  increment_type: "",
  increment_type_desc: "",
  perc_increment: 0,
  amt_increment: 0,
  effective_date: "",
  actual_effective_date: "",
  arrears_flag: "N",
  arrears_amt: 0,
  arrears_percent: 0,
  approval_status: "",
  approval_status_desc: "",
  status: "",
  status_desc: "",
  incremented_by: "",
  incremented_on: "",
  approved_by: "",
  approved_on: "",
  verified_by: "",
  verified_on: "",
  posted: "",
  remarks: "",
};

function makeRowKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function mapLookupRowToIncrementRow(r: LookupRow): GradeIncrementRow {
  return {
    _rowKey: makeRowKey(),
    is_new: false,
    slno: r.slno != null ? Number(r.slno) : null,
    pay_comp_id: String(r.pay_comp_id ?? ""),
    pay_comp_name: String((r as any).pay_comp_name ?? r.pay_comp_id ?? ""),
    old_grade_amt: Number(r.old_grade_amt ?? 0),
    increment_type: String(r.increment_type ?? ""),
    increment_type_desc: String((r as any).increment_type_desc ?? ""),
    perc_increment: Number(r.perc_increment ?? 0),
    amt_increment: Number(r.amt_increment ?? 0),
    effective_date: r.effective_date ? String(r.effective_date).slice(0, 10) : "",
    actual_effective_date: r.actual_effective_date ? String(r.actual_effective_date).slice(0, 10) : "",
    arrears_flag: (String(r.arrears_flag ?? "N") as "Y" | "N"),
    arrears_amt: Number(r.arrears_amt ?? 0),
    arrears_percent: Number(r.arrears_percent ?? 0),
    approval_status: String(r.approval_status ?? ""),
    approval_status_desc: String((r as any).approval_status_desc ?? ""),
    status: String(r.status ?? ""),
    status_desc: String((r as any).status_desc ?? ""),
    incremented_by: String(r.incremented_by ?? ""),
    incremented_on: r.incremented_on ? String(r.incremented_on).slice(0, 10) : "",
    approved_by: String(r.approved_by ?? ""),
    approved_on: r.approved_on ? String(r.approved_on).slice(0, 10) : "",
    verified_by: String(r.verified_by ?? ""),
    verified_on: r.verified_on ? String(r.verified_on).slice(0, 10) : "",
    posted: String(r.posted ?? ""),
    remarks: r.remarks != null ? String(r.remarks) : "",
  };
}

// ---------------------------------------------------------------------------
// Add/Edit Row Dialog — styled to match EmployeeSalaryIncrement's
// AddSalaryIncrementDialog (Dialog component, 2-column form grid, h-8/text-sm).
// Note: unlike the employee-level grid, HR_GRADE_SALARY_INCREMENTS has no
// TRN_TYPE (Increment/Decrement) column, so there is no "Type" selector here.
// ---------------------------------------------------------------------------

interface AddGradeIncrementDialogProps {
  open: boolean;
  initialRow?: GradeIncrementRow | null;
  onClose: () => void;
  onSave: (row: GradeIncrementRow) => void;
  companyCode?: string;
  gradeCode?: string;
}

function AddGradeIncrementDialog({
  open,
  initialRow,
  onClose,
  onSave,
  companyCode,
  gradeCode,
}: AddGradeIncrementDialogProps) {
  const isEditing = Boolean(initialRow);

  const buildInitialForm = useCallback(
    (): GradeIncrementRow => ({
      _rowKey: initialRow?._rowKey ?? makeRowKey(),
      is_new: initialRow?.is_new ?? true,
      slno: initialRow?.slno ?? null,
      ...EMPTY_INCREMENT_ROW,
      ...(initialRow ?? {}),
    }),
    [initialRow],
  );

  const [form, setForm] = useState<GradeIncrementRow>(buildInitialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm());
      setError("");
    }
  }, [open, buildInitialForm]);

  const update = <K extends keyof GradeIncrementRow>(key: K, value: GradeIncrementRow[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.pay_comp_id || !form.effective_date) {
      setError("Pay Unit and Effective Date are required");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog
      open={open}
      title={isEditing ? "Edit Pay Unit Increment" : "Add Pay Unit Increment"}
      description="Apply an increment against a grade pay unit"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          <Button type="submit" form="grade-increment-line-form">
            <Save size={14} /> {isEditing ? "Save Changes" : "Add Line"}
          </Button>
        </>
      }
    >
      <form
        id="grade-increment-line-form"
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
            code2={gradeCode}
          />
        </label>

        {/* Row 2: Increment Type + % Increment */}
        <label className="field">
          <span className="text-xs font-medium">Increment Type</span>
          <DynamicDropDown
            type="dddwIncrementStatus"
            value={form.increment_type}
            displayName={form.increment_type_desc}
            onChange={handleIncrementTypeChange}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">% Increment</span>
          <Input
            type="number"
            className="h-8 text-sm"
            value={form.perc_increment}
            onChange={(e) => update("perc_increment", Number(e.target.value))}
          />
        </label>

        {/* Row 3: Amount Increment + Effective Date */}
        <label className="field">
          <span className="text-xs font-medium">Amount Increment *</span>
          <Input
            type="number"
            className="h-8 text-sm"
            value={form.amt_increment}
            onChange={(e) => update("amt_increment", Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Effective Date *</span>
          <Input
            type="date"
            className="h-8 text-sm"
            value={form.effective_date}
            onChange={(e) => update("effective_date", e.target.value)}
          />
        </label>

        {/* Row 4: Arrears flag + Arrears amount (conditional) */}
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

        {/* Row 5: Arrears % (conditional) + Approval Status */}
        {form.arrears_flag === "Y" ? (
          <label className="field">
            <span className="text-xs font-medium">Arrears %</span>
            <Input
              type="number"
              className="h-8 text-sm"
              value={form.arrears_percent}
              onChange={(e) => update("arrears_percent", Number(e.target.value))}
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

        {/* Row 6: Remarks (full width) */}
        <label className="field col-span-2">
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

export default function GradeSalaryIncrement() {
  const { user } = useAuth();

  // Company is fixed to the logged-in company (not user-selectable), shown
  // read-only the same way it appears on the WinForms screen.
  const companyDisplayName = (user as any)?.company_name ?? user?.company_code ?? "";

  const [grade, setGrade] = useState<GradeDetailState>(EMPTY_GRADE);
  const [currentPayUnits, setCurrentPayUnits] = useState<CurrentPayUnitRow[]>([]);
  const [incrementRows, setIncrementRows] = useState<GradeIncrementRow[]>([]);
  const [loadingPayUnits, setLoadingPayUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<GradeIncrementRow | null>(null);

  const gradeSelected = Boolean(grade.grade_code);

  // ---------- GRADE ----------
  const handleGradeChange = useCallback((value: string, row: LookupRow | null) => {
    setGrade({
      grade_code: value,
      grade_name: row ? String((row as any).name ?? "") : "",
    });
    setCurrentPayUnits([]);
    setIncrementRows([]);
  }, []);

  // ---------- LOAD CURRENT PAY UNITS (proc_build_dynamic_grade_salary_increment) ----------
  useEffect(() => {
    if (!grade.grade_code || !user?.company_code) {
      setCurrentPayUnits([]);
      return;
    }

    let cancelled = false;
    setLoadingPayUnits(true);

    getDynamicLookup({
      parameter: PARAM.CURRENT_PAY_UNIT,
      loginid: user.loginid,
      code1: user.company_code,
      code2: grade.grade_code,
    })
      .then((rows) => {
        if (cancelled) return;
        setCurrentPayUnits((rows as LookupRow[]).map(mapLookupRowToCurrentPayUnitRow));
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrentPayUnits([]);
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Unable to load current pay units",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPayUnits(false);
      });

    return () => {
      cancelled = true;
    };
  }, [grade.grade_code, user?.company_code, user?.loginid]);

  // ---------- LOAD EXISTING (UNPOSTED) INCREMENT ROWS WHEN GRADE SELECTED ----------
  useEffect(() => {
    if (!grade.grade_code || !user?.company_code) {
      setIncrementRows([]);
      return;
    }

    let cancelled = false;

    getDynamicLookup({
      parameter: PARAM.PAY_UNIT_INCREMENT,
      loginid: user.loginid,
      code1: user.company_code,
      code2: grade.grade_code,
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
            message: error instanceof Error ? error.message : "Unable to load grade increment history",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grade.grade_code, user?.company_code, user?.loginid]);

  // ---------- ADD / EDIT / DELETE ROW HANDLERS ----------
  const openAddModal = () => {
    setEditingRow(null);
    setModalOpen(true);
  };

  const openEditModal = (row: GradeIncrementRow) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const handleModalSave = (row: GradeIncrementRow) => {
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
  // NOTE: unlike the employee-level page, Save stays enabled as soon as a
  // Grade is selected — an empty increment grid is a valid save (e.g. after
  // clearing out lines), so we intentionally do NOT gate on incrementRows.length.
  const canSave = gradeSelected && !saving;

  const handleSaveAll = async () => {
    if (!canSave || !user?.company_code) return;

    setSaving(true);
    setNotice(null);
    try {
      const payload = incrementRows.map((r) => ({
        company_code: user.company_code,
        grade_code: grade.grade_code,
        pay_comp_id: r.pay_comp_id,
        old_grade_amt: r.old_grade_amt,
        perc_increment: r.perc_increment,
        amt_increment: r.amt_increment,
        incremented_by: user.loginid,
        incremented_on: r.incremented_on || null,
        approved_by: r.approved_by || null,
        approved_on: r.approved_on || null,
        arrears_flag: r.arrears_flag,
        arrears_amt: r.arrears_amt,
        arrears_percent: r.arrears_percent,
        effective_date: r.effective_date,
        actual_effective_date: r.actual_effective_date || null,
        verified_by: r.verified_by || null,
        verified_on: r.verified_on || null,
        status: r.status,
        remarks: r.remarks,
        approval_status: r.approval_status,
        posted: "N",
        posted_to_emp_incr: "N",
        slno: r.slno,
        increment_type: r.increment_type,
        is_new: r.is_new,
        user_id: user.loginid,
      }));

      await api.post("/api/finance/insUpdGradeSalaryIncrement", payload);

      const [payUnitRows, incrementLookupRows] = await Promise.all([
        getDynamicLookup({
          parameter: PARAM.CURRENT_PAY_UNIT,
          loginid: user.loginid,
          code1: user.company_code,
          code2: grade.grade_code,
        }),
        getDynamicLookup({
          parameter: PARAM.PAY_UNIT_INCREMENT,
          loginid: user.loginid,
          code1: user.company_code,
          code2: grade.grade_code,
        }),
      ]);
      setCurrentPayUnits((payUnitRows as LookupRow[]).map(mapLookupRowToCurrentPayUnitRow));
      setIncrementRows((incrementLookupRows as LookupRow[]).map(mapLookupRowToIncrementRow));
      setNotice({ type: "success", message: "Grade salary increment saved successfully" });
    } catch (err) {
      setNotice({ type: "error", message: "Unable to save grade salary increments" });
    } finally {
      setSaving(false);
    }
  };

  // ---------- COLUMNS ----------
  const currentPayUnitColumns: ColumnDef<CurrentPayUnitRow>[] = [
    { accessorKey: "pay_comp_id", header: "Pay Unit" },
    { accessorKey: "min_pay_amt", header: "Minimum Amount" },
    { accessorKey: "medium_pay_amt", header: "Medium Amount" },
    { accessorKey: "max_pay_amt", header: "Maximum Amount" },
    { accessorKey: "approval_status", header: "Approval Status" },
    { accessorKey: "status", header: "Pay Unit Status" },
  ];

  const incrementColumns: ColumnDef<GradeIncrementRow>[] = [
    { accessorKey: "pay_comp_name", header: "Pay Unit" },
    { accessorKey: "increment_type_desc", header: "Increment Type" },
    { accessorKey: "perc_increment", header: "% Increment" },
    { accessorKey: "amt_increment", header: "Amount Increment" },
    { accessorKey: "effective_date", header: "Effective Date" },
    { accessorKey: "arrears_flag", header: "Arrears (Y/N)" },
    { accessorKey: "arrears_amt", header: "Arrears Amount" },
    { accessorKey: "approval_status_desc", header: "Approval Status" },
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

  // ---------- Render — mirrors EmployeeSalaryIncrement's compact card layout ----------
  return (
    <section className="grid gap-2">
      {/* Page title + actions — compact */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="m-0 text-lg font-semibold tracking-tight">Grade Salary Increment</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {gradeSelected && (
            <Button size="sm" onClick={openAddModal}>
              <Plus size={13} /> Add
            </Button>
          )}
          <Button size="sm" disabled={!canSave} onClick={() => void handleSaveAll()}>
            <Save size={13} /> Save
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Company / Grade selection — compact padding, matches Employee page */}
      <div className="rounded-md border bg-white p-2">
        <p className="eyebrow mb-1.5 text-xs">HR - Grade Salary Increment</p>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="field">
            <span className="text-xs">Company *</span>
            <Input className="h-8 text-sm" value={companyDisplayName} disabled readOnly />
          </label>

          <label className="field">
            <span className="text-xs">Grade *</span>
            <DynamicDropDown
              type="grade"
              value={grade.grade_code}
              displayName={grade.grade_name}
              onChange={handleGradeChange}
              code1={user?.company_code}
              key={`grade-${grade.grade_code}`}
            />
          </label>
        </div>
      </div>

      {gradeSelected && (
        <>
          {/* Current Pay Units — compact card, same shape as Employee's Current Salary card */}
          <div className="rounded-md border bg-white">
            <div className="border-b px-3 py-1.5">
              <p className="eyebrow m-0 text-xs">Current Pay Units</p>
            </div>
            <DataTable
              columns={currentPayUnitColumns}
              data={currentPayUnits}
              loading={loadingPayUnits}
              height={200}
              density="compact"
              emptyText="No pay units configured for this grade"
            />
          </div>

          {/* Pay Units Increments — same shape as Detail Lines grid */}
          <div className="rounded-md border bg-white">
            <div className="border-b px-3 py-1.5">
              <p className="eyebrow m-0 text-xs">Pay Units Increments</p>
            </div>
            <DataTable
              columns={incrementColumns}
              data={incrementRows}
              getRowId={(row) => row._rowKey}
              height={240}
              density="compact"
              emptyText="No increment rows added — use Add to apply a pay unit increment"
            />
          </div>
        </>
      )}

      <AddGradeIncrementDialog
        open={modalOpen}
        initialRow={editingRow}
        onClose={() => {
          setModalOpen(false);
          setEditingRow(null);
        }}
        onSave={handleModalSave}
        companyCode={user?.company_code}
        gradeCode={grade.grade_code}
      />
    </section>
  );
}