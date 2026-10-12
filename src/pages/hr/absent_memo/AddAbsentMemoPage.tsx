// Absent Memo form — new UI (modelled on AddGradeMasterForm):
//  • forwardRef + useImperativeHandle → parent header "Save" button calls save()
//  • Freight-style SectionPanel / Field building blocks (shared Formblocks)
//  • useState instead of Formik; save logic lives here, page only triggers it
//  • No bottom Cancel/Save row — List / Close / Save live in the page header

import type { ColumnDef } from "@tanstack/react-table";
import { FileText, ListChecks, Plus, StickyNote, Trash2, UserCog } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState,
} from "react";
import { getDynamicLookup } from "../../../api/lookups";
import hrSalaryAdvDedServiceInstance from "../../../api/hr/upsertHrSalaryAdvDed";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import type { AbsentMemoRow } from "./AbsentMemoMainPage";
import type { AbsentMemoDetailRow } from "./types";

/* ✅ Expose save() to the parent (header Save button) */
export type AbsentMemoFormHandle = {
  save: () => Promise<void>;
};

type Props = {
  mode: "add" | "edit";
  existingData?: AbsentMemoRow | null;
  onClose: (shouldRefetch?: boolean) => void;
};

type AbsentMemoFormState = {
  docNo: string;
  docType: string;
  docDate: string;
  refNo: string;
  employeeCode: string;
  nameFrom: string;
  addrFrom: string;
  lettrSubject: string;
  remarks1: string;
  remarks2: string;
  signatoryName: string;
  signatoryPosition: string;
};

/* ── helpers ── */

// Stored/saved value is the code ("ABS"); the UI shows the label ("Absent").
const DOC_TYPE_ABSENT = "ABS";
const DOC_TYPE_LABELS: Record<string, string> = { ABS: "Absent" };

/** Accepts either the code ("ABS") or the old label ("Absent") and returns the code. */
const toDocTypeCode = (value: unknown): string => {
  const v = String(value ?? "").trim();
  if (!v) return DOC_TYPE_ABSENT;
  const match = Object.entries(DOC_TYPE_LABELS).find(
    ([code, label]) => code.toUpperCase() === v.toUpperCase() || label.toUpperCase() === v.toUpperCase(),
  );
  return match ? match[0] : v;
};

const normalizeValue = (value: any) => (value === null || value === undefined ? "" : String(value));

const normalizeDateValue = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const mapDetailRows = (rows: any[]): AbsentMemoDetailRow[] =>
  rows.map((row, index) => ({
    srNo: row?.sr_no ?? row?.SR_NO ?? row?.serial_no ?? row?.SERIAL_NO ?? index + 1,
    payUnit: String(row?.pay_comp_id ?? row?.PAY_COMP_ID ?? ""),
    description: String(row?.sal_type_flag ?? row?.SAL_TYPE_FLAG ?? row?.description ?? ""),
    effectiveFrom: normalizeDateValue(row?.recover_from_dt ?? row?.RECOVER_FROM_DT),
    absentFromDate: normalizeDateValue(row?.leave_start_date ?? row?.LEAVE_START_DATE ?? row?.recover_from_dt),
    absentToDate: normalizeDateValue(row?.leave_end_date ?? row?.LEAVE_END_DATE),
    noOfDays: row?.deduct_noof_leavedays ?? row?.DEDUCT_NOOF_LEAVEDAYS ?? row?.leave_days_paid ?? "",
    amount: row?.amount ?? row?.AMOUNT ?? row?.recover_mth_amt ?? row?.RECOVER_MTH_AMT ?? "",
    refLeaveDocNo: String(row?.ref_leave_doc_no ?? row?.REF_LEAVE_DOC_NO ?? ""),
    cancel: String(row?.cancel_status ?? row?.CANCEL_STATUS ?? (row?.deduct_from_leave === "Y" ? "Yes" : "No")),
  }));

