import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileSpreadsheet, Loader2, X } from "lucide-react";

export type ReportPreviewDialogProps = {
  orientation?: "portrait" | "landscape";
  onToggleOrientation?: (newOrientation: "portrait" | "landscape") => void;
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
  orientation = "portrait",
  onToggleOrientation,
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
    if (pdfUrl) window.open(`${pdfUrl}#zoom=100`, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div className="freight-report-preview-backdrop">
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="report-preview-title" className={`freight-report-preview ${className}`.trim()}>
        <header>
          <div>
            <span>REPORT PREVIEW</span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "2px" }}>
              <h2 id="report-preview-title" style={{ margin: 0 }}>{title}</h2>
              {onToggleOrientation && (
                <div style={{ display: "inline-flex", border: "1px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#f8fafc", fontSize: "11px", fontWeight: 600 }}>
                  <button
                    type="button"
                    style={{
                      padding: "3px 10px",
                      background: orientation === "portrait" ? "#00378c" : "transparent",
                      color: orientation === "portrait" ? "#ffffff" : "#475569",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: orientation === "portrait" ? 700 : 500,
                    }}
                    onClick={() => onToggleOrientation("portrait")}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "3px 10px",
                      background: orientation === "landscape" ? "#00378c" : "transparent",
                      color: orientation === "landscape" ? "#ffffff" : "#475569",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: orientation === "landscape" ? 700 : 500,
                    }}
                    onClick={() => onToggleOrientation("landscape")}
                  >
                    Landscape
                  </button>
                </div>
              )}
            </div>
          </div>
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
            <iframe title={`${title} PDF preview`} src={`${pdfUrl}#zoom=100`} />
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
