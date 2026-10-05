import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { pamsDelete, pamsSave, pamsSelect } from "../../api/pams";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { LookupRow } from "../../api/lookups";
import ImportKpiEdi from "./Importkpiedi";
import { DataTable } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/AlertToast";

type Row = Record<string, unknown>;

type KpiForm = {
  KPI_CODE: string;
  KPI_TYPE_CODE: string;
  KPI_DESC: string;
  DIVISION_CODE: string;
  DEPARTMENT_CODE: string;
  SECTION_CODE: string;
  DESG_CODE: string;
  STANDARD_WEIGHTAGE: number;
};

type Activity = { srno: number; desc: string };

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
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

// 🔹 display helper — code + name (duplicate code prefix avoid karta hai)
function displayLookup(list: Row[], codeKey: string, nameKey: string, code: string): string {
  if (!code) return "";
  const found = list.find((r) => text(r[codeKey]) === code);
  if (!found) return code;
  const name = text(found[nameKey]);
  if (!name) return code;
  if (name.startsWith(code)) return name; // already contains "code - name"
  return `${code} - ${name}`;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

export function KpiGroupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [form, setForm] = useState<KpiForm>({
    KPI_CODE: "",
    KPI_TYPE_CODE: "",
    KPI_DESC: "",
    DIVISION_CODE: "",
    DEPARTMENT_CODE: "",
    SECTION_CODE: "",
    DESG_CODE: "",
    STANDARD_WEIGHTAGE: 0,
  });

  // ── Lookups ──────────────────────────────────────────────
  const [kpiTypeList, setKpiTypeList] = useState<Row[]>([]);
  const [divisionList, setDivisionList] = useState<Row[]>([]);
  const [departmentList, setDepartmentList] = useState<Row[]>([]);
  const [designationList, setDesignationList] = useState<Row[]>([]);

  // ── Activities ───────────────────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([]);

  // ═════════════════════════════════════════════════════════
  // DATA LOADERS
  // ═════════════════════════════════════════════════════════
  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await pamsSelect({ parameter: "kpi", loginid, code1: companyCode });
      setRows(data.map(normalizeRow));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load KPI Groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [loginid, companyCode]);

  const loadStaticLookups = async () => {
  try {
    const [kpiTypes, divisions] = await Promise.all([
      pamsSelect({ parameter: "kpi_type", loginid, code1: companyCode }),
      pamsSelect({ parameter: "employee_division", loginid, code1: companyCode }),  
    ]);
    setKpiTypeList(kpiTypes.map(normalizeRow));
    setDivisionList(                                                  
      divisions.map(normalizeRow).filter((r) => text(r.DIV_CODE).toUpperCase() !== "ALL")
    );
  } catch {
    setKpiTypeList([]);
    setDivisionList([]);                                            
  }
};

  const loadDepartments = async (divCode: string) => {
  if (!divCode) { setDepartmentList([]); return; }
  try {
    const data = await pamsSelect({
      parameter: "employee_department",   
      loginid,
      code1: companyCode,
      code2: divCode,
    });
    setDepartmentList(
      data.map(normalizeRow).filter((r) => text(r.DEPT_CODE).toUpperCase() !== "ALL")
    );
  } catch {
    setDepartmentList([]);
  }
};

  const loadDesignations = async (divCode: string, deptCode: string) => {
  if (!divCode || !deptCode) { setDesignationList([]); return; }
  try {
    const data = await pamsSelect({
      parameter: "employee_designation",  
      loginid,
      code1: companyCode,
      code2: divCode,
      code3: deptCode,
      code4: "All",                     
    });
    setDesignationList(
      data.map(normalizeRow).filter((r) => text(r.DESG_CODE).toUpperCase() !== "ALL")
    );
  } catch {
    setDesignationList([]);
  }
};

  const loadActivities = async (kpiCode: string) => {
    if (!kpiCode) {
      setActivities([]);
      return;
    }
    try {
      const data = await pamsSelect({
        parameter: "kpi_item_page",
        loginid,
        code1: companyCode,
        code2: kpiCode,
      });
      setActivities(
        data.map((r: Row) => ({
          srno: Number(r.KPI_ITEM_SRNO ?? 0),
          desc: text(r.KPI_ITEM_DESC),
        }))
      );
    } catch {
      setActivities([]);
    }
  };

  // ═════════════════════════════════════════════════════════
  // CASCADING HANDLERS — Division → Dept → Desg
  // ═════════════════════════════════════════════════════════
  const onDivisionChange = async (divCode: string) => {
    setForm((prev) => ({ ...prev, DIVISION_CODE: divCode, DEPARTMENT_CODE: "", DESG_CODE: "" }));
    setDepartmentList([]);
    setDesignationList([]);
    if (divCode) await loadDepartments(divCode);
  };

  const onDepartmentChange = async (deptCode: string) => {
    setForm((prev) => ({ ...prev, DEPARTMENT_CODE: deptCode, DESG_CODE: "" }));
    setDesignationList([]);
    if (deptCode && form.DIVISION_CODE) {
      await loadDesignations(form.DIVISION_CODE, deptCode);
    }
  };

  // ═════════════════════════════════════════════════════════
  // ACTIVITY HANDLERS
  // ═════════════════════════════════════════════════════════
  const addActivity = () => setActivities((p) => [...p, { srno: 0, desc: "" }]);
  const updateActivity = (idx: number, desc: string) =>
    setActivities((p) => p.map((a, i) => (i === idx ? { ...a, desc } : a)));
  const removeActivity = (idx: number) => setActivities((p) => p.filter((_, i) => i !== idx));

  // ═════════════════════════════════════════════════════════
  // OPEN ADD / EDIT / VIEW
  // ═════════════════════════════════════════════════════════
  const openAdd = async () => {
    setEditMode(false);
    setViewMode(false);
    setDepartmentList([]);
    setDesignationList([]);
    setActivities([]);
    setForm({
      KPI_CODE: "",
      KPI_TYPE_CODE: "",
      KPI_DESC: "",
      DIVISION_CODE: "",
      DEPARTMENT_CODE: "",
      SECTION_CODE: "",
      DESG_CODE: "",
      STANDARD_WEIGHTAGE: 0,
    });
    setFormOpen(true);
    await loadStaticLookups();
  };

  const openEdit = async (row: Row) => {
    const divCode = text(row.DIVISION_CODE);
    const deptCode = text(row.DEPARTMENT_CODE);

    setEditMode(true);
    setViewMode(false);
    setForm({
      KPI_CODE: text(row.KPI_CODE),
      KPI_TYPE_CODE: text(row.KPI_TYPE_CODE),
      KPI_DESC: text(row.KPI_DESC),
      DIVISION_CODE: divCode,
      DEPARTMENT_CODE: deptCode,
      SECTION_CODE: text(row.SECTION_CODE),
      DESG_CODE: text(row.DESG_CODE),
      STANDARD_WEIGHTAGE: Number(row.STANDARD_WEIGHTAGE ?? 0),
    });

    setFormOpen(true);
    await loadStaticLookups();
    await loadDepartments(divCode);
    await loadDesignations(divCode, deptCode);
    await loadActivities(text(row.KPI_CODE));
  };

  const openView = async (row: Row) => {
    const divCode = text(row.DIVISION_CODE);
    const deptCode = text(row.DEPARTMENT_CODE);

    setEditMode(false);
    setViewMode(true);
    setForm({
      KPI_CODE: text(row.KPI_CODE),
      KPI_TYPE_CODE: text(row.KPI_TYPE_CODE),
      KPI_DESC: text(row.KPI_DESC),
      DIVISION_CODE: divCode,
      DEPARTMENT_CODE: deptCode,
      SECTION_CODE: text(row.SECTION_CODE),
      DESG_CODE: text(row.DESG_CODE),
      STANDARD_WEIGHTAGE: Number(row.STANDARD_WEIGHTAGE ?? 0),
    });

    setFormOpen(true);
    await loadStaticLookups();
    await loadDepartments(divCode);
    await loadDesignations(divCode, deptCode);
    await loadActivities(text(row.KPI_CODE));
  };

  const updateField = (name: keyof KpiForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ═════════════════════════════════════════════════════════
  // SAVE
  // ═════════════════════════════════════════════════════════
  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();

    // 🔹 New validations (no employee)
    if (!form.KPI_TYPE_CODE.trim()) {
      toast.warning("KPI Type Code is required");
      return;
    }
    if (!form.DIVISION_CODE.trim()) {
      toast.warning("Division is required");
      return;
    }
    if (!form.DEPARTMENT_CODE.trim()) {
      toast.warning("Department is required");
      return;
    }
    if (!form.DESG_CODE.trim()) {
      toast.warning("Designation is required");
      return;
    }
    if (!form.KPI_DESC.trim()) {
      toast.warning("KPI Description is required");
      return;
    }

    const validActivities = activities.filter((a) => a.desc.trim());
    if (validActivities.length < 3) {
      toast.warning(`Minimum 3 KPI Items (Activities) required. Currently: ${validActivities.length}`);
      return;
    }
    if (validActivities.length > 6) {
      toast.warning(`Maximum 6 KPI Items (Activities) allowed. Currently: ${validActivities.length}`);
      return;
    }

    setSaving(true);

    try {
      // 1. KPI master save
      await pamsSave({
        parameter: "kpi_ins_upd",
        loginid,
        val1s1: form.KPI_CODE,
        val1s2: form.KPI_DESC,
        val1s3: form.KPI_TYPE_CODE,
        val1s4: companyCode,
        val1s5: form.DIVISION_CODE,
        val1s6: form.DEPARTMENT_CODE,
        val1s7: form.SECTION_CODE,
        val1s8: form.DESG_CODE,
        val1n1: form.STANDARD_WEIGHTAGE,
      });

      // 2. KPI_CODE resolve
      let kpiCode = form.KPI_CODE;
      if (!kpiCode) {
        const refreshed = await pamsSelect({ parameter: "kpi", loginid, code1: companyCode });
        const matches = refreshed
          .map(normalizeRow)
          .filter(
            (r) =>
              text(r.KPI_DESC) === form.KPI_DESC &&
              text(r.DIVISION_CODE) === form.DIVISION_CODE &&
              text(r.DEPARTMENT_CODE) === form.DEPARTMENT_CODE &&
              text(r.DESG_CODE) === form.DESG_CODE
          )
          .sort((a, b) => Number(text(b.KPI_CODE)) - Number(text(a.KPI_CODE)));

        kpiCode = matches.length > 0 ? text(matches[0].KPI_CODE) : "";
      }

      // 3. Activities save
      if (kpiCode) {
        if (editMode) {
          await pamsSave({
            parameter: "kpi_item_delete_all",
            loginid,
            val1s1: companyCode,
            val1s2: kpiCode,
          });
        }
        let srno = 1;
        for (const act of activities) {
          if (!act.desc.trim()) continue;
          await pamsSave({
            parameter: "kpi_item_ins_upd",
            loginid,
            val1s1: companyCode,
            val1s2: kpiCode,
            val1s3: act.desc,
            val1n1: srno,
          });
          srno++;
        }
      }

      setFormOpen(false);
      toast.success(editMode ? "KPI updated successfully" : "KPI added successfully");
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save KPI");
    } finally {
      setSaving(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // DELETE
  // ═════════════════════════════════════════════════════════
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await pamsDelete({
        parameter: "delete_kpi",
        loginid,
        code1: text(deleteTarget.KPI_CODE),
        code2: text(deleteTarget.KPI_TYPE_CODE),
        code3: companyCode,
      });
      setDeleteTarget(null);
      toast.success("KPI deleted successfully");
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete KPI");
    } finally {
      setSaving(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // COLUMNS
  // ═════════════════════════════════════════════════════════
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "KPI_TYPE_CODE", header: "KPI Type Code", size: 140, enableColumnFilter: true, filterFn: "includesString" },
      { accessorKey: "KPI_CODE", header: "KPI Code", size: 120, enableColumnFilter: true, filterFn: "includesString" },
      { accessorKey: "KPI_DESC", header: "KPI Desc", size: 260, enableColumnFilter: true, filterFn: "includesString" },
      {
        id: "kpiItems",
        header: "KPI Items (Activities)",
        size: 500,
        enableColumnFilter: true,
        filterFn: (row, _c, filterValue) => {
          const items = text(row.original.KPI_ITEMS ?? row.original.kpi_items).toLowerCase();
          return items.includes(String(filterValue ?? "").toLowerCase());
        },
        cell: ({ row }) => {
          const items = text(row.original.KPI_ITEMS ?? row.original.kpi_items);
          if (!items) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="grid gap-1 py-1 text-xs leading-relaxed">
              {items.split(" | ").map((it, i) => (
                <div key={i} className="whitespace-normal break-words" title={it}>• {it}</div>
              ))}
            </div>
          );
        },
      },
      { id: "division", accessorFn: (r) => orgLabel(r, "DIVISION_CODE", "DIVISION_NAME"), header: "Division", size: 230, enableColumnFilter: true, filterFn: "includesString" },
      { id: "department", accessorFn: (r) => orgLabel(r, "DEPARTMENT_CODE", "DEPARTMENT_NAME"), header: "Department", size: 180, enableColumnFilter: true, filterFn: "includesString" },
      { id: "designation", accessorFn: (r) => orgLabel(r, "DESG_CODE", "DESG_NAME"), header: "Designation", size: 200, enableColumnFilter: true, filterFn: "includesString" },
      { accessorKey: "STANDARD_WEIGHTAGE", header: "Weightage", size: 110, enableColumnFilter: true, filterFn: "includesString" },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableColumnFilter: false,
        meta: { sticky: "right" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="View" onClick={() => void openView(row.original)}><Eye size={14} /></Button>
            <Button size="icon" variant="ghost" title="Edit" onClick={() => void openEdit(row.original)}><Edit2 size={14} /></Button>
            <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}><Trash2 size={14} /></Button>
          </div>
        ),
      },
    ],
    []
  );

  const kpiTypeOptions = kpiTypeList.map(normalizeRow);
  const divisionOptions = divisionList.map(normalizeRow);
  const deptOptions = departmentList.map(normalizeRow);
  const desgOptions = designationList.map(normalizeRow);

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Maintain KPI groups, activities, weightage, and organization scope.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search KPI groups..."
        loading={loading}
        height={620}
        minWidth={1850}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => `${text(row.KPI_CODE)}_${text(row.KPI_TYPE_CODE)}_${index}`}
        enableExport={false}
        toolbar={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload size={15} /> Import from Excel
            </Button>
            <Button onClick={openAdd}>
              <Plus size={15} /> Add KPI
            </Button>
          </>
        }
      />

      {/* ════════ IMPORT DIALOG (unchanged) ════════ */}
      <Dialog open={importOpen} wide title="Import KPI from Excel"
        description="Upload an Excel file to bulk import KPI records into MS_EAM_KPI."
        onClose={() => setImportOpen(false)}>
        <ImportKpiEdi
          onClose={() => setImportOpen(false)}
          onSuccess={async () => {
            setImportOpen(false);
            toast.success("KPI records imported successfully.");
            await loadRows();
          }}
        />
      </Dialog>

      {/* ════════ ADD / EDIT / VIEW DIALOG ════════ */}
      <Dialog
        open={formOpen}
        wide
        title={viewMode ? "View KPI" : editMode ? "Edit KPI" : "Add KPI"}
        description="Maintain KPI group setup."
        onClose={() => setFormOpen(false)}
      >
        <form className="grid gap-4" onSubmit={saveRecord}>
          {/* ============ KPI INFORMATION ============ */}
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">KPI Information</h2>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 pt-4">
              {/* Row 1: KPI Type + Division */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="KPI Type Code" required>
                  <LookupField
                    compact
                    disabled={viewMode || editMode}
                    label="KPI Type Code"
                    value={form.KPI_TYPE_CODE}
                    displayValue={displayLookup(kpiTypeOptions, "KPI_TYPE_CODE", "KPI_TYPE_DESC", form.KPI_TYPE_CODE)}
                    placeholder="Select KPI Type"
                    columns={[
                      { field: "KPI_TYPE_CODE", header: "Code" },
                      { field: "KPI_TYPE_DESC", header: "Description" },
                    ]}
                    valueField="KPI_TYPE_CODE"
                    displayFields={["KPI_TYPE_CODE", "KPI_TYPE_DESC"]}
                    loadOptions={async () => kpiTypeOptions as LookupRow[]}
                    onChange={(val) => updateField("KPI_TYPE_CODE", val)}
                  />
                </Field>

                <Field label="Division" required>
                  <LookupField
                    compact
                    disabled={viewMode || editMode}
                    label="Division"
                    value={form.DIVISION_CODE}
                    displayValue={displayLookup(divisionOptions, "DIV_CODE", "DIV_NAME", form.DIVISION_CODE)}
                    placeholder="Select Division"
                    columns={[
                      { field: "DIV_CODE", header: "Code" },
                      { field: "DIV_NAME", header: "Name" },
                    ]}
                    valueField="DIV_CODE"
                    displayFields={["DIV_CODE", "DIV_NAME"]}
                    loadOptions={async () => divisionOptions as LookupRow[]}
                    onChange={(val) => void onDivisionChange(val)}
                  />
                </Field>
              </div>

              {/* Row 2: Department + Designation */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Department" required>
                  <LookupField
                    compact
                    disabled={viewMode || editMode || !form.DIVISION_CODE}
                    label="Department"
                    value={form.DEPARTMENT_CODE}
                    displayValue={displayLookup(deptOptions, "DEPT_CODE", "DEPT_NAME", form.DEPARTMENT_CODE)}
                    placeholder={!form.DIVISION_CODE ? "Select Division first" : "Select Department"}
                    columns={[
                      { field: "DEPT_CODE", header: "Code" },
                      { field: "DEPT_NAME", header: "Name" },
                    ]}
                    valueField="DEPT_CODE"
                    displayFields={["DEPT_CODE", "DEPT_NAME"]}
                    loadOptions={async () => deptOptions as LookupRow[]}
                    onChange={(val) => void onDepartmentChange(val)}
                  />
                </Field>

                <Field label="Designation" required>
                  <LookupField
                    compact
                    disabled={viewMode || editMode || !form.DEPARTMENT_CODE}
                    label="Designation"
                    value={form.DESG_CODE}
                    displayValue={displayLookup(desgOptions, "DESG_CODE", "DESG_NAME", form.DESG_CODE)}
                    placeholder={
                      !form.DIVISION_CODE
                        ? "Select Division first"
                        : !form.DEPARTMENT_CODE
                          ? "Select Department first"
                          : "Select Designation"
                    }
                    columns={[
                      { field: "DESG_CODE", header: "Code" },
                      { field: "DESG_NAME", header: "Name" },
                    ]}
                    valueField="DESG_CODE"
                    displayFields={["DESG_CODE", "DESG_NAME"]}
                    loadOptions={async () => desgOptions as LookupRow[]}
                    onChange={(val) => updateField("DESG_CODE", val)}
                  />
                </Field>
              </div>

              {/* Row 3: Weightage + KPI Description */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Standard Weightage">
                  <Input
                    disabled={viewMode}
                    type="number"
                    value={form.STANDARD_WEIGHTAGE}
                    onChange={(e) => updateField("STANDARD_WEIGHTAGE", Number(e.target.value || 0))}
                    min={0}
                    max={100}
                    placeholder="Enter weightage"
                  />
                </Field>

                <div className="lg:col-span-2">
                  <Field label="KPI Description (KPI Group)" required>
                    <textarea
                      disabled={viewMode}
                      className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                      value={form.KPI_DESC}
                      onChange={(e) => updateField("KPI_DESC", e.target.value)}
                      placeholder="Enter KPI description"
                    />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============ ACTIVITIES ============ */}
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Activities / KPI Items</p>
                {!viewMode && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addActivity}
                    disabled={activities.length >= 6}
                    className="gap-1"
                  >
                    <Plus size={14} /> Add Activity
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {activities.length === 0 ? (
                <p className="rounded-md bg-muted/30 py-4 text-center text-sm text-muted-foreground">
                  No activities added. Click "Add Activity" to add.
                </p>
              ) : (
                <div className="grid gap-2">
                  {activities.map((act, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-md border bg-background p-2">
                      <span className="w-6 text-right text-xs text-muted-foreground">{idx + 1}.</span>
                      <Input
                        value={act.desc}
                        disabled={viewMode}
                        onChange={(e) => updateActivity(idx, e.target.value)}
                        placeholder="Enter activity description"
                      />
                      {!viewMode && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeActivity(idx)}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            {!viewMode && (
              <Button type="submit">
                <Save size={15} /> {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </form>
      </Dialog>

      {/* ════════ DELETE DIALOG (unchanged) ════════ */}
      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete KPI"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Please confirm to delete KPI <strong>{text(deleteTarget?.KPI_CODE)}</strong> — {text(deleteTarget?.KPI_DESC)}.
        </p>
      </Dialog>
    </section>
  );
}