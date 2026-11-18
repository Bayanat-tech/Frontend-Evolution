import type { TEmployeeHr } from "./employee-hr.types";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date(0);
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  return toDate(value);
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export function mapEmployeeHr(row: Record<string, unknown>): TEmployeeHr {
  return {
    // TPersnolHr
    company_code: text(row.company_code ?? row.COMPANY_CODE),
    employer_code: text(row.employer_code ?? row.EMPLOYER_CODE),
    section_code: text(row.section_code ?? row.SECTION_CODE),
    dept_code: text(row.dept_code ?? row.DEPT_CODE),
    div_code: text(row.div_code ?? row.DIV_CODE),
    emp_photo: text(row.emp_photo ?? row.EMP_PHOTO),
    employee_id: text(row.employee_id ?? row.EMPLOYEE_ID),
    employee_code: text(row.employee_code ?? row.EMPLOYEE_CODE),
    alternate_id: text(row.alternate_id ?? row.ALTERNATE_ID),
    rpt_name: text(row.rpt_name ?? row.RPT_NAME),
    grade_code: text(row.grade_code ?? row.GRADE_CODE),
    desg_code: text(row.desg_code ?? row.DESG_CODE),
    labour_desg_code: text(row.labour_desg_code ?? row.LABOUR_DESG_CODE),
    category_code: text(row.category_code ?? row.CATEGORY_CODE),
    birth_date: toDate(row.birth_date ?? row.DOB),
    join_date: toDate(row.join_date ?? row.JOIN_DATE),
    probation_end_date: toDate(row.probation_end_date ?? row.PROBATION_END_DATE),
    probation_confirm_date: toDate(row.probation_confirm_date ?? row.PROBATION_CONFIRM_DATE),
    emp_status: text(row.emp_status ?? row.EMP_STATUS),
    country_code: text(row.country_code ?? row.PPT_COUNTRY),

    // TPayrollHr
    include_in_payroll: text(row.include_in_payroll ?? row.INCLUDE_IN_PAYROLL),
    payroll_start_date: toDate(row.payroll_start_date ?? row.COMP_PAYROLL_DATE),
    payment_mode: text(row.payment_mode ?? row.PAYMENT_MODE),
    company_bank_code: text(row.company_bank_code ?? row.COMPANY_BANK_CODE),
    salary_acct_no: text(row.salary_acct_no ?? row.SALARY_ACCT_NO),
    salary_bank_code: text(row.salary_bank_code ?? row.SALARY_BANK_CODE),
    currency_id: text(row.currency_id ?? row.CURR_CODE),
    exch_rate: num(row.exch_rate ?? row.EX_RATE),
    emp_iban_no: text(row.emp_iban_no ?? row.IBAN_NO),

    // TPassportHr
    ppt_no: text(row.ppt_no ?? row.PASSPORT_NO),
    ppt_name: text(row.ppt_name ?? row.PASSPORT_NAME),
    ppt_country: text(row.ppt_country ?? row.PPT_COUNTRY),
    ppt_status: text(row.ppt_status ?? row.PPT_STATUS),
    ppt_valid_from: toDate(row.ppt_valid_from ?? row.PPT_VALID_FROM),
    ppt_valid_to: toDate(row.ppt_valid_to ?? row.PPT_VALID_TO),
    passport_with: text(row.passport_with ?? row.PPT_WITH),

    // TContractHr
    contract_type: text(row.contract_type ?? row.CONTRACT_TYPE),
    contract_start_date: toDate(row.contract_start_date ?? row.CONTRACT_START_DATE),
    contract_end_date: toNullableDate(row.contract_end_date ?? row.CONTRACT_END_DATE),
    contract_renewable: text(row.contract_renewable ?? row.CONTRACT_RENEW),
    contract_type_desc: text(row.contract_type_desc ?? row.CONTRACT_TYPE_DESC),

    // TSponsorHr
    sponsor_id: text(row.sponsor_id ?? row.SPONSOR_ID),
    visa_type: text(row.visa_type ?? row.SPONSOR_VISA_TYPE),
    visa_valid_from: toDate(row.visa_valid_from ?? row.SPONSOR_VISA_FROM_DT),
    visa_valid_to: toNullableDate(row.visa_valid_to ?? row.SPONSOR_VISA_TO_DT),

    // TIsuranceHr
    ins_card_no: text(row.ins_card_no ?? row.INS_CARD_NO),
    ins_card_issue_dt: toDate(row.ins_card_issue_dt ?? row.INS_CARD_ISSUE_DT),
    ins_card_exp_dt: toDate(row.ins_card_exp_dt ?? row.INS_CARD_EXP_DT),
    ins_card_type: text(row.ins_card_type ?? row.INS_CARD_TYPE),

    // TILPHr
    labourcard_no: text(row.labourcard_no ?? row.LABOUR_CARD_NO),
    pasi_no: text(row.pasi_no ?? row.PASI_NO),
    labourcard_valid_from: toDate(row.labourcard_valid_from),
    labourcard_valid_to: toDate(row.labourcard_valid_to),
    labourcard_status: text(row.labourcard_status),

    // TAirfareHr
    airport_code: text(row.airport_code ?? row.AIRPORT_CODE),
    ticket_eligibility: text(row.ticket_eligibility),
    ticket_dpend_adult: num(row.ticket_dpend_adult ?? row.ADULT_FARE),
    ta_no: num(row.ta_no),
    tc_no: num(row.tc_no),
    ti_no: num(row.ti_no),
    ticket_eligible_period: num(row.ticket_eligible_period),

    actions: undefined,
  };
}