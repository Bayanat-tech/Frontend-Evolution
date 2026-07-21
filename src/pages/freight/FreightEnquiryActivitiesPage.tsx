import { FormEvent, useState } from "react";
import { Activity, BadgeDollarSign, CircleDollarSign, Layers3, Plus, RefreshCw, Save, Search, Trash2, TrendingUp } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

type ActivityRow = {
  srno: number;
  act_code: string;
  activity: string;
  activity_group_code: string;
  quantity: string;
  uom: string;
  bill_rate: string;
  cost_rate: string;
  bill: string;
  cost: string;
  curr_code: string;
  ex_rate: string;
  uoc: string;
  moc1: string;
  moc2: string;
  origin_port: string;
  destination_port: string;
  transport_mode: string;
  remarks: string;
};

type Notice = { type: "success" | "error"; text: string } | null;

const transportModes = [
  { value: "A", label: "Air" },
  { value: "S", label: "Sea" },
  { value: "R", label: "Road" },
];

export function FreightEnquiryActivitiesPage() {
  const { user } = useAuth();
  const userInfo = user as Record<string, unknown> | null;
  const [companyCode, setCompanyCode] = useState(String(userInfo?.company_code || userInfo?.COMPANY_CODE || ""));
  const [enquiryType, setEnquiryType] = useState("ENQ");
  const [enquiryNr, setEnquiryNr] = useState("");
  const [prinCode, setPrinCode] = useState("");
  const [rows, setRows] = useState<ActivityRow[]>([emptyRow(1)]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const totals = rows.reduce(
    (acc, row) => {
      acc.bill += numberValue(row.bill);
      acc.cost += numberValue(row.cost);
      return acc;
    },
    { bill: 0, cost: 0 },
  );
  const profit = totals.bill - totals.cost;

  const setRow = (index: number, field: keyof ActivityRow, value: string) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    setRows((current) => [...current, emptyRow(current.length + 1)]);
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, srno: rowIndex + 1 })));
  };

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: ActivityRow[]; message?: string }>("/api/freight/enquiry-activities/list", {
        company_code: companyCode,
        enquiry_type: enquiryType,
        enquiry_nr: enquiryNr,
      });
      if (response.data?.success === false) throw new Error(response.data.message || "Unable to load activities");
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setRows(data.length ? data.map(normalizeRow) : [emptyRow(1)]);
      setNotice({ type: "success", text: `${data.length} activity rows loaded` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to load activities" });
    } finally {
      setLoading(false);
    }
  };

  const saveRows = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const loginid = String(userInfo?.loginid || userInfo?.USERID || userInfo?.user_id || "");
      const response = await api.post<{ success?: boolean; message?: string }>("/api/freight/enquiry-activities/save", {
        company_code: companyCode,
        enquiry_type: enquiryType,
        enquiry_nr: enquiryNr,
        prin_code: prinCode,
        userid: loginid,
        details: rows.map((row, index) => ({
          ...row,
          srno: index + 1,
          company_code: companyCode,
          enquiry_type: enquiryType,
          enquiry_nr: enquiryNr,
          prin_code: prinCode,
          userid: loginid,
          curr_code: row.curr_code || "OMR",
          ex_rate: row.ex_rate || "1",
        })),
      });
      if (response.data?.success === false) throw new Error(response.data.message || "Unable to save activities");
      setNotice({ type: "success", text: response.data?.message || "Activities saved" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save activities" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={saveRows}>
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 p-4 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/15 bg-white/10 text-cyan-100">
              <Activity size={22} />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className="rounded-full bg-white/12 px-3 py-1 text-cyan-100">{enquiryType}</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-emerald-100">{companyCode || "Company"}</span>
              </div>
              <h1 className="m-0 text-2xl font-semibold tracking-tight">Enquiry Activities</h1>
              <p className="m-0 text-sm text-slate-300">{enquiryNr || "Select enquiry"} / {prinCode || "Principal pending"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice && (
              <span className={`rounded-md px-3 py-2 text-sm font-medium ${notice.type === "success" ? "bg-emerald-400/15 text-emerald-100" : "bg-red-400/15 text-red-100"}`}>
                {notice.text}
              </span>
            )}
            <Button type="button" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={loadRows} disabled={loading || !companyCode || !enquiryNr}>
              <RefreshCw size={15} />
              {loading ? "Loading" : "Load"}
            </Button>
            <Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={saving || !companyCode || !enquiryNr}>
              <Save size={15} />
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile icon={Layers3} label="Lines" value={String(rows.length)} tone="cyan" />
          <MetricTile icon={CircleDollarSign} label="Bill" value={formatAmount(totals.bill)} tone="emerald" />
          <MetricTile icon={BadgeDollarSign} label="Cost" value={formatAmount(totals.cost)} tone="amber" />
          <MetricTile icon={TrendingUp} label="Profit" value={formatAmount(profit)} tone={profit >= 0 ? "emerald" : "rose"} />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-card p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="m-0 text-sm font-semibold uppercase text-slate-700">Selection</h2>
          <p className="m-0 text-xs text-muted-foreground">Company, enquiry and principal reference</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FormInput label="Company" value={companyCode} onChange={setCompanyCode} required />
          <FormInput label="Enquiry No" value={enquiryNr} onChange={setEnquiryNr} required actionTitle="Search enquiry" />
          <FormInput label="Enquiry Type" value={enquiryType} onChange={setEnquiryType} />
          <FormInput label="Principal" value={prinCode} onChange={setPrinCode} />
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" onClick={addRow}>
              <Plus size={15} />
              Add Line
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
          <div>
            <h2 className="m-0 text-sm font-semibold uppercase text-slate-700">Activity Lines</h2>
            <p className="m-0 text-xs text-muted-foreground">Billable and cost activities for the selected enquiry</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus size={14} />
            Add Line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-white text-left text-xs uppercase text-slate-600">
                {["Act Code", "Activity", "Group", "Mode", "Origin", "Destination", "Qty", "UOM", "Bill Rate", "Cost Rate", "Bill", "Cost", "Currency", "Remarks", ""].map((label) => (
                  <th key={label} className="px-2 py-2 font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.srno} className="border-b transition hover:bg-cyan-50/40 last:border-0">
                  <CellInput value={row.act_code} onChange={(value) => setRow(index, "act_code", value)} />
                  <CellInput value={row.activity} onChange={(value) => setRow(index, "activity", value)} className="min-w-52" />
                  <CellInput value={row.activity_group_code} onChange={(value) => setRow(index, "activity_group_code", value)} className="w-28" />
                  <td className="px-2 py-2">
                    <select className={fieldClassName} value={row.transport_mode} onChange={(event) => setRow(index, "transport_mode", event.target.value)}>
                      {transportModes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <CellInput value={row.origin_port} onChange={(value) => setRow(index, "origin_port", value)} />
                  <CellInput value={row.destination_port} onChange={(value) => setRow(index, "destination_port", value)} />
                  <CellInput type="number" value={row.quantity} onChange={(value) => setRow(index, "quantity", value)} className="w-24 text-right" />
                  <CellInput value={row.uom} onChange={(value) => setRow(index, "uom", value)} className="w-24" />
                  <CellInput type="number" value={row.bill_rate} onChange={(value) => setRow(index, "bill_rate", value)} className="w-28 text-right" />
                  <CellInput type="number" value={row.cost_rate} onChange={(value) => setRow(index, "cost_rate", value)} className="w-28 text-right" />
                  <CellInput type="number" value={row.bill} onChange={(value) => setRow(index, "bill", value)} className="w-28 text-right" />
                  <CellInput type="number" value={row.cost} onChange={(value) => setRow(index, "cost", value)} className="w-28 text-right" />
                  <CellInput value={row.curr_code} onChange={(value) => setRow(index, "curr_code", value)} className="w-24" />
                  <CellInput value={row.remarks} onChange={(value) => setRow(index, "remarks", value)} className="min-w-64" />
                  <td className="px-2 py-2 text-right">
                    <Button type="button" size="icon" variant="ghost" title="Remove line" disabled={rows.length === 1} onClick={() => removeRow(index)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    cyan: "bg-cyan-400/15 text-cyan-100",
    emerald: "bg-emerald-400/15 text-emerald-100",
    amber: "bg-amber-400/15 text-amber-100",
    rose: "bg-rose-400/15 text-rose-100",
  }[tone];

  return (
    <div className="rounded-md border border-white/15 bg-white/10 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-slate-300">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 truncate text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function numberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyRow(srno: number): ActivityRow {
  return {
    srno,
    act_code: "",
    activity: "",
    activity_group_code: "",
    quantity: "1",
    uom: "",
    bill_rate: "0",
    cost_rate: "0",
    bill: "0",
    cost: "0",
    curr_code: "OMR",
    ex_rate: "1",
    uoc: "",
    moc1: "",
    moc2: "",
    origin_port: "",
    destination_port: "",
    transport_mode: "A",
    remarks: "",
  };
}

function normalizeRow(row: Record<string, unknown>, index: number): ActivityRow {
  return {
    ...emptyRow(index + 1),
    srno: Number(row.SRNO ?? row.srno ?? index + 1),
    act_code: String(row.ACT_CODE ?? row.act_code ?? ""),
    activity: String(row.ACTIVITY ?? row.activity ?? ""),
    activity_group_code: String(row.ACTIVITY_GROUP_CODE ?? row.activity_group_code ?? ""),
    quantity: String(row.QUANTITY ?? row.quantity ?? "0"),
    uom: String(row.UOM ?? row.uom ?? ""),
    bill_rate: String(row.BILL_RATE ?? row.bill_rate ?? "0"),
    cost_rate: String(row.COST_RATE ?? row.cost_rate ?? "0"),
    bill: String(row.BILL ?? row.bill ?? "0"),
    cost: String(row.COST ?? row.cost ?? "0"),
    curr_code: String(row.CURR_CODE ?? row.curr_code ?? "OMR"),
    ex_rate: String(row.EX_RATE ?? row.ex_rate ?? "1"),
    uoc: String(row.UOC ?? row.uoc ?? ""),
    moc1: String(row.MOC1 ?? row.moc1 ?? ""),
    moc2: String(row.MOC2 ?? row.moc2 ?? ""),
    origin_port: String(row.ORIGIN_PORT ?? row.origin_port ?? ""),
    destination_port: String(row.DESTINATION_PORT ?? row.destination_port ?? ""),
    transport_mode: String(row.TRANSPORT_MODE ?? row.transport_mode ?? "A"),
    remarks: String(row.REMARKS ?? row.remarks ?? ""),
  };
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  actionTitle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  actionTitle?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      <div className="flex gap-2">
        <Input value={value} type={type} required={required} onChange={(event) => onChange(event.target.value)} />
        {actionTitle && (
          <Button type="button" variant="outline" size="icon" title={actionTitle}>
            <Search size={14} />
          </Button>
        )}
      </div>
    </label>
  );
}

function CellInput({
  value,
  onChange,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <td className="px-2 py-2">
      <Input className={`h-8 ${className}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </td>
  );
}

const fieldClassName =
  "flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
