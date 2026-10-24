import { useFormik } from "formik";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  Plus,
  StickyNote,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ColumnDef } from "@tanstack/react-table";
import hrSalaryAdvDedServiceInstance from "../../../../api/hr/upsertHrSalaryAdvDed";
import { getDynamicLookup } from "../../../../api/lookups";
import { useToast } from "../../../../components/ui/AlertToast";
import { Button } from "../../../../components/ui/Button";
import { DataTable } from "../../../../components/ui/DataTable";
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

const CTL = "h-7 text-xs";

/* Defaults applied only for new (add-mode) documents */
const NEW_DEFAULTS = {
  nameFrom: "Abdullah Khalfan Al Fulaiti",
  nameTo: "Sibu Mathew",
  addrFrom: "Hr Manager",
  addrTo: "Finance Manager",
  signatoryName: "Abdullah Khalfan Al Fulaiti",
  signatoryPosition: "Hr Manager",
} as const;

/* Header column sizes (matches DB DDL) */
const HEADER_LIMITS = {
  refNo: 30,
  nameFrom: 100,
  nameTo: 100,
  addrFrom: 250,
  addrTo: 250,
  lettrSubject: 250,
  remarks1: 1000,
  remarks2: 1000,
  signatoryName: 100,
  signatoryPosition: 100,
} as const;

/* Detail column sizes (matches DB DDL) */
const DETAIL_LIMITS = {
  employeeId: 5, // EMPLOYEE_ID  VARCHAR2(5)
  employeeCode: 15, // EMPLYEE_CODE VARCHAR2(15)
  payUnit: 5, // PAY_COMP_ID  VARCHAR2(5)
} as const;

/* NUMBER(18,4) → 14 integer digits + 4 decimals */
const AMOUNT_MAX = 99999999999999.9999;
const AMOUNT_DECIMALS = 4;

const normalizeValue = (value: any) =>
  value === null || value === undefined ? "" : String(value);

const normalizeDateValue = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatDisplayDate = (val: string | null | undefined) => {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-GB");
  } catch {
    return val;
  }
};

const getInitialFormValues = (rowData: any) => {
  const isNew = !rowData;
  const orDefault = (val: string, def: string) => val || (isNew ? def : "");

  return {
    docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
    docType: normalizeValue(rowData?.docType ?? rowData?.doc_type ?? "ADD"),
    docDate:
      normalizeDateValue(rowData?.doc_date) ||
      (isNew ? normalizeDateValue(new Date()) : ""),
    refNo: normalizeValue(rowData?.refNo ?? rowData?.ref_no),

    nameFrom: orDefault(
      normalizeValue(rowData?.nameFrom ?? rowData?.name_from),
      NEW_DEFAULTS.nameFrom,
    ),
    nameTo: orDefault(
      normalizeValue(rowData?.nameTo ?? rowData?.name_to),
      NEW_DEFAULTS.nameTo,
    ),
    addrFrom: orDefault(
      normalizeValue(rowData?.addrFrom ?? rowData?.addr_from),
      NEW_DEFAULTS.addrFrom,
    ),
    addrTo: orDefault(
      normalizeValue(rowData?.addrTo ?? rowData?.addr_to),
      NEW_DEFAULTS.addrTo,
    ),

    lettrSubject: normalizeValue(rowData?.lettrSubject ?? rowData?.lettr_subject),
    remarks1: normalizeValue(rowData?.remarks1 ?? rowData?.remarks_1),
    remarks2: normalizeValue(rowData?.remarks2 ?? rowData?.remarks_2),

    signatoryName: orDefault(
      normalizeValue(rowData?.signatoryName ?? rowData?.signatory_name),
      NEW_DEFAULTS.signatoryName,
    ),
    signatoryPosition: orDefault(
      normalizeValue(rowData?.signatoryPosition ?? rowData?.signatory_position),
      NEW_DEFAULTS.signatoryPosition,
    ),
  };
};

const mapDetailApiRow = (row: any, index: number): SalaryAdditionDeductionDetailRow => {
  const deductFromLeave = String(
    row?.DEDUCT_FROM_LEAVE ?? row?.deduct_from_leave ?? "N",
  ).toUpperCase();
  return {
    srNo: row?.SERIAL_NO ?? row?.serial_no ?? row?.SR_NO ?? row?.sr_no ?? index + 1,
    employeeId: normalizeValue(row?.EMPLOYEE_ID ?? row?.employee_id),
    employeeCode: normalizeValue(
      row?.EMPLYEE_CODE ??
        row?.emplyee_code ??
        row?.EMPLOYEE_CODE ??
        row?.employee_code,
    ),
    employee: normalizeValue(row?.EMP_NAME ?? row?.emp_name),
    payUnit: normalizeValue(row?.PAY_COMP_ID ?? row?.pay_comp_id),
    description: normalizeValue(row?.DESCRIPTION ?? row?.description),
    amount: normalizeValue(row?.AMOUNT ?? row?.amount),
    effectiveFrom: normalizeDateValue(row?.RECOVER_FROM_DT ?? row?.recover_from_dt),
    cancel: deductFromLeave === "Y" || deductFromLeave === "YES" ? "Yes" : "No",
  };
};

