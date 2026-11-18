import { ReportFilterHeader } from "../../reports/ReportFilterHeader";

export function PurchaseSalesReportFilterHeader(props: { onClear: () => void; label?: string; clearLabel?: string }) {
  return <ReportFilterHeader {...props} className="purchase-sales-report-filter-header" />;
}
