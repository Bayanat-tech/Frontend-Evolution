import { MdAddCircleOutline } from "react-icons/md";
import { RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { ColumnDef } from "@tanstack/react-table";
import hrEmpDependantsServiceInstance from "./Upserthrempdependants";


// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string;     div_name: string };
type DeptOption     = { dept_code: string;    dept_name: string };
type SectionOption  = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string;  employee_name: string };
type RelationOption = { rel_code: string;     rel_desc: string };
type TicketTypeOption = { ttype_code: string; ttype_desc: string };
type StatusOption   = { value_code: string;   value_desc: string };

const MARITAL_STATUS_OPTIONS: { code: string; label: string }[] = [
  { code: "S", label: "Single" },
  { code: "M", label: "Married" },
];

const YES_NO_OPTIONS: { code: string; label: string }[] = [
  { code: "Y", label: "Yes" },
  { code: "N", label: "No" },
];

const BLOOD_GROUP_OPTIONS: { code: string; label: string }[] = [
  { code: "A+",  label: "A+"  },
  { code: "A-",  label: "A-"  },
  { code: "B+",  label: "B+"  },
  { code: "B-",  label: "B-"  },
  { code: "O+",  label: "O+"  },
  { code: "O-",  label: "O-"  },
  { code: "AB+", label: "AB+" },
  { code: "AB-", label: "AB-" },
];

