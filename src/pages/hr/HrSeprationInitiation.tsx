import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import { AddHrInitiationSepration } from "./AddhrInitiationSepration";

// Row shape matches HR_EMP_SEPARATIONS columns (see MST_HR_EMP_SEPARATIONS_DETAIL
// and MST_HR_EMP_SEPARATIONS_LIST in PROC_BUILD_DYNAMIC_SQL_MST_HR). Table has
// no DOC_NO — natural key is COMPANY_CODE + EMPLOYEE_ID, so employee_id is
// used as the row id here.
type SeparationRow = {
  company_code?: string;
  employee_id: string | number;
  emp_code?: string;
  emp_name?: string;
  pay_month?: string;
  pay_year?: string;
  separation_initiation_date?: string;
  in_notice_period?: string;
  notice_period_start_date?: string;
  notice_period_end_date?: string;
  act_separation_date?: string;
  remarks?: string;
  settlement_status?: string;
  notice_period?: number | string;
  status_flag?: string;
  visa_cancelled?: string;
  final_settlement_done?: string;
  settlement_date?: string;
  separation_reason?: string;
  labour_card_cancelled?: string;
  reason_category?: string;
  created_at?: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<SeparationRow>;
};

const parseCreatedAt = (input: unknown): number => {
  if (input === null || input === undefined || input === "") return -Infinity;

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const inner = obj.value ?? obj.date ?? obj.iso ?? null;
    if (inner) return parseCreatedAt(inner);
    return -Infinity;
  }

  const raw = String(input).trim();
  if (!raw) return -Infinity;

  let t = Date.parse(raw);
  if (!Number.isNaN(t)) return t;

  t = Date.parse(raw.replace(" ", "T"));
  if (!Number.isNaN(t)) return t;

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

const sortByCreatedAtDesc = (rows: SeparationRow[]): SeparationRow[] =>
  [...rows].sort(
    (a, b) => createdAtSortValue(b.created_at) - createdAtSortValue(a.created_at),
  );

const normalizeKey = (k: string) => k.toLowerCase().replace(/[_\s]/g, "");

