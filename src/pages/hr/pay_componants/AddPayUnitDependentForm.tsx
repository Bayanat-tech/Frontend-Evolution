import { useFormik } from 'formik';
import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Printer, Paperclip, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import PayUnitDependHeaderForm from './PayUnitDependHeaderForm';
import PayUnitDependDetailForm from './PayUnitDependDetailForm';
import hrPayCompDependServiceInstance, { THrPayCompDependDetail, THrPayCompDependHeader } from './insUpdHrPayCompDepend';
import { Button } from '../../../components/ui/Button';
import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';

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
export type TPayUnitDetail = {
  id: string;
  pay_comp_id_depend: string;
  percent: number;
  pay_comp_desc: string;
  remarks: string;
  isEditMode: boolean;
  country_code: string;
  country_name: string;
  status: string;
  limit: number;
  age: number;
  amount: number;
  nationality: string;
};

export type THeaderDetail = {
  id: string;
  depend_pay_comp_type: string;
  depend_pay_comp_desc: string;
  depend_pay_comp_short_desc: string;
  min_pay_amt?: number;
  percent: number;
  medium_pay_amt?: number;
  max_pay_amt?: number;
  approved_date?: string;
  emp_percent: number;
  status: string;
  status_desc: string;
  remarks: string;
  isEditMode?: boolean;
};

export type TCountryOption = {
  country_code: string;
  country_name: string;
  nationality: string;
};

export type TPayUnitFormValues = {
  depend_pay_comp_type: string;
  percent: number;
  emp_percent: number;
  company_code: string;
  pay_comp_id: string;
  pay_comp_desc: string;
  pay_comp_short_desc: string;
  pay_comp_type: string;
  pay_comp_earn_ded: string;
  periodicity: string;
  periodicity_desc: string;
  taxable: string;
  taxable_desc: string;
  round_off_to: string;
  round_off_to_desc: string;
  remarks: string;
  status: string;
  status_desc: string;
  user_id: string;
  user_dt: string | null;
  attendance_dependency: string;
  attendance_dependency_desc: string;
  pay_comp_class: string;
  pay_flag: string;
  pay_flag_desc: string;
  pay_comp_dependent: string;
  pay_comp_dependent_desc: string;
  type: string;
  sort_order: number;
  leave_paid: string;
  salary_link: string;
  div_code: string;
  div_name: string;
  detail: TPayUnitDetail[];
  headerDetail: THeaderDetail[];
};

type TProps = {
  onClose: (refetchData?: boolean) => void;
  isEdit: boolean;
  isViewMode?: boolean;
  pay_comp_id?: string;
  onDivisionChange?: (divCode: string) => void;
  div_code?: string;
  div_name?: string;
};

// ===================== VALIDATION (plain function — no yup) =====================
const validateForm = (values: TPayUnitFormValues) => {
  const errors: Partial<Record<keyof TPayUnitFormValues, string>> = {};
  if (!values.pay_comp_desc || !values.pay_comp_desc.trim()) {
    errors.pay_comp_desc = 'Pay Component Description is required';
  }
  return errors;
};

// ===================== INITIAL VALUES =====================
const getInitialValues = (): TPayUnitFormValues => ({
  company_code: '',
  pay_comp_id: '',
  pay_comp_desc: '',
  pay_comp_short_desc: '',
  pay_comp_type: '',
  pay_comp_earn_ded: '',
  periodicity: '',
  periodicity_desc: '',
  taxable: '',
  taxable_desc: '',
  round_off_to: '',
  round_off_to_desc: '',
  remarks: '',
  status: '',
  status_desc: '',
  user_id: '',
  user_dt: new Date().toISOString().split('T')[0],
  attendance_dependency: '',
  attendance_dependency_desc: '',
  pay_comp_class: '',
  pay_flag: '',
  pay_flag_desc: '',
  pay_comp_dependent: '',
  pay_comp_dependent_desc: '',
  type: '',
  sort_order: 0,
  leave_paid: '',
  salary_link: '',
  div_code: '',
  div_name: '',
  depend_pay_comp_type: '',
  percent: 0,
  emp_percent: 0,
  detail: [],
  headerDetail: []
});

