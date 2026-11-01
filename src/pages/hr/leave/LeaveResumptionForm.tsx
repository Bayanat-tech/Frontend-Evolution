import React, { useEffect, useState } from "react";
import { ArrowLeft, FileDown, Loader2, Save, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../state/AuthContext";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import type { ToastNotice } from "../../../components/ui/NoticeToast";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import * as XLSX from "xlsx";
import { IHrEmployee, IValidateLeaveResponse, TLeaveApproval } from "./leave-approval-types";
import {
  getEmployees,
  getHrEmployees,
  getHrLeaveEntitlement,
  saveHrLeaveApproval,
  validateHrLeave,
} from "../../../api/hr";
import { saveLeaveRequestFlow } from "./LeaveRequestDialog";

dayjs.extend(customParseFormat);

// All dates are kept internally as ISO (YYYY-MM-DD), exactly like the Leave Request
// form (native <input type="date">), so comparisons and the payload builder stay simple.
const ISO_FORMAT = "YYYY-MM-DD";
const DISPLAY_FORMAT = "DD-MM-YYYY";

const INPUT_FORMATS = [
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "DD/MM/YYYY",
  "YYYY/MM/DD",
  "D-M-YYYY",
  "D/M/YYYY",
  "DD-MMM-YYYY",
  "DD-MMM-YY",
];

/**
 * Normalise anything date-like to ISO (YYYY-MM-DD).
 * Returns "" for empty / unparseable input (including "Invalid Date").
 */
function toIso(value?: string | Date | null): string {
  if (!value) return "";

  if (value instanceof Date) {
    const d = dayjs(value);
    return d.isValid() ? d.format(ISO_FORMAT) : "";
  }

  const s = String(value).trim();
  if (!s || s.toLowerCase() === "invalid date") return "";

  // ISO timestamp (e.g. 2026-08-24T20:00:00.000Z): convert to the local calendar day.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = dayjs(s);
    return d.isValid() ? d.format(ISO_FORMAT) : "";
  }

  // Oracle style month names arrive as "25-AUG-26"; dayjs expects "Aug".
  const normalised = s.replace(
    /-([A-Za-z]{3})-/,
    (_m, mon: string) => `-${mon.charAt(0).toUpperCase()}${mon.slice(1).toLowerCase()}-`,
  );

  const parsed = dayjs(normalised, INPUT_FORMATS, true);
  return parsed.isValid() ? parsed.format(ISO_FORMAT) : "";
}

function isoToDisplay(value?: string): string {
  const iso = toIso(value);
  return iso ? dayjs(iso, ISO_FORMAT, true).format(DISPLAY_FORMAT) : "";
}

function formatHeaderDate(value: string) {
  const iso = toIso(value);
  if (!iso) return "—";
  return dayjs(iso, ISO_FORMAT, true).format("DD MMM YYYY");
}

const todayIso = () => dayjs().format(ISO_FORMAT);

function getUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type AddLeaveApprovalFormProps = {
  data?: TLeaveApproval | null;
  onClose?: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  viewMode?: boolean;
  approveResumption?: boolean;
  disableButtons?: boolean;
  /** Render as a full page section (same as the Leave Request editor). Default true. */
  inline?: boolean;
};

interface ILeaveType {
  value: string;
  label: string;
}

type FormDataType = {
  CONTACT_DETAILS_DURING_LEAVE: string;
  contact_details_during_leave: string;
  NAME_OF_REPLACEMENT: string;
  TRAVEL_DATE: string;
  TRAVEL_END_DATE: string;
  CAUSE_TYPE: string;
  ADV_PAYMENT: unknown;
  LEAVE_ALLOWANCE: unknown;
  request_number: string;
  request_date: string;
  employee_code: string;
  leave_type: string;
  leave_type_desc: string;
  leave_start_date: string;
  leave_end_date: string;
  resume_date: string;
  leave_days: string;
  remarks: string;
  company_code: string;
  rpt_name: string;
  EMPLOYEE_ID: string;
  Employee_Name: string;
  is_half_day: boolean;
  div_code?: string;
  SUPERVISOR_EMPID: string;
  DEPT_HEAD_EMPID: string;
  MANGR_EMPID: string;
  IMMEDIATE_SUPERVISOR_NAME: string;
  HOD_NAME: string;
  DEPT_HEAD_NAME: string;
  resume_work: boolean;
  actual_resume_date: string;
  DUTY_RESUME_DATE: string;
  AIR_ROUTE: string;
  AIR_TICKET: string;
};

