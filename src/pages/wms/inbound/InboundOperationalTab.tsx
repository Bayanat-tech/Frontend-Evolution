import {
  CheckCircle2, Plus, RefreshCw, Save, Settings2, Truck, X,   Package, MapPin, Hash, FileText, CalendarDays,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { executeWmsInboundSql, patchWmsInbound, postWmsInbound } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { type FormField, type DropdownOption } from "../../../config/formFields";
import { getInboundTabConfig } from "../../../config/tabConfig";
import {
  type WmsRow,
  value, normalizeRow, sqlEscape, stripUiFields, recalcQuantity, makeColumns,
} from "../../../utils/inboundHelpers";

// ─── types ───────────────────────────────────────────────────────────────────
type Props = {
  job:        WmsRow | null;
  jobNo:      string;
  tab:        string;
  loadingJob: boolean;
};

// ─── component ───────────────────────────────────────────────────────────────
export function InboundOperationalTab({ job, jobNo, tab, loadingJob }: Props) {
  const { user }  = useAuth();
  const { toast } = useToast();
  const prinCode    = value(job || {}, "prin_code");
  const companyCode = user?.company_code || "";

  // ── state ─────────────────────────────────────────────────────────────────
  const [rows, setRows]           = useState<WmsRow[]>([]);
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [sortKey, setSortKey]     = useState(0);
  const [selectedRows, setSelectedRows] = useState<WmsRow[]>([]);

  // add modal
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState<WmsRow>({});
  const [saving, setSaving]       = useState(false);

  // edit modal
  const [editOpen, setEditOpen]   = useState(false);
  const [editForm, setEditForm]   = useState<WmsRow>({});
  const [editSaving, setEditSaving] = useState(false);

  // process modal (clearance / putaway / confirmation)
  const [processOpen, setProcessOpen] = useState(false);
  const [modalNotice, setModalNotice] = useState<string | null>(null);

  // quality clearance form
  const [clearanceForm, setClearanceForm] = useState({
    truck_condition: "", container_condition: "", container_type: "",
    ref_box_temp: "", prod_temp: "", prod_con_acceptance: "",
  });

function SectionHeader({ icon: Icon, label, caption }: { icon: any; label: string; caption: string }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon size={18} />
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</div>
        <div className="text-sm text-muted-foreground">{caption}</div>
      </div>
    </div>
  );
}

  // putaway form
  const [putawayForm, setPutawayForm] = useState({
    site_from: "", site_from_name: "", location_from: "", location_from_name: "",
    site_to: "", site_to_name: "", location_to: "", location_to_name: "",
  });
  const [siteOptions,          setSiteOptions]         = useState<DropdownOption[]>([]);
  const [locationFromOptions,  setLocationFromOptions] = useState<DropdownOption[]>([]);
  const [locationToOptions,    setLocationToOptions]   = useState<DropdownOption[]>([]);
const isManualPutaway = tab === "putway_manual"; // ⚠️ confirm this matches your tabConfig.tsx key
  const config = getInboundTabConfig(tab);

  // ── lookup props factory ──────────────────────────────────────────────────
  const getLookupProps = (field: FormField, isEditMode = false) => {
    const formData    = isEditMode ? editForm : addForm;
    const setFormData = isEditMode ? setEditForm : setAddForm;
    const lookupType = field.lookup as "product" | "container" | "country" | "manufacturer" | "site" | "location";

    switch (lookupType) {
    case "product":
  return {
    valueField:    "PROD_CODE",
    displayFields: ["PROD_CODE", "PROD_NAME"],
    columns: [
      { field: "PROD_CODE", header: "Product Code" },
      { field: "PROD_NAME", header: "Product Name" },
      { field: "UOM_CODE",  header: "UOM" },
    ],
    loadOptions: async () => {
      if (tab === "packing_details" && !formData.container_no)
        throw new Error("Please select a Container No. first before selecting a product.");
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT * FROM MS_PRODUCT
                  WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
                    AND PRIN_CODE    = '${sqlEscape(prinCode)}'
                  ORDER BY PROD_NAME`,
      });
      return Array.isArray(res.data?.data) ? res.data.data
           : Array.isArray(res.data)        ? res.data : [];
    },
    onChange: (val: string, row: Record<string, unknown> | null) => {
      const uppp     = Number(row?.["UPPP"]      ?? row?.["uppp"]      ?? 1);
      const upp      = Number(row?.["UPP"]       ?? row?.["upp"]       ?? 0); // ← new
      const uomCount = Number(row?.["UOM_COUNT"] ?? row?.["uom_count"] ?? 1);
      const pUom     = String(row?.["P_UOM"]  ?? row?.["p_uom"]  ?? "");
      const lUom     = String(row?.["L_UOM"]     ?? row?.["l_uom"]     ?? "");
      const prodName = String(row?.["PROD_NAME"] ?? row?.["prod_name"] ?? ""); // ← new
  const rawPo = row?.["PO_NO"] ?? row?.["po_no"];
  const poNo = rawPo == null || rawPo === "null" || rawPo === "" ? null : String(rawPo);

      setFormData((cur:any) => {
        const qtyPuom = Number(cur.qty_puom ?? 0);
        const qtyLuom = uomCount <= 1 ? 0 : Number(cur.qty_luom ?? 0);
        const quantity = uomCount <= 1 ? qtyPuom + qtyLuom : qtyPuom * uppp + qtyLuom;
    return { ...cur, prod_code: val, prod_name: prodName, p_uom: pUom, l_uom: lUom, uppp, upp, uom_count: uomCount, qty_luom: uomCount <= 1 ? 0 : cur.qty_luom, quantity, po_no: poNo,     container_no: val,
 };
      });
    },
  };

case "site":
  return {
    valueField:    "SITE_CODE",
    displayFields: ["SITE_CODE", "SITE_NAME"],
    columns: [
      { field: "SITE_CODE", header: "Site Code" },
      { field: "SITE_NAME", header: "Site Name" },
    ],
    loadOptions: async () => {
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT SITE_CODE, SITE_NAME FROM MS_SITE
                  WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
                  ORDER BY SITE_CODE`,
      });
      return Array.isArray(res.data?.data) ? res.data.data
           : Array.isArray(res.data)        ? res.data : [];
    },
    onChange: (val: string, row: Record<string, unknown> | null) =>
      setFormData((cur:any) => ({
        ...cur,
        site_code: val,
        site_code_display: row ? `${row["SITE_CODE"] ?? ""} - ${row["SITE_NAME"] ?? ""}` : "",
        location_code: "", location_code_display: "", // reset dependent field
      })),
  };

case "location":
  return {
    valueField:    "LOCATION_CODE",
    displayFields: ["LOCATION_CODE"],
    columns: [
      { field: "LOCATION_CODE", header: "Location Code" },
      { field: "SITE_CODE",     header: "Site Code" },
    ],
    loadOptions: async () => {
      if (!formData.site_code)
        throw new Error("Please select a Site Code first before selecting a Location.");
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT * FROM MS_LOCATION
                  WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
                    AND SITE_CODE    = '${sqlEscape(String(formData.site_code ?? ""))}'
                  ORDER BY LOCATION_CODE`,
      });
      return Array.isArray(res.data?.data) ? res.data.data
           : Array.isArray(res.data)        ? res.data : [];
    },
    onChange: (val: string, row: Record<string, unknown> | null) =>
      setFormData((cur:any) => ({
        ...cur,
        location_code: val,
        location_code_display: row ? String(row["LOCATION_CODE"] ?? "") : val,
      })),
  };
      case "container": {
        const cacheKey = `wms_containers_${jobNo}_v2`;
        return {
          valueField:    "CONTAINER_NO",
          displayFields: ["CONTAINER_NO"],
          columns: [
            { field: "CONTAINER_NO", header: "Container No" },
            { field: "VEHICLE_NO",   header: "Vehicle No" },
            { field: "VESSEL_NAME",  header: "Vessel Name" },
            { field: "SEAL_NO",      header: "Seal No" },
            { field: "PO_NO",        header: "PO No" },
          ],
          loadOptions: async () => {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) { try { return JSON.parse(cached); } catch { /* fall through */ } }
            const res = await api.post("/api/wms/inbound/executeRawSql", {
              raw_sql: `SELECT CONTAINER_NO, VEHICLE_NO, VESSEL_NAME, SEAL_NO, PO_NO
                        FROM TI_CONTAINER
                        WHERE JOB_NO    = '${sqlEscape(jobNo)}'
                          AND PRIN_CODE = '${sqlEscape(prinCode)}'
                        ORDER BY CONTAINER_NO`,
            });
            const data = Array.isArray(res.data?.data) ? res.data.data
                       : Array.isArray(res.data)        ? res.data : [];
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
            return data;
          },
          onChange: (val: string, row: Record<string, unknown> | null) =>
            setFormData((cur:any) => ({
              ...cur,
              container_no: val,
              // po_no: String(row?.["PO_NO"] ?? row?.["po_no"] ?? null),
             po_no: row?.["PO_NO"] ?? row?.["po_no"] ?? null,
            })),
        };
      }

      // case "country":
      //   return {
      //     valueField:    "COUNTRY_CODE",
      //     displayFields: ["COUNTRY_CODE", "COUNTRY_NAME"],
      //     columns: [
      //       { field: "COUNTRY_CODE", header: "Code" },
      //       { field: "COUNTRY_NAME", header: "Country" },
      //     ],
      //     loadOptions: async () => {
      //       const res = await api.post("/api/wms/inbound/executeRawSql", {
      //         raw_sql: `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`,
      //       });
      //       return Array.isArray(res.data?.data) ? res.data.data
      //            : Array.isArray(res.data)        ? res.data : [];
      //     },
      //     onChange: (val: string, row: Record<string, unknown> | null) =>
      //       setFormData((cur:any) => ({
      //         ...cur,
      //         country_origin: val,
      //         country_origin_display: row ? `${row["COUNTRY_CODE"] ?? ""} - ${row["COUNTRY_NAME"] ?? ""}` : "",
      //       })),
      //   };

      case "manufacturer":
        return {
          valueField:    "MANU_CODE",
          displayFields: ["MANU_CODE", "MANU_NAME"],
          columns: [
            { field: "MANU_CODE", header: "Code" },
            { field: "MANU_NAME", header: "Manufacturer" },
          ],
          loadOptions: async () => {
            const res = await api.post("/api/wms/inbound/executeRawSql", {
              raw_sql: `SELECT MANU_CODE, MANU_NAME FROM MS_MANUFACTURER
                        WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
                        ORDER BY MANU_NAME`,
            });
            return Array.isArray(res.data?.data) ? res.data.data
                 : Array.isArray(res.data)        ? res.data : [];
          },
          onChange: (val: string, row: Record<string, unknown> | null) =>
            setFormData((cur:any) => ({
              ...cur,
              manufacturer: val,
              manufacturer_display: row ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}` : "",
            })),
        };

      default:
        return null;
    }
  };

  // ── load rows ────────────────────────────────────────────────────────────
  const loadRows = useCallback(async () => {
    if (!config || loadingJob || !prinCode) return;
    setLoading(true);
    try {
      const data = await executeWmsInboundSql(
        config.sql({ companyCode, jobNo, prinCode }),
      );
setRows(data.map(normalizeRow).filter((row) =>
  tab !== "putway_details" || String(value(row, "allocated") || "").toUpperCase() !== "Y"
));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to load ${config?.title}`);
    } finally { setLoading(false); }
  }, [tab, jobNo, prinCode, loadingJob, companyCode]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // ── open modals ──────────────────────────────────────────────────────────
  const openAddModal = () => {
    setAddForm({ job_no: jobNo, prin_code: prinCode, company_code: companyCode });
    setAddOpen(true);
  };

  const openPutawayModal = async () => {
    try {
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT SITE_CODE, SITE_NAME FROM MS_SITE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY SITE_CODE`,
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setSiteOptions(data.map((r: Record<string, unknown>) => ({
        value: String(r["SITE_CODE"] ?? r["site_code"] ?? ""),
        label: `${r["SITE_CODE"] ?? r["site_code"]} - ${r["SITE_NAME"] ?? r["site_name"]}`,
      })));
    } catch { /* ignore */ }
    setPutawayForm({ site_from: "", site_from_name: "", location_from: "", location_from_name: "", site_to: "", site_to_name: "", location_to: "", location_to_name: "" });
    setLocationFromOptions([]);
    setLocationToOptions([]);
    setModalNotice(null);
    setProcessOpen(true);
  };

  const loadLocations = async (siteCode: string, target: "from" | "to") => {
    if (!siteCode) { target === "from" ? setLocationFromOptions([]) : setLocationToOptions([]); return; }
    try {
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT * FROM MS_LOCATION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND SITE_CODE = '${sqlEscape(siteCode)}' ORDER BY LOCATION_CODE`,
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      const opts = data.map((r: Record<string, unknown>) => ({
        value: String(r["LOCATION_CODE"] ?? r["location_code"] ?? ""),
        label: String(r["LOCATION_CODE"] ?? r["location_code"]),
      }));
      target === "from" ? setLocationFromOptions(opts) : setLocationToOptions(opts);
    } catch { /* ignore */ }
  };

  // ── save add ─────────────────────────────────────────────────────────────
  const saveAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!config?.addEndpoint) return;
    setModalNotice(null);

    if (tab === "packing_details") {
      if (!addForm.container_no)                       { setModalNotice("Container No. is required."); return; }
      if (!addForm.prod_code)                          { setModalNotice("Product / SKU is required."); return; }
      if (!addForm.qty_puom || Number(addForm.qty_puom) <= 0) { setModalNotice("Quantity (Primary) must be > 0."); return; }
      if (addForm.qty_luom === undefined || addForm.qty_luom === "") { setModalNotice("Quantity (Lowest) is required."); return; }
    
    } else if (isManualPutaway) {
  if (!addForm.container_no)   { setModalNotice("Container No. is required."); return; }
  if (!addForm.prod_code)      { setModalNotice("Product / SKU is required."); return; }
  if (!addForm.site_code)      { setModalNotice("Site Code is required."); return; }
  if (!addForm.location_code)  { setModalNotice("Location Code is required."); return; }
  if (!addForm.qty_puom || Number(addForm.qty_puom) <= 0) { setModalNotice("Quantity 1 (Primary) must be > 0."); return; }
} 
   else {
      const missing = (config?.addFields || []).find((f:any) => f.required && !String(addForm[f.name] || "").trim());
      if (missing) { setModalNotice(`${missing.label} is required`); return; }
    }

setSaving(true);
try {
  if (config.addEndpoint === "shipment") sessionStorage.removeItem(`wms_containers_${jobNo}_v2`);

  if (isManualPutaway) {
    const now      = new Date().toISOString();
    const quantity = Number(addForm.quantity ?? 0);
    const qtyPuom  = Number(addForm.qty_puom ?? 0);
    const qtyLuom  = Number(addForm.qty_luom ?? 0);
    const pUom     = String(addForm.p_uom || "");
    const lUom     = String(addForm.l_uom || "");
    const userId   = String(user?.USERNAME || user?.username || ""); // ⚠️ confirm the real field on your auth user object

    await postWmsInbound(config.addEndpoint, {
      COMPANY_CODE: companyCode,
      PRIN_CODE:    prinCode,
      JOB_NO:       jobNo,
      TXN_TYPE:     "PUT",
      TXN_DATE:     now,
      PACKDET_NO:   0,
      KEY_NUMBER:   "",
      PROD_CODE:    addForm.prod_code,
      SITE_CODE:    addForm.site_code,
      LOCATION_CODE: addForm.location_code,
      QUANTITY:     quantity,
      QTY_PUOM:     qtyPuom,
      QTY_LUOM:     qtyLuom,
      P_UOM:        pUom,
      L_UOM:        lUom,
      QTY_CONFIRMED:  quantity,   // mirrors old payload: confirmed qty pre-filled, CONFIRMED flag stays "N" until job confirmation step
      PQTY_CONFIRMED: qtyPuom,
      LQTY_CONFIRMED: qtyLuom,
      PUOM_CONFIRMED: pUom,
      LUOM_CONFIRMED: lUom,
      UPP:          Number(addForm.upp ?? 0),
      UPPP:         Number(addForm.uppp ?? 1),
      CONFIRM_DATE: null,
      CUST_CODE:    "",
      ORDER_NO:     "",
      VESSEL_NAME:  "",
      CONTAINER_NO: addForm.container_no || "",
      SEAL_NO:      "",
      PO_NO: addForm.po_no || null,   // empty string → null
      BL_NO:        "",    
      DOC_REF:      addForm.doc_ref || "",
      LOT_NO:       addForm.lot_no || "",
      PALLET_ID:    addForm.pallet_id || "",
      MANU_CODE:    "",
      CURR_CODE:    "",
      EX_RATE:      0,
      UNIT_PRICE:   0,
      SELECTED:     "Y",
      ALLOCATED:    "Y",
      CONFIRMED:    "N",
      USER_ID:      userId,
      USER_DT:      now,
      ORIGIN_COUNTRY: "",
      SHELF_LIFE_DAYS: Number(addForm.shelf_life_days ?? 0),
      BATCH_NO:     addForm.batch_no || "",
      GROSS_WT:     0,
      NET_VOLUME:   0,
      MFG_DATE:        addForm.mfg_date || null,        // ⚠️ not present in your old reference payload — confirm these 3 columns actually exist on the table
      EXPIRY_DATE:     addForm.expiry_date || null,
      SHELF_LIFE_DATE: addForm.shelf_life_date || null,
      updated_by:   userId, // backend expects this one lowercase, unlike everything else
    });
  } else {
    await postWmsInbound(config.addEndpoint, {
      ...stripUiFields(addForm), job_no: jobNo, prin_code: prinCode, company_code: companyCode,
    });
  }

  setAddOpen(false);
  setModalNotice(null);
  toast.success(`${config.title} added successfully`);
  await loadRows();
} catch (error) {
  setModalNotice(error instanceof Error ? error.message : `Unable to add ${config?.title}`);
} finally { setSaving(false); }
  };

  // ── save edit ────────────────────────────────────────────────────────────
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    setModalNotice(null);

    if (tab === "packing_details") {
      if (!editForm.container_no)                         { setModalNotice("Container No. is required."); return; }
      if (!editForm.prod_code)                            { setModalNotice("Product / SKU is required."); return; }
      if (!editForm.qty_puom || Number(editForm.qty_puom) <= 0) { setModalNotice("Quantity (Primary) is required."); return; }
    } else if (tab === "receiving_details") {
      const q1 = Number(editForm.qty1_arrived), q2 = Number(editForm.qty2_arrived);
      if (isNaN(q1) || isNaN(q2)) { setModalNotice("Both quantity fields must be numbers."); return; }
      if (q1 <= 0 && q2 <= 0)     { setModalNotice("At least one quantity must be > 0."); return; }
    }

    setEditSaving(true);
    try {
      if (tab === "packing_details") {
        await api.put(
          `/api/wms/inbound/packing_details/${encodeURIComponent(String(editForm.packdet_no || ""))}?prin_code=${encodeURIComponent(prinCode)}&job_no=${encodeURIComponent(jobNo)}`,
          { ...stripUiFields(editForm), company_code: companyCode },
        );
      }
      else if (tab === "receiving_details") {
        await api.put(
          `/api/wms/inbound/packing_details/receiving?prin_code=${encodeURIComponent(prinCode)}&job_no=${encodeURIComponent(jobNo)}&packdet_no=${encodeURIComponent(String(editForm.packdet_no))}`,
          { qty1_arrived: Number(editForm.qty1_arrived), qty2_arrived: Number(editForm.qty2_arrived) },
        );
      }
      setEditOpen(false);
      setModalNotice(null);
      toast.success(`${tab === "packing_details" ? "Packing detail" : "Receiving detail"} updated successfully`);
      await loadRows();
    } catch (error) {
      setModalNotice(error instanceof Error ? error.message : "Unable to update record");
    } finally { setEditSaving(false); }
  };

  if (!config) return (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">This tab is not configured yet.</CardContent></Card>
  );

  // ── action button ────────────────────────────────────────────────────────
  const getActionButton = () => {
    switch (tab) {
      case "quality_clearance":
        return <Button size="sm" variant="outline" onClick={() => setProcessOpen(true)} disabled={selectedRows.length === 0}><Settings2 size={14} /> Process Clearance</Button>;
      case "putway_details":
        return <Button size="sm" variant="outline" onClick={openPutawayModal} disabled={selectedRows.length === 0}><Truck size={14} /> Process Putaway</Button>;
      case "job_confirmation":
        return <Button size="sm" variant="outline" onClick={() => setProcessOpen(true)} disabled={selectedRows.length === 0}><CheckCircle2 size={14} /> Process Confirm Selected</Button>;
      case "receiving_details":
        return null;
      default:
        return config.addFields && config.addEndpoint
          ? <Button size="sm" variant="outline" onClick={openAddModal}><Plus size={14} /> {config.addLabel || `Add ${config.title}`}</Button>
          : null;
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {getActionButton()}
      <Button size="sm" variant="outline" onClick={loadRows}><RefreshCw size={14} /> Refresh</Button>
    </div>
  );

const handleDelete = async (row: WmsRow) => {
  if (!confirm("Delete this record? This cannot be undone.")) return;
  try {
    await api.post("/api/wms/inbound/packing_details/delete", {
      packing_details: [{ packdet_no: Number(value(row, "packdet_no")) }],
      prin_code:    prinCode,
      job_no:       jobNo,
      company_code: companyCode,
    });
    // remove instantly from local state
    setRows((prev) => prev.filter((r) => value(r, "packdet_no") !== value(row, "packdet_no")));
    toast.success("Record deleted successfully");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Delete failed");
  }
};
  const columns = makeColumns(
    config.columns,
    tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation",
    (tab === "packing_details" || tab === "receiving_details")
      ? (row:any) => {
          if (tab === "packing_details") {
            setEditForm({ ...row, uom_count: Number(row.uom_count ?? 1), uppp: Number(row.uppp ?? 1), qty_puom: Number(row.qty_puom ?? 0), qty_luom: Number(row.qty_luom ?? 0), quantity: Number(row.quantity ?? 0) });
          } else {
setEditForm({
  packdet_no: row.packdet_no,
  prod_name: row.prod_name,
  batch_no: row.batch_no,
  lot_no: row.lot_no,
  po_no: row.po_no,
  doc_ref: row.doc_ref,
  qty_luom: Number(row.qty_luom ?? 0),        // ← add this
  qty1_arrived: Number(row.qty1_arrived ?? row.qty_arrived ?? 0),
  qty2_arrived: Number(row.qty2_arrived ?? 0),
});          }
          setEditOpen(true);
        }
      : undefined,
       tab === "packing_details" ? handleDelete : undefined,
       
  );
const renderManualPutawaySections = () => {
  const containerLp = getLookupProps({ name: "container_no",  lookup: "container" } as any);
  const productLp   = getLookupProps({ name: "prod_code",     lookup: "product"   } as any);
  const siteLp       = getLookupProps({ name: "site_code",     lookup: "site"      } as any);
  const locationLp   = getLookupProps({ name: "location_code", lookup: "location"  } as any);

  const uomDetails = addForm.p_uom
    ? `${addForm.p_uom}${addForm.uppp ? ` × ${addForm.uppp}` : ""}${Number(addForm.uom_count) > 1 && addForm.l_uom ? ` + ${addForm.l_uom}` : ""}`
    : "—";

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <SectionHeader icon={Package} label="Product Information" caption="Container, SKU and pallet details" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Container No. <strong className="text-destructive">*</strong></span>
            <LookupField label="Container No." compact value={String(addForm.container_no || "")} displayValue={String(addForm.container_no || "")}
              valueField={containerLp!.valueField} displayFields={containerLp!.displayFields}
              columns={containerLp!.columns} loadOptions={containerLp!.loadOptions} onChange={containerLp!.onChange} />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Product / SKU <strong className="text-destructive">*</strong></span>
            <LookupField label="Product / SKU" compact value={String(addForm.prod_code || "")} displayValue={String(addForm.prod_code || "")}
              valueField={productLp!.valueField} displayFields={productLp!.displayFields}
              columns={productLp!.columns} loadOptions={productLp!.loadOptions} onChange={productLp!.onChange} />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Product Name</span>
            <Input disabled value={String(addForm.prod_name || "")} className="bg-muted text-muted-foreground" />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Pallet ID</span>
            <Input value={String(addForm.pallet_id || "")} onChange={(e) => setAddForm((c) => ({ ...c, pallet_id: e.target.value }))} />
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        <SectionHeader icon={Hash} label="Quantity & UOM" caption="Primary, lowest unit and total quantity" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Quantity 1 (Primary) <strong className="text-destructive">*</strong></span>
            <Input type="number" min="0" value={String(addForm.qty_puom ?? "")}
              onChange={(e) => setAddForm((c) => ({ ...c, ...recalcQuantity(c, "qty_puom", e.target.value) }))} />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Quantity 2 (Lowest)</span>
            <Input type="number" min="0" disabled={Number(addForm.uom_count ?? 1) <= 1} value={String(addForm.qty_luom ?? "")}
              onChange={(e) => setAddForm((c) => ({ ...c, ...recalcQuantity(c, "qty_luom", e.target.value) }))} />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Total Quantity</span>
            <Input type="number" disabled value={String(addForm.quantity ?? 0)} className="bg-muted text-muted-foreground" />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">UOM Details</span>
            <Input disabled value={uomDetails} className="bg-muted text-muted-foreground" />
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        <SectionHeader icon={MapPin} label="Putaway Location" caption="Destination site and location" />
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Site Code <strong className="text-destructive">*</strong></span>
            <LookupField label="Site Code" compact value={String(addForm.site_code || "")} displayValue={String(addForm.site_code_display || "")}
              valueField={siteLp!.valueField} displayFields={siteLp!.displayFields}
              columns={siteLp!.columns} loadOptions={siteLp!.loadOptions} onChange={siteLp!.onChange} />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Location Code <strong className="text-destructive">*</strong></span>
            <LookupField label="Location Code" compact value={String(addForm.location_code || "")} displayValue={String(addForm.location_code_display || "")}
              valueField={locationLp!.valueField} displayFields={locationLp!.displayFields}
              columns={locationLp!.columns} loadOptions={locationLp!.loadOptions} onChange={locationLp!.onChange} />
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        <SectionHeader icon={FileText} label="Batch & References" caption="Traceability and order references" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Batch No.</span>
            <Input value={String(addForm.batch_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, batch_no: e.target.value }))} /></label>
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Lot No.</span>
            <Input value={String(addForm.lot_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, lot_no: e.target.value }))} /></label>
          <label className="field"><span className="text-xs font-medium text-muted-foreground">PO No.</span>
            <Input value={String(addForm.po_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, po_no: e.target.value }))} /></label>
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Doc Ref.</span>
            <Input value={String(addForm.doc_ref || "")} onChange={(e) => setAddForm((c) => ({ ...c, doc_ref: e.target.value }))} /></label>
        </div>
      </div>

      <div className="grid gap-3">
        <SectionHeader icon={CalendarDays} label="Dates & Shelf Life" caption="Manufacturing, expiry and shelf life" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Manufacturing Date</span>
            <Input type="date" value={String(addForm.mfg_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, mfg_date: e.target.value }))} /></label>
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Expiry Date</span>
            <Input type="date" value={String(addForm.expiry_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, expiry_date: e.target.value }))} /></label>
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Shelf Life (Date)</span>
            <Input type="date" value={String(addForm.shelf_life_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, shelf_life_date: e.target.value }))} /></label>
          <label className="field"><span className="text-xs font-medium text-muted-foreground">Shelf Life Days</span>
            <Input type="number" min="0" value={String(addForm.shelf_life_days ?? "")} onChange={(e) => setAddForm((c) => ({ ...c, shelf_life_days: e.target.value }))} /></label>
        </div>
      </div>
    </div>
  );
};
  // ── field renderer (shared between add / edit modals) ───────────────────
  const renderField = (field: FormField, formData: WmsRow, setData: (u: (c: WmsRow) => WmsRow) => void, isEdit = false) => {
    if (field.lookup) {
      const lp = getLookupProps(field, isEdit);
      if (!lp) return null;
      return (
        <LookupField
          label={field.label} compact
          value={String(formData[field.name] || "")}
          displayValue={String(formData[`${field.name}_display`] || "")}
          valueField={lp.valueField}
          displayFields={lp.displayFields}
          columns={lp.columns}
          loadOptions={lp.loadOptions}
          onChange={isEdit
            ? (val, row) => {
                if      (field.name === "prod_code")     setData((c) => ({ ...c, prod_code:   val, uom: row ? String(row["UOM_CODE"] ?? c.uom ?? "") : String(c.uom ?? "") }));
                else if (field.name === "container_no")  setData((c) => ({ ...c, container_no: val }));
                else if (field.name === "manufacturer")  setData((c) => ({ ...c, manufacturer: val, manufacturer_display: row ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}` : "" }));
              }
            : lp.onChange
          }
        />
      );
    }
    if (field.dropdown && field.dropdown.length > 0) {
      return (
        <Select value={String(formData[field.name] || "")} onChange={(e) => setData((c) => ({ ...c, [field.name]: e.target.value }))}>
          <option value="">— Select {field.label} —</option>
          {field.dropdown.map((opt:any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </Select>
      );
    }
    if (field.name === "qty_puom") return <Input type="number" min="0" value={String(formData.qty_puom ?? "")} onChange={(e) => setData((c) => ({ ...c, ...recalcQuantity(c, "qty_puom", e.target.value) }))} />;
    if (field.name === "qty_luom") return <Input type="number" min="0" disabled={Number(formData.uom_count ?? 1) <= 1} value={String(formData.qty_luom ?? "")} onChange={(e) => setData((c) => ({ ...c, ...recalcQuantity(c, "qty_luom", e.target.value) }))} />;
    if (field.disabled || field.name === "quantity") return <Input type="number" disabled value={String(formData.quantity ?? 0)} className="bg-muted text-muted-foreground" />;
    return <Input type={field.type || "text"} value={String(formData[field.name] || "")} onChange={(e) => setData((c) => ({ ...c, [field.name]: e.target.value }))} />;
  };

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <section className="grid gap-3">
      <DataTable
        key={sortKey}
        columns={columns} data={rows}
        title={loading ? "Loading" : `${rows.length} Rows`}
        subtitle={config.title} searchValue={query} onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading || loadingJob} height="calc(100vh - 365px)"
        minWidth={config.minWidth} density="grid" enablePagination pageSize={75}
        toolbar={toolbar}
        rowClassName={
  tab === "quality_clearance"
    ? (row) => String(value(row as WmsRow, "clearance") || "").toUpperCase() === "Y"
        ? "opacity-50 pointer-events-none bg-muted/40"
        : ""
    : undefined
}
        getRowId={(row, index) => `${tab}_${value(row, "packdet_no") || value(row, "container_no") || value(row, "key_number") || index}`}
onRowSelectionChange={
  (tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation")
    ? (selected) => {
        if (tab === "quality_clearance") {
          // filter out rows already cleared
          setSelectedRows(selected.filter(
            (r) => String(value(r, "clearance") || "").toUpperCase() !== "Y"
          ));
        } else {
          setSelectedRows(selected);
        }
      }
    : undefined
}
      />

      {/* ── Add Modal ── */}
      <Dialog wide open={addOpen} title={config.addLabel || `Add ${config.title}`}
        description={`Fill in the details to add a new ${config.title.toLowerCase()} record.`}
        onClose={() => setAddOpen(false)}
      >
        <form className="grid gap-2" onSubmit={saveAdd}>
          {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
          {isManualPutaway ? renderManualPutawaySections() : (
  <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
    {(config.addFields ?? []).map((field:any) => (
      <label key={field.name} className={field.name === "remarks" || field.name === "description1" ? "field col-span-2 md:col-span-3" : "field"}>
        <span className="text-xs font-medium text-muted-foreground">
          {field.label}{field.required && <strong className="text-destructive"> *</strong>}
        </span>
        {renderField(field, addForm, setAddForm, false)}
      </label>
    ))}
  </div>
)}
          {/* <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
            {(config.addFields ?? []).map((field:any) => (
              <label key={field.name} className={field.name === "remarks" || field.name === "description1" ? "field col-span-2 md:col-span-3" : "field"}>
                <span className="text-xs font-medium text-muted-foreground">
                  {field.label}{field.required && <strong className="text-destructive"> *</strong>}
                </span>
                {renderField(field, addForm, setAddForm, false)}
              </label>
            ))}
          </div> */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}><X size={15} /> Cancel</Button>
            <Button disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Edit Modal (packing & receiving) ── */}
      {(tab === "packing_details" || tab === "receiving_details") && (
        <Dialog wide open={editOpen}
          title={tab === "packing_details" ? "Edit Packing Details" : "Edit Receiving Quantity"}
          description={tab === "packing_details" ? "Update the packing detail record." : "Update the arrived quantities for this product."}
          onClose={() => { setEditOpen(false); setModalNotice(null); }}
        >
          <form className="grid gap-2" onSubmit={saveEdit}>
            {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}

            {tab === "packing_details" ? (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                {(config.addFields ?? []).map((field:any) => (
                  <label key={field.name} className={field.name === "remarks" || field.name === "description1" ? "field col-span-2 md:col-span-3" : "field"}>
                    <span className="text-xs font-medium text-muted-foreground">
                      {field.label}{field.required && <strong className="text-destructive"> *</strong>}
                    </span>
                    {renderField(field, editForm, setEditForm, true)}
                  </label>
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 gap-3 text-sm">
                  {(["prod_name", "batch_no", "lot_no", "po_no", "doc_ref"] as const).map((k) => (
                    <div key={k}>
                      <span className="block text-xs text-muted-foreground capitalize">{k.replace("_", " ")}</span>
                      <span className="font-medium">{String(editForm[k] ?? "-")}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span className="text-xs font-medium text-muted-foreground">Quantity (Primary) <strong className="text-destructive">*</strong></span>
                    <Input type="number" min="0" step="1" value={Number(editForm.qty1_arrived ?? 0)}
                      onChange={(e) => setEditForm((c:any) => ({ ...c, qty1_arrived: e.target.value === "" ? 0 : Number(e.target.value) }))} />
                  </label>
                  <label className="field">
                    <span className="text-xs font-medium text-muted-foreground">Quantity (Secondary)</span>
                    <Input type="number" min="0" step="1" value={Number(editForm.qty2_arrived ?? 0)}
                         disabled={Number(editForm.qty_luom ?? 0) === 0}
                      onChange={(e) => setEditForm((c:any) => ({ ...c, qty2_arrived: e.target.value === "" ? 0 : Number(e.target.value) }))} />
                  </label>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Quantity: {(Number(editForm.qty1_arrived) + Number(editForm.qty2_arrived)).toFixed(0)}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}><X size={15} /> Cancel</Button>
              <Button disabled={editSaving} type="submit"><Save size={15} /> {editSaving ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ── Quality Clearance Modal ── */}
      {tab === "quality_clearance" && (
        <Dialog wide open={processOpen} title="Process Quality Clearance"
          description={`Processing ${selectedRows.length} selected row(s)`}
          onClose={() => { setProcessOpen(false); setModalNotice(null); }}
        >
          <form className="grid gap-3" onSubmit={async (e) => {
            e.preventDefault();
            setModalNotice(null);
            if (!clearanceForm.prod_con_acceptance.trim()) { setModalNotice("Product Condition Acceptance is required."); return; }
            setSaving(true);
            try {
              await Promise.all(selectedRows.map((r) =>
                api.put("/api/wms/inbound/packing_details/clearance", {
                  company_code: companyCode, prin_code: prinCode, job_no: jobNo,
                  packdet_no: Number(value(r, "packdet_no")), clearance: "Y",
                  ...clearanceForm,
                })
              ));
              setProcessOpen(false); setModalNotice(null); setSelectedRows([]);
              setClearanceForm({ truck_condition: "", container_condition: "", container_type: "", ref_box_temp: "", prod_temp: "", prod_con_acceptance: "" });
              toast.success("Quality clearance processed successfully");
              await loadRows();
            } catch (error) {
              setModalNotice(error instanceof Error ? error.message : "Process failed");
            } finally { setSaving(false); }
          }}>
            {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
            {selectedRows.length === 0
              ? <p className="text-sm text-muted-foreground">No rows selected. Close and select rows from the table.</p>
              : (
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["truck_condition",     "Truck Condition"],
                    ["container_condition", "Container Condition"],
                    ["container_type",      "Container Type"],
                    ["ref_box_temp",        "Refer Box Temperature"],
                    ["prod_temp",           "Product Temperature"],
                    ["prod_con_acceptance", "Product Condition Acceptance", true],
                  ] as [keyof typeof clearanceForm, string, boolean?][]).map(([k, label, req]) => (
                    <label key={k} className="field">
                      <span className="text-xs font-medium text-muted-foreground">
                        {label}{req && <strong className="text-destructive"> *</strong>}
                      </span>
                      <Input value={clearanceForm[k]} placeholder={label}
                        onChange={(e) => setClearanceForm((c:any) => ({ ...c, [k]: e.target.value }))} />
                    </label>
                  ))}
                </div>
              )
            }
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setProcessOpen(false); setModalNotice(null); }}>Cancel</Button>
              <Button type="submit" disabled={saving || selectedRows.length === 0}>
                <CheckCircle2 size={15} /> {saving ? "Processing..." : "Process Quality Clearance"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ── Putaway Modal ── */}
      {tab === "putway_details" && (
        <Dialog wide open={processOpen} title="Process Putaway"
          description={`Selected Items: ${selectedRows.length}`}
          onClose={() => { setProcessOpen(false); setModalNotice(null); }}
        >
          <form className="grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            setModalNotice(null);
            if (!putawayForm.site_from) { setModalNotice("Site From is required."); return; }
            setSaving(true);
            try {
              await api.put(
                `/api/wms/inbound/putway_details/${encodeURIComponent(jobNo)}?prin_code=${encodeURIComponent(prinCode)}`,
                { site_from: putawayForm.site_from, site_to: putawayForm.site_from, location_from: putawayForm.location_from, location_to: putawayForm.location_to, packdet_no: selectedRows.map((r) => value(r, "packdet_no")) },
              );
              setProcessOpen(false); setModalNotice(null); setSelectedRows([]);
              setPutawayForm({ site_from: "", site_from_name: "", location_from: "", location_from_name: "", site_to: "", site_to_name: "", location_to: "", location_to_name: "" });
              toast.success("Putaway processed successfully");
              await loadRows();
            } catch (error) {
              setModalNotice(error instanceof Error ? error.message : "Putaway failed");
            } finally { setSaving(false); }
          }}>
            {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Site From <strong className="text-destructive">*</strong></span>
                <Select value={putawayForm.site_from} onChange={(e) => { const v = e.target.value; setPutawayForm((c) => ({ ...c, site_from: v, location_from: "", location_from_name: "", location_to: "", location_to_name: "" })); void loadLocations(v, "from"); void loadLocations(v, "to"); }}>
                  <option value="">— Select Site —</option>
                  {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Location From <strong className="text-destructive">*</strong></span>
                <Select value={putawayForm.location_from} disabled={!putawayForm.site_from} onChange={(e) => setPutawayForm((c) => ({ ...c, location_from: e.target.value }))}>
                  <option value="">— Select Location —</option>
                  {locationFromOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Site To (Auto-set to match Site From)</span>
                <Select value={putawayForm.site_from} disabled>
                  <option value="">—</option>
                  {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                {putawayForm.site_from && <span className="mt-1 text-[11px] italic text-primary">Note: Site To is automatically set to match Site From ({putawayForm.site_from})</span>}
              </label>
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Location To <strong className="text-destructive">*</strong></span>
                <Select value={putawayForm.location_to} disabled={!putawayForm.site_from} onChange={(e) => setPutawayForm((c) => ({ ...c, location_to: e.target.value }))}>
                  <option value="">— Select Location —</option>
                  {locationToOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>
            </div>
            <p className="text-sm text-muted-foreground">Selected Items: {selectedRows.length}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setProcessOpen(false); setModalNotice(null); }}>Cancel</Button>
              <Button type="submit" disabled={saving || selectedRows.length === 0}>
                <Settings2 size={15} /> {saving ? "Processing..." : "Process Putaway"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ── Job Confirmation Modal ── */}
      {tab === "job_confirmation" && (
        <Dialog open={processOpen} compact title="Process Job Confirmation"
          description={`Processing ${selectedRows.length} selected row(s)`}
          onClose={() => setProcessOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setProcessOpen(false)}>Close</Button>
              <Button disabled={saving} onClick={async () => {
                setSaving(true);
                try {
                  await api.put(
                    `/api/wms/inbound/job_confirmation/${encodeURIComponent(jobNo)}?prin_code=${encodeURIComponent(prinCode)}`,
                    { packdet_no: selectedRows.map((r) => value(r, "packdet_no")) },
                  );
                  setProcessOpen(false); setSelectedRows([]);
                  toast.success("Job confirmation processed successfully");
                  await loadRows();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Process failed");
                } finally { setSaving(false); }
              }}>
                <CheckCircle2 size={15} /> {saving ? "Processing..." : "Confirm"}
              </Button>
            </>
          }
        >
          <div className="text-sm text-muted-foreground">
            {selectedRows.length === 0
              ? "No rows selected. Close and select rows from the table."
              : `You are about to process ${selectedRows.length} row(s). This action cannot be undone.`}
          </div>
        </Dialog>
      )}
    </section>
  );
}