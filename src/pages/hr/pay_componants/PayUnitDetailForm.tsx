// src/pages/hr/payunits/PayUnitDetailForm.tsx
//
// Pay Unit dependents — new UI: Freight SectionPanel with a DataTable
// (Add Row lives in the DataTable toolbar), icon-button row actions, and a
// Dialog row editor using shared Field wrappers.

import { Edit2, ListChecks, Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { FormikProps } from 'formik';
import { useState } from 'react';
import type { TPayUnitDetail, TPayUnitFormValues } from './AddPayUnitsForm';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import { useToast } from '../../../components/ui/AlertToast';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';
import { LookupField } from '../../../components/ui/LookupField';
import { Field, SectionPanel } from '../../../components/ui/Freightpanel';
import { useCodeOptions } from '../../../components/ui/Usecodeoptions';

function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ===================== EMPTY ROW FACTORY =====================
const createEmptyRow = (sort_order: number): TPayUnitDetail => ({
  id: newId(),
  pay_comp_id_depend: '',
  percent: 0,
  pay_comp_desc: '',
  sort_order,
  country_code: '',
  country_name: '',
  isEditMode: false
});

// ===================== TYPES =====================
type TProps = {
  formik: FormikProps<TPayUnitFormValues>;
  disabled?: boolean;
};

const dependentLookupColumns = [
  { field: 'value_code', header: 'Code' },
  { field: 'value_desc', header: 'Description' }
];

// ===================== MAIN COMPONENT =====================
const PayUnitDetailForm = ({ formik, disabled = false }: TProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const details = formik.values.detail;

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<TPayUnitDetail | null>(null);

  const dependentPayCompOptions = useCodeOptions('PAY_COMPONENT_DependentPayCompId');

  // ===================== ADD ROW =====================
  // The new row is only held in the dialog state; it is added to formik on OK,
  // so Cancel no longer leaves a blank row behind in the grid.
  const handleAddRow = () => {
    setEditRow(createEmptyRow(details.length + 1));
    setOpen(true);
  };

  // ===================== DELETE =====================
  const handleDeleteDetail = (id: string) => {
    const updated = details.filter((row) => row.id !== id).map((row, i) => ({ ...row, sort_order: i + 1 }));
    formik.setFieldValue('detail', updated);
  };

  // ===================== EDIT =====================
  const handleEdit = (row: TPayUnitDetail) => {
    const index = details.findIndex((d) => d.id === row.id);
    if (index === -1) return;
    setEditRow({
      ...details[index],
      pay_comp_id_depend: details[index].pay_comp_id_depend ?? '',
      percent: details[index].percent ?? 0,
      pay_comp_desc: details[index].pay_comp_desc ?? '',
      sort_order: details[index].sort_order ?? 0
    });
    setOpen(true);
  };

  // ===================== SAVE (dialog OK) =====================
  const handleSave = () => {
    if (!editRow) return;

    if (!editRow.pay_comp_id_depend) {
      toast.warning('Dependent Pay Comp ID is required');
      return;
    }
    if (editRow.percent < 0 || editRow.percent > 100) {
      toast.warning('Percent must be between 0 and 100');
      return;
    }

    const exists = details.some((d) => d.id === editRow.id);
    const updated = exists
      ? details.map((d) =>
          d.id === editRow.id
            ? {
                ...d,
                pay_comp_id_depend: editRow.pay_comp_id_depend,
                pay_comp_desc: editRow.pay_comp_desc,
                percent: editRow.percent,
                sort_order: editRow.sort_order,
                isEditMode: true
              }
            : d
        )
      : [...details, { ...editRow, isEditMode: true }];

    formik.setFieldValue('detail', updated);
    setOpen(false);
    setEditRow(null);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditRow(null);
  };

  // ===================== COLUMN DEFS =====================
  const columns: ColumnDef<TPayUnitDetail>[] = [
    {
      id: 'srno',
      header: 'No.',
      size: 50,
      cell: ({ row }) => <span className="text-xs">{row.index + 1}</span>
    },
    {
      accessorKey: 'pay_comp_id_depend',
      header: 'Dependent Pay Comp ID',
      size: 200,
      cell: ({ row }) => <span className="text-xs">{row.original.pay_comp_id_depend || '—'}</span>
    },
    {
      accessorKey: 'pay_comp_desc',
      header: 'Description',
      size: 260,
      cell: ({ row }) => <span className="text-xs">{row.original.pay_comp_desc || '—'}</span>
    },
    {
      accessorKey: 'percent',
      header: 'Percent (%)',
      size: 120,
      cell: ({ row }) => <span className="text-xs">{row.original.percent ?? '—'}</span>
    },
    {
      id: 'actions',
      header: 'Action',
      size: 80,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            title="Edit"
            disabled={disabled}
            onClick={() => handleEdit(row.original)}
            className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            title="Delete"
            disabled={disabled}
            onClick={() => handleDeleteDetail(row.original.id)}
            className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )
    }
  ];

  // Description shown in the lookup: prefer the stored one, fall back to the option list
  const selectedDesc =
    editRow?.pay_comp_desc ||
    dependentPayCompOptions.find((opt) => opt.value_code === editRow?.pay_comp_id_depend)?.value_desc ||
    '';

  // ===================== RENDER =====================
  return (
    <>
      <SectionPanel title="Pay Unit Dependents" icon={ListChecks}>
        <DataTable
          columns={columns}
          data={details}
          title={`${details.length} Row${details.length !== 1 ? 's' : ''}`}
          subtitle="Dependent Pay Components"
          emptyText="No dependent components added"
          height={280}
          density="grid"
          enablePagination={false}
          getRowId={(row) => row.id}
          toolbar={
            !disabled ? (
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                Add Row
              </button>
            ) : undefined
          }
        />
      </SectionPanel>

      {/* ===================== ROW EDITOR DIALOG ===================== */}
      <Dialog
        open={open}
        wide={false}
        title={editRow?.isEditMode ? 'Edit Row' : 'Add Row'}
        onClose={closeDialog}
        footer={
          <>
            <Button type="button" size="sm" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            {!disabled && (
              <Button type="button" size="sm" variant="default" onClick={handleSave}>
                OK
              </Button>
            )}
          </>
        }
      >
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          {/* Dependent Pay Component ID — searchable lookup */}
          <Field label="Dependent Pay Comp ID" required>
            <LookupField
              label=""
              placeholder="Search..."
              value={editRow?.pay_comp_id_depend || ''}
              displayValue={editRow?.pay_comp_id_depend ? `${editRow.pay_comp_id_depend} - ${selectedDesc}` : ''}
              columns={dependentLookupColumns}
              valueField="value_code"
              displayFields={['value_code', 'value_desc']}
              loadOptions={() =>
                getDynamicLookup({
                  parameter: 'PAY_COMPONENT_DependentPayCompId',
                  loginid: user?.loginid ?? '',
                  code1: user?.company_code ?? ''
                })
              }
              onChange={(val: string, row?: any) =>
                setEditRow((prev) =>
                  prev
                    ? {
                        ...prev,
                        pay_comp_id_depend: val,
                        pay_comp_desc: String(row?.VALUE_DESC ?? row?.value_desc ?? '')
                      }
                    : prev
                )
              }
              disabled={disabled}
            />
          </Field>

          {/* Percent */}
          <Field label="Percent (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="text-right"
              value={editRow?.percent ?? ''}
              disabled={disabled}
              onChange={(e) =>
                setEditRow((prev) => (prev ? { ...prev, percent: parseFloat(e.target.value) || 0 } : prev))
              }
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
};

export default PayUnitDetailForm;