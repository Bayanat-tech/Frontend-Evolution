import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NoticeToast } from "../../../components/ui/NoticeToast";
// NOTE: adjust these two imports/names to whatever you actually export from api/wms
// (mirroring getAllStockTransfers / createSTN in the transfer module).
import { procBuildDynamicSqlCommonBase } from "../../../api/wms";
import StockCountForm from "./AddStockCount";
import { useAuth } from "../../../state/AuthContext";

type WmsRow = Record<string, unknown>;

function val(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? "");
}

function formatDate(input: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB");
}

export function StockCountPage() {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [selectedRow, setSelectedRow] = useState<WmsRow | null>(null);
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const { user } = useAuth();
  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
    //   const data = await getAllStockCounts();
         const data= await procBuildDynamicSqlCommonBase({
                parameter: 'STOCKCOUNT_document_page',
                loginid: user?.loginid || '',
            });
      const normalized = [...(data as any[])]
        .sort((a, b) => new Date(b.COUNT_DATE ?? 0).getTime() - new Date(a.COUNT_DATE ?? 0).getTime())
        .map((row) => {
          const n: WmsRow = { ...row };
          Object.entries(row).forEach(([k, v]) => { n[k.toLowerCase()] = v; });
          return n;
        });
      setRows(normalized);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load stock counts." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  const openAdd = () => {
    setSelectedRow(null);
    setFormMode("add");
    setFormOpen(true);
  };

  const openEdit = (row: WmsRow) => {
    setSelectedRow(row);
    setFormMode("edit");
    setFormOpen(true);
  };

  const columns = useMemo<ColumnDef<WmsRow>[]>(() => [
    {
      accessorKey: "count_no",
      header: "Count No",
      size: 120,
      cell: ({ row }) => (
        <button className="font-semibold text-primary hover:underline" onClick={() => openEdit(row.original)}>
          {val(row.original, "count_no")}
        </button>
      ),
    },
    {
      accessorKey: "count_date",
      header: "Count Date",
      size: 110,
      cell: ({ row }) => formatDate(val(row.original, "count_date")),
    },
    {
      accessorKey: "confirmed",
      header: "Confirmed",
      size: 100,
      cell: ({ row }) => val(row.original, "confirmed") || "-",
    },
    {
      accessorKey: "confirmed_date",
      header: "Confirmed Date",
      size: 130,
      cell: ({ row }) => formatDate(val(row.original, "confirmed_date")),
    },
    {
      accessorKey: "site_code_from",
      header: "Site Code From",
      size: 130,
      cell: ({ row }) => val(row.original, "site_code_from") || "-",
    },
    {
      accessorKey: "site_code_to",
      header: "Site Code To",
      size: 130,
      cell: ({ row }) => val(row.original, "site_code_to") || "-",
    },
    {
      accessorKey: "from_location",
      header: "Location From",
      size: 130,
      cell: ({ row }) => val(row.original, "from_location") || "-",
    },
    {
      accessorKey: "to_location",
      header: "Location To",
      size: 130,
      cell: ({ row }) => val(row.original, "to_location") || "-",
    },
    {
      id: "actions",
      header: "Actions",
      size: 80,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Button size="icon" variant="ghost" title="Edit count" onClick={() => openEdit(row.original)}>
          <Edit size={14} />
        </Button>
      ),
    },
  ], []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Stock Count Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            View, create, and edit stock count records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={openAdd}><Plus size={15} /> Add Stock Count</Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        subtitle="Stock Counts"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search count no, site..."
        loading={loading}
        height="calc(100vh - 260px)"
        minWidth={960}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => val(row, "count_no") || String(index)}
      />

      {formOpen && (
        <StockCountForm
          open={formOpen}
          mode={formMode}
          editRowData={selectedRow}
          onClose={(shouldRefetch) => {
            setFormOpen(false);
            if (shouldRefetch) {
              void loadRows(false);
              setNotice({ type: "success", message: "Stock count saved successfully." });
            }
          }}
        />
      )}
    </section>
  );
}

export default StockCountPage;