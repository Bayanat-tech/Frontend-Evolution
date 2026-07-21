import { useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, TextField } from '../../../../components/mms_ui';
import { InspectionItemResponse } from '../types/AddInspectionReportPage.types';
import { InspectionReportStructureRow } from '../types/inspectionReportApi.types';
import { useAuth } from '../../../../state/AuthContext';
import { executeDynamicMutationColumn90 } from '../../../../api/lookups';

const OVERALL_CONDITION_OPTIONS = [
  'Excellent Condition',
  'Good Condition',
  'A little wear',
  'Minor Repair required',
  'Major Repair required',
  'Cannot determine',
  'Not Applicable'
] as const;
const ASSET_STATUS_OPTIONS = ['Available', 'In Maintenance', 'Maintenance Required', 'BreakDwon', 'Discontinue'] as const;
const MAINTENANCE_PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Emergency'] as const;

export type InspectionSummaryValues = {
  overall_condition: string;
  asset_safe_to_use: 'Yes' | 'No';
  maintenance_required: 'Yes' | 'No';
  asset_status: string;
  maintenance_priority: string;
  additional_note: string;
};

type InspectionSummarySectionProps = {
  inspectionSummary: InspectionSummaryValues;
  onChange: (value: InspectionSummaryValues) => void;
  onSubmit: () => void;
  inspectionInfo?: {
    location: string;
    asset_number: string;
    asset_name: string;
    inspector_name: string;
    inventory_no: string;
    running_hours: string | number;
    running_hours_unit: string;
    inspection_form_code: string;
  };
  inspectionStructure?: InspectionReportStructureRow[];
  inspectionResponses?: Record<string, InspectionItemResponse>;
  isSubmitting?: boolean;
};

const getDefaultInspectionValueByType = (type: string): string | number | null => {
  const key = (type || '').trim().toLowerCase();

  if (key === 'good-repair-replace-na') return 'NA';
  if (key === 'yes-no-na') return 'NA';
  if (key === 'pass-fail-na') return 'NA';
  if (key === 'ok-faulty-na') return 'NA';
  if (key === 'text field') return '';
  if (key === 'number') return null;

  return null;
};

const SummaryRow = ({
  label,
  required,
  children,
  alignStart
}: {
  label: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  alignStart?: boolean;
}) => (
  <div
    className={`grid grid-cols-[240px_1fr] gap-3 max-[1200px]:grid-cols-[190px_1fr] max-[768px]:grid-cols-1 max-[768px]:gap-1.5 ${
      alignStart ? 'items-start' : 'items-center'
    }`}
  >
    <p className="text-sm font-medium text-[#5a728f] text-right leading-tight max-[1200px]:text-[13px] max-[768px]:text-left">
      {required && <span className="text-[#d83434] font-bold mr-px">*</span>}
      {label}
    </p>
    {children}
  </div>
);

