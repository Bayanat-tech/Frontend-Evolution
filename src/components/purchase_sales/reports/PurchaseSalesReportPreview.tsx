import { ReportPreviewDialog, type ReportPreviewDialogProps } from "../../reports/ReportPreviewDialog";

export function PurchaseSalesReportPreview(props: ReportPreviewDialogProps) {
  return <ReportPreviewDialog {...props} className={`purchase-sales-report-preview ${props.className || ""}`.trim()} />;
}
