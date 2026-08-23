import { useFormik } from 'formik';
import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Printer, Paperclip, X } from 'lucide-react';
import { FormikHelpers } from 'formik';
import { useAuth } from '../../../state/AuthContext';
import hrGradeComponentServiceInstance from './insUpdHrGrade';
import { Button } from '../../../components/ui/Button';
import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';
import GradePayUnitHeaderForm from './GradePayUnitHeaderForm';

/* ================= TYPES ================= */

export type THeaderDetailGrad = {
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

export type TGradeFormValues = {
  company_code: string;
  grade_code: string;
  grade_name: string;
  div_code: string;
  div_name: string;
  detail: THeaderDetailGrad[];
};

type TProps = {
  onClose: (refetchData?: boolean) => void;
  isEdit?: boolean;
  isViewMode?: boolean;
  div_code?: string;
  div_name?: string;
};
/* ================= INITIAL ================= */

const getInitialValues = (): TGradeFormValues => ({
  company_code: '',
  grade_code: '',
  grade_name: '',
  div_code: '',
  div_name: '',
  detail: []
});

/* ================= VALIDATION (plain function — no yup) ================= */

const validateForm = (values: TGradeFormValues) => {
  const errors: Partial<Record<keyof TGradeFormValues, string>> = {};
  if (!values.grade_code || !values.grade_code.trim()) {
    errors.grade_code = 'Grade is required';
  }
  return errors;
};

/* ================= MAIN ================= */

const AddGradePayUnitForm = ({ onClose, isViewMode = false, div_code, div_name }: TProps) => {
  const { user } = useAuth();
  const isDisabled = isViewMode;
  const [, setSelectedGrade] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ================= FILE UPLOAD ================= */
  const handleUploadPopup = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (selectedFile) handleFileUpload(selectedFile);
  };

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

  /* ================= SUBMIT ================= */
  const handleSubmit = async (values: TGradeFormValues, { setSubmitting }: FormikHelpers<TGradeFormValues>) => {
    try {
      if (!values.grade_code?.trim()) {
        setNotice({ type: 'error', message: 'Please select a Grade' });
        setSubmitting(false);
        return;
      }

      if (values.detail.length === 0) {
        setNotice({ type: 'error', message: 'Please add at least one row' });
        setSubmitting(false);
        return;
      }

      const payload = values.detail.map((r: any) => ({
        company_code: values.company_code,
        grade_code: values.grade_code,
        pay_comp_id: r.depend_pay_comp_type,
        min_pay_amt: Number(r.min_pay_amt || 0),
        medium_pay_amt: Number(r.medium_pay_amt || 0),
        max_pay_amt: Number(r.max_pay_amt || 0),
        reimbursement: r.reimbursement || '',
        min_reimb_amt: Number(r.min_reimb_amt || 0),
        max_reimb_amt: Number(r.max_reimb_amt || 0),
        remarks: r.remarks || '',
        emp_percent: Number(r.emp_percent || 0),
        status: r.status || 'A',
        user_id: user?.loginid ?? '',
        grade_paycomp_amt: Number(r.grade_paycomp_amt || 0),
        old_grade_paycomp_amt: Number(r.old_grade_paycomp_amt || 0),
        arrears_posted: r.arrears_posted || '',
        arrears_amt: Number(r.arrears_amt || 0),
        approved_date: r.approved_date || '',
        approval_status: r.approval_status || '',
        old_min_pay_amt: Number(r.old_min_pay_amt || 0),
        old_medium_pay_amt: Number(r.old_medium_pay_amt || 0),
        old_max_pay_amt: Number(r.old_max_pay_amt || 0),
        arrears_percent: Number(r.arrears_percent || 0),
        sort_order: Number(r.sort_order || 0)
      }));

      const result = await hrGradeComponentServiceInstance.upsertHrGradeComponentApi({
        data: payload,
        loginid: user?.loginid ?? 'ADMIN'
      });

      if (result.success) {
        setNotice({ type: 'success', message: 'Saved successfully.' });
        onClose(true);
      } else {
        setNotice({ type: 'error', message: result.message || 'Operation failed.' });
      }
    } catch (error: any) {
      console.error('ERROR:', error);
      setNotice({ type: 'error', message: 'An unexpected error occurred.' });
    }
  };

  /* ================= FORMIK ================= */
  const formik = useFormik<TGradeFormValues>({
    initialValues: getInitialValues(),
    validate: validateForm,
    onSubmit: handleSubmit
  });

  /* ================= EFFECTS ================= */
  useEffect(() => {
    if (user?.company_code) formik.setFieldValue('company_code', user.company_code);

  }, [user]);

  useEffect(() => {
    if (div_code) formik.setFieldValue('div_code', div_code);
    if (div_name) formik.setFieldValue('div_name', div_name);

  }, [div_code, div_name]);

  /* ================= RENDER ================= */
  return (
    <div className="w-full">
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <form onSubmit={formik.handleSubmit} className="w-full">
        <div className="grid w-full grid-cols-12 gap-4">
          <GradePayUnitHeaderForm formik={formik} disabled={isDisabled} onGradeSelect={(id: string) => setSelectedGrade(id)} />
        </div>

        <div className="mt-3">
          {/* Divider */}
          <div className="mb-3 mt-1 h-0.5 w-full bg-[#1677ff]" />

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
        </div>
      </form>
    </div>
  );
};

export default AddGradePayUnitForm;