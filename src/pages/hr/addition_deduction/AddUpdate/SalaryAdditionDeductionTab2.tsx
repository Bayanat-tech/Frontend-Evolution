import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { LookupField } from '../../../../components/ui/LookupField';
import { DataTable } from '../../../../components/ui/DataTable';
import { getDynamicLookup } from '../../../../api/lookups';
import { useAuth } from '../../../../state/AuthContext';
import type { SalaryAdditionDeductionDetailRow } from './types';

type Props = {
  detailRows: SalaryAdditionDeductionDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<SalaryAdditionDeductionDetailRow[]>>;
};

const SalaryAdditionDeductionTab2 = ({ detailRows, setDetailRows }: Props) => {
  const { user } = useAuth();

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

  const updateRow = (rowKey: number | string, patch: Partial<SalaryAdditionDeductionDetailRow>) => {
    setDetailRows((prev) =>
      prev.map((row) => (String(row.srNo) === String(rowKey) ? { ...row, ...patch } : row)),
    );
  };

  const handleAddDetailRow = () => {
    const nextSrNo = detailRows.length > 0 ? Number(detailRows[detailRows.length - 1]?.srNo || 0) + 1 : 1;
    setDetailRows((prev) => [
      ...prev,
      {
        srNo: nextSrNo,
        employeeId: '',
        employee: '',
        payUnit: '',
        description: '',
        amount: '',
        effectiveFrom: '',
        cancel: 'No',
      },
    ]);
  };

  const handleRemoveDetailRow = (rowKey: number | string) => {
    setDetailRows((prev) => prev.filter((row) => String(row.srNo) !== String(rowKey)));
  };

  const columns = useMemo<ColumnDef<SalaryAdditionDeductionDetailRow>[]>(
    () => [
      { accessorKey: 'srNo', header: 'Sr No', size: 60 },
      {
        accessorKey: 'employee',
        header: 'Employee',
        size: 200,
        cell: ({ row }) => (
          <LookupField
            label='Employee'
            compact
            value={row.original.employeeId}
            displayValue={row.original.employee}
            columns={[
              { field: 'employee_code', header: 'Employee Code' },
              { field: 'rpt_name', header: 'Employee Name' },
            ]}
            valueField="employee_code"
            displayFields={['rpt_name']}
            loadOptions={loadEmployees}
            onChange={(value, opt) =>
              updateRow(row.original.srNo, {
                employeeId: String(
                  opt?.employee_id ?? opt?.EMPLOYEE_ID ?? opt?.employee_code ?? opt?.EMPLOYEE_CODE ?? value,
                ),
                employee: String(
                  opt?.rpt_name ?? opt?.RPT_NAME ?? opt?.employee_name ?? opt?.EMPLOYEE_NAME ?? '',
                ),
              })
            }
          />
        ),
      },
      {
        accessorKey: 'payUnit',
        header: 'Pay Unit',
        size: 180,
        cell: ({ row }) => (
          <LookupField
            label='Pay Unit'
            compact
            value={row.original.payUnit}
            columns={[
              { field: 'value_code', header: 'Value Code' },
              { field: 'value_desc', header: 'Description' },
            ]}
            valueField="value_code"
            displayFields={['value_code', 'value_desc']}
            loadOptions={loadPayUnits}
            onChange={(value) => updateRow(row.original.srNo, { payUnit: value })}
          />
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            value={row.original.description}
            onChange={(e) => updateRow(row.original.srNo, { description: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="number"
            value={String(row.original.amount ?? '')}
            onChange={(e) => updateRow(row.original.srNo, { amount: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'effectiveFrom',
        header: 'Effective From',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="date"
            value={row.original.effectiveFrom}
            onChange={(e) => updateRow(row.original.srNo, { effectiveFrom: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'cancel',
        header: 'Cancel',
        cell: ({ row }) => (
          <Select
            className="h-7 text-[11px] px-2"
            value={row.original.cancel}
            onChange={(e) => updateRow(row.original.srNo, { cancel: e.target.value })}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
        ),
      },
      {
        id: 'actions',
        header: 'Remove',
        cell: ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            title="Delete Row"
            onClick={() => handleRemoveDetailRow(row.original.srNo)}
          >
            <Trash2 size={13} />
          </Button>
        ),
        size: 60,
      },
    ],
    [user],
  );

  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleAddDetailRow}>
          <Plus size={13} /> Add
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={detailRows}
        emptyText="No lines added"
        height={300}
        density="compact"
        getRowId={(row) => String(row.srNo)}
      />
    </div>
  );
};

export default SalaryAdditionDeductionTab2;