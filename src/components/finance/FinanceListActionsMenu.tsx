import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Download, Calendar, RefreshCw, ChevronDown } from "lucide-react";

export interface FinanceListActionsMenuProps {
  fyPeriod?: string;
  onFyPeriodChange?: (period: string) => void;
  fyPeriods?: Array<{ fy_period: string }>;
  onExport?: () => void;
  onRefresh?: () => void;
}

export const FinanceListActionsMenu: React.FC<FinanceListActionsMenuProps> = ({
  fyPeriod,
  onFyPeriodChange,
  fyPeriods = [],
  onExport,
  onRefresh,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00378C]/20 ${
          open
            ? "border-[#00378C] bg-blue-50/80 text-[#00378C] shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:text-[#00378C] hover:border-blue-200 hover:bg-blue-50/40"
        }`}
        title="More options"
        aria-label="More options"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[215px] rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-100 font-sans">
          {/* Financial Year Selector */}
          {onFyPeriodChange && fyPeriods.length > 0 && (
            <div className="px-2 pt-1.5 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fiscal Period
                </span>
                {fyPeriod && (
                  <span className="text-[10px] font-bold text-[#00378C] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100/80">
                    FY {fyPeriod}
                  </span>
                )}
              </div>
              <div className="relative">
                <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#00378C] pointer-events-none" />
                <select
                  value={fyPeriod || ""}
                  onChange={(e) => onFyPeriodChange(e.target.value)}
                  className="w-full h-7 pl-7 pr-6 rounded-md border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-white focus:border-[#00378C] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00378C] cursor-pointer appearance-none transition-colors"
                >
                  {fyPeriods.map((period) => (
                    <option key={period.fy_period} value={period.fy_period}>
                      FY {period.fy_period}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Subtle separator */}
          <div className="my-1 border-t border-slate-100" />

          {/* Action List */}
          <div className="space-y-0.5">
            {onExport && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onExport();
                }}
                className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-[#00378C] transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors shrink-0">
                  <Download size={13} />
                </span>
                <span className="truncate">Export to Excel</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRefresh();
                }}
                className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-[#00378C] transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-50 text-[#00378C] group-hover:bg-blue-100 transition-colors shrink-0">
                  <RefreshCw size={13} />
                </span>
                <span className="truncate">Refresh List</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

