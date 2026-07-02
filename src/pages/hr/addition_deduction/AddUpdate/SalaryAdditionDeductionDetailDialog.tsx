import { useEffect, useState } from 'react';
import { Dialog } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { LookupField } from '../../../../components/ui/LookupField';
import type { SalaryAdditionDeductionDetailRow } from './types';
import { useAuth } from '../../../../state/AuthContext';
import { getDynamicLookup } from '../../../../api/lookups';


type Props = {
  open: boolean;
  initialRow: SalaryAdditionDeductionDetailRow | null;
  onClose: () => void;
  onSave: (row: SalaryAdditionDeductionDetailRow) => void;
};

const emptyRow = (): SalaryAdditionDeductionDetailRow => ({
  srNo: '',
  employeeId: '',
  employee: '',
  payUnit: '',
  description: '',
  amount: '',
  effectiveFrom: '',
  cancel: 'No',
});

const SalaryAdditionDeductionDetailDialog = ({ open, initialRow, onClose, onSave }: Props) => {
  const { user } = useAuth();
  const [row, setRow] = useState<SalaryAdditionDeductionDetailRow>(initialRow ?? emptyRow());

  useEffect(() => {
    setRow(initialRow ?? emptyRow());
  }, [initialRow, open]);

  const loadEmployees = async () => {
    const response = await getDynamicLookup({
      parameter: 'HR_ADDITION_DEDUCTION_EMPLOYEE_DROP_DOWN',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });
    return Array.isArray(response) ? response : [];
  };

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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(row)}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Sr No</span>
          <Input
            type="number"
            value={String(row.srNo ?? '')}
            onChange={(e) => setRow((prev) => ({ ...prev, srNo: e.target.value }))}
          />
        </label>

        <LookupField
          label="Employee"
          value={row.employeeId}
          displayValue={row.employee}
          columns={[
            { field: 'employee_code', header: 'Employee Code' },
            { field: 'rpt_name', header: 'Employee Name' },
          ]}
          valueField="employee_code"
          displayFields={['rpt_name']}
          loadOptions={loadEmployees}
          onChange={(value, opt) =>
            setRow((prev) => ({
              ...prev,
              employeeId: String(opt?.employee_id ?? opt?.EMPLOYEE_ID ?? opt?.employee_code ?? opt?.EMPLOYEE_CODE ?? value),
              employee: String(opt?.rpt_name ?? opt?.RPT_NAME ?? opt?.employee_name ?? opt?.EMPLOYEE_NAME ?? ''),
            }))
          }
        />

        <LookupField
          label="Pay Unit"
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

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Description</span>
          <Input value={row.description} onChange={(e) => setRow((prev) => ({ ...prev, description: e.target.value }))} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Amount</span>
          <Input
            type="number"
            value={String(row.amount ?? '')}
            onChange={(e) => setRow((prev) => ({ ...prev, amount: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Effective From</span>
          <Input
            type="date"
            value={row.effectiveFrom}
            onChange={(e) => setRow((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Cancel</span>
          <Select value={row.cancel} onChange={(e) => setRow((prev) => ({ ...prev, cancel: e.target.value }))}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
        </label>
      </div>
    </Dialog>
  );
};

export default SalaryAdditionDeductionDetailDialog;