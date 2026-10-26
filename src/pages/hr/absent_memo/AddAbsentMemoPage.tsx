import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, FileText, List, Plus, StickyNote, Trash2, UserCheck } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { getDynamicLookup, type LookupRow } from "../../../api/lookups";
import hrSalaryAdvDedServiceInstance from "../../../api/hr/upsertHrSalaryAdvDed";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import type { AbsentMemoRow } from "./AbsentMemoMainPage";
import type { AbsentMemoDetailRow } from "./types";
import { toApiDateInput } from "../../../hooks/apiDate";

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
  employeeId: string; 
  nameFrom: string;
  addrFrom: string;
  lettrSubject: string;
  remarks1: string;
  remarks2: string;
  signatoryName: string;
  signatoryPosition: string;
};

/* ── defaults ── */
const DEFAULT_NAME_FROM = "Abdullah Khalfan Al Fulaiti";
const DEFAULT_ADDR_FROM = "Hr Manager";
const DEFAULT_SIGNATORY_NAME = "Abdullah Khalfan Al Fulaiti";
const DEFAULT_SIGNATORY_POSITION = "Hr Manager";

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

// const normalizeDateValue = (value: any) => {
//   if (!value) return "";
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return "";
//   return date.toISOString().slice(0, 10);
// };

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

// ---------- Oracle column widths (HR_SALARY_ADV_DED header + details) ----------
const FIELD_LIMITS = {
  // HDR
  ref_no:               30,     // REF_NO VARCHAR2(30)
  name_from:           100,     // NAME_FROM VARCHAR2(100)
  addr_from:           250,     // ADDR_FROM VARCHAR2(250)
  lettr_subject:       250,     // LETTR_SUBJECT VARCHAR2(250)
  remarks_1:          1000,     // REMARKS_1 VARCHAR2(1000)
  remarks_2:          1000,     // REMARKS_2 VARCHAR2(1000)
  signatory_name:      100,     // SIGNATORY_NAME VARCHAR2(100)
  signatory_position:  100,     // SIGNATORY_POSITION VARCHAR2(100)
  employee_code:        15,     // EMPLOYEE_CODE VARCHAR2(15)
  // DTL
  ref_leave_doc_no:     10,     // REF_LEAVE_DOC_NO VARCHAR2(10)
  description:          20,     // DTL.REMARKS VARCHAR2(20)
} as const;

function countDecimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(Math.abs(n));
  const m = s.match(/e-(\d+)/i);
  if (m) return Number(m[1]);
  const dot = s.indexOf(".");
  return dot >= 0 ? s.length - dot - 1 : 0;
}

