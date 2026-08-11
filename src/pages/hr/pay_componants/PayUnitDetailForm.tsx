import { Edit2, Trash2, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { FormikProps } from 'formik';
import { useEffect, useState } from 'react';
import { TPayUnitDetail, TPayUnitFormValues } from './AddPayUnitsForm';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';
import { LookupField } from '../../../components/ui/LookupField';

// Lightweight id generator — replaces the missing 'uuid' package
function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ===================== CODE OPTION TYPE =====================
type TCodeOption = {
  value_code: string;
  value_desc: string;
};

// ===================== useCodeOptions HOOK =====================
const useCodeOptions = (parameter: string): TCodeOption[] => {
  const { user } = useAuth();
  const [options, setOptions] = useState<TCodeOption[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await getDynamicLookup({
          parameter,
          loginid: user?.loginid ?? '',
          code1: user?.company_code ?? ''
        });
        if (Array.isArray(response)) {
          setOptions(
            response.map((row: any) => ({
              value_code: row.VALUE_CODE ?? row.value_code ?? '',
              value_desc: row.VALUE_DESC ?? row.value_desc ?? ''
            }))
          );
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (user?.company_code) {
      fetchOptions();
    }
  }, [user?.company_code, parameter]);

  return options;
};

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
  const details = formik.values.detail;

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<TPayUnitDetail | null>(null);

  const dependentPayCompOptions = useCodeOptions('PAY_COMPONENT_DependentPayCompId');

  // ===================== ADD ROW =====================
  const handleAddRow = () => {
    const newRow = createEmptyRow(details.length + 1);
    const updatedDetails = [...details, newRow];
    formik.setFieldValue('detail', updatedDetails);
    setEditRow(newRow);
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

  // ===================== SAVE =====================
  const handleSave = () => {
    if (!editRow) return;
    const updated = details.map((d) =>
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
    );

    const exists = details.some((d) => d.id === editRow.id);
    if (!exists) {
      updated.push({ ...editRow, isEditMode: true });
    }

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
      accessorKey: 'percent',
      header: 'Percent (%)',
      size: 120,
      cell: ({ row }) => <span className="text-xs">{row.original.percent ?? '—'}</span>
    },
    {
      id: 'actions',
      header: 'Action',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            type="button"
            title="Edit"
            disabled={disabled}
            onClick={() => handleEdit(row.original)}
          >
            <Edit2 size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            title="Delete"
            disabled={disabled}
            className="text-destructive hover:text-destructive"
            onClick={() => handleDeleteDetail(row.original.id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )
    }
  ];

  // ===================== RENDER =====================
  return (
    <div className="col-span-12 mt-1">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Dependent Pay Components</h4>
        {!disabled && (
          <Button type="button" size="sm" variant="default" onClick={handleAddRow}>
            <Plus size={14} /> Add Row
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={details}
        title={`${details.length} Rows`}
        height={280}
        density="compact"
        enablePagination={false}
        getRowId={(row) => row.id}
      />

      {/* Footer */}
      <div className="mt-1 flex justify-end">
        <span className="text-xs text-muted-foreground">
          Total Rows: <strong>{details.length}</strong>
        </span>
      </div>

      {/* ===================== DIALOG ===================== */}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Dependent Pay Component ID — searchable lookup (replaces Autocomplete) */}
          <LookupField
            label="Dependent Pay Comp ID - Desc"
            compact
            placeholder="Search..."
            value={editRow?.pay_comp_id_depend || ''}
            displayValue={
              editRow?.pay_comp_id_depend
                ? `${editRow.pay_comp_id_depend} - ${
                    dependentPayCompOptions.find((opt) => opt.value_code === editRow.pay_comp_id_depend)?.value_desc || ''
                  }`
                : ''
            }
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

          {/* Percent */}
          <label className="field">
            <span>Percent (%)</span>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="text-right"
              value={editRow?.percent ?? ''}
              disabled={disabled}
              onChange={(e) => setEditRow((prev) => (prev ? { ...prev, percent: parseFloat(e.target.value) || 0 } : prev))}
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
};

export default PayUnitDetailForm;