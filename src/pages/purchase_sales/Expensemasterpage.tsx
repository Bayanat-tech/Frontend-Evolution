import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getDynamicLookupaccount } from "../../api/lookups";
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

// Adjust these to match the actual dynamic-lookup parameter names configured
// on the backend for this master (mirrors the HR_CAM_INT_EVAL_FORM pattern).
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
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ExpenseMasterRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
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
        parameter: PURCHASE_SALE_MSE_EXPENSES_DELETE,
        loginid,
        code1: companyCode,
        code2: deleteTarget.expense_code,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Expense ${deleteTarget.expense_code} deleted successfully.` });
      await loadRows();
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
    //   { accessorKey: "user_id", header: "Updated By", size: 130, enableSorting: false },
    //   {
    //     accessorKey: "user_dt",
    //     header: "Updated On",
    //     size: 130,
    //     enableSorting: false,
    //     cell: ({ getValue }) => {
    //       const val = getValue<string>();
    //       if (!val) return "-";
    //       const d = new Date(val);
    //       return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB");
    //     },
    //   },
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">Expense Master</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage expense codes used across purchase and accounting documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Expense
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
        subtitle="Expense Master List"
        searchPlaceholder="Search expense code, name, A/C code..."
        loading={loading}
        height={560}
        minWidth={900}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.company_code}-${row.expense_code}`}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Expense"
              : popup.mode === "edit"
                ? "Edit Expense"
                : "View Expense"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddExpenseMasterForm
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
        <p className="text-sm text-muted-foreground">
          Confirm delete for expense code <strong>{deleteTarget?.expense_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}