type DependantRow = {
  _rowId:             string;
  _isPersisted:       boolean;
  dep_serial_number:  string;
  dep_relation:       string;
  dep_relation_desc:  string;
  dep_name:           string;
  dep_dob:            string;
  dep_sponsored_by:   string;
  ticket_eligibility: string;
  ticket_type:        string;
  marstat:            string;
  medical_eligible:   string;
  dep_blood_group:    string;
  status_flag:        string;
  remarks:            string;
  ppt_card:           string;
  res_card:           string;
  ppt_valid_from:     string;
  ppt_valid_to:       string;
  res_valid_from:     string;
  res_valid_to:       string;
  ins_card_no:        string;
  ins_card_type:      string;
  ins_card_issue_dt:  string;
  isn_card_exp_dt:    string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(): DependantRow {
  return {
    _rowId:             `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _isPersisted:       false,
    dep_serial_number:  "",
    dep_relation:       "",
    dep_relation_desc:  "",
    dep_name:           "",
    dep_dob:            "",
    dep_sponsored_by:   "",
    ticket_eligibility: "",
    ticket_type:        "",
    marstat:            "",
    medical_eligible:   "",
    dep_blood_group:    "",
    status_flag:        "A",
    remarks:            "",
    ppt_card:           "",
    res_card:           "",
    ppt_valid_from:     "",
    ppt_valid_to:       "",
    res_valid_from:     "",
    res_valid_to:       "",
    ins_card_no:        "",
    ins_card_type:      "",
    ins_card_issue_dt:  "",
    isn_card_exp_dt:    "",
  };
}

function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = "",
) {
  return {
    parameter,
    loginid,
    code1:   companyCode,
    code2,
    code3,
    code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

// ── Inline editable text cell ─────────────────────────────────────────────────

function EditableTextCell({
  initialValue,
  onBlur,
}: {
  initialValue: string;
  onBlur: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.value = initialValue ?? "";
  }, [initialValue]);

  return (
    <Input
      ref={ref}
      type="text"
      defaultValue={initialValue}
      onBlur={(e) => onBlur(e.target.value)}
    />
  );
}

// ── Inline editable date cell ─────────────────────────────────────────────────

function EditableDateCell({
  initialValue,
  onBlur,
}: {
  initialValue: string;
  onBlur: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.value = initialValue ?? "";
  }, [initialValue]);

  return (
    <Input
      ref={ref}
      type="date"
      defaultValue={initialValue}
      onBlur={(e) => onBlur(e.target.value)}
    />
  );
}

// ── Inline editable select cell ───────────────────────────────────────────────

function EditableSelectCell({
  value,
  options,
  disabled = false,
  onChange,
}: {
  value:     string;
  options:   { code: string; label: string }[];
  disabled?: boolean;
  onChange:  (value: string) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HrEmpDependantsPage() {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const loginid     = user?.loginid      ?? "";
  const companyCode = user?.company_code ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [division,   setDivision]   = useState<DivisionOption | null>(null);
  const [department, setDepartment] = useState<DeptOption     | null>(null);
  const [section,    setSection]    = useState<SectionOption  | null>(null);
  const [employee,   setEmployee]   = useState<EmployeeOption | null>(null);

  // ── Grid / notice state ────────────────────────────────────────────────────
  const [rows,   setRows]   = useState<DependantRow[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [resetKey, setResetKey] = useState(0);

  const skipHydrateForEmployeeRef = useRef<string | null>(null);

  // ── Master data — relations, ticket types, status ──────────────────────────
  const { data: relationOpts = [] } = useQuery<RelationOption[]>({
    queryKey: ["hr-dependants-relation", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_RELATION_SELECT", loginid, companyCode),
      );
      return res as RelationOption[];
    },
  });

  const { data: ticketTypeOpts = [] } = useQuery<TicketTypeOption[]>({
    queryKey: ["hr-dependants-ticket-type", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("HR_EMP_DEPENDANTS_TICKET_TYPE_SELECT", loginid, companyCode),
      );
      return res as TicketTypeOption[];
    },
  });

  const { data: statusOpts = [] } = useQuery<StatusOption[]>({
    queryKey: ["hr-dependants-status", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("HR_EMP_DEPENDANTS_STATUS_SELECT", loginid, companyCode),
      );
      return res as StatusOption[];
    },
  });

  // ── Division / Department / Section / Employee dropdown data ───────────────
  const { data: divisionOpts = [] } = useQuery<DivisionOption[]>({
    queryKey: ["hr-dependants-division", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST", loginid, companyCode),
      );
      return res as DivisionOption[];
    },
  });

  const { data: departmentOpts = [] } = useQuery<DeptOption[]>({
    queryKey: ["hr-dependants-department", companyCode, division?.div_code],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
          loginid,
          companyCode,
          division?.div_code ?? "",
        ),
      );
      return res as DeptOption[];
    },
  });

  const { data: sectionOpts = [] } = useQuery<SectionOption[]>({
    queryKey: ["hr-dependants-section", companyCode, division?.div_code, department?.dept_code],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
        ),
      );
      return res as SectionOption[];
    },
  });

  const { data: employeeOpts = [] } = useQuery<EmployeeOption[]>({
    queryKey: [
      "hr-dependants-employee",
      companyCode,
      division?.div_code,
      department?.dept_code,
      section?.section_code,
    ],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          loginid,
          companyCode,
          division?.div_code    ?? "", // code2 = DIVISION
          department?.dept_code ?? "", // code3 = DEPARTMENT
          section?.section_code ?? "", // code4 = SECTION
        ),
      );
      return (Array.isArray(res) ? res : []).map((r: Record<string, unknown>) => ({
        employee_id:   String(r.employee_id ?? ""),
        // Guard both rpt_name and employee_name — the API may return
        // either depending on the lookup.
        employee_name: String(r.employee_name ?? r.rpt_name ?? ""),
      })) as EmployeeOption[];
    },
  });




    // ── Lookup loaders for LookupField ────────────────────────────────────────

  const loadDivisions = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_LANG_DIVISION_LIST",
          loginid,
          companyCode,
        ),
      ),
    [loginid, companyCode],
  );

  const loadDepartments = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
          loginid,
          companyCode,
          division?.div_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code],
  );

  const loadSections = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
        ),
      ),
    [
      loginid,
      companyCode,
      division?.div_code,
      department?.dept_code,
    ],
  );

  const loadEmployees = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
          section?.section_code ?? "",
        ),
      ),
    [
      loginid,
      companyCode,
      division?.div_code,
      department?.dept_code,
      section?.section_code,
    ],
  );

  // ── Dependant data for the selected employee ────────────────────────────────
  const dependantsQuery = useQuery({
    queryKey: ["dependants-data", employee?.employee_id],
    enabled:  !!employee?.employee_id,
    // Always treat cached data as stale on (re)enable, so re-selecting the
    // same employee after a Refresh reliably triggers a real network fetch
    // instead of silently reusing a previous result.
    refetchOnMount: "always",
    queryFn:  async () => {
      const currentEmployeeId = employee?.employee_id ?? "";
      const res = await getDynamicLookup(
        buildParams(
          "HR_EMP_DEPENDANTS_SELECT",
          loginid,
          companyCode,
          currentEmployeeId,
        ),
      );
      const data: DependantRow[] = (Array.isArray(res) ? res : []).map(
        (r: Record<string, unknown>, i: number) => ({
          _rowId:             `row_${i}`,
          _isPersisted:       true,
          dep_serial_number:  String(r.dep_serial_number  ?? ""),
          dep_relation:       String(r.dep_relation        ?? ""),
          dep_relation_desc:  String(r.dep_relation_desc   ?? ""),
          dep_name:           String(r.dep_name            ?? ""),
          dep_dob:            String(r.dep_dob             ?? ""),
          dep_sponsored_by:   String(r.dep_sponsored_by    ?? ""),
          ticket_eligibility: String(r.ticket_eligibility  ?? ""),
          ticket_type:        String(r.ticket_type         ?? ""),
          marstat:            String(r.marstat             ?? ""),
          medical_eligible:   String(r.medical_eligible    ?? ""),
          dep_blood_group:    String(r.dep_blood_group     ?? ""),
          status_flag:        String(r.status_flag         ?? "A"),
          remarks:            String(r.remarks             ?? ""),
          ppt_card:           String(r.ppt_card            ?? ""),
          res_card:           String(r.res_card            ?? ""),
          ppt_valid_from:     String(r.ppt_valid_from      ?? ""),
          ppt_valid_to:       String(r.ppt_valid_to        ?? ""),
          res_valid_from:     String(r.res_valid_from      ?? ""),
          res_valid_to:       String(r.res_valid_to        ?? ""),
          ins_card_no:        String(r.ins_card_no         ?? ""),
          ins_card_type:      String(r.ins_card_type       ?? ""),
          ins_card_issue_dt:  String(r.ins_card_issue_dt   ?? ""),
          isn_card_exp_dt:    String(r.isn_card_exp_dt     ?? ""),
        }),
      );

      // Only skip hydration if this fetch is for the SAME employee the skip
      // was set for. Any other employee's fetch always hydrates normally.
      if (
        skipHydrateForEmployeeRef.current !== null &&
        skipHydrateForEmployeeRef.current === currentEmployeeId
      ) {
        skipHydrateForEmployeeRef.current = null;
      } else {
        setRows(data);
      }
      return data;
    },
  });

  useEffect(() => {
    setDepartment(null);
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, [division]);

  useEffect(() => {
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, [department]);

  useEffect(() => {
    setEmployee(null);
    setRows([]);
  }, [section]);

  useEffect(() => {
    if (!employee) setRows([]);
  }, [employee]);

  // ── Row update helpers ─────────────────────────────────────────────────────
  const updateRowSelect = useCallback(
    (rowId: string, field: keyof DependantRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r._rowId !== rowId) return r;
          if (field === "dep_relation") {
            const opt = relationOpts.find((x) => x.rel_code === value);
            return { ...r, dep_relation: value, dep_relation_desc: opt?.rel_desc ?? "" };
          }
          return { ...r, [field]: value };
        }),
      );
    },
    [relationOpts],
  );

  const updateRowText = useCallback(
    (rowId: string, field: keyof DependantRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) =>
      prev
        .map((r) =>
          r._rowId === rowId && r._isPersisted
            ? { ...r, status_flag: "D" }
            : r,
        )
        .filter((r) => !(r._rowId === rowId && !r._isPersisted)),
    );
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((r) => r.status_flag !== "D"),
    [rows],
  );

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<DependantRow>[]>(
    () => [
      {
        id:     "index",
        header: "SlNo",
        size:   60,
        cell:   ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "dep_name",
        header:      "Dependant Name *",
        size:        200,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.dep_name}
            onBlur={(v) => updateRowText(row.original._rowId, "dep_name", v)}
          />
        ),
      },
      {
        accessorKey: "dep_relation",
        header:      "Relation *",
        size:        180,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.dep_relation}
            options={relationOpts.map((o) => ({
              code:  o.rel_code,
              label: o.rel_desc,
            }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "dep_relation", v)}
          />
        ),
      },
      {
        accessorKey: "dep_dob",
        header:      "Date of Birth",
        size:        150,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.dep_dob}
            onBlur={(v) => updateRowText(row.original._rowId, "dep_dob", v)}
          />
        ),
      },
      {
        accessorKey: "marstat",
        header:      "Marital Status",
        size:        140,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.marstat}
            options={MARITAL_STATUS_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "marstat", v)}
          />
        ),
      },
      {
        accessorKey: "ticket_eligibility",
        header:      "Ticket Eligible",
        size:        130,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.ticket_eligibility}
            options={YES_NO_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "ticket_eligibility", v)}
          />
        ),
      },
      {
        accessorKey: "ticket_type",
        header:      "Ticket Type",
        size:        160,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.ticket_type}
            options={ticketTypeOpts.map((o) => ({
              code:  o.ttype_code,
              label: o.ttype_desc,
            }))}
            disabled={row.original.ticket_eligibility !== "Y"}
            onChange={(v) => updateRowSelect(row.original._rowId, "ticket_type", v)}
          />
        ),
      },
      {
        accessorKey: "medical_eligible",
        header:      "Medical Eligibility",
        size:        150,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.medical_eligible}
            options={YES_NO_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "medical_eligible", v)}
          />
        ),
      },
      {
        accessorKey: "status_flag",
        header:      "Status *",
        size:        140,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.status_flag}
            options={statusOpts.map((o) => ({
              code:  o.value_code,
              label: o.value_desc,
            }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "status_flag", v)}
          />
        ),
      },
      {
        accessorKey: "dep_blood_group",
        header:      "Blood Group",
        size:        130,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.dep_blood_group}
            options={BLOOD_GROUP_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "dep_blood_group", v)}
          />
        ),
      },
      {
        accessorKey: "dep_sponsored_by",
        header:      "Sponsored By",
        size:        160,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.dep_sponsored_by}
            onBlur={(v) => updateRowText(row.original._rowId, "dep_sponsored_by", v)}
          />
        ),
      },
      {
        accessorKey: "ppt_card",
        header:      "Passport No",
        size:        160,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.ppt_card}
            onBlur={(v) => updateRowText(row.original._rowId, "ppt_card", v)}
          />
        ),
      },
      {
        accessorKey: "ppt_valid_from",
        header:      "Passport Valid From",
        size:        160,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.ppt_valid_from}
            onBlur={(v) => updateRowText(row.original._rowId, "ppt_valid_from", v)}
          />
        ),
      },
      {
        accessorKey: "ppt_valid_to",
        header:      "Passport Valid To",
        size:        160,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.ppt_valid_to}
            onBlur={(v) => updateRowText(row.original._rowId, "ppt_valid_to", v)}
          />
        ),
      },
      {
        accessorKey: "res_card",
        header:      "Residence Card No",
        size:        170,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.res_card}
            onBlur={(v) => updateRowText(row.original._rowId, "res_card", v)}
          />
        ),
      },
      {
        accessorKey: "res_valid_from",
        header:      "Residence Valid From",
        size:        170,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.res_valid_from}
            onBlur={(v) => updateRowText(row.original._rowId, "res_valid_from", v)}
          />
        ),
      },
      {
        accessorKey: "res_valid_to",
        header:      "Residence Valid To",
        size:        170,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.res_valid_to}
            onBlur={(v) => updateRowText(row.original._rowId, "res_valid_to", v)}
          />
        ),
      },
      {
        accessorKey: "ins_card_no",
        header:      "Insurance Card No",
        size:        170,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.ins_card_no}
            onBlur={(v) => updateRowText(row.original._rowId, "ins_card_no", v)}
          />
        ),
      },
      {
        accessorKey: "ins_card_type",
        header:      "Insurance Card Type",
        size:        170,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.ins_card_type}
            onBlur={(v) => updateRowText(row.original._rowId, "ins_card_type", v)}
          />
        ),
      },
      {
        accessorKey: "ins_card_issue_dt",
        header:      "Insurance Issue Date",
        size:        170,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.ins_card_issue_dt}
            onBlur={(v) => updateRowText(row.original._rowId, "ins_card_issue_dt", v)}
          />
        ),
      },
      {
        accessorKey: "isn_card_exp_dt",
        header:      "Insurance Exp Date",
        size:        170,
        cell:        ({ row }) => (
          <EditableDateCell
            initialValue={row.original.isn_card_exp_dt}
            onBlur={(v) => updateRowText(row.original._rowId, "isn_card_exp_dt", v)}
          />
        ),
      },
      {
        accessorKey: "remarks",
        header:      "Remarks",
        size:        220,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.remarks}
            onBlur={(v) => updateRowText(row.original._rowId, "remarks", v)}
          />
        ),
      },
      {
        id:                 "remove",
        header:             "",
        size:               60,
        enableColumnFilter: false,
        cell:               ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            title="Remove row"
            onClick={() => deleteRow(row.original._rowId)}
          >
            ✕
          </Button>
        ),
      },
    ],
    [relationOpts, ticketTypeOpts, statusOpts, updateRowSelect, updateRowText, deleteRow],
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.employee_id) throw new Error("Please select an employee");

      if (visibleRows.length === 0 && rows.every((r) => r.status_flag === "D")) {
        throw new Error("Add at least one dependant record");
      }

      for (const r of visibleRows) {
        if (!r.dep_name.trim()) throw new Error("Dependant Name is required for all rows");
        if (!r.dep_relation)     throw new Error("Relation is required for all rows");
      }

      const dependant_details = rows.map((r) => ({
        dep_serial_number:  r.dep_serial_number || null,
        employee_id:        employee.employee_id,
        dep_relation:       r.dep_relation,
        dep_name:           r.dep_name,
        dep_dob:            r.dep_dob || null,
        dep_sponsored_by:   r.dep_sponsored_by,
        ticket_eligibility: r.ticket_eligibility,
        ticket_type:        r.ticket_type,
        marstat:            r.marstat,
        medical_eligible:   r.medical_eligible,
        dep_blood_group:    r.dep_blood_group,
        status_flag:        r.status_flag,
        remarks:            r.remarks,
        ppt_card:           r.ppt_card,
        res_card:           r.res_card,
        ppt_valid_from:     r.ppt_valid_from || null,
        ppt_valid_to:       r.ppt_valid_to   || null,
        res_valid_from:     r.res_valid_from || null,
        res_valid_to:       r.res_valid_to   || null,
        ins_card_no:        r.ins_card_no,
        ins_card_type:      r.ins_card_type,
        ins_card_issue_dt:  r.ins_card_issue_dt || null,
        isn_card_exp_dt:    r.isn_card_exp_dt   || null,
        company_code:       companyCode,
        user_id:            loginid,
      }));

      const success = await hrEmpDependantsServiceInstance.upsertHrEmpDependantsApi({
        company_code: companyCode,
        dependant_details,
        loginid,
      });

      if (!success) throw new Error("Save failed. Please try again.");
    },
    onSuccess: () => {
      setNotice({ type: "success", message: "Dependant details saved successfully." });

      setRows((prev) =>
        prev
          .filter((r) => r.status_flag !== "D")
          .map((r) => ({ ...r, _isPersisted: true })),
      );

      skipHydrateForEmployeeRef.current = employee?.employee_id ?? null;
      queryClient.invalidateQueries({ queryKey: ["dependants-data", employee?.employee_id] });
    },
    onError: (err: Error) => {
      setNotice({ type: "error", message: err.message ?? "Failed to save dependant details." });
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="grid gap-4">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            HR Employee - Employee Dependants
          </h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Maintain dependant records (name, relation, tickets, medical, documents) for employees.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDivision(null);
              setDepartment(null);
              setSection(null);
              setEmployee(null);
              setRows([]);
              setNotice(null);
              setResetKey((k) => k + 1);

              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-relation", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-ticket-type", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-status", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-division", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-department", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-section", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-dependants-employee", companyCode] });

              queryClient.removeQueries({
                predicate: (query) => query.queryKey[0] === "dependants-data",
              });
              skipHydrateForEmployeeRef.current = null;
            }}
          >
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
<Card>
  <CardHeader>
    <div>
      <p className="eyebrow">Filters</p>
      <h2 className="m-0 text-sm font-semibold">
        Select Employee
      </h2>
    </div>
  </CardHeader>

  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

    {/* Division */}
    <label className="field">
      <span>Division</span>

      <LookupField
        key={`division-${resetKey}`}
        compact
        label="Division"
        value={division?.div_code ?? ""}
        displayValue={
          division
            ? `${division.div_code} - ${division.div_name}`
            : ""
        }
        columns={[
          { field: "div_code", header: "Code" },
          { field: "div_name", header: "Division" },
        ]}
        valueField="div_code"
        displayFields={["div_code", "div_name"]}
        loadOptions={loadDivisions}
        onChange={(_, row) => {
          setDivision(
            row
              ? {
                  div_code: String(row.div_code ?? ""),
                  div_name: String(row.div_name ?? ""),
                }
              : null
          );
        }}
      />
    </label>

    {/* Department */}
    <label className="field">
      <span>
        Department{" "}
        <strong className="text-destructive">*</strong>
      </span>

      <LookupField
        key={`department-${resetKey}-${division?.div_code ?? ""}`}
        compact
        label="Department"
        value={department?.dept_code ?? ""}
        displayValue={
          department
            ? `${department.dept_code} - ${department.dept_name}`
            : ""
        }
        columns={[
          { field: "dept_code", header: "Code" },
          { field: "dept_name", header: "Department" },
        ]}
        valueField="dept_code"
        displayFields={["dept_code", "dept_name"]}
        loadOptions={loadDepartments}
        onChange={(_, row) => {
          setDepartment(
            row
              ? {
                  dept_code: String(row.dept_code ?? ""),
                  dept_name: String(row.dept_name ?? ""),
                }
              : null
          );
        }}
      />
    </label>

    {/* Section */}
    <label className="field">
      <span>
        Section{" "}
        <strong className="text-destructive">*</strong>
      </span>

      <LookupField
        key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
        compact
        label="Section"
        value={section?.section_code ?? ""}
        displayValue={
          section
            ? `${section.section_code} - ${section.section_name}`
            : ""
        }
        columns={[
          { field: "section_code", header: "Code" },
          { field: "section_name", header: "Section" },
        ]}
        valueField="section_code"
        displayFields={["section_code", "section_name"]}
        loadOptions={loadSections}
        onChange={(_, row) => {
          setSection(
            row
              ? {
                  section_code: String(row.section_code ?? ""),
                  section_name: String(row.section_name ?? ""),
                }
              : null
          );
        }}
      />
    </label>

    {/* Employee */}
    <label className="field">
      <span>
        Employee{" "}
        <strong className="text-destructive">*</strong>
      </span>

      <LookupField
        key={`employee-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}-${section?.section_code ?? ""}`}
        compact
        label="Employee"
        value={employee?.employee_id ?? ""}
        displayValue={
          employee
            ? `${employee.employee_id} - ${employee.employee_name}`
            : ""
        }
        columns={[
          { field: "employee_id", header: "ID" },
          { field: "employee_name", header: "Employee" },
        ]}
        valueField="employee_id"
        displayFields={["employee_id", "employee_name"]}
        loadOptions={loadEmployees}
        onChange={(_, row) => {
          setEmployee(
            row
              ? {
                  employee_id: String(row.employee_id ?? ""),
                  employee_name: String(
                    row.employee_name ?? row.rpt_name ?? ""
                  ),
                }
              : null
          );
        }}
      />
    </label>

  </CardContent>
</Card>

      {/* ── Dependants Grid ──────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={visibleRows}
        title={`${visibleRows.length} Record${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle="Dependant Records"
        searchPlaceholder="Search name, relation, remarks..."
        height={420}
        minWidth={2600}
        density="grid"
        enablePagination={false}
        getRowId={(row) => row._rowId}
        toolbar={
          <Button
            variant="outline"
            disabled={!employee?.employee_id}
            onClick={() => setRows((prev) => [...prev, makeRow()])}
          >
            <MdAddCircleOutline size={15} /> Add Row
          </Button>
        }
      />

      {/* ── Footer Actions ───────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2">
        <Button
          disabled={mutation.isPending || visibleRows.length === 0 || !employee?.employee_id}
          onClick={() => mutation.mutate()}
        >
          <Save size={15} />
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

    </section>
  );
}