import type { AbsentMemoDetailRow } from './types';
import { LookupField } from '../../../components/ui/LookupField';
import {
  DocField,
  docInputClass,
  DocumentSection,
  DocumentTable,
} from '../../../components/ui/DocumentPageShell';
import { getDynamicLookup } from '../../../api/lookups';
import { useAuth } from '../../../state/AuthContext';
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { DataTable } from '../../../components/ui/DataTable';

type Props = {
  mode?: string;
  formik: any;
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

type AbsentMemoTab1Props = { formik: any; mode?: string };
type AbsentMemoDetailTabProps = {
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

/* compact single-line controls */
const compactInput = `${docInputClass} !h-7 !text-[12px] !py-0 !leading-7`;
const compactTextarea =
  'w-full rounded-md border border-input bg-background px-2 py-1 text-[12px] min-h-[32px] max-h-[40px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const AddAbsentMemoPage = ({ mode, formik, detailRows, setDetailRows }: Props) => {
  return (
    <form className="grid gap-2" onSubmit={formik.handleSubmit}>
      <DocumentSection label="Header" subtitle="Document & Employee">
        <AbsentMemoTab1 formik={formik} mode={mode} />
      </DocumentSection>

      <DocumentSection label="Details" subtitle="Absence / Deduction Lines">
        <AbsentMemoDetailTab detailRows={detailRows} setDetailRows={setDetailRows} />
      </DocumentSection>
    </form>
  );
};

const AbsentMemoTab1 = ({ formik, mode }: AbsentMemoTab1Props) => {
  const { user } = useAuth();
  const isEdit = mode === 'edit';

  const loadEmployees = async () => {
    const response = await getDynamicLookup({
      parameter: 'HR_ADDITION_DEDUCTION_EMPLOYEE_DROP_DOWN',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });
    return Array.isArray(response) ? response : [];
  };

  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2">
      {/* ── Row 1 ── */}
      <DocField label="Doc No">
        <input
          className={docInputClass}
          name="docNo"
          value={formik.values.docNo ?? ''}
          onChange={formik.handleChange}
          readOnly={isEdit}
          placeholder={isEdit ? '' : 'Auto'}
        />
      </DocField>
      <DocField label="Doc Date" required>
        <input
          className={docInputClass}
          type="date"
          name="docDate"
          value={formik.values.docDate ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Doc Type">
        <input
          className={docInputClass}
          name="docType"
          value={formik.values.docType ?? 'Absent'}
          onChange={formik.handleChange}
          readOnly
        />
      </DocField>
      <DocField label="Ref No">
        <input
          className={docInputClass}
          name="refNo"
          value={formik.values.refNo ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      {/* ── Row 2 ── */}
      <DocField label="Employee Code" required>
        <LookupField
          value={formik.values.employeeCode ?? ''}
          columns={[
            { field: 'employee_code', header: 'Employee Code' },
            { field: 'rpt_name', header: 'Name' },
          ]}
          valueField="employee_code"
          displayFields={['employee_code']}
          loadOptions={loadEmployees}
          onChange={(value, row) => {
            formik.setFieldValue('employeeCode', String(value ?? ''));
            formik.setFieldValue(
              'nameFrom',
              String(row?.rpt_name ?? row?.RPT_NAME ?? ''),
            );
          }}
        />
      </DocField>
      <DocField label="Name From">
        <input
          className={docInputClass}
          name="nameFrom"
          value={formik.values.nameFrom ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Addr From">
        <input
          className={docInputClass}
          name="addrFrom"
          value={formik.values.addrFrom ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Letter Subject">
        <input
          className={docInputClass}
          name="lettrSubject"
          value={formik.values.lettrSubject ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      {/* ── Row 3 ── */}
      <DocField label="Remarks 1" className="col-span-1">
        <input
          className={docInputClass}
          name="remarks1"
          value={formik.values.remarks1 ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Remarks 2" className="col-span-1">
        <input
          className={docInputClass}
          name="remarks2"
          value={formik.values.remarks2 ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Signatory Name">
        <input
          className={docInputClass}
          name="signatoryName"
          value={formik.values.signatoryName ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Signatory Position">
        <input
          className={docInputClass}
          name="signatoryPosition"
          value={formik.values.signatoryPosition ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
    </div>
  );
};

const AbsentMemoDetailTab = ({ detailRows, setDetailRows }: AbsentMemoDetailTabProps) => {
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
      prev.map((row) =>
        String(row.srNo) === String(rowKey)
          ? {
              ...row,
              ...patch,
              payUnit: patch.payUnit !== undefined ? String(patch.payUnit) : row.payUnit,
              description:
                patch.description !== undefined
                  ? String(patch.description)
                  : row.description,
              cancel: patch.cancel !== undefined ? String(patch.cancel) : row.cancel,
              refLeaveDocNo:
                patch.refLeaveDocNo !== undefined
                  ? String(patch.refLeaveDocNo)
                  : row.refLeaveDocNo,
            }
          : row,
      ),
    );
  };

  const handleAddDetailRow = () => {
    const nextSrNo =
      detailRows.length > 0
        ? Number(detailRows[detailRows.length - 1]?.srNo || 0) + 1
        : 1;
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
    setDetailRows((prev) =>
      prev.filter((row) => String(row.srNo) !== String(rowKey)),
    );
  };

  const columns = useMemo<ColumnDef<AbsentMemoDetailRow>[]>(
    () => [
      { accessorKey: 'srNo', header: 'No', size: 40 },
      {
        accessorKey: 'payUnit',
        header: 'Pay Unit',
        size: 130,
        cell: ({ row }) => (
          <LookupField
            label="Pay Unit"
            compact
            value={row.original.payUnit}
            columns={[
              { field: 'value_code', header: 'Value Code' },
              { field: 'value_desc', header: 'Description' },
            ]}
            valueField="value_code"
            displayFields={['value_code', 'value_desc']}
            loadOptions={loadPayUnits}
            onChange={(value, selected) => {
              updateRow(row.original.srNo, {
                payUnit: String(value ?? ''),
                description: String(
                  selected?.value_desc ??
                    selected?.VALUE_DESC ??
                    row.original.description ??
                    '',
                ),
              });
            }}
          />
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        size: 110,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            value={row.original.description}
            onChange={(e) =>
              updateRow(row.original.srNo, { description: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'effectiveFrom',
        header: 'Effective',
        size: 105,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            type="date"
            value={row.original.effectiveFrom}
            onChange={(e) =>
              updateRow(row.original.srNo, { effectiveFrom: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'absentFromDate',
        header: 'From',
        size: 105,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            type="date"
            value={row.original.absentFromDate}
            onChange={(e) =>
              updateRow(row.original.srNo, { absentFromDate: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'absentToDate',
        header: 'To',
        size: 105,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            type="date"
            value={row.original.absentToDate}
            onChange={(e) =>
              updateRow(row.original.srNo, { absentToDate: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'noOfDays',
        header: 'Days',
        size: 60,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            type="number"
            min={0}
            value={String(row.original.noOfDays ?? '')}
            onChange={(e) =>
              updateRow(row.original.srNo, { noOfDays: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 85,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            type="number"
            step="0.001"
            value={String(row.original.amount ?? '')}
            onChange={(e) =>
              updateRow(row.original.srNo, { amount: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'refLeaveDocNo',
        header: 'Ref Leave',
        size: 90,
        cell: ({ row }) => (
          <Input
            className="h-6 text-[11px] px-1.5"
            value={row.original.refLeaveDocNo}
            onChange={(e) =>
              updateRow(row.original.srNo, { refLeaveDocNo: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'cancel',
        header: 'Cancel',
        size: 68,
        cell: ({ row }) => (
          <Select
            className="h-6 text-[11px] px-1"
            value={row.original.cancel}
            onChange={(e) =>
              updateRow(row.original.srNo, { cancel: e.target.value })
            }
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 40,
        cell: ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Delete Row"
            onClick={() => handleRemoveDetailRow(row.original.srNo)}
          >
            <Trash2 size={12} className="text-red-500" />
          </Button>
        ),
      },
    ],
    [user?.company_code, user?.loginid],
  );

return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Button
          size="sm"
          type="button"
          onClick={handleAddDetailRow}
          className="h-7 rounded-lg border border-[#0e4f8f] bg-white px-2.5 text-xs font-medium text-[#0e4f8f] hover:bg-[#eaf2fb]"
        >
          <Plus size={12} /> Add Line
        </Button>
      </div>

      <DocumentTable>
        <DataTable
          columns={columns}
          data={detailRows}
          emptyText="No lines — click Add Line"
          height={220}
          density="compact"
          getRowId={(row) => String(row.srNo)}
        />
      </DocumentTable>
    </div>
  );
};

export default AddAbsentMemoPage;