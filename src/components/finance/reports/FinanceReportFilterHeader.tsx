import { ReportFilterHeader } from "../../reports/ReportFilterHeader";

export function FinanceReportFilterHeader(props: { onClear: () => void; label?: string; clearLabel?: string }) {
  return <ReportFilterHeader {...props} className="finance-report-filter-header" />;
}
