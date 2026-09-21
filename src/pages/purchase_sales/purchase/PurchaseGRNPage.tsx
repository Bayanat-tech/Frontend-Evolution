import { Download, Edit2, Eye, Loader2, Plus, Printer, RefreshCw } from "lucide-react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Division, getDivisions, getGrnPrintReportPreviewUrl, exportGrnPrintReportExcel } from "../../../api/transactions";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";


import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { TabStrip } from "../../vendor/components";
import { PurchaseOrderEditorState } from "./Purchaseordereditor";
import { GRN_CONFIG, PO_DOC_TYPE } from "./Purchaseordertypes";
import { PurchaseGRNEditor } from "./PurchaseGRNeditor";
import { NewReportDialog } from "../../../components/new_report_format";

// TODO: replace with the real purchase-order row shape once the backend contract is confirmed.
export interface PurchaseOrderRow {
  doc_type: string;
  doc_no: string;
  doc_date: string;
  quotn_no?: string;
  quotn_date?: string;
  div_code: string;
  div_name?: string;
  ac_code: string;
  ac_name?: string;
  address?: string;
  credit_period?: number;
  dept_code?: string;
  tel?: string;
  fax?: string;
  buyer?: string;
  wo_number?: string;
  curr_code?: string;
  curr_name?: string;
  ex_rate?: number;
  pay_terms?: string;
  delivery_term?: string;
  delivery_contact?: string;
  delivery_tel?: string;
  delivery_email?: string;
  remarks?: string;
  disc_amt?: number;
  disc_pct?: number;
  tax_category?: string;
  tax_code?: string;
  expense_ac_post?: string;
  print_on_letterhead?: string;
  project_name?: string;
  pr_no?: string;
  scope_of_work?: string;
  status?: string;
  canceled?: string;
  flow_level_running?: number;
  flow_level?: number;
  sentback_reason?: string;
  reject_reason?: string;
  last_action?: "SENTBACK" | "REJECTED" | "APPROVED" | "CANCELED" | "PENDING" | string;
}

/**
 * getGrnPrintReportPreviewUrl returns a blob: URL. NewReportDialog needs the
 * raw HTML string, so read the blob back as text and release the URL at once.
 */
async function fetchHtmlFromPreviewUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    return await res.text();
  } finally {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

type RequestTab = "PENDING" | "INPROGRESS" | "CLOSED" | "CANCELED" | "REJECTED" | "SENDBACK";

export function PurchaseGRNPage({ onClose }: { onClose?: () => void } = {}) {
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
  const isViewOnlyTab = tab === "CLOSED" || tab === "CANCELED";
  
  const canViewCanceledTab = approvalLevel <= 1;
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<PurchaseOrderEditorState>(null);
  const [divisionPicker, setDivisionPicker] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // ── Row-level report preview dialog state ────────────────────────────────
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportPreviewDocNo, setReportPreviewDocNo] = useState("");
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
  const [reportPreviewExporting, setReportPreviewExporting] = useState(false);

  // Track which row's excel export is in flight, so only that row's button spins.
  const [exportingRowDocNo, setExportingRowDocNo] = useState<string | null>(null);

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
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load Purchase Grns" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    const response = await getDynamicLookup({
      parameter: "PS_GRN_ENTRY_TAB_List",
      code1: user?.company_code,
      code2: user?.loginid || user?.username || "ADMIN",
      code3: tab,
      code4: PO_DOC_TYPE.GRN
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
          code3: "purchase_order",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query, pageIndex, pageSize, columnFilters]);

  const handleExportRowExcel = async (row: PurchaseOrderRow) => {
    if (!row.doc_no) return;
    setExportingRowDocNo(row.doc_no);
    try {
      await exportGrnPrintReportExcel({
        parameter: "GRN_Print",
        loginid: user?.loginid || user?.username || "ADMIN",
        company_code: user?.company_code,
        doc_type: PO_DOC_TYPE.GRN,
        doc_no: row.doc_no,
      } as any);
    } catch (exportError) {
      setNotice({ type: "error", message: exportError instanceof Error ? exportError.message : "Error while exporting to Excel" });
    } finally {
      setExportingRowDocNo(null);
    }
  };

  // ── Row-level print handler → opens NewReportDialog ───────────────────────
  const handlePrintRow = async (row: PurchaseOrderRow) => {
    if (!row.doc_no) return;

    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewDocNo(row.doc_no);
    setReportPreviewOpen(true);
    setReportPreviewLoading(true);

    try {
      const url = await getGrnPrintReportPreviewUrl({
        parameter: "GRN_Print",
        loginid: user?.loginid || user?.username || "ADMIN",
        company_code: user?.company_code,
        doc_type: PO_DOC_TYPE.GRN,
        doc_no: row.doc_no,
      } as any);
      const html = await fetchHtmlFromPreviewUrl(url);
      setReportHtml(html);
    } catch (printError) {
      setReportPreviewError(printError instanceof Error ? printError.message : "Error while generating report");
    } finally {
      setReportPreviewLoading(false);
    }
  };

  const closeReportPreview = () => {
    setReportPreviewOpen(false);
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewDocNo("");
  };

  const handleReportPreviewExcel = async () => {
    if (!reportPreviewDocNo) return;
    setReportPreviewExporting(true);
    try {
      await exportGrnPrintReportExcel({
        parameter: "GRN_Print",
        loginid: user?.loginid || user?.username || "ADMIN",
        company_code: user?.company_code,
        doc_type: PO_DOC_TYPE.GRN,
        doc_no: reportPreviewDocNo,
      } as any);
    } catch (exportError) {
      setReportPreviewError(exportError instanceof Error ? exportError.message : "Error while exporting to Excel");
    } finally {
      setReportPreviewExporting(false);
    }
  };

  // Open the report HTML in a new browser tab
  const handleOpenReportInNewWindow = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } else {
      window.URL.revokeObjectURL(url);
    }
  };

  // Trigger the browser print dialog (Save as PDF) for the current report
  const handleDownloadReportPdf = () => {
    if (!reportHtml) return;
    const PRINT_IFRAME_ID = "grn-list-print-iframe";
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-modals");
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    const doPrint = () => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        /* ignore */
      }
    };

    if (iframe.contentDocument?.readyState === "complete") {
      setTimeout(doPrint, 300);
    } else {
      iframe.onload = () => setTimeout(doPrint, 300);
      setTimeout(doPrint, 700);
    }
  };

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
          {/* <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original as any })} title="Edit">
            <Edit2 size={15} />
          </Button> */}

          <Button
  size="icon"
  variant="ghost"
  onClick={() => setEditor({ mode: "edit", row: row.original as any })}
  title={isViewOnlyTab ? "View" : "Edit"}
