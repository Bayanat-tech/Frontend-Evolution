import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw, Save, Truck } from "lucide-react";
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
import { NewReportDialog } from "../../../components/new_report_format";
import { OutboundAcitivityBilling } from "./OutboundAcitivityBilling";

type TReport = {
  id:           number;
  reportTitle:  string;
  apiFn:        (prinCode: string, jobNo: string) => Promise<string>;
  excelFn?:     (prinCode: string, jobNo: string) => Promise<void>;
};

const REPORTS: TReport[] = [
  { id: 1, reportTitle: "Job Details Report", apiFn: getOubJobDetReport, excelFn: downloadOubJobDetReportExcel },
  { id: 2, reportTitle: "Pick List Report", apiFn: getOubPickReport, excelFn: downloadOubPickReportExcel },
  { id: 3, reportTitle: "Delivery Note Report", apiFn: getDnReport, excelFn: downloadDnReportExcel },
  { id: 4, reportTitle: "Activity Services Report", apiFn: getOubServiceActivityReport, excelFn: downloadOubServiceActivityReportExcel },
  { id: 5, reportTitle: "Sales Order Report", apiFn: getSalesOrderReportHtml, excelFn: getSalesOrderSheetReportExcelDownload },
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
  const principalCode = new URLSearchParams(location.search).get("principal_code") || "";
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
    const PRINT_IFRAME_ID = "outbound-job-report-print-iframe";
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

  const activeTab = detailTabs.some((item) => item.value === tab) ? tab : "order_entry";
  
  const jobClass = jobClassLabels[value(job || {}, "job_class")] || value(job || {}, "job_class") || "Normal";
  const status = isCanceled(job || {}) ? "Canceled" : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress";
  const jobDate = formatDate(value(job || {}, "job_date"));

  // Exact status colors from Inbound
  const statusColor = status === "Canceled" 
    ? "text-red-600 bg-red-50 border-red-200"
    : status === "Confirmed" 
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : "text-blue-600 bg-blue-50 border-blue-200";

  const hasExcelExport = !!selectedReport?.excelFn;

  return (
    <section className="grid gap-3">
      {/* ── Job Header (Exact Inbound Style) ── */}
      <div 
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          padding: "12px 16px",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
        }}
      >
        {/* LEFT SIDE: Identity */}
        <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: "12px" }}>
          
          <Button 
            size="icon" 
            variant="outline" 
            style={{ height: "32px", width: "32px", flexShrink: 0, borderRadius: "8px" }}
            onClick={() => navigate(outboundJobsPath)}
            title="Back to jobs"
          >
            <ArrowLeft size={16} />
          </Button>

          <div 
            style={{ 
              display: "grid", placeItems: "center", width: "32px", height: "32px", 
              borderRadius: "8px", backgroundColor: "rgba(0, 55, 140, 0.08)", 
              color: "#00378C", flexShrink: 0
            }}
          >
            <Truck size={16} />
          </div>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, lineHeight: 1.2, color: "#0f172a" }}>
              Job No: {jobNo}
            </h1>
            
            <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10.5px] leading-tight font-semibold ${statusColor}`}>
              {status}
            </span>
            
            {/* Job Class badge styled like Inbound pill */}
            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10.5px] leading-tight font-semibold text-blue-700">
              {jobClass}
            </span>
          </div>
        </div>

        {/* RIGHT SIDE: Metadata Pill & Actions */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: "16px" }}>
          
          {job && (
            <div 
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                backgroundColor: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: "9999px", padding: "5px 14px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                {value(job, "prin_code")}
                {value(job, "prin_name") ? ` - ${value(job, "prin_name")}` : ""}
              </span>
              
              <span style={{ width: "1px", height: "12px", backgroundColor: "#cbd5e1" }} />
              
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>
                {jobDate}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            {/* <Button 
              size="sm" 
              variant="outline" 
              style={{ height: "32px", borderRadius: "8px", padding: "0 14px", fontSize: "13px", fontWeight: 500 }}
              onClick={loadJob}
            >
              <RefreshCw size={15} /> Refresh
            </Button> */}
            <Button 
              size="sm" 
              variant="outline" 
              style={{ height: "32px", borderRadius: "8px", padding: "0 14px", fontSize: "13px", fontWeight: 500 }}
              onClick={openListDialog}
            >
              <Printer size={15} /> Print
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tab Strip (Exact Inbound Style) ── */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {loading ? (
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          detailTabs.map((item) => {
            const active = item.value === activeTab;
            return (
              <Link
                key={item.value}
                to={outboundJobTabPath(jobNo, item.value, job || { prin_code: principalCode } as WmsRow)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#00378C] text-white shadow-sm font-semibold"
                    : "border border-border bg-card text-foreground hover:bg-secondary font-medium"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })
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

      {/* ── Dialog 2: Report viewer (NewReportDialog) ── */}
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