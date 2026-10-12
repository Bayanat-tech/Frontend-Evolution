import { ArrowLeft, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { formatDate } from "../../utils/date";

/** Compact identity shared by finance commercial and payment command bars matching BISC design. */
export function FinanceDocumentIdentity({
  title,
  documentNo,
  documentDate,
  total,
  divCode,
  divName,
  onBack,
  headerExpanded,
  onToggleHeader,
}: {
  title?: string;
  documentNo?: string;
  documentDate: string;
  total?: string | number;
  divCode?: string;
  divName?: string;
  onBack?: () => void;
  headerExpanded?: boolean;
  onToggleHeader?: () => void;
}) {
  return (
    <div className="finance-document-identity flex items-center gap-3 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
      )}
      {title && (
        <div className="flex items-center gap-2 mr-1">
          <FileText size={16} className="text-[#00378C] shrink-0" />
          <h2 className="m-0 text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
            {title}
          </h2>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {/* Highlighted Doc No - Increased font size */}
        <div className="finance-identity-docno rounded-md bg-[#fef3c7] text-[#78350f] border border-[#f59e0b] px-3 py-1 shadow-xs flex items-center gap-1.5">
          <span className="text-[12px] uppercase font-black text-[#78350f] tracking-wide">Doc No</span>
          <span className="text-[#78350f] font-extrabold select-none opacity-70">-</span>
          <strong className="text-[16px] font-black text-[#78350f] font-mono tracking-tight leading-none">
            {documentNo && documentNo !== "New" && documentNo !== "0"
              ? String(documentNo).trim()
              : "NEW"}
          </strong>
        </div>

        {/* Highlighted Date - Same amber background & increased font size */}
        <div className="finance-identity-date rounded-md bg-[#fef3c7] text-[#78350f] border border-[#f59e0b] px-2.5 py-0.5 shadow-xs flex items-center gap-1.5">
          <span className="text-[12px] uppercase font-black text-[#78350f] tracking-wide">Date</span>
          <span className="text-[#78350f] font-extrabold select-none opacity-70">-</span>
          <strong className="text-[14px] font-black text-[#78350f] font-mono tracking-tight">
            {formatDate(documentDate) || "—"}
          </strong>
        </div>

        {/* Total Badge */}
        {total !== undefined && total !== null && total !== "" && (
          <div className="rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-0.5 shadow-2xs flex items-center gap-1.5 max-sm:hidden">
            <span className="text-[11px] uppercase font-bold text-emerald-600">Total</span>
            <strong className="text-[13px] font-bold text-emerald-900">{total}</strong>
          </div>
        )}
      </div>
      {onToggleHeader && (
        <button type="button" className="finance-header-toggle" aria-expanded={headerExpanded}
          aria-label={headerExpanded ? "Collapse header to expand tables" : "Expand document header"}
          title={headerExpanded ? "Collapse header to expand tables" : "Expand document header"} onClick={onToggleHeader}>
          {headerExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}
    </div>
  );
}
