import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { deleteSmsMaster, getSmsMaster, saveSmsGm, type SmsRow } from "../../api/sms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../components/ui/NoticeToast";

type SmsField = {
  name: string;
  label: string;
  type?: "text" | "number" | "email";
  required?: boolean;
  disabledOnAdd?: boolean;
  disabledOnEdit?: boolean;
  table?: boolean;
  width?: number;
};

export type SmsMasterConfig = {
  title: string;
  subtitle: string;
  listMaster: string;
  gmEndpoint: string;
  deleteMaster: string;
  keyField: string;
  routeKeys: string[];
  fields: SmsField[];
};

export const smsMasterConfigs: Record<string, SmsMasterConfig> = {
  lead: {
    title: "Lead Master",
    subtitle: "Maintain SMS lead companies and addresses.",
    listMaster: "lead",
    gmEndpoint: "company_master",
    deleteMaster: "lead",
    keyField: "id",
    routeKeys: ["lead", "company_master", "company", "sms lead"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "company_code", label: "Company Code", disabledOnAdd: true, table: true, width: 140 },
      { name: "company_name", label: "Company Name", required: true, table: true, width: 240 },
      { name: "address", label: "Address", table: true, width: 260 },
      { name: "city", label: "City", table: true, width: 140 },
      { name: "country", label: "Country", table: true, width: 140 },
    ],
  },
  services: {
    title: "Service Master",
    subtitle: "Maintain services offered by the sales team.",
    listMaster: "services",
    gmEndpoint: "service_master",
    deleteMaster: "service_master",
    keyField: "id",
    routeKeys: ["services", "service_master", "service master"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "service_code", label: "Service Code", disabledOnAdd: true, table: true, width: 150 },
      { name: "service_name", label: "Service Name", required: true, table: true, width: 260 },
    ],
  },
  segment: {
    title: "Segment Master",
    subtitle: "Maintain customer and opportunity segments.",
    listMaster: "segment_master",
    gmEndpoint: "segment_master",
    deleteMaster: "segment_master",
    keyField: "id",
    routeKeys: ["segment_master", "segment", "segment master"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "segment_code", label: "Segment Code", disabledOnAdd: true, table: true, width: 150 },
      { name: "segment_name", label: "Segment Name", required: true, table: true, width: 260 },
    ],
  },
  salesman: {
    title: "Salesman Master",
    subtitle: "Maintain SMS sales representatives.",
    listMaster: "salesman_master",
    gmEndpoint: "sales_master",
    deleteMaster: "sales_master",
    keyField: "id",
    routeKeys: ["salesman_master", "sales_master", "salesman", "sales master"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "sales_code", label: "Sales Code", disabledOnAdd: true, table: true, width: 140 },
      { name: "sales_name", label: "Sales Name", required: true, table: true, width: 220 },
      { name: "contact_no", label: "Contact No", table: true, width: 150 },
      { name: "email", label: "Email", type: "email", table: true, width: 220 },
    ],
  },
  reason: {
    title: "Reject Reason",
    subtitle: "Maintain lost/rejected deal reasons.",
    listMaster: "reject_reason",
    gmEndpoint: "reason_master",
    deleteMaster: "reason_master",
    keyField: "id",
    routeKeys: ["reject_reason", "reason_master", "lost_reason", "reason"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "reason_code", label: "Reason Code", disabledOnAdd: true, table: true, width: 150 },
      { name: "lost_reason", label: "Lost Reason", required: true, table: true, width: 300 },
    ],
  },
  dealStatus: {
    title: "Deal Status",
    subtitle: "Maintain deal pipeline statuses and percentages.",
    listMaster: "deal_status",
    gmEndpoint: "deal_master",
    deleteMaster: "deal_master",
    keyField: "id",
    routeKeys: ["deal_status", "deal_master", "deal status"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "status_code", label: "Status Code", disabledOnAdd: true, table: true, width: 150 },
      { name: "deal_status", label: "Deal Status", required: true, table: true, width: 220 },
      { name: "status_percentage", label: "Percentage", type: "number", table: true, width: 130 },
    ],
  },
  dealProbability: {
    title: "Deal Probability",
    subtitle: "Maintain probability labels used in sales requests.",
    listMaster: "deal_probability",
    gmEndpoint: "probability_master",
    deleteMaster: "probability_master",
    keyField: "id",
    routeKeys: ["deal_probability", "probability_master", "deal probability"],
    fields: [
      { name: "id", label: "ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, table: true, width: 80 },
      { name: "probability_code", label: "Probability Code", disabledOnAdd: true, table: true, width: 170 },
      { name: "deal_probability", label: "Deal Probability", required: true, table: true, width: 240 },
    ],
  },
};

