import { ArrowLeft, Loader2, Paperclip, Save, Send, ShieldCheck, Trash2, Undo2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  executeHrRawSql,
  validateHrLeave,
  type HrEmployee,
  type HrLeaveEntitlement,
  getleavedaycount,
  getRequestFlowUsers,
  getHrWorkflowIdentity,
  getHrWorkflowRequest,
  getHrEmployeeFiles,
} from "../../../api/hr";
import { Button } from "../../../components/ui/Button";
import { LmsDialog } from "../../../components/ui/LmsDialog";
import { Input } from "../../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import { toApiDateInput, toBackendDate, toIsoDate } from "../../../hooks/apiDate";
import { getDynamicLookupaccount } from "../../../api/lookups";
import { api } from "../../../api/client";
import { HrLeaveAttachmentPanel } from "./HrLeaveAttachmentPanel";

const LEAVE_TYPES_SKIP_VALIDATION = new Set(["SL"]);

type SaveAction = "SAVEASDRAFT" | "SUBMITTED" | "CANCEL" | "REJECTED" | "SENTBACK";

type LeaveRequestDialogProps = {
  open: boolean;
  initialRow?: Record<string, unknown> | null;
  isEditMode?: boolean;
  readOnly?: boolean;
  /** When true, renders as a full page section (like WMS master editor) instead of a modal. */
  inline?: boolean;
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
  resumedate: string;
  resumework: string;
  dutyresumedate: string;
  actualresumedate: string;
};

type LeaveValidationResult = {
  success?: boolean;
  isValid: boolean;
  availableBalance: number | null;
  message: string;
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
  resumedate: "",
  resumework: "",
  dutyresumedate: "",
  actualresumedate: "",
};

// ---------------------------------SAVE API PROCEDURE-----------------------------------//
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: string;
};
type SaveLeaveResponse = ApiResponse<unknown> & { requestNumber?: string };

