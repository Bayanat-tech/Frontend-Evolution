import { useEffect, useState, type FormEvent } from "react";
import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { deleteWaybillMaster, getWaybillMaster, saveWaybillMaster, type WaybillMasterKind, type WaybillMasterRow } from "../../api/vendor";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { WmsDataTable } from "../../components/ui/WmsDataTable";
import { Input } from "../../components/ui/Input";
import type { Notice } from "./vendorTypes";

type MasterField = { key: string; label: string; numeric?: boolean; lookup?: "city" | "well_id" };
const definitions: Record<WaybillMasterKind, { title: string; fields: MasterField[] }> = {
  rates: { title: "Revenue Table (Lookup)", fields: [
    { key: "city", label: "City" },
    { key: "base_kms", label: "Base Kms", numeric: true },
    { key: "standard_revenue", label: "Standard Revenue", numeric: true },
    { key: "non_standard_revenue", label: "Non-Standard Revenue", numeric: true },
    { key: "standard_kms_charge", label: "Standard charge per Km", numeric: true },
    { key: "non_standard_kms_charge", label: "Non-Standard charge per Km", numeric: true },
  ] },
  wells: { title: "Well IDs (Destination Lookup)", fields: [
    { key: "well_id", label: "Well ID / Destination Name" },
    { key: "city", label: "City", lookup: "city" },
    { key: "actual_kms", label: "Actual Kms", numeric: true },
  ] },
  distances: { title: "Non-Standard Kms Table (Data and Lookup)", fields: [
    { key: "well_id_1", label: "Well ID 1", lookup: "well_id" },
    { key: "well_id_2", label: "Well ID 2", lookup: "well_id" },
    { key: "distance", label: "Distance (Kms)", numeric: true },
  ] },
};

