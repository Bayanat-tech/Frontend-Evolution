import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, Eye, FileText, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
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

type Notice = { type: "success" | "error"; message: string } | null;

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
  const [query, setQuery] = useState(""); // Added for controlled search
  
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ProductBrandRow | null>(null);
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
    },
    [loginid, companyCode],
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // Local filtering for the search bar
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
        parameter: PURCHASE_SALE_MSE_PRODBRAND_DELETE,
        loginid,
        code1: companyCode,
        code2: deleteTarget.brand_code,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Brand ${deleteTarget.brand_code} deleted successfully.` });
      await loadRows(false);
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

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, WMS style header
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
                  {popup.mode === "add" ? "New Brand" : popup.mode === "edit" ? "Edit Brand" : "View Brand"}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {popup.mode === "view" ? "Viewing" : popup.mode === "edit" ? "Editing" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          {/* WMS-style actions: List / Close / Reset / Save */}
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
              <Button type="submit" form="brand-master-form" size="sm" disabled={formSaving}>
                <Save size={14} /> {formSaving ? "Saving" : popup.mode === "edit" ? "Update" : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Form content */}
        <AddProductBrandForm
          key={`${popup.mode}-${popup.data.brand_code ?? "new"}-${resetKey}`}
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
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — WMS style (buttons inside DataTable toolbar)
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
            Product Brand
          </h2>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Product Brand List"
        searchValue={query}
        onSearchChange={(value) => setQuery(value)}
        searchPlaceholder="Search brand code, name..."
        loading={loading}
        height="calc(100dvh - 150px)"
        minWidth={700}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.company_code}-${row.brand_code}`}
        enableExport
        exportFilename="product-brands.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRows(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setPopup({ open: true, mode: "add", data: {} })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Brand
            </button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
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