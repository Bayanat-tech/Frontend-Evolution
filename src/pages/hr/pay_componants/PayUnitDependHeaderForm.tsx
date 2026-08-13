import { Edit2, Trash2, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { FormikProps } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { THeaderDetail, TPayUnitFormValues } from './AddPayUnitDependentForm';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup, executeDynamicDelete } from '../../../api/lookups';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';

// Lightweight id generator — replaces the missing 'uuid' package
function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// getDynamicLookup returns raw lowercase keys from Oracle — normalize so
// UPPERCASE field reads resolve correctly.
function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

// ===================== TYPES =====================
type TProps = {
  formik: FormikProps<TPayUnitFormValues>;
  isEdit: boolean;
  disabled?: boolean;
  onPayCompIdSelect: (id: string) => void;
};

type TPayUnitOption = { pay_comp_id: string; pay_comp_desc: string };
type TDependUnitOption = { pay_comp_id: string; pay_comp_desc: string; pay_comp_short_desc: string };
type TCodeOption = { value_code: string; value_desc: string };

// ===================== PAY UNIT OPTIONS HOOK =====================
const usePayUnitOptions = () => {
  const { user } = useAuth();
  const [options, setOptions] = useState<TPayUnitOption[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: 'PAY_COMPONENT_PAYUNIT_Dep_UnitId',
          code1: user?.company_code ?? '',
          code2: user?.loginid ?? ''
        });
        const rows = (res ?? []) as unknown as Record<string, unknown>[];
        setOptions(
          rows.map(uppercaseKeys).map((r: any) => ({
            pay_comp_id: r.PAY_COMP_ID ?? '',
            pay_comp_desc: r.PAY_COMP_DESC ?? ''
          }))
        );
      } catch (e) {
        console.error(e);
      }
    };
    if (user?.company_code) fetchOptions();
  }, [user?.company_code]);

  return options;
};

// ===================== DEPEND UNIT OPTIONS HOOK =====================
const useDependUnitOptions = () => {
  const { user } = useAuth();
  const [options, setOptions] = useState<TDependUnitOption[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: 'PAY_COMPONENT_PAYUNIT_DependPayUnit',
          code1: user?.company_code ?? '',
          code2: user?.loginid ?? ''
        });
        const rows = (res ?? []) as unknown as Record<string, unknown>[];
        setOptions(
          rows.map(uppercaseKeys).map((r: any) => ({
            pay_comp_id: r.PAY_COMP_ID ?? '',
            pay_comp_desc: r.PAY_COMP_DESC ?? '',
            pay_comp_short_desc: r.PAY_COMP_SHORT_DESC ?? ''
          }))
        );
      } catch (e) {
        console.error(e);
      }
    };
    if (user?.company_code) fetchOptions();
  }, [user?.company_code]);

  return options;
};

// ===================== CODE OPTIONS HOOK =====================
const useCodeOptions = (parameter: string) => {
  const { user } = useAuth();
  const [options, setOptions] = useState<TCodeOption[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await getDynamicLookup({
          parameter,
          code1: user?.company_code ?? '',
          code2: user?.loginid ?? ''
        });
        const rows = (res ?? []) as unknown as Record<string, unknown>[];
        setOptions(
          rows.map(uppercaseKeys).map((r: any) => ({
            value_code: r.VALUE_CODE ?? '',
            value_desc: r.VALUE_DESC ?? ''
          }))
        );
      } catch (e) {
        console.error(e);
      }
    };
    if (user?.company_code) fetchOptions();
  }, [user?.company_code, parameter]);

  return options;
};

// ===================== EMPTY ROW FACTORY =====================
const createEmptyHeaderRow = (): THeaderDetail => ({
  id: newId(),
  depend_pay_comp_type: '',
  depend_pay_comp_desc: '',
  depend_pay_comp_short_desc: '',
  percent: 0,
  emp_percent: 0,
  status: '',
  status_desc: '',
  remarks: '',
  isEditMode: false
});

