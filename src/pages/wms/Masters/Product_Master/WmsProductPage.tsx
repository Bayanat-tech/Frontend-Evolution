import {
  ArrowLeft, Edit2, FileText, Plus, RefreshCw, Save, Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../../state/AuthContext";
import { useToast } from "../../../../components/ui/AlertToast";
import { TProduct } from "./product-wms.types";
import { deleteProduct, executeWmsInboundSql } from "../../../../api/wms";
import { Button } from "../../../../components/ui/Button";
import { DataTable } from "../../../../components/ui/DataTable";
import { Dialog } from "../../../../components/ui/Dialog";
import AddProductWmsForm, { type ProductFormHandle } from "./ProductWmsForm";

const PAGE_SIZE_OPTIONS = [50, 100, 200];

export function ProductWmsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<TProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [totalRows, setTotalRows] = useState(0);

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editMode, setEditMode] = useState(false);
  const [activeProduct, setActiveProduct] = useState<TProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ Ref to the form so the header Save button can trigger it
  const formRef = useRef<ProductFormHandle>(null);

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
    try {
      const hasSearch = Boolean(query.trim());
      const whereSql = `WHERE p.COMPANY_CODE = '${user?.company_code}'`;

      const baseSql = `
        SELECT
          p.*,
          pr.PRIN_NAME AS PRIN_NAME,
          g.GROUP_NAME AS GROUP_NAME,
          b.BRAND_NAME AS BRAND_NAME
        FROM MS_PRODUCT p
        LEFT JOIN MS_PRINCIPAL pr
          ON pr.COMPANY_CODE = p.COMPANY_CODE AND pr.PRIN_CODE = p.PRIN_CODE
        LEFT JOIN MS_PRODGROUP g
          ON g.COMPANY_CODE = p.COMPANY_CODE AND g.PRIN_CODE = p.PRIN_CODE AND g.GROUP_CODE = p.GROUP_CODE
        LEFT JOIN MS_PRODBRAND b
          ON b.COMPANY_CODE = p.COMPANY_CODE AND b.PRIN_CODE = p.PRIN_CODE
         AND b.GROUP_CODE = p.GROUP_CODE AND b.BRAND_CODE = p.BRAND_CODE
        ${whereSql}
      `;

      const countSql = `SELECT COUNT(*) as TOTAL_COUNT FROM MS_PRODUCT p ${whereSql}`;

      const startRow = hasSearch ? 0 : nextPageIndex * nextPageSize;
      const endRow = hasSearch ? 100000 : startRow + nextPageSize;

      const paginatedSql = `
        SELECT * FROM (
          SELECT a.*, ROWNUM as rnum FROM (
            ${baseSql} ORDER BY PROD_CODE
          ) a WHERE ROWNUM <= ${endRow}
        ) WHERE rnum > ${startRow}
      `;

      const [dataResponse, countResponse] = await Promise.all([
        executeWmsInboundSql(paginatedSql) as Promise<Record<string, unknown>[]>,
        executeWmsInboundSql(countSql) as Promise<{ TOTAL_COUNT: number }[]>,
      ]);

      setRows((dataResponse ?? []).map((item: Record<string, unknown>) => toLowerCaseKeys<TProduct>(item)));
      setTotalRows(countResponse?.[0]?.TOTAL_COUNT ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [pageIndex, pageSize, query]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  /* ── Navigation handlers ── */
  const openAdd = () => {
    setEditMode(false);
    setActiveProduct(null);
    setView("editor");
  };

  const openEdit = (row: TProduct) => {
    setEditMode(true);
    setActiveProduct(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditMode(false);
    setActiveProduct(null);
  };

  const handleSaved = () => {
    handleCloseEditor();
    void loadRows();
  };

  /* ✅ Header Save button handler */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const requestDelete = (row: TProduct) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct({
        prod_code: deleteTarget.prod_code,
        prin_code: deleteTarget.prin_code,
        group_code: deleteTarget.group_code,
        brand_code: deleteTarget.brand_code,
        company_code: deleteTarget.company_code || user?.company_code,
      });
      toast.success("Product deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<TProduct>[]>(
    () => [
      {
        id: "principal",
        header: "Principal",
        cell: ({ row }) => combine(row.original.prin_code, row.original.prin_name),
        size: 200,
      },
      {
        id: "group",
        header: "Group",
        cell: ({ row }) => combine(row.original.group_code, row.original.group_name),
        size: 180,
      },
      {
        id: "brand",
        header: "Brand",
        cell: ({ row }) => combine(row.original.brand_code, row.original.brand_name),
        size: 180,
      },
      { accessorKey: "prod_code", header: "Product Code", size: 120 },
      { accessorKey: "prod_name", header: "Product Name", size: 220 },
      { accessorKey: "barcode", header: "Barcode", size: 120 },
      {
        id: "actions",
        header: "Actions",
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEdit(row.original)}
              title="Edit product"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => requestDelete(row.original)}
              title="Delete product"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {editMode ? "Edit Product" : "New Product"}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          {/* ✅ Freight-style actions: List / Close / Save */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
              <Save size={14} /> {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        {/* Form content — pass ref so header Save works */}
        <AddProductWmsForm
          ref={formRef}
          onClose={(refresh) => (refresh ? handleSaved() : handleCloseEditor())}
          isEditMode={editMode}
          existingData={activeProduct ?? {}}
        />
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
            Products
          </h2>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Products`}
        subtitle="Product List"
        searchValue={query}
        onSearchChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        searchPlaceholder="Search product code, name, barcode..."
        loading={loading}
        emptyText="No products found"
        height={620}
        minWidth={900}
        density="grid"
        enablePagination
        manualPagination={!query.trim()}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageIndex(0);
        }}
        getRowId={(row) => `${row.prod_code}-${row.prin_code}`}
        enableExport
        exportFilename="wms-products-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Upload size={14} />
              Import
            </button>

            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Product
            </button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        title="Delete Product"
        description={
          deleteTarget ? `Delete ${deleteTarget.prod_code} - ${deleteTarget.prod_name}?` : undefined
        }
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={deleting} variant="destructive" onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">Are you sure you want to delete?</p>
      </Dialog>

      {/* Import dialog */}
      {importOpen && (
        <Dialog
          open={importOpen}
          title="Import Products"
          description="Upload products via Excel/EDI"
          compact
          wide
          onClose={() => setImportOpen(false)}
        >
          <div style={{ maxHeight: "calc(90vh - 180px)", overflowY: "auto", width: "100%" }}>
            {/* <ImportProductEdi
              onSuccess={() => { void loadRows(); setImportOpen(false); }}
              onClose={() => setImportOpen(false)}
            /> */}
          </div>
        </Dialog>
      )}
    </section>
  );
}

function combine(code?: string, name?: string) {
  if (code && name) return `${code} - ${name}`;
  return code || name || "N/A";
}

function toLowerCaseKeys<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    result[key.toLowerCase()] = row[key];
  }
  return result as T;
}