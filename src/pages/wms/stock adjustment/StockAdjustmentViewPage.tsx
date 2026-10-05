import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  getStockAdjustmentData,
  getStockAdjusmentReportHtml,
  getStockAdjusmentReportExcelDownload,
  getAdjConfirmReport,
  downloadAdjConfirmReportExcel,
} from "../../../api/wms";
import { api } from "../../../api/client";
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Types ────────────────────────────────────────────────────────────────────
type WmsRow = Record<string, unknown>;
type NoticeState = { type: "success" | "error"; message: string } | null;

type TReport = {
  id: number;
  reportTitle: string;
  apiFn: (prinCode: string, adjNo: string) => Promise<string>;
  excelFn?: (prinCode: string, adjNo: string) => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function val(row: WmsRow, key: string) {
  return String(
    row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? ""
  );
}

function formatDateTime(input: string) {
  if (!input || input === "N/A") return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { label: "Create", value: "create" },
  { label: "Process", value: "process" },
  { label: "Confirm", value: "confirm" },
];

// ─── Report registry ──────────────────────────────────────────────────────────
const REPORTS: TReport[] = [
  {
    id: 1,
    reportTitle: "Adjustment Confirm Report",
    apiFn: getAdjConfirmReport,
    excelFn: downloadAdjConfirmReportExcel,
  },
  {
    id: 2,
    reportTitle: "Stock Adjustment Report",
    apiFn: getStockAdjusmentReportHtml,
    excelFn: getStockAdjusmentReportExcelDownload,
  },
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
export function StockAdjViewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [listOpen, setListOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TReport | null>(null);
  const [reportHtml, setReportHtml] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string>("");
  const [excelLoading, setExcelLoading] = useState(false);
  const [principalName, setPrincipalName] = useState("");

useEffect(() => {
  if (!prin_code || !company_code) return;
  let alive = true;
  api
    .post("/api/wms/inbound/executeRawSql", {
      raw_sql: `SELECT PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${company_code}' AND PRIN_CODE = '${prin_code}'`,
    })
    .then((res) => {
      if (!alive) return;
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      const name = rows[0]?.PRIN_NAME ?? rows[0]?.prin_name ?? "";
      setPrincipalName(String(name).trim());
    })
    .catch(() => {});
  return () => {
    alive = false;
  };
}, [prin_code, company_code]);

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
        message:
          error instanceof Error
            ? error.message
            : "Unable to load adjustment details.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adj_no, prin_code]);

  useEffect(() => {
    setSelectedRows([]);
  }, [selectedTab]);

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
      .apiFn(String(prin_code), adj_no)
      .then((html) => setReportHtml(html))
      .catch((err) => {
        console.error("Report API error:", err);
        setReportError("Failed to load report. Please try again.");
      })
      .finally(() => setReportLoading(false));
  }, [selectedReport, adj_no, prin_code]);

  const createRows = allDetails;

  const processRows = useMemo(
    () => allDetails.filter((r) => val(r, "selected") !== "Y"),
    [allDetails]
  );

  const confirmRows = useMemo(
    () =>
      allDetails.filter(
        (r) => val(r, "selected") === "Y" && val(r, "confirmed") !== "Y"
      ),
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

  const getTabCount = (tabValue: string) => {
    if (tabValue === "create") return createRows.length;
    if (tabValue === "process") return processRows.length;
    if (tabValue === "confirm") return confirmRows.length;
    return 0;
  };

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
      setNotice({
        type: "success",
        message: "Stock adjustment processed successfully.",
      });
      await loadData(false);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to process.",
      });
    } finally {
      setProcessing(false);
    }
  };

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
      setNotice({
        type: "success",
        message: "Stock adjustment confirmed successfully.",
      });
      await loadData(false);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to confirm.",
      });
    } finally {
      setConfirming(false);
    }
  };

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
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to delete.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCurrentTab = () => {
    const rowsToExport = displayData;

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
    link.download = `stock-adjustment-${selectedTab}-${adj_no}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExcel = async () => {
    if (!selectedReport?.excelFn) return;
    if (!prin_code) return;
    setExcelLoading(true);
    try {
      await selectedReport.excelFn(String(prin_code), adj_no);
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
    const PRINT_IFRAME_ID = "stock-adj-report-print-iframe";
    let iframe = document.getElementById(
      PRINT_IFRAME_ID
    ) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute(
        "sandbox",
        "allow-same-origin allow-scripts allow-modals"
      );
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

  const hasExcelExport = !!selectedReport?.excelFn;

  const selectColumn = (): ColumnDef<WmsRow> => ({
    id: "select",
    header: () => (
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
            if (e.target.checked)
              setSelectedRows((prev) => [...prev, row.original]);
            else
              setSelectedRows((prev) =>
                prev.filter((r) => r._id !== row.original._id)
              );
          }}
        />
      );
    },
  });

  const baseColumns: ColumnDef<WmsRow>[] = [
    { id: "row_no", header: "No", size: 52, cell: ({ row }) => row.index + 1 },
    // {
    //   accessorKey: "adj_no",
    //   header: "Adj No",
    //   size: 80,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "adj_no")}
    //     </span>
    //   ),
    // },
    {
      accessorKey: "prod_code",
      header: "Product",
      size: 150,
      cell: ({ row }) => (
        <span className="text-[11.5px] text-foreground">
          {val(row.original, "prod_code")}
        </span>
      ),
    },
    {
      accessorKey: "adj_type",
      header: "Adj Type",
      size: 100,
      cell: ({ row }) => <AdjTypeBadge type={val(row.original, "adj_type")} />,
    },
    {
      accessorKey: "key_number",
      header: "Key No",
      size: 130,
      cell: ({ row }) => (
        <span className="text-[11.5px] text-foreground">
          {val(row.original, "key_number")}
        </span>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty (Total)",
      size: 105,
      cell: ({ row }) => (
        <span className="text-[11.5px] text-foreground">
          {val(row.original, "quantity")}
        </span>
      ),
    },
    {
  id: "qty_combined",
  header: "Qty (PUOM / LUOM)",
  size: 100,
  cell: ({ row }) => {
    const puom = val(row.original, "qty_puom") || "0";
    const luom = val(row.original, "qty_luom") || "0";
    const pUomLabel = val(row.original, "p_uom");
    const lUomLabel = val(row.original, "l_uom");
    const isSame = pUomLabel.toUpperCase() === lUomLabel.toUpperCase();
    return (
      <span className="text-[11.5px] text-foreground">
        {puom} <span className="text-muted-foreground">{pUomLabel}</span>
        {!isSame && (
          <>
            {" / "}
            {luom} <span className="text-muted-foreground">{lUomLabel}</span>
          </>
        )}
      </span>
    );
  },
},
    // {
    //   accessorKey: "qty_puom",
    //   header: "Qty PUOM",
    //   size: 100,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "qty_puom")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "qty_luom",
    //   header: "Qty LUOM",
    //   size: 100,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "qty_luom")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "p_uom",
    //   header: "P UOM",
    //   size: 80,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "p_uom")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "l_uom",
    //   header: "L UOM",
    //   size: 80,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "l_uom")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "location_code",
    //   header: "Location",
    //   size: 120,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "location_code")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "job_no",
    //   header: "Job No",
    //   size: 120,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "job_no")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "batch_no",
    //   header: "Batch No",
    //   size: 110,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "batch_no")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "mfg_date",
    //   header: "Mfg Date",
    //   size: 130,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {formatDateTime(val(row.original, "mfg_date"))}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "exp_date",
    //   header: "Exp Date",
    //   size: 130,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {formatDateTime(val(row.original, "exp_date"))}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "user_id",
    //   header: "User",
    //   size: 100,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {val(row.original, "user_id")}
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "user_dt",
    //   header: "User Date",
    //   size: 130,
    //   cell: ({ row }) => (
    //     <span className="text-[11.5px] text-foreground">
    //       {formatDateTime(val(row.original, "user_dt"))}
    //     </span>
    //   ),
    // },
  ];

  const createColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      ...baseColumns,
      // {
      //   id: "actions",
      //   header: "Actions",
      //   size: 90,
      //   enableColumnFilter: false,
      //   cell: ({ row }) => {
      //     if (val(row.original, "selected") === "Y") return null;
      //     return (
      //       <div className="flex items-center justify-center gap-1">
      //         <button
      //           type="button"
      //           className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
      //           title="Edit"
      //           onClick={(e) => {
      //             e.stopPropagation();
      //             setEditingRow(row.original);
      //             setEditOpen(true);
      //           }}
      //         >
      //           <Pencil size={13} />
      //         </button>
      //         <button
      //           type="button"
      //           className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
      //           title="Delete"
      //           onClick={(e) => {
      //             e.stopPropagation();
      //             setDeleteTarget(row.original);
      //           }}
      //         >
      //           <Trash2 size={13} />
      //         </button>
      //       </div>
      //     );
      //   },
      // },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allDetails]
  );

  const processColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [selectColumn(), ...baseColumns],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedRows, processRows]
  );

  const confirmColumns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      selectColumn(),
      ...baseColumns,
      {
        accessorKey: "app_keynumber",
        header: "Applied Key No",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {val(row.original, "app_keynumber")}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedRows, confirmRows]
  );

  const activeColumns =
    selectedTab === "create"
      ? createColumns
      : selectedTab === "process"
      ? processColumns
      : confirmColumns;

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* ── Header (Polished Senior UI — matches Stock Transfer) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() =>
              navigate("/workspace/wms/wms/activity/request/stock_adj")
            }
            title="Back to Listing"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </Button>

<div className="flex min-w-0 items-center gap-2">
      <ClipboardList size={15} className="text-[#00378C] shrink-0" />

  <span className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
    Stock Adjustment No
  </span>
  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold leading-tight text-foreground">
    {adj_no}
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

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {selectedTab === "create" && (
            <Button
              size="sm"
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isAnyConfirmed}
              title={
                isAnyConfirmed
                  ? "Cannot add — a confirmed adjustment already exists"
                  : ""
              }
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} className="mr-1.5" /> Create Detail
            </Button>
          )}

          {selectedTab === "process" && (
            <Button
              size="sm"
              className="h-8 bg-primary hover:bg-primary/90"
              disabled={!selectedRows.length || processing}
              onClick={handleProcess}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              {processing
                ? "Processing..."
                : `Process Selected (${selectedRows.length})`}
            </Button>
          )}

          {selectedTab === "confirm" && (
            <>
              <Button
                size="sm"
                className="h-8 bg-primary hover:bg-primary/90"
                disabled={!selectedRows.length || confirming}
                onClick={handleConfirm}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {confirming
                  ? "Confirming..."
                  : `Confirm Adjustment (${selectedRows.length})`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={openListDialog}
              >
                <Printer size={14} className="mr-1.5" /> Print
              </Button>
            </>
          )}

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
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Data table ── */}
      <DataTable
        columns={activeColumns}
        data={displayData}
        searchPlaceholder="Search product, location, key no..."
        loading={loading}
        height="calc(100vh - 180px)"
        minWidth={900}
        density="grid"
        enablePagination
        pageSize={50}
        enableExport={false}
        getRowId={(row, index) => String((row as WmsRow)._id || index)}
        rowClassName={(row) => {
          if (val(row as WmsRow, "confirmed") === "Y")
            return "[&>td]:bg-emerald-50/70";
          if (val(row as WmsRow, "selected") === "Y")
            return "[&>td]:bg-amber-50/60";
          return "[&>td]:bg-blue-50/40";
        }}
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
          setNotice({
            type: "success",
            message: "Adjustment detail created.",
          });
        }}
        onError={(msg) => setNotice({ type: "error", message: msg })}
      />

      {/* ── Edit Detail dialog ── */}
      {editingRow && (
        <EditDetailDialog
          open={editOpen}
          row={editingRow}
          adj_no={adj_no}
          onClose={() => {
            setEditOpen(false);
            setEditingRow(null);
          }}
          onSuccess={() => {
            setEditOpen(false);
            setEditingRow(null);
            void loadData(false);
            setNotice({
              type: "success",
              message: "Adjustment detail updated.",
            });
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
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
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
      <NewReportDialog
        open={reportOpen}
        onClose={closeReportDialog}
        title={selectedReport?.reportTitle ?? "Report"}
        htmlContent={reportHtml || null}
        loading={reportLoading}
        error={reportError || null}
        onExportExcel={hasExcelExport ? handleExcel : undefined}
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

  const pUom = selectedProduct ? val(selectedProduct, "P_UOM") : "";
  const lUom = selectedProduct ? val(selectedProduct, "L_UOM") : "";
  const isSameUOM =
    !selectedProduct || pUom.toUpperCase() === lUom.toUpperCase();
  const uomCount =
    Number(selectedProduct ? val(selectedProduct, "UOM_COUNT") : 1) || 1;

  const totalQty = isSameUOM
    ? Number(qtyPUOM) || 0
    : uomCount * (Number(qtyPUOM) || 0) + (Number(qtyLUOM) || 0);

  const qtyAvl = Number(selectedProduct ? val(selectedProduct, "QTY_AVL") : 0);
  const isQtyExceeded = adjType === "-" && totalQty > qtyAvl;
  const canSubmit =
    !!selectedProduct && totalQty > 0 && !isQtyExceeded && !saving;

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
      onError(
        error instanceof Error
          ? error.message
          : "Unable to create adjustment detail."
      );
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
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Stock Adjustment
              </p>
              <h2 className="m-0 text-lg font-bold text-foreground">
                Create Adjustment Detail
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

        <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 text-sm">
          <div className="grid gap-4">
            <Section title="Product">
              <div className="grid gap-2.5 md:grid-cols-[1fr_2fr]">
                <LookupField
                  label="Product Code"
                  required
                  value={selectedProduct ? val(selectedProduct, "PROD_CODE") : ""}
                  displayValue={
                    selectedProduct
                      ? `${val(selectedProduct, "PROD_CODE")} — ${val(
                          selectedProduct,
                          "PROD_NAME"
                        )}`
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
                    <ReadOnlyInput
                      label="Site Code"
                      value={val(selectedProduct, "SITE_CODE")}
                    />
                    <ReadOnlyInput
                      label="Location Code"
                      value={val(selectedProduct, "LOCATION_CODE")}
                    />
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <ReadOnlyInput
                      label="Mfg Date"
                      value={
                        val(selectedProduct, "MFG_DATE")
                          ? new Date(
                              val(selectedProduct, "MFG_DATE")
                            ).toLocaleDateString("en-GB")
                          : "—"
                      }
                    />
                    <ReadOnlyInput
                      label="Exp Date"
                      value={
                        val(selectedProduct, "EXP_DATE")
                          ? new Date(
                              val(selectedProduct, "EXP_DATE")
                            ).toLocaleDateString("en-GB")
                          : "—"
                      }
                    />
                  </div>
                  <div className="mt-2.5 grid grid-cols-4 gap-2.5">
                    <ReadOnlyInput
                      label="Batch No"
                      value={val(selectedProduct, "BATCH_NO")}
                    />
                    <ReadOnlyInput
                      label="Lot No"
                      value={val(selectedProduct, "LOT_NO")}
                    />
                    <ReadOnlyInput
                      label="Available Qty"
                      value={val(selectedProduct, "QTY_AVL")}
                    />
                    <ReadOnlyInput label="Primary UOM" value={pUom} />
                  </div>
                </>
              )}
            </Section>

            {selectedProduct && (
              <Section title="Quantity & Adjustment Type">
                <div
                  className={`grid gap-2.5 ${
                    isSameUOM ? "md:grid-cols-2" : "md:grid-cols-3"
                  }`}
                >
                  <Field label={`P UOM Qty (${pUom})`} required>
                    <Input
                      type="number"
                      min={0}
                      value={qtyPUOM}
                      onChange={(e) => setQtyPUOM(e.target.value)}
                      placeholder="Enter in CSE"
                    />
                  </Field>

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
                      onChange={(e) =>
                        setAdjType(e.target.value as "+" | "-")
                      }
                    >
                      <option value="+">+ (Add)</option>
                      <option value="-">- (Subtract)</option>
                    </select>
                  </Field>
                </div>

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
                      </strong>{" "}
                      <span className="text-muted-foreground">
                        ({Number(qtyPUOM) || 0} {pUom} × {uomCount} +{" "}
                        {Number(qtyLUOM) || 0} {lUom})
                      </span>
                    </>
                  )}
                </p>

                {isQtyExceeded && (
                  <p className="mt-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    ⚠ Total {totalQty} {lUom || pUom} exceeds available stock of{" "}
                    {qtyAvl}
                  </p>
                )}

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
                        {" · "}LUOM = <strong>{Number(qtyLUOM) || 0}</strong>{" "}
                        {lUom}
                      </>
                    )}
                    {" · "}Total = <strong>{totalQty}</strong> {lUom || pUom}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      adjType === "+" ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {adjType === "+" ? "▲ Adding Stock" : "▼ Removing Stock"}{" "}
                    <span className="text-xs font-normal opacity-70">
                      (Avl: {qtyAvl} {lUom || pUom})
                    </span>
                  </span>
                </div>
              </Section>
            )}
          </div>
        </div>

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
  const [adjType, setAdjType] = useState<"+" | "-">(
    val(row, "adj_type") === "-" ? "-" : "+"
  );
  const [qtyPUOM, setQtyPUOM] = useState(
    String(row.qty_puom ?? row.QTY_PUOM ?? "0")
  );
  const [qtyLUOM, setQtyLUOM] = useState(
    String(row.qty_luom ?? row.QTY_LUOM ?? "0")
  );

  const pUom = val(row, "p_uom");
  const lUom = val(row, "l_uom");
  const isSameUOM = pUom.toUpperCase() === lUom.toUpperCase();

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
      onError(
        error instanceof Error
          ? error.message
          : "Unable to update adjustment detail."
      );
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
                <ReadOnlyInput
                  label="Location Code"
                  value={val(row, "location_code")}
                />
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
                    onChange={(e) => {
                      if (!isSameUOM) setQtyLUOM(e.target.value);
                    }}
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