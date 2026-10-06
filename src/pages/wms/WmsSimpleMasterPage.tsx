import { CloudUpload, Edit2, FileText, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { deleteWmsGm, deleteWmsGmRaw, getWmsMaster, saveWmsGm } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
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
  /** OPTIONAL. Splits the form into steps with Back / Next (Next validates the current step's required entries). */
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

type Notice = { type: "success" | "error"; message: string } | null;

const FORM_ID = "wms-master-form";

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
      if (typeof responseData === "string") return responseData;
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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function WmsSimpleMasterPage({ config }: { config: WmsSimpleMasterConfig }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const editableFields = config.fields;
  const tableFields = config.fields.filter((field) => field.table !== false);
  const hasTabs = Boolean(config.formTabs && config.formTabs.length > 0);
  const deleteDisabled = !config.customDelete && config.deleteConfig?.mode === "disabled";

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize, clearNotice = true) => {
    setLoading(true);
    setRows([]);
    if (clearNotice) setNotice(null);
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
      setNotice({ type: "error", message: getErrorMessage(error, `Unable to load ${config.title}`) });
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
      ...tableFields.map((field, index) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width || 160,
        cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
          const value = formatValue(row.original[field.name]);
          const alignmentClass = field.align
            ? field.align === "right" ? "text-right" : field.align === "center" ? "text-center" : "text-left"
            : "text-left";
          if (index === 0) {
            return (
              <div className={alignmentClass}>
                <button
                  type="button"
                  onClick={() => openEdit(row.original)}
                  className="font-semibold text-[#00378C] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
                  title="Click to edit"
                >
                  {value}
                </button>
              </div>
            );
          }
          return <div className={alignmentClass}>{value}</div>;
        },
      })),
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
              onClick={() => openEdit(row.original)}
              title="Edit"
            >
              <Edit2 size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md"
              disabled={deleteDisabled}
              onClick={() => setDeleteTarget(row.original)}
              title={deleteDisabled ? config.deleteConfig?.reason || "Delete endpoint is not registered" : "Delete"}
            >
              <Trash2 size={15} />
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
    setNotice(null);
    setView("editor");
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setOriginal(row);
    const mappedData = config.mapAfterLoad ? config.mapAfterLoad(row) : row;
    setForm({ ...makeEmpty(), ...mappedData });
    setNotice(null);
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
    const missing = editableFields.find(
      (field) => field.required && field.type !== "checkbox" && !String(form[field.name] ?? "").trim(),
    );
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
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
      setNotice({ type: "success", message: editMode ? "Successfully updated" : "Successfully created" });
      await loadRows(pageIndex, pageSize, false);
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, `Unable to save ${config.title}`) });
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
      setNotice({ type: "success", message: "Successfully deleted" });
      await loadRows(pageIndex, pageSize, false);
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, `Unable to delete ${config.title}`) });
    } finally {
      setSaving(false);
    }
  };

  const editorOpen = view === "editor";
  const pageTitle = editorOpen ? (editMode ? `Edit ${config.title}` : `New ${config.title}`) : config.title;

  return (
    <section className="grid gap-2 p-1">
      {/* ---------- Top Header (compact) ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
            <FileText size={14} />
          </div>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
        </div>

        {editorOpen && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              title="Reset"
              className="h-7 gap-1 text-xs font-semibold px-3 rounded-md"
            >
              <RefreshCw size={13} /> Reset
            </Button>
            {/* With steps, Save lives on the last step next to Back / Next. */}
            
              <Button
                type="submit"
                form={FORM_ID}
                disabled={saving}
                className="h-7 gap-1 bg-[#00378C] text-white hover:bg-[#002d72] shadow-sm text-xs font-semibold px-3 rounded-md"
              >
                <Save size={13} /> {saving ? "Saving..." : editMode ? "Update" : "Save"}
              </Button>
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCloseForm}
              disabled={saving}
              aria-label="Close"
              title="Close"
              className="h-7 w-7 rounded-md"
            >
              <X size={14} />
            </Button>
          </div>
        )}
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ---------- EDITOR ---------- */}
      {editorOpen && (
        <WmsMasterForm
          key={editMode ? `edit-${getRowDisplayKey(original || {}, config)}` : "add"}
          formId={FORM_ID}
          title={config.title}
          fields={editableFields}
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
      )}

      {/* ---------- LIST ---------- */}
      {!editorOpen && (
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Records`}
          searchValue={query}
          onSearchChange={(value: any) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
          loading={loading}
          emptyText={`No ${config.title.toLowerCase()} records found`}
          height="calc(100dvh - 150px)"
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
          onColumnFiltersChange={(filters: any) => {
            setColumnFilters(filters);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize: any) => {
            setPageSize(nextPageSize);
            setPageIndex(0);
          }}
          actionButton={
            <div className="flex items-center gap-2">
              {config.ediUploadConfig?.open && (
                <Button
                  type="button"
                  variant="outline"
                  title={`Upload ${config.title} via EDI`}
                  onClick={() => setEdiUploadOpen(true)}
                  className="h-8 gap-1.5 text-xs font-semibold px-3.5 rounded-lg"
                >
                  <CloudUpload size={14} /> EDI Upload
                </Button>
              )}
              <Button
                type="button"
                onClick={openAdd}
                disabled={saving}
                className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3.5 rounded-lg"
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                fyPeriod=""
                fyPeriods={[]}
                onFyPeriodChange={() => {}}
                onExport={() =>
                  exportToCsv(
                    rows,
                    columns,
                    `${config.title.toLowerCase().replace(/\s+/g, "-")}-list-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                onRefresh={() => void loadRows(pageIndex, pageSize, false)}
              />
            </div>
          }
          getRowId={(row: any, index: any) => generateRowId(row, config, index)}
        />
      )}

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Close</Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete <strong>{deleteTarget ? formatValue(getRowDisplayKey(deleteTarget, config)) : ""}</strong>?
        </p>
      </Dialog>

      {/* ---------- EDI UPLOAD DIALOGS ---------- */}
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