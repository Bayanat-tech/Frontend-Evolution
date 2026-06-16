import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useToast } from "../../components/ui/AlertToast";
import { deleteWmsGm, deleteWmsGmRaw, getWmsMaster, saveWmsGm } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { WmsDataTable } from "../../components/ui/WmsDataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import {WmsMasterForm} from "../../components/WmsMasterForm";

export type WmsMasterField = {
  name: string;
  label: string;
  required?: boolean;
  hideOnAdd?: boolean;
  disabledOnEdit?: boolean;
  disabledWhen?: (form: Record<string, unknown>) => boolean;
  type?: "text" | "number" | "select" | "email" | "textarea" | "checkbox" | "date";
  options?: { label: string; value: string }[];
  dropdownParam?: string;
  dropdownLabelKey?: string;
  dropdownValueKey?: string;
  dropdownDisplayFields?: string[];
  dropdownDisplaySeparator?: string;
  dropdownCodeMap?: Record<string, string>;
  filterDependsOn?: string;
  asyncOptions?: {
    endpoint: string;
    labelKey: string;
    valueKey: string;
    dependsOn?: string;
  };
  tab?: string;
  section?: string;
  table?: boolean;
  width?: number;
  colSpan?: number;
  align?: "left" | "center" | "right";
  maxLength?: number;
};

export type WmsDeleteConfig = {
  mode: "registered" | "rawPost" | "rawDelete" | "disabled";
  payload: (row: Record<string, unknown>) => unknown;
  reason?: string;
};

export type WmsMasterFormTab = {
  key: string;
  label: string;
};

export type AlmsSimpleMasterConfig = {
  title: string;
  subtitle: string;
  master: string;
  gmEndpoint: string;
  routeKeys?: string[];
  keyField?: string;  // Single key field (fallback if keyFields not provided)
  keyFields?: string[];  // Multiple fields to compose unique row ID
  fields: WmsMasterField[];
  defaults?: Record<string, unknown>;
  fieldsPerRow?: number;  // Number of fields per row (default: 2)
  deleteConfig?: WmsDeleteConfig;
  mapBeforeSave?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null }) => Record<string, unknown>;
  mapAfterLoad?: (data: Record<string, unknown>) => Record<string, unknown>;
  saveEndpoint?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null }) => string;
    formTabs?: WmsMasterFormTab[];

  customLoad?: (user: unknown) => Promise<{ tableData: Record<string, unknown>[]; count?: number }>;
  customSave?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown }) => Promise<void>;
  customDelete?: (row: Record<string, unknown>, user: unknown) => Promise<void>;
  rowIdSeparator?: string;  // Separator for composite row IDs (default: '_')
};

function generateRowId(row: Record<string, unknown>, config: AlmsSimpleMasterConfig, index: number): string {
  const separator = config.rowIdSeparator || "_";
  
  // Use multiple key fields if provided
  if (config.keyFields && config.keyFields.length > 0) {
    const composedId = config.keyFields
      .map((field) => String(row[field] ?? "").trim())
      .filter((val) => val.length > 0)
      .join(separator);
    return composedId || `${config.master}${separator}${index}`;
  }
  
  // Fallback to single key field
  if (config.keyField) {
    return String(row[config.keyField] || `${config.master}${separator}${index}`);
  }
  
  // Final fallback
  return `${config.master}${separator}${index}`;
}

function getRowDisplayKey(row: Record<string, unknown>, config: AlmsSimpleMasterConfig): string {
  // Use multiple key fields if provided
  if (config.keyFields && config.keyFields.length > 0) {
    return config.keyFields
      .map((field) => String(row[field] ?? "").trim())
      .filter((val) => val.length > 0)
      .join(config.rowIdSeparator || "_");
  }
  
  // Fallback to single key field
  if (config.keyField) {
    return String(row[config.keyField] ?? "");
  }
  
  // Final fallback
  return "";
}

function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    // Check if it's an axios error with response data
    const axiosError = error as any;
    if (axiosError.response?.data) {
      const responseData = axiosError.response.data;
      // Try common error message fields in API responses
      if (typeof responseData === 'string') return responseData;
      if (responseData.message) return responseData.message;
      if (responseData.error) return responseData.error;
      if (responseData.msg) return responseData.msg;
    }
    // Fall back to error message
    return error.message;
  }
  return defaultMessage;
}

function clearDependentFields(
  fieldName: string,
  newValue: unknown,
  form: Record<string, unknown>,
  config: AlmsSimpleMasterConfig
): Record<string, unknown> {
  // If a field is being cleared (empty/null/undefined), clear all dependent fields
  const isFieldBeingCleared = newValue === "" || newValue === null || newValue === undefined;
  
  if (!isFieldBeingCleared) {
    return form;
  }

  // Find all fields that depend on the current field
  const updatedForm = { ...form };
  
  config.fields.forEach((field) => {
    // Check if this field depends on the field being cleared
    if (field.dropdownCodeMap) {
      // Check if the cleared field is a dependency
      const dependsOnClearedField = Object.keys(field.dropdownCodeMap).includes(fieldName);
      if (dependsOnClearedField) {
        // Clear this dependent field
        updatedForm[field.name] = field.type === "number" ? 0 : "";
      }
    }
  });

  return updatedForm;
}

export function AlmsSimpleMasterPage({ config }: { config: AlmsSimpleMasterConfig }) {
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
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

  const editableFields = config.fields;
  const tableFields = config.fields.filter((field) => field.table !== false);

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
    setRows([]); // Clear rows immediately when loading starts
    try {
      if (config.customLoad) {
        const response = await config.customLoad(user);
        setRows(response.tableData.map(normalizeRow));
        setTotalRows(response.count || response.tableData.length);
      } else {
        const hasSearch = Boolean(query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()));
        const requestPageIndex = hasSearch ? 0 : nextPageIndex;
        const requestPageSize = hasSearch ? 100000 : nextPageSize;
        const activeFilters = columnFilters
          .map((filter) => ({ field: filter.id, values: String(filter.value ?? "").trim() }))
          .filter((filter) => filter.values);
        const response = await getWmsMaster(config.master, {
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
      setRows([]);
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
        cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
          const value = formatValue(row.original[field.name]);
          const alignmentClass = field.align ? 
            field.align === "right" ? "text-right" : field.align === "center" ? "text-center" : "text-left"
            : "text-left";
          return <div className={alignmentClass}>{value}</div>;
        },
      })),
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title={`Edit ${config.title}`}>
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={!config.customDelete && config.deleteConfig?.mode === "disabled"}
              onClick={() => setDeleteTarget(row.original)}
              title={
                !config.customDelete && config.deleteConfig?.mode === "disabled"
                  ? config.deleteConfig.reason || "Delete endpoint is not registered"
                  : `Delete ${config.title}`
              }
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    [config, tableFields],
  );

  const openAdd = () => {
    setEditMode(false);
    setOriginal(null);
    setForm(makeEmpty());
    setFormOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setOriginal(row);
    const mappedData = config.mapAfterLoad ? config.mapAfterLoad(row) : row;
    setForm({ ...makeEmpty(), ...mappedData });
    setFormOpen(true);
  };

const saveRecord = async (event: FormEvent) => {
  let response;
  event.preventDefault();
  const missing = editableFields.find((field) => field.required && !String(form[field.name] ?? "").trim());
  if (missing) {
    toast.error(`${missing.label} is required`);
    return;
  }
  setSaving(true);
  try {
    const transformedForm = editableFields.reduce((acc, field) => {
      let value = form[field.name];
      if (field.type === "checkbox") {
        value = value === true || value === "Y" ? "Y" : "N";
      }
      if (value === "") value = null;
      acc[field.name] = value;
      return acc;
    }, {} as Record<string, unknown>);

    const finalForm = { ...transformedForm, company_code: transformedForm.company_code || user?.company_code || "" };
    if (config.customSave) {
     response = await config.customSave(finalForm, { editMode, original, user });
    } else {
      const mapped = config.mapBeforeSave?.(finalForm, { editMode, original }) || finalForm;
      const endpoint = config.saveEndpoint?.(mapped, { editMode, original }) || config.gmEndpoint;
      response = await saveWmsGm(endpoint, mapped, editMode ? "put" : "post");
    }
    console.log("Save response", response);
    setFormOpen(false);
    toast.success(editMode ? "Successfully updated" : "Successfully created");
    await loadRows(pageIndex, pageSize);
  } catch (error) {
    console.log("Save response", response);
    toast.error(getErrorMessage(error, `Unable to save ${config.title}`));
  } finally {
    setSaving(false);
  }
};
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (config.customDelete) {
        await config.customDelete(deleteTarget, user);
      } else {
        if (!config.deleteConfig || config.deleteConfig.mode === "disabled") return;
        const payload = config.deleteConfig.payload(deleteTarget);
        if (config.deleteConfig.mode === "registered") {
          await deleteWmsGm(config.gmEndpoint, payload);
        } else {
          await deleteWmsGmRaw(config.gmEndpoint, payload, config.deleteConfig.mode === "rawDelete" ? "delete" : "post");
        }
      }
      setDeleteTarget(null);
      toast.success("Successfully deleted");
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      toast.error(getErrorMessage(error, `Unable to delete ${config.title}`));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">{config.title}</h1>
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

      <WmsDataTable
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
        minWidth={Math.max(900, tableFields.reduce((sum, field) => sum + (field.width || 160), 160))}
        density="grid"
        enablePagination
        manualPagination={!(query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()))}
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
        getRowId={(row, index) => generateRowId(row, config, index)}
      />

      <Dialog open={formOpen} title={editMode ? `Edit ${config.title}` : `Add ${config.title}`} description="Master details" compact wide onClose={() => setFormOpen(false)} >
      <div style={{ maxHeight: 'calc(90vh - 180px)', overflowY: 'auto', width: '100%' }}>
      <WmsMasterForm
          fields={editableFields}
          key={formOpen ? (editMode ? `edit-${getRowDisplayKey(original || {}, config)}` : "add") : "closed"}
          tabs={config.formTabs}
          fieldsPerRow={config.fieldsPerRow}
          form={form}
          editMode={editMode}
          saving={saving}
          user={user}
          onChange={(name:any, value:any) => setForm((prev) => {
            const updated = { ...prev, [name]: value };
            // Clear dependent fields if a parent field is cleared
            return clearDependentFields(name, value, updated, config);
          })}
          onSave={saveRecord}
          onCancel={() => setFormOpen(false)}
        />
      </div>
        {/* <form className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {editableFields.map((field) => (
                <Field label={field.label} required={field.required} key={field.name}>
                  {renderInput(field, form[field.name], Boolean(editMode && field.disabledOnEdit), (value) => setForm((current) => ({ ...current, [field.name]: value })))}
                </Field>
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            <Button disabled={saving} type="submit">
              <Save size={15} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form> */}
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description={deleteTarget ? `Delete ${formatValue(getRowDisplayKey(deleteTarget, config))}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">This action uses the existing Bayanat WMS backend endpoint.</p>
      </Dialog>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

function renderInput(field: WmsMasterField, value: unknown, disabled: boolean, onChange: (value: unknown) => void) {
  if (field.type === "select") {
    return (
      <Select disabled={disabled} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        {(field.options || []).map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </Select>
    );
  }
  return (
    <Input
      disabled={disabled}
      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
      value={String(value ?? "")}
      onChange={(event) => onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value)}
    />
  );
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
