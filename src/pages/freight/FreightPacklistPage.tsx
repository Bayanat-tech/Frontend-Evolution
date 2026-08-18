import type { ColumnDef } from "@tanstack/react-table";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit2,
  Eye,
  FileSignature,
  FileText,
  MapPinned,
  PackageCheck,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Ship,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type ViewMode = "list" | "editor";
type Notice = { type: "success" | "error"; text: string } | null;
const PackEditContext = createContext(true);

type PackForm = {
  company_code: string;
  prin_code: string;
  job_no: string;
  packlist_no: string;
  seq_number: string;
  is_new_packlist: boolean;
  transport_mode: string;
  job_type: string;
  job_date: string;
  prin_name: string;
  port_code: string;
  destination_port: string;
  place_receipt: string;
  place_delivery: string;
  doc_ref: string;
  cust_code: string;
  broker_code: string;
  shipper_name: string;
  shipper_address: string;
  consignee_name: string;
  consignee_address: string;
  notify_name: string;
  notify_address: string;
  marksnos: string;
  prod_description: string;
  cargo_details: string;
  no_of_packings: string;
  quantity: string;
  puom: string;
  volume: string;
  net_wt: string;
  gross_wt: string;
  charge_wt: string;
  feus: string;
  teus: string;
  bl_mode: string;
  container_no: string;
  container_size: string;
  container_type: string;
  vessel_name: string;
  voyage_no: string;
  bl_no: string;
  bl_date: string;
  import_blno: string;
  import_bldate: string;
  hawb: string;
  airline: string;
  airline_address: string;
  flight_info: string;
  issuing_carrier: string;
  issuing_carrier_add: string;
  agents_iata_code: string;
  acc_info: string;
  accnt_no: string;
  chg_code: string;
  dec_val_carr: string;
  dec_val_cus: string;
  valuation_chg: string;
  tax_chg: string;
  agent_amount: string;
  carrier_amount: string;
  issue_place: string;
  issue_date: string;
  shipon_board: string;
  signature: string;
  po_no: string;
  shipment_status: string;
  rate_ind: string;
  amt_insurance: string;
  kg_ind: string;
  rate_class: string;
  item_no: string;
  routing: string;
  terms_of_delivery: string;
  curr_code: string;
  ex_rate: string;
  rate: string;
  amount: string;
  remarks: string;
  handling_info: string;
  user_id: string;
};

type DimensionLine = {
  sr_no: string;
  packlist_dim_no: string;
  length: string;
  breadth: string;
  height: string;
  qty: string;
  gross_wt: string;
  chargeable_wt: string;
  volume: string;
  total_qty: string;
  cargo_details: string;
  prod_description: string;
};

const modeMap = {
  air: { code: "A", label: "Air", icon: Plane },
  sea: { code: "S", label: "Sea", icon: Ship },
  land: { code: "R", label: "Road", icon: Truck },
};

const directionMap = {
  import: { code: "IMP", label: "Import" },
  export: { code: "EXP", label: "Export" },
  reexport: { code: "IRE", label: "Import for Re-export" },
};

