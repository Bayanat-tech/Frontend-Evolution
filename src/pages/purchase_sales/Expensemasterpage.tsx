import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, FileText, Plus, RefreshCw, Save, Trash2, X, ArrowLeft, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddExpenseMasterForm } from "./Addexpensemasterform";

type ExpenseMasterRow = {
  company_code: string;
  expense_code: string;
  expense_name: string;
  ac_code: string;
  user_id: string;
  user_dt: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ExpenseMasterRow>;
};

type Notice = { type: "success" | "error"; message: string } | null;

const PURCHASE_SALE_MSE_EXPENSES = "PURCHASE_SALE_MSE_EXPENSES";
const PURCHASE_SALE_MSE_EXPENSES_DELETE = "PURCHASE_SALE_MSE_EXPENSES_DELETE";

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: PURCHASE_SALE_MSE_EXPENSES,
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

export function ExpenseMasterPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<ExpenseMasterRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ExpenseMasterRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const loadRows = useCallback(
    async (clearNotice = true) => {
      if (!companyCode) return;
      setLoading(true);
      if (clearNotice) setNotice(null);
      try {
        const data = await getDynamicLookupaccount(baseParams(loginid, companyCode));
        const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        const list: ExpenseMasterRow[] = raw.map((r) => ({
          ...(r as ExpenseMasterRow),
          company_code: String(r.company_code ?? r.COMPANY_CODE ?? companyCode),
          expense_code: String(r.expense_code ?? r.EXPENSE_CODE ?? ""),
          expense_name: String(r.expense_name ?? r.EXPENSE_NAME ?? ""),
          ac_code: String(r.ac_code ?? r.AC_CODE ?? ""),
          ac_name: String(r.ac_name ?? r.AC_NAME ?? ""),
          user_id: String(r.user_id ?? r.USER_ID ?? ""),
          user_dt: String(r.user_dt ?? r.USER_DT ?? ""),
        }));
        setRows(list);
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to load expense master records",
        });
      } finally {
        setLoading(false);
      }
    },
    [loginid, companyCode],
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: PURCHASE_SALE_MSE_EXPENSES_DELETE,
        loginid,
        code1: companyCode,
        code2: deleteTarget.expense_code,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Expense ${deleteTarget.expense_code} deleted successfully.` });
      await loadRows(false);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete expense master record",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ExpenseMasterRow>[]>(
    () => [
      { accessorKey: "expense_code", header: "Expense Code", size: 140, enableSorting: false },
      { accessorKey: "expense_name", header: "Expense Name", size: 260, enableSorting: false },
      { accessorKey: "ac_code", header: "A/C Code", size: 140, enableSorting: false },
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        size: 100,
        enableColumnFilter: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="Edit"
              className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
              onClick={() => setPopup({ open: true, mode: "edit", data: row.original })}
            >
              <Edit2 size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="View"
              className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
              onClick={() => setPopup({ open: true, mode: "view", data: row.original })}
            >
              <Eye size={15} />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              title="Delete" 
              className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const formOpen = popup.open;
  const readonly = popup.mode === "view";
  const closeForm = () => setPopup((p) => ({ ...p, open: false }));

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header
     ───────────────────────────────────────────────────────── */
  if (formOpen) {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        
        {/* WMS-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {popup.mode === "add" ? "New Expense" : popup.mode === "edit" ? "Edit Expense" : "View Expense"}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {popup.mode === "view" ? "Viewing" : popup.mode === "edit" ? "Editing" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!readonly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setResetKey((k) => k + 1)}
                disabled={formSaving}
                title="Reset form"
              >
                <RotateCcw size={14} /> Reset
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={formSaving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={formSaving}>
              <X size={14} /> Close
            </Button>
            {!readonly && (
              <Button type="submit" form="expense-master-form" size="sm" disabled={formSaving}>
                <Save size={14} /> {formSaving ? "Saving" : popup.mode === "edit" ? "Update" : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Form content wrapped in Freight tabs shell */}
        <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
          <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
            <div className="p-3 grid gap-3">
              <AddExpenseMasterForm
                key={`${popup.mode}-${popup.data.expense_code ?? "new"}-${resetKey}`}
                mode={popup.mode}
                existingData={popup.data}
                onSavingChange={setFormSaving}
                onClose={(shouldRefetch?: boolean) => {
                  const wasEdit = popup.mode === "edit";
                  closeForm();
                  if (shouldRefetch) {
                    setNotice({ type: "success", message: wasEdit ? "Successfully updated" : "Successfully created" });
                    void loadRows(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title only — buttons live inside the DataTable toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Expense Master
          </h2>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={`${filteredRows.length.toLocaleString()} Records`}
        subtitle="Expense Master List"
        searchValue={query}
        onSearchChange={(value) => setQuery(value)}
        searchPlaceholder="Search expense code, name, A/C code..."
        loading={loading}
        height="calc(100dvh - 150px)"
        minWidth={900}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.company_code}-${row.expense_code}`}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPopup({ open: true, mode: "add", data: {} })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Expense
            </button>
            <button
              type="button"
              onClick={() => void loadRows(false)}
              className="flex items-center justify-center h-[30px] w-[30px] rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all shadow-sm cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Expense"
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
        <p className="text-sm text-muted-foreground m-0">
          Confirm delete for expense code <strong>{deleteTarget?.expense_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}