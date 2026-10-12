import type { ColumnDef } from "@tanstack/react-table";
import {
  Edit2, Eye, FileSignature, Loader2, Plus, RefreshCw, Save, Send, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import {
  AddContinuousAutoMemoForm,
  type ContinuousAutoMemoFormHandle,
  type FormMode,
} from "./AddContinuousAutoMemoForm";

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

// ─── Lookup params — SAME parameter name as the old page ────────────────────
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
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<ContinuousAutoMemoRow[]>([]);
  const [loading, setLoading] = useState(false);

  // inline form (replaces the grid while open)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [activeRow, setActiveRow] = useState<ContinuousAutoMemoRow | null>(null);
  const [formKey, setFormKey] = useState(0); // remount form when switching rows
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<ContinuousAutoMemoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header buttons can trigger it
  const formRef = useRef<ContinuousAutoMemoFormHandle>(null);

  const readonly = formMode === "view";
  const editing = formMode === "edit";

  // ─── FETCH: Main grid data — parameter "HR_CAM_EMP_CONTINUOUS_MEMO" ───────
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      setRows(Array.isArray(data) ? (data as ContinuousAutoMemoRow[]) : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load continuous auto memo records",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Inline form open / close ── */
  const openForm = (mode: FormMode, row: ContinuousAutoMemoRow | null = null) => {
    setFormMode(mode);
    setActiveRow(row);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

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

  // ─── DELETE — parameter "HR_CAM_EMP_CONT_MEMO_DELETE" (same as old page) ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const docType = deleteTarget.doc_type ?? (deleteTarget as any).DOC_TYPE ?? "";
    const docNo = deleteTarget.doc_no ?? (deleteTarget as any).DOC_NO ?? "";

    if (!docType || !docNo) {
      console.error("Missing doc_type or doc_no for delete:", deleteTarget);
      toast.error("Unable to delete: document type or number is missing");
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_EMP_CONT_MEMO_DELETE",
        loginid,
        code1: companyCode,
        code2: String(docType),
        code3: String(docNo),
      });
      toast.success(`Document ${docNo} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete memo");
    } finally {
      setDeleting(false);
    }
  };

  // ─── COLUMNS — same columns as the old page ──────────────────────────────
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
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openForm("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openForm("view", row.original)}
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
    [],
  );

  const formBadge = formMode === "add" ? "Draft" : editing ? "Editing" : "View only";

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileSignature size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Transactions - Continuous Auto Memo
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
                      Doc No: {activeRow.doc_no}
                      {activeRow.employee_code ? ` - Emp: ${activeRow.employee_code}` : ""}
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
            disabled={loading || saving}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openForm("add")} disabled={saving}>
            <Plus size={14} /> Add
          </Button>
          {formOpen && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
                <X size={14} /> Close
              </Button>
              {!readonly && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void formRef.current?.saveDraft()}
                    disabled={saving}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                    {saving ? "Saving" : "Save as Draft"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => formRef.current?.submit()}
                    disabled={saving}
                  >
                    <Send size={14} /> Submit
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit / View form — replaces the grid while open */}
      {formOpen ? (
        <AddContinuousAutoMemoForm
          key={formKey}
          ref={formRef}
          mode={formMode}
          existingData={activeRow}
          onClose={handleFormClosed}
          onSavingChange={setSaving}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${rows.length.toLocaleString()} Records`}
          subtitle="Continuous Auto Memo List"
          searchPlaceholder="Search doc no, employee..."
          loading={loading}
          emptyText="No continuous auto memo records found. Click Add to create one."
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
      )}

      {/* Delete confirmation */}
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
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Confirm delete for document <strong>{deleteTarget?.doc_no}</strong>?
        </p>
      </Dialog>
    </section>
  );
}