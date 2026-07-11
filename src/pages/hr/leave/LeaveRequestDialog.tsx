import { CalendarDays, CheckCircle2, Loader2, Plane, Save, Send, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  getHrEmployees,
  getHrLeaveEntitlement,
  executeHrRawSql,
  saveHrLeaveApproval,
  validateHrLeave,
  type HrEmployee,
  type HrLeaveEntitlement,
} from "../../../api/hr";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";

type LeaveRequestDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type LeaveForm = {
  requestDate: string;
  employeeCode: string;
  employeeName: string;
  leaveType: string;
  leaveTypeDesc: string;
  leaveStartDate: string;
  leaveEndDate: string;
  leaveDays: string;
  remarks: string;
  halfDay: "N" | "Y";
  leaveAllowance: "N" | "Y" | "";
  advancePayment: "N" | "Y" | "";
  causeType: string;
  travelDate: string;
  travelEndDate: string;
  replacementName: string;
  contactDuringLeave: string;
  supervisor: string;
  deptHead: string;
  hod: string;
};

const initialForm: LeaveForm = {
  requestDate: today(),
  employeeCode: "",
  employeeName: "",
  leaveType: "",
  leaveTypeDesc: "",
  leaveStartDate: "",
  leaveEndDate: "",
  leaveDays: "",
  remarks: "",
  halfDay: "N",
  leaveAllowance: "",
  advancePayment: "",
  causeType: "",
  travelDate: "",
  travelEndDate: "",
  replacementName: "",
  contactDuringLeave: "",
  supervisor: "",
  deptHead: "",
  hod: "",
};