const getInitialFormValues = (rowData?: any): AbsentMemoFormState => ({
  docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
  docType: toDocTypeCode(rowData?.docType ?? rowData?.doc_type),
  docDate: normalizeDateValue(rowData?.docDate ?? rowData?.doc_date) || new Date().toISOString().slice(0, 10),
  refNo: normalizeValue(rowData?.refNo ?? rowData?.ref_no),
  employeeCode: normalizeValue(rowData?.employeeCode ?? rowData?.employee_code),
  nameFrom: normalizeValue(rowData?.nameFrom ?? rowData?.name_from),
  addrFrom: normalizeValue(rowData?.addrFrom ?? rowData?.addr_from),
  lettrSubject: normalizeValue(rowData?.lettrSubject ?? rowData?.lettr_subject ?? "Salary Deduction"),
  remarks1: normalizeValue(rowData?.remarks1 ?? rowData?.remarks_1),
  remarks2: normalizeValue(rowData?.remarks2 ?? rowData?.remarks_2),
  signatoryName: normalizeValue(rowData?.signatoryName ?? rowData?.signatory_name),
  signatoryPosition: normalizeValue(rowData?.signatoryPosition ?? rowData?.signatory_position),
});

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
const AddAbsentMemoPage = forwardRef<AbsentMemoFormHandle, Props>(function AddAbsentMemoPage(
  { mode, existingData, onClose },
  ref,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = mode === "edit";

  const [form, setForm] = useState<AbsentMemoFormState>(() => getInitialFormValues(existingData));
  const [detailRows, setDetailRows] = useState<AbsentMemoDetailRow[]>([]);

  const set = (field: keyof AbsentMemoFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const totalAmount = detailRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  /* ── Lookups ── */
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

  /* ── Load detail lines on edit ── */
  useEffect(() => {
    const fetchDetailRows = async () => {
      if (!isEdit || !existingData?.doc_no) return;
      try {
        const response = await getDynamicLookup({
          parameter: "HR_ABSENT_MEMO_TAB_2_DATA",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
          number1: Number(existingData.doc_no),
        });
        setDetailRows(mapDetailRows(Array.isArray(response) ? response : []));
      } catch (error) {
        console.error("Failed to load absent memo detail rows:", error);
        setDetailRows([]);
        toast.error("Unable to load detail lines");
      }
    };
    void fetchDetailRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existingData?.doc_no, user?.company_code, user?.loginid]);

  /* ── Detail row handlers (functional updates keep these stable) ── */
  const updateRow = useCallback((rowKey: number | string, patch: Partial<AbsentMemoDetailRow>) => {
    setDetailRows((prev) =>
      prev.map((row) =>
        String(row.srNo) === String(rowKey)
          ? {
              ...row,
              ...patch,
              payUnit: patch.payUnit !== undefined ? String(patch.payUnit) : row.payUnit,
              description: patch.description !== undefined ? String(patch.description) : row.description,
              cancel: patch.cancel !== undefined ? String(patch.cancel) : row.cancel,
              refLeaveDocNo:
                patch.refLeaveDocNo !== undefined ? String(patch.refLeaveDocNo) : row.refLeaveDocNo,
            }
          : row,
      ),
    );
  }, []);

  const addDetailRow = () => {
    setDetailRows((prev) => {
      const nextSrNo = prev.length > 0 ? Number(prev[prev.length - 1]?.srNo || 0) + 1 : 1;
      return [
        ...prev,
        {
          srNo: nextSrNo,
          payUnit: "",
          description: "",
          effectiveFrom: "",
          absentFromDate: "",
          absentToDate: "",
          noOfDays: "",
          amount: "",
          refLeaveDocNo: "",
          cancel: "No",
        },
      ];
    });
  };

  const removeDetailRow = useCallback((rowKey: number | string) => {
    setDetailRows((prev) => prev.filter((row) => String(row.srNo) !== String(rowKey)));
  }, []);

  /* ── Submit (called by the page header Save button) ── */
  const handleSubmit = async () => {
    if (!form.employeeCode) {
      toast.warning("Employee Code is required");
      return;
    }
    if (detailRows.length === 0) {
      toast.warning("Please add at least one detail line");
      return;
    }

    try {
      const header = {
        company_code: user?.company_code ?? "",
        doc_type: form.docType || DOC_TYPE_ABSENT,
        doc_no: form.docNo ? Number(form.docNo) : 0,
        doc_date: form.docDate ? new Date(form.docDate).toISOString() : new Date().toISOString(),
        ref_no: form.refNo || "",
        name_from: form.nameFrom || "",
        addr_from: form.addrFrom || "",
        lettr_subject: form.lettrSubject || "Salary Deduction",
        remarks_1: form.remarks1 || "",
        remarks_2: form.remarks2 || "",
        signatory_name: form.signatoryName || "",
        signatory_position: form.signatoryPosition || "",
        employee_code: form.employeeCode || "",
        employee_id: form.employeeCode || "",
        amount: totalAmount,
        user_id: user?.loginid || "",
      };

      const details = detailRows.map((row, index) => ({
        company_code: user?.company_code ?? "",
        doc_type: form.docType || DOC_TYPE_ABSENT,
        doc_no: form.docNo ? Number(form.docNo) : 0,
        sr_no: Number(row.srNo) || index + 1,
        employee_id: form.employeeCode || "",
        emplyee_code: form.employeeCode || "", // matches DB column spelling
        pay_comp_id: row.payUnit || "",
        amount: Number(row.amount || 0),
        recover_mth_amt: Number(row.amount || 0),
        recover_from_dt: row.effectiveFrom
          ? new Date(row.effectiveFrom).toISOString()
          : row.absentFromDate
            ? new Date(row.absentFromDate).toISOString()
            : undefined,
        deduct_from_leave: row.cancel === "Yes" ? "Y" : "N",
        deduct_noof_leavedays: Number(row.noOfDays || 0),
        ref_leave_doc_no: row.refLeaveDocNo || "",
      }));

      const success = await hrSalaryAdvDedServiceInstance.upsertHrSalaryAdvDed({
        header,
        details,
        loginid: user?.loginid || "",
      });

      if (success) {
        toast.success(isEdit ? "Updated successfully" : "Saved successfully");
        onClose(true);
      } else {
        toast.error(isEdit ? "Update failed" : "Save failed");
      }
    } catch (error) {
      console.error("Absent Memo save error:", error);
      toast.error(error instanceof Error ? error.message : "Error while saving data");
    }
  };

  /* ✅ Expose save() to parent */
  useImperativeHandle(ref, () => ({
    save: handleSubmit,
  }));

  /* ── Detail columns ── */
  const columns = useMemo<ColumnDef<AbsentMemoDetailRow>[]>(
    () => [
      { accessorKey: "srNo", header: "No", size: 50, enableSorting: false },
      {
        accessorKey: "payUnit",
        header: "Pay Unit",
        size: 170,
        enableSorting: false,
        cell: ({ row }) => (
          <LookupField
            label="Pay Unit"
            compact
            value={row.original.payUnit}
            columns={[
              { field: "value_code", header: "Value Code" },
              { field: "value_desc", header: "Description" },
            ]}
            valueField="value_code"
            displayFields={["value_code", "value_desc"]}
            loadOptions={loadPayUnits}
            onChange={(value, selected) => {
              updateRow(row.original.srNo, {
                payUnit: String(value ?? ""),
                description: String(
                  selected?.value_desc ?? selected?.VALUE_DESC ?? row.original.description ?? "",
                ),
              });
            }}
          />
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 140,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            value={row.original.description}
            onChange={(e) => updateRow(row.original.srNo, { description: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "effectiveFrom",
        header: "Effective",
        size: 140,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            type="date"
            value={row.original.effectiveFrom}
            onChange={(e) => updateRow(row.original.srNo, { effectiveFrom: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "absentFromDate",
        header: "From",
        size: 140,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            type="date"
            value={row.original.absentFromDate}
            onChange={(e) => updateRow(row.original.srNo, { absentFromDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "absentToDate",
        header: "To",
        size: 140,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            type="date"
            value={row.original.absentToDate}
            onChange={(e) => updateRow(row.original.srNo, { absentToDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "noOfDays",
        header: "Days",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-right text-sm"
            type="number"
            min={0}
            value={String(row.original.noOfDays ?? "")}
            onChange={(e) => updateRow(row.original.srNo, { noOfDays: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 110,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-right font-mono text-sm"
            type="number"
            step="0.001"
            value={String(row.original.amount ?? "")}
            onChange={(e) => updateRow(row.original.srNo, { amount: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "refLeaveDocNo",
        header: "Ref Leave",
        size: 110,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            value={row.original.refLeaveDocNo}
            onChange={(e) => updateRow(row.original.srNo, { refLeaveDocNo: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "cancel",
        header: "Cancel",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            value={row.original.cancel}
            onChange={(e) => updateRow(row.original.srNo, { cancel: e.target.value })}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <button
              type="button"
              title="Delete row"
              onClick={() => removeDetailRow(row.original.srNo)}
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [loadPayUnits, updateRow, removeDetailRow],
  );

  /* ── UI ── */
  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      <SectionPanel title="Document" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Doc No">
            <Input
              name="docNo"
              value={form.docNo}
              onChange={(e) => set("docNo", e.target.value)}
              readOnly={isEdit}
              disabled={isEdit}
              placeholder={isEdit ? "" : "Auto"}
            />
          </Field>

          <Field label="Doc Date" required>
            <Input
              type="date"
              name="docDate"
              value={form.docDate}
              onChange={(e) => set("docDate", e.target.value)}
            />
          </Field>

          <Field label="Doc Type">
            <Input
              name="docType"
              value={DOC_TYPE_LABELS[form.docType] ?? form.docType}
              readOnly
              disabled
            />
          </Field>

          <Field label="Ref No">
            <Input name="refNo" value={form.refNo} onChange={(e) => set("refNo", e.target.value)} />
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title="Employee & Letter" icon={UserCog}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Employee Code" required>
            <LookupField
              compact
              value={form.employeeCode}
              columns={[
                { field: "employee_code", header: "Employee Code" },
                { field: "rpt_name", header: "Name" },
              ]}
              valueField="employee_id"
              displayFields={["employee_code", "rpt_name"]}
              loadOptions={loadEmployees}
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  employeeCode: String(value ?? ""),
                }));
              }}
              placeholder="Employee code or name"
            />
          </Field>

          <Field label="Name From">
            <Input name="nameFrom" value={form.nameFrom} onChange={(e) => set("nameFrom", e.target.value)} />
          </Field>

          <Field label="Addr From">
            <Input name="addrFrom" value={form.addrFrom} onChange={(e) => set("addrFrom", e.target.value)} />
          </Field>

          <Field label="Letter Subject">
            <Input
              name="lettrSubject"
              value={form.lettrSubject}
              onChange={(e) => set("lettrSubject", e.target.value)}
            />
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title="Remarks & Signatory" icon={StickyNote}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Remarks 1">
            <Input name="remarks1" value={form.remarks1} onChange={(e) => set("remarks1", e.target.value)} />
          </Field>

          <Field label="Remarks 2">
            <Input name="remarks2" value={form.remarks2} onChange={(e) => set("remarks2", e.target.value)} />
          </Field>

          <Field label="Signatory Name">
            <Input
              name="signatoryName"
              value={form.signatoryName}
              onChange={(e) => set("signatoryName", e.target.value)}
            />
          </Field>

          <Field label="Signatory Position">
            <Input
              name="signatoryPosition"
              value={form.signatoryPosition}
              onChange={(e) => set("signatoryPosition", e.target.value)}
            />
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title={`Absence / Deduction Lines (${detailRows.length})`} icon={ListChecks}>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Total Amount{" "}
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {totalAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}
              </span>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addDetailRow}>
              <Plus size={14} /> Add Line
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={detailRows}
            emptyText="No lines — click Add Line"
            height={260}
            minWidth={1200}
            density="grid"
            getRowId={(row) => String(row.srNo)}
          />
        </div>
      </SectionPanel>
    </div>
  );
});

export default AddAbsentMemoPage;