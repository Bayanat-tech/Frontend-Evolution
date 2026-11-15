import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, FileText, Loader2, Plus, Printer, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { deleteHrMaster, saveHrGm, getHrMaster } from "../../../api/hr";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, type LookupRow } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NewReportDialog } from "../../../components/new_report_format";
import { Select } from "../../../components/ui/Select";
import type { HrMasterContext, HrMasterField } from "../HrMasterPage";
import { useAuth } from "../../../state/AuthContext";

export type MasterReportConfig = {
  title: string;
  gridParameter?: string;  // 👈 Make optional
  gridEndpoint?: string;   // 👈 Add this for non-dynamic endpoints (like "formaldesignation")
  reportUrl: string;
  keyField: string;
  source: "dynamic" | "gm";
  gmEndpoint?: string;
  enableDelete?: boolean;
  deleteParameter?: string;
  fields: HrMasterField[];
  defaults?: Record<string, unknown>;
};

const PRINT_IFRAME_ID = "master-print-iframe";

function getLookupDisplayPatch(field: HrMasterField, row?: LookupRow | null) {
  if (!field.lookup) return {};
  const nameField = `${field.name}_name`;
  if (!row) return { [nameField]: "" };

  const labelValue = field.lookup.displayFields
    .filter((displayField) => displayField !== field.lookup?.valueField)
    .map((displayField) => getLookupValue(row, displayField))
    .find((value) => String(value ?? "").trim());
  return { [nameField]: labelValue ?? "" };
}

const fetchReportHtml = async (url: string, payload: any): Promise<string> => {
  try {
    const res = await api.post(url, payload, { responseType: "text" });
    return res.data;
  } catch (e: any) {
    let message = "Failed to load report.";
    const data = e?.response?.data;
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed?.message) message = parsed.message;
    } catch {}
    throw new Error(message);
  }
};

