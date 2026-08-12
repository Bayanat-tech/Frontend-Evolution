import type { ColumnDef } from "@tanstack/react-table"; 
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddProductTypeForm } from "./PS_AddproductTypeform";

// ─── Types ──────────────────────────────────────────────────────────────────
// Field set matches the OLD dw_erp_prodtype DataWindow exactly — no invented
// columns, since the old grid only ever exposed code + name.
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

// ─── Lookup / delete params — VERIFY against the actual DB proc names ──────
// Placeholder parameter names below — swap for the real
// PROC_BUILD_DYNAMIC_LOOKUP / PROC_BUILD_DYNAMIC_DELETE entries for
// MSE_PRODTYPE if these differ.
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

export function ProductTypePage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<ProductTypeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ProductTypeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── FETCH: Main grid data — parameter "PUR_PRODTYPE" ─────────────────────
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookupaccount(baseParams(loginid, companyCode));
      const list = Array.isArray(data) ? (data as ProductTypeRow[]) : [];
      setRows(list);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load product type records",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // ─── DELETE — parameter "PUR_PRODTYPE_DELETE" ──────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const prodtypeCode = deleteTarget.prodtype_code ?? (deleteTarget as any).PRODTYPE_CODE ?? "";

    if (!prodtypeCode) {
      console.error("Missing prodtype_code for delete:", deleteTarget);
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
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete product type",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ─── COLUMNS — same columns as the old page (Prod Type Code, Prod Type Name) ──
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">Product Type</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage product type master records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Create Product Type
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
        subtitle="Product Type List"
        searchPlaceholder="Search code, name..."
        loading={loading}
        height={560}
        minWidth={700}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => {
          const prodtypeCode = row.prodtype_code ?? (row as any).PRODTYPE_CODE ?? "";
          return String(prodtypeCode);
        }}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Product Type"
              : popup.mode === "edit"
                ? "Edit Product Type"
                : "View Product Type"
          }
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddProductTypeForm
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