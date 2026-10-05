import { CloudUpload, Edit2, Plus, Save, Trash2, X, ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useToast } from "../../components/ui/AlertToast";
import { deleteWmsGm, deleteWmsGmRaw, getWmsMaster, saveWmsGm } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { WmsMasterForm } from "../../components/WmsMasterForm";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
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

  // ── RENDER EDITOR (FULL PAGE - PREPAID REGISTER STYLE) ──
  if (view === "editor" && useFullPage) {
    return (
      <section className="freight-airline-tariff-screen grid gap-2 freight-ui-standard freight-dense-form">
        {/* Top Header Card - Prepaid Register Style */}
        <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="tariff-page-icon">
              <FileText size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight text-slate-900">
                {editMode ? `Edit ${config.title}` : `New ${config.title}`}
              </h1>
              <p className="m-0 text-xs text-slate-500">{config.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="wms-master-form"
              disabled={saving}
              className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? <span className="spinner small" /> : <Save size={14} />} Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCloseForm}
              disabled={saving}
              aria-label="Close"
              title="Close"
              className="h-8 w-8 rounded-lg"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Form content */}
        <div className="flex flex-col gap-2">
          {renderFormContent()}
        </div>
      </section>
    );
  }

  // ── RENDER LIST (PREPAID REGISTER STYLE) ──
  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      {/* Page Header */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <FileText size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{config.title}</h1>
            <p className="m-0 text-xs text-slate-500">{config.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Records`}
          subtitle={`${config.title} List`}
          searchValue={query}
          onSearchChange={(value: any) => { setQuery(value); setPageIndex(0); }}
          searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
          loading={loading}
          emptyText={`No ${config.title.toLowerCase()} records found`}
          height={620}
          minWidth={Math.max(900, tableFields.reduce((sum, field) => sum + (field.width || 160), 160))}
          density="grid"
          enablePagination
          enableExport={false}
          manualPagination={!(query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()))}
          manualFiltering={false}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters: any) => { setColumnFilters(filters); setPageIndex(0); }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize: any) => { setPageSize(nextPageSize); setPageIndex(0); }}
          getRowId={(row: any, index: any) => generateRowId(row, config, index)}
          actionButton={
            <div className="flex items-center gap-2">
              {config.ediUploadConfig?.open && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEdiUploadOpen(true)}
                  className="h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <CloudUpload size={14} /> EDI Upload
                </Button>
              )}
              <Button
                type="button"
                onClick={openAdd}
                disabled={saving}
                className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3.5 rounded-lg cursor-pointer transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                onExport={() =>
                  exportToCsv(
                    rows,
                    columns.filter((column) => column.id !== "actions"),
                    `${config.title.toLowerCase().replace(/\s+/g, "-")}-list.csv`,
                  )
                }
                onRefresh={() => void loadRows()}
              />
            </div>
          }
        />
      </div>

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