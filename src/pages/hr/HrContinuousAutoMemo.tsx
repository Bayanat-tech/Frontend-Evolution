import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddContinuousAutoMemoForm } from "./AddContinuousAutoMemoForm";

// ─── Types ──────────────────────────────────────────────────────────────────
// Field set matches the OLD page exactly — no invented columns (no doc_status,
// no created_at) since those never existed in the old grid.
type ContinuousAutoMemoRow = {
  doc_no: string;
  doc_date: string;
  doc_type: string;
  employee_code: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ContinuousAutoMemoRow>;
};

// ─── Lookup / delete params — SAME parameter names as the old page ─────────
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

const formatDate = (value: unknown) => {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

export function ContinuousAutoMemoPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<ContinuousAutoMemoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ContinuousAutoMemoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── FETCH: Main grid data — parameter "HR_CAM_EMP_CONTINUOUS_MEMO" ───────
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const list = Array.isArray(data) ? (data as ContinuousAutoMemoRow[]) : [];
      setRows(list);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to load continuous auto memo records",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // ─── DELETE — parameter "HR_CAM_EMP_CONT_MEMO_DELETE" (same as old page) ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const docType = deleteTarget.doc_type ?? (deleteTarget as any).DOC_TYPE ?? "";
    const docNo = deleteTarget.doc_no ?? (deleteTarget as any).DOC_NO ?? "";

    if (!docType || !docNo) {
      console.error("Missing doc_type or doc_no for delete:", deleteTarget);
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_EMP_CONT_MEMO_DELETE",
        loginid,
        code1: companyCode,
        code2: String(docType),
        code3: String(docNo),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Document ${docNo} deleted successfully.` });
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

  // ─── COLUMNS — same columns as the old page (Doc No, Doc Date, Doc Type, Employee Code) ──
  const columns = useMemo<ColumnDef<ContinuousAutoMemoRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 140 },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 130,
        cell: ({ getValue }) => formatDate(getValue()) || "-",
      },
      { accessorKey: "doc_type", header: "Doc Type", size: 130 },
      { accessorKey: "employee_code", header: "Employee Code", size: 160 },
      {
        id: "actions",
        header: "Actions",
        size: 120,
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
        getRowId={(row) => {
          const docType = row.doc_type ?? (row as any).DOC_TYPE ?? "";
          const docNo = row.doc_no ?? (row as any).DOC_NO ?? "";
          return `${docType}-${docNo}`;
        }}
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

