import { useFormik } from "formik";
import {
  ChevronDown, ChevronUp, FileText, List, Plus, StickyNote, Trash2, UserCheck,
} from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState,
  type ReactNode,
} from "react";
import hrSalaryAdvDedServiceInstance from "../../../../api/hr/upsertHrSalaryAdvDed";
import { getDynamicLookup } from "../../../../api/lookups";
import { useToast } from "../../../../components/ui/AlertToast";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { LookupField } from "../../../../components/ui/LookupField";
import { Select } from "../../../../components/ui/Select";
import { useAuth } from "../../../../state/AuthContext";
import type { SalaryAdditionDeductionDetailRow } from "./types";

export type SalaryFormHandle = {
  save: () => Promise<void>;
};

export type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: any;
  onClose: (shouldRefetch?: boolean) => void;
};

/* ───────────────────────── helpers ───────────────────────── */

const normalizeValue = (value: any) =>
  value === null || value === undefined ? "" : String(value);

const normalizeDateValue = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toDisplayDate = (ymd: string) => (ymd ? ymd.split("-").reverse().join("/") : "-");

const getInitialFormValues = (rowData: any) => ({
  docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
  docType: normalizeValue(rowData?.docType ?? rowData?.doc_type ?? "ADD"),
  docDate: normalizeDateValue(rowData?.doc_date) || (rowData ? "" : normalizeDateValue(new Date())),
  refNo: normalizeValue(rowData?.refNo ?? rowData?.ref_no),
  nameFrom: normalizeValue(rowData?.nameFrom ?? rowData?.name_from),
  nameTo: normalizeValue(rowData?.nameTo ?? rowData?.name_to),
  addrFrom: normalizeValue(rowData?.addrFrom ?? rowData?.addr_from),
  addrTo: normalizeValue(rowData?.addrTo ?? rowData?.addr_to),
  lettrSubject: normalizeValue(rowData?.lettrSubject ?? rowData?.lettr_subject),
  remarks1: normalizeValue(rowData?.remarks1 ?? rowData?.remarks_1),
  remarks2: normalizeValue(rowData?.remarks2 ?? rowData?.remarks_2),
  signatoryName: normalizeValue(rowData?.signatoryName ?? rowData?.signatory_name),
  signatoryPosition: normalizeValue(rowData?.signatoryPosition ?? rowData?.signatory_position),
});

const mapDetailApiRow = (row: any, index: number): SalaryAdditionDeductionDetailRow => {
  const deductFromLeave = String(
    row?.DEDUCT_FROM_LEAVE ?? row?.deduct_from_leave ?? "N",
  ).toUpperCase();
  return {
    srNo: row?.SERIAL_NO ?? row?.serial_no ?? row?.SR_NO ?? row?.sr_no ?? index + 1,
    employeeId: normalizeValue(row?.EMPLOYEE_ID ?? row?.employee_id),
    employee: normalizeValue(row?.EMP_NAME ?? row?.emp_name),
    payUnit: normalizeValue(row?.PAY_COMP_ID ?? row?.pay_comp_id),
    description: normalizeValue(row?.DESCRIPTION ?? row?.description),
    amount: normalizeValue(row?.AMOUNT ?? row?.amount),
    effectiveFrom: normalizeDateValue(row?.RECOVER_FROM_DT ?? row?.recover_from_dt),
    cancel: deductFromLeave === "Y" || deductFromLeave === "YES" ? "Yes" : "No",
  };
};

/* ───────────── UI building blocks (same as the Absent Memo form) ───────────── */

// Control styles shared by the header form.
const CTL = "h-7 text-xs";
const TEXTAREA =
  "h-[68px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

// Group card: icon + title strip, then a tight field grid.
function HeaderBlock({
  label,
  icon,
  children,
  actions,
  gridCols = "grid-cols-2",
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  gridCols?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md border border-[#cbd5e1] bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-slate-50 px-2.5 py-1">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">{icon}</span>
        <span className="text-xs font-bold text-[#00378C]">{label}</span>
        {actions && <span className="ml-auto">{actions}</span>}
      </div>
      <div className={`grid gap-x-2 gap-y-1.5 px-2.5 py-2 ${gridCols} max-md:grid-cols-1`}>{children}</div>
    </div>
  );
}

// Compact label above the control (10px), with an optional inline error.
function CField({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        <span>
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </span>
        {error && <span className="font-semibold normal-case tracking-tight text-destructive">{error}</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 truncate">
      <span className="font-semibold text-[#00378C]">{label}:</span>
      <span className="truncate font-medium">{value}</span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
export const AddSalaryAdditionDeductionForm = forwardRef<SalaryFormHandle, Props>(
  function AddSalaryAdditionDeductionForm({ mode, existingData, onClose }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";

    const [detailRows, setDetailRows] = useState<SalaryAdditionDeductionDetailRow[]>([]);
    const [errors, setErrors] = useState<{ docDate?: string }>({});
    const [showHeader, setShowHeader] = useState(true);

    const initialValues = useMemo(() => getInitialFormValues(existingData), [existingData]);

    const formik = useFormik({
      enableReinitialize: true,
      initialValues,
      onSubmit: () => undefined, // submit is driven by the page header via save()
    });

    /* ── lookups ── */
    const loadEmployees = useCallback(async () => {
      const response = await getDynamicLookup({
        parameter: "HR_ADDITION_DEDUCTION_EMPLOYEE_DROP_DOWN",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });
      return Array.isArray(response) ? response : [];
    }, [user?.loginid, user?.company_code]);

    const loadPayUnits = useCallback(async () => {
      const response = await getDynamicLookup({
        parameter: "PAY_COMPONENT_DependentPayCompId",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });
      return Array.isArray(response) ? response : [];
    }, [user?.loginid, user?.company_code]);

    /* ── load detail lines on edit / view ── */
    useEffect(() => {
      if (mode === "add") {
        setDetailRows([]);
        return;
      }
      const docNo = Number(existingData?.doc_no ?? existingData?.docNo);
      if (!docNo || Number.isNaN(docNo)) return;

      let cancelled = false;
      (async () => {
        try {
          const response = await getDynamicLookup({
            parameter: "HR_ADDITION_DEDUCTION_DETAIL",
            loginid: user?.loginid ?? "",
            code1: user?.company_code ?? "",
            number1: docNo,
          });
          const rows = Array.isArray(response) ? response : [];
          if (!cancelled) setDetailRows(rows.map(mapDetailApiRow));
        } catch (error) {
          console.error("Failed to fetch detail rows:", error);
          if (!cancelled) {
            setDetailRows([]);
            toast.error("Unable to load detail lines");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, existingData, user?.loginid, user?.company_code]);

    /* ── line handlers ── */
    const updateRow = (rowKey: number | string, patch: Partial<SalaryAdditionDeductionDetailRow>) => {
      setDetailRows((prev) =>
        prev.map((row) => (String(row.srNo) === String(rowKey) ? { ...row, ...patch } : row)),
      );
    };

    const handleAddDetailRow = () => {
      setDetailRows((prev) => [
        ...prev,
        {
          srNo: prev.length > 0 ? Number(prev[prev.length - 1]?.srNo || 0) + 1 : 1,
          employeeId: "",
          employee: "",
          payUnit: "",
          description: "",
          amount: "",
          effectiveFrom: "",
          cancel: "No",
        },
      ]);
    };

    const handleRemoveDetailRow = (rowKey: number | string) => {
      setDetailRows((prev) => prev.filter((row) => String(row.srNo) !== String(rowKey)));
    };

    const totalAmount = detailRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalAmountText = totalAmount.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    const lineCount = detailRows.length;

    /* ── validation ── */
    const validate = (): string | null => {
      const next: { docDate?: string } = {};
      if (!formik.values.docDate) next.docDate = "Doc Date is required";
      setErrors(next);

      if (next.docDate) return next.docDate;
      if (detailRows.length === 0) return "Please add at least one detail line";
      return null;
    };

    /* ── submit (called by the page header Save button) ── */
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }

      const values = formik.values;

      try {
        const header = {
          company_code: user?.company_code ?? "",
          doc_type: values.docType,
          doc_no: values.docNo ? Number(values.docNo) : null,
          doc_date: values.docDate ? new Date(values.docDate).toISOString() : new Date().toISOString(),
          ref_no: values.refNo || "",
          name_from: values.nameFrom || "",
          addr_from: values.addrFrom || "",
          name_to: values.nameTo || "",
          addr_to: values.addrTo || "",
          lettr_subject: values.lettrSubject || "",
          remarks_1: values.remarks1 || "",
          remarks_2: values.remarks2 || "",
          signatory_name: values.signatoryName || "",
          signatory_position: values.signatoryPosition || "",
          amount: totalAmount,
          user_id: user?.loginid || "",
        };

        const details = detailRows.map((row, index) => ({
          company_code: user?.company_code ?? "",
          doc_type: values.docType,
          doc_no: values.docNo ? Number(values.docNo) : null,
          sr_no: Number(row.srNo) || index + 1,
          employee_id: row.employeeId || "",
          emplyee_code: row.employeeId || "",
          pay_comp_id: row.payUnit || "",
          amount: Number(row.amount || 0),
          recover_mth_amt: Number(row.amount || 0),
          recover_from_dt: row.effectiveFrom ? new Date(row.effectiveFrom).toISOString() : undefined,
          deduct_from_leave: row.cancel === "Yes" ? "Y" : "N",
        }));

        const success = await hrSalaryAdvDedServiceInstance.upsertHrSalaryAdvDed({
          header,
          details,
          loginid: user?.loginid || "",
        });

        if (!success) throw new Error(isEdit ? "Update Failed" : "Save Failed");
        toast.success(isEdit ? "Updated Successfully" : "Saved Successfully");
        onClose(true);
      } catch (error) {
        console.error("Salary Addition/Deduction save error:", error);
        toast.error(error instanceof Error ? error.message : "Error while saving data");
      }
    };

    /* ✅ Expose save() to parent */
    useImperativeHandle(ref, () => ({
      save: handleSubmit,
    }));

    const text = (name: keyof typeof initialValues) => ({
      name,
      value: formik.values[name] ?? "",
      onChange: formik.handleChange,
      disabled: readonly,
    });

    const docTypeLabel = formik.values.docType === "DED" ? "Deduction" : "Addition";

    // ── UI ──────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        {!showHeader ? (
          /* Collapsed: one-line summary */
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-1.5 text-xs shadow-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-4 text-slate-700">
              <SummaryItem label="Doc No" value={formik.values.docNo || "Auto"} />
              <SummaryItem label="Doc Date" value={toDisplayDate(formik.values.docDate)} />
              <SummaryItem label="Type" value={docTypeLabel} />
              {formik.values.refNo && <SummaryItem label="Ref" value={formik.values.refNo} />}
              <SummaryItem label="Total" value={totalAmountText} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-2 h-6 shrink-0 cursor-pointer border-[#00378C] text-xs font-semibold text-[#00378C] hover:bg-blue-100/60"
              onClick={() => setShowHeader(true)}
            >
              Show Header Fields <ChevronDown size={13} className="ml-1" />
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border-2 border-gray-100 bg-card">
            <div className="grid items-stretch gap-1.5 p-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)]">
              {/* ══ Block 1: Document Details ══ */}
              <HeaderBlock
                label="Document Details"
                icon={<FileText size={11} />}
                actions={
                  <button
                    type="button"
                    onClick={() => setShowHeader(false)}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#00378C] hover:underline"
                  >
                    Hide <ChevronUp size={12} />
                  </button>
                }
              >
                <CField label="Doc No">
                  <Input
                    className={CTL}
                    {...text("docNo")}
                    disabled={readonly || isEdit}
                    placeholder={isEdit ? "" : "Auto"}
                  />
                </CField>

                <CField label="Doc Date" required error={errors.docDate} className="max-w-[150px]">
                  <Input className={CTL} type="date" {...text("docDate")} />
                </CField>

                <CField label="Doc Type">
                  <Select
                    className={CTL}
                    name="docType"
                    value={formik.values.docType}
                    onChange={formik.handleChange}
                    disabled={readonly}
                  >
                    <option value="ADD">Addition</option>
                    <option value="DED">Deduction</option>
                  </Select>
                </CField>

                <CField label="Ref No">
                  <Input className={CTL} {...text("refNo")} />
                </CField>
              </HeaderBlock>

              {/* ══ Block 2: From, To & Signatory ══ */}
              <HeaderBlock label="From, To & Signatory" icon={<UserCheck size={11} />}>
                <CField label="Name From">
                  <Input className={CTL} {...text("nameFrom")} />
                </CField>

                <CField label="Name To">
                  <Input className={CTL} {...text("nameTo")} />
                </CField>

                <CField label="Addr From">
                  <Input className={CTL} {...text("addrFrom")} />
                </CField>

                <CField label="Addr To">
                  <Input className={CTL} {...text("addrTo")} />
                </CField>

                <CField label="Signatory Name">
                  <Input className={CTL} {...text("signatoryName")} />
                </CField>

                <CField label="Signatory Position">
                  <Input className={CTL} {...text("signatoryPosition")} />
                </CField>
              </HeaderBlock>

              {/* ══ Block 3: Letter Details (widest — remarks live here) ══ */}
              <HeaderBlock label="Letter Details" icon={<StickyNote size={11} />}>
                <CField label="Letter Subject" className="col-span-2">
                  <Input className={CTL} {...text("lettrSubject")} />
                </CField>

                <CField label="Remarks 1">
                  <textarea className={TEXTAREA} {...text("remarks1")} />
                </CField>

                <CField label="Remarks 2">
                  <textarea className={TEXTAREA} {...text("remarks2")} />
                </CField>
              </HeaderBlock>
            </div>
          </div>
        )}

        {/* ══ Lines card: toolbar (title · count · Add Line), table, total chip ══ */}
        <div className="min-w-0 overflow-hidden rounded-md border border-[#cbd5e1] bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-[#cbd5e1] bg-slate-50 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
                <List size={11} />
              </span>
              <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-[#00378C]">
                Addition / Deduction Lines
              </h3>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00378C]">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
            </div>

            {!readonly && (
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 px-2.5 text-xs"
                title="Add line"
                onClick={handleAddDetailRow}
              >
                <Plus size={13} /> Add Line
              </Button>
            )}
          </div>

          <div className="max-h-[56vh] min-h-[160px] overflow-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-700">
                <tr className="border-b border-[#cbd5e1]">
                  <th className="w-12 px-2 py-1.5 text-left">No</th>
                  <th className="w-56 px-2 py-1.5 text-left">Employee</th>
                  <th className="w-44 px-2 py-1.5 text-left">Pay Unit</th>
                  <th className="px-2 py-1.5 text-left">Description</th>
                  <th className="w-32 px-2 py-1.5 text-right">Amount</th>
                  <th className="w-40 px-2 py-1.5 text-left">Effective From</th>
                  <th className="w-24 px-2 py-1.5 text-left">Cancel</th>
                  {!readonly && <th className="w-12 px-2 py-1.5 text-center">Action</th>}
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-muted-foreground"
                      colSpan={readonly ? 7 : 8}
                    >
                      {readonly ? "No lines" : "No lines — click Add Line"}
                    </td>
                  </tr>
                ) : (
                  detailRows.map((row, index) => (
                    <tr className="border-t odd:bg-muted/20" key={String(row.srNo)}>
                      <td className="px-2 py-1 text-xs">{index + 1}</td>
                      <td className="px-2 py-1">
                        <LookupField
                          label="Employee"
                          compact
                          disabled={readonly}
                          value={row.employeeId}
                          displayValue={row.employee}
                          columns={[
                            { field: "employee_code", header: "Employee Code" },
                            { field: "rpt_name", header: "Employee Name" },
                          ]}
                          valueField="employee_code"
                          displayFields={["rpt_name"]}
                          loadOptions={loadEmployees}
                          onChange={(value: any, opt: any) =>
                            updateRow(row.srNo, {
                              employeeId: String(
                                opt?.employee_id ??
                                  opt?.EMPLOYEE_ID ??
                                  opt?.employee_code ??
                                  opt?.EMPLOYEE_CODE ??
                                  value ??
                                  "",
                              ),
                              employee: String(
                                opt?.rpt_name ??
                                  opt?.RPT_NAME ??
                                  opt?.employee_name ??
                                  opt?.EMPLOYEE_NAME ??
                                  "",
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <LookupField
                          label="Pay Unit"
                          compact
                          disabled={readonly}
                          value={row.payUnit}
                          columns={[
                            { field: "value_code", header: "Value Code" },
                            { field: "value_desc", header: "Description" },
                          ]}
                          valueField="value_code"
                          displayFields={["value_code", "value_desc"]}
                          loadOptions={loadPayUnits}
                          onChange={(value: any, selected: any) =>
                            updateRow(row.srNo, {
                              payUnit: String(value ?? ""),
                              description: String(
                                selected?.value_desc ??
                                  selected?.VALUE_DESC ??
                                  row.description ??
                                  "",
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={CTL}
                          disabled={readonly}
                          value={row.description}
                          onChange={(e) => updateRow(row.srNo, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={`${CTL} text-right font-mono`}
                          type="number"
                          step="0.001"
                          disabled={readonly}
                          value={String(row.amount ?? "")}
                          onChange={(e) => updateRow(row.srNo, { amount: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={CTL}
                          type="date"
                          disabled={readonly}
                          value={row.effectiveFrom}
                          onChange={(e) => updateRow(row.srNo, { effectiveFrom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select
                          className={CTL}
                          disabled={readonly}
                          value={row.cancel}
                          onChange={(e) => updateRow(row.srNo, { cancel: e.target.value })}
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </Select>
                      </td>
                      {!readonly && (
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            title="Remove line"
                            onClick={() => handleRemoveDetailRow(row.srNo)}
                            className="inline-grid h-6 w-6 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#cbd5e1] bg-slate-50/95 px-4 py-2">
            <div className="flex min-h-9 items-center gap-3 rounded-md border-2 border-[#00378c]/50 bg-blue-50 px-4 py-1.5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00378c]">Total Amount</span>
              <strong className="font-mono text-base font-black tabular-nums text-[#00378c]">
                {totalAmountText}
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default AddSalaryAdditionDeductionForm;