const emptyFormData = (companyCode: string): FormDataType => ({
  request_number: "",
  request_date: todayIso(),
  EMPLOYEE_ID: "",
  employee_code: "",
  Employee_Name: "",
  is_half_day: false,
  leave_type: "",
  leave_type_desc: "",
  leave_start_date: "",
  leave_end_date: "",
  resume_date: "",
  leave_days: "",
  remarks: "",
  company_code: companyCode,
  rpt_name: "",
  SUPERVISOR_EMPID: "",
  DEPT_HEAD_EMPID: "",
  MANGR_EMPID: "",
  contact_details_during_leave: "",
  CONTACT_DETAILS_DURING_LEAVE: "",
  NAME_OF_REPLACEMENT: "",
  TRAVEL_DATE: "",
  TRAVEL_END_DATE: "",
  CAUSE_TYPE: "",
  ADV_PAYMENT: "",
  LEAVE_ALLOWANCE: "",
  resume_work: false,
  actual_resume_date: "",
  DUTY_RESUME_DATE: "",
  AIR_ROUTE: "",
  AIR_TICKET: "",
  IMMEDIATE_SUPERVISOR_NAME: "",
  HOD_NAME: "",
  DEPT_HEAD_NAME: "",
});

const LeaveResumptionForm: React.FC<AddLeaveApprovalFormProps> = ({
  data,
  onClose,
  onSuccess,
  isEditMode,
  viewMode,
  approveResumption,
  inline = true,
}) => {
  const { user } = useAuth();

  // Same tenant detection as the Leave Request form: login ids containing letters are MHDL, the rest ALMS.
  const LOGINUSER = String(user?.LOGINID || user?.loginid || "");
  const tenantName = /[A-Za-z]/.test(LOGINUSER.trim()) ? "MHDL" : "ALMS";
  const isAlms = tenantName === "ALMS";
  const yesValue = isAlms ? "Y" : "Yes";
  const noValue = isAlms ? "N" : "No";
  const loginId = String(user?.loginid1 || user?.LOGINID1 || "");

  const [formData, setFormData] = useState<FormDataType>(emptyFormData(user?.company_code || ""));
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<ToastNotice>(null);

  // True when the record arrived without usable leave start/end dates, so they can be re-entered.
  const [repairDates, setRepairDates] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<ILeaveType[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);
  const [, setLeaveTypesError] = useState("");

  const [approverNames, setApproverNames] = useState({
    SUPERVISOR_EMPID: "",
    DEPT_HEAD_EMPID: "",
    MANGR_EMPID: "",
  });

  const [approverLoading, setApproverLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<IValidateLeaveResponse | null>(null);

  // Logged-in user's employee data
  const { data: currentUserEmployeeData } = useQuery<IHrEmployee | null>({
    queryKey: ["current-user-employee", user?.loginid1],
    queryFn: async () => {
      if (!user?.loginid1) return null;
      const emp = await getEmployees(user?.loginid1);
      return emp[0] ?? null;
    },
    retry: false,
    enabled: !!user?.loginid1,
  });

  useEffect(() => {
    if (!currentUserEmployeeData) return;
    if (data) return;

    const employeeId = currentUserEmployeeData.EMPLOYEE_ID?.toString() || "";
    const employeeCode = currentUserEmployeeData.EMPLOYEE_CODE || "";
    const employeeName = currentUserEmployeeData.RPT_NAME || "";

    setFormData((prev) => ({
      ...prev,
      EMPLOYEE_ID: employeeId,
      employee_code: employeeCode,
      Employee_Name: employeeName,
      SUPERVISOR_EMPID: currentUserEmployeeData.SUPERVISOR_EMPID || "",
      DEPT_HEAD_EMPID: currentUserEmployeeData.DEPT_HEAD_EMPID || "",
      MANGR_EMPID: currentUserEmployeeData.MANGR_EMPID || "",
    }));

    void fetchApproverNames(currentUserEmployeeData);
    void fetchLeaveTypes(employeeId);
  }, [currentUserEmployeeData, data]);

  // Edit mode: fetch the leave-types list using the record's own employee id so the
  // Leave Type select has an option matching the saved value.
  useEffect(() => {
    if (!data) return;
    const employeeId = (data.EMPLOYEE_ID || data.EMPLOYEE_CODE || "").toString();
    if (employeeId) void fetchLeaveTypes(employeeId);
  }, [data]);

  useEffect(() => {
    if (!data) return;

    const startIso = toIso(data.LEAVE_START_DATE);
    const endIso = toIso(data.LEAVE_END_DATE);
    setRepairDates(!startIso || !endIso);

    setFormData({
      request_number: data.REQUEST_NUMBER || "",
      request_date: toIso(data.REQUEST_DATE),
      employee_code: data.EMPLOYEE_CODE || "",
      leave_type: data.LEAVE_TYPE || "",
      leave_type_desc: data.LEAVE_TYPE_DESC || "",
      Employee_Name: data.EMPLOYEE_NAME || "",
      leave_start_date: startIso,
      leave_end_date: endIso,
      resume_date: toIso(data.RESUME_DATE),
      leave_days: data.LEAVE_DAYS?.toString() || "",
      remarks: data.REMARKS || "",
      company_code: user?.company_code || "",
      rpt_name: data.EMPLOYEE_CODE || "",
      EMPLOYEE_ID: data.EMPLOYEE_ID || data.EMPLOYEE_CODE || "",
      SUPERVISOR_EMPID: data.IMMEDIATE_SUPERVISOR || "",
      DEPT_HEAD_EMPID: data.DEPT_HEAD || "",
      MANGR_EMPID: data.HOD || "",
      contact_details_during_leave: data.CONTACT_DETAILS_DURING_LEAVE || "",
      CONTACT_DETAILS_DURING_LEAVE: data.CONTACT_DETAILS_DURING_LEAVE || "",
      NAME_OF_REPLACEMENT: data.NAME_OF_REPLACEMENT || "",
      TRAVEL_DATE: toIso(data.TRAVEL_DATE),
      TRAVEL_END_DATE: toIso(data.TRAVEL_END_DATE),
      CAUSE_TYPE: data.CAUSE_TYPE || "",
      ADV_PAYMENT: data.ADV_PAYMENT || "",
      LEAVE_ALLOWANCE: data.LEAVE_ALLOWANCE || "",
      is_half_day: String((data as any).HALF_DAY ?? "").toUpperCase() === "Y",
      resume_work: data.RESUME_WORK || false,
      actual_resume_date: toIso(data.ACTUAL_RESUME_DATE),
      DUTY_RESUME_DATE: toIso(data.DUTY_RESUME_DATE),
      AIR_ROUTE: data.AIR_ROUTE || "",
      AIR_TICKET: data.AIR_TICKET || "",
      IMMEDIATE_SUPERVISOR_NAME: data.IMMEDIATE_SUPERVISOR_NAME || "",
      HOD_NAME: data.HOD_NAME || "",
      DEPT_HEAD_NAME: data.DEPT_HEAD_NAME || "",
    });
  }, [data, user?.company_code]);

  useEffect(() => {
    if (!formData.leave_start_date || !formData.leave_end_date) return;
    const start = dayjs(formData.leave_start_date, ISO_FORMAT, true);
    const end = dayjs(formData.leave_end_date, ISO_FORMAT, true);
    if (!start.isValid() || !end.isValid()) return;

    const diffDays = end.diff(start, "day") + 1;
    if (diffDays !== Number(formData.leave_days)) {
      setFormData((prev) => ({ ...prev, leave_days: diffDays > 0 ? diffDays.toString() : "" }));
    }
  }, [formData.leave_start_date, formData.leave_end_date]);

  const handleExport = () => {
    try {
      const exportData = {
        "Request Number": formData.request_number || "",
        "Request Date": isoToDisplay(formData.request_date),
        "Employee Code": formData.employee_code,
        "Employee Name": formData.Employee_Name,
        "Leave Type": formData.leave_type_desc || formData.leave_type,
        "Leave Start Date": isoToDisplay(formData.leave_start_date),
        "Leave End Date": isoToDisplay(formData.leave_end_date),
        "Leave Days": formData.leave_days,
        "Resume Date": isoToDisplay(formData.resume_date),
        Remarks: formData.remarks,
        "Contact Details": formData.CONTACT_DETAILS_DURING_LEAVE,
        "Leave Allowance": formData.LEAVE_ALLOWANCE,
        "Advance Payment": formData.ADV_PAYMENT,
        "Cause Type": formData.CAUSE_TYPE,
        "Travel Date": isoToDisplay(formData.TRAVEL_DATE),
        "Travel End Date": isoToDisplay(formData.TRAVEL_END_DATE),
        "Name of Replacement": formData.NAME_OF_REPLACEMENT,
        "Immediate Supervisor": approverNames.SUPERVISOR_EMPID,
        "Department Head": approverNames.DEPT_HEAD_EMPID,
        HOD: approverNames.MANGR_EMPID,
        "Half Day": formData.is_half_day ? "Yes" : "No",
      };

      const ws = XLSX.utils.json_to_sheet([exportData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leave Request");
      const fileName = `Leave_Request_${formData.request_number || ""}_${todayIso()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setNotice({ type: "success", message: "Leave request exported successfully" });
    } catch {
      setNotice({ type: "error", message: "Failed to export leave request" });
    }
  };

  const getEmployeeNameById = async (employeeId: string): Promise<string> => {
    if (!employeeId) return "";
    try {
      const employeeArr = await getHrEmployees(employeeId);
      return employeeArr[0]?.RPT_NAME || "";
    } catch {
      return "";
    }
  };

  const fetchApproverNames = async (employeeData: IHrEmployee | null) => {
    if (!employeeData) {
      setApproverNames({ SUPERVISOR_EMPID: "", DEPT_HEAD_EMPID: "", MANGR_EMPID: "" });
      return;
    }
    setApproverLoading(true);
    try {
      const names = await Promise.all([
        getEmployeeNameById(employeeData.SUPERVISOR_EMPID || ""),
        getEmployeeNameById(employeeData.DEPT_HEAD_EMPID || ""),
        getEmployeeNameById(employeeData.MANGR_EMPID || ""),
      ]);
      setApproverNames({ SUPERVISOR_EMPID: names[0], DEPT_HEAD_EMPID: names[1], MANGR_EMPID: names[2] });
      setFormData((prev) => ({
        ...prev,
        SUPERVISOR_EMPID: employeeData.SUPERVISOR_EMPID || "",
        DEPT_HEAD_EMPID: employeeData.DEPT_HEAD_EMPID || "",
        MANGR_EMPID: employeeData.MANGR_EMPID || "",
      }));
    } finally {
      setApproverLoading(false);
    }
  };

  const fetchLeaveTypes = async (employeeId: string) => {
    if (!employeeId) return;
    setLeaveTypesLoading(true);
    setLeaveTypesError("");
    try {
      const leaveHistory = await getHrLeaveEntitlement(employeeId);
      const uniqueTypes = new Map<string, ILeaveType>();
      leaveHistory.forEach((leave: any) => {
        if (leave.LEAVE_TYPE && leave.LEAVE_DESC && !uniqueTypes.has(leave.LEAVE_TYPE)) {
          uniqueTypes.set(leave.LEAVE_TYPE, { value: leave.LEAVE_TYPE, label: leave.LEAVE_DESC });
        }
      });
      setLeaveTypes(Array.from(uniqueTypes.values()).sort((a, b) => a.label.localeCompare(b.label)));
    } catch {
      setLeaveTypesError("Failed to load leave types");
      setLeaveTypes([]);
    } finally {
      setLeaveTypesLoading(false);
    }
  };

  const validateLeave = async () => {
    if (!formData.EMPLOYEE_ID) {
      setNotice({ type: "error", message: "Please select an employee first" });
      return;
    }
    if (!formData.leave_type || !formData.leave_start_date || !formData.leave_end_date) {
      setNotice({
        type: "error",
        message: "Please fill all required leave details (Leave Type, Start Date, End Date)",
      });
      return;
    }
    const requestedDays = Number(formData.leave_days);
    if (requestedDays <= 0) {
      setNotice({ type: "error", message: "Leave days must be greater than zero" });
      return;
    }

    setValidationLoading(true);
    setValidationResult(null);

    try {
      const result = await validateHrLeave({
        companyCode: String(user?.COMPANY_CODE),
        employeeId: formData.EMPLOYEE_ID,
        leaveStartDate: formData.leave_start_date,
        leaveEndDate: formData.leave_end_date,
        leaveType: formData.leave_type,
        leaveDays: requestedDays,
      });

      let isValid: boolean = Boolean(result.success && result.isValid);
      let message = result.message || "Leave validation passed!";

      if (
        result.availableBalance !== undefined &&
        result.availableBalance !== null &&
        result.availableBalance < requestedDays
      ) {
        isValid = false;
        message = `Insufficient leave balance. Available: ${result.availableBalance} days, Requested: ${requestedDays} days`;
      }

      if (result.message && result.message.includes("$$$")) {
        const parts = result.message.split("$$$");
        if (parts.length === 2) {
          const balance = parseFloat(parts[1]);
          if (!isNaN(balance) && balance < requestedDays) {
            isValid = false;
            message = `Insufficient leave balance. Available: ${balance} days, Requested: ${requestedDays} days`;
          } else if (!isNaN(balance)) {
            result.availableBalance = balance;
            message = `Leave validation passed! Available balance: ${balance} days`;
          }
        }
      }

      const validationResponse: IValidateLeaveResponse = {
        ...result,
        success: result.success ?? isValid,
        isValid,
        message,
        validationResult: result,
        availableBalance: result.availableBalance ?? undefined,
      };

      setValidationResult(validationResponse);
      setNotice({ type: isValid ? "success" : "error", message });
    } catch {
      setNotice({ type: "error", message: "Failed to validate leave request" });
    } finally {
      setValidationLoading(false);
    }
  };

  const handleChange = (field: keyof FormDataType, value: any) => {
    if (field === "leave_type") {
      const selectedLeaveType = leaveTypes.find((lt) => lt.value === value);
      setFormData((prev) => ({
        ...prev,
        leave_type: value,
        leave_type_desc: selectedLeaveType ? selectedLeaveType.label : "",
      }));
      setValidationResult(null);
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (
        (field === "leave_start_date" || field === "leave_end_date") &&
        updated.leave_start_date &&
        updated.leave_end_date
      ) {
        const start = dayjs(updated.leave_start_date, ISO_FORMAT, true);
        const end = dayjs(updated.leave_end_date, ISO_FORMAT, true);
        if (start.isValid() && end.isValid() && start.isBefore(end.add(1, "day"))) {
          const dayDiff = end.diff(start, "day") + 1;
          updated.leave_days = dayDiff > 0 ? dayDiff.toString() : "0";
        } else {
          updated.leave_days = "0";
        }
      }
      return updated;
    });

    if (["leave_type", "leave_start_date", "leave_end_date", "leave_days"].includes(field)) {
      setValidationResult(null);
    }
  };

  const handleSave = async (actionType: string) => {
    const {
      request_number,
      request_date,
      EMPLOYEE_ID,
      leave_type,
      leave_start_date,
      leave_end_date,
      leave_days,
      remarks,
      SUPERVISOR_EMPID,
      DEPT_HEAD_EMPID,
      MANGR_EMPID,
      resume_work,
      actual_resume_date,
      DUTY_RESUME_DATE,
    } = formData;

    const requestDateIso = toIso(request_date);
    const startIso = toIso(leave_start_date);
    const endIso = toIso(leave_end_date);
    const actualResumeIso = toIso(actual_resume_date);
    const dutyResumeIso = toIso(DUTY_RESUME_DATE);

    if (actionType === "SAVEASDRAFT" || actionType === "SUBMITTED") {
      const errors: string[] = [];
      if (!requestDateIso) errors.push("Request Date is required.");
      if (!EMPLOYEE_ID) errors.push("Employee Code is required.");
      if (!leave_type) errors.push("Leave Type is required.");
      if (!startIso) errors.push("Leave Start Date is required.");
      if (!endIso) errors.push("Leave End Date is required.");
      if (startIso && endIso && dayjs(endIso).isBefore(dayjs(startIso))) {
        errors.push("Leave End Date cannot be before Leave Start Date.");
      }
      if (!remarks) errors.push("Remarks are required.");
      if (!actualResumeIso) errors.push("Actual Resume Date is required.");
      if (!dutyResumeIso) errors.push("Duty Resume Date is required.");
      if (errors.length) {
        setNotice({ type: "error", message: errors.join(" ") });
        return;
      }
    }

    setSaving(actionType);

    const payload = {
      COMPANY_CODE: user?.company_code || "",
      EMPLOYEE_NAME: formData.Employee_Name || "",
      CREATED_BY: user?.loginid1 || "",
      UPDATED_BY: user?.loginid1 || "",
      LAST_ACTION: actionType,
      REQUEST_NUMBER: request_number || "",
      REQUEST_DATE: requestDateIso || todayIso(),
      EMPLOYEE_CODE: EMPLOYEE_ID,
      LEAVE_TYPE: leave_type,
      LEAVE_START_DATE: startIso,
      LEAVE_END_DATE: endIso,
      LEAVE_DAYS: leave_days ? Number(leave_days) : 0,
      REMARKS: remarks || "Draft save",
      FLOW_CODE: "004",
      HOD: MANGR_EMPID,
      IMMEDIATE_SUPERVISOR: SUPERVISOR_EMPID,
      DEPT_HEAD: DEPT_HEAD_EMPID,
      LEAVE_ALLOWANCE: formData.LEAVE_ALLOWANCE || "",
      ADV_PAYMENT: formData.ADV_PAYMENT || "",
      CAUSE_TYPE: formData.CAUSE_TYPE || "",
      TRAVEL_DATE: toIso(formData.TRAVEL_DATE),
      TRAVEL_END_DATE: toIso(formData.TRAVEL_END_DATE),
      NAME_OF_REPLACEMENT: formData.NAME_OF_REPLACEMENT || "",
      CONTACT_DETAILS_DURING_LEAVE: formData.CONTACT_DETAILS_DURING_LEAVE || "",
      RESUME_DATE: toIso(formData.resume_date),
      LEAVE_TYPE_DESC: formData.leave_type_desc || "",
      HALF_DAY: formData.is_half_day,
      RESUME_WORK: resume_work ? "Yes" : "No",
      ACTUAL_RESUME_DATE: actualResumeIso,
      DUTY_RESUME_DATE: dutyResumeIso,
      AIR_ROUTE: formData.AIR_ROUTE || "",
      AIR_TICKET: formData.AIR_TICKET || "",
    };

    try {
      let result: unknown;

      if (isAlms) {
        // ALMS: save through the same API the Leave Request form uses.
        const almsPayload: Record<string, unknown> = {
          ...payload,
          COMPANY_CODE: String(user?.company_code || user?.COMPANY_CODE || "BSG"),
          CREATED_BY: String((data as any)?.CREATED_BY || loginId),
          UPDATED_BY: loginId,
          LAST_ACTION: actionType === "CANCELLED" ? "CANCEL" : actionType,
          HALF_DAY: formData.is_half_day ? "Y" : "N",
          RESUME_WORK: "No",
          UUID: getUuid(),
        };
        result = await saveLeaveRequestFlow(almsPayload, loginId);
      } else {
        // MHDL: unchanged.
        result = await saveHrLeaveApproval(payload);
      }

      if (result) {
        setNotice({ type: "success", message: "Leave request saved successfully" });
        onSuccess?.();
        onClose?.();
      } else {
        setNotice({ type: "error", message: "An error occurred while saving the leave request." });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "An error occurred while saving the leave request.",
      });
    } finally {
      setSaving(null);
    }
  };

  const showSideBySideApprovers = Boolean(
    formData.IMMEDIATE_SUPERVISOR_NAME || formData.DEPT_HEAD_NAME || formData.HOD_NAME,
  );

  const approverRows = showSideBySideApprovers
    ? [
        { label: "Immediate Supervisor", name: formData.IMMEDIATE_SUPERVISOR_NAME },
        { label: "Department Head", name: formData.DEPT_HEAD_NAME },
        { label: "HR. Head Of Department", name: formData.HOD_NAME },
      ]
    : [
        { label: "Immediate Supervisor", name: approverNames.SUPERVISOR_EMPID },
        { label: "Department Head", name: approverNames.DEPT_HEAD_EMPID },
        { label: "HR. Head Of Department", name: approverNames.MANGR_EMPID },
      ];

  const fieldsReadOnly = Boolean(approveResumption || data?.FINAL_APPROVED === "YES");
  const leaveDatesReadOnly = fieldsReadOnly && !repairDates;

  const lastAction = String(data?.LAST_ACTION || "").toUpperCase();
  const statusLabel = String((data as any)?.STATUS || lastAction || "Draft");
  const requestNumber = formData.request_number;
  const busy = Boolean(saving);

  const alertNotice = notice ? ({ ...notice, type: notice.type === "info" ? "success" : notice.type } as any) : null;

  const actionBtn =
    "!w-auto shrink-0 whitespace-nowrap h-8 gap-1.5 text-xs font-semibold px-3 rounded-lg cursor-pointer";
  const dangerBtn = `${actionBtn} !text-red-600 !border-red-200 hover:!bg-red-50`;

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleSave("SAVEASDRAFT")}
        disabled={viewMode || busy}
        className={actionBtn}
      >
        {saving === "SAVEASDRAFT" ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
        <span>Save As Draft</span>
      </Button>

      <Button
        type="button"
        onClick={() => void handleSave("SUBMITTED")}
        disabled={viewMode || busy}
        className={`${actionBtn} bg-[#00378C] text-white hover:bg-[#002d72]`}
      >
        {saving === "SUBMITTED" ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
        <span>Submit</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => void handleSave("CANCELLED")}
        disabled={viewMode || busy}
        className={dangerBtn}
      >
        {saving === "CANCELLED" ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
        <span>Cancel Request</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="Export Leave Request"
        aria-label="Export Leave Request"
        onClick={handleExport}
        disabled={!isEditMode && !requestNumber}
        className="h-8 w-8 shrink-0 rounded-lg cursor-pointer"
      >
        <FileDown size={14} />
      </Button>
    </>
  );

  const mainNode = (
    <>
      {/* Employee strip */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee</p>
        <p className="m-0 mt-0.5 text-sm font-medium text-slate-900">
          {data?.EMPLOYEE_NAME_DISPLAY || `${user?.loginid || ""} - ${formData.Employee_Name}`}
        </p>
      </div>

      {repairDates && (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          This record has no valid leave start/end date. Please re-enter them below.
        </p>
      )}

      {/* Resumption: the section the user actually fills in */}
      <div className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-xs">
        <div className="border-b border-blue-200 bg-blue-50/70 px-3 py-1.5">
          <h3 className="m-0 text-sm font-semibold text-[#00378C]">Leave Resumption</h3>
        </div>
        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col justify-end">
            <label
              className={`flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-[#f8f9fb] px-2.5 text-xs font-semibold text-slate-700 ${
                viewMode ? "opacity-60" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[#00378C]"
                disabled={viewMode}
                checked={formData.actual_resume_date ? true : formData.resume_work}
                onChange={(e) => handleChange("resume_work", e.target.checked)}
              />
              Resume Work
            </label>
          </div>

          <Field label="Duty Resume Date *">
            <Input
              type="date"
              disabled={viewMode}
              value={formData.DUTY_RESUME_DATE}
              onChange={(e) => handleChange("DUTY_RESUME_DATE", e.target.value)}
            />
          </Field>

          <Field label="Actual Resume Date *">
            <Input
              type="date"
              disabled={viewMode}
              value={formData.actual_resume_date}
              onChange={(e) => handleChange("actual_resume_date", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {data?.LAST_ACTION === "SENTBACK" && data?.SENTBACK_HISTORY && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Sent back with remarks</p>
          <p className="m-0 mt-0.5 text-sm text-amber-900">{data.SENTBACK_HISTORY}</p>
        </div>
      )}
      {data?.LAST_ACTION === "REJECTED" && data?.CANCEL_REMARK && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-red-800">Rejected with remarks</p>
          <p className="m-0 mt-0.5 text-sm text-red-900">{data.CANCEL_REMARK}</p>
        </div>
      )}

      {/* Three columns side-by-side with bordered section cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ---------- Column 1: Leave Details ---------- */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Leave Details</h3>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <Field label="Leave Type *">
              <Select
                value={formData.leave_type}
                onChange={(e) => handleChange("leave_type", e.target.value)}
                disabled={leaveTypesLoading || !formData.EMPLOYEE_ID || fieldsReadOnly}
              >
                <option value="">{leaveTypesLoading ? "Loading..." : "Leave Type"}</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Leave Start Date *">
              <Input
                type="date"
                disabled={leaveDatesReadOnly}
                value={formData.leave_start_date}
                onChange={(e) => handleChange("leave_start_date", e.target.value)}
              />
            </Field>

            <Field label="Leave End Date *">
              <Input
                type="date"
                disabled={leaveDatesReadOnly}
                value={formData.leave_end_date}
                min={formData.leave_start_date || undefined}
                onChange={(e) => handleChange("leave_end_date", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field label="Leave Days">
                <Input value={formData.leave_days} disabled readOnly tabIndex={-1} onChange={() => {}} />
              </Field>
              <label
                className={`mb-0 flex h-8 select-none items-center gap-2 text-xs font-medium text-slate-700 ${
                  viewMode || fieldsReadOnly ? "opacity-60" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#00378C]"
                  disabled={viewMode || fieldsReadOnly}
                  checked={formData.is_half_day}
                  onChange={(e) => handleChange("is_half_day", e.target.checked)}
                />
                Half Day
              </label>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void validateLeave()}
              disabled={
                validationLoading ||
                !formData.EMPLOYEE_ID ||
                !formData.leave_type ||
                !formData.leave_start_date ||
                !formData.leave_end_date ||
                fieldsReadOnly
              }
              className="mt-1 h-9 w-full justify-center gap-2 rounded-full text-xs font-semibold"
            >
              {validationLoading ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
              {validationLoading ? "Checking..." : "Validate"}
            </Button>

            {validationResult?.validationErrors && validationResult.validationErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                {validationResult.validationErrors.map((error, index) => (
                  <p key={index} className="m-0 text-xs text-red-800">
                    • {error}
                  </p>
                ))}
              </div>
            )}
            {validationResult?.availableBalance !== undefined && (
              <p className="m-0 text-xs font-medium text-slate-600">
                Available Balance: {validationResult.availableBalance} days
              </p>
            )}
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
                value={formData.LEAVE_ALLOWANCE as string}
                onChange={(e) => handleChange("LEAVE_ALLOWANCE", e.target.value)}
                disabled={fieldsReadOnly}
              >
                <option value="">Leave Allowance</option>
                <option value={yesValue}>Yes</option>
                <option value={noValue}>No</option>
              </Select>
            </Field>

            <Field label="Advance Payment">
              <Select
                value={formData.ADV_PAYMENT as string}
                onChange={(e) => handleChange("ADV_PAYMENT", e.target.value)}
                disabled={fieldsReadOnly}
              >
                <option value="">Advance Payment</option>
                <option value={yesValue}>Yes</option>
                <option value={noValue}>No</option>
              </Select>
            </Field>

            <Field label="Cause Type">
              {isAlms ? (
                <Input
                  value={formData.CAUSE_TYPE}
                  onChange={(e) => handleChange("CAUSE_TYPE", e.target.value)}
                  disabled={fieldsReadOnly}
                />
              ) : (
                <Select
                  value={formData.CAUSE_TYPE}
                  onChange={(e) => handleChange("CAUSE_TYPE", e.target.value)}
                  disabled={fieldsReadOnly}
                >
                  <option value="">Cause Type</option>
                  <option value="Occupational">Occupational</option>
                  <option value="Non Occupational">Non Occupational</option>
                </Select>
              )}
            </Field>

            <Field label="Remarks *">
              <textarea
                className="min-h-[72px] w-full resize-y rounded-md border border-gray-300 p-2 text-sm"
                rows={3}
                disabled={fieldsReadOnly}
                value={formData.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
              />
            </Field>

            <Field label="Contact Details During Leave">
              <textarea
                className="min-h-[72px] w-full resize-y rounded-md border border-gray-300 p-2 text-sm"
                rows={3}
                disabled={fieldsReadOnly}
                value={formData.CONTACT_DETAILS_DURING_LEAVE}
                onChange={(e) => handleChange("CONTACT_DETAILS_DURING_LEAVE", e.target.value)}
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
            {approverRows.map(({ label, name }) => (
              <Field key={label} label={label}>
                <Input
                  value={name || (approverLoading ? "Loading..." : "Not assigned")}
                  disabled
                  readOnly
                  onChange={() => {}}
                />
              </Field>
            ))}

            <Field label="Air Ticket">
              <Select
                value={formData.AIR_TICKET}
                onChange={(e) => handleChange("AIR_TICKET", e.target.value)}
                disabled={fieldsReadOnly}
              >
                <option value="">Air Ticket</option>
                <option value={yesValue}>Yes</option>
                <option value={noValue}>No</option>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Travel Start Date">
                <Input
                  type="date"
                  disabled={fieldsReadOnly}
                  value={formData.TRAVEL_DATE}
                  onChange={(e) => handleChange("TRAVEL_DATE", e.target.value)}
                />
              </Field>
              <Field label="Travel End Date">
                <Input
                  type="date"
                  disabled={fieldsReadOnly}
                  value={formData.TRAVEL_END_DATE}
                  min={formData.TRAVEL_DATE || undefined}
                  onChange={(e) => handleChange("TRAVEL_END_DATE", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Air Route">
              <Input
                value={formData.AIR_ROUTE}
                onChange={(e) => handleChange("AIR_ROUTE", e.target.value)}
                disabled={fieldsReadOnly}
              />
            </Field>
          </div>
        </div>
      </div>
    </>
  );

  // Page layout: identical shell to the Leave Request editor.
  if (inline) {
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
                disabled={busy}
                aria-label="Back to list"
                title="Back to list"
                className="h-8 w-8 shrink-0 rounded-lg cursor-pointer"
              >
                <ArrowLeft size={15} />
              </Button>
              <h1 className="m-0 truncate text-sm font-semibold text-slate-900">Leave Resumption</h1>
              {requestNumber && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {requestNumber}
                </span>
              )}
              <span className="select-none rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Request Date: {formatHeaderDate(formData.request_date)}
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
      </section>
    );
  }

  // Embedded layout (e.g. inside a dialog)
  return (
    <div className="flex flex-col gap-2.5">
      <AutoDismissAlert notice={alertNotice} onClose={() => setNotice(null)} />
      {mainNode}
      <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-2">
        {actionButtons}
      </div>
    </div>
  );
};

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const required = label.trim().endsWith("*");
  const text = label.replace(/\s*\*$/, "");
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        {text}
        {required && <span className="ml-0.5 font-bold text-[#E24B4A]">*</span>}
      </span>
      {children}
    </label>
  );
}

function statusBadgeTone(label: string) {
  const l = (label || "").toLowerCase();
  const base = "rounded-md border px-2 py-0.5 text-[11px] font-medium";
  if (l.includes("approv") || l.includes("close")) return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (l.includes("reject")) return `${base} border-red-200 bg-red-50 text-red-700`;
  if (l.includes("cancel") || l.includes("draft") || l.includes("saveasdraft"))
    return `${base} border-slate-200 bg-slate-50 text-slate-600`;
  if (l.includes("progress")) return `${base} border-sky-200 bg-sky-50 text-sky-700`;
  return `${base} border-amber-200 bg-amber-50 text-amber-700`;
}

export default LeaveResumptionForm;