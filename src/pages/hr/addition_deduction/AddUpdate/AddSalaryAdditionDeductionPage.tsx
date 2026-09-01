import type { SalaryAdditionDeductionDetailRow } from './types';
import { LookupField } from '../../../../components/ui/LookupField';
import {
  DocField,
  docInputClass,
  DocumentSection,
  DocumentTable,
} from '../../../../components/ui/DocumentPageShell';
import { getDynamicLookup } from '../../../../api/lookups';
import { useAuth } from '../../../../state/AuthContext';
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { DataTable } from '../../../../components/ui/DataTable';

type Props = {
  mode?: string;
  formik: any;
  detailRows: SalaryAdditionDeductionDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<SalaryAdditionDeductionDetailRow[]>>;
};

type HeaderProps = { formik: any; mode?: string };
type DetailProps = {
  detailRows: SalaryAdditionDeductionDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<SalaryAdditionDeductionDetailRow[]>>;
};

const AddSalaryAdditionDeductionPage = ({
  mode,
  formik,
  detailRows,
  setDetailRows,
}: Props) => {
  return (
    <form className="grid gap-2" onSubmit={formik.handleSubmit}>
      <DocumentSection label="Header" subtitle="Document Information">
        <HeaderSection formik={formik} mode={mode} />
      </DocumentSection>

      <DocumentSection label="Details" subtitle="Addition / Deduction Lines">
        <DetailSection detailRows={detailRows} setDetailRows={setDetailRows} />
      </DocumentSection>
    </form>
  );
};

/** Exactly 3 compact rows – matches Absent Memo layout */
const HeaderSection = ({ formik, mode }: HeaderProps) => {
  const isEdit = mode === 'edit';

  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2">
      {/* Row 1 */}
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
          value={formik.values.docType ?? 'ADV'}
          onChange={formik.handleChange}
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

      {/* Row 2 */}
      <DocField label="Name From">
        <input
          className={docInputClass}
          name="nameFrom"
          value={formik.values.nameFrom ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Name To">
        <input
          className={docInputClass}
          name="nameTo"
          value={formik.values.nameTo ?? ''}
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
      <DocField label="Addr To">
        <input
          className={docInputClass}
          name="addrTo"
          value={formik.values.addrTo ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      {/* Row 3 */}
      <DocField label="Letter Subject">
        <input
          className={docInputClass}
          name="lettrSubject"
          value={formik.values.lettrSubject ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
      <DocField label="Remarks 1">
        <input
          className={docInputClass}
          name="remarks1"
          value={formik.values.remarks1 ?? ''}
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

      {/* Optional 4th row only if you still need Remarks 2 – keep single line */}
      <DocField label="Remarks 2" className="col-span-4">
        <input
          className={docInputClass}
          name="remarks2"
          value={formik.values.remarks2 ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
    </div>
  );
};

const DetailSection = ({ detailRows, setDetailRows }: DetailProps) => {
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

  const updateRow = (
    rowKey: number | string,
    patch: Partial<SalaryAdditionDeductionDetailRow>,
  ) => {
    setDetailRows((prev) =>
      prev.map((row) =>
        String(row.srNo) === String(rowKey)
          ? {
              ...row,
              ...patch,
              employeeId:
                patch.employeeId !== undefined
                  ? String(patch.employeeId)
                  : row.employeeId,
              employee:
                patch.employee !== undefined ? String(patch.employee) : row.employee,
              payUnit:
                patch.payUnit !== undefined ? String(patch.payUnit) : row.payUnit,
              description:
                patch.description !== undefined
                  ? String(patch.description)
                  : row.description,
              cancel: patch.cancel !== undefined ? String(patch.cancel) : row.cancel,
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
    setDetailRows((prev) =>
      prev.filter((row) => String(row.srNo) !== String(rowKey)),
    );
  };

  const columns = useMemo<ColumnDef<SalaryAdditionDeductionDetailRow>[]>(
    () => [
      { accessorKey: 'srNo', header: 'No', size: 44 },
      {
        accessorKey: 'employee',
        header: 'Employee',
        size: 180,
        cell: ({ row }) => (
          <LookupField
            label="Employee"
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
                  opt?.employee_id ??
                    opt?.EMPLOYEE_ID ??
                    opt?.employee_code ??
                    opt?.EMPLOYEE_CODE ??
                    value ??
                    '',
                ),
                employee: String(
                  opt?.rpt_name ??
                    opt?.RPT_NAME ??
                    opt?.employee_name ??
                    opt?.EMPLOYEE_NAME ??
                    '',
                ),
              })
            }
          />
        ),
      },
      {
        accessorKey: 'payUnit',
        header: 'Pay Unit',
        size: 150,
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
            onChange={(value, selected) =>
              updateRow(row.original.srNo, {
                payUnit: String(value ?? ''),
                description: String(
                  selected?.value_desc ??
                    selected?.VALUE_DESC ??
                    row.original.description ??
                    '',
                ),
              })
            }
          />
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        size: 120,
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-1.5"
            value={row.original.description}
            onChange={(e) =>
              updateRow(row.original.srNo, { description: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 90,
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-1.5"
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
        accessorKey: 'effectiveFrom',
        header: 'Effective From',
        size: 120,
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-1.5"
            type="date"
            value={row.original.effectiveFrom}
            onChange={(e) =>
              updateRow(row.original.srNo, { effectiveFrom: e.target.value })
            }
          />
        ),
      },
      {
        accessorKey: 'cancel',
        header: 'Cancel',
        size: 72,
        cell: ({ row }) => (
          <Select
            className="h-7 text-[11px] px-1.5"
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
        size: 44,
        cell: ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Delete Row"
            onClick={() => handleRemoveDetailRow(row.original.srNo)}
          >
            <Trash2 size={13} className="text-red-500" />
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

export default AddSalaryAdditionDeductionPage;