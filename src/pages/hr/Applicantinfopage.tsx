import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddApplicantForm } from "./Addapplicantform";


type ApplicantInfoRow = {
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

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ApplicantInfoRow>;
};

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "MST_HR_APPLICANT_INFO",
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

const sortByCreatedAtDesc = (rows: ApplicantInfoRow[]): ApplicantInfoRow[] =>
  [...rows].sort(
    (a, b) => createdAtSortValue(b.created_at) - createdAtSortValue(a.created_at),
  );

export function ApplicantInfoPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<ApplicantInfoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ApplicantInfoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: ApplicantInfoRow[] = raw.map((r) => ({
        ...(r as ApplicantInfoRow),
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
        message: error instanceof Error ? error.message : "Unable to load applicant records",
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
        parameter: "HR_CAM_APPLICANT_INFO_DELETE",
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
        message: error instanceof Error ? error.message : "Unable to delete applicant record",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ApplicantInfoRow>[]>(
    () => [
      {
        accessorKey: "doc_no",
        header: "Doc No",
        size: 100,
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
        size: 120,
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
      { accessorKey: "doc_ref_no", header: "Ref No", size: 120, enableSorting: false },
      { accessorKey: "cand_name", header: "Candidate Name", size: 180, enableSorting: false },
      { accessorKey: "pos_appl_for", header: "Position", size: 160, enableSorting: false },
      { accessorKey: "dept", header: "Department", size: 140, enableSorting: false },
      { accessorKey: "intvr_name", header: "Interviewer", size: 150, enableSorting: false },
      {
        accessorKey: "intrvw_date",
        header: "Interview Date",
        size: 130,
        // Same reasoning as doc_date: keep the table locked to created_at order.
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = getValue<string>();
          if (!val) return "-";
          return new Date(val).toLocaleDateString("en-GB");
        },
      },
      {
        accessorKey: "hire_flag",
        header: "Hire Status",
        size: 110,
        enableSorting: false,
        cell: ({ row }) => {
          const val = (row.original.hire_flag ?? "").toString().toUpperCase();
          if (val === "Y")
            return (
              <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.8125rem" }}>
                Hired
              </span>
            );
          if (val === "N")
            return (
              <span style={{ color: "#dc2626", fontWeight: 600, fontSize: "0.8125rem" }}>
                Rejected
              </span>
            );
          return <span style={{ color: "#6b7280", fontSize: "0.8125rem" }}>-</span>;
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">Applicant Info</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage applicant interview and hiring records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Applicant
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
        subtitle="Applicant Info List"
        searchPlaceholder="Search doc no, candidate, department..."
        loading={loading}
        height={560}
        minWidth={1100}
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
              ? "Add Applicant"
              : popup.mode === "edit"
                ? "Edit Applicant"
                : "View Applicant"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddApplicantForm
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
        title="Delete Applicant"
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