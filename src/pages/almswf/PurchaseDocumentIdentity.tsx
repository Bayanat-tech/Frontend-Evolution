import { ArrowLeft, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { formatDate } from "../../utils/date";
import { type ReactNode } from "react";

export function PurchaseDocumentIdentity({
  title,
  documentNo,
  documentDate,
  total,
  onBack,
  headerExpanded,
  onToggleHeader,
  hideDate = false,
  children,
}: {
  title?: string;
  documentNo?: string;
  documentDate?: string;
  total?: string | number;
  divCode?: string;
  divName?: string;
  onBack?: () => void;
  headerExpanded?: boolean;
  onToggleHeader?: () => void;
  hideDate?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="finance-document-identity flex items-center justify-between gap-1.5 min-w-0 w-full">
      
      {/* LEFT SECTION */}
      <div className="flex items-center gap-1.5 min-w-0">
        
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        {title && (
          <div className="flex items-center gap-1.5 mr-1">
            <FileText size={16} className="text-[#00378C] shrink-0" />
            <h2 className="m-0 text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              {title}
            </h2>
          </div>
        )}

        {/* ✅ गैप कम करने के लिए gap-1.5 किया गया है */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {/* 1. DOC NO Pill */}
          <div className="finance-identity-docno rounded-full bg-[#fef3c7] text-[#78350f] border border-[#f59e0b] px-3 h-7 shadow-sm flex items-center gap-1">
            <span className="text-[11px] uppercase font-bold text-[#78350f] tracking-wide">DOC NO</span>
            <span className="text-[#78350f] font-bold select-none opacity-70">-</span>
            <strong className="text-[13px] font-bold text-[#78350f] font-mono tracking-tight leading-none">
              {documentNo && documentNo !== "New" && documentNo !== "0" ? String(documentNo).trim() : "NEW"}
            </strong>
          </div>

          {!hideDate && documentDate && (
            <div className="finance-identity-date rounded-full bg-[#fef3c7] text-[#78350f] border border-[#f59e0b] px-3 h-7 shadow-sm flex items-center gap-1">
              <span className="text-[11px] uppercase font-bold text-[#78350f] tracking-wide">DATE</span>
              <strong className="text-[13px] font-bold text-[#78350f] font-mono tracking-tight">
                {formatDate(documentDate) || "—"}
              </strong>
            </div>
          )}

          {/* 2. TOTAL Pill */}
          {total !== undefined && total !== null && total !== "" && (
            <div className="rounded-full bg-[#effaf5] border border-[#74e0b1] px-3 h-7 shadow-sm flex items-center gap-1 max-sm:hidden">
              <span className="text-[11px] uppercase font-bold text-[#00378C] tracking-wide">TOTAL</span>
              <strong className="text-[13px] font-bold text-slate-900">{total}</strong>
            </div>
          )}
        </div>

        {/* 3. Activity Button + Toggle (यहाँ ml-1 किया गया है ताकि गैप कम हो) */}
        <div className="flex items-center gap-1 ml-1">
            {children} 
            
            {onToggleHeader && (
              <button 
                type="button" 
                className="flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors border border-transparent hover:border-slate-300" 
                aria-expanded={headerExpanded}
                onClick={onToggleHeader}
              >
                {headerExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
        </div>

      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto"></div>
    </div>
  );
}