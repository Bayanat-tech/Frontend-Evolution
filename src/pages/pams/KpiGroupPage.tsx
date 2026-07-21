import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { pamsDelete, pamsSave, pamsSelect } from "../../api/pams";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import type { LookupRow } from "../../api/lookups";
import ImportKpiEdi from "./Importkpiedi";
import { DataTable } from "../../components/ui/PamsDataTable";



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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}{required && <strong className="text-destructive"> *</strong>}</span>
      {children}
    </div>
  );
}


export function KpiGroupPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
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

  const [kpiTypeList, setKpiTypeList] = useState<Row[]>([]);
  const [divisionList, setDivisionList] = useState<Row[]>([]);
  const [departmentList, setDepartmentList] = useState<Row[]>([]);
  const [sectionList, setSectionList] = useState<Row[]>([]);
  const [designationList, setDesignationList] = useState<Row[]>([]);
  const [formError, setFormError] = useState("");

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await pamsSelect({ parameter: "kpi", loginid, code1: companyCode });
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load KPI Groups" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [loginid, companyCode]);

  const loadStaticLookups = async () => {
    try {
      const [kpiTypes, divisions] = await Promise.all([
        pamsSelect({ parameter: "kpi_type", loginid, code1: companyCode }),
        pamsSelect({ parameter: "division", loginid, code1: companyCode }),
      ]);
      setKpiTypeList(kpiTypes.map(normalizeRow));
      setDivisionList(divisions.map(normalizeRow));
    } catch {
      setKpiTypeList([]);
      setDivisionList([]);
    }
  };

  const loadDepartments = async (divisionCode: string) => {
    if (!divisionCode) { setDepartmentList([]); setSectionList([]); setDesignationList([]); return; }
    try {
      const data = await pamsSelect({ parameter: "department", loginid, code1: companyCode, code2: divisionCode });
      setDepartmentList(data.map(normalizeRow));
    } catch { setDepartmentList([]); }
  };

  const loadSectionsAndDesignations = async (divisionCode: string, departmentCode: string) => {
    if (!departmentCode) { setSectionList([]); setDesignationList([]); return; }
    try {
      const [sections, designations] = await Promise.all([
        pamsSelect({ parameter: "section", loginid, code1: companyCode, code2: divisionCode, code3: departmentCode }),
        pamsSelect({ parameter: "designation", loginid, code1: companyCode, code2: divisionCode, code3: departmentCode }),
      ]);
      setSectionList(sections.map(normalizeRow));
      setDesignationList(designations.map(normalizeRow));
    } catch { setSectionList([]); setDesignationList([]); }
  };

  const openAdd = () => {
    setEditMode(false);
    setViewMode(false);
    setForm({ KPI_CODE: "", KPI_TYPE_CODE: "", KPI_DESC: "", DIVISION_CODE: "", DEPARTMENT_CODE: "", SECTION_CODE: "", DESG_CODE: "", STANDARD_WEIGHTAGE: 0 });
    setDepartmentList([]);
    setSectionList([]);
    setDesignationList([]);
    setFormError("");
    setFormOpen(true);
    void loadStaticLookups();
  };

  const openEdit = async (row: Row) => {
    setEditMode(true);
    setViewMode(false);
    setForm({
      KPI_CODE: text(row.KPI_CODE),
      KPI_TYPE_CODE: text(row.KPI_TYPE_CODE),
      KPI_DESC: text(row.KPI_DESC),
      DIVISION_CODE: text(row.DIVISION_CODE),
      DEPARTMENT_CODE: text(row.DEPARTMENT_CODE),
      SECTION_CODE: text(row.SECTION_CODE),
      DESG_CODE: text(row.DESG_CODE),
      STANDARD_WEIGHTAGE: Number(row.STANDARD_WEIGHTAGE ?? 0),
    });
    setFormError("");
    setFormOpen(true);
    await loadStaticLookups();
    await loadDepartments(text(row.DIVISION_CODE));
    await loadSectionsAndDesignations(text(row.DIVISION_CODE), text(row.DEPARTMENT_CODE));
  };

  const openView = async (row: Row) => {
    setEditMode(false);
    setViewMode(true);
    setForm({
      KPI_CODE: text(row.KPI_CODE),
      KPI_TYPE_CODE: text(row.KPI_TYPE_CODE),
      KPI_DESC: text(row.KPI_DESC),
      DIVISION_CODE: text(row.DIVISION_CODE),
      DEPARTMENT_CODE: text(row.DEPARTMENT_CODE),
      SECTION_CODE: text(row.SECTION_CODE),
      DESG_CODE: text(row.DESG_CODE),
      STANDARD_WEIGHTAGE: Number(row.STANDARD_WEIGHTAGE ?? 0),
    });
    setFormError("");
    setFormOpen(true);
    await loadStaticLookups();
    await loadDepartments(text(row.DIVISION_CODE));
    await loadSectionsAndDesignations(text(row.DIVISION_CODE), text(row.DEPARTMENT_CODE));
  };

  const updateField = (name: keyof KpiForm, value: string | number) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "DIVISION_CODE") {
        next.DEPARTMENT_CODE = "";
        next.SECTION_CODE = "";
        next.DESG_CODE = "";
        void loadDepartments(text(value));
        setSectionList([]);
        setDesignationList([]);
      }
      if (name === "DEPARTMENT_CODE") {
        next.SECTION_CODE = "";
        next.DESG_CODE = "";
        void loadSectionsAndDesignations(prev.DIVISION_CODE, text(value));
      }
      return next;
    });
  };

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.KPI_TYPE_CODE.trim()) { setFormError("KPI Type Code is required"); return; }
    if (!form.KPI_DESC.trim()) { setFormError("KPI Description is required"); return; }
    setSaving(true);
    setFormError("");
    try {
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
      setFormOpen(false);
      setNotice({ type: "success", message: editMode ? "KPI updated successfully" : "KPI added successfully" });
      await loadRows(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save KPI");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setNotice(null);
    try {
      await pamsDelete({
        parameter: "delete_kpi",
        loginid,
        code1: text(deleteTarget.KPI_CODE),
        code2: text(deleteTarget.KPI_TYPE_CODE),
        code3: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "KPI deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete KPI" });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "KPI_TYPE_CODE", header: "KPI Type Code", size: 160, cell: ({ row }) => formatValue(row.original.KPI_TYPE_CODE) },
    { accessorKey: "KPI_CODE",      header: "KPI Code",      size: 140, cell: ({ row }) => formatValue(row.original.KPI_CODE) },
    { accessorKey: "KPI_DESC",      header: "KPI Desc",      size: 280, cell: ({ row }) => formatValue(row.original.KPI_DESC) },
    {
      id: "division", header: "Division", size: 250,
      cell: ({ row }) => orgLabel(row.original, "DIVISION_CODE", "DIVISION_NAME"),
    },
    {
      id: "department", header: "Department", size: 180,
      cell: ({ row }) => orgLabel(row.original, "DEPARTMENT_CODE", "DEPARTMENT_NAME"),
    },
    {
      id: "section", header: "Section", size: 220,
      cell: ({ row }) => orgLabel(row.original, "SECTION_CODE", "SECTION_NAME"),
    },
    {
      id: "designation", header: "Designation", size: 220,
      cell: ({ row }) => orgLabel(row.original, "DESG_CODE", "DESG_NAME"),
    },
    { accessorKey: "STANDARD_WEIGHTAGE", header: "Weightage", size: 130, cell: ({ row }) => formatValue(row.original.STANDARD_WEIGHTAGE) },
    {
      id: "actions", header: "Actions", size: 110,
      meta: { sticky: "right" },
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="View"   onClick={() => void openView(row.original)}><Eye    size={14} /></Button>
          <Button size="icon" variant="ghost" title="Edit"   onClick={() => void openEdit(row.original)}><Edit2  size={14} /></Button>
          <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ], []);

  const kpiTypeOptions   = kpiTypeList.map(normalizeRow);
  const divisionOptions  = divisionList.map(normalizeRow);
  const deptOptions      = departmentList.map(normalizeRow);
  const sectionOptions   = sectionList.map(normalizeRow);
  const desgOptions      = designationList.map(normalizeRow);

  const findLabel = (list: Row[], valueKey: string, labelKey: string, val: string) => {
    const found = list.find((r) => text(r[valueKey]) === val);
    return found ? `${text(found[valueKey])} - ${text(found[labelKey])}` : val;
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Maintain KPI groups, weightage, and organization scope.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import from Excel
          </Button>
          <Button onClick={openAdd}><Plus size={15} /> Add KPI</Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="KPI Groups List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search KPI groups..."
        loading={loading}
        height={620}
        minWidth={1600}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => `${text(row.KPI_CODE)}_${text(row.KPI_TYPE_CODE)}_${index}`}
      />

      <Dialog
        open={importOpen}
        wide
        title="Import KPI from Excel"
        description="Upload an Excel file to bulk import KPI records into MS_EAM_KPI."
        onClose={() => setImportOpen(false)}
      >
        <ImportKpiEdi
          onClose={() => setImportOpen(false)}
          onSuccess={async () => {
            setImportOpen(false);
            setNotice({ type: "success", message: "KPI records imported successfully." });
            await loadRows(false); // ← table refresh hoga import ke baad
          }}
        />
      </Dialog>

      <Dialog
        open={formOpen}
        wide
        title={viewMode ? "View KPI" : editMode ? "Edit KPI" : "Add KPI"}
        description="Maintain KPI group setup."
        onClose={() => setFormOpen(false)}
      >
        <form className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">KPI Information</h2>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.5fr]">
                <Field label="KPI Code">
                  <Input
                    disabled
                    value={form.KPI_CODE || "Auto Generated"}
                    onChange={() => undefined}
                    className="bg-muted/40 text-muted-foreground"
                  />
                </Field>
                <Field label="KPI Type Code" required>
                  <LookupField
                    compact
                    disabled={viewMode || editMode}
                    label="KPI Type Code"
                    value={form.KPI_TYPE_CODE}
                    displayValue={findLabel(kpiTypeOptions, "KPI_TYPE_CODE", "KPI_TYPE_DESC", form.KPI_TYPE_CODE)}
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
                <Field label="Division">
                  <LookupField
                    compact
                    disabled={viewMode}
                    label="Division"
                    value={form.DIVISION_CODE}
                    displayValue={findLabel(divisionOptions, "DIV_CODE", "DIV_NAME", form.DIVISION_CODE)}
                    placeholder="Select Division"
                    columns={[
                      { field: "DIV_CODE", header: "Code" },
                      { field: "DIV_NAME", header: "Name" },
                    ]}
                    valueField="DIV_CODE"
                    displayFields={["DIV_CODE", "DIV_NAME"]}
                    loadOptions={async () => divisionOptions as LookupRow[]}
                    onChange={(val) => updateField("DIVISION_CODE", val)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Department">
                  <LookupField
                    compact
                    disabled={viewMode || !form.DIVISION_CODE}
                    label="Department"
                    value={form.DEPARTMENT_CODE}
                    displayValue={findLabel(deptOptions, "DEPT_CODE", "DEPT_NAME", form.DEPARTMENT_CODE)}
                    placeholder={form.DIVISION_CODE ? "Select Department" : "Select Division first"}
                    columns={[
                      { field: "DEPT_CODE", header: "Code" },
                      { field: "DEPT_NAME", header: "Name" },
                    ]}
                    valueField="DEPT_CODE"
                    displayFields={["DEPT_CODE", "DEPT_NAME"]}
                    loadOptions={async () => deptOptions as LookupRow[]}
                    onChange={(val) => updateField("DEPARTMENT_CODE", val)}
                  />
                </Field>
                <Field label="Section">
                  <LookupField
                    compact
                    disabled={viewMode || !form.DEPARTMENT_CODE}
                    label="Section"
                    value={form.SECTION_CODE}
                    displayValue={findLabel(sectionOptions, "SECTION_CODE", "SECTION_NAME", form.SECTION_CODE)}
                    placeholder={form.DEPARTMENT_CODE ? "Select Section" : "Select Department first"}
                    columns={[
                      { field: "SECTION_CODE", header: "Code" },
                      { field: "SECTION_NAME", header: "Name" },
                    ]}
                    valueField="SECTION_CODE"
                    displayFields={["SECTION_CODE", "SECTION_NAME"]}
                    loadOptions={async () => sectionOptions as LookupRow[]}
                    onChange={(val) => updateField("SECTION_CODE", val)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Designation">
                  <LookupField
                    compact
                    disabled={viewMode || !form.DEPARTMENT_CODE}
                    label="Designation"
                    value={form.DESG_CODE}
                    displayValue={findLabel(desgOptions, "DESG_CODE", "DESG_NAME", form.DESG_CODE)}
                    placeholder={form.DEPARTMENT_CODE ? "Select Designation" : "Select Department first"}
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
                <Field label="Standard Weightage">
                  <Input
                    disabled={viewMode}
                    type="number"
                    value={form.STANDARD_WEIGHTAGE}
                    onChange={(e) => updateField("STANDARD_WEIGHTAGE", Number(e.target.value || 0))}
                    min={0}
                    max={100}
                  />
                </Field>
              </div>

              <div>
                <Field label="KPI Description" required>
                  <textarea
                    disabled={viewMode}
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    value={form.KPI_DESC}
                    onChange={(e) => updateField("KPI_DESC", e.target.value)}
                    placeholder="Enter KPI description"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <NoticeToast notice={formError ? { type: "error", message: formError } : null} onClose={() => setFormError("")} />

          <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            {!viewMode && (
              <Button disabled={saving} type="submit">
                <Save size={15} /> {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </form>
      </Dialog>

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