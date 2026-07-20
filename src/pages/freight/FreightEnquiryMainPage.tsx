import { FormEvent, useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type EnquiryHeader = {
  company_code: string;
  prin_code: string;
  enquiry_nr: string;
  enquiry_date: string;
  dept_code: string;
  origin_port: string;
  destination_port: string;
  transit_time: string;
  cargo_detail: string;
  frequency: string;
  tos: string;
  commodity: string;
  dimension: string;
  carrier: string;
  weight: string;
  volume: string;
  remarks: string;
  payment_terms: string;
  curr_code: string;
  ex_rate: string;
  job_type: string;
  transport_mode: string;
  via: string;
  job_number: string;
  schedule_date: string;
  country_origin: string;
  country_destination: string;
  indstatus: string;
  enquiry_type: string;
  offer_validity: string;
  spl_instructions: string;
  walkin_prin_code: string;
  salesman_code: string;
  member_type: string;
  sale_type: string;
  shipper_name: string;
  shipper_address: string;
  consignee_name: string;
  consignee_address: string;
  job_category: string;
  ref_enquiry_type: string;
  ref_enquiry_nr: string;
  b: string;
  h: string;
  l: string;
  forwarder_code: string;
  gross_wt: string;
  shipment_status: string;
  container_type: string;
  no_of_contaners: string;
  vehicle_type: string;
  t_f: string;
};

type EnquiryDetail = {
  srno: number;
  act_code: string;
  activity: string;
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
  partners_price: string;
  fc_cost: string;
  fc_bill: string;
  fc_partners: string;
  fc_costrate: string;
  fc_billrate: string;
  origin_port: string;
  destination_port: string;
  transport_mode: string;
  cost_curr_code: string;
  cost_ex_rate: string;
  partners_curr_code: string;
  partners_ex_rate: string;
  enquiry_type: string;
  remarks: string;
};

type Notice = { type: "success" | "error"; text: string } | null;
type EnquiryTab = "cargo" | "journey" | "carrier" | "payment" | "activities";

const paymentTerms = ["CIF", "CFR", "FOB", "EXW", "FCA", "FAS", "CPT", "CIP", "DAF", "DES", "DEQ", "DDU", "DDP"];
const jobTypes = [
  { value: "IMP", label: "Import" },
  { value: "EXP", label: "Export" },
];
const transportModes = [
  { value: "A", label: "Air" },
  { value: "S", label: "Sea" },
  { value: "R", label: "Road" },
];
const approvalStatuses = [
  { value: "N", label: "Not Approved" },
  { value: "A", label: "Approved" },
];
const tosOptions = ["ORIGIN", "DESTINATION"];
const memberTypes = ["", "IFLN", "AFFAL", "None"];
const saleTypes = ["Normal", "FreeIn"];
const jobCategories = ["International", "Combined services", "Clearance", "Others"];
const enquiryTabs: { key: EnquiryTab; label: string }[] = [
  { key: "cargo", label: "Cargo" },
  { key: "journey", label: "Journey" },
  { key: "carrier", label: "Carrier" },
  { key: "payment", label: "Payment" },
  { key: "activities", label: "Activities" },
];

export function FreightEnquiryMainPage({ target }: { target?: FreightWorkspaceTarget }) {
  const { user } = useAuth();
  const userInfo = user as Record<string, unknown> | null;
  const initialHeader = useMemo(() => buildInitialHeader(userInfo, target), [target, userInfo]);
  const [header, setHeader] = useState<EnquiryHeader>(initialHeader);
  const [details, setDetails] = useState<EnquiryDetail[]>([buildInitialDetail(initialHeader, 1)]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTab, setActiveTab] = useState<EnquiryTab>("cargo");

  const setHeaderField = (field: keyof EnquiryHeader, value: string) => {
    setHeader((current) => ({ ...current, [field]: value }));
  };

  const setDetailField = (index: number, field: keyof EnquiryDetail, value: string) => {
    setDetails((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  };

  const resetForm = () => {
    const freshHeader = buildInitialHeader(userInfo, target);
    setHeader(freshHeader);
    setDetails([buildInitialDetail(freshHeader, 1)]);
    setNotice(null);
  };

  const addDetail = () => {
    setDetails((current) => [...current, buildInitialDetail(header, current.length + 1)]);
  };

  const removeDetail = (index: number) => {
    setDetails((current) =>
      current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, srno: rowIndex + 1 })),
    );
  };

  const saveEnquiry = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const loginid = String(userInfo?.loginid || userInfo?.USERID || userInfo?.user_id || "");
      const payload = {
        header: {
          ...header,
          userid: loginid,
          user_date: new Date().toISOString(),
        },
        details: details.map((row, index) => ({
          ...row,
          srno: index + 1,
          sr_no: index + 1,
          company_code: header.company_code,
          prin_code: header.prin_code,
          enquiry_nr: header.enquiry_nr || "0",
          enquiry_type: header.enquiry_type,
          curr_code: row.curr_code || header.curr_code,
          ex_rate: row.ex_rate || header.ex_rate,
          origin_port: row.origin_port || header.origin_port,
          destination_port: row.destination_port || header.destination_port,
          transport_mode: row.transport_mode || header.transport_mode,
          userid: loginid,
          user_dt: new Date().toISOString(),
        })),
      };

      const response = await api.post<{ success?: boolean; message?: string }>("/api/freight/insUpdTfEnquiryBulk", payload);
      if (response.data?.success === false) {
        throw new Error(response.data.message || "Unable to save enquiry");
      }
      setNotice({ type: "success", text: response.data?.message || "Enquiry saved" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save enquiry" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={saveEnquiry}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Freight Enquiry</h1>
          <p className="m-0 text-sm text-muted-foreground">
            {header.job_type === "IMP" ? "Import" : "Export"} / {modeLabel(header.transport_mode)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && (
            <span
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                notice.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-destructive/10 text-destructive"
              }`}
            >
              {notice.text}
            </span>
          )}
          <Button type="button" variant="outline" onClick={resetForm}>
            <RotateCcw size={15} />
            Reset
          </Button>
          <Button type="submit" disabled={saving}>
            <Save size={15} />
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <FormInput label="Company" value={header.company_code} onChange={(value) => setHeaderField("company_code", value)} required />
          <FormInput label="Enquiry No" value={header.enquiry_nr} onChange={(value) => setHeaderField("enquiry_nr", value)} placeholder="Auto" />
          <FormInput label="Date" type="date" value={header.enquiry_date} onChange={(value) => setHeaderField("enquiry_date", value)} required />
          <FormInput label="Department" value={header.dept_code} onChange={(value) => setHeaderField("dept_code", value)} />
          <FormSelect label="Job Type" value={header.job_type} onChange={(value) => setHeaderField("job_type", value)} options={jobTypes} />
          <FormSelect label="Mode" value={header.transport_mode} onChange={(value) => setHeaderField("transport_mode", value)} options={transportModes} />
          <FormInput label="Principal" value={header.prin_code} onChange={(value) => setHeaderField("prin_code", value)} required actionTitle="Search principal" />
          <FormInput label="Walk-in Principal" value={header.walkin_prin_code} onChange={(value) => setHeaderField("walkin_prin_code", value)} />
          <FormInput label="Salesman" value={header.salesman_code} onChange={(value) => setHeaderField("salesman_code", value)} />
          <FormSelect label="Status" value={header.indstatus} onChange={(value) => setHeaderField("indstatus", value)} options={approvalStatuses} />
          <FormInput label="Offer Validity" type="date" value={header.offer_validity} onChange={(value) => setHeaderField("offer_validity", value)} />
          <FormInput label="Enquiry Type" value={header.enquiry_type} onChange={(value) => setHeaderField("enquiry_type", value)} />
        </div>
      </section>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 pt-3">
          {enquiryTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 rounded-t-md px-4 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border border-b-transparent bg-card text-foreground"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "cargo" && (
            <section>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase text-muted-foreground">Cargo And Parties</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormInput label="Commodity" value={header.commodity} onChange={(value) => setHeaderField("commodity", value)} />
                <FormInput label="Weight" type="number" value={header.weight} onChange={(value) => setHeaderField("weight", value)} />
                <FormInput label="Volume" type="number" value={header.volume} onChange={(value) => setHeaderField("volume", value)} />
                <FormInput label="Gross Weight" type="number" value={header.gross_wt} onChange={(value) => setHeaderField("gross_wt", value)} />
                <FormInput label="Length" type="number" value={header.l} onChange={(value) => setHeaderField("l", value)} />
                <FormInput label="Breadth" type="number" value={header.b} onChange={(value) => setHeaderField("b", value)} />
                <FormInput label="Height" type="number" value={header.h} onChange={(value) => setHeaderField("h", value)} />
                <FormInput label="Dimension" value={header.dimension} onChange={(value) => setHeaderField("dimension", value)} />
                <FormInput label="Container Type" value={header.container_type} onChange={(value) => setHeaderField("container_type", value)} />
                <FormInput label="Containers" type="number" value={header.no_of_contaners} onChange={(value) => setHeaderField("no_of_contaners", value)} />
                <FormInput label="Vehicle Type" value={header.vehicle_type} onChange={(value) => setHeaderField("vehicle_type", value)} />
                <FormInput label="T/F" value={header.t_f} onChange={(value) => setHeaderField("t_f", value)} />
                <FormTextarea label="Cargo Detail" value={header.cargo_detail} onChange={(value) => setHeaderField("cargo_detail", value)} className="sm:col-span-2" />
                <FormTextarea label="Remarks" value={header.remarks} onChange={(value) => setHeaderField("remarks", value)} className="sm:col-span-2" />
                <FormTextarea label="Shipper" value={header.shipper_name} onChange={(value) => setHeaderField("shipper_name", value)} />
                <FormTextarea label="Shipper Address" value={header.shipper_address} onChange={(value) => setHeaderField("shipper_address", value)} />
                <FormTextarea label="Consignee" value={header.consignee_name} onChange={(value) => setHeaderField("consignee_name", value)} />
                <FormTextarea label="Consignee Address" value={header.consignee_address} onChange={(value) => setHeaderField("consignee_address", value)} />
              </div>
            </section>
          )}

          {activeTab === "journey" && (
            <section>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase text-muted-foreground">Journey</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormInput label="Port of Loading" value={header.origin_port} onChange={(value) => setHeaderField("origin_port", value)} actionTitle="Search loading port" />
                <FormInput label="Port of Destination" value={header.destination_port} onChange={(value) => setHeaderField("destination_port", value)} actionTitle="Search destination port" />
                <FormInput label="Via" value={header.via} onChange={(value) => setHeaderField("via", value)} className="lg:col-span-2" />
                <FormInput label="Country Origin" value={header.country_origin} onChange={(value) => setHeaderField("country_origin", value)} />
                <FormInput label="Country Destination" value={header.country_destination} onChange={(value) => setHeaderField("country_destination", value)} />
                <FormInput label="Shipment Status" value={header.shipment_status} onChange={(value) => setHeaderField("shipment_status", value)} />
                <FormInput label="Job No" value={header.job_number} onChange={(value) => setHeaderField("job_number", value)} />
              </div>
            </section>
          )}

          {activeTab === "carrier" && (
            <section>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase text-muted-foreground">Carrier Details</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormInput label="Carrier" value={header.carrier} onChange={(value) => setHeaderField("carrier", value)} actionTitle="Search carrier" />
                <FormInput label="Forwarder" value={header.forwarder_code} onChange={(value) => setHeaderField("forwarder_code", value)} actionTitle="Search forwarder" />
                <FormInput label="Transit Time" value={header.transit_time} onChange={(value) => setHeaderField("transit_time", value)} />
                <FormInput label="Frequency" value={header.frequency} onChange={(value) => setHeaderField("frequency", value)} />
                <FormInput label="Sales Executive" value={header.salesman_code} onChange={(value) => setHeaderField("salesman_code", value)} actionTitle="Search sales executive" />
                <FormInput label="Ready Date" type="date" value={header.schedule_date} onChange={(value) => setHeaderField("schedule_date", value)} />
              </div>
            </section>
          )}

          {activeTab === "payment" && (
            <section>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase text-muted-foreground">Payment Terms</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormSelect label="INCO Terms" value={header.payment_terms} onChange={(value) => setHeaderField("payment_terms", value)} options={paymentTerms.map((value) => ({ value, label: value }))} />
                <FormSelect label="Freight Payable At" value={header.tos} onChange={(value) => setHeaderField("tos", value)} options={tosOptions.map((value) => ({ value, label: value }))} />
                <FormInput label="Currency" value={header.curr_code} onChange={(value) => setHeaderField("curr_code", value)} />
                <FormInput label="Exchange Rate" type="number" value={header.ex_rate} onChange={(value) => setHeaderField("ex_rate", value)} />
                <FormSelect label="Member Type" value={header.member_type} onChange={(value) => setHeaderField("member_type", value)} options={memberTypes.map((value) => ({ value, label: value || "Blank" }))} />
                <FormSelect label="Sale Type" value={header.sale_type} onChange={(value) => setHeaderField("sale_type", value)} options={saleTypes.map((value) => ({ value, label: value }))} />
                <FormSelect label="Job Category" value={header.job_category} onChange={(value) => setHeaderField("job_category", value)} options={jobCategories.map((value) => ({ value, label: value }))} />
                <FormInput label="Ref Enquiry No" value={header.ref_enquiry_nr} onChange={(value) => setHeaderField("ref_enquiry_nr", value)} />
                <FormTextarea label="Special Instructions" value={header.spl_instructions} onChange={(value) => setHeaderField("spl_instructions", value)} className="sm:col-span-2 lg:col-span-4" />
              </div>
            </section>
          )}

          {activeTab === "activities" && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-sm font-semibold uppercase text-muted-foreground">Activities</h2>
                <Button type="button" size="sm" variant="outline" onClick={addDetail}>
                  <Plus size={14} />
                  Add Line
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      {["Act Code", "Activity", "Mode", "Origin", "Destination", "Qty", "UOM", "Bill Rate", "Cost Rate", "Bill", "Cost", "Currency", "Remarks", ""].map((label) => (
                        <th key={label} className="px-2 py-2 font-semibold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((row, index) => (
                      <tr key={row.srno} className="border-b last:border-0">
                        <CellInput value={row.act_code} onChange={(value) => setDetailField(index, "act_code", value)} />
                        <CellInput value={row.activity} onChange={(value) => setDetailField(index, "activity", value)} className="min-w-52" />
                        <td className="px-2 py-2">
                          <select
                            className={fieldClassName}
                            value={row.transport_mode}
                            onChange={(event) => setDetailField(index, "transport_mode", event.target.value)}
                          >
                            {transportModes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <CellInput value={row.origin_port} onChange={(value) => setDetailField(index, "origin_port", value)} />
                        <CellInput value={row.destination_port} onChange={(value) => setDetailField(index, "destination_port", value)} />
                        <CellInput type="number" value={row.quantity} onChange={(value) => setDetailField(index, "quantity", value)} className="w-24 text-right" />
                        <CellInput value={row.uom} onChange={(value) => setDetailField(index, "uom", value)} className="w-24" />
                        <CellInput type="number" value={row.bill_rate} onChange={(value) => setDetailField(index, "bill_rate", value)} className="w-28 text-right" />
                        <CellInput type="number" value={row.cost_rate} onChange={(value) => setDetailField(index, "cost_rate", value)} className="w-28 text-right" />
                        <CellInput type="number" value={row.bill} onChange={(value) => setDetailField(index, "bill", value)} className="w-28 text-right" />
                        <CellInput type="number" value={row.cost} onChange={(value) => setDetailField(index, "cost", value)} className="w-28 text-right" />
                        <CellInput value={row.curr_code} onChange={(value) => setDetailField(index, "curr_code", value)} className="w-24" />
                        <CellInput value={row.remarks} onChange={(value) => setDetailField(index, "remarks", value)} className="min-w-56" />
                        <td className="px-2 py-2 text-right">
                          <Button type="button" size="icon" variant="ghost" title="Remove line" disabled={details.length === 1} onClick={() => removeDetail(index)}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </form>
  );
}

function buildInitialHeader(user: Record<string, unknown> | null, target?: FreightWorkspaceTarget): EnquiryHeader {
  const company = String(user?.company_code || user?.COMPANY_CODE || "");
  const mode = target?.mode === "sea" ? "S" : target?.mode === "land" ? "R" : "A";
  const jobType = target?.direction === "import" ? "IMP" : "EXP";
  return {
    company_code: company,
    prin_code: "",
    enquiry_nr: "",
    enquiry_date: toInputDate(new Date()),
    dept_code: "22",
    origin_port: "",
    destination_port: "",
    transit_time: "",
    cargo_detail: "",
    frequency: "",
    tos: "ORIGIN",
    commodity: "",
    dimension: "",
    carrier: "",
    weight: "",
    volume: "0",
    remarks: "",
    payment_terms: "CIF",
    curr_code: "OMR",
    ex_rate: "1",
    job_type: jobType,
    transport_mode: mode,
    via: "",
    job_number: "",
    schedule_date: "",
    country_origin: "",
    country_destination: "",
    indstatus: "N",
    enquiry_type: "ENQ",
    offer_validity: "",
    spl_instructions: "",
    walkin_prin_code: "",
    salesman_code: "",
    member_type: "",
    sale_type: "Normal",
    shipper_name: "",
    shipper_address: "",
    consignee_name: "",
    consignee_address: "",
    job_category: "Others",
    ref_enquiry_type: "",
    ref_enquiry_nr: "",
    b: "",
    h: "",
    l: "",
    forwarder_code: "",
    gross_wt: "",
    shipment_status: "",
    container_type: "",
    no_of_contaners: "",
    vehicle_type: "",
    t_f: "T",
  };
}

function buildInitialDetail(header: EnquiryHeader, srno: number): EnquiryDetail {
  return {
    srno,
    act_code: "",
    activity: "",
    quantity: "1",
    uom: "",
    bill_rate: "0",
    cost_rate: "0",
    bill: "0",
    cost: "0",
    curr_code: header.curr_code,
    ex_rate: header.ex_rate,
    uoc: "",
    moc1: "",
    moc2: "",
    partners_price: "0",
    fc_cost: "0",
    fc_bill: "0",
    fc_partners: "0",
    fc_costrate: "0",
    fc_billrate: "0",
    origin_port: header.origin_port,
    destination_port: header.destination_port,
    transport_mode: header.transport_mode,
    cost_curr_code: header.curr_code,
    cost_ex_rate: header.ex_rate,
    partners_curr_code: header.curr_code,
    partners_ex_rate: header.ex_rate,
    enquiry_type: header.enquiry_type,
    remarks: "",
  };
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  actionTitle,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  actionTitle?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-semibold uppercase text-muted-foreground ${className}`}>
      {label}
      <div className="flex gap-2">
        <Input value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        {actionTitle && (
          <Button type="button" variant="outline" size="icon" title={actionTitle}>
            <Search size={14} />
          </Button>
        )}
      </div>
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      <select className={fieldClassName} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-semibold uppercase text-muted-foreground ${className}`}>
      {label}
      <textarea className={`${fieldClassName} min-h-20 resize-y py-2`} value={value} onChange={(event) => onChange(event.target.value)} />
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

function modeLabel(mode: string) {
  if (mode === "S") return "Sea";
  if (mode === "R") return "Road";
  return "Air";
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

const fieldClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
