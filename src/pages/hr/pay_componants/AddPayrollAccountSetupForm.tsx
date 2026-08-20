import { useFormik } from 'formik';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { LookupField } from '../../../components/ui/LookupField';
import { CardHeader } from '../../../components/ui/Card';
import { useAuth } from '../../../state/AuthContext';
import { executeDynamicMutationColumn90, getDynamicLookup } from '../../../api/lookups';
import { useState } from 'react';
import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';
// import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

export type TPayrollAccountForm = {
  COMPANY_CODE: string;
  DIV_CODE: string;
  DEPT_CODE: string;
  SECTION_CODE: string;
  PAY_COMP_ID: string;
  AC_CODE_DB: string;
  AC_CODE_CR: string;
  EXP_TYPE_CODE: string;
  EXP_SUBTYPE_CODE: string;
  PAY_COMP_EARN_DED: string;
  REMARKS: string;
};

type Props = {
  onClose: (refetch?: boolean) => void;
  isEdit?: boolean;
  isViewMode?: boolean;
  company_code: string;
  div_code: string;
  dept_code: string;
  section_code: string;
  pay_comp_id?: string; // required when isEdit = true
};

const EARN_DED_OPTIONS = [
  { value: 'E', label: 'Earning' },
  { value: 'D', label: 'Deduction' }
];

