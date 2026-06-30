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
  doc_date?: string;
  doc_ref_no?: string;
  cand_name?: string;
  division?: string;
  desig?: string;
  join_date?: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<JoiningRow>;
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
      setRows(Array.isArray(data) ? (data as JoiningRow[]) : []);
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
      if (Array.isArray(detail) && detail.length > 0) {
        const header = detail[0] as Record<string, unknown>;
        const payComponents = detail
          .slice(1)
          .filter((d: LookupRow) => d.PAY_COMP_ID || d.pay_comp_id)
          .map((d: LookupRow, i: number) => ({
            _rowId: `existing_${i}`,
            pay_comp_id: String(d.PAY_COMP_ID ?? d.pay_comp_id ?? ""),
            pay_comp_desc: String(d.PAY_COMP_DESC ?? d.pay_comp_desc ?? ""),
            pay_comp_amt: Number(d.PAY_COMP_AMT ?? d.pay_comp_amt ?? 0),
          }));
        return { ...row, ...header, payComponents };
      }
      return row;
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
    { accessorKey: "doc_no", header: "Doc No", size: 100 },
    {
      accessorKey: "doc_date",
      header: "Doc Date",
      size: 120,
      cell: ({ getValue }) => {
        const val = getValue<string>();
        return val ? new Date(val).toLocaleDateString("en-GB") : "-";
      },
    },
    { accessorKey: "doc_ref_no", header: "Ref No", size: 130 },
    { accessorKey: "cand_name", header: "Candidate Name", size: 220 },
    { accessorKey: "division", header: "Division", size: 140 },
    { accessorKey: "desig", header: "Designation", size: 160 },
    {
      accessorKey: "join_date",
      header: "Joining Date",
      size: 130,
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Refresh" onClick={() => loadRows()}>
            <RefreshCw size={15} />
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