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
  pay_unit: string;
  description: string;
  effective_from: string;
  absent_from_date: string;
  absent_to_date: string;
  no_of_days: number;
  amount: number;
  ref_leave_doc_no: string;
  is_canceled: boolean;
}

export interface AbsentHeaderData {
  doc_no: string;
  doc_date: string;
  doc_type: string;
  ref_no: string;
  employee_code: string;
  employee_name: string;
  name_from: string;
  addr_from: string;
  letter_subject: string;
  remarks1: string;
  remarks2: string;
  signatory_name: string;
  signatory_position: string;
  is_reversed: boolean;
}

export type AbsentProcessEditorState =
  | null
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: AbsentProcessRow };

export const emptyAbsentHeader = (): AbsentHeaderData => ({
  doc_no: "",
  doc_date: "",
  doc_type: "",
  ref_no: "",
  employee_code: "",
  employee_name: "",
  name_from: "",
  addr_from: "",
  letter_subject: "",
  remarks1: "",
  remarks2: "",
  signatory_name: "",
  signatory_position: "",
  is_reversed: false,
});

export const emptyAbsentRow = (serial_no: number): AbsentDetailRow => ({
  serial_no,
  pay_unit: "",
  description: "",
  effective_from: "",
  absent_from_date: "",
  absent_to_date: "",
  no_of_days: 0,
  amount: 0,
  ref_leave_doc_no: "",
  is_canceled: false,
});

// Re-exported so callers of this module don't need a second import for the division type.
export type { Division };