import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddSalaryAdvanceForm } from "./AddSalaryAdvanceForm";

type SalaryAdvanceRow = {
  doc_no: string;
  doc_date: string;
  employee_code: string;
  amount: number | null;
  recover_mth_amt: number | null;
  balance_amt: number | null;
  doc_status: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<SalaryAdvanceRow>;
};

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "HR_TRANSACTIONS_SELECT",
  loginid,
  code1: companyCode,
  code2: "",
  code3: "",
  code4: "",
  number1: 0,
  number2: 0,
  number3: 0,
  number4: 0,
  date1: null,
  date2: null,
  date3: null,
  date4: null,
});

export function SalaryAdvancePage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<SalaryAdvanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<SalaryAdvanceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      setRows(Array.isArray(data) ? (data as SalaryAdvanceRow[]) : []);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load salary advance records" });
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
        parameter: "MST_HR_SAL_ADVANCE_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_no,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Document ${deleteTarget.doc_no} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete record" });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<SalaryAdvanceRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 120 },
      { accessorKey: "doc_date", header: "Doc Date", size: 130 },
      { accessorKey: "employee_code", header: "Employee Code", size: 150 },
      { accessorKey: "amount", header: "Amount", size: 140 },
      { accessorKey: "recover_mth_amt", header: "Recover / Month", size: 160 },
      { accessorKey: "balance_amt", header: "Balance", size: 130 },
      {
        accessorKey: "doc_status",
        header: "Status",
        size: 110,
        cell: ({ row }) => {
          const active = row.original.doc_status === "A";
          return (
            <span
              style={{
                color: active ? "#16a34a" : "#dc2626",
                fontWeight: 600,
                fontSize: "0.8125rem",
              }}
            >
              {active ? "Active" : "Cancelled"}
            </span>
          );
        },
      },
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
    []
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Salary Advance</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Manage employee salary advance records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Salary Advance
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
        subtitle="Salary Advance List"
        searchPlaceholder="Search doc no, employee..."
        loading={loading}
        height={560}
        minWidth={1060}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.doc_no)}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Salary Advance"
              : popup.mode === "edit"
              ? "Edit Salary Advance"
              : "View Salary Advance"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddSalaryAdvanceForm
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
        title="Delete Salary Advance"
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
