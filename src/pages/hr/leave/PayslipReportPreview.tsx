import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { closePayslipPreview, getPayslipPreview, subscribePayslipPreview } from "./payslipPreviewStore";
import { createPayslipPdf } from "./payslipReportDocument";
import { reportFilename, ReportIdentity } from "../../../components/freight/freightReportDocument";
import { useAuth } from "../../../state/AuthContext";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";

export function PayslipReportPreview() {
  const request = useSyncExternalStore(subscribePayslipPreview, getPayslipPreview);
  const { user } = useAuth();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const identity = useRef<ReportIdentity>({ title: "", company: "", user: "", generatedAt: "" });

  useEffect(() => { closePayslipPreview(); }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    let url = "";
    setPdfUrl(""); setError("");
    if (request?.document) {
      identity.current = {
        title: request.title,
        company: user?.company_name || user?.COMPANY_NAME || user?.company_code || "Company",
        user: user?.username || user?.USERNAME || user?.loginid || "User",
        generatedAt: new Date().toLocaleString(),
      };
      createPayslipPdf({ ...request.document, orientation }, identity.current)
        .then((blob) => { if (cancelled) return; url = URL.createObjectURL(blob); setPdfUrl(url); })
        .catch((reason) => {
          console.error("payslip pdf failed", reason);
          if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to prepare PDF.");
        });
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [request, orientation, user]);

  if (!request) return null;
  return (
    <ReportPreviewDialog
      title={request.title}
      className="freight-report-preview-freight"
      orientation={orientation}
      onToggleOrientation={setOrientation}
      pdfUrl={pdfUrl}
      error={request.error || error}
      exporting={false}
      onClose={closePayslipPreview}
      onDownload={() => undefined}
      downloadName={`${reportFilename(request.document?.filename || request.title)}.pdf`}
      onExcel={async () => undefined}
    />
  );
}