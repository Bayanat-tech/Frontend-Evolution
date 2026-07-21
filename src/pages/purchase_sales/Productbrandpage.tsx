import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddProductBrandForm } from "./Addproductbrandform";


type ProductBrandRow = {
  company_code: string;
  brand_code: string;
  brand_name: string;
  user_id: string;
  user_dt: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ProductBrandRow>;
};


const PURCHASE_SALE_MSE_PRODBRAND = "PURCHASE_SALE_MSE_PRODBRAND";
const PURCHASE_SALE_MSE_PRODBRAND_DELETE = "PURCHASE_SALE_MSE_PRODBRAND_DELETE";

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: PURCHASE_SALE_MSE_PRODBRAND,
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


export function ProductBrandPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<ProductBrandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ProductBrandRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookupaccount(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: ProductBrandRow[] = raw.map((r) => ({
        ...(r as ProductBrandRow),
        company_code: String(r.company_code ?? r.COMPANY_CODE ?? companyCode),
        brand_code: String(r.brand_code ?? r.BRAND_CODE ?? ""),
        brand_name: String(r.brand_name ?? r.BRAND_NAME ?? ""),
        user_id: String(r.user_id ?? r.USER_ID ?? ""),
        user_dt: String(r.user_dt ?? r.USER_DT ?? ""),
      }));
     setRows(list);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load product brand records",
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
        parameter: PURCHASE_SALE_MSE_PRODBRAND_DELETE,
        loginid,
        code1: companyCode,
        code2: deleteTarget.brand_code,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Brand ${deleteTarget.brand_code} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete product brand record",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ProductBrandRow>[]>(
    () => [
      { accessorKey: "brand_code", header: "Brand Code", size: 140, enableSorting: false },
      { accessorKey: "brand_name", header: "Brand Name", size: 260, enableSorting: false },
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">Product Brand Master</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage product brand codes used across purchase and sales documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Brand
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
        subtitle="Product Brand List"
        searchPlaceholder="Search brand code, name..."
        loading={loading}
        height={560}
        minWidth={700}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.company_code}-${row.brand_code}`}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Brand"
              : popup.mode === "edit"
                ? "Edit Brand"
                : "View Brand"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddProductBrandForm
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
        title="Delete Brand"
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
          Confirm delete for brand code <strong>{deleteTarget?.brand_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}