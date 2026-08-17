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

type PayComponentRow = {
  _rowId: string;
  pay_comp_id: string;
  pay_comp_desc: string;
  pay_comp_amt: number;
};

type PayCompMasterRow = {
  pay_comp_id: string;
  pay_comp_desc: string;
};

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
  payComponents?: PayComponentRow[];
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<JoiningRow>;
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

const sortByCreatedAtDesc = (rows: JoiningRow[]): JoiningRow[] =>
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

  // Pay-component master list (ID -> description). HR_CAM_JOIN_RPT_DETAIL
  
  const [payCompMaster, setPayCompMaster] = useState<PayCompMasterRow[]>([]);

  useEffect(() => {
    if (!companyCode) return;
    getDynamicLookup({
      parameter: "PAY_COMPONENT_PAYUNIT_DependPayUnit",
      loginid,
      code1: companyCode,
      code2: "",
      code3: "",
      code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    })
      .then((data) => {
        const arr = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        setPayCompMaster(
          arr.map((r) => ({
            pay_comp_id: String(pick(r, "pay_comp_id") ?? ""),
            pay_comp_desc: String(pick(r, "pay_comp_desc") ?? ""),
          })).filter((r) => r.pay_comp_id)
        );
      })
      .catch(() => setPayCompMaster([]));
  }, [loginid, companyCode]);

  const payCompDescMap = useMemo(
    () => new Map(payCompMaster.map((o) => [o.pay_comp_id, o.pay_comp_desc])),
    [payCompMaster]
  );

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
        doc_no: pick(r, "doc_no") as string | number,
        doc_type: String(pick(r, "doc_type") ?? "MRF"),
        doc_date: String(pick(r, "doc_date") ?? ""),
        doc_ref_no: String(pick(r, "doc_ref_no") ?? ""),
        cand_no: pick(r, "cand_no") as string | number,
        cand_name: String(pick(r, "cand_name") ?? ""),
        division: String(pick(r, "division") ?? ""),
        desig: String(pick(r, "desig") ?? ""),
        join_date: String(pick(r, "join_date") ?? ""),
        bank: String(pick(r, "bank") ?? ""),
        branch: String(pick(r, "branch") ?? ""),
        bank_acct_number: String(pick(r, "bank_acct_number") ?? ""),
        sign_1: String(pick(r, "sign_1") ?? ""),
        date_1: String(pick(r, "date_1") ?? ""),
        created_at: String(pick(r, "user_dt") ?? ""),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load joining records" });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // ── Fetch row detail (pay components only) ────────────────────────────

  const fetchRowDetail = useCallback(async (row: JoiningRow): Promise<JoiningRow> => {
    try {
      const compResp = await getDynamicLookup({
        parameter: "HR_CAM_JOIN_RPT_DETAIL", // pay components, keyed on (company_code, doc_no)
        loginid,
        code1: companyCode,
        code2: String(row.cand_no ?? ""), 
        code3: "",
        code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });

      const compArr = Array.isArray(compResp) ? (compResp as Record<string, unknown>[]) : [];

      const payComponents: PayComponentRow[] = compArr
        .map((rec) => ({
          pay_comp_id: pick(rec, "pay_comp_id"),
          pay_comp_amt: pick(rec, "pay_comp_amt"),
        }))
        .filter((d) => d.pay_comp_id)
        .map((d, i) => {
          const id = String(d.pay_comp_id ?? "");
          return {
            _rowId: `existing_${i}`,
            pay_comp_id: id,
            pay_comp_desc: payCompDescMap.get(id) ?? id, 
            pay_comp_amt: Number(d.pay_comp_amt ?? 0),
          };
        });

      return { ...row, payComponents };
    } catch (error) {
      console.error("fetchRowDetail failed:", error);
      return { ...row, payComponents: [] };
    }
  }, [loginid, companyCode, payCompDescMap]);

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
      enableSorting: false,
    },
    {
      accessorKey: "doc_date",
      header: "Doc Date",
      size: 120,
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
      enableSorting: false,
      cell: ({ getValue }) => {
        const val = getValue<string>();
        return val ? new Date(val).toLocaleDateString("en-GB") : "-";
      },
    },
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