function MasterEditor({ kind }: { kind: WaybillMasterKind }) {
  const definition = definitions[kind];
  const [rows, setRows] = useState<WaybillMasterRow[]>([]);
  const [lookups, setLookups] = useState<WaybillMasterRow[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WaybillMasterRow | null>(null);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fetchData = () => Promise.all([
    getWaybillMaster(kind),
    kind === "rates" ? Promise.resolve([]) : getWaybillMaster(kind === "wells" ? "rates" : "wells"),
  ]);
  const refresh = async () => {
    setLoading(true);
    try {
      const [data, options] = await fetchData();
      setRows(data); setLookups(options); setLoaded(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load masters." });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    fetchData().then(([data, options]) => {
      if (active) { setRows(data); setLookups(options); setLoaded(true); }
    }).catch((error: unknown) => {
      if (active) setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load masters." });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);

  const reset = () => { setForm({}); setEditingId(undefined); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await saveWaybillMaster(kind, form, editingId);
      reset();
      setFormOpen(false);
      setNotice({ type: "success", message: "Master entry saved." });
      try { setRows(await getWaybillMaster(kind)); }
      catch { setNotice({ type: "error", message: "Entry saved, but the list could not refresh. Reopen this master screen to reload it." }); }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save master entry." });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true); setNotice(null);
    try {
      await deleteWaybillMaster(kind, deleteTarget.id);
      setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Master entry deleted." });
      try { setRows(await getWaybillMaster(kind)); }
      catch { setNotice({ type: "error", message: "Entry deleted, but the list could not refresh. Use Refresh to reload it." }); }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete master entry." });
    } finally { setSaving(false); }
  };

  return <div className="grid gap-4">
    <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">{definition.title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" disabled={loading || saving} onClick={() => void refresh()}><RefreshCw size={15} /></Button>
        <Button title={`Add ${definition.title}`} disabled={loading || saving || !loaded} onClick={() => { reset(); setNotice(null); setFormOpen(true); }}><Plus size={15} /> Add</Button>
      </div>
    </div>
    <WmsDataTable<WaybillMasterRow, unknown>
      columns={[
        ...definition.fields.map((field) => ({ accessorKey: field.key, header: field.label, size: 180 })),
        ...(kind === "wells" ? [{ accessorKey: "base_kms", header: "Base Kms" }, { accessorKey: "diversion_kms", header: "Diversion Kms" }] : []),
        { id: "actions", header: "Actions", size: 90, cell: ({ row }) => <div className="flex items-center justify-center gap-1">
          <Button size="icon" variant="ghost" title={`Edit ${definition.title}`} aria-label={`Edit ${definition.title}`} disabled={saving || loading} onClick={() => {
            setEditingId(row.original.id);
            setForm(Object.fromEntries(definition.fields.map((field) => [field.key, String(row.original[field.key] ?? "")])));
            setNotice(null); setFormOpen(true);
          }}><Edit2 size={14} /></Button>
          <Button size="icon" variant="ghost" title={`Delete ${definition.title}`} aria-label={`Delete ${definition.title}`} disabled={saving || loading} onClick={() => { setNotice(null); setDeleteTarget(row.original); }}><Trash2 size={14} /></Button>
        </div> },
      ]}
      data={rows} loading={loading} height={620} minWidth={Math.max(900, definition.fields.length * 180 + 90)} density="grid"
      title={`${rows.length} Records`} subtitle={`${definition.title} List`}
      searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${definition.title.toLowerCase()}...`}
      getRowId={(row) => String(row.id)} enablePagination pageSize={100}
      emptyText="No master entries yet" enableExport exportFilename={`waybill-${kind}.csv`}
    />
    <Dialog open={formOpen} title={`${editingId ? "Edit" : "Add"} ${definition.title}`} description="Master details" compact wide onClose={() => { if (!saving) setFormOpen(false); }}>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          {definition.fields.map((field) => <label key={field.key} className="grid gap-1 text-sm">
            <span>{field.label} *</span>
            {field.lookup ? <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={form[field.key] || ""} required disabled={saving || loading}
              onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
            >
              <option value="">Select {field.lookup === "city" ? "city" : "well"}</option>
              {lookups.map((row) => <option key={row.id} value={String(row[field.lookup!])}>{String(row[field.lookup!])}</option>)}
            </select> : <Input
              value={form[field.key] ?? ""} required disabled={saving || loading}
              type={field.numeric ? "number" : "text"} min={field.numeric ? 0 : undefined}
              max={field.numeric ? "99999999999.999" : undefined}
              step={field.numeric ? "0.001" : undefined} maxLength={field.numeric ? undefined : 200}
              onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
            />}
          </label>)}
        </div>
        {kind === "wells" && <p className="text-xs text-muted-foreground">Use the destination name shown on the waybill as the Well ID. Diversion Kms = Actual Kms − city Base Kms − 15; this value is calculated automatically.</p>}
        {kind !== "rates" && !loading && lookups.length === 0 && <p className="text-sm">Create {kind === "wells" ? "city rates" : "well destinations"} first.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}><X size={15} /> Cancel</Button>
          <Button type="submit" disabled={saving || loading || (kind !== "rates" && lookups.length === 0)}><Save size={15} />{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </Dialog>
    <Dialog open={Boolean(deleteTarget)} title={`Delete ${definition.title}`} description={deleteTarget ? `Delete ${definition.fields.filter((field) => !field.numeric).map((field) => deleteTarget[field.key]).join(" / ")}?` : undefined}
      compact tone="danger" onClose={() => { if (!saving) setDeleteTarget(null); }}
      footer={<><Button variant="outline" disabled={saving} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void confirmDelete()}>{saving ? "Deleting..." : "Delete"}</Button></>}>
      <p className="m-0 text-sm text-muted-foreground">This action cannot be undone. Entries referenced by another master cannot be deleted.</p>
    </Dialog>
  </div>;
}

export function WaybillMastersPage({ kind }: { kind: WaybillMasterKind }) {
  return <section className="grid gap-4">
    <MasterEditor key={kind} kind={kind} />
  </section>;
}
