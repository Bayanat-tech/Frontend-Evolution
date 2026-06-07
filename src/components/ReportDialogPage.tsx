import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { X } from "lucide-react";
import { Button } from "./ui/Button";

export interface ReportDialogPageProps {
  Report: React.ComponentType<{ required_values: any }>;
  required_values: any;
  onClose?: () => void;
  title?: string;
}

const ReportDialogPage = ({
  Report,
  required_values,
  onClose,
  title,
}: ReportDialogPageProps) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const fileName = `${title || "Report"}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const printStyles = `
    @page { margin: 10mm; size: A4 portrait; }

    * { box-sizing: border-box; }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      font-size: 13px;
      color: #000;
      background: #fff;
    }

    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }

    .invoice-print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      padding: 4px 24px;
      border-top: 1px solid #ccc;
    }

    .invoice-inline-footer {
      display: none !important;
    }
  `;

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: fileName,
    pageStyle: printStyles,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-black"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="border-b px-6 py-4 text-lg font-semibold">
          {title ?? `Report - ${required_values.doc_no ?? ""}`}
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-slate-100 p-4">
            <div ref={reportRef}>
              <Report required_values={required_values} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t p-4 print:hidden">
          <Button
            onClick={handlePrint}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Print
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportDialogPage;