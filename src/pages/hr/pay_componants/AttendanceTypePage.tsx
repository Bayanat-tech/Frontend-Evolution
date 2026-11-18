import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, Eye, FileText, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { uppercaseKeys } from "../../../components/ui/Uselookupoptions";
import { useAuth } from "../../../state/AuthContext";
import { AddAttendanceTypeForm, type AttendanceFormHandle } from "./AddAttendanceTypeForm";

export type TAttendanceTypeRow = {
  COMPANY_CODE: string;
  ATTEND_TYPE: string;
  ATTEND_DESC: string;
  ATTEND_SHORT_DESC?: string;
  STATUS?: string;
  ATTENDANCE_CATEGORY?: string;
  ATTEND_PERIODICITY?: string;
  REMARKS?: string;
};

type EditorMode = "add" | "edit" | "view";

const AttendanceTypesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [query, setQuery] = useState("");

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeRow, setActiveRow] = useState<TAttendanceTypeRow | null>(null);
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<TAttendanceTypeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<AttendanceFormHandle>(null);

  /* ── Data ── */
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["attendance-types", companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: "PAY_COMPONENT_ATTENDANCE_TYPE",
        code1: companyCode,
        code2: loginid,
      });
      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys).map(
        (row): TAttendanceTypeRow => ({
          COMPANY_CODE: String(row.COMPANY_CODE ?? companyCode),
          ATTEND_TYPE: String(row.ATTEND_TYPE ?? ""),
          ATTEND_DESC: String(row.ATTEND_DESC ?? ""),
          ATTEND_SHORT_DESC: row.ATTEND_SHORT_DESC as string | undefined,
          STATUS: row.STATUS as string | undefined,
          ATTENDANCE_CATEGORY: row.ATTENDANCE_CATEGORY as string | undefined,
          ATTEND_PERIODICITY: row.ATTEND_PERIODICITY as string | undefined,
          REMARKS: row.REMARKS as string | undefined,
        }),
      );
    },
    enabled: !!companyCode,
  });

  const rows = useMemo(() => data ?? [], [data]);

  // Client-side search (type / description / short description)
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.ATTEND_TYPE, r.ATTEND_DESC, r.ATTEND_SHORT_DESC].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  /* ── Navigation handlers ── */
  const openEditor = (mode: EditorMode, row: TAttendanceTypeRow | null = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
  };

  const handleSaved = () => {
    handleCloseEditor();
    void refetch();
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

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "PAY_COMP_ATTENDANCE_TYPE_delete",
        loginid,
        code1: deleteTarget.COMPANY_CODE,
        code2: deleteTarget.ATTEND_TYPE,
      });
      toast.success(`Attendance type ${deleteTarget.ATTEND_TYPE} deleted successfully`);
      setDeleteTarget(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete attendance type");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<TAttendanceTypeRow>[]>(
    () => [
      { accessorKey: "ATTEND_TYPE", header: "Attend Type", size: 120, enableSorting: false },
      { accessorKey: "ATTEND_DESC", header: "Description", size: 260, enableSorting: false },
      { accessorKey: "ATTEND_SHORT_DESC", header: "Short Description", size: 180, enableSorting: false },
      { accessorKey: "ATTENDANCE_CATEGORY", header: "Category", size: 150, enableSorting: false },
      { accessorKey: "ATTEND_PERIODICITY", header: "Periodicity", size: 150, enableSorting: false },
      {
        accessorKey: "STATUS",
        header: "Status",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() ?? "");
          if (val === "A") return <span className="text-[0.8125rem] font-semibold text-green-600">Active</span>;
          if (val === "N" || val === "I")
            return <span className="text-[0.8125rem] font-semibold text-red-600">Inactive</span>;
          return val || "-";
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("edit", row.original)}
              title="Edit attendance type"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("view", row.original)}
              title="View attendance type"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete attendance type"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const isView = editorMode === "view";
    const title =
      editorMode === "add" ? "New Attendance Type" : editorMode === "edit" ? "Edit Attendance Type" : "View Attendance Type";
    const badge = editorMode === "add" ? "Draft" : editorMode === "edit" ? "Editing" : "View only";

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
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {activeRow?.ATTEND_TYPE && (
                  <span className="text-xs text-muted-foreground">
                    {activeRow.ATTEND_TYPE}
                    {activeRow.ATTEND_DESC ? ` - ${activeRow.ATTEND_DESC}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save (Save hidden in view mode) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            {!isView && (
              <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
                <Save size={14} /> {saving ? "Saving" : "Save"}
              </Button>
            )}
          </div>
        </div>

        <AddAttendanceTypeForm
          key={activeRow?.ATTEND_TYPE || "new"}
          ref={formRef}
          mode={editorMode}
          existingData={activeRow ?? {}}
          onClose={(shouldRefetch?: boolean) => (shouldRefetch ? handleSaved() : handleCloseEditor())}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <h2
          className="text-foreground m-0"
          style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
        >
          Attendance Types
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
        subtitle="Attendance Type List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search type, description..."
        loading={isLoading}
        emptyText="No attendance types found"
        height={560}
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => row.ATTEND_TYPE || `temp-${index}`}
        enableExport
        exportFilename="attendance-types-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => openEditor("add")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Attendance Type
            </button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        title="Delete Attendance Type"
        description={
          deleteTarget ? `Delete ${deleteTarget.ATTEND_TYPE} - ${deleteTarget.ATTEND_DESC}?` : undefined
        }
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete attendance type{" "}
          <strong>{deleteTarget?.ATTEND_TYPE}</strong>?
        </p>
      </Dialog>
    </section>
  );
};

export default AttendanceTypesPage;