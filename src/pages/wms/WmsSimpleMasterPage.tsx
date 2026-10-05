import { CloudUpload, Edit2, Plus, RefreshCw, Save, Trash2, X, ArrowLeft, FileText, Download } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useToast } from "../../components/ui/AlertToast";
import { deleteWmsGm, deleteWmsGmRaw, getWmsMaster, saveWmsGm } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { WmsMasterForm } from "../../components/WmsMasterForm";
import ImportLocationEdi from "./edi/ImportLocationEdi";
import ImportProductEdi from "./edi/ImportProductEdi";
import ImportSiteEdi from "./edi/ImportSiteEdi";

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

export type WmsSimpleMasterConfig = {
  title: string;
  subtitle: string;
  master: string;
  gmEndpoint: string;
  routeKeys?: string[];
  keyField?: string;
  keyFields?: string[];
  fields: WmsMasterField[];
  defaults?: Record<string, unknown>;
  fieldsPerRow?: number;
  deleteConfig?: WmsDeleteConfig;
  mapBeforeSave?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null }) => Record<string, unknown>;
  mapAfterLoad?: (data: Record<string, unknown>) => Record<string, unknown>;
  saveEndpoint?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null }) => string;
  formTabs?: WmsMasterFormTab[];
  customLoad?: (user: unknown) => Promise<{ tableData: Record<string, unknown>[]; count?: number }>;
  customSave?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown }) => Promise<void>;
  customDelete?: (row: Record<string, unknown>, user: unknown) => Promise<void>;
  rowIdSeparator?: string;
  ediUploadConfig?: {
    open: boolean;
    name: "location" | "product" | "site";
  };
};

// const FIELD_THRESHOLD = 8;

function generateRowId(row: Record<string, unknown>, config: WmsSimpleMasterConfig, index: number): string {
  const separator = config.rowIdSeparator || "_";
  if (config.keyFields && config.keyFields.length > 0) {
    const composedId = config.keyFields
      .map((field) => String(row[field] ?? "").trim())
      .filter((val) => val.length > 0)
      .join(separator);
    return composedId || `${config.master}${separator}${index}`;
  }
  if (config.keyField) {
    return String(row[config.keyField] || `${config.master}${separator}${index}`);
  }
  return `${config.master}${separator}${index}`;
}

function getRowDisplayKey(row: Record<string, unknown>, config: WmsSimpleMasterConfig): string {
  if (config.keyFields && config.keyFields.length > 0) {
    return config.keyFields
      .map((field) => String(row[field] ?? "").trim())
      .filter((val) => val.length > 0)
      .join(config.rowIdSeparator || "_");
  }
  if (config.keyField) {
    return String(row[config.keyField] ?? "");
  }
  return "";
}

function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    const axiosError = error as any;
    if (axiosError.response?.data) {
      const responseData = axiosError.response.data;
      if (typeof responseData === 'string') return responseData;
      if (responseData.message) return responseData.message;
      if (responseData.error) return responseData.error;
      if (responseData.msg) return responseData.msg;
    }
    return error.message;
  }
  return defaultMessage;
}

function clearDependentFields(
  fieldName: string,
  newValue: unknown,
  form: Record<string, unknown>,
  config: WmsSimpleMasterConfig
): Record<string, unknown> {
  const isFieldBeingCleared = newValue === "" || newValue === null || newValue === undefined;
  if (!isFieldBeingCleared) return form;

  const updatedForm = { ...form };
  config.fields.forEach((field) => {
    if (field.dropdownCodeMap) {
      const dependsOnClearedField = Object.keys(field.dropdownCodeMap).includes(fieldName);
      if (dependsOnClearedField) {
        updatedForm[field.name] = field.type === "number" ? 0 : "";
      }
    }
  });
  return updatedForm;
}