function validateAbsentMemo(
  form: AbsentMemoFormState,
  rows: AbsentMemoDetailRow[],
): string | null {
  // ---- header string fields ----
  const hdrChecks: Array<[keyof typeof FIELD_LIMITS, string | undefined, string]> = [
    ["ref_no",             form.refNo,             "Ref No"],
    ["name_from",          form.nameFrom,          "Name From"],
    ["addr_from",          form.addrFrom,          "Addr From"],
    ["lettr_subject",      form.lettrSubject,      "Letter Subject"],
    ["remarks_1",          form.remarks1,          "Remarks 1"],
    ["remarks_2",          form.remarks2,          "Remarks 2"],
    ["signatory_name",     form.signatoryName,     "Signatory Name"],
    ["signatory_position", form.signatoryPosition, "Signatory Position"],
    ["employee_code",      form.employeeCode,      "Employee Code"],
  ];
  for (const [key, val, label] of hdrChecks) {
    if ((val?.length ?? 0) > FIELD_LIMITS[key]) {
      return `${label} exceeds ${FIELD_LIMITS[key]} characters (currently ${val?.length}).`;
    }
  }

  // ---- detail rows ----
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tag = `Line ${r.srNo || i + 1}`;

    // Mandatory fields (Ref Leave Doc No is optional)
    if (!r.payUnit?.trim())        return `${tag}: Pay Unit is required.`;
    if (!r.description?.trim())    return `${tag}: Description is required.`;
    if (!r.effectiveFrom)          return `${tag}: Effective From is required.`;
    if (!r.absentFromDate)         return `${tag}: Absent From is required.`;
    if (!r.absentToDate)           return `${tag}: Absent To is required.`;
    if (!r.noOfDays || Number(r.noOfDays) <= 0)
      return `${tag}: No. of Days must be greater than zero.`;
    if (!r.amount || Number(r.amount) <= 0)
      return `${tag}: Amount must be greater than zero.`;

    // Length / precision checks
    if ((r.description?.length ?? 0) > FIELD_LIMITS.description) {
      return `${tag}: Description exceeds ${FIELD_LIMITS.description} characters.`;
    }
    if ((r.refLeaveDocNo?.length ?? 0) > FIELD_LIMITS.ref_leave_doc_no) {
      return `${tag}: Ref Leave Doc No exceeds ${FIELD_LIMITS.ref_leave_doc_no} characters.`;
    }
    if (countDecimals(Number(r.amount || 0)) > 4) {
      return `${tag}: Amount can have at most 4 decimal places.`;
    }
    if (countDecimals(Number(r.noOfDays || 0)) > 6) {
      return `${tag}: No. of Days can have at most 6 decimal places.`;
    }
  }

  return null; // OK
}

/** Inclusive day count between two "YYYY-MM-DD" strings (same day = 1). */
const calcDaysBetween = (from: string, to: string): number => {
  if (!from || !to) return 0;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  // Date.UTC avoids daylight-saving drift
  const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.round(diff / 86_400_000) + 1;
};

/** Days in the month of the given "YYYY-MM-DD" (equivalent of ll_Mnt_Days). */
const getDaysInMonth = (dateStr: string): number => {
  const [y, m] = dateStr.split("-").map(Number);
  if (!y || !m) return 0;
  return new Date(y, m, 0).getDate();
};

// Control styles shared by the header form (same density as the finance document pages).
const CTL = "h-7 text-xs";
const TEXTAREA =
  "h-[68px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const toDisplayDate = (ymd: string) => (ymd ? ymd.split("-").reverse().join("/") : "-");

// Group card: icon + title strip, then a tight field grid (mirrors CommercialDocumentPage).
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

