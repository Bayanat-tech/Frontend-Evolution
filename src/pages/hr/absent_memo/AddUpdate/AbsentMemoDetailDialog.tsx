import { useEffect, useState } from 'react';
import { Dialog } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { LookupField } from '../../../../components/ui/LookupField';
import type { AbsentMemoDetailRow } from './types';
import { getDynamicLookup } from '../../../../api/lookups';
import { useAuth } from '../../../../state/AuthContext';

type Props = {
  open: boolean;
  initialRow: AbsentMemoDetailRow | null;
  onClose: () => void;
  onSave: (row: AbsentMemoDetailRow) => void;
};

const emptyRow = (): AbsentMemoDetailRow => ({
  srNo: '',
  payUnit: '',
  description: '',
  effectiveFrom: '',
  absentFromDate: '',
  absentToDate: '',
  noOfDays: '',
  amount: '',
  refLeaveDocNo: '',
  cancel: 'No',
});

const inputClass = 'h-7 text-[11px] px-2';
const labelClass = 'text-[10px] font-medium text-muted-foreground';

const AbsentMemoDetailDialog = ({ open, initialRow, onClose, onSave }: Props) => {
  const { user } = useAuth();
  const [row, setRow] = useState<AbsentMemoDetailRow>(initialRow ?? emptyRow());

  useEffect(() => {
    setRow(initialRow ?? emptyRow());
  }, [initialRow, open]);

  const loadPayUnits = async () => {
    const response = await getDynamicLookup({
      parameter: 'PAY_COMPONENT_DependentPayCompId',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });
    return Array.isArray(response) ? response : [];
  };

  return (
    <Dialog
      open={open}
      title={initialRow ? 'Edit Line' : 'Add Line'}
      compact
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(row)}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Sr No</span>
          <Input
            className={inputClass}
            type="number"
            value={String(row.srNo ?? '')}
            onChange={(e) => setRow((prev) => ({ ...prev, srNo: e.target.value }))}
          />
        </label>

        <LookupField
          label="Pay Unit"
          compact
          value={row.payUnit}
          columns={[
            { field: 'value_code', header: 'Value Code' },
            { field: 'value_desc', header: 'Description' },
          ]}
          valueField="value_code"
          displayFields={['value_code', 'value_desc']}
          loadOptions={loadPayUnits}
          onChange={(value) => setRow((prev) => ({ ...prev, payUnit: value }))}
        />

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Description</span>
          <Input className={inputClass} value={row.description} onChange={(e) => setRow((prev) => ({ ...prev, description: e.target.value }))} />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Effective From</span>
          <Input
            className={inputClass}
            type="date"
            value={row.effectiveFrom}
            onChange={(e) => setRow((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Absent From Date</span>
          <Input
            className={inputClass}
            type="date"
            value={row.absentFromDate}
            onChange={(e) => setRow((prev) => ({ ...prev, absentFromDate: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Absent To Date</span>
          <Input
            className={inputClass}
            type="date"
            value={row.absentToDate}
            onChange={(e) => setRow((prev) => ({ ...prev, absentToDate: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>No Of Days</span>
          <Input
            className={inputClass}
            type="number"
            value={String(row.noOfDays ?? '')}
            onChange={(e) => setRow((prev) => ({ ...prev, noOfDays: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Amount</span>
          <Input
            className={inputClass}
            type="number"
            value={String(row.amount ?? '')}
            onChange={(e) => setRow((prev) => ({ ...prev, amount: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Ref Leave Doc No</span>
          <Input className={inputClass} value={row.refLeaveDocNo} onChange={(e) => setRow((prev) => ({ ...prev, refLeaveDocNo: e.target.value }))} />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Cancel</span>
          <Select className={inputClass} value={row.cancel} onChange={(e) => setRow((prev) => ({ ...prev, cancel: e.target.value }))}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
        </label>
      </div>
    </Dialog>
  );
};

export default AbsentMemoDetailDialog;