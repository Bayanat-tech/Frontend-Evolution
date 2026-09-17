import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../state/AuthContext";
import { ReportPreviewDialog } from "../../reports/ReportPreviewDialog";
import { closeFinanceReportPreview, getFinanceReportPreview, subscribeFinanceReportPreview } from "./financeReportPreviewStore";
import { createFinancePdf, downloadFinanceExcel, reportFilename, type ReportIdentity } from "./financeReportDocument";

export function FinanceReportPreview() {
  const request = useSyncExternalStore(subscribeFinanceReportPreview, getFinanceReportPreview);
  const { user } = useAuth();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const identity = useRef<ReportIdentity>({ title: "", company: "", user: "", generatedAt: "" });

  useEffect(() => { closeFinanceReportPreview(); }, [location.pathname]);
  useEffect(() => {
    let cancelled = false;
    let url = "";
    setPdfUrl(""); setError(""); setExporting(false);
    if (request?.document) {
      identity.current = {
        title: request.title,
        company: user?.company_name || user?.COMPANY_NAME || user?.company_code || "Company",
        user: user?.username || user?.USERNAME || user?.loginid || "User",
        generatedAt: new Date().toLocaleString(),
      };
      createFinancePdf(request.document, identity.current).then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob); setPdfUrl(url);
      }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to prepare PDF."); });
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [request]);

  if (!request) return null;
  const failure = request.error || error;
  return (
    <ReportPreviewDialog
      title={request.title}
      className="finance-report-preview"
      pdfUrl={pdfUrl}
      error={failure}
      exporting={exporting}
      onClose={closeFinanceReportPreview}
      onDownload={() => undefined}
      downloadName={`${reportFilename(request.document?.filename || request.title)}.pdf`}
      onExcel={async () => {
        if (!request.document) return;
        setExporting(true);
        try { await downloadFinanceExcel(request.document, identity.current); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to export Excel."); }
        finally { setExporting(false); }
      }}
    />
  );
}
