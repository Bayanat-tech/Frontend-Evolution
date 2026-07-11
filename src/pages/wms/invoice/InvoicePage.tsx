import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { getAllInvoices } from "../../../api/billing";
import InvoiceForm from "./InvoiceForm";

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

export function InvoicePage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<WmsRow | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRows = async (clearNotice = true) => {
    if (!user?.company_code) return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getAllInvoices(user.company_code, user.loginid ?? "");
      const normalized = (data as any[]).map((row) => {
        const n: WmsRow = { ...row };
        Object.entries(row).forEach(([k, v]) => { n[k.toLowerCase()] = v; });
        return n;
      });
      setRows(normalized);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load invoices." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [user?.company_code]);

  const openForm = (row: WmsRow | null, view: boolean) => {
    setEditingRow(row);
    setViewMode(view);
    setFormOpen(true);
  };

//   const handleDelete = async (row: WmsRow) => {
//     if (!window.confirm("Delete this invoice?")) return;
//     try {
//       await deleteInvoice({
//         loginid: user?.loginid ?? "",
//         company_code: user?.company_code ?? "",
//         invoice_no: val(row, "invoice_no"),
//         prin_code: val(row, "prin_code"),
//       });
//       setNotice({ type: "success", message: "Invoice deleted." });
//       void loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete invoice." });
//     }
//   };

  const columns = useMemo<ColumnDef<WmsRow>[]>(() => [
    {
      accessorKey: "invoice_no",
      header: "Invoice No",
      size: 130,
      cell: ({ row }) => (
        <button className="font-semibold text-primary hover:underline" onClick={() => openForm(row.original, true)}>
          {val(row.original, "invoice_no")}
        </button>
      ),
    },
    {
      accessorKey: "invoice_date",
      header: "Invoice Date",
      size: 120,
      cell: ({ row }) => formatDate(val(row.original, "invoice_date")),
    },
    {
      id: "principal",
      header: "Principal",
      size: 220,
      cell: ({ row }) => {
        const code = val(row.original, "prin_code");
        const name = val(row.original, "prin_name");
        return [code, name].filter(Boolean).join(" - ") || "-";
      },
    },
    { accessorKey: "div_name", header: "Division", size: 120, cell: ({ row }) => val(row.original, "div_name") || "-" },
    { accessorKey: "curr_code", header: "Currency", size: 90 },
    {
      accessorKey: "inv_amount",
      header: "Invoice Amount",
      size: 130,
      cell: ({ row }) => <span className="block text-right tabular-nums">{val(row.original, "inv_amount")}</span>,
    },
    { accessorKey: "inv_status", header: "Status", size: 90 },
    {
      id: "actions",
      header: "Actions",
      size: 110,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="View invoice" onClick={() => openForm(row.original, true)}>
            <Eye size={14} />
          </Button>
          <Button size="icon" variant="ghost" title="Edit invoice" onClick={() => openForm(row.original, false)}>
            <Pencil size={14} />
          </Button>
          {/* <Button size="icon" variant="ghost" title="Delete invoice" onClick={() => handleDelete(row.original)}>
            <Trash2 size={14} />
          </Button> */}
        </div>
      ),
    },
  ], []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Invoice Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Create and manage principal billing invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => openForm(null, false)}><Plus size={15} /> Create Invoice</Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        subtitle="Invoices"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search invoice no, principal..."
        loading={loading}
        height="calc(100vh - 260px)"
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => {
          const inv = val(row, "invoice_no");
          const prin = val(row, "prin_code");
          const co = val(row, "company_code");
          return inv ? `${co}-${prin}-${inv}` : String(index);
        }}
      />

      {formOpen && (
        <InvoiceForm
          existingData={editingRow ?? undefined}
          viewMode={viewMode}
          onClose={(shouldRefetch) => {
            setFormOpen(false);
            if (shouldRefetch) {
              void loadRows(false);
              setNotice({ type: "success", message: "Invoice saved successfully." });
            }
          }}
        />
      )}
    </section>
  );
}

export default InvoicePage;