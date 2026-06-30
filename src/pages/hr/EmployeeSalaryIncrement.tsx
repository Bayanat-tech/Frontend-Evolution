import { useState, useCallback } from "react";
import { DynamicDropDown } from "./api/DynamicDropDown";
import { useAuth } from "../../state/AuthContext";
import { LookupRow } from "../../api/lookups";

interface EmployeeDetailState {
  div_code: string;
  div_name: string;

  dept_code: string;
  dept_name: string;

  section_code: string;
  section_name: string;

  emp_id: string;     // matches "employee_id" -> the dropdown's valueField
  emp_code: string;   // matches "employee_code" -> a secondary display field
  emp_name: string;   // matches "rpt_name"
}

const EMPTY_STATE: EmployeeDetailState = {
  div_code: "",
  div_name: "",
  dept_code: "",
  dept_name: "",
  section_code: "",
  section_name: "",
  emp_id: "",
  emp_code: "",
  emp_name: "",
};

export default function EmployeeSalaryIncrement() {
  const { user } = useAuth();

  const [employeeDetail, setEmployeeDetail] =
    useState<EmployeeDetailState>(EMPTY_STATE);

  // ---------- DIVISION ----------
  // Fires on both select AND clear (value === "", row === null).
  // Clearing division must cascade-reset dept, section, and employee.
  const handleDivisionChange = useCallback(
    (value: string, row: LookupRow | null) => {
      setEmployeeDetail((prev) => ({
        ...prev,
        div_code: value,
        div_name: row ? String(row.div_name ?? "") : "",
        // cascade reset — division changed/cleared, everything below is invalid
        dept_code: "",
        dept_name: "",
        section_code: "",
        section_name: "",
        emp_id: "",
        emp_code: "",
        emp_name: "",
      }));
    },
    []
  );

  // ---------- DEPARTMENT ----------
  const handleDepartmentChange = useCallback(
    (value: string, row: LookupRow | null) => {
      setEmployeeDetail((prev) => ({
        ...prev,
        dept_code: value,
        dept_name: row ? String(row.dept_name ?? "") : "",
        // cascade reset — department changed/cleared
        section_code: "",
        section_name: "",
        emp_id: "",
        emp_code: "",
        emp_name: "",
      }));
    },
    []
  );

  // ---------- SECTION ----------
  const handleSectionChange = useCallback(
    (value: string, row: LookupRow | null) => {
      setEmployeeDetail((prev) => ({
        ...prev,
        section_code: value,
        section_name: row ? String(row.section_name ?? "") : "",
        // cascade reset — section changed/cleared
        emp_id: "",
        emp_code: "",
        emp_name: "",
      }));
    },
    []
  );

  // ---------- EMPLOYEE ----------
  // User is allowed to pick employee FIRST (before division/dept/section).
  // On select: sync div/dept/section from the row, when those fields exist on it.
  // On clear: only reset employee fields, leave div/dept/section as-is.
  const handleEmployeeChange = useCallback(
    (value: string, row: LookupRow | null) => {
      setEmployeeDetail((prev) => {
        if (!row) {
          return {
            ...prev,
            emp_id: "",
            emp_code: "",
            emp_name: "",
          };
        }

        const rowDiv = row.div_code != null ? String(row.div_code) : "";
        const rowDept = row.dept_code != null ? String(row.dept_code) : "";
        const rowSection =
          row.section_code != null ? String(row.section_code) : "";

        const divChanged = rowDiv !== "" && rowDiv !== prev.div_code;
        const deptChanged = rowDept !== "" && rowDept !== prev.dept_code;
        const sectionChanged =
          rowSection !== "" && rowSection !== prev.section_code;

        return {
          ...prev,
          emp_id: value, // employee_id (the dropdown's valueField)
          emp_code: String(row.employee_code ?? ""),
          emp_name: String(row.rpt_name ?? ""),

          div_code: rowDiv || prev.div_code,
          div_name: divChanged
            ? String(row.div_name ?? "")
            : rowDiv
            ? prev.div_name
            : prev.div_name,

          dept_code: rowDept || prev.dept_code,
          dept_name: deptChanged
            ? String(row.dept_name ?? "")
            : rowDept
            ? prev.dept_name
            : prev.dept_name,

          section_code: rowSection || prev.section_code,
          section_name: sectionChanged
            ? String(row.section_name ?? "")
            : rowSection
            ? prev.section_name
            : prev.section_name,
        };
      });
    },
    []
  );

  return (
    <div className="h-screen w-full">
      <div className="w-full h-1/6 m-1 border">
        <DynamicDropDown
          type="division"
          value={employeeDetail.div_code}
          displayName={employeeDetail.div_name}
          onChange={handleDivisionChange}
          code1={user?.company_code}
          key = {`division-${employeeDetail.div_code}-${Date.now()}`}
        />

        <DynamicDropDown
          type="departmentBasedOnDivision"
          value={employeeDetail.dept_code}
          displayName={employeeDetail.dept_name}
          onChange={handleDepartmentChange}
          code1={user?.company_code}
          code2={employeeDetail.div_code}
          disabled={!employeeDetail.div_code}
          key = {`department-${employeeDetail.div_code}-${employeeDetail.dept_code}-${Date.now()}`}
        />

        <DynamicDropDown
          type="section"
          value={employeeDetail.section_code}
          displayName={employeeDetail.section_name}
          onChange={handleSectionChange}
          required
          disabled={!employeeDetail.dept_code}
          key = {`section-${employeeDetail.div_code}-${employeeDetail.dept_code}-${employeeDetail.section_code}-${Date.now()}`}
        />

        <DynamicDropDown
          type="employee"
          value={employeeDetail.emp_id}
          displayName={employeeDetail.emp_name}
          onChange={handleEmployeeChange}
          code1={employeeDetail.div_code || undefined}
          code2={employeeDetail.dept_code || undefined}
          code3={employeeDetail.section_code || undefined}
          required
          key = {`employee-${employeeDetail.div_code}-${employeeDetail.dept_code}-${employeeDetail.section_code}-${employeeDetail.emp_id}-${Date.now()}`}
        />
      </div>

      <div className="w-full h-2/6 m-1 border"></div>
      <div className="w-full h-3/6 m-1 border"></div>
    </div>
  );
}