import { Columns3, List } from "lucide-react";

interface ColumnModeToggleProps {
  showAllColumns: boolean;
  onChange: (showAll: boolean) => void;
  compactLabel?: string;
  allColumnsLabel?: string;
  className?: string;
}

export function ColumnModeToggle({
  showAllColumns,
  onChange,
  compactLabel = "Compact View",
  allColumnsLabel = "All Columns",
  className = "",
}: ColumnModeToggleProps) {
  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-lg bg-slate-200/90 border border-slate-300 text-xs shadow-inner select-none ${className}`}
      role="group"
      aria-label="Table view mode"
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
          !showAllColumns
            ? "bg-slate-900 text-white shadow-xs font-bold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/60"
        }`}
        title="Compact View (fits screen without horizontal scroll)"
      >
        <List size={13} className={!showAllColumns ? "text-white" : "text-slate-500"} />
        <span>{compactLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
          showAllColumns
            ? "bg-slate-900 text-white shadow-xs font-bold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/60"
        }`}
        title="All Columns (view all fields including Tax & Currency)"
      >
        <Columns3 size={13} className={showAllColumns ? "text-white" : "text-slate-500"} />
        <span>{allColumnsLabel}</span>
      </button>
    </div>
  );
}

