import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft, ClipboardCheck, Edit2, Eye, Loader2, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { Addinterviewevalform, type InterviewEvalFormHandle } from "./Addinterviewevalform";

type InterviewEvalRow = {
  doc_no: string;
  doc_date: string;
  doc_type: string;
  doc_ref_no: string;
  cand_no: string;
  cand_name: string;
  pos_appl_for: string;
  dept: string;
  intvr_name: string;
  intrvw_date: string;
  hire_flag: string;
  created_at: string;
  [key: string]: unknown;
};

type EditorMode = "add" | "edit" | "view";

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "HR_CAM_INT_EVAL_FORM",
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

const parseCreatedAt = (input: unknown): number => {
  if (input === null || input === undefined || input === "") return -Infinity;

  // Some APIs wrap date values as { value: "..." } or { date: "..." }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const inner = obj.value ?? obj.date ?? obj.iso ?? null;
    if (inner) return parseCreatedAt(inner);
    return -Infinity;
  }

  const raw = String(input).trim();
  if (!raw) return -Infinity;

  // Try as-is first (handles proper ISO strings)
  let t = Date.parse(raw);
  if (!Number.isNaN(t)) return t;

  // "YYYY-MM-DD HH24:MI:SS" -> "YYYY-MM-DDTHH24:MI:SS"
  t = Date.parse(raw.replace(" ", "T"));
  if (!Number.isNaN(t)) return t;

  // Oracle default NLS format: "DD-MON-YY" / "DD-MON-YYYY", optionally with time.
  const oracleMatch = raw.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (oracleMatch) {
    const [, day, monStr, yearStr, hh = "0", mm = "0", ss = "0"] = oracleMatch;
    const months: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    const month = months[monStr.toUpperCase()];
    let year = Number(yearStr);
    if (yearStr.length === 2) year += year < 70 ? 2000 : 1900;
    if (month !== undefined) {
      const d = new Date(year, month, Number(day), Number(hh), Number(mm), Number(ss));
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
  }

  return -Infinity;
};

const createdAtSortValue = (createdAt: unknown): number => parseCreatedAt(createdAt);

const sortByCreatedAtDesc = (rows: InterviewEvalRow[]): InterviewEvalRow[] =>
  [...rows].sort((a, b) => createdAtSortValue(b.created_at) - createdAtSortValue(a.created_at));

export function InterviewEvalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<InterviewEvalRow[]>([]);
  const [loading, setLoading] = useState(false);

  // view state (list ⇄ full-page editor)
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeRow, setActiveRow] = useState<Partial<InterviewEvalRow> | null>(null);
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<InterviewEvalRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<InterviewEvalFormHandle>(null);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: InterviewEvalRow[] = raw.map((r) => ({
        ...(r as InterviewEvalRow),
        doc_no: String(r.doc_no ?? r.DOC_NO ?? ""),
        // Accept multiple possible key casings/names the backend might use
        // for the SYSDATE audit column.
        created_at: String(
          r.created_at ?? r.CREATED_AT ?? r.createdAt ?? r.CREATED_DATE ?? r.created_date ?? "",
        ),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load interview evaluation records",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Navigation handlers ── */
  const openEditor = (mode: EditorMode, row: Partial<InterviewEvalRow> | null = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    if (saving) return;
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
  };

  const handleSaved = () => {
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
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
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_INT_EVAL_FORM_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_type,
        code3: String(deleteTarget.doc_no),
      });
      toast.success(`Document ${deleteTarget.doc_no} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete evaluation record");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<InterviewEvalRow>[]>(
    () => [
      {
        accessorKey: "doc_no",
        header: "Doc No",
        size: 100,
        // Sorting disabled on every column: the newest-first order is enforced
        // by sortByCreatedAtDesc() on load (created_at is fetched but not shown).
        enableSorting: false,
      },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = getValue<string>();
          if (!val) return "-";
          return new Date(val).toLocaleDateString("en-GB");
        },
      },
      { accessorKey: "doc_ref_no", header: "Ref No", size: 120, enableSorting: false },
      { accessorKey: "cand_name", header: "Candidate Name", size: 180, enableSorting: false },
      { accessorKey: "pos_appl_for", header: "Position Applied", size: 160, enableSorting: false },
      { accessorKey: "dept", header: "Department", size: 140, enableSorting: false },
      { accessorKey: "intvr_name", header: "Interviewer", size: 150, enableSorting: false },
      {
        accessorKey: "intrvw_date",
        header: "Interview Date",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = getValue<string>();
          if (!val) return "-";
          return new Date(val).toLocaleDateString("en-GB");
        },
      },
      {
        accessorKey: "hire_flag",
        header: "Hired",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => {
          const val = (row.original.hire_flag ?? "").toString().toUpperCase();
          if (val === "Y") return <span className="text-[0.8125rem] font-semibold text-green-600">Yes</span>;
          if (val === "N") return <span className="text-[0.8125rem] font-semibold text-red-600">No</span>;
          return <span className="text-[0.8125rem] text-slate-500">-</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("view", row.original)}
              title="View"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete"
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
      editorMode === "add"
        ? "New Interview Evaluation"
        : editorMode === "edit"
          ? "Edit Interview Evaluation"
          : "View Interview Evaluation";
    const badge = editorMode === "add" ? "Draft" : editorMode === "edit" ? "Editing" : "View only";

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <ClipboardCheck size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{title}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {activeRow?.doc_no && (
                  <span className="text-xs text-muted-foreground">
                    Doc {String(activeRow.doc_no)}
                    {activeRow.cand_name ? ` - ${activeRow.cand_name}` : ""}
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
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                {saving ? "Saving" : editorMode === "edit" ? "Update" : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Form content — ref lets the header Save trigger the form */}
        <Addinterviewevalform
          ref={formRef}
          mode={editorMode}
          existingData={activeRow ?? {}}
          onClose={(shouldRefetch?: boolean) => (shouldRefetch ? handleSaved() : handleCloseEditor())}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight-style transaction header
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ClipboardCheck size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Interview Evaluation</h1>
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
          <Button type="button" size="sm" onClick={() => openEditor("add")}>
            <Plus size={14} /> Add
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Interview Evaluation List"
        searchPlaceholder="Search doc no, candidate, department..."
        loading={loading}
        emptyText="No interview evaluation records found"
        height={560}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.doc_type}-${row.doc_no}`}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Interview Evaluation"
        description="This action cannot be undone."
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
          Confirm delete for document <strong>{deleteTarget?.doc_no}</strong>?
        </p>
      </Dialog>
    </section>
  );
}