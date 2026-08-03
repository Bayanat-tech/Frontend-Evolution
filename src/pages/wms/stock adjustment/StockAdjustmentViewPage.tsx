import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Pencil, Plus, Printer, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import {
  executeWmsInboundSql,
  createAdjDetail,
  editAdjDetail,
  deleteAdjDetail,
  processStockAdjustment,
  confirmStockAdjustment,
  getAllStockAdjReports,
  getStockAdjustmentData,
  getAdjConfirmReport,
  downloadAdjConfirmReportExcel,
  getStockAdjusmentReportHtml,
  getStockAdjusmentReportExcelDownload
} from "../../../api/wms";

// ─── Types ────────────────────────────────────────────────────────────────────
type WmsRow = Record<string, unknown>;
type NoticeState = { type: "success" | "error"; message: string } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function val(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "");
}

function formatDateTime(input: string) {
  if (!input || input === "N/A") return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function toIsoDate(input: unknown): string | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(String(input));
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeRow(row: WmsRow): WmsRow {
  const out: WmsRow = { ...row };
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { label: "Create", value: "create" },
  { label: "Process", value: "process" },
  { label: "Confirm", value: "confirm" },
];

// ─── Adj Type badge ───────────────────────────────────────────────────────────
function AdjTypeBadge({ type }: { type: string }) {
  const isAdd = type === "+" || type?.toUpperCase() === "AD+";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${
        isAdd
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-red-300 bg-red-50 text-red-700"
      }`}
    >
      {isAdd ? "AD+" : "AD−"}
    </span>
  );
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

function ReadOnlyInput({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <Input readOnly className="bg-muted/40" value={value || ""} />
    </Field>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-md border border-border bg-card p-3">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

type TReport = {
  id:           number;
  reportTitle:  string;
  apiFn:        (prin_code: string, adj_no: string) => Promise<string>;
  excelFn?:     (prin_code: string, adj_no: string) => Promise<void>;
};

const REPORTS: TReport[] = [
  {
    id:          1,
    reportTitle: "Adjustment Confirm Report",
    apiFn:       getAdjConfirmReport,
    excelFn:     downloadAdjConfirmReportExcel,
  },

  {

     id:          2,
    reportTitle: "Stock Adjustment Report",
    apiFn:       getStockAdjusmentReportHtml,
    excelFn:     getStockAdjusmentReportExcelDownload,
  }
];

// ─── Main component ───────────────────────────────────────────────────────────
export function StockAdjViewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse adj_no from path: /stock_adj/view/4?principal_code=00009
  const pathSegments = location.pathname.split("/");
  const viewIndex = pathSegments.findIndex((s) => s.toLowerCase() === "view");
  const adj_no = viewIndex !== -1 ? pathSegments[viewIndex + 1] : "";

  const searchParams = new URLSearchParams(location.search);
  const prin_code = searchParams.get("principal_code") || "";
  const company_code = user?.company_code || "";

  const [selectedTab, setSelectedTab] = useState("create");
  const [allDetails, setAllDetails] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [selectedRows, setSelectedRows] = useState<WmsRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<WmsRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WmsRow | null>(null);
  // const [printOpen, setPrintOpen] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

    // ── Report dialog state ───────────────────────────────────────────────────
    const [listOpen,       setListOpen]       = useState(false);
    const [reportOpen,     setReportOpen]     = useState(false);
    const [selectedReport, setSelectedReport] = useState<TReport | null>(null);
    const [reportHtml,     setReportHtml]     = useState<string>("");
    const [reportLoading,  setReportLoading]  = useState(false);
    const [reportError,    setReportError]    = useState<string>("");
    const [excelLoading,   setExcelLoading]   = useState(false);
  
    const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Load detail data ──
  const loadData = async (clearNotice = true) => {
    if (!adj_no || !prin_code) return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    setSelectedRows([]);
    try {
      const data = await getStockAdjustmentData();
      const arr = Array.isArray(data.details) ? data.details : [];
      const scoped = arr
        .filter(
          (row) =>
            String(val(row, "adj_no")) === String(adj_no) &&
            val(row, "prin_code") === prin_code
        )
        .map((row, index) => ({
          ...normalizeRow(row),
          _id: `${val(row, "adj_no")}-${val(row, "adj_serialno") || index}`,
        }));
      setAllDetails(scoped);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load adjustment details.",
      });
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!selectedReport) return;
    if (!prin_code) {
      setReportError("Principal code is not available for this adjustment.");
      return;
    }

    setReportHtml("");
    setReportError("");
    setReportLoading(true);

    selectedReport
      .apiFn(prin_code, adj_no)
      .then((html) => setReportHtml(html))
      .catch((err) => {
        console.error("Report API error:", err);
        setReportError("Failed to load report. Please try again.");
      })
      .finally(() => setReportLoading(false));
  }, [selectedReport]);


  useEffect(() => { void loadData(); }, [adj_no, prin_code]);
  useEffect(() => { setSelectedRows([]); }, [selectedTab]);

  // ── Client-side tab filtering ──
  // Create tab  → all rows (edit/delete only if selected !== 'Y')
  // Process tab → rows where selected !== 'Y'
  // Confirm tab → rows where selected === 'Y' and confirmed !== 'Y'
  const createRows = allDetails;

  const processRows = useMemo(
    () => allDetails.filter((r) => val(r, "selected") !== "Y"),
    [allDetails]
  );

  const confirmRows = useMemo(
    () => allDetails.filter((r) => val(r, "selected") === "Y" && val(r, "confirmed") !== "Y"),
    [allDetails]
  );

  const displayData =
    selectedTab === "create"
      ? createRows
      : selectedTab === "process"
      ? processRows
      : confirmRows;

  const isAnyConfirmed = useMemo(
    () => allDetails.some((r) => val(r, "confirmed") === "Y"),
    [allDetails]
  );

  // ── Process ──
  const handleProcess = async () => {
    if (!selectedRows.length) return;
    setProcessing(true);
    try {
      await processStockAdjustment({
        COMPANY_CODE: company_code,
        PRIN_CODE: prin_code,
        ADJ_NO: Number(adj_no),
        USERID: user?.username || "",
        P_ADJ_SERIALNO: selectedRows
          .map((r) => val(r, "adj_serialno"))
          .filter(Boolean)
          .join(","),
      });
      setNotice({ type: "success", message: "Stock adjustment processed successfully." });
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to process." });
    } finally {
      setProcessing(false);
    }
  };

  // ── Confirm ──
  const handleConfirm = async () => {
    if (!selectedRows.length) return;
    setConfirming(true);
    try {
      await confirmStockAdjustment({
        P_COMPANY_CODE: company_code,
        P_PRIN_CODE: prin_code,
        P_ADJ_NO: adj_no,
        P_ADJ_SERIALNO: selectedRows
          .map((r) => val(r, "adj_serialno"))
          .filter(Boolean)
          .join(","),
      });
      setNotice({ type: "success", message: "Stock adjustment confirmed successfully." });
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to confirm." });
    } finally {
      setConfirming(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdjDetail({
        ADJ_NO: Number(adj_no),
        ADJ_SERIALNO: Number(val(deleteTarget, "adj_serialno")) || undefined,
        JOB_NO: val(deleteTarget, "job_no"),
        COMPANY_CODE: company_code,
      });
      setNotice({ type: "success", message: "Adjustment detail deleted." });
      setDeleteTarget(null);
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete." });
    } finally {
      setDeleting(false);
    }
  };

  // ── Print ──
    // ── Toolbar handlers ──────────────────────────────────────────────────────
  const handlePrint = () => {
    iframeRef.current?.contentWindow?.postMessage("print", "*");
  };

  const handleExcel = async () => {
    if (!selectedReport?.excelFn || !prin_code) return;
    setExcelLoading(true);
    try {
      await selectedReport.excelFn(prin_code, adj_no);
    } catch (err) {
      console.error("Excel export error:", err);
    } finally {
      setExcelLoading(false);
    }
  };

  // ── Dialog helpers ────────────────────────────────────────────────────────
  const openListDialog = () => setListOpen(true);

  const selectReport = (rp: TReport) => {
    setListOpen(false);
    setSelectedReport(rp);
    setReportOpen(true);
  };

  const closeReportDialog = () => {
    setReportOpen(false);
    setSelectedReport(null);
    setReportHtml("");
    setReportError("");
  };

  const reportReady   = !reportLoading && !reportError && !!reportHtml;
  const hasExcelExport = !!selectedReport?.excelFn;


  // ── Checkbox column (shared between process & confirm tabs) ──
  const selectColumn = (tab: string): ColumnDef<WmsRow> => ({
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={
          displayData.length > 0 && selectedRows.length === displayData.length
        }
        onChange={(e) => {
          setSelectedRows(e.target.checked ? [...displayData] : []);
        }}
      />
    ),
    size: 52,
    enableColumnFilter: false,
    cell: ({ row }) => {
      const checked = selectedRows.some((r) => r._id === row.original._id);
      return (
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={checked}
          onChange={(e) => {
            if (e.target.checked) setSelectedRows((prev) => [...prev, row.original]);
            else setSelectedRows((prev) => prev.filter((r) => r._id !== row.original._id));
          }}
        />
      );
    },
  });

  // ── Base column defs ──
  const baseColumns: ColumnDef<WmsRow>[] = [
    { id: "row_no", header: "No", size: 52, cell: ({ row }) => row.index + 1 },
    { accessorKey: "adj_no", header: "Adj No", size: 80, cell: ({ row }) => val(row.original, "adj_no") },
    { accessorKey: "prod_code", header: "Product", size: 150, cell: ({ row }) => val(row.original, "prod_code") },
    {
      accessorKey: "adj_type",
      header: "Adj Type",
      size: 100,
      cell: ({ row }) => <AdjTypeBadge type={val(row.original, "adj_type")} />,
    },
    { accessorKey: "key_number", header: "Key No", size: 130, cell: ({ row }) => val(row.original, "key_number") },
    { accessorKey: "quantity", header: "Qty (Total)", size: 105, cell: ({ row }) => val(row.original, "quantity") },
    { accessorKey: "qty_puom", header: "Qty PUOM", size: 100, cell: ({ row }) => val(row.original, "qty_puom") },
    { accessorKey: "qty_luom", header: "Qty LUOM", size: 100, cell: ({ row }) => val(row.original, "qty_luom") },
    { accessorKey: "p_uom", header: "P UOM", size: 80, cell: ({ row }) => val(row.original, "p_uom") },
    { accessorKey: "l_uom", header: "L UOM", size: 80, cell: ({ row }) => val(row.original, "l_uom") },
    { accessorKey: "location_code", header: "Location", size: 120, cell: ({ row }) => val(row.original, "location_code") },
    { accessorKey: "job_no", header: "Job No", size: 120, cell: ({ row }) => val(row.original, "job_no") },
    { accessorKey: "batch_no", header: "Batch No", size: 110, cell: ({ row }) => val(row.original, "batch_no") },
    { accessorKey: "mfg_date", header: "Mfg Date", size: 130, cell: ({ row }) => formatDateTime(val(row.original, "mfg_date")) },
    { accessorKey: "exp_date", header: "Exp Date", size: 130, cell: ({ row }) => formatDateTime(val(row.original, "exp_date")) },
    { accessorKey: "user_id", header: "User", size: 100, cell: ({ row }) => val(row.original, "user_id") },
    { accessorKey: "user_dt", header: "User Date", size: 130, cell: ({ row }) => formatDateTime(val(row.original, "user_dt")) },
  ];

  const createColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => {
          // Cannot edit/delete a row that has already been processed (selected=Y)
          if (val(row.original, "selected") === "Y") return null;
          return (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                title="Edit"
                onClick={() => { setEditingRow(row.original); setEditOpen(true); }}
              >
                <Pencil size={14} />
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
          );
        },
      },
    ],
    [allDetails]
  );

  const processColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [selectColumn("process"), ...baseColumns],
    [selectedRows, processRows]
  );

  const confirmColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      selectColumn("confirm"),
      ...baseColumns,
      {
        accessorKey: "app_keynumber",
        header: "Applied Key No",
        size: 140,
        cell: ({ row }) => val(row.original, "app_keynumber"),
      },
    ],
    [selectedRows, confirmRows]
  );

  const activeColumns =
    selectedTab === "create"
      ? createColumns
      : selectedTab === "process"
      ? processColumns
      : confirmColumns;

  return (
    <section className="grid gap-4">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            onClick={() => navigate("/workspace/wms/wms/activity/request/stock_adj")}
            title="Back"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Stock Adjustment
            </p>
            <h1 className="m-0 truncate text-2xl font-bold text-foreground">{adj_no}</h1>
          </div>
          <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Principal
            </span>
            <span className="ml-1.5 text-sm font-bold text-foreground">{prin_code || "—"}</span>
          </div>
          {isAnyConfirmed && (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Confirmed
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw size={14} /> Refresh
          </Button>

          {selectedTab === "create" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isAnyConfirmed}
              title={isAnyConfirmed ? "Cannot add — a confirmed adjustment already exists" : ""}
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} /> Create Detail
            </Button>
          )}

          {selectedTab === "process" && (
            <Button
              size="sm"
              disabled={!selectedRows.length || processing}
              onClick={handleProcess}
            >
              <CheckCircle2 size={14} />
              {processing ? "Processing..." : `Process Selected (${selectedRows.length})`}
            </Button>
          )}

          {selectedTab === "confirm" && (
            <>
              <Button
                size="sm"
                disabled={!selectedRows.length || confirming}
                onClick={handleConfirm}
              >
                <CheckCircle2 size={14} />
                {confirming ? "Confirming..." : `Confirm Adjustment (${selectedRows.length})`}
              </Button>
              <Button size="sm" variant="outline" onClick={openListDialog}>
                <Printer size={14} /> Print
              </Button>
            </>
          )}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Tab strip ── */}
      <div className="flex gap-2 rounded-md border bg-card p-2">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={selectedTab === tab.value ? "default" : "outline"}
            onClick={() => setSelectedTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ── Data table ── */}
      <DataTable
        columns={activeColumns}
        data={displayData}
        subtitle={`${TABS.find((t) => t.value === selectedTab)?.label} — Adjustment Details`}
        searchPlaceholder="Search product, location, key no..."
        loading={loading}
        height="calc(100vh - 320px)"
        minWidth={1500}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => String((row as WmsRow)._id || index)}
        rowClassName={(row) =>
          val(row as WmsRow, "confirmed") === "Y"
            ? "bg-emerald-50/70"
            : val(row as WmsRow, "selected") === "Y"
            ? "bg-amber-50/60"
            : "bg-blue-50/40"
        }
      />

      {/* ── Create Detail dialog ── */}
      <CreateDetailDialog
        open={createOpen}
        adj_no={adj_no}
        company_code={company_code}
        prin_code={prin_code}
        username={user?.username || ""}
        nextSerialNo={allDetails.length + 1}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          void loadData(false);
          setNotice({ type: "success", message: "Adjustment detail created." });
        }}
        onError={(msg) => setNotice({ type: "error", message: msg })}
      />

      {/* ── Edit Detail dialog ── */}
      {editingRow && (
        <EditDetailDialog
          open={editOpen}
          row={editingRow}
          adj_no={adj_no}
          onClose={() => { setEditOpen(false); setEditingRow(null); }}
          onSuccess={() => {
            setEditOpen(false);
            setEditingRow(null);
            void loadData(false);
            setNotice({ type: "success", message: "Adjustment detail updated." });
          }}
          onError={(msg) => setNotice({ type: "error", message: msg })}
        />
      )}

      {/* ── Delete confirm dialog ── */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Adjustment Detail"
        description="This will permanently remove this adjustment detail."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              <X size={14} /> Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          Product:{" "}
          <strong className="text-foreground">
            {deleteTarget ? val(deleteTarget, "prod_code") : ""}
          </strong>
          {" · "}Serial:{" "}
          <strong className="text-foreground">
            {deleteTarget ? val(deleteTarget, "adj_serialno") : ""}
          </strong>
        </div>
      </Dialog>

{/* ── Dialog 1: Report list ── */}
      <Dialog
        open={listOpen}
        title="Select Report"
        compact
        onClose={() => setListOpen(false)}
      >
        <div className="flex flex-col gap-1 p-2">
          {REPORTS.map((rp) => (
            <button
              key={rp.id}
              onClick={() => selectReport(rp)}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-left text-sm font-medium hover:bg-muted transition-colors"
            >
              <Printer size={14} className="text-muted-foreground shrink-0" />
              {rp.reportTitle}
            </button>
          ))}
        </div>
      </Dialog>

      {/* ── Dialog 2: Report viewer ── */}
      <Dialog
        open={reportOpen}
        title={selectedReport?.reportTitle ?? "Report"}
        wide
        onClose={closeReportDialog}
      >
        <div className="flex flex-col" style={{ height: "75vh" }}>
          {reportReady && (
            <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer size={13} /> Print / Save as PDF
              </Button>

              {hasExcelExport && (
                <Button size="sm" variant="outline" onClick={handleExcel} disabled={excelLoading}>
                  {excelLoading
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <FileSpreadsheet size={13} />}
                  {excelLoading ? "Exporting…" : "Export Excel"}
                </Button>
              )}
            </div>
          )}

          {reportLoading && (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" />
              Loading report…
            </div>
          )}

          {!reportLoading && reportError && (
            <div className="flex flex-1 items-center justify-center text-sm text-red-600">
              {reportError}
            </div>
          )}

          {reportReady && (
            <iframe
              ref={iframeRef}
              srcDoc={reportHtml}
              title={selectedReport?.reportTitle}
              className="flex-1 w-full rounded border-0"
              style={{ minHeight: 0 }}
            />
          )}
        </div>
      </Dialog>
    </section>
  );
}

// ─── Create Detail Dialog ─────────────────────────────────────────────────────
function CreateDetailDialog({
  open,
  adj_no,
  company_code,
  prin_code,
  username,
  nextSerialNo,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  adj_no: string;
  company_code: string;
  prin_code: string;
  username: string;
  nextSerialNo: number;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WmsRow | null>(null);
  const [adjType, setAdjType] = useState<"+" | "-">("+");
  const [qtyPUOM, setQtyPUOM] = useState("");
  const [qtyLUOM, setQtyLUOM] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedProduct(null);
      setAdjType("+");
      setQtyPUOM("");
      setQtyLUOM("");
    }
  }, [open]);

  // UOM condition: if P_UOM === L_UOM (or UOM_COUNT = 1) → L UOM qty is disabled
  const pUom = selectedProduct ? val(selectedProduct, "P_UOM") : "";
  const lUom = selectedProduct ? val(selectedProduct, "L_UOM") : "";
  const isSameUOM = !selectedProduct || pUom.toUpperCase() === lUom.toUpperCase();

  // UOM_COUNT = how many loose units per primary unit
  const uomCount = Number(selectedProduct ? val(selectedProduct, "UOM_COUNT") : 1) || 1;

  const totalQty = isSameUOM
    ? Number(qtyPUOM) || 0
    : uomCount * (Number(qtyPUOM) || 0) + (Number(qtyLUOM) || 0);

  const qtyAvl = Number(selectedProduct ? val(selectedProduct, "QTY_AVL") : 0);

  // Exceed check only when subtracting
  const isQtyExceeded = adjType === "-" && totalQty > qtyAvl;

  const canSubmit = !!selectedProduct && totalQty > 0 && !isQtyExceeded && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedProduct) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ADJ_NO: Number(adj_no),
        ADJ_SERIALNO: nextSerialNo,
        PRIN_CODE: val(selectedProduct, "PRIN_CODE") || prin_code,
        PROD_CODE: val(selectedProduct, "PROD_CODE"),
        SITE_CODE: val(selectedProduct, "SITE_CODE"),
        LOCATION_CODE: val(selectedProduct, "LOCATION_CODE"),
        P_UOM: pUom,
        L_UOM: lUom,
        JOB_NO: val(selectedProduct, "JOB_NO"),
        QTY_PUOM: Number(qtyPUOM) || 0,
        QTY_LUOM: isSameUOM ? 0 : Number(qtyLUOM) || 0,
        QUANTITY: totalQty,
        ADJ_TYPE: adjType,
        PALLET_ID: val(selectedProduct, "PALLET_ID"),
      };

      if (adjType === "-") {
        payload.KEY_NUMBER = val(selectedProduct, "KEY_NUMBER");
      } else {
        payload.MFG_DATE = toIsoDate(val(selectedProduct, "MFG_DATE"));
        payload.EXP_DATE = toIsoDate(val(selectedProduct, "EXP_DATE"));
        payload.BATCH_NO = val(selectedProduct, "BATCH_NO") || null;
        payload.LOT_NO = val(selectedProduct, "LOT_NO") || null;
      }

      await createAdjDetail(payload as any);
      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to create adjustment detail.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="grid max-h-[92vh] w-[min(96vw,720px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Stock Adjustment
              </p>
              <h2 className="m-0 text-lg font-bold text-foreground">Create Adjustment Detail</h2>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            type="button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 text-sm">
          <div className="grid gap-4">

            {/* Product section */}
            <Section title="Product">
              <div className="grid gap-2.5 md:grid-cols-[1fr_2fr]">
                <LookupField
                  label="Product Code"
                  required
                  value={selectedProduct ? val(selectedProduct, "PROD_CODE") : ""}
                  displayValue={
                    selectedProduct
                      ? `${val(selectedProduct, "PROD_CODE")} — ${val(selectedProduct, "PROD_NAME")}`
                      : ""
                  }
                  valueField="PROD_CODE"
                  displayFields={["PROD_CODE", "PROD_NAME"]}
                  columns={[
                    { field: "PROD_CODE", header: "Product Code" },
                    { field: "PROD_NAME", header: "Product Name" },
                    { field: "SITE_CODE", header: "Site" },
                    { field: "LOCATION_CODE", header: "Location" },
                    { field: "QTY_AVL", header: "Qty Avl" },
                    { field: "P_UOM", header: "P UOM" },
                    { field: "BATCH_NO", header: "Batch No" },
                  ]}
                  placeholder="Search product..."
                  loadOptions={async () => {
                    const rows = await executeWmsInboundSql(
                      `SELECT 
                        PROD_CODE, BATCH_NO, UPPP, PRIN_CODE, PROD_NAME, SITE_CODE, LOCATION_CODE,
                        P_UOM, QTY_STOCK, QTY_AVL, L_UOM, JOB_NO, TXN_DATE, LOT_NO, MANU_CODE,
                        DOC_REF, KEY_NUMBER, UOM_COUNT, PALLET_ID, MFG_DATE, EXP_DATE
                      FROM VW_STKLED
                      WHERE PRIN_CODE = '${prin_code}'`
                    );
                    return rows.map((r) => normalizeRow(r as WmsRow));
                  }}
                  onChange={(_v, row) => {
                    if (!row) return;
                    setSelectedProduct(row as WmsRow);
                    setQtyPUOM("");
                    setQtyLUOM("");
                  }}
                />
                <ReadOnlyInput
                  label="Product Name"
                  value={selectedProduct ? val(selectedProduct, "PROD_NAME") : ""}
                />
              </div>

              {selectedProduct && (
                <>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <ReadOnlyInput label="Site Code" value={val(selectedProduct, "SITE_CODE")} />
                    <ReadOnlyInput label="Location Code" value={val(selectedProduct, "LOCATION_CODE")} />
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <ReadOnlyInput label="Mfg Date" value={val(selectedProduct, "MFG_DATE") ? new Date(val(selectedProduct, "MFG_DATE")).toLocaleDateString("en-GB") : "—"} />
                    <ReadOnlyInput label="Exp Date" value={val(selectedProduct, "EXP_DATE") ? new Date(val(selectedProduct, "EXP_DATE")).toLocaleDateString("en-GB") : "—"} />
                  </div>
                  <div className="mt-2.5 grid grid-cols-4 gap-2.5">
                    <ReadOnlyInput label="Batch No" value={val(selectedProduct, "BATCH_NO")} />
                    <ReadOnlyInput label="Lot No" value={val(selectedProduct, "LOT_NO")} />
                    <ReadOnlyInput label="Available Qty" value={val(selectedProduct, "QTY_AVL")} />
                    <ReadOnlyInput label="Primary UOM" value={pUom} />
                  </div>
                </>
              )}
            </Section>

            {/* Qty & Adj Type section — only when product is selected */}
            {selectedProduct && (
              <Section title="Quantity & Adjustment Type">
                <div className={`grid gap-2.5 ${isSameUOM ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  <Field
                    label={`P UOM Qty (${pUom})`}
                    required
                  >
                    <Input
                      type="number"
                      min={0}
                      value={qtyPUOM}
                      onChange={(e) => setQtyPUOM(e.target.value)}
                      placeholder="Enter in CSE"
                    />
                  </Field>

                  {/* L UOM qty — disabled when same UOM */}
                  {!isSameUOM && (
                    <Field label={`L UOM Qty (${lUom})`}>
                      <Input
                        type="number"
                        min={0}
                        value={qtyLUOM}
                        onChange={(e) => setQtyLUOM(e.target.value)}
                        placeholder="Enter loose PCS"
                      />
                    </Field>
                  )}

                  <Field label="Adjustment Type" required>
                    <select
                      className="ui-input h-9 w-full rounded-md"
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as "+" | "-")}
                    >
                      <option value="+">+ (Add)</option>
                      <option value="-">- (Subtract)</option>
                    </select>
                  </Field>
                </div>

                {/* Availability line */}
                <p className="mt-2 text-xs text-muted-foreground">
                  Available:{" "}
                  <strong className="text-foreground">
                    {qtyAvl} {lUom || pUom}
                  </strong>
                  {!isSameUOM && totalQty > 0 && (
                    <>
                      {" · "}Total:{" "}
                      <strong className="text-foreground">
                        {totalQty} {lUom}
                      </strong>
                      {" "}
                      <span className="text-muted-foreground">
                        ({Number(qtyPUOM) || 0} {pUom} × {uomCount} + {Number(qtyLUOM) || 0} {lUom})
                      </span>
                    </>
                  )}
                </p>

                {isQtyExceeded && (
                  <p className="mt-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    ⚠ Total {totalQty} {lUom || pUom} exceeds available stock of {qtyAvl}
                  </p>
                )}

                {/* Summary bar */}
                <div
                  className={`mt-2.5 flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                    adjType === "+"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-red-300 bg-red-50"
                  }`}
                >
                  <span>
                    <strong className="text-primary">Summary</strong>{" "}
                    PUOM = <strong>{Number(qtyPUOM) || 0}</strong> {pUom}
                    {!isSameUOM && (
                      <>
                        {" · "}LUOM = <strong>{Number(qtyLUOM) || 0}</strong> {lUom}
                      </>
                    )}
                    {" · "}Total = <strong>{totalQty}</strong> {lUom || pUom}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      adjType === "+" ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {adjType === "+" ? "▲ Adding Stock" : "▼ Removing Stock"}
                    {" "}
                    <span className="text-xs font-normal opacity-70">(Avl: {qtyAvl} {lUom || pUom})</span>
                  </span>
                </div>
              </Section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={15} /> Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            <Save size={15} /> {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Detail Dialog ───────────────────────────────────────────────────────
function EditDetailDialog({
  open,
  row,
  adj_no,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  row: WmsRow;
  adj_no: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [adjType, setAdjType] = useState<"+" | "-">(val(row, "adj_type") === "-" ? "-" : "+");
  const [qtyPUOM, setQtyPUOM] = useState(String(row.qty_puom ?? row.QTY_PUOM ?? "0"));
  const [qtyLUOM, setQtyLUOM] = useState(String(row.qty_luom ?? row.QTY_LUOM ?? "0"));

  const pUom = val(row, "p_uom");
  const lUom = val(row, "l_uom");
  const isSameUOM = pUom.toUpperCase() === lUom.toUpperCase();

  // Fix: proper parentheses for precedence
  const totalQty = isSameUOM
    ? Number(qtyPUOM) || 0
    : (Number(qtyPUOM) || 0) + (Number(qtyLUOM) || 0);

  const canSubmit = (Number(qtyPUOM) || 0) > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await editAdjDetail({
        ADJ_NO: Number(adj_no),
        ADJ_SERIALNO: Number(val(row, "adj_serialno")),
        PRIN_CODE: val(row, "prin_code"),
        PROD_CODE: val(row, "prod_code"),
        SITE_CODE: val(row, "site_code"),
        LOCATION_CODE: val(row, "location_code"),
        P_UOM: pUom,
        L_UOM: lUom,
        KEY_NUMBER: val(row, "key_number"),
        QTY_PUOM: Number(qtyPUOM) || 0,
        QTY_LUOM: isSameUOM ? 0 : Number(qtyLUOM) || 0,
        QUANTITY: totalQty,
        ADJ_TYPE: adjType,
        PALLET_ID: val(row, "pallet_id"),
      });
      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to update adjustment detail.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="grid max-h-[92vh] w-[min(96vw,620px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Stock Adjustment
              </p>
              <h2 className="m-0 text-lg font-bold text-foreground">
                Edit Detail — {val(row, "prod_code")}
              </h2>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            type="button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 text-sm">
          <div className="grid gap-4">
            <Section title="Product">
              <div className="grid gap-2.5 md:grid-cols-3">
                <ReadOnlyInput label="Product Code" value={val(row, "prod_code")} />
                <ReadOnlyInput label="P UOM" value={pUom} />
                <ReadOnlyInput label="L UOM" value={lUom} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <ReadOnlyInput label="Site Code" value={val(row, "site_code")} />
                <ReadOnlyInput label="Location Code" value={val(row, "location_code")} />
              </div>
            </Section>

            <Section title="Quantity & Adjustment Type">
              <div className="grid gap-2.5 md:grid-cols-3">
                <Field label={`P UOM Qty (${pUom || "PUOM"})`} required>
                  <Input
                    type="number"
                    min={0}
                    value={qtyPUOM}
                    onChange={(e) => setQtyPUOM(e.target.value)}
                  />
                </Field>
                <Field label={`L UOM Qty (${lUom || "LUOM"})`}>
                  <Input
                    type="number"
                    min={0}
                    value={isSameUOM ? "0" : qtyLUOM}
                    disabled={isSameUOM}
                    onChange={(e) => { if (!isSameUOM) setQtyLUOM(e.target.value); }}
                  />
                </Field>
                <Field label="Adjustment Type" required>
                  <select
                    className="ui-input h-9 w-full rounded-md"
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as "+" | "-")}
                  >
                    <option value="+">+ (Add)</option>
                    <option value="-">- (Subtract)</option>
                  </select>
                </Field>
              </div>
              {isSameUOM && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  L UOM qty is disabled — P UOM and L UOM are the same ({pUom}).
                </p>
              )}
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={15} /> Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StockAdjViewPage;