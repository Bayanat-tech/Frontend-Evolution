export interface TEmployeeDetails {
  // Identifiers / org (display-only — no add/assign flow here)
  employee_id: string;
  alternate_id: string;
  employee_code: string;
  company_code?: string;
  rpt_name?: string;
  div_code?: string;
  dept_code?: string;
  section_code?: string;
  employer_code: string;

  // Name
  title: string;
  first_name: string;
  second_name: string;
  third_name: string;
  fourth_name: string;
  last_name: string;
  family_name: string;
  alias_name: string;

  // Personal
  gender: string;
  birth_date: Date | null;
  birth_place: string;
  father_name: string;
  mother_name: string;
  marrital_status: string;
  spouse_name: string;
  no_of_children: number;
  blood_group: string;
  nationality: string;
  religion_code: string;
  caste_code: string;
  country_code: string;
  country_living_in: string;

  // Passport
  ppt_name: string;
  ppt_no: string;
  ppt_country: string;
  ppt_valid_from: Date | null;
  ppt_valid_to: Date | null;
  ppt_status: string;
  passport_with: string;

  // Contact
  phone_office: string;
  phone_office_extn: string;
  mobile_no: string;
  mobile_no2: string;
  email_official: string;
  email_personal: string;

  // Permanent address
  perm_address1: string;
  perm_address2: string;
  perm_address3: string;
  perm_phone: string;
  perm_mobile: string;

  // Local address
  local_address1: string;
  local_address2: string;
  local_address3: string;
  local_phone: string;
  local_mobile: string;

  // Emergency address
  emgr_address1: string;
  emgr_address2: string;
  emgr_address3: string;
  emgr_phone: string;
  emgr_mobile: string;
  emgr_contact_person: string;

  // Driving licence
  driving_license_no: string;
  dl_issue_place: string;
  dl_issue_date: Date | null;
  dl_valid_upto: Date | null;

  // Employment / misc
  emp_status: string;
  ot_applicable: string;
  health_expiry: Date | null;
  dept_head_emp_id: string;
  supervisor_empid: string;
  manager_code: string;

  // Audit (display-only)
  user_id: string;
  user_dt: Date | null;

  actions?: undefined;
}

export type TEmployeeDetailsUpdatePayload = Partial<{
  [K in keyof TEmployeeDetails as Uppercase<K & string>]: TEmployeeDetails[K];
}>;