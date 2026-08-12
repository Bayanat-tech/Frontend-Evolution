import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { executeWmsInboundSql, getDnReport, downloadDnReportExcel, getOubPickReport, downloadOubPickReportExcel, downloadOubJobDetReportExcel, getOubJobDetReport, getOubServiceActivityReport, downloadOubServiceActivityReportExcel, getSalesOrderReportHtml, getSalesOrderSheetReportExcelDownload } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../state/AuthContext";
import type { WmsRow } from "./Outboundtypes";
import { detailTabs, outboundJobsPath } from "./Outboundtypes";
import {
  normalizeRow,
  value,
  isCanceled,
  hasDate,
  formatDate,
  sqlEscape,
} from "./OutboundHelpers";
import { jobClassLabels } from "./Outboundtypes";
import { outboundJobTabPath } from "./OutboundHelpers";
import { OutboundOperationalTab } from "./OutboundOperationalTab";
import { Dialog } from "../../../components/ui/Dialog";
import { OutboundAcitivityBilling } from "./OutboundAcitivityBilling";

type TReport = {
  id:           number;
  reportTitle:  string;
  apiFn:        (prinCode: string, jobNo: string) => Promise<string>;
  excelFn?:     (prinCode: string, jobNo: string) => Promise<void>;
};


const REPORTS: TReport[] = [
  {
    id:          1,
    reportTitle: "Job Details Report",
    apiFn:       getOubJobDetReport,
    excelFn:     downloadOubJobDetReportExcel,
  },
  {
    id:          2,
    reportTitle: "Pick List Report",
    apiFn:       getOubPickReport,
    excelFn:     downloadOubPickReportExcel,
  },
  {
    id:          3,
    reportTitle: "Delivery Note Report",
    apiFn:       getDnReport,
    excelFn:     downloadDnReportExcel,
  },
  {
    id:          4,
    reportTitle: "Activity Services Report",
    apiFn:       getOubServiceActivityReport,
    excelFn:     downloadOubServiceActivityReportExcel,
  },
   {
    id:          5,
    reportTitle: "Sales Order Report",
    apiFn:       getSalesOrderReportHtml,
    excelFn:     getSalesOrderSheetReportExcelDownload,
  },
  
];

export function OutboundJobDetail({
  jobNo,
  tab,
}: {
  jobNo: string;
  tab: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const principalCode =
    new URLSearchParams(location.search).get("principal_code") || "";
  const [job, setJob] = useState<WmsRow | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Report dialog state ───────────────────────────────────────────────────
  const [listOpen,       setListOpen]       = useState(false);
  const [reportOpen,     setReportOpen]     = useState(false);
  const [selectedReport, setSelectedReport] = useState<TReport | null>(null);
  const [reportHtml,     setReportHtml]     = useState<string>("");
  const [reportLoading,  setReportLoading]  = useState(false);
  const [reportError,    setReportError]    = useState<string>("");
  const [excelLoading,   setExcelLoading]   = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadJob = async () => {
    setLoading(true);
    try {
      const data = await executeWmsInboundSql(
        `SELECT * FROM TO_ORDER
         WHERE JOB_NO       = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(principalCode)}'
           AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`
      );
      setJob(
        normalizeRow(data[0] || { job_no: jobNo, prin_code: principalCode })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
  }, [jobNo]);

  // ── Fetch HTML when a report is selected ──────────────────────────────────
  useEffect(() => {
    if (!selectedReport) return;

    const prinCode = value(job || {}, "prin_code") || principalCode;
    if (!prinCode) {
      setReportError("Principal code is not available for this job.");
      return;
    }

    setReportHtml("");
    setReportError("");
    setReportLoading(true);

    selectedReport
      .apiFn(String(prinCode), jobNo)
      .then((html) => setReportHtml(html))
      .catch((err) => {
        console.error("Report API error:", err);
        setReportError("Failed to load report. Please try again.");
      })
      .finally(() => setReportLoading(false));
  }, [selectedReport]);

  // ── Toolbar handlers ──────────────────────────────────────────────────────
  const handlePrint = () => {
    iframeRef.current?.contentWindow?.postMessage("print", "*");
  };

  const handleExcel = async () => {
    if (!selectedReport?.excelFn) return;
    const prinCode = value(job || {}, "prin_code") || principalCode;
    if (!prinCode) return;
    setExcelLoading(true);
    try {
      await selectedReport.excelFn(String(prinCode), jobNo);
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

  const activeTab = detailTabs.some((item) => item.value === tab)
    ? tab
    : "order_entry";
  const jobClass =
    jobClassLabels[value(job || {}, "job_class")] ||
    value(job || {}, "job_class") ||
    "Normal";
  const status = isCanceled(job || {})
    ? "Canceled"
    : hasDate(value(job || {}, "confirm_date"))
      ? "Confirmed"
      : "In Progress";
  const jobDate = formatDate(value(job || {}, "job_date"));

  const reportReady    = !reportLoading && !reportError && !!reportHtml;
  const hasExcelExport  = !!selectedReport?.excelFn;

  return (
    <section className="grid gap-3">
      {/* ── Job Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            onClick={() => navigate(outboundJobsPath)}
            title="Back to jobs"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Outbound Job
            </p>
            <h1 className="m-0 truncate text-2xl font-bold text-foreground">
              {jobNo}
            </h1>
          </div>

          {/* Principal chip */}
          <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Principal
            </span>
            <span className="ml-1.5 text-sm font-bold text-foreground">
              {value(job || {}, "prin_code") || principalCode || "-"}
            </span>
          </div>

          {/* Job Date chip */}
          {jobDate && (
            <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Job Date
              </span>
              <span className="ml-1.5 text-sm font-bold text-foreground">
                {jobDate}
              </span>
            </div>
          )}

          {/* Job Class badge */}
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {jobClass}
          </span>

          {/* Status badge */}
          <span
            className={
              status === "Canceled"
                ? "rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700"
                : status === "Confirmed"
                  ? "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                  : "rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700"
            }
          >
            {status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadJob}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={openListDialog}>
            <Printer size={14} /> Print
          </Button>
        </div>
      </div>

      {/* ── Tab Strip ── */}
      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {detailTabs.map((item) =>
            <Link
              className={
                item.value === activeTab
                  ? "ui-button ui-button-default ui-button-sm"
                  : "ui-button ui-button-outline ui-button-sm"
              }
              key={item.value}
              to={outboundJobTabPath(jobNo, item.value, job || { prin_code: principalCode } as WmsRow)}
            >
              {item.label}
            </Link>
          // )
        )}
      </div>
      <OutboundOperationalTab
        job={job}
        jobNo={jobNo}
        tab={activeTab}
        loadingJob={loading}
        principalCode={principalCode}
      />
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExcel}
                  disabled={excelLoading}
                >
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

