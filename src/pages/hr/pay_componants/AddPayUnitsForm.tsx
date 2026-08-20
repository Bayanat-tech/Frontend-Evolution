import { useFormik } from 'formik';
import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Printer, Paperclip, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import PayUnitHeaderForm from './PayUnitHeaderForm';
import PayUnitDetailForm from './PayUnitDetailForm';
import hrPayComponentServiceInstance from './upsertHrPayComponent';
import { Button } from '../../../components/ui/Button';
import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';
import { CardHeader } from '../../../components/ui/Card';
function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ===================== TYPES =====================
export type TPayUnitDetail = {
  id: string;
  pay_comp_id_depend: string;
  percent: number;
  pay_comp_desc: string;
  sort_order: number;
  isEditMode: boolean;
  country_code: string;
  country_name: string;
};

export type TPayUnitFormValues = {
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
  detail: []
});

// ===================== HELPER — normalize a raw API row =====================
const normalizeHeader = (h: any): Partial<TPayUnitFormValues> => ({
  company_code: h.COMPANY_CODE ?? h.company_code ?? '',
  pay_comp_id: h.PAY_COMP_ID ?? h.pay_comp_id ?? '',
  pay_comp_desc: h.PAY_COMP_DESC ?? h.pay_comp_desc ?? '',
  pay_comp_short_desc: h.PAY_COMP_SHORT_DESC ?? h.pay_comp_short_desc ?? '',
  pay_comp_type: h.PAY_COMP_TYPE ?? h.pay_comp_type ?? '',
  pay_comp_earn_ded: h.PAY_COMP_EARN_DED ?? h.pay_comp_earn_ded ?? '',
  periodicity: h.PERIODICITY ?? h.periodicity ?? '',
  periodicity_desc: h.PERIODICITY_DESC ?? h.periodicity_desc ?? '',
  taxable: h.TAXABLE ?? h.taxable ?? '',
  taxable_desc: h.TAXABLE_DESC ?? h.taxable_desc ?? '',
  round_off_to: h.ROUND_OFF_TO ?? h.round_off_to ?? '',
  round_off_to_desc: h.ROUND_OFF_TO_DESC ?? h.round_off_to_desc ?? '',
  remarks: h.REMARKS ?? h.remarks ?? '',
  status: h.STATUS ?? h.status ?? '',
  status_desc: h.STATUS_DESC ?? h.status_desc ?? '',
  user_id: h.USER_ID ?? h.user_id ?? '',
  user_dt: h.USER_DT ?? h.user_dt ?? null,
  attendance_dependency: h.ATTENDANCE_DEPENDENCY ?? h.attendance_dependency ?? '',
  attendance_dependency_desc: h.ATTENDANCE_DEPENDENCY_DESC ?? h.attendance_dependency_desc ?? '',
  pay_comp_class: h.PAY_COMP_CLASS ?? h.pay_comp_class ?? '',
  pay_flag: h.PAY_FLAG ?? h.pay_flag ?? '',
  pay_flag_desc: h.PAY_FLAG_DESC ?? h.pay_flag_desc ?? '',
  pay_comp_dependent: h.PAY_COMP_DEPENDENT ?? h.pay_comp_dependent ?? '',
  pay_comp_dependent_desc: h.PAY_COMP_DEPENDENT_DESC ?? h.pay_comp_dependent_desc ?? '',
  type: h.TYPE ?? h.type ?? '',
  sort_order: h.SORT_ORDER ?? h.sort_order ?? 0,
  leave_paid: h.LEAVE_PAID ?? h.leave_paid ?? '',
  salary_link: h.SALARY_LINK ?? h.salary_link ?? '',
  div_code: h.DIV_CODE ?? h.div_code ?? '',
  div_name: h.DIV_NAME ?? h.div_name ?? ''
});