/* ───────────────────── UI building blocks ───────────────────── */

function HeaderBlock({
  label,
  icon,
  children,
  actions,
  gridCols = "grid-cols-2",
  bodyClass,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  gridCols?: string;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md border border-[#cbd5e1] bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-slate-50 px-2.5 py-1">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
          {icon}
        </span>
        <span className="text-xs font-bold text-[#00378C]">{label}</span>
        {actions && <span className="ml-auto">{actions}</span>}
      </div>
      <div
        className={
          bodyClass ?? `grid gap-x-2 gap-y-1.5 px-2.5 py-2 ${gridCols} max-md:grid-cols-1`
        }
      >
        {children}
      </div>
    </div>
  );
}

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
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
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
      onSubmit: () => undefined,
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
    const updateRow = (
      rowKey: number | string,
      patch: Partial<SalaryAdditionDeductionDetailRow>,
    ) => {
      setDetailRows((prev) =>
        prev.map((row) =>
          String(row.srNo) === String(rowKey) ? { ...row, ...patch } : row,
        ),
      );
    };

    const handleAddDetailRow = () => {
      setDetailRows((prev) => [
        ...prev,
        {
          srNo: prev.length > 0 ? Number(prev[prev.length - 1]?.srNo || 0) + 1 : 1,
          employeeId: "",
          employeeCode: "",
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

    const totalAmount = detailRows.reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0,
    );

    /* ── validation ── */
    const validate = (): string | null => {
      /* ── Header: required ── */
      const next: { docDate?: string } = {};
      if (!formik.values.docDate) next.docDate = "Doc Date is required";
      setErrors(next);
      if (next.docDate) return next.docDate;

      /* ── Header: max length ── */
      const v = formik.values;
      const headerChecks: Array<[string, string | undefined, number]> = [
        ["Ref No", v.refNo, HEADER_LIMITS.refNo],
        ["Name From", v.nameFrom, HEADER_LIMITS.nameFrom],
        ["Name To", v.nameTo, HEADER_LIMITS.nameTo],
        ["Addr From", v.addrFrom, HEADER_LIMITS.addrFrom],
        ["Addr To", v.addrTo, HEADER_LIMITS.addrTo],
        ["Letter Subject", v.lettrSubject, HEADER_LIMITS.lettrSubject],
        ["Remarks 1", v.remarks1, HEADER_LIMITS.remarks1],
        ["Remarks 2", v.remarks2, HEADER_LIMITS.remarks2],
        ["Signatory Name", v.signatoryName, HEADER_LIMITS.signatoryName],
        ["Signatory Position", v.signatoryPosition, HEADER_LIMITS.signatoryPosition],
      ];
      for (const [label, val, max] of headerChecks) {
        if ((val || "").length > max) return `${label} must be ≤ ${max} characters`;
      }

      /* ── Detail: at least one line ── */
      if (detailRows.length === 0) return "Please add at least one detail line";

      /* ── Detail: per-line required + length + numeric ── */
      for (const row of detailRows) {
        const at = `Row ${row.srNo}`;

        // Employee (id + code together, both from the lookup)
        if (!row.employeeId) return `${at}: Employee is required`;
        if (!row.employeeCode) return `${at}: Employee Code is required`;
        if (row.employeeId.length > DETAIL_LIMITS.employeeId)
          return `${at}: Employee ID must be ≤ ${DETAIL_LIMITS.employeeId} characters`;
        if (row.employeeCode.length > DETAIL_LIMITS.employeeCode)
          return `${at}: Employee Code must be ≤ ${DETAIL_LIMITS.employeeCode} characters`;

        // Pay Unit
        if (!row.payUnit) return `${at}: Pay Unit is required`;
        if (row.payUnit.length > DETAIL_LIMITS.payUnit)
          return `${at}: Pay Unit must be ≤ ${DETAIL_LIMITS.payUnit} characters`;

        // Effective From
        if (!row.effectiveFrom) return `${at}: Effective From is required`;

        // Amount — NUMBER(18,4)
        const amtRaw = String(row.amount ?? "").trim();
        if (!amtRaw) return `${at}: Amount is required`;
        const amt = Number(amtRaw);
        if (!Number.isFinite(amt)) return `${at}: Amount is not a valid number`;
        if (amt < 0) return `${at}: Amount cannot be negative`;
        if (amt > AMOUNT_MAX) return `${at}: Amount exceeds allowed size`;
        const [intPart = "", decPart = ""] = amtRaw.split(".");
        if (intPart.replace(/^-/, "").length > 14)
          return `${at}: Amount can have at most 14 integer digits`;
        if (decPart.length > AMOUNT_DECIMALS)
          return `${at}: Amount can have at most ${AMOUNT_DECIMALS} decimals`;

        // Cancel (defaults to "No", kept for safety)
        if (!row.cancel) return `${at}: Cancel is required`;
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
      console.log("form values", values);

      try {
        const header = {
          company_code: user?.company_code ?? "",
          doc_type: values.docType,
          doc_no: values.docNo ? Number(values.docNo) : null,
          doc_date: values.docDate
            ? new Date(values.docDate).toISOString()
            : new Date().toISOString(),
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
          emplyee_code: row.employeeCode || "",
          pay_comp_id: row.payUnit || "",
          amount: Number(row.amount || 0),
          recover_mth_amt: Number(row.amount || 0),
          recover_from_dt: row.effectiveFrom
            ? new Date(row.effectiveFrom).toISOString()
            : undefined,
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

    useImperativeHandle(ref, () => ({
      save: handleSubmit,
    }));

    const text = (name: keyof typeof initialValues) => ({
      name,
      value: formik.values[name] ?? "",
      onChange: formik.handleChange,
      disabled: readonly,
    });

    /* ── detail grid columns (DataTable) ── */
    const detailColumns = useMemo<ColumnDef<SalaryAdditionDeductionDetailRow>[]>(
      () => [
        {
          id: "sno",
          header: "No",
          size: 55,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <span className="text-xs font-medium text-muted-foreground">
              {row.index + 1}
            </span>
          ),
        },
        {
          accessorKey: "employeeId",
          header: "Employee",
          size: 220,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <LookupField
              label="Employee"
              compact
              dense
              disabled={readonly}
              value={row.original.employeeCode}
              displayValue={row.original.employee}
              columns={[
                { field: "employee_code", header: "Employee Code" },
                { field: "employee_id", header: "Employee ID" },
                { field: "rpt_name", header: "Employee Name" },
              ]}
              valueField="employee_code"
              displayFields={["rpt_name"]}
              loadOptions={loadEmployees}
              onChange={(value: any, opt: any) =>
                updateRow(row.original.srNo, {
                  employeeId: String(opt?.employee_id ?? opt?.EMPLOYEE_ID ?? ""),
                  employeeCode: String(
                    opt?.employee_code ?? opt?.EMPLOYEE_CODE ?? value ?? "",
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
          ),
        },
        {
          accessorKey: "payUnit",
          header: "Pay Unit",
          size: 200,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <LookupField
              label="Pay Unit"
              compact
              dense
              disabled={readonly}
              value={row.original.payUnit}
              columns={[
                { field: "value_code", header: "Value Code" },
                { field: "value_desc", header: "Description" },
              ]}
              valueField="value_code"
              displayFields={["value_code", "value_desc"]}
              loadOptions={loadPayUnits}
              onChange={(value: any, selected: any) =>
                updateRow(row.original.srNo, {
                  payUnit: String(value ?? ""),
                  description: String(
                    selected?.value_desc ??
                      selected?.VALUE_DESC ??
                      row.original.description ??
                      "",
                  ),
                })
              }
            />
          ),
        },
        {
          accessorKey: "description",
          header: "Description",
          size: 240,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <Input
              className="h-7 px-2 text-sm"
              disabled={readonly}
              value={row.original.description}
              onChange={(e) =>
                updateRow(row.original.srNo, { description: e.target.value })
              }
            />
          ),
        },
        {
          accessorKey: "amount",
          header: "Amount",
          size: 130,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <Input
              type="number"
              step="0.0001"
              min="0"
              max={String(AMOUNT_MAX)}
              className="h-7 px-2 text-right font-mono text-sm"
              disabled={readonly}
              value={String(row.original.amount ?? "")}
              onChange={(e) => updateRow(row.original.srNo, { amount: e.target.value })}
            />
          ),
        },
        {
          accessorKey: "effectiveFrom",
          header: "Effective From",
          size: 150,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <Input
              type="date"
              className="h-7 px-2 text-sm"
              disabled={readonly}
              value={row.original.effectiveFrom}
              onChange={(e) =>
                updateRow(row.original.srNo, { effectiveFrom: e.target.value })
              }
            />
          ),
        },
        {
          accessorKey: "cancel",
          header: "Cancel",
          size: 100,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <Select
              className="h-7 px-2 text-sm"
              disabled={readonly}
              value={row.original.cancel}
              onChange={(e) => updateRow(row.original.srNo, { cancel: e.target.value })}
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </Select>
          ),
        },
        ...(readonly
          ? []
          : ([
              {
                id: "actions",
                header: "",
                size: 50,
                enableSorting: false,
                enableColumnFilter: false,
                cell: ({ row }: { row: { original: SalaryAdditionDeductionDetailRow } }) => (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => handleRemoveDetailRow(row.original.srNo)}
                      title="Remove row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ),
              } as ColumnDef<SalaryAdditionDeductionDetailRow>,
            ])),
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [readonly, loadEmployees, loadPayUnits],
    );

    // ── UI ──────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {!showHeader ? (
          /* Collapsed: one-line summary */
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-1.5 text-xs shadow-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-4 text-slate-700">
              <SummaryItem label="Doc No" value={formik.values.docNo || "Auto"} />
              <SummaryItem
                label="Doc Date"
                value={formatDisplayDate(formik.values.docDate) || "-"}
              />
              <SummaryItem label="Doc Type" value={formik.values.docType} />
              <SummaryItem label="Lines" value={String(detailRows.length)} />
              <SummaryItem label="Total" value={totalAmount.toFixed(4)} />
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

                <CField
                  label="Doc Date"
                  required
                  error={errors.docDate}
                  className="max-w-[150px]"
                >
                  <Input type="date" className={CTL} {...text("docDate")} />
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
                  <Input className={CTL} {...text("refNo")} maxLength={HEADER_LIMITS.refNo} />
                </CField>
              </HeaderBlock>

              {/* ══ Block 2: From, To & Signatory ══ */}
              <HeaderBlock label="From, To & Signatory" icon={<UserCheck size={11} />}>
                <CField label="Name From">
                  <Input
                    className={CTL}
                    {...text("nameFrom")}
                    maxLength={HEADER_LIMITS.nameFrom}
                  />
                </CField>
                <CField label="Name To">
                  <Input
                    className={CTL}
                    {...text("nameTo")}
                    maxLength={HEADER_LIMITS.nameTo}
                  />
                </CField>
                <CField label="Addr From">
                  <Input
                    className={CTL}
                    {...text("addrFrom")}
                    maxLength={HEADER_LIMITS.addrFrom}
                  />
                </CField>
                <CField label="Addr To">
                  <Input
                    className={CTL}
                    {...text("addrTo")}
                    maxLength={HEADER_LIMITS.addrTo}
                  />
                </CField>
                <CField label="Signatory Name">
                  <Input
                    className={CTL}
                    {...text("signatoryName")}
                    maxLength={HEADER_LIMITS.signatoryName}
                  />
                </CField>
                <CField label="Signatory Position">
                  <Input
                    className={CTL}
                    {...text("signatoryPosition")}
                    maxLength={HEADER_LIMITS.signatoryPosition}
                  />
                </CField>
              </HeaderBlock>

              {/* ══ Block 3: Letter Details ══ */}
              <HeaderBlock label="Letter Details" icon={<StickyNote size={11} />}>
                <CField label="Letter Subject" className="col-span-2">
                  <Input
                    className={CTL}
                    {...text("lettrSubject")}
                    maxLength={HEADER_LIMITS.lettrSubject}
                  />
                </CField>
                <CField label="Remarks 1">
                  <Input
                    className={CTL}
                    {...text("remarks1")}
                    maxLength={HEADER_LIMITS.remarks1}
                  />
                </CField>
                <CField label="Remarks 2">
                  <Input
                    className={CTL}
                    {...text("remarks2")}
                    maxLength={HEADER_LIMITS.remarks2}
                  />
                </CField>
              </HeaderBlock>
            </div>
          </div>
        )}

        {/* ══ Lines card: toolbar (title · count · Add Row), grid, total chip ══ */}
        <div className="min-w-0 overflow-hidden rounded-md border border-[#cbd5e1] bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-[#cbd5e1] bg-slate-50 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
                <ListChecks size={11} />
              </span>
              <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-[#00378C]">
                Detail Lines
              </h3>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00378C]">
                {detailRows.length} {detailRows.length === 1 ? "line" : "lines"}
              </span>
            </div>

            {!readonly && (
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 px-2.5 text-xs"
                title="Add row"
                onClick={handleAddDetailRow}
              >
                <Plus size={13} /> Add Row
              </Button>
            )}
          </div>

          <div className="p-2">
            <DataTable
              columns={detailColumns}
              data={detailRows}
              emptyText={
                readonly ? "No lines" : "No lines — click Add Row to start."
              }
              height={240}
              minWidth={1000}
              density="grid"
              getRowId={(_row, index) => String(index)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#cbd5e1] bg-slate-50/95 px-4 py-2">
            <div className="flex min-h-9 items-center gap-3 rounded-md border-2 border-[#00378c]/50 bg-blue-50 px-4 py-1.5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00378c]">
                Total Amount
              </span>
              <strong className="font-mono text-base font-black tabular-nums text-[#00378c]">
                {totalAmount.toFixed(4)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default AddSalaryAdditionDeductionForm;