const CheckOption = ({
  option,
  selected,
  activeColor,
  onClick
}: {
  option: 'Yes' | 'No';
  selected: boolean;
  activeColor: 'yes' | 'no';
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-2.5 normal-case">
    <span
      className={`w-6 h-6 rounded-[7px] border-2 flex items-center justify-center bg-white ${
        activeColor === 'yes' ? 'border-[#53a96a]' : 'border-[#f04444]'
      }`}
    >
      {selected && (
        <FaCheck size={13} className={activeColor === 'yes' ? 'text-[#53a96a]' : 'text-[#f04444]'} />
      )}
    </span>
    <span className="text-sm text-[#243447] max-[1200px]:text-[13px]">{option}</span>
  </button>
);

const InspectionSummarySection = ({
  inspectionSummary,
  onChange,
  onSubmit,
  inspectionInfo,
  inspectionStructure = [],
  inspectionResponses = {},
  isSubmitting: isSubmittingProp = false
}: InspectionSummarySectionProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const handleSubmitAPI = async () => {
    try {
      setIsSubmitting(true);

      // Build JSON array from the full inspection structure so unchanged rows are also submitted
      const structureItems = inspectionStructure.filter((row) => String(row.under_section_id ?? '').trim().length > 0);
      const uniqueInspectionItems = Array.from(
        new Map(structureItems.map((row) => [String(row.under_section_id), row])).values()
      );

      const inspectionFormId = inspectionInfo?.inspection_form_code
        ? Number(inspectionInfo.inspection_form_code.split('-')[0])
        : 0;

      const detailRows = uniqueInspectionItems.map((row) => {
        const key = String(row.under_section_id);
        const existingResponse = inspectionResponses[key];

        return {
          inspection_form_id: inspectionFormId,
          header_section_id: Number(row.header_section_id || 0),
          under_section_id: Number(row.under_section_id || 0),
          type_status: row.type,
          inspection_note: existingResponse ? existingResponse.note : '',
          upload: existingResponse ? existingResponse.upload_url : '',
          type_value: existingResponse ? String(existingResponse.value ?? '') : String(getDefaultInspectionValueByType(row.type) ?? '')
        };
      });

      const apiParams = {
        parameter: 'OX_IN_UPD_INSPECTION_REPORT',
        loginid: user?.loginid ?? '',

        // Inspection Info
        val1s1: inspectionInfo?.location ?? '',
        val1s2: inspectionInfo?.asset_number ?? '',
        val1s3: inspectionInfo?.asset_name ?? '',
        val1s4: inspectionInfo?.inventory_no ?? '',
        val1s5: inspectionInfo?.running_hours_unit ?? '',

        // Inspection Summary
        val1s6: inspectionSummary.overall_condition,
        val1s7: inspectionSummary.asset_safe_to_use,
        val1s8: inspectionSummary.maintenance_required,
        val1s9: inspectionSummary.asset_status,
        val1s10: inspectionSummary.additional_note,
        val1s11: inspectionInfo?.inspector_name ?? '',

        // Numbers
        val1n1: inspectionInfo?.running_hours ? Number(inspectionInfo.running_hours) : 0,
        val1n2: inspectionFormId,

        // JSON detail rows
        val1s90: JSON.stringify(detailRows)
      };

      console.log('Submitting inspection report with params:', apiParams);

      const response = await executeDynamicMutationColumn90(apiParams);

      if (response.success) {
        console.log('Inspection report created successfully:', response.message);
        setSuccessOpen(true);
      } else {
        console.error('Failed to create inspection report:', response.message);
      }
    } catch (error) {
      console.error('Error submitting inspection report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <p className="text-base font-extrabold text-[#243447] mb-2.5 mt-6">3. Inspection Summary</p>
      <Paper className="rounded-xl px-[22px] pt-[18px] pb-4 shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_22px_rgba(15,23,42,0.04)]">
        <div className="grid gap-2.5">
          <SummaryRow label="Overall Condition:" required>
            <TextField
              select
              size="small"
              fullWidth
              value={inspectionSummary.overall_condition}
              onChange={(event) => onChange({ ...inspectionSummary, overall_condition: event.target.value })}
            >
              {OVERALL_CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </TextField>
          </SummaryRow>

          <SummaryRow label="Asset Safe to Use:" required>
            <div className="flex items-center gap-5">
              {(['Yes', 'No'] as const).map((option) => (
                <CheckOption
                  key={option}
                  option={option}
                  selected={inspectionSummary.asset_safe_to_use === option}
                  activeColor={option === 'Yes' ? 'yes' : 'no'}
                  onClick={() => onChange({ ...inspectionSummary, asset_safe_to_use: option })}
                />
              ))}
            </div>
          </SummaryRow>

          <SummaryRow
            label={
              <>
                Maintenance
                <br />
                Required:
              </>
            }
            required
          >
            <div className="flex items-center gap-5">
              {(['Yes', 'No'] as const).map((option) => (
                <CheckOption
                  key={option}
                  option={option}
                  selected={inspectionSummary.maintenance_required === option}
                  activeColor={option === 'Yes' ? 'no' : 'yes'}
                  onClick={() =>
                    onChange({
                      ...inspectionSummary,
                      maintenance_required: option,
                      asset_status: option === 'Yes' ? 'Maintenance Required' : inspectionSummary.asset_status
                    })
                  }
                />
              ))}
            </div>
          </SummaryRow>

          <SummaryRow label="Asset Status:" required>
            <TextField
              select
              size="small"
              fullWidth
              value={inspectionSummary.asset_status}
              onChange={(event) => onChange({ ...inspectionSummary, asset_status: event.target.value })}
            >
              {ASSET_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </TextField>
          </SummaryRow>

          <SummaryRow label="Maintenance Priority:" required>
            <TextField
              select
              size="small"
              fullWidth
              value={inspectionSummary.maintenance_priority}
              onChange={(event) => onChange({ ...inspectionSummary, maintenance_priority: event.target.value })}
            >
              {MAINTENANCE_PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </TextField>
          </SummaryRow>

          <SummaryRow label="Additional Note:" alignStart>
            <TextField
              multiline
              minRows={5}
              fullWidth
              value={inspectionSummary.additional_note}
              onChange={(event) => onChange({ ...inspectionSummary, additional_note: event.target.value })}
            />
          </SummaryRow>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSubmitAPI}
            disabled={isSubmitting || isSubmittingProp}
            className="min-w-[76px] rounded-lg text-white bg-gradient-to-b from-[#1172d7] to-[#0a6ed1] shadow-[0_6px_14px_rgba(10,110,209,0.25)]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </Paper>

      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Success</DialogTitle>
        <DialogContent>
          <p className="text-sm text-[#243447]">Report Generate sucessfully</p>
        </DialogContent>
        <DialogActions>
          <Button
            className="bg-[#0a6ed1] text-white"
            onClick={() => {
              setSuccessOpen(false);
              onSubmit();
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InspectionSummarySection;
