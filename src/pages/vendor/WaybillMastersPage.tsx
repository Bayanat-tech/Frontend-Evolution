import { useEffect, useState, type FormEvent } from "react";
import { getWaybillMaster, saveWaybillMaster, type WaybillMasterKind, type WaybillMasterRow } from "../../api/vendor";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { VendorPageHeader } from "./components";
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
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getWaybillMaster(kind),
      kind === "rates" ? Promise.resolve([]) : getWaybillMaster(kind === "wells" ? "rates" : "wells"),
    ]).then(([data, options]) => {
      if (active) { setRows(data); setLookups(options); }
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
      setNotice({ type: "success", message: "Master entry saved." });
      try { setRows(await getWaybillMaster(kind)); }
      catch { setNotice({ type: "error", message: "Entry saved, but the list could not refresh. Reopen this tab to reload it." }); }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save master entry." });
    } finally { setSaving(false); }
  };

  return <div className="grid gap-4">
    <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
    <Card><CardContent className="pt-4">
      <form onSubmit={(event) => void submit(event)} className="grid gap-4">
        <div className="text-sm font-semibold">{editingId ? "Edit master entry" : "Add master entry"}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          {editingId && <Button type="button" variant="outline" onClick={reset} disabled={saving}>Cancel edit</Button>}
          <Button type="submit" disabled={saving || loading || (kind !== "rates" && lookups.length === 0)}>{saving ? "Saving..." : editingId ? "Save changes" : "Add entry"}</Button>
        </div>
      </form>
    </CardContent></Card>
    <DataTable<WaybillMasterRow, unknown>
      columns={[
        ...definition.fields.map((field) => ({ accessorKey: field.key, header: field.label })),
        ...(kind === "wells" ? [{ accessorKey: "base_kms", header: "Base Kms" }, { accessorKey: "diversion_kms", header: "Diversion Kms" }] : []),
        { id: "actions", header: "Actions", cell: ({ row }) => <Button variant="outline" disabled={saving || loading} onClick={() => {
          setEditingId(row.original.id);
          setForm(Object.fromEntries(definition.fields.map((field) => [field.key, String(row.original[field.key] ?? "")])));
          setNotice(null);
        }}>Edit</Button> },
      ]}
      data={rows} loading={loading} height={360} minWidth={900}
      emptyText="No master entries yet" enableExport exportFilename={`waybill-${kind}.csv`}
    />
  </div>;
}

export function WaybillMastersPage() {
  const [kind, setKind] = useState<WaybillMasterKind>("rates");
  return <section className="grid gap-4">
    <VendorPageHeader title="Waybill masters" description="Set up city rates, map well destinations to cities, and record distances between drop points." />
    <div className="flex flex-wrap gap-2">
      {(Object.keys(definitions) as WaybillMasterKind[]).map((key) => <Button key={key} variant={key === kind ? "default" : "outline"} onClick={() => setKind(key)}>{definitions[key].title}</Button>)}
    </div>
    <MasterEditor key={kind} kind={kind} />
  </section>;
}