export function FreightPacklistPage({
  target,
  initialJob = null,
  startMode = "list",
  screen = "packlist",
  readOnly = false,
  onEmbeddedActionsChange,
  onEmbeddedList,
}: {
  target?: FreightWorkspaceTarget;
  initialJob?: LookupRow | null;
  startMode?: ViewMode;
  screen?: "packlist" | "jobsheet";
  readOnly?: boolean;
  onEmbeddedActionsChange?: (actions: ReactNode | null) => void;
  onEmbeddedList?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");
  const modeKey = (target?.mode || "air") as keyof typeof modeMap;
  const directionKey = (target?.direction || "import") as keyof typeof directionMap;
  const mode = modeMap[modeKey];
  const direction = directionMap[directionKey];
  const Icon = mode.icon;
  const screenTitle = screen === "jobsheet" ? "JOB Sheet" : "Pack List";
  const screenSubtitle = screen === "jobsheet" ? "Shipment document and billing summary" : "Bill of lading and cargo packing details";
  const embeddedInWorkspace = Boolean(onEmbeddedActionsChange);
  const embeddedFormId = `freight-${screen}-embedded-form`;

  const [view, setView] = useState<ViewMode>("list");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [pack, setPack] = useState<PackForm>(() => emptyPack(companyCode, userId, mode.code, direction.code));
  const [dimensions, setDimensions] = useState<DimensionLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState(false);

  const notify = useCallback((next: Exclude<Notice, null>) => {
    setNotice(next);
    if (next.type === "success") toast.success(next.text);
    else toast.error(next.text);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const isAir = mode.code === "A";

  const loadRows = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/list", {
        company_code: companyCode,
        transport_mode: mode.code,
        job_type: direction.code,
        search: query,
      });
      setRows((response.data.data || []).map(normalizeLookupRow));
    } catch (error: any) {
      setRows([]);
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load pack lists." });
    } finally {
      setLoading(false);
    }
  }, [companyCode, direction.code, mode.code, notify, query]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPack(emptyPack(companyCode, userId, mode.code, direction.code));
    setDimensions([]);
    setView(startMode);
    setEditing(!readOnly && startMode === "editor");
  }, [companyCode, direction.code, mode.code, readOnly, startMode, userId]);

  useEffect(() => {
    if (!initialJob) return;
    void openInitialJob(initialJob);
  }, [initialJob]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "packlist_no", header: "Pack No", size: 110, cell: ({ row }) => <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openPack(row.original)}>{lookupText(row.original, "packlist_no") || "Auto"}</button> },
    { accessorKey: "seq_number", header: "Seq", size: 70 },
    { accessorKey: "job_no", header: "Job No", size: 120 },
    { accessorKey: "job_date", header: "Job Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "job_date")) },
    { accessorKey: "prin_code", header: "Principal", size: 90 },
    { accessorKey: "prin_name", header: "Principal Name", size: 220 },
    { accessorKey: "shipper_name", header: "Shipper", size: 200 },
    { accessorKey: "consignee_name", header: "Consignee", size: 200 },
    { accessorKey: "bl_no", header: isAir ? "AWB" : "BL No", size: 130 },
    { accessorKey: "bl_date", header: "BL Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "bl_date")) },
    { accessorKey: "container_no", header: "Container", size: 130 },
    { accessorKey: "container_type", header: "Container Type", size: 130 },
    { accessorKey: "gross_wt", header: "Gross Wt", size: 90 },
    { accessorKey: "volume", header: "Volume", size: 90 },
    { accessorKey: "quantity", header: "Qty", size: 80 },
    { accessorKey: "shipment_status", header: "Shipment Status", size: 140 },
    { id: "actions", header: "Actions", size: 90, cell: ({ row }) => <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" title="View" onClick={() => openPack(row.original)}><Eye size={14} /></Button><Button type="button" size="icon" variant="ghost" title="Delete" disabled={readOnly} onClick={(event) => { event.stopPropagation(); void deletePack(row.original); }}><Trash2 size={14} /></Button></div> },
  ], [isAir, readOnly]);

  const openAdd = () => {
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Pack list is view only." });
      return;
    }
    setPack(emptyPack(companyCode, userId, mode.code, direction.code));
    setDimensions([]);
    setNotice(null);
    setEditing(true);
    setView("editor");
  };

  const openNewPackForCurrentJob = useCallback(() => {
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Pack list is view only." });
      return;
    }
    setPack((current) => {
      const draft = toPackDraftFromJob(current as unknown as LookupRow, companyCode, userId, mode.code, direction.code);
      return {
        ...draft,
        company_code: current.company_code || draft.company_code,
        prin_code: current.prin_code || draft.prin_code,
        prin_name: current.prin_name || draft.prin_name,
        job_no: current.job_no || draft.job_no,
        job_date: current.job_date || draft.job_date,
        transport_mode: current.transport_mode || draft.transport_mode,
        job_type: current.job_type || draft.job_type,
        curr_code: current.curr_code || draft.curr_code,
        ex_rate: current.ex_rate || draft.ex_rate,
        packlist_no: "",
        seq_number: "",
        is_new_packlist: true,
      };
    });
    setDimensions([]);
    setNotice(null);
    setEditing(true);
  }, [companyCode, direction.code, mode.code, notify, readOnly, userId]);

  const loadDimensions = async (row: LookupRow) => {
    const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/dimensions/list", {
      company_code: companyCode,
      prin_code: lookupText(row, "prin_code"),
      job_no: lookupText(row, "job_no"),
    });
    setDimensions((response.data.data || []).map(toDimensionLine));
  };

  const openInitialJob = async (row: LookupRow) => {
    const normalized = normalizeLookupRow(row);
    const jobNo = lookupText(normalized, "job_no");
    const prinCode = lookupText(normalized, "prin_code");
    if (!jobNo) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/list", {
        company_code: companyCode,
        transport_mode: mode.code,
        job_type: direction.code,
        search: jobNo,
      });
      const match = (response.data.data || [])
        .map(normalizeLookupRow)
        .find((item) => lookupText(item, "job_no") === jobNo && (!prinCode || lookupText(item, "prin_code") === prinCode));

      if (match && lookupText(match, "packlist_no")) {
        await openPack(match);
        return;
      }

      setPack(toPackDraftFromJob(normalized, companyCode, userId, mode.code, direction.code));
      if (mode.code === "A") await loadDimensions(normalized);
      else setDimensions([]);
      setEditing(!readOnly);
      setView("editor");
    } catch (error: any) {
      setPack(toPackDraftFromJob(normalized, companyCode, userId, mode.code, direction.code));
      setDimensions([]);
      setEditing(!readOnly);
      setView("editor");
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to check existing pack list; opened new draft." });
    } finally {
      setLoading(false);
    }
  };

  const openPack = async (row: LookupRow) => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow }>("/api/freight/packlist/get", {
        company_code: companyCode,
        prin_code: lookupText(row, "prin_code"),
        job_no: lookupText(row, "job_no"),
        packlist_no: lookupText(row, "packlist_no"),
      });
      setPack(toPackForm(normalizeLookupRow(response.data.data || row), companyCode, userId, mode.code, direction.code));
      if (mode.code === "A") await loadDimensions(row);
      else setDimensions([]);
      setEditing(false);
      setView("editor");
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to open pack list." });
    } finally {
      setLoading(false);
    }
  };

  const deletePack = async (row: LookupRow) => {
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Pack list is view only." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/packlist/delete", {
        company_code: companyCode,
        prin_code: lookupText(row, "prin_code"),
        job_no: lookupText(row, "job_no"),
        packlist_no: lookupText(row, "packlist_no"),
      });
      notify({ type: "success", text: "Pack list deleted." });
      await loadRows();
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete pack list." });
    } finally {
      setSaving(false);
    }
  };

  const savePack = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Pack list is view only." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        ...pack,
        packlist_no: pack.is_new_packlist ? null : pack.packlist_no,
        seq_number: pack.is_new_packlist ? null : pack.seq_number,
      };
      const response = await api.post<{ success?: boolean; data?: { packlist_no?: string | number; seq_number?: string }; message?: string }>("/api/freight/packlist/save", { packlist: payload });
      if (isAir && pack.job_no && pack.prin_code) {
        await api.post("/api/freight/packlist/dimensions/save", {
          company_code: companyCode,
          prin_code: pack.prin_code,
          job_no: pack.job_no,
          user_id: userId,
          lines: dimensions,
        });
      }
      notify({ type: "success", text: response.data.message || "Pack list saved." });
      setPack((current) => ({
        ...current,
        packlist_no: String(response.data.data?.packlist_no || current.packlist_no),
        seq_number: response.data.data?.seq_number || current.seq_number,
        is_new_packlist: false,
      }));
      await loadRows();
      setEditing(false);
      setView("editor");
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save pack list." });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!embeddedInWorkspace || !onEmbeddedActionsChange || view !== "editor") {
      onEmbeddedActionsChange?.(null);
      return undefined;
    }

    onEmbeddedActionsChange(
      <div className="freight-job-inline-actions freight-job-inline-actions-header freight-job-commandbar">
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={() => (onEmbeddedList ? onEmbeddedList() : setView("list"))}>
          <ArrowLeft size={14} /> List
        </Button>
        {pack.job_no && !readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={openNewPackForCurrentJob}>
            <Plus size={14} /> New {screenTitle}
          </Button>
        )}
        {!editing && !readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Edit2 size={14} /> Edit
          </Button>
        )}
        {editing && !readOnly && (
          <Button type="submit" size="sm" disabled={saving || !pack.job_no || readOnly} form={embeddedFormId}>
            <Save size={14} /> Save
          </Button>
        )}
        <span className={`freight-job-mode-badge ${editing ? "editing" : "viewing"}`}>{editing ? "Edit" : "View"}</span>
      </div>
    );

    return () => onEmbeddedActionsChange(null);
  }, [embeddedFormId, embeddedInWorkspace, editing, notice, onEmbeddedActionsChange, onEmbeddedList, openNewPackForCurrentJob, pack.job_no, readOnly, saving, screenTitle, view]);

  if (view === "list") {
    return (
      <section className="grid gap-3">
        <Header title={`${mode.label} ${direction.label} ${screenTitle}`} subtitle={screenSubtitle} icon={Icon} screenTitle={screenTitle}>
          {notice && <NoticeChip notice={notice} />}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={14} />Refresh</Button>
          {!readOnly && <Button type="button" size="sm" onClick={openAdd}><Plus size={14} />Add {screenTitle}</Button>}
        </Header>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search pack list, job, principal, BL/AWB..."
          title={`${rows.length} ${screenTitle}s`}
          subtitle={`${mode.label} / ${direction.label}`}
          height="calc(100vh - 240px)"
          minWidth={1680}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename={`freight-${modeKey}-${directionKey}-packlist.csv`}
          onRowClick={openPack}
        />
      </section>
    );
  }

  return (
    <form id={embeddedInWorkspace ? embeddedFormId : undefined} className="freight-document-form" onSubmit={savePack}>
      {!embeddedInWorkspace && (
        <>
          <Header title={`${mode.label} ${direction.label} ${screenTitle}`} subtitle={pack.packlist_no ? `Pack ${pack.packlist_no}` : `New ${screenTitle.toLowerCase()}`} icon={Icon} screenTitle={screenTitle}>
            {notice && <NoticeChip notice={notice} />}
            <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>
            {!editing && !readOnly && <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 size={14} />Edit</Button>}
            {pack.job_no && !readOnly && <Button type="button" size="sm" variant="outline" onClick={openNewPackForCurrentJob}><Plus size={14} />New {screenTitle}</Button>}
            {editing && !readOnly && <Button type="submit" size="sm" disabled={saving || !pack.job_no || readOnly}><Save size={14} />Save</Button>}
          </Header>

          <div className="freight-job-focus-bar freight-job-focus-compact">
            <div>
              <span className="freight-job-number">{pack.packlist_no ? `Pack ${pack.packlist_no}` : "New Pack List"}</span>
              <span className="freight-job-route">{pack.job_no || "Job pending"} / {mode.label} / {direction.label}</span>
            </div>
            <div className="freight-job-status-strip">
              <span>BL <strong>{pack.bl_no || "-"}</strong></span>
              <span>Cargo <strong>{pack.quantity || "0"} {pack.puom}</strong></span>
              <span>Gross <strong>{pack.gross_wt || "0"}</strong></span>
            </div>
          </div>
        </>
      )}

      <fieldset disabled={readOnly || !editing} className={`freight-document-paper freight-shipment-paper ${editing && !readOnly ? "is-editing" : "is-viewing"}`}>
        <PackEditContext.Provider value={editing && !readOnly}>
        <div className="freight-job-section-grid">
        <Panel className="lg:col-span-12" icon={FileSignature} title="Document Reference" meta={`Pack ${pack.packlist_no || "Auto"} / ${pack.job_no || "Select job"}`}>
          <div className="freight-job-field-grid freight-job-field-grid-8">
            <Lookup label="Freight Job" value={pack.job_no} valueField="JOB_NO" displayFields={["JOB_NO", "PRIN_CODE", "PRIN_NAME"]} columns={jobColumns} loadOptions={() => lookupJobs(companyCode, mode.code, direction.code, pack.job_no)} onChange={(value, row) => selectJob(value, row, setPack, companyCode, userId, mode.code, direction.code)} />
            <ReadOnlyField label="Pack No" value={pack.packlist_no || "Auto"} />
            <ReadOnlyField label="Seq No" value={pack.seq_number || "Auto"} />
            <ReadOnlyField label="Principal" value={pack.prin_code || "-"} />
            <ReadOnlyField label="Principal Name" value={pack.prin_name || "-"} />
            <Field label="Customer" value={pack.cust_code} onChange={(value) => setPackField(setPack, "cust_code", value)} />
            <Field label="Broker" value={pack.broker_code} onChange={(value) => setPackField(setPack, "broker_code", value)} />
            <Field label={isAir ? "AWB No" : "HBL Number"} value={pack.bl_no} onChange={(value) => setPackField(setPack, "bl_no", value)} />
            <Field label={isAir ? "AWB Date" : "WBL Date"} type="date" value={pack.bl_date} onChange={(value) => setPackField(setPack, "bl_date", value)} />
            <Field label="Currency" value={pack.curr_code} onChange={(value) => setPackField(setPack, "curr_code", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-12" icon={UserRound} title="Parties" meta="Shipper / Consignee / Notify">
          <div className="freight-job-field-grid freight-job-field-grid-3">
            <Textarea label="Shipper" value={pack.shipper_name} onChange={(value) => setPackField(setPack, "shipper_name", value)} />
            <Textarea label="Consignee" value={pack.consignee_name} onChange={(value) => setPackField(setPack, "consignee_name", value)} />
            <Textarea label="Notify" value={pack.notify_name} onChange={(value) => setPackField(setPack, "notify_name", value)} />
            <Textarea label="Shipper Address" value={pack.shipper_address} onChange={(value) => setPackField(setPack, "shipper_address", value)} />
            <Textarea label="Consignee Address" value={pack.consignee_address} onChange={(value) => setPackField(setPack, "consignee_address", value)} />
            <Textarea label="Notify Address" value={pack.notify_address} onChange={(value) => setPackField(setPack, "notify_address", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-6" icon={PackageCheck} title="Cargo And Measures" meta={`${pack.quantity || "0"} ${pack.puom || ""} / ${pack.gross_wt || "0"} kgs`}>
          <div className="freight-job-field-grid freight-job-field-grid-3">
            <Field label="Packages" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} />
            <Field label="Quantity" type="number" value={pack.quantity} onChange={(value) => setPackField(setPack, "quantity", value)} />
            <Field label="UOM" value={pack.puom} onChange={(value) => setPackField(setPack, "puom", value)} />
            <Field label="Volume" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
            <Field label="Net Wt" type="number" value={pack.net_wt} onChange={(value) => setPackField(setPack, "net_wt", value)} />
            <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
            <Field label="Charge Wt" type="number" value={pack.charge_wt} onChange={(value) => setPackField(setPack, "charge_wt", value)} />
            <Field label="FEU" type="number" value={pack.feus} onChange={(value) => setPackField(setPack, "feus", value)} />
            <Field label="TEU" type="number" value={pack.teus} onChange={(value) => setPackField(setPack, "teus", value)} />
            <SelectField label="BL Mode" value={pack.bl_mode} options={["FCL", "LCL", "NONE"]} onChange={(value) => setPackField(setPack, "bl_mode", value)} />
            <Field label="Rate" type="number" value={pack.rate} onChange={(value) => setPackField(setPack, "rate", value)} />
            <Field label="Amount" type="number" value={pack.amount} onChange={(value) => setPackField(setPack, "amount", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-6" icon={FileText} title="Description And Marks" meta={pack.prod_description || "Cargo description pending"}>
          <div className="freight-job-field-grid freight-job-field-grid-2">
            <Textarea label="Marks & Nos" value={pack.marksnos} onChange={(value) => setPackField(setPack, "marksnos", value)} />
            <Textarea label="Product Description" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} />
            <Textarea label="Cargo Details" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} />
            <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-12" icon={mode.icon} title={isAir ? "Air Waybill" : "Container / Carrier"} meta={isAir ? pack.flight_info || "Flight pending" : pack.container_no || "Container pending"}>
          <div className="freight-job-field-grid freight-job-field-grid-4">
            {isAir ? (
              <>
                <Field label="HAWB" value={pack.hawb} onChange={(value) => setPackField(setPack, "hawb", value)} />
                <Field label="Airline" value={pack.airline} onChange={(value) => setPackField(setPack, "airline", value)} />
                <Field label="IATA Code" value={pack.agents_iata_code} onChange={(value) => setPackField(setPack, "agents_iata_code", value)} />
                <SelectField label="Charge Code" value={pack.chg_code} options={["PP", "CC"]} onChange={(value) => setPackField(setPack, "chg_code", value)} />
                <Field label="Flight Info" value={pack.flight_info} onChange={(value) => setPackField(setPack, "flight_info", value)} />
                <Field label="Issue Place" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
                <Field label="Issue Date" type="date" value={pack.issue_date} onChange={(value) => setPackField(setPack, "issue_date", value)} />
                <Field label="Ship On Board" type="date" value={pack.shipon_board} onChange={(value) => setPackField(setPack, "shipon_board", value)} />
                <Field label="Status" value={pack.shipment_status} onChange={(value) => setPackField(setPack, "shipment_status", value)} />
              </>
            ) : (
              <>
                <Field label="Vessel / Vehicle" value={pack.vessel_name} onChange={(value) => setPackField(setPack, "vessel_name", value)} />
                <Field label="Voyage / Trip" value={pack.voyage_no} onChange={(value) => setPackField(setPack, "voyage_no", value)} />
                <Field label="Container No" value={pack.container_no} onChange={(value) => setPackField(setPack, "container_no", value)} />
                <Field label="Size" value={pack.container_size} onChange={(value) => setPackField(setPack, "container_size", value)} />
                <Field label="Type" value={pack.container_type} onChange={(value) => setPackField(setPack, "container_type", value)} />
                <Field label="Import BL" value={pack.import_blno} onChange={(value) => setPackField(setPack, "import_blno", value)} />
              </>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-12" icon={FileSignature} title="Terms And Handling" meta={pack.terms_of_delivery || "Delivery terms pending"}>
          <div className="freight-job-field-grid freight-job-field-grid-4">
            <Field label="Terms" value={pack.terms_of_delivery} onChange={(value) => setPackField(setPack, "terms_of_delivery", value)} />
            <Field label="Ex Rate" type="number" value={pack.ex_rate} onChange={(value) => setPackField(setPack, "ex_rate", value)} />
            <Field label="PO No" value={pack.po_no} onChange={(value) => setPackField(setPack, "po_no", value)} />
            <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} />
            {!isAir && <Field label="Import BL Date" type="date" value={pack.import_bldate} onChange={(value) => setPackField(setPack, "import_bldate", value)} />}
            <Textarea className="sm:col-span-2" label="Handling Info" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} />
          </div>
        </Panel>

        {!isAir && (
          <Panel className="lg:col-span-12" icon={Ship} title="Bill Of Lading Route" meta={`${pack.port_code || "Loading"} -> ${pack.destination_port || "Discharge"}`}>
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Field label="MSWB / Master BL" value={pack.doc_ref} onChange={(value) => setPackField(setPack, "doc_ref", value)} />
              <Field label="PO No" value={pack.po_no} onChange={(value) => setPackField(setPack, "po_no", value)} />
              <Field label="Pre-Carriage By" value={pack.vessel_name} onChange={(value) => setPackField(setPack, "vessel_name", value)} />
              <Field label="Place of Receipt" value={pack.place_receipt} onChange={(value) => setPackField(setPack, "place_receipt", value)} />
              <Field label="Port of Loading" value={pack.port_code} onChange={(value) => setPackField(setPack, "port_code", value)} />
              <Field label="Port of Discharge" value={pack.destination_port} onChange={(value) => setPackField(setPack, "destination_port", value)} />
              <Field label="Place of Delivery" value={pack.place_delivery} onChange={(value) => setPackField(setPack, "place_delivery", value)} />
              <Field label="Vessel Name" value={pack.vessel_name} onChange={(value) => setPackField(setPack, "vessel_name", value)} />
              <Field label="Voyage No" value={pack.voyage_no} onChange={(value) => setPackField(setPack, "voyage_no", value)} />
            </div>
          </Panel>
        )}

        {isAir && (
          <Panel className="lg:col-span-12" icon={MapPinned} title="Air Routing" meta={pack.routing || `${pack.port_code || "Origin"} -> ${pack.destination_port || "Destination"}`}>
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Field label="Origin" value={pack.port_code} onChange={(value) => setPackField(setPack, "port_code", value)} />
              <Field label="Destination" value={pack.destination_port} onChange={(value) => setPackField(setPack, "destination_port", value)} />
              <Field label="Place of Receipt" value={pack.place_receipt} onChange={(value) => setPackField(setPack, "place_receipt", value)} />
              <Field label="Place of Delivery" value={pack.place_delivery} onChange={(value) => setPackField(setPack, "place_delivery", value)} />
              <Field label="Routing" value={pack.routing} onChange={(value) => setPackField(setPack, "routing", value)} />
              <Field label="Flight Info" value={pack.flight_info} onChange={(value) => setPackField(setPack, "flight_info", value)} />
            </div>
          </Panel>
        )}

        {isAir && (
          <Panel className="lg:col-span-12" icon={Plane} title="Air Waybill Accounting" meta="PB AWB valuation, carrier and account fields">
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Field label="Airline Address" value={pack.airline_address} onChange={(value) => setPackField(setPack, "airline_address", value)} />
              <Field label="Issuing Carrier" value={pack.issuing_carrier} onChange={(value) => setPackField(setPack, "issuing_carrier", value)} />
              <Field label="Carrier Address" value={pack.issuing_carrier_add} onChange={(value) => setPackField(setPack, "issuing_carrier_add", value)} />
              <Field label="Account Info" value={pack.acc_info} onChange={(value) => setPackField(setPack, "acc_info", value)} />
              <Field label="Dec Val Carr" value={pack.dec_val_carr} onChange={(value) => setPackField(setPack, "dec_val_carr", value)} />
              <Field label="Dec Val Cus" value={pack.dec_val_cus} onChange={(value) => setPackField(setPack, "dec_val_cus", value)} />
              <Field label="Valuation Chg" type="number" value={pack.valuation_chg} onChange={(value) => setPackField(setPack, "valuation_chg", value)} />
              <Field label="Tax Chg" type="number" value={pack.tax_chg} onChange={(value) => setPackField(setPack, "tax_chg", value)} />
              <Field label="Agent Amount" type="number" value={pack.agent_amount} onChange={(value) => setPackField(setPack, "agent_amount", value)} />
              <Field label="Carrier Amount" type="number" value={pack.carrier_amount} onChange={(value) => setPackField(setPack, "carrier_amount", value)} />
              <Field label="Account No" value={pack.accnt_no} onChange={(value) => setPackField(setPack, "accnt_no", value)} />
              <Field label="Insurance Amt" value={pack.amt_insurance} onChange={(value) => setPackField(setPack, "amt_insurance", value)} />
              <SelectField label="Rate Ind" value={pack.rate_ind} options={["N", "A", "R"]} onChange={(value) => setPackField(setPack, "rate_ind", value)} />
              <SelectField label="KG Ind" value={pack.kg_ind} options={["K", "L"]} onChange={(value) => setPackField(setPack, "kg_ind", value)} />
              <Field label="Rate Class" value={pack.rate_class} onChange={(value) => setPackField(setPack, "rate_class", value)} />
              <Field label="Item No" value={pack.item_no} onChange={(value) => setPackField(setPack, "item_no", value)} />
              <Field label="Routing" value={pack.routing} onChange={(value) => setPackField(setPack, "routing", value)} />
            </div>
          </Panel>
        )}

        {isAir && (
          <Panel className="lg:col-span-12" icon={PackageCheck} title="Dimension Details" meta={`${dimensions.length} cargo dimension lines`}>
            <DimensionGrid rows={dimensions} setRows={setDimensions} />
          </Panel>
        )}
        </div>
        </PackEditContext.Provider>
      </fieldset>
    </form>
  );
}

function Header({ title, subtitle, icon: Icon, children, screenTitle = "Pack List" }: { title: string; subtitle: string; icon: typeof Plane; children: ReactNode; screenTitle?: string }) {
  return (
    <div className="freight-form-header">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={18} /></span>
        <div>
          <p className="eyebrow mb-0.5">Freight {screenTitle}</p>
          <h1 className="m-0 text-lg font-semibold text-foreground">{title}</h1>
          <p className="m-0 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Panel({ title, meta, icon: Icon, children, className = "" }: { title: string; meta: string; icon: typeof Plane; children: ReactNode; className?: string }) {
  return (
    <section className={`freight-info-section ${className}`}>
      <div className="freight-info-title">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={15} />
          <h2>{title}</h2>
        </div>
        <span>{meta}</span>
      </div>
      <div className="freight-info-body">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={type === "date" ? formatDate(value) : value} />;
  const safeValue = type === "date" ? normalizeDateInput(value) : value;
  return <label className="freight-compact-label">{label}<Input className="h-7 text-xs font-semibold" type={type} value={safeValue} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={value} />;
  return <label className="freight-compact-label">{label}<select className="h-7 rounded-md border bg-background px-2 text-xs font-semibold" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Blank</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Textarea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField className={className} label={label} value={value} multiline />;
  return <label className={`freight-compact-label ${className}`}>{label}<textarea className="min-h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground shadow-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={value} strong />;
  return <div className="freight-compact-label">{label}<div className="flex h-7 items-center rounded-md border bg-muted/40 px-2 text-xs font-semibold normal-case text-foreground">{value}</div></div>;
}

function Lookup({ label, value, valueField, displayFields, columns, loadOptions, onChange }: { label: string; value: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; loadOptions: (query?: string) => Promise<LookupRow[]>; onChange: (value: string, row: LookupRow | null) => void }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={value} />;
  return <label className="freight-compact-label">{label}<LookupField value={value} compact valueField={valueField} displayFields={displayFields} columns={columns} loadOptions={loadOptions} onChange={onChange} /></label>;
}

function DisplayField({ label, value, strong, multiline, className = "" }: { label: string; value: string; strong?: boolean; multiline?: boolean; className?: string }) {
  return (
    <div className={`freight-read-field ${multiline ? "multiline" : ""} ${className}`}>
      <span>{label}</span>
      <strong className={strong ? "is-strong" : ""}>{value || "-"}</strong>
    </div>
  );
}

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function emptyPack(companyCode: string, userId: string, transportMode: string, jobType: string): PackForm {
  return {
    company_code: companyCode,
    prin_code: "",
    job_no: "",
    packlist_no: "",
    seq_number: "",
    is_new_packlist: true,
    transport_mode: transportMode,
    job_type: jobType,
    job_date: "",
    prin_name: "",
    port_code: "",
    destination_port: "",
    place_receipt: "",
    place_delivery: "",
    doc_ref: "",
    cust_code: "",
    broker_code: "",
    shipper_name: "",
    shipper_address: "",
    consignee_name: "",
    consignee_address: "",
    notify_name: "",
    notify_address: "",
    marksnos: "",
    prod_description: "",
    cargo_details: "",
    no_of_packings: "",
    quantity: "1",
    puom: "",
    volume: "",
    net_wt: "",
    gross_wt: "",
    charge_wt: "",
    feus: "",
    teus: "",
    bl_mode: "LCL",
    container_no: "",
    container_size: "",
    container_type: "STANDARD",
    vessel_name: "",
    voyage_no: "",
    bl_no: "",
    bl_date: "",
    import_blno: "",
    import_bldate: "",
    hawb: "",
    airline: "",
    airline_address: "",
    flight_info: "",
    issuing_carrier: "",
    issuing_carrier_add: "",
    agents_iata_code: "",
    acc_info: "",
    accnt_no: "",
    chg_code: "PP",
    dec_val_carr: "NVD",
    dec_val_cus: "NCV",
    valuation_chg: "0",
    tax_chg: "0",
    agent_amount: "0",
    carrier_amount: "0",
    issue_place: "",
    issue_date: "",
    shipon_board: "",
    signature: "",
    po_no: "",
    shipment_status: "READY",
    rate_ind: "N",
    amt_insurance: "",
    kg_ind: "K",
    rate_class: "",
    item_no: "",
    routing: "",
    terms_of_delivery: "",
    curr_code: "OMR",
    ex_rate: "1",
    rate: "",
    amount: "",
    remarks: "",
    handling_info: "",
    user_id: userId,
  };
}

function toPackForm(row: LookupRow, companyCode: string, userId: string, mode: string, jobType: string): PackForm {
  const base = emptyPack(companyCode, userId, mode, jobType);
  return {
    ...(Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as PackForm),
    is_new_packlist: false,
  };
}

function emptyDimension(srNo: number): DimensionLine {
  return {
    sr_no: String(srNo),
    packlist_dim_no: "",
    length: "",
    breadth: "",
    height: "",
    qty: "1",
    gross_wt: "",
    chargeable_wt: "",
    volume: "",
    total_qty: "",
    cargo_details: "",
    prod_description: "",
  };
}

function toDimensionLine(row: LookupRow, index: number): DimensionLine {
  const base = emptyDimension(index + 1);
  return Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as DimensionLine;
}

function DimensionGrid({ rows, setRows }: { rows: DimensionLine[]; setRows: Dispatch<SetStateAction<DimensionLine[]>> }) {
  const editable = useContext(PackEditContext);
  const columns: Array<keyof DimensionLine> = ["sr_no", "length", "breadth", "height", "qty", "gross_wt", "chargeable_wt", "volume", "total_qty", "cargo_details", "prod_description"];
  const numeric = new Set<keyof DimensionLine>(["length", "breadth", "height", "qty", "gross_wt", "chargeable_wt", "volume", "total_qty"]);
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-between border-b bg-muted/35 px-2 py-1.5">
        <span className="text-xs font-semibold text-foreground">Air cargo dimensions</span>
        {editable && <Button type="button" size="sm" variant="outline" onClick={() => setRows((current) => [...current, emptyDimension(current.length + 1)])}><Plus size={14} />Line</Button>}
      </div>
      <div className="overflow-auto">
        <div className="grid min-w-[1180px] grid-cols-[56px_repeat(8,minmax(86px,1fr))_minmax(170px,1.5fr)_minmax(190px,1.7fr)_44px] gap-1 border-b bg-muted/20 px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
          {columns.map((column) => <span key={column}>{column.replace(/_/g, " ")}</span>)}<span />
        </div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid min-w-[1180px] grid-cols-[56px_repeat(8,minmax(86px,1fr))_minmax(170px,1.5fr)_minmax(190px,1.7fr)_44px] gap-1 border-b px-2 py-1">
            {columns.map((column) => (
              editable ? (
                <Input
                  key={column}
                  className={`h-7 text-xs ${numeric.has(column) ? "text-right" : ""}`}
                  type={numeric.has(column) ? "number" : "text"}
                  value={row[column]}
                  readOnly={column === "sr_no"}
                  onChange={(event) => setRows((current) => current.map((item, index) => index === rowIndex ? { ...item, [column]: event.target.value } : item))}
                />
              ) : (
                <span key={column} className={`min-h-7 rounded-sm px-1 py-1 text-xs font-semibold text-foreground ${numeric.has(column) ? "text-right" : ""}`}>{row[column] || "-"}</span>
              )
            ))}
            {editable ? <Button type="button" size="icon" variant="ghost" title="Remove dimension" onClick={() => setRows((current) => current.filter((_, index) => index !== rowIndex).map((item, index) => ({ ...item, sr_no: String(index + 1) })))}><Trash2 size={14} /></Button> : <span />}
          </div>
        ))}
        {!rows.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No air dimension lines. Add length, breadth, height and weight details when needed.</div>}
      </div>
    </div>
  );
}

