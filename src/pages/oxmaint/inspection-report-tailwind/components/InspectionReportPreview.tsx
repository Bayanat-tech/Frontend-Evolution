import { FaPrint, FaTimes } from 'react-icons/fa';
import { Button, Dialog, DialogContent, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '../../../../components/mms_ui';
import { InspectionSummaryValues } from './InspectionSummary';

export type InspectionReportPreviewItem = {
  headerSectionTitle: string;
  underSectionTitle: string;
  typeStatus: string;
  value: string | number | null;
  note?: string;
  upload?: string;
};

export type InspectionReportPreviewData = {
  reportNo: string;
  date: string;
  time?: string;
  location: string;
  assetNumber: string;
  assetName: string;
  inspector: string;
  inspectionForm: string;
  additionalNote?: string;
  summary?: Partial<InspectionSummaryValues>;
  detailItems?: InspectionReportPreviewItem[];
};

type InspectionReportPreviewProps = {
  open: boolean;
  onClose: () => void;
  report: InspectionReportPreviewData;
  onPrint?: () => void;
};

const fieldValue = (value?: string | number | null) => (value === null || value === undefined || String(value).trim() === '' ? '-' : String(value));

const chipText = (value?: string) => fieldValue(value);

const MetaCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Paper className="border border-[#e5ecf5] rounded-2xl p-4">
    <p className="text-[#62748a] text-xs font-bold uppercase tracking-wide">{label}</p>
    <p className="mt-2 text-[#243447] text-[15px] font-extrabold">{value}</p>
  </Paper>
);

const KvRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-3 text-[13px] text-[#516b89]">
    <span>{label}</span>
    <strong className="text-[#243447] text-right font-extrabold">{value}</strong>
  </div>
);

const InspectionReportPreview = ({ open, onClose, report, onPrint }: InspectionReportPreviewProps) => {
  const detailItems = report.detailItems ?? [];

  return (
    <Dialog open={open} onClose={onClose} fullScreen paperClassName="bg-[#eef3f8]">
      <DialogContent className="p-0 bg-[#eef3f8]">
        <div className="min-h-screen p-6 bg-gradient-to-b from-[#eef3f8] to-[#f7f9fc] max-[768px]:p-3">
          <Paper className="max-w-[1280px] mx-auto p-6 rounded-[18px] shadow-[0_18px_50px_rgba(15,23,42,0.08)] max-[768px]:p-4">
            <div className="flex justify-between items-start gap-4 mb-4 max-[768px]:flex-col">
              <div>
                <p className="m-0 mb-1 text-[#0a6ed1] text-xs font-bold uppercase tracking-[0.08em]">Generated Report</p>
                <p className="m-0 text-[#243447] text-[28px] font-extrabold max-[768px]:text-[22px]">Inspection Report</p>
                <p className="mt-1.5 mb-0 text-[#62748a] text-[13px]">
                  {report.inspectionForm || 'Inspection Form'} · {report.reportNo || '-'}
                </p>
              </div>

              <div className="flex gap-2">
                {onPrint && (
                  <Button
                    startIcon={<FaPrint size={13} />}
                    onClick={onPrint}
                    className="normal-case rounded-[10px] bg-[#0a6ed1] text-white"
                  >
                    Print
                  </Button>
                )}
                <Button
                  startIcon={<FaTimes size={13} />}
                  onClick={onClose}
                  className="normal-case rounded-[10px] border border-[#c8d3df] text-[#243447] bg-white"
                >
                  Close
                </Button>
              </div>
            </div>

            <hr className="my-[18px] border-[#e5ecf5]" />

            <div className="grid grid-cols-4 gap-4 mb-4 max-[1280px]:grid-cols-2 max-[768px]:grid-cols-1">
              <MetaCard label="Report No." value={fieldValue(report.reportNo)} />
              <MetaCard
                label="Date / Time"
                value={
                  <>
                    {fieldValue(report.date)} {report.time ? `• ${report.time}` : ''}
                  </>
                }
              />
              <MetaCard label="Inspector" value={fieldValue(report.inspector)} />
              <MetaCard label="Location" value={fieldValue(report.location)} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 max-[768px]:grid-cols-1">
              <Paper className="border border-[#e5ecf5] rounded-2xl p-4">
                <p className="text-[#243447] text-xs font-bold uppercase tracking-wide mb-3">Asset Information</p>
                <div className="grid gap-2.5">
                  <KvRow label="Asset Number" value={fieldValue(report.assetNumber)} />
                  <KvRow label="Asset Name" value={fieldValue(report.assetName)} />
                  <KvRow label="Inspection Form" value={fieldValue(report.inspectionForm)} />
                </div>
              </Paper>

              <Paper className="border border-[#e5ecf5] rounded-2xl p-4">
                <p className="text-[#243447] text-xs font-bold uppercase tracking-wide mb-3">Inspection Summary</p>
                <div className="grid gap-2.5">
                  <KvRow label="Overall Condition" value={chipText(report.summary?.overall_condition)} />
                  <KvRow label="Asset Safe to Use" value={chipText(report.summary?.asset_safe_to_use)} />
                  <KvRow label="Maintenance Required" value={chipText(report.summary?.maintenance_required)} />
                  <KvRow label="Asset Status" value={chipText(report.summary?.asset_status)} />
                  <KvRow label="Maintenance Priority" value={chipText(report.summary?.maintenance_priority)} />
                </div>
              </Paper>
            </div>

            <Paper className="border border-[#e5ecf5] rounded-2xl p-4 mb-4">
              <p className="text-[#243447] text-xs font-bold uppercase tracking-wide mb-3">Additional Note</p>
              <p className="text-[#243447] text-sm leading-[1.7]">{fieldValue(report.additionalNote)}</p>
            </Paper>

            <Paper className="border border-[#e5ecf5] rounded-2xl p-4">
              <p className="text-[#243447] text-xs font-bold uppercase tracking-wide mb-3">Inspection Details</p>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell head className="border-[#e5ecf5] text-[13px]">Section</TableCell>
                      <TableCell head className="border-[#e5ecf5] text-[13px]">Item</TableCell>
                      <TableCell head className="border-[#e5ecf5] text-[13px]">Type</TableCell>
                      <TableCell head className="border-[#e5ecf5] text-[13px]">Value</TableCell>
                      <TableCell head className="border-[#e5ecf5] text-[13px]">Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailItems.length > 0 ? (
                      detailItems.map((item, index) => (
                        <TableRow key={`${item.underSectionTitle}-${index}`}>
                          <TableCell className="border-[#e5ecf5] text-[13px]">{fieldValue(item.headerSectionTitle)}</TableCell>
                          <TableCell className="border-[#e5ecf5] text-[13px]">{fieldValue(item.underSectionTitle)}</TableCell>
                          <TableCell className="border-[#e5ecf5] text-[13px]">{fieldValue(item.typeStatus)}</TableCell>
                          <TableCell className="border-[#e5ecf5] text-[13px]">{fieldValue(item.value)}</TableCell>
                          <TableCell className="border-[#e5ecf5] text-[13px]">{fieldValue(item.note)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center" className="border-[#e5ecf5] text-[13px]">
                          No inspection items available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Paper>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionReportPreview;