export function SmsMasterPage({ config }: { config: SmsMasterConfig }) {
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<SmsRow>({});
  const [deleteTarget, setDeleteTarget] = useState<SmsRow | null>(null);
  const [saving, setSaving] = useState(false);

  const tableFields = config.fields.filter((field) => field.table);

  const loadRows = async (clearNotice = true) => {
    if (clearNotice) setNotice(null);
    setLoading(true);
    try {
      const response = await getSmsMaster(config.listMaster, { page: 1, limit: 100000 });
      setRows(response.tableData || []);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(false);
  }, [config.listMaster]);

  const columns = useMemo<ColumnDef<SmsRow>[]>(
    () => [
      ...tableFields.map((field) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width || 160,
        cell: ({ row }: { row: { original: SmsRow } }) => formatValue(row.original[field.name]),
      })),
      {
        id: "actions",
        header: "Actions",
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(row.original)}>
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [config, tableFields],
  );

  const makeEmpty = () =>
    Object.fromEntries(config.fields.map((field) => [field.name, field.disabledOnAdd ? "" : field.type === "number" ? 0 : ""]));

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
    const missing = config.fields.find((field) => field.required && !String(form[field.name] ?? "").trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await saveSmsGm(config.gmEndpoint, cleanPayload(config, form), editMode ? "put" : "post");
      setFormOpen(false);
      setNotice({ type: "success", message: `${config.title} ${editMode ? "updated" : "added"} successfully` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to save ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setNotice(null);
    try {
      await deleteSmsMaster(config.deleteMaster, [deleteTarget[config.keyField]]);
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${config.title} deleted successfully` });
      await loadRows(false);
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
          <p className="eyebrow">SMS</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.subtitle}</p>
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

      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading}
        density="grid"
        height="calc(100vh - 260px)"
        minWidth={Math.max(900, tableFields.reduce((sum, field) => sum + (field.width || 160), 120))}
        enablePagination
        pageSize={100}
        getRowId={(row, index) => `${String(row[config.keyField] ?? config.listMaster)}_${index}`}
      />

      <Dialog open={formOpen} title={editMode ? `Edit ${config.title}` : `Add ${config.title}`} onClose={() => setFormOpen(false)} wide>
        <form id="sms-master-form" className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <h2 className="m-0 text-sm font-semibold">Details</h2>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
              {config.fields.map((field) => {
                const disabled = Boolean((!editMode && field.disabledOnAdd) || (editMode && field.disabledOnEdit));
                return (
                  <label className="field" key={field.name}>
                    <span>
                      {field.label}
                      {field.required && <strong className="text-destructive"> *</strong>}
                    </span>
                    <Input
                      disabled={disabled}
                      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                      value={disabled && !form[field.name] ? "" : String(form[field.name] ?? "")}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [field.name]: field.type === "number" ? Number(event.target.value || 0) : event.target.value }))
                      }
                    />
                  </label>
                );
              })}
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

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">This will delete the selected record.</p>
      </Dialog>
    </section>
  );
}

function cleanPayload(config: SmsMasterConfig, form: SmsRow) {
  const payload: SmsRow = {};
  config.fields.forEach((field) => {
    if (!String(form[field.name] ?? "").trim() && (field.disabledOnAdd || field.disabledOnEdit)) return;
    payload[field.name] = form[field.name];
  });
  return payload;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return String(value);
}
