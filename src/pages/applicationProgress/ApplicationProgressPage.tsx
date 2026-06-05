import type { ColumnDef } from "@tanstack/react-table";
import { Check, Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveBTProject } from "../../api/applicationProgress";
import { executeCommonProcedure, getDynamicLookup, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import NoticeToast, { ToastNotice } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import { applyProgressCalculations, buildBTProjectPayloadRow, isStandardField, STATUS_SCORE_MAP } from "./progressCalculations";

type ProgressRow = Record<string, unknown> & {
  id?: string | number;
  module?: string;
  sub_modules?: string;
  activity?: string;
  weightage?: number | string;
  developer?: string;
  start_date?: string;
  est_completion_date?: string;
  end_date?: string;
  status?: string;
  tester?: string;
};

type EditorState = { mode: "create" | "edit"; row?: ProgressRow } | null;

const fieldLabels: Record<string, string> = {
  sub_modules: "Sub Module",
  activity: "Activity",
  weightage: "Weightage",
  developer: "Developer",
  start_date: "Start Date",
  est_completion_date: "Estimated Completion",
  end_date: "End Date",
  status: "Status",
  tester: "Tester",
};

const standardFields = ["standard_1", "standard_2", "standard_3", "standard_4", "standard_5", "standard_6", "standard_7"];
const dateFields = new Set(["start_date", "est_completion_date", "end_date"]);

const toDateInputValue = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeProgressRow = (row: ProgressRow): ProgressRow => {
  const normalized = { ...row };
  dateFields.forEach((field) => {
    normalized[field] = toDateInputValue(normalized[field]);
  });
  return applyProgressCalculations(normalized);
};

const emptyProgressRow = (module: string): ProgressRow => ({
  module,
  sub_modules: "",
  activity: "",
  weightage: 0,
  developer: "",
  start_date: "",
  est_completion_date: "",
  end_date: "",
  status: "Not Started (0%)",
  tester: "Garang P",
  standard_1: "N",
  standard_2: "N",
  standard_3: "N",
  standard_4: "N",
  standard_5: "N",
  standard_6: "N",
  standard_7: "N",
});

export function ApplicationProgressPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const companyCode = user?.company_code || "";
  const [activeTab, setActiveTab] = useState<"progress" | "summary">("progress");
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [dirtyRows, setDirtyRows] = useState<Record<string, ProgressRow>>({});

  const loadModules = async () => {
    const data = await getDynamicLookup({
      parameter: "APPLICATION_PROGRESS_MODULE_SELECTION",
      loginid,
      code1: companyCode,
    });
    const nextModules = data.map((row) => String(row.module ?? row.MODULE ?? "")).filter(Boolean);
    setModules(nextModules);
    setSelectedModule((current) => current || nextModules[0] || "");
  };

  const loadRows = async (module = selectedModule, clearNotice = true) => {
    if (!module) return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "APPLICATION_PROGRESS_MAIN_PAGE_DATA",
        loginid,
        code1: companyCode,
        code2: module,
      });
      setRows(data.map((row) => normalizeProgressRow(row as ProgressRow)));
      setDirtyRows({});
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load application progress" });
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await getDynamicLookup({ parameter: "APPLICATION_PROGRESS_SUMMARY", loginid });
      setSummaryRows(data);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load summary" });
    }
  };

  useEffect(() => {
    if (!loginid) return;
    void loadModules();
    void loadSummary();
  }, [loginid]);

  useEffect(() => {
    if (!selectedModule || !loginid) return;
    void loadRows(selectedModule);
  }, [selectedModule, loginid]);

  const updateRow = (id: string, patch: Partial<ProgressRow>) => {
    setRows((current) =>
      current.map((row, index) => {
        const rowId = String(row.id ?? index);
        if (rowId !== id) return row;
        const next = normalizeProgressRow({ ...row, ...patch });
        setDirtyRows((prev) => ({ ...prev, [rowId]: next }));
        return next;
      }),
    );
  };

  const saveDirtyRows = async () => {
    const changes = Object.values(dirtyRows);
    if (!selectedModule || changes.length === 0) return;
    setSaving(true);
    try {
      await saveBTProject(selectedModule, changes.map((row) => buildBTProjectPayloadRow(row, selectedModule)));
      setNotice({ type: "success", message: "Application progress updated successfully" });
      await loadRows(selectedModule, false);
      await loadSummary();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save application progress" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: ProgressRow) => {
    setSaving(true);
    try {
      await executeCommonProcedure({
        parameter: "PROC_TBL_BT_DEVELOPMENT_PROJECT_REPORT_DEL",
        loginid,
        val1s1: row.module || selectedModule,
        val1s2: row.sub_modules || "",
        val1s3: row.activity || "",
        val1n1: Number(row.id || 0),
      });
      setNotice({ type: "success", message: "Application progress row deleted" });
      await loadRows(selectedModule, false);
      await loadSummary();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete row" });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<ProgressRow>[]>(() => {
    const textCell = (field: keyof ProgressRow, type: "text" | "number" | "date" = "text") => ({
      accessorKey: field,
      header: fieldLabels[String(field)] || String(field),
      cell: ({ row }: { row: { original: ProgressRow; index: number } }) => {
        const rowId = String(row.original.id ?? row.index);
        return (
          <Input
            className="h-7 min-w-[130px] border-transparent bg-transparent px-1 shadow-none focus-visible:border-input"
            type={type}
            value={type === "date" ? toDateInputValue(row.original[field]) : String(row.original[field] ?? "")}
            onChange={(event) => updateRow(rowId, { [field]: type === "number" ? Number(event.target.value) : event.target.value })}
          />
        );
      },
    } as ColumnDef<ProgressRow>);

    return [
      textCell("sub_modules"),
      textCell("activity"),
      textCell("weightage", "number"),
      textCell("developer"),
      textCell("start_date", "date"),
      textCell("est_completion_date", "date"),
      textCell("end_date", "date"),
      {
        accessorKey: "variance",
        header: "Variance",
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? 0)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const rowId = String(row.original.id ?? row.index);
          return (
            <select
              className="h-7 min-w-[160px] rounded-md border bg-background px-2 text-xs"
              value={String(row.original.status ?? "")}
              onChange={(event) => updateRow(rowId, { status: event.target.value })}
            >
              {Object.keys(STATUS_SCORE_MAP).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          );
        },
      },
      { accessorKey: "results", header: "Results" },
      textCell("tester"),
      ...standardFields.map<ColumnDef<ProgressRow>>((field) => ({
        accessorKey: field,
        header: field.replace("_", " "),
        cell: ({ row }) => {
          const rowId = String(row.original.id ?? row.index);
          const checked = row.original[field] === "Y";
          return (
            <button
              type="button"
              className={`grid h-6 w-6 place-items-center rounded border ${checked ? "border-primary bg-primary text-white" : "bg-white"}`}
              onClick={() => updateRow(rowId, { [field]: checked ? "N" : "Y" })}
            >
              {checked && <Check size={13} />}
            </button>
          );
        },
      })),
      { accessorKey: "results1", header: "Results 1" },
      { accessorKey: "overall_result", header: "Overall Result" },
      { accessorKey: "overall_weightage_accomplished", header: "Overall Weightage" },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}>
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => void deleteRow(row.original)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ];
  }, [dirtyRows, selectedModule]);

  const summaryColumns = useMemo<ColumnDef<LookupRow>[]>(
    () => [
      { accessorKey: "module", header: "Module" },
      {
        id: "overall",
        header: "Overall Weightage Accomplished",
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {String(row.original["sum(overall_weightage_accomplished)"] ?? row.original.SUM ?? row.original.overall ?? "")}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Application Progress</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Development Progress</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 min-w-[220px] rounded-md border bg-white px-3 text-sm" value={selectedModule} onChange={(event) => setSelectedModule(event.target.value)}>
            <option value="">Select module</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => void loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button variant="outline" disabled={Object.keys(dirtyRows).length === 0 || saving} onClick={() => void saveDirtyRows()}>
            <Save size={15} /> Save Changes
          </Button>
          <Button disabled={!selectedModule} onClick={() => setEditor({ mode: "create" })}>
            <Plus size={15} /> Add Progress
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="flex gap-2 rounded-lg border bg-white p-1 shadow-sm">
        {(["progress", "summary"] as const).map((tab) => (
          <button
            key={tab}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"}`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === "progress" ? "Progress" : "Summary"}
          </button>
        ))}
      </div>

      {activeTab === "progress" ? (
        <DataTable
          columns={columns}
          data={rows}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search module, activity, developer, status..."
          loading={loading || saving}
          height="calc(100vh - 310px)"
          minWidth={2450}
          density="grid"
          enablePagination
          pageSize={100}
          emptyText={selectedModule ? "No progress rows found" : "Select a module to load progress"}
          getRowId={(row, index) => String(row.id ?? index)}
        />
      ) : (
        <DataTable
          columns={summaryColumns}
          data={summaryRows}
          searchPlaceholder="Search summary..."
          height={420}
          density="compact"
          emptyText="No summary rows found"
        />
      )}

      <ProgressEditor
        editor={editor}
        module={selectedModule}
        onClose={() => setEditor(null)}
        onSaved={async (row) => {
          await saveBTProject(selectedModule, [buildBTProjectPayloadRow(row, selectedModule)]);
          setEditor(null);
          setNotice({ type: "success", message: editor?.mode === "edit" ? "Progress updated successfully" : "Progress added successfully" });
          await loadRows(selectedModule, false);
          await loadSummary();
        }}
      />
    </section>
  );
}

function ProgressEditor({
  editor,
  module,
  onClose,
  onSaved,
}: {
  editor: EditorState;
  module: string;
  onClose: () => void;
  onSaved: (row: ProgressRow) => Promise<void>;
}) {
  const [form, setForm] = useState<ProgressRow>(emptyProgressRow(module));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editor) return;
    setForm(normalizeProgressRow(editor.mode === "edit" && editor.row ? { ...emptyProgressRow(module), ...editor.row } : emptyProgressRow(module)));
  }, [editor, module]);

  if (!editor) return null;

  const setField = (field: string, value: unknown) => setForm((current) => normalizeProgressRow({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.sub_modules || !form.activity) return;
    setSaving(true);
    try {
      await onSaved(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={Boolean(editor)}
      title={editor.mode === "edit" ? "Edit Progress" : "Add Progress"}
      description={module}
      wide
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={15} /> Cancel
          </Button>
          <Button type="submit" form="application-progress-editor" disabled={saving}>
            <Save size={15} /> Save
          </Button>
        </>
      }
    >
      <form id="application-progress-editor" className="grid gap-4" onSubmit={submit}>
        <div className="rounded-lg border">
          <div className="border-b p-4">
            <p className="eyebrow">Details</p>
            <h3 className="m-0 text-base font-semibold">Progress Information</h3>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {Object.entries(fieldLabels).map(([field, label]) => (
              <label key={field} className="field">
                <span>{label}{["sub_modules", "activity"].includes(field) && <span className="text-destructive"> *</span>}</span>
                {field === "status" ? (
                  <select className="ui-input h-9 rounded-md border px-3 text-sm" value={String(form.status ?? "")} onChange={(event) => setField(field, event.target.value)}>
                    {Object.keys(STATUS_SCORE_MAP).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    required={["sub_modules", "activity"].includes(field)}
                    type={field.includes("date") ? "date" : field === "weightage" ? "number" : "text"}
                    value={String(form[field] ?? "")}
                    onChange={(event) => setField(field, field === "weightage" ? Number(event.target.value) : event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-7">
          {standardFields.map((field) => (
            <label key={field} className="flex items-center gap-2 rounded-md border bg-secondary/30 px-3 py-2 text-sm font-semibold">
              <input type="checkbox" checked={form[field] === "Y"} onChange={(event) => setField(field, event.target.checked ? "Y" : "N")} />
              {isStandardField(field) ? field.replace("_", " ") : field}
            </label>
          ))}
        </div>
      </form>
    </Dialog>
  );
}