// Compact label above the control (10px, like the finance pages).
function CField({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
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

const mapDetailRows = (rows: any[]): AbsentMemoDetailRow[] =>
  rows.map((row, index) => ({
    srNo: row?.sr_no ?? row?.SR_NO ?? row?.serial_no ?? row?.SERIAL_NO ?? index + 1,
    payUnit: String(row?.pay_comp_id ?? row?.PAY_COMP_ID ?? ""),
    description: String(row?.remarks ?? row?.REMARKS ?? row?.description ?? row?.sal_type_flag ?? row?.SAL_TYPE_FLAG ?? ""),
    effectiveFrom: toApiDateInput(row?.recover_from_dt ?? row?.RECOVER_FROM_DT),
    absentFromDate: toApiDateInput(row?.leave_start_date ?? row?.LEAVE_START_DATE ?? row?.recover_from_dt),
    absentToDate: toApiDateInput(row?.leave_end_date ?? row?.LEAVE_END_DATE),
    noOfDays: row?.deduct_noof_leavedays ?? row?.DEDUCT_NOOF_LEAVEDAYS ?? row?.leave_days_paid ?? "",
    amount: row?.amount ?? row?.AMOUNT ?? row?.recover_mth_amt ?? row?.RECOVER_MTH_AMT ?? "",
    refLeaveDocNo: String(row?.ref_leave_doc_no ?? row?.REF_LEAVE_DOC_NO ?? ""),
    cancel: String(row?.cancel_status ?? row?.CANCEL_STATUS ?? (row?.deduct_from_leave === "Y" ? "Yes" : "No")),
  }));

const getInitialFormValues = (rowData?: any): AbsentMemoFormState => ({
  docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
  docType: toDocTypeCode(rowData?.docType ?? rowData?.doc_type),
  docDate: toApiDateInput(rowData?.docDate ?? rowData?.doc_date) || new Date().toISOString().slice(0, 10),
  refNo: normalizeValue(rowData?.refNo ?? rowData?.ref_no),
  employeeCode: normalizeValue(rowData?.employeeCode ?? rowData?.employee_code),
  employeeId:   normalizeValue(rowData?.employeeId   ?? rowData?.employee_id),
  nameFrom:
    normalizeValue(rowData?.nameFrom ?? rowData?.name_from) || DEFAULT_NAME_FROM,
  addrFrom:
    normalizeValue(rowData?.addrFrom ?? rowData?.addr_from) || DEFAULT_ADDR_FROM,
  lettrSubject: normalizeValue(rowData?.lettrSubject ?? rowData?.lettr_subject ?? "Salary Deduction"),
  remarks1: normalizeValue(rowData?.remarks1 ?? rowData?.remarks_1),
  remarks2: normalizeValue(rowData?.remarks2 ?? rowData?.remarks_2),
  signatoryName:
    normalizeValue(rowData?.signatoryName ?? rowData?.signatory_name) || DEFAULT_SIGNATORY_NAME,
  signatoryPosition:
    normalizeValue(rowData?.signatoryPosition ?? rowData?.signatory_position) || DEFAULT_SIGNATORY_POSITION,
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

  // Keep the latest toast in a ref so callbacks (and the columns memo) don't
  // rebuild if useToast() returns a new object on every render.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [form, setForm] = useState<AbsentMemoFormState>(() => getInitialFormValues(existingData));
  const [detailRows, setDetailRows] = useState<AbsentMemoDetailRow[]>([]);
  const [showHeader, setShowHeader] = useState(true);
  const [employeeName, setEmployeeName] = useState("");

  // Caches the in-flight/resolved *promise* per employee, so several rows
  // asking for the same employee share a single request.
  const grossCache = useRef<Record<string, Promise<number>>>({});

  const set = (field: keyof AbsentMemoFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const totalAmount = detailRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalDays = detailRows.reduce((sum, row) => sum + Number(row.noOfDays || 0), 0);

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

  /** Fixed-component gross salary for an employee (port of the PowerBuilder SELECT). */
  const fetchGrossSalary = useCallback(
    (employeeCode: string): Promise<number> => {
      if (!grossCache.current[employeeCode]) {
        grossCache.current[employeeCode] = getDynamicLookup({
          parameter: "HR_ABSENT_MEMO_FIXED_GROSS_SAL",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
          code2: employeeCode,
        })
          .then((response) => {
            const first = Array.isArray(response) ? response[0] : null;
            return Number(first?.gross_sal ?? first?.GROSS_SAL ?? 0);
          })
          .catch((error) => {
            delete grossCache.current[employeeCode]; // never cache a failure
            throw error;
          });
      }
      return grossCache.current[employeeCode];
    },
    [user?.loginid, user?.company_code],
  );

  /* ── Load detail lines on edit ── */
  useEffect(() => {
    const fetchDetailRows = async () => {
      if (!isEdit || !existingData?.doc_no) return;
      try {
        const response = await getDynamicLookup({
          parameter: "HR_ABSENT_MEMO_TAB_2_DATA1",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
          number1: Number(existingData.doc_no),
        });
        setDetailRows(mapDetailRows(Array.isArray(response) ? response : []));
      } catch (error) {
        console.error("Failed to load absent memo detail rows:", error);
        setDetailRows([]);
        toastRef.current.error("Unable to load detail lines");
      }
    };
    void fetchDetailRows();
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

  /**
   * Called when From / To change:
   *  1) days = inclusive days between From and To
   *  2) amount = gross / days-in-month(From) * days
   * Invalid / incomplete dates clear both days and amount so no stale value is saved.
   */
  const recalcLine = useCallback(
    async (row: AbsentMemoDetailRow, patch: Partial<AbsentMemoDetailRow>) => {
      const next = { ...row, ...patch };
      const days = calcDaysBetween(next.absentFromDate, next.absentToDate);

      if (days <= 0) {
        updateRow(row.srNo, { ...patch, noOfDays: "", amount: "" });
        return;
      }
      updateRow(row.srNo, { ...patch, noOfDays: String(days) });

      if (!form.employeeCode) return;
      try {
        const monthDays = getDaysInMonth(next.absentFromDate);
        if (!monthDays) return;
        const gross = await fetchGrossSalary(form.employeeCode);
        updateRow(row.srNo, { amount: round3((gross / monthDays) * days).toFixed(3) });
      } catch (error) {
        console.error("Absent amount calculation failed:", error);
        toastRef.current.error("Unable to calculate amount");
      }
    },
    [form.employeeCode, fetchGrossSalary, updateRow],
  );

  /** Employee changed → recompute every line's amount with the new employee's salary. */
  const handleEmployeeChange = (value: string, row: LookupRow | null) => {
    const code = String(value ?? "");
    const picked = (row ?? {}) as Record<string, unknown>;
    const empId = String(picked.employee_id ?? picked.EMPLOYEE_ID ?? code);

    setForm((prev) => ({ ...prev, employeeCode: code, employeeId: empId }));
    setEmployeeName(String(picked.rpt_name ?? picked.RPT_NAME ?? ""));
    grossCache.current = {};
    if (!code) return;

    detailRows.forEach((r) => {
      const days = calcDaysBetween(r.absentFromDate, r.absentToDate);
      const monthDays = getDaysInMonth(r.absentFromDate);
      if (days <= 0 || !monthDays) return;
      fetchGrossSalary(code)
        .then((gross) =>
          updateRow(r.srNo, { amount: round3((gross / monthDays) * days).toFixed(3) }),
        )
        .catch(() => toastRef.current.error("Unable to calculate amount"));
    });
  };

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
    const badRange = detailRows.find(
      (r) => r.absentFromDate && r.absentToDate && r.absentToDate < r.absentFromDate,
    );
    if (badRange) {
      toast.warning(`Line ${badRange.srNo}: "To" date cannot be before "From" date`);
      return;
    }

    if (!form.docDate) {
      toast.warning("Document Date is required");
      return;
    }
    const validationError = validateAbsentMemo(form, detailRows);
    if (validationError) {
      toast.warning(validationError);
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
        employee_id:   form.employeeId   || form.employeeCode || "",
        amount: totalAmount,
        user_id: user?.loginid || "",
      };

      const details = detailRows.map((row, index) => ({
        company_code: user?.company_code ?? "",
        doc_type: form.docType || DOC_TYPE_ABSENT,
        doc_no: form.docNo ? Number(form.docNo) : 0,
        sr_no: Number(row.srNo) || index + 1,
        employee_id:   form.employeeId || "",
        emplyee_code: form.employeeCode || "",
        pay_comp_id: row.payUnit || "",
        amount: Number(row.amount || 0),
        recover_mth_amt: Number(row.amount || 0),
        recover_from_dt: row.effectiveFrom
          ? new Date(row.effectiveFrom).toISOString()
          : row.absentFromDate
            ? new Date(row.absentFromDate).toISOString()
            : undefined,
        leave_start_date: row.absentFromDate ,
        leave_end_date: row.absentToDate,
        deduct_from_leave: row.cancel === "Yes" ? "Y" : "N",
        deduct_noof_leavedays: Number(row.noOfDays || 0),
        ref_leave_doc_no: row.refLeaveDocNo || "",
        remarks: row.description || null, // DTL.REMARKS VARCHAR2(20)
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
      { accessorKey: "srNo", header: "No", size: 44, enableSorting: false },
      {
        accessorKey: "payUnit",
        header: "Pay Unit *",
        size: 140,
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
        header: "Description *",
        size: 190,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            value={row.original.description}
            onChange={(e) => updateRow(row.original.srNo, { description: e.target.value })}
            maxLength={FIELD_LIMITS.description}
          />
        ),
      },
      {
        accessorKey: "effectiveFrom",
        header: "Effective From *",
        size: 130,
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
        header: "Absent From *",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            type="date"
            value={row.original.absentFromDate}
            onChange={(e) => recalcLine(row.original, { absentFromDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "absentToDate",
        header: "Absent To *",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            type="date"
            value={row.original.absentToDate}
            onChange={(e) => recalcLine(row.original, { absentToDate: e.target.value })}
          />
        ),
      },
      {
        // Calculated from From/To — read-only so it can't drift from the amount.
        accessorKey: "noOfDays",
        header: "No. of Days *",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-right text-sm"
            type="number"
            step="0.000001"
            value={String(row.original.noOfDays ?? "")}
            readOnly
            disabled
          />
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount *",
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-right font-mono text-sm"
            type="number"
            step="0.0001"
            value={String(row.original.amount ?? "")}
            onChange={(e) => updateRow(row.original.srNo, { amount: e.target.value })}
          />
        ),
      },
      {
        accessorKey: "refLeaveDocNo",
        header: "Ref Leave Doc No",  // optional
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            value={row.original.refLeaveDocNo}
            onChange={(e) => updateRow(row.original.srNo, { refLeaveDocNo: e.target.value })}
            maxLength={FIELD_LIMITS.ref_leave_doc_no}
          />
        ),
      },
      {
        accessorKey: "cancel",
        header: "Cancel",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            className="!h-7 px-2 text-sm"
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
        size: 40,
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
    [loadPayUnits, updateRow, removeDetailRow, recalcLine],
  );

  // No per-column filter icons in this grid (keeps the header clean).
  const gridColumns = useMemo(
    () => columns.map((c) => ({ ...c, enableColumnFilter: false })),
    [columns],
  );

  /* ── UI ── */
  const lineCount = detailRows.length;

  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      {!showHeader ? (
        /* Collapsed: one-line summary */
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-1.5 text-xs shadow-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-4 text-slate-700">
            <SummaryItem label="Doc No" value={form.docNo || "Auto"} />
            <SummaryItem label="Doc Date" value={toDisplayDate(form.docDate)} />
            <SummaryItem label="Employee" value={employeeName || form.employeeCode || "Not selected"} />
            {form.refNo && <SummaryItem label="Ref" value={form.refNo} />}
            <SummaryItem
              label="Total"
              value={totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            />
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
          <div className="grid items-stretch gap-1.5 p-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)]">
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
                  name="docNo"
                  value={form.docNo}
                  onChange={(e) => set("docNo", e.target.value)}
                  readOnly={isEdit}
                  disabled={isEdit}
                  placeholder={isEdit ? "" : "Auto"}
                />
              </CField>

              <CField label="Doc Date" required className="max-w-[150px]">
                <Input
                  className={CTL}
                  type="date"
                  name="docDate"
                  value={form.docDate}
                  onChange={(e) => set("docDate", e.target.value)}
                />
              </CField>

              <CField label="Doc Type">
                <Input
                  className={CTL}
                  name="docType"
                  value={DOC_TYPE_LABELS[form.docType] ?? form.docType}
                  readOnly
                  disabled
                />
              </CField>

              <CField label="Ref No">
                <Input
                  className={CTL}
                  name="refNo"
                  value={form.refNo}
                  onChange={(e) => set("refNo", e.target.value)}
                  maxLength={FIELD_LIMITS.ref_no}
                />
              </CField>

              <CField label="Employee Code" required className="col-span-2 max-w-[340px]">
                <LookupField
                  compact
                  value={form.employeeCode}
                  columns={[
                    { field: "employee_code", header: "Employee Code" },
                    { field: "rpt_name", header: "Name" },
                  ]}
                  valueField="employee_code"
                  displayFields={["employee_code", "rpt_name"]}
                  loadOptions={loadEmployees}
                  onChange={handleEmployeeChange}
                  placeholder="Employee code or name"
                />
              </CField>
            </HeaderBlock>

            {/* ══ Block 2: From & Signatory ══ */}
            <HeaderBlock label="From & Signatory" icon={<UserCheck size={11} />}>
              <CField label="Name From">
                <Input
                  className={CTL}
                  name="nameFrom"
                  value={form.nameFrom}
                  onChange={(e) => set("nameFrom", e.target.value)}
                  maxLength={FIELD_LIMITS.name_from}
                />
              </CField>

              <CField label="Addr From">
                <Input
                  className={CTL}
                  name="addrFrom"
                  value={form.addrFrom}
                  onChange={(e) => set("addrFrom", e.target.value)}
                  maxLength={FIELD_LIMITS.addr_from}
                />
              </CField>

              <CField label="Signatory Name">
                <Input
                  className={CTL}
                  name="signatoryName"
                  value={form.signatoryName}
                  onChange={(e) => set("signatoryName", e.target.value)}
                  maxLength={FIELD_LIMITS.signatory_name}
                />
              </CField>

              <CField label="Signatory Position">
                <Input
                  className={CTL}
                  name="signatoryPosition"
                  value={form.signatoryPosition}
                  onChange={(e) => set("signatoryPosition", e.target.value)}
                  maxLength={FIELD_LIMITS.signatory_position}
                />
              </CField>
            </HeaderBlock>

            {/* ══ Block 3: Letter Details (widest — remarks live here) ══ */}
            <HeaderBlock label="Letter Details" icon={<StickyNote size={11} />}>
              <CField label="Letter Subject" className="col-span-2">
                <Input
                  className={CTL}
                  name="lettrSubject"
                  value={form.lettrSubject}
                  onChange={(e) => set("lettrSubject", e.target.value)}
                  maxLength={FIELD_LIMITS.lettr_subject}
                />
              </CField>

              <CField label="Remarks 1">
                <textarea
                  className={TEXTAREA}
                  name="remarks1"
                  value={form.remarks1}
                  onChange={(e) => set("remarks1", e.target.value)}
                  maxLength={FIELD_LIMITS.remarks_1}
                />
              </CField>

              <CField label="Remarks 2">
                <textarea
                  className={TEXTAREA}
                  name="remarks2"
                  value={form.remarks2}
                  onChange={(e) => set("remarks2", e.target.value)}
                  maxLength={FIELD_LIMITS.remarks_2}
                />
              </CField>
            </HeaderBlock>
          </div>
        </div>
      )}

      {/* ══ Lines card: toolbar (title · count · Add Line), grid, total chips ══ */}
      <div className="min-w-0 overflow-hidden rounded-md border border-[#cbd5e1] bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-[#cbd5e1] bg-slate-50 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
              <List size={11} />
            </span>
            <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-[#00378C]">
              Absence / Deduction Lines
            </h3>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00378C]">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            title="Add line"
            onClick={addDetailRow}
          >
            <Plus size={13} /> Add Line
          </Button>
        </div>

        <div className="p-2">
          <DataTable
            columns={gridColumns}
            data={detailRows}
            emptyText="No lines — click Add Line"
            height={220}
            minWidth={1150}
            density="grid"
            getRowId={(row) => String(row.srNo)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#cbd5e1] bg-slate-50/95 px-4 py-2">
          <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3.5 py-1.5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Total Days</span>
            <strong className="font-mono text-sm font-bold tabular-nums text-slate-900">{totalDays}</strong>
          </div>
          <div className="flex min-h-9 items-center gap-3 rounded-md border-2 border-[#00378c]/50 bg-blue-50 px-4 py-1.5 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00378c]">Total Amount</span>
            <strong className="font-mono text-base font-black tabular-nums text-[#00378c]">
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AddAbsentMemoPage;