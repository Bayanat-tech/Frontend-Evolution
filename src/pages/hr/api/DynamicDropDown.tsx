// components/dropdowns/DynamicDropDown.tsx
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDynamicLookup, LookupRow } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";

export type DropDownType =
  | "division"
  | "department"
  | "departmentBasedOnDivision"
  | "section"
  | "employee"
  | "dddwIncrementStatus"
  | "dddwYesNoFlag"
  | "dddwStatusFlag"
  | "payComponent"
  | "grade";

interface DropDownConfig {
  parameterCode: string;
  label: string;
  valueField: string;
  displayField: string;
  columns: { field: string; header: string }[];
}

// Add a new dropdown by adding ONE entry here — nothing else changes.
const DROPDOWN_CONFIG: Record<DropDownType, DropDownConfig> = {
  grade:{
    parameterCode: "GRADE_SALARY_INCREMENT_GRADE_DROP_DOWN",
    label: "Grade",
    valueField: "code",
    displayField: "name",
    columns: [
      { field: "code", header: "Code" },
      { field: "name", header: "Name" },
    ],
  },
  payComponent: {
    parameterCode: "EMPLOYEE_SALARY_INCREMENT_DDDW_PAY_COMPONENT", // confirm/adjust name
    label: "Pay Unit",
    valueField: "code",
    displayField: "name",
    columns: [
      { field: "code", header: "Code" },
      { field: "name", header: "Name" },
    ],
  },
  division: {
    parameterCode: "DROP_DOWN_DIVISION",
    label: "Division",
    valueField: "div_code",
    displayField: "div_name",
    columns: [
      { field: "div_code", header: "Code" },
      { field: "div_name", header: "Name" },
    ],
  },
  department: {
    parameterCode: "DROP_DOWN_DEPT_BASED_ON_DIV",
    label: "Department",
    valueField: "dept_code",
    displayField: "dept_name",
    columns: [
      { field: "dept_code", header: "Code" },
      { field: "dept_name", header: "Name" },
    ],
  },
  departmentBasedOnDivision: {
    parameterCode: "DROP_DOWN_DEPT_BASED_ON_DIV",
    label: "Department",
    valueField: "dept_code",
    displayField: "dept_name",
    columns: [
      { field: "dept_code", header: "Code" },
      { field: "dept_name", header: "Name" },
    ],
  },
  section: {
    parameterCode: "HR_LEAVE_ENCASHMENT_SECTION_DROP_DOWN",
    label: "Section",
    valueField: "section_code",
    displayField: "section_name",
    columns: [
      { field: "section_code", header: "Code" },
      { field: "section_name", header: "Name" },
    ],
  },
  employee: {
    parameterCode: "HR_LEAVE_ENCASHMENT_EMPLOYEE_DROP_DOWN",
    label: "Employee",
    valueField: "employee_id",
    displayField: "rpt_name",
    columns: [
      { field: "employee_id", header: "ID" },
      { field: "employee_code", header: "Code" },
      { field: "rpt_name", header: "Name" },
    ],
  },
  dddwIncrementStatus: {
    parameterCode: "EMPLOYEE_SALARY_INCREMENT_DDDW_INCREMENT_STATUS",
    label: "Increment Status",
    valueField: "value_code",
    displayField: "value_desc",
    columns: [
      { field: "value_code", header: "Code" },
      { field: "value_desc", header: "Name" },
    ],
  },
  dddwYesNoFlag: {
    parameterCode: "EMPLOYEE_SALARY_INCREMENT_DDDW_YES_NO_FLAG",
    label: "Yes/No",
    valueField: "code",
    displayField: "name",
    columns: [
      { field: "code", header: "Code" },
      { field: "name", header: "Name" },
    ],
  },
  dddwStatusFlag: {
    parameterCode: "EMPLOYEE_SALARY_INCREMENT_DDDW_STATUS_FLAG",
    label: "Status",
    valueField: "value_code",
    displayField: "value_desc",
    columns: [
      { field: "value_code", header: "Code" },
      { field: "value_desc", header: "Name" },
    ],
  },
};

interface DynamicDropDownProps {
  type: DropDownType;
  value: string;
  displayName: string;
  onChange: (value: string, row: LookupRow | null) => void;
  required?: boolean;
  label?: string;
  code1?: string;
  code2?: string;
  code3?: string;
  code4?: string;
  disabled?: boolean;
  key?: string 
}

export function DynamicDropDown({
  type,
  value,
  displayName,
  onChange,
  required,
  label,
  code1,
  code2,
  code3,
  code4,
  disabled,
  key
}: DynamicDropDownProps) {
  const config = DROPDOWN_CONFIG[type];
  const queryClient = useQueryClient();

  const loadOptions = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: [
          "dynamicLookup",
          config.parameterCode,
          code1 ?? "",
          code2 ?? "",
          code3 ?? "",
          code4 ?? "",
          Date.now(), 
          key
        ],
        queryFn: () =>
          getDynamicLookup({
            parameter: config.parameterCode,
            code1: code1 ?? "",
            code2: code2 ?? "",
            code3: code3 ?? "",
            code4: code4 ?? "",
          }),
        staleTime: 0,
        gcTime: 0,
      });
      return (data ?? []) as LookupRow[];
    } catch (error) {
      console.error(`Error fetching dropdown data for "${type}":`, error);
      return [];
    }
  }, [queryClient, config.parameterCode, type, code1, code2, code3, code4]);

  return (
    <LookupField
      label={label ?? config.label}
      value={value}
      displayValue={displayName}
      columns={config.columns}
      valueField={config.valueField}
      displayFields={[config.valueField, config.displayField]}
      loadOptions={loadOptions}
      onChange={onChange}
      required={required}
      disabled={disabled}
    />
  );
}