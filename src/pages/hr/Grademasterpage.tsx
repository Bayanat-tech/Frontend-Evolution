import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft, Edit2, Eye, FileText, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddGradeMasterForm, type GradeFormHandle } from "./Addgrademasterform";

export type GradeRow = {
  company_code: string;
  grade_code: string;
  grade_name: string;
  grade_short_name: string;
  ot_eligibility: string;
  grade_status: string;
  status: string;
  airfare_entitlement?: string;
  spouse_af_entitlement?: string;
  dep_af_entitlement?: string;
  medical_entitlement?: string;
  spouse_med_entitlement?: string;
  dep_med_entitlement?: string;
  remarks?: string;
  [key: string]: unknown;
};

type EditorMode = "add" | "edit" | "view";

// NOTE: reuses the same list proc your old GradeComponentsPage.tsx used
// (MST_HR_MS_HR_Grade_Page). Swap the parameter name if yours differs —
// insUpdHrGrade only covers save, not list/delete.
const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "MST_HR_MS_HR_Grade_Page",
  loginid,
  code1: companyCode,
  code2: "",
  code3: "",
  code4: "",
  number1: 0,
  number2: 0,
  number3: 0,
  number4: 0,
  date1: null,
  date2: null,
  date3: null,
  date4: null,
});

export function GradeMasterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeGrade, setActiveGrade] = useState<GradeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");


  // delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GradeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<GradeFormHandle>(null);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      // Keep every field the backend returns so the edit form can populate
      // directly from the row.
      const list: GradeRow[] = raw.map((r) => ({
        ...(r as GradeRow),
        company_code: String(r.company_code ?? r.COMPANY_CODE ?? companyCode),
        grade_code: String(r.grade_code ?? r.GRADE_CODE ?? ""),
        grade_name: String(r.grade_name ?? r.GRADE_NAME ?? ""),
        grade_short_name: String(r.grade_short_name ?? r.GRADE_SHORT_NAME ?? ""),
        ot_eligibility: String(r.ot_eligibility ?? r.OT_ELIGIBILITY ?? "N"),
        grade_status: String(r.grade_status ?? r.GRADE_STATUS ?? ""),
        status: String(r.status ?? r.STATUS ?? "A"),
      }));
      setRows(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load grades");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Navigation handlers ── */
  const openEditor = (mode: EditorMode, row: GradeRow | null = null) => {
    setEditorMode(mode);
    setActiveGrade(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditorMode("add");
    setActiveGrade(null);
  };

  const handleSaved = () => {
    handleCloseEditor();
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

  /* ── Delete ── */
  const requestDelete = (row: GradeRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_GRADE_DELETE",
        loginid,
        code1: deleteTarget.grade_code,
        code2: companyCode,
      });
      toast.success(`Grade ${deleteTarget.grade_code} deleted successfully`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete grade");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<GradeRow>[]>(
    () => [
      { accessorKey: "grade_code", header: "Grade Code", size: 110, enableSorting: false },
      { accessorKey: "grade_name", header: "Name", size: 220, enableSorting: false },
      { accessorKey: "grade_short_name", header: "Short Name", size: 140, enableSorting: false },
      {
        accessorKey: "ot_eligibility",
        header: "OT Eligible",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => (String(getValue() || "N") === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "grade_status",
        header: "Grade Status",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          if (val === "A") return "Approved";
          if (val === "P") return "Pending";
          return val || "-";
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) =>
          String(getValue() || "A") === "A" ? (
            <span className="text-[0.8125rem] font-semibold text-green-600">Active</span>
          ) : (
            <span className="text-[0.8125rem] font-semibold text-red-600">Inactive</span>
          ),
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
              title="Edit grade"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("view", row.original)}
              title="View grade"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => requestDelete(row.original)}
              title="Delete grade"
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
      editorMode === "add" ? "New Grade" : editorMode === "edit" ? "Edit Grade" : "View Grade";
    const badge = editorMode === "add" ? "Draft" : editorMode === "edit" ? "Editing" : "View only";

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
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{title}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {activeGrade?.grade_code && (
                  <span className="text-xs text-muted-foreground">
                    {activeGrade.grade_code}
                    {activeGrade.grade_name ? ` - ${activeGrade.grade_name}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save (Save hidden in view mode) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
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

        {/* Form content — ref lets the header Save trigger the form */}
        <AddGradeMasterForm
          ref={formRef}
          mode={editorMode}
          existingData={activeGrade ?? {}}
          onClose={(shouldRefetch?: boolean) =>
            shouldRefetch ? handleSaved() : handleCloseEditor()
          }
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title only — buttons live inside the DataTable toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            HR General Masters - Grades
          </h2>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Grades`}
        subtitle="Grade Master List"
        searchValue={query}
        onSearchChange={(value) => {
          setQuery(value);
        }}
        searchPlaceholder="Search grade code, name..."
        loading={loading}
        emptyText="No grades found"
        height={560}
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.company_code}-${row.grade_code}`}
        enableExport
        exportFilename="hr-grades-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRows()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => openEditor("add")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Grade
            </button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        title="Delete Grade"
        description={deleteTarget ? `Delete ${deleteTarget.grade_code} - ${deleteTarget.grade_name}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete grade{" "}
          <strong>{deleteTarget?.grade_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}