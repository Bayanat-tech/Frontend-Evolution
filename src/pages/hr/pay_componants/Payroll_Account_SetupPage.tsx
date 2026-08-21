import { useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, RotateCcw, Pencil } from 'lucide-react';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup, postFinance } from '../../../api/lookups';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import AddPayrollAccountSetupForm from './AddPayrollAccountSetupForm';


function lowercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toLowerCase()] = row[key];
  }
  return out as T;
}

type TLeaveRow = {
  pay_comp_id: string;
  ac_code_db: string;
  ac_code_cr: string;
};

// ─── Columns ──────────────────────────────────────────────────────────────
const leaveColumns: ColumnDef<TLeaveRow>[] = [
  {
    id: 'srno',
    header: '#',
    size: 50,
    cell: ({ row }) => row.index + 1
  },
  { accessorKey: 'pay_comp_id', header: 'Pay Component ID', size: 200 },
  { accessorKey: 'ac_code_db', header: 'DB Account Code', size: 200 },
  { accessorKey: 'ac_code_cr', header: 'CR Account Code *', size: 200 }
];

// ─── Helper ───────────────────────────────────────────────────────────────
const fetchLookup = async (parameter: string, code1: string, code2 = '', code3 = '', code4 = '') => {
  const res = await getDynamicLookup({ parameter, code1, code2, code3, code4 });
  const rows = (res ?? []) as unknown as Record<string, unknown>[];
  return rows.map(lowercaseKeys);
};