export function LeaveRequestDialog({ open, onClose, onSaved }: LeaveRequestDialogProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeaveForm>(initialForm);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<HrLeaveEntitlement[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false);
  const [savingAction, setSavingAction] = useState<"SAVEASDRAFT" | "SUBMITTED" | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationText, setValidationText] = useState("");
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");
  const companyCode = String(user?.company_code || user?.COMPANY_CODE || "BSG");

  useEffect(() => {
    if (!open) return;
    setForm({ ...initialForm, requestDate: today() });
    setLeaveTypes([]);
    setValidationText("");
    setNotice(null);
    setLoadingEmployees(true);
    loadEmployees(loginId)
      .then((rows) => {
        setEmployees(rows);
        const self = rows.find((employee) => getEmployeeCode(employee) === loginId) || rows[0];
        if (self) {
          handleEmployeeChange(getEmployeeCode(self), rows);
        }
      })
      .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employees" }))
      .finally(() => setLoadingEmployees(false));
  }, [open, loginId]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => getEmployeeCode(employee) === form.employeeCode),
    [employees, form.employeeCode],
  );

  const uniqueLeaveTypes = useMemo(() => {
    const map = new Map<string, HrLeaveEntitlement>();
    leaveTypes.forEach((leaveType) => {
      const code = String(leaveType.LEAVE_TYPE || "");
      if (code && !map.has(code)) map.set(code, leaveType);
    });
    return Array.from(map.values()).sort((a, b) => getLeaveTypeLabel(a).localeCompare(getLeaveTypeLabel(b)));
  }, [leaveTypes]);

  const update = (key: keyof LeaveForm, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if ((key === "leaveStartDate" || key === "leaveEndDate") && next.leaveStartDate && next.leaveEndDate) {
        next.leaveDays = String(calculateInclusiveDays(next.leaveStartDate, next.leaveEndDate));
      }
      if (key === "leaveType") {
        const selected = leaveTypes.find((leaveType) => String(leaveType.LEAVE_TYPE || "") === value);
        next.leaveTypeDesc = selected ? getLeaveTypeLabel(selected) : "";
      }
      return next;
    });
    if (["leaveType", "leaveStartDate", "leaveEndDate", "leaveDays"].includes(key)) {
      setValidationText("");
    }
  };

  const handleEmployeeChange = (employeeCode: string, sourceEmployees = employees) => {
    const employee = sourceEmployees.find((item) => getEmployeeCode(item) === employeeCode);
    setValidationText("");
    setLeaveTypes([]);
    setForm((current) => ({
      ...current,
      employeeCode,
      employeeName: employee ? getEmployeeName(employee) : "",
      leaveType: "",
      leaveTypeDesc: "",
      supervisor: String(employee?.SUPERVISOR_EMPID || employee?.IMMEDIATE_SUPERVISOR || ""),
      deptHead: String(employee?.DEPT_HEAD_EMPID || employee?.DEPT_HEAD || ""),
      hod: String(employee?.MANGR_EMPID || employee?.HOD || ""),
    }));

    if (!employeeCode) return;
    setLoadingLeaveTypes(true);
    loadLeaveEntitlement(employeeCode)
      .then(setLeaveTypes)
      .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave types" }))
      .finally(() => setLoadingLeaveTypes(false));
  };

  const validate = async () => {
    const errors = getValidationErrors(form);
    if (errors.length) {
      setNotice({ type: "error", message: errors[0] });
      return false;
    }
    setValidating(true);
    try {
      const response = await validateHrLeave({
        companyCode,
        employeeId: form.employeeCode,
        leaveStartDate: form.leaveStartDate,
        leaveEndDate: form.leaveEndDate,
        leaveType: form.leaveType,
        leaveDays: Number(form.leaveDays || 0),
      });
      const text = parseValidationMessage(response);
      setValidationText(text);
      setNotice({ type: text.toLowerCase().includes("insufficient") || text.toLowerCase().includes("failed") ? "error" : "success", message: text });
      return !text.toLowerCase().includes("insufficient") && !text.toLowerCase().includes("failed");
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to validate leave" });
      return false;
    } finally {
      setValidating(false);
    }
  };

  const save = async (action: "SAVEASDRAFT" | "SUBMITTED") => {
    const errors = getValidationErrors(form);
    if (errors.length) {
      setNotice({ type: "error", message: errors[0] });
      return;
    }
    setSavingAction(action);
    setNotice(null);
    try {
      await saveHrLeaveApproval({
        COMPANY_CODE: companyCode,
        EMPLOYEE_NAME: form.employeeName,
        CREATED_BY: loginId,
        UPDATED_BY: loginId,
        LAST_ACTION: action,
        REQUEST_NUMBER: "",
        REQUEST_DATE: form.requestDate,
        EMPLOYEE_CODE: form.employeeCode,
        LEAVE_TYPE: form.leaveType,
        LEAVE_TYPE_DESC: form.leaveTypeDesc,
        LEAVE_START_DATE: form.leaveStartDate,
        LEAVE_END_DATE: form.leaveEndDate,
        LEAVE_DAYS: Number(form.leaveDays || 0),
        REMARKS: form.remarks,
        FLOW_CODE: "004",
        HOD: form.hod,
        IMMEDIATE_SUPERVISOR: form.supervisor,
        DEPT_HEAD: form.deptHead,
        LEAVE_ALLOWANCE: form.leaveAllowance,
        ADV_PAYMENT: form.advancePayment,
        CAUSE_TYPE: form.causeType,
        TRAVEL_DATE: form.travelDate,
        TRAVEL_END_DATE: form.travelEndDate,
        NAME_OF_REPLACEMENT: form.replacementName,
        CONTACT_DETAILS_DURING_LEAVE: form.contactDuringLeave,
        RESUME_DATE: "",
        HALF_DAY: form.halfDay,
        RESUME_WORK: "No",
        ACTUAL_RESUME_DATE: "",
        DUTY_RESUME_DATE: "",
        UUID: getUuid(),
      });
      setNotice({ type: "success", message: action === "SAVEASDRAFT" ? "Leave request saved as draft" : "Leave request submitted" });
      onSaved();
      onClose();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save leave request" });
    } finally {
      setSavingAction(null);
    }
  };

  return (
    <Dialog
      open={open}
      title="Add Leave Request"
      description="Create a leave request using the same HR flow used by the legacy screen."
      wide
      contentClassName="leave-request-dialog"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={Boolean(savingAction)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => void save("SAVEASDRAFT")} disabled={Boolean(savingAction)}>
            {savingAction === "SAVEASDRAFT" ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Save Draft
          </Button>
          <Button type="button" onClick={() => void save("SUBMITTED")} disabled={Boolean(savingAction)}>
            {savingAction === "SUBMITTED" ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Submit
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <NoticeToast notice={notice} onClose={() => setNotice(null)} />

        <div className="grid gap-3 rounded-md border bg-gradient-to-r from-primary/10 via-card to-secondary/40 p-4 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="flex items-center gap-3 md:col-span-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-background text-primary shadow-sm">
              <UserRound size={21} />
            </div>
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Requester</p>
              <h3 className="m-0 truncate text-lg font-semibold text-foreground">{form.employeeName || "Select employee"}</h3>
              <p className="m-0 text-sm text-muted-foreground">{form.employeeCode || "Employee code pending"}</p>
            </div>
          </div>
          <Field label="Request Date">
            <Input type="date" value={form.requestDate} onChange={(event) => update("requestDate", event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-4">
          <Field label="Employee">
            <Select value={form.employeeCode} onChange={(event) => handleEmployeeChange(event.target.value)} disabled={loadingEmployees}>
              <option value="">{loadingEmployees ? "Loading employees..." : "Select employee"}</option>
              {employees.map((employee) => {
                const code = getEmployeeCode(employee);
                return (
                  <option key={code} value={code}>
                    {code} - {getEmployeeName(employee)}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Employee Name">
            <Input value={form.employeeName} disabled />
          </Field>
          <Field label="Half Day">
            <Select value={form.halfDay} onChange={(event) => update("halfDay", event.target.value as "N" | "Y")}>
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <CalendarDays size={16} className="text-primary" />
            <p className="m-0 text-sm font-semibold text-foreground">Leave Details</p>
            <Badge variant="outline" className="ml-auto">{uniqueLeaveTypes.length} entitled type{uniqueLeaveTypes.length === 1 ? "" : "s"}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
          <Field label="Leave Type">
            <Select value={form.leaveType} onChange={(event) => update("leaveType", event.target.value)} disabled={!form.employeeCode || loadingLeaveTypes}>
              <option value="">{loadingLeaveTypes ? "Loading leave types..." : "Select leave type"}</option>
              {uniqueLeaveTypes.map((leaveType) => {
                const code = String(leaveType.LEAVE_TYPE || "");
                return (
                  <option key={code} value={code}>
                    {getLeaveTypeLabel(leaveType)}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Start Date">
            <Input type="date" value={form.leaveStartDate} onChange={(event) => update("leaveStartDate", event.target.value)} />
          </Field>
          <Field label="End Date">
            <Input type="date" value={form.leaveEndDate} onChange={(event) => update("leaveEndDate", event.target.value)} />
          </Field>
          <Field label="Leave Days">
            <Input type="number" min="0" step="0.5" value={form.leaveDays} onChange={(event) => update("leaveDays", event.target.value)} />
          </Field>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <Plane size={16} className="text-primary" />
            <p className="m-0 text-sm font-semibold text-foreground">Travel And Allowance</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
          <Field label="Leave Allowance">
            <Select value={form.leaveAllowance} onChange={(event) => update("leaveAllowance", event.target.value as "N" | "Y" | "")}>
              <option value="">Select</option>
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </Field>
          <Field label="Advance Payment">
            <Select value={form.advancePayment} onChange={(event) => update("advancePayment", event.target.value as "N" | "Y" | "")}>
              <option value="">Select</option>
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </Field>
          <Field label="Travel Date">
            <Input type="date" value={form.travelDate} onChange={(event) => update("travelDate", event.target.value)} />
          </Field>
          <Field label="Travel End Date">
            <Input type="date" value={form.travelEndDate} onChange={(event) => update("travelEndDate", event.target.value)} />
          </Field>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-3">
          <Field label="Replacement Name">
            <Input value={form.replacementName} onChange={(event) => update("replacementName", event.target.value)} />
          </Field>
          <Field label="Contact During Leave">
            <Input value={form.contactDuringLeave} onChange={(event) => update("contactDuringLeave", event.target.value)} />
          </Field>
          <Field label="Cause Type">
            <Input value={form.causeType} onChange={(event) => update("causeType", event.target.value)} />
          </Field>
          <Field label="Remarks" className="md:col-span-3">
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.remarks}
              onChange={(event) => update("remarks", event.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-secondary/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1"><UsersRound size={12} /> Supervisor: {form.supervisor || "-"}</Badge>
            <Badge variant="outline">Dept Head: {form.deptHead || "-"}</Badge>
            <Badge variant="outline">HOD: {form.hod || "-"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {validationText ? (
              <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={12} /> {validationText}
              </Badge>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void validate()} disabled={validating || !selectedEmployee}>
              {validating ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />} Validate
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`field min-w-0 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function getEmployeeCode(employee: HrEmployee) {
  return String(employee.EMPLOYEE_ID || employee.EMPLOYEE_CODE || employee.ALTERNATE_ID || "");
}

function getEmployeeName(employee: HrEmployee) {
  return String(employee.RPT_NAME || employee.EMPLOYEE_NAME || employee.Employee_Name || employee.EMPLOYEE_ID || "");
}

function getLeaveTypeLabel(leaveType: HrLeaveEntitlement) {
  const code = String(leaveType.LEAVE_TYPE || "");
  const desc = String(leaveType.LEAVE_DESC || leaveType.LEAVE_TYPE_DESC || code);
  return code && desc !== code ? `${code} - ${desc}` : desc;
}

async function loadEmployees(loginId: string) {
  const [apiRows, sqlRows] = await Promise.allSettled([getHrEmployees(loginId), executeHrRawSql<HrEmployee>(employeeTreeSql(loginId))]);
  const rows = [
    ...(apiRows.status === "fulfilled" ? apiRows.value : []),
    ...(sqlRows.status === "fulfilled" ? sqlRows.value : []),
  ];
  return uniqueBy(rows, getEmployeeCode).sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));
}

async function loadLeaveEntitlement(employeeId: string) {
  const [apiRows, sqlRows] = await Promise.allSettled([
    getHrLeaveEntitlement(employeeId),
    executeHrRawSql<HrLeaveEntitlement>(leaveEntitlementSql(employeeId)),
  ]);
  const rows = [
    ...(apiRows.status === "fulfilled" ? apiRows.value : []),
    ...(sqlRows.status === "fulfilled" ? sqlRows.value : []),
  ];
  return uniqueBy(rows, (row) => String(row.LEAVE_TYPE || "")).filter((row) => row.LEAVE_TYPE);
}

function uniqueBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const key = getKey(row);
    if (key && !map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

function employeeTreeSql(loginId: string) {
  const safeLogin = escapeSql(loginId);
  return `
    SELECT DISTINCT *
    FROM (
      SELECT *
      FROM VW_HR_EMPLOYEE_AWARE
      WHERE EMP_STATUS <> 'S'
      START WITH
        EMPLOYEE_ID = '${safeLogin}'
        OR SUPERVISOR_EMPID = '${safeLogin}'
        OR DEPT_HEAD_EMPID = '${safeLogin}'
        OR MANGR_EMPID = '${safeLogin}'
      CONNECT BY NOCYCLE PRIOR EMPLOYEE_ID = SUPERVISOR_EMPID
        OR PRIOR EMPLOYEE_ID = DEPT_HEAD_EMPID
        OR PRIOR EMPLOYEE_ID = MANGR_EMPID
    )
  `;
}

function leaveEntitlementSql(employeeId: string) {
  return `
    SELECT DISTINCT LEAVE_TYPE, LEAVE_DESC, LEAVE_TYPE_DESC
    FROM VW_HR_EMP_LEAVE_ENTITLE_AWARE
    WHERE EMPLOYEE_ID = '${escapeSql(employeeId)}'
      AND LEAVE_TYPE IS NOT NULL
  `;
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function getValidationErrors(form: LeaveForm) {
  const errors: string[] = [];
  if (!form.requestDate) errors.push("Request date is required");
  if (!form.employeeCode) errors.push("Employee is required");
  if (!form.leaveType) errors.push("Leave type is required");
  if (!form.leaveStartDate) errors.push("Leave start date is required");
  if (!form.leaveEndDate) errors.push("Leave end date is required");
  if (Number(form.leaveDays || 0) <= 0) errors.push("Leave days must be greater than zero");
  if (!form.remarks.trim()) errors.push("Remarks are required");
  return errors;
}

function calculateInclusiveDays(startValue: string, endValue: string) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function parseValidationMessage(response: unknown) {
  if (typeof response === "string") return parseValidationString(response);
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    const raw = record.validationResult ?? record.message ?? record.data;
    if (typeof raw === "string") return parseValidationString(raw);
    if (record.success === false) return String(record.message || "Leave validation failed");
  }
  return "Leave validation passed";
}

function parseValidationString(value: string) {
  if (value.includes("$$$")) {
    const [status, balance] = value.split("$$$");
    return status.toUpperCase().startsWith("S") ? `Available balance: ${balance} days` : `Leave validation failed: ${balance}`;
  }
  return value || "Leave validation passed";
}

function getUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