const AddPayrollAccountSetupForm = ({
  onClose,
  isEdit,
  isViewMode,
  company_code,
  div_code,
  dept_code,
  section_code,
  pay_comp_id
}: Props) => {
  const { user } = useAuth();
  const loginid = user?.loginid ?? '';
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

 
  const { data: existingRecord, isLoading: existingLoading } = useQuery({
    queryKey: ['pa-setup-detail', company_code, div_code, dept_code, section_code, pay_comp_id],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_AccountSetup',
        code1: company_code,
        code2: div_code,
        code3: dept_code,
        code4: section_code
      });
      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const upperRows = rawRows.map(uppercaseKeys);
      return upperRows.find((r: any) => r.PAY_COMP_ID === pay_comp_id) ?? null;
    },
    enabled: !!(isEdit && company_code && div_code && dept_code && section_code && pay_comp_id)
  });

  // ===================== LOOKUP: Pay Component (search icon field) =====================
  const loadPayComponentOptions = async (search?: string) => {
    const response = await getDynamicLookup({
      parameter: 'PAY_COMPONENT_Encashment', // NOTE: confirm this is the correct pay-component master lookup
      code1: company_code,
      code2: loginid
    });
    const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
    const rows = rawRows.map(uppercaseKeys);
    if (!search) return rows;
    const trimmed = search.trim().toLowerCase();
    return rows.filter((row: any) =>
      [row.PAY_COMP_ID, row.PAY_COMP_DESC].some((val) => String(val ?? '').toLowerCase().includes(trimmed))
    );
  };

  // ===================== LOOKUP: Account Code (DB / CR — search icon field) =====================
  const loadAccountCodeOptions = async (search?: string) => {
    // NOTE: confirm actual parameter name for chart-of-accounts lookup
    const response = await getDynamicLookup({
      parameter: 'AC_PREPAID_GET_DEBIT_AC',
      code1: company_code,
      code2: search ?? ''
    });
    const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
    return rawRows.map(uppercaseKeys);
  };

  // ===================== FORM =====================
  const formik = useFormik<TPayrollAccountForm>({
    enableReinitialize: true,
    initialValues: {
      COMPANY_CODE: company_code,
      DIV_CODE: div_code,
      DEPT_CODE: dept_code,
      SECTION_CODE: section_code,
      PAY_COMP_ID: (existingRecord?.PAY_COMP_ID as string) ?? '',
      AC_CODE_DB: (existingRecord?.AC_CODE_DB as string) ?? '',
      AC_CODE_CR: (existingRecord?.AC_CODE_CR as string) ?? '',
      EXP_TYPE_CODE: (existingRecord?.EXP_TYPE_CODE as string) ?? '',
      EXP_SUBTYPE_CODE: (existingRecord?.EXP_SUBTYPE_CODE as string) ?? '',
      PAY_COMP_EARN_DED: (existingRecord?.PAY_COMP_EARN_DED as string) ?? 'E',
      REMARKS: (existingRecord?.REMARKS as string) ?? ''
    },
    validate: (values) => {
      const errors: Partial<Record<keyof TPayrollAccountForm, string>> = {};
      if (!values.PAY_COMP_ID) errors.PAY_COMP_ID = 'Required';
      if (!values.AC_CODE_DB) errors.AC_CODE_DB = 'Required';
      if (!values.AC_CODE_CR) errors.AC_CODE_CR = 'Required';
      return errors;
    },
    onSubmit: async (values) => {
      await saveMutation.mutateAsync(values);
    }
  });

  // ===================== SAVE =====================
  const saveMutation = useMutation({
    mutationFn: async (values: TPayrollAccountForm) => {
      // NOTE: confirm exact insert/update proc names + val1sN column mapping on backend
      return executeDynamicMutationColumn90({
         parameter: 'Payroll_accountsetup_ins_upd',
        loginid,
        val1s1: values.COMPANY_CODE,
        val1s2: values.DIV_CODE,
        val1s3: values.DEPT_CODE,
        val1s4: values.SECTION_CODE,
        val1s5: values.PAY_COMP_ID,
        val1s6: values.AC_CODE_DB,
        val1s7: values.AC_CODE_CR,
        val1s8: values.EXP_TYPE_CODE,
        val1s9: values.EXP_SUBTYPE_CODE,
        val1s10: 'P', // PAY_COMP_TYPE — fixed as per existing SELECT filter
        val1s11: values.PAY_COMP_EARN_DED,
        val1s12: values.REMARKS
      });
    },
   onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['pa_setup'] });
  setNotice({ type: 'success', message: 'Payroll account setup saved successfully.' });
  setTimeout(() => onClose(true), 1200); // let the success message show before closing
},
    onError: () => {
      setNotice({ type: 'error', message: 'Failed to save payroll account setup.' });
    }
  });

  const disabled = !!isViewMode;
  const isLoadingData = !!(isEdit && existingLoading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
  <section className="commercial-editor grid w-full max-w-6xl h-[55dvh] grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg bg-background shadow-xl">
     <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
        {/* ===== Top Bar ===== */}
        <CardHeader className="border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {isViewMode ? 'View Document' : isEdit ? 'Edit Document' : 'New Document'}
              </p>
              <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                Payroll Account Setup {pay_comp_id ? `— ${pay_comp_id}` : ''}
              </h2>
            </div>
            <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}>
              <X size={16} />
            </Button>
          </div>
        </CardHeader>

        {/* ===== Scrollable Body ===== */}
        <div className="min-h-0 overflow-auto p-3">
          {isLoadingData ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Loading document...
            </div>
          ) : (
            <form id="payroll-account-form" onSubmit={formik.handleSubmit} className="w-full">
              <div className="w-full space-y-3">
                {/* ===== Header Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Header</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Location</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <div className="col-span-6 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Company</label>
                      <Input value={company_code} disabled />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Division</label>
                      <Input value={div_code} disabled />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                      <Input value={dept_code} disabled />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Section</label>
                      <Input value={section_code} disabled />
                    </div>
                  </div>
                </div>

                {/* ===== Account Setup Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Setup</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Pay Component Account Mapping</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <div className="col-span-12 md:col-span-4">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Pay Component ID <span className="text-red-500">*</span>
                      </label>
                      <LookupField
                        value={formik.values.PAY_COMP_ID}
                        onChange={(val: string) => formik.setFieldValue('PAY_COMP_ID', val)}
                        disabled={disabled || isEdit}
                        valueField="PAY_COMP_ID"
                        displayFields={['PAY_COMP_ID', 'PAY_COMP_DESC']}
                        columns={[
                          { field: 'PAY_COMP_ID', header: 'Pay Component ID' },
                          { field: 'PAY_COMP_DESC', header: 'Description' }
                        ]}
                        loadOptions={loadPayComponentOptions}
                      />
                      {formik.touched.PAY_COMP_ID && formik.errors.PAY_COMP_ID && (
                        <p className="mt-1 text-xs text-red-500">{formik.errors.PAY_COMP_ID}</p>
                      )}
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        DB Account Code <span className="text-red-500">*</span>
                      </label>
                      <LookupField
                        value={formik.values.AC_CODE_DB}
                        onChange={(val: string) => formik.setFieldValue('AC_CODE_DB', val)}
                        disabled={disabled}
                        valueField="AC_CODE"
                        displayFields={['AC_CODE', 'AC_NAME']}
                        columns={[
                          { field: 'AC_CODE', header: 'Account Code' },
                          { field: 'AC_NAME', header: 'Account Name' }
                        ]}
                        loadOptions={loadAccountCodeOptions}
                      />
                      {formik.touched.AC_CODE_DB && formik.errors.AC_CODE_DB && (
                        <p className="mt-1 text-xs text-red-500">{formik.errors.AC_CODE_DB}</p>
                      )}
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        CR Account Code <span className="text-red-500">*</span>
                      </label>
                      <LookupField
                        value={formik.values.AC_CODE_CR}
                        onChange={(val: string) => formik.setFieldValue('AC_CODE_CR', val)}
                        disabled={disabled}
                        valueField="AC_CODE"
                        displayFields={['AC_CODE', 'AC_NAME']}
                        columns={[
                          { field: 'AC_CODE', header: 'Account Code' },
                          { field: 'AC_NAME', header: 'Account Name' }
                        ]}
                        loadOptions={loadAccountCodeOptions}
                      />
                      {formik.touched.AC_CODE_CR && formik.errors.AC_CODE_CR && (
                        <p className="mt-1 text-xs text-red-500">{formik.errors.AC_CODE_CR}</p>
                      )}
                    </div>

                    {/* <div className="col-span-12 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Expense Type</label>
                      <Input
                        name="EXP_TYPE_CODE"
                        value={formik.values.EXP_TYPE_CODE}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      />
                    </div> */}

                    {/* <div className="col-span-12 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Expense Subtype</label>
                      <Input
                        name="EXP_SUBTYPE_CODE"
                        value={formik.values.EXP_SUBTYPE_CODE}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      />
                    </div> */}

                    {/* <div className="col-span-12 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Earn / Deduction</label>
                      <Select
                        name="PAY_COMP_EARN_DED"
                        value={formik.values.PAY_COMP_EARN_DED}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        {EARN_DED_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div> */}

                    {/* <div className="col-span-12">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                      <textarea
                        name="REMARKS"
                        value={formik.values.REMARKS}
                        onChange={formik.handleChange}
                        disabled={disabled}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                      />
                    </div> */}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* ===== Bottom Action Bar ===== */}
        <div className="flex items-center justify-end gap-2 border-t bg-secondary/60 px-4 py-2">
          {!isViewMode && (
            <Button type="submit" form="payroll-account-form" variant="default" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}{' '}
              Submit
            </Button>
          )}
        </div>
      </section>
    </div>
  );
};

export default AddPayrollAccountSetupForm;