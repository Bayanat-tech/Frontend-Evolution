import { Download, Edit2, Plus, Printer, RefreshCw } from "lucide-react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Division, getDivisions } from "../../../api/transactions";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";

import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { TabStrip } from "../../vendor/components";
import { PurchaseOrderEditor, PurchaseOrderEditorState } from "./Purchaseordereditor";
import { LPO_CONFIG, PIN_CONFIG } from "./Purchaseordertypes";
import { PurchaseInvoiceEditor } from "./PurchaseInvoiceEditor";

// TODO: replace with the real purchase-order row shape once the backend contract is confirmed.
export interface PurchaseOrderRow {
  doc_type: "LPO";
  doc_no: string;
  doc_date: string;
  quotn_no?: string;
  purchase_actype?: any;
  quotn_date?: string;
   ref_no?: string;
  ref_date?: string;
  dept_name?: string;
  uppp?: number;
  div_code: string;
  div_name?: string;
  ac_code: string;
  ac_name?: string;
  party_address?: string;
  address?: string;
  credit_period?: number;
  dept_code?: string;
  party_phone?: string;
  party_fax?: string;
  buyer?: string;
  tel?: string;
  fax?: string;
  pay_terms?: string;
  delivery_term?: string;
  delivery_contact?: string;
  delivery_tel?: string;
  delivery_email?: string;
  party_name?: string;
  wo_no?: string;
  curr_code?: string;
  curr_name?: string;
  ex_rate?: number;
  payment_terms?: string;
  dlvr_term?: string;
  dlvr_contact?: string;
  dlvr_mobile?: string;
  dlvr_email?: string;
  remarks?: string;
  disc_hdr_price?: number;
  disc_hdr_percent?: number;
  tx_cat_code?: string;
  tx_cat_name?: string;
  disc_price?: number;
  disc_pct?: number;
  tax_category?: string;
  tax_code?: string;
  tx_compntcat_code_1?: string;
  tax_code_name?: string;
  expense_ac_post?: string;
  print_on_letterhead?: string;
  project_name?: string;
  pr_no?: string;
  scope_of_work?: string;
  disc_percent?: number;
  status?: string;
  canceled?: string;
  flow_level_running?: number;
  flow_level?: number;
  sentback_reason?: string;
  reject_reason?: string; // added for reject action
  last_action?: "SENTBACK" | "REJECTED" | "APPROVED" | "CANCELED" | "PENDING" | string;
  wo_number?: string;
}

// TODO: swap for a real API call, e.g. cancelPurchaseOrderApi(docNo)
async function cancelPurchaseOrderApi(_docNo: string): Promise<void> {
  return;
}

type RequestTab = "PENDING" | "INPROGRESS" | "CLOSED" | "CANCELED" | "REJECTED" | "SENDBACK";

