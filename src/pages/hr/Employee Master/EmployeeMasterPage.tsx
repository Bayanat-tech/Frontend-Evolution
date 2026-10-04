// Employee Master page — new UI
//  • List view: Freight-style header + DataTable
//  • Add / Edit opens the full-page editor (same page, no dialog)
//  • Editor header owns Back / Save; the form owns the logic
//  • Header Save calls formRef.current?.save()

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, FileText, Loader2, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { useAuth } from "../../../state/AuthContext";
import { formatDate } from "../../../hooks/apiDate";
import AddEmployeeHrForm, { type EmployeeFormHandle } from "./AddEmployeeHrForm";
import { mapEmployeeHr } from "./employee-hr.mapper";
import type { TEmployeeHr } from "./employee-hr.types";

type Editor = { editMode: boolean; row?: TEmployeeHr } | null;

export function EmployeeMasterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";
  const queryKey = useMemo(() => ["employee-hr", companyCode], [companyCode]);

  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TEmployeeHr | null>(null);

  const formRef = useRef<EmployeeFormHandle>(null);

  /* ── Employees ── */
  const { data: rows = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<TEmployeeHr[]> => {
      const response = await getDynamicLookup({
        parameter: "MSEHR_TRANSACTIONS_MS_HR_EMPLOYEE",
        loginid,
        code1: companyCode,
      });
      return ((Array.isArray(response) ? response : []) as Record<string, unknown>[]).map(mapEmployeeHr);
    },
    enabled: !!companyCode,
  });

  useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : "Unable to load employees");
  }, [error, toast]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  /* ── Delete ── */
  const deleteMutation = useMutation({
    mutationFn: (row: TEmployeeHr) =>
      executeDynamicDelete({
        parameter: "MSEHR_TRANSACTIONS_MS_HR_EMPLOYEE_DELETE",
        loginid,
        code1: row.employee_code,
        code2: companyCode,
      }),
    onSuccess: () => {
      toast.success("Employee deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete employee"),
  });

  /* ── Editor open / close ── */
  const openAdd = () => setEditor({ editMode: false });
  const openEdit = useCallback((row: TEmployeeHr) => setEditor({ editMode: true, row }), []);
  const backToList = () => setEditor(null);
  const handleSaved = () => {
    setEditor(null);
    queryClient.invalidateQueries({ queryKey });
  };

  /* ── Header Save ── */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<TEmployeeHr>[]>(
    () => [
      { accessorKey: "rpt_name", header: "Employee Name", size: 270 },
      { accessorKey: "desg_code", header: "Designation", size: 80 },
      { accessorKey: "join_date", header: "Join Date", size: 100, cell: ({ getValue }) => formatDate(getValue()) },
      { accessorKey: "dept_code", header: "Department", size: 80 },
      {
        id: "actions",
        header: "Actions",
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEdit(row.original)}
              title="Edit employee"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete employee"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [openEdit],
  );

  /* ── Editor view ── */
  if (editor) {
    const { editMode, row } = editor;
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Employee Master</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "New"}
                </span>
                {editMode && row && (
                  <span className="text-xs text-muted-foreground">
                    {row.employee_code}
                    {row.rpt_name ? ` - ${row.rpt_name}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={backToList} disabled={saving}>
              <ArrowLeft size={14} /> Back to List
            </Button>
            <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        <AddEmployeeHrForm
          key={row?.employee_code || "new"}
          ref={formRef}
          isEditMode={editMode}
          existingData={editMode ? row : undefined}
          onSaved={handleSaved}
        />
      </section>
    );
  }

  /* ── List view ── */
  return (
    <section className="freight-workspace-ui freight-ui-standard grid gap-2">
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Users size={15} />
          </div>
          <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Employee Master</h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus size={14} /> Add Employee
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} Employees`}
        subtitle="Employee Master List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search employee, designation..."
        loading={isLoading}
        emptyText="No Employee found"
        height={620}
        minWidth={900}
        density="grid"
        getRowId={(row) => `${row.employee_code}-${row.employee_id}`}
      />

      {/* ── Delete confirmation dialog ── */}
      <Dialog
        open={!!deleteTarget}
        title="Delete Employee"
        description={deleteTarget ? `Delete ${deleteTarget.rpt_name}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete this employee?
        </p>
      </Dialog>
    </section>
  );
}

export default EmployeeMasterPage;