import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, FileText, Loader2, Plus, Printer, RefreshCw, Save, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api } from "../../../api/client";
import { getDynamicLookup } from "../../../api/lookups";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";
import {
  AddSalaryAdditionDeductionForm,
  type FormMode,
  type SalaryFormHandle,
} from "./AddUpdate/AddSalaryAdditionDeductionPage";

const gridDataParameter = "HR_ADDITION_DEDUCTION_MAIN_PAGE";
const title = "Salary Addition/Deduction";

// print=false stops the backend HTML from auto-opening a print dialog inside the preview.
const SALARY_ADV_DED_REPORT_URL = "/api/wms/reports/salary-adv-ded/html?print=false";

const PRINT_IFRAME_ID = "salary-adv-ded-print-iframe";

const columnDef: ColumnDef<any>[] = [
  { accessorKey: "doc_no", header: "Doc No", enableSorting: false },
  { accessorKey: "doc_type", header: "Doc Type", enableSorting: false },
  { accessorKey: "doc_date", header: "Doc Date", enableSorting: false },
  { accessorKey: "ref_no", header: "Ref No", enableSorting: false },
  { accessorKey: "name_from", header: "Name From", enableSorting: false },
  { accessorKey: "addr_from", header: "Addr From", enableSorting: false },
  { accessorKey: "name_to", header: "Name To", enableSorting: false },
  { accessorKey: "addr_to", header: "Addr To", enableSorting: false },
  { accessorKey: "amount", header: "Amount", enableSorting: false },
];

// ── Backend report fetch (full HTML with company header/footer) ──────────────
const fetchSalaryAdvDedReportHtml = async (docNo: number): Promise<string> => {
  try {
    const res = await api.post(
      SALARY_ADV_DED_REPORT_URL,
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

const SalaryAdditionDeductionMainPage = () => {
  const { user } = useAuth();

  // inline form (shown above the table)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [activeRow, setActiveRow] = useState<any>(null);
  const [formKey, setFormKey] = useState(0); // remount form when switching rows
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // ── Report preview dialog state (NewReportDialog: raw HTML) ──
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTitle, setReportTitle] = useState(title);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<SalaryFormHandle>(null);

  const {
    data: gridData,
    isLoading,
    isFetching,
    refetch: refetchGridData,
  } = useQuery({
    queryKey: ["data", gridDataParameter, user?.company_code],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: gridDataParameter,
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });
      return Array.isArray(response) ? response : [];
    },
    enabled: !!user?.company_code,
  });

  const rows = gridData ?? [];
  const loading = isLoading || isFetching;
  const readonly = formMode === "view";
  const editing = formMode === "edit";

  /* ── Inline form open / close ── */
  const openForm = (mode: FormMode, row: any = null) => {
    setFormMode(mode);
    setActiveRow(row);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormMode("add");
    setActiveRow(null);
  };

  const handleFormClosed = (shouldRefetch?: boolean) => {
    setFormOpen(false);
    setFormMode("add");
    setActiveRow(null);
    if (shouldRefetch) void refetchGridData();
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
  const handlePrintSalaryAdditionDeduction = async (row: any) => {
    const docNo = Number(row?.doc_no ?? row?.docNo);
    if (!docNo || Number.isNaN(docNo)) return;

    setReportTitle(`${title} ${docNo}`.trim());
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setReportLoading(true);

    try {
      setReportHtml(await fetchSalaryAdvDedReportHtml(docNo));
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

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      ...columnDef,
      {
        id: "actions",
        header: "Actions",
        size: 120,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openForm("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openForm("view", row.original)}
              title="View"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => void handlePrintSalaryAdditionDeduction(row.original)}
              title="Print / PDF"
            >
              <Printer size={13} />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const formBadge = formMode === "add" ? "Draft" : editing ? "Editing" : "View only";

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
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Transactions - {title}
              </h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
              {formOpen && (
                <>
                  <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                    {formBadge}
                  </span>
                  {activeRow?.doc_no && (
                    <span className="text-xs text-muted-foreground">
                      Doc No: {activeRow.doc_no}
                      {activeRow.ref_no ? ` - Ref: ${activeRow.ref_no}` : ""}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetchGridData()}
            disabled={loading || saving}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openForm("add")} disabled={saving}>
            <Plus size={14} /> Add
          </Button>
          {formOpen && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
                <X size={14} /> Close
              </Button>
              {!readonly && (
                <Button type="button" size="sm" onClick={() => void handleHeaderSave()} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                  {saving ? "Saving" : editing ? "Update" : "Save"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit / View form — above the table */}
      {formOpen && (
        <AddSalaryAdditionDeductionForm
          key={formKey}
          ref={formRef}
          mode={formMode}
          existingData={activeRow}
          onClose={handleFormClosed}
        />
      )}

      {/* Document grid — hidden while the form is open */}
      {!formOpen && (
        <DataTable
          columns={columns}
          data={rows}
          title={isLoading ? "Loading" : `${rows.length.toLocaleString()} Documents`}
          subtitle={`${title} List`}
          searchValue={query}
          onSearchChange={(value) => setQuery(value)}
          searchPlaceholder="Search doc no, ref no, name..."
          loading={loading}
          emptyText={`No ${title.toLowerCase()} records found. Click Add to create one.`}
          height={420}
          minWidth={1000}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row: any) => String(row.doc_no)}
          enableExport
          exportFilename="salary-addition-deduction-list.csv"
        />
      )}

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

export default SalaryAdditionDeductionMainPage;