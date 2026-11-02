import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, FileText, Loader2, Plus, Printer, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { deleteHrMaster, saveHrGm, getHrMaster } from "../../../api/hr";
import { getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { NewReportDialog } from "../../../components/new_report_format";
import { Select } from "../../../components/ui/Select";
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
  fields: { name: string; label: string; required?: boolean; disabledOnEdit?: boolean; disabledOnAdd?: boolean; width?: number; type?: "text" | "select"; options?: { label: string; value: string }[] }[];
  defaults?: Record<string, unknown>;
};

const PRINT_IFRAME_ID = "master-print-iframe";

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

  const confirmDelete = async () => {
    if (!deleteTarget || !config.enableDelete) return;
    setSaving(true);
    try {
      await deleteHrMaster(config.gmEndpoint!, [deleteTarget[config.keyField]]);
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
      <section className="p-4 grid gap-4">
        <div className="flex justify-between items-center bg-card p-2 border rounded-md">
          <h1 className="text-lg font-semibold">{editorMode === "edit" ? `Edit ${config.title}` : `New ${config.title}`}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} /> Cancel</Button>
            <Button onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card p-4 border rounded-md">
          {config.fields.map(f => (
            <label key={f.name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted-foreground">{f.label} {f.required && "*"}</span>
              {f.type === "select" ? (
                <Select value={String(form[f.name] || "")} onChange={e => setForm({...form, [f.name]: e.target.value})}>
                  <option value="">Select...</option>
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : (
                <Input value={String(form[f.name] || "")} disabled={editorMode === "edit" && f.disabledOnEdit} onChange={e => setForm({...form, [f.name]: e.target.value})} />
              )}
            </label>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 grid gap-4">
      <div className="flex justify-between items-center bg-card p-3 border rounded-md shadow-sm">
        <h1 className="text-lg font-semibold flex items-center gap-2"><FileText size={18} /> {config.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRows} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</Button>
          <Button onClick={() => openEditor("add")}><Plus size={14} /> Add</Button>
        </div>
      </div>

      <DataTable columns={columns} data={rows} loading={loading} searchValue={query} onSearchChange={setQuery} />

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