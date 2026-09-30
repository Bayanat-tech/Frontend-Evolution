import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Download, Calendar, RefreshCw } from "lucide-react";
import { Select } from "../ui/Select";

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
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00378C]/20"
        title="More options"
        aria-label="More options"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100">
          {/* Financial Year Selector */}
          {onFyPeriodChange && fyPeriods.length > 0 && (
            <div className="p-2.5 bg-slate-50/90 rounded-lg border border-slate-100 mb-1.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} className="text-[#00378C]" /> Financial Year
                </span>
                {fyPeriod && (
                  <span className="text-[10px] font-bold text-[#00378C] bg-blue-100/70 px-1.5 py-0.5 rounded">
                    FY {fyPeriod}
                  </span>
                )}
              </div>
              <Select
                value={fyPeriod || ""}
                onChange={(e) => onFyPeriodChange(e.target.value)}
                className="h-8 text-xs font-semibold text-[#00378C] bg-white border-slate-200"
              >
                {fyPeriods.map((period) => (
                  <option key={period.fy_period} value={period.fy_period}>
                    FY {period.fy_period}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Action List */}
          <div className="space-y-0.5 pt-0.5">
            {onExport && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onExport();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#00378C] transition-colors cursor-pointer text-left"
              >
                <Download size={14} className="text-[#00378C]" />
                <span>Export to CSV / Excel</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRefresh();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#00378C] transition-colors cursor-pointer text-left"
              >
                <RefreshCw size={14} className="text-slate-500" />
                <span>Refresh List</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
