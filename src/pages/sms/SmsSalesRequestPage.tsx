import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { deleteSmsMaster, getSmsMaster, getSmsMasterData, saveSmsGm, type SmsMasterData, type SmsRow } from "../../api/sms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";

type SmsSalesField = {
  name: string;
  label: string;
  type?: "date" | "number";
  required?: boolean;
  disabled?: boolean;
  source?: keyof SmsMasterData;
  labelKey?: string;
  width: number;
};

const fields: SmsSalesField[] = [
  { name: "sr_no", label: "Sr No", type: "number", disabled: true, width: 90 },
  { name: "sales_name", label: "Sales Name", required: true, source: "salesmen", labelKey: "sales_name", width: 180 },
  { name: "company_name", label: "Company Name", required: true, source: "companies", labelKey: "company_name", width: 220 },
  { name: "service_offered", label: "Service", required: true, source: "services", labelKey: "service_name", width: 180 },
  { name: "segment", label: "Segment", required: true, source: "segments", labelKey: "segment_name", width: 160 },
  { name: "contact_name", label: "Contact Name", required: true, width: 180 },
  { name: "contact_number", label: "Contact Number", type: "number", width: 150 },
  { name: "deal_desc", label: "Deal Description", required: true, width: 260 },
  { name: "deal_ref", label: "Deal Ref", width: 160 },
  { name: "deal_date", label: "Deal Date", type: "date", width: 130 },
  { name: "deal_size", label: "Deal Size", width: 140 },
  { name: "deal_probability", label: "Probability", required: true, source: "probabilities", labelKey: "deal_probability", width: 150 },
  { name: "deal_status", label: "Status", required: true, source: "deals", labelKey: "deal_status", width: 150 },
  { name: "weighted_forecast", label: "Weighted Forecast", disabled: true, width: 150 },
  { name: "lost_reason", label: "Lost Reason", source: "reasons", labelKey: "lost_reason", width: 180 },
  { name: "status_update", label: "Status Update", width: 180 },
  { name: "project_closing_date", label: "Closing Date", type: "date", width: 140 },
  { name: "next_action", label: "Next Action", width: 180 },
  { name: "note", label: "Note", width: 220 },
];

export function SmsSalesRequestPage() {
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [masterData, setMasterData] = useState<SmsMasterData>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<SmsRow>({});
  const [deleteTarget, setDeleteTarget] = useState<SmsRow | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRows = async (clearNotice = true) => {
    if (clearNotice) setNotice(null);
    setLoading(true);
    try {
      const [list, masters] = await Promise.all([
        getSmsMaster("sales_request", { page: 1, limit: 100000 }),
        getSmsMasterData(),
      ]);
      setRows(list.tableData || []);
      setMasterData(masters);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load sales requests" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(false);
  }, []);

  const columns = useMemo<ColumnDef<SmsRow>[]>(
    () => [
      ...fields.map((field) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width,
        cell: ({ row }: { row: { original: SmsRow } }) => formatValue(row.original[field.name]),
      })),
      {
        id: "actions",
        header: "Actions",
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit">
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)} title="Delete">
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const makeEmpty = () => Object.fromEntries(fields.map((field) => [field.name, field.type === "number" ? 0 : ""]));

  const openAdd = () => {
    setEditMode(false);
    setForm(makeEmpty());
    setFormOpen(true);
    setNotice(null);
  };

  const openEdit = (row: SmsRow) => {
    setEditMode(true);
    setForm({ ...makeEmpty(), ...row });
    setFormOpen(true);
    setNotice(null);
  };

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
    const missing = fields.find((field) => field.required && !String(form[field.name] ?? "").trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    try {
      const payload = normalizePayload(form);
      await saveSmsGm("sales_request", editMode ? payload : [payload], editMode ? "patch" : "post");
      setFormOpen(false);
      setNotice({ type: "success", message: `Sales request ${editMode ? "updated" : "created"} successfully` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save sales request" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteSmsMaster("sales_request", [deleteTarget.sr_no]);
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Sales request deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete sales request" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">SMS</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Sales Request</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage sales pipeline requests, status, probability and next actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Refresh" onClick={() => void loadRows()}>
            <RefreshCw size={15} />
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable columns={columns} data={rows} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search sales requests..." loading={loading} density="grid" height="calc(100vh - 260px)" minWidth={2600} enablePagination pageSize={100} getRowId={(row, index) => `${String(row.sr_no ?? "sales_request")}_${index}`} />

      <Dialog open={formOpen} title={editMode ? "Edit Sales Request" : "Add Sales Request"} wide onClose={() => setFormOpen(false)}>
        <form id="sms-sales-request-form" className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <h2 className="m-0 text-sm font-semibold">Details</h2>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <label className="field" key={field.name}>
                  <span>
                    {field.label}
                    {field.required && <strong className="text-destructive"> *</strong>}
                  </span>
                  {field.source && field.labelKey ? (
                    <Select value={String(form[field.name] ?? "")} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}>
                      <option value="">Select {field.label}</option>
                      {getOptions(masterData, field.source, field.labelKey).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      disabled={Boolean(field.disabled)}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      value={field.type === "date" ? toDateInput(form[field.name]) : String(form[field.name] ?? "")}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: field.type === "number" ? Number(event.target.value || 0) : event.target.value }))}
                    />
                  )}
                </label>
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            <Button disabled={saving} type="submit">
              <Save size={15} /> Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} title="Delete Sales Request" onClose={() => setDeleteTarget(null)} footer={<><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={confirmDelete}>Delete</Button></>}>
        <p className="text-sm text-muted-foreground">This will delete the selected sales request.</p>
      </Dialog>
    </section>
  );
}

function getOptions(masterData: SmsMasterData, source: keyof SmsMasterData, labelKey: string) {
  const rows = (masterData[source] || []) as SmsRow[];
  return Array.from(new Set(rows.map((row) => String(row[labelKey] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizePayload(form: SmsRow) {
  const payload: SmsRow = {};
  fields.forEach((field) => {
    if (field.disabled && !form[field.name]) return;
    payload[field.name] = form[field.name];
  });
  return payload;
}

function toDateInput(value: unknown) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return String(value);
}
