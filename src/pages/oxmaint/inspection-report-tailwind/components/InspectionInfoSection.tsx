import { FormikProps } from 'formik';
import { FaSearch } from 'react-icons/fa';
import { Button, Paper, TextField } from '../../../../components/mms_ui';

export type InspectionInfoFormValues = {
  report_no: string;
  asset_inventory_code: string;
  asset_number: string;
  location: string;
  asset_name: string;
  inspector_name: string;
  inventory_no: string;
  inspection_form_code: string;
  inspection_form: string;
  running_hours: string;
  running_hours_unit: string;
};

type InspectionInfoSectionProps = {
  formik: FormikProps<InspectionInfoFormValues>;
  openAssetDialog: () => void;
  openInspectionDialog: () => void;
  runningHoursUnitOptions: readonly string[];
  canProceedToNext: boolean;
  isLoadingStructure: boolean;
  onNext: () => void;
};

const FieldRow = ({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[128px_1fr] items-center gap-2 max-[1200px]:grid-cols-1 max-[1200px]:gap-1">
    <p className="text-xs font-medium text-[#5a728f] text-right leading-tight max-[1200px]:text-left">
      {required && <span className="text-[#d83434] font-bold mr-px">*</span>}
      {label}
    </p>
    {children}
  </div>
);

const InspectionInfoSection = ({
  formik,
  openAssetDialog,
  openInspectionDialog,
  runningHoursUnitOptions,
  canProceedToNext,
  isLoadingStructure,
  onNext
}: InspectionInfoSectionProps) => {
  return (
    <>
      <p className="text-base font-extrabold text-[#243447] mb-2.5">1. Inspection Info</p>

      <Paper className="rounded-xl px-3 pt-3 pb-2.5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_22px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 items-start max-[1200px]:grid-cols-1">
          <FieldRow label="Report #:" required>
            <TextField
              size="small"
              fullWidth
              name="report_no"
              value={formik.values.report_no}
              onChange={formik.handleChange}
              readOnly
            />
          </FieldRow>

          <FieldRow label="Asset Number:" required>
            <TextField
              size="small"
              fullWidth
              name="asset_number"
              value={formik.values.asset_number}
              onChange={formik.handleChange}
              onClick={openAssetDialog}
              placeholder="Select Asset from inventory list"
              readOnly
              endAdornment={<FaSearch size={13} />}
              inputClassName="cursor-pointer"
            />
          </FieldRow>

          <FieldRow label="Location:" required>
            <TextField
              size="small"
              fullWidth
              name="location"
              value={formik.values.location}
              onChange={formik.handleChange}
            />
          </FieldRow>

          <FieldRow label="Asset Name:" required>
            <TextField size="small" fullWidth name="asset_name" value={formik.values.asset_name} readOnly />
          </FieldRow>

          <FieldRow label="Inspector Name:" required>
            <TextField
              size="small"
              fullWidth
              name="inspector_name"
              value={formik.values.inspector_name}
              onChange={formik.handleChange}
            />
          </FieldRow>

          <FieldRow label="Inventory#:">
            <TextField size="small" fullWidth name="inventory_no" value={formik.values.inventory_no} readOnly />
          </FieldRow>

          <FieldRow label="Select Inspection Form:" required>
            <TextField
              size="small"
              fullWidth
              name="inspection_form"
              value={formik.values.inspection_form}
              onChange={formik.handleChange}
              onClick={openInspectionDialog}
              placeholder="Select inspection form from list"
              readOnly
              endAdornment={<FaSearch size={13} />}
              inputClassName="cursor-pointer"
            />
          </FieldRow>

          <div className="grid grid-cols-[128px_1fr] items-center gap-2 col-start-2 max-[1200px]:col-start-auto max-[1200px]:grid-cols-1 max-[1200px]:gap-1">
            <p className="text-xs font-medium text-[#5a728f] text-right leading-tight max-[1200px]:text-left">
              <span className="text-[#d83434] font-bold mr-px">*</span>Running Hours:
            </p>
            <div className="grid grid-cols-[1fr_120px] gap-2 items-center max-[768px]:grid-cols-[1fr_96px]">
              <TextField
                size="small"
                fullWidth
                name="running_hours"
                value={formik.values.running_hours}
                onChange={formik.handleChange}
              />
              <TextField
                size="small"
                select
                name="running_hours_unit"
                value={formik.values.running_hours_unit}
                onChange={formik.handleChange}
                disabled
                inputClassName="text-[#9ca3af]"
              >
                {runningHoursUnitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </TextField>
            </div>
          </div>
        </div>
      </Paper>

      <div className="flex justify-start mt-3">
        <Button
          size="small"
          disabled={!canProceedToNext || isLoadingStructure}
          onClick={onNext}
          className="min-w-[76px] rounded-lg text-white bg-gradient-to-b from-[#1172d7] to-[#0a6ed1] shadow-[0_6px_14px_rgba(10,110,209,0.25)]"
        >
          {isLoadingStructure ? 'Loading...' : 'Next'}
        </Button>
      </div>
    </>
  );
};

export default InspectionInfoSection;
