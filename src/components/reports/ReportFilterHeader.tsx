import { Filter, RefreshCw } from "lucide-react";

export function ReportFilterHeader({
  onClear,
  label = "Report Filters",
  clearLabel = "Clear All",
}: {
  onClear: () => void;
  label?: string;
  clearLabel?: string;
}) {
  return (
    <div className="freight-report-filter-heading">
      <div className="freight-report-filter-title">
        <span aria-hidden="true"><Filter size={15} /></span>
        <span>{label}</span>
      </div>
      <button type="button" onClick={onClear}>
        <RefreshCw size={14} /> {clearLabel}
      </button>
    </div>
  );
}
