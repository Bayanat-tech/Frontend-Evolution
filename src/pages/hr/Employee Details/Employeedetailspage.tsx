import {
  ArrowLeft, ChevronsDownUp, ChevronsUpDown, Edit2, FileText, Loader2, RefreshCw, Save, UserCog, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { getDynamicLookup } from "../../../api/lookups";
import type { TEmployeeDetails } from "./EmployeeDetails.types";
import EditEmployeeDetailsForm, { type EmployeeFormHandle } from "./Employeedetailform";

// dd/mm/yyyy — used for every date column rendered in the table
function formatDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value as string);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function mapEmployeeDetails(row: Record<string, unknown>): TEmployeeDetails {
  const v = (key: string) => row[key] ?? row[key.toUpperCase()];
  return {
    employee_id: text(v("employee_id")),
    alternate_id: text(v("alternate_id")),
    employee_code: text(v("employee_code")),
    rpt_name: text(v("rpt_name")),
    company_code: text(v("company_code")),
    div_code: text(v("div_code")),
    dept_code: text(v("dept_code")),
    section_code: text(v("section_code")),
    employer_code: text(v("employer_code")),

    title: text(v("title")),
    first_name: text(v("first_name")),
    second_name: text(v("second_name")),
    third_name: text(v("third_name")),
    fourth_name: text(v("fourth_name")),
    last_name: text(v("last_name")),
    family_name: text(v("family_name")),
    alias_name: text(v("alias_name")),

    gender: text(v("gender")),
    birth_date: toDate(v("birth_date")),
    birth_place: text(v("birth_place")),
    father_name: text(v("father_name")),
    mother_name: text(v("mother_name")),
    marrital_status: text(v("marrital_status")),
    spouse_name: text(v("spouse_name")),
    no_of_children: num(v("no_of_children")),
    blood_group: text(v("blood_group")),
    nationality: text(v("nationality")),
    religion_code: text(v("religion_code")),
    caste_code: text(v("caste_code")),
    country_code: text(v("country_code")),
    country_living_in: text(v("country_living_in")),

    ppt_name: text(v("ppt_name")),
    ppt_no: text(v("ppt_no")),
    ppt_country: text(v("ppt_country")),
    ppt_valid_from: toDate(v("ppt_valid_from")),
    ppt_valid_to: toDate(v("ppt_valid_to")),
    ppt_status: text(v("ppt_status")),
    passport_with: text(v("passport_with")),

    phone_office: text(v("phone_office")),
    phone_office_extn: text(v("phone_office_extn")),
    mobile_no: text(v("mobile_no")),
    mobile_no2: text(v("mobile_no2")),
    email_official: text(v("email_official")),
    email_personal: text(v("email_personal")),

    perm_address1: text(v("perm_address1")),
    perm_address2: text(v("perm_address2")),
    perm_address3: text(v("perm_address3")),
    perm_phone: text(v("perm_phone")),
    perm_mobile: text(v("perm_mobile")),

    local_address1: text(v("local_address1")),
    local_address2: text(v("local_address2")),
    local_address3: text(v("local_address3")),
    local_phone: text(v("local_phone")),
    local_mobile: text(v("local_mobile")),

    emgr_address1: text(v("emgr_address1")),
    emgr_address2: text(v("emgr_address2")),
    emgr_address3: text(v("emgr_address3")),
    emgr_phone: text(v("emgr_phone")),
    emgr_mobile: text(v("emgr_mobile")),
    emgr_contact_person: text(v("emgr_contact_person")),

    driving_license_no: text(v("driving_license_no")),
    dl_issue_place: text(v("dl_issue_place")),
    dl_issue_date: toDate(v("dl_issue_date")),
    dl_valid_upto: toDate(v("dl_valid_upto")),

    emp_status: text(v("emp_status")),
    ot_applicable: text(v("ot_applicable")),
    health_expiry: toDate(v("health_expiry")),
    dept_head_emp_id: text(v("dept_head_emp_id")),
    supervisor_empid: text(v("supervisor_empid")),
    manager_code: text(v("manager_code")),

    user_id: text(v("user_id")),
    user_dt: toDate(v("user_dt")),

    actions: undefined,
  };
}

export function EmployeeDetailsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code;

  const [rows, setRows] = useState<TEmployeeDetails[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [activeEmployee, setActiveEmployee] = useState<TEmployeeDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [allOpen, setAllOpen] = useState(false); // mirrors the form's section state

  // Ref to the form so the header buttons can trigger it
  const formRef = useRef<EmployeeFormHandle>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDynamicLookup({
        parameter: "MS_HR_EMPDETAIL_EMPLOYEE",
        loginid,
        code1: companyCode,
      });
      const tableData = (Array.isArray(response) ? response : []) as Record<string, unknown>[];
      setRows(tableData.map(mapEmployeeDetails));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load employee details");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.employee_code, row.rpt_name, row.first_name, row.last_name, row.family_name, row.dept_code, row.section_code]
        .some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [query, rows]);

  /* ── Navigation handlers ── */
  const openEdit = (row: TEmployeeDetails) => {
    setActiveEmployee(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    if (saving) return;
    setView("list");
    setActiveEmployee(null);
  };

  const handleSaved = () => {
    setSaving(false);
    setView("list");
    setActiveEmployee(null);
    void loadRows();
  };

  /* ── Header Save button handler ── */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<TEmployeeDetails>[]>(
    () => [
      { accessorKey: "employee_code", header: "Employee Code", size: 110, enableSorting: false },
      { accessorKey: "rpt_name", header: "Employee Name", size: 220, enableSorting: false },
      { accessorKey: "dept_code", header: "Department", size: 100, enableSorting: false },
      { accessorKey: "section_code", header: "Section", size: 100, enableSorting: false },
      { accessorKey: "mobile_no", header: "Mobile No", size: 120, enableSorting: false },
      { accessorKey: "email_official", header: "Official Email", size: 200, enableSorting: false },
      {
        accessorKey: "birth_date",
        header: "Date of Birth",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      { accessorKey: "emp_status", header: "Status", size: 90, enableSorting: false },
      {
        id: "actions",
        header: "Actions",
        size: 70,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEdit(row.original)}
              title="Edit employee details"
            >
              <Edit2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — full-page, Freight-style transaction header
     ───────────────────────────────────────────────────────── */
  if (view === "editor" && activeEmployee) {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Edit Employee Details</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] font-medium leading-tight text-amber-700">
                  Editing
                </span>
                <span className="text-xs text-muted-foreground">
                  {activeEmployee.employee_code}
                  {activeEmployee.rpt_name ? ` - ${activeEmployee.rpt_name}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Expand all / Save */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">

            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => formRef.current?.toggleAll()}>
              {allOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}{" "}
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
            <Button type="button" size="sm" onClick={() => void handleHeaderSave()} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        <EditEmployeeDetailsForm
          ref={formRef}
          existingData={activeEmployee}
          onAllOpenChange={setAllOpen}
          onClose={(shouldRefetch?: boolean) => (shouldRefetch ? handleSaved() : handleCloseEditor())}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight-style transaction header + DataTable
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UserCog size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Master - Employee Details
              </h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Employees`}
        subtitle="Employee Personal Details"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search employee code, name, department..."
        loading={loading}
        emptyText="No employee found"
        height={620}
        minWidth={1000}
        density="grid"
        getRowId={(row) => `${row.employee_code}-${row.employee_id}`}
        onRowClick={openEdit}
      />
    </section>
  );
}

export default EmployeeDetailsPage;