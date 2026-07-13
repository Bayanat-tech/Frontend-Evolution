    import { Edit2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
// import AddEmployeeHrForm from "components/forms/HR/Masters/Employee/AddEmployeeHrForm";
import { TEmployeeHr } from "./employee-hr.types";
import { getDynamicLookup } from "../../../api/lookups";
import AddEmployeeHrForm from "./AddEmployeeHrForm";

export function EmployeeMasterPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<TEmployeeHr[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [existingData, setExistingData] = useState<Partial<TEmployeeHr>>({});

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TEmployeeHr | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    try {
      const response = await getDynamicLookup({
        parameter: "HR_TRANSACTIONS_MS_HR_EMPLOYEE",
        loginid: user?.loginid ?? "",
        code1: user?.company_code,
        code2: user?.loginid ?? "",
      });
      const tableData = (Array.isArray(response) ? response : []) as Record<string, unknown>[];
        setRows(tableData.map(mapEmployeeHr));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  const openAdd = () => {
    setEditMode(false);
    setExistingData({});
    setOpenDialog(true);
  };

  const openEdit = (row: TEmployeeHr) => {
    setEditMode(true);
    setExistingData(row);
    setOpenDialog(true);
  };

  const closeDialog = (refetch?: boolean) => {
    setOpenDialog(false);
    setExistingData({});
    setEditMode(false);
    if (refetch) void loadRows();
  };

  const requestDelete = (row: TEmployeeHr) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      toast.success("Employee deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete employee");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (value: unknown) => {
  if (!value) return "";
  const d = new Date(value as string | Date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

  const columns = useMemo<ColumnDef<TEmployeeHr>[]>(
    () => [
      { accessorKey: "rpt_name", header: "Employee Name", size: 270 },
      { accessorKey: "desg_code", header: "Designation", size: 80 },
      { accessorKey: "join_date", header: "Join Date", size: 100 , cell: ({getValue})=>formatDate(getValue())},
      { accessorKey: "dept_code", header: "Department", size: 80 },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit employee">
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => requestDelete(row.original)} title="Delete employee">
              <Trash2 size={14} />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">HR Master</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Employee Master</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Employee
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Employees`}
        subtitle="Employee Master List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search employee, designation..."
        loading={loading}
        emptyText="No Employee found"
        height={620}
        minWidth={900}
        density="grid"
        getRowId={(row) => `${row.employee_code}-${row.employee_id}-${row.join_date}`}
      />

      {/* ── Add / Edit Form Dialog ── */}
      <Dialog
        open={openDialog}
        title={editMode ? "Edit Employee Details" : "Add Employee Details"}
        description="Employee information"
        compact
        wide
        onClose={() => closeDialog()}
      >
        <AddEmployeeHrForm
        onClose={() => closeDialog(true)}
        isEditMode={editMode}
        employee_code={existingData.employee_code ?? ""}
        existingData={editMode ? (existingData as TEmployeeHr) : undefined}
        />
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog
        open={deleteOpen}
        title="Delete Employee"
        description={deleteTarget ? `Delete ${deleteTarget.rpt_name}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={deleting} variant="destructive" onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p className="m-0 text-sm text-muted-foreground">Are you sure you want to delete?</p>
        </div>
      </Dialog>
    </section>
  );
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date(0);
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  return toDate(value);
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function mapEmployeeHr(row: Record<string, unknown>): TEmployeeHr {
  return {
    // TPersnolHr
    company_code: text(row.company_code ?? row.COMPANY_CODE),
    employer_code: text(row.employer_code ?? row.EMPLOYER_CODE),
    section_code: text(row.section_code ?? row.SECTION_CODE),
    dept_code: text(row.dept_code ?? row.DEPT_CODE),
    div_code: text(row.div_code ?? row.DIV_CODE),
    emp_photo: text(row.emp_photo ?? row.EMP_PHOTO),
    employee_id: text(row.employee_id ?? row.EMPLOYEE_ID),
    employee_code: text(row.employee_code ?? row.EMPLOYEE_CODE),
    alternate_id: text(row.alternate_id ?? row.ALTERNATE_ID),
    rpt_name: text(row.rpt_name ?? row.RPT_NAME),
    grade_code: text(row.grade_code ?? row.GRADE_CODE),
    desg_code: text(row.desg_code ?? row.DESG_CODE),
    labour_desg_code: text(row.labour_desg_code ?? row.LABOUR_DESG_CODE),
    category_code: text(row.category_code ?? row.CATEGORY_CODE),
    birth_date: toDate(row.birth_date ?? row.DOB),
    join_date: toDate(row.join_date ?? row.JOIN_DATE),
    probation_end_date: toDate(row.probation_end_date ?? row.PROBATION_END_DATE),
    probation_confirm_date: toDate(row.probation_confirm_date ?? row.PROBATION_CONFIRM_DATE),
    emp_status: text(row.emp_status ?? row.EMP_STATUS),
    country_code: text(row.country_code ?? row.PPT_COUNTRY),

    // TPayrollHr
    include_in_payroll: text(row.include_in_payroll ?? row.INCLUDE_IN_PAYROLL),
    payroll_start_date: toDate(row.payroll_start_date ?? row.COMP_PAYROLL_DATE),
    payment_mode: text(row.payment_mode ?? row.PAYMENT_MODE),
    company_bank_code: text(row.company_bank_code ?? row.COMPANY_BANK_CODE),
    salary_acct_no: text(row.salary_acct_no ?? row.SALARY_ACCT_NO),
    salary_bank_code: text(row.salary_bank_code ?? row.SALARY_BANK_CODE),
    currency_id: text(row.currency_id ?? row.CURR_CODE),
    exch_rate: num(row.exch_rate ?? row.EX_RATE),
    emp_iban_no: text(row.emp_iban_no ?? row.IBAN_NO),

    // TPassportHr
    ppt_no: text(row.ppt_no ?? row.PASSPORT_NO),
    ppt_name: text(row.ppt_name ?? row.PASSPORT_NAME),
    ppt_country: text(row.ppt_country ?? row.PPT_COUNTRY),
    ppt_status: text(row.ppt_status ?? row.PPT_STATUS),
    ppt_valid_from: toDate(row.ppt_valid_from ?? row.PPT_VALID_FROM),
    ppt_valid_to: toDate(row.ppt_valid_to ?? row.PPT_VALID_TO),
    passport_with: text(row.passport_with ?? row.PPT_WITH),

    // TContractHr
    contract_type: text(row.contract_type ?? row.CONTRACT_TYPE),
    contract_start_date: toDate(row.contract_start_date ?? row.CONTRACT_START_DATE),
    contract_end_date: toNullableDate(row.contract_end_date ?? row.CONTRACT_END_DATE),
    contract_renewable: text(row.contract_renewable ?? row.CONTRACT_RENEW),
    contract_type_desc: text(row.contract_type_desc ?? row.CONTRACT_TYPE_DESC),

    // TSponsorHr
    sponsor_id: text(row.sponsor_id ?? row.SPONSOR_ID),
    visa_type: text(row.visa_type ?? row.SPONSOR_VISA_TYPE),
    visa_valid_from: toDate(row.visa_valid_from ?? row.SPONSOR_VISA_FROM_DT),
    visa_valid_to: toNullableDate(row.visa_valid_to ?? row.SPONSOR_VISA_TO_DT),

    // TIsuranceHr
    ins_card_no: text(row.ins_card_no ?? row.INS_CARD_NO),
    ins_card_issue_dt: toDate(row.ins_card_issue_dt ?? row.INS_CARD_ISSUE_DT),
    ins_card_exp_dt: toDate(row.ins_card_exp_dt ?? row.INS_CARD_EXP_DT),
    ins_card_type: text(row.ins_card_type ?? row.INS_CARD_TYPE),

    // TILPHr
    labourcard_no: text(row.labourcard_no ?? row.LABOUR_CARD_NO),
    pasi_no: text(row.pasi_no ?? row.PASI_NO),
    labourcard_valid_from: toDate(row.labourcard_valid_from),
    labourcard_valid_to: toDate(row.labourcard_valid_to),
    labourcard_status: text(row.labourcard_status),

    // TAirfareHr
    airport_code: text(row.airport_code ?? row.AIRPORT_CODE),
    ticket_eligibility: text(row.ticket_eligibility),
    ticket_dpend_adult: num(row.ticket_dpend_adult ?? row.ADULT_FARE),
    ta_no: num(row.ta_no),
    tc_no: num(row.tc_no),
    ti_no: num(row.ti_no),
    ticket_eligible_period: num(row.ticket_eligible_period),

    actions: undefined,
  };
}

export default EmployeeMasterPage;