export function MasterWithReportPage({ config }: { config: MasterReportConfig }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [activeRow, setActiveRow] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      // 👇 If gridEndpoint is provided, use the old getHrMaster API instead of dynamic lookup
      if (config.gridEndpoint) {
        const response = await getHrMaster(config.gridEndpoint, { page: 1, limit: 10000 });
        setRows(response.tableData || []);
      } else if (config.gridParameter) {
        const response = await getDynamicLookup({ parameter: config.gridParameter, loginid, code1: companyCode });
        setRows(Array.isArray(response) ? response : []);
      }
    } catch (error) {
      setRows([]);
      toast.error("Unable to load data");
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode, config.gridParameter, config.gridEndpoint]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  const makeEmpty = () => ({ company_code: companyCode, ...config.defaults });
  const lookupContext: HrMasterContext = {
    loginid,
    companyCode,
    editMode: editorMode === "edit",
    rows,
    form,
  };

  const openEditor = (mode: "add" | "edit", row: any = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setForm(mode === "edit" && row ? { ...makeEmpty(), ...row, _edit_key: row[config.keyField] } : makeEmpty());
    setView("editor");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, company_code: companyCode };
      if (editorMode === "edit") payload._edit_key = activeRow?.[config.keyField];
      await saveHrGm(config.gmEndpoint!, payload, editorMode === "edit" ? "put" : "post");
      toast.success(`${config.title} saved successfully`);
      setView("list");
      void loadRows();
    } catch (error: any) {
      toast.error(error.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (row: any) => {
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setReportLoading(true);
    try {
      setReportHtml(await fetchReportHtml(config.reportUrl, { company_code: row.company_code || companyCode, [config.keyField]: row[config.keyField] }));
    } catch (error: any) {
      setReportPreviewError(error.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrintAll = async () => {
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setReportLoading(true);
    try {
      setReportHtml(await fetchReportHtml(config.reportUrl, { company_code: companyCode, [config.keyField]: "All" }));
    } catch (error: any) {
      setReportPreviewError(error.message);
    } finally {
      setReportLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !config.enableDelete) return;
    setSaving(true);
    try {
      if (config.source === "dynamic" && config.deleteParameter) {
        await executeDynamicDelete({
          parameter: config.deleteParameter,
          loginid,
          code1: companyCode,
          code2: String(deleteTarget[config.keyField] ?? ""),
        });
      } else {
        await deleteHrMaster(config.gmEndpoint!, [deleteTarget[config.keyField]]);
      }
      toast.success(`${config.title} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error: any) {
      toast.error(error.message || `Unable to delete ${config.title}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!reportHtml) return;
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(reportHtml); doc.close();
      setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }, 500);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    ...config.fields.map(f => ({ accessorKey: f.name, header: f.label, size: f.width || 150 })),
    {
      id: "actions", header: "Actions", size: 110,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => openEditor("edit", row.original)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={14} /></button>
          <button onClick={() => void handlePrint(row.original)} className="text-slate-600 hover:bg-slate-100 p-1 rounded"><Printer size={14} /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
        </div>
      )
    }
  ], [config]);

  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {editorMode === "edit" ? `Edit ${config.title}` : `New ${config.title}`}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editorMode === "edit" ? "Editing" : "Draft"}
                </span>
                {activeRow?.[config.keyField] && (
                  <span className="text-xs text-muted-foreground">{String(activeRow[config.keyField])}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setView("list")} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setView("list")} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Save size={14} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          noValidate
        >
          <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
            <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="freight-section-icon"><FileText size={16} /></span>
                <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">Basic Information</h3>
              </div>
            </div>
            <div className="freight-panel-body p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {config.fields.map((field) => {
                  if (field.hideOnAdd && editorMode === "add") return null;
                  const disabled = Boolean(
                    (editorMode === "edit" && field.disabledOnEdit) ||
                    (editorMode === "add" && field.disabledOnAdd),
                  );
                  const value = form[field.name];

                  return (
                    <label key={field.name} className="freight-field-label group flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground transition-colors group-focus-within:text-primary">
                        {field.label}
                        {field.required && <strong className="ml-0.5 font-bold text-red-600"> *</strong>}
                      </span>
                      {field.lookup ? (
                        <LookupField
                          compact
                          label=""
                          value={String(value ?? "")}
                          displayValue={
                            String(value ?? "")
                              ? [value, form[`${field.name}_name`]].filter(Boolean).join(" - ") || String(value)
                              : ""
                          }
                          columns={field.lookup.columns}
                          valueField={field.lookup.valueField}
                          displayFields={field.lookup.displayFields}
                          loadOptions={() => field.lookup!.loadOptions(lookupContext)}
                          disabled={disabled}
                          onChange={(nextValue, selectedRow) =>
                            setForm((current) => {
                              const next = {
                                ...current,
                                [field.name]: nextValue,
                                ...getLookupDisplayPatch(field, selectedRow),
                              };
                              if (field.name === "div_code") {
                                next.dept_code = "";
                                next.dept_code_name = "";
                              }
                              return next;
                            })
                          }
                        />
                      ) : field.type === "select" ? (
                        <Select
                          value={String(value ?? "")}
                          disabled={disabled}
                          onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                        >
                          <option value="">Select {field.label}</option>
                          {(field.options || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={field.type === "email" ? "text" : field.type || "text"}
                          value={field.type === "date" ? String(value ?? "").slice(0, 10) : String(value ?? "")}
                          disabled={disabled}
                          placeholder={field.Placeholder}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            [field.name]: field.type === "number" ? Number(event.target.value || 0) : event.target.value,
                          }))}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </section>
    );
  }

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <h2 className="m-0 text-foreground" style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}>
          {config.title}
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Records`}
        subtitle={`${config.title} List`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading}
        emptyText={`No ${config.title.toLowerCase()} records found`}
        height={620}
        minWidth={Math.max(900, config.fields.filter((field) => field.table !== false).reduce((sum, field) => sum + (field.width || 160), 170))}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => String(row[config.keyField] || `${config.keyField}_${index}`)}
        enableExport
        exportFilename={`hr-${config.keyField}-list.csv`}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRows()}
              title="Refresh"
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-secondary"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handlePrintAll()}
              title={`Print all ${config.title}`}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-secondary"
            >
              <Printer size={14} />
              Print All
            </button>
            <button
              type="button"
              onClick={() => openEditor("add")}
              title={`Add ${config.title}`}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        }
      />

      <NewReportDialog
        open={reportPreviewOpen}
        onClose={() => setReportPreviewOpen(false)}
        title={`${config.title} Report`}
        htmlContent={reportHtml}
        loading={reportLoading}
        error={reportPreviewError}
        onDownloadPdf={handleDownloadPdf}
      />

      <Dialog
        open={config.enableDelete === true && Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description="This will remove the selected HR master record."
        compact
        tone="danger"
        onClose={() => {
          if (!saving) setDeleteTarget(null);
        }}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Confirm delete for <strong>{String(deleteTarget?.[config.keyField] ?? "")}</strong>.
        </p>
      </Dialog>
    </section>
  );
}