import { CloudUpload, Edit2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { WmsDataTable } from "../../components/ui/WmsDataTable";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { MasterForm } from "./MasterForm";
import { cn } from "../../lib/utils";
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
  fieldsPerRow?: number; // Number of fields per row (default: 2)
  sectionsPerRow?: number; // Number of sections per row (default: 1)
  compact? : boolean; // Compact form layout
  wide? : boolean; // Wide form layout
  mapAfterLoad?: (data: Record<string, unknown>) => Record<string, unknown>;
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

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  compact?: boolean;
  wide?: boolean;
  contentClassName?: string;
  children: ReactNode;
  onClose: () => void;
};

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

export function MasterPage({ config }: { config: MasterPageConfig }) {
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
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [ediUploadOpen, setEdiUploadOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const editableFields = config.fields;
  const tableFields = config.fields.filter((field) => field.table !== false);

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async () => {
    setLoading(true);
    setRows([]); // Clear rows immediately when loading starts
    try {
      const response = await config.customLoad(user);
      setRows(response.tableData.map(normalizeRow));
      setTotalRows(response.count ?? response.tableData.length);
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
            ? field.align === "right"
              ? "text-right"
              : field.align === "center"
                ? "text-center"
                : "text-left"
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
              onClick={() => setDeleteTarget(row.original)}
              title={`Delete ${config.title}`}
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

      await config.customSave(finalForm, { editMode, original, user });

      setFormOpen(false);
      toast.success(editMode ? "Successfully updated" : "Successfully created");
      await loadRows();
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
      await config.customDelete(deleteTarget, user);
      setDeleteTarget(null);
      toast.success("Successfully deleted");
      await loadRows();
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
          {config.ediUploadConfig?.open && (
            <Button title={`Upload ${config.title} via EDI`} onClick={() => setEdiUploadOpen(true)}>
              <CloudUpload size={15} /> EDI Upload
            </Button>
          )}
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

      <MainPageDialog
        open={formOpen}
        title={editMode ? `Edit ${config.title}` : `Add ${config.title}`}
        description="Master details"
        compact={config.compact ?? false}
        wide={config.wide ?? false}
        onClose={() => setFormOpen(false)}
      >
        <div style={{ maxHeight: "100%", overflowY: "auto", width: "100%" }}>
          <MasterForm
            fields={editableFields}
            key={formOpen ? (editMode ? `edit-${getRowDisplayKey(original || {}, config)}` : "add") : "closed"}
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
        </div>
      </MainPageDialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description={deleteTarget ? `Delete ${formatValue(getRowDisplayKey(deleteTarget, config))}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">This action cannot be undone.</p>
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

function renderInput(field: MasterField, value: unknown, disabled: boolean, onChange: (value: unknown) => void) {
  if (field.type === "select") {
    return (
      <Select disabled={disabled} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        {(field.options || []).map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
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

// function MainPageDialog({
//   open,
//   title,
//   description,
//   tone = "default",
//   compact,
//   wide,
//   contentClassName,
//   children,
//   onClose,
// }: DialogProps) {
//   if (!open) return null;
//   const editorDialog = wide || /^(add|edit|new|view)\b/i.test(title);

//   return (
//     <div
//       className={cn(
//         "fixed inset-0 z-50 grid place-items-center p-5 backdrop-blur-[1px]",
//         editorDialog ? "bg-background/95" : "bg-slate-950/50",
//       )}
//       onClick={onClose}
//     >
//       <div
//         className={cn(
//           // ← restored: rounded, border, bg, shadow, max-h, overflow-hidden
//           "grid max-h-[94vh] w-[min(96vw,560px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl",
//           compact && "w-[min(94vw,460px)]",
//           wide && "max-h-[min(96vh,920px)] w-[min(98vw,1440px)]",
//           editorDialog && !compact && !wide && "w-[min(96vw,920px)]",
//           contentClassName,
//         )}
//         onClick={(e) => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div
//           className={cn(
//             "flex items-start justify-between gap-4 border-b bg-secondary/70 p-4",
//             tone === "danger" && "[&_h2]:text-destructive",
//           )}
//         >
//           <div>
//             <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
//             {description && (
//               <p className="mt-1 text-sm text-muted-foreground">{description}</p>
//             )}
//           </div>
//           <Button aria-label="Close" type="button" variant="ghost" size="icon" onClick={onClose}>
//             <X size={16} />
//           </Button>
//         </div>

// {/* Body — scrollable so content never bleeds outside the modal */}
// <div className="min-h-0 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
//   {children}
// </div>
//       </div>
//     </div>
//   );
// }

function MainPageDialog({
  open,
  title,
  description,
  tone = "default",
  compact,
  wide,
  contentClassName,
  children,
  onClose,
}: DialogProps) {
  if (!open) return null;

  const editorDialog = wide || /^(add|edit|new|view)\b/i.test(title);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 grid place-items-center backdrop-blur-[1px]",
        wide ? "p-0" : "p-5",
        editorDialog ? "bg-background/95" : "bg-slate-950/50",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "grid max-h-[94vh] w-[min(96vw,560px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl",
          compact && "w-[min(94vw,460px)]",
          wide &&
            "h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none border-0 shadow-none",
          editorDialog && !compact && !wide && "w-[min(96vw,920px)]",
          contentClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-start justify-between gap-4 border-b bg-secondary/70 p-2",
            tone === "danger" && "[&_h2]:text-destructive",
          )}
        >
          <div>
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button
            aria-label="Close"
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Body — scrollable so content never bleeds outside the modal */}
        <div
          className={cn("min-h-0 overflow-y-auto p-1")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full h-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

