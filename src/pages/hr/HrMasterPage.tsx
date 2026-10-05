import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import {
  ArrowLeft, Edit2, FileText, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

// ── Types (unchanged) ─────────────────────────────────────────────────────────

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
  limit?: number;
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

// ── Freight building blocks ───────────────────────────────────────────────────
// (Same as in the Grade / Product forms — worth moving to components/ui later.)

function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  helperText,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
      {helperText && <span className="text-[10.5px] text-muted-foreground">{helperText}</span>}
    </label>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function HrMasterPage({ config }: { config: HrMasterConfig }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

  const tableFields = useMemo(() => config.fields.filter((field) => field.table !== false), [config]);
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const makeEmpty = (): Record<string, unknown> => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: companyCode,
  });

  const buildContext = (mode = editMode): HrMasterContext => ({ loginid, companyCode, editMode: mode, rows });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
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
      toast.error(getErrorMessage(error, `Unable to load ${config.title}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.master, pageIndex, pageSize, query, columnFilters]);

  // Switching to a different master (route change) always lands on the list
  useEffect(() => {
    setView("list");
    setEditMode(false);
    setForm({});
  }, [config.master]);

  /* ── Navigation handlers ── */
  const openAdd = () => {
    setEditMode(false);
    const empty = makeEmpty();
    if (config.autoGenerateKey) empty[config.keyField] = nextCode(rows, config.keyField);
    setForm(empty);
    setView("editor");
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setForm({ ...makeEmpty(), ...row, _edit_key: row[config.keyField], company_code: row.company_code || companyCode });
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditMode(false);
    setForm({});
  };

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
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEdit(row.original)}
              title={`Edit ${config.title}`}
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              disabled={config.deleteMode === "disabled"}
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
              onClick={() => setDeleteTarget(row.original)}
              title={config.deleteMode === "disabled" ? "Delete is not configured" : `Delete ${config.title}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, tableFields, companyCode],
  );

  /* ── Save (header Save button + Enter key inside the form) ── */
  const saveRecord = async (event?: FormEvent) => {
    event?.preventDefault();

    const missing = config.fields.find(
      (field) => field.required && !field.hideOnAdd && !String(form[field.name] ?? "").trim(),
    );
    if (missing) {
      toast.warning(`${missing.label} is required`);
      return;
    }
    setSaving(true);
    try {
      if (config.source === "dynamic" && config.buildSave) {
        const payload = config.buildSave(form, buildContext()) as DynamicMutationParams;
        if (config.mutationMode === "column90") await executeDynamicMutationColumn90(payload);
        else await executeDynamicMutation(payload);
      } else if (config.source === "finance" && config.buildSave && config.financeSaveEndpoint) {
        await postFinance(
          config.financeSaveEndpoint,
          cleanPayload(config.buildSave(form, buildContext()) as Record<string, unknown>),
        );
      } else {
        let payload: Record<string, unknown>;

        if (config.buildSave) {
          payload = config.buildSave(form, buildContext()) as Record<string, unknown>;
        } else if (config.stripEditKeyOnSave) {
          const { _edit_key, ...rest } = form;
          payload = rest;
        } else {
          payload = form;
        }

        await saveHrGm(
          config.gmEndpoint,
          cleanPayload({ ...payload, company_code: form.company_code || companyCode }),
          editMode ? "put" : "post",
        );
      }
      toast.success(`${config.title} ${editMode ? "updated" : "created"} successfully`);
      handleCloseEditor();
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      toast.error(getErrorMessage(error, `Unable to save ${config.title}`));
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget || config.deleteMode === "disabled") return;
    setSaving(true);
    try {
      const id = deleteTarget[config.keyField];
      if ((config.source === "dynamic" || config.source === "finance") && config.buildDelete) {
        await executeDynamicDelete(config.buildDelete(deleteTarget, buildContext()));
      } else if (config.deleteMode === "gm") await deleteHrGm(config.gmEndpoint, [id]);
      else await deleteHrMaster(config.master, [id]);
      setDeleteTarget(null);
      toast.success(`${config.title} deleted successfully`);
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      toast.error(getErrorMessage(error, `Unable to delete ${config.title}`));
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const keyValue = editMode ? String(form[config.keyField] ?? "") : "";

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {editMode ? `Edit ${config.title}` : `New ${config.title}`}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "Draft"}
                </span>
                {keyValue && <span className="text-xs text-muted-foreground">{keyValue}</span>}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" onClick={() => void saveRecord()} disabled={saving}>
              <Save size={14} /> {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        {/* Form content */}
        <form onSubmit={saveRecord}>
          <SectionPanel title="Basic Information" icon={FileText}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {config.fields.map((field) => {
                if (field.hideOnAdd && !editMode) return null;

                const disabled = Boolean(
                  (editMode && field.disabledOnEdit) || (!editMode && field.disabledOnAdd),
                );

                return (
                  <Field
                    key={field.name}
                    label={field.label}
                    required={field.required}
                    helperText={field.helperText}
                  >
                    {renderInput(
                      field,
                      form[field.name],
                      form[`${field.name}_name`],
                      disabled,
                      buildContext(),
                      (value, row) =>
                        setForm((current) => {
                          if (!field.lookup) return { ...current, [field.name]: value };
                          return {
                            ...current,
                            [field.name]: value,
                            ...(row ? displayPatch(field, row) : { [`${field.name}_name`]: "" }),
                          };
                        }),
                    )}
                  </Field>
                );
              })}
            </div>
          </SectionPanel>
          {/* hidden submit so Enter inside a text input saves */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  const hasActiveSearch = Boolean(
    query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()),
  );

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title only — buttons live inside the DataTable toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            {config.title}
          </h2>
        </div>
      </div>

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
        manualPagination={config.source !== "dynamic" && config.source !== "finance" && !hasActiveSearch}
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
        enableExport
        exportFilename={`hr-${config.master}-list.csv`}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRows()}
              title="Refresh"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openAdd}
              title={`Add ${config.title}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description="This will remove the selected HR master record."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDelete}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Confirm delete for <strong>{String(deleteTarget?.[config.keyField] || "")}</strong>.
        </p>
      </Dialog>
    </section>
  );
}

// ── Helpers (unchanged except renderInput's label / placeholder) ──────────────

function renderInput(
  field: HrMasterField,
  value: unknown,
  selectedLabel: unknown,
  disabled: boolean,
  context: HrMasterContext,
  onChange: (value: unknown, row?: LookupRow | null) => void,
) {
  if (field.lookup) {
    const displayValue = String(value ?? "")
      ? [value, selectedLabel].filter(Boolean).join(" - ") || String(value ?? "")
      : "";
    return (
      <LookupField
        compact
        label="" // label is rendered by <Field>
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
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      type={field.type || "text"}
      value={field.type === "date" ? toDateInputValue(value) : String(value ?? "")}
      disabled={disabled}
      maxLength={field.limit}
      placeholder={field.Placeholder}
      onChange={(event) => {
        const raw = event.target.value;
        const trimmed = field.limit ? raw.slice(0, field.limit) : raw;
        onChange(field.type === "number" ? Number(trimmed || 0) : trimmed);
      }}
    />
  );
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
    const backendMessage = anyErr.response?.data?.message || anyErr.data?.message || anyErr.message;
    if (backendMessage && typeof backendMessage === "string") return backendMessage;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function nextCode(rows: Record<string, unknown>[], keyField: string) {
  const values = rows.map((row) => Number(row[keyField])).filter((value) => Number.isFinite(value));
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