import type { Division } from "../../../api/transactions";

// TODO: replace with the real absent-process row shape once the backend contract is confirmed.
export interface AbsentProcessRow {
  doc_type: "ABSENT";
  doc_no: string;
  doc_date: string;
  doc_type_desc?: string;
  ref_no?: string;
  employee_code: string;
  employee_name?: string;
  name_from?: string;
  addr_from?: string;
  letter_subject?: string;
  remarks1?: string;
  remarks2?: string;
  signatory_name?: string;
  signatory_position?: string;
  div_code?: string;
  div_name?: string;
  total_amount?: number;
  total_days?: number;
  canceled?: string;
  status?: string;
}

export interface AbsentDetailRow {
  serial_no: number;
  employee_code: string;
  amount: number;
  allocated_amt: number;
  balance_amt: number;
  deduct_from_leave: string;
  deduct_noof_leavedays: number;
  ref_leave_doc_no: string | null;
  cancel_status: string | null;
  sys_gen?: string;
  pay_unit?: string;
  recover_from_dt?: Date | null;
}
export interface AbsentHeaderData {
  company_code: string;
  doc_no: number | string;
  doc_date: string;
  doc_type: string;
  ref_no: string;
  name_from: string;
  addr_from: string;
  name_to: string;
  addr_to: string;
  lettr_subject: string;
  remarks_1: string;
  remarks_2: string;
  remarks_3: string;
  signatory_name: string;
  signatory_position: string;
  employee_code: string;
  request_number: string;
  next_action_by: string;
  doc_status: string;
  is_reversed?: boolean;
}

export type AbsentProcessEditorState =
  | null
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: AbsentProcessRow };

export function emptyAbsentHeader(): AbsentHeaderData {
  return {
    company_code: "",
    doc_no: "",
    doc_date: "",
    doc_type: "ABM",
    ref_no: "",
    name_from: "",
    addr_from: "",
    name_to: "",
    addr_to: "",
    lettr_subject: "",
    remarks_1: "",
    remarks_2: "",
    remarks_3: "",
    signatory_name: "",
    signatory_position: "",
    employee_code: "",
    request_number: "",
    next_action_by: "",
    doc_status: "P",
    is_reversed: false,
  };
}


export function emptyAbsentRow(serial: number): AbsentDetailRow {
  return {
    serial_no: serial,
    employee_code: "",
    amount: 0,
    allocated_amt: 0,
    balance_amt: 0,
    deduct_from_leave: "N",
    deduct_noof_leavedays: 0,
    ref_leave_doc_no: "",
    cancel_status: null,
  };
}



// Re-exported so callers of this module don't need a second import for the division type.
export type { Division };