// ===================== MAIN COMPONENT =====================
const PayUnitDependHeaderForm = ({ formik, isEdit, disabled = false, onPayCompIdSelect }: TProps) => {
  const { values, errors, touched, handleBlur, setFieldValue } = formik;
  const { user } = useAuth();

  const statusOptions = useCodeOptions('PAY_COMPONENT_STATUS_CodeValue');
  const payUnitOptions = usePayUnitOptions();
  const dependUnitOptions = useDependUnitOptions();

  const headerDetails: THeaderDetail[] = formik.values.headerDetail ?? [];

  const [openDialog, setOpenDialog] = useState(false);
  const [editHeaderRow, setEditHeaderRow] = useState<THeaderDetail | null>(null);

  // ===================== ADD ROW =====================
  const handleAddHeaderRow = () => {
    setEditHeaderRow(createEmptyHeaderRow());
    setOpenDialog(true);
  };

  // ===================== EDIT ROW =====================
  const handleEditHeaderRow = (row: THeaderDetail) => {
    setEditHeaderRow({ ...row });
    setOpenDialog(true);
  };

  // ===================== DELETE ROW =====================
  const handleDeleteHeaderRow = async (id: string, depend_pay_comp_type: string) => {
    if (!window.confirm('Are you sure you want to delete this row?')) return;

    try {
      // NOTE: verify executeDynamicDelete accepts a code3 field — the original
      // delete call needed company_code / pay_comp_id / depend_pay_comp_type (3 codes).
      await executeDynamicDelete({
        parameter: 'PAY_COMP_PAYUNIT_DEPEND_Delete',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: values.pay_comp_id ?? '',
        code3: depend_pay_comp_type ?? ''
      } as any);

      setFieldValue(
        'headerDetail',
        headerDetails.filter((r) => r.id !== id)
      );
    } catch (e) {
      console.error(e);
    }
  };

  // ===================== SAVE ROW =====================
  const handleSaveHeaderRow = () => {
    if (!editHeaderRow) return;
    const updated = [...headerDetails];
    const index = updated.findIndex((r) => r.id === editHeaderRow.id);
    if (index === -1) updated.push(editHeaderRow);
    else updated[index] = editHeaderRow;
    setFieldValue('headerDetail', updated);
    setOpenDialog(false);
    setEditHeaderRow(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditHeaderRow(null);
  };

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<THeaderDetail>[]>(
    () => [
      {
        id: 'actions',
        header: 'Action',
        size: 80,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={disabled}
              className="text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                handleEditHeaderRow(row.original);
              }}
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              disabled={disabled}
              className="text-destructive hover:text-destructive/80 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteHeaderRow(row.original.id, row.original.depend_pay_comp_type);
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
        accessorKey: 'depend_pay_comp_type',
        header: 'Depend To Pay Unit',
        size: 220,
        cell: ({ row }) =>
          row.original.depend_pay_comp_desc
            ? `${row.original.depend_pay_comp_desc} (${row.original.depend_pay_comp_short_desc})`
            : row.original.depend_pay_comp_type || '—'
      },
      {
        accessorKey: 'percent',
        header: 'AMT %',
        size: 100,
        cell: ({ row }) => <span className="block text-right">{row.original.percent ?? '—'}</span>
      },
      {
        accessorKey: 'emp_percent',
        header: 'Employee %',
        size: 120,
        cell: ({ row }) => <span className="block text-right">{row.original.emp_percent ?? '—'}</span>
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        cell: ({ row }) => {
          const label = statusOptions.find((opt) => opt.value_code === row.original.status)?.value_desc;
          return label ?? row.original.status ?? '—';
        }
      },
      {
        accessorKey: 'remarks',
        header: 'Remarks',
        size: 150,
        cell: ({ row }) => row.original.remarks || '—'
      }
    ],
    [disabled, statusOptions]
  );

  // ===================== RENDER =====================
  return (
    <>
      {/* Header Fields */}
      <div className="col-span-12">
        <div className="flex flex-col gap-2 rounded-lg border border-[#d0dcf5] bg-[#f0f5ff] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Division Code</span>
              <Input
                disabled
                readOnly
                value={values.div_code && values.div_name ? `${values.div_code} - ${values.div_name}` : values.div_code || ''}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Pay Unit</span>
              <select
                disabled={disabled}
                value={values.pay_comp_id || ''}
                onBlur={handleBlur}
                name="pay_comp_id"
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const selected = payUnitOptions.find((opt) => opt.pay_comp_id === selectedId);
                  setFieldValue('pay_comp_id', selectedId);
                  setFieldValue('pay_comp_desc', selected?.pay_comp_desc ?? '');
                  onPayCompIdSelect(selectedId);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select</option>
                {payUnitOptions.map((opt) => (
                  <option key={opt.pay_comp_id} value={opt.pay_comp_id}>
                    {opt.pay_comp_id} - {opt.pay_comp_desc}
                  </option>
                ))}
              </select>
              {touched.pay_comp_id && errors.pay_comp_id && (
                <span className="text-xs text-destructive">{String(errors.pay_comp_id)}</span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Dependent Pay Unit Table */}
      <div className="col-span-12">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold">Dependent Pay Unit Parameters</span>
          {!disabled && (
            <Button type="button" size="sm" variant="default" onClick={handleAddHeaderRow}>
              <Plus size={14} /> Add Row
            </Button>
          )}
        </div>

        <DataTable columns={columns} data={headerDetails} height={220} density="compact" getRowId={(row: THeaderDetail) => row.id} />

        <div className="mt-1 flex justify-end">
          <span className="text-xs text-muted-foreground">
            Total Rows: <strong>{headerDetails.length}</strong>
          </span>
        </div>
      </div>

      {/* Add/Edit Row Dialog */}
      <Dialog open={openDialog} title={editHeaderRow?.depend_pay_comp_type ? 'Edit Row' : 'Add Row'} onClose={handleCloseDialog}>
        <div className="flex flex-wrap items-start gap-3">
          {/* Depend To Pay Unit */}
          <label className="flex flex-1 basis-[45%] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Depend To Pay Unit</span>
            <select
              value={editHeaderRow?.depend_pay_comp_type || ''}
              onChange={(e) => {
                const selected = dependUnitOptions.find((opt) => opt.pay_comp_id === e.target.value);
                setEditHeaderRow((prev) =>
                  prev
                    ? {
                        ...prev,
                        depend_pay_comp_type: selected?.pay_comp_id ?? '',
                        depend_pay_comp_desc: selected?.pay_comp_desc ?? '',
                        depend_pay_comp_short_desc: selected?.pay_comp_short_desc ?? ''
                      }
                    : prev
                );
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select</option>
              {dependUnitOptions.map((opt) => (
                <option key={opt.pay_comp_id} value={opt.pay_comp_id}>
                  {opt.pay_comp_desc} - {opt.pay_comp_short_desc}
                </option>
              ))}
            </select>
          </label>

          {/* AMT % */}
          <label className="flex flex-1 basis-[45%] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">AMT %</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className="text-right"
              value={editHeaderRow?.percent ?? 0}
              onChange={(e) => setEditHeaderRow((prev) => (prev ? { ...prev, percent: parseFloat(e.target.value) || 0 } : prev))}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                setEditHeaderRow((prev) => (prev ? { ...prev, percent: isNaN(val) ? 0 : parseFloat(val.toFixed(2)) } : prev));
              }}
            />
          </label>

          {/* Employee % */}
          <label className="flex flex-1 basis-[45%] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Employee %</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className="text-right"
              value={editHeaderRow?.emp_percent ?? 0}
              onChange={(e) => setEditHeaderRow((prev) => (prev ? { ...prev, emp_percent: parseFloat(e.target.value) || 0 } : prev))}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                setEditHeaderRow((prev) => (prev ? { ...prev, emp_percent: isNaN(val) ? 0 : parseFloat(val.toFixed(2)) } : prev));
              }}
            />
          </label>

          {/* Status */}
          <label className="flex flex-1 basis-[45%] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select
              value={editHeaderRow?.status || ''}
              onChange={(e) => {
                const code = e.target.value;
                const selected = statusOptions.find((opt) => opt.value_code === code);
                setEditHeaderRow((prev) => (prev ? { ...prev, status: code, status_desc: selected?.value_desc ?? '' } : prev));
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select</option>
              {statusOptions.map((opt) => (
                <option key={opt.value_code} value={opt.value_code}>
                  {opt.value_code} - {opt.value_desc}
                </option>
              ))}
            </select>
          </label>

          {/* Remarks */}
          <label className="flex flex-1 basis-[45%] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Remarks</span>
            <Input
              value={editHeaderRow?.remarks ?? ''}
              onChange={(e) => setEditHeaderRow((prev) => (prev ? { ...prev, remarks: e.target.value } : prev))}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleCloseDialog}>
            Cancel
          </Button>
          {!disabled && (
            <Button type="button" size="sm" variant="default" onClick={handleSaveHeaderRow}>
              OK
            </Button>
          )}
        </div>
      </Dialog>
    </>
  );
};

export default PayUnitDependHeaderForm;