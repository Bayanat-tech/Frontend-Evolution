import { ReportPreviewDialog, type ReportPreviewDialogProps } from "../../reports/ReportPreviewDialog";

export function FinanceReportPreview(props: ReportPreviewDialogProps) {
  return <ReportPreviewDialog {...props} className={`finance-report-preview ${props.className || ""}`.trim()} />;
}
