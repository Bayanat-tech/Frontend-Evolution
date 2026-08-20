import { useFormik } from 'formik';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { CardHeader } from '../../../components/ui/Card';
import { AutoDismissAlert } from '../../../components/ui/AutoDismissAlert';
import { useAuth } from '../../../state/AuthContext';
import { executeDynamicMutationColumn90, getDynamicLookup } from '../../../api/lookups';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
    const out: Record<string, unknown> = {};
    for (const key in row) {
        out[key.toUpperCase()] = row[key];
    }
    return out as T;
}

export type TAttendanceTypeForm = {
    COMPANY_CODE: string;
    ATTEND_TYPE: string;
    ATTEND_DESC: string;
    ATTEND_SHORT_DESC: string;
    ATTENDANCE_CATEGORY: string;
    ATTEND_PERIODICITY: string;
    STATUS: string;
    REMARKS: string;
};

type Props = {
    onClose: (refetch?: boolean) => void;
    isEdit?: boolean;
    isViewMode?: boolean;
    company_code: string;
    attend_type?: string; // required when isEdit = true
};

const AddAttendanceTypeForm = ({ onClose, isEdit, isViewMode, company_code, attend_type }: Props) => {
    const { user } = useAuth();
    const loginid = user?.loginid ?? '';
    const queryClient = useQueryClient();
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // ===================== FETCH EXISTING RECORD (edit/view mode) =====================
    const { data: existingRecord, isLoading: existingLoading } = useQuery({
        queryKey: ['attendance-type-detail', company_code, attend_type],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'PAY_COMPONENT_ATTENDANCE_TYPE',
                code1: company_code,
                code2: attend_type
            });
            const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
            const upperRows = rawRows.map(uppercaseKeys);
            // Backend WHEN case may return all company rows regardless of code2,
            // so filter client-side to guarantee the correct record is picked.
            const match = upperRows.find((row: any) => row.ATTEND_TYPE === attend_type);
            return match ?? upperRows[0] ?? null;
        },
        enabled: !!(isEdit && company_code && attend_type)
    });

    // ===================== STATUS DROPDOWN =====================
    const { data: statusOptions } = useQuery({
        queryKey: ['attendance-status-options', company_code],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'PAY_COMPONENT_STATUS_CodeValue',
                code1: company_code
            });
            const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
            return rawRows.map(uppercaseKeys).map((r: any) => ({
                value_code: r.VALUE_CODE ?? '',
                value_desc: r.VALUE_DESC ?? ''
            }));
        },
        enabled: !!company_code
    });


    // ===================== CATEGORY DROPDOWN =====================
    const { data: categoryOptions } = useQuery({
        queryKey: ['attendance-category-options', company_code],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'PAY_COMPONENT_ATTENDANCE_CATEGORY',
                code1: company_code
            });
            const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
            return rawRows.map(uppercaseKeys).map((r: any) => ({
                value_code: r.VALUE_CODE ?? '',
                value_desc: r.VALUE_DESC ?? ''
            }));
        },
        enabled: !!company_code
    });


    // ===================== PERIODICITY DROPDOWN =====================
    const { data: periodicityOptions } = useQuery({
        queryKey: ['attendance-periodicity-options', company_code],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'PAY_COMPONENT_ATTENDANCE_PERIODICITY',
                code1: company_code
            });
            const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
            return rawRows.map(uppercaseKeys).map((r: any) => ({
                value_code: r.VALUE_CODE ?? '',
                value_desc: r.VALUE_DESC ?? ''
            }));
        },
        enabled: !!company_code
    });

    // ===================== FORM =====================
    const formik = useFormik<TAttendanceTypeForm>({
        enableReinitialize: true,
        initialValues: {
            COMPANY_CODE: company_code,
            ATTEND_TYPE: (existingRecord?.ATTEND_TYPE as string) ?? '',
            ATTEND_DESC: (existingRecord?.ATTEND_DESC as string) ?? '',
            ATTEND_SHORT_DESC: (existingRecord?.ATTEND_SHORT_DESC as string) ?? '',
            ATTENDANCE_CATEGORY: (existingRecord?.ATTENDANCE_CATEGORY as string) ?? '',
            ATTEND_PERIODICITY: (existingRecord?.ATTEND_PERIODICITY as string) ?? '',
            STATUS: (existingRecord?.STATUS as string) ?? 'A',
            REMARKS: (existingRecord?.REMARKS as string) ?? ''
        },
        validate: (values) => {
            const errors: Partial<Record<keyof TAttendanceTypeForm, string>> = {};
            if (isEdit && !values.ATTEND_TYPE) errors.ATTEND_TYPE = 'Required';
            if (!values.ATTEND_DESC) errors.ATTEND_DESC = 'Required';
            return errors;
        },
        onSubmit: async (values) => {
            await saveMutation.mutateAsync(values);
        }
    });

    // ===================== SAVE =====================
    // NOTE: backend WHEN block for 'ATTENDANCE_TYPE_ins_upd' still needs to be
    // created — same count-check pattern used for 'Payroll_accountsetup_ins_upd'.
    const saveMutation = useMutation({
        mutationFn: async (values: TAttendanceTypeForm) => {
            return executeDynamicMutationColumn90({
                parameter: 'attendance_type_ins_upd',
                loginid,
                val1s1: values.COMPANY_CODE,
                val1s2: values.ATTEND_TYPE,
                val1s3: values.ATTEND_DESC,
                val1s4: values.ATTEND_SHORT_DESC,
                val1s5: values.ATTENDANCE_CATEGORY,
                val1s6: values.ATTEND_PERIODICITY,
                val1s7: values.STATUS,
                val1s8: values.REMARKS
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-types'] });
            setNotice({ type: 'success', message: 'Attendance type saved successfully.' });
            setTimeout(() => onClose(true), 1200); // let the success message show before closing
        },
        onError: () => {
            setNotice({ type: 'error', message: 'Failed to save attendance type.' });
        }
    });

    const disabled = !!isViewMode;
    const isLoadingData = !!(isEdit && existingLoading);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <section className="commercial-editor grid w-full max-w-6xl h-[50dvh] grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg bg-background shadow-xl">
                <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

                {/* ===== Top Bar ===== */}
                <CardHeader className="border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
                    <div className="flex min-h-10 items-center justify-between gap-3">
                        <div>
                            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                                {isViewMode ? 'View Document' : isEdit ? 'Edit Document' : 'New Document'}
                            </p>
                            <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                                Attendance Type {attend_type ? `— ${attend_type}` : ''}
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
                        <form id="attendance-type-form" onSubmit={formik.handleSubmit} className="w-full">
                            <div className="w-full space-y-3">
                                {/* ===== Header Section ===== */}
                                {/* <div className="w-full rounded-md border bg-card">
                  <div className="border-b bg-secondary/40 px-3 py-1.5">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Header</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Company</h3>
                  </div>
                  <div className="grid w-full grid-cols-12 gap-4 p-3">
                    <div className="col-span-6 md:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Company</label>
                      <Input value={company_code} disabled />
                    </div>
                  </div>
                </div> */}

                                {/* ===== Attendance Type Section ===== */}
                                <div className="w-full rounded-md border bg-card">
                                    <div className="border-b bg-secondary/40 px-3 py-1.5">
                                        {/* <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">Setup</p> */}
                                        <h3 className="m-0 text-sm font-semibold leading-tight">Attendance Type Details</h3>
                                    </div>
                                    <div className="grid w-full grid-cols-12 gap-4 p-3">
                                        <div className="col-span-6 md:col-span-3">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                                Attend Type {isEdit && <span className="text-red-500">*</span>}
                                            </label>
                                            <Input
                                                name="ATTEND_TYPE"
                                                value={formik.values.ATTEND_TYPE}
                                                onChange={formik.handleChange}
                                                disabled
                                                placeholder={!isEdit ? 'Auto-generated' : ''}
                                            />
                                            {formik.touched.ATTEND_TYPE && formik.errors.ATTEND_TYPE && (
                                                <p className="mt-1 text-xs text-red-500">{formik.errors.ATTEND_TYPE}</p>
                                            )}
                                        </div>

                                        <div className="col-span-12 md:col-span-6">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                                Description <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                name="ATTEND_DESC"
                                                value={formik.values.ATTEND_DESC}
                                                onChange={formik.handleChange}
                                                disabled={disabled}
                                            />
                                            {formik.touched.ATTEND_DESC && formik.errors.ATTEND_DESC && (
                                                <p className="mt-1 text-xs text-red-500">{formik.errors.ATTEND_DESC}</p>
                                            )}
                                        </div>

                                        <div className="col-span-12 md:col-span-3">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">Short Description</label>
                                            <Input
                                                name="ATTEND_SHORT_DESC"
                                                value={formik.values.ATTEND_SHORT_DESC}
                                                onChange={formik.handleChange}
                                                disabled={disabled}
                                            />
                                        </div>

                                        {/* NOTE: confirm if Category/Periodicity should be dropdowns
                        from a code-value master rather than free text. */}
                                        <div className="col-span-12 md:col-span-4">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                                            <Select
                                                name="ATTENDANCE_CATEGORY"
                                                value={formik.values.ATTENDANCE_CATEGORY}
                                                onChange={formik.handleChange}
                                                disabled={disabled}
                                            >
                                                <option value="">Select</option>
                                                {(categoryOptions ?? []).map((opt) => (
                                                    <option key={opt.value_code} value={opt.value_code}>
                                                        {opt.value_desc}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>

                                        <div className="col-span-12 md:col-span-4">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">Periodicity</label>
                                            <Select
                                                name="ATTEND_PERIODICITY"
                                                value={formik.values.ATTEND_PERIODICITY}
                                                onChange={formik.handleChange}
                                                disabled={disabled}
                                            >
                                                <option value="">Select</option>
                                                {(periodicityOptions ?? []).map((opt) => (
                                                    <option key={opt.value_code} value={opt.value_code}>
                                                        {opt.value_desc}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>

                                        <div className="col-span-12 md:col-span-4">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                                            <Select name="STATUS" value={formik.values.STATUS} onChange={formik.handleChange} disabled={disabled}>
                                                <option value="">Select</option>
                                                {(statusOptions ?? []).map((opt) => (
                                                    <option key={opt.value_code} value={opt.value_code}>
                                                        {opt.value_desc}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>

                                        <div className="col-span-12">
                                            <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                                            <textarea
                                                name="REMARKS"
                                                value={formik.values.REMARKS}
                                                onChange={formik.handleChange}
                                                disabled={disabled}
                                                rows={3}
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* ===== Bottom Action Bar ===== */}
                <div className="flex items-center justify-end gap-2 border-t bg-secondary/60 px-4 py-2">
                    {!isViewMode && (
                        <Button type="submit" form="attendance-type-form" variant="default" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}{' '}
                            Submit
                        </Button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AddAttendanceTypeForm;