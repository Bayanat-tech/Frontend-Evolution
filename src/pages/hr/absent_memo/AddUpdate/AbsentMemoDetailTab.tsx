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
import type { AbsentMemoDetailRow } from './types';

type Props = {
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

const AbsentMemoDetailTab = ({ detailRows, setDetailRows }: Props) => {
  const { user } = useAuth();

  const loadPayUnits = async () => {
    const response = await getDynamicLookup({
      parameter: 'PAY_COMPONENT_DependentPayCompId',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });
    return Array.isArray(response) ? response : [];
  };

  const updateRow = (rowKey: number | string, patch: Partial<AbsentMemoDetailRow>) => {
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
        payUnit: '',
        description: '',
        effectiveFrom: '',
        absentFromDate: '',
        absentToDate: '',
        noOfDays: '',
        amount: '',
        refLeaveDocNo: '',
        cancel: 'No',
      },
    ]);
  };

  const handleRemoveDetailRow = (rowKey: number | string) => {
    setDetailRows((prev) => prev.filter((row) => String(row.srNo) !== String(rowKey)));
  };

  const columns = useMemo<ColumnDef<AbsentMemoDetailRow>[]>(
    () => [
      { accessorKey: 'srNo', header: 'SNo', size: 55 },
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
        accessorKey: 'absentFromDate',
        header: 'From Date',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="date"
            value={row.original.absentFromDate}
            onChange={(e) => updateRow(row.original.srNo, { absentFromDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'absentToDate',
        header: 'To Date',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="date"
            value={row.original.absentToDate}
            onChange={(e) => updateRow(row.original.srNo, { absentToDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'noOfDays',
        header: 'No Of Days',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="number"
            value={String(row.original.noOfDays ?? '')}
            onChange={(e) => updateRow(row.original.srNo, { noOfDays: e.target.value })}
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
        accessorKey: 'refLeaveDocNo',
        header: 'Ref Leave Doc No',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            value={row.original.refLeaveDocNo}
            onChange={(e) => updateRow(row.original.srNo, { refLeaveDocNo: e.target.value })}
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
          <Plus size={13} /> Add Line
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={detailRows}
        emptyText="No lines added"
        height={260}
        density="compact"
        getRowId={(row) => String(row.srNo)}
      />
    </div>
  );
};

export default AbsentMemoDetailTab;