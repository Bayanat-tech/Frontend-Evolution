export type TLeaveApproval = {
  SUPERVISOR: string;
  EMPLOYEE_NAME: string;
  DIVISION_HEAD: string;
  REQUEST_NUMBER: string;
  REQUEST_DATE: string;
  EMPLOYEE_CODE: string;
  LEAVE_TYPE: string;
  LEAVE_START_DATE: string;
  LEAVE_END_DATE: string;
  RESUME_DATE?: string;
  LEAVE_DAYS?: number;
  REMARKS?: string;
  CREATED_BY: string;
  COMPANY_CODE: string;
  UPDATED_BY: string;
  LAST_ACTION?: string;
  alternate_id?: string;
  HOD?: string;
  IMMEDIATE_SUPERVISOR?: string;
  DEPT_HEAD?: string;
  LEAVE_ALLOWANCE?: number;
  ADV_PAYMENT?: number;
  CAUSE_TYPE?: string;
  TRAVEL_DATE?: string;
  TRAVEL_END_DATE?: string;
  NAME_OF_REPLACEMENT?: string;
  CONTACT_DETAILS_DURING_LEAVE?: string;
  EMPLOYEE_ID?: string;
  // Add the new properties
  LEAVE_DOC_NO?: string;
  RESUME_WORK?: boolean;
  ACTUAL_RESUME_DATE?: string;
  DUTY_RESUMED_ON?: string;
  LEAVE_REQUEST_DATE?: string;
  EMPLOYEE_NAME_DISPLAY?: string; 
  NEXT_ACTION_BY_NAME?: string; 
  LEAVE_TYPE_DESC?: string; 
  FINAL_APPROVED?: string;
  DUTY_RESUME_DATE?: string;
  SENTBACK_HISTORY?: string;
  HALF_DAY?: boolean;
  NEXT_ACTION_BY?: string;
  CANCEL_REMARK?: string;
  AIR_ROUTE?: string;
  AIR_TICKET?: string;
  IMMEDIATE_SUPERVISOR_NAME: string;
  HOD_NAME: string;
  DEPT_HEAD_NAME: string;
};


export interface IHrEmployee {
  EMAIL: any;
  IMMEDIATE_SUPERVISOR: any;
  DEPT_HEAD: any;
  HOD: any;
  SUPERVISOR_EMPID: any;
  DEPT_HEAD_EMPID: any;
  MANGR_EMPID: any;
  EMPLOYEE_ID: string;
  EMPLOYEE_CODE: string;
  ALTERNATE_ID: string;
  RPT_NAME: string;
  SUPERVISOR_NAME?: string;
  DEPT_HEAD_NAME?: string;
  MANAGER_NAME?: string;
}

export interface ILeaveHistory {
  COMPANY_CODE: string;
  COMPANY_NAME: string;
  DIV_CODE: string;
  DIV_NAME: string;
  DEPT_CODE: string;
  DEPT_NAME: string;
  EMP_STATUS: string;
  SECTION_CODE: string;
  SECTION_NAME: string;
  EMPLOYEE_ID: string;
  EMPLOYEE_CODE: string;
  ALTERNATE_ID: string;
  RPT_NAME: string;
  LEAVE_REQUEST_DATE: string;
  HDR_LVE_SLNO: number;
  LVE_DOC_NO: string;
  LEAVE_TYPE: string;
  LEAVE_TYPE_DESC: string;
  DOC_TYPE: string;
  LEAVE_START_DATE: string;
  LEAVE_END_DATE: string;
  LEAVE_DAYS: number;
  HALF_DAY: string;
  REQ_LEAVE_FROM_DT: string;
  REQ_LEAVE_TO_DT: string;
  APPROVAL_STATUS: string;
  VERIFIED_STATUS: string;
  APPROVED_ON: string;
  APPROVED_BY: any;
  VERIFIED_ON: string;
  VERIFIED_BY: string;
  CANCEL_DATE: any;
  CANCELLD_BY: any;
  ACTUAL_RESUME_DATE: string;
  DUTY_RESUME_DATE: string;
  RESUME_APPROVED_BY: any;
}

interface ILeaveHistoryParams {
  employeeId: string;
  leaveType?: string;
  leaveStartDateFrom?: string;
  leaveEndDateTo?: string;
}

export interface IValidateLeaveParams {
  companyCode: string;
  employeeId: string;
  leaveStartDate: string;
  leaveEndDate: string;
  leaveType: string;
  leaveDays: number;
}

export interface IValidateLeaveResponse {
  validationResult: any;

  success: boolean;
  isValid: boolean;
  message?: string;
  validationErrors?: string[];
  availableBalance?: number;
  requiredBalance?: number;
  overlappingLeaves?: Array<{
    leaveDocNo: string;
    leaveType: string;
    startDate: string;
    endDate: string;
  }>;
}
export interface ILeaveDaysParams {
  leaveStartDate: string ;
  leaveEndDate: string;
  leaveType?: string;
  company_code: string;
  employee_code: string;
}