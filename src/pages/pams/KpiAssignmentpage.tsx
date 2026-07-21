import { ChevronDown, CheckCircle2, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { pamsSelect, pamsSave } from "../../api/pams";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import type { LookupRow } from "../../api/lookups";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

type ItemType = "KPI" | "CHARACTERISTICS" | "SKILL" | "GOAL";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

function orgLabel(row: Row, codeKey: string, nameKey: string): string {
  const code = text(row[codeKey]);
  const name = text(row[nameKey]);
  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
}

function assignmentRowKey(row: Row): string {
  return [
    row.KPI_CODE,
    row.DIVISION_CODE || row.DIV_CODE,
    row.DEPARTMENT_CODE || row.DEPT_CODE,
    row.EMPLOYEE_CODE,
  ]
    .map(text)
    .join("|");
}

function splitItems(value: unknown): string[] {
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </div>
  );
}


const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "KPI", label: "Task" },
  { value: "CHARACTERISTICS", label: "Characteristics" },
  { value: "SKILL", label: "Skill" },
  { value: "GOAL", label: "Goal" },
];


export function KpiAssignmentPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";
  const [employees, setEmployees] = useState<Row[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedType, setSelectedType] = useState<ItemType>("KPI");
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    pamsSelect({ parameter: "employee_hierarchy", loginid, code1: companyCode })
      .then((data) => setEmployees(data.map(normalizeRow)))
      .catch(() => setEmployees([]));
  }, [loginid, companyCode]);

  const loadAssignments = async (clearNotice = true) => {
    if (!selectedEmployee || !selectedType) {
      setNotice({ type: "error", message: "Select employee and item type" });
      return;
    }
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      await pamsSelect({
        parameter: "populate_dept_kpi",
        loginid,
        code1: companyCode,
        code2: selectedEmployee,
        code3: selectedType,
      });

      const data = await pamsSelect({
        parameter: "kpi_assignment_page",
        loginid,
        code1: companyCode,
        code2: selectedType,
        code3: selectedEmployee,
      });

      const normalized = data.map(normalizeRow);
      setRows(normalized);
      setSelectedRows(
        Object.fromEntries(normalized.map((row) => [assignmentRowKey(row), true]))
      );
      setExpandedRows({});
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load assignments",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployee && selectedType) void loadAssignments();
  }, [selectedEmployee, selectedType]);

  const saveAssignments = async () => {
    const rowsToSave = rows.filter((row) => selectedRows[assignmentRowKey(row)]);
    if (!rowsToSave.length) {
      setNotice({ type: "error", message: "Select at least one row" });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await Promise.all(
        rowsToSave.map((row) =>
          pamsSave({
            parameter: "dept_kpi_ins_upd",
            loginid,
            val1s1: companyCode,
            val1s2: text(row.DIVISION_CODE || row.DIV_CODE),
            val1s3: text(row.DEPARTMENT_CODE || row.DEPT_CODE),
            val1s4: selectedEmployee,
            val1s5: text(row.KPI_CODE),
            val1s6: selectedType,
            val1n1: number(row.WEIGHTAGE || row.STANDARD_WEIGHTAGE),
            val1s7: "Y",
          })
        )
      );
      setNotice({ type: "success", message: "Assignment saved successfully" });
      setLastSaved(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      await loadAssignments(false);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to save assignments",
      });
    } finally {
      setSaving(false);
    }
  };

  const employeeOptions = employees.map((employee, index) => ({
    value: text(employee.EMPLOYEE_CODE || employee.employee_code),
    label: [
      employee.EMPLOYEE_CODE || employee.employee_code,
      employee.EMP_NAME || employee.RPT_NAME || employee.employee_name,
    ]
      .filter(Boolean)
      .join(" - "),
    key: `employee_${index}`,
  }));

  const selectedCount = Object.values(selectedRows).filter(Boolean).length;
  const allSelected =
    rows.length > 0 && rows.every((row) => selectedRows[assignmentRowKey(row)]);
  const selectedEmployeeLabel =
    employeeOptions.find((opt) => opt.value === selectedEmployee)?.label ||
    selectedEmployee;

  const toggleAll = () => {
    const next = !allSelected;
    setSelectedRows(
      Object.fromEntries(rows.map((row) => [assignmentRowKey(row), next]))
    );
  };

  return (
    <section className="grid gap-4">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Assignment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select employee, item type, and save the required appraisal assignment rows.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadAssignments()}>
            <RefreshCw size={15} /> Load
          </Button>
          <Button disabled={saving || !rows.length} onClick={saveAssignments}>
            <Save size={15} /> {saving ? "Saving..." : "Save Selected"}
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-[1.3fr_1fr]">

          <Field label="Employee" required>
            <LookupField
              compact
              label="Employee"
              value={selectedEmployee}
              displayValue={
                employeeOptions.find((opt) => opt.value === selectedEmployee)
                  ?.label || selectedEmployee
              }
              placeholder="Search employee"
              columns={[
                { field: "EMPLOYEE_CODE", header: "Employee Code" },
                { field: "EMP_NAME", header: "Employee Name" },
                { field: "RPT_NAME", header: "Report Name" },
              ]}
              valueField="EMPLOYEE_CODE"
              displayFields={["EMPLOYEE_CODE", "EMP_NAME", "RPT_NAME"]}
              loadOptions={async () => {
                if (employees.length) return employees as LookupRow[];
                const data = (
                  await pamsSelect({
                    parameter: "employee_hierarchy",
                    loginid,
                    code1: companyCode,
                  })
                ).map(normalizeRow);
                setEmployees(data);
                return data as LookupRow[];
              }}
              onChange={(value) => setSelectedEmployee(value)}
            />
          </Field>

          <Field label="Item Type" required>
            <div className="flex flex-wrap gap-2">
              {ITEM_TYPES.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={selectedType === item.value ? "default" : "outline"}
                  onClick={() => setSelectedType(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </Field>

        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.26em] text-primary">
                  Assignment
                </p>
                <h2 className="m-0 text-base font-semibold text-foreground">
                  KPI Assignment
                </h2>
                <p className="m-0 text-xs text-muted-foreground">
                  {selectedEmployee
                    ? selectedEmployeeLabel
                    : "Select an employee to load assignment rows"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Last saved {lastSaved}
                </span>
              )}
              <Badge variant="outline">
                {selectedCount} / {rows.length} selected
              </Badge>
              <Button
                type="button"
                variant="outline"
                disabled={!rows.length}
                onClick={toggleAll}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 text-[11px] uppercase tracking-[0.12em] text-primary">
                <tr>
                  <th className="w-16 border-b border-border px-3 py-2 text-left">
                    Select
                  </th>
                  <th className="border-b border-border px-3 py-2 text-left">
                    KPI Code - Description
                  </th>
                  <th className="w-40 border-b border-border px-3 py-2 text-left">
                    Weightage
                  </th>
                  <th className="w-44 border-b border-border px-3 py-2 text-left">
                    Division
                  </th>
                  <th className="w-44 border-b border-border px-3 py-2 text-left">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-14 text-center text-muted-foreground"
                    >
                      Loading assignment rows...
                    </td>
                  </tr>
                ) : !selectedEmployee ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-14 text-center text-muted-foreground"
                    >
                      Select employee and item type to load rows.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-14 text-center text-muted-foreground"
                    >
                      No assignment rows found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const key = assignmentRowKey(row);
                    const itemRows = splitItems(
                      row.KPI_ITEM_DESC || row.ITEM_DESC
                    );
                    return (
                      <tr
                        key={key}
                        className="border-b border-border align-top hover:bg-muted/40"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedRows[key])}
                            onChange={(e) =>
                              setSelectedRows((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                        </td>

                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 text-left"
                            onClick={() =>
                              setExpandedRows((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            <span>
                              <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                {formatValue(row.KPI_CODE)}
                              </span>
                              <span className="ml-2 font-semibold text-foreground">
                                {formatValue(
                                  row.KPI_DESC || row.ITEM_DESC || row.DESCRIPTION
                                )}
                              </span>
                              {itemRows.length > 0 && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {itemRows.length} item
                                  {itemRows.length === 1 ? "" : "s"}
                                </span>
                              )}
                            </span>
                            {itemRows.length > 0 && (
                              <ChevronDown
                                size={16}
                                className={
                                  expandedRows[key]
                                    ? "rotate-180 transition-transform"
                                    : "transition-transform"
                                }
                              />
                            )}
                          </button>

                          {expandedRows[key] && itemRows.length > 0 && (
                            <div className="mt-2 grid gap-1 rounded-md border border-border bg-muted/30 p-2">
                              {itemRows.map((item, index) => (
                                <div
                                  key={`${key}_item_${index}`}
                                  className="text-xs text-muted-foreground"
                                >
                                  {index + 1}. {item}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          {formatValue(row.WEIGHTAGE || row.STANDARD_WEIGHTAGE)}
                        </td>

                        <td className="px-3 py-2">
                          {orgLabel(row, "DIVISION_CODE", "DIVISION_NAME") ||
                            orgLabel(row, "DIV_CODE", "DIV_NAME")}
                        </td>

                        <td className="px-3 py-2">
                          {orgLabel(row, "DEPARTMENT_CODE", "DEPARTMENT_NAME") ||
                            orgLabel(row, "DEPT_CODE", "DEPT_NAME")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-border p-3">
            <Button disabled={saving || !rows.length} onClick={saveAssignments}>
              <Save size={15} /> {saving ? "Saving..." : "Save Selection"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
