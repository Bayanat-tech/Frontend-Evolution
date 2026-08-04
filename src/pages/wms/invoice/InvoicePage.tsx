import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { getAllInvoices } from "../../../api/billing";
import InvoiceForm from "./InvoiceForm";
import { Badge } from "../../../components/ui/Badge";

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
      accessorKey: "from_date",
      header: "From Date",
      size: 120,
      cell: ({ row }) => formatDate(val(row.original, "from_date")),
    },
    {
      accessorKey: "to_date",
      header: "To Date",
      size: 120,
      cell: ({ row }) => formatDate(val(row.original, "to_date")),
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
    { accessorKey: "div_code", header: "Division Code", size: 100, cell: ({ row }) => val(row.original, "div_code") || "-" },
    { accessorKey: "div_name", header: "Division", size: 120, cell: ({ row }) => val(row.original, "div_name") || "-" },
    { accessorKey: "job_no", header: "Job No", size: 110, cell: ({ row }) => val(row.original, "job_no") || "-" },
    { accessorKey: "other_job", header: "Other Job", size: 110, cell: ({ row }) => val(row.original, "other_job") || "-" },
    { accessorKey: "cust_code", header: "Customer Code", size: 120, cell: ({ row }) => val(row.original, "cust_code") || "-" },
    { accessorKey: "inv_to", header: "Invoice To", size: 160, cell: ({ row }) => val(row.original, "inv_to") || "-" },
    { accessorKey: "inv_type", header: "Invoice Type", size: 110, cell: ({ row }) => val(row.original, "inv_type") || "-" },
    { accessorKey: "inv_mode", header: "Invoice Mode", size: 110, cell: ({ row }) => val(row.original, "inv_mode") || "-" },
    { accessorKey: "curr_code", header: "Currency", size: 90, cell: ({ row }) => val(row.original, "curr_code") || "-" },
    {
      accessorKey: "ex_rate",
      header: "Exchange Rate",
      size: 110,
      cell: ({ row }) => <span className="block text-right tabular-nums">{val(row.original, "ex_rate") ?? "-"}</span>,
    },
    {
      accessorKey: "inv_amount",
      header: "Invoice Amount",
      size: 130,
      cell: ({ row }) => <span className="block text-right tabular-nums">{val(row.original, "inv_amount")}</span>,
    },
    { accessorKey: "crdr", header: "Cr/Dr", size: 80, cell: ({ row }) => val(row.original, "crdr") || "-" },
    { accessorKey: "inv_status", header: "Status", size: 90 },
    {
      accessorKey: "allocated",
      header: "Allocated",
      size: 100,
      cell: ({ row }) => {
        const value = val(row.original, "allocated");
        return (
          <Badge variant={value === "Y" ? "default" : "secondary"}>
            {value === "Y" ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "allocated_date",
      header: "Allocated Date",
      size: 130,
      cell: ({ row }) => formatDate(val(row.original, "allocated_date")),
    },
    {
      accessorKey: "despatched",
      header: "Despatched",
      size: 100,
      cell: ({ row }) => {
        const value = val(row.original, "despatched");
        return (
          <Badge variant={value === "Y" ? "default" : "secondary"}>
            {value === "Y" ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "desp_date",
      header: "Despatch Date",
      size: 130,
      cell: ({ row }) => formatDate(val(row.original, "desp_date")),
    },
    { accessorKey: "awb_no", header: "AWB No", size: 120, cell: ({ row }) => val(row.original, "awb_no") || "-" },
    { accessorKey: "stmt_actno", header: "Statement A/C No", size: 140, cell: ({ row }) => val(row.original, "stmt_actno") || "-" },
    { accessorKey: "account_ref", header: "Account Ref", size: 130, cell: ({ row }) => val(row.original, "account_ref") || "-" },
    { accessorKey: "party", header: "Party", size: 150, cell: ({ row }) => val(row.original, "party") || "-" },
    { accessorKey: "inv_desc1", header: "Description 1", size: 180, cell: ({ row }) => val(row.original, "inv_desc1") || "-" },
    { accessorKey: "inv_desc2", header: "Description 2", size: 180, cell: ({ row }) => val(row.original, "inv_desc2") || "-" },
    { accessorKey: "prin_ref1", header: "Principal Ref 1", size: 140, cell: ({ row }) => val(row.original, "prin_ref1") || "-" },
    { accessorKey: "prin_ref2", header: "Principal Ref 2", size: 140, cell: ({ row }) => val(row.original, "prin_ref2") || "-" },
    { accessorKey: "credit_note_no", header: "Credit Note No", size: 130, cell: ({ row }) => val(row.original, "credit_note_no") || "-" },
    {
      accessorKey: "credit_note_date",
      header: "Credit Note Date",
      size: 140,
      cell: ({ row }) => formatDate(val(row.original, "credit_note_date")),
    },
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