function selectJob(value: string, row: LookupRow | null, setPack: (updater: (current: PackForm) => PackForm) => void, companyCode: string, userId: string, mode: string, jobType: string) {
  if (!row) {
    setPack((current) => ({ ...current, job_no: value }));
    return;
  }
  const next = toPackDraftFromJob(row, companyCode, userId, mode, jobType);
  setPack((current) => ({
    ...current,
    ...next,
    job_no: value,
    packlist_no: current.is_new_packlist ? "" : current.packlist_no,
    seq_number: current.is_new_packlist ? "" : current.seq_number,
    is_new_packlist: current.is_new_packlist,
    curr_code: lookupText(row, "curr_code") || current.curr_code,
    ex_rate: lookupText(row, "ex_rate") || current.ex_rate,
  }));
}

function toPackDraftFromJob(row: LookupRow, companyCode: string, userId: string, mode: string, jobType: string): PackForm {
  const base = emptyPack(companyCode, userId, mode, jobType);
  return {
    ...base,
    company_code: lookupText(row, "company_code") || base.company_code,
    prin_code: lookupText(row, "prin_code") || base.prin_code,
    prin_name: lookupText(row, "prin_name") || base.prin_name,
    port_code: lookupText(row, "port_code") || base.port_code,
    destination_port: lookupText(row, "destination_port") || base.destination_port,
    place_receipt: lookupText(row, "place_receipt") || base.place_receipt,
    place_delivery: lookupText(row, "place_delivery") || base.place_delivery,
    doc_ref: lookupText(row, "doc_ref") || base.doc_ref,
    cust_code: lookupText(row, "cust_code") || lookupText(row, "prin_code") || base.cust_code,
    job_no: lookupText(row, "job_no") || base.job_no,
    job_date: normalizeDateInput(lookupText(row, "job_date")),
    transport_mode: lookupText(row, "transport_mode") || base.transport_mode,
    job_type: lookupText(row, "job_type") || base.job_type,
    vessel_name: lookupText(row, "vessel_name") || lookupText(row, "carrier") || base.vessel_name,
    voyage_no: lookupText(row, "voyage_no") || base.voyage_no,
    bl_no: lookupText(row, "doc_ref") || base.bl_no,
    hawb: lookupText(row, "hawb") || base.hawb,
    curr_code: lookupText(row, "curr_code") || base.curr_code,
    ex_rate: lookupText(row, "ex_rate") || base.ex_rate,
  };
}

function setPackField(setPack: (updater: (current: PackForm) => PackForm) => void, field: keyof PackForm, value: string) {
  setPack((current) => ({ ...current, [field]: value }));
}

async function lookupJobs(companyCode: string, mode: string, jobType: string, search: string) {
  const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/jobs", {
    company_code: companyCode,
    transport_mode: mode,
    job_type: jobType,
    search,
  });
  return (response.data.data || []).map(normalizeLookupRow);
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function lookupText(row: LookupRow | undefined, key: string) {
  if (!row) return "";
  const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function normalizeDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

const jobColumns = [
  { field: "JOB_NO", header: "Job No" },
  { field: "JOB_DATE", header: "Date" },
  { field: "PRIN_CODE", header: "Principal" },
  { field: "PRIN_NAME", header: "Principal Name" },
];
