import { Building2, CalendarDays, BriefcaseBusiness, Mail, MapPin, Phone, RefreshCcw, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pamsSelect } from "../../api/pams";
import type { PamsProcedureParams } from "../../api/pams";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type Row = Record<string, unknown>;

type EmployeeInfo = {
  employeeCode: string;
  employeeName: string;
  divisionCode: string;
  departmentCode: string;
  sectionCode: string;
  designationCode: string;
  gradeCode: string;
  categoryCode: string;
  status: string;
  phone: string;
  mobile: string;
  email: string;
  joinDate: string;
  birthDate: string;
  nationality: string;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatValue(value: unknown): string {
  if (!value) return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }
  return String(value);
}

function normalizeRow(row: Row): Row {
  const normalized: Row = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.toUpperCase()] = value;
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function pick(row: Row, keys: string[]): string {
  for (const key of keys) {
    const value = text(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()]);
    if (value) return value;
  }
  return "";
}

function getEmployeeInfo(row: Row): EmployeeInfo {
  const normalized = normalizeRow(row);
  return {
    employeeCode: pick(normalized, ["EMPLOYEE_CODE", "employee_code"]),
    employeeName: pick(normalized, ["RPT_NAME", "EMP_NAME", "employee_name", "EMPLOYEE_NAME"]),
    divisionCode: pick(normalized, ["DIV_CODE", "div_code"]),
    departmentCode: pick(normalized, ["DEPT_CODE", "dept_code"]),
    sectionCode: pick(normalized, ["SECTION_CODE", "section_code"]),
    designationCode: pick(normalized, ["DESG_CODE", "desg_code"]),
    gradeCode: pick(normalized, ["GRADE_CODE", "grade_code"]),
    categoryCode: pick(normalized, ["CATEGORY_CODE", "category_code"]),
    status: pick(normalized, ["EMP_STATUS", "emp_status"]),
    phone: pick(normalized, ["PHONE_NO", "phone_no", "PHONE"]),
    mobile: pick(normalized, ["MOBILE_NO", "mobile_no", "MOB_NO"]),
    email: pick(normalized, ["EMAIL_ID", "email_id", "EMAIL"]),
    joinDate: formatValue(pick(normalized, ["JOIN_DATE", "join_date"])),
    birthDate: formatValue(pick(normalized, ["DOB", "birth_date", "BIRTH_DATE"])),
    nationality: pick(normalized, ["NATIONALITY", "nationality"]),
  };
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof UserRound }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value || "-"}</div>
    </div>
  );
}

async function pamsProc(params: PamsProcedureParams): Promise<Row[]> {
  return pamsSelect(params);
}

