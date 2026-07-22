import { FormEvent, useMemo, useState } from "react";
import { Activity, CreditCard, MapPinned, PackageCheck, Plus, RotateCcw, Save, ShipWheel, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { executeWmsInboundSql } from "../../api/wms";
import { getLookupValue, type LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
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
const enquiryTabs: { key: EnquiryTab; label: string; icon: typeof PackageCheck }[] = [
  { key: "cargo", label: "Cargo", icon: PackageCheck },
  { key: "journey", label: "Journey", icon: MapPinned },
  { key: "carrier", label: "Carrier", icon: ShipWheel },
  { key: "payment", label: "Payment", icon: CreditCard },
  { key: "activities", label: "Activities", icon: Activity },
];

type FreightEnquiryMainPageProps = {
  target?: FreightWorkspaceTarget;
  screenType?: "enquiry" | "rfq";
};

export function FreightEnquiryMainPage({ target, screenType = "enquiry" }: FreightEnquiryMainPageProps) {
  const { user } = useAuth();
  const userInfo = user as Record<string, unknown> | null;
  const isRfq = screenType === "rfq";
  const initialHeader = useMemo(() => buildInitialHeader(userInfo, target, screenType), [screenType, target, userInfo]);
  const [header, setHeader] = useState<EnquiryHeader>(initialHeader);
  const [details, setDetails] = useState<EnquiryDetail[]>([buildInitialDetail(initialHeader, 1)]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTab, setActiveTab] = useState<EnquiryTab>("cargo");

  const setHeaderField = (field: keyof EnquiryHeader, value: string) => {
    setHeader((current) => ({ ...current, [field]: value }));
  };

  const applyHeaderLookup = (field: keyof EnquiryHeader, value: string, row: LookupRow | null) => {
    setHeader((current) => {
      const next = { ...current, [field]: value };
      if (field === "prin_code" && row) {
        next.dept_code = lookupText(row, "prin_dept_code") || next.dept_code;
        next.curr_code = lookupText(row, "curr_code") || next.curr_code;
        next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
      }
      if (field === "origin_port" && row) {
        next.country_origin = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_origin;
      }
      if (field === "destination_port" && row) {
        next.country_destination = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_destination;
      }
      if (field === "curr_code" && row) {
        next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
      }
      return next;
    });
  };

  const setDetailField = (index: number, field: keyof EnquiryDetail, value: string) => {
    setDetails((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  };

  const resetForm = () => {
    const freshHeader = buildInitialHeader(userInfo, target, screenType);
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
        details: details.filter((row) => row.act_code.trim()).map((row, index) => ({
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

      const response = await api.post<{ success?: boolean; message?: string; data?: { enquiry_nr?: string } }>(
        isRfq ? "/api/freight/rfq/save" : "/api/freight/enquiry/save",
        payload
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || "Unable to save enquiry");
      }
      if (response.data?.data?.enquiry_nr) {
        setHeaderField("enquiry_nr", response.data.data.enquiry_nr);
      }
      setNotice({ type: "success", text: response.data?.message || "Enquiry saved" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save enquiry" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-2" onSubmit={saveEnquiry}>
      <div className="rounded-md border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-3 py-2.5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="mb-1 flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
              <span className="rounded bg-white/12 px-2 py-0.5 text-cyan-100">{modeLabel(header.transport_mode)}</span>
              <span className="rounded bg-white/12 px-2 py-0.5 text-emerald-100">{header.job_type === "IMP" ? "Import" : "Export"}</span>
              <span className="rounded bg-white/12 px-2 py-0.5 text-amber-100">{header.indstatus === "A" ? "Approved" : "Not Approved"}</span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <h1 className="m-0 text-xl font-semibold tracking-tight">{isRfq ? "Request For Quote" : "Freight Enquiry"}</h1>
              <p className="m-0 text-xs text-slate-300">{header.enquiry_nr || (isRfq ? "New RFQ" : "New enquiry")} / {header.prin_code || "Principal pending"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice && (
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  notice.type === "success" ? "bg-emerald-400/15 text-emerald-100" : "bg-red-400/15 text-red-100"
                }`}
              >
                {notice.text}
              </span>
            )}
            <Button type="button" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={resetForm}>
              <RotateCcw size={15} />
              Reset
            </Button>
            <Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={saving}>
              <Save size={15} />
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <SummaryTile label="Route" value={`${header.origin_port || "-"} -> ${header.destination_port || "-"}`} />
          <SummaryTile label="Currency" value={`${header.curr_code || "-"} / ${header.ex_rate || "1"}`} />
          <SummaryTile label="Cargo" value={header.commodity || "-"} />
          <SummaryTile label="Activity Lines" value={String(details.length)} />
        </div>
      </div>

      <section className="rounded-md border border-slate-200 bg-card p-2.5 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <FormInput label="Company" value={header.company_code} onChange={(value) => setHeaderField("company_code", value)} required />
          <FormInput label="Enquiry No" value={header.enquiry_nr} onChange={(value) => setHeaderField("enquiry_nr", value)} placeholder="Auto" />
          <FormInput label="Date" type="date" value={header.enquiry_date} onChange={(value) => setHeaderField("enquiry_date", value)} required />
          <FormLookup label="Department" value={header.dept_code} valueField="dept_code" displayFields={["dept_code", "dept_name"]} columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Department" }]} loadOptions={() => loadDepartmentLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("dept_code", value, row)} />
          <FormSelect label="Job Type" value={header.job_type} onChange={(value) => setHeaderField("job_type", value)} options={jobTypes} />
          <FormSelect label="Mode" value={header.transport_mode} onChange={(value) => setHeaderField("transport_mode", value)} options={transportModes} />
          <FormLookup label="Principal" value={header.prin_code} valueField="prin_code" displayFields={["prin_code", "prin_name"]} columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Principal" }, { field: "curr_code", header: "Currency" }]} loadOptions={() => loadPrincipalLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("prin_code", value, row)} required />
          <FormLookup label="Walk-in Principal" value={header.walkin_prin_code} valueField="prin_code" displayFields={["prin_code", "prin_name"]} columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }, { field: "prin_telno1", header: "Phone" }]} loadOptions={() => loadWalkinPrincipalLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("walkin_prin_code", value, row)} />
          <FormLookup label="Salesman" value={header.salesman_code} valueField="salesman_code" displayFields={["salesman_code", "salesman_name"]} columns={[{ field: "salesman_code", header: "Code" }, { field: "salesman_name", header: "Salesman" }]} loadOptions={() => loadSalesmanLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("salesman_code", value, row)} />
          <FormSelect label="Status" value={header.indstatus} onChange={(value) => setHeaderField("indstatus", value)} options={approvalStatuses} />
          <FormInput label="Offer Validity" type="date" value={header.offer_validity} onChange={(value) => setHeaderField("offer_validity", value)} />
          <FormInput label="Enquiry Type" value={header.enquiry_type} onChange={(value) => setHeaderField("enquiry_type", value)} />
        </div>
      </section>

      <div className="rounded-md border border-slate-200 bg-card shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b bg-slate-50 px-2 pt-2">
          {enquiryTabs.map((tab) => (
            <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />
          ))}
        </div>

        <div className="p-2.5">
          {activeTab === "cargo" && (
            <section>
              <SectionHeading title="Cargo And Parties" description="Commodity, measurement, shipper and consignee details" />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FormLookup label="Commodity" value={header.commodity} valueField="prodtype_desc" displayFields={["prodtype_desc", "prodtype_code"]} columns={[{ field: "prodtype_desc", header: "Commodity" }, { field: "prodtype_code", header: "Code" }]} loadOptions={() => loadCommodityLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("commodity", value, row)} />
                <FormInput label="Weight" type="number" value={header.weight} onChange={(value) => setHeaderField("weight", value)} />
                <FormInput label="Volume" type="number" value={header.volume} onChange={(value) => setHeaderField("volume", value)} />
                <FormInput label="Gross Weight" type="number" value={header.gross_wt} onChange={(value) => setHeaderField("gross_wt", value)} />
                <FormInput label="Length" type="number" value={header.l} onChange={(value) => setHeaderField("l", value)} />
                <FormInput label="Breadth" type="number" value={header.b} onChange={(value) => setHeaderField("b", value)} />
                <FormInput label="Height" type="number" value={header.h} onChange={(value) => setHeaderField("h", value)} />
                <FormInput label="Dimension" value={header.dimension} onChange={(value) => setHeaderField("dimension", value)} />
                <FormInput label="Container Type" value={header.container_type} onChange={(value) => setHeaderField("container_type", value)} />
                <FormInput label="Containers" type="number" value={header.no_of_contaners} onChange={(value) => setHeaderField("no_of_contaners", value)} />
                <FormLookup label="Vehicle Type" value={header.vehicle_type} valueField="vtype_code" displayFields={["vtype_code", "vtype_name"]} columns={[{ field: "vtype_code", header: "Code" }, { field: "vtype_name", header: "Vehicle Type" }]} loadOptions={() => loadVehicleTypeLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("vehicle_type", value, row)} />
                <FormInput label="T/F" value={header.t_f} onChange={(value) => setHeaderField("t_f", value)} />
                <FormTextarea label="Cargo Detail" value={header.cargo_detail} onChange={(value) => setHeaderField("cargo_detail", value)} className="sm:col-span-2 xl:col-span-3" />
                <FormTextarea label="Remarks" value={header.remarks} onChange={(value) => setHeaderField("remarks", value)} className="sm:col-span-2 xl:col-span-3" />
                <FormTextarea label="Shipper" value={header.shipper_name} onChange={(value) => setHeaderField("shipper_name", value)} className="xl:col-span-2" />
                <FormTextarea label="Shipper Address" value={header.shipper_address} onChange={(value) => setHeaderField("shipper_address", value)} className="xl:col-span-2" />
                <FormTextarea label="Consignee" value={header.consignee_name} onChange={(value) => setHeaderField("consignee_name", value)} className="xl:col-span-2" />
                <FormTextarea label="Consignee Address" value={header.consignee_address} onChange={(value) => setHeaderField("consignee_address", value)} className="xl:col-span-2" />
              </div>
            </section>
          )}
          {activeTab === "journey" && (
            <section>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase text-muted-foreground">Journey</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FormLookup label="Port of Loading" value={header.origin_port} valueField="port_code" displayFields={["port_code", "port_name"]} columns={portColumns} loadOptions={() => loadPortLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("origin_port", value, row)} />
                <FormLookup label="Port of Destination" value={header.destination_port} valueField="port_code" displayFields={["port_code", "port_name"]} columns={portColumns} loadOptions={() => loadPortLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("destination_port", value, row)} />
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FormLookup key={`carrier-${header.transport_mode}`} label="Carrier" value={header.carrier} {...carrierLookupProps(header.transport_mode, header.company_code)} onChange={(value, row) => applyHeaderLookup("carrier", value, row)} />
                <FormLookup label="Forwarder" value={header.forwarder_code} valueField="forwarder_code" displayFields={["forwarder_code", "forwarder_name"]} columns={[{ field: "forwarder_code", header: "Code" }, { field: "forwarder_name", header: "Forwarder" }]} loadOptions={() => loadForwarderLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("forwarder_code", value, row)} />
                <FormInput label="Transit Time" value={header.transit_time} onChange={(value) => setHeaderField("transit_time", value)} />
                <FormInput label="Frequency" value={header.frequency} onChange={(value) => setHeaderField("frequency", value)} />
                <FormLookup label="Sales Executive" value={header.salesman_code} valueField="salesman_code" displayFields={["salesman_code", "salesman_name"]} columns={[{ field: "salesman_code", header: "Code" }, { field: "salesman_name", header: "Sales Executive" }]} loadOptions={() => loadSalesmanLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("salesman_code", value, row)} />
                <FormInput label="Ready Date" type="date" value={header.schedule_date} onChange={(value) => setHeaderField("schedule_date", value)} />
              </div>
            </section>
          )}

          {activeTab === "payment" && (
            <section>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase text-muted-foreground">Payment Terms</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FormSelect label="INCO Terms" value={header.payment_terms} onChange={(value) => setHeaderField("payment_terms", value)} options={paymentTerms.map((value) => ({ value, label: value }))} />
                <FormSelect label="Freight Payable At" value={header.tos} onChange={(value) => setHeaderField("tos", value)} options={tosOptions.map((value) => ({ value, label: value }))} />
                <FormLookup label="Currency" value={header.curr_code} valueField="curr_code" displayFields={["curr_code", "curr_name"]} columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Currency" }, { field: "ex_rate", header: "Rate" }]} loadOptions={() => loadCurrencyLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("curr_code", value, row)} />
                <FormInput label="Exchange Rate" type="number" value={header.ex_rate} onChange={(value) => setHeaderField("ex_rate", value)} />
                <FormSelect label="Member Type" value={header.member_type} onChange={(value) => setHeaderField("member_type", value)} options={memberTypes.map((value) => ({ value, label: value || "Blank" }))} />
                <FormSelect label="Sale Type" value={header.sale_type} onChange={(value) => setHeaderField("sale_type", value)} options={saleTypes.map((value) => ({ value, label: value }))} />
                <FormSelect label="Job Category" value={header.job_category} onChange={(value) => setHeaderField("job_category", value)} options={jobCategories.map((value) => ({ value, label: value }))} />
                <FormLookup label="Ref Enquiry No" value={header.ref_enquiry_nr} valueField="enquiry_nr" displayFields={["enquiry_nr", "enquiry_date"]} columns={[{ field: "enquiry_nr", header: "Enquiry" }, { field: "enquiry_date", header: "Date" }, { field: "prin_code", header: "Principal" }]} loadOptions={() => loadReferenceEnquiryLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("ref_enquiry_nr", value, row)} />
                <FormTextarea label="Special Instructions" value={header.spl_instructions} onChange={(value) => setHeaderField("spl_instructions", value)} className="sm:col-span-2 lg:col-span-4 xl:col-span-6" />
              </div>
            </section>
          )}

          {activeTab === "activities" && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="m-0 text-sm font-semibold uppercase text-muted-foreground">Activities</h2>
                <Button type="button" size="sm" variant="outline" onClick={addDetail}>
                  <Plus size={14} />
                  Add Line
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      {["Act Code", "Activity", "Mode", "Origin", "Destination", "Qty", "UOM", "Bill Rate", "Cost Rate", "Bill", "Cost", "Currency", "Remarks", ""].map((label) => (
                        <th key={label} className="px-1.5 py-1.5 font-semibold">{label}</th>
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

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { key: EnquiryTab; label: string; icon: typeof PackageCheck };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-t-md border px-3 text-xs font-semibold transition ${
        active
          ? "border-slate-200 border-b-card bg-card text-slate-950"
          : "border-transparent text-slate-500 hover:bg-white hover:text-slate-900"
      }`}
    >
      <Icon size={14} />
      {tab.label}
    </button>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h2 className="m-0 text-xs font-semibold uppercase text-slate-700">{title}</h2>
      <p className="m-0 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/15 bg-white/10 px-2.5 py-1.5">
      <div className="text-[11px] font-semibold uppercase text-slate-300">{label}</div>
      <div className="truncate text-xs font-semibold text-white">{value}</div>
    </div>
  );
}

function buildInitialHeader(user: Record<string, unknown> | null, target?: FreightWorkspaceTarget, screenType: "enquiry" | "rfq" = "enquiry"): EnquiryHeader {
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
    enquiry_type: screenType === "rfq" ? "RFQ" : "EQI",
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
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
      {label}
      <Input className="h-8 text-xs" value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FormLookup({
  label,
  value,
  valueField,
  displayFields,
  columns,
  loadOptions,
  onChange,
  required,
  className = "",
}: {
  label: string;
  value: string;
  valueField: string;
  displayFields: string[];
  columns: Array<{ field: string; header: string }>;
  loadOptions: () => Promise<LookupRow[]>;
  onChange: (value: string, row: LookupRow | null) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
      {label}
      <LookupField
        compact
        label={label}
        value={value}
        columns={columns}
        valueField={valueField}
        displayFields={displayFields}
        loadOptions={loadOptions}
        onChange={onChange}
        required={required}
        placeholder={`Select ${label}`}
      />
    </div>
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
    <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
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
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
      {label}
      <textarea className={`${fieldClassName} min-h-14 resize-y py-1.5`} value={value} onChange={(event) => onChange(event.target.value)} />
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
    <td className="px-1.5 py-1.5">
      <Input className={`h-7 text-xs ${className}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </td>
  );
}

function modeLabel(mode: string) {
  if (mode === "S") return "Sea";
  if (mode === "R") return "Road";
  return "Air";
}

const portColumns = [
  { field: "port_code", header: "Code" },
  { field: "port_name", header: "Port" },
  { field: "country_name", header: "Country" },
];

function carrierLookupProps(mode: string, companyCode: string) {
  if (mode === "S") {
    return {
      valueField: "vessel_code",
      displayFields: ["vessel_code", "vessel_name"],
      columns: [
        { field: "vessel_code", header: "Code" },
        { field: "vessel_name", header: "Vessel" },
      ],
      loadOptions: () => loadCarrierLookup(companyCode, mode),
    };
  }
  if (mode === "R") {
    return {
      valueField: "vehicle_no",
      displayFields: ["vehicle_no", "vehicle_desc"],
      columns: [
        { field: "vehicle_no", header: "Vehicle" },
        { field: "vehicle_desc", header: "Description" },
      ],
      loadOptions: () => loadCarrierLookup(companyCode, mode),
    };
  }
  return {
    valueField: "airline_code",
    displayFields: ["airline_code", "airline_name"],
    columns: [
      { field: "airline_code", header: "Code" },
      { field: "airline_name", header: "Airline" },
    ],
    loadOptions: () => loadCarrierLookup(companyCode, mode),
  };
}

async function loadPrincipalLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT
      p.PRIN_CODE,
      p.PRIN_NAME,
      p.PRIN_DEPT_CODE,
      p.CURR_CODE,
      c.CURR_NAME,
      c.EX_RATE,
      d.DEPT_NAME
    FROM MS_PRINCIPAL p
    LEFT JOIN MS_CURRENCY c
      ON c.COMPANY_CODE = p.COMPANY_CODE
     AND c.CURR_CODE = p.CURR_CODE
    LEFT JOIN MS_DEPARTMENT d
      ON d.COMPANY_CODE = p.COMPANY_CODE
     AND d.DEPT_CODE = p.PRIN_DEPT_CODE
    WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY p.PRIN_CODE
  `);
}

async function loadWalkinPrincipalLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT PRIN_CODE, PRIN_NAME, PRIN_CONTACT1, PRIN_EMAIL1, PRIN_TELNO1
    FROM MS_PRINCIPAL_WALKIN
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY PRIN_CODE
  `);
}

async function loadDepartmentLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT DEPT_CODE, DEPT_NAME
    FROM MS_DEPARTMENT
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY DEPT_CODE
  `);
}

async function loadCommodityLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT PRODTYPE_DESC, PRODTYPE_CODE
    FROM MS_PRODTYPE
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY PRODTYPE_DESC
  `);
}

async function loadPortLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT
      p.PORT_CODE,
      p.PORT_NAME,
      p.COUNTRY_CODE,
      c.COUNTRY_NAME
    FROM MS_PORT p
    LEFT JOIN MS_COUNTRY c
      ON c.COUNTRY_CODE = p.COUNTRY_CODE
    WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY p.PORT_NAME
  `);
}

async function loadCurrencyLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT CURR_CODE, CURR_NAME, EX_RATE
    FROM MS_CURRENCY
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY CURR_CODE
  `);
}

async function loadSalesmanLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT SALESMAN_CODE, SALESMAN_NAME
    FROM MS_SALESMAN
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY SALESMAN_CODE
  `);
}

async function loadForwarderLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT FORWARDER_CODE, FORWARDER_NAME
    FROM MS_FORWARDER
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY FORWARDER_CODE
  `);
}

async function loadVehicleTypeLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT VTYPE_CODE, VTYPE_NAME
    FROM MS_VEHICLE_TYPE
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY VTYPE_CODE
  `);
}

async function loadCarrierLookup(companyCode: string, mode: string) {
  if (mode === "S") {
    return loadFreightLookup(`
      SELECT VESSEL_CODE, VESSEL_NAME
      FROM MS_VESSEL
      WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      ORDER BY VESSEL_CODE
    `);
  }
  if (mode === "R") {
    return loadFreightLookup(`
      SELECT VEHICLE_NO, VEHICLE_DESC
      FROM MS_VEHICLE
      WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      ORDER BY VEHICLE_NO
    `);
  }
  return loadFreightLookup(`
    SELECT AIRLINE_CODE, AIRLINE_NAME
    FROM MS_AIRLINE
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY AIRLINE_CODE
  `);
}

async function loadReferenceEnquiryLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT ENQUIRY_NR, ENQUIRY_DATE, PRIN_CODE, JOB_TYPE, TRANSPORT_MODE, DEPT_CODE, CURR_CODE
    FROM TF_ENQUIRY
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND ENQUIRY_TYPE = 'EQI'
    ORDER BY ENQUIRY_DATE DESC
  `);
}

async function loadFreightLookup(sql: string) {
  const rows = await executeWmsInboundSql(sql);
  return Array.isArray(rows) ? rows.map(normalizeLookupRow) : [];
}

function normalizeLookupRow(row: LookupRow): LookupRow {
  const normalized: LookupRow = { ...row };
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function lookupText(row: LookupRow, field: string) {
  return String(getLookupValue(row, field) ?? "").trim();
}

function sqlEscape(input: string) {
  return String(input || "").replace(/'/g, "''");
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

const fieldClassName =
  "flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