// ===================== MAIN COMPONENT =====================
const AddPayUnitDependentForm = ({ onClose, isEdit, isViewMode = false, pay_comp_id, div_code, div_name }: TProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = isViewMode;

  // Local notice state — replaces the missing Redux openSnackbar/dispatch
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [selectedPayCompId, setSelectedPayCompId] = useState<string>(
    pay_comp_id && pay_comp_id.trim().length > 0 ? pay_comp_id.trim() : ''
  );

  // ===================== FILE UPLOAD =====================
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (selectedFile) handleFileUpload(selectedFile);
  };

  const handleUploadPopup = () => fileInputRef.current?.click();

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed!');
      const result = await response.json();
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Error during upload:', error);
    }
  };

  // ===================== FORMIK =====================
  const formik = useFormik<TPayUnitFormValues>({
    initialValues: getInitialValues(),
    enableReinitialize: false,
    validate: validateForm,
    onSubmit: handleSubmit
  });

  async function handleSubmit(values: TPayUnitFormValues): Promise<void> {
    try {
      if (!values.pay_comp_id?.trim()) {
        setNotice({ type: 'error', message: 'Please select Pay Unit' });
        return;
      }
      const headerDetails = values.headerDetail ?? [];
      if (headerDetails.length === 0) {
        setNotice({ type: 'error', message: 'Please add at least one Depend To Pay Unit row' });
        return;
      }
      if (values.detail.length === 0) {
        setNotice({ type: 'error', message: 'Please add at least one detail row' });
        return;
      }

      const nationalities = values.detail.map((d) => d.nationality).filter(Boolean);
      const uniqueNationalities = new Set(nationalities);

      if (nationalities.length !== uniqueNationalities.size) {
        setNotice({ type: 'error', message: 'Duplicate nationality found in detail rows. Please remove duplicates before submitting.' });
        return;
      }

      const headers: THrPayCompDependHeader[] = headerDetails.map((h) => ({
        company_code: user?.company_code ?? '',
        pay_comp_id: values.pay_comp_id.trim(),
        pay_comp_id_depend: h.depend_pay_comp_type?.trim() ?? '',
        percent: Number(h.percent) || 0,
        empr_percent: Number(h.emp_percent) || 0,
        remarks: h.remarks || undefined,
        status_flag: h.status || 'A',
        user_id: user?.loginid ?? '',
        user_dt: new Date()
      }));

      const details: THrPayCompDependDetail[] = values.detail.map((d: TPayUnitDetail) => ({
        company_code: user?.company_code ?? '',
        pay_comp_id: values.pay_comp_id.trim(),
        pay_comp_id_depend: headerDetails[0]?.depend_pay_comp_type?.trim() ?? '',
        nationality: d.nationality || d.country_code || '',
        age: Number(d.age) || 0,
        status: d.status || 'A',
        remarks: d.remarks || undefined,
        amt_limit: Number(d.amount) || 0,
        user_id: user?.loginid ?? '',
        user_dt: new Date()
      }));

      console.log('ALL HEADERS PAYLOAD ✨====>', headers);
      console.log('DETAILS PAYLOAD➕ ====>', details);

      const result = await hrPayCompDependServiceInstance.insUpdHrPayCompDepend({
        header: headers,
        details
      });

      if (result.success) {
        setNotice({ type: 'success', message: 'Saved successfully.' });
        onClose(true);
      } else {
        setNotice({ type: 'error', message: result.message || 'Failed to save.' });
      }
    } catch (error: any) {
      console.error('ERROR:', error);
      setNotice({ type: 'error', message: 'An unexpected error occurred.' });
    }
  }

  // ===================== SET COMPANY + DIV on mount =====================
  useEffect(() => {
    if (user?.company_code) formik.setFieldValue('company_code', user.company_code);
    if (div_code) formik.setFieldValue('div_code', div_code);
    if (div_name) formik.setFieldValue('div_name', div_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===================== HANDLER — pay unit dropdown select =====================
  const handlePayCompIdSelect = async (id: string) => {
    if (!id) return;
    formik.setFieldValue('detail', []);
    formik.setFieldValue('headerDetail', []);
    formik.setFieldValue('pay_comp_id', id);
    await queryClient.invalidateQueries({ queryKey: ['pay_unit_header_data', id] });
    await queryClient.invalidateQueries({ queryKey: ['pay_unit_detail_data', id] });
    setSelectedPayCompId(id);
  };

  // ===================== FETCH COUNTRY LIST =====================
  const { data: countryList = [] } = useQuery({
    queryKey: ['country_options', user?.company_code],
    queryFn: async (): Promise<TCountryOption[]> => {
      const res = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_PAYUNIT_CountryList',
        code1: user?.company_code ?? '',
        code2: user?.loginid ?? ''
      });
      const rows = (res ?? []) as unknown as Record<string, unknown>[];
      return rows.map(uppercaseKeys).map(
        (row: any): TCountryOption => ({
          country_code: row.COUNTRY_CODE ?? '',
          country_name: row.COUNTRY_NAME ?? '',
          nationality: row.NATIONALITY ?? ''
        })
      );
    },
    enabled: !!user?.company_code,
    staleTime: 5 * 60 * 1000
  });

  // ===================== FETCH HEADER =====================
  const { data: payUnitHeaderData, isLoading: dataLoading } = useQuery({
    queryKey: ['pay_unit_header_data', selectedPayCompId],
    queryFn: async () => {
      console.log('FETCHING HEADER FOR ====>', selectedPayCompId);
      const res = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_PAY_UNIT',
        code1: user?.company_code ?? '',
        code2: selectedPayCompId
      });
      const rows = (res ?? []) as unknown as Record<string, unknown>[];
      return rows.map(uppercaseKeys);
    },
    enabled: !!selectedPayCompId && !!user?.loginid,
    staleTime: 0,
    gcTime: 0
  });

  // ===================== FETCH DETAIL =====================
  const { data: payUnitDetailData, isLoading: detailLoading } = useQuery({
    queryKey: ['pay_unit_detail_data', selectedPayCompId],
    queryFn: async () => {
      console.log('FETCHING DETAIL FOR ====>', selectedPayCompId);
      const res = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_DEPEND',
        code1: user?.company_code ?? '',
        code2: selectedPayCompId
      });
      const rows = (res ?? []) as unknown as Record<string, unknown>[];
      return rows.map(uppercaseKeys);
    },
    enabled: !!selectedPayCompId && !!user?.loginid,
    staleTime: 0,
    gcTime: 0
  });

  // ===================== POPULATE FORM =====================
  useEffect(() => {
    if (!selectedPayCompId) return;
    if (dataLoading || detailLoading) return;
    if (!countryList || countryList.length === 0) return;

    const headerDetails: THeaderDetail[] = (payUnitHeaderData ?? []).map((row: any) => ({
      id: newId(),
      depend_pay_comp_type: row.PAY_COMP_ID_DEPEND ?? '',
      depend_pay_comp_desc: '',
      depend_pay_comp_short_desc: '',
      percent: row.PERCENT ?? 0,
      emp_percent: row.EMPR_PERCENT ?? 0,
      status: row.STATUS_FLAG ?? '',
      status_desc: '',
      remarks: row.REMARKS ?? '',
      isEditMode: true
    }));

    const details: TPayUnitDetail[] = (payUnitDetailData ?? []).map((row: any) => {
      const nationality = row.NATIONALITY ?? '';
      const country = countryList.find((c: TCountryOption) => c.country_code === nationality);

      return {
        id: newId(),
        pay_comp_id_depend: row.PAY_COMP_ID_DEPEND ?? '',
        percent: row.AMT_LIMIT ?? 0,
        pay_comp_desc: '',
        remarks: row.REMARKS ?? '',
        isEditMode: true,
        country_code: country?.country_code ?? nationality,
        country_name: country?.country_name ?? '',
        status: row.STATUS ?? '',
        limit: 0,
        age: row.AGE ?? 0,
        amount: row.AMT_LIMIT ?? 0,
        nationality: nationality
      };
    });

    console.log('headerDetails ====>', headerDetails);
    console.log('details ====>', details);

    formik.setFieldValue('pay_comp_id', selectedPayCompId);
    formik.setFieldValue('headerDetail', headerDetails);
    formik.setFieldValue('detail', details);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payUnitHeaderData, payUnitDetailData, countryList, selectedPayCompId]);

  // ===================== LOADING STATE =====================
  const isLoadingData = !!selectedPayCompId && (dataLoading || detailLoading);

  // ===================== RENDER =====================
  return (
    <div className="w-full">
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {isLoadingData && (
        <div className="flex items-center justify-center gap-1 py-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading data...</span>
        </div>
      )}

      <form onSubmit={formik.handleSubmit} className="w-full">
        <div className="w-full space-y-3 pt-1">
          <div className="grid w-full grid-cols-12 gap-4 px-2">
            <PayUnitDependHeaderForm formik={formik} isEdit={isEdit} disabled={isDisabled} onPayCompIdSelect={handlePayCompIdSelect} />
          </div>

          <div className="grid w-full grid-cols-12 gap-4 px-2">
            <PayUnitDependDetailForm formik={formik} disabled={isDisabled} />
          </div>
        </div>

        <div className="mb-2 mt-4 h-0.5 w-full bg-[#1677ff]" />

        <div className="flex items-center justify-between px-2 pb-1">
          <div>
            {!isViewMode && (
              <Button type="submit" variant="default" disabled={isDisabled || formik.isSubmitting}>
                {formik.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}{' '}
                Submit
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border">
              <Button type="button" variant="outline" title="Print & View" className="rounded-none border-0 border-r">
                <Printer size={15} />
              </Button>
              <Button type="button" variant="outline" title="Attach & View" className="rounded-none border-0 border-r" onClick={handleUploadPopup}>
                <Paperclip size={15} />
              </Button>
              <Button type="button" variant="outline" title="Exit" className="rounded-none border-0" onClick={() => onClose()}>
                <X size={15} />
              </Button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddPayUnitDependentForm;