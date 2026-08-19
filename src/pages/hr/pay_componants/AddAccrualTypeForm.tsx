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

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

export type TAccrualTypeForm = {
  COMPANY_CODE: string;
  ACCRUAL_TYPE: string;
  ACCRUAL_DESC: string;
  ACCRUAL_SHORT_DESC: string;
  ELIGIBLITY: string; // Applicable To
  ACCRUAL_UNIT: string;
  CALC_SETUP: string; // Calculation Based on
  AMOUNT_CALC_FACTOR: string; // Unit Calculation Factor (left side)
  ACCRUAL_CALC_TYPE: string; // Amount Calculation (right side, top)
  CALC_AMT: string; // Amount Calculation Factor (right side, bottom)
  ACCRUAL_DEPENDENCY: string;
  CREDIT_TYPE: string;
  ALLOW_ENCASHMENT: string;
  AUTO_ENCASHMENT: string;
  ENCASHMENT_COMP_ID: string;
  REMARKS: string;
  ACCR_STATUS: string;
};

type Props = {
  onClose: (refetch?: boolean) => void;
  isEdit?: boolean;
  isViewMode?: boolean;
  company_code?: string;
  accrual_type?: string;
};

// const ACCRUAL_UNIT_OPTIONS = [{ value: 'DAYS', label: 'Days' }, { value: 'HOURS', label: 'Hours' }];

// const CALC_FACTOR_OPTIONS = [
//   { value: 'MONTHLY_30', label: 'Monthly(30)' },
//   { value: 'MONTHLY_30D', label: 'Monthly(30 Days)' },
//   { value: 'ACTUAL', label: 'Actual Days' }
// ];


const YES_NO_OPTIONS = [
  { value: 'N', label: 'No' },
  { value: 'Y', label: 'Yes' }
];
const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' }
];

const AddAccrualTypeForm = ({ onClose, isEdit, isViewMode, company_code, accrual_type }: Props) => {
  const { user } = useAuth();
  const companyCode = company_code ?? user?.company_code ?? '';
  const loginid = user?.loginid ?? '';
  const queryClient = useQueryClient();

  // ===================== FETCH EXISTING RECORD (edit/view) =====================
    const { data: existingRecord, isLoading: existingLoading } = useQuery({
    queryKey: ['accrual-type-detail', companyCode, accrual_type],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_ACCRUAL_TYPE',
        code1: companyCode,
        code2: accrual_type
      });
      const allRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];

      // sirf wahi record chahiye jiska ACCRUAL_TYPE match karta ho
      const matched = allRows.find((row: any) => {
        const type = String(row.ACCRUAL_TYPE ?? row.accrual_type ?? '').trim();
        return type === String(accrual_type ?? '').trim();
      });

      return matched ? uppercaseKeys(matched) : null;
    },
    enabled: !!(isEdit && companyCode && accrual_type),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always'
  });
  // ===================== APPLICABLE TO lookup =====================
  const { data: applicableToData } = useQuery({
    queryKey: ['accrual-applicable-to', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_accrual_applicable_to',
        code1: companyCode,
        code2: loginid
      });
      // response can be either a plain array OR an envelope { success, data, totalCount }
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });

  // ===================== UNIT CALCULATION FACTOR lookup =====================
  const { data: unitCalcFactorData } = useQuery({
    queryKey: ['unit-calc-factor', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_unit_calculation_factor',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });


  const { data: accrualUnitData } = useQuery({
    queryKey: ['accrual-unit', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_accrual_unit',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });

  // ===================== ACCRUAL DEPEND TO lookup =====================
  const { data: accrualDependData } = useQuery({
    queryKey: ['accrual-depend', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_accrual_depend',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });



  // ===================== CALCULATION BASED ON lookup =====================
  const { data: calcBasedOnData } = useQuery({
    queryKey: ['calc-based-on', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_calculation_based',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });

  // ===================== ENCASHMENT PAY UNIT lookup (search icon field) =====================
  const { data: payUnitData } = useQuery({
    queryKey: ['pay-units-header', companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_Encashment',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });

  // ===================== LOOKUP: Accrual Type (search icon field) =====================
  const loadAccrualTypeOptions = async (search?: string) => {
    const response = await getDynamicLookup({
      parameter: 'PAY_COMPONENT_ACCRUAL',
      code1: companyCode,
      code2: search ?? ''
    });
    const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
    return rawRows.map(uppercaseKeys);
  };

  // ===================== LOOKUP: Encashment Pay Unit (search icon field) =====================
  const loadPayUnitOptions = async (search?: string) => {
    const rows = payUnitData ?? [];
    if (!search) return rows;
    const trimmed = search.trim().toLowerCase();
    return rows.filter((row: any) =>
      [row.PAY_COMP_ID, row.PAY_COMP_DESC].some((val) =>
        String(val ?? '').toLowerCase().includes(trimmed)
      )
    );
  };

  // ===================== CREDIT TYPE lookup =====================
  const { data: creditTypeData } = useQuery({
    queryKey: ['credit-type', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_Credit_Type',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });

  // ===================== AMOUNT CALCULATION lookup (ACCRUAL_CALC_TYPE) =====================
  const { data: accrualCalcTypeData } = useQuery({
    queryKey: ['accrual-calc-type', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_amount_calculation',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });


  // ===================== AMOUNT CALCULATION FACTOR lookup (CALC_AMT) =====================
  const { data: calcAmtData } = useQuery({
    queryKey: ['calc-amt', companyCode],
    queryFn: async () => {
      const response: any = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_amount_calculationFactor',
        code1: companyCode,
        code2: loginid
      });
      const rawRows = (Array.isArray(response) ? response : response?.data ?? []) as Record<string, unknown>[];
      return rawRows.map(uppercaseKeys);
    },
    enabled: !!companyCode
  });
  // ===================== FORM =====================
  const formik = useFormik<TAccrualTypeForm>({
    enableReinitialize: true,
    initialValues: {
      COMPANY_CODE: companyCode,
      ACCRUAL_TYPE: (existingRecord?.ACCRUAL_TYPE as string) ?? '',
      ACCRUAL_DESC: (existingRecord?.ACCRUAL_DESC as string) ?? '',
      ACCRUAL_SHORT_DESC: (existingRecord?.ACCRUAL_SHORT_DESC as string) ?? '',
      ELIGIBLITY: (existingRecord?.ELIGIBLITY as string) ?? '',
      ACCRUAL_UNIT: (existingRecord?.ACCRUAL_UNIT as string) ?? 'DAYS',
      CALC_SETUP: (existingRecord?.CALC_SETUP as string) ?? 'PAY_UNIT',
      AMOUNT_CALC_FACTOR: (existingRecord?.AMOUNT_CALC_FACTOR as string) ?? 'MONTHLY_30',
      ACCRUAL_CALC_TYPE: (existingRecord?.ACCRUAL_CALC_TYPE as string) ?? '',
      CALC_AMT: (existingRecord?.CALC_AMT as string) ?? 'MONTHLY_30D',
      ACCRUAL_DEPENDENCY: (existingRecord?.ACCRUAL_DEPENDENCY as string) ?? 'NONE',
      CREDIT_TYPE: (existingRecord?.CREDIT_TYPE as string) ?? 'YEARLY',
      ALLOW_ENCASHMENT: (existingRecord?.ALLOW_ENCASHMENT as string) ?? 'N',
      AUTO_ENCASHMENT: (existingRecord?.AUTO_ENCASHMENT as string) ?? 'N',
      ENCASHMENT_COMP_ID: (existingRecord?.ENCASHMENT_COMP_ID as string) ?? '',
      REMARKS: (existingRecord?.REMARKS as string) ?? '',
      ACCR_STATUS: (existingRecord?.ACCR_STATUS as string) ?? 'A'
    },
    validate: (values) => {
      const errors: Partial<Record<keyof TAccrualTypeForm, string>> = {};
      if (!values.ACCRUAL_TYPE) errors.ACCRUAL_TYPE = 'Required';
      if (!values.ACCRUAL_DESC) errors.ACCRUAL_DESC = 'Required';
      if (!values.ACCRUAL_UNIT) errors.ACCRUAL_UNIT = 'Required';
      if (!values.AMOUNT_CALC_FACTOR) errors.AMOUNT_CALC_FACTOR = 'Required';
      if (!values.ACCR_STATUS) errors.ACCR_STATUS = 'Required';
      return errors;
    },
    onSubmit: async (values) => {
      await saveMutation.mutateAsync(values);
    }
  });

  // ===================== SAVE =====================
  const saveMutation = useMutation({
    mutationFn: async (values: TAccrualTypeForm) => {
      // NOTE: DynamicMutationParams has no `_edit_key` field — insert vs
      // update is being distinguished via the `parameter` name instead.
      // Confirm the exact insert/update proc names on the backend.
      return executeDynamicMutationColumn90({
        parameter: 'accrual_type_ins_upd',
        loginid,
        val1s1: values.COMPANY_CODE,
        val1s2: values.ACCRUAL_TYPE,
        val1s3: values.ACCRUAL_DESC,
        val1s4: values.ACCRUAL_SHORT_DESC,
        val1s5: values.ELIGIBLITY,
        val1s6: values.ACCRUAL_UNIT,
        val1s7: values.CALC_SETUP,
        val1s8: values.AMOUNT_CALC_FACTOR,
        val1s9: values.ACCRUAL_CALC_TYPE,
        val1s10: values.CALC_AMT,
        val1s11: values.ACCRUAL_DEPENDENCY,
        val1s12: values.CREDIT_TYPE,
        val1s13: values.ALLOW_ENCASHMENT,
        val1s14: values.AUTO_ENCASHMENT,
        val1s15: values.ENCASHMENT_COMP_ID,
        val1s16: values.REMARKS,
        val1s17: values.ACCR_STATUS
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accrual-type-header', companyCode] });
      onClose(true);
    }
  });

  const disabled = !!isViewMode;
  const isLoadingData = !!(isEdit && existingLoading);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <section className="commercial-editor grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]">
        {/* ===== Top Bar ===== */}
        <CardHeader className="border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-2">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {isViewMode ? 'View Document' : isEdit ? 'Edit Document' : 'New Document'}
              </p>
              <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                Accrual Type {accrual_type ? `— ${accrual_type}` : ''}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}>
                <X size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* ===== Scrollable Body ===== */}
        <div className="min-h-0 overflow-auto p-3">
          {isLoadingData ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Loading document...
            </div>
          ) : (
            <form id="accrual-type-form" onSubmit={formik.handleSubmit} className="w-full">
              <div className="w-full space-y-3">
                {/* ===== Header Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Header</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Accrual Type Information</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    {/* <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Company</label>
                      <Input value={companyCode} disabled />
                    </div> */}

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Accrual Type <span className="text-red-500">*</span>
                      </label>
                      <LookupField
                        value={formik.values.ACCRUAL_TYPE}
                        onChange={(val: string) => formik.setFieldValue('ACCRUAL_TYPE', val)}
                        disabled={disabled || isEdit}
                        valueField="ACCRUAL_TYPE"
                        displayFields={['ACCRUAL_TYPE', 'ACCRUAL_DESC']}
                        columns={[
                          { field: 'ACCRUAL_TYPE', header: 'Accrual Type' },
                          { field: 'ACCRUAL_DESC', header: 'Description' }
                        ]}
                        loadOptions={loadAccrualTypeOptions}
                      />
                      {formik.touched.ACCRUAL_TYPE && formik.errors.ACCRUAL_TYPE && (
                        <p className="mt-1 text-xs text-red-500">{formik.errors.ACCRUAL_TYPE}</p>
                      )}
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Applicable To</label>
                      <Select
                        name="ELIGIBLITY"
                        value={formik.values.ELIGIBLITY}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(applicableToData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-5">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Accrual Description <span className="text-red-500">*</span>
                      </label>
                      <Input
                        name="ACCRUAL_DESC"
                        value={formik.values.ACCRUAL_DESC}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      />
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Short Description</label>
                      <Input
                        name="ACCRUAL_SHORT_DESC"
                        value={formik.values.ACCRUAL_SHORT_DESC}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>

                {/* ===== Accrual Parameters Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Parameters</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Accrual Parameters</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Accrual Unit <span className="text-red-500">*</span>
                      </label>


                      <Select
                        name="ACCRUAL_UNIT"
                        value={formik.values.ACCRUAL_UNIT}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(accrualUnitData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Amount Calculation</label>
                      <Select
                        name="ACCRUAL_CALC_TYPE"
                        value={formik.values.ACCRUAL_CALC_TYPE}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(accrualCalcTypeData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Calculation Based on</label>
                      <Select
                        name="CALC_SETUP"
                        value={formik.values.CALC_SETUP}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(calcBasedOnData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Amount Calculation Factor</label>
                      <Select
                        name="CALC_AMT"
                        value={formik.values.CALC_AMT}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(calcAmtData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Unit Calculation Factor <span className="text-red-500">*</span>
                      </label>
                      <Select
                        name="AMOUNT_CALC_FACTOR"
                        value={formik.values.AMOUNT_CALC_FACTOR}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(unitCalcFactorData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Accrual Depend to</label>
                      <Select
                        name="ACCRUAL_DEPENDENCY"
                        value={formik.values.ACCRUAL_DEPENDENCY}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(accrualDependData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Credit Type</label>
                      <Select
                        name="CREDIT_TYPE"
                        value={formik.values.CREDIT_TYPE}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        <option value="">Select...</option>
                        {(creditTypeData ?? []).map((row: any, idx: number) => (
                          <option key={idx} value={row.VALUE_CODE}>
                            {row.VALUE_CODE} - {row.VALUE_DESC}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>

                {/* ===== Encashment Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Encashment</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Encashment Settings</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Allow Encashment</label>
                      <Select
                        name="ALLOW_ENCASHMENT"
                        value={formik.values.ALLOW_ENCASHMENT}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        {YES_NO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Auto Encashment</label>
                      <Select
                        name="AUTO_ENCASHMENT"
                        value={formik.values.AUTO_ENCASHMENT}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        {YES_NO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Encashment Pay Unit</label>
                      <LookupField
                        value={formik.values.ENCASHMENT_COMP_ID}
                        onChange={(val: string) => formik.setFieldValue('ENCASHMENT_COMP_ID', val)}
                        disabled={disabled}
                        valueField="PAY_COMP_ID"
                        displayFields={['PAY_COMP_ID', 'PAY_COMP_DESC']}
                        columns={[
                          { field: 'PAY_COMP_ID', header: 'Pay Component ID' },
                          { field: 'PAY_COMP_DESC', header: 'Description' }
                        ]}
                        loadOptions={loadPayUnitOptions}
                      />
                    </div>
                  </div>
                </div>

                {/* ===== Remarks + Status Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    {/* <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Additional</p> */}
                    {/* <h3 className="m-0 text-sm font-semibold leading-tight">Remarks &amp; Status</h3> */}
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <div className="col-span-5">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                      <textarea
                        name="REMARKS"
                        value={formik.values.REMARKS}
                        onChange={formik.handleChange}
                        disabled={disabled}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                      />
                    </div>

                    <div className="col-span-3 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <Select
                        name="ACCR_STATUS"
                        value={formik.values.ACCR_STATUS}
                        onChange={formik.handleChange}
                        disabled={disabled}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* ===== Bottom Action Bar ===== */}
        <div className="flex items-center justify-end gap-7 border-t bg-secondary/30 px-4 py-8">
          {!isViewMode && (
            <Button
              type="submit"
              form="accrual-type-form"
              variant="default"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}{' '}
              Submit
            </Button>
          )}
        </div>
      </section>
    </div>
  ); 
};

export default AddAccrualTypeForm;