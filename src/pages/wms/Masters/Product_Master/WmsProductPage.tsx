import { Edit2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../../state/AuthContext";
import { useToast } from "../../../../components/ui/AlertToast";
import { TProduct } from "./product-wms.types";
import { deleteProduct , executeWmsInboundSql } from "../../../../api/wms";
import { Button } from "../../../../components/ui/Button";
import { DataTable } from "../../../../components/ui/DataTable";
import { Dialog } from "../../../../components/ui/Dialog";
import AddProductWmsForm from "./ProductWmsForm";

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

  const [dialogOpen, setDialogOpen] = useState<"add" | "import" | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [activeProduct, setActiveProduct] = useState<TProduct | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  const openAdd = () => {
    setEditMode(false);
    setActiveProduct(null);
    setDialogOpen("add");
  };

  const openEdit = (row: TProduct) => {
    setEditMode(true);
    setActiveProduct(row);
    setDialogOpen("add");
  };

  const closeAddDialog = (refresh?: boolean) => {
    setDialogOpen(null);
    setActiveProduct(null);
    if (refresh) void loadRows();
  };

  const requestDelete = (row: TProduct) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(
        {
          prod_code: deleteTarget.prod_code,
          prin_code: deleteTarget.prin_code,
          group_code: deleteTarget.group_code,
          brand_code: deleteTarget.brand_code,
          company_code: deleteTarget.company_code || user?.company_code,
        },
      );
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
      { id: "principal", header: "Principal", cell: ({ row }) => combine(row.original.prin_code, row.original.prin_name), size: 200 },
      { id: "group", header: "Group", cell: ({ row }) => combine(row.original.group_code, row.original.group_name), size: 180 },
      { id: "brand", header: "Brand", cell: ({ row }) => combine(row.original.brand_code, row.original.brand_name), size: 180 },
      { accessorKey: "prod_code", header: "Product Code", size: 120 },
      { accessorKey: "prod_name", header: "Product Name", size: 220 },
      { accessorKey: "barcode", header: "Barcode", size: 120 },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit product">
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => requestDelete(row.original)} title="Delete product">
              <Trash2 size={14} />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    []
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">WMS Master</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Product
          </Button>
          <Button onClick={() => setDialogOpen("import")}>
            <Upload size={15} /> Import
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Products`}
        subtitle="Product List"
        searchValue={query}
        onSearchChange={(value) => { setQuery(value); setPageIndex(0); }}
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
        onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPageIndex(0); }}
        getRowId={(row) => `${row.prod_code}-${row.prin_code}`}
      />

      <Dialog
        open={dialogOpen === "add"}
        title={editMode ? "Edit Product" : "Add Product"}
        description="Product information"
        compact
        wide
        onClose={() => closeAddDialog()}
      >
        <AddProductWmsForm onClose={closeAddDialog} isEditMode={editMode} existingData={activeProduct ?? {}} />
      </Dialog>

      {/* <Dialog open={dialogOpen === "import"} title="Import Product from Excel" compact wide onClose={() => setDialogOpen(null)}>
        <ImportProductEdi
          onClose={() => setDialogOpen(null)}
          onSuccess={() => {
            void loadRows();
            setDialogOpen(null);
          }}
        />
      </Dialog> */}

      <Dialog
        open={deleteOpen}
        title="Delete Product"
        description={deleteTarget ? `Delete ${deleteTarget.prod_code} - ${deleteTarget.prod_name}?` : undefined}
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