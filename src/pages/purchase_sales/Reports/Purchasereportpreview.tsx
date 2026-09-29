import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { closePurchaseReportPreview, getPurchaseReportPreview, subscribePurchaseReportPreview } from "./PurchaseReportPreviewState";
import { createPurchasePdf, downloadPurchaseExcel, reportFilename, ReportIdentity } from "./Purchasereportdocument";
import { PurchaseReportPreviewDialog } from "./PurchaseReportPreviewDialog";
import { useAuth } from "../../../state/AuthContext";


export function PurchaseReportPreview() {
  const request = useSyncExternalStore(subscribePurchaseReportPreview, getPurchaseReportPreview);
  const { user } = useAuth();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const identity = useRef<ReportIdentity>({ title: "", company: "", user: "", generatedAt: "" });

  useEffect(() => { closePurchaseReportPreview(); }, [location.pathname]);

  useEffect(() => {
    if (request?.document?.orientation) {
      setOrientation(request.document.orientation);
    }
  }, [request?.id, request?.document?.orientation]);

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
      const doc = { ...request.document, orientation };
      createPurchasePdf(doc, identity.current).then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob); setPdfUrl(url);
      }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to prepare PDF."); });
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [request, orientation, user]);

  if (!request) return null;
  const failure = request.error || error;
  return (
    <PurchaseReportPreviewDialog
      title={request.title}
      className="purchase-report-preview"
      orientation={orientation}
      onToggleOrientation={setOrientation}
      pdfUrl={pdfUrl}
      error={failure}
      exporting={exporting}
      onClose={closePurchaseReportPreview}
      onDownload={() => undefined}
      downloadName={`${reportFilename(request.document?.filename || request.title)}.pdf`}
      onExcel={async () => {
  if (!request.document) return;
  setExporting(true);
  try {
    if (request.document.onExcel) {
      await request.document.onExcel();
    } else {
      await downloadPurchaseExcel({ ...request.document, orientation }, identity.current);
    }
  }
  catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to export Excel."); }
  finally { setExporting(false); }
}}
    />
  );
}