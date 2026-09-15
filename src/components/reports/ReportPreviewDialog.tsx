import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileSpreadsheet, Loader2, X } from "lucide-react";

export type ReportPreviewDialogProps = {
  title: string;
  pdfUrl: string;
  error?: string;
  onBack?: () => void;  
  exporting: boolean;
  onExcel: () => void;
  onClose: () => void;
  onDownload: () => void;
  downloadName: string;
  className?: string;
};

export function ReportPreviewDialog({
  title,
  pdfUrl,
  error,
  exporting,
  onExcel,
  onClose,
  onDownload,
  downloadName,
  className = "",
}: ReportPreviewDialogProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],iframe') || []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const openInNewWindow = () => {
    if (pdfUrl) window.open(`${pdfUrl}#view=FitH`, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div className="freight-report-preview-backdrop">
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="report-preview-title" className={`freight-report-preview ${className}`.trim()}>
        <header>
          <div><span>REPORT PREVIEW</span><h2 id="report-preview-title">{title}</h2></div>
          <button type="button" aria-label="Close report preview" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="freight-report-preview-body" aria-busy={!pdfUrl && !error}>
          {error ? (
            <div className="freight-report-preview-message" role="alert">
              <strong>Unable to generate report</strong>
              <p>{error}</p>
              <p>Close this preview and generate the report again.</p>
            </div>
          ) : pdfUrl ? (
            <iframe title={`${title} PDF preview`} src={`${pdfUrl}#view=FitH`} />
          ) : (
            <div className="freight-report-preview-message" role="status">
              <Loader2 size={28} className="animate-spin" />
              <p>Preparing your report...</p>
            </div>
          )}
        </div>
        <footer>
          <span>PDF preview · Esc to close</span>
          <div>
            <button type="button" disabled={!pdfUrl || exporting} onClick={onExcel}>
              <FileSpreadsheet size={16} />{exporting ? "Exporting..." : "Excel"}
            </button>
            <button type="button" disabled={!pdfUrl} onClick={openInNewWindow}>
              <ExternalLink size={16} />Open in new window
            </button>
            {pdfUrl ? (
              <a className="primary" href={pdfUrl} download={downloadName} onClick={onDownload}>
                <Download size={16} />Download PDF
              </a>
            ) : (
              <button type="button" className="primary" disabled><Download size={16} />Download PDF</button>
            )}
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
