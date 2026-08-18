import React, { useEffect, useState } from "react";
import { FileDown,  Save, Send, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import dayjs from 'dayjs';
// import { Dialog } from "../../../components/ui/Dialog";
// import { SentBackPopup } from "pages/Purchasefolder/MyTaskPendingRequestTab";
import * as XLSX from "xlsx";
import { IHrEmployee, IValidateLeaveResponse, TLeaveApproval } from "./leave-approval-types";
import { getEmployees, getHrEmployees, getHrLeaveEntitlement, saveHrLeaveApproval, validateHrLeave } from "../../../api/hr";

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
  request_date: new Date().toISOString().split("T")[0],
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
  }, [currentUserEmployeeData , data]);

  useEffect(() => {
    if (!data) return;
    setFormData({
      request_number: data.REQUEST_NUMBER || "",
      request_date: data.REQUEST_DATE || "",
      employee_code: data.EMPLOYEE_CODE || "",
      leave_type: data.LEAVE_TYPE || "",
      leave_type_desc: data.LEAVE_TYPE_DESC || "",
      Employee_Name: data.EMPLOYEE_NAME || "",
      leave_start_date: data.LEAVE_START_DATE || "",
      leave_end_date: data.LEAVE_END_DATE || "",
      resume_date: data.RESUME_DATE || "",
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
      TRAVEL_DATE: data.TRAVEL_DATE || "",
      TRAVEL_END_DATE: data.TRAVEL_END_DATE || "",
      CAUSE_TYPE: data.CAUSE_TYPE || "",
      ADV_PAYMENT: data.ADV_PAYMENT || "",
      LEAVE_ALLOWANCE: data.LEAVE_ALLOWANCE || "",
      is_half_day: false,
      resume_work: data.RESUME_WORK || false,
      actual_resume_date: data.ACTUAL_RESUME_DATE || "",
      DUTY_RESUME_DATE: data.DUTY_RESUME_DATE || "",
      AIR_ROUTE: data.AIR_ROUTE || "",
      AIR_TICKET: data.AIR_TICKET || "",
      IMMEDIATE_SUPERVISOR_NAME: data.IMMEDIATE_SUPERVISOR_NAME || "",
      HOD_NAME: data.HOD_NAME || "",
      DEPT_HEAD_NAME: data.DEPT_HEAD_NAME || "",
    });
  }, [data, user?.company_code]);

  useEffect(() => {
    if (!formData.leave_start_date || !formData.leave_end_date) return;
    const start = parseCustomDate(formData.leave_start_date);
    const end = parseCustomDate(formData.leave_end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays !== Number(formData.leave_days)) {
      setFormData((prev) => ({ ...prev, leave_days: diffDays > 0 ? diffDays.toString() : "" }));
    }
  }, [formData.leave_start_date, formData.leave_end_date]);

  const handleExport = () => {
    try {
      const exportData = {
        "Request Number": formData.request_number || "",
        "Request Date": formData.request_date,
        "Employee Code": formData.employee_code,
        "Employee Name": formData.Employee_Name,
        "Leave Type": formData.leave_type_desc || formData.leave_type,
        "Leave Start Date": formData.leave_start_date,
        "Leave End Date": formData.leave_end_date,
        "Leave Days": formData.leave_days,
        "Resume Date": formData.resume_date,
        Remarks: formData.remarks,
        "Contact Details": formData.CONTACT_DETAILS_DURING_LEAVE,
        "Leave Allowance": formData.LEAVE_ALLOWANCE,
        "Advance Payment": formData.ADV_PAYMENT,
        "Cause Type": formData.CAUSE_TYPE,
        "Travel Date": formData.TRAVEL_DATE,
        "Name of Replacement": formData.NAME_OF_REPLACEMENT,
        "Immediate Supervisor": approverNames.SUPERVISOR_EMPID,
        "Department Head": approverNames.DEPT_HEAD_EMPID,
        HOD: approverNames.MANGR_EMPID,
        "Half Day": formData.is_half_day ? "Yes" : "No",
      };

      const ws = XLSX.utils.json_to_sheet([exportData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leave Request");
      const fileName = `Leave_Request_${formData.request_number || ""}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
        const start = dayjs(updated.leave_start_date);
        const end = dayjs(updated.leave_end_date);
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

    if (actionType === "SAVEASDRAFT" || actionType === "SUBMITTED") {
      const errors: string[] = [];
      if (!request_date) errors.push("Request Date is required.");
      if (!EMPLOYEE_ID) errors.push("Employee Code is required.");
      if (!leave_type) errors.push("Leave Type is required.");
      if (!leave_start_date) errors.push("Leave Start Date is required.");
      if (!leave_end_date) errors.push("Leave End Date is required.");
      if (!remarks) errors.push("Remarks are required.");
      if (!actual_resume_date) errors.push("Actual Resume Date is required.");
      if (!DUTY_RESUME_DATE) errors.push("Duty Resume Date is required.");
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
      REQUEST_DATE: dayjs(request_date).format("YYYY-MM-DD"),
      EMPLOYEE_CODE: EMPLOYEE_ID,
      LEAVE_TYPE: leave_type,
      LEAVE_START_DATE: dayjs(leave_start_date).format("YYYY-MM-DD"),
      LEAVE_END_DATE: dayjs(leave_end_date).format("YYYY-MM-DD"),
      LEAVE_DAYS: leave_days ? Number(leave_days) : 0,
      REMARKS: remarks || "Draft save",
      FLOW_CODE: "004",
      HOD: MANGR_EMPID,
      IMMEDIATE_SUPERVISOR: SUPERVISOR_EMPID,
      DEPT_HEAD: DEPT_HEAD_EMPID,
      LEAVE_ALLOWANCE: formData.LEAVE_ALLOWANCE || "",
      ADV_PAYMENT: formData.ADV_PAYMENT || "",
      CAUSE_TYPE: formData.CAUSE_TYPE || "",
      TRAVEL_DATE: formData.TRAVEL_DATE ? dayjs(formData.TRAVEL_DATE).format("YYYY-MM-DD") : "0000/00/00",
      TRAVEL_END_DATE: formData.TRAVEL_END_DATE ? dayjs(formData.TRAVEL_END_DATE).format("YYYY-MM-DD") : "0000/00/00",
      NAME_OF_REPLACEMENT: formData.NAME_OF_REPLACEMENT || "",
      CONTACT_DETAILS_DURING_LEAVE: formData.CONTACT_DETAILS_DURING_LEAVE || "",
      RESUME_DATE: formData.resume_date || "",
      LEAVE_TYPE_DESC: formData.leave_type_desc || "",
      HALF_DAY: formData.is_half_day,
      RESUME_WORK: resume_work ? "Yes" : "No",
      ACTUAL_RESUME_DATE: actual_resume_date ? dayjs(actual_resume_date).format("YYYY-MM-DD") : "",
      DUTY_RESUME_DATE: DUTY_RESUME_DATE ? dayjs(DUTY_RESUME_DATE).format("YYYY-MM-DD") : "",
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

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="m-0 text-base font-semibold text-foreground">Leave Request Number {formData.request_number}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.EMPLOYEE_NAME_DISPLAY || `${user?.loginid || ""} - ${formData.Employee_Name}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Basic Info</p>
            <h3 className="m-0 text-sm font-semibold">Request &amp; Resumption</h3>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Request Date" required>
            <Input type="date" disabled value={formData.request_date} onChange={() => {}} />
          </Field>

          <Field label="Resume Work">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={viewMode}
                checked={formData.actual_resume_date ? true : formData.resume_work}
                onChange={(e) => handleChange("resume_work", e.target.checked)}
              />
              Resume Work
            </label>
          </Field>

          <Field label="Actual Resume Date" required>
            <Input
              type="date"
              disabled={viewMode}
              min={formData.leave_end_date || undefined}
              value={formData.actual_resume_date}
              onChange={(e) => handleChange("actual_resume_date", e.target.value)}
            />
          </Field>

          <Field label="Duty Resume Date" required>
            <Input
              type="date"
              disabled={viewMode}
              min={formData.leave_end_date || undefined}
              value={formData.DUTY_RESUME_DATE}
              onChange={(e) => handleChange("DUTY_RESUME_DATE", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Leave Details */}
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">Leave</p>
              <h3 className="m-0 text-sm font-semibold">Leave Details</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
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
              <Input
                type="date"
                disabled={fieldsReadOnly}
                value={formData.leave_start_date}
                onChange={(e) => handleChange("leave_start_date", e.target.value)}
              />
            </Field>

            <Field label="Leave End Date" required>
              <Input
                type="date"
                disabled={fieldsReadOnly}
                value={formData.leave_end_date}
                onChange={(e) => handleChange("leave_end_date", e.target.value)}
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
                    disabled={viewMode || fieldsReadOnly}
                    checked={formData.is_half_day}
                    onChange={(e) => handleChange("is_half_day", e.target.checked)}
                  />
                  Half Day
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
              <p className="eyebrow">Settings</p>
              <h3 className="m-0 text-sm font-semibold">Additional Details</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
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
                className="input"
                rows={2}
                disabled={fieldsReadOnly}
                value={formData.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
              />
            </Field>

            <Field label="Contact Details During Leave">
              <textarea
                className="input"
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
              <p className="eyebrow">Approvers</p>
              <h3 className="m-0 text-sm font-semibold">Approver Details</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {approverRows.map(({ label, name }) => (
              <Field key={label} label={label}>
                <Input disabled value={name || (approverLoading ? "Loading..." : "Not assigned")} onChange={() => {}} />
              </Field>
            ))}

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
                min={formData.TRAVEL_DATE || undefined}
                value={formData.TRAVEL_END_DATE}
                onChange={(e) => handleChange("TRAVEL_END_DATE", e.target.value)}
              />
            </Field>

            <Field label="Air Route">
              <textarea
                className="input"
                rows={2}
                disabled={fieldsReadOnly}
                value={formData.AIR_ROUTE}
                onChange={(e) => handleChange("AIR_ROUTE", e.target.value)}
              />
            </Field>

            {data?.LAST_ACTION === "SENTBACK" && data?.SENTBACK_HISTORY !== "" && (
              <Field label="Send Back Remarks">
                <textarea className="input" rows={2} disabled value={data?.SENTBACK_HISTORY || ""} />
              </Field>
            )}

            {data?.LAST_ACTION === "REJECTED" && data?.CANCEL_REMARK !== "" && (
              <Field label="Reject Remarks">
                <textarea className="input" rows={2} disabled value={data?.CANCEL_REMARK || ""} />
              </Field>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="sticky bottom-0 z-10 mt-2 flex flex-col items-center justify-between gap-3 border-t bg-background py-3 sm:flex-row">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={viewMode || saving} onClick={() => handleSave("SAVEASDRAFT")}>
            <Save size={15} /> {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button type="button" size="sm" disabled={viewMode || saving} onClick={() => handleSave("SUBMITTED")}>
            <Send size={15} /> Submit
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

function parseCustomDate(dateString: any) {
  if (!dateString) return new Date(NaN);
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    const [day, month, year] = dateString.split("-");
    return new Date(`${year}-${month}-${day}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString);
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? new Date(NaN) : date;
}

export default LeaveResumptionForm;