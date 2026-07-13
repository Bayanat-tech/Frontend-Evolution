import { Loader2, Paperclip, RotateCcw, Save, Send, ShieldCheck, UserRound, X } from "lucide-react";
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
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import { HrLeaveAttachmentDialog } from "./HrLeaveAttachmentDialog";

type LeaveRequestDialogProps = {
  open: boolean;
  initialRow?: Record<string, unknown> | null;
  readOnly?: boolean;
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
  airTicket: "N" | "Y" | "";
  airRoute: string;
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
  airTicket: "",
  airRoute: "",
  travelDate: "",
  travelEndDate: "",
  replacementName: "",
  contactDuringLeave: "",
  supervisor: "",
  deptHead: "",
  hod: "",
};

export function LeaveRequestDialog({ open, initialRow, readOnly = false, onClose, onSaved }: LeaveRequestDialogProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeaveForm>(initialForm);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<HrLeaveEntitlement[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false);
  const [savingAction, setSavingAction] = useState<"SAVEASDRAFT" | "SUBMITTED" | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationText, setValidationText] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");
  const companyCode = String(user?.company_code || user?.COMPANY_CODE || "BSG");
  const userRecord = (user || {}) as Record<string, unknown>;
  const fallbackEmployeeName = String(userRecord.RPT_NAME || userRecord.rpt_name || user?.username || user?.USERNAME || loginId || "Current User");

  useEffect(() => {
    if (!open) return;
    const initialRequestNumber = getRowString(initialRow, "REQUEST_NUMBER", "requestNumber");
    setForm(initialRow ? formFromRow(initialRow) : { ...initialForm, requestDate: today() });
    setLeaveTypes([]);
    setRequestNumber(initialRequestNumber);
    setValidationText("");
    setNotice(null);
    setLoadingEmployees(true);
    loadEmployees(loginId)
      .then((rows) => {
        const safeRows = rows.length ? rows : [{ EMPLOYEE_ID: loginId, EMPLOYEE_CODE: loginId, RPT_NAME: fallbackEmployeeName }];
        setEmployees(safeRows);
        const rowEmployeeCode = getRowString(initialRow, "EMPLOYEE_CODE", "EMPLOYEE_ID", "employeeCode", "employeeId");
        const self = safeRows.find((employee) => getEmployeeCode(employee) === (rowEmployeeCode || loginId)) || safeRows[0];
        if (self && !initialRow) {
          handleEmployeeChange(getEmployeeCode(self), safeRows);
        }
        const entitlementEmployee = rowEmployeeCode || (self ? getEmployeeCode(self) : "");
        if (entitlementEmployee) {
          setLoadingLeaveTypes(true);
          loadLeaveEntitlement(entitlementEmployee)
            .then(setLeaveTypes)
            .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave types" }))
            .finally(() => setLoadingLeaveTypes(false));
        }
      })
      .catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employees" }))
      .finally(() => setLoadingEmployees(false));
  }, [open, initialRow, loginId, fallbackEmployeeName]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => getEmployeeCode(employee) === form.employeeCode),
    [employees, form.employeeCode],
  );
  const supervisorName = resolveEmployeeName(employees, form.supervisor);
  const deptHeadName = resolveEmployeeName(employees, form.deptHead);
  const hodName = resolveEmployeeName(employees, form.hod);
  const statusRemark = readOnly ? getStatusRemark(initialRow) : "";

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
      const saveResult = await saveHrLeaveApproval({
        COMPANY_CODE: companyCode,
        EMPLOYEE_NAME: form.employeeName,
        CREATED_BY: loginId,
        UPDATED_BY: loginId,
        LAST_ACTION: action,
        REQUEST_NUMBER: requestNumber,
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
        AIR_TICKET: form.airTicket,
        AIR_ROUTE: form.airRoute,
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
      const savedRequestNumber = getSavedRequestNumber(saveResult);
      if (savedRequestNumber) {
        setRequestNumber(savedRequestNumber);
      }

      if (action === "SAVEASDRAFT") {
        setNotice({
          type: "success",
          message: savedRequestNumber
            ? `Draft saved. Request ${savedRequestNumber} is ready for attachments.`
            : "Draft saved. Attachments will enable after request number is available.",
        });
        onSaved();
        return;
      }

      setNotice({ type: "success", message: "Leave request submitted" });
      onSaved();
      onClose();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save leave request" });
    } finally {
      setSavingAction(null);
    }
  };

  const openAttachments = () => {
    if (!requestNumber) {
      setNotice({ type: "error", message: "Save as draft first. Attachments need a generated request number." });
      return;
    }
    setAttachmentOpen(true);
  };

  const resetForm = () => {
    setForm({ ...initialForm, requestDate: today() });
    setRequestNumber("");
    setValidationText("");
    setNotice(null);
  };

  return (
    <Dialog
      open={open}
      title={readOnly ? "View Leave Request" : initialRow ? "Edit Leave Request" : "Add Leave Request"}
      wide
      contentClassName={`leave-request-dialog${readOnly ? " is-readonly" : ""}`}
      onClose={onClose}
      footer={
        readOnly ? (
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="icon" title="Cancel" aria-label="Cancel" onClick={onClose} disabled={Boolean(savingAction)}>
              <X size={16} />
            </Button>
            <Button type="button" variant="outline" size="icon" title="Reset" aria-label="Reset" onClick={resetForm} disabled={Boolean(savingAction)}>
              <RotateCcw size={16} />
            </Button>
            <Button type="button" variant="outline" size="icon" title="Save Draft" aria-label="Save Draft" onClick={() => void save("SAVEASDRAFT")} disabled={Boolean(savingAction)}>
              {savingAction === "SAVEASDRAFT" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            </Button>
            <Button type="button" size="icon" title="Submit" aria-label="Submit" onClick={() => void save("SUBMITTED")} disabled={Boolean(savingAction)}>
              {savingAction === "SUBMITTED" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </Button>
          </>
        )
      }
    >
      <div className="leave-request-form">
        <NoticeToast notice={notice} onClose={() => setNotice(null)} />

        <div className="leave-request-identity">
          <div className="leave-request-profile-icon">
            <UserRound size={22} />
          </div>
          <div className="min-w-0">
            <h3>{form.employeeCode ? `${form.employeeCode} - ${form.employeeName || "Employee"}` : "Select employee"}</h3>
            {requestNumber ? <p>Request No. {requestNumber}</p> : null}
          </div>
          <Field label="Request Date">
            <Input type="date" value={form.requestDate} onChange={(event) => update("requestDate", event.target.value)} disabled={readOnly} />
          </Field>
        </div>

        <div className="leave-request-grid">
          <section className="leave-request-section leave-request-section-main">
            <div className="leave-request-section-title">
              <span>Leave Details</span>
            </div>
            <div className="leave-request-fields">
              <Field label="Employee">
                <Select value={form.employeeCode} onChange={(event) => handleEmployeeChange(event.target.value)} disabled={readOnly || loadingEmployees}>
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
              <Field label="Leave Type *">
                <Select value={form.leaveType} onChange={(event) => update("leaveType", event.target.value)} disabled={readOnly || !form.employeeCode || loadingLeaveTypes}>
                  <option value="">{loadingLeaveTypes ? "Loading leave types..." : "Leave Type"}</option>
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
              <Field label="Leave Start Date *">
                <Input type="date" value={form.leaveStartDate} onChange={(event) => update("leaveStartDate", event.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Leave End Date *">
                <Input type="date" value={form.leaveEndDate} onChange={(event) => update("leaveEndDate", event.target.value)} disabled={readOnly} />
              </Field>
              <div className="leave-days-row">
                <Field label="Leave Days">
                  <Input type="number" min="0" step="0.5" value={form.leaveDays} onChange={(event) => update("leaveDays", event.target.value)} disabled={readOnly} />
                </Field>
                <label className="leave-half-day">
                  <input type="checkbox" checked={form.halfDay === "Y"} onChange={(event) => update("halfDay", event.target.checked ? "Y" : "N")} disabled={readOnly} />
                  <span>Half Day</span>
                </label>
              </div>
              <Button
                type="button"
                className={`leave-validate-button ${getValidationToneClass(validationText)}`}
                variant="outline"
                onClick={() => void validate()}
                disabled={readOnly || validating || !selectedEmployee}
              >
                {validating ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                {validationText || "Validate"}
              </Button>
            </div>
          </section>

          <section className="leave-request-section">
            <div className="leave-request-section-title">
              <span>Request Notes</span>
            </div>
            <div className="leave-request-fields">
              <Field label="Leave Allowance">
                <Select value={form.leaveAllowance} onChange={(event) => update("leaveAllowance", event.target.value as "N" | "Y" | "")} disabled={readOnly}>
                  <option value="">Leave Allowance</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </Select>
              </Field>
              <Field label="Advance Payment">
                <Select value={form.advancePayment} onChange={(event) => update("advancePayment", event.target.value as "N" | "Y" | "")} disabled={readOnly}>
                  <option value="">Advance Payment</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </Select>
              </Field>
              <Field label="Cause Type">
                <Input value={form.causeType} onChange={(event) => update("causeType", event.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Remarks *">
                <textarea className="leave-request-textarea" value={form.remarks} onChange={(event) => update("remarks", event.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Contact Details During Leave">
                <textarea className="leave-request-textarea leave-request-textarea-small" value={form.contactDuringLeave} onChange={(event) => update("contactDuringLeave", event.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Replacement Name">
                <Input value={form.replacementName} onChange={(event) => update("replacementName", event.target.value)} disabled={readOnly} />
              </Field>
            </div>
          </section>

          <section className="leave-request-section">
            <div className="leave-request-section-title">
              <span>Approver Details</span>
            </div>
            <div className="leave-request-fields">
              <Field label="Immediate Supervisor">
                <Input value={supervisorName} disabled />
              </Field>
              <Field label="Department Head">
                <Input value={deptHeadName} disabled />
              </Field>
              <Field label="HOD">
                <Input value={hodName} disabled />
              </Field>
              <Field label="Air Ticket">
                <Select value={form.airTicket} onChange={(event) => update("airTicket", event.target.value as "N" | "Y" | "")} disabled={readOnly}>
                  <option value="">Air Ticket</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </Select>
              </Field>
              <div className="leave-travel-row">
                <Field label="Travel Start Date">
                  <Input type="date" value={form.travelDate} onChange={(event) => update("travelDate", event.target.value)} disabled={readOnly} />
                </Field>
                <Field label="Travel End Date">
                  <Input type="date" value={form.travelEndDate} onChange={(event) => update("travelEndDate", event.target.value)} disabled={readOnly} />
                </Field>
              </div>
              <Field label="Air Route">
                <Input value={form.airRoute} onChange={(event) => update("airRoute", event.target.value)} disabled={readOnly} />
              </Field>
              {statusRemark ? (
                <Field label="Reject Remarks">
                  <textarea className="leave-request-textarea leave-request-textarea-small leave-status-remarks" value={statusRemark} disabled />
                </Field>
              ) : null}
              <div className="leave-attachments">
                <button
                  type="button"
                  className={`leave-attachment-button${!requestNumber ? " is-disabled" : ""}`}
                  title={!requestNumber ? "Save Draft first to enable attachments" : "Attach files"}
                  aria-label={!requestNumber ? "Save Draft first to enable attachments" : "Attach files"}
                  onClick={openAttachments}
                >
                  <span className="leave-attachment-icon">
                    <Paperclip size={16} />
                  </span>
                  <span className="leave-attachment-copy">
                    <strong>
                      {!requestNumber
                        ? "Save Draft"
                        : "Attachments"}
                    </strong>
                    <small>{!requestNumber ? "to enable files" : "PDF, image, document"}</small>
                  </span>
                </button>
                {!requestNumber ? <p className="leave-attachment-hint">Save draft first, then upload attachments.</p> : null}
              </div>
            </div>
          </section>
        </div>
      </div>
      <HrLeaveAttachmentDialog
        open={attachmentOpen}
        requestNumber={requestNumber}
        companyCode={companyCode}
        loginId={loginId}
        onClose={() => setAttachmentOpen(false)}
      />
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

function resolveEmployeeName(employees: HrEmployee[], employeeId: string) {
  if (!employeeId) return "";
  const employee = employees.find((item) => getEmployeeCode(item) === employeeId);
  return employee ? `${employeeId} - ${getEmployeeName(employee)}` : employeeId;
}

function getLeaveTypeLabel(leaveType: HrLeaveEntitlement) {
  const code = String(leaveType.LEAVE_TYPE || "");
  const desc = String(leaveType.LEAVE_DESC || leaveType.LEAVE_TYPE_DESC || code);
  return code && desc !== code ? `${code} - ${desc}` : desc;
}

async function loadEmployees(loginId: string) {
  let rows = await getHrEmployees(loginId);
  if (!rows.length) {
    rows = await executeHrRawSql<HrEmployee>(employeeTreeSql(loginId));
  }
  return uniqueBy(rows, getEmployeeCode).sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));
}

async function loadLeaveEntitlement(employeeId: string) {
  let rows = await getHrLeaveEntitlement(employeeId);
  if (!rows.length) {
    rows = await executeHrRawSql<HrLeaveEntitlement>(leaveEntitlementSql(employeeId));
  }
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

function getSavedRequestNumber(response: unknown) {
  if (!response || typeof response !== "object") return "";
  const record = response as Record<string, unknown>;
  const raw = record.request_number ?? record.requestNumber ?? record.data;
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (raw && typeof raw === "object") {
    const nested = raw as Record<string, unknown>;
    return String(nested.requestNumber ?? nested.REQUEST_NUMBER ?? nested.request_number ?? "");
  }
  return "";
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

function formFromRow(row: Record<string, unknown>): LeaveForm {
  return {
    requestDate: getDateInputValue(getRowString(row, "REQUEST_DATE", "requestDate")) || today(),
    employeeCode: getRowString(row, "EMPLOYEE_CODE", "EMPLOYEE_ID", "employeeCode", "employeeId"),
    employeeName: getRowString(row, "EMPLOYEE_NAME", "EMPLOYEE_NAME_DISPLAY", "RPT_NAME", "employeeName"),
    leaveType: getRowString(row, "LEAVE_TYPE", "leaveType"),
    leaveTypeDesc: getRowString(row, "LEAVE_TYPE_DESC", "leaveTypeDesc"),
    leaveStartDate: getDateInputValue(getRowString(row, "LEAVE_START_DATE", "leaveStartDate")),
    leaveEndDate: getDateInputValue(getRowString(row, "LEAVE_END_DATE", "leaveEndDate")),
    leaveDays: getRowString(row, "LEAVE_DAYS", "leaveDays"),
    remarks: getRowString(row, "REMARKS", "REASON", "remarks"),
    halfDay: getRowString(row, "HALF_DAY", "halfDay").toUpperCase() === "Y" ? "Y" : "N",
    leaveAllowance: getYesNoValue(getRowString(row, "LEAVE_ALLOWANCE", "leaveAllowance")),
    advancePayment: getYesNoValue(getRowString(row, "ADV_PAYMENT", "advancePayment")),
    causeType: getRowString(row, "CAUSE_TYPE", "causeType"),
    airTicket: getYesNoValue(getRowString(row, "AIR_TICKET", "airTicket")),
    airRoute: getRowString(row, "AIR_ROUTE", "airRoute"),
    travelDate: getDateInputValue(getRowString(row, "TRAVEL_DATE", "travelDate")),
    travelEndDate: getDateInputValue(getRowString(row, "TRAVEL_END_DATE", "travelEndDate")),
    replacementName: getRowString(row, "NAME_OF_REPLACEMENT", "replacementName"),
    contactDuringLeave: getRowString(row, "CONTACT_DETAILS_DURING_LEAVE", "contactDuringLeave"),
    supervisor: getRowString(row, "IMMEDIATE_SUPERVISOR", "SUPERVISOR_EMPID", "immediateSupervisor"),
    deptHead: getRowString(row, "DEPT_HEAD", "DEPT_HEAD_EMPID", "deptHead"),
    hod: getRowString(row, "HOD", "MANGR_EMPID", "hod"),
  };
}

function getRowString(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
}

function getStatusRemark(row: Record<string, unknown> | null | undefined) {
  return getRowString(
    row,
    "REJECT_REMARKS",
    "REJECT_REMARK",
    "REJECTED_REMARKS",
    "REJECTED_REMARK",
    "REJECTION_REMARKS",
    "REJECTION_REMARK",
    "CANCEL_REMARKS",
    "CANCEL_REMARK",
    "SENTBACK_REMARKS",
    "SENT_BACK_REMARKS",
    "APPROVAL_REMARKS",
    "ACTION_REMARKS",
    "STATUS_REMARKS",
    "rejectRemarks",
    "rejectRemark",
    "rejectedRemarks",
    "cancelRemarks",
    "sentBackRemarks",
    "approvalRemarks",
    "actionRemarks",
    "statusRemarks",
  );
}

function getDateInputValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getYesNoValue(value: string): "N" | "Y" | "" {
  const normalized = value.toUpperCase();
  return normalized === "Y" || normalized === "N" ? normalized : "";
}

function getValidationToneClass(text: string) {
  const lower = text.toLowerCase();
  if (!text) return "";
  if (lower.includes("insufficient") || lower.includes("failed") || lower.includes("error")) return "is-error";
  return "is-success";
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
