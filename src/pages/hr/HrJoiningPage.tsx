import type { ColumnDef } from "@tanstack/react-table";
import {
  Edit2, Eye, Loader2, Plus, RefreshCw, Save, Trash2, UserCheck, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import {
  AddHrJoiningForm,
  type FormMode,
  type HrJoiningFormHandle,
} from "./AddHrJoiningForm";

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

const sortByCreatedAtDesc = (rows: JoiningRow[]): JoiningRow[] =>
  [...rows].sort((a, b) => parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at));

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

const formatDate = (val: unknown) => {
  if (!val) return "-";
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString("en-GB");
};

export function HrJoiningPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<JoiningRow[]>([]);
  const [loading, setLoading] = useState(false);

  // inline form (replaces the grid while open)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [activeRow, setActiveRow] = useState<JoiningRow | null>(null);
  const [formKey, setFormKey] = useState(0); // remount form when switching rows
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false); // fetching detail for edit/view

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<JoiningRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<HrJoiningFormHandle>(null);

  const readonly = formMode === "view";
  const editing = formMode === "edit";

  // Pay-component master list (ID -> description) used to label detail rows
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
          arr
            .map((r) => ({
              pay_comp_id: String(pick(r, "pay_comp_id") ?? ""),
              pay_comp_desc: String(pick(r, "pay_comp_desc") ?? ""),
            }))
            .filter((r) => r.pay_comp_id),
        );
      })
      .catch(() => setPayCompMaster([]));
  }, [loginid, companyCode]);

  const payCompDescMap = useMemo(
    () => new Map(payCompMaster.map((o) => [o.pay_comp_id, o.pay_comp_desc])),
    [payCompMaster],
  );

  // ── Fetch main grid ──────────────────────────────────────────────────────
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
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
      toast.error(error instanceof Error ? error.message : "Unable to load joining records");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // ── Fetch row detail (pay components only) ───────────────────────────────
  const fetchRowDetail = useCallback(
    async (row: JoiningRow): Promise<JoiningRow> => {
      try {
        const compResp = await getDynamicLookup({
          parameter: "HR_CAM_JOIN_RPT_DETAIL",
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
        toast.error("Unable to load pay components");
        return { ...row, payComponents: [] };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loginid, companyCode, payCompDescMap],
  );

  /* ── Inline form open / close ── */
  const openForm = (mode: FormMode, row: JoiningRow | null = null) => {
    setFormMode(mode);
    setActiveRow(row);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const openRow = useCallback(
    async (mode: "edit" | "view", row: JoiningRow) => {
      setOpening(true);
      try {
        const fullRow = await fetchRowDetail(row);
        openForm(mode, fullRow);
      } finally {
        setOpening(false);
      }
    },
    [fetchRowDetail],
  );

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormMode("add");
    setActiveRow(null);
  };

  const handleFormClosed = (shouldRefetch?: boolean) => {
    setFormOpen(false);
    setFormMode("add");
    setActiveRow(null);
    if (shouldRefetch) void loadRows();
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

  // ── Delete ───────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_JOIN_RPT_DELETE",
        loginid,
        code1: companyCode,
        code2: String(deleteTarget.doc_no),
      });
      toast.success(`Joining document ${deleteTarget.doc_no} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete record");
    } finally {
      setDeleting(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<JoiningRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 100, enableSorting: false },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue()),
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
        cell: ({ getValue }) => formatDate(getValue()),
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
              onClick={() => void openRow("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => void openRow("view", row.original)}
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
    // openRow depends on fetchRowDetail → payCompDescMap, so the grid must
    // rebuild when the pay-component master list arrives
    [openRow],
  );

  const formBadge = formMode === "add" ? "Draft" : editing ? "Editing" : "View only";
  const busy = loading || opening;

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UserCheck size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Recruitment - Joining
              </h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
              {formOpen && (
                <>
                  <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                    {formBadge}
                  </span>
                  {activeRow?.doc_no && (
                    <span className="text-xs text-muted-foreground">
                      Doc No: {String(activeRow.doc_no)}
                      {activeRow.cand_name ? ` - ${activeRow.cand_name}` : ""}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadRows()}
            disabled={busy || saving}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openForm("add")}
            disabled={opening || saving}
          >
            <Plus size={14} /> Add
          </Button>
          {formOpen && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
                <X size={14} /> Close
              </Button>
              {!readonly && (
                <Button type="button" size="sm" onClick={() => void handleHeaderSave()} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                  {saving ? "Saving" : editing ? "Update" : "Save"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit / View form — replaces the grid while open */}
      {formOpen ? (
        <AddHrJoiningForm
          key={formKey}
          ref={formRef}
          mode={formMode}
          existingData={activeRow}
          onClose={handleFormClosed}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading..." : `${rows.length.toLocaleString()} Records`}
          subtitle="HR Joining List"
          searchPlaceholder="Search doc no, candidate, division..."
          loading={busy}
          emptyText="No joining records found. Click Add to create one."
          height={520}
          minWidth={1100}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => String(row.doc_no)}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Joining"
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Confirm delete for document <strong>{String(deleteTarget?.doc_no ?? "")}</strong>?
        </p>
      </Dialog>
    </section>
  );
}