>
  {isViewOnlyTab ? <Eye size={15} /> : <Edit2 size={15} />}
</Button>
          <Button size="icon" variant="ghost" onClick={() => void handlePrintRow(row.original)} title="Print / PDF">
            <Printer size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Excel"
            disabled={exportingRowDocNo === row.original.doc_no}
            onClick={() => void handleExportRowExcel(row.original)}
          >
            {exportingRowDocNo === row.original.doc_no ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </Button>
        </div>
      ),
    },
  ],  [isViewOnlyTab, exportingRowDocNo]);

  const openCreateForDivision = (division: Division) => {
    setDivisionPicker(false);
    setEditor({ mode: "create", divCode: division.div_code, divName: division.div_name });
  };

  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Purchase Grn</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Purchase Grn document</p>
        </div>
        <div className="finance-list-actions">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => void loadRows()}>
            <RefreshCw size={15} />
          </Button>
          {tab === "PENDING" && (
            <Button title="Add Purchase Grn" onClick={() => setDivisionPicker(true)}>
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
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Purchase Grns`}
          subtitle="Purchase Grn List"
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search doc no, division, vendor..."
          loading={loading}
          emptyText="No Purchase Grns found"
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
          <PurchaseGRNEditor
            key={editor?.mode === "edit" ? editor.row.doc_no : editor?.mode || "create"}
            config={GRN_CONFIG}
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

      {/* ── Report preview dialog (NewReportDialog + NewReportDialogProps) ── */}
      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title={`Purchase GRN ${reportPreviewDocNo}`.trim()}
        htmlContent={reportHtml}
        loading={reportPreviewLoading}
        error={reportPreviewError || null}
        meta={{
          companyName: user?.company_code || "",
          user: user?.loginid || user?.username || "ADMIN",
          status: tab,
          generatedAt: new Date().toLocaleString(),
        }}
        onExportExcel={handleReportPreviewExcel}
        exportingExcel={reportPreviewExporting}
        onOpenInNewWindow={handleOpenReportInNewWindow}
        onDownloadPdf={handleDownloadReportPdf}
      />

      <Dialog
        open={divisionPicker}
        title="Select Division"
        description="Choose the division before opening the Purchase Grn form."
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