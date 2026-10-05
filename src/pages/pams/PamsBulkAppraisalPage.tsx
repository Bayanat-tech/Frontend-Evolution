import {
  CheckCircle2, ChevronDown, Edit2, Plus, Save, Trash2, Users, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";   // ⭐ useRef added
import {
  pamsCommonProcedure, pamsDelete, pamsSave, pamsSelect,
} from "../../api/pams";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import type { LookupRow } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";

type Row = Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE — KPI Assignment
// ═══════════════════════════════════════════════════════════════════
export function PamsBulkAppraisalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEmployeeLabel, setSelectedEmployeeLabel] = useState("");
  const [selectedType, setSelectedType] = useState("KPI");
  const [employees, setEmployees] = useState<Row[]>([]);
  const [processedEmployees, setProcessedEmployees] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState("");

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [periodReloadKey, setPeriodReloadKey] = useState(0);

  const [editPeriodTarget, setEditPeriodTarget] = useState<Row | null>(null);
  const [deletePeriodTarget, setDeletePeriodTarget] = useState<Row | null>(null);

  const [kpiEditorTarget, setKpiEditorTarget] = useState<Row | null>(null);
  const [kpiEditorMode, setKpiEditorMode] = useState<"add" | "edit">("add");
  const [kpiEditorOpen, setKpiEditorOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  // ⭐ In-flight guard — React StrictMode double-fire rokne ke liye
  const loadInFlightRef = useRef(false);

  const itemTypes = [
    { value: "KPI", label: "Task" },
    { value: "CHARACTERISTICS", label: "Characteristics" },
    { value: "SKILL", label: "Skill Evaluation" },
    { value: "GOAL", label: "Goal Achievement" },
  ];

  const isKpiType = selectedType === "KPI";
  const colCount = isKpiType ? 5 : 4;

  const typeLabel =
    selectedType === "SKILL" ? "Skill"
      : selectedType === "GOAL" ? "Goal"
        : selectedType === "CHARACTERISTICS" ? "Characteristic"
          : "KPI";

  const canEditRow = selectedType === "KPI" || selectedType === "CHARACTERISTICS";

  useEffect(() => {
    if (!selectedPeriod) {
      setEmployees([]);
      setProcessedEmployees(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await pamsSelect({
          parameter: "employee_hierarchy",
          loginid,
          code1: companyCode,
          code2: selectedPeriod,
        });
        if (cancelled) return;
        setEmployees(data.map(normalizeRow));

        try {
          const hdrData = await pamsSelect({
            parameter: "appraisal_hdr_employees",
            loginid,
            code1: companyCode,
            code2: selectedPeriod,
          });
          if (!cancelled) {
            const codes = new Set(
              hdrData.map((d) => text(d.EMPLOYEE_CODE || d.employee_code)).filter(Boolean)
            );
            setProcessedEmployees(codes);
          }
        } catch {
          if (!cancelled) setProcessedEmployees(new Set());
        }
      } catch (error) {
        if (!cancelled) {
          setEmployees([]);
          setProcessedEmployees(new Set());
          toast.error(
            error instanceof Error ? error.message : "Unable to load employees"
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loginid, companyCode, selectedPeriod, toast]);

  // ⭐ FIXED — in-flight guard lagaya
  const loadAssignments = async () => {
    if (!selectedEmployee || !selectedType || !selectedPeriod) return;

    // ⭐ Agar pichla call chal raha hai to skip karo (StrictMode double-fire rok)
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setLoading(true);
    try {
      await pamsSelect({
        parameter: "populate_dept_kpi",
        loginid,
        code1: companyCode,
        code2: selectedEmployee,
        code3: selectedType,
        code4: selectedPeriod,
      });

      const data = await pamsSelect({
        parameter: "kpi_assignment_page",
        loginid,
        code1: companyCode,
        code2: selectedType,
        code3: selectedEmployee,
        code4: selectedPeriod,
      });
      setRows(data.map(normalizeRow));
      setExpandedRows({});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load assignments"
      );
      setRows([]);
    } finally {
      loadInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployee && selectedType && selectedPeriod) void loadAssignments();
    else setRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, selectedType, selectedPeriod]);

  const process = async () => {
    if (!selectedPeriod) { toast.warning("Select a period first"); return; }
    if (!selectedEmployee) { toast.warning("Select an employee first"); return; }
    setSaving(true);
    try {
      await pamsCommonProcedure({
        parameter: "PROC_CLONE_DEPT_KPI_FROM_PREV_PERIOD",
        loginid,
        val1s1: companyCode,
        val1s2: selectedEmployee,
        val1s3: selectedPeriod,
      });

      await pamsCommonProcedure({
        parameter: "PROC_CREATE_APPRAISAL_DOC_BULK",
        loginid,
        val1s1: companyCode,
        val1s2: selectedPeriod,
        val1s3: selectedEmployee,
      });

      const msg = `Appraisal document for "${
        selectedEmployeeLabel || selectedEmployee
      }" (Period: ${selectedPeriod}) has been created successfully.`;
      setSuccessMsg(msg);
      setSuccessOpen(true);
      toast.success("Appraisal document created successfully");

      setSelectedEmployee("");
      setSelectedEmployeeLabel("");
      setRows([]);

      try {
        const hdrData = await pamsSelect({
          parameter: "appraisal_hdr_employees",
          loginid,
          code1: companyCode,
          code2: selectedPeriod,
        });
        const codes = new Set(
          hdrData.map((d) => text(d.EMPLOYEE_CODE || d.employee_code)).filter(Boolean)
        );
        setProcessedEmployees(codes);
      } catch { /* silent */ }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to process appraisal"
      );
    } finally {
      setSaving(false);
    }
  };

  // ⭐ CHANGED — Add KPI button: weightage 100 check
  const openAddKpi = () => {
    if (!selectedEmployee) {
      toast.warning("Select an employee first");
      return;
    }

    // Weightage total 100 ka check (sirf KPI/Task ke liye)
    if (isKpiType && totalWeightage >= 100) {
      toast.error(
        `Total weightage is already ${totalWeightage}%. Maximum 100% allowed. Cannot add more KPI.`
      );
      return;
    }

    setKpiEditorTarget(null);
    setKpiEditorMode("add");
    setKpiEditorOpen(true);
  };

  const openEditKpi = (row: Row) => {
    setKpiEditorTarget(row);
    setKpiEditorMode("edit");
    setKpiEditorOpen(true);
  };

  const handleDeleteKpi = async () => {
    if (!deleteTarget) return;
    const kpiCode = text(deleteTarget.KPI_CODE);
    const divCode = text(deleteTarget.DIVISION_CODE || deleteTarget.DIV_CODE);
    const deptCode = text(deleteTarget.DEPARTMENT_CODE || deleteTarget.DEPT_CODE);

    try {
      await pamsDelete({
        parameter: "delete_dept_kpi",
        loginid,
        code1: companyCode,
        code2: divCode,
        code3: deptCode,
        code4: selectedEmployee,
        code5: kpiCode,
        code6: selectedType,
        code7: selectedPeriod,
      });
      setDeleteTarget(null);
      toast.success(`${typeLabel} removed from this period`);
      await loadAssignments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const handleDeletePeriod = async () => {
    if (!deletePeriodTarget) return;
    const periodNumber = text(deletePeriodTarget.PERIOD_NUMBER);
    try {
      await pamsDelete({
        parameter: "delete_kpi_period",
        loginid,
        code1: companyCode,
        code2: periodNumber,
      });
      setDeletePeriodTarget(null);
      setPeriodReloadKey((k) => k + 1);
      if (selectedPeriod === periodNumber) {
        setSelectedPeriod("");
        setSelectedPeriodLabel("");
        setSelectedEmployee("");
        setSelectedEmployeeLabel("");
        setRows([]);
      }
      toast.success(`Period ${periodNumber} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const totalWeightage = useMemo(
    () => rows.reduce((sum, r) => sum + number(r.WEIGHTAGE || r.STANDARD_WEIGHTAGE), 0),
    [rows]
  );

  const availableEmployees = useMemo(
    () =>
      employees.filter(
        (e) => !processedEmployees.has(text(e.EMPLOYEE_CODE || e.employee_code))
      ),
    [employees, processedEmployees]
  );

  const toggleRow = (key: string) =>
    setExpandedRows((current) => ({ ...current, [key]: !current[key] }));

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Assignment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select period, employee, item type, and manage the required appraisal assignment rows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setPeriodFormOpen(true)}>
            <Plus size={15} /> Add New Period
          </Button>
          <Button type="button" disabled={saving} onClick={process}>
            <Users size={15} /> {saving ? "Processing..." : "Process"}
          </Button>
        </div>
      </div>

      <Card className="shrink-0">
        <CardContent className="grid gap-3 mt-2 pt-4 md:grid-cols-3">
          <Field label="Period" required>
            <LookupField
              key={`period-${periodReloadKey}`}
              compact
              label="Period"
              value={selectedPeriod}
              displayValue={selectedPeriodLabel}
              placeholder="Search period"
              columns={[
                { field: "PERIOD_NUMBER", header: "Period" },
                { field: "PERIOD_TYPE", header: "Type" },
                { field: "PERIOD_FROM_DATE", header: "From" },
                { field: "PERIOD_TO_DATE", header: "To" },
              ]}
              valueField="PERIOD_NUMBER"
              displayFields={["PERIOD_NUMBER", "PERIOD_TYPE"]}
              loadOptions={async () => {
                const data = await pamsSelect({
                  parameter: "period",
                  loginid,
                  code1: companyCode,
                });
                return data.map(normalizeRow) as LookupRow[];
              }}
              onChange={(value, row) => {
                setSelectedPeriod(value);
                setSelectedPeriodLabel(
                  row ? `${value} (${text(row.PERIOD_TYPE) || "Q"})` : value
                );
                setSelectedEmployee("");
                setSelectedEmployeeLabel("");
                setRows([]);
              }}
              renderRowActions={(row) => (
                <>
                  <button
                    type="button"
                    title="Edit period"
                    className="grid h-5 w-5 place-items-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setEditPeriodTarget(row); }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    title="Delete period"
                    className="grid h-5 w-5 place-items-center rounded text-red-500 hover:bg-red-100 hover:text-red-700 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setDeletePeriodTarget(row); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            />
          </Field>

          <Field label="Employee" required>
            <LookupField
              compact
              label="Employee"
              value={selectedEmployee}
              displayValue={selectedEmployeeLabel}
              placeholder={
                !selectedPeriod
                  ? "Select period first"
                  : availableEmployees.length === 0
                  ? "All employees processed"
                  : "Search employee"
              }
              disabled={!selectedPeriod || availableEmployees.length === 0}
              columns={[
                { field: "EMPLOYEE_CODE", header: "Employee Code" },
                { field: "EMP_NAME", header: "Employee Name" },
              ]}
              valueField="EMPLOYEE_CODE"
              displayFields={["EMPLOYEE_CODE", "EMP_NAME", "RPT_NAME"]}
              loadOptions={async () => availableEmployees as LookupRow[]}
              onChange={(value, row) => {
                setSelectedEmployee(value);
                setSelectedEmployeeLabel(
                  row
                    ? [value, text(row.EMP_NAME || row.RPT_NAME)].filter(Boolean).join(" - ")
                    : value
                );
              }}
            />
          </Field>

          <Field label="Item Type" required>
            <div className="flex flex-wrap gap-2">
              {itemTypes.map((item) => (
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

      {/* ═══ Assignment Card ═══ */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b border-slate-200/70 px-4 py-2.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 size={15} />
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="m-0 text-sm font-semibold text-foreground">
                    KPI Assignment
                  </h2>
                </div>
                <p className="m-0 truncate text-[11px] text-muted-foreground">
                  {selectedEmployee
                    ? selectedEmployeeLabel
                    : "Select an employee to load assignment rows"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              disabled={!selectedEmployee}
              onClick={openAddKpi}
              className="shrink-0"
            >
              <Plus size={15} /> Add {typeLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-14 px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    S.No
                  </th>
                  <th className="w-12 px-2 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    {isKpiType ? "KPI Group · Activity" : typeLabel}
                  </th>
                  {isKpiType && (
                    <th className="w-32 px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      Weightage %
                    </th>
                  )}
                  <th className="w-28 px-3 py-2.5 text-center text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-14 text-center text-muted-foreground">
                      Loading assignment rows...
                    </td>
                  </tr>
                ) : !selectedEmployee ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-14 text-center text-muted-foreground">
                      Select employee and item type to load rows.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-14 text-center text-muted-foreground">
                      No assignment rows found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const key = assignmentRowKey(row) + idx;
                    const itemRows = splitItems(row.KPI_ITEM_DESC || row.ITEM_DESC);
                    const isOpen = !!expandedRows[key];
                    const hasItems = itemRows.length > 0;
                    return (
                      <tr
                        key={key}
                        className="group border-b border-slate-100 align-top transition-colors hover:bg-primary/[0.04] dark:border-slate-800/70"
                      >
                        <td className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-3">
                          {hasItems ? (
                            <button
                              type="button"
                              onClick={() => toggleRow(key)}
                              className={`grid h-6 w-6 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background ${
                                isOpen ? "border-border bg-background text-primary" : ""
                              }`}
                              title={isOpen ? "Collapse" : "Expand"}
                            >
                              <ChevronDown
                                size={13}
                                className={
                                  isOpen
                                    ? "rotate-180 transition-transform"
                                    : "transition-transform"
                                }
                              />
                            </button>
                          ) : null}
                        </td>


                        <td
                          className={`px-3 py-3 ${hasItems ? "cursor-pointer select-none" : ""}`}
                          onClick={hasItems ? () => toggleRow(key) : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground group-hover:text-primary">
                              {formatValue(
                                row.KPI_DESC || row.ITEM_DESC || row.DESCRIPTION
                              ) || "—"}
                            </span>
                            {hasItems && (
                              <span className="rounded-full bg-slate-100 px-1.5 py-[1px] text-[9px] font-semibold text-slate-500 dark:bg-slate-800">
                                {itemRows.length}
                              </span>
                            )}
                          </div>

                          {isOpen && hasItems && (
                            <div className="mt-2 grid gap-1 rounded-md border border-border bg-muted/40 p-2.5">
                              {itemRows.map((item, index) => (
                                <div
                                  key={`${key}_item_${index}`}
                                  className="flex items-start gap-2 text-xs text-muted-foreground"
                                >
                                  <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                                    {index + 1}
                                  </span>
                                  <span className="leading-snug">{item}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>


                        {isKpiType && (
                          <td className="px-3 py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                              {formatValue(row.WEIGHTAGE || row.STANDARD_WEIGHTAGE) || "—"}
                            </span>
                          </td>
                        )}

                        <td className="px-3 py-3">
                          <div className="flex justify-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  
                            {canEditRow && (
                              <button
                                type="button"
                                title={`Edit ${typeLabel}`}
                                onClick={(e) => { e.stopPropagation(); openEditKpi(row); }}
                                className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-border hover:bg-background hover:text-primary"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              title={`Delete ${typeLabel}`}
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                              className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-slate-400 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>


              {isKpiType && (
                <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-900">
                  <tr className="border-t border-slate-200 dark:border-slate-800">
                    <td
                      colSpan={3}
                      className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Total Weightage
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${
                          totalWeightage === 100
                            ? "bg-emerald-600 text-white"
                            : totalWeightage > 100
                            ? "bg-red-600 text-white"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {totalWeightage}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <PeriodFormModal
        open={periodFormOpen || Boolean(editPeriodTarget)}
        onClose={() => { setPeriodFormOpen(false); setEditPeriodTarget(null); }}
        existingPeriod={editPeriodTarget}
        companyCode={companyCode}
        loginid={loginid}
        onSave={async (savedPeriodNumber) => {
          setPeriodFormOpen(false);
          setEditPeriodTarget(null);
          setPeriodReloadKey((k) => k + 1);
          if (savedPeriodNumber) {
            setSelectedPeriod(savedPeriodNumber);
            setSelectedPeriodLabel(savedPeriodNumber);
          }
        }}
      />

      <KpiEditorModal
        open={kpiEditorOpen}
        onClose={() => { setKpiEditorOpen(false); setKpiEditorTarget(null); }}
        existingRow={kpiEditorMode === "edit" ? kpiEditorTarget : null}
        itemType={selectedType}
        employeeCode={selectedEmployee}
        companyCode={companyCode}
        loginid={loginid}
        period={selectedPeriod}
        totalWeightage={totalWeightage}   /* ⭐ NAYA PROP */
        onRefresh={loadAssignments}
        onSave={async () => {
          setKpiEditorOpen(false);
          setKpiEditorTarget(null);
          setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          await loadAssignments();
        }}
      />

      <Dialog
        open={successOpen}
        compact
        title="Success"
        onClose={() => setSuccessOpen(false)}
        footer={<Button onClick={() => setSuccessOpen(false)}>OK</Button>}
      >
        <div className="flex items-start gap-3 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <div className="grid gap-1">
            <p className="m-0 font-semibold text-emerald-800 dark:text-emerald-200">
              Appraisal Document Created
            </p>
            <p className="m-0 text-sm text-emerald-700 dark:text-emerald-300">
              {successMsg}
            </p>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title={`Delete ${typeLabel}`}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteKpi}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Remove <strong>{text(deleteTarget?.KPI_DESC)}</strong> from
          <strong> {selectedPeriod}</strong> only?
          <br />
          <span className="text-xs">
            Appraisal documents that are already created are not affected.
          </span>
        </p>
      </Dialog>

      <Dialog
        open={Boolean(deletePeriodTarget)}
        compact
        tone="danger"
        title="Delete Period"
        onClose={() => setDeletePeriodTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletePeriodTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePeriod}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete period <strong>{text(deletePeriodTarget?.PERIOD_NUMBER)}</strong>?
          <br />
          <span className="text-xs">This cannot be undone.</span>
        </p>
      </Dialog>
    </section>
  );
}


function KpiEditorModal({
  open, onClose, existingRow, itemType, employeeCode, companyCode, loginid,
  period, totalWeightage, onSave, onRefresh,   // ⭐ totalWeightage add
}: {
  open: boolean;
  onClose: () => void;
  existingRow: Row | null;
  itemType: string;
  employeeCode: string;
  companyCode: string;
  loginid: string;
  period: string;
  totalWeightage: number;                      // ⭐ NAYA
  onSave: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const isEdit = !!existingRow;

  const isTask = itemType === "KPI";
  const needsWeightage = isTask;
  const needsActivities = isTask;
  const isMulti = !isEdit && !isTask; // naam-only types: add mode mein kai naam ek saath

  const label =
    itemType === "SKILL" ? "Skill"
      : itemType === "GOAL" ? "Goal"
        : itemType === "CHARACTERISTICS" ? "Characteristic"
          : "KPI";

  const [kpiCode, setKpiCode] = useState("");
  const [kpiDesc, setKpiDesc] = useState("");
  const [weightage, setWeightage] = useState(0);
  const [activities, setActivities] = useState<string[]>([]);
  const [originalActivities, setOriginalActivities] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNames([""]);
    if (existingRow) {
      setKpiCode(text(existingRow.KPI_CODE));
      setKpiDesc(text(existingRow.KPI_DESC));
      setWeightage(number(existingRow.WEIGHTAGE || existingRow.STANDARD_WEIGHTAGE));
      const existing = splitItems(existingRow.KPI_ITEM_DESC);
      setActivities(existing);
      setOriginalActivities(existing);
    } else {
      setKpiCode("");
      setKpiDesc("");
      setWeightage(0);
      setActivities([]);
      setOriginalActivities([]);
    }
  }, [open, existingRow]);

  // ── Activities (Task) ─────────────────────────────────────────────
  const addActivityRow = () => {
    setActivities((prev) => [...prev, ""]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-activity-input]");
      inputs[inputs.length - 1]?.focus();
    }, 50);
  };

  const removeActivity = (index: number) => {
    setActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const updateActivity = (index: number, value: string) => {
    setActivities((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  // ── Names (Characteristics / Skill / Goal) ────────────────────────
  const addNameRow = () => {
    setNames((prev) => [...prev, ""]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-name-input]");
      inputs[inputs.length - 1]?.focus();
    }, 50);
  };

  const removeName = (index: number) => {
    setNames((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  // ── Save: ek saath kai naam ──────────────────────────────────────
  const submitMulti = async () => {
    // trim + blank hatao + duplicate naam (case ignore) hatao
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of names) {
      const n = raw.trim();
      if (!n) continue;
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      cleaned.push(n);
    }

    if (cleaned.length === 0) {
      toast.warning(`Enter at least one ${label.toLowerCase()}`);
      return;
    }

    setSaving(true);
    const failed: { name: string; msg: string }[] = [];
    let okCount = 0;

    for (const name of cleaned) {
      try {
        const result = await pamsSelect({
          parameter: "proc_kpi_creation",
          loginid,
          code1: companyCode,
          code2: employeeCode,
          code3: name,
          code4: "",
          code5: itemType,
          code6: period,
          number1: 0,
        });
        const res = String((result?.[0] as Record<string, unknown>)?.RESULT ?? "");
        if (res.toUpperCase().startsWith("ERROR")) throw new Error(res);
        okCount++;
      } catch (err) {
        failed.push({
          name,
          msg: (err instanceof Error ? err.message : "Save failed").replace(/^ERROR:\s*/i, ""),
        });
      }
    }
    setSaving(false);

    if (failed.length === 0) {
      toast.success(
        okCount === 1
          ? `${label} added successfully`
          : `${okCount} ${label.toLowerCase()}s added successfully`
      );
      onSave();
      return;
    }

    // Kuch fail hue: jo ho gaye wo list mein dikhao, fail wale modal mein rakho
    setNames(failed.map((f) => f.name));
    if (okCount > 0) await onRefresh();
    toast.error(
      `${failed.length} not added — ` +
      failed.map((f) => `${f.name}: ${f.msg}`).join(" | ")
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isMulti) {
      await submitMulti();
      return;
    }

    if (!kpiDesc.trim()) {
      toast.warning(`${label} name is required`);
      return;
    }

    // ═══════════════════════════════════════════════════════
    // ⭐ WEIGHTAGE TOTAL 100 CHECK
    // ═══════════════════════════════════════════════════════
    if (needsWeightage) {
      if (weightage <= 0) {
        toast.warning("Weightage must be greater than 0");
        return;
      }

      const originalWeightage = isEdit
        ? number(existingRow?.WEIGHTAGE || existingRow?.STANDARD_WEIGHTAGE)
        : 0;

      const projectedTotal = totalWeightage - originalWeightage + weightage;

      if (projectedTotal > 100) {
        toast.error(
          `Total weightage would become ${projectedTotal}%. Maximum 100% allowed. ` +
          `Available: ${100 - (totalWeightage - originalWeightage)}%.`
        );
        return;
      }
    }

    const finalActivities = needsActivities
      ? activities.map((a) => a.trim()).filter(Boolean)
      : [];

    if (needsActivities) {
      // 1. Min / Max range
      if (finalActivities.length < 3) {
        toast.warning("Minimum 3 KPI items (activities) are required per designation/role.");
        return;
      }
      if (finalActivities.length > 6) {
        toast.warning("Maximum 6 KPI items (activities) are allowed per designation/role.");
        return;
      }

      // 2. Measurable check (min 5 chars)
      const invalidItem = finalActivities.find((a) => a.length < 5);
      if (invalidItem) {
        toast.warning(
          `KPI item "${invalidItem}" is too short. Please make it measurable and descriptive (min 5 characters).`
        );
        return;
      }

      // ═══════════════════════════════════════════════════════
      // ⭐ DUPLICATE ACTIVITY CHECK (case-insensitive)
      // ═══════════════════════════════════════════════════════
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const act of finalActivities) {
        const key = act.toLowerCase();
        if (seen.has(key)) {
          if (!duplicates.includes(act)) duplicates.push(act);
        } else {
          seen.add(key);
        }
      }

      if (duplicates.length > 0) {
        toast.error(
          `Duplicate ${duplicates.length === 1 ? "activity" : "activities"} found: ` +
          `${duplicates.map((d) => `"${d}"`).join(", ")}. ` +
          `Please remove duplicates before saving.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit) {
        await pamsSave({
          parameter: "dept_kpi_ins_upd",
          loginid,
          val1s1: companyCode,
          val1s2: text(existingRow?.DIVISION_CODE || existingRow?.DIV_CODE),
          val1s3: text(existingRow?.DEPARTMENT_CODE || existingRow?.DEPT_CODE),
          val1s4: employeeCode,
          val1s5: kpiCode,
          val1s6: itemType,
          val1s7: kpiDesc,
          val1n1: needsWeightage ? weightage : 0,
        });

        // Activities sirf KPI (Task) ke hote hain
        if (needsActivities) {
          for (let i = 0; i < originalActivities.length; i++) {
            await pamsDelete({
              parameter: "delete_kpi_item",
              loginid,
              code1: companyCode,
              code2: kpiCode,
              number1: i + 1,
            });
          }

          for (const [i, activity] of finalActivities.entries()) {
            await pamsSave({
              parameter: "kpi_item_ins_upd",
              loginid,
              val1s1: companyCode,
              val1s2: kpiCode,
              val1s3: activity,
              val1n1: i + 1,
            });
          }
        }
        toast.success(`${label} updated successfully`);
      } else {
        const result = await pamsSelect({
          parameter: "proc_kpi_creation",
          loginid,
          code1: companyCode,
          code2: employeeCode,
          code3: kpiDesc,
          code4: finalActivities.join(","),
          code5: itemType,
          code6: period,
          number1: needsWeightage ? weightage : 0,
        });

        const res = String((result?.[0] as Record<string, unknown>)?.RESULT ?? "");
        if (res.toUpperCase().startsWith("ERROR")) throw new Error(res);

        toast.success(`${label} added successfully`);
      }
      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      wide
      title={isEdit ? `Edit ${label}` : `Add ${label}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="kpi-editor-form" disabled={saving}>
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="kpi-editor-form" className="grid gap-4" onSubmit={handleSubmit}>
        {/* ── Characteristics / Skill / Goal: kai naam ek saath ── */}
        {isMulti ? (
          <Field label={`${label} name`} required>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {names.length === 0
                    ? "No names added yet"
                    : `${names.length} name${names.length === 1 ? "" : "s"}`}
                </span>
                <Button type="button" size="sm" onClick={addNameRow}>
                  <Plus size={13} /> Add {label.toLowerCase()}
                </Button>
              </div>

              <div className="grid gap-1.5">
                {names.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <Input
                      data-name-input
                      value={name}
                      onChange={(e) => updateName(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (name.trim() && i === names.length - 1) addNameRow();
                        }
                      }}
                      placeholder={`Enter ${label.toLowerCase()} name`}
                      className="flex-1"
                      autoFocus={i === 0}
                    />
                    {names.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeName(i)}
                        title="Remove"
                      >
                        <X size={13} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Field>
        ) : (
          <Field label={isTask ? "KPI Group" : label} required>
            <Input
              value={kpiDesc}
              onChange={(e) => setKpiDesc(e.target.value)}
              disabled={isEdit && (itemType === "SKILL" || itemType === "GOAL")}
              placeholder={
                isTask
                  ? "Enter KPI group name (e.g. General Accountabilities)"
                  : `Enter ${label.toLowerCase()} name`
              }
              autoFocus
            />
            {isEdit && kpiCode && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Code: <span className="font-mono">{kpiCode}</span>
              </p>
            )}
          </Field>
        )}

        {needsWeightage && (
          <Field label="Weightage %" required>
            <Input
              type="number"
              value={weightage}
              onChange={(e) => setWeightage(Number(e.target.value))}
              min={0}
              max={100}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Available: <strong>{Math.max(0, 100 - (totalWeightage - (isEdit ? number(existingRow?.WEIGHTAGE || existingRow?.STANDARD_WEIGHTAGE) : 0)))}%</strong>
              {" "}(Current total: {totalWeightage}%)
            </p>
          </Field>
        )}

        {needsActivities && (
          <Field label="Activities" required>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs ${activities.length < 3 || activities.length > 6 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  {activities.length === 0
                    ? "Add activities below"
                    : ``}
                </span>
                <Button 
                  type="button"
                  size="sm" 
                  onClick={addActivityRow}
                  disabled={activities.length >= 6} 
                >
                  <Plus size={13} /> Add Activity
                </Button>
              </div>

              {activities.length === 0 ? (
                <p className="rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Click "Add Activity" to add one. Minimum 3, Maximum 6 required.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  {activities.map((activity, i) => {
                    // Case-insensitive duplicate check
                    const isDuplicate =
                      activity.trim() !== "" &&
                      activities.some(
                        (a, idx) =>
                          idx !== i &&
                          a.trim().toLowerCase() === activity.trim().toLowerCase()
                      );
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                          {i + 1}.
                        </span>
                        <Input
                          data-activity-input
                          value={activity}
                          onChange={(e) => updateActivity(i, e.target.value)}
                          placeholder="Enter activity..."
                          className={`flex-1 h-8 text-xs ${
                            isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""
                          }`}
                          autoFocus={i === activities.length - 1 && activity === ""}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeActivity(i)}
                          title="Remove"
                        >
                          <X size={13} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>
        )}
      </form>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PERIOD FORM MODAL
// ═══════════════════════════════════════════════════════════════════
function PeriodFormModal({
  open, onClose, existingPeriod, companyCode, loginid, onSave,
}: {
  open: boolean;
  onClose: () => void;
  existingPeriod: Row | null;
  companyCode: string;
  loginid: string;
  onSave: (savedPeriodNumber?: string) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!existingPeriod;
  const [periodType, setPeriodType] = useState("Q");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodNumber, setPeriodNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingPeriod) {
      setPeriodType(text(existingPeriod.PERIOD_TYPE) || "Q");
      setFromDate(toInputDate(existingPeriod.PERIOD_FROM_DATE));
      setToDate(toInputDate(existingPeriod.PERIOD_TO_DATE));
      setPeriodNumber(text(existingPeriod.PERIOD_NUMBER));
    } else {
      setPeriodType("Q");
      setFromDate("");
      setToDate("");
      setPeriodNumber("");
    }
  }, [open, existingPeriod]);

  useEffect(() => {
    if (!fromDate) return;
    if (!isEdit) {
      setPeriodNumber(generatePeriodNumber(periodType, fromDate));
      setToDate(calculateEndDate(periodType, fromDate));
    }
  }, [fromDate, periodType, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!fromDate) { toast.warning("From Date is required"); return; }
    if (!toDate)   { toast.warning("To Date is required");   return; }
    if (!periodNumber) { toast.warning("Period Number is required"); return; }

    setSaving(true);
    try {
      await pamsSave({
        parameter: "period_ins_upd",
        loginid,
        val1s1: periodNumber,
        val1s2: formatProcedureDate(fromDate),
        val1s3: formatProcedureDate(toDate),
        val1s4: companyCode,
        val1s5: periodType,
      });
      toast.success(isEdit ? "Period updated" : "Period created");
      onSave(periodNumber);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save period");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      title={isEdit ? "Edit Period" : "Add New Period"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="period-form" disabled={saving}>
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="period-form" className="grid gap-3" onSubmit={handleSubmit}>
        <Field label="Period Type" required>
          <div className="flex gap-2">
            {[
              { value: "Q", label: "Quarter" },
              { value: "M", label: "Month" },
              { value: "Y", label: "Year" },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                disabled={isEdit}
                onClick={() => setPeriodType(type.value)}
                className={`h-8 flex-1 rounded-md border text-xs font-medium transition-colors ${periodType === type.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="From Date" required>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-2 text-sm" />
          </Field>
          <Field label="To Date" required>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-2 text-sm" />
          </Field>
          <Field label="Period Number" required>
            <Input
              value={periodNumber}
              onChange={(e) => setPeriodNumber(e.target.value)}
              disabled={isEdit}
              placeholder="Auto-generated"
              className="h-2 text-sm"
            />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function assignmentRowKey(row: Row) {
  return [
    row.KPI_CODE,
    row.DIVISION_CODE || row.DIV_CODE,
    row.DEPARTMENT_CODE || row.DEPT_CODE,
    row.EMPLOYEE_CODE,
  ].map(text).join("|");
}

function splitItems(value: unknown) {
  const seen = new Set<string>();
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function normalizeRow(row: Row): Row {
  const out: Row = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    out[k] = v;
    out[k.toUpperCase()] = v;
    out[k.toLowerCase()] = v;
  });
  return out;
}

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function number(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
}

function toInputDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatProcedureDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

function generatePeriodNumber(type: string, fromDate: string): string {
  if (!fromDate) return "";
  const d = new Date(fromDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (type === "Q") return `Q${Math.ceil(month / 3)}-${year}`;
  if (type === "M") {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${months[month - 1]}-${year}`;
  }
  if (type === "Y") return String(year);
  return "";
}

function calculateEndDate(type: string, fromDate: string): string {
  if (!fromDate) return "";
  const to = new Date(fromDate);
  if (type === "Q") { to.setMonth(to.getMonth() + 3); to.setDate(to.getDate() - 1); }
  else if (type === "M") { to.setMonth(to.getMonth() + 1); to.setDate(to.getDate() - 1); }
  else if (type === "Y") { to.setFullYear(to.getFullYear() + 1); to.setDate(to.getDate() - 1); }
  return to.toISOString().slice(0, 10);
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}{required && <strong className="text-destructive"> *</strong>}</span>
      {children}
    </div>
  );
}