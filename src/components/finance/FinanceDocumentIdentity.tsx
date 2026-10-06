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
        {/* Highlighted Doc No */}
        <div className="finance-identity-docno rounded-md bg-amber-400 text-black border border-amber-500 px-2.5 py-0.5 shadow-xs flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-extrabold text-black tracking-wider">Doc No</span>
          <span className="text-black font-extrabold select-none">-</span>
          <strong className="text-xs font-black text-black font-mono tracking-tight">
            {documentNo && documentNo !== "New" && documentNo !== "0"
              ? String(documentNo).trim()
              : "NEW"}
          </strong>
        </div>

        {/* Highlighted Date */}
        <div className="rounded-md bg-white border border-slate-300 text-slate-700 px-2.5 py-0.5 shadow-2xs flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-500">Date</span>
          <strong className="text-xs font-semibold text-slate-900">{formatDate(documentDate) || "—"}</strong>
        </div>

        {/* Total Badge */}
        {total !== undefined && total !== null && total !== "" && (
          <div className="rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-0.5 shadow-2xs flex items-center gap-1.5 max-sm:hidden">
            <span className="text-[10px] uppercase font-bold text-emerald-600">Total</span>
            <strong className="text-xs font-bold text-emerald-900">{total}</strong>
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
