import { CloudUpload, Edit2, FileText, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";
import { MasterForm } from "./MasterForm";
import { Dialog } from "./Dialog";

export type MasterField = {
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
  populateFields?: Record<string, string>;
};

export type MasterFormTab = {
  key: string;
  label: string;
};

export type MasterPageConfig = {
  title: string;
  subtitle: string;
  master: string;
  routeKeys?: string[];
  keyField?: string; // Single key field (fallback if keyFields not provided)
  keyFields?: string[]; // Multiple fields to compose unique row ID
  fields: MasterField[];
  defaults?: Record<string, unknown>;
  fieldsPerRow?: number; // Number of fields per row (default: 4)
  sectionsPerRow?: number; // Number of sections per row (default: 1)
  compact?: boolean; // kept for backwards compatibility (no longer used by the in-page editor)
  wide?: boolean; // kept for backwards compatibility (no longer used by the in-page editor)
  mapAfterLoad?: (data: Record<string, unknown>) => Record<string, unknown>;
  /**
   * OPTIONAL. Provide to split the form into steps with Back / Next buttons.
   * Assign each field to a step with `field.tab`. Next validates the required entries of the
   * current step before moving on, and Save validates every step.
   */
  formTabs?: MasterFormTab[];

  // Only supported data path now: caller supplies its own load/save/delete implementations.
  customLoad: (user: unknown) => Promise<{ tableData: Record<string, unknown>[]; count?: number }>;
  customSave: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown }) => Promise<void>;
  customDelete: (row: Record<string, unknown>, user: unknown) => Promise<void>;

  rowIdSeparator?: string; // Separator for composite row IDs (default: '_')
  ediUploadConfig?: {
    open: boolean;
    name: "location" | "product" | "site";
  };
};

type Notice = { type: "success" | "error"; message: string } | null;

function generateRowId(row: Record<string, unknown>, config: MasterPageConfig, index: number): string {
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

function getRowDisplayKey(row: Record<string, unknown>, config: MasterPageConfig): string {
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
      if (typeof responseData === "string") return responseData;
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
  config: MasterPageConfig
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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function MasterPage({ config }: { config: MasterPageConfig }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [, setEdiUploadOpen] = useState(false);

  const editableFields = config.fields;
  const tableFields = config.fields.filter((field) => field.table !== false);
  const hasTabs = Boolean(config.formTabs && config.formTabs.length > 0);
  const formId = `${config.master}-master-form`;

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    setRows([]); // Clear rows immediately when loading starts
    if (clearNotice) setNotice(null);
    try {
      const response = await config.customLoad(user);
      setRows(response.tableData.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, `Unable to load ${config.title}`) });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };


   const resetForm = () => {
    if (editMode && original) {
   
      setForm({ ...makeEmpty(), ...original, active: original.active ?? original.is_active ?? "" });
    } else {
     
      setForm(makeEmpty());
    }
    setError("");
  };


  useEffect(() => {
    void loadRows();
  }, [config.master]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [rows, query]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      ...tableFields.map((field, index) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width || 160,
        cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
          const value = formatValue(row.original[field.name]);
          const alignmentClass = field.align
            ? field.align === "right"
              ? "text-right"
              : field.align === "center"
                ? "text-center"
                : "text-left"
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
              onClick={() => setDeleteTarget(row.original)}
              title="Delete"
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
    setFormOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setOriginal(row);
    const mappedData = config.mapAfterLoad ? config.mapAfterLoad(row) : row;
    setForm({ ...makeEmpty(), ...mappedData });
    setNotice(null);
    setFormOpen(true);
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
        if (field.type === "checkbox") {
          value = value === true || value === "Y" ? "Y" : "N";
        }
        if (value === "") value = null;
        acc[field.name] = value;
        return acc;
      }, {} as Record<string, unknown>);

      const finalForm = { ...transformedForm, company_code: transformedForm.company_code || user?.company_code || "" };

      await config.customSave(finalForm, { editMode, original, user });

      setFormOpen(false);
      setNotice({ type: "success", message: editMode ? "Successfully updated" : "Successfully created" });
      await loadRows(false);
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
      await config.customDelete(deleteTarget, user);
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Successfully deleted" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, `Unable to delete ${config.title}`) });
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = formOpen ? (editMode ? `Edit ${config.title}` : `New ${config.title}`) : config.title;

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

        {formOpen && (
          <div className="flex items-center gap-1.5">
            {/* With steps, Save lives on the last step next to Back / Next. */}
            <Button
      type="button"
      variant="outline"
      onClick={resetForm}
      disabled={saving}
      title="Reset form"
      className="h-7 gap-1 px-3 text-xs font-semibold rounded-md"
    >
      <RotateCcw size={13} /> Reset
    </Button>
              
            {!hasTabs && (

              
              <Button
                type="submit"
                form={formId}
                disabled={saving}
                className="h-7 gap-1 bg-[#00378C] text-white hover:bg-[#002d72] shadow-sm text-xs font-semibold px-3 rounded-md"
              >
                <Save size={13} /> {saving ? "Saving..." : editMode ? "Update" : "Save"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setFormOpen(false)}
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
      {formOpen && (
        <MasterForm
          key={editMode ? `edit-${getRowDisplayKey(original || {}, config)}` : "add"}
          formId={formId}
          title={config.title}
          fields={editableFields}
          tabs={config.formTabs}
          fieldsPerRow={config.fieldsPerRow}
          sectionsPerRow={config.sectionsPerRow}
          form={form}
          editMode={editMode}
          saving={saving}
          user={user}
          onChange={(name: any, value: any) =>
            setForm((prev) => {
              const updated = { ...prev, [name]: value };
              // Clear dependent fields if a parent field is cleared
              return clearDependentFields(name, value, updated, config);
            })
          }
          onSave={saveRecord}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {/* ---------- LIST ---------- */}
      {!formOpen && (
        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
          loading={loading}
          emptyText={`No ${config.title.toLowerCase()} records found`}
          height="calc(100dvh - 150px)"
          minWidth={Math.max(900, tableFields.reduce((sum, field) => sum + (field.width || 160), 160))}
          density="grid"
          enablePagination={false}
          enableExport={false}
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
                    filteredRows,
                    columns,
                    `${config.master}-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                onRefresh={() => void loadRows(false)}
              />
            </div>
          }
          getRowId={(row, index) => generateRowId(row, config, index)}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Close
            </Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete <strong>{deleteTarget ? formatValue(getRowDisplayKey(deleteTarget, config)) : ""}</strong>?
        </p>
      </Dialog>
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