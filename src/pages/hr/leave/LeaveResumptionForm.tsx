import React, { useEffect, useRef, useState } from "react";
import { Calendar, FileDown, Save, Send, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
// import { Dialog } from "../../../components/ui/Dialog";
// import { SentBackPopup } from "pages/Purchasefolder/MyTaskPendingRequestTab";
import * as XLSX from "xlsx";
import { IHrEmployee, IValidateLeaveResponse, TLeaveApproval } from "./leave-approval-types";
import { getEmployees, getHrEmployees, getHrLeaveEntitlement, saveHrLeaveApproval, validateHrLeave } from "../../../api/hr";

dayjs.extend(customParseFormat);

// All dates are kept internally as ISO (YYYY-MM-DD) so comparisons, dayjs
// maths and the payload builder stay simple. Only the on-screen text is
// rendered/typed as DD-MM-YYYY via the DateInput below (which also offers a
// calendar picker).
const ISO_FORMAT = "YYYY-MM-DD";
const DISPLAY_FORMAT = "DD-MM-YYYY";

// Formats we accept coming from the API / parent. Order matters; every one is
// parsed strictly so that e.g. "01-09-2026" is never misread as MM-DD-YYYY
// (which is what `new Date("01-09-2026")` does in Chrome).
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
 * Returns "" for empty / unparseable input — including the literal string
 * "Invalid Date" — so callers can rely on a truthy result being a real date.
 */
function toIso(value?: string | Date | null): string {
  if (!value) return "";

  if (value instanceof Date) {
    const d = dayjs(value);
    return d.isValid() ? d.format(ISO_FORMAT) : "";
  }

  const s = String(value).trim();
  if (!s || s.toLowerCase() === "invalid date") return "";

  // ISO timestamp (e.g. 2026-08-24T20:00:00.000Z from oracledb): convert to
  // the local calendar day instead of slicing, otherwise UTC shifts the date.
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

function displayToIso(display: string): string {
  const parsed = dayjs(display, DISPLAY_FORMAT, true);
  return parsed.isValid() ? parsed.format(ISO_FORMAT) : "";
}

const todayIso = () => dayjs().format(ISO_FORMAT);

type AddLeaveApprovalFormProps = {
  data?: TLeaveApproval | null;
  onClose?: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  viewMode?: boolean;
  approveResumption?: boolean;
  disableButtons?: boolean;
};

// interface SentBackPopupState {
//   open: boolean;
//   data: {
//     request_number: string;
//     level: number;
//     remarks: string;
//   };
// }

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
  // Local date, not toISOString() — that is UTC and gives "yesterday" for the
  // first hours of the day in UTC+ timezones.
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
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormDataType>(emptyFormData(user?.company_code || ""));
  const [saving, setSaving] = useState(false);

  // True when the record arrived without usable leave start/end dates. In that
  // case the (normally read-only) date fields are unlocked so they can be
  // re-entered with the calendar instead of being stuck blank.
  const [repairDates, setRepairDates] = useState(false);

  //   const [sentBackPopup, setSentBackPopup] = useState<SentBackPopupState>({
  //     open: false,
  //     data: { request_number: "", level: 0, remarks: "" },
  //   });

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
  const [showValidationAlert, setShowValidationAlert] = useState(false);

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

  // Edit mode: the effect above bails out early when `data` is present, so
  // the leave-types list was never being fetched for existing records —
  // that's why the Leave Type select had no option matching the saved
  // value and rendered blank. Fetch it here using the record's own
  // employee id instead.
  useEffect(() => {
    if (!data) return;
    const employeeId = (data.EMPLOYEE_ID || data.EMPLOYEE_CODE || "").toString();
    if (employeeId) void fetchLeaveTypes(employeeId);
  }, [data]);

  useEffect(() => {
    if (!data) return;

    // Every date coming from the record goes through toIso() so the form state
    // only ever holds "YYYY-MM-DD" or "" — never "Invalid Date" or a
    // DD-MM-YYYY / DD-MON-YY string.
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
      is_half_day: false,
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
      toast.success("Leave request exported successfully");
    } catch (error) {
      toast.error("Failed to export leave request");
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
      toast.error("Please select an employee first");
      return;
    }
    if (!formData.leave_type || !formData.leave_start_date || !formData.leave_end_date) {
      toast.error("Please fill all required leave details (Leave Type, Start Date, End Date)");
      return;
    }
    const requestedDays = Number(formData.leave_days);
    if (requestedDays <= 0) {
      toast.error("Leave days must be greater than zero");
      return;
    }

    setValidationLoading(true);
    setValidationResult(null);
    setShowValidationAlert(true);

    try {
      const result = await validateHrLeave({
        companyCode: String(user?.COMPANY_CODE),
        employeeId: formData.EMPLOYEE_ID,
        leaveStartDate: formData.leave_start_date,
        leaveEndDate: formData.leave_end_date,
        leaveType: formData.leave_type,
        leaveDays: requestedDays,
      });

      let isValid = result.success && result.isValid;
      let message = result.message || "Leave validation passed!";

      if (result.availableBalance !== undefined && result.availableBalance < requestedDays) {
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

      setValidationResult({ ...result, isValid, message });
      if (isValid) toast.success(message);
      else toast.error(message);
    } catch (error) {
      toast.error("Failed to validate leave request");
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
      setShowValidationAlert(false);
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if ((field === "leave_start_date" || field === "leave_end_date") && updated.leave_start_date && updated.leave_end_date) {
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
      setShowValidationAlert(false);
    }
  };

  const handleSave = async (actionType: string) => {
    setSaving(true);
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

    // Normalise once; everything below (validation + payload) uses these so
    // "Invalid Date" can never reach the backend.
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
        setSaving(false);
        toast.error(errors.join(" "));
        return;
      }
    }

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
      // Optional dates: "" when empty/invalid, never "Invalid Date".
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
      const result = await saveHrLeaveApproval(payload);
      if (result) {
        toast.success("Leave request saved successfully");
        onSuccess?.();
        onClose?.();
      } else {
        toast.error("An error occurred while saving the leave request.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred while saving the leave request.");
    } finally {
      setSaving(false);
    }
  };

  const showSideBySideApprovers = Boolean(
    formData.IMMEDIATE_SUPERVISOR_NAME || formData.DEPT_HEAD_NAME || formData.HOD_NAME,
  );

  const approverRows = showSideBySideApprovers
    ? [
        { label: "Immediate Supervisor", name: formData.IMMEDIATE_SUPERVISOR_NAME },
        { label: "Department Head", name: formData.DEPT_HEAD_NAME },
        { label: "HOD", name: formData.HOD_NAME },
      ]
    : [
        { label: "Immediate Supervisor", name: approverNames.SUPERVISOR_EMPID },
        { label: "Department Head", name: approverNames.DEPT_HEAD_EMPID },
        { label: "HOD", name: approverNames.MANGR_EMPID },
      ];

  const fieldsReadOnly = approveResumption || data?.FINAL_APPROVED === "YES";

  // Leave start/end stay locked for resumption/final-approved records, unless
  // the record came in without valid dates and they need to be re-entered.
  const leaveDatesReadOnly = fieldsReadOnly && !repairDates;

  return (
    <div className="grid gap-5">
      {/* Header with Request Date on the right */}
      <div className="border-b border-border pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-foreground">
              Leave Request Number <span className="text-muted-foreground">{formData.request_number || "—"}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.EMPLOYEE_NAME_DISPLAY || `${user?.loginid || ""} - ${formData.Employee_Name}`}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Field label="Request Date" required>
              <DateInput value={formData.request_date} onChange={() => {}} disabled />
            </Field>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-1 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-sm font-semibold text-foreground">Request &amp; Resumption</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="flex items-center space-x-3">
              <Field label="Resume Work">
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    style={{ width: 20, height: 25, minWidth: 25, minHeight: 25 }}
                    className="rounded border-input text-primary focus:ring-primary/20 cursor-pointer"
                    disabled={viewMode}
                    checked={formData.actual_resume_date ? true : formData.resume_work}
                    onChange={(e) => handleChange("resume_work", e.target.checked)}
                  />
                </label>
              </Field>
            </div>

            {/* Duty Resume Date */}
            <div>
              <Field label="Duty Resume Date" required>
                <DateInput
                  disabled={viewMode}
                  value={formData.DUTY_RESUME_DATE}
                  onChange={(iso) => handleChange("DUTY_RESUME_DATE", iso)}
                  placeholder="DD-MM-YYYY"
                />
              </Field>
            </div>

            {/* Actual Resume Date */}
            <div>
              <Field label="Actual Resume Date" required>
                <DateInput
                  disabled={viewMode}
                  value={formData.actual_resume_date}
                  onChange={(iso) => handleChange("actual_resume_date", iso)}
                  placeholder="DD-MM-YYYY"
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <h3 className="m-0 text-sm font-semibold">Leave Details</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {showValidationAlert && validationResult && (
              <div className={validationResult.isValid ? "alert success" : "alert error"}>
                <p className="m-0 text-sm">{validationResult.message}</p>
                {validationResult.validationErrors && validationResult.validationErrors.length > 0 && (
                  <div className="mt-1">
                    {validationResult.validationErrors.map((error, index) => (
                      <p key={index} className="m-0 text-sm">
                        • {error}
                      </p>
                    ))}
                  </div>
                )}
                {validationResult.availableBalance !== undefined && (
                  <p className="m-0 mt-1 text-sm">Available Balance: {validationResult.availableBalance} days</p>
                )}
              </div>
            )}

            <Field label="Leave Type" required>
              <Select
                value={formData.leave_type}
                onChange={(e) => handleChange("leave_type", e.target.value)}
                disabled={leaveTypesLoading || !formData.EMPLOYEE_ID || fieldsReadOnly}
              >
                <option value="">Select...</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Leave Start Date" required>
              <DateInput
                disabled={leaveDatesReadOnly}
                value={formData.leave_start_date}
                onChange={(iso) => handleChange("leave_start_date", iso)}
              />
            </Field>

            <Field label="Leave End Date" required>
              <DateInput
                disabled={leaveDatesReadOnly}
                value={formData.leave_end_date}
                min={formData.leave_start_date || undefined}
                onChange={(iso) => handleChange("leave_end_date", iso)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Leave Days">
                <Input disabled value={formData.leave_days} onChange={() => {}} />
              </Field>

              <Field label="Half Day">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    style={{ width: 14, height: 14, minWidth: 14, minHeight: 14, flexShrink: 0 }}
                    className="cursor-pointer rounded border-input"
                    disabled={viewMode || fieldsReadOnly}
                    checked={formData.is_half_day}
                    onChange={(e) => handleChange("is_half_day", e.target.checked)}
                  />
                </label>
              </Field>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={validateLeave}
              disabled={
                validationLoading ||
                !formData.EMPLOYEE_ID ||
                !formData.leave_type ||
                !formData.leave_start_date ||
                !formData.leave_end_date ||
                fieldsReadOnly
              }
            >
              {validationLoading ? "Validating..." : "Validate"}
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <div>
              <h3 className="m-0 text-sm font-semibold">Additional Details</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Leave Allowance">
              <Select
                value={formData.LEAVE_ALLOWANCE as string}
                onChange={(e) => handleChange("LEAVE_ALLOWANCE", e.target.value)}
                disabled={fieldsReadOnly}
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </Field>

            <Field label="Advance Payment">
              <Select
                value={formData.ADV_PAYMENT as string}
                onChange={(e) => handleChange("ADV_PAYMENT", e.target.value)}
                disabled={fieldsReadOnly}
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </Field>

            <Field label="Cause Type">
              <Select
                value={formData.CAUSE_TYPE}
                onChange={(e) => handleChange("CAUSE_TYPE", e.target.value)}
                disabled={fieldsReadOnly}
              >
                <option value="">Select...</option>
                <option value="Occupational">Occupational</option>
                <option value="Non Occupational">Non Occupational</option>
              </Select>
            </Field>

            <Field label="Remarks" required>
              <textarea
                className="input resize-none"
                rows={2}
                disabled={fieldsReadOnly}
                value={formData.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
              />
            </Field>

            <Field label="Contact Details During Leave">
              <textarea
                className="input resize-none"
                rows={2}
                disabled={fieldsReadOnly}
                value={formData.CONTACT_DETAILS_DURING_LEAVE}
                onChange={(e) => handleChange("CONTACT_DETAILS_DURING_LEAVE", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Approver Details */}
        <Card>
          <CardHeader>
            <div>
              <h3 className="m-0 text-sm font-semibold">Approver Details</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {approverRows.map(({ label, name }) => (
              <Field key={label} label={label}>
                <Input disabled value={name || (approverLoading ? "Loading..." : "Not assigned")} onChange={() => {}} />
              </Field>
            ))}

            <Field label="Travel Start Date">
              <DateInput
                disabled={fieldsReadOnly}
                value={formData.TRAVEL_DATE}
                onChange={(iso) => handleChange("TRAVEL_DATE", iso)}
              />
            </Field>

            <Field label="Travel End Date">
              <DateInput
                disabled={fieldsReadOnly}
                value={formData.TRAVEL_END_DATE}
                min={formData.TRAVEL_DATE || undefined}
                onChange={(iso) => handleChange("TRAVEL_END_DATE", iso)}
              />
            </Field>

            <Field label="Air Route">
              <textarea
                className="input resize-none"
                rows={2}
                disabled={fieldsReadOnly}
                value={formData.AIR_ROUTE}
                onChange={(e) => handleChange("AIR_ROUTE", e.target.value)}
              />
            </Field>

            {data?.LAST_ACTION === "SENTBACK" && data?.SENTBACK_HISTORY !== "" && (
              <Field label="Send Back Remarks">
                <textarea className="input resize-none" rows={2} disabled value={data?.SENTBACK_HISTORY || ""} />
              </Field>
            )}

            {data?.LAST_ACTION === "REJECTED" && data?.CANCEL_REMARK !== "" && (
              <Field label="Reject Remarks">
                <textarea className="input resize-none" rows={2} disabled value={data?.CANCEL_REMARK || ""} />
              </Field>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mt-2 flex flex-col items-center justify-between gap-3 border-t border-border pt-3 sm:flex-row">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={viewMode || saving} onClick={() => handleSave("SUBMITTED")}>
            <Send size={15} /> Submit
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={viewMode || saving} onClick={() => handleSave("SAVEASDRAFT")}>
            <Save size={15} /> {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={viewMode || saving} onClick={() => handleSave("CANCELLED")}>
            <XCircle size={15} /> Cancel
          </Button>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" title="Export Leave Request" onClick={handleExport} disabled={!isEditMode}>
            <FileDown size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

type DateInputProps = {
  /** ISO value (YYYY-MM-DD) or "" */
  value: string;
  /** Called with an ISO value, or "" when cleared / invalid */
  onChange: (isoValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** ISO lower bound for the calendar picker */
  min?: string;
  /** ISO upper bound for the calendar picker */
  max?: string;
};

/**
 * Masked DD-MM-YYYY text input with a calendar button that opens the
 * browser's native date picker. The form only ever sees ISO strings.
 */
const DateInput: React.FC<DateInputProps> = ({ value, onChange, disabled, placeholder = "DD-MM-YYYY", min, max }) => {
  const [text, setText] = useState(() => isoToDisplay(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
    }
    setText(formatted);

    if (digits.length === 8) {
      // "" when the typed date doesn't exist (e.g. 31-02-2026), so the form
      // never keeps a stale value that differs from what's on screen.
      onChange(displayToIso(formatted));
    } else if (formatted === "") {
      onChange("");
    }
  };

  // Half-typed input is discarded on blur, so the box always shows the real value.
  const handleBlur = () => setText(isoToDisplay(value));

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={10}
        disabled={disabled}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
      />
      {!disabled && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Open calendar"
            onClick={openPicker}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Calendar size={16} />
          </button>
          {/* Visually hidden native picker; its value is always ISO. */}
          <input
            ref={pickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            value={toIso(value)}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            className="pointer-events-none absolute bottom-0 left-0 h-0 w-full opacity-0"
          />
        </>
      )}
    </div>
  );
};

export default LeaveResumptionForm;