import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, FileText, Loader2, Plus, Printer, RefreshCw, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../api/client";
import { getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";
import AddAbsentMemoPage, { type AbsentMemoFormHandle } from "./AddAbsentMemoPage";

const gridDataParameter = "HR_ABSENT_MEMO_MAIN_PAGE";

// print=false stops the backend HTML from auto-opening a print dialog inside the preview.
// AbsentMemoMainPage.tsx
const ABSENT_MEMO_REPORT_URL = "/api/wms/reports/absent-memo/html?print=false";
const PRINT_IFRAME_ID = "absent-memo-print-iframe";

export type AbsentMemoRow = {
  doc_no: string | number;
  doc_type?: string;
  doc_date?: string;
  ref_no?: string;
  employee_code?: string;
  name_from?: string;
  amount?: number | string;
  [key: string]: unknown;
};

type EditorMode = "add" | "edit";

// ── Backend report fetch (full HTML with company header/footer) ──────────────
const fetchAbsentMemoReportHtml = async (docNo: number): Promise<string> => {
  try {
    const res = await api.post(
      ABSENT_MEMO_REPORT_URL,
      { doc_no: docNo },
      { responseType: "text" },
    );
    return res.data;
  } catch (e: any) {
    let message = "Failed to load report. Please try again.";
    const data = e?.response?.data;
    try {
      // responseType 'text' leaves the JSON error body as a string
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed?.message) {
        message = parsed.code ? `${parsed.code}: ${parsed.message}` : parsed.message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
};

const AbsentMemoMainPage = () => {
  const title = "Absent Memo";
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<AbsentMemoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // view state (list ⇄ full-page editor)
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeRow, setActiveRow] = useState<AbsentMemoRow | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Report preview dialog state (NewReportDialog: raw HTML) ──
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTitle, setReportTitle] = useState(title);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<AbsentMemoFormHandle>(null);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const response = await getDynamicLookup({
        parameter: gridDataParameter,
        loginid,
        code1: companyCode,
      });
      setRows(Array.isArray(response) ? (response as AbsentMemoRow[]) : []);
    } catch (error) {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Unable to load absent memos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Navigation handlers ── */
  const openEditor = (mode: EditorMode, row: AbsentMemoRow | null = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    if (saving) return;
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
  };

  const handleSaved = () => {
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
    void loadRows();
  };

  /* ── Header Save button handler ── */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  /* ── Row-level print: fetch full report HTML from backend, open dialog ── */
  const handlePrintAbsentMemo = async (row: AbsentMemoRow) => {
    const docNo = Number(row?.doc_no);
    if (!docNo || Number.isNaN(docNo)) return;

    setReportTitle(`${title} ${docNo}`.trim());
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setReportLoading(true);

    try {
      setReportHtml(await fetchAbsentMemoReportHtml(docNo));
    } catch (error) {
      setReportPreviewError(
        error instanceof Error ? error.message : "Failed to load report. Please try again.",
      );
    } finally {
      setReportLoading(false);
    }
  };

  const closeReportPreview = () => {
    setReportPreviewOpen(false);
    setReportHtml(null);
    setReportPreviewError("");
  };

  // Open report HTML in a new tab
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

  // Print dialog (Save as PDF)
  const handleDownloadReportPdf = () => {
    if (!reportHtml) return;
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

  const columns = useMemo<ColumnDef<AbsentMemoRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 100, enableSorting: false },
      { accessorKey: "doc_type", header: "Doc Type", size: 110, enableSorting: false },
      { accessorKey: "doc_date", header: "Doc Date", size: 120, enableSorting: false },
      { accessorKey: "ref_no", header: "Ref No", size: 120, enableSorting: false },
      { accessorKey: "employee_code", header: "Employee Code", size: 140, enableSorting: false },
      { accessorKey: "name_from", header: "Name From", size: 200, enableSorting: false },
      { accessorKey: "amount", header: "Amount", size: 110, enableSorting: false },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => void handlePrintAbsentMemo(row.original)}
              title="Print / PDF"
            >
              <Printer size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const isEdit = editorMode === "edit";
    const editorTitle = isEdit ? `Edit ${title}` : `New ${title}`;
    const badge = isEdit ? "Editing" : "Draft";

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{editorTitle}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {activeRow?.doc_no != null && (
                  <span className="text-xs text-muted-foreground">Doc No {String(activeRow.doc_no)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
              <Save size={14} /> {saving ? "Saving" : isEdit ? "Update" : "Save"}
            </Button>
          </div>
        </div>

        {/* Form content — ref lets the header Save trigger the form */}
        <AddAbsentMemoPage
          ref={formRef}
          mode={editorMode}
          existingData={activeRow}
          onClose={(shouldRefetch?: boolean) => (shouldRefetch ? handleSaved() : handleCloseEditor())}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight-style transaction header (buttons in header)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">HR - {title}</h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => openEditor("add")}>
            <Plus size={14} /> Add
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Documents`}
        subtitle="Absent Memo List"
        searchValue={query}
        onSearchChange={(value) => setQuery(value)}
        searchPlaceholder="Search doc no, employee..."
        loading={loading}
        emptyText={`No ${title.toLowerCase()} records found`}
        height={560}
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.doc_no)}
        enableExport
        exportFilename="hr-absent-memo-list.csv"
      />

      {/* ── Report preview dialog ── */}
      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title={reportTitle}
        htmlContent={reportHtml}
        loading={reportLoading}
        error={reportPreviewError || null}
        onOpenInNewWindow={handleOpenReportInNewWindow}
        onDownloadPdf={handleDownloadReportPdf}
      />
    </section>
  );
};

export default AbsentMemoMainPage;