export function KpiEmployeeInformationPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [divisions, setDivisions] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    if (!companyCode) return;

    const loadDivisions = async () => {
      setLoadingDivisions(true);
      try {
        const data = await pamsProc({
          parameter: "get_divisions",
          loginid,
          code1: companyCode,
          code2: "NULL",
          code3: "NULL",
        });
        setDivisions(data.map(normalizeRow));
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to load divisions",
        });
      } finally {
        setLoadingDivisions(false);
      }
    };

    void loadDivisions();
  }, [companyCode, loginid]);

  const divisionOptions = useMemo(
    () =>
      divisions.map((division, index) => {
        const code = text(division.DIV_CODE ?? division.div_code ?? division.CODE ?? `DIV-${index}`);
        const name = text(division.DIV_NAME ?? division.div_name ?? division.NAME ?? "");
        return { value: code, label: code && name ? `${code} - ${name}` : code || name || `Division ${index + 1}` };
      }),
    [divisions]
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((emp, index) => {
        const employeeCode = text(emp.EMPLOYEE_CODE ?? emp.employee_code ?? "");
        const employeeName = text(emp.EMP_NAME ?? emp.RPT_NAME ?? emp.employee_name ?? "");
        return {
          value: employeeCode,
          label: employeeCode && employeeName ? `${employeeCode} - ${employeeName}` : employeeCode || employeeName || `Employee ${index + 1}`,
        };
      }),
    [employees]
  );

  const loadEmployeesByDivision = async (divisionCode: string) => {
    if (!companyCode || !divisionCode) {
      setEmployees([]);
      setSelectedEmployee("");
      setEmployee(null);
      return;
    }

    setLoadingEmployees(true);
    setNotice(null);
    try {
      const data = await pamsProc({
        parameter: "get_employees_by_division",
        loginid,
        code1: companyCode,
        code2: divisionCode,
        code3: "NULL",
      });
      setEmployees(data.map(normalizeRow));
      setSelectedEmployee("");
      setEmployee(null);
    } catch (error) {
      setEmployees([]);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load employees for selected division",
      });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadEmployeeDetails = async (employeeCode: string) => {
    if (!companyCode || !selectedDivision || !employeeCode) {
      setEmployee(null);
      return;
    }

    setLoadingDetails(true);
    setNotice(null);
    try {
      const data = await pamsProc({
        parameter: "get_employee_details",
        loginid,
        code1: companyCode,
        code2: selectedDivision,
        code3: employeeCode,
      });

      const details = data[0] ? getEmployeeInfo(data[0]) : null;
      setEmployee(details);
      if (!details) {
        setNotice({ type: "info", message: "No employee details were returned for the selected record." });
      }
    } catch (error) {
      setEmployee(null);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load employee details",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const detailFields = [
    { label: "Employee Code", value: employee?.employeeCode ?? "-", icon: UserRound },
    { label: "Employee Name", value: employee?.employeeName ?? "-", icon: UserRound },
    { label: "Division", value: employee?.divisionCode ?? "-", icon: Building2 },
    { label: "Department", value: employee?.departmentCode ?? "-", icon: Building2 },
    { label: "Section", value: employee?.sectionCode ?? "-", icon: Building2 },
    { label: "Designation", value: employee?.designationCode ?? "-", icon: BriefcaseBusiness },
    { label: "Grade", value: employee?.gradeCode ?? "-", icon: ShieldCheck },
    { label: "Category", value: employee?.categoryCode ?? "-", icon: ShieldCheck },
    { label: "Status", value: employee?.status ?? "-", icon: ShieldCheck },
    { label: "Mobile", value: employee?.mobile || employee?.phone || "-", icon: Phone },
    { label: "Email", value: employee?.email || "-", icon: Mail },
    { label: "Date of Birth", value: employee?.birthDate || "-", icon: CalendarDays },
    { label: "Join Date", value: employee?.joinDate || "-", icon: CalendarDays },
    { label: "Nationality", value: employee?.nationality || "-", icon: MapPin },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">PAMS / HR</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Employee Information</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a division and employee to view the complete profile in a clean, readable layout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedDivision("");
              setSelectedEmployee("");
              setEmployees([]);
              setEmployee(null);
              void loadEmployeesByDivision("");
            }}
          >
            <RefreshCcw size={15} /> Reset
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border border-border bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="flex items-center gap-4 rounded-2xl bg-background/80 p-4 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRound size={28} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Profile Preview</div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {employee?.employeeName || "Select an employee"}
              </div>
              <div className="text-sm text-muted-foreground">
                {employee?.employeeCode || "Employee code will appear here"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-background/70 p-4 shadow-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Division</div>
            <Select
              value={selectedDivision}
              disabled={loadingDivisions}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDivision(value);
                void loadEmployeesByDivision(value);
              }}
            >
              <option value="">{loadingDivisions ? "Loading divisions..." : "Choose division"}</option>
              {divisionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-2xl bg-background/70 p-4 shadow-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Employee</div>
            <Select
              value={selectedEmployee}
              disabled={!selectedDivision || loadingEmployees}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedEmployee(value);
                void loadEmployeeDetails(value);
              }}
            >
              <option value="">{loadingEmployees ? "Loading employees..." : "Choose employee"}</option>
              {employeeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} duration={4000} />}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Employee Summary</h2>
              <p className="text-sm text-muted-foreground">A focused snapshot of the selected HR record.</p>
            </div>
            <Badge variant="secondary">{loadingDetails ? "Loading..." : employee ? "Active Profile" : "Awaiting Selection"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          {detailFields.map((field) => (
            <InfoTile key={field.label} label={field.label} value={field.value} icon={field.icon} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