// ===================== MAIN COMPONENT =====================
const AddPayUnitsForm = ({ onClose, isEdit, isViewMode = false, pay_comp_id, div_code, div_name }: TProps) => {
  const { user } = useAuth();
  const [queryId] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = isViewMode;


  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const resolvedPayCompId =
    pay_comp_id && typeof pay_comp_id === 'string' && pay_comp_id.trim().length > 0 ? pay_comp_id.trim() : undefined;

  const isEditOrView = !!resolvedPayCompId;

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

  // ===================== SUBMIT =====================
  async function handleSubmit(values: TPayUnitFormValues) {
    try {
      const resolvedDivCode = values.div_code || div_code || '';
      if (!resolvedDivCode) {
        setNotice({ type: 'error', message: 'Division Code is missing. Please select a division.' });
        return;
      }

      const payload = {
        header: {
          company_code: user?.company_code ?? '',
          pay_comp_id: isEdit ? values.pay_comp_id : '',
          pay_comp_desc: values.pay_comp_desc,
          pay_comp_short_desc: values.pay_comp_short_desc,
          pay_comp_type: values.pay_comp_type,
          pay_comp_earn_ded: values.pay_comp_earn_ded,
          periodicity: values.periodicity,
          taxable: values.taxable,
          round_off_to: Number(values.round_off_to) || 0,
          remarks: values.remarks,
          status: values.status,
          user_id: user?.loginid ?? '',
          user_dt: new Date(),
          attendance_dependency: values.attendance_dependency,
          pay_comp_class: values.pay_comp_class,
          pay_flag: values.pay_flag,
          pay_comp_dependent: values.pay_comp_dependent,
          type: values.type,
          sort_order: Number(values.sort_order) || 0,
          leave_paid: values.leave_paid,
          salary_link: values.salary_link,
          div_code: resolvedDivCode
        },
        details: values.detail.map((row, index) => ({
          company_code: user?.company_code ?? '',
          pay_comp_id: values.pay_comp_id,
          pay_comp_id_depend: row.pay_comp_id_depend,
          percent: Number(row.percent) || 0,
          pay_comp_desc: row.pay_comp_desc,
          sort_order: index + 1,
          user_id: user?.loginid ?? '',
          user_dt: new Date()
        }))
      };

      const result = await hrPayComponentServiceInstance.insUpdHrPayComponent(payload);
      if (result.success) {
        setNotice({ type: 'success', message: 'Saved successfully.' });
        onClose(true);
      } else {
        setNotice({ type: 'error', message: result.message || 'Failed to save.' });
      }
    } catch (err) {
      console.error('handleSubmit error:', err);
      setNotice({ type: 'error', message: 'An unexpected error occurred.' });
    }
  }

  // ===================== SET COMPANY + DIV on mount (ADD mode only) =====================
  useEffect(() => {
    if (user?.company_code) {
      formik.setFieldValue('company_code', user.company_code);
    }

    if (!isEditOrView) {
      if (div_code) formik.setFieldValue('div_code', div_code);
      if (div_name) formik.setFieldValue('div_name', div_name);
    }

  }, []);

  // ===================== FETCH HEADER =====================
  const {
    data: payUnitHeaderData,
    isLoading: headerLoading,
    isSuccess: headerSuccess
  } = useQuery({
    queryKey: ['pay_unit_header_data', resolvedPayCompId, queryId],
    queryFn: async () => {
      const res = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_PAY_UNITS',
        code1: user?.company_code ?? '',
        code2: resolvedPayCompId ?? ''
      });

      const allRows = Array.isArray(res) ? res : [];

      const filtered = allRows.filter((row: any) => {
        const id = row.PAY_COMP_ID ?? row.pay_comp_id ?? '';
        return id === resolvedPayCompId;
      });

      return filtered;
    },
    enabled: !!resolvedPayCompId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always'
  });

  // ===================== FETCH DETAIL =====================
  const {
    data: payUnitDetailData,
    isLoading: detailLoading,
    isSuccess: detailSuccess
  } = useQuery({
    queryKey: ['pay_unit_detail_data', resolvedPayCompId, queryId],
    queryFn: async () => {
      const res = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_PAY_COMP_DEPEND',
        code1: user?.company_code ?? '',
        code2: resolvedPayCompId ?? ''
      });
      return Array.isArray(res) ? res : [];
    },
    enabled: !!resolvedPayCompId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always'
  });

  // ===================== POPULATE FORM FROM HEADER DATA =====================
  useEffect(() => {
    if (!headerSuccess || !payUnitHeaderData || payUnitHeaderData.length === 0) return;

    const h = payUnitHeaderData[0];
    const normalized = normalizeHeader(h);
    formik.setValues({
      ...getInitialValues(),
      ...normalized,
      company_code: normalized.company_code || user?.company_code || '',
      detail: formik.values.detail
    });

  }, [headerSuccess, payUnitHeaderData]);

  // ===================== POPULATE FORM FROM DETAIL DATA =====================
  useEffect(() => {
    if (!detailSuccess || !payUnitDetailData || payUnitDetailData.length === 0) return;
    const details: TPayUnitDetail[] = payUnitDetailData.map((row: any) => ({
      id: newId(),
      pay_comp_id_depend: row.PAY_COMP_ID_DEPEND ?? row.pay_comp_id_depend ?? '',
      percent: row.PERCENT ?? row.percent ?? 0,
      pay_comp_desc: row.PAY_COMP_DESC ?? row.pay_comp_desc ?? '',
      sort_order: row.SORT_ORDER ?? row.sort_order ?? 0,
      isEditMode: true,
      country_code: row.COUNTRY_CODE ?? row.country_code ?? '',
      country_name: row.COUNTRY_NAME ?? row.country_name ?? ''
    }));
    formik.setFieldValue('detail', details);
  }, [detailSuccess, payUnitDetailData]);

  // ===================== LOADING STATE =====================
  const isLoadingData = isEditOrView && (headerLoading || detailLoading);

  // ===================== RENDER =====================
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <section className="commercial-editor grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]">
        <CardHeader className="border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {isViewMode ? 'View Document' : isEdit ? 'Edit Document' : 'New Document'}
              </p>
              <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                Pay Unit {resolvedPayCompId ? `— ${resolvedPayCompId}` : ''}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleUploadPopup}>
                <Paperclip size={15} /> Attach
              </Button>
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}>
                <X size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="min-h-0 overflow-auto p-3">
          <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

          {isLoadingData ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">
              Loading document...
            </div>
          ) : (
            <form id="pay-unit-form" onSubmit={formik.handleSubmit} className="w-full">
              <div className="w-full space-y-3">
                {/* ===== Header Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Header</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Pay Unit Information</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <PayUnitHeaderForm formik={formik} isEdit={isEdit} disabled={isDisabled} />
                  </div>
                </div>

                {/* ===== Details Section ===== */}
                <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Details</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Pay Unit Dependents</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <PayUnitDetailForm formik={formik} disabled={isDisabled} />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-end gap-2 border-t bg-secondary/60 px-4 py-2">
          {!isViewMode && (
            <Button type="submit" form="pay-unit-form" variant="default" disabled={isDisabled || formik.isSubmitting}>
              {formik.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Submit
            </Button>
          )}
        </div>

        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
      </section>
    </div>
  );
};

export default AddPayUnitsForm;