const PayrollAccountSetupPage = () => {
  const { user } = useAuth();
  const gridRef = useRef<any>(null);
  const queryClient = useQueryClient();

  const loginid = user?.loginid ?? '';
  const companyCode = user?.company_code ?? '';

  // ── Filter State ──────────────────────────────────────────────────────────
  const [company, setCompany] = useState<any>(null);
  const [division, setDivision] = useState<any>(null);
  const [department, setDepartment] = useState<any>(null);
  const [section, setSection] = useState<any>(null);
  const [empCode, setEmpCode] = useState<any>(null);

  // ── Form State ────────────────────────────────────────────────────────────
  const [docNo, setDocNo] = useState<any>(null);

  // ── Add/Edit Modal State ─────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<TLeaveRow | null>(null);

  // ── Company Query ─────────────────────────────────────────────────────────
  const { data: companyData } = useQuery({
    queryKey: ['lc_company'],
    queryFn: async () => ({ tableData: await fetchLookup('EDUCATION_QUALIFICATION_Company', companyCode, loginid) })
  });

  // ── Division Query ─────────────────────────────────────────────────────────
  const { data: divisionData } = useQuery({
    queryKey: ['lc_division', company?.company_code],
    queryFn: async () => ({ tableData: await fetchLookup('Account_division', company?.company_code ?? '', loginid) }),
    enabled: !!company,
    staleTime: 0,
    gcTime: 0
  });

  // ── Department Query ───────────────────────────────────────────────────────
  const { data: departmentData } = useQuery({
    queryKey: ['lc_department', division?.div_code],
    queryFn: async () => ({
      tableData: await fetchLookup('EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE', companyCode, division?.div_code ?? '')
    }),
    enabled: !!division,
    staleTime: 0,
    gcTime: 0
  });

  // ── Section Query ──────────────────────────────────────────────────────────
  const { data: sectionData } = useQuery({
    queryKey: ['lc_section', division?.div_code, department?.dept_code],
    queryFn: async () => ({
      tableData: await fetchLookup(
        'EDUCATION_QUALIFICATION_MS_HR_SECTION',
        companyCode,
        division?.div_code ?? '',
        department?.dept_code ?? ''
      )
    }),
    enabled: !!department,
    staleTime: 0,
    gcTime: 0
  });

  // ── Leave Grid Data Query ──────────────────────────────────────────────────
  const { data: leaveData } = useQuery({
    queryKey: ['pa_setup', company?.company_code, division?.div_code, department?.dept_code, section?.section_code],
    queryFn: async () => ({
      tableData: await fetchLookup(
        'PAY_COMPONENT_AccountSetup',
        company?.company_code ?? '', // P_CODE1 → COMPANY_CODE
        division?.div_code ?? '', // P_CODE2 → DIV_CODE
        department?.dept_code ?? '', // P_CODE3 → DEPT_CODE
        section?.section_code ?? '' // P_CODE4 → SECTION_CODE
      )
    }),
    enabled: !!company && !!division && !!department && !!section,
    staleTime: 0,
    gcTime: 0
  });

  const leaveRows: TLeaveRow[] = (leaveData?.tableData ?? []) as TLeaveRow[];


  const handleReset = () => {
    setCompany(null);
    setDivision(null);
    setDepartment(null);
    setSection(null);
    setEmpCode(null);
    setDocNo(null);
  };

  const handleSave = async () => {
    if (!empCode || !docNo) {
      alert('Please select Employee and Doc No!');
      return;
    }

    try {
      const response: any = await postFinance('PROC_CANCEL_LEAVE', {
        loginid: user?.loginid ?? '',
        val1s1: docNo?.lve_doc_no ?? '', // LVE_DOC_NO
        val1s2: empCode?.employee_code ?? '', // employee_code
        val1s3: user?.company_code ?? '' // company_code
      });

      console.log('Save response:', response);
      // TODO: success message
    } catch (error) {
      console.error('Save error:', error);
      // TODO: error message
    }
  };

  // ── Add / Edit Modal Handlers ────────────────────────────────────────────
  const handleAddClick = () => {
    setEditingRow(null);
    setShowForm(true);
  };



  const handleFormClose = (refetch?: boolean) => {
    setShowForm(false);
    setEditingRow(null);
    if (refetch) {
      queryClient.invalidateQueries({
        queryKey: ['pa_setup', company?.company_code, division?.div_code, department?.dept_code, section?.section_code]
      });
    }
  };
  const handleRowEdit = (row: TLeaveRow) => {
    setEditingRow(row);
    setShowForm(true);
  };

  const columnsWithActions = useMemo<ColumnDef<TLeaveRow>[]>(
    () => [
      ...leaveColumns,
      {
        id: 'actions',
        header: '',
        size: 60,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => handleRowEdit(row.original)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
        )
      }
    ],
    []
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — Employee Filters
      ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-md border bg-card p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Company */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Company</span>
            <select
              value={company?.company_code ?? ''}
              onChange={(e) => {
                const val = (companyData?.tableData ?? []).find((opt: any) => opt.company_code === e.target.value) ?? null;
                setCompany(val);
                setDivision(null);
                setDepartment(null);
                setSection(null);
                setEmpCode(null);
                setDocNo(null);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select</option>
              {(companyData?.tableData ?? []).map((opt: any) => (
                <option key={opt.company_code} value={opt.company_code}>
                  {opt.company_code} - {opt.comp_name}
                </option>
              ))}
            </select>
          </label>

          {/* Division */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Division</span>
            <select
              disabled={!company}
              value={division?.div_code ?? ''}
              onChange={(e) => {
                const val = (divisionData?.tableData ?? []).find((opt: any) => opt.div_code === e.target.value) ?? null;
                setDivision(val);
                setDepartment(null);
                setSection(null);
                setEmpCode(null);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select</option>
              {(divisionData?.tableData ?? []).map((opt: any) => (
                <option key={opt.div_code} value={opt.div_code}>
                  {opt.div_code} - {opt.div_name}
                </option>
              ))}
            </select>
          </label>

          {/* Department */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Department</span>
            <select
              disabled={!division}
              value={department?.dept_code ?? ''}
              onChange={(e) => {
                const val = (departmentData?.tableData ?? []).find((opt: any) => opt.dept_code === e.target.value) ?? null;
                setDepartment(val);
                setSection(null);
                setEmpCode(null);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select</option>
              {(departmentData?.tableData ?? []).map((opt: any) => (
                <option key={opt.dept_code} value={opt.dept_code}>
                  {opt.dept_code} - {opt.dept_name}
                </option>
              ))}
            </select>
          </label>

          {/* Section */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Section</span>
            <select
              disabled={!department}
              value={section?.section_code ?? ''}
              onChange={(e) => {
                const val = (sectionData?.tableData ?? []).find((opt: any) => opt.section_code === e.target.value) ?? null;
                setSection(val);
                setEmpCode(null);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select</option>
              {(sectionData?.tableData ?? []).map((opt: any) => (
                <option key={opt.section_code} value={opt.section_code}>
                  {opt.section_code} - {opt.section_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>


      <div className="flex flex-1 flex-col rounded-md border bg-card p-3">
        <div className="mb-3 flex justify-end">
          <Button
            type="button"
            variant="default"
            onClick={handleAddClick}
            disabled={!company || !division || !department || !section}
          >
            <Plus size={15} /> Add Payroll
          </Button>
        </div>

        <DataTable
          columns={leaveColumns}
          data={leaveRows}
          height={350}
          density="compact"
          getRowId={(row: TLeaveRow) => String(row.pay_comp_id)}

        />




        <div className="mt-3 border-t pt-3">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw size={15} /> Reset
            </Button>
          </div>
        </div>



      </div>

      {/*
          Add / Edit Modal*/}
      {showForm && (
        <AddPayrollAccountSetupForm
          onClose={handleFormClose}
          isEdit={!!editingRow}
          company_code={company?.company_code ?? ''}
          div_code={division?.div_code ?? ''}
          dept_code={department?.dept_code ?? ''}
          section_code={section?.section_code ?? ''}
          pay_comp_id={editingRow?.pay_comp_id}
        />
      )}
    </div>
  );
};

export default PayrollAccountSetupPage;