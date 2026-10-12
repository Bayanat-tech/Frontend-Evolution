import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, FileText, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddProductTypeForm } from "./PS_AddproductTypeform";

type ProductTypeRow = {
  prodtype_code: string;
  prodtype_name: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ProductTypeRow>;
};

type Notice = { type: "success" | "error"; message: string } | null;

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "PURCHASE_SALE_MSE_PRODTYPE",
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

const normalizeRow = (r: any): ProductTypeRow => ({
  ...r,
  prodtype_code: r.prodtype_code ?? r.PRODTYPE_CODE ?? "",
  prodtype_name: r.prodtype_name ?? r.PRODTYPE_NAME ?? "",
});

export function ProductTypePage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<ProductTypeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ProductTypeRow | null>(null);
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
        const list = Array.isArray(data) ? data : [];
        setRows(list.map(normalizeRow));
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to load product type records",
        });
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [loginid, companyCode],
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const prodtypeCode = deleteTarget.prodtype_code ?? "";

    if (!prodtypeCode) {
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "PURCHASE_SALE_MSE_PRODTYPE_DELETE",
        loginid,
        code1: companyCode,
        code2: String(prodtypeCode),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Product type ${prodtypeCode} deleted successfully.` });
      await loadRows(false);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete product type",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ProductTypeRow>[]>(
    () => [
      { accessorKey: "prodtype_code", header: "Prod Type Code", size: 160 },
      { accessorKey: "prodtype_name", header: "Prod Type Name", size: 260 },
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
            <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}>
              <Trash2 size={14} />
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
  const pageTitle = !formOpen
    ? "Product Type"
    : popup.mode === "add"
      ? "New Product Type"
      : popup.mode === "edit"
        ? "Edit Product Type"
        : "View Product Type";

  return (
    <section className="grid gap-2 p-1">
      {/* ---------- Top Header ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
            <FileText size={14} />
          </div>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
        </div>

        {formOpen ? (
          <div className="flex items-center gap-1.5">
           {!readonly && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetKey((k) => k + 1)}
                disabled={formSaving}
                title="Reset form"
                className="h-7 gap-1 rounded-md px-3 text-xs font-semibold"
              >
                <RotateCcw size={13} /> Reset
              </Button>
            )}


            {!readonly && (
              <Button
                type="submit"
                form="product-type-form"
                disabled={formSaving}
                className="h-7 gap-1 rounded-md bg-[#00378C] px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#002d72]"
              >
                <Save size={13} /> {formSaving ? "Saving..." : popup.mode === "edit" ? "Update" : "Save"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={closeForm}
              disabled={formSaving}
              aria-label="Close"
              title="Close"
              className="h-7 w-7 rounded-md"
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setPopup({ open: true, mode: "add", data: {} })}
              className="h-8 gap-1.5 rounded-lg bg-[#00378C] px-3.5 text-xs font-semibold text-white hover:bg-[#002d72]"
            >
              <Plus size={14} strokeWidth={2.5} /> Add
            </Button>
            <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => void loadRows(false)}>
              <RefreshCw size={15} />
            </Button>
          </div>
        )}
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ---------- EDITOR (in-page) ---------- */}
      {formOpen && (
        <AddProductTypeForm
          key={`${popup.mode}-${popup.data.prodtype_code ?? "new"}-${resetKey}`}
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
      )}

      {/* ---------- LIST ---------- */}
      {!formOpen && (
        <DataTable
          columns={columns}
          data={rows}
          title={`${rows.length.toLocaleString()} Records`}
          subtitle="Product Type List"
          searchPlaceholder="Search code, name..."
          loading={loading}
          height="calc(100dvh - 150px)"
          minWidth={700}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => String(row.prodtype_code ?? "")}
        />
      )}

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Product Type"
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
          Confirm delete for product type <strong>{deleteTarget?.prodtype_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}