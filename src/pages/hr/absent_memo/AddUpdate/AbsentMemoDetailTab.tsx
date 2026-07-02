import { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../../components/ui/Button';
import { DataTable } from '../../../../components/ui/DataTable';
import AbsentMemoDetailDialog from './AbsentMemoDetailDialog';
import type { AbsentMemoDetailRow } from './types';

type Props = {
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

const AbsentMemoDetailTab = ({ detailRows, setDetailRows }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AbsentMemoDetailRow | null>(null);

  const openAddRow = () => {
    setEditingRow(null);
    setDialogOpen(true);
  };

  const openEditRow = (row: AbsentMemoDetailRow) => {
    setEditingRow(row);
    setDialogOpen(true);
  };

  const removeRow = (srNo: number | string) => {
    setDetailRows((prev) => prev.filter((row) => String(row.srNo) !== String(srNo)));
  };

  const handleDialogSave = (row: AbsentMemoDetailRow) => {
    setDetailRows((prev) => {
      const exists = editingRow && prev.some((r) => String(r.srNo) === String(editingRow.srNo));
      if (exists) {
        return prev.map((r) => (String(r.srNo) === String(editingRow!.srNo) ? row : r));
      }
      const nextSrNo = row.srNo || (prev.length > 0 ? Number(prev[prev.length - 1]?.srNo || 0) + 1 : 1);
      return [...prev, { ...row, srNo: nextSrNo }];
    });
    setDialogOpen(false);
  };

  const columns = useMemo<ColumnDef<AbsentMemoDetailRow>[]>(
    () => [
      { accessorKey: 'srNo', header: 'SNo', size: 60 },
      { accessorKey: 'payUnit', header: 'Pay Unit' },
      { accessorKey: 'description', header: 'Description' },
      { accessorKey: 'effectiveFrom', header: 'Effective From' },
      { accessorKey: 'absentFromDate', header: 'From Date' },
      { accessorKey: 'absentToDate', header: 'To Date' },
      { accessorKey: 'noOfDays', header: 'No Of Days' },
      { accessorKey: 'amount', header: 'Amount' },
      { accessorKey: 'refLeaveDocNo', header: 'Ref Leave Doc No' },
      { accessorKey: 'cancel', header: 'Cancel' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEditRow(row.original)} title="Edit">
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => removeRow(row.original.srNo)} title="Remove">
              <Trash2 size={14} />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    [],
  );

  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAddRow}>
          <Plus size={14} /> Add Line
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

      <AbsentMemoDetailDialog
        open={dialogOpen}
        initialRow={editingRow}
        onClose={() => setDialogOpen(false)}
        onSave={handleDialogSave}
      />
    </div>
  );
};

export default AbsentMemoDetailTab;