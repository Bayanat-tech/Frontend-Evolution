// src/pages/hr/payunits/AddPayUnitsForm.tsx
//
// Pay Unit form — new UI (modelled on ProductWmsForm):
//  • forwardRef + useImperativeHandle → page header Save / Attach buttons call save() / attach()
//  • No fixed full-screen overlay, own header or bottom action bar — the page header owns those
//  • Header / Dependents child forms render their own Freight SectionPanels
//  • toast feedback instead of AutoDismissAlert

import { useFormik } from 'formik';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import { useToast } from '../../../components/ui/AlertToast';
import PayUnitHeaderForm from './PayUnitHeaderForm';
import PayUnitDetailForm from './PayUnitDetailForm';
import hrPayComponentServiceInstance from './upsertHrPayComponent';

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

/* ✅ Expose save() / attach() to the parent (header buttons) */
export type PayUnitFormHandle = {
  save: () => Promise<void>;
  attach: () => void;
};

type TProps = {
  onClose: (refetchData?: boolean) => void;
  isEdit: boolean;
  isViewMode?: boolean;
  pay_comp_id?: string;
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

// ===================== MAIN COMPONENT (forwardRef so parent can trigger save / attach) =====================
const AddPayUnitsForm = forwardRef<PayUnitFormHandle, TProps>(function AddPayUnitsForm(
  { onClose, isEdit, isViewMode = false, pay_comp_id, div_code, div_name },
  ref
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queryId] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = isViewMode;

  const resolvedPayCompId =
    pay_comp_id && typeof pay_comp_id === 'string' && pay_comp_id.trim().length > 0 ? pay_comp_id.trim() : undefined;

  const isEditOrView = !!resolvedPayCompId;

  // ===================== FILE UPLOAD =====================
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (selectedFile) void handleFileUpload(selectedFile);
    event.target.value = ''; // allow re-selecting the same file
  };

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed!');
      await response.json();
      toast.success(`${file.name} uploaded successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
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
        toast.warning('Division Code is missing. Please select a division.');
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
        toast.success('Pay unit saved successfully');
        onClose(true);
      } else {
        toast.error(result.message || 'Failed to save pay unit');
      }
    } catch (err) {
      console.error('handleSubmit error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  /* ✅ Expose save() / attach() to parent.
     save() validates first so a failed validation surfaces as a toast
     (formik.submitForm then marks every field touched so inline errors show). */
  useImperativeHandle(ref, () => ({
    save: async () => {
      const errors = await formik.validateForm();
      const first = Object.values(errors)[0];
      if (first) toast.warning(String(first));
      await formik.submitForm();
    },
    attach: () => fileInputRef.current?.click()
  }));

  // ===================== SET COMPANY + DIV on mount (ADD mode only) =====================
  useEffect(() => {
    if (user?.company_code) {
      formik.setFieldValue('company_code', user.company_code);
    }

    if (!isEditOrView) {
      if (div_code) formik.setFieldValue('div_code', div_code);
      if (div_name) formik.setFieldValue('div_name', div_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSuccess, payUnitDetailData]);

  // ===================== LOADING STATE =====================
  const isLoadingData = isEditOrView && (headerLoading || detailLoading);

  // ===================== RENDER =====================
  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      {isLoadingData ? (
        <div className="grid min-h-[420px] place-items-center rounded-md border bg-card text-sm text-muted-foreground shadow-sm">
          Loading document...
        </div>
      ) : (
        <form id="pay-unit-form" onSubmit={formik.handleSubmit} className="grid w-full gap-3">
          {/* Header + Dependents render their own Freight SectionPanels */}
          <PayUnitHeaderForm formik={formik} isEdit={isEdit} disabled={isDisabled} />
          <PayUnitDetailForm formik={formik} disabled={isDisabled} />

          {/* hidden submit so Enter inside a text input saves */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}

      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
    </div>
  );
});

export default AddPayUnitsForm;