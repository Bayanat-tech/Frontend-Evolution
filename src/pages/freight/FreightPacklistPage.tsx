import { Textarea as TextAreaControl } from "../../components/ui/Textarea";
import { FreightDatePicker, FreightDateTimePicker } from "../../components/freight/FreightDatePicker";
import type { ColumnDef } from "@tanstack/react-table";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  ShieldCheck,
  Ship,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { freightSelect } from "../../api/freight";

type ViewMode = "list" | "editor";
type Notice = { type: "success" | "error"; text: string } | null;
type SmartCheck = { tone: "ok" | "warn" | "danger"; title: string; detail: string };
const PackEditContext = createContext(true);

type PackForm = {
  no_of_original_bl: string;
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
  agent_name: string;
  agent_address: string;
  agent_country: string;
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
  payableat: string;
  curr_code: string;
  ex_rate: string;
  rate: string;
  amount: string;
  remarks: string;
  handling_info: string;
  executed_on: string;
  executed_by: string;
  frt_chgs_master: string;
  frt_chgs_house: string;
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

type ContainerLine = {
  srno: string;
  container_no: string;
  container_type: string;
  t_f: string;
  seal_no: string;
  volume: string;
  gross_weight: string;
  no_of_pkgs: string;
  puom: string;
  contn_desc: string;
  contn_pick_date: string;
  bl_no: string;
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
  const [containers, setContainers] = useState<ContainerLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);

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
  const isSea = mode.code === "S";
  const isRoad = mode.code === "R";

  const syncContainersToPack = useCallback((updatedContainers: ContainerLine[]) => {
    const totalVol = updatedContainers.reduce((sum, r) => sum + (Number(r.volume) || 0), 0);
    const totalGross = updatedContainers.reduce((sum, r) => sum + (Number(r.gross_weight) || 0), 0);
    const totalPkgs = updatedContainers.reduce((sum, r) => sum + (Number(r.no_of_pkgs) || 0), 0);
    const teuCount = updatedContainers.filter((r) => r.t_f === "T").length;
    const feuCount = updatedContainers.filter((r) => r.t_f === "F").length;
    const containerSummary = updatedContainers.map((r) => r.container_no.trim()).filter(Boolean).join(",\r\n");

    setPack((curr) => ({
      ...curr,
      volume: totalVol > 0 ? totalVol.toFixed(3) : curr.volume,
      gross_wt: totalGross > 0 ? totalGross.toFixed(2) : curr.gross_wt,
      no_of_packings: totalPkgs > 0 ? String(totalPkgs) : curr.no_of_packings,
      quantity: totalPkgs > 0 ? String(totalPkgs) : curr.quantity,
      teus: String(teuCount),
      feus: String(feuCount),
      container_no: containerSummary || curr.container_no,
    }));
  }, []);

  const syncDimensionsToPack = useCallback((updatedDims: DimensionLine[]) => {
    const totalVol = updatedDims.reduce((sum, r) => sum + (Number(r.volume) || 0), 0);
    const totalQty = updatedDims.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalGross = updatedDims.reduce((sum, r) => sum + (Number(r.gross_wt) || 0), 0);
    const totalCwt = updatedDims.reduce((sum, r) => sum + (Number(r.chargeable_wt) || 0), 0);

    let finalCwt = Math.max(totalGross, totalCwt);
    if (finalCwt > 0 && finalCwt < 45) finalCwt = 45;

    setPack((curr) => {
      const nextAmount = (finalCwt > 0 && Number(curr.rate) > 0)
        ? (finalCwt * Number(curr.rate)).toFixed(3)
        : curr.amount;

      return {
        ...curr,
        volume: totalVol > 0 ? totalVol.toFixed(3) : curr.volume,
        no_of_packings: totalQty > 0 ? String(totalQty) : curr.no_of_packings,
        quantity: totalQty > 0 ? String(totalQty) : curr.quantity,
        gross_wt: totalGross > 0 ? totalGross.toFixed(2) : curr.gross_wt,
        charge_wt: finalCwt > 0 ? String(Math.round(finalCwt * 100) / 100) : curr.charge_wt,
        amount: nextAmount,
      };
    });
  }, []);

  const smartChecks = useMemo(() => buildPacklistSmartChecks(pack, containers, dimensions, mode.code), [pack, containers, dimensions, mode.code]);
  const urgentChecks = smartChecks.filter((item) => item.tone === "danger").length;
  const warningChecks = smartChecks.filter((item) => item.tone === "warn").length;

  const airCargoColumns: CargoColumn[] = [
  { key: "no_of_packings", label: "No. of Pcs", width: "90px", type: "number" },
  { key: "quantity", label: "Quantity", width: "90px", type: "number" },
  { key: "puom", label: "UOM", width: "150px", lookupUom: true },
  { key: "volume", label: "Volume", width: "90px", type: "number" },
  { key: "gross_wt", label: "Gross Wt", width: "95px", type: "number" },
  { key: "kg_ind", label: "KG Ind", width: "75px", type: "select", options: ["K", "L"] },
  { key: "rate_class", label: "Rate Class", width: "100px" },
  { key: "item_no", label: "Commodity Item No", width: "100px", type: "number" },

  { key: "charge_wt", label: "Chargeable Wt", width: "110px", type: "number" },
  { key: "rate_ind", label: "Rate Ind", width: "95px", type: "select", options: ["N", "A", "R"] },
  { key: "rate", label: "Rate", width: "90px", type: "number" },
  
  { key: "amount", label: "Total", width: "100px", type: "number", readOnly: true },
];

const seaCargoColumns: CargoColumn[] = [
  { key: "no_of_packings", label: "No. of Pkgs", width: "100px", type: "number" },
  { key: "quantity", label: "Quantity", width: "95px", type: "number" },
  { key: "puom", label: "Kind of Pkgs / UOM", width: "150px", lookupUom: true },
  { key: "gross_wt", label: "Gross Wt (kg)", width: "110px", type: "number" },
  { key: "net_wt", label: "Net Wt (kg)", width: "110px", type: "number" },
  { key: "volume", label: "Cube (m3)", width: "105px", type: "number" },
  { key: "cargo_details", label: "Container Details", width: "650px" },
];

const roadCargoColumns: CargoColumn[] = [
  { key: "no_of_packings", label: "No. of Pcs", width: "90px", type: "number" },
  { key: "quantity", label: "Quantity", width: "90px", type: "number" },
  { key: "puom", label: "UOM", width: "130px", lookupUom: true },
  { key: "net_wt", label: "Net Wt (kg)", width: "100px", type: "number" },
  { key: "gross_wt", label: "Gross Wt (kg)", width: "100px", type: "number" },
  { key: "volume", label: "Volume (cbm)", width: "100px", type: "number" },
  { key: "charge_wt", label: "Chg Wt (kg)", width: "100px", type: "number" },
  { key: "dec_val_carr", label: "Value of Goods", width: "120px", type: "number" },
  { key: "cargo_details", label: "Cargo Details", width: "500px" },
];
const cargoColumns = isAir ? airCargoColumns : isRoad ? roadCargoColumns : seaCargoColumns;

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
    setContainers([]);
    setView(startMode);
    setEditing(!readOnly && startMode === "editor");
  }, [companyCode, direction.code, mode.code, readOnly, startMode, userId]);

  useEffect(() => {
    if (!initialJob) return;
    void openInitialJob(initialJob);
  }, [initialJob]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "PACKLIST_NO", header: "Pack No", size: 110, cell: ({ row }) => <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openPack(row.original)}>{lookupText(row.original, "packlist_no") || "Auto"}</button> },
    { accessorKey: "SEQ_NUMBER", header: "Seq", size: 70 },
    { accessorKey: "JOB_NO", header: "Job No", size: 120 },
    { accessorKey: "JOB_DATE", header: "Job Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "job_date")) },
    { accessorKey: "PRIN_CODE", header: "Principal", size: 90 },
    { accessorKey: "PRIN_NAME", header: "Principal Name", size: 220 },
    { accessorKey: "SHIPPER_NAME", header: "Shipper", size: 200 },
    { accessorKey: "CONSIGNEE_NAME", header: "Consignee", size: 200 },
    { accessorKey: "BL_NO", header: isAir ? "AWB" : "BL No", size: 130 },
    { accessorKey: "BL_DATE", header: "BL Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "bl_date")) },
    { accessorKey: "CONTAINER_NO", header: "Container", size: 130 },
    { accessorKey: "CONTAINER_TYPE", header: "Container Type", size: 130 },
    { accessorKey: "GROSS_WT", header: "Gross Wt", size: 90 },
    { accessorKey: "VOLUME", header: "Volume", size: 90 },
    { accessorKey: "QUANTITY", header: "Qty", size: 80 },
    { accessorKey: "SHIPMENT_STATUS", header: "Shipment Status", size: 140 },
    { id: "actions", header: "Actions", size: 90, cell: ({ row }) => <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="View" onClick={() => openPack(row.original)}><Eye size={13} /></Button><Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="Delete" disabled={readOnly} onClick={(event) => { event.stopPropagation(); void deletePack(row.original); }}><Trash2 size={13} /></Button></div> },
  ], [isAir, readOnly]);

  const openAdd = () => {
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Pack list is view only." });
      return;
    }
    setPack(emptyPack(companyCode, userId, mode.code, direction.code));
    setDimensions([]);
    setContainers([]);
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
    setContainers([]);
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
      const jobTransportMode = lookupText(normalized, "transport_mode") || mode.code;
      const jobJobType = lookupText(normalized, "job_type") || direction.code;

      let response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/list", {
        company_code: companyCode,
        transport_mode: jobTransportMode,
        job_type: jobJobType,
        search: jobNo,
      });
      let match = (response.data.data || [])
        .map(normalizeLookupRow)
        .find((item) => lookupText(item, "job_no") === jobNo && (!prinCode || lookupText(item, "prin_code") === prinCode));

      if (!match) {
        // Fallback search without transport_mode and job_type restrictions to catch cross-mode or newly converted jobs
        const fallbackRes = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/list", {
          company_code: companyCode,
          search: jobNo,
        });
        match = (fallbackRes.data.data || [])
          .map(normalizeLookupRow)
          .find((item) => lookupText(item, "job_no") === jobNo && (!prinCode || lookupText(item, "prin_code") === prinCode));
      }

      if (match && lookupText(match, "packlist_no")) {
        await openPack(match);
        return;
      }

      setPack(toPackDraftFromJob(normalized, companyCode, userId, mode.code, direction.code));
      setContainers([]);
      if (mode.code === "A") await loadDimensions(normalized);
      else setDimensions([]);
      setEditing(!readOnly);
      setView("editor");
    } catch (error: any) {
      setPack(toPackDraftFromJob(normalized, companyCode, userId, mode.code, direction.code));
      setDimensions([]);
      setContainers([]);
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
      const packRow = normalizeLookupRow(response.data.data || row);
      setPack(toPackForm(packRow, companyCode, userId, mode.code, direction.code));
      const containerRows = ((response.data.data as Record<string, unknown> | undefined)?.CONTAINERS || []) as LookupRow[];
      setContainers(containerRows.map(toContainerLine));
      if (mode.code === "A") await loadDimensions(row);
      else setDimensions([]);
      setEditing(false);
      setEditing(!readOnly);
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
      const containerSummary = containers.map((row) => row.container_no.trim()).filter(Boolean).join(",\r\n");
      const payload = {
        ...pack,
        container_no: mode.code === "S" ? containerSummary : pack.container_no,
        packlist_no: pack.is_new_packlist ? null : pack.packlist_no,
        seq_number: pack.is_new_packlist ? null : pack.seq_number,
      };
      const response = await api.post<{ success?: boolean; data?: { packlist_no?: string | number; seq_number?: string }; message?: string }>("/api/freight/packlist/save", {
        packlist: payload,
        ...(mode.code === "S" ? { containers } : {}),
        ...(isAir ? { dimensions } : {}),
      });
      notify({ type: "success", text: response.data.message || "Pack list saved." });
      setPack((current) => ({
        ...current,
        packlist_no: String(response.data.data?.packlist_no || current.packlist_no),
        seq_number: response.data.data?.seq_number || current.seq_number,
        container_no: mode.code === "S" ? containerSummary : current.container_no,
        is_new_packlist: false,
      }));
      setEditing(!readOnly);
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
      <div className="freight-job-inline-actions freight-job-inline-actions-header freight-job-commandbar flex flex-wrap items-center gap-1.5">
        {notice && <NoticeChip notice={notice} />}
        {!onEmbeddedList && (<Button type="button" size="sm" variant="outline" onClick={() => setView("list")} aria-label="Back to list" title="Back to list"><ArrowLeft size={14} /></Button>)}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={urgentChecks + warningChecks > 0 ? "border-amber-300 text-amber-700 bg-amber-50" : ""}
          onClick={() => setAssistOpen((prev) => !prev)}
        >
          <Sparkles size={14} />
          Assist {urgentChecks + warningChecks > 0 ? `(${urgentChecks + warningChecks})` : ""}
        </Button>
        {pack.job_no && !readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={openNewPackForCurrentJob}>
            <Plus size={14} /> New {screenTitle}
          </Button>
        )}
        {!readOnly && (
          <Button type="submit" size="sm" disabled={saving || !pack.job_no || readOnly} form={embeddedFormId}>
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
    );

    return () => onEmbeddedActionsChange(null);
  }, [assistOpen, embeddedFormId, embeddedInWorkspace, notice, onEmbeddedActionsChange, onEmbeddedList, openNewPackForCurrentJob, pack.job_no, readOnly, saving, screenTitle, urgentChecks, view, warningChecks]);

  if (view === "list") {
    return (
    <section className="freight-list-screen grid gap-3">
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
          pageSize={25}
          enableExport={false}
          actionButton={<FinanceListActionsMenu onExport={() => exportToCsv(rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]))), columns, `freight-${modeKey}-${directionKey}-packlist.csv`)} onRefresh={() => void loadRows()} />}
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={urgentChecks + warningChecks > 0 ? "border-amber-300 text-amber-700 bg-amber-50" : ""}
              onClick={() => setAssistOpen((prev) => !prev)}
            >
              <Sparkles size={14} />
              Smart Assist {urgentChecks + warningChecks > 0 ? `(${urgentChecks + warningChecks})` : ""}
            </Button>
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

      {assistOpen && <FreightAssistPanel checks={smartChecks} />}

      <fieldset disabled={readOnly || !editing} className={`freight-ui-standard freight-document-paper freight-shipment-paper ${editing && !readOnly ? "is-editing" : "is-viewing"}`}>
        <PackEditContext.Provider value={editing && !readOnly}>
        <div className="freight-job-section-grid">
        <Panel className="pack-document-panel lg:col-span-12" icon={FileSignature} title="Document Reference" meta={`Pack ${pack.packlist_no || "Auto"} / Job ${pack.job_no || "Pending"}`}>
          <div className="freight-job-field-grid grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <ReadOnlyField label="Job No" value={pack.job_no || "-"} />
            <ReadOnlyField label="Pack List No" value={pack.packlist_no || "Auto"} />
            <Field label="P.O. No" value={pack.po_no} onChange={(value) => setPackField(setPack, "po_no", value)} required />
            <Field
              label={isAir ? "MAWB" : isSea ? "MSWB / Master BL" : "Doc Ref #"}
              value={pack.doc_ref}
              onChange={(value) => setPackField(setPack, "doc_ref", value)}
            />
            <Field
              label={isAir ? "HAWB" : isSea ? "HBL Number" : "HBWL No"}
              value={pack.bl_no}
              onChange={(value) => setPackField(setPack, "bl_no", value)}
            />
            <Field
              label={isAir ? "AWB Date" : isSea ? "WBL Date" : "WB Date"}
              type="date"
              value={pack.bl_date}
              onChange={(value) => setPackField(setPack, "bl_date", value)}
            />
          </div>
        </Panel>

        <Panel className="pack-parties-panel lg:col-span-12" icon={UserRound} title="Parties" meta="Shipper / Consignee / Notify">
          <div className="freight-job-field-grid pack-parties-grid">
            <Textarea rows={2} label="Shipper Name" value={pack.shipper_name} onChange={(value) => setPackField(setPack, "shipper_name", value)} />
            <Textarea rows={3} label="Shipper Address" value={pack.shipper_address} onChange={(value) => setPackField(setPack, "shipper_address", value)} />
            <Textarea rows={2} label="Consignee Name" value={pack.consignee_name} onChange={(value) => setPackField(setPack, "consignee_name", value)} />
            <Textarea rows={3} label="Consignee Address" value={pack.consignee_address} onChange={(value) => setPackField(setPack, "consignee_address", value)} />
            <Textarea rows={2} label="Notify Name" value={pack.notify_name} onChange={(value) => setPackField(setPack, "notify_name", value)} />
            <Textarea rows={3} label="Notify Address" value={pack.notify_address} onChange={(value) => setPackField(setPack, "notify_address", value)} />
            {isAir && (
              <>
                <Field label="Airline Name" value={pack.airline} onChange={(value) => setPackField(setPack, "airline", value)} className="lg:col-span-1" />
                <Field label="Airline Address" value={pack.airline_address} onChange={(value) => setPackField(setPack, "airline_address", value)} />
              </>
            )}
          </div>
        </Panel>

        {/* <Panel className="lg:col-span-6" icon={PackageCheck} title="Cargo And Measures" meta={`${pack.quantity || "0"} ${pack.puom || ""} / ${pack.gross_wt || "0"} kgs`}>
          <div className="freight-job-field-grid freight-job-field-grid-3">
            <Field label="Packages" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} />
            <Field label="Quantity" type="number" value={pack.quantity} onChange={(value) => setPackField(setPack, "quantity", value)} />
            <Lookup label="UOM" value={pack.puom} valueField="UOM_CODE" displayFields={["UOM_CODE", "UOM_NAME"]} columns={[{ field: "UOM_CODE", header: "Code" }, { field: "UOM_NAME", header: "NAME" }]} loadOptions={(search) => lookup("freight_uom", companyCode, "NULL", "NULL", search)} onChange={(value) => setPackField(setPack, "puom", value)} />            
            {/* <Field label="UOM" value={pack.puom} onChange={(value) => setPackField(setPack, "puom", value)} /> */}
            {/* <Field label="Volume" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
            <Field label="Net Wt" type="number" value={pack.net_wt} onChange={(value) => setPackField(setPack, "net_wt", value)} />
            <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
            <Field label="Charge Wt" type="number" value={pack.charge_wt} onChange={(value) => setPackField(setPack, "charge_wt", value)} />
            {mode.code === "S" && <Field label="FEU" type="number" value={pack.feus} onChange={(value) => setPackField(setPack, "feus", value)} />}
            {mode.code === "S" && <Field label="TEU" type="number" value={pack.teus} onChange={(value) => setPackField(setPack, "teus", value)} />}
            <SelectField label="BL Mode" value={pack.bl_mode} options={["FCL", "LCL", "NONE"]} onChange={(value) => setPackField(setPack, "bl_mode", value)} />
            <Field label="Rate" type="number" value={pack.rate} onChange={(value) => setPackField(setPack, "rate", value)} />
            <Field label="Amount" type="number" value={pack.amount} onChange={(value) => setPackField(setPack, "amount", value)} readOnly />
          </div>
        </Panel> */}

        {/* <Panel className="pack-cargo-panel lg:col-span-6" icon={PackageCheck} title="Cargo And Measures" meta={`${pack.quantity || "0"} ${pack.puom || ""} / ${pack.gross_wt || "0"} kgs`}>
  <div className="freight-job-field-grid freight-job-field-grid-3">
    {isAir && (
      <>
        <Field label="No. of Pcs" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} required />
        <Field label="Quantity" type="number" value={pack.quantity} onChange={(value) => setPackField(setPack, "quantity", value)} required/>
        <Lookup label="UOM" value={pack.puom} valueField="UOM_CODE" displayFields={["UOM_CODE", "UOM_NAME"]} columns={[{ field: "UOM_CODE", header: "Code" }, { field: "UOM_NAME", header: "NAME" }]} loadOptions={(search) => lookup("freight_uom", companyCode, "NULL", "NULL", search)} onChange={(value) => setPackField(setPack, "puom", value)} />
        <Field label="Volume" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
        <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
        <Field label="Chargeable Wt" type="number" value={pack.charge_wt} onChange={(value) => setPackField(setPack, "charge_wt", value)} />
        <Field label="Rate" type="number" value={pack.rate} onChange={(value) => setPackField(setPack, "rate", value)} />
        <Field label="Total" type="number" value={pack.amount} readOnly onChange={(value) => setPackField(setPack, "amount", value)} />
      </>
    )}
    {isSea && (
      <>
        <Field label="Cube (m3)" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
        <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
        <Field label="Net Wt" type="number" value={pack.net_wt} onChange={(value) => setPackField(setPack, "net_wt", value)} />
        <Field label="No. of Pkgs" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} />
        {/* <Field label="FEU" type="number" value={pack.feus} onChange={(value) => setPackField(setPack, "feus", value)} />
        <Field label="TEU" type="number" value={pack.teus} onChange={(value) => setPackField(setPack, "teus", value)} />
        <SelectField label="BL Mode" value={pack.bl_mode} options={["FCL", "LCL", "NONE"]} onChange={(value) => setPackField(setPack, "bl_mode", value)} /> */}
      {/* </>
    )}
    {isRoad && (
      <>
        <Field label="No. of Pcs" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} required />
        <Field label="Quantity" type="number" value={pack.quantity} onChange={(value) => setPackField(setPack, "quantity", value)} required />
        <Field label="Net Wt" type="number" value={pack.net_wt} onChange={(value) => setPackField(setPack, "net_wt", value)} />
        <Lookup label="UOM" value={pack.puom} valueField="UOM_CODE" displayFields={["UOM_CODE", "UOM_NAME"]} columns={[{ field: "UOM_CODE", header: "Code" }, { field: "UOM_NAME", header: "NAME" }]} loadOptions={(search) => lookup("freight_uom", companyCode, "NULL", "NULL", search)} onChange={(value) => setPackField(setPack, "puom", value)} />
        <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
        <Field label="Volume" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
        <Field label="Chg Wt" type="number" value={pack.charge_wt} onChange={(value) => setPackField(setPack, "charge_wt", value)} />
      </>
    )}
  </div>
</Panel> */} 

     <Panel className="pack-cargo-panel lg:col-span-12" icon={PackageCheck} title="Cargo And Measures" meta={`${pack.quantity || "0"} ${pack.puom || ""} / ${pack.gross_wt || "0"} kgs`}>
  <CargoMeasureTable columns={cargoColumns} pack={pack} setPack={setPack} companyCode={companyCode} />
</Panel>

        {/* <Panel className="lg:col-span-6" icon={FileText} title="Description And Marks" meta={pack.prod_description || "Cargo description pending"}>
          <div className="freight-job-field-grid freight-job-field-grid-2 grid gap-2.5 sm:grid-cols-2">
            <Textarea label="Marks & Nos" value={pack.marksnos} onChange={(value) => setPackField(setPack, "marksnos", value)} />
            <Textarea label="Product Description" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} />
            <Textarea label="Cargo Details" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} />
            <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)} />
          </div>
        </Panel> */}

        <Panel className="pack-description-panel lg:col-span-12" icon={FileText} title="Description And Marks" meta={pack.prod_description || "Cargo description pending"}>
  {/* <div className="freight-job-field-grid freight-job-field-grid-1 grid gap-1.5 sm:grid-cols-2">
    {isAir ? (
      <>
        <Textarea label="Nature And Quantity Of Goods" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} required/>
        <Textarea label="Cargo Details" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} />
        <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)}className="sm:col-span-2" />
      </>
    ) : (
      <>
        <Textarea label="Marks & Nos" value={pack.marksnos} onChange={(value) => setPackField(setPack, "marksnos", value)} />
        <Textarea label="Cargo Detail" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} />
        <Textarea label="Cargo Desc" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} />
        <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)} />
      </>
    )}
  </div> */}

  {isAir ? (
  <div className="freight-job-field-grid grid gap-1.5" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
    <Textarea label="Nature And Quantity Of Goods" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} required />
    {/* <Textarea label="Cargo Details" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} /> */}
    <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)} 
    // className="col-span-2" 
    />
  </div>
) : (
  <div className="freight-job-field-grid grid gap-1.5" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
    <Textarea label="Marks & Nos" value={pack.marksnos} onChange={(value) => setPackField(setPack, "marksnos", value)} />
    {isRoad ? (
    <>
      {/* <Textarea label="Cargo Detail" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} /> */}
      <Textarea label="Cargo Desc" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} />
      <Textarea label="Special Instructions" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} />
    </>
    ) : null}
    <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)} />
  </div>
)}
</Panel>

   {isAir && (
          <Panel className="lg:col-span-12" icon={MapPinned} title="Air Routing" meta={pack.routing || `${pack.port_code || "Origin"} -> ${pack.destination_port || "Destination"}`}>
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Field label="Airport of Origin" value={pack.port_code} onChange={(value) => setPackField(setPack, "port_code", value)} />
              <Field label="Routing Of Destination" value={pack.routing} onChange={(value) => setPackField(setPack, "routing", value)}/>
              <Field label="Airport of Destination" value={pack.destination_port} onChange={(value) => setPackField(setPack, "destination_port", value)} />
              <Field label="Flight Info" value={pack.flight_info} onChange={(value) => setPackField(setPack, "flight_info", value)} />
            </div>
          </Panel>
        )} 


          {!isAir && (
        <Panel className="pack-transport-panel lg:col-span-12" icon={mode.icon} title="Container / Carrier" meta={pack.container_no || "Container pending"}>
          <div className="freight-job-field-grid freight-job-field-grid-4">
  {isSea ? (
  <>
    <Field label="Vessel Name" value={pack.vessel_name} onChange={(value) => setPackField(setPack, "vessel_name", value)} />
    {/* <Textarea rows={2} label="Container Summary" value={pack.container_no} onChange={(value) => setPackField(setPack, "container_no", value)} /> */}
    <Field label="Shipped On Board" type="date" value={pack.shipon_board} onChange={(value) => setPackField(setPack, "shipon_board", value)} />
    {/* <Field label="Shipment Status" value={pack.shipment_status} onChange={(value) => setPackField(setPack, "shipment_status", value)} /> */}
    <SelectField label="Shipment Status" value={pack.shipment_status} options={["LCL/FCL", "FCL/FCL", "FCL/LCL", "LCL/LCL"]} onChange={(value) => setPackField(setPack, "shipment_status", value)} />
    <Field label="Freight Chgs (Master)" value={pack.frt_chgs_master} onChange={(value) => setPackField(setPack, "frt_chgs_master", value)} />
    <Field label="Freight Chgs (House)" value={pack.frt_chgs_house} onChange={(value) => setPackField(setPack, "frt_chgs_house", value)} />
  </>
) : (
  <>
   <Field label="HBWL No" value={pack.bl_no} onChange={(value) => setPackField(setPack, "bl_no", value)} />
    <Field label="WB Date" type="date" value={pack.bl_date} onChange={(value) => setPackField(setPack, "bl_date", value)} />
    <Field label="Truck No" value={pack.container_no} onChange={(value) => setPackField(setPack, "container_no", value)} required/>
    <Lookup
  label="Vehicle Type"
  value={pack.container_type}
  valueField="vtype_code"
  displayFields={["vtype_code", "vtype_name"]}
  columns={[{ field: "vtype_code", header: "Code" }, { field: "vtype_name", header: "Name" }]}
  loadOptions={(search) => lookup("freight_vehicle_type", companyCode, "NULL", "NULL", search)}
  onChange={(value) => setPackField(setPack, "container_type", value)}
/>
    <Field label="Account Info" value={pack.acc_info} onChange={(value) => setPackField(setPack, "acc_info", value)} />
    {/* <Textarea label="Special Instructions" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} className="col-span-4"/> */}
  </>
)}
          </div>
        </Panel>
        )}



        {mode.code === "S" && (
          <Panel className="lg:col-span-12" icon={Ship} title="Container Details" meta={`${containers.length} container${containers.length === 1 ? "" : "s"}`}>
            <ContainerGrid rows={containers} setRows={setContainers} onSync={syncContainersToPack} />
          </Panel>
        )}



        {/* <Panel className="lg:col-span-12" icon={FileSignature} title="Terms And Handling" meta={pack.terms_of_delivery || "Delivery terms pending"}>
          <div className="freight-job-field-grid freight-job-field-grid-4">
            <Field label="Terms" value={pack.terms_of_delivery} onChange={(value) => setPackField(setPack, "terms_of_delivery", value)} />
            {/* <Field label="Ex Rate" type="number" value={pack.ex_rate} onChange={(value) => setPackField(setPack, "ex_rate", value)} /> */}
            {/* <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} /> */}
            {/* {!isAir && <Field label="Import BL Date" type="date" value={pack.import_bldate} onChange={(value) => setPackField(setPack, "import_bldate", value)} />} */}
            {/* <Textarea className="sm:col-span-2" label="Handling Info" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} /> */}
            {/* {!isRoad && <Textarea className="sm:col-span-2" label="Handling Info" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} />}
          </div>
        </Panel> */}

       {isSea && (
  <Panel className="lg:col-span-12" icon={Ship} title="Bill Of Lading Route & Carrier" meta={`${pack.port_code || "Loading"} -> ${pack.destination_port || "Discharge"}`}>
    <div className="freight-job-field-grid grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <Field label="Pre-Carriage By" value={pack.vessel_name} onChange={(value) => setPackField(setPack, "vessel_name", value)} />
      <Field label="Place of Receipt" value={pack.place_receipt} onChange={(value) => setPackField(setPack, "place_receipt", value)} />
      <Field label="Port of Loading" value={pack.port_code} onChange={(value) => setPackField(setPack, "port_code", value)} />
      <Field label="Port of Discharge" value={pack.destination_port} onChange={(value) => setPackField(setPack, "destination_port", value)} />
      <Field label="Place of Delivery" value={pack.place_delivery} onChange={(value) => setPackField(setPack, "place_delivery", value)} />
      <Field label="Freight Amount" type="number" value={pack.amount} onChange={(value) => setPackField(setPack, "amount", value)} />
      <Lookup
        label="Freight Payable At"
        value={pack.payableat}
        valueField="PAYABLEAT"
        displayFields={["PAYABLEAT", "PAYABLEAT_NAME"]}
        columns={[{ field: "PAYABLEAT", header: "Code" }, { field: "PAYABLEAT_NAME", header: "Payable At" }]}
        loadOptions={(search) => lookup("freight_payable_at", companyCode, "NULL", "NULL", search)}
        onChange={(value) => setPackField(setPack, "payableat", value)}
      />
      <Field label="Number of Originals B/Ls" type="number" value={pack.no_of_original_bl} onChange={(value) => setPackField(setPack, "no_of_original_bl", value)} />
      <Field label="Issuing Carrier Name" value={pack.issuing_carrier} onChange={(value) => setPackField(setPack, "issuing_carrier", value)} />
      <Field label="Issuing Carrier Address" value={pack.issuing_carrier_add} onChange={(value) => setPackField(setPack, "issuing_carrier_add", value)} className="lg:col-span-2" />
    </div>
  </Panel>
)}

        {/* {isAir && (
          <Panel className="lg:col-span-12" icon={MapPinned} title="Air Routing" meta={pack.routing || `${pack.port_code || "Origin"} -> ${pack.destination_port || "Destination"}`}>
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Field label="Airport of Origin" value={pack.port_code} onChange={(value) => setPackField(setPack, "port_code", value)} />
              <Field label="Airport of Destination" value={pack.destination_port} onChange={(value) => setPackField(setPack, "destination_port", value)} />
              {/* <Field label="Place of Receipt" value={pack.place_receipt} onChange={(value) => setPackField(setPack, "place_receipt", value)} />
              <Field label="Place of Delivery" value={pack.place_delivery} onChange={(value) => setPackField(setPack, "place_delivery", value)} /> */}
              {/* <Field label="Routing" value={pack.routing} onChange={(value) => setPackField(setPack, "routing", value)} />
              <Field label="Flight Info" value={pack.flight_info} onChange={(value) => setPackField(setPack, "flight_info", value)} />
            </div>
          </Panel>
        )} */} 

        {isAir && (
          <Panel className="lg:col-span-12" icon={Plane} title="Air Waybill Accounting" meta="PB AWB valuation, carrier and account fields">
            <div className="freight-job-field-grid freight-job-field-grid-4">
              {/* <Field label="Airline Address" value={pack.airline_address} onChange={(value) => setPackField(setPack, "airline_address", value)} /> */}
              {/* <Field label="Issuing Carrier" value={pack.issuing_carrier} onChange={(value) => setPackField(setPack, "issuing_carrier", value)} />
              <Field label="Carrier Address" value={pack.issuing_carrier_add} onChange={(value) => setPackField(setPack, "issuing_carrier_add", value)} /> */}
              <Field label="Agent IATA Code" value={pack.agents_iata_code} onChange={(value) => setPackField(setPack, "agents_iata_code", value)} />
              <Field label="Account Info" value={pack.acc_info} onChange={(value) => setPackField(setPack, "acc_info", value)} />
              <Field label="Account No" value={pack.accnt_no} onChange={(value) => setPackField(setPack, "accnt_no", value)} />
              <Field label="Currency" value={pack.curr_code} onChange={(value) => setPackField(setPack, "curr_code", value)} />
              <SelectField label="CHGS Code" value={pack.chg_code} options={["PP", "CC"]} onChange={(value) => setPackField(setPack, "chg_code", value)} />
              <Field label="Dec Val of Carriage" value={pack.dec_val_carr} onChange={(value) => setPackField(setPack, "dec_val_carr", value)} />
              <Field label="Dec Val of Customs" value={pack.dec_val_cus} onChange={(value) => setPackField(setPack, "dec_val_cus", value)} />
              <Field label="Insurance Amt" value={pack.amt_insurance} onChange={(value) => setPackField(setPack, "amt_insurance", value)} />
            
              <Field label="Valuation Chg" type="number" value={pack.valuation_chg} onChange={(value) => setPackField(setPack, "valuation_chg", value)} />
              <Field label="Tax Chg" type="number" value={pack.tax_chg} onChange={(value) => setPackField(setPack, "tax_chg", value)} />
              {/* <Field label="Carrier Amount" type="number" value={pack.carrier_amount} onChange={(value) => setPackField(setPack, "carrier_amount", value)} /> */}
              {/* <SelectField label="Rate Ind" value={pack.rate_ind} options={["N", "A", "R"]} onChange={(value) => setPackField(setPack, "rate_ind", value)} />
              <SelectField label="KG Ind" value={pack.kg_ind} options={["K", "L"]} onChange={(value) => setPackField(setPack, "kg_ind", value)} />
              <Field label="Rate Class" value={pack.rate_class} onChange={(value) => setPackField(setPack, "rate_class", value)} /> */}
              {/* <Field label="Item No" value={pack.item_no} onChange={(value) => setPackField(setPack, "item_no", value)} /> */}
              {/* <Field label="Commodity Item No" value={pack.item_no} onChange={(value) => setPackField(setPack, "item_no", value)} /> */}
              {/* <Field label="Executed On" type="date" value={pack.executed_on} onChange={(value) => setPackField(setPack, "executed_on", value)} /> */}
              {/* <Field label="Executed By" value={pack.executed_by} onChange={(value) => setPackField(setPack, "executed_by", value)} /> */}
               {/* <Field label="Place" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} /> */}
            </div>
          </Panel>
        )}

        {isAir && (
          <Panel className="lg:col-span-12" icon={PackageCheck} title="Dimension Details" meta={`${dimensions.length} cargo dimension lines`}>
            <DimensionGrid rows={dimensions} setRows={setDimensions} onSync={syncDimensionsToPack} />
          </Panel>
        )}

        <Panel className="lg:col-span-12" icon={FileSignature} title="Terms & Agent Details" meta={pack.terms_of_delivery || "Delivery & agent details"} >
  {/* <div className="freight-job-field-grid freight-job-field-grid-4">
    {/* <Field label="Frt Amt" type="number" value={pack.amount} onChange={(value) => setPackField(setPack, "amount", value)} /> */}
    {/* <Field label="Terms" value={pack.terms_of_delivery} onChange={(value) => setPackField(setPack, "terms_of_delivery", value)} /> */}
    {/* <Field label="Agent Name" value={pack.agent_name} onChange={(value) => setPackField(setPack, "agent_name", value)} />
    <Field label="Agent Address" value={pack.agent_address} onChange={(value) => setPackField(setPack, "agent_address", value)} />
    <Lookup
      label="Agent Country"
      value={pack.agent_country}
      valueField="COUNTRY_CODE"
      displayFields={["COUNTRY_CODE", "COUNTRY_NAME"]}
      columns={[{ field: "COUNTRY_CODE", header: "Code" }, { field: "COUNTRY_NAME", header: "Country" }]}
      loadOptions={(search) => lookup("freight_country", companyCode, "NULL", "NULL", search)}
      onChange={(value) => setPackField(setPack, "agent_country", value)}
    /><Field label="Agent Amt" type="number" value={pack.agent_amount} onChange={(value) => setPackField(setPack, "agent_amount", value)} />
    <Field label="Carrier Amount" type="number" value={pack.carrier_amount} onChange={(value) => setPackField(setPack, "carrier_amount", value)} />
    <Field label="Place of Issue" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
    <Field label="Date of Issue" type="date" value={pack.issue_date} onChange={(value) => setPackField(setPack, "issue_date", value)} />
    <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} />
    <Textarea className="sm:col-span-2" label="Handling Info" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} />
  </div> */} 

  <div className="freight-job-field-grid freight-job-field-grid-4">
  <Field label="Ex Rate" type="number" value={pack.ex_rate} onChange={(value) => setPackField(setPack, "ex_rate", value)} />
  {/* <Field label="Place of Issue" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
  <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} /> */}

  {isAir && (
    <>
      {/* <Field label="Agent Name" value={pack.agent_name} onChange={(value) => setPackField(setPack, "agent_name", value)} />
      <Field label="Agent Add" value={pack.agent_address} onChange={(value) => setPackField(setPack, "agent_address", value)} /> */}
      <Field label="Agent Chrg Amount" type="number" value={pack.agent_amount} onChange={(value) => setPackField(setPack, "agent_amount", value)} />
      <Field label="Carrier Chg Amount" type="number" value={pack.carrier_amount} onChange={(value) => setPackField(setPack, "carrier_amount", value)} />
      <Field label="Executed On" type="date" value={pack.executed_on} onChange={(value) => setPackField(setPack, "executed_on", value)} />
      <Field label="Place of Issue" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
      <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} />
      <Textarea className="sm:col-span-2" label="Handling Info" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} />
    </>
  )}

  {isSea && (
    <>
      <Field label="Terms of Delivery" value={pack.terms_of_delivery} onChange={(value) => setPackField(setPack, "terms_of_delivery", value)} />
      <Field label="Agent Name" value={pack.agent_name} onChange={(value) => setPackField(setPack, "agent_name", value)} />
      <Field label="Agent Address" value={pack.agent_address} onChange={(value) => setPackField(setPack, "agent_address", value)} />
      <Lookup
        label="Agent Country"
        value={pack.agent_country}
        valueField="COUNTRY_CODE"
        displayFields={["COUNTRY_CODE", "COUNTRY_NAME"]}
        columns={[{ field: "COUNTRY_CODE", header: "Code" }, { field: "COUNTRY_NAME", header: "Country" }]}
        loadOptions={(search) => lookup("freight_country", companyCode, "NULL", "NULL", search)}
        onChange={(value) => setPackField(setPack, "agent_country", value)}
      />
      <Field label="Agent Amount" type="number" value={pack.agent_amount} onChange={(value) => setPackField(setPack, "agent_amount", value)} />
      <Field label="Carrier Amount" type="number" value={pack.carrier_amount} onChange={(value) => setPackField(setPack, "carrier_amount", value)} />
      <Field label="Date of Issue" type="date" value={pack.issue_date} onChange={(value) => setPackField(setPack, "issue_date", value)} />
      <Field label="Place of Issue" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
      <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} />
    </>
  )}

  {isRoad && (
    <>
      <Field label="Terms" value={pack.terms_of_delivery} onChange={(value) => setPackField(setPack, "terms_of_delivery", value)} />
      <Field label="Agent Amt" type="number" value={pack.agent_amount} onChange={(value) => setPackField(setPack, "agent_amount", value)} />
      <Field label="Carrier Amt" type="number" value={pack.carrier_amount} onChange={(value) => setPackField(setPack, "carrier_amount", value)} />
      <Field label="Date of Issue" type="date" value={pack.issue_date} onChange={(value) => setPackField(setPack, "issue_date", value)} />
      <Field label="Place of Issue" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
      <Field label="Signature" value={pack.signature} onChange={(value) => setPackField(setPack, "signature", value)} />
    </>
  )}
</div>
</Panel>
        </div>
        </PackEditContext.Provider>
      </fieldset>
    </form>
  );
}

function FreightAssistPanel({ checks }: { checks: SmartCheck[] }) {
  const ready = checks.every((item) => item.tone === "ok");
  const reviewCount = checks.filter((item) => item.tone !== "ok").length;

  return (
    <section className="grid gap-2 rounded-md border bg-card p-2.5 shadow-sm mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-md ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {ready ? <ShieldCheck size={16} /> : <Sparkles size={16} />}
          </span>
          <div>
            <h2 className="m-0 text-sm font-semibold text-foreground">Pack List Assist &amp; Validation</h2>
            <p className="m-0 text-xs text-muted-foreground">PowerBuilder manifest compliance, party checks, container/dimension calculations.</p>
          </div>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {ready ? "Ready to Save" : `${reviewCount} to review`}
        </span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        {checks.map((check) => (
          <div
            key={check.title}
            className={`rounded-md border px-2.5 py-2 ${
              check.tone === "danger"
                ? "border-red-200 bg-red-50 text-red-800"
                : check.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {check.tone === "ok" ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
              {check.title}
            </div>
            <p className="m-0 mt-1 text-[11px] leading-snug opacity-85">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildPacklistSmartChecks(
  pack: PackForm,
  containers: ContainerLine[],
  dimensions: DimensionLine[],
  modeCode: string
): SmartCheck[] {
  const isAir = modeCode === "A";
  const isSea = modeCode === "S";
  const isRoad = modeCode === "R";

  const checks: SmartCheck[] = [];

  // 1. Job Reference & Status
  if (pack.job_no.trim()) {
    checks.push({
      tone: "ok",
      title: "Job Reference",
      detail: `Job ${pack.job_no} linked (${pack.job_type || "IMP"}).`,
    });
  } else {
    checks.push({
      tone: "danger",
      title: "Job Reference",
      detail: "Pack list must be associated with an active Job.",
    });
  }

  // 2. Shipper Details (Mandatory in PowerBuilder: gf_checknull('STR', ls_shipper_name, 'Shipper Name/Address'))
  if (pack.shipper_name.trim() && pack.shipper_address.trim()) {
    checks.push({
      tone: "ok",
      title: "Shipper Profile",
      detail: `${pack.shipper_name.slice(0, 30)}... verified with address.`,
    });
  } else if (pack.shipper_name.trim()) {
    checks.push({
      tone: "warn",
      title: "Shipper Profile",
      detail: "Shipper address is missing (required in PowerBuilder).",
    });
  } else {
    checks.push({
      tone: "danger",
      title: "Shipper Profile",
      detail: "Shipper Name & Address are mandatory per PB validation.",
    });
  }

  // 3. Consignee Details
  if (pack.consignee_name.trim() && pack.consignee_address.trim()) {
    checks.push({
      tone: "ok",
      title: "Consignee Profile",
      detail: `${pack.consignee_name.slice(0, 30)}... verified with address.`,
    });
  } else if (pack.consignee_name.trim()) {
    checks.push({
      tone: "warn",
      title: "Consignee Profile",
      detail: "Consignee address should be provided for delivery.",
    });
  } else {
    checks.push({
      tone: "warn",
      title: "Consignee Profile",
      detail: "Consignee details are pending.",
    });
  }

  // 4. P.O. Number (Mandatory in PowerBuilder & checked against duplicates)
  if (pack.po_no.trim()) {
    checks.push({
      tone: "ok",
      title: "P.O. Number",
      detail: `PO No: ${pack.po_no} recorded.`,
    });
  } else {
    checks.push({
      tone: "danger",
      title: "P.O. Number",
      detail: "Purchase Order (P.O.) number is mandatory in PB.",
    });
  }

  // 5. Cargo Measures & UOM
  const qty = Number(pack.quantity) || 0;
  const gross = Number(pack.gross_wt) || 0;
  if (qty > 0 && pack.puom.trim() && gross > 0) {
    checks.push({
      tone: "ok",
      title: "Cargo Manifest",
      detail: `${qty} ${pack.puom}, Gross: ${gross.toFixed(2)} kg, Vol: ${Number(pack.volume || 0).toFixed(3)} cbm.`,
    });
  } else if (!pack.puom.trim()) {
    checks.push({
      tone: "danger",
      title: "Cargo Manifest",
      detail: "Packaging UOM is required.",
    });
  } else if (qty <= 0) {
    checks.push({
      tone: "danger",
      title: "Cargo Manifest",
      detail: "Cargo quantity / piece count must be greater than 0.",
    });
  } else {
    checks.push({
      tone: "warn",
      title: "Cargo Manifest",
      detail: "Gross weight should be greater than 0.",
    });
  }

  // 6. Mode-specific checks
  if (isSea) {
    // Vessel & Routing
    if (pack.vessel_name.trim() && (pack.port_code.trim() || pack.destination_port.trim())) {
      checks.push({
        tone: "ok",
        title: "Sea Carrier & Route",
        detail: `Vessel: ${pack.vessel_name} (${pack.port_code || "Origin"} -> ${pack.destination_port || "Dest"}).`,
      });
    } else {
      checks.push({
        tone: "warn",
        title: "Sea Carrier & Route",
        detail: "Specify Vessel Name and Loading/Discharge ports.",
      });
    }

    // Containers (TF_CONTAINER_DET)
    if (containers.length > 0) {
      const emptyCont = containers.some((c) => !c.container_no.trim());
      if (emptyCont) {
        checks.push({
          tone: "danger",
          title: "Container Details",
          detail: "All container detail rows must have a valid Container Number.",
        });
      } else {
        const teuCount = containers.filter((c) => c.t_f === "T").length;
        const feuCount = containers.filter((c) => c.t_f === "F").length;
        checks.push({
          tone: "ok",
          title: "Container Details",
          detail: `${containers.length} container(s) verified: ${teuCount} TEU, ${feuCount} FEU.`,
        });
      }
    } else {
      checks.push({
        tone: "warn",
        title: "Container Details",
        detail: "No containers added. Add container records in Container Details.",
      });
    }

    // Bill of Lading
    if (pack.bl_no.trim() || pack.doc_ref.trim()) {
      checks.push({
        tone: "ok",
        title: "B/L Documentation",
        detail: `B/L No: ${pack.bl_no || pack.doc_ref} (${pack.bl_date ? formatDate(pack.bl_date) : "Date pending"}).`,
      });
    } else {
      checks.push({
        tone: "warn",
        title: "B/L Documentation",
        detail: "Master/House B/L number is recommended before finalizing.",
      });
    }
  } else if (isAir) {
    // Air Route & Flight
    if (pack.port_code.trim() && pack.destination_port.trim()) {
      checks.push({
        tone: "ok",
        title: "Air Route",
        detail: `${pack.port_code} -> ${pack.destination_port} ${pack.flight_info ? `(Flt: ${pack.flight_info})` : ""}.`,
      });
    } else {
      checks.push({
        tone: "warn",
        title: "Air Route",
        detail: "Airport of Origin and Destination should be specified.",
      });
    }

    // AWB Ref
    if (pack.bl_no.trim() || pack.doc_ref.trim()) {
      checks.push({
        tone: "ok",
        title: "Air Waybill (AWB)",
        detail: `AWB: ${pack.bl_no || pack.doc_ref} (${pack.bl_date ? formatDate(pack.bl_date) : "Date pending"}).`,
      });
    } else {
      checks.push({
        tone: "danger",
        title: "Air Waybill (AWB)",
        detail: "MAWB or HAWB number is required for air documentation.",
      });
    }

    // Dimensions & Chargeable Wt (TF_PACKLIST_DIM)
    const chgWt = Number(pack.charge_wt) || 0;
    if (dimensions.length > 0) {
      checks.push({
        tone: "ok",
        title: "Cargo Dimensions",
        detail: `${dimensions.length} dimension line(s) synced. Chargeable Wt: ${chgWt.toFixed(2)} kg.`,
      });
    } else if (chgWt > 0) {
      checks.push({
        tone: "ok",
        title: "Cargo Dimensions",
        detail: `Chargeable weight set to ${chgWt.toFixed(2)} kg. Dimensions optional.`,
      });
    } else {
      checks.push({
        tone: "warn",
        title: "Cargo Dimensions",
        detail: "Add dimension lines or specify Chargeable Weight.",
      });
    }
  } else if (isRoad) {
    // Road Truck & Vehicle Type
    if (pack.container_no.trim()) {
      checks.push({
        tone: "ok",
        title: "Truck / Vehicle",
        detail: `Vehicle No: ${pack.container_no} (${pack.container_type || "Standard"}).`,
      });
    } else {
      checks.push({
        tone: "danger",
        title: "Truck / Vehicle",
        detail: "Truck No is mandatory for road freight dispatch.",
      });
    }

    // Waybill
    if (pack.bl_no.trim() || pack.doc_ref.trim()) {
      checks.push({
        tone: "ok",
        title: "Waybill Ref",
        detail: `HBWL No: ${pack.bl_no || pack.doc_ref} (${pack.bl_date ? formatDate(pack.bl_date) : "Date pending"}).`,
      });
    } else {
      checks.push({
        tone: "warn",
        title: "Waybill Ref",
        detail: "Waybill / Doc reference is recommended.",
      });
    }

    // Value of Goods
    if (pack.dec_val_carr.trim()) {
      checks.push({
        tone: "ok",
        title: "Value of Goods",
        detail: `Declared value: ${pack.dec_val_carr}.`,
      });
    } else {
      checks.push({
        tone: "warn",
        title: "Value of Goods",
        detail: "Declared value of goods should be entered for insurance/customs.",
      });
    }
  }

  return checks;
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

function Panel({ title, icon: Icon, children, className = "" }: { title: string; meta?: string; icon: any; children: ReactNode; className?: string }) {
  return (
    <section className={`freight-panel overflow-hidden rounded-md border bg-background shadow-xs ${className}`}>
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={12} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-bold uppercase tracking-wider text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-2">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", readOnly = false, required, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; readOnly?: boolean; required?: boolean; className?: string }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={type === "date" ? formatDate(value) : value} className={className} />;
  const safeValue = type === "date" ? normalizeDateInput(value) : value;
  return (
    <label className={`freight-compact-label flex flex-col gap-1 text-[11px] font-semibold text-foreground ${className}`}>
      <span>{label} {required && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}</span>
      {type === "date" ? (<FreightDatePicker className="freight-calendar-field"
        value={safeValue}
        required={required}
        onChange={(nextValue) => onChange(nextValue)} />) : type === "datetime-local" ? (<FreightDateTimePicker className="freight-calendar-field"
        value={safeValue}
        required={required}
        onChange={(nextValue) => onChange(nextValue)} />) : (<Input
        className={`h-7 rounded-md border-input bg-background px-2 text-xs font-normal text-foreground ${type === "number" ? "text-right tabular-nums" : ""}`}
        type={type}
        value={safeValue}
        readOnly={readOnly}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLInputElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLInputElement).setCustomValidity("")}
      />)}
    </label>
  );
}

function SelectField({ label, value, options, onChange, required, className = "" }: { label: string; value: string; options: string[]; onChange: (value: string) => void; required?: boolean; className?: string }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={value} className={className} />;
  return (
    <label className={`freight-compact-label flex flex-col gap-1 text-[11px] font-semibold text-foreground ${className}`}>
      <span>{label} {required && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}</span>
      <select
        className="h-7 rounded-md border border-input bg-background px-2 text-xs font-normal text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value=""> </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, className = "", rows = 2, required }: { label: string; value: string; onChange: (value: string) => void; className?: string; rows?: number; required?: boolean }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField className={className} label={label} value={value} multiline />;
  return (
    <label className={`freight-compact-label flex flex-col gap-1 text-[11px] font-semibold text-foreground ${className}`}>
      <span>{label} {required && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}</span>
      <TextAreaControl
        rows={rows}
        className="min-h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-normal text-foreground shadow-none"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLTextAreaElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLTextAreaElement).setCustomValidity("")}
      />
    </label>
  );
}

function ReadOnlyField({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={value} className={className} />;
  return (
    <div className={`freight-compact-label flex flex-col gap-1 text-[11px] font-semibold text-foreground ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <div title={value} className="flex h-7 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-muted/40 px-2 text-xs font-semibold text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

function Lookup({ label, value, valueField, displayFields, columns, loadOptions, onChange }: { label: string; value: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; loadOptions: (query?: string) => Promise<LookupRow[]>; onChange: (value: string, row: LookupRow | null) => void }) {
  const editable = useContext(PackEditContext);
  if (!editable) return <DisplayField label={label} value={value} />;
  return (
    <label className="freight-compact-label flex flex-col gap-1 text-[11px] font-semibold text-foreground">
      <span>{label}</span>
      <LookupField value={value} compact valueField={valueField} displayFields={displayFields} columns={columns} loadOptions={loadOptions} onChange={onChange} />
    </label>
  );
}

function DisplayField({ label, value, multiline, className = "" }: { label: string; value: string; strong?: boolean; multiline?: boolean; className?: string }) {
  return (
    <div className={`freight-compact-label flex flex-col gap-1 text-[11px] font-semibold text-foreground ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <div className={`flex ${multiline ? "min-h-12 py-1 items-start" : "h-7 items-center"} rounded-md border border-border bg-muted/30 px-2 text-xs font-medium text-foreground`}>
        {value || "-"}
      </div>
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
    container_type: "",
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
    agent_name: "",
    agent_address: "",
    agent_country: "",
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
    payableat: "",
    no_of_original_bl: "",
    curr_code: "OMR",
    ex_rate: "1",
    rate: "",
    amount: "",
    remarks: "",
    handling_info: "",
     executed_on: "",
    executed_by: "",
    frt_chgs_master: "",
    frt_chgs_house: "",
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

function emptyContainer(srNo: number): ContainerLine {
  return {
    srno: String(srNo),
    container_no: "",
    container_type: "",
    t_f: "T",
    seal_no: "",
    volume: "0",
    gross_weight: "0",
    no_of_pkgs: "",
    puom: "",
    contn_desc: "",
    contn_pick_date: "",
    bl_no: "",
  };
}

function toContainerLine(row: LookupRow, index: number): ContainerLine {
  const base = emptyContainer(index + 1);
  return {
    ...(Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as ContainerLine),
    srno: String(index + 1),
    contn_pick_date: normalizeDateInput(lookupText(row, "contn_pick_date")),
  };
}

const containerTypes = ["STANDARD", "HIGHCUBE", "REFER", "HIGH CUBE REFER", "OPEN TOP", "FLAT RACK", "MAIN DECK PALLET", "LOWER DECK PALLET", "LD-2", "LD-3", "LD-4", "LD-7", "LD-11", "TANK", "BULK", "OPEN SIDE", "PLAT FORM", "VENTILATED"];

function ContainerGrid({ rows, setRows, onSync }: { rows: ContainerLine[]; setRows: Dispatch<SetStateAction<ContainerLine[]>>; onSync?: (updated: ContainerLine[]) => void }) {
  const editable = useContext(PackEditContext);
  const update = (rowIndex: number, field: keyof ContainerLine, value: string) => {
    setRows((current) => {
      const next = current.map((row, index) => {
        if (index !== rowIndex) return row;
        const updated = { ...row, [field]: value };
        if (field === "container_type") {
          const upper = value.toUpperCase();
          if (upper.includes("40") || upper.includes("FEU") || upper.includes("45")) {
            updated.t_f = "F";
          } else if (upper.includes("20") || upper.includes("TEU")) {
            updated.t_f = "T";
          }
        }
        return updated;
      });
      onSync?.(next);
      return next;
    });
  };
  const addContainer = () => {
    setRows((current) => {
      const next = [...current, emptyContainer(current.length + 1)];
      onSync?.(next);
      return next;
    });
  };
  const removeContainer = (rowIndex: number) => {
    setRows((current) => {
      const next = current.filter((_, index) => index !== rowIndex).map((item, index) => ({ ...item, srno: String(index + 1) }));
      onSync?.(next);
      return next;
    });
  };
  const totals = rows.reduce((result, row) => ({
    volume: result.volume + (Number(row.volume) || 0),
    gross: result.gross + (Number(row.gross_weight) || 0),
    packages: result.packages + (Number(row.no_of_pkgs) || 0),
  }), { volume: 0, gross: 0, packages: 0 });

  return (
    <div className="commercial-lines-card rounded-md border bg-card shadow-xs overflow-hidden">
      {/* Finance Line Actions Header */}
      <div className="finance-line-actions flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/90 border-b border-slate-200">
        <div className="finance-line-actions-left flex flex-wrap items-center gap-2">
          <span className="finance-line-actions-icon p-1 bg-blue-100/70 text-[#00378C] rounded">
            <Ship size={14} />
          </span>
          <span className="finance-line-actions-title font-bold text-xs text-slate-800 uppercase tracking-wide">
            Sea Container Manifest (TF_CONTAINER_DET)
          </span>
          <span className="finance-line-actions-badge text-[11px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
            {rows.length} {rows.length === 1 ? "container" : "containers"}
          </span>

          {/* Inline KPI Strip */}
          {rows.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 ml-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 font-medium text-blue-900">
                <span className="text-blue-700 font-bold">Volume:</span> {totals.volume.toFixed(3)} m³
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-medium text-emerald-900">
                <span className="text-emerald-700 font-bold">Gross Wt:</span> {totals.gross.toFixed(2)} kg
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-medium text-amber-900">
                <span className="text-amber-700 font-bold">Pkgs:</span> {totals.packages}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {editable && (
            <Button
              type="button"
              size="sm"
              onClick={addContainer}
              className="h-7 text-xs font-semibold !bg-[#00378C] !text-white !border-[#002d72] hover:!bg-[#002d72] shadow-xs cursor-pointer"
            >
              <Plus size={13} className="mr-1" /> Add Container
            </Button>
          )}
        </div>
      </div>

      {/* Finance Table */}
      <div className="commercial-lines-scroll overflow-auto max-h-[360px] min-h-[140px]">
        <table className="finance-lines-table w-full text-xs min-w-[1480px] border-collapse">
          <thead className="sticky top-0 bg-[#00378C] text-white text-[11px] font-bold uppercase tracking-wider shadow-xs z-10 whitespace-nowrap">
            <tr>
              <th className="finance-sticky-col finance-col-no px-2 py-2 text-center w-9 bg-[#00378C] text-white">#</th>
              <th className="px-2 py-2 text-left w-[170px] text-white">Container No</th>
              <th className="px-2 py-2 text-left w-[150px] text-white">Container Type</th>
              <th className="px-2 py-2 text-center w-[90px] text-white">TEU / FEU</th>
              <th className="px-2 py-2 text-left w-[130px] text-white">Seal No</th>
              <th className="px-2 py-2 text-right w-[105px] text-white">Cube (m³)</th>
              <th className="px-2 py-2 text-right w-[115px] text-white">Gross Wt (kg)</th>
              <th className="px-2 py-2 text-right w-[85px] text-white">Nos / Pkgs</th>
              <th className="px-2 py-2 text-left w-[95px] text-white">UOM</th>
              <th className="px-2 py-2 text-left min-w-[180px] text-white">Description</th>
              <th className="px-2 py-2 text-center w-[135px] text-white">Pickup Date</th>
              <th className="px-2 py-2 text-left w-[130px] text-white">BL No</th>
              <th className="px-2 py-2 text-center w-[50px] text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row, rowIndex) => (
              <tr
                key={`${row.srno}-${rowIndex}`}
                className={`transition-colors ${
                  rowIndex % 2 === 1 ? "bg-slate-50/40 hover:bg-blue-50/40" : "bg-white hover:bg-blue-50/40"
                }`}
              >
                <td className="finance-sticky-col finance-col-no px-2 py-1 text-center font-mono text-[11px] font-semibold text-slate-500">
                  {rowIndex + 1}
                </td>
                <td className="px-1.5 py-1 w-[170px]">
                  {editable ? (
                    <Input
                      className="h-7 uppercase text-xs font-semibold"
                      value={row.container_no}
                      onChange={(e) => update(rowIndex, "container_no", e.target.value.toUpperCase())}
                    />
                  ) : (
                    <span className="font-semibold text-slate-800">{row.container_no || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[150px]">
                  {editable ? (
                    <select
                      className="h-7 w-full rounded-md border bg-background px-1 text-xs"
                      value={row.container_type}
                      onChange={(e) => update(rowIndex, "container_type", e.target.value)}
                    >
                      {containerTypes.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <span>{row.container_type || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[90px] text-center">
                  {editable ? (
                    <select
                      className="h-7 w-full rounded-md border bg-background px-1 text-xs font-semibold text-center"
                      value={row.t_f}
                      onChange={(e) => update(rowIndex, "t_f", e.target.value)}
                    >
                      <option value="T">TEU</option>
                      <option value="F">FEU</option>
                      <option value="V">45FT</option>
                      <option value="E">48FT</option>
                    </select>
                  ) : (
                    <span className="font-semibold">{row.t_f || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[130px]">
                  {editable ? (
                    <Input
                      className="h-7 text-xs"
                      value={row.seal_no}
                      onChange={(e) => update(rowIndex, "seal_no", e.target.value)}
                    />
                  ) : (
                    <span>{row.seal_no || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[105px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs text-amber-700 bg-amber-50/40"
                      type="number"
                      step="0.001"
                      value={row.volume}
                      onChange={(e) => update(rowIndex, "volume", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right text-amber-700 font-semibold">{row.volume || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[115px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs font-semibold text-emerald-700 bg-emerald-50/40"
                      type="number"
                      step="0.01"
                      value={row.gross_weight}
                      onChange={(e) => update(rowIndex, "gross_weight", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right text-emerald-700 font-semibold">{row.gross_weight || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[85px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs font-semibold"
                      type="number"
                      value={row.no_of_pkgs}
                      onChange={(e) => update(rowIndex, "no_of_pkgs", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-semibold">{row.no_of_pkgs || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[95px]">
                  {editable ? (
                    <Input
                      className="h-7 text-xs uppercase"
                      value={row.puom}
                      onChange={(e) => update(rowIndex, "puom", e.target.value)}
                    />
                  ) : (
                    <span>{row.puom || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 min-w-[180px]">
                  {editable ? (
                    <Input
                      className="h-7 text-xs"
                      value={row.contn_desc}
                      onChange={(e) => update(rowIndex, "contn_desc", e.target.value)}
                    />
                  ) : (
                    <span className="block truncate">{row.contn_desc || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[135px]">
                  {editable ? (
                    <FreightDatePicker
                      className="freight-calendar-field"
                      value={row.contn_pick_date}
                      onChange={(nextValue) => update(rowIndex, "contn_pick_date", nextValue)}
                    />
                  ) : (
                    <span className="block text-center">{formatDate(row.contn_pick_date) || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[130px]">
                  {editable ? (
                    <Input
                      className="h-7 text-xs"
                      value={row.bl_no}
                      onChange={(e) => update(rowIndex, "bl_no", e.target.value)}
                    />
                  ) : (
                    <span>{row.bl_no || "-"}</span>
                  )}
                </td>
                <td className="px-1 py-1 text-center w-[50px]">
                  {editable ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                      title="Remove container"
                      onClick={() => removeContainer(rowIndex)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={13} className="py-8 px-4 text-center text-xs text-muted-foreground">
                  <p className="m-0 text-slate-500 font-medium">No container details recorded. Click 'Add Container' to add Sea containers.</p>
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-xs text-slate-900 sticky bottom-0 z-10">
              <tr>
                <td colSpan={5} className="px-2 py-1.5 text-right uppercase tracking-wider text-slate-600 font-bold text-[11px]">
                  Totals:
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-amber-800">
                  {totals.volume.toFixed(3)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-emerald-800">
                  {totals.gross.toFixed(2)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-slate-800">
                  {totals.packages}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

type CargoColumn = {
  key: keyof PackForm;
  label: string;
  width: string;
  type?: "text" | "number" | "select";
  options?: string[];
  readOnly?: boolean;
  lookupUom?: boolean;
};

function CargoMeasureTable({
  columns,
  pack,
  setPack,
  companyCode,
}: {
  columns: CargoColumn[];
  pack: PackForm;
  setPack: (updater: (current: PackForm) => PackForm) => void;
  companyCode: string;
}) {
  const editable = useContext(PackEditContext);

  return (
    <div className="commercial-lines-card rounded-md border bg-card shadow-xs overflow-hidden">
      <div className="finance-line-actions flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/90 border-b border-slate-200">
        <div className="finance-line-actions-left flex flex-wrap items-center gap-2">
          <span className="finance-line-actions-icon p-1 bg-blue-100/70 text-[#00378C] rounded">
            <PackageCheck size={14} />
          </span>
          <span className="finance-line-actions-title font-bold text-xs text-slate-800 uppercase tracking-wide">
            Cargo Summary & Measurements
          </span>
        </div>
      </div>

      <div className="commercial-lines-scroll overflow-auto">
        <table className="finance-lines-table w-full text-xs border-collapse">
          <thead className="bg-[#00378C] text-white text-[11px] font-bold uppercase tracking-wider shadow-xs whitespace-nowrap">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={`px-2 py-2 text-white font-bold text-[11px] uppercase ${
                    c.type === "number" ? "text-right" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white hover:bg-blue-50/40 transition-colors">
              {columns.map((c) => {
                const value = (pack[c.key] as string) || "";
                if (!editable) {
                  return (
                    <td
                      key={c.key}
                      style={{ width: c.width }}
                      className={`px-1.5 py-1.5 ${c.type === "number" ? "text-right font-semibold" : ""}`}
                    >
                      <span className="block truncate font-medium text-slate-800">
                        {value || "-"}
                      </span>
                    </td>
                  );
                }
                if (c.lookupUom) {
                  return (
                    <td key={c.key} style={{ width: c.width }} className="px-1.5 py-1">
                      <LookupField
                        value={value}
                        compact
                        valueField="UOM_CODE"
                        displayFields={["UOM_CODE", "UOM_NAME"]}
                        columns={[{ field: "UOM_CODE", header: "Code" }, { field: "UOM_NAME", header: "NAME" }]}
                        loadOptions={(search) => lookup("freight_uom", companyCode, "NULL", "NULL", search)}
                        onChange={(val) => setPackField(setPack, c.key, val)}
                      />
                    </td>
                  );
                }
                if (c.type === "select") {
                  return (
                    <td key={c.key} style={{ width: c.width }} className="px-1.5 py-1">
                      <select
                        className="h-7 w-full rounded-md border bg-background px-1 text-xs"
                        value={value}
                        onChange={(event) => setPackField(setPack, c.key, event.target.value)}
                      >
                        <option value="">-</option>
                        {c.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  );
                }
                return (
                  <td key={c.key} style={{ width: c.width }} className="px-1.5 py-1">
                    <Input
                      className={`h-7 text-xs ${c.type === "number" ? "text-right font-semibold" : ""}`}
                      type={c.type === "number" ? "number" : "text"}
                      step={c.type === "number" ? "any" : undefined}
                      readOnly={c.readOnly}
                      value={value}
                      onChange={(event) => setPackField(setPack, c.key, event.target.value)}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DimensionGrid({ rows, setRows, onSync }: { rows: DimensionLine[]; setRows: Dispatch<SetStateAction<DimensionLine[]>>; onSync?: (updated: DimensionLine[]) => void }) {
  const editable = useContext(PackEditContext);
  const numeric = new Set<keyof DimensionLine>(["length", "breadth", "height", "qty", "gross_wt", "chargeable_wt", "volume", "total_qty"]);

  const update = (rowIndex: number, column: keyof DimensionLine, val: string) => {
    setRows((current) => {
      const next = current.map((item, index) => {
        if (index !== rowIndex) return item;
        const row = { ...item, [column]: val };
        // PowerBuilder formula: volume = (L * B * H * Q) / 1000000; cwt = (L * B * H * Q) / 6000
        const l = Number(column === "length" ? val : row.length) || 0;
        const b = Number(column === "breadth" ? val : row.breadth) || 0;
        const h = Number(column === "height" ? val : row.height) || 0;
        const q = Number(column === "qty" ? val : row.qty) || 0;
        const gross = Number(column === "gross_wt" ? val : row.gross_wt) || 0;

        if (l > 0 && b > 0 && h > 0 && q > 0) {
          row.volume = ((l * b * h * q) / 1000000).toFixed(3);
          const volWt = (l * b * h * q) / 6000;
          row.chargeable_wt = (gross > 0 ? Math.max(gross, volWt) : volWt).toFixed(2);
        } else if (gross > 0 && !row.chargeable_wt) {
          row.chargeable_wt = gross.toFixed(2);
        }

        if (column === "qty" && (!row.total_qty || row.total_qty === "0")) {
          row.total_qty = val;
        }
        return row;
      });
      onSync?.(next);
      return next;
    });
  };

  const addDimension = () => {
    setRows((current) => {
      const next = [...current, emptyDimension(current.length + 1)];
      onSync?.(next);
      return next;
    });
  };

  const removeDimension = (rowIndex: number) => {
    setRows((current) => {
      const next = current.filter((_, index) => index !== rowIndex).map((item, index) => ({ ...item, sr_no: String(index + 1) }));
      onSync?.(next);
      return next;
    });
  };

  const totals = rows.reduce(
    (acc, row) => ({
      qty: acc.qty + (Number(row.qty) || 0),
      gross: acc.gross + (Number(row.gross_wt) || 0),
      chargeable: acc.chargeable + (Number(row.chargeable_wt) || 0),
      volume: acc.volume + (Number(row.volume) || 0),
    }),
    { qty: 0, gross: 0, chargeable: 0, volume: 0 }
  );

  return (
    <div className="commercial-lines-card rounded-md border bg-card shadow-xs overflow-hidden mt-2">
      {/* Finance Line Actions Header */}
      <div className="finance-line-actions flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/90 border-b border-slate-200">
        <div className="finance-line-actions-left flex flex-wrap items-center gap-2">
          <span className="finance-line-actions-icon p-1 bg-blue-100/70 text-[#00378C] rounded">
            <PackageCheck size={14} />
          </span>
          <span className="finance-line-actions-title font-bold text-xs text-slate-800 uppercase tracking-wide">
            Air Cargo Dimensions Manifest (TF_PACKLIST_DIM)
          </span>
          <span className="finance-line-actions-badge text-[11px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
            {rows.length} {rows.length === 1 ? "line" : "lines"}
          </span>

          {/* Inline KPI Strip */}
          {rows.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 ml-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 font-medium text-blue-900">
                <span className="text-blue-700 font-bold">Qty:</span> {totals.qty}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-medium text-emerald-900">
                <span className="text-emerald-700 font-bold">Gross Wt:</span> {totals.gross.toFixed(2)} kg
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-medium text-indigo-900">
                <span className="text-indigo-700 font-bold">Chg Wt:</span> {totals.chargeable.toFixed(2)} kg
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-medium text-amber-900">
                <span className="text-amber-700 font-bold">Volume:</span> {totals.volume.toFixed(3)} m³
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {editable && (
            <Button
              type="button"
              size="sm"
              onClick={addDimension}
              className="h-7 text-xs font-semibold !bg-[#00378C] !text-white !border-[#002d72] hover:!bg-[#002d72] shadow-xs cursor-pointer"
            >
              <Plus size={13} className="mr-1" /> Add Dimension Line
            </Button>
          )}
        </div>
      </div>

      {/* Finance Table */}
      <div className="commercial-lines-scroll overflow-auto max-h-[360px] min-h-[140px]">
        <table className="finance-lines-table w-full text-xs min-w-[1240px] border-collapse">
          <thead className="sticky top-0 bg-[#00378C] text-white text-[11px] font-bold uppercase tracking-wider shadow-xs z-10 whitespace-nowrap">
            <tr>
              <th className="finance-sticky-col finance-col-no px-2 py-2 text-center w-9 bg-[#00378C] text-white">#</th>
              <th className="px-2 py-2 text-right w-[85px] text-white">Length (cm)</th>
              <th className="px-2 py-2 text-right w-[85px] text-white">Breadth (cm)</th>
              <th className="px-2 py-2 text-right w-[85px] text-white">Height (cm)</th>
              <th className="px-2 py-2 text-right w-[75px] text-white">Qty</th>
              <th className="px-2 py-2 text-right w-[95px] text-white">Gross Wt (kg)</th>
              <th className="px-2 py-2 text-right w-[100px] text-white">Chg Wt (kg)</th>
              <th className="px-2 py-2 text-right w-[95px] text-white">Volume (m³)</th>
              <th className="px-2 py-2 text-right w-[80px] text-white">Total Qty</th>
              <th className="px-2 py-2 text-left min-w-[180px] text-white">Cargo Details</th>
              <th className="px-2 py-2 text-left min-w-[180px] text-white">Prod Description</th>
              <th className="px-2 py-2 text-center w-[50px] text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`transition-colors ${
                  rowIndex % 2 === 1 ? "bg-slate-50/40 hover:bg-blue-50/40" : "bg-white hover:bg-blue-50/40"
                }`}
              >
                <td className="finance-sticky-col finance-col-no px-2 py-1 text-center font-mono text-[11px] font-semibold text-slate-500">
                  {rowIndex + 1}
                </td>
                <td className="px-1.5 py-1 w-[85px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs"
                      type="number"
                      step="any"
                      value={row.length}
                      onChange={(e) => update(rowIndex, "length", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-medium">{row.length || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[85px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs"
                      type="number"
                      step="any"
                      value={row.breadth}
                      onChange={(e) => update(rowIndex, "breadth", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-medium">{row.breadth || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[85px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs"
                      type="number"
                      step="any"
                      value={row.height}
                      onChange={(e) => update(rowIndex, "height", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-medium">{row.height || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[75px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs font-semibold"
                      type="number"
                      value={row.qty}
                      onChange={(e) => update(rowIndex, "qty", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-semibold">{row.qty || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[95px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs font-semibold"
                      type="number"
                      step="0.01"
                      value={row.gross_wt}
                      onChange={(e) => update(rowIndex, "gross_wt", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-semibold">{row.gross_wt || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[100px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs font-semibold text-indigo-700 bg-indigo-50/40"
                      type="number"
                      step="0.01"
                      value={row.chargeable_wt}
                      onChange={(e) => update(rowIndex, "chargeable_wt", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-semibold text-indigo-700">{row.chargeable_wt || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[95px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs text-amber-700 bg-amber-50/40"
                      type="number"
                      step="0.001"
                      value={row.volume}
                      onChange={(e) => update(rowIndex, "volume", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right text-amber-700">{row.volume || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 w-[80px]">
                  {editable ? (
                    <Input
                      className="h-7 text-right text-xs"
                      type="number"
                      value={row.total_qty}
                      onChange={(e) => update(rowIndex, "total_qty", e.target.value)}
                    />
                  ) : (
                    <span className="block text-right font-medium">{row.total_qty || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 min-w-[180px]">
                  {editable ? (
                    <Input
                      className="h-7 text-xs"
                      value={row.cargo_details}
                      onChange={(e) => update(rowIndex, "cargo_details", e.target.value)}
                    />
                  ) : (
                    <span className="block truncate">{row.cargo_details || "-"}</span>
                  )}
                </td>
                <td className="px-1.5 py-1 min-w-[180px]">
                  {editable ? (
                    <Input
                      className="h-7 text-xs"
                      value={row.prod_description}
                      onChange={(e) => update(rowIndex, "prod_description", e.target.value)}
                    />
                  ) : (
                    <span className="block truncate">{row.prod_description || "-"}</span>
                  )}
                </td>
                <td className="px-1 py-1 text-center w-[50px]">
                  {editable ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                      title="Remove dimension"
                      onClick={() => removeDimension(rowIndex)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={12} className="py-8 px-4 text-center text-xs text-muted-foreground">
                  <p className="m-0 text-slate-500 font-medium">No air dimension lines recorded. Click 'Add Dimension Line' to enter cargo dimensions.</p>
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-xs text-slate-900 sticky bottom-0 z-10">
              <tr>
                <td colSpan={4} className="px-2 py-1.5 text-right uppercase tracking-wider text-slate-600 font-bold text-[11px]">
                  Totals:
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-slate-800">
                  {totals.qty}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-emerald-800">
                  {totals.gross.toFixed(2)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-indigo-800">
                  {totals.chargeable.toFixed(2)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono font-bold text-amber-800">
                  {totals.volume.toFixed(3)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
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
    bl_no: lookupText(row, "hawb") || lookupText(row, "doc_ref") || base.bl_no,
    hawb: lookupText(row, "hawb") || base.hawb,
    curr_code: lookupText(row, "curr_code") || base.curr_code,
    ex_rate: lookupText(row, "ex_rate") || base.ex_rate,
  };
}

function setPackField(setPack: (updater: (current: PackForm) => PackForm) => void, field: keyof PackForm, value: string) {
  setPack((current) => {
    const next = { ...current, [field]: value };
    if (field === "charge_wt" || field === "rate") {
      const amount = (Number(next.charge_wt) || 0) * (Number(next.rate) || 0);
      next.amount = amount ? amount.toFixed(3) : "0";
    }
    return next;
  });
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

// async function lookupUoms(companyCode: string, search: string) {
//   const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/lookups/uom", {
//     company_code: companyCode,
//     search,
//   });
//   return (response.data.data || []).map(normalizeLookupRow);
// }

async function lookup(parameter: string, companyCode: string, code2 = "NULL", code3 = "NULL", query = "") {
  return (await freightSelect<LookupRow>({ parameter, code1: companyCode, code2, code3, code4: query || "NULL", number1: 50 })).map(normalizeLookupRow);
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