export function PurchaseInvoicePage({ onClose }: { onClose?: () => void } = {}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RequestTab>("PENDING");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [approvalLevel, setApprovalLevel] = useState<number>(0);
  const isPendingTab = tab === "PENDING";
  const canViewCanceledTab = approvalLevel <= 1;
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<PurchaseOrderEditorState>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderRow | null>(null);
  const [divisionPicker, setDivisionPicker] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const loadLookups = async () => {
    const divisionData = await getDivisions();
    setDivisions(divisionData);
  };

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await fetchPurchaseOrders();
      setRows(response);
      setTotalRows(response.length);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load purchase orders" });
    } finally {
      setLoading(false);
    }
  };

  // TODO: confirm lookup parameter name against your Oracle package (mirrors MS_BUDGET_ACCOUNT_TAB__List).
  const fetchPurchaseOrders = async () => {
    const response = await getDynamicLookup({
      parameter: "PS_INVOICE_ENTRY_TAB_List",
      code1: user?.company_code,
      code2: user?.loginid || user?.username || "ADMIN",
      code3: tab,
    });

    return response as unknown as PurchaseOrderRow[];
  };

  useEffect(() => {
  if (approvalLevel === 0 && !["PENDING", "CLOSED", "CANCELED"].includes(tab)) {
    setTab("PENDING");
  }
}, [approvalLevel, tab]);

  useEffect(() => {
    void loadLookups().catch((error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load lookups" });
      setLoading(false);
    });

    let mounted = true;
    (async () => {
      try {
        const rows = await getDynamicLookup({
          parameter: "PS_POORDER_ENTRY_FUN_CHECK_GLOBAL_APPR_LEVEL",
          code1: user?.company_code,
          code2: user?.loginid || user?.username || "ADMIN",
          code3: "purchase_invoice",
        });
        if (!mounted) return;
        const first = (rows || [])[0] as Record<string, unknown> | undefined;
        const level = first ? Number(first.level ?? first.flow_level ?? first.flow_level_running ?? Object.values(first)[0]) : 0;
        setApprovalLevel(Number.isFinite(level) ? level : 0);
      } catch {
        if (mounted) setApprovalLevel(0);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.company_code, user?.loginid, user?.username]);

  useEffect(() => {
    void loadRows();
  }, [tab, query, pageIndex, pageSize, columnFilters]);

  const columns = useMemo<ColumnDef<PurchaseOrderRow>[]>(() => [
    {
      accessorKey: "doc_no",
      header: "Doc No",
      cell: ({ row }) => <span className="font-semibold">{row.original.doc_no}</span>,
    },
    { accessorKey: "doc_date", header: "Doc Date", cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: "div_code", header: "Div" },
    { accessorKey: "ac_code", header: "A/c Code" },
    { accessorKey: "ac_name", header: "A/c Name" },
    { accessorKey: "curr_code", header: "Currency" },
    {
      accessorKey: "canceled",
      header: "Status",
      cell: ({ getValue }) => String(getValue() || "N") === "Y" ? <Badge variant="outline" className="border-destructive text-destructive">Cancelled</Badge> : <Badge>Active</Badge>,
    },
     {
  id: "reason",
  header: "Reason",
  accessorFn: (row) =>
    row.last_action === "SENTBACK" ? row.sentback_reason : row.reject_reason,
},
        { accessorKey: "last_action", header: "Last Action" },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })} title="Edit">
            <Edit2 size={15} />
          </Button>
          <Button size="icon" variant="ghost" title="Print / PDF">
            <Printer size={15} />
          </Button>
          <Button size="icon" variant="ghost" title="Excel">
            <Download size={15} />
          </Button>
        </div>
      ),
    },
  ], []);

  const openCreateForDivision = (division: Division) => {
    setDivisionPicker(false);
    setEditor({ mode: "create", divCode: division.div_code, divName: division.div_name });
  };

  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Purchase Invoice</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Purchase invoice document</p>
        </div>
        <div className="finance-list-actions">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => void loadRows()}>
            <RefreshCw size={15} />
          </Button>
        { tab === "PENDING" && (
          <Button title="Add Purchase Order" onClick={() => setDivisionPicker(true)}>
            <Plus size={15} /> Add
          </Button>
        )}
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
     <TabStrip
  value={tab}
  onChange={(value) => setTab(value as RequestTab)}
  tabs={
    approvalLevel === 0
      ? [
          { label: "Pending", value: "PENDING", icon: "pending" },
          { label: "Closed", value: "CLOSED", icon: "closed" },
          { label: "Canceled", value: "CANCELED", icon: "canceled" as const },
        ]
      : [
          { label: "Pending", value: "PENDING", icon: "pending" },
          { label: "In Progress", value: "INPROGRESS", icon: "inProgress" },
          { label: "Closed", value: "CLOSED", icon: "closed" },
          ...(canViewCanceledTab ? [{ label: "Canceled", value: "CANCELED", icon: "canceled" as const }] : []),
          { label: "Rejected", value: "REJECTED", icon: "rejected" as const },
        ]
  }
/>

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Purchase Orders`}
          subtitle="Purchase Order List"
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search doc no, division, vendor..."
          loading={loading}
          emptyText="No purchase orders found"
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename="purchase-orders.csv"
          initialSorting={[{ id: "doc_date", desc: true }]}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) => {
            setColumnFilters(filters);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPageIndex(0);
          }}
          getRowId={(row, index) => `${row.doc_no}_${index}`}
        />
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-background">
          <PurchaseInvoiceEditor
            key={editor?.mode === "edit" ? editor.row.doc_no : editor?.mode || "create"}
            config={PIN_CONFIG}
            editor={editor}
            isPendingTab={isPendingTab}
            onClose={() => setEditor(null)}
            onSaved={async (message) => {
              setEditor(null);
              setNotice({ type: "success", message });
              await loadRows(false);
            }}
          />
        </div>
      )}

      <Dialog
        open={divisionPicker}
        title="Select Division"
        description="Choose the division before opening the purchase order form."
        onClose={() => setDivisionPicker(false)}
        footer={<Button variant="outline" onClick={() => setDivisionPicker(false)}>Cancel</Button>}
      >
        <div className="grid max-h-[420px] gap-2 overflow-auto">
          {divisions.map((division) => (
            <button
              key={division.div_code}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => openCreateForDivision(division)}
              type="button"
            >
              <span className="font-medium">{division.div_name}</span>
              <span className="text-muted-foreground">{division.div_code}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </section>
  );
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}