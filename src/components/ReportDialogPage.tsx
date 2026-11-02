import React, { useRef, useCallback, useState, useEffect } from "react";
import { NewReportDialog } from "./new_report_format";

export interface ReportDialogPageProps {
  Report: React.ComponentType<{ required_values: any }>;
  required_values: any;
  onClose?: () => void;
  title?: string;
  excel?: () => void;
  headerSlot?: React.ReactNode;
  /** Optional: pass through if available from caller */
  onOpenInNewWindow?: () => void;
  onDownloadPdf?: () => void;
  exportingExcel?: boolean;
  loading?: boolean;
  error?: string | null;
}

/**
 * Thin adapter: keeps the existing ReportDialogPage API, captures HTML from the
 * Report component's internal iframe, and renders NewReportDialog for preview /
 * print / zoom / page nav. Existing call sites stay unchanged.
 */
const ReportDialogPage = ({
  Report,
  required_values,
  onClose,
  title,
  excel,
  headerSlot,
  onOpenInNewWindow,
  onDownloadPdf,
  exportingExcel = false,
  loading: externalLoading = false,
  error: externalError = null,
}: ReportDialogPageProps) => {
  const captureHostRef = useRef<HTMLDivElement | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(true);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const resolvedTitle =
    title ?? `Report - ${required_values?.doc_no ?? ""}`;

  /**
   * After Report mounts and paints its iframe, read documentElement.outerHTML
   * (or body) so NewReportDialog can measure pages / print the same content.
   */
  const captureHtmlFromReport = useCallback(() => {
    const host = captureHostRef.current;
    if (!host) return;

    const iframe =
      (host.querySelector('iframe[title="report"]') as HTMLIFrameElement | null) ||
      (host.querySelector("iframe") as HTMLIFrameElement | null);

    if (!iframe) {
      // Report may still be loading its iframe — retry shortly
      return false;
    }

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !doc.body) return false;

      // Prefer full document so <head> styles / scripts stay intact
      const html =
        doc.documentElement?.outerHTML ||
        `<!DOCTYPE html><html><head></head><body>${doc.body.innerHTML}</body></html>`;

      if (!html || html.length < 20) return false;

      setHtmlContent(html);
      setCapturing(false);
      setCaptureError(null);
      return true;
    } catch (err) {
      // Cross-origin or not ready
      console.warn("ReportDialogPage: could not capture report HTML", err);
      setCaptureError("Could not read report content for preview.");
      setCapturing(false);
      return false;
    }
  }, []);

  // Poll briefly until the Report iframe is ready and HTML can be read
  useEffect(() => {
    setCapturing(true);
    setHtmlContent(null);
    setCaptureError(null);

    let attempts = 0;
    const maxAttempts = 40; // ~8s at 200ms
    const timer = window.setInterval(() => {
      attempts += 1;
      const ok = captureHtmlFromReport();
      if (ok || attempts >= maxAttempts) {
        window.clearInterval(timer);
        if (!ok && attempts >= maxAttempts) {
          setCapturing(false);
          setCaptureError(
            (prev) => prev || "Report did not finish loading in time."
          );
        }
      }
    }, 200);

    // Also try on next frames in case content is already there
    requestAnimationFrame(() => {
      captureHtmlFromReport();
    });

    return () => window.clearInterval(timer);
  }, [Report, required_values, captureHtmlFromReport]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const isLoading = externalLoading || capturing;
  const error = externalError || captureError;

  return (
    <>
      {/*
        Off-screen host: Report still mounts and runs its scripts / iframe
        so we can extract HTML. Not visible; does not affect layout.
      */}
      <div
        ref={captureHostRef}
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: 800,
          height: 600,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <Report required_values={required_values} />
      </div>

      <NewReportDialog
        open={true}
        onClose={handleClose}
        title={resolvedTitle}
        htmlContent={htmlContent}
        loading={isLoading}
        error={error}
        onExportExcel={excel}
        exportingExcel={exportingExcel}
        onOpenInNewWindow={onOpenInNewWindow}
        onDownloadPdf={onDownloadPdf}
        headerSlot={headerSlot}
      />
    </>
  );
};

export default ReportDialogPage;