function extractApiErrorMessage(error: unknown, fallback: string) {
  const anyErr = error as any;
  const data = anyErr?.response?.data;
  const backendMessage = data?.details || data?.message;
  if (backendMessage && typeof backendMessage === "string") return backendMessage;
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function saveLeaveRequestFlow(
  payload: Record<string, unknown>,
  loginId: string
): Promise<SaveLeaveResponse> {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  const body = {
    loginId,
    companyCode: s(payload.COMPANY_CODE),
    requestNumber: s(payload.REQUEST_NUMBER),
    employeeCode: s(payload.EMPLOYEE_CODE),
    employeeName: s(payload.EMPLOYEE_NAME),
    leaveType: s(payload.LEAVE_TYPE),
    requestDate: s(payload.REQUEST_DATE),
    leaveStartDate: s(payload.LEAVE_START_DATE),
    leaveEndDate: s(payload.LEAVE_END_DATE),
    remarks: s(payload.REMARKS),
    halfDay: s(payload.HALF_DAY),
    leaveAllowance: s(payload.LEAVE_ALLOWANCE),
    advPayment: s(payload.ADV_PAYMENT),
    causeType: s(payload.CAUSE_TYPE),
    airTicket: s(payload.AIR_TICKET),
    airRoute: s(payload.AIR_ROUTE),
    travelDate: s(payload.TRAVEL_DATE),
    travelEndDate: s(payload.TRAVEL_END_DATE),
    nameOfReplacement: s(payload.NAME_OF_REPLACEMENT),
    contactDetailsDuringLeave: s(payload.CONTACT_DETAILS_DURING_LEAVE),
    dutyResumeDate: s(payload.DUTY_RESUME_DATE),
    actualResumeDate: s(payload.ACTUAL_RESUME_DATE),
    hod: s(payload.HOD),
    immediateSupervisor: s(payload.IMMEDIATE_SUPERVISOR),
    deptHead: s(payload.DEPT_HEAD),
    lastAction: s(payload.LAST_ACTION),
    createdBy: s(payload.CREATED_BY),
    uuid: s(payload.UUID),
    flowCode: s(payload.FLOW_CODE),
    nextActionBy: s(payload.NEXT_ACTION_BY),
    sentbackHistory: s(payload.SENTBACK_HISTORY),
    cancelRemark: s(payload.CANCEL_REMARK),

    leaveDays: Number(payload.LEAVE_DAYS || 0),
    flowLevelInitial: Number(payload.FLOW_LEVEL_INITIAL ?? 0),
    flowLevelRunning: Number(payload.FLOW_LEVEL_RUNNING ?? 0),
    flowLevelFinal: Number(payload.FLOW_LEVEL_FINAL ?? 3),
  };

  try {
    const response = await api.post<SaveLeaveResponse>("/api/hr/workflow/leaveRequestFlow", body);
    if (!response.data.success) {
      throw new Error(response.data.details || response.data.message || "Unable to save record");
    }
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to save record"));
  }
}
// -----------------------------------------------------------------------------------//

export function LeaveRequestDialog({
  open,
  initialRow,
  readOnly = false,
  inline = false,
  onClose,
  onSaved,
}: LeaveRequestDialogProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeaveForm>(initialForm);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<HrLeaveEntitlement[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false);
  const [savingAction, setSavingAction] = useState<SaveAction | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<LeaveValidationResult | null>(null);
  const [approverInfo, setApproverInfo] = useState<Record<string, unknown> | null>(null);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "attachments">("details");
  const [attachmentCount, setAttachmentCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LeaveForm, string>>>({});
  const [fetchingLeaveDays, setFetchingLeaveDays] = useState(false);

  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [sentBackParams, setSentBackParams] = useState<{
    LOGIN_ID: string;
    USERNAME: string;
    SENTBACK_HISTORY: string;
  }>({ LOGIN_ID: "", USERNAME: "", SENTBACK_HISTORY: "" });

  const [rejectParams, setRejectParams] = useState<{ CANCEL_REMARK: string }>({
    CANCEL_REMARK: "",
  });

  const [userFlowData, setUserFlowData] = useState<{ LOGIN_ID: string; USERNAME: string }[]>([]);
  const [loadingFlowUsers, setLoadingFlowUsers] = useState(false);
  const [workflowRow, setWorkflowRow] = useState<Record<string, any> | null>(null);
  const [workflowActor, setWorkflowActor] = useState("");
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");

  const loginId = workflowActor || String(user?.LOGINID1 || user?.loginid1 || "");
  const companyCode = String(user?.company_code || user?.COMPANY_CODE || "BSG");
  const userRecord = (user || {}) as Record<string, unknown>;
  const fallbackEmployeeName = String(
    userRecord.RPT_NAME || userRecord.rpt_name || user?.username || user?.USERNAME || loginId || "Current User"
  );
  const LOGINUSER = String(user?.LOGINID || user?.loginid || "");
  const tenantName = /[A-Za-z]/.test(LOGINUSER.trim()) ? "MHDL" : "ALMS";
  const isAlms = tenantName === "ALMS";
  const isCreator = isAlms
    ? !initialRow || String(workflowRow?.CREATED_BY || initialRow.CREATED_BY || "").trim() === loginId
    : initialRow?.CREATED_BY === user?.loginid1 ||
      initialRow?.CREATED_BY === undefined ||
      initialRow?.CREATED_BY === null ||
      initialRow?.CREATED_BY === "";
  const createMode = !requestNumber;
  const permissions = (isAlms ? workflowRow?.WORKFLOW_PERMISSIONS || {} : { canApprove: !isCreator }) as Record<string, any>;
  const canPrimary = !isAlms || Boolean(permissions.canSubmit || permissions.canApprove);
  const fieldsDisabled = readOnly || !isCreator || workflowLoading || Boolean(workflowError);

  // Sick leave (e.g. "002 - SICK LEAVE") needs a supporting attachment before it can be submitted.
  const isSickLeave = form.leaveType === "002" || (form.leaveTypeDesc || "").toUpperCase().includes("SICK");
  const sickLeaveNeedsAttachment = isCreator && isSickLeave && (attachmentCount ?? 0) === 0;

  // The Attachments tab exists only for sick leave; always start on the details tab.
  useEffect(() => {
    if (!isSickLeave) setActiveTab("details");
  }, [isSickLeave]);
  useEffect(() => {
    if (open) setActiveTab("details");
  }, [open]);

  const refreshAttachmentCount = async (reqNo: string = requestNumber): Promise<number> => {
    if (!reqNo) {
      setAttachmentCount(0);
      return 0;
    }
    const count = await countLeaveAttachments(reqNo);
    setAttachmentCount(count);
    return count;
  };

  useEffect(() => {
    if (!open) return;
    if (!isSickLeave) {
      setAttachmentCount(null);
      return;
    }
    if (!requestNumber) {
      setAttachmentCount(0);
      return;
    }
    let cancelled = false;
    countLeaveAttachments(requestNumber)
      .then((count) => {
        if (!cancelled) setAttachmentCount(count);
      })
      .catch(() => {
        if (!cancelled) setAttachmentCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requestNumber, isSickLeave]);

  useEffect(() => {
    if (!open) return;
    if (!isAlms) {
      setWorkflowRow(null);
      setWorkflowActor("");
      setWorkflowLoading(false);
      setWorkflowError("");
      return;
    }
    let current = true;
    setWorkflowLoading(true);
    setWorkflowError("");
    setWorkflowRow(null);
    setWorkflowActor("");
    const request = getRowString(initialRow, "REQUEST_NUMBER", "requestNumber");
    Promise.all([getHrWorkflowIdentity(), request ? getHrWorkflowRequest(request) : Promise.resolve(null)])
      .then(([actor, row]) => {
        if (current) {
          setWorkflowActor(actor);
          setWorkflowRow(row);
          if (row) setForm(formFromRow({ ...initialRow, ...row }));
        }
      })
      .catch((error) => {
        if (current) {
          const message = error instanceof Error ? error.message : "Workflow verification failed.";
          setWorkflowError(message);
          setNotice({ type: "error", message });
        }
      })
      .finally(() => {
        if (current) setWorkflowLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open, initialRow, isAlms]);

  useEffect(() => {
    if (!open) return;
    const initialRequestNumber = getRowString(initialRow, "REQUEST_NUMBER", "requestNumber");
    setForm(initialRow ? formFromRow(initialRow) : { ...initialForm, requestDate: today() });
    setLeaveTypes([]);
    setRequestNumber(initialRequestNumber);
    setValidationResult(null);
    setShowValidationAlert(false);
    setNotice(null);
    setLoadingEmployees(true);
    loadEmployees(loginId, companyCode)
      .then((rows) => {
        const safeRows = rows.length
          ? rows
          : [{ EMPLOYEE_ID: loginId, EMPLOYEE_CODE: loginId, RPT_NAME: fallbackEmployeeName }];
        setEmployees(safeRows);
        const rowEmployeeCode = getRowString(initialRow, "EMPLOYEE_CODE", "EMPLOYEE_ID", "employeeCode", "employeeId");
        const self = safeRows.find((employee) => getEmployeeCode(employee) === (rowEmployeeCode || loginId)) || safeRows[0];
        if (self && !initialRow) {
          handleEmployeeChange(getEmployeeCode(self), safeRows);
        }
        const entitlementEmployee = rowEmployeeCode || (self ? getEmployeeCode(self) : "");
        if (entitlementEmployee) {
          setLoadingLeaveTypes(true);
          loadLeaveEntitlement(entitlementEmployee, companyCode, loginId)
            .then(setLeaveTypes)
            .catch((error) =>
              setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave types" })
            )
            .finally(() => setLoadingLeaveTypes(false));
        }
      })
      .catch((error) =>
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employees" })
      )
      .finally(() => setLoadingEmployees(false));
  }, [open, initialRow, loginId, fallbackEmployeeName, companyCode]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => getEmployeeCode(employee) === form.employeeCode),
    [employees, form.employeeCode]
  );

  const lastAction = getRowString(initialRow, "LAST_ACTION", "lastAction").toUpperCase();

  const sendBackRemark = getRowString(initialRow, "SENTBACK_HISTORY", "sendBackHistory");
  const rejectRemark = getRowString(
    initialRow,
    "CANCEL_REMARK",
    "REJECT_REMARKS",
    "REJECT_REMARK",
    "REJECTED_REMARKS",
    "REJECTED_REMARK",
    "cancelRemark",
    "rejectRemarks"
  );

  const showSendBackRemark = lastAction === "SENTBACK" && sendBackRemark.trim() !== "";
  const showRejectRemark = lastAction === "REJECTED" && rejectRemark.trim() !== "";

  const uniqueLeaveTypes = useMemo(() => {
    const map = new Map<string, HrLeaveEntitlement>();
    leaveTypes.forEach((leaveType) => {
      const code = String(leaveType.LEAVE_TYPE || "");
      if (code && !map.has(code)) map.set(code, leaveType);
    });
    return Array.from(map.values()).sort((a, b) => getLeaveTypeLabel(a).localeCompare(getLeaveTypeLabel(b)));
  }, [leaveTypes]);

  const update = (key: keyof LeaveForm, value: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Local first guess of the days; the API result (below) then corrects the end date and days.
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
      setValidationResult(null);
      setShowValidationAlert(false);
    }
  };

  useEffect(() => {
    if (!form.employeeCode) {
      setApproverInfo(null);
      return;
    }
    let cancelled = false;
    executeHrRawSql<Record<string, unknown>>(
      `SELECT * FROM VW_HR_EMPLOYEE_NEW WHERE EMPLOYEE_ID = '${escapeSql(form.employeeCode)}'`
    )
      .then((rows) => {
        if (!cancelled) setApproverInfo(rows?.[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setApproverInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.employeeCode]);

  const supervisorName = getApproverDisplay(approverInfo, "SUPERVISOR_NAME", form.supervisor);
  const deptHeadName = getApproverDisplay(approverInfo, "DEPT_HEAD_NAME", form.deptHead);
  const hodName = getApproverDisplay(approverInfo, "MANAGER_NAME", form.hod);

  // Flow: user picks start date + end date -> API returns the leave days ->
  // end date is recalculated as (start date + leave days) and shown in the Leave End Date field.
  const syncedKeyRef = useRef("");
  useEffect(() => {
    if (!open) return;
    if (!form.leaveStartDate || !form.leaveEndDate || !form.employeeCode || !form.leaveType) {
      return;
    }
    // Skip when these exact values are what we last synced (prevents a call loop).
    const key = [form.leaveStartDate, form.leaveEndDate, form.leaveType, form.employeeCode, form.halfDay].join("|");
    if (key === syncedKeyRef.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setFetchingLeaveDays(true);
      getleavedaycount(
        {
          leaveStartDate: toBackendDate(form.leaveStartDate),
          leaveEndDate: toBackendDate(form.leaveEndDate),
          leaveType: form.leaveType,
          company_code: companyCode,
          employee_code: form.employeeCode,
          half_day: form.halfDay,
        },
        tenantName
      )
        .then((response) => {
          if (cancelled) return;

          const apiDays = extractLeaveDays(response);

          // End date = start date + leave days (from API). Day 1 is the start date itself,
          // so N days end on start + (N - 1). Falls back to the API end date, then to the user's pick.
          const endDate =
            apiDays !== null && apiDays > 0
              ? calculateEndDate(form.leaveStartDate, apiDays)
              : extractLeaveEndDate(response) || form.leaveEndDate;

          // Remember this combination so setting the new end date doesn't trigger the API again.
          syncedKeyRef.current = [form.leaveStartDate, endDate, form.leaveType, form.employeeCode, form.halfDay].join("|");

          setForm((current) => ({
            ...current,
            leaveEndDate: endDate,
            leaveDays: apiDays !== null ? String(apiDays) : current.leaveDays,
          }));
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn("getleavedaycount failed, using local calculation", error);
        })
        .finally(() => {
          if (!cancelled) setFetchingLeaveDays(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setFetchingLeaveDays(false);
    };
  }, [open, form.leaveStartDate, form.leaveEndDate, form.employeeCode, form.leaveType, form.halfDay, companyCode, tenantName]);

  const handleEmployeeChange = (employeeCode: string, sourceEmployees = employees) => {
    const employee = sourceEmployees.find((item) => getEmployeeCode(item) === employeeCode);
    setFieldErrors((prev) => ({ ...prev, employeeCode: undefined, leaveType: undefined }));
    setValidationResult(null);
    setShowValidationAlert(false);
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
    loadLeaveEntitlement(employeeCode, companyCode, loginId)
      .then(setLeaveTypes)
      .catch((error) =>
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave types" })
      )
      .finally(() => setLoadingLeaveTypes(false));
  };

  const runLeaveValidation = async (requestedDays: number): Promise<LeaveValidationResult> => {
    setValidating(true);
    setShowValidationAlert(true);
    try {
      const response = await validateHrLeave(
        {
          companyCode,
          employeeId: form.employeeCode,
          leaveStartDate: toBackendDate(form.leaveStartDate),
          leaveEndDate: toBackendDate(form.leaveEndDate),
          leaveType: form.leaveType,
          leaveDays: requestedDays,
        },
        tenantName
      );

      const record = (response || {}) as Record<string, unknown>;
      const isValid = Boolean(record.isValid);
      const balanceRaw = record.availableBalance;
      const availableBalance = balanceRaw === null || balanceRaw === undefined ? null : Number(balanceRaw);
      const message = String(record.message || (isValid ? "Leave validation passed" : "Leave validation failed"));

      const result: LeaveValidationResult = { success: Boolean(record.success), isValid, availableBalance, message };
      setValidationResult(result);
      setNotice({ type: isValid ? "success" : "error", message });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to validate leave";
      const result: LeaveValidationResult = { isValid: false, availableBalance: null, message };
      setValidationResult(result);
      setNotice({ type: "error", message });
      return result;
    } finally {
      setValidating(false);
    }
  };

  // Marks invalid fields in red and raises one alert. Returns true when something is invalid.
  const flagErrors = (): boolean => {
    const found = getFieldErrors(form);
    setFieldErrors(found);
    const messages = Object.values(found).filter(Boolean) as string[];
    if (!messages.length) return false;
    setNotice({
      type: "error",
      message: messages.length > 1 ? `${messages[0]} (and ${messages.length - 1} more field${messages.length > 2 ? "s" : ""})` : messages[0],
    });
    return true;
  };

  const validate = async () => {
    if (flagErrors()) return false;

    if (LEAVE_TYPES_SKIP_VALIDATION.has(form.leaveType)) {
      setValidationResult({
        isValid: true,
        availableBalance: null,
        message: "Validation skipped for this leave type",
      });
      setShowValidationAlert(true);
      setNotice({ type: "info", message: "Validation skipped for this leave type" });
      return true;
    }

    const result = await runLeaveValidation(Number(form.leaveDays || 0));
    return result.isValid;
  };

  useEffect(() => {
    if (!sendBackOpen || !requestNumber) return;
    let cancelled = false;

    setLoadingFlowUsers(true);

    getRequestFlowUsers({ doc_id: requestNumber, loginId }, tenantName)
      .then((payload: any) => {
        if (cancelled) return;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.rows)
          ? payload.rows
          : payload?.data
          ? [payload.data]
          : payload
          ? [payload]
          : [];

        setUserFlowData(
          rows
            .map((r: any) => ({
              LOGIN_ID: r.LOGIN_ID ?? r.login_id ?? r.LOGINID1 ?? "",
              USERNAME: r.USERNAME ?? r.username ?? "",
            }))
            .filter((u: any) => u.LOGIN_ID)
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("getRequestFlowUsers failed", err);
        setUserFlowData([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFlowUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sendBackOpen, requestNumber, loginId, tenantName]);

  const save = async (action: SaveAction): Promise<string | undefined> => {
    if (isAlms && (workflowLoading || workflowError || !workflowActor || readOnly)) {
      setNotice({ type: "error", message: workflowError || "Please wait for workflow verification before saving." });
      return;
    }

    if (flagErrors()) return;

    // Sick leave cannot be submitted until at least one attachment is uploaded.
    if (action === "SUBMITTED" && isCreator && isSickLeave) {
      if (!requestNumber) {
        setNotice({ type: "error", message: "Please attach a supporting document before submitting sick leave." });
        return;
      }
      try {
        const count = await refreshAttachmentCount();
        if (count === 0) {
          setNotice({ type: "error", message: "Please attach a supporting document before submitting sick leave." });
          return;
        }
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to verify attachments. Please try again.",
        });
        return;
      }
    }

    const isExemptFromValidation = LEAVE_TYPES_SKIP_VALIDATION.has(form.leaveType);
    const hasResumptionDates = Boolean(form.actualresumedate || form.dutyresumedate);

    if (!isExemptFromValidation && (action === "SAVEASDRAFT" || action === "SUBMITTED") && !hasResumptionDates) {
      const requestedDays = Number(form.leaveDays || 0);
      if (requestedDays > 0) {
        const { isValid, availableBalance } = await runLeaveValidation(requestedDays);
        const hasInsufficientBalance =
          availableBalance !== null && !Number.isNaN(availableBalance) && availableBalance < requestedDays;

        if (!isValid || hasInsufficientBalance) {
          return;
        }
      }
    }

    if (action === "REJECTED" && !rejectParams.CANCEL_REMARK.trim()) {
      setNotice({ type: "error", message: "Reject remarks are required" });
      return;
    }

    if (action === "SENTBACK" && (!sentBackParams.LOGIN_ID || !sentBackParams.SENTBACK_HISTORY.trim())) {
      setNotice({ type: "error", message: "Please select a user and add remarks" });
      return;
    }

    setSavingAction(action);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = {
        COMPANY_CODE: companyCode,
        EMPLOYEE_NAME: form.employeeName,
        CREATED_BY: isAlms ? workflowRow?.CREATED_BY || loginId : loginId,
        UPDATED_BY: loginId,
        LAST_ACTION: action,
        REQUEST_NUMBER: requestNumber,
        REQUEST_DATE: toIsoDate(form.requestDate),
        EMPLOYEE_CODE: form.employeeCode,
        LEAVE_TYPE: form.leaveType,
        LEAVE_TYPE_DESC: form.leaveTypeDesc,
        LEAVE_START_DATE: toIsoDate(form.leaveStartDate),
        LEAVE_END_DATE: toIsoDate(form.leaveEndDate),
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
        TRAVEL_DATE: toIsoDate(form.travelDate),
        TRAVEL_END_DATE: toIsoDate(form.travelEndDate),
        NAME_OF_REPLACEMENT: form.replacementName,
        CONTACT_DETAILS_DURING_LEAVE: form.contactDuringLeave,
        RESUME_DATE: "",
        HALF_DAY: form.halfDay,
        RESUME_WORK: "No",
        ACTUAL_RESUME_DATE: toIsoDate(form.actualresumedate),
        DUTY_RESUME_DATE: toIsoDate(form.dutyresumedate),
        UUID: getUuid(),
      };

      if (action === "SENTBACK") {
        payload.SENTBACK_HISTORY = sentBackParams.SENTBACK_HISTORY;
        payload.NEXT_ACTION_BY = sentBackParams.LOGIN_ID;
      }

      if (action === "REJECTED") {
        payload.CANCEL_REMARK = rejectParams.CANCEL_REMARK;
      }

      const saveResult = await saveLeaveRequestFlow(payload, loginId);

      let savedRequestNumber = getSavedRequestNumber(saveResult);
      // Procedure generates the number on insert; fall back to a lookup by the UUID of this save.
      if (!savedRequestNumber && !requestNumber) {
        const rows = await executeHrRawSql<Record<string, unknown>>(
          `SELECT REQUEST_NUMBER FROM LEAVE_REQUEST_FLOW WHERE UUID = '${escapeSql(String(payload.UUID))}'`
        );
        savedRequestNumber = String(rows?.[0]?.REQUEST_NUMBER ?? "");
      }

      if (savedRequestNumber) {
        setRequestNumber(savedRequestNumber);
        if (isAlms && action === "SAVEASDRAFT") setWorkflowRow(await getHrWorkflowRequest(savedRequestNumber));
      }

      if (action === "SAVEASDRAFT") {
        setNotice({
          type: "success",
          message: savedRequestNumber
            ? `Draft saved. Request ${savedRequestNumber} is ready for attachments.`
            : "Draft saved. Attachments will enable after request number is available.",
        });
        // Sick leave: take the user straight to the Attachments tab after the draft is saved.
        if (isSickLeave && (savedRequestNumber || requestNumber)) setActiveTab("attachments");
        onSaved();
        return savedRequestNumber || requestNumber || undefined;
      }

      if (action === "SENTBACK") {
        setSendBackOpen(false);
        setSentBackParams({ LOGIN_ID: "", USERNAME: "", SENTBACK_HISTORY: "" });
      }
      if (action === "REJECTED") {
        setRejectOpen(false);
        setRejectParams({ CANCEL_REMARK: "" });
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

  /* ------------------------------------------------------------------ */
  /*  Shared pieces (used by both the modal and the inline page layout)  */
  /* ------------------------------------------------------------------ */

  const dialogTitle = readOnly ? "View Leave Request" : initialRow ? "Edit Leave Request" : "Add Leave Request";
  const pageTitle = readOnly ? "View Leave Request" : createMode ? "New Leave Request" : "Edit Leave Request";
  const statusLabel = createMode ? "Draft" : getRowString(initialRow, "STATUS", "status") || lastAction || "Draft";

  // Validation / info / error messages are shown with the shared alert component
  const alertNotice = notice ? ({ ...notice, type: notice.type === "info" ? "success" : notice.type } as any) : null;

  const actionBtn = "!w-auto shrink-0 whitespace-nowrap h-8 gap-1.5 text-xs font-semibold px-3 rounded-lg cursor-pointer";
  const dangerBtn = `${actionBtn} !text-red-600 !border-red-200 hover:!bg-red-50`;

  // All action buttons in one flat group (rendered in the page header, or in the modal footer)
  const actionButtons =
    readOnly || (!createMode && !canPrimary) ? (
      <>
        {!inline && (
          <Button type="button" variant="outline" onClick={onClose} className={actionBtn}>
            <X size={14} />
            <span>Close</span>
          </Button>
        )}
      </>
    ) : (
      <>
        {/* Order: Save As Draft, Attachments, Submit/Approve, then the rest */}
        {(isCreator || createMode) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void save("SAVEASDRAFT")}
            disabled={Boolean(savingAction) || Boolean(requestNumber)}
            title={requestNumber ? "Draft already saved" : undefined}
            className={actionBtn}
          >
            {savingAction === "SAVEASDRAFT" ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            <span>Save As Draft</span>
          </Button>
        )}

        {/* Before the first save only "Save As Draft" is shown. Once the request number exists,
            Submit/Approve appears for other leave types straight away, and for sick leave only
            after at least one file is uploaded in the Attachments tab. */}
        {requestNumber && !sickLeaveNeedsAttachment && (
          <Button
            type="button"
            onClick={() => void save("SUBMITTED")}
            disabled={Boolean(savingAction) || workflowLoading || Boolean(workflowError)}
            className={`${actionBtn} bg-[#00378C] text-white hover:bg-[#002d72]`}
          >
            {savingAction === "SUBMITTED" ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            <span>{permissions.mode === "resumption" ? "Approve Resumption" : isCreator ? "Submit" : "Approve"}</span>
          </Button>
        )}

        {!createMode && isCreator && !hasActualResumeDate(initialRow) && (
          <Button type="button" variant="outline" onClick={() => void save("CANCEL")} disabled={Boolean(savingAction)} className={dangerBtn}>
            {savingAction === "CANCEL" ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            <span>Cancel Request</span>
          </Button>
        )}

        {!createMode && !isCreator && permissions.canApprove && (
          <>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(true)} disabled={Boolean(savingAction)} className={dangerBtn}>
              <X size={14} />
              <span>Reject</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendBackOpen(true)}
              disabled={Boolean(savingAction) || !requestNumber}
              className={actionBtn}
              title="Send Back"
            >
              <Undo2 size={14} />
              <span>Send Back</span>
            </Button>
          </>
        )}
      </>
    );

  const footerNode = <div className="flex w-full flex-wrap items-center justify-end gap-2 p-2">{actionButtons}</div>;

  /* ---------------- main (left) column: the form ---------------- */
  const mainNode = (
    <>
      {/* Popup layout has no page header, so the request date is shown here; the page layout shows it in the header */}
      {!inline && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Request Date">
            <Input
              value={formatDisplayDate(form.requestDate)}
              disabled
              readOnly
              tabIndex={-1}
              className="pointer-events-none select-none"
            />
          </Field>
        </div>
      )}

      {workflowLoading && (
        <p className="m-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Checking the current approver and available actions…
        </p>
      )}
      {!readOnly && permissions.mode === "resumption" && (
        <p className="m-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
          This request is waiting for your leave-resumption approval.
        </p>
      )}
      {!readOnly && isCreator && isSickLeave && (attachmentCount ?? 0) === 0 && (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {requestNumber
            ? "Sick leave requires a supporting attachment. Open the Attachments tab and upload one; Submit appears once it is uploaded."
            : "Sick leave requires a supporting attachment. Save As Draft first, then upload one in the Attachments tab."}
        </p>
      )}

      {/* Tabs: the Attachments tab exists only for sick leave */}
      {isSickLeave && (
        <div className="flex gap-1 border-b border-slate-200">
          {(
            [
              { id: "details", label: "Leave Details" },
              { id: "attachments", label: "Attachments" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold ${
                activeTab === tab.id
                  ? "border-[#00378C] text-[#00378C]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.id === "attachments" && <Paperclip size={13} />}
              {tab.label}
              {tab.id === "attachments" && attachmentCount !== null && attachmentCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{attachmentCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isSickLeave && activeTab === "attachments" && (
        <HrLeaveAttachmentPanel
          requestNumber={requestNumber}
          companyCode={companyCode}
          loginId={loginId}
          readOnly={fieldsDisabled}
          onCountChange={setAttachmentCount}
        />
      )}
      {showSendBackRemark && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Sent back with remarks</p>
          <p className="m-0 mt-0.5 text-sm text-amber-900">{sendBackRemark}</p>
        </div>
      )}
      {showRejectRemark && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-red-800">Rejected with remarks</p>
          <p className="m-0 mt-0.5 text-sm text-red-900">{rejectRemark}</p>
        </div>
      )}

      {/* Three columns side-by-side with bordered section cards */}
      <div className={`grid grid-cols-1 gap-3 lg:grid-cols-3 ${isSickLeave && activeTab === "attachments" ? "hidden" : ""}`}>
        {/* ---------- Column 1: Leave Details ---------- */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Leave Details</h3>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <Field label="Employee" error={fieldErrors.employeeCode}>
              <Select
                value={form.employeeCode}
                onChange={(event) => handleEmployeeChange(event.target.value)}
                disabled={fieldsDisabled || loadingEmployees}
              >
                <option value="">{loadingEmployees ? "Loading employees..." : "Select employee"}</option>
                {employees.map((employee) => {
                  const code = getEmployeeCode(employee);
                  const alternateId = employee.ALTERNATE_ID || employee.alternate_id;
                  const name = getEmployeeName(employee);
                  return (
                    <option key={code} value={code}>
                      {alternateId ? `${alternateId} - ${name}` : name}
                    </option>
                  );
                })}
              </Select>
            </Field>

            <Field label="Leave Type *" error={fieldErrors.leaveType}>
              <Select
                value={form.leaveType}
                onChange={(event) => update("leaveType", event.target.value)}
                disabled={fieldsDisabled || !form.employeeCode || loadingLeaveTypes}
              >
                <option value="">{loadingLeaveTypes ? "Loading..." : "Leave Type"}</option>
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

            <Field label="Leave Start Date *" error={fieldErrors.leaveStartDate}>
              <Input
                type="date"
                value={form.leaveStartDate}
                onChange={(event) => update("leaveStartDate", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>
            {/* User picks the end date; after the API call it is replaced by start date + leave days */}
            <Field label="Leave End Date *" error={fieldErrors.leaveEndDate}>
              <Input
                type="date"
                value={form.leaveEndDate}
                min={form.leaveStartDate || undefined}
                onChange={(event) => update("leaveEndDate", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field label={fetchingLeaveDays ? "Leave Days (calculating…)" : "Leave Days"} error={fieldErrors.leaveDays}>
                <Input type="number" value={form.leaveDays} disabled readOnly tabIndex={-1} />
              </Field>
              <label
                className={`mb-0 flex h-8 select-none items-center gap-2 text-xs font-medium text-slate-700 ${
                  fieldsDisabled ? "opacity-60" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#00378C]"
                  checked={form.halfDay === "Y"}
                  onChange={(event) => update("halfDay", event.target.checked ? "Y" : "N")}
                  disabled={fieldsDisabled}
                />
                Half Day
              </label>
            </div>

            {tenantName === "MHDL" && (
              <Field label="Duty Resume Date *">
                <Input
                  type="date"
                  value={form.dutyresumedate}
                  onChange={(event) => update("dutyresumedate", event.target.value)}
                  disabled={fieldsDisabled}
                />
              </Field>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => void validate()}
              disabled={fieldsDisabled || validating || !selectedEmployee}
              className="mt-1 h-9 w-full justify-center gap-2 rounded-full text-xs font-semibold"
            >
              {validating ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
              {validating ? "Checking..." : "Validate"}
            </Button>
          </div>
        </div>

        {/* ---------- Column 2: Request Notes ---------- */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Request Notes</h3>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <Field label="Leave Allowance">
              <Select
                value={form.leaveAllowance}
                onChange={(event) => update("leaveAllowance", event.target.value as "N" | "Y" | "")}
                disabled={fieldsDisabled}
              >
                <option value="">Leave Allowance</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </Field>

            <Field label="Advance Payment">
              <Select
                value={form.advancePayment}
                onChange={(event) => update("advancePayment", event.target.value as "N" | "Y" | "")}
                disabled={fieldsDisabled}
              >
                <option value="">Advance Payment</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </Field>

            <Field label="Cause Type">
              <Input
                value={form.causeType}
                onChange={(event) => update("causeType", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>

            <Field label="Remarks *" error={fieldErrors.remarks}>
              <textarea
                className="min-h-[72px] w-full resize-y rounded-md border border-gray-300 p-2 text-sm"
                rows={3}
                value={form.remarks}
                onChange={(event) => update("remarks", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>

            <Field label="Contact Details During Leave">
              <textarea
                className="min-h-[72px] w-full resize-y rounded-md border border-gray-300 p-2 text-sm"
                rows={3}
                value={form.contactDuringLeave}
                onChange={(event) => update("contactDuringLeave", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>
          </div>
        </div>

        {/* ---------- Column 3: Approver Details ---------- */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Approver Details</h3>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <Field label="Immediate Supervisor">
              <Input value={supervisorName} disabled readOnly />
            </Field>

            <Field label="Department Head">
              <Input value={deptHeadName} disabled readOnly />
            </Field>

            <Field label="HR. Head Of Department">
              <Input value={hodName} disabled readOnly />
            </Field>

            <Field label="Air Ticket">
              <Select
                value={form.airTicket}
                onChange={(event) => update("airTicket", event.target.value as "N" | "Y" | "")}
                disabled={fieldsDisabled}
              >
                <option value="">Air Ticket</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Travel Start Date">
                <Input
                  type="date"
                  value={form.travelDate}
                  onChange={(event) => update("travelDate", event.target.value)}
                  disabled={fieldsDisabled}
                />
              </Field>
              <Field label="Travel End Date">
                <Input
                  type="date"
                  value={form.travelEndDate}
                  min={form.travelDate || undefined}
                  onChange={(event) => update("travelEndDate", event.target.value)}
                  disabled={fieldsDisabled}
                />
              </Field>
            </div>

            <Field label="Air Route">
              <Input
                value={form.airRoute}
                onChange={(event) => update("airRoute", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>
          </div>
        </div>
      </div>

      {hasActualResumeDate(initialRow) && !(isSickLeave && activeTab === "attachments") && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Leave Resumption</h3>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-end">
              <label className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-[#f8f9fb] px-2.5 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#00378C]"
                  checked={form.actualresumedate ? true : form.resumework === "Y"}
                  onChange={(event) => update("resumework", event.target.checked ? "Y" : "N")}
                  disabled={fieldsDisabled}
                />
                Resume Work
              </label>
            </div>
            <Field label="Actual Resume Date">
              <Input
                type="date"
                value={form.actualresumedate}
                onChange={(event) => update("actualresumedate", event.target.value)}
                disabled={fieldsDisabled}
              />
            </Field>
            {tenantName === "ALMS" && (
              <Field label="Duty Resume Date">
                <Input
                  type="date"
                  value={form.dutyresumedate}
                  onChange={(event) => update("dutyresumedate", event.target.value)}
                  disabled={fieldsDisabled}
                />
              </Field>
            )}
          </div>
        </div>
      )}
    </>
  );

  // Send Back / Reject / Attachments stay as small popups on top of either layout.
  const nestedDialogs = (
    <>
      {/* -------------------- SEND BACK DIALOG -------------------- */}
      <LmsDialog
        open={sendBackOpen}
        title="Send Back Request"
        onClose={() => setSendBackOpen(false)}
        footer={
          <div className="flex w-full justify-end gap-2 p-1">
            <Button variant="outline" onClick={() => setSendBackOpen(false)} disabled={savingAction === "SENTBACK"}>
              Close
            </Button>
            <Button
              onClick={() => void save("SENTBACK")}
              disabled={
                savingAction === "SENTBACK" || !sentBackParams.LOGIN_ID || !sentBackParams.SENTBACK_HISTORY.trim()
              }
              className="!w-auto shrink-0"
            >
              {savingAction === "SENTBACK" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
              <span>Send Back</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Employee *">
            <Select
              value={sentBackParams.LOGIN_ID}
              onChange={(e) => {
                const selected = userFlowData.find((u) => u.LOGIN_ID === e.target.value);
                setSentBackParams((prev) => ({
                  ...prev,
                  LOGIN_ID: e.target.value,
                  USERNAME: selected?.USERNAME || "",
                }));
              }}
              disabled={loadingFlowUsers}
            >
              <option value="">{loadingFlowUsers ? "Loading..." : "Select employee"}</option>
              {userFlowData.map((u) => (
                <option key={u.LOGIN_ID} value={u.LOGIN_ID}>
                  {u.LOGIN_ID} - {u.USERNAME}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Remarks *">
            <textarea
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
              value={sentBackParams.SENTBACK_HISTORY}
              onChange={(e) => setSentBackParams((prev) => ({ ...prev, SENTBACK_HISTORY: e.target.value }))}
            />
          </Field>
        </div>
      </LmsDialog>

      {/* -------------------- REJECT DIALOG -------------------- */}
      <LmsDialog
        open={rejectOpen}
        title="Reject Request"
        onClose={() => setRejectOpen(false)}
        footer={
          <div className="flex w-full justify-end gap-2 p-1">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={savingAction === "REJECTED"}>
              Close
            </Button>
            <Button
              onClick={() => void save("REJECTED")}
              disabled={savingAction === "REJECTED" || !rejectParams.CANCEL_REMARK.trim()}
              className="!w-auto shrink-0"
            >
              {savingAction === "REJECTED" ? <Loader2 className="animate-spin" size={16} /> : <X size={16} />}
              <span>Reject</span>
            </Button>
          </div>
        }
      >
        <Field label="Reject Remarks *">
          <textarea
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            rows={3}
            value={rejectParams.CANCEL_REMARK}
            onChange={(e) => setRejectParams({ CANCEL_REMARK: e.target.value })}
          />
        </Field>
      </LmsDialog>
    </>
  );

  /* ------------------------------------------------------------------ */
  /*  Layouts                                                            */
  /* ------------------------------------------------------------------ */

  // Page layout: fixed header, alert, scrollable form column.
  // Sized to the window so the page itself never scrolls.
  if (inline) {
    if (!open) return null;
    return (
      <section className="leave-request-page flex h-[calc(100dvh-150px)] flex-col gap-2 overflow-hidden p-1">
        <div className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="h-1 w-full bg-[#00378C]" />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onClose}
                disabled={Boolean(savingAction)}
                aria-label="Back to list"
                title="Back to list"
                className="h-8 w-8 shrink-0 rounded-lg cursor-pointer"
              >
                <ArrowLeft size={15} />
              </Button>
              <h1 className="m-0 truncate text-sm font-semibold text-slate-900">{pageTitle}</h1>
              {requestNumber && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{requestNumber}</span>
              )}
              <span className="select-none rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Request Date: {formatDisplayDate(form.requestDate)}
              </span>
              <span className={statusBadgeTone(statusLabel)}>{statusLabel}</span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">{actionButtons}</div>
          </div>
        </div>

        <AutoDismissAlert notice={alertNotice} onClose={() => setNotice(null)} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-0 flex-col gap-2.5 pr-1">{mainNode}</div>
        </div>

        {nestedDialogs}
      </section>
    );
  }

  // Modal layout (default behaviour)
  return (
    <LmsDialog
      open={open}
      title={dialogTitle}
      wide
      contentClassName={`leave-request-dialog${readOnly ? " is-readonly" : ""}`}
      onClose={onClose}
      footer={footerNode}
    >
      <div className="leave-request-form flex flex-col gap-2.5">
        <NoticeToast notice={notice} onClose={() => setNotice(null)} />
        {mainNode}
      </div>
      {nestedDialogs}
    </LmsDialog>
  );
}

function Field({
  label,
  className = "",
  error,
  children,
}: {
  label: string;
  className?: string;
  error?: string;
  children: ReactNode;
}) {
  const required = label.trim().endsWith("*");
  const text = label.replace(/\s*\*$/, "");
  const invalidClass = error
    ? "[&_input]:!border-red-400 [&_select]:!border-red-400 [&_textarea]:!border-red-400"
    : "";
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${invalidClass} ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        {text}
        {required && <span className="ml-0.5 font-bold text-[#E24B4A]">*</span>}
      </span>
      {children}
      {error && <span className="text-[11px] font-medium text-red-600">{error}</span>}
    </label>
  );
}

function statusBadgeTone(label: string) {
  const l = (label || "").toLowerCase();
  const base = "rounded-md border px-2 py-0.5 text-[11px] font-medium";
  if (l.includes("approv") || l.includes("close")) return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (l.includes("reject")) return `${base} border-red-200 bg-red-50 text-red-700`;
  if (l.includes("cancel") || l.includes("draft") || l.includes("saveasdraft")) return `${base} border-slate-200 bg-slate-50 text-slate-600`;
  if (l.includes("progress")) return `${base} border-sky-200 bg-sky-50 text-sky-700`;
  return `${base} border-amber-200 bg-amber-50 text-amber-700`;
}

function formatDisplayDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getFieldErrors(form: LeaveForm): Partial<Record<keyof LeaveForm, string>> {
  const errors: Partial<Record<keyof LeaveForm, string>> = {};
  if (!form.requestDate) errors.requestDate = "Request date is required";
  if (!form.employeeCode) errors.employeeCode = "Employee is required";
  if (!form.leaveType) errors.leaveType = "Leave type is required";
  if (!form.leaveStartDate) errors.leaveStartDate = "Start date is required";
  if (!form.leaveEndDate) errors.leaveEndDate = "End date is required";
  else if (form.leaveStartDate && form.leaveEndDate < form.leaveStartDate) errors.leaveEndDate = "End date is before start date";
  if (Number(form.leaveDays || 0) <= 0) errors.leaveDays = "Must be greater than zero";
  if (!form.remarks.trim()) errors.remarks = "Remarks are required";
  return errors;
}

function getEmployeeCode(employee: HrEmployee) {
  return String(employee.EMPLOYEE_ID || employee.EMPLOYEE_CODE || employee.ALTERNATE_ID || "");
}

function getEmployeeName(employee: HrEmployee) {
  return String(employee.RPT_NAME || employee.EMPLOYEE_NAME || employee.Employee_Name || employee.EMPLOYEE_ID || "");
}

function getLeaveTypeLabel(leaveType: HrLeaveEntitlement) {
  const code = String(leaveType.LEAVE_TYPE || "");
  const desc = String(leaveType.LEAVE_TYPE_DESC || code);
  return code && desc !== code ? `${code} - ${desc}` : desc;
}

async function loadEmployees(loginId: string, companyCode: string) {
  const raw = await getDynamicLookupaccount({
    parameter: "LEAVE_FLOW_EMPLOYEE_LIST",
    loginid: loginId,
    code1: companyCode,
    code2: loginId,
  });
  const rows = upperKeys<HrEmployee>(raw);
  return uniqueBy(rows, getEmployeeCode).sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));
}

async function loadLeaveEntitlement(employeeId: string, companyCode: string, loginId: string) {
  const raw = await getDynamicLookupaccount({
    parameter: "LEAVE_FLOW_TYPE_LIST",
    loginid: loginId,
    code1: companyCode,
    code2: employeeId,
  });
  const rows = upperKeys<HrLeaveEntitlement>(raw);
  return uniqueBy(rows, (row) => String(row.LEAVE_TYPE || "")).filter((row) => row.LEAVE_TYPE);
}

// Counts the files attached to a leave request (used to gate sick-leave submission).
async function countLeaveAttachments(requestNumber: string): Promise<number> {
  const files = await getHrEmployeeFiles(requestNumber);
  return Array.isArray(files) ? files.length : 0;
}

function uniqueBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const key = getKey(row);
    if (key && !map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

function upperKeys<T>(rows: unknown): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row as Record<string, unknown>).map(([key, value]) => [key.toUpperCase(), value])
      ) as T
  );
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

function addDaysIso(startValue: string, daysToAdd: number) {
  const start = new Date(`${startValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  start.setDate(start.getDate() + daysToAdd);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// End date = start date + leave days. The first leave day is the start date,
// so N days end on start + (N - 1). A half day (0.5) ends on the start date.
function calculateEndDate(startValue: string, leaveDays: number) {
  if (!startValue || !(leaveDays > 0)) return "";
  return addDaysIso(startValue, Math.max(Math.ceil(leaveDays) - 1, 0));
}

// API dates arrive as "dd-MM-yyyy" (e.g. "22-10-2026"); the date input needs "yyyy-MM-dd".
function apiDateToInput(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return "";
}

function extractLeaveEndDate(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const record = response as Record<string, unknown>;
  const raw = record.leaveEndDate ?? record.LEAVE_END_DATE ?? record.leave_end_date ?? record.endDate;
  if (raw !== null && raw !== undefined && typeof raw !== "object") return apiDateToInput(raw);
  if (record.data && typeof record.data === "object") return extractLeaveEndDate(record.data);
  return "";
}

function extractLeaveDays(response: unknown): number | null {
  if (response === null || response === undefined) return null;
  if (typeof response === "number") return Number.isFinite(response) ? response : null;
  if (typeof response === "string") {
    const parsed = Number(response);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof response === "object") {
    const record = response as Record<string, unknown>;
    const raw =
      record.leaveDays ??
      record.LEAVE_DAYS ??
      record.leave_days ??
      record.days ??
      record.DAYS ??
      record.count ??
      record.COUNT ??
      record.data;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object") return extractLeaveDays(raw);
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function calculateInclusiveDays(startValue: string, endValue: string) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function formFromRow(row: Record<string, unknown>): LeaveForm {
  return {
    requestDate: toApiDateInput(getRowString(row, "REQUEST_DATE", "requestDate")) || today(),
    employeeCode: getRowString(row, "EMPLOYEE_CODE", "EMPLOYEE_ID", "employeeCode", "employeeId"),
    employeeName: getRowString(row, "EMPLOYEE_NAME", "EMPLOYEE_NAME_DISPLAY", "RPT_NAME", "employeeName"),
    leaveType: getRowString(row, "LEAVE_TYPE", "leaveType"),
    leaveTypeDesc: getRowString(row, "LEAVE_TYPE_DESC", "leaveTypeDesc"),
    leaveStartDate: toApiDateInput(getRowString(row, "LEAVE_START_DATE", "leaveStartDate")),
    leaveEndDate: toApiDateInput(getRowString(row, "LEAVE_END_DATE", "leaveEndDate")),
    leaveDays: getRowString(row, "LEAVE_DAYS", "leaveDays"),
    remarks: getRowString(row, "REMARKS", "REASON", "remarks"),
    halfDay: getRowString(row, "HALF_DAY", "halfDay").toUpperCase() === "Y" ? "Y" : "N",
    leaveAllowance: getYesNoValue(getRowString(row, "LEAVE_ALLOWANCE", "leaveAllowance")),
    advancePayment: getYesNoValue(getRowString(row, "ADV_PAYMENT", "advancePayment")),
    causeType: getRowString(row, "CAUSE_TYPE", "causeType"),
    airTicket: getYesNoValue(getRowString(row, "AIR_TICKET", "airTicket")),
    airRoute: getRowString(row, "AIR_ROUTE", "airRoute"),
    travelDate: toApiDateInput(getRowString(row, "TRAVEL_DATE", "travelDate")),
    travelEndDate: toApiDateInput(getRowString(row, "TRAVEL_END_DATE", "travelEndDate")),
    replacementName: getRowString(row, "NAME_OF_REPLACEMENT", "replacementName"),
    contactDuringLeave: getRowString(row, "CONTACT_DETAILS_DURING_LEAVE", "contactDuringLeave"),
    supervisor: getRowString(row, "IMMEDIATE_SUPERVISOR", "SUPERVISOR_EMPID", "immediateSupervisor"),
    deptHead: getRowString(row, "DEPT_HEAD", "DEPT_HEAD_EMPID", "deptHead"),
    hod: getRowString(row, "HOD", "MANGR_EMPID", "hod"),
    resumework: getRowString(row, "RESUME_WORK", "resume_work").toUpperCase() === "Y" ? "Y" : "N",
    resumedate: toApiDateInput(getRowString(row, "RESUME_DATE", "resume_date")),
    dutyresumedate: toApiDateInput(getRowString(row, "DUTY_RESUME_DATE", "duty_resume_date")),
    actualresumedate: toApiDateInput(getRowString(row, "ACTUAL_RESUME_DATE", "actual_resume_date")),
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

function getYesNoValue(value: string): "N" | "Y" | "" {
  const normalized = value.toUpperCase();
  return normalized === "Y" || normalized === "N" ? normalized : "";
}

function getApproverDisplay(row: Record<string, unknown> | null, nameKey: string, fallbackId: string) {
  const name = row ? String(row[nameKey] || "").trim() : "";
  return name || fallbackId || "";
}

function hasActualResumeDate(row: Record<string, unknown> | null | undefined) {
  const value = getRowString(row, "ACTUAL_RESUME_DATE", "actualResumeDate").trim();
  return Boolean(value) && value !== "0000-00-00";
}

function getUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

