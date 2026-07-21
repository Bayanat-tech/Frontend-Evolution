import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddTrainingFeedbackForm, type TTrainingFeedback } from "./Addtrainingfeedbackform";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// TTrainingFeedback comes from the form module and doesn't declare created_at,
// so we extend it locally just for sorting purposes. It's never rendered.
type TrainingFeedbackRow = TTrainingFeedback & { created_at?: unknown };

type Notice = { type: "success" | "error"; message: string } | null;

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<TTrainingFeedback>;
};

// CREATED_AT is a DB-level audit timestamp (DATE DEFAULT SYSDATE NOT NULL)
// set once at insert time and never touched afterward, so it's a reliable
// "true creation order" — unlike doc_date (user-editable business field,
// can be backdated/postdated) or doc_no (sequential, but only a reliable
// proxy for creation order if the backend never reuses/backfills numbers).
//
// created_at can arrive from the backend in several shapes depending on
// how Oracle/the API layer serializes SYSDATE, e.g.:
//   - ISO string:                "2026-06-30T14:05:09.000Z"
//   - Oracle default format:     "30-JUN-26" or "30-JUN-2026"
//   - "YYYY-MM-DD HH24:MI:SS"
//   - With stray whitespace, or wrapped as { value: "..." }
// We parse defensively and fall back to -Infinity (sorts last) on
// anything unparseable rather than letting NaN comparisons silently
// produce insertion-order-looking results.
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

  // Try swapping a space-separated date/time into ISO-friendly form:
  // "YYYY-MM-DD HH24:MI:SS" -> "YYYY-MM-DDTHH24:MI:SS"
  t = Date.parse(raw.replace(" ", "T"));
  if (!Number.isNaN(t)) return t;

  // Try common Oracle default NLS format: "DD-MON-YY" / "DD-MON-YYYY"
  // e.g. "30-JUN-26", "30-JUN-2026", optionally with a time portion.
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

const sortByCreatedAtDesc = (rows: TrainingFeedbackRow[]): TrainingFeedbackRow[] =>
  [...rows].sort(
    (a, b) => createdAtSortValue(b.created_at) - createdAtSortValue(a.created_at),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function TrainingFeedbackPage() {
  const { user }    = useAuth();
  const loginid     = user?.loginid      || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows,         setRows]         = useState<TrainingFeedbackRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [notice,       setNotice]       = useState<Notice>(null);
  const [popup,        setPopup]        = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<TrainingFeedbackRow | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Load list ───────────────────────────────────────────────────────────────

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_TR_FEEDBACK_FORM_SELECT",
        loginid,
        code1: companyCode,
        code2: "NULL", code3: "NULL", code4: "NULL",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: TrainingFeedbackRow[] = raw.map((r) => ({
        ...(r as TrainingFeedbackRow),
        // Accept multiple possible key casings/names the backend might use
        // for the SYSDATE audit column.
        created_at: String(
          r.created_at ?? r.CREATED_AT ?? r.createdAt ?? r.CREATED_DATE ?? r.created_date ?? "",
        ),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to load training feedback records",
      });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // ── Fetch single full record for edit / view ────────────────────────────────

  const fetchSingle = async (docNo: string): Promise<Partial<TTrainingFeedback>> => {
    try {
      const data = await getDynamicLookup({
        parameter: "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_TR_FEEDBACK_FORM_FETCH",
        loginid,
        code1: companyCode,
        code2: docNo,
        code3: "NULL", code4: "NULL",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const list = Array.isArray(data) ? data : [];
      return (list[0] as TTrainingFeedback) ?? {};
    } catch {
      return {};
    }
  };

  const openEdit = async (row: TrainingFeedbackRow) => {
    const full = await fetchSingle(row.doc_no);
    setPopup({ open: true, mode: "edit", data: Object.keys(full).length ? full : row });
  };

  const openView = async (row: TrainingFeedbackRow) => {
    const full = await fetchSingle(row.doc_no);
    setPopup({ open: true, mode: "view", data: Object.keys(full).length ? full : row });
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_TR_FEEDBACK_FORM_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_no
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Document ${deleteTarget.doc_no} deleted successfully.` });
      void loadRows();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to delete record",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TrainingFeedbackRow>[]>(() => [
    // Sorting disabled on all visible columns: the desired order (newest
    // first) is already enforced by sortByCreatedAtDesc() pre-sorting the
    // row array on load, using created_at as the sort key. That column is
    // intentionally not rendered in the UI at all.
    { accessorKey: "doc_no",     header: "Doc No",          size: 100, enableSorting: false },
    { accessorKey: "doc_type",   header: "Doc Type",        size: 100, enableSorting: false },
    { accessorKey: "doc_ref_no", header: "Ref No",          size: 120, enableSorting: false },
    {
      accessorKey: "doc_date",
      header: "Doc Date",
      size: 110,
      // doc_date is a user-editable business field (can be backdated/postdated),
      // so it must never become the active sort column.
      enableSorting: false,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        if (!v) return "-";
        return new Date(v).toLocaleDateString("en-GB");
      },
    },
    { accessorKey: "cand_no",    header: "Cand No",         size: 110, enableSorting: false },
    { accessorKey: "cand_name",  header: "Candidate Name",  size: 200, enableSorting: false },
    { accessorKey: "desig",      header: "Designation",     size: 150, enableSorting: false },
    { accessorKey: "dept",       header: "Department",      size: 140, enableSorting: false },
    { accessorKey: "grade",      header: "Grade",           size: 90,  enableSorting: false },
    { accessorKey: "course_att", header: "Course Attended", size: 170, enableSorting: false },
    { accessorKey: "report_to",  header: "Report To",       size: 140, enableSorting: false },
    // NOTE: created_at is intentionally NOT rendered as a column here.
    // It's still fetched, parsed, and used to pre-sort `rows` (newest
    // first) via sortByCreatedAtDesc() in loadRows(). It's just hidden
    // from the UI. If you ever want it back, re-add a column with
    // accessorKey: "created_at" using parseCreatedAt()/createdAtSortValue()
    // for its cell rendering and sortingFn.
    {
      id: "actions",
      header: "Actions",
      size: 110,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="Edit"
            onClick={() => void openEdit(row.original)}>
            <Edit2 size={14} />
          </Button>
          <Button size="icon" variant="ghost" title="View"
            onClick={() => void openView(row.original)}>
            <Eye size={14} />
          </Button>
          <Button size="icon" variant="ghost" title="Delete"
            onClick={() => setDeleteTarget(row.original)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ], []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="grid gap-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Training Feedback</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage employee training feedback forms.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Create Feedback
          </Button>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Training Feedback List"
        searchPlaceholder="Search candidate, course, doc no..."
        loading={loading}
        height={560}
        minWidth={1480}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.doc_no)}
      />

      {/* Add / Edit / View dialog */}
      {popup.open && (
        <Dialog
          open
          wide
          title={
            popup.mode === "add"  ? "Add Training Feedback"  :
            popup.mode === "edit" ? "Edit Training Feedback" :
                                    "View Training Feedback"
          }
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddTrainingFeedbackForm
            mode={popup.mode}
            existingData={popup.data}
            onClose={(shouldRefetch) => {
              setPopup((p) => ({ ...p, open: false }));
              if (shouldRefetch) void loadRows();
            }}
          />
        </Dialog>
      )}

      {/* Delete confirm */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Training Feedback"
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete feedback for <strong>{deleteTarget?.cand_name}</strong>{" "}
          (Doc No: <strong>{deleteTarget?.doc_no}</strong>)?
        </p>
      </Dialog>

    </section>
  );
}