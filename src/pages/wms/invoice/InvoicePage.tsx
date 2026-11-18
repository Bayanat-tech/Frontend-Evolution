import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { useAuth } from "../../../state/AuthContext";
import { getAllInvoices } from "../../../api/billing";
import InvoiceForm from "./InvoiceForm";
import { useToast } from "../../../components/ui/AlertToast";

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

// Define tabs exactly like Inbound (using allocated status as an example)
const listTabs = [
  { key: "all", label: "All Invoices" },
  { key: "allocated", label: "Allocated" },
  { key: "unallocated", label: "Unallocated" },
];

export function InvoicePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<WmsRow | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const loadRows = async () => {
    if (!user?.company_code) return;
    setLoading(true);
    try {
      const data = await getAllInvoices(user.company_code, user.loginid ?? "");
      const normalized = (data as any[]).map((row) => {
        const n: WmsRow = { ...row };
        Object.entries(row).forEach(([k, v]) => { n[k.toLowerCase()] = v; });
        return n;
      });
      setRows(normalized);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [user?.company_code]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = (row: WmsRow | null, view: boolean) => {
    setEditingRow(row);
    setViewMode(view);
    setFormOpen(true);
  };

  // Filter rows based on active tab
  const filteredRows = useMemo(() => {
    if (activeTab === "all") return rows;
    return rows.filter((row) => {
      const allocated = val(row, "allocated");
      if (activeTab === "allocated") return allocated === "Y";
      if (activeTab === "unallocated") return allocated !== "Y";
      return true;
    });
  }, [rows, activeTab]);

  // Count for tabs
  const getTabCount = (tabKey: string) => {
    if (tabKey === "all") return rows.length;
    return rows.filter((row) => {
      const allocated = val(row, "allocated");
      if (tabKey === "allocated") return allocated === "Y";
      if (tabKey === "unallocated") return allocated !== "Y";
      return false;
    }).length;
  };

  const columns = useMemo<ColumnDef<WmsRow>[]>(() => [
    {
      accessorKey: "invoice_no",
      header: "Invoice No",
      size: 130,
      cell: ({ row }) => (
        <button
          className="font-semibold text-primary hover:underline text-[11.5px] text-left cursor-pointer"
          onClick={() => openForm(row.original, true)}
        >
          {val(row.original, "invoice_no")}
        </button>
      ),
    },
    {
      accessorKey: "invoice_date",
      header: "Invoice Date",
      size: 120,
      cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDate(val(row.original, "invoice_date"))}</span>,
    },
    {
      id: "principal",
      header: "Principal",
      size: 220,
      cell: ({ row }) => {
        const code = val(row.original, "prin_code");
        const name = val(row.original, "prin_name");
        return <span className="text-[11.5px] text-foreground">{[code, name].filter(Boolean).join(" - ") || "-"}</span>;
      },
    },
    {
      id: "division",
      header: "Division",
      size: 180,
      cell: ({ row }) => {
        const code = val(row.original, "div_code");
        const name = val(row.original, "div_name");
        return <span className="text-[11.5px] text-foreground">{[code, name].filter(Boolean).join(" - ") || "-"}</span>;
      },
    },
    {
      accessorKey: "inv_amount",
      header: "Invoice Amount",
      size: 130,
      cell: ({ row }) => <span className="block text-right tabular-nums text-[11.5px] text-foreground">{val(row.original, "inv_amount")}</span>,
    },
    {
      id: "actions",
      header: "ACTIONS",
      size: 125,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            title="View invoice"
            onClick={(event) => {
              event.stopPropagation();
              openForm(row.original, true);
            }}
          >
            <Eye size={13} />
          </button>
          <button
            type="button"
            className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            title="Edit invoice"
            onClick={(event) => {
              event.stopPropagation();
              openForm(row.original, false);
            }}
          >
            <Pencil size={13} />
          </button>
        </div>
      ),
    },
  ], []);

  // Page-style form replaces the listing entirely while adding/editing an invoice
  if (formOpen) {
    return (
      <InvoiceForm
        existingData={editingRow ?? undefined}
        viewMode={viewMode}
        onClose={(shouldRefetch) => {
          setFormOpen(false);
          if (shouldRefetch) {
            void loadRows();
            toast.success("Invoice saved successfully.");
          }
        }}
      />
    );
  }

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Invoice Listing
          </h2>
        </div>
      </div>

      {/* Tabs with counts
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {listTabs.map((tab) => {
          const count = getTabCount(tab.key);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#00378C] text-white shadow-sm font-semibold"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div> */}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredRows}
        toolbar={
          <button
            type="button"
            onClick={() => openForm(null, false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Create Invoice
          </button>
        }
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search invoice no, principal..."
        loading={loading}
        height="calc(100vh - 180px)"
        density="grid"
        enablePagination
        pageSize={50}
        enableExport
        exportFilename="invoices-list.csv"
        getRowId={(row, index) => {
          const inv = val(row, "invoice_no");
          const prin = val(row, "prin_code");
          const co = val(row, "company_code");
          return inv ? `${co}-${prin}-${inv}` : String(index);
        }}
        rowClassName={(row) => {
          // Apply row colors based on status, matching Inbound design pattern
          if (val(row, "allocated") === "Y") return "[&>td]:bg-emerald-50/70"; // Allocated -> Light Green
          return "[&>td]:bg-amber-50/70"; // Unallocated -> Light Yellow
        }}
      />
    </section>
  );
}

export default InvoicePage;