const pick = (obj: Record<string, unknown>, ...aliases: string[]): unknown => {
  if (!obj) return undefined;
  const normalizedAliases = aliases.map(normalizeKey);
  for (const rawKey of Object.keys(obj)) {
    const nk = normalizeKey(rawKey);
    if (normalizedAliases.includes(nk)) {
      const v = obj[rawKey];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
};

export function HrSeprationInitiation() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<SeparationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<SeparationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch main grid ──────────────────────────────────────────────────────
  // Uses MST_HR_EMP_SEPARATIONS_LIST — the company-wide grid query added to
  // PROC_BUILD_DYNAMIC_SQL_MST_HR (see PROC_BUILD_DYNAMIC_SQL_MST_HR_addition.sql).
  // It left-joins MS_HR_EMPLOYEE so EMP_CODE / EMP_NAME come back with the row,
  // same as HR_CAM_JOIN_RPT_MAIN_PAGE does for the Joining page.
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "MST_HR_EMP_SEPARATIONS_LIST",
        loginid,
        code1: companyCode,
        code2: "",
        code3: "",
        code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: SeparationRow[] = raw.map((r) => ({
        company_code: String(pick(r, "company_code") ?? ""),
        employee_id: pick(r, "employee_id") as string | number,
        emp_code: String(pick(r, "emp_code", "employee_code") ?? ""),
        emp_name: String(pick(r, "emp_name", "rpt_name") ?? ""),
        pay_month: String(pick(r, "pay_month") ?? ""),
        pay_year: String(pick(r, "pay_year") ?? ""),
        separation_initiation_date: String(pick(r, "separation_initiation_date") ?? ""),
        in_notice_period: String(pick(r, "in_notice_period") ?? ""),
        notice_period_start_date: String(pick(r, "notice_period_start_date") ?? ""),
        notice_period_end_date: String(pick(r, "notice_period_end_date") ?? ""),
        act_separation_date: String(pick(r, "act_separation_date") ?? ""),
        remarks: String(pick(r, "remarks") ?? ""),
        settlement_status: String(pick(r, "settlement_status") ?? ""),
        notice_period: pick(r, "notice_period") as number | string,
        status_flag: String(pick(r, "status_flag") ?? ""),
        visa_cancelled: String(pick(r, "visa_cancelled") ?? ""),
        final_settlement_done: String(pick(r, "final_settlement_done") ?? ""),
        settlement_date: String(pick(r, "settlement_date") ?? ""),
        separation_reason: String(pick(r, "separation_reason") ?? ""),
        labour_card_cancelled: String(pick(r, "labour_card_cancelled") ?? ""),
        reason_category: String(pick(r, "reason_category") ?? ""),
        created_at: String(pick(r, "user_dt") ?? ""),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load separation records" });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // ── Fetch row detail ─────────────────────────────────────────────────────
  // Calls the existing MST_HR_EMP_SEPARATIONS_DETAIL WHEN clause: code1 =
  // company, code2 = employee_id. Grid rows already carry the full record
  // now that MST_HR_EMP_SEPARATIONS_LIST returns everything, but this keeps
  // edit/view re-fetching so the data is guaranteed fresh at the moment the
  // form opens.
  const fetchRowDetail = useCallback(async (row: SeparationRow): Promise<SeparationRow> => {
    try {
      const data = await getDynamicLookup({
        parameter: "MST_HR_EMP_SEPARATIONS_DETAIL",
        loginid,
        code1: companyCode,
        code2: String(row.employee_id ?? ""),
        code3: "",
        code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const rec = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      if (!rec) return row;
      return {
        ...row,
        company_code: String(pick(rec, "company_code") ?? row.company_code ?? ""),
        employee_id: (pick(rec, "employee_id") as string | number) ?? row.employee_id,
        pay_month: String(pick(rec, "pay_month") ?? row.pay_month ?? ""),
        pay_year: String(pick(rec, "pay_year") ?? row.pay_year ?? ""),
        separation_initiation_date: String(pick(rec, "separation_initiation_date") ?? row.separation_initiation_date ?? ""),
        in_notice_period: String(pick(rec, "in_notice_period") ?? row.in_notice_period ?? ""),
        notice_period_start_date: String(pick(rec, "notice_period_start_date") ?? row.notice_period_start_date ?? ""),
        notice_period_end_date: String(pick(rec, "notice_period_end_date") ?? row.notice_period_end_date ?? ""),
        act_separation_date: String(pick(rec, "act_separation_date") ?? row.act_separation_date ?? ""),
        remarks: String(pick(rec, "remarks") ?? row.remarks ?? ""),
        settlement_status: String(pick(rec, "settlement_status") ?? row.settlement_status ?? ""),
        notice_period: (pick(rec, "notice_period") as number | string) ?? row.notice_period,
        status_flag: String(pick(rec, "status_flag") ?? row.status_flag ?? ""),
        visa_cancelled: String(pick(rec, "visa_cancelled") ?? row.visa_cancelled ?? ""),
        final_settlement_done: String(pick(rec, "final_settlement_done") ?? row.final_settlement_done ?? ""),
        settlement_date: String(pick(rec, "settlement_date") ?? row.settlement_date ?? ""),
        separation_reason: String(pick(rec, "separation_reason") ?? row.separation_reason ?? ""),
        labour_card_cancelled: String(pick(rec, "labour_card_cancelled") ?? row.labour_card_cancelled ?? ""),
        reason_category: String(pick(rec, "reason_category") ?? row.reason_category ?? ""),
      };
    } catch (error) {
      console.error("fetchRowDetail failed:", error);
      return row;
    }
  }, [loginid, companyCode]);

  // ── Delete ───────────────────────────────────────────────────────────────
  // TODO: "MST_HR_EMP_SEPARATIONS_DELETE" is NOT yet defined in any procedure
  // shared so far. HR_CAM_JOIN_RPT_DELETE (the Joining page's equivalent)
  // doesn't appear in PROC_BUILD_DYNAMIC_SQL_MST_HR either, so deletes are
  // handled by a separate procedure not included here. Add a matching
  // WHEN clause there (DELETE FROM HR_EMP_SEPARATIONS WHERE COMPANY_CODE =
  // P_CODE1 AND EMPLOYEE_ID = P_CODE2) before this will work.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_EMP_SEPARATIONS_DELETE", // TODO: add this WHEN clause to the delete procedure
        loginid,
        code1: companyCode,
        code2: String(deleteTarget.employee_id),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Separation record for employee ${deleteTarget.employee_id} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete record" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Open edit/view with detail fetch ────────────────────────────────────
  const openEdit = async (row: SeparationRow) => {
    const fullRow = await fetchRowDetail(row);
    setPopup({ open: true, mode: "edit", data: fullRow });
  };

  const openView = async (row: SeparationRow) => {
    const fullRow = await fetchRowDetail(row);
    setPopup({ open: true, mode: "view", data: fullRow });
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<SeparationRow>[]>(() => [
    { accessorKey: "employee_id", header: "Emp ID", size: 100, enableSorting: false },
    { accessorKey: "emp_code", header: "Emp Code", size: 120, enableSorting: false },
    { accessorKey: "emp_name", header: "Employee Name", size: 200, enableSorting: false },
    {
      accessorKey: "separation_initiation_date",
      header: "Request Date",
      size: 130,
      enableSorting: false,
      cell: ({ getValue }) => {
        const val = getValue<string>();
        return val ? new Date(val).toLocaleDateString("en-GB") : "-";
      },
    },
    { accessorKey: "pay_month", header: "Payroll Month", size: 130, enableSorting: false },
    { accessorKey: "pay_year", header: "Payroll Year", size: 120, enableSorting: false },
    { accessorKey: "settlement_status", header: "Settlement Status", size: 150, enableSorting: false },
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">HR Separation Initiation</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Manage employee separation requests and notice period tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Separation
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading..." : `${rows.length.toLocaleString()} Records`}
        subtitle="HR Separation Initiation List"
        searchPlaceholder="Search emp id, emp code, name..."
        loading={loading}
        height={520}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.employee_id)}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add" ? "Add Separation" :
            popup.mode === "edit" ? "Edit Separation" :
            "View Separation"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddHrInitiationSepration
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
        title="Delete Separation"
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
          Confirm delete for employee <strong>{String(deleteTarget?.employee_id ?? "")}</strong>?
        </p>
      </Dialog>
    </section>
  );
}