import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronRight, Search, X } from "lucide-react";
import { Division } from "../../api/transactions";

interface DivisionPickerDialogProps {
  open: boolean;
  divisions: Division[];
  onSelect: (division: Division) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

/**
 * BISC-styled Division Selection Dialog.
 * Features:
 * - Royal Blue gradient header with Building2 icon
 * - Quick search filter by division name or code
 * - BISC card items with division code badge, clear typography, and hover indicators
 * - Keyboard support (Escape to close, auto-focus search)
 */
export function DivisionPickerDialog({
  open,
  divisions,
  onSelect,
  onClose,
  title = "Select Division",
  description = "Choose the operating division to proceed",
}: DivisionPickerDialogProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filteredDivisions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return divisions;
    return divisions.filter(
      (d) =>
        d.div_name?.toLowerCase().includes(q) ||
        d.div_code?.toLowerCase().includes(q)
    );
  }, [divisions, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center p-4 bg-slate-950/50 backdrop-blur-[2px] transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BISC Royal Blue Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#00378C] to-[#0c4a9e] text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white shadow-xs backdrop-blur-xs">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="m-0 text-base font-semibold leading-tight tracking-tight text-white">
                {title}
              </h3>
              <p className="m-0 mt-0.5 text-xs text-blue-100/80">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search division by name or code..."
              className="w-full h-9 pl-9 pr-8 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Divisions List */}
        <div className="max-h-[380px] overflow-y-auto p-3 flex flex-col gap-2">
          {filteredDivisions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No divisions found matching "{query}"
            </div>
          ) : (
            filteredDivisions.map((division) => (
              <button
                key={division.div_code}
                type="button"
                onClick={() => {
                  onSelect(division);
                  onClose();
                }}
                className="group relative flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-[#00378C] hover:shadow-xs transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#00378C] border border-blue-200 group-hover:bg-[#00378C] group-hover:text-white transition-colors font-mono font-bold text-xs">
                    {division.div_code}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-[#00378C] transition-colors truncate">
                      {division.div_name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-[#00378C] opacity-0 group-hover:opacity-100 transition-opacity">
                    Select
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-slate-300 group-hover:text-[#00378C] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            {filteredDivisions.length}{" "}
            {filteredDivisions.length === 1 ? "division" : "divisions"} available
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

