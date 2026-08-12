import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { deleteHrGm, deleteHrMaster, getHrMaster, saveHrGm } from "../../api/hr";
import {
  DynamicDeleteParams,
  DynamicMutationParams,
  DynamicQueryParams,
  executeDynamicDelete,
  executeDynamicMutation,
  executeDynamicMutationColumn90,
  getDynamicLookup,
  getLookupValue,
  LookupRow,
  postFinance,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

export type HrMasterField = {
  name: string;
  label: string;
  required?: boolean;
  hideOnAdd?: boolean;
  Placeholder?: string;
  helperText?: string;
  disabledOnEdit?: boolean;
  disabledOnAdd?: boolean;
  type?: "text" | "number" | "select" | "email" | "date";
  options?: { label: string; value: string }[];
  lookup?: {
    columns: { field: string; header: string }[];
    valueField: string;
    displayFields: string[];
    loadOptions: (context: HrMasterContext) => Promise<LookupRow[]>;
  };
  table?: boolean;
  width?: number;
};

export type HrMasterConfig = {
  title: string;
  subtitle: string;
  master: string;
  gmEndpoint: string;
  routeKeys?: string[];
  keyField: string;
  fields: HrMasterField[];
  defaults?: Record<string, unknown>;
  deleteMode?: "master" | "gm" | "disabled";
  source?: "hr" | "dynamic" | "finance";
  mutationMode?: "common" | "column90";
  listQuery?: (context: HrMasterContext) => DynamicQueryParams;
  buildSave?: (form: Record<string, unknown>, context: HrMasterContext) => DynamicMutationParams | Record<string, unknown>;
  buildDelete?: (row: Record<string, unknown>, context: HrMasterContext) => DynamicDeleteParams;
  financeSaveEndpoint?: string;
  autoGenerateKey?: boolean;
  stripEditKeyOnSave?: boolean;
};

export type HrMasterContext = {
  loginid: string;
  companyCode: string;
  editMode: boolean;
  rows: Record<string, unknown>[];
};

export function HrMasterPage({ config }: { config: HrMasterConfig }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const tableFields = config.fields.filter((field) => field.table !== false);
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const makeEmpty = (): Record<string, unknown> => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: companyCode,
  });

  const buildContext = (mode = editMode): HrMasterContext => ({ loginid, companyCode, editMode: mode, rows });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize, clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const isDynamic = config.source === "dynamic" || config.source === "finance";
      const hasSearch = Boolean(query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()));
      const requestPageIndex = hasSearch ? 0 : nextPageIndex;
      const requestPageSize = hasSearch ? 100000 : nextPageSize;
      const activeFilters = columnFilters
        .map((filter) => ({ field: filter.id, values: String(filter.value ?? "").trim() }))
        .filter((filter) => filter.values);
      if (isDynamic && config.listQuery) {
        const data = await getDynamicLookup(config.listQuery(buildContext()));
        setRows(data.map(normalizeRow));
        setTotalRows(data.length);
      } else {
        const response = await getHrMaster(config.master, {
          page: requestPageIndex + 1,
          limit: requestPageSize,
          ...(query.trim() ? { search: query.trim() } : {}),
          ...(activeFilters.length ? { filter: JSON.stringify({ search: activeFilters }) } : {}),
        });
        setRows(response.tableData.map(normalizeRow));
        setTotalRows(response.count || response.tableData.length);
      }
    } catch (error) {
  setNotice({ type: "error", message: getErrorMessage(error, `Unable to load ${config.title}`) });
  } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [config.master, pageIndex, pageSize, query, columnFilters]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      ...tableFields.map((field) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width || 160,
        cell: ({ row }: { row: { original: Record<string, unknown> } }) => formatValue(row.original[field.name]),
      })),
      {
        id: "actions",
        header: "Actions",
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title={`Edit ${config.title}`} onClick={() => openEdit(row.original)}>
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={config.deleteMode === "disabled"}
              title={config.deleteMode === "disabled" ? "Delete is not configured" : `Delete ${config.title}`}
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [config, tableFields],
  );

  const openAdd = () => {
    setEditMode(false);
    const empty = makeEmpty();
    if (config.autoGenerateKey) empty[config.keyField] = nextCode(rows, config.keyField);
    setForm(empty);
    setFormOpen(true);
    setNotice(null);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setForm({ ...makeEmpty(), ...row, _edit_key: row[config.keyField], company_code: row.company_code || companyCode });
    setFormOpen(true);
    setNotice(null);
  };

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
  
    const missing = config.fields.find(
  (field) => field.required && !field.hideOnAdd && !String(form[field.name] ?? "").trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      if (config.source === "dynamic" && config.buildSave) {
        const payload = config.buildSave(form, buildContext()) as DynamicMutationParams;
        if (config.mutationMode === "column90") await executeDynamicMutationColumn90(payload);
        else await executeDynamicMutation(payload);
      } else if (config.source === "finance" && config.buildSave && config.financeSaveEndpoint) {
        await postFinance(config.financeSaveEndpoint, cleanPayload(config.buildSave(form, buildContext()) as Record<string, unknown>));
     } else {
  const payload = config.stripEditKeyOnSave
    ? (() => {
        const { _edit_key, ...rest } = form;
        return rest;
      })()
    : form;

  await saveHrGm(
    config.gmEndpoint,
    cleanPayload({ ...payload, company_code: form.company_code || companyCode }),
    editMode ? "put" : "post"
  );
}
      setFormOpen(false);
      setNotice({ type: "success", message: `${config.title} ${editMode ? "updated" : "created"} successfully.` });
      await loadRows(pageIndex, pageSize, false);
    } catch (error) {
  setNotice({ type: "error", message: getErrorMessage(error, `Unable to save ${config.title}`) });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || config.deleteMode === "disabled") return;
    setSaving(true);
    setNotice(null);
    try {
      const id = deleteTarget[config.keyField];
      if ((config.source === "dynamic" || config.source === "finance") && config.buildDelete) {
        await executeDynamicDelete(config.buildDelete(deleteTarget, buildContext()));
      } else if (config.deleteMode === "gm") await deleteHrGm(config.gmEndpoint, [id]);
      else await deleteHrMaster(config.master, [id]);
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${config.title} deleted successfully.` });
      await loadRows(pageIndex, pageSize, false);
    } catch (error) {
  setNotice({ type: "error", message: getErrorMessage(error, `Unable to delete ${config.title}`) });
  } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{config.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => loadRows()}>
            <RefreshCw size={15} />
          </Button>
          <Button title={`Add ${config.title}`} onClick={openAdd}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Records`}
        subtitle={`${config.title} List`}
        searchValue={query}
        onSearchChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading}
        emptyText={`No ${config.title.toLowerCase()} records found`}
        height={620}
        minWidth={Math.max(900, tableFields.reduce((sum, field) => sum + (field.width || 160), 170))}
        density="grid"
        enablePagination
        manualPagination={config.source !== "dynamic" && config.source !== "finance" && !(query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()))}
        manualFiltering={false}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        columnFilters={columnFilters}
        onColumnFiltersChange={(filters) => {
          setColumnFilters(filters);
          setPageIndex(0);
        }}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageIndex(0);
        }}
        getRowId={(row, index) => String(row[config.keyField] || `${config.master}_${index}`)}
      />

      <Dialog open={formOpen} title={editMode ? `Edit ${config.title}` : `Add ${config.title}`} wide onClose={() => setFormOpen(false)}>
        <form className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
              </div>
            </CardHeader>
           


            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
  {config.fields.map((field, index) => {
    
    if (field.hideOnAdd && !editMode) return null;

    return (
      <label className="field" key={field.name}>
        <span>{field.label}{field.required ? <strong className="text-destructive"> *</strong> : null}</span>
        {renderInput(field, form[field.name], form[`${field.name}_name`], Boolean((editMode && field.disabledOnEdit) || (!editMode && field.disabledOnAdd)), buildContext(), 
      (value, row) => setForm((current) => {
  if (!field.lookup) return { ...current, [field.name]: value };
  return {
    ...current,
    [field.name]: value,
    ...(row ? displayPatch(field, row) : { [`${field.name}_name`]: "" }),
  };
}))}
      </label>
    );
  })}
</CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save size={15} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description="This will remove the selected HR master record."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Close</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Confirm delete for <strong>{String(deleteTarget?.[config.keyField] || "")}</strong>.</p>
      </Dialog>
    </section>
  );
}

function renderInput(field: HrMasterField, value: unknown, selectedLabel: unknown, disabled: boolean, context: HrMasterContext, onChange: (value: unknown, row?: LookupRow | null) => void) {
  if (field.lookup) {
    const displayValue = String(value ?? "")
      ? [value, selectedLabel].filter(Boolean).join(" - ") || String(value ?? "")
      : "";
    return (
      <LookupField
        compact
        label={field.label}
        value={String(value ?? "")}
        displayValue={displayValue}
        columns={field.lookup.columns}
        valueField={field.lookup.valueField}
        displayFields={field.lookup.displayFields}
        loadOptions={() => field.lookup!.loadOptions(context)}
        disabled={disabled}
        onChange={(nextValue, row) => onChange(nextValue, row)}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select value={String(value ?? "")} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select {field.label}</option>
        {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    );
  }
  return <Input type={field.type || "text"} value={field.type === "date" ? toDateInputValue(value) : String(value ?? "")} disabled={disabled} onChange={(event) => onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value)} />;
}

function displayPatch(field: HrMasterField, row: LookupRow) {
  if (!field.lookup) return {};
  const nameField = `${field.name}_name`;
  const labelValue = field.lookup.displayFields
    .filter((displayField) => displayField !== field.lookup?.valueField)
    .map((displayField) => getLookupValue(row, displayField))
    .find((value) => String(value ?? "").trim());
  return labelValue ? { [nameField]: labelValue } : {};
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toLocaleDateString("en-GB");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value).toLocaleDateString("en-GB");
  return String(value);
}

function cleanPayload(payload: Record<string, unknown>) {
  const next = { ...payload };
  Object.keys(next).forEach((key) => {
    if (next[key] === "") next[key] = null;
  });
  return next;
}


function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const anyErr = error as any;
    const backendMessage =
      anyErr.response?.data?.message ||
      anyErr.data?.message ||
      anyErr.message;
    if (backendMessage && typeof backendMessage === "string") return backendMessage;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function nextCode(rows: Record<string, unknown>[], keyField: string) {
  const values = rows
    .map((row) => Number(row[keyField]))
    .filter((value) => Number.isFinite(value));
  const next = (values.length ? Math.max(...values) : 0) + 1;
  return String(next).padStart(3, "0");
}

function toDateInputValue(input: unknown) {
  if (!input) return "";
  const value = String(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}




