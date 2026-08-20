import { Edit2, Trash2, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { FormikProps } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { TPayUnitDetail, TPayUnitFormValues, TCountryOption } from './AddPayUnitDependentForm';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup, executeDynamicDelete } from '../../../api/lookups';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';
import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';
function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}


function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' }
];

// ===================== COUNTRY OPTIONS HOOK =====================
const useCountryOptions = () => {
  const { user } = useAuth();
  const [options, setOptions] = useState<TCountryOption[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: 'PAY_COMPONENT_PAYUNIT_CountryList',
          code1: user?.company_code ?? '',
          code2: user?.loginid ?? ''
        });
        const rows = (res ?? []) as unknown as Record<string, unknown>[];
        setOptions(
          rows.map(uppercaseKeys).map(
            (row: any): TCountryOption => ({
              country_code: row.COUNTRY_CODE ?? '',
              country_name: row.COUNTRY_NAME ?? '',
              nationality: row.NATIONALITY ?? ''
            })
          )
        );
      } catch (e) {
        console.error('Country options error:', e);
      }
    };
    if (user?.company_code) fetchOptions();
  }, [user?.company_code]);

  return options;
};

// ===================== EMPTY ROW FACTORY =====================
const createEmptyRow = (): TPayUnitDetail => ({
  id: newId(),
  pay_comp_id_depend: '',
  percent: 0,
  pay_comp_desc: '',
  remarks: '',
  country_code: '',
  country_name: '',
  status: 'A',
  limit: 0,
  age: 0,
  amount: 0,
  nationality: '',
  isEditMode: false
});

// ===================== TYPES =====================
type TProps = {
  formik: FormikProps<TPayUnitFormValues>;
  disabled?: boolean;
};

