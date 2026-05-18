import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { deleteWmsGm, deleteWmsGmRaw, getWmsMaster, saveWmsGm } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

export type WmsMasterField = {
  name: string;
  label: string;
  required?: boolean;
  disabledOnEdit?: boolean;
  type?: "text" | "number" | "select" | "email";
  options?: { label: string; value: string }[];
  table?: boolean;
  width?: number;
};

export type WmsDeleteConfig = {
  mode: "registered" | "rawPost" | "rawDelete" | "disabled";
  payload: (row: Record<string, unknown>) => unknown;
  reason?: string;
};

export type WmsSimpleMasterConfig = {
  title: string;
  subtitle: string;
  master: string;
  gmEndpoint: string;
  routeKeys?: string[];
  keyField: string;
  fields: WmsMasterField[];
  defaults?: Record<string, unknown>;
  deleteConfig?: WmsDeleteConfig;
  mapBeforeSave?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null }) => Record<string, unknown>;
  saveEndpoint?: (form: Record<string, unknown>, context: { editMode: boolean; original: Record<string, unknown> | null }) => string;
};

export function WmsSimpleMasterPage({ config }: { config: WmsSimpleMasterConfig }) {
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
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const editableFields = config.fields;
  const tableFields = config.fields.filter((field) => field.table !== false);

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
    setNotice(null);
    try {
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
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
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
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title={`Edit ${config.title}`}>
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={config.deleteConfig?.mode === "disabled"}
              onClick={() => setDeleteTarget(row.original)}
              title={config.deleteConfig?.mode === "disabled" ? config.deleteConfig.reason || "Delete endpoint is not registered" : `Delete ${config.title}`}
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
    setNotice(null);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
    setFormOpen(true);
    setNotice(null);
  };

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
    const missing = editableFields.find((field) => field.required && !String(form[field.name] ?? "").trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const mapped = config.mapBeforeSave?.(form, { editMode, original }) || form;
      const endpoint = config.saveEndpoint?.(mapped, { editMode, original }) || config.gmEndpoint;
      await saveWmsGm(endpoint, { ...mapped, company_code: mapped.company_code || user?.company_code || "" }, editMode ? "put" : "post");
      setFormOpen(false);
      setNotice({ type: "success", message: `${config.title} ${editMode ? "updated" : "added"} successfully` });
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to save ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !config.deleteConfig || config.deleteConfig.mode === "disabled") return;
    setSaving(true);
    setNotice(null);
    try {
      const payload = config.deleteConfig.payload(deleteTarget);
      if (config.deleteConfig.mode === "registered") {
        await deleteWmsGm(config.gmEndpoint, payload);
      } else {
        await deleteWmsGmRaw(config.gmEndpoint, payload, config.deleteConfig.mode === "rawDelete" ? "delete" : "post");
      }
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${config.title} deleted successfully` });
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">WMS Master</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{config.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>

      {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>}

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
        getRowId={(row, index) => String(row[config.keyField] || `${config.master}_${index}`)}
      />

      <Dialog open={formOpen} title={editMode ? `Edit ${config.title}` : `Add ${config.title}`} description="Master details" compact onClose={() => setFormOpen(false)}>
        <form className="grid gap-4" onSubmit={saveRecord}>
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
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description={deleteTarget ? `Delete ${formatValue(deleteTarget[config.keyField])}?` : undefined}
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
