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

type Notice = { type: "success" | "error"; message: string } | null;

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<TTrainingFeedback>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function TrainingFeedbackPage() {
  const { user }    = useAuth();
  const loginid     = user?.loginid      || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows,         setRows]         = useState<TTrainingFeedback[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [notice,       setNotice]       = useState<Notice>(null);
  const [popup,        setPopup]        = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<TTrainingFeedback | null>(null);
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
      setRows(Array.isArray(data) ? (data as TTrainingFeedback[]) : []);
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

  const openEdit = async (row: TTrainingFeedback) => {
    const full = await fetchSingle(row.doc_no);
    setPopup({ open: true, mode: "edit", data: Object.keys(full).length ? full : row });
  };

  const openView = async (row: TTrainingFeedback) => {
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
        code1: deleteTarget.doc_no,
        code2: companyCode,
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

  const columns = useMemo<ColumnDef<TTrainingFeedback>[]>(() => [
    { accessorKey: "doc_no",     header: "Doc No",          size: 100 },
    { accessorKey: "doc_type",   header: "Doc Type",        size: 100 },
    { accessorKey: "doc_ref_no", header: "Ref No",          size: 120 },
    {
      accessorKey: "doc_date",
      header: "Doc Date",
      size: 110,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        if (!v) return "-";
        return new Date(v).toLocaleDateString("en-GB");
      },
    },
    { accessorKey: "cand_no",    header: "Cand No",         size: 110 },
    { accessorKey: "cand_name",  header: "Candidate Name",  size: 200 },
    { accessorKey: "desig",      header: "Designation",     size: 150 },
    { accessorKey: "dept",       header: "Department",      size: 140 },
    { accessorKey: "grade",      header: "Grade",           size: 90  },
    { accessorKey: "course_att", header: "Course Attended", size: 170 },
    { accessorKey: "report_to",  header: "Report To",       size: 140 },
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