// ===================== MAIN COMPONENT =====================
const PayUnitDependDetailForm = ({ formik, disabled = false }: TProps) => {
  const details = formik.values.detail || [];
  const countryOptions = useCountryOptions();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<TPayUnitDetail | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ===================== ADD ROW =====================
  const handleAddRow = () => {
    setEditRow(createEmptyRow());
    setOpen(true);
  };

  // ===================== DELETE =====================
  const handleDeleteDetail = async (id: string, nationality: string) => {
    if (!window.confirm('Are you sure you want to delete this row?')) return;
    try {

      await executeDynamicDelete({
        parameter: 'PAY_COMP_PAYUNIT_DEPEND_DETAIL_Delete',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: nationality ?? ''
      } as any);

      const updated = details.filter((row) => row.id !== id).map((row, i) => ({ ...row, sort_order: i + 1 }));
      formik.setFieldValue('detail', updated);
    } catch (e) {
      console.error(e);
    }
  };

  // ===================== EDIT =====================
  const handleEdit = (row: TPayUnitDetail) => {
    setEditRow({
      ...row,
      pay_comp_id_depend: row.pay_comp_id_depend ?? '',
      percent: row.percent ?? 0,
      pay_comp_desc: row.pay_comp_desc ?? '',
      country_code: row.country_code ?? '',
      country_name: row.country_name ?? '',
      nationality: row.nationality ?? '',
      status: row.status ?? '',
      limit: row.limit ?? 0,
      age: row.age ?? 0,
      amount: row.amount ?? 0,
      remarks: row.remarks ?? ''
    });
    setOpen(true);
  };

  // ===================== SAVE =====================
  const handleSave = () => {
    if (!editRow) return;

    const isNewRow = !details.some((d) => d.id === editRow.id);

    if (isNewRow) {
      const isDuplicate = details.some((d) => d.nationality === editRow.nationality && editRow.nationality !== '');
      if (isDuplicate) {
        setNotice({ type: 'error', message: `Nationality "${editRow.nationality}" already exists. Duplicate not allowed.` });
        return;
      }
    }

    let updated: TPayUnitDetail[];
    if (!isNewRow) {
      updated = details.map((d) => (d.id === editRow.id ? { ...editRow, isEditMode: true } : d));
    } else {
      updated = [...details, { ...editRow, isEditMode: true }];
    }

    formik.setFieldValue('detail', updated);
    setOpen(false);
    setEditRow(null);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditRow(null);
  };
  const updateEditRow = (patch: Partial<TPayUnitDetail>) => {
    if (!editRow) return;
    const updatedRow = { ...editRow, ...patch };
    const index = details.findIndex((d) => d.id === editRow.id);
    if (index !== -1) {
      const updatedDetails = [...details];
      updatedDetails[index] = updatedRow;
      formik.setFieldValue('detail', updatedDetails);
    }
    setEditRow(updatedRow);
  };

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<TPayUnitDetail>[]>(
    () => [
      {
        id: 'actions',
        header: 'Action',
        size: 80,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              title="Edit"
              disabled={disabled}
              className="text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row.original);
              }}
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              title="Delete"
              disabled={disabled}
              className="text-destructive hover:text-destructive/80 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteDetail(row.original.id, row.original.nationality);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      },
      {
        id: 'srno',
        header: 'No.',
        size: 50,
        cell: ({ row }) => row.index + 1
      },
      {
        accessorKey: 'country_code',
        header: 'National',
        size: 150,
        cell: ({ row }) =>
          row.original.country_code ? (
            <span title={`Nationality: ${row.original.nationality || 'N/A'}`}>
              {row.original.country_code} - {row.original.country_name}
              {row.original.nationality}
            </span>
          ) : (
            ''
          )
      },
      {
        id: 'limit',
        header: 'Limit',
        columns: [
          {
            accessorKey: 'age',
            header: 'Age',
            size: 100,
            cell: ({ row }) => <span className="block text-right">{row.original.age ?? '—'}</span>
          },
          {
            accessorKey: 'amount',
            header: 'Amount',
            size: 120,
            cell: ({ row }) => <span className="block text-right">{row.original.amount ?? '—'}</span>
          }
        ]
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        cell: ({ row }) => STATUS_OPTIONS.find((opt) => opt.value === row.original.status)?.label ?? '—'
      },
      {
        accessorKey: 'remarks',
        header: 'Remark',
        size: 150,
        cell: ({ row }) => row.original.remarks || '—'
      }
    ],
    [disabled]
  );

  // ===================== RENDER =====================
  return (
    <div className="col-span-12 mt-1">
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">Dependent Parameters ({details.length} rows)</span>
        {!disabled && (
          <Button type="button" size="sm" variant="default" onClick={handleAddRow}>
            <Plus size={14} /> Add Row
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={details} height={300} density="compact" getRowId={(row: TPayUnitDetail) => row.id} />

      {/* ===================== DIALOG ===================== */}
      <Dialog open={open} title={editRow?.isEditMode ? 'Edit Row' : 'Add Row'} onClose={handleCloseDialog}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {/* Nationality */}
          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-xs font-medium text-muted-foreground">Nationality *</span>
            <select
              value={editRow?.country_code || ''}
              onChange={(e) => {
                const selected = countryOptions.find((opt) => opt.country_code === e.target.value);
                updateEditRow({
                  country_code: selected?.country_code ?? '',
                  country_name: selected?.country_name ?? '',
                  nationality: selected?.nationality ?? ''
                });
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select</option>
              {countryOptions.map((opt) => (
                <option key={opt.country_code} value={opt.country_code}>
                  {opt.country_code} - {opt.country_name}
                </option>
              ))}
            </select>
          </label>

          {/* Age */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Age</span>
            <Input
              type="number"
              min={0}
              step="1"
              className="text-right"
              value={editRow?.age ?? 0}
              onChange={(e) => updateEditRow({ age: parseFloat(e.target.value) || 0 })}
            />
          </label>

          {/* Amount */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Amount</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="text-right"
              value={editRow?.amount ?? 0}
              onChange={(e) => updateEditRow({ amount: parseFloat(e.target.value) || 0 })}
            />
          </label>

          {/* Status */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select
              value={editRow?.status || ''}
              onChange={(e) => {
                const code = e.target.value;
                const selected = STATUS_OPTIONS.find((opt) => opt.value === code);
                updateEditRow({ status: code, status_desc: selected?.label ?? '' } as Partial<TPayUnitDetail>);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} - {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Remarks */}
          <label className="flex flex-col gap-1 sm:col-span-2 md:col-span-3">
            <span className="text-xs font-medium text-muted-foreground">Remarks</span>
            <textarea
              rows={2}
              value={editRow?.remarks ?? ''}
              onChange={(e) => updateEditRow({ remarks: e.target.value })}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleCloseDialog}>
            Cancel
          </Button>
          {!disabled && (
            <Button type="button" size="sm" variant="default" onClick={handleSave}>
              Save
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default PayUnitDependDetailForm;