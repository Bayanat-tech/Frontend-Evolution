import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { closeReportPreview, getReportPreview, subscribeReportPreview } from "./reportPreviewStore";
import { createFreightPdf, downloadFreightExcel, reportFilename, type ReportIdentity } from "./freightReportDocument";

export function FreightReportPreview() {
  const request = useSyncExternalStore(subscribeReportPreview, getReportPreview);
  const { user } = useAuth();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const identity = useRef<ReportIdentity>({ title: "", company: "", user: "", generatedAt: "" });

  useEffect(() => { closeReportPreview(); }, [location.pathname]);
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReportPreview();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],iframe') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [request?.id]);

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
      createFreightPdf(request.document, identity.current).then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob); setPdfUrl(url);
      }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to prepare PDF."); });
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [request]);

  if (!request) return null;
  const failure = request.error || error;
  return createPortal(
    <div className="freight-report-preview-backdrop">
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="freight-preview-title" className="freight-report-preview">
        <header>
          <div><span>REPORT PREVIEW</span><h2 id="freight-preview-title">{request.title}</h2></div>
          <button type="button" aria-label="Close report preview" onClick={closeReportPreview}><X size={20} /></button>
        </header>
        <div className="freight-report-preview-body" aria-busy={!pdfUrl && !failure}>
          {failure ? <div className="freight-report-preview-message" role="alert"><strong>Unable to generate report</strong><p>{failure}</p><p>Close this preview and generate the report again.</p></div>
            : pdfUrl ? <iframe title={`${request.title} PDF preview`} src={`${pdfUrl}#view=FitH`} />
              : <div className="freight-report-preview-message" role="status"><Loader2 size={28} className="animate-spin" /><p>Preparing your report...</p></div>}
        </div>
        <footer>
          <span>PDF preview · Esc to close</span>
          <div>
            <button type="button" disabled={!pdfUrl || exporting} onClick={async () => {
              if (!request.document) return;
              setExporting(true);
              try { await downloadFreightExcel(request.document, identity.current); }
              catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to export Excel."); }
              finally { setExporting(false); }
            }}><FileSpreadsheet size={16} />{exporting ? "Exporting..." : "Excel"}</button>
            {pdfUrl ? <a className="primary" href={pdfUrl} download={`${reportFilename(request.document?.filename || request.title)}.pdf`}><Download size={16} />Download PDF</a>
              : <button type="button" className="primary" disabled><Download size={16} />Download PDF</button>}
            <button type="button" onClick={closeReportPreview}>Close</button>
          </div>
        </footer>
      </div>
    </div>, document.body,
  );
}
