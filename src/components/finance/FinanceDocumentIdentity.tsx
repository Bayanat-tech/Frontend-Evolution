import { ArrowLeft, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { formatDate } from "../../utils/date";
import { formatDocNo } from "../../utils/docNo";

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
          className="flex items-center justify-center p-1.5 rounded-lg text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 transition-colors"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
      )}
      {title && (
        <div className="flex items-center gap-2 mr-1">
          <FileText size={16} className="text-primary-foreground/80 shrink-0" />
          <h2 className="m-0 text-sm font-semibold tracking-tight text-primary-foreground whitespace-nowrap">
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
        <div className="rounded-md bg-blue-950/40 border border-blue-300/40 text-blue-100 px-2.5 py-0.5 shadow-xs flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-blue-200">Date</span>
          <strong className="text-xs font-semibold text-white">{formatDate(documentDate) || "—"}</strong>
        </div>

        {/* Total Badge */}
        {total !== undefined && total !== null && total !== "" && (
          <div className="rounded-md bg-emerald-950/40 border border-emerald-400/40 text-emerald-100 px-2.5 py-0.5 shadow-xs flex items-center gap-1.5 max-sm:hidden">
            <span className="text-[10px] uppercase font-bold text-emerald-300">Total</span>
            <strong className="text-xs font-bold text-emerald-200">{total}</strong>
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
