import React, { useRef, useCallback } from "react";
import { X, Printer, FileSpreadsheet } from "lucide-react";
import { Button } from "./ui/Button";

export interface ReportDialogPageProps {
  Report: React.ComponentType<{ required_values: any }>;
  required_values: any;
  onClose?: () => void;
  title?: string;
  excel?: () => void;
  headerSlot?: React.ReactNode;
}

const ReportDialogPage = ({
  Report,
  required_values,
  onClose,
  title,
  excel,
  headerSlot,
}: ReportDialogPageProps) => {
  // We keep a ref to the iframe element so we can reach its contentWindow for printing.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const fileName = `${title || "Report"}-${new Date().toISOString().slice(0, 10)}`;

  const handlePrint = useCallback(() => {
    const dialogEl = document.querySelector('[data-report-dialog]');
    const iframe   = dialogEl?.querySelector('iframe[title="report"], iframe') as HTMLIFrameElement | null;

    if (!iframe?.contentWindow) {
      console.warn("ReportDialogPage: could not find report iframe");
      return;
    }

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-report-dialog
    >
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-black"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="border-b px-6 py-4 text-lg font-semibold pr-12 truncate">
          {title ?? `Report - ${required_values?.doc_no ?? ""}`}
        </div>

        {/* Optional slot (breadcrumbs, alerts, drill indicators, etc.) */}
        {headerSlot}

        {/* Content — the Report component renders its own iframe internally */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 bg-slate-100 p-4">
            <Report required_values={required_values} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t p-4">
          {excel && (
            <Button
              onClick={excel}
              className="flex items-center gap-1.5 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              <FileSpreadsheet size={15} />
              Excel
            </Button>
          )}
          <Button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Printer size={15} />
            Print
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportDialogPage;