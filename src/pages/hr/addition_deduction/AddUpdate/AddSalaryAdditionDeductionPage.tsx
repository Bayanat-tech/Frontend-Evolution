// AddUpdate/AddSalaryAdditionDeductionPage.tsx
//
// Salary Addition/Deduction form — GradeMaster-style:
//  • forwardRef + useImperativeHandle → parent header "Save" button calls save()
//  • Freight-style tabs + SectionPanel / Field building blocks
//  • Form owns validation + upsert; toast for feedback
//  • No bottom button row — List / Close / Save live in the page header

import { useFormik } from "formik";
import { FileText, ListChecks, Plus, StickyNote, Trash2, UserRound } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import hrSalaryAdvDedServiceInstance from "../../../../api/hr/upsertHrSalaryAdvDed";
import { getDynamicLookup } from "../../../../api/lookups";
import { useToast } from "../../../../components/ui/AlertToast";
import { Button } from "../../../../components/ui/Button";
import { Field, SectionPanel } from "../../../../components/ui/Formblocks";
import { Input } from "../../../../components/ui/Input";
import { LookupField } from "../../../../components/ui/LookupField";
import { Select } from "../../../../components/ui/Select";
import { useAuth } from "../../../../state/AuthContext";
import type { SalaryAdditionDeductionDetailRow } from "./types";

/* ✅ Expose save() to the parent (header Save button) */
export type SalaryFormHandle = {
  save: () => Promise<void>;
};

export type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: any;
  onClose: (shouldRefetch?: boolean) => void;
};

const TABS = ["Document Details", "Addition / Deduction Lines"];

/* ───────────────────────── helpers ───────────────────────── */

const normalizeValue = (value: any) =>
  value === null || value === undefined ? "" : String(value);

