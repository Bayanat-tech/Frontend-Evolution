import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddContinuousAutoMemoForm } from "./AddContinuousAutoMemoForm";

type ContinuousAutoMemoRow = {
  doc_no: string;
  doc_date: string;
  doc_type: string;
  employee_code: string;
  doc_status: string;
  created_at: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ContinuousAutoMemoRow>;
};

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "HR_CAM_EMP_CONTINUOUS_MEMO",
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

const sortByCreatedAtDesc = (rows: ContinuousAutoMemoRow[]): ContinuousAutoMemoRow[] =>
  [...rows].sort(
    (a, b) => createdAtSortValue(b.created_at) - createdAtSortValue(a.created_at),
  );

export function ContinuousAutoMemoPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<ContinuousAutoMemoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ContinuousAutoMemoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: ContinuousAutoMemoRow[] = raw.map((r) => ({
        ...(r as ContinuousAutoMemoRow),
        // Accept multiple possible key casings/names the backend might use
        // for the SYSDATE audit column.
        created_at: String(
          r.created_at ?? r.CREATED_AT ?? r.createdAt ?? r.CREATED_DATE ?? r.created_date ?? "",
        ),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load continuous auto memo records",
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
        parameter: "HR_CAM_EMP_CONT_MEMO_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_type,
        code3: deleteTarget.doc_no,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Document ${deleteTarget.doc_no} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete memo",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ContinuousAutoMemoRow>[]>(
    () => [
      {
        accessorKey: "doc_no",
        header: "Doc No",
        size: 140,
        // Sorting disabled: the desired order (newest first) is already
        // enforced by sortByCreatedAtDesc() pre-sorting the row array on
        // load, using created_at as the sort key. That column is
        // intentionally not rendered in the UI (see note near the bottom
        // of this columns array).
        enableSorting: false,
      },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 130,
        // Sorting disabled: doc_date is a user-editable business field
        // (people can backdate/postdate it on the form), so it must never
        // become the active sort column — otherwise it silently overrides
        // the newest-first-by-created_at order this table is meant to show.
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = getValue<string>();
          if (!val) return "-";
          return new Date(val).toLocaleDateString("en-GB");
        },
      },
      { accessorKey: "doc_type", header: "Doc Type", size: 130, enableSorting: false },
      { accessorKey: "employee_code", header: "Employee Code", size: 160, enableSorting: false },
      {
        accessorKey: "doc_status",
        header: "Status",
        size: 110,
        enableSorting: false,
        cell: ({ row }) => {
          const active = row.original.doc_status === "A";
          return (
            <span
              style={{
                color: active ? "#16a34a" : "#dc2626",
                fontWeight: 600,
                fontSize: "0.8125rem",
              }}
            >
              {active ? "Active" : "Cancelled"}
            </span>
          );
        },
      },
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">Continuous Auto Memo</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage continuous auto memo records for HR employees.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Create Auto Memo
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
        subtitle="Continuous Auto Memo List"
        searchPlaceholder="Search doc no, employee..."
        loading={loading}
        height={560}
        minWidth={900}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.doc_type}-${row.doc_no}`}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Continuous Auto Memo"
              : popup.mode === "edit"
                ? "Edit Continuous Auto Memo"
                : "View Continuous Auto Memo"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddContinuousAutoMemoForm
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
        title="Delete Continuous Auto Memo"
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