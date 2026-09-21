import { Edit2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { getDynamicLookup } from "../../../api/lookups";
import { TEmployeeDetails } from "./EmployeeDetails.types";
import EditEmployeeDetailsForm from "./Employeedetailform";

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

  const [rows, setRows] = useState<TEmployeeDetails[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TEmployeeDetails | null>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const response = await getDynamicLookup({
        parameter: "MS_HR_EMPDETAIL_EMPLOYEE",
        loginid: user?.loginid ?? "",
        code1: user?.company_code,
      });
      const tableData = (Array.isArray(response) ? response : []) as Record<string, unknown>[];
      setRows(tableData.map(mapEmployeeDetails));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load employee details");
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
      [row.employee_code, row.rpt_name , row.first_name, row.last_name, row.family_name, row.dept_code, row.section_code]
        .some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [query, rows]);

  const openEdit = (row: TEmployeeDetails) => {
    setEditTarget(row);
    setEditOpen(true);
  };

  const closeEdit = (refetch?: boolean) => {
    setEditOpen(false);
    setEditTarget(null);
    if (refetch) void loadRows();
  };

  const fullName = (row: TEmployeeDetails) =>
    [row.first_name, row.second_name, row.last_name].filter(Boolean).join(" ");

  const columns = useMemo<ColumnDef<TEmployeeDetails>[]>(
    () => [
      { accessorKey: "employee_code", header: "Employee Code", size: 110 },
      { accessorKey: "rpt_name", header: "Employee Name", size: 220},
      { accessorKey: "dept_code", header: "Department", size: 100 },
      { accessorKey: "section_code", header: "Section", size: 100 },
      { accessorKey: "mobile_no", header: "Mobile No", size: 120 },
      { accessorKey: "email_official", header: "Official Email", size: 200 },
      {
        accessorKey: "birth_date",
        header: "Date of Birth",
        size: 110,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      { accessorKey: "emp_status", header: "Status", size: 90 },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit employee details">
              <Edit2 size={14} />
            </Button>
          </div>
        ),
        size: 70,
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">Employee Details</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
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
      />

      {/* ── Edit Details Dialog ── */}
      <Dialog
        open={editOpen}
        title="Edit Employee Details"
        description={editTarget ? `${fullName(editTarget)} (${editTarget.employee_code} - ${editTarget?.rpt_name})` : undefined}
        wide
        onClose={() => closeEdit()}
      >
        {editTarget && (
          <EditEmployeeDetailsForm existingData={editTarget} onClose={() => closeEdit(true)} />
        )}
      </Dialog>
    </section>
  );
}

export default EmployeeDetailsPage;