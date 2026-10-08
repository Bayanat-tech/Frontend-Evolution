import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, Eye, FileText, Plus, RefreshCw, Save, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddEmployeeTransferForm, codeName, type TransferFormHandle } from "./Addemployeetransferform";

/* ── Types ── */
export type EmployeeTransferRow = {
  doc_no: string;
  doc_type: string;
  employee_id: string;
  employee_name?: string;
  div_code?: string;
  div_name?: string;
  dept_code?: string;
  dept_name?: string;
  section_code?: string;
  section_name?: string;
  div_code_to?: string;
  div_name_to?: string;
  dept_code_to?: string;
  dept_name_to?: string;
  section_code_to?: string;
  section_name_to?: string;
  remarks?: string;
  approved: string;
  user_dt: string;
  [key: string]: unknown;
};

type EditorMode = "add" | "edit" | "view";

const EDITOR_TITLES: Record<EditorMode, { title: string; badge: string }> = {
  add: { title: "New Employee Transfer", badge: "Draft" },
  edit: { title: "Edit Employee Transfer", badge: "Editing" },
  view: { title: "View Employee Transfer", badge: "View only" },
};

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "EDUCATION_QUALIFICATION_EMP_TRANSFER",
  loginid,
  code1: companyCode,
  code2: "NULL",
  code3: "NULL",
  code4: "NULL",
  number1: 0,
  number2: 0,
  number3: 0,
  number4: 0,
  date1: null,
  date2: null,
  date3: null,
  date4: null,
});

// Backend sends Oracle-style UPPERCASE keys; lower-case them once, here.
function normalizeRow(r: Record<string, unknown>): EmployeeTransferRow {
  const n: Record<string, unknown> = {};
  for (const key of Object.keys(r)) n[key.toLowerCase()] = r[key];
  return { ...(n as EmployeeTransferRow), user_dt: String(n.user_dt ?? ""), approved: String(n.approved ?? "N") };
}

/* ── Small presentational pieces ── */

/** Division on top, "Department / Section" underneath. Used for From and To. */
function PlacementCell({ div, dept, section }: { div: string; dept: string; section: string }) {
  if (!div && !dept && !section) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <div className="grid text-xs leading-snug">
      <span>{div || "-"}</span>
      <span className="text-muted-foreground">{[dept, section].filter(Boolean).join(" / ") || "-"}</span>
    </div>
  );
}

function StatusLabel({ approved }: { approved: string }) {
  return approved === "Y" ? (
    <span className="text-[0.8125rem] font-semibold text-green-600">Approved</span>
  ) : (
    <span className="text-[0.8125rem] font-semibold text-amber-600">Pending</span>
  );
}

const iconBtn =
  "h-6 w-6 grid place-items-center rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40";

/* ─────────────────────────────────────────────────────────── */

export function EmployeeTransferPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<EmployeeTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeRow, setActiveRow] = useState<EmployeeTransferRow | null>(null);
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<EmployeeTransferRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header buttons can trigger it
  const formRef = useRef<TransferFormHandle>(null);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      setRows((Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map(normalizeRow));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load employee transfers");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Navigation ── */
  const openEditor = (mode: EditorMode, row: EmployeeTransferRow | null = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setView("editor");
  };

  const closeEditor = () => {
    if (saving) return;
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
  };

  const handleFormClose = (shouldRefetch?: boolean) => {
    setSaving(false);
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
    if (shouldRefetch) void loadRows();
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_EMP_TRANSFER_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_type,
        code3: String(deleteTarget.doc_no),
      });
      toast.success(`Transfer ${deleteTarget.doc_no} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete employee transfer");
    } finally {
      setDeleting(false);
    }
  };

  // accessorFn on text columns so the search box can see the displayed values.
  const columns = useMemo<ColumnDef<EmployeeTransferRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 90, enableSorting: false },
      {
        id: "employee",
        header: "Employee",
        size: 220,
        enableSorting: false,
        accessorFn: (r) => codeName(r.employee_id, r.employee_name),
      },
      {
        id: "from",
        header: "From",
        size: 230,
        enableSorting: false,
        accessorFn: (r) =>
          [codeName(r.div_code, r.div_name), codeName(r.dept_code, r.dept_name), codeName(r.section_code, r.section_name)].join(" "),
        cell: ({ row: { original: r } }) => (
          <PlacementCell
            div={codeName(r.div_code, r.div_name)}
            dept={codeName(r.dept_code, r.dept_name)}
            section={codeName(r.section_code, r.section_name)}
          />
        ),
      },
      {
        id: "to",
        header: "To",
        size: 230,
        enableSorting: false,
        accessorFn: (r) =>
          [
            codeName(r.div_code_to, r.div_name_to),
            codeName(r.dept_code_to, r.dept_name_to),
            codeName(r.section_code_to, r.section_name_to),
          ].join(" "),
        cell: ({ row: { original: r } }) => (
          <PlacementCell
            div={codeName(r.div_code_to, r.div_name_to)}
            dept={codeName(r.dept_code_to, r.dept_name_to)}
            section={codeName(r.section_code_to, r.section_name_to)}
          />
        ),
      },
      {
        id: "date",
        header: "Date",
        size: 110,
        enableSorting: false,
        accessorFn: (r) => r.user_dt.slice(0, 10),
      },
      {
        id: "status",
        header: "Status",
        size: 100,
        enableSorting: false,
        accessorFn: (r) => (r.approved === "Y" ? "Approved" : "Pending"),
        cell: ({ row }) => <StatusLabel approved={row.original.approved} />,
      },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const locked = row.original.approved === "Y"; // approved transfers can't be edited or deleted
          return (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                className={`${iconBtn} text-slate-500 hover:bg-blue-50 hover:text-[#00378C]`}
                onClick={() => openEditor("edit", row.original)}
                disabled={locked}
                title="Edit transfer"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                className={`${iconBtn} text-slate-500 hover:bg-blue-50 hover:text-[#00378C]`}
                onClick={() => openEditor("view", row.original)}
                title="View transfer"
              >
                <Eye size={13} />
              </button>
              <button
                type="button"
                className={`${iconBtn} text-slate-400 hover:bg-red-50 hover:text-red-600`}
                onClick={() => setDeleteTarget(row.original)}
                disabled={locked}
                title="Delete transfer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — full-page, Freight-style header
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const isView = editorMode === "view";
    const { title, badge } = EDITOR_TITLES[editorMode];

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{title}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] font-medium leading-tight text-amber-700">
                  {badge}
                </span>
                {activeRow?.doc_no && (
                  <span className="text-xs text-muted-foreground">
                    Doc {activeRow.doc_no}
                    {activeRow.employee_name ? ` - ${activeRow.employee_name}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save draft / Submit (last two hidden in view mode) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={closeEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={closeEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            {!isView && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void formRef.current?.save()}
                  disabled={saving}
                >
                  <Save size={14} /> {saving ? "Saving" : "Save draft"}
                </Button>
                <Button type="button" size="sm" onClick={() => formRef.current?.submit()} disabled={saving}>
                  <Send size={14} /> Submit
                </Button>
              </>
            )}
          </div>
        </div>

        <AddEmployeeTransferForm
          ref={formRef}
          mode={editorMode}
          existingData={activeRow ?? {}}
          onSavingChange={setSaving}
          onClose={handleFormClose}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — buttons live inside the DataTable toolbar
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <h2 className="m-0 text-foreground" style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}>
          HR - Employee Transfer
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Transfers`}
        subtitle="Employee Transfer List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search employee, division, department..."
        loading={loading}
        emptyText="No employee transfers found"
        height={560}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.doc_type}-${row.doc_no}`}
        enableExport
        exportFilename="hr-employee-transfers.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => openEditor("add")}>
              <Plus size={14} /> Add Transfer
            </Button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Employee Transfer"
        description={deleteTarget ? `Delete transfer ${deleteTarget.doc_no}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete transfer{" "}
          <strong>{deleteTarget?.doc_no}</strong>?
        </p>
      </Dialog>
    </section>
  );
}