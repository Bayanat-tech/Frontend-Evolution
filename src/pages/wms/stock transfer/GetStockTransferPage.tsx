import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  Download,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import {
  getAllStockTransferDetails,
  createStockTransferDetail,
  editStockTransferDetail,
  deleteStockTransferDetail,
  processStockTransfer,
  confirmStockTransfer,
} from "../../../api/wms";
import { api } from "../../../api/client";
import { ImportStockTransEdi } from "./Importstocktransedi";

// ─── Report viewer (mirrors OutboundJobDetail exactly) ────────────────────────
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Types ────────────────────────────────────────────────────────────────────
type WmsRow = Record<string, unknown>;
type NoticeState = { type: "success" | "error"; message: string } | null;

type TReport = {
  id: string;
  reportTitle: string;
  htmlEndpoint: string;
  excelEndpoint: string;
  fileStem: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function val(row: WmsRow, key: string) {
  return String(
    row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? ""
  );
}

function formatDate(input: string) {
  if (!input || input === "N/A") return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-GB");
}

function formatDateTime(input: string) {
  if (!input || input === "N/A") return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  const date = d.toLocaleDateString("en-GB");
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
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

function normalizeFlag(value: unknown): "Y" | "N" {
  if (value === null || value === undefined) return "N";
  if (typeof value === "boolean") return value ? "Y" : "N";
  if (typeof value === "number") return value === 1 ? "Y" : "N";
  const normalized = String(value).trim().toUpperCase();
  if (
    [
      "Y",
      "YES",
      "TRUE",
      "T",
      "1",
      "P",
      "PROCESSED",
      "POSTED",
      "C",
      "CONFIRMED",
    ].includes(normalized)
  )
    return "Y";
  return "N";
}

function normalizeRow(row: WmsRow): WmsRow {
  const out: WmsRow = { ...row };
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

// ─── Tab strip ────────────────────────────────────────────────────────────────
const TABS = [
  { label: "Create", value: "create" },
  { label: "Process", value: "process" },
  { label: "Confirm", value: "confirmed" },
];

// ─── Report registry (mirrors REPORTS in OutboundJobDetail) ──────────────────
const REPORTS: TReport[] = [
  {
    id: "1",
    reportTitle: "Stock Transfer Report",
    htmlEndpoint: "/api/wms/reports/stocktransfer-report/html",
    excelEndpoint: "/api/wms/reports/stocktransfer-report/excel",
    fileStem: "stock-transfer",
  },
  {
    id: "2",
    reportTitle: "Stock Confirmation Report",
    htmlEndpoint: "/api/wms/reports/stockconfirmation-report/html",
    excelEndpoint: "/api/wms/reports/stockconfirmation-report/excel",
    fileStem: "stock-confirmation",
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({
  flag,
  labels,
}: {
  flag: "Y" | "N";
  labels: [string, string];
}) {
  return flag === "Y" ? (
    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      {labels[0]}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      {labels[1]}
    </span>
  );
}

// ─── Field wrappers ───────────────────────────────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-md border border-border bg-card p-3">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StockTransferViewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathSegments = location.pathname.split("/");
  const viewIndex = pathSegments.findIndex(
    (s) => s.toLowerCase() === "view"
  );
  const stn_no = viewIndex !== -1 ? pathSegments[viewIndex + 1] : "";

  const searchParams = new URLSearchParams(location.search);
  const prin_code = searchParams.get("principal_code") || "";
  const company_code =
    searchParams.get("company_code") || user?.company_code || "";

  const [selectedTab, setSelectedTab] = useState("create");
  const [gridData, setGridData] = useState<WmsRow[]>([]);
  const [batchRows, setBatchRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [selectedRows, setSelectedRows] = useState<WmsRow[]>([]);
  const [selectedBatchKeys, setSelectedBatchKeys] = useState<Set<string>>(
    new Set()
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<WmsRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WmsRow | null>(null);

  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [principalName, setPrincipalName] = useState("");

  // ── Report dialog state (mirrors OutboundJobDetail exactly) ──
  const [listOpen, setListOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TReport | null>(null);
  const [reportHtml, setReportHtml] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string>("");
  const [excelLoading, setExcelLoading] = useState(false);

  // ── Load data ──
  const loadData = async (clearNotice = true) => {
    if (!stn_no || !company_code || !prin_code) return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    setSelectedRows([]);
    setSelectedBatchKeys(new Set());
    try {
      const raw = await getAllStockTransferDetails(
        stn_no,
        company_code,
        prin_code
      );
      const responseData = (raw as any)?.data || raw;
      const detailsArray = (responseData as any)?.details || [];
      const arr = Array.isArray(detailsArray) ? detailsArray : [];
      setGridData(
        arr.map((row: WmsRow, index: number) => {
          const uniqueId =
            row.key_number ??
            row.KEY_NUMBER ??
            row.seq_number ??
            row.SEQ_NUMBER ??
            `transfer-${index}`;
          return {
            ...normalizeRow(row),
            _id: String(uniqueId).trim().replace(/\s+/g, "-"),
            confirmed: normalizeFlag(row.confirmed ?? row.CONFIRMED),
            processed: normalizeFlag(
              row.processed ?? row.PROCESSED ?? row.posted_ind ?? row.POSTED_IND
            ),
          };
        })
      );
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load transfer details.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stn_no, company_code, prin_code]);

  useEffect(() => {
    setSelectedRows([]);
    setSelectedBatchKeys(new Set());
  }, [selectedTab]);

  // ── Fetch Principal Name for Header ──
  useEffect(() => {
    if (!prin_code || !company_code) return;
    let alive = true;
    api.post("/api/wms/inbound/executeRawSql", {
      raw_sql: `SELECT PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${company_code}' AND PRIN_CODE = '${prin_code}'`,
    })
      .then((res) => {
        if (!alive) return;
        const rows = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        const name = rows[0]?.PRIN_NAME ?? rows[0]?.prin_name ?? "";
        setPrincipalName(String(name).trim());
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [prin_code, company_code]);

  // ── Fetch HTML when a report is selected ──
  useEffect(() => {
    if (!selectedReport) return;

    if (!stn_no) {
      setReportError("Transfer no is not available.");
      return;
    }

    setReportHtml("");
    setReportError("");
    setReportLoading(true);

    api
      .get(selectedReport.htmlEndpoint, {
        params: { stn_no, company_code, prin_code },
        responseType: "text",
        headers: { Accept: "text/html" },
      })
      .then((res) => {
        const html = typeof res.data === "string" ? res.data : String(res.data);
        setReportHtml(html);
      })
      .catch((err) => {
        console.error("Report API error:", err);
        setReportError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load report. Please try again."
        );
      })
      .finally(() => setReportLoading(false));
  }, [selectedReport]);

  const isAnyConfirmed = useMemo(
    () => gridData.some((r) => r.confirmed === "Y"),
    [gridData]
  );

  const displayData = useMemo(() => {
    if (selectedTab === "process")
      return gridData.filter((r) => r.processed !== "Y");
    return gridData;
  }, [gridData, selectedTab]);

  const getTabCount = (tabValue: string) => {
    if (tabValue === "create") return gridData.length;
    if (tabValue === "process") return gridData.filter((r) => r.processed !== "Y").length;
    if (tabValue === "confirmed") return gridData.filter((r) => r.confirmed === "Y").length;
    return 0;
  };

  const confirmRows = useMemo(() => {
    const unconfirmed = gridData.filter((r) => r.confirmed !== "Y");
    const usedTfoKeys = new Set<string>();
    return unconfirmed.map((row, idx) => {
      const detailKey = val(row, "key_number");
      const seqNumber = val(row, "seq_number");
      const tfoRow =
        batchRows.find(
          (r) =>
            val(r, "txn_type") === "TFO" &&
            val(r, "applied_keyno") === detailKey &&
            !usedTfoKeys.has(val(r, "key_number"))
        ) ?? null;
      if (tfoRow) usedTfoKeys.add(val(tfoRow, "key_number"));
      const tfiRow = tfoRow
        ? batchRows.find(
            (r) =>
              val(r, "txn_type") === "TFI" &&
              val(r, "applied_keyno") === val(tfoRow, "key_number")
          ) ?? null
        : null;
      const parentKey = seqNumber
        ? `${detailKey}-seq${seqNumber}`
        : `${detailKey}-idx${idx}`;
      return {
        ...row,
        _parentKey: parentKey,
        _isParent: true,
        _children: [
          ...(tfoRow ? [{ ...tfoRow, _isParent: false, _parentKey: parentKey }] : []),
          ...(tfiRow ? [{ ...tfiRow, _isParent: false, _parentKey: parentKey }] : []),
        ],
      };
    });
  }, [gridData, batchRows]);

  // ── Process ──
  const handleProcess = async () => {
    if (!selectedRows.length || !stn_no) return;
    setProcessing(true);
    try {
      await processStockTransfer({
        company_code,
        prin_code,
        stn_no: stn_no,
        user_id: user?.username || "",
      });
      setNotice({ type: "success", message: "Stock transfer processed successfully." });
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to process transfer." });
    } finally {
      setProcessing(false);
    }
  };

  // ── Confirm ──
  const handleConfirm = async () => {
    if (!selectedBatchKeys.size) return;
    setConfirming(true);
    try {
      await confirmStockTransfer({
        company_code,
        principal_code: prin_code,
        stn_no: parseInt(stn_no || "0", 10),
      });
      setNotice({ type: "success", message: "Stock transfer confirmed successfully." });
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to confirm transfer." });
    } finally {
      setConfirming(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStockTransferDetail({
        COMPANY_CODE: val(deleteTarget, "company_code") || company_code,
        STN_NO: stn_no ?? "",
        KEY_NUMBER: String(deleteTarget._id ?? ""),
      });
      setNotice({ type: "success", message: "Transfer detail deleted." });
      setDeleteTarget(null);
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete." });
    } finally {
      setDeleting(false);
    }
  };

  // ── Export current tab's data as CSV ──
  const handleExportCurrentTab = () => {
    const rowsToExport =
      selectedTab === "confirmed" ? flatConfirmRows : displayData;

    if (!rowsToExport.length) {
      setNotice({ type: "error", message: "No data to export." });
      return;
    }

    const headers = Array.from(
      rowsToExport.reduce<Set<string>>((set, row) => {
        Object.keys(row).forEach((k) => {
          if (!k.startsWith("_")) set.add(k);
        });
        return set;
      }, new Set<string>())
    );

    const escapeCell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [
      headers.join(","),
      ...rowsToExport.map((row) =>
        headers.map((h) => escapeCell((row as WmsRow)[h])).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-transfer-${selectedTab}-${stn_no}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // ── Excel export ──
  const handleExcel = async () => {
    if (!selectedReport) return;
    setExcelLoading(true);
    try {
      const res = await api.get(selectedReport.excelEndpoint, {
        params: { stn_no, company_code, prin_code },
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedReport.fileStem}-${stn_no}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel export error:", err);
    } finally {
      setExcelLoading(false);
    }
  };

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

  const handleDownloadReportPdf = () => {
    if (!reportHtml) return;
    const PRINT_IFRAME_ID = "stock-transfer-report-print-iframe";
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-modals");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
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
      } catch { /* ignore */ }
    };

    if (iframe.contentDocument?.readyState === "complete") {
      setTimeout(doPrint, 300);
    } else {
      iframe.onload = () => setTimeout(doPrint, 300);
      setTimeout(doPrint, 700);
    }
  };

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

  // ── Columns (trimmed, no size props so they auto-fill) ──
  const createColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      { id: "row_no", header: "No.", cell: ({ row }) => row.index + 1 },
      // { accessorKey: "stn_no", header: "Transfer No", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "stn_no")}</span> },
      { accessorKey: "prod_code", header: "Product Code", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "prod_code")}</span> },
      { accessorKey: "job_no", header: "Job No", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "job_no")}</span> },
      { accessorKey: "qty_puom", header: "Qty PUOM", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "qty_puom") || val(row.original, "QTY_PUOM")}</span> },
      { accessorKey: "uom", header: "UOM", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "p_uom")}</span> },
      { accessorKey: "from_loc_start", header: "From Location", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "p_uom")}</span> },
      { accessorKey: "to_loc_start", header: "To Location", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "p_uom")}</span> },
      // FROM_LOC_START
      {
        accessorKey: "confirmed",
        header: "Confirmed",
        cell: ({ row }) => <StatusBadge flag={row.original.confirmed as "Y" | "N"} labels={["Yes", "No"]} />,
      },
      // {
      //   id: "actions",
      //   header: "ACTIONS",
      //   enableColumnFilter: false,
      //   cell: ({ row }) => {
      //     if (row.original.processed === "Y" || row.original.confirmed === "Y") return null;
      //     return (
      //       <div className="flex items-center justify-center gap-1">
      //         <button
      //           type="button"
      //           className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
      //           title="Edit"
      //           onClick={(e) => { e.stopPropagation(); setEditingRow(row.original); setEditOpen(true); }}
      //         >
      //           <Pencil size={13} />
      //         </button>
      //         <button
      //           type="button"
      //           className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
      //           title="Delete"
      //           onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }}
      //         >
      //           <Trash2 size={13} />
      //         </button>
      //       </div>
      //     );
      //   },
      // },
    ],
    []
  );

  const processColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        id: "select",
        header: "Select",
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
      },
      ...createColumns.filter((c) => (c as any).id !== "actions"),
    ],
    [createColumns, selectedRows]
  );

  const confirmColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        id: "select_expand",
        header: "",
        enableColumnFilter: false,
        cell: ({ row }) => {
          if (!row.original._isParent) return null;
          const key = String(row.original._parentKey || "");
          const checked = selectedBatchKeys.has(key);
          return (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={checked}
                onChange={(e) => {
                  setSelectedBatchKeys((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(key);
                    else next.delete(key);
                    return next;
                  });
                }}
              />
            </div>
          );
        },
      },
      {
        id: "txn_type",
        header: "TXN Type",
        cell: ({ row }) => {
          if (row.original._isParent) {
            return <span className="inline-flex items-center rounded border bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">STN Detail</span>;
          }
          const isTFO = val(row.original, "txn_type") === "TFO";
          return (
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold ${isTFO ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
              {val(row.original, "txn_type")}
            </span>
          );
        },
      },
      {
        id: "key_number",
        header: "Key Number",
        cell: ({ row }) => row.original._isParent ? (
          <strong className="text-primary text-xs">{val(row.original, "key_number")}</strong>
        ) : (
          <span className="pl-4 text-xs text-muted-foreground">{val(row.original, "key_number")}</span>
        ),
      },
      { id: "prod_code_c", header: "Product Code", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "prod_code")}</span> },
      { id: "job_no_c", header: "Job No", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "job_no")}</span> },
      { id: "site_code_c", header: "Site Code", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "site_code")}</span> },
      { id: "location_code_c", header: "Location", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "location_code")}</span> },
      { id: "quantity_c", header: "Quantity", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "quantity")}</span> },
      { id: "qty_puom_c", header: "Qty PUOM", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "qty_puom")}</span> },
      { id: "p_uom_c", header: "P UOM", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "p_uom")}</span> },
      { id: "stn_no_c", header: "STN No", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "stn_no")}</span> },
      { id: "batch_no_c", header: "Batch No", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "batch_no")}</span> },
      { id: "lot_no_c", header: "Lot No", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "lot_no")}</span> },
      { id: "confirmed_c", header: "Confirmed", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "confirmed")}</span> },
      { id: "user_id_c", header: "User ID", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "user_id")}</span> },
      { id: "user_dt_c", header: "User Date", cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDateTime(val(row.original, "user_dt"))}</span> },
    ],
    [selectedBatchKeys]
  );

  const flatConfirmRows = useMemo(() => {
    const out: WmsRow[] = [];
    for (const parent of confirmRows) {
      out.push(parent);
      for (const child of (parent._children as WmsRow[]) || []) out.push(child);
    }
    return out;
  }, [confirmRows]);

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* ── Header (Polished Senior UI) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        {/* LEFT SIDE: Back Button + Title + Metadata */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/workspace/wms/wms/activity/request/stock_transfer")}
            title="Back to Listing"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Stock Transfer No
            </span>
            <span className="text-[13px] font-bold leading-tight text-foreground">
              {stn_no}
            </span>
          </div>

          <div className="hidden h-9 items-center gap-2.5 border-l border-border pl-4 sm:flex">
            <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Principal
              </span>
              <span className="max-w-[250px] truncate text-xs font-semibold text-foreground">
                {prin_code ? `${prin_code} - ${principalName || "..."}` : "—"}
              </span>
            </div>

            {isAnyConfirmed && (
              <div className="flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Confirmed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Action Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            className="h-8"
          >
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button> */}

          {selectedTab === "create" && (
            <>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isAnyConfirmed}
                title={isAnyConfirmed ? "Cannot add — a confirmed transfer already exists" : ""}
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={14} className="mr-1.5" /> Create Detail
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setImportOpen(true)}
              >
                <CloudUpload size={14} className="mr-1.5" /> Import
              </Button>
            </>
          )}

          {selectedTab === "process" && (
            <Button
              size="sm"
              className="h-8 bg-primary hover:bg-primary/90"
              disabled={!selectedRows.length || processing}
              onClick={handleProcess}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              {processing ? "Processing..." : "Process Transfer"}
            </Button>
          )}

          {selectedTab === "confirmed" && (
            <>
              <Button
                size="sm"
                className="h-8 bg-primary hover:bg-primary/90"
                disabled={!selectedBatchKeys.size || confirming}
                onClick={handleConfirm}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {confirming ? "Confirming..." : "Confirm Transfer"}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={openListDialog}>
                <Printer size={14} className="mr-1.5" /> Print
              </Button>
            </>
          )}

          {/* Export button — always visible, exports current tab's data */}
          <Button
            type="button"
            size="sm"
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleExportCurrentTab}
          >
            <Download size={14} className="mr-1.5" /> Export
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Tab strip (Freight style with counts) ── */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {TABS.map((tab) => {
          const count = getTabCount(tab.value);
          const active = selectedTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedTab(tab.value)}
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
      </div>

      {/* ── Grid ── */}
      {selectedTab === "confirmed" ? (
        <DataTable
                  enableExport={false}
          columns={confirmColumns}
          data={flatConfirmRows}
          searchPlaceholder="Search..."
          loading={loading}
          height="calc(100vh - 180px)"
          minWidth={1400}
          density="grid"
          enablePagination
          pageSize={25}
          getRowId={(row, index) =>
            row._isParent
              ? `parent-${val(row as WmsRow, "_parentKey")}`
              : `child-${val(row as WmsRow, "key_number")}-${val(row as WmsRow, "txn_type")}-${index}`
          }
          rowClassName={(row) => {
            if (row._isParent) return "[&>td]:bg-blue-50/60 font-semibold border-t-2 border-primary/30";
            if (val(row as WmsRow, "txn_type") === "TFO") return "[&>td]:bg-amber-50/50";
            return "[&>td]:bg-emerald-50/50";
          }}
        />
      ) : (
        <DataTable
          columns={selectedTab === "process" ? processColumns : createColumns}
                    enableExport={false}
          data={displayData}
          searchPlaceholder="Search product, site, location..."
          loading={loading}
          height="calc(100vh - 180px)"
          minWidth={900}
          density="grid"
          enablePagination
          pageSize={25}
          getRowId={(row, index) => String((row as WmsRow)._id || index)}
          rowClassName={(row) => {
            if ((row as WmsRow).confirmed === "Y") return "[&>td]:bg-emerald-50/70";
            if ((row as WmsRow).processed === "Y") return "[&>td]:bg-amber-50/60";
            return "[&>td]:bg-blue-50/40";
          }}
        />
      )}

      {/* ── Create Detail Dialog ── */}
      <CreateDetailDialog
        open={createOpen}
        stn_no={stn_no || ""}
        company_code={company_code}
        prin_code={prin_code}
        username={user?.username || ""}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          void loadData(false);
          setNotice({ type: "success", message: "Transfer detail created." });
        }}
        onError={(msg) => setNotice({ type: "error", message: msg })}
      />

      {/* ── Edit Detail Dialog ── */}
      {editingRow && (
        <EditDetailDialog
          open={editOpen}
          row={editingRow}
          stn_no={stn_no || ""}
          company_code={company_code}
          prin_code={prin_code}
          username={user?.username || ""}
          onClose={() => { setEditOpen(false); setEditingRow(null); }}
          onSuccess={() => {
            setEditOpen(false);
            setEditingRow(null);
            void loadData(false);
            setNotice({ type: "success", message: "Transfer detail updated." });
          }}
          onError={(msg) => setNotice({ type: "error", message: msg })}
        />
      )}

      {/* ── Delete confirm ── */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Transfer Detail"
        description="This will permanently remove this transfer detail."
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
          Product: <strong className="text-foreground">{deleteTarget ? val(deleteTarget, "prod_code") : ""}</strong>
          {" · "}Key: <strong className="text-foreground">{deleteTarget ? String(deleteTarget._id || "") : ""}</strong>
        </div>
      </Dialog>

      {/* ── Import Dialog ── */}
      <Dialog
        open={importOpen}
        title="Import Stock Transfer from Excel"
        onClose={() => setImportOpen(false)}
        wide
      >
        <ImportStockTransEdi
          stn_no={stn_no || 0}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            void loadData(false);
          }}
        />
      </Dialog>

      {/* ── Dialog 1: Report list ── */}
      <Dialog open={listOpen} title="Select Report" compact onClose={() => setListOpen(false)}>
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
      <NewReportDialog
        open={reportOpen}
        onClose={closeReportDialog}
        title={selectedReport?.reportTitle ?? "Report"}
        htmlContent={reportHtml || null}
        loading={reportLoading}
        error={reportError || null}
        onExportExcel={handleExcel}
        exportingExcel={excelLoading}
        onOpenInNewWindow={handleOpenReportInNewWindow}
        onDownloadPdf={handleDownloadReportPdf}
      />
    </section>
  );
}

// ─── Create Detail Dialog ─────────────────────────────────────────────────────
function CreateDetailDialog({
  open,
  stn_no,
  company_code,
  prin_code,
  username,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  stn_no: string;
  company_code: string;
  prin_code: string;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WmsRow | null>(null);
  const [fromSite, setFromSite] = useState("");
  const [toSite, setToSite] = useState("");
  const [fromLocStart, setFromLocStart] = useState("");
  const [fromLocEnd, setFromLocEnd] = useState("");
  const [toLocStart, setToLocStart] = useState("");
  const [toLocEnd, setToLocEnd] = useState("");
  const [qtyPUOM, setQtyPUOM] = useState("");
  const [qtyLUOM, setQtyLUOM] = useState("");
  const [locNotice, setLocNotice] = useState<NoticeState>(null);

  useEffect(() => {
    if (open) {
      setSelectedProduct(null);
      setFromSite("");
      setToSite("");
      setFromLocStart("");
      setFromLocEnd("");
      setToLocStart("");
      setToLocEnd("");
      setQtyPUOM("");
      setQtyLUOM("");
      setLocNotice(null);
    }
  }, [open]);

  const isSameUOM =
    !selectedProduct ||
    val(selectedProduct, "P_UOM").toUpperCase() === val(selectedProduct, "L_UOM").toUpperCase();
  const uppp = Number(selectedProduct ? val(selectedProduct, "UPPP") : 1) || 1;
  const totalQty = isSameUOM
    ? Number(qtyPUOM) || 0
    : uppp * (Number(qtyPUOM) || 0) + (Number(qtyLUOM) || 0);
  const qtyAvl = Number(selectedProduct ? val(selectedProduct, "QTY_AVL") : 0);
  const isQtyValid = totalQty > 0 && totalQty <= qtyAvl;
  const canSubmit =
    selectedProduct && fromSite && toSite && fromLocStart && toLocStart && isQtyValid && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedProduct) return;
    setSaving(true);
    try {
      await createStockTransferDetail({
        STN_NO: stn_no,
        COMPANY_CODE: company_code,
        PRIN_CODE: val(selectedProduct, "PRIN_CODE") || prin_code,
        PROD_CODE: val(selectedProduct, "PROD_CODE"),
        USER_ID: username,
        FROM_SITE: fromSite,
        TO_SITE: toSite,
        FROM_LOC_START: fromLocStart,
        FROM_LOC_END: fromLocEnd || fromLocStart,
        TO_LOC_START: toLocStart,
        TO_LOC_END: toLocEnd || toLocStart,
        QTY_PUOM: Number(qtyPUOM) || 0,
        QTY_LUOM: isSameUOM ? 0 : Number(qtyLUOM) || 0,
        QUANTITY: totalQty,
        P_UOM: val(selectedProduct, "P_UOM"),
        L_UOM: val(selectedProduct, "L_UOM"),
        JOB_NO: val(selectedProduct, "JOB_NO"),
        KEY_NUMBER: val(selectedProduct, "KEY_NUMBER"),
        PALLET_ID_FROM: val(selectedProduct, "PALLET_ID"),
        PALLET_ID_TO: "",
        BATCH_NO_FROM: val(selectedProduct, "BATCH_NO"),
        BATCH_NO_TO: val(selectedProduct, "BATCH_NO"),
        LOT_NO_FROM: val(selectedProduct, "LOT_NO"),
        LOT_NO_TO: val(selectedProduct, "LOT_NO"),
        MFG_DATE_FROM: toIsoDate(val(selectedProduct, "MFG_DATE")),
        MFG_DATE_TO: toIsoDate(val(selectedProduct, "MFG_DATE")),
        EXP_DATE_FROM: toIsoDate(val(selectedProduct, "EXP_DATE")),
        EXP_DATE_TO: toIsoDate(val(selectedProduct, "EXP_DATE")),
        ALLOCATED: "N",
        CONFIRMED: "N",
        SELECTED: "N",
        PROCESSED: "N",
        RECEIPT_TYPE: "N",
        MIXED_PUTAWAY: "N",
        MULTI_SERIES: "N",
      });
      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to create transfer detail.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div className="grid max-h-[92vh] w-[min(96vw,860px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Stock Transfer</p>
              <h2 className="m-0 text-lg font-bold text-foreground">Create Transfer Detail</h2>
            </div>
          </div>
          <button aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 text-sm">
          <div className="grid gap-4">
            <Section title="Product">
              <div className="grid gap-2.5 md:grid-cols-[1fr_2fr]">
                <LookupField
                  label="Product Code"
                  value={selectedProduct ? val(selectedProduct, "PROD_CODE") : ""}
                  displayValue={selectedProduct ? `${val(selectedProduct, "PROD_CODE")} - ${val(selectedProduct, "PROD_NAME")}` : ""}
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
                    const res = await api.post("/api/wms/inbound/executeRawSql", {
                      raw_sql: `SELECT PROD_CODE, BATCH_NO, UPPP, PRIN_CODE, PROD_NAME, SITE_CODE, LOCATION_CODE, P_UOM, QTY_STOCK, QTY_AVL, L_UOM, JOB_NO, TXN_DATE, LOT_NO, MANU_CODE, DOC_REF, KEY_NUMBER, UOM_COUNT, PALLET_ID, MFG_DATE, EXP_DATE FROM VW_STKLED WHERE PRIN_CODE = '${prin_code}'`,
                    });
                    return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
                  }}
                  onChange={(_val, row) => {
                    if (!row) return;
                    setSelectedProduct(row as WmsRow);
                    const siteCode = val(row as WmsRow, "SITE_CODE").trim();
                    const locCode = val(row as WmsRow, "LOCATION_CODE").trim();
                    setFromSite(siteCode);
                    setFromLocStart(locCode);
                    setFromLocEnd(locCode);
                    setToSite("");
                    setToLocStart("");
                    setToLocEnd("");
                    setQtyPUOM("");
                    setQtyLUOM("");
                  }}
                />
                <ReadOnlyInput label="Product Name" value={selectedProduct ? val(selectedProduct, "PROD_NAME") : ""} />
              </div>
              {selectedProduct && (
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  <ReadOnlyInput label="Available Qty" value={val(selectedProduct, "QTY_AVL")} />
                  <ReadOnlyInput label="P UOM" value={val(selectedProduct, "P_UOM")} />
                  <ReadOnlyInput label="L UOM" value={val(selectedProduct, "L_UOM")} />
                </div>
              )}
            </Section>

            {selectedProduct && (
              <>
                <Section title="Site">
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <LookupField label="From Site" value={fromSite} valueField="SITE_CODE" displayFields={["SITE_CODE", "SITE_NAME"]} columns={[{ field: "SITE_CODE", header: "Site Code" }, { field: "SITE_NAME", header: "Site Name" }]} placeholder="Select site" loadOptions={async () => { const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT * FROM MS_SITE` }); return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; }} onChange={(v) => { setFromSite(v); setFromLocStart(""); setFromLocEnd(""); }} />
                    <LookupField label="To Site" value={toSite} valueField="SITE_CODE" displayFields={["SITE_CODE", "SITE_NAME"]} columns={[{ field: "SITE_CODE", header: "Site Code" }, { field: "SITE_NAME", header: "Site Name" }]} placeholder="Select site" loadOptions={async () => { const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT * FROM MS_SITE` }); return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; }} onChange={(v) => { setToSite(v); setToLocStart(""); setToLocEnd(""); }} />
                  </div>
                </Section>

                <NoticeToast notice={locNotice} onClose={() => setLocNotice(null)} />

                <Section title="Location">
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <LookupField label="Loc Start (From)" required value={fromLocStart} valueField="LOCATION_CODE" displayFields={["LOCATION_CODE", "LOC_DESC"]} columns={[{ field: "LOCATION_CODE", header: "Location Code" }, { field: "LOC_DESC", header: "Location Name" }]} placeholder="Select location" loadOptions={async () => { if (!fromSite) return []; const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT LOCATION_CODE, LOC_DESC FROM MS_LOCATION WHERE SITE_CODE = '${fromSite}'` }); const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; if (data.length === 0) setLocNotice({ type: "error", message: `Site "${fromSite}" does not have any locations.` }); return data; }} onChange={(v) => { setFromLocStart(v); setFromLocEnd(v); }} />
                    <LookupField label="Loc Start (To)" required value={toLocStart} valueField="LOCATION_CODE" displayFields={["LOCATION_CODE", "LOC_DESC"]} columns={[{ field: "LOCATION_CODE", header: "Location Code" }, { field: "LOC_DESC", header: "Location Name" }]} placeholder="Select location" loadOptions={async () => { if (!toSite) return []; const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT LOCATION_CODE, LOC_DESC FROM MS_LOCATION WHERE SITE_CODE = '${toSite}'` }); const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; if (data.length === 0) setLocNotice({ type: "error", message: `Site "${toSite}" does not have any locations.` }); return data; }} onChange={(v) => { setToLocStart(v); setToLocEnd(v); }} />
                    <LookupField label="Loc End (From)" value={fromLocEnd} valueField="LOCATION_CODE" displayFields={["LOCATION_CODE", "LOC_DESC"]} columns={[{ field: "LOCATION_CODE", header: "Location Code" }, { field: "LOC_DESC", header: "Location Name" }]} placeholder="Select location" loadOptions={async () => { if (!fromSite) return []; const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT LOCATION_CODE, LOC_DESC FROM MS_LOCATION WHERE SITE_CODE = '${fromSite}'` }); return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; }} onChange={(v) => setFromLocEnd(v)} />
                    <LookupField label="Loc End (To)" value={toLocEnd} valueField="LOCATION_CODE" displayFields={["LOCATION_CODE", "LOC_DESC"]} columns={[{ field: "LOCATION_CODE", header: "Location Code" }, { field: "LOC_DESC", header: "Location Name" }]} placeholder="Select location" loadOptions={async () => { if (!toSite) return []; const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT LOCATION_CODE, LOC_DESC FROM MS_LOCATION WHERE SITE_CODE = '${toSite}'` }); return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; }} onChange={(v) => setToLocEnd(v)} />
                  </div>
                </Section>

                <Section title="Quantity">
                  <div className="grid gap-2.5 md:grid-cols-3">
                    <Field label={`Primary Qty (${val(selectedProduct, "P_UOM") || "PUOM"})`} required>
                      <Input type="number" min={0} value={qtyPUOM} onChange={(e) => setQtyPUOM(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label={`Lowest Qty (${val(selectedProduct, "L_UOM") || "LUOM"})`}>
                      <Input type="number" min={0} value={isSameUOM ? "0" : qtyLUOM} disabled={isSameUOM} onChange={(e) => !isSameUOM && setQtyLUOM(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Total Qty">
                      <Input readOnly className={`bg-muted/40 font-bold ${totalQty === 0 ? "" : isQtyValid ? "text-emerald-700" : "text-red-600"}`} value={String(totalQty)} />
                    </Field>
                  </div>
                  {totalQty > 0 && (
                    <p className={`mt-2 text-xs font-semibold ${isQtyValid ? "text-emerald-700" : "text-red-600"}`}>
                      {isQtyValid ? `✓ Within available (${qtyAvl})` : `✗ Exceeds available (${qtyAvl})`}
                    </p>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}><X size={15} /> Cancel</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}><Save size={15} /> {saving ? "Creating..." : "Create"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Detail Dialog ───────────────────────────────────────────────────────
function EditDetailDialog({
  open, row, stn_no, company_code, prin_code, username, onClose, onSuccess, onError,
}: {
  open: boolean; row: WmsRow; stn_no: string; company_code: string; prin_code: string; username: string; onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [fromSite, setFromSite] = useState(val(row, "from_site"));
  const [toSite, setToSite] = useState(val(row, "to_site"));
  const [fromLocStart, setFromLocStart] = useState(val(row, "from_loc_start"));
  const [fromLocEnd, setFromLocEnd] = useState(val(row, "from_loc_end"));
  const [toLocStart, setToLocStart] = useState(val(row, "to_loc_start"));
  const [toLocEnd, setToLocEnd] = useState(val(row, "to_loc_end"));
  const [qtyPUOM, setQtyPUOM] = useState(String(row.qty_puom ?? row.QTY_PUOM ?? "0"));
  const [qtyLUOM, setQtyLUOM] = useState(String(row.qty_luom ?? row.QTY_LUOM ?? "0"));

  const isSameUOM = val(row, "uom").toUpperCase() === val(row, "l_uom").toUpperCase();
  const uppp = Number(val(row, "uppp")) || 1;
  const totalQty = isSameUOM ? Number(qtyPUOM) || 0 : uppp * (Number(qtyPUOM) || 0) + (Number(qtyLUOM) || 0);
  const canSubmit = fromSite && toSite && fromLocStart && toLocStart && Number(qtyPUOM) > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await editStockTransferDetail({
        STN_NO: stn_no, COMPANY_CODE: company_code, PRIN_CODE: val(row, "prin_code") || prin_code, PROD_CODE: val(row, "prod_code"), SEQ_NUMBER: val(row, "seq_number") ? Number(val(row, "seq_number")) : undefined, KEY_NUMBER: String(row._id || ""), USER_ID: username, FROM_SITE: fromSite, TO_SITE: toSite, FROM_LOC_START: fromLocStart, FROM_LOC_END: fromLocEnd || fromLocStart, TO_LOC_START: toLocStart, TO_LOC_END: toLocEnd || toLocStart, QTY_PUOM: Number(qtyPUOM) || 0, QTY_LUOM: isSameUOM ? 0 : Number(qtyLUOM) || 0, QUANTITY: totalQty, P_UOM: val(row, "uom"), L_UOM: val(row, "l_uom"), JOB_NO: val(row, "job_no"), BATCH_NO_FROM: val(row, "batch_no_from"), BATCH_NO_TO: val(row, "batch_no_to"), LOT_NO_FROM: val(row, "lot_no_from"), LOT_NO_TO: val(row, "lot_no_to"), MFG_DATE_FROM: toIsoDate(val(row, "mfg_date_from")), MFG_DATE_TO: toIsoDate(val(row, "mfg_date_to")), EXP_DATE_FROM: toIsoDate(val(row, "exp_date_from")), EXP_DATE_TO: toIsoDate(val(row, "exp_date_to")), PALLET_ID_FROM: val(row, "pallet_id_from"), PALLET_ID_TO: val(row, "pallet_id_to"),
      });
      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to update transfer detail.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div className="grid max-h-[92vh] w-[min(96vw,800px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Stock Transfer</p>
              <h2 className="m-0 text-lg font-bold text-foreground">Edit Detail — {val(row, "prod_code")}</h2>
            </div>
          </div>
          <button aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 text-sm">
          <div className="grid gap-4">
            <Section title="Product">
              <div className="grid gap-2.5 md:grid-cols-3">
                <ReadOnlyInput label="Product Code" value={val(row, "prod_code")} />
                <ReadOnlyInput label="P UOM" value={val(row, "uom")} />
                <ReadOnlyInput label="L UOM" value={val(row, "l_uom")} />
              </div>
            </Section>

            <Section title="Site">
              <div className="grid gap-2.5 md:grid-cols-2">
                <LookupField label="From Site" value={fromSite} valueField="SITE_CODE" displayFields={["SITE_CODE", "SITE_NAME"]} columns={[{ field: "SITE_CODE", header: "Site Code" }, { field: "SITE_NAME", header: "Site Name" }]} placeholder="Select site" loadOptions={async () => { const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT DISTINCT SITE_CODE, SITE_CODE AS SITE_NAME FROM MS_SITE WHERE COMPANY_CODE = '${company_code}' AND PRIN_CODE = '${prin_code}' ORDER BY SITE_CODE` }); return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; }} onChange={(v) => { setFromSite(v); setFromLocStart(""); setFromLocEnd(""); }} />
                <LookupField label="To Site" value={toSite} valueField="SITE_CODE" displayFields={["SITE_CODE", "SITE_NAME"]} columns={[{ field: "SITE_CODE", header: "Site Code" }, { field: "SITE_NAME", header: "Site Name" }]} placeholder="Select site" loadOptions={async () => { const res = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: `SELECT DISTINCT SITE_CODE, SITE_CODE AS SITE_NAME FROM MS_SITE WHERE COMPANY_CODE = '${company_code}' AND PRIN_CODE = '${prin_code}' ORDER BY SITE_CODE` }); return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []; }} onChange={(v) => { setToSite(v); setToLocStart(""); setToLocEnd(""); }} />
              </div>
            </Section>

            <Section title="Location">
              <div className="grid gap-2.5 md:grid-cols-2">
                <Field label="Loc Start (From)" required><Input value={fromLocStart} onChange={(e) => setFromLocStart(e.target.value)} /></Field>
                <Field label="Loc Start (To)" required><Input value={toLocStart} onChange={(e) => setToLocStart(e.target.value)} /></Field>
                <Field label="Loc End (From)"><Input value={fromLocEnd} onChange={(e) => setFromLocEnd(e.target.value)} /></Field>
                <Field label="Loc End (To)"><Input value={toLocEnd} onChange={(e) => setToLocEnd(e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="Quantity">
              <div className="grid gap-2.5 md:grid-cols-3">
                <Field label={`Primary Qty (${val(row, "uom") || "PUOM"})`} required><Input type="number" min={0} value={qtyPUOM} onChange={(e) => setQtyPUOM(e.target.value)} /></Field>
                <Field label={`Lowest Qty (${val(row, "l_uom") || "LUOM"})`}><Input type="number" min={0} value={isSameUOM ? "0" : qtyLUOM} disabled={isSameUOM} onChange={(e) => !isSameUOM && setQtyLUOM(e.target.value)} /></Field>
                <Field label="Total Qty"><Input readOnly className="bg-muted/40 font-bold text-primary" value={String(totalQty)} /></Field>
              </div>
            </Section>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}><X size={15} /> Cancel</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}><Save size={15} /> {saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}

export default StockTransferViewPage;