const normalizeDateValue = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getInitialFormValues = (rowData: any) => ({
  docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
  docType: normalizeValue(rowData?.docType ?? rowData?.doc_type ?? "ADV"),
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

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
export const AddSalaryAdditionDeductionForm = forwardRef<SalaryFormHandle, Props>(
  function AddSalaryAdditionDeductionForm({ mode, existingData, onClose }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";

    const [tab, setTab] = useState(0);
    const [detailRows, setDetailRows] = useState<SalaryAdditionDeductionDetailRow[]>([]);
    const [errors, setErrors] = useState<{ docDate?: string }>({});

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

    /* ── validation ── */
    const validate = (): string | null => {
      const next: { docDate?: string } = {};
      if (!formik.values.docDate) next.docDate = "Doc Date is required";
      setErrors(next);

      if (next.docDate) {
        setTab(0);
        return next.docDate;
      }
      if (detailRows.length === 0) {
        setTab(1);
        return "Please add at least one detail line";
      }
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
          doc_type: values.docType || "ADV",
          doc_no: values.docNo ? Number(values.docNo) : 0,
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
          doc_type: values.docType || "ADV",
          doc_no: values.docNo ? Number(values.docNo) : 0,
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

    // ── UI ──────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
          <div className="freight-tabs-list flex overflow-x-auto">
            {TABS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(index)}
                aria-pressed={tab === index}
                className={`freight-workspace-tab ${tab === index ? "active" : ""}`}
              >
                {label}
                {index === 1 && ` (${detailRows.length})`}
              </button>
            ))}
          </div>

          <div className="freight-tabs-panel border-t p-3 grid gap-3">
            {/* ══ TAB 0 — Document Details ══ */}
            {tab === 0 && (
              <>
                <SectionPanel title="Document Information" icon={FileText}>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Doc No">
                      <Input
                        {...text("docNo")}
                        disabled={readonly || isEdit}
                        placeholder={isEdit ? "" : "Auto"}
                      />
                    </Field>
                    <Field label="Doc Date" required error={errors.docDate}>
                      <Input type="date" {...text("docDate")} />
                    </Field>
                    <Field label="Doc Type">
                      <Input {...text("docType")} />
                    </Field>
                    <Field label="Ref No">
                      <Input {...text("refNo")} />
                    </Field>
                  </div>
                </SectionPanel>

                <div className="grid gap-3 md:grid-cols-2">
                  <SectionPanel title="From" icon={UserRound}>
                    <div className="grid gap-3">
                      <Field label="Name From">
                        <Input {...text("nameFrom")} />
                      </Field>
                      <Field label="Addr From">
                        <Input {...text("addrFrom")} />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="To" icon={UserRound}>
                    <div className="grid gap-3">
                      <Field label="Name To">
                        <Input {...text("nameTo")} />
                      </Field>
                      <Field label="Addr To">
                        <Input {...text("addrTo")} />
                      </Field>
                    </div>
                  </SectionPanel>
                </div>

                <SectionPanel title="Letter & Signatory" icon={StickyNote}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Letter Subject" className="md:col-span-2">
                      <Input {...text("lettrSubject")} />
                    </Field>
                    <Field label="Remarks 1">
                      <Input {...text("remarks1")} />
                    </Field>
                    <Field label="Remarks 2">
                      <Input {...text("remarks2")} />
                    </Field>
                    <Field label="Signatory Name">
                      <Input {...text("signatoryName")} />
                    </Field>
                    <Field label="Signatory Position">
                      <Input {...text("signatoryPosition")} />
                    </Field>
                  </div>
                </SectionPanel>
              </>
            )}

            {/* ══ TAB 1 — Lines ══ */}
            {tab === 1 && (
              <SectionPanel
                title={`Addition / Deduction Lines (${detailRows.length})`}
                icon={ListChecks}
              >
                {!readonly && (
                  <div className="mb-2 flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={handleAddDetailRow}>
                      <Plus size={12} /> Add Line
                    </Button>
                  </div>
                )}
                <div className="overflow-auto rounded-md border">
                  <table className="w-full min-w-[900px] text-[12px]">
                    <thead className="bg-secondary/60">
                      <tr>
                        <th className="px-2 py-2 text-left w-12">No</th>
                        <th className="px-2 py-2 text-left w-56">Employee</th>
                        <th className="px-2 py-2 text-left w-44">Pay Unit</th>
                        <th className="px-2 py-2 text-left">Description</th>
                        <th className="px-2 py-2 text-left w-32">Amount</th>
                        <th className="px-2 py-2 text-left w-40">Effective From</th>
                        <th className="px-2 py-2 text-left w-24">Cancel</th>
                        {!readonly && <th className="px-2 py-2 text-left w-12">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.length === 0 ? (
                        <tr>
                          <td
                            className="px-3 py-6 text-center text-muted-foreground"
                            colSpan={readonly ? 7 : 8}
                          >
                            {readonly ? "No lines" : "No lines — click Add Line"}
                          </td>
                        </tr>
                      ) : (
                        detailRows.map((row, index) => (
                          <tr className="border-t" key={String(row.srNo)}>
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
                                disabled={readonly}
                                value={row.description}
                                onChange={(e) => updateRow(row.srNo, { description: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                step="0.001"
                                disabled={readonly}
                                value={String(row.amount ?? "")}
                                onChange={(e) => updateRow(row.srNo, { amount: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="date"
                                disabled={readonly}
                                value={row.effectiveFrom}
                                onChange={(e) => updateRow(row.srNo, { effectiveFrom: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Select
                                disabled={readonly}
                                value={row.cancel}
                                onChange={(e) => updateRow(row.srNo, { cancel: e.target.value })}
                              >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                              </Select>
                            </td>
                            {!readonly && (
                              <td className="px-2 py-1">
                                <button
                                  type="button"
                                  title="Remove line"
                                  onClick={() => handleRemoveDetailRow(row.srNo)}
                                  className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {detailRows.length > 0 && (
                      <tfoot className="border-t bg-secondary/40">
                        <tr>
                          <td className="px-2 py-2 text-right font-medium" colSpan={4}>
                            Total Amount
                          </td>
                          <td className="px-2 py-2 font-semibold text-primary">
                            {totalAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            })}
                          </td>
                          <td colSpan={readonly ? 2 : 3} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </SectionPanel>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default AddSalaryAdditionDeductionForm;