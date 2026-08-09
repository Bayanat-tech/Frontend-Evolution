import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getWmsInbound,
  executeWmsInboundSql,
  getJobDetailsReport,
  downloadJobDetailsReportExcel,
  getPutawayReport,
  downloadPutawayReportExcel,
  getGrnReport,
  downloadGrnReportExcel,
  getTallyReport,
  downloadTallyReportExcel,
  getInbServiceActivityReport,
  downloadInbServiceActivityReportExcel
} from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../state/AuthContext";
import { cn } from "../../../lib/utils";
import { InboundOperationalTab, type InboundOperationalTabHandle } from "./InboundOperationalTab";
import { getTabsForJob } from "../../../config/tabConfig";
import {
  type WmsRow,
  value, normalizeRow, formatDate, sqlEscape,
  isCanceled, hasDate, locationSearchPrincipal, JobClassPill,
} from "../../../utils/inboundHelpers";
import { Dialog } from "../../../components/ui/Dialog";

type Props = { jobNo: string; tab: string };

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
    apiFn:       getJobDetailsReport,
    excelFn:     downloadJobDetailsReportExcel,
  },
  {
    id:          2,
    reportTitle: "Putaway Report",
    apiFn:       getPutawayReport,
    excelFn:     downloadPutawayReportExcel,
  },
    {
    id:          3,
    reportTitle: "Tally Report",
    apiFn:       getTallyReport,
    excelFn:     downloadTallyReportExcel,
  },
  {
    id:          4,
    reportTitle: "Goods Recipt Note Report",
    apiFn:       getGrnReport,
    excelFn:     downloadGrnReportExcel,
  },
  {
    id:          5,
    reportTitle: "Activity Services Report",
    apiFn:       getInbServiceActivityReport,
    excelFn:     downloadInbServiceActivityReportExcel,
  },
];

export function InboundJobDetail({ jobNo, tab }: Props) {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const location      = useLocation();
  const [job, setJob] = useState<WmsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const basePath = location.pathname.split("/").slice(0, -1).join("/");

  // ── Report dialog state ───────────────────────────────────────────────────
  const [listOpen,       setListOpen]       = useState(false);
  const [reportOpen,     setReportOpen]     = useState(false);
  const [selectedReport, setSelectedReport] = useState<TReport | null>(null);
  const [reportHtml,     setReportHtml]     = useState<string>("");
  const [reportLoading,  setReportLoading]  = useState(false);
  const [reportError,    setReportError]    = useState<string>("");
  const [excelLoading,   setExcelLoading]   = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const tabRef = useRef<InboundOperationalTabHandle>(null);

  // ── Fetch HTML when a report is selected ──────────────────────────────────
  useEffect(() => {
    if (!selectedReport) return;

    const prinCode = value(job || {}, "prin_code");
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
    const prinCode = value(job || {}, "prin_code");
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

  // ── Job loader ────────────────────────────────────────────────────────────
  const loadJob = async () => {
    setLoading(true);
    try {
      const data = await getWmsInbound<WmsRow>(`job/${encodeURIComponent(jobNo)}`);
      setJob(normalizeRow(data || {}));
    } catch {
      try {
        const fallback = await executeWmsInboundSql(
          `SELECT * FROM VW_TI_JOB WHERE JOB_NO = '${sqlEscape(jobNo)}' AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`,
        );
        setJob(normalizeRow(fallback[0] || { job_no: jobNo }));
      } catch {
        setJob(normalizeRow({ job_no: jobNo }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadJob(); }, [jobNo]);

  const availableTabs = getTabsForJob(value(job || {}, "job_class"));
  const activeTab     = availableTabs.some((t: any) => t.value === tab) ? tab : "shipment_details";
  console.log("value(job || {}, 'job_class'):", value(job || {}, "job_class"));

  const jobStatus   = isCanceled(job || {}) ? "Canceled"
    : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress";

  const statusColor = jobStatus === "Canceled"  ? "text-red-600 bg-red-50 border-red-200"
    : jobStatus === "Confirmed" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : "text-blue-600 bg-blue-50 border-blue-200";

  const reportReady   = !reportLoading && !reportError && !!reportHtml;
  const hasExcelExport = !!selectedReport?.excelFn;

  return (
    <section className="grid gap-3">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button size="icon" variant="outline"
            onClick={() => navigate("/workspace/wms/wms/transactions/inbound/jobs")}
            title="Back to jobs"
          >
            <ArrowLeft size={16} />
          </Button>

          <div className="min-w-0">
            <p className="eyebrow mb-0.5">Inbound Job</p>
            <h1 className="m-0 truncate text-xl font-semibold leading-tight">{jobNo}</h1>
          </div>

          <div className="hidden h-8 w-px bg-border sm:block" />

          {job && value(job, "prin_code") && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Principal</span>
              <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {value(job, "prin_code")}
                {value(job, "prin_name") ? ` · ${value(job, "prin_name")}` : ""}
              </span>
            </div>
          )}

          {job && value(job, "job_date") && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Job Date</span>
              <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {formatDate(value(job, "job_date"))}
              </span>
            </div>
          )}

          <div className="hidden h-8 w-px bg-border sm:block" />

          {job && <JobClassPill code={value(job, "job_class")} />}

          <span className={cn(
            "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
            statusColor,
          )}>
            {jobStatus}
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

      {/* ── Tabs ── */}
      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {availableTabs.map((item: any) => (
          <Link
            key={item.value}
            className={
              item.value === activeTab
                ? "ui-button ui-button-default ui-button-sm whitespace-nowrap"
                : "ui-button ui-button-outline ui-button-sm whitespace-nowrap"
            }
            to={`${basePath}/${item.value}${locationSearchPrincipal(job)}`}
            onClick={(e) => {
              if (item.value === activeTab) return;
              if (!tabRef.current?.validateBeforeLeave()) {
                e.preventDefault(); // blocked — the tab component already showed the
                                    // error toast and opened the fix-it modal
              }
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* ── Tab content ── */}
      <InboundOperationalTab ref={tabRef} job={job} jobNo={jobNo} tab={activeTab} loadingJob={loading} />

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

          {/* Toolbar — only visible when the report has loaded */}
          {reportReady && (
            <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-3 py-2">
              {/* Print / Save as PDF — fires window.print() inside the iframe */}
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer size={13} /> Print / Save as PDF
              </Button>

              {/* Excel — only rendered if the selected report has an excelFn */}
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

          {/* Loading */}
          {reportLoading && (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" />
              Loading report…
            </div>
          )}

          {/* Error */}
          {!reportLoading && reportError && (
            <div className="flex flex-1 items-center justify-center text-sm text-red-600">
              {reportError}
            </div>
          )}

          {/* Report iframe */}
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