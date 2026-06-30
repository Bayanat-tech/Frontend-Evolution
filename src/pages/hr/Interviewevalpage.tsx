import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { Addinterviewevalform } from "./Addinterviewevalform";

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
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<InterviewEvalRow>;
};

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

// doc_no (e.g. 2026120003) is the sequential identifier assigned by the
// backend at save time, so the highest doc_no is always the most recently
// created record. doc_date is a user-editable business field on the form
// (people can type any date), so it must NOT be used for ordering.
//
// doc_no can arrive as a zero-padded string, with stray whitespace, or
// (rarely) with a non-numeric prefix/suffix depending on the backend
// formatter, so we strip everything except digits before comparing
// numerically. This avoids cases where naive Number(a.doc_no) === NaN
// silently falls through to string comparison and produces an
// insertion-order-looking result.
const docNoSortValue = (docNo: unknown): number => {
  const digitsOnly = String(docNo ?? "").replace(/[^0-9]/g, "");
  if (!digitsOnly) return -Infinity;
  const n = Number(digitsOnly);
  return Number.isNaN(n) ? -Infinity : n;
};

const sortByDocNoDesc = (rows: InterviewEvalRow[]): InterviewEvalRow[] =>
  [...rows].sort((a, b) => docNoSortValue(b.doc_no) - docNoSortValue(a.doc_no));

export function InterviewEvalPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<InterviewEvalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<InterviewEvalRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: InterviewEvalRow[] = raw.map((r) => ({
        ...(r as InterviewEvalRow),
        doc_no: String(r.doc_no ?? r.DOC_NO ?? ""),
      }));
      setRows(sortByDocNoDesc(list));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load interview evaluation records",
      });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_INT_EVAL_FORM_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_type,
        code3: String(deleteTarget.doc_no),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Document ${deleteTarget.doc_no} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete evaluation record",
      });
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
        // Sorting disabled here so users can't click the header and flip
        // the order — the desired order (newest first) is enforced two
        // ways: (1) sortByDocNoDesc() pre-sorts the row array on load,
        // and (2) DataTable is given initialSorting=[{id:"doc_no",desc:true}]
        // so tanstack-table's getSortedRowModel doesn't fall back to
        // unsorted/insertion order before any user interaction.
        enableSorting: false,
        // sortingFn is defined for correctness/documentation even though
        // enableSorting is false — if this column's sorting is ever
        // re-enabled, it will sort numerically by the digits in doc_no
        // rather than falling back to tanstack's default string/basic sort.
        sortingFn: (rowA, rowB) =>
          docNoSortValue(rowA.original.doc_no) - docNoSortValue(rowB.original.doc_no),
      },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 120,
        // Sorting disabled: doc_date is a user-editable business field
        // (people can backdate/postdate it on the form), so it must never
        // become the active sort column — otherwise it silently overrides
        // the newest-first-by-doc_no order this table is meant to show.
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
        // Same reasoning as doc_date: keep the table locked to doc_no order.
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
          if (val === "Y")
            return (
              <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.8125rem" }}>
                Yes
              </span>
            );
          if (val === "N")
            return (
              <span style={{ color: "#dc2626", fontWeight: 600, fontSize: "0.8125rem" }}>
                No
              </span>
            );
          return <span style={{ color: "#6b7280", fontSize: "0.8125rem" }}>-</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="Edit"
              onClick={() => setPopup({ open: true, mode: "edit", data: row.original })}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="View"
              onClick={() => setPopup({ open: true, mode: "view", data: row.original })}
            >
              <Eye size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Delete"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Interview Evaluation</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage candidate interview evaluation records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Evaluation
          </Button>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Interview Evaluation List"
        searchPlaceholder="Search doc no, candidate, department..."
        loading={loading}
        height={560}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        initialSorting={[{ id: "doc_no", desc: true }]}
        getRowId={(row) => `${row.doc_type}-${row.doc_no}`}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Interview Evaluation"
              : popup.mode === "edit"
                ? "Edit Interview Evaluation"
                : "View Interview Evaluation"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <Addinterviewevalform
            mode={popup.mode}
            existingData={popup.data}
            onClose={(shouldRefetch?: boolean) => {
              setPopup((p) => ({ ...p, open: false }));
              if (shouldRefetch) void loadRows();
            }}
          />
        </Dialog>
      )}

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
        <p className="text-sm text-muted-foreground">
          Confirm delete for document <strong>{deleteTarget?.doc_no}</strong>?
        </p>
      </Dialog>
    </section>
  );
}