export function WmsSimpleMasterPage({ config }: { config: WmsSimpleMasterConfig }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const [view, setView] = useState<"list" | "editor">("list");
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [ediUploadOpen, setEdiUploadOpen] = useState(false);

  // const useFullPage = config.fields.length >= FIELD_THRESHOLD;
  const useFullPage = true;


  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const editableFields = config.fields;
  const tableFields = config.fields.filter((field) => field.table !== false);

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
    setRows([]);
    try {
      if (config.customLoad) {
        const response = await config.customLoad(user);
        setRows(response.tableData.map(normalizeRow));
        setTotalRows(response.count || response.tableData.length);
      } else {
        const hasSearch = Boolean(debouncedQuery.trim());
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
  }, [config.master, pageIndex, pageSize, debouncedQuery, columnFilters]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      ...tableFields.map((field) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width || 160,
        cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
          const value = formatValue(row.original[field.name]);
          const alignmentClass = field.align
            ? field.align === "right" ? "text-right" : field.align === "center" ? "text-center" : "text-left"
            : "text-left";
          return <div className={`text-[11.5px] text-foreground ${alignmentClass}`}>{value}</div>;
        },
      })),
      {
        id: "actions",
        header: "Actions",
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
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              disabled={!config.customDelete && config.deleteConfig?.mode === "disabled"}
              onClick={() => setDeleteTarget(row.original)}
              title={!config.customDelete && config.deleteConfig?.mode === "disabled" ? config.deleteConfig.reason || "Delete endpoint is not registered" : `Delete ${config.title}`}
            >
              <Trash2 size={13} />
            </button>
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
    setView("editor");
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setOriginal(row);
    const mappedData = config.mapAfterLoad ? config.mapAfterLoad(row) : row;
    setForm({ ...makeEmpty(), ...mappedData });
    setView("editor");
  };

  const handleCloseForm = () => {
    setView("list");
    setEditMode(false);
    setOriginal(null);
    setForm({});
  };

  const handleReset = () => {
    if (editMode && original) {
      openEdit(original);
    } else {
      setForm(makeEmpty());
    }
  };

  const saveRecord = async (event: FormEvent) => {
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
        if (field.type === "checkbox") value = value === true || value === "Y" ? "Y" : "N";
        if (value === "") value = null;
        acc[field.name] = value;
        return acc;
      }, {} as Record<string, unknown>);

      const finalForm = { ...transformedForm, company_code: transformedForm.company_code || user?.company_code || "" };

      if (config.customSave) {
        await config.customSave(finalForm, { editMode, original, user });
      } else {
        const mapped = config.mapBeforeSave?.(finalForm, { editMode, original }) || finalForm;
        const endpoint = config.saveEndpoint?.(mapped, { editMode, original }) || config.gmEndpoint;
        await saveWmsGm(endpoint, mapped, editMode ? "put" : "post");
      }

      handleCloseForm();
      toast.success(editMode ? "Successfully updated" : "Successfully created");
      await loadRows(pageIndex, pageSize);
    } catch (error) {
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

  const renderFormContent = () => (
    <WmsMasterForm
      fields={editableFields}
      key={view === "editor" ? (editMode ? `edit-${getRowDisplayKey(original || {}, config)}` : "add") : "closed"}
      tabs={config.formTabs}
      fieldsPerRow={config.fieldsPerRow}
      form={form}
      editMode={editMode}
      saving={saving}
      user={user}
      onChange={(name: any, value: any) =>
        setForm((prev) => {
          const updated = { ...prev, [name]: value };
          return clearDependentFields(name, value, updated, config);
        })
      }
      onSave={saveRecord}
      onCancel={handleCloseForm}
    />
  );

// ── RENDER EDITOR (FULL PAGE - FREIGHT STYLE) ──
if (view === "editor" && useFullPage) {
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
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={handleCloseForm}>
            <ArrowLeft size={14} /> List
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={saving}>
            <RefreshCw size={14} /> Reset
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleCloseForm} disabled={saving}>
            <X size={14} /> Close
          </Button>
          <Button type="submit" size="sm" disabled={saving} form="wms-master-form">
            <Save size={14} /> {saving ? "Saving" : "Save Draft"}
          </Button>
        </div>
      </div>

      {/* Form content — Freight form has its own internal structure */}
      <div className="mt-2">
        {renderFormContent()}
      </div>
    </section>
  );
}

  // ── RENDER LIST (FREIGHT STYLE) ──
  return (
    <section className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-foreground m-0" style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}>
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
        onSearchChange={(value:any) => { setQuery(value); setPageIndex(0); }}
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
        onColumnFiltersChange={(filters:any) => { setColumnFilters(filters); setPageIndex(0); }}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize:any) => { setPageSize(nextPageSize); setPageIndex(0); }}
        getRowId={(row:any, index:any) => generateRowId(row, config, index)}
                toolbar={
          <div className="flex items-center gap-2">
            {config.ediUploadConfig?.open && (
              <button 
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
               onClick={() => setEdiUploadOpen(true)}>
                <CloudUpload size={14} /> EDI Upload
              </button>
            )}
            <button                 className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
 onClick={openAdd}>
              <Plus size={14} /> Add {config.title}
            </button>
          </div>
        }
        enableExport
        exportFilename={`${config.title.toLowerCase().replace(/\s+/g, '-')}-list.csv`}

      />

      {/* ── MODAL FOR SMALL FORMS (< 8 fields) ── */}
      {/* {!useFullPage && (
        <Dialog open={view === "editor"} title={editMode ? `Edit ${config.title}` : `Add ${config.title}`} description="Master details" compact wide onClose={handleCloseForm}>
          <div style={{ maxHeight: "calc(90vh - 180px)", overflowY: "auto", width: "100%" }}>
            {renderFormContent()}
          </div>
        </Dialog>
      )} */}

      {/* ── DELETE DIALOG ── */}
      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description={deleteTarget ? `Delete ${formatValue(getRowDisplayKey(deleteTarget, config))}?` : undefined}
        compact tone="danger" onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">This action cannot be undone.</p>
      </Dialog>

      {/* ── EDI UPLOAD DIALOGS ── */}
      {config.ediUploadConfig?.name === "location" && ediUploadOpen && (
        <Dialog open={ediUploadOpen} title={`${config.title} EDI Upload`} description="Import records via Excel/EDI" compact wide onClose={() => setEdiUploadOpen(false)}>
          <div style={{ maxHeight: "calc(90vh - 180px)", overflowY: "auto", width: "100%" }}>
            <ImportLocationEdi onSuccess={() => setEdiUploadOpen(false)} onClose={() => setEdiUploadOpen(false)} />
          </div>
        </Dialog>
      )}
      {config.ediUploadConfig?.name === "product" && ediUploadOpen && (
        <Dialog open={ediUploadOpen} title={`${config.title} EDI Upload`} description="Import records via Excel/EDI" compact wide onClose={() => setEdiUploadOpen(false)}>
          <div style={{ maxHeight: "calc(90vh - 180px)", overflowY: "auto", width: "100%" }}>
            <ImportProductEdi onSuccess={() => setEdiUploadOpen(false)} onClose={() => setEdiUploadOpen(false)} />
          </div>
        </Dialog>
      )}
      {config.ediUploadConfig?.name === "site" && ediUploadOpen && (
        <Dialog open={ediUploadOpen} title={`${config.title} EDI Upload`} description="Import records via Excel/EDI" compact wide onClose={() => setEdiUploadOpen(false)}>
          <div style={{ maxHeight: "calc(90vh - 180px)", overflowY: "auto", width: "100%" }}>
            <ImportSiteEdi onSuccess={() => setEdiUploadOpen(false)} onClose={() => setEdiUploadOpen(false)} />
          </div>
        </Dialog>
      )}
    </section>
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