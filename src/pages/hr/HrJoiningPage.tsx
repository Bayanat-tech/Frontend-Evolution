import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import { AddHrJoiningForm } from "./AddHrJoiningForm";

type JoiningRow = {
  doc_no: string | number;
  doc_type?: string;
  doc_date?: string;
  doc_ref_no?: string;
  cand_no?: string | number;
  cand_name?: string;
  division?: string;
  desig?: string;
  join_date?: string;
  bank?: string;
  branch?: string;
  bank_acct_number?: string;
  sign_1?: string;
  date_1?: string;
  created_at?: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<JoiningRow>;
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

const sortByCreatedAtDesc = (rows: JoiningRow[]): JoiningRow[] =>
  [...rows].sort(
    (a, b) => createdAtSortValue(b.created_at) - createdAtSortValue(a.created_at),
  );

// Case-insensitive, multi-key lookup helper. Oracle/lookup layers can return
// column names in either UPPERCASE or lowercase depending on the query path,
// so every normalized field below is read through this instead of a plain
// dot/bracket access, to avoid silently-blank fields.
const pick = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
};

export function HrJoiningPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<JoiningRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<JoiningRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch main grid ──────────────────────────────────────────────────────
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "HR_CAM_JOIN_RPT_MAIN_PAGE",
        loginid,
        code1: companyCode,
        code2: "",
        code3: "",
        code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: JoiningRow[] = raw.map((r) => ({
        ...(r as JoiningRow),
        // Accept multiple possible key casings/names the backend might use
        // for the SYSDATE audit column.
        created_at: String(
          r.created_at ?? r.CREATED_AT ?? r.createdAt ?? r.CREATED_DATE ?? r.created_date ?? "",
        ),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load joining records" });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // ── Fetch row detail (header + pay components) ───────────────────────────
  const fetchRowDetail = useCallback(async (row: JoiningRow): Promise<JoiningRow> => {
    try {
      const detail = await getDynamicLookup({
        parameter: "HR_CAM_JOIN_RPT_DETAIL",
        loginid,
        code1: companyCode,
        code2: String(row.doc_no),
        code3: "",
        code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });

      // TEMP DEBUG — check the browser console once, then remove this line.
      console.log("HR_CAM_JOIN_RPT_DETAIL raw response:", detail);

      if (!Array.isArray(detail) || detail.length === 0) return row;

      const header = detail[0] as Record<string, unknown>;

      // ★ Normalize header fields regardless of UPPERCASE/lowercase key casing.
      const normalizedHeader: Partial<JoiningRow> = {
        doc_no: (pick(header, "DOC_NO", "doc_no") ?? row.doc_no) as string | number,
        doc_type: String(pick(header, "DOC_TYPE", "doc_type") ?? row.doc_type ?? "MRF"),
        doc_date: String(pick(header, "DOC_DATE", "doc_date") ?? row.doc_date ?? ""),
        doc_ref_no: String(pick(header, "DOC_REF_NO", "doc_ref_no") ?? row.doc_ref_no ?? ""),
        cand_no: (pick(header, "CAND_NO", "cand_no") ?? "") as string | number,
        cand_name: String(pick(header, "CAND_NAME", "cand_name") ?? row.cand_name ?? ""),
        division: String(pick(header, "DIVISION", "division") ?? row.division ?? ""),
        desig: String(pick(header, "DESIG", "desig") ?? row.desig ?? ""),
        join_date: String(pick(header, "JOIN_DATE", "join_date") ?? row.join_date ?? ""),
        bank: String(pick(header, "BANK", "bank") ?? ""),
        branch: String(pick(header, "BRANCH", "branch") ?? ""),
        bank_acct_number: String(pick(header, "BANK_ACCT_NUMBER", "bank_acct_number") ?? ""),
        sign_1: String(pick(header, "SIGN_1", "sign_1") ?? ""),
        date_1: String(pick(header, "DATE_1", "date_1") ?? ""),
      };

      // ★ Normalize pay component rows the same way.
      const payComponents = detail
        .slice(1)
        .map((d) => {
          const rec = d as Record<string, unknown>;
          return {
            pay_comp_id: pick(rec, "PAY_COMP_ID", "pay_comp_id"),
            pay_comp_desc: pick(rec, "PAY_COMP_DESC", "pay_comp_desc"),
            pay_comp_amt: pick(rec, "PAY_COMP_AMT", "pay_comp_amt"),
          };
        })
        .filter((d) => d.pay_comp_id)
        .map((d, i) => ({
          _rowId: `existing_${i}`,
          pay_comp_id: String(d.pay_comp_id ?? ""),
          pay_comp_desc: String(d.pay_comp_desc ?? ""),
          pay_comp_amt: Number(d.pay_comp_amt ?? 0),
        }));

      return { ...row, ...normalizedHeader, payComponents };
    } catch {
      return row;
    }
  }, [loginid, companyCode]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_JOIN_RPT_DELETE",
        loginid,
        code1: companyCode,
        code2: String(deleteTarget.doc_no),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Joining document ${deleteTarget.doc_no} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete record" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Open edit/view with detail fetch ────────────────────────────────────
  const openEdit = async (row: JoiningRow) => {
    const fullRow = await fetchRowDetail(row);
    setPopup({ open: true, mode: "edit", data: fullRow });
  };

  const openView = async (row: JoiningRow) => {
    const fullRow = await fetchRowDetail(row);
    setPopup({ open: true, mode: "view", data: fullRow });
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<JoiningRow>[]>(() => [
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
        return val ? new Date(val).toLocaleDateString("en-GB") : "-";
      },
    },
    { accessorKey: "doc_ref_no", header: "Ref No", size: 130, enableSorting: false },
    { accessorKey: "cand_name", header: "Candidate Name", size: 220, enableSorting: false },
    { accessorKey: "division", header: "Division", size: 140, enableSorting: false },
    { accessorKey: "desig", header: "Designation", size: 160, enableSorting: false },
    {
      accessorKey: "join_date",
      header: "Joining Date",
      size: 130,
      // Same reasoning as doc_date: keep the table locked to created_at order.
      enableSorting: false,
      cell: ({ getValue }) => {
        const val = getValue<string>();
        return val ? new Date(val).toLocaleDateString("en-GB") : "-";
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
          <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(row.original)}>
            <Edit2 size={14} />
          </Button>
          <Button size="icon" variant="ghost" title="View" onClick={() => openView(row.original)}>
            <Eye size={14} />
          </Button>
          <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">HR Joining</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Manage employee joining documents and pay component assignments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Joining
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading..." : `${rows.length.toLocaleString()} Records`}
        subtitle="HR Joining List"
        searchPlaceholder="Search doc no, candidate, division..."
        loading={loading}
        height={520}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.doc_no)}
      />

      {/* ── Add / Edit / View Dialog ──────────────────────────────────────── */}
      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add" ? "Add Joining" :
            popup.mode === "edit" ? "Edit Joining" :
            "View Joining"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddHrJoiningForm
            mode={popup.mode}
            existingData={popup.data}
            onClose={(shouldRefetch?: boolean) => {
              setPopup((p) => ({ ...p, open: false }));
              if (shouldRefetch) void loadRows();
            }}
          />
        </Dialog>
      )}

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Joining"
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Confirm delete for document <strong>{String(deleteTarget?.doc_no ?? "")}</strong>?
        </p>
      </Dialog>
    </section>
  );
}