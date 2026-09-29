import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export type BiscDatePickerProps = {
  value?: string; // YYYY-MM-DD or ISO string
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minYear?: number;
  maxYear?: number;
  error?: boolean;
  required?: boolean;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function BiscDatePicker({
  value = "",
  onChange,
  placeholder = "DD / MM / YYYY",
  disabled = false,
  className = "",
  minYear = 1950,
  maxYear = 2050,
  error = false,
}: BiscDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Parse current value date safely
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const str = String(value).trim();
    if (!str) return null;

    // Match YYYY-MM-DD prefix (ignores ISO timestamp if present)
    const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
  }, [value]);

  // Calendar view month & year state
  const [viewYear, setViewYear] = useState<number>(() => parsedDate?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsedDate?.getMonth() ?? new Date().getMonth());

  // Sync view when parsedDate changes externally
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
    }
  }, [parsedDate]);

  // Position calculation
  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = 310;
    const popoverWidth = 275;

    let top = rect.bottom + 4;
    if (top + popoverHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - popoverHeight - 4);
    }

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - popoverWidth - 10);
    }

    setCoords({ top, left });
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close on outside click (handling both containerRef and portalRef)
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        portalRef.current &&
        !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  // Years array
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) list.push(y);
    return list;
  }, [minYear, maxYear]);

  // Prev / Next month handlers
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar grid computation — exactly rows needed (5 or 6 rows)
  const calendarCells = useMemo(() => {
    const cells: {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
    }[] = [];

    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const today = new Date();
    const isTodayYearMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
    const todayDate = today.getDate();

    // Previous month filler days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const isSelected = parsedDate !== null &&
        parsedDate.getFullYear() === prevY &&
        parsedDate.getMonth() === prevM &&
        parsedDate.getDate() === d;
      cells.push({
        day: d,
        month: prevM,
        year: prevY,
        isCurrentMonth: false,
        isSelected,
        isToday: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const isSelected = parsedDate !== null &&
        parsedDate.getFullYear() === viewYear &&
        parsedDate.getMonth() === viewMonth &&
        parsedDate.getDate() === d;
      const isToday = isTodayYearMonth && todayDate === d;
      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        isSelected,
        isToday,
      });
    }

    // Only complete the rows that actually exist (5 rows = 35 cells, 6 rows = 42 cells)
    const totalDays = firstDayOfWeek + daysInCurrentMonth;
    const totalRows = Math.ceil(totalDays / 7);
    const totalCells = totalRows * 7;
    const remaining = totalCells - cells.length;

    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const isSelected = parsedDate !== null &&
        parsedDate.getFullYear() === nextY &&
        parsedDate.getMonth() === nextM &&
        parsedDate.getDate() === d;
      cells.push({
        day: d,
        month: nextM,
        year: nextY,
        isCurrentMonth: false,
        isSelected,
        isToday: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth, parsedDate]);

  // Handle selecting a day
  const handleSelectDay = (year: number, month: number, day: number) => {
    const yStr = String(year);
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    onChange(`${yStr}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  // Handle Today
  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const yStr = String(today.getFullYear());
    const mStr = String(today.getMonth() + 1).padStart(2, "0");
    const dStr = String(today.getDate()).padStart(2, "0");
    onChange(`${yStr}-${mStr}-${dStr}`);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  // Handle Clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Format display string e.g. "01 / 09 / 2026"
  const formattedDisplay = useMemo(() => {
    if (!parsedDate) return "";
    const dStr = String(parsedDate.getDate()).padStart(2, "0");
    const mStr = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const yStr = String(parsedDate.getFullYear());
    return `${dStr} / ${mStr} / ${yStr}`;
  }, [parsedDate]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button Input */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`bisc-date-picker-trigger w-full h-[28px] px-2 rounded-[6px] border ${
          error ? "border-destructive ring-1 ring-destructive/40" : "border-[#94a3b8]"
        } bg-white text-foreground text-xs flex items-center justify-between transition-all cursor-pointer select-none
          ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "hover:border-[#64748b] focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C]/30 shadow-2xs"}`}
      >
        <span className={formattedDisplay ? "text-[#0f172a] font-medium text-[12px] tracking-tight" : "text-slate-400 text-[12px]"}>
          {formattedDisplay || placeholder}
        </span>
        <CalendarIcon className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
      </button>

      {/* Portaled Interactive Calendar Popover */}
      {isOpen && typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            ref={portalRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: "275px",
              backgroundColor: "#ffffff",
              zIndex: 999999,
            }}
            data-bisc-calendar="true"
            className="bisc-date-picker-portal fixed z-[999999] p-3 rounded-2xl border border-[#e2e8f0] bg-white text-[#1a1a2e] shadow-[0_20px_50px_rgba(0,0,0,0.18)] select-none font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Month and Year Selectors */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="cursor-pointer flex-1 h-7 px-2 rounded-md border border-[#e2e8f0] bg-slate-100 text-[#1a1a2e] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00378C]/20"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="cursor-pointer flex-1 h-7 px-2 rounded-md border border-[#e2e8f0] bg-slate-100 text-[#1a1a2e] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00378C]/20"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Navy Navigation Bar (< Month Year >) */}
            <div className="bg-[#00378C] text-white py-1.5 px-3 rounded-lg flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-0.5 text-white/80 hover:text-white hover:bg-white/20 rounded cursor-pointer transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold tracking-wide">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-0.5 text-white/80 hover:text-white hover:bg-white/20 rounded cursor-pointer transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday Row (Su Mo Tu We Th Fr Sa) */}
            <div className="grid grid-cols-7 text-center text-[10.5px] font-medium text-slate-400 mb-1">
              {WEEKDAY_NAMES.map((d) => (
                <span key={d} className="py-0.5">{d}</span>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-y-1 place-items-center">
              {calendarCells.map((cell, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(cell.year, cell.month, cell.day)}
                  className={`size-7 text-[11px] font-normal flex items-center justify-center rounded-full transition-all cursor-pointer
                    ${cell.isSelected
                      ? "bg-[#00378C] text-white font-semibold shadow-sm"
                      : cell.isToday
                      ? "bg-[#e0e7ff] text-[#00378C] font-semibold hover:bg-blue-100"
                      : cell.isCurrentMonth
                      ? "text-[#1a1a2e] hover:bg-slate-100"
                      : "text-slate-300 hover:bg-slate-50"
                    }`}
                >
                  {cell.day}
                </button>
              ))}
            </div>

            {/* Footer (Today and Clear Buttons) */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 mt-2">
              <button
                type="button"
                onClick={handleSelectToday}
                className="cursor-pointer py-1 px-4 text-xs font-semibold text-[#00378C] bg-[#e8eef6] hover:bg-[#d8e4f2] rounded-full transition-colors text-center"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="cursor-pointer py-1 px-3 text-xs font-medium text-slate-500 hover:text-[#1a1a2e] transition-colors text-right"
              >
                Clear
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
