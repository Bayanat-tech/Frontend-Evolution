import {
  CheckCircle2, Plus, RefreshCw, Save, Settings2, Truck, X,
  Package, MapPin, Hash, FileText, CalendarDays, Barcode,
} from "lucide-react";
import { type FormEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
  type WmsRow, value, normalizeRow, sqlEscape, stripUiFields, recalcQuantity, makeColumns,
} from "../../../utils/inboundHelpers";
import { useDebounce } from "../../../hooks/useDebounce";
import { Upload, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download, CheckCircle2 as CheckCircle2Icon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ActivityBillingSection } from "./ActivityBillingSection";
// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  job:        WmsRow | null;
  jobNo:      string;
  tab:        string;
  loadingJob: boolean;
};

type TallySubTab = "pallet" | "product" | "serial";

// Explicit return type for getLookupProps so TS never infers `unknown` on the fields commit
type LookupProps = {
  valueField:    string;
  displayFields: string[];
  columns:       { field: string; header: string }[];
  loadOptions:   () => Promise<any[]>;
  onChange:      (val: string, row: Record<string, unknown> | null) => void;
};

export type InboundOperationalTabHandle = {
  validateBeforeLeave: () => boolean;
};

// ── Tax component-category codes that carry a 5% rate; everything else is 0%.
// Mirrors legacy rule: if TX_COMPNTCAT_CODE_1 in ('10100','11100') then 5 else 0.
const TAX_FIVE_PERCENT_CODES = ["10100", "11100"];
const deriveTaxPercentFromCategory = (taxCompntcatCode: unknown): number =>
  TAX_FIVE_PERCENT_CODES.includes(String(taxCompntcatCode ?? "")) ? 5 : 0;

// ─── Component ────────────────────────────────────────────────────────────────
export const InboundOperationalTab = forwardRef<InboundOperationalTabHandle, Props>(
  function InboundOperationalTab({ job, jobNo, tab, loadingJob }, ref) {
    const { user }    = useAuth();
    const { toast }   = useToast();
    const prinCode    = value(job || {}, "prin_code");
    const companyCode = user?.company_code || "";
    const todayDateStr = new Date().toISOString().split("T")[0]; // ← add this
const [ediImportOpen, setEdiImportOpen] = useState(false);
const [ediImportFile, setEdiImportFile] = useState<File | null>(null);
const [ediTempData, setEdiTempData]     = useState<any[]>([]);
const [ediLoading, setEdiLoading]       = useState(false);
const [ediDragActive, setEdiDragActive] = useState(false);
    // ── tab flags ────────────────────────────────────────────────────────────
    const isPutawayHHT    = tab === "putway_hht";
    const isManualPutaway = tab === "putway_manual";
    const isTallyDetails  = tab === "tally_details";
    const isPackingDetails = tab === "packing_details";
    const isActivityBilling = tab === "activity_billing";
    // ── activity billing state ──────────────────────────────────────────────
const [activityRows,    setActivityRows]    = useState<WmsRow[]>([]);
const [activityLoading, setActivityLoading] = useState(false);
const [activityEdited,  setActivityEdited]  = useState<Record<string, WmsRow>>({});
const [activitySaving,  setActivitySaving]  = useState(false);

const loadActivityBilling = useCallback(async () => {
  if (!isActivityBilling || !jobNo || !prinCode) return;
  setActivityLoading(true);
  try {
    const sql = `
      SELECT 
        tid.PRIN_CODE, 
        tid.JOB_NO, 
        tid.ACT_CODE, 
        tid.ACT_CODE || '-' || ma.ACTIVITY AS ACTIVITY, 
        tid.QUANTITY, 
        tid.TX_COMPNTCAT_CODE_1, 
        tid.TX_CAT_CODE,
        tid.BILL_RATE, 
        tid.BILL, 
        tid.TX_COMPNT_PERC_1, 
        tid.TX_COMPNT_AMT_1, 
        tid.TX_COMPNT_LCURAMT_1, 
        tid.COST_RATE, 
        tid.TX_COMPNTCAT_CODE_1_COST, 
        tid.TX_CAT_CODE_COST, 
        tid.TX_COMPNT_PERC_1_COST, 
        tid.TX_COMPNT_AMT_1_COST, 
        tid.TX_COMPNT_LCURAMT_1_COST, 
        tid.COST, 
        tid.OTHER_SERVICES 
      FROM TN_INVOICE_DET tid
      JOIN MS_ACTIVITY ma 
        ON tid.ACT_CODE = ma.ACTIVITY_CODE
      WHERE tid.PRIN_CODE = '${sqlEscape(prinCode)}'
        AND tid.JOB_NO = '${sqlEscape(jobNo)}'
    `;
    const data = await executeWmsInboundSql(sql);
    setActivityRows(data.map(normalizeRow));
    setActivityEdited({});
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to load activity billing");
  } finally {
    setActivityLoading(false);
  }
}, [isActivityBilling, jobNo, prinCode]);

useEffect(() => {
  if (isActivityBilling && !loadingJob) void loadActivityBilling();
}, [isActivityBilling, loadingJob, jobNo, prinCode]);

const activityTotals = useMemo(() => {
  const totalBill   = activityRows.reduce((sum, r) => sum + Number(value(r, "bill") ?? 0), 0);
  const totalTax    = activityRows.reduce((sum, r) => sum + Number(value(r, "TX_COMPNT_AMT_1") ?? 0), 0);
  const totalAmount = activityRows.reduce((sum, r) => sum + Number(value(r, "TX_COMPNT_LCURAMT_1") ?? 0), 0);
  const totalCost   = activityRows.reduce((sum, r) => sum + Number(value(r, "cost") ?? 0), 0);
  const totalCostTax    = activityRows.reduce((sum, r) => sum + Number(value(r, "TX_COMPNT_AMT_1_COST") ?? 0), 0);
  const totalCostAmount = activityRows.reduce((sum, r) => sum + Number(value(r, "TX_COMPNT_LCURAMT_1_COST") ?? 0), 0);
  return { totalBill, totalTax, totalAmount, totalCost, totalCostTax, totalCostAmount };
}, [activityRows]);

// recompute BILL/COST locally as rates are edited, and track which rows changed
const handleActivityRateChange = (row: WmsRow, field:"quantity" | "bill_rate" | "cost_rate" | "TX_COMPNT_PERC_1", raw: string) => {
  const num = raw === "" ? 0 : Number(raw);
  const actCode = String(value(row, "act_code") ?? "");
  setActivityRows((prev) =>
    prev.map((r) => {
      if (String(value(r, "act_code") ?? "") !== actCode) return r;
      const updated: WmsRow = { ...r, [field]: num };
      const qty = Number(value(updated, "quantity") ?? 0);
      const billRate = Number(value(updated, "bill_rate") ?? 0);
      const taxPercent = Number(value(updated, "TX_COMPNT_PERC_1") ?? 0);
      const bill = qty * billRate;
      const taxAmount = bill * (taxPercent / 100);
      updated.bill = bill;
      updated.cost = qty * Number(value(updated, "cost_rate") ?? 0);
      updated.TX_COMPNT_AMT_1 = taxAmount;
      updated.TX_COMPNT_LCURAMT_1 = bill + taxAmount;
      setActivityEdited((prevEdited) => ({ ...prevEdited, [actCode]: updated }));
      return updated;
    })
  );
};

const handleActivityBillingSubmit = async () => {
  if (!Object.keys(activityEdited).length) { toast.error("No changes to update"); return; }
  setActivitySaving(true);
  try {
    const userId = String(user?.USERNAME || user?.username || "");

    // Look up whatever invoice already exists for this job/principal, if any.
    // If none exists, `existingHeader` stays null and every header field
    // below falls back to null/defaults - PROC_INS_UPD_TN_INVOICE treats a
    // null/absent INVOICE_NO as "create a new invoice" and just inserts it.
    const headerSql = `
      SELECT
        INVOICE_NO, INVOICE_DATE, INV_TYPE, INV_TO, CURR_CODE, EX_RATE,
        ALLOCATED, DESPATCHED, JOB_TYPE, INV_PRINT_COUNT, INV_PRINTED,
        INV_GRP_PRINT_COUNT, INV_GRP_PRINTED, FA_UPLOADED
      FROM TN_INVOICE
      WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
        AND PRIN_CODE    = '${sqlEscape(prinCode)}'
        AND JOB_NO       = '${sqlEscape(jobNo)}'`;
    const headerRows = await executeWmsInboundSql(headerSql);
    const existingHeader: any = headerRows?.[0] ? normalizeRow(headerRows[0]) : {};

    const detailRows = activityRows
      .filter((row) => String(value(row, "act_code") || "").trim() !== "") // drop blank "Add Activity" rows
      .map((row) => ({
        ACT_CODE: String(value(row, "act_code") ?? ""),
        QUANTITY: Number(value(row, "quantity") ?? 0),
        BILL_RATE: Number(value(row, "bill_rate") ?? 0),
        TX_COMPNTCAT_CODE_1: value(row, "TX_COMPNTCAT_CODE_1") || null,
        TX_CAT_CODE: value(row, "TX_CAT_CODE") || null,
        TX_COMPNT_PERC_1: Number(value(row, "TX_COMPNT_PERC_1") ?? 0),
        TX_COMPNT_AMT_1: Number(value(row, "TX_COMPNT_AMT_1") ?? 0),
        TX_COMPNT_LCURAMT_1: Number(value(row, "TX_COMPNT_LCURAMT_1") ?? 0),
        OTHER_SERVICES: value(row, "other_services") || null,
        USER_ID: userId,
        COST_RATE: Number(value(row, "cost_rate") ?? 0),
        TX_COMPNTCAT_CODE_1_COST: value(row, "TX_COMPNTCAT_CODE_1_COST") || null,
        TX_CAT_CODE_COST: value(row, "TX_CAT_CODE_COST") || null,
        TX_COMPNT_PERC_1_COST: Number(value(row, "TX_COMPNT_PERC_1_COST") ?? 0),
        TX_COMPNT_AMT_1_COST: Number(value(row, "TX_COMPNT_AMT_1_COST") ?? 0),
        TX_COMPNT_LCURAMT_1_COST: Number(value(row, "TX_COMPNT_LCURAMT_1_COST") ?? 0),
        COST: Number(value(row, "cost") ?? 0),
      }));

    const payload = {
      header: {
        INVOICE_NO: value(existingHeader, "invoice_no") ?? null,
        INVOICE_DATE: value(existingHeader, "invoice_date") ?? null,
        JOB_NO: jobNo,
        INV_TYPE: value(existingHeader, "inv_type") ?? null,
        PRIN_CODE: prinCode,
        INV_TO: value(existingHeader, "inv_to") ?? null,
        CURR_CODE: value(existingHeader, "curr_code") ?? null,
        EX_RATE: Number(value(existingHeader, "ex_rate") ?? 1),
        ALLOCATED: value(existingHeader, "allocated") ?? null,
        USER_ID: userId,
        DESPATCHED: value(existingHeader, "despatched") ?? null,
        COMPANY_CODE: companyCode,
        JOB_TYPE: value(existingHeader, "job_type") ?? null,
        INV_PRINT_COUNT: Number(value(existingHeader, "inv_print_count") ?? 0),
        INV_PRINTED: value(existingHeader, "inv_printed") ?? null,
        INV_GRP_PRINT_COUNT: Number(value(existingHeader, "inv_grp_print_count") ?? 0),
        INV_GRP_PRINTED: value(existingHeader, "inv_grp_printed") ?? null,
        FA_UPLOADED: value(existingHeader, "fa_uploaded") ?? null,
      },
      details: detailRows,
    };

    await api.post("/api/finance/insUpdTnInvoiceBulk", payload); // adjust to your actual route path

    toast.success("Activity billing updated successfully");
    setActivityEdited({});
    await loadActivityBilling();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to update activity billing");
  } finally {
    setActivitySaving(false);
  }
};
    // ── HHT putaway state ────────────────────────────────────────────────────
    const [hhtPalletId,          setHhtPalletId]          = useState("");
    const [hhtLocation,          setHhtLocation]          = useState("");
    const [hhtPalletProducts,    setHhtPalletProducts]    = useState<WmsRow[]>([]);
    const [hhtAvailablePallets,  setHhtAvailablePallets]  = useState<string[]>([]);
    const [hhtLocationError,     setHhtLocationError]     = useState("");
    const [hhtLocationValid,     setHhtLocationValid]     = useState<boolean | null>(null);
    const [hhtLocationLoading,   setHhtLocationLoading]   = useState(false);
    const [hhtAllLocations,      setHhtAllLocations]      = useState<{ site: string; loc: string }[]>([]);
    const [hhtLocationsLoaded,   setHhtLocationsLoaded]   = useState(false);

    // fetch available pallets for HHT
    useEffect(() => {
      if (!isPutawayHHT || !jobNo) return;
      const fetchPallets = async () => {
        try {
          const sql = `
            SELECT DISTINCT t.PALLET_ID
            FROM TI_TALLY_DETAIL t
            WHERE t.JOB_NO = '${sqlEscape(jobNo)}'
              AND t.PALLET_ID IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM TT_BATCH b WHERE b.PALLET_ID = t.PALLET_ID
              )`;
          const data = await executeWmsInboundSql(sql);
          setHhtAvailablePallets(
            data.map((r) => String(value(r, "pallet_id") || value(r, "PALLET_ID") || "")).filter(Boolean)
          );
        } catch { setHhtAvailablePallets([]); }
      };
      void fetchPallets();
    }, [isPutawayHHT, jobNo]);

    // pre-fetch all locations for HHT validation
    useEffect(() => {
      if (!isPutawayHHT || hhtLocationsLoaded || !companyCode) return;
      const fetchLocs = async () => {
        setHhtLocationLoading(true);
        try {
          const data = await executeWmsInboundSql(
            `SELECT SITE_CODE, LOCATION_CODE FROM MS_LOCATION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'`
          );
          setHhtAllLocations(
            data.map((r) => ({
              site: String(value(r, "site_code") || value(r, "SITE_CODE") || ""),
              loc:  String(value(r, "location_code") || value(r, "LOCATION_CODE") || ""),
            }))
          );
          setHhtLocationsLoaded(true);
        } catch {
          setHhtAllLocations([]);
        } finally {
          setHhtLocationLoading(false);
        }
      };
      void fetchLocs();
    }, [isPutawayHHT, hhtLocationsLoaded, companyCode]);

    const handleHhtLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.toUpperCase();
      setHhtLocation(v);
      if (!v) { setHhtLocationError(""); setHhtLocationValid(null); return; }
      const siteCode = v.slice(0, 2);
      const locCode  = v.slice(2);
      if (v.length < 2) { setHhtLocationError(""); setHhtLocationValid(null); return; }
      const siteExists = hhtAllLocations.some((l) => l.site === siteCode);
      if (!siteExists) { setHhtLocationError("Site code does not exist"); setHhtLocationValid(false); return; }
      if (locCode.length === 0) { setHhtLocationError(""); setHhtLocationValid(null); return; }
      const locExists = hhtAllLocations.some((l) => l.site === siteCode && l.loc === locCode);
      if (!locExists) { setHhtLocationError("Location code does not exist"); setHhtLocationValid(false); return; }
      setHhtLocationError(""); setHhtLocationValid(true);
    };

    const handleHhtPalletChange = async (palletId: string) => {
      setHhtPalletId(palletId);
      setHhtPalletProducts([]);
      if (!palletId) return;
      try {
        const data = await executeWmsInboundSql(`
          SELECT * FROM VW_TI_TALLY_DETAIL
          WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
            AND JOB_NO       = '${sqlEscape(jobNo)}'
            AND PRIN_CODE    = '${sqlEscape(prinCode)}'
            AND PALLET_ID    = '${sqlEscape(palletId)}'
          ORDER BY UPDATED_AT`);
        setHhtPalletProducts(data.map(normalizeRow));
      } catch { setHhtPalletProducts([]); }
    };

    const openHhtPutawayModal = () => {
      setHhtPalletId(""); setHhtLocation(""); setHhtPalletProducts([]);
      setHhtLocationError(""); setHhtLocationValid(null);
      setModalNotice(null); setProcessOpen(true);
    };

    // ── core state ───────────────────────────────────────────────────────────
    const [rows,         setRows]         = useState<WmsRow[]>([]);
    const [query,        setQuery]        = useState("");
    const [loading,      setLoading]      = useState(false);
    const [selectedRows, setSelectedRows] = useState<WmsRow[]>([]);

    const [addOpen,    setAddOpen]    = useState(false);
    const [addForm,    setAddForm]    = useState<WmsRow>({});
    const [saving,     setSaving]     = useState(false);

    const [editOpen,   setEditOpen]   = useState(false);
    const [editForm,   setEditForm]   = useState<WmsRow>({});
    const [editSaving, setEditSaving] = useState(false);

    const [processOpen,  setProcessOpen]  = useState(false);
    const [modalNotice,  setModalNotice]  = useState<string | null>(null);

    const [clearanceForm, setClearanceForm] = useState({
      truck_condition: "", container_condition: "", container_type: "",
      ref_box_temp: "", prod_temp: "", prod_con_acceptance: "",
    });

    // ── putaway form + debounced location validation ─────────────────────────
const [putawayForm, setPutawayForm] = useState({ site_from: "", site_to: "", location_from: "", location_code: "", location_to: "" });
    const debouncedLocation = useDebounce(putawayForm.location_code, 500);
    const [locationValid, setLocationValid] = useState<boolean | null>(null);
    const [locationError, setLocationError] = useState<string>("");

    useEffect(() => {
      if (!putawayForm.site_from || !debouncedLocation) {
        setLocationValid(null); setLocationError(""); return;
      }
      const check = async () => {
        try {
          const sql = `
            SELECT LOCATION_CODE FROM MS_LOCATION
            WHERE COMPANY_CODE  = '${sqlEscape(companyCode)}'
              AND SITE_CODE     = '${sqlEscape(putawayForm.site_from)}'
              AND LOCATION_CODE = '${sqlEscape(debouncedLocation)}'`;
          const data = await executeWmsInboundSql(sql);
          if (data.length > 0) { setLocationValid(true);  setLocationError(""); }
          else                  { setLocationValid(false); setLocationError("Location not found for this site."); }
        } catch { setLocationValid(false); setLocationError("Error checking location."); }
      };
      check();
    }, [debouncedLocation, putawayForm.site_from, companyCode]);

    const [siteOptions,         setSiteOptions]         = useState<DropdownOption[]>([]);
    const [locationFromOptions, setLocationFromOptions] = useState<DropdownOption[]>([]);
    const [locationToOptions,   setLocationToOptions]   = useState<DropdownOption[]>([]);

    const config = getInboundTabConfig(tab);
    const [tallySubTab, setTallySubTab] = useState<TallySubTab>("pallet");

    // ── SectionHeader helper ─────────────────────────────────────────────────
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

    // ── getLookupProps — explicit return type so TS never widens to unknown ──
    const getLookupProps = (field: FormField, isEditMode = false): LookupProps | null => {
      const formData    = isEditMode ? editForm : addForm;
      const setFormData = isEditMode
        ? (u: (c: WmsRow) => WmsRow) => setEditForm(u)
        : (u: (c: WmsRow) => WmsRow) => setAddForm(u);

      const lookupType = field.lookup as
        | "product" | "container" | "country" | "manufacturer" | "site" | "location"
        | "tally_product" | "tally_container";

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
              return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            },
onChange: (val: string, row: Record<string, unknown> | null) => {
  const uppp     = Number(row?.["UPPP"]      ?? row?.["uppp"]      ?? 1);
  const upp      = Number(row?.["UPP"]       ?? row?.["upp"]       ?? 0);
  const uomCount = Number(row?.["UOM_COUNT"] ?? row?.["uom_count"] ?? 1);
  const pUom     = String(row?.["P_UOM"]     ?? row?.["p_uom"]     ?? "");
  const lUom     = String(row?.["L_UOM"]     ?? row?.["l_uom"]     ?? "");
  const prodName = String(row?.["PROD_NAME"] ?? row?.["prod_name"] ?? "");
  setFormData((cur: any) => {
    const qtyPuom = Number(cur.qty_puom ?? 0);
    const qtyLuom = uomCount <= 1 ? 0 : Number(cur.qty_luom ?? 0);
    const quantity = uomCount <= 1 ? qtyPuom + qtyLuom : qtyPuom * uppp + qtyLuom;
    // po_no and container_no are owned by the Container lookup — don't touch them here.
    return { ...cur, prod_code: val, prod_name: prodName, p_uom: pUom, l_uom: lUom, uppp, upp, uom_count: uomCount, qty_luom: uomCount <= 1 ? 0 : cur.qty_luom, quantity };
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
                raw_sql: `SELECT SITE_CODE, SITE_NAME FROM MS_SITE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY SITE_CODE`,
              });
              return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            },
            onChange: (val: string, row: Record<string, unknown> | null) =>
              setFormData((cur: any) => ({
                ...cur,
                site_code: val,
                site_code_display: row ? `${row["SITE_CODE"] ?? ""} - ${row["SITE_NAME"] ?? ""}` : "",
                location_code: "", location_code_display: "",
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
              return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            },
            onChange: (val: string, row: Record<string, unknown> | null) =>
              setFormData((cur: any) => ({
                ...cur,
                location_code: val,
                location_code_display: row ? String(row["LOCATION_CODE"] ?? "") : val,
              })),
          };

case "container": {
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
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT CONTAINER_NO, VEHICLE_NO, VESSEL_NAME, SEAL_NO, PO_NO, BL_NO
                  FROM TI_CONTAINER
                  WHERE JOB_NO    = '${sqlEscape(jobNo)}'
                    AND PRIN_CODE = '${sqlEscape(prinCode)}' AND COMPANY_CODE = '${sqlEscape(companyCode)}'
                  ORDER BY CONTAINER_NO`,
      });
      return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    },
    onChange: (val: string, row: Record<string, unknown> | null) =>
      setFormData((cur: any) => ({
        ...cur,
        container_no: val,
        po_no: row?.["PO_NO"] ?? row?.["po_no"] ?? null,
        bl_no: row?.["BL_NO"] ?? row?.["bl_no"] ?? null,
      })),
  };
}

        case "tally_container":
          return {
            valueField:    "CONTAINER_NO",
            displayFields: ["CONTAINER_NO"],
            columns: [
              { field: "CONTAINER_NO", header: "Container No" },
              { field: "VEHICLE_NO",   header: "Vehicle No" },
              { field: "VESSEL_NAME",  header: "Vessel Name" },
              { field: "SEAL_NO",      header: "Seal No" },
              { field: "PO_NO",        header: "PO No" },
              {field:"BL_NO", header:"BL No"},
            ],
            loadOptions: async () => {
              const res = await api.post("/api/wms/inbound/executeRawSql", {
                raw_sql: `SELECT * FROM TI_CONTAINER WHERE PRIN_CODE = '${sqlEscape(prinCode)}' AND JOB_NO = '${sqlEscape(jobNo)}'`,
              });
              return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            },
            onChange: (val: string) => setFormData((cur: any) => ({ ...cur, container_no: val })),
          };

        case "tally_product":
          return {
            valueField:    "PROD_CODE",
            displayFields: ["PROD_CODE", "PROD_NAME"],
            columns: [
              { field: "PROD_CODE", header: "Product Code" },
              { field: "PROD_NAME", header: "Product Name" },
              { field: "QTY_PUOM",  header: "Qty (Primary)" },
              { field: "QTY_LUOM",  header: "Qty (Lowest)" },
            ],
            loadOptions: async () => {
              const res = await api.post("/api/wms/inbound/executeRawSql", {
                raw_sql: `SELECT * FROM VW_WM_INB_PACKDET_DETS
                          WHERE company_code = '${sqlEscape(companyCode)}'
                            AND job_no = '${sqlEscape(jobNo)}'
                            AND prin_code = '${sqlEscape(prinCode)}'
                          ORDER BY updated_at`,
              });
              return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            },
            onChange: (val: string, row: Record<string, unknown> | null) => {
              const prodName  = String(row?.["PROD_NAME"] ?? row?.["prod_name"] ?? "");
              const pUom      = String(row?.["PUOM"] ?? row?.["puom"] ?? row?.["P_UOM"] ?? row?.["p_uom"] ?? "");
              const lUom      = String(row?.["LUOM"] ?? row?.["luom"] ?? row?.["L_UOM"] ?? row?.["l_uom"] ?? "");
              const qtyPuom   = Number(row?.["QTY_PUOM"] ?? row?.["qty_puom"] ?? row?.["PQTY"] ?? row?.["pqty"] ?? 0);
              const qtyLuom   = Number(row?.["QTY_LUOM"] ?? row?.["qty_luom"] ?? row?.["LQTY"] ?? row?.["lqty"] ?? 0);
              const uppp      = Number(row?.["UPPP"] ?? row?.["uppp"] ?? 1);
              const packdetNo = row?.["PACKDET_NO"] ?? row?.["packdet_no"] ?? null;
              setFormData((cur: any) => ({
                ...cur,
                prod_code: val, prod_name: prodName,
                pda_puom: pUom, pda_luom: lUom,
                pda_qty_puom: qtyPuom, pda_qty_luom: qtyLuom,
                uppp, packdet_no: packdetNo,
                quantity: qtyPuom * uppp + qtyLuom,
              }));
            },
          };

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
                raw_sql: `SELECT MANU_CODE, MANU_NAME FROM MS_MANUFACTURER WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY MANU_NAME`,
              });
              return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            },
            onChange: (val: string, row: Record<string, unknown> | null) =>
              setFormData((cur: any) => ({
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
    const requestIdRef = useRef(0);
    const loadRows = useCallback(async () => {
      if (!config || loadingJob || !prinCode) return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await executeWmsInboundSql(config.sql({ companyCode, jobNo, prinCode }));
        if (requestId !== requestIdRef.current) return;
        setRows(
          data.map(normalizeRow).filter((row) =>
            tab !== "putway_details" || String(value(row, "allocated") || "").toUpperCase() !== "Y"
          )
        );
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        toast.error(error instanceof Error ? error.message : `Unable to load ${config?.title}`);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, [tab, jobNo, prinCode, loadingJob, companyCode]);


useEffect(() => {
  if (!loadingJob && !processOpen) {
    void loadRows();
  }
}, [tab, jobNo, prinCode, loadingJob, processOpen]);
    // ── received qty helpers ─────────────────────────────────────────────────
    const parseLeadingNumber = (v: unknown): number => {
      if (v === null || v === undefined || v === "") return 0;
      const match = String(v).match(/-?\d+(\.\d+)?/);
      return match ? Number(match[0]) : 0;
    };

    const getReceivedQty = (row: WmsRow) => {
      const direct = Number(value(row, "qty1_arrived") ?? 0) + Number(value(row, "qty2_arrived") ?? 0);
      if (direct > 0) return direct;
      return parseLeadingNumber(value(row, "qty_arrived_string"))
          || parseLeadingNumber(value(row, "qty_netarrived_string"));
    };

    // ── guard ────────────────────────────────────────────────────────────────
useImperativeHandle(ref, () => ({
  validateBeforeLeave: () => {
    if (tab !== "receiving_details") return true;
    const pending = rows.find((r) => getReceivedQty(r) <= 0);
    if (!pending) return true;
    toast.error("Please enter receiving quantity before continuing.");
    setEditForm({
      packdet_no:   value(pending, "packdet_no"),
      prod_name:    value(pending, "prod_name"),
      batch_no:     value(pending, "batch_no"),
      lot_no:       value(pending, "lot_no"),
      po_no:        value(pending, "po_no"),
      doc_ref:      value(pending, "doc_ref"),
      qty_luom:     Number(value(pending, "qty_luom") ?? 0),
      qty_puom:     Number(value(pending, "qty_puom") ?? 0),         // ← add
      p_uom:        String(value(pending, "p_uom") || value(pending, "puom") || ""), // ← add
      qty1_arrived: getReceivedQty(pending),
      qty2_arrived: 0,
    });
    setEditOpen(true);
    return false;
  },
}), [tab, rows, toast]);


    // ── open modals ──────────────────────────────────────────────────────────
    const openAddModal = () => {
      setAddForm({ job_no: jobNo, prin_code: prinCode, company_code: companyCode });
      if (isTallyDetails) setTallySubTab("pallet");
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
setPutawayForm({ site_from: "", site_to: "", location_from: "", location_code: "", location_to: "" });
      setLocationFromOptions([]); setLocationToOptions([]);
      setModalNotice(null); setProcessOpen(true);
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
        if (!addForm.container_no)                              { setModalNotice("Container No. is required."); return; }
        if (!addForm.prod_code)                                 { setModalNotice("Product / SKU is required."); return; }
        if (!addForm.qty_puom || Number(addForm.qty_puom) <= 0) { setModalNotice("Quantity (Primary) must be > 0."); return; }
        if (addForm.qty_luom === undefined || addForm.qty_luom === "") { setModalNotice("Quantity (Lowest) is required."); return; }
      } else if (isManualPutaway) {
        if (!addForm.container_no)                              { setModalNotice("Container No. is required."); return; }
        if (!addForm.prod_code)                                 { setModalNotice("Product / SKU is required."); return; }
        if (!addForm.site_code)                                 { setModalNotice("Site Code is required."); return; }
        if (!addForm.location_code)                             { setModalNotice("Location Code is required."); return; }
        if (!addForm.qty_puom || Number(addForm.qty_puom) <= 0) { setModalNotice("Quantity 1 (Primary) must be > 0."); return; }
      } else if (isTallyDetails) {
        if (!addForm.prod_code) { setModalNotice("Product / SKU is required."); return; }
        if (tallySubTab === "pallet") {
          if (!addForm.pallet_id)    { setModalNotice("Pallet ID is required."); return; }
              if (String(addForm.pallet_id).length > 10) { setModalNotice("Pallet ID must be 10 characters or fewer."); return; }
          if (!addForm.container_no) { setModalNotice("Container No. is required."); return; }
        }
        if (tallySubTab === "serial" && !addForm.serial_no) { setModalNotice("Serial No. is required."); return; }
      } else {
        const missing = (config?.addFields || []).find((f: any) => f.required && !String(addForm[f.name] || "").trim());
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
          const userId   = String(user?.USERNAME || user?.username || "");
          await postWmsInbound(config.addEndpoint, {
            COMPANY_CODE: companyCode, PRIN_CODE: prinCode, JOB_NO: jobNo,
            TXN_TYPE: "PUT", TXN_DATE: now, PACKDET_NO: 0, KEY_NUMBER: "",
            PROD_CODE: addForm.prod_code, SITE_CODE: addForm.site_code,
            LOCATION_CODE: addForm.location_code,
            QUANTITY: quantity, QTY_PUOM: qtyPuom, QTY_LUOM: qtyLuom, P_UOM: pUom, L_UOM: lUom,
            QTY_CONFIRMED: quantity, PQTY_CONFIRMED: qtyPuom, LQTY_CONFIRMED: qtyLuom,
            PUOM_CONFIRMED: pUom, LUOM_CONFIRMED: lUom,
            UPP: Number(addForm.upp ?? 0), UPPP: Number(addForm.uppp ?? 1),
            CONFIRM_DATE: null, CUST_CODE: "", ORDER_NO: "", VESSEL_NAME: "",
            CONTAINER_NO: addForm.container_no || "", SEAL_NO: "",
            PO_NO: addForm.po_no || null, BL_NO: "", DOC_REF: addForm.doc_ref || "",
            LOT_NO: addForm.lot_no || "", PALLET_ID: addForm.pallet_id || "",
            MANU_CODE: "", CURR_CODE: "", EX_RATE: 0, UNIT_PRICE: 0,
            SELECTED: "Y", ALLOCATED: "Y", CONFIRMED: "N",
            USER_ID: userId, USER_DT: now, ORIGIN_COUNTRY: "",
            SHELF_LIFE_DAYS: Number(addForm.shelf_life_days ?? 0),
            BATCH_NO: addForm.batch_no || "", GROSS_WT: 0, NET_VOLUME: 0,
            MFG_DATE: addForm.mfg_date || null, EXPIRY_DATE: addForm.expiry_date || null,
            SHELF_LIFE_DATE: addForm.shelf_life_date || null, updated_by: userId,
          });
        } else if (isTallyDetails) {
          const qtyPuom  = Number(addForm.pda_qty_puom ?? 0);
          const qtyLuom  = Number(addForm.pda_qty_luom ?? 0);
          const quantity = Number(addForm.quantity ?? (qtyPuom + qtyLuom));
          await api.post("/api/wms/inbound/tally_details", {
            prod_code: addForm.prod_code, company_code: companyCode,
            pda_qty_puom: qtyPuom, pda_puom: addForm.pda_puom || "",
            pda_luom: addForm.pda_luom || "", pda_qty_luom: qtyLuom,
            batch_no: addForm.batch_no || "", lot_no: addForm.lot_no || "",
            mfg_date: addForm.mfg_date || null, exp_date: addForm.exp_date || null,
            origin_country: "", gross_weight: null, volume: null,
            shelf_life_days: null, shelf_life_date: null,
            container_no: tallySubTab === "pallet" ? (addForm.container_no || "") : "",
            pallet_id:    tallySubTab === "pallet" ? (addForm.pallet_id || "")    : "",
            ...(tallySubTab === "serial" ? { serial_no: addForm.serial_no || "" } : {}),
            seq_number: null, uppp: Number(addForm.uppp ?? 1),
            prod_name: addForm.prod_name || "", quantity,
            packdet_no: addForm.packdet_no ?? null,
            pda_quantity: quantity, job_no: jobNo, prin_code: prinCode,
          });
} else if (tab === "packing_details") {
          await postWmsInbound(config.addEndpoint, {
            prod_code:      addForm.prod_code,
            company_code:   companyCode,
            qty_puom:       addForm.qty_puom,
            p_uom:          String(addForm.p_uom  || ""),
            l_uom:          String(addForm.l_uom  || ""),
            qty_luom:       Number(addForm.qty_luom  ?? 0),
            quantity:       Number(addForm.quantity  ?? 0),
            batch_no:       addForm.batch_no       || "",
            lot_no:         addForm.lot_no         || "",
            mfg_date:       addForm.mfg_date       || null,
            exp_date:       addForm.exp_date       || null,
            po_no:          addForm.po_no          || null,
            origin_country: addForm.origin_country || "",
            manu_code:      "",
            gross_weight:   null,
            volume:         null,
            shelf_life_days: addForm.shelf_life_days || null,
            shelf_life_date: addForm.shelf_life_date || null,
            container_no:   addForm.container_no   || "",
            bl_no:          addForm.bl_no          || "",
            doc_ref:        addForm.doc_ref        || "",
            uppp:           Number(addForm.uppp    ?? 1),
            job_no:         jobNo,
            prin_code:      prinCode,
          });
        } else {
          await postWmsInbound(config.addEndpoint, {
            ...stripUiFields(addForm), job_no: jobNo, prin_code: prinCode, company_code: companyCode,
          });
        }

        setAddOpen(false); setModalNotice(null);
        toast.success(`${config.title} added successfully`);
        await loadRows();
      } catch (error) {
        const msg = error instanceof Error ? error.message : `Unable to add ${config?.title}`;
        setModalNotice(msg); toast.error(msg);
      } finally { setSaving(false); }
    };
const openEdiImportModal = () => {
  setEdiImportFile(null); setEdiTempData([]); setEdiLoading(false);
  setEdiImportOpen(true);
};
    // ── save edit ────────────────────────────────────────────────────────────
    const saveEdit = async (e: FormEvent) => {
      e.preventDefault();
      setModalNotice(null);
      if (tab === "packing_details") {
        if (!editForm.container_no)                                  { setModalNotice("Container No. is required."); return; }
        if (!editForm.prod_code)                                     { setModalNotice("Product / SKU is required."); return; }
        if (!editForm.qty_puom || Number(editForm.qty_puom) <= 0)    { setModalNotice("Quantity (Primary) is required."); return; }
      } else if (tab === "receiving_details") {
        const q1 = Number(editForm.qty1_arrived), q2 = Number(editForm.qty2_arrived);
        if (isNaN(q1) || isNaN(q2))   { setModalNotice("Both quantity fields must be numbers."); return; }
        if (q1 <= 0 && q2 <= 0)       { setModalNotice("At least one quantity must be > 0."); return; }
      }
      setEditSaving(true);
      try {
        if (tab === "packing_details") {
          await api.put(
            `/api/wms/inbound/packing_details/${encodeURIComponent(String(editForm.packdet_no || ""))}?prin_code=${encodeURIComponent(prinCode)}&job_no=${encodeURIComponent(jobNo)}`,
            { ...stripUiFields(editForm), company_code: companyCode }
          );
        } else if (tab === "receiving_details") {
          await api.put(
            `/api/wms/inbound/packing_details/receiving?prin_code=${encodeURIComponent(prinCode)}&job_no=${encodeURIComponent(jobNo)}&packdet_no=${encodeURIComponent(String(editForm.packdet_no))}`,
            { qty1_arrived: Number(editForm.qty1_arrived), qty2_arrived: Number(editForm.qty2_arrived) }
          );
        }
        setEditOpen(false); setModalNotice(null);
        toast.success(`${tab === "packing_details" ? "Packing detail" : "Receiving detail"} updated successfully`);
        await loadRows();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unable to update record";
        setModalNotice(msg); toast.error(msg);
      } finally { setEditSaving(false); }
    };


// if (isActivityBilling) {
//   const handleAddActivity = () => {
//     // Legacy default rule: if the tax-component-category master has no rows
//     // for this company, default the row to code '11100' @ 5%; otherwise
//     // leave the category blank and default the tax category to '00' @ 0%.
//     const noCompntcatMaster = !txCompntcatCode1Loading && txCompntcatCode1Data.length === 0;
//     const defaults = noCompntcatMaster
//       ? { TX_COMPNTCAT_CODE_1: "11100", TX_COMPNT_PERC_1: 5, TX_COMPNTCAT_CODE_1_COST: "11100", TX_COMPNT_PERC_1_COST: 5 }
//       : { TX_CAT_CODE: "00", TX_COMPNT_PERC_1: 0, TX_CAT_CODE_COST: "00", TX_COMPNT_PERC_1_COST: 0 };
//     setActivityRows((cur) => [
//       ...cur,
//       {
//         act_code: "", activity: "", quantity: 0,
//         bill_rate: 0, bill: 0, TX_COMPNT_AMT_1: 0, TX_COMPNT_LCURAMT_1: 0,
//         cost_rate: 0, cost: 0, other_services: "", TX_COMPNT_AMT_1_COST: 0, TX_COMPNT_LCURAMT_1_COST: 0,
//         ...defaults,
//       },
//     ]);
//   }

//   const { data: activityData = [] } = useQuery({
//     queryKey: ["activityBilling", companyCode, prinCode, jobNo],
//     enabled: !!companyCode && !!prinCode && !!jobNo,
//     queryFn: async () => {
//       const sql = `SELECT ACTIVITY_CODE, ACTIVITY FROM MS_ACTIVITY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY ACTIVITY`;
//       const res = await executeWmsInboundSql(sql);
//       return Array.isArray(res) ? res : [];
//     },
//   });

//   // Tax Component Category ("Tax_Code" -> TX_COMPNTCAT_CODE_1 / TX_COMPNTCAT_CODE_1_COST)
//   // select tx_compntcat_code, tx_compntcat_name from ms_tax_compntcategory
//   // where company_code = ... order by tx_compntcat_code
//   const { data: txCompntcatCode1Data = [], isLoading: txCompntcatCode1Loading
//    } = useQuery({
//     queryKey: ["txCompntcatCode1", companyCode],
//     enabled: !!companyCode,
//     queryFn: async () => {
//       const sql = `SELECT TX_COMPNTCAT_CODE, TX_COMPNTCAT_NAME FROM MS_TAX_COMPNTCATEGORY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY TX_COMPNTCAT_CODE`;
//       const res = await executeWmsInboundSql(sql);
//       return Array.isArray(res) ? res : [];
//     } 
//   })

//   // Tax Category ("Tax Category" -> TX_CAT_CODE / TX_CAT_CODE_COST)
//   // select tx_cat_code, tx_cat_name from ms_tax_category where company_code = ... order by tx_cat_code
//   const { data: taxCategoryData = [], isLoading: taxCategoryLoading } = useQuery({
//     queryKey: ["taxCategory", companyCode],
//     enabled: !!companyCode,
//     queryFn: async () => {
//       const sql = `SELECT TX_CAT_CODE, TX_CAT_NAME FROM MS_TAX_CATEGORY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY TX_CAT_CODE`;
//       const res = await executeWmsInboundSql(sql);
//       return Array.isArray(res) ? res : [];
//     },
//   });

//   const handleActivitySelect = (i: number, selectedRow: any) => {
//     setActivityRows((cur) => {
//       const next = cur.map((r, idx) =>
//         idx === i
//           ? {
//               ...r,
//               act_code: selectedRow ? String(selectedRow.ACTIVITY_CODE ?? "") : "",
//               activity: selectedRow ? String(selectedRow.ACTIVITY ?? "") : "",
//             }
//           : r
//       );
//       const updatedRow = next[i];
//       const key = String(value(updatedRow, "act_code") || `row_${i}`);
//       setActivityEdited((prevEdited) => ({ ...prevEdited, [key]: updatedRow }));
//       return next;
//     });
//   };

//   const handleActivityRateChange = (
//     row: WmsRow,
//     field: "quantity" | "bill_rate" | "cost_rate" | "TX_COMPNT_PERC_1" | "TX_COMPNT_PERC_1_COST",
//     rawValue: string
//   ) => {
//     const i = activityRows.indexOf(row);
//     if (i === -1) return;
//     const numValue = Number(rawValue);
//     const safeValue = Number.isFinite(numValue) ? numValue : 0;

//     setActivityRows((cur) => {
//       const next = cur.map((r, idx) => {
//         if (idx !== i) return r;
//         const updated: WmsRow = { ...r, [field]: safeValue };

//         const quantity   = Number(field === "quantity"    ? safeValue : value(updated, "quantity")    ?? 0);
//         const billRate    = Number(field === "bill_rate"   ? safeValue : value(updated, "bill_rate")    ?? 0);
//         const costRate    = Number(field === "cost_rate"   ? safeValue : value(updated, "cost_rate")    ?? 0);
//         const taxPercent  = Number(field === "TX_COMPNT_PERC_1" ? safeValue : value(updated, "TX_COMPNT_PERC_1")  ?? 0);
//         const costTaxPercent = Number(field === "TX_COMPNT_PERC_1_COST" ? safeValue : value(updated, "TX_COMPNT_PERC_1_COST") ?? 0);

//         const bill = quantity * billRate;
//         const taxAmount = bill * (taxPercent / 100);
//         const cost = quantity * costRate;
//         const costTaxAmount = cost * (costTaxPercent / 100);

//         updated.bill         = bill;
//         updated.cost         = cost;
//         updated.TX_COMPNT_PERC_1  = taxPercent;
//         updated.TX_COMPNT_AMT_1   = taxAmount;
//         updated.TX_COMPNT_LCURAMT_1 = bill + taxAmount;
//         updated.TX_COMPNT_PERC_1_COST  = costTaxPercent;
//         updated.TX_COMPNT_AMT_1_COST   = costTaxAmount;
//         updated.TX_COMPNT_LCURAMT_1_COST = cost + costTaxAmount;

//         return updated;
//       });
//       const updatedRow = next[i];
//       const key = String(value(updatedRow, "act_code") || `row_${i}`);
//       setActivityEdited((prevEdited) => ({ ...prevEdited, [key]: updatedRow }));
//       return next;
//     });
//   };

//   // Selecting a Tax Component Category applies the legacy percent rule
//   // (codes 10100 / 11100 -> 5%, everything else -> 0%) to the matching side.
//   const handleTaxCompntcatSelect = (
//     row: WmsRow,
//     side: "bill" | "cost",
//     selectedRow: any
//   ) => {
//     const i = activityRows.indexOf(row);
//     if (i === -1) return;
//     const code = selectedRow ? String(selectedRow.TX_COMPNTCAT_CODE ?? "") : "";
//     const perc = deriveTaxPercentFromCategory(code);

//     setActivityRows((cur) => {
//       const next = cur.map((r, idx) => {
//         if (idx !== i) return r;
//         const updated: WmsRow = {
//           ...r,
//           ...(side === "bill"
//             ? { TX_COMPNTCAT_CODE_1: code }
//             : { TX_COMPNTCAT_CODE_1_COST: code }),
//         };

//         const quantity = Number(value(updated, "quantity") ?? 0);
//         if (side === "bill") {
//           const billRate = Number(value(updated, "bill_rate") ?? 0);
//           const bill = quantity * billRate;
//           const taxAmount = bill * (perc / 100);
//           updated.bill = bill;
//           updated.TX_COMPNT_PERC_1 = perc;
//           updated.TX_COMPNT_AMT_1 = taxAmount;
//           updated.TX_COMPNT_LCURAMT_1 = bill + taxAmount;
//         } else {
//           const costRate = Number(value(updated, "cost_rate") ?? 0);
//           const cost = quantity * costRate;
//           const costTaxAmount = cost * (perc / 100);
//           updated.cost = cost;
//           updated.TX_COMPNT_PERC_1_COST = perc;
//           updated.TX_COMPNT_AMT_1_COST = costTaxAmount;
//           updated.TX_COMPNT_LCURAMT_1_COST = cost + costTaxAmount;
//         }
//         return updated;
//       });
//       const updatedRow = next[i];
//       const key = String(value(updatedRow, "act_code") || `row_${i}`);
//       setActivityEdited((prevEdited) => ({ ...prevEdited, [key]: updatedRow }));
//       return next;
//     });
//   };

//   // Selecting a Tax Category (TX_CAT_CODE / TX_CAT_CODE_COST) — reference only,
//   // stored as-is and sent to the API; it doesn't drive the percent calculation.
//   const handleTaxCategorySelect = (
//     row: WmsRow,
//     side: "bill" | "cost",
//     selectedRow: any
//   ) => {
//     const i = activityRows.indexOf(row);
//     if (i === -1) return;
//     const code = selectedRow ? String(selectedRow.TX_CAT_CODE ?? "") : "";

//     setActivityRows((cur) => {
//       const next = cur.map((r, idx) =>
//         idx === i
//           ? { ...r, ...(side === "bill" ? { TX_CAT_CODE: code } : { TX_CAT_CODE_COST: code }) }
//           : r
//       );
//       const updatedRow = next[i];
//       const key = String(value(updatedRow, "act_code") || `row_${i}`);
//       setActivityEdited((prevEdited) => ({ ...prevEdited, [key]: updatedRow }));
//       return next;
//     });
//   };

//   return (
//     <section className="grid gap-3">
//       {/* ── Toolbar (matches DataTable's toolbar row) ── */}
//       <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-4 py-3 shadow-sm">
//         <div>
//           <div className="text-sm font-semibold text-foreground">
//             {activityLoading ? "Loading" : `${activityRows.length} Rows`}
//           </div>
//           <div className="text-xs text-muted-foreground">
//             Activity Billing — adjust bill / cost rates per activity, then submit to update.
//           </div>
//         </div>
//         <div className="flex flex-wrap items-center gap-2">
//           <Button size="sm" variant="outline" onClick={handleAddActivity}>
//             <Plus size={14} /> Add Activity
//           </Button>
//           <Button size="sm" variant="outline" onClick={loadActivityBilling}>
//             <RefreshCw size={14} /> Refresh
//           </Button>
//           <Button size="sm" onClick={handleActivityBillingSubmit} disabled={activitySaving}>
//             <Save size={14} /> {activitySaving ? "Saving..." : "Submit"}
//           </Button>
//         </div>
//       </div>

//       {/* ── Activity Billing Table ── */}
// <div
//   className="activity-table-wrapper overflow-auto rounded-md border bg-card shadow-sm"
//   style={{ maxHeight: "calc(100vh - 365px)" }}
// >
//   <table className="activity-table min-w-full divide-y divide-border text-sm">
//     <thead className="bg-muted/50">
//       <tr>
//         <th className="col-activity col-activity-header px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
//           Activity
//         </th>
//         <th className="col-quantity col-quantity-header px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
//           Quantity
//         </th>
//         <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Tax Component Category
//         </th>
//         <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Tax Category
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Bill Rate
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Bill
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Tax Percent
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Tax Amount
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Total Amount
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Cost Rate
//         </th>
//         <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Cost Tax Component Category
//         </th>
//         <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Cost Tax Category
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Cost Tax Percent
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Cost Tax Amount
//         </th>
//         <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Total Cost
//         </th>
//         <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//           Other Services
//         </th>
//       </tr>
//     </thead>
    
//     <tbody className="divide-y divide-border">
//       {activityLoading ? (
//         <tr>
//           <td colSpan={16} className="px-3 py-6 text-center text-sm text-muted-foreground">
//             Loading...
//           </td>
//         </tr>
//       ) : activityRows.length === 0 ? (
//         <tr>
//           <td colSpan={16} className="px-3 py-6 text-center text-sm text-muted-foreground">
//             No records found
//           </td>
//         </tr>
//       ) : (
//         activityRows.map((row, i) => (
//           <tr key={`${String(value(row, "act_code") ?? "")}_${i}`} className="hover:bg-muted/30">
//             {/* Activity - STICKY */}
//             <td className="col-activity bg-card px-3 py-1.5 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
//               <LookupField
//                 compact
//                 value={String(value(row, "act_code") || "")}
//                 displayValue={String(value(row, "activity") || "")}
//                 columns={[
//                   { field: "ACTIVITY_CODE", header: "Code" },
//                   { field: "ACTIVITY", header: "Activity" },
//                 ]}
//                 valueField="ACTIVITY_CODE"
//                 displayFields={["ACTIVITY"]}
//                 loadOptions={async (query) => {
//                   if (!query) return activityData;
//                   const term = query.toLowerCase();
//                   return activityData.filter(
//                     (r) =>
//                       String(r.ACTIVITY_CODE ?? "").toLowerCase().includes(term) ||
//                       String(r.ACTIVITY ?? "").toLowerCase().includes(term)
//                   );
//                 }}
//                 onChange={(_val, selectedRow) => handleActivitySelect(i, selectedRow)}
//                 placeholder="Select activity"
//               />
//             </td>
            
//             {/* Quantity - STICKY */}
//             <td className="col-quantity bg-card px-3 py-1.5 text-right shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
//               <input
//                 type="number" 
//                 min="0" 
//                 step="1"
//                 className="h-8 w-full max-w-[80px] rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
//                 value={String(value(row, "quantity") ?? 0)}
//                 onChange={(e) => handleActivityRateChange(row, "quantity", e.target.value)}
//               />
//             </td>
            
//             {/* Rest of the columns - scrollable */}
//             <td className="px-3 py-1.5">
//               <LookupField
//                 compact
//                 value={String(value(row, "TX_COMPNTCAT_CODE_1") || "")}
//                 displayValue={String(value(row, "TX_COMPNTCAT_CODE_1") || "")}
//                 columns={[
//                   { field: "TX_COMPNTCAT_CODE", header: "Code" },
//                   { field: "TX_COMPNTCAT_NAME", header: "Description" },
//                 ]}
//                 valueField="TX_COMPNTCAT_CODE"
//                 displayFields={["TX_COMPNTCAT_NAME"]}
//                 loadOptions={async (query) => {
//                   if (txCompntcatCode1Loading) return [];
//                   if (!query) return txCompntcatCode1Data;
//                   const term = query.toLowerCase();
//                   return txCompntcatCode1Data.filter(
//                     (r) =>
//                       String(r.TX_COMPNTCAT_CODE ?? "").toLowerCase().includes(term) ||
//                       String(r.TX_COMPNTCAT_NAME ?? "").toLowerCase().includes(term)
//                   );
//                 }}
//                 onChange={(_val, selectedRow) => handleTaxCompntcatSelect(row, "bill", selectedRow)}
//                 placeholder="Select tax code"
//               />
//             </td>
            
//             <td className="px-3 py-1.5">
//               <LookupField
//                 compact
//                 value={String(value(row, "TX_CAT_CODE") || "")}
//                 displayValue={String(value(row, "TX_CAT_CODE") || "")}
//                 columns={[
//                   { field: "TX_CAT_CODE", header: "Code" },
//                   { field: "TX_CAT_NAME", header: "Description" },
//                 ]}
//                 valueField="TX_CAT_CODE"
//                 displayFields={["TX_CAT_NAME"]}
//                 loadOptions={async (query) => {
//                   if (taxCategoryLoading) return [];
//                   if (!query) return taxCategoryData;
//                   const term = query.toLowerCase();
//                   return taxCategoryData.filter(
//                     (r) =>
//                       String(r.TX_CAT_CODE ?? "").toLowerCase().includes(term) ||
//                       String(r.TX_CAT_NAME ?? "").toLowerCase().includes(term)
//                   );
//                 }}
//                 onChange={(_val, selectedRow) => handleTaxCategorySelect(row, "bill", selectedRow)}
//                 placeholder="Select tax category"
//               />
//             </td>
            
//             <td className="px-3 py-1.5 text-right">
//               <input
//                 type="number" 
//                 min="0" 
//                 step="0.01"
//                 className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
//                 value={String(value(row, "bill_rate") ?? 0)}
//                 onChange={(e) => handleActivityRateChange(row, "bill_rate", e.target.value)}
//               />
//             </td>
            
//             <td className="px-3 py-2.5 text-right font-medium text-foreground">
//               {Number(value(row, "bill") ?? 0).toFixed(2)}
//             </td>

//             <td className="px-3 py-1.5 text-right">
//               <input
//                 type="number" 
//                 min="0" 
//                 max="100"
//                 step="0.01"
//                 className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
//                 value={String(value(row, "TX_COMPNT_PERC_1") ?? 0)}
//                 onChange={(e) => handleActivityRateChange(row, "TX_COMPNT_PERC_1", e.target.value)}
//               />
//             </td>

//             <td className="px-3 py-2.5 text-right font-medium text-foreground">
//               {Number(value(row, "TX_COMPNT_AMT_1") ?? 0).toFixed(2)}
//             </td>

//             <td className="px-3 py-2.5 text-right font-semibold text-primary">
//               {Number(value(row, "TX_COMPNT_LCURAMT_1") ?? 0).toFixed(2)}
//             </td>
            
//             <td className="px-3 py-1.5 text-right">
//               <input
//                 type="number" 
//                 min="0" 
//                 step="0.01"
//                 className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
//                 value={String(value(row, "cost_rate") ?? 0)}
//                 onChange={(e) => handleActivityRateChange(row, "cost_rate", e.target.value)}
//               />
//             </td>
            
//             <td className="px-3 py-1.5">
//               <LookupField
//                 compact
//                 value={String(value(row, "TX_COMPNTCAT_CODE_1_COST") || "")}
//                 displayValue={String(value(row, "TX_COMPNTCAT_CODE_1_COST") || "")}
//                 columns={[
//                   { field: "TX_COMPNTCAT_CODE", header: "Code" },
//                   { field: "TX_COMPNTCAT_NAME", header: "Description" },
//                 ]}
//                 valueField="TX_COMPNTCAT_CODE"
//                 displayFields={["TX_COMPNTCAT_NAME"]}
//                 loadOptions={async (query) => {
//                   if (txCompntcatCode1Loading) return [];
//                   if (!query) return txCompntcatCode1Data;
//                   const term = query.toLowerCase();
//                   return txCompntcatCode1Data.filter(
//                     (r) =>
//                       String(r.TX_COMPNTCAT_CODE ?? "").toLowerCase().includes(term) ||
//                       String(r.TX_COMPNTCAT_NAME ?? "").toLowerCase().includes(term)
//                   );
//                 }}
//                 onChange={(_val, selectedRow) => handleTaxCompntcatSelect(row, "cost", selectedRow)}
//                 placeholder="Select tax code"
//               />
//             </td>
            
//             <td className="px-3 py-1.5">
//               <LookupField
//                 compact
//                 value={String(value(row, "TX_CAT_CODE_COST") || "")}
//                 displayValue={String(value(row, "TX_CAT_CODE_COST") || "")}
//                 columns={[
//                   { field: "TX_CAT_CODE", header: "Code" },
//                   { field: "TX_CAT_NAME", header: "Description" },
//                 ]}
//                 valueField="TX_CAT_CODE"
//                 displayFields={["TX_CAT_NAME"]}
//                 loadOptions={async (query) => {
//                   if (taxCategoryLoading) return [];
//                   if (!query) return taxCategoryData;
//                   const term = query.toLowerCase();
//                   return taxCategoryData.filter(
//                     (r) =>
//                       String(r.TX_CAT_CODE ?? "").toLowerCase().includes(term) ||
//                       String(r.TX_CAT_NAME ?? "").toLowerCase().includes(term)
//                   );
//                 }}
//                 onChange={(_val, selectedRow) => handleTaxCategorySelect(row, "cost", selectedRow)}
//                 placeholder="Select tax category"
//               />
//             </td>
            
//             <td className="px-3 py-1.5 text-right">
//               <input
//                 type="number" 
//                 min="0" 
//                 max="100"
//                 step="0.01"
//                 className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
//                 value={String(value(row, "TX_COMPNT_PERC_1_COST") ?? 0)}
//                 onChange={(e) => handleActivityRateChange(row, "TX_COMPNT_PERC_1_COST", e.target.value)}
//               />
//             </td>
            
//             <td className="px-3 py-2.5 text-right font-medium text-foreground">
//               {Number(value(row, "TX_COMPNT_AMT_1_COST") ?? 0).toFixed(2)}
//             </td>
            
//             <td className="px-3 py-2.5 text-right font-semibold text-primary">
//               {Number(value(row, "TX_COMPNT_LCURAMT_1_COST") ?? 0).toFixed(2)}
//             </td>
            
//             <td className="px-3 py-2.5">
//               <input
//                 type="text"
//                 className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
//                 value={String(value(row, "other_services") || "")}
//                 onChange={(e) => {
//                   const val = e.target.value;
//                   setActivityRows((cur) => {
//                     const next = cur.map((r, idx) => (idx === i ? { ...r, other_services: val } : r));
//                     const updatedRow = next[i];
//                     const key = String(value(updatedRow, "act_code") || `row_${i}`);
//                     setActivityEdited((prevEdited) => ({ ...prevEdited, [key]: updatedRow }));
//                     return next;
//                   });
//                 }}
//               />
//             </td>
//           </tr>
//         ))
//       )}
//     </tbody>
    
//     {activityRows.length > 0 && (
//       <tfoot className="border-t bg-primary/5">
//         <tr>
//           <td className="col-activity col-activity-total bg-primary/5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-primary shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
//             Total
//           </td>
//           <td className="col-quantity col-quantity-total bg-primary/5 px-3 py-2.5 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]" />
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
//             {activityTotals.totalBill.toFixed(2)}
//           </td>
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
//             {activityTotals.totalTax.toFixed(2)}
//           </td>
//           <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
//             {activityTotals.totalAmount.toFixed(2)}
//           </td>
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5" />
//           <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
//             {activityTotals.totalCostTax.toFixed(2)}
//           </td>
//           <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
//             {activityTotals.totalCostAmount.toFixed(2)}
//           </td>
//           <td className="px-3 py-2.5" />
//         </tr>
//       </tfoot>
//     )}
//   </table>
// </div>
//       {/* ── Footer bar (matches DataTable's "Showing X-Y of Z" footer) ── */}
//       <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
//         <span>Showing {activityRows.length === 0 ? 0 : 1}-{activityRows.length} of {activityRows.length}</span>
//         {Object.keys(activityEdited).length > 0 && (
//           <span className="font-medium text-primary">{Object.keys(activityEdited).length} unsaved change(s)</span>
//         )}
//       </div>
//     </section>
//   );
// }

if (isActivityBilling) {
  return (
    <ActivityBillingSection
      companyCode={companyCode}
      prinCode={prinCode}
      jobNo={jobNo}
      isActivityBilling={isActivityBilling}
      activityLoading={activityLoading}
      activitySaving={activitySaving}
      activityRows={activityRows}
      setActivityRows={setActivityRows}
      activityEdited={activityEdited}
      setActivityEdited={setActivityEdited}
      activityTotals={activityTotals}
      loadActivityBilling={loadActivityBilling}
      handleActivityBillingSubmit={handleActivityBillingSubmit}
      executeWmsInboundSql={executeWmsInboundSql}
    />
  );
}

if (!config) return (
  <Card><CardContent className="p-6 text-sm text-muted-foreground">This tab is not configured yet.</CardContent></Card>
);
    // ── action button ────────────────────────────────────────────────────────
    const getActionButton = () => {
      switch (tab) {
        case "putway_hht":
          return <Button size="sm" variant="outline" onClick={openHhtPutawayModal}><Truck size={14} /> Process HHT Putaway</Button>;
        case "quality_clearance":
          return <Button size="sm" variant="outline" onClick={() => setProcessOpen(true)} disabled={selectedRows.length === 0}><Settings2 size={14} /> Process Clearance</Button>;
        case "putway_details":
          return <Button size="sm" variant="outline" onClick={openPutawayModal} disabled={selectedRows.length === 0}><Truck size={14} /> Process Putaway</Button>;
          case "packing_details":
  return (
    <>
      <Button size="sm" variant="outline" onClick={openAddModal}>
        <Plus size={14} /> {config.addLabel || `Add ${config.title}`}
      </Button>
      <Button size="sm" variant="outline" onClick={openEdiImportModal}>
        <Upload size={14} /> Import EDI
      </Button>
    </>
  )
        case "job_confirmation":
          return <Button size="sm" variant="outline" onClick={() => setProcessOpen(true)} disabled={selectedRows.length === 0}><CheckCircle2 size={14} /> Process Confirm Selected</Button>;
        case "receiving_details":
          return null;
        case "tally_details":
          return <Button size="sm" variant="outline" onClick={openAddModal}><Plus size={14} /> Add Tally Detail</Button>;
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
          prin_code: prinCode, job_no: jobNo, company_code: companyCode,
        });
        setRows((prev) => prev.filter((r) => value(r, "packdet_no") !== value(row, "packdet_no")));
        toast.success("Record deleted successfully");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Delete failed";
        setModalNotice(msg); toast.error(msg);
      }
    };

    const columns = makeColumns(
      config.columns,
      tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation",
      (tab === "packing_details" || tab === "receiving_details")
        ? (row: any) => {
            if (tab === "packing_details") {
              setEditForm({ ...row, uom_count: Number(row.uom_count ?? 1), uppp: Number(row.uppp ?? 1), qty_puom: Number(row.qty_puom ?? 0), qty_luom: Number(row.qty_luom ?? 0), quantity: Number(row.quantity ?? 0) });
                } else {
                  setEditForm({
                    packdet_no: row.packdet_no, prod_name: row.prod_name,
                    batch_no: row.batch_no, lot_no: row.lot_no, po_no: row.po_no, doc_ref: row.doc_ref,
                    qty_luom: Number(row.qty_luom ?? 0),
                    qty_puom: Number(row.qty_puom ?? 0),          // ← packed/expected qty
                    p_uom: String(row.p_uom || row.puom || ""),   // ← UOM for display
                    qty1_arrived: getReceivedQty(row), qty2_arrived: Number(row.qty2_arrived ?? 0),
                  });
                }
            setEditOpen(true);
          }
        : undefined,
      tab === "packing_details" ? handleDelete : undefined,
    );

    // ── tally qty/batch/date shared block ────────────────────────────────────
    const renderTallyQtyBatchDateFields = () => {
      const setQty = (field: "pda_qty_puom" | "pda_qty_luom") => (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setAddForm((cur: any) => {
          const next    = { ...cur, [field]: raw === "" ? "" : Number(raw) };
          const uppp    = Number(cur.uppp ?? 1);
          const qtyPuom = Number(field === "pda_qty_puom" ? (raw === "" ? 0 : raw) : cur.pda_qty_puom ?? 0);
          const qtyLuom = Number(field === "pda_qty_luom" ? (raw === "" ? 0 : raw) : cur.pda_qty_luom ?? 0);
          next.quantity = qtyPuom * uppp + qtyLuom;
          return next;
        });
      };
      return (
        <>
          <div className="grid gap-3">
            <SectionHeader icon={Hash} label="Quantity & UOM" caption="Pre-filled from product — edit if needed" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Quantity (Primary)</span>
                <Input type="number" min="0" value={String(addForm.pda_qty_puom ?? 0)} onChange={setQty("pda_qty_puom")} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Quantity (Lowest)</span>
                <Input type="number" min="0" value={String(addForm.pda_qty_luom ?? 0)} onChange={setQty("pda_qty_luom")} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Total Quantity</span>
                <Input type="number" disabled value={String(addForm.quantity ?? 0)} className="bg-muted text-muted-foreground" /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">UOM</span>
                <Input disabled value={[addForm.pda_puom, addForm.pda_luom].filter(Boolean).join(" / ") || "—"} className="bg-muted text-muted-foreground" /></label>
            </div>
          </div>
          <div className="grid gap-3">
            <SectionHeader icon={FileText} label="Batch & Lot" caption="Traceability references" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Batch No.</span>
                <Input value={String(addForm.batch_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, batch_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Lot No.</span>
                <Input value={String(addForm.lot_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, lot_no: e.target.value }))} /></label>
            </div>
          </div>
          <div className="grid gap-3">
            <SectionHeader icon={CalendarDays} label="Dates" caption="Production and expiry" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label className="field"><span className="text-xs font-medium text-muted-foreground">Production Date</span>
  <Input type="date" value={String(addForm.mfg_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, mfg_date: e.target.value }))} /></label>
<label className="field"><span className="text-xs font-medium text-muted-foreground">Expiry Date</span>
  <Input type="date" min={todayDateStr} value={String(addForm.exp_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, exp_date: e.target.value }))} /></label>
            </div>
          </div>
        </>
      );
    };

    // ── tally sections ───────────────────────────────────────────────────────
    const renderTallySections = () => {
      const tallyContainerLp = getLookupProps({ name: "container_no", lookup: "tally_container" } as any)!;
      const tallyProductLp   = getLookupProps({ name: "prod_code",    lookup: "tally_product"   } as any)!;
      const productField = (
        <label className="field">
          <span className="text-xs font-medium text-muted-foreground">Product / SKU <strong className="text-destructive">*</strong></span>
          <LookupField label="Product / SKU" compact value={String(addForm.prod_code || "")} displayValue={String(addForm.prod_name || "")}
            valueField={tallyProductLp.valueField} displayFields={tallyProductLp.displayFields}
            columns={tallyProductLp.columns} loadOptions={tallyProductLp.loadOptions} onChange={tallyProductLp.onChange} />
        </label>
      );
      return (
        <div className="grid gap-4">
          <div className="flex gap-1 border-b">
            {([ ["pallet", "Pallet Wise"], ["product", "Product/SKU Wise"], ["serial", "Serial Wise"] ] as [TallySubTab, string][]).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTallySubTab(key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tallySubTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          {tallySubTab === "pallet" && (
            <div className="grid gap-3">
              <SectionHeader icon={Package} label="Pallet Information" caption="Pallet, container and product" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="field"><span className="text-xs font-medium text-muted-foreground">Pallet ID <strong className="text-destructive">*</strong></span>
                  <Input autoFocus maxLength={10} value={String(addForm.pallet_id || "")} onChange={(e) => setAddForm((c) => ({ ...c, pallet_id: e.target.value }))} /></label>
                <label className="field"><span className="text-xs font-medium text-muted-foreground">Container No. <strong className="text-destructive">*</strong></span>
                  <LookupField label="Container No." compact value={String(addForm.container_no || "")} displayValue={String(addForm.container_no || "")}
                    valueField={tallyContainerLp.valueField} displayFields={tallyContainerLp.displayFields}
                    columns={tallyContainerLp.columns} loadOptions={tallyContainerLp.loadOptions} onChange={tallyContainerLp.onChange} /></label>
                {productField}
              </div>
            </div>
          )}
          {tallySubTab === "product" && (
            <div className="grid gap-3">
              <SectionHeader icon={Package} label="Product Information" caption="Select product and enter quantities" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{productField}</div>
            </div>
          )}
          {tallySubTab === "serial" && (
            <div className="grid gap-3">
              <SectionHeader icon={Barcode} label="Serial Information" caption="Scan or enter serial number" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {productField}
                <label className="field col-span-2"><span className="text-xs font-medium text-muted-foreground">Serial No. <strong className="text-destructive">*</strong></span>
                  <Input autoFocus placeholder="Scanning barcode.........." value={String(addForm.serial_no || "")}
                    onChange={(e) => setAddForm((c) => ({ ...c, serial_no: e.target.value }))} /></label>
              </div>
            </div>
          )}
          {renderTallyQtyBatchDateFields()}
        </div>
      );
    };

    // ── packing details sections ─────────────────────────────────────────────
    const renderPackingDetailsSections = () => {
      const containerLp = getLookupProps({ name: "container_no", lookup: "container" } as any) as LookupProps;
      const productLp   = getLookupProps({ name: "prod_code",    lookup: "product"   } as any) as LookupProps;
      const manufacturerLp = getLookupProps({ name: "manufacturer", lookup: "manufacturer" } as any) as LookupProps;

      const pUom      = String(addForm.p_uom    || "");
      const lUom      = String(addForm.l_uom    || "");
      const uomCount  = Number(addForm.uom_count ?? 1);
      const uppp      = Number(addForm.uppp      ?? 1);
      const lDisabled = uomCount <= 1;
      const uomSummary = pUom
        ? `${pUom}${uppp > 1 ? ` × ${uppp}` : ""}${!lDisabled && lUom ? ` + ${lUom}` : ""}`
        : "—";
      const prodNameStr = String(addForm.prod_name || "");

      // Shared section header — identical styling to before
      const SH = ({ icon: Icon, eyebrow, title }: { icon: any; eyebrow: string; title: string }) => (
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={14} /></div>
          <div>
            <p className="m-0 text-[9px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
            <p className="m-0 text-xs font-semibold text-foreground leading-tight">{title}</p>
          </div>
        </div>
      );

      return (
        // 2-column grid of sections — each section is self-contained with its own border/bg
        <div className="grid grid-cols-2 gap-3">

          {/* ── Section 1: Container & Product (full width) ── */}
          <section className="col-span-2 rounded-md border bg-card shadow-sm">
            <SH icon={Package} eyebrow="Packing Information" title="Container & Product" />
            <div className="grid grid-cols-2 gap-2.5 p-2.5">
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Container No <strong className="text-destructive">*</strong></span>
                <LookupField label="Container No" compact
                  value={String(addForm.container_no || "")} displayValue={String(addForm.container_no || "")}
                  valueField={containerLp.valueField} displayFields={containerLp.displayFields}
                  columns={containerLp.columns} loadOptions={containerLp.loadOptions} onChange={containerLp.onChange} />
              </label>
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Product / SKU <strong className="text-destructive">*</strong></span>
                <LookupField label="Product / SKU" compact
                  value={String(addForm.prod_code || "")}
                  displayValue={prodNameStr ? `${String(addForm.prod_code || "")} - ${prodNameStr}` : String(addForm.prod_code || "")}
                  valueField={productLp.valueField} displayFields={productLp.displayFields}
                  columns={productLp.columns} loadOptions={productLp.loadOptions} onChange={productLp.onChange} />
              </label>
            </div>
          </section>

          {/* ── Section 2: Quantity & UOM ── */}
          <section className="rounded-md border bg-card shadow-sm">
            <SH icon={Hash} eyebrow="Quantity & UOM" title="Primary, Lowest & Total" />
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 p-2.5">
              {/* Primary Qty */}
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Qty (Primary) <strong className="text-destructive">*</strong></span>
                <div className="relative flex h-8 overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary/40">
                  <input style={{paddingBottom: '8px'}} type="number" min="0" placeholder="0"
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                    value={String(addForm.qty_puom ?? "")}
                    onChange={(e) => setAddForm((c) => ({ ...c, ...recalcQuantity(c, "qty_puom", e.target.value) }))} />
                  {pUom && <span className="flex items-center border-l bg-muted/50 px-2 text-xs font-semibold text-muted-foreground">{pUom}</span>}
                </div>
              </label>
              {/* Lowest Qty */}
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">
                  Qty (Lowest){!lDisabled && <strong className="text-destructive"> *</strong>}
                </span>
                <div className={`relative flex h-8 overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary/40 ${lDisabled ? "opacity-50" : ""}`}>
                  <input style={{paddingBottom: '8px'}} type="number" min="0" disabled={lDisabled}
                    className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed"
                    placeholder={lDisabled ? "Same UOM" : "0"}
                    value={lDisabled ? "0" : String(addForm.qty_luom ?? "")}
                    onChange={(e) => { if (!lDisabled) setAddForm((c) => ({ ...c, ...recalcQuantity(c, "qty_luom", e.target.value) })); }} />
                  {lUom && <span className="flex items-center border-l bg-muted/50 px-2 text-xs font-semibold text-muted-foreground">{lUom}</span>}
                </div>
                {lDisabled && pUom && <p className="mt-0.5 text-[10px] text-muted-foreground">P &amp; L UOM both {pUom}</p>}
              </label>
              {/* Total Qty */}
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Total Quantity</span>
                <div className="relative flex h-8 overflow-hidden rounded-md border bg-muted/40">
                  <input style={{paddingBottom: '8px'}} type="number" readOnly
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none"
                    value={String(addForm.quantity ?? 0)} />
                  {(lUom || pUom) && <span className="flex items-center border-l bg-muted/60 px-2 text-xs font-semibold text-muted-foreground">{lUom || pUom}</span>}
                </div>
              </label>
              {/* UOM Details */}
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">UOM Details</span>
                <Input readOnly className="h-8 bg-muted/40 font-mono text-xs text-muted-foreground" value={uomSummary} />
              </label>
            </div>
          </section>

          {/* ── Section 3: References ── */}
          <section className="rounded-md border bg-card shadow-sm">
            <SH icon={FileText} eyebrow="References" title="Batch, Lot & Order References" />
            <div className="grid grid-cols-3 gap-2.5 p-2.5">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Batch No</span>
                <Input className="h-8" value={String(addForm.batch_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, batch_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Lot No</span>
                <Input className="h-8" value={String(addForm.lot_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, lot_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">PO No</span>
                <Input className="h-8" value={String(addForm.po_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, po_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">BL No</span>
                <Input className="h-8" value={String(addForm.bl_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, bl_no: e.target.value }))} /></label>
              <label className="field col-span-2"><span className="text-xs font-medium text-muted-foreground">Doc Ref</span>
                <Input className="h-8" value={String(addForm.doc_ref || "")} onChange={(e) => setAddForm((c) => ({ ...c, doc_ref: e.target.value }))} /></label>
            </div>
          </section>


          {/* ── Section 4: Dates & Shelf Life (full width) ── */}
          <section className="col-span-2 rounded-md border bg-card shadow-sm">
            <SH icon={CalendarDays} eyebrow="Dates & Shelf Life" title="Production, Expiry & Shelf Life" />
            <div className="grid grid-cols-4 gap-2.5 px-2.5 py-2">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Production Date</span>
                <Input className="h-8" type="date" value={String(addForm.mfg_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, mfg_date: e.target.value }))} /></label>
<label className="field"><span className="text-xs font-medium text-muted-foreground">Expiry Date</span>
  <Input className="h-8" type="date" min={todayDateStr} value={String(addForm.exp_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, exp_date: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Shelf Life (Date)</span>
                <Input className="h-8" type="date" value={String(addForm.shelf_life_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, shelf_life_date: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Shelf Life Days</span>
                <Input className="h-8" type="number" min="0" value={String(addForm.shelf_life_days ?? "")} onChange={(e) => setAddForm((c) => ({ ...c, shelf_life_days: e.target.value }))} /></label>
            </div>

          </section>

        </div>
      );
    };


    // ── manual putaway sections ──────────────────────────────────────────────
    const renderManualPutawaySections = () => {
      const containerLp = getLookupProps({ name: "container_no",  lookup: "container" } as any) as LookupProps;
      const productLp   = getLookupProps({ name: "prod_code",     lookup: "product"   } as any) as LookupProps;
      const siteLp      = getLookupProps({ name: "site_code",     lookup: "site"      } as any) as LookupProps;
      const locationLp  = getLookupProps({ name: "location_code", lookup: "location"  } as any) as LookupProps;
      const uomDetails  = addForm.p_uom
        ? `${addForm.p_uom}${addForm.uppp ? ` × ${addForm.uppp}` : ""}${Number(addForm.uom_count) > 1 && addForm.l_uom ? ` + ${addForm.l_uom}` : ""}`
        : "—";
      return (
        <div className="grid gap-5">
          <div className="grid gap-3">
            <SectionHeader icon={Package} label="Product Information" caption="Container, SKU and pallet details" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Container No. <strong className="text-destructive">*</strong></span>
                <LookupField label="Container No." compact value={String(addForm.container_no || "")} displayValue={String(addForm.container_no || "")}
                  valueField={containerLp.valueField} displayFields={containerLp.displayFields} columns={containerLp.columns} loadOptions={containerLp.loadOptions} onChange={containerLp.onChange} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Product / SKU <strong className="text-destructive">*</strong></span>
                <LookupField label="Product / SKU" compact value={String(addForm.prod_code || "")} displayValue={String(addForm.prod_code || "")}
                  valueField={productLp.valueField} displayFields={productLp.displayFields} columns={productLp.columns} loadOptions={productLp.loadOptions} onChange={productLp.onChange} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Product Name</span>
                <Input disabled value={String(addForm.prod_name || "")} className="bg-muted text-muted-foreground" /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Pallet ID</span>
                <Input   maxLength={10} value={String(addForm.pallet_id || "")} onChange={(e) => setAddForm((c) => ({ ...c, pallet_id: e.target.value }))} /></label>
            </div>
          </div>
          <div className="grid gap-3">
            <SectionHeader icon={Hash} label="Quantity & UOM" caption="Primary, lowest unit and total quantity" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Quantity 1 (Primary) <strong className="text-destructive">*</strong></span>
                <Input type="number" min="0" value={String(addForm.qty_puom ?? "")} onChange={(e) => setAddForm((c) => ({ ...c, ...recalcQuantity(c, "qty_puom", e.target.value) }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Quantity 2 (Lowest)</span>
                <Input type="number" min="0" disabled={Number(addForm.uom_count ?? 1) <= 1} value={String(addForm.qty_luom ?? "")} onChange={(e) => setAddForm((c) => ({ ...c, ...recalcQuantity(c, "qty_luom", e.target.value) }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Total Quantity</span>
                <Input type="number" disabled value={String(addForm.quantity ?? 0)} className="bg-muted text-muted-foreground" /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">UOM Details</span>
                <Input disabled value={uomDetails} className="bg-muted text-muted-foreground" /></label>
            </div>
          </div>
          <div className="grid gap-3">
            <SectionHeader icon={MapPin} label="Putaway Location" caption="Destination site and location" />
            <div className="grid grid-cols-2 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Site Code <strong className="text-destructive">*</strong></span>
                <LookupField label="Site Code" compact value={String(addForm.site_code || "")} displayValue={String(addForm.site_code_display || "")}
                  valueField={siteLp.valueField} displayFields={siteLp.displayFields} columns={siteLp.columns} loadOptions={siteLp.loadOptions} onChange={siteLp.onChange} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Location Code <strong className="text-destructive">*</strong></span>
                <LookupField label="Location Code" compact value={String(addForm.location_code || "")} displayValue={String(addForm.location_code_display || "")}
                  valueField={locationLp.valueField} displayFields={locationLp.displayFields} columns={locationLp.columns} loadOptions={locationLp.loadOptions} onChange={locationLp.onChange} /></label>
            </div>
          </div>
          <div className="grid gap-3">
            <SectionHeader icon={FileText} label="Batch & References" caption="Traceability and order references" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Batch No.</span><Input value={String(addForm.batch_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, batch_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Lot No.</span><Input value={String(addForm.lot_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, lot_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">PO No.</span><Input value={String(addForm.po_no || "")} onChange={(e) => setAddForm((c) => ({ ...c, po_no: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Doc Ref.</span><Input value={String(addForm.doc_ref || "")} onChange={(e) => setAddForm((c) => ({ ...c, doc_ref: e.target.value }))} /></label>
            </div>
          </div>
          <div className="grid gap-3">
            <SectionHeader icon={CalendarDays} label="Dates & Shelf Life" caption="Manufacturing, expiry and shelf life" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Manufacturing Date</span><Input type="date" value={String(addForm.mfg_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, mfg_date: e.target.value }))} /></label>
<label className="field"><span className="text-xs font-medium text-muted-foreground">Expiry Date</span>
  <Input type="date" min={todayDateStr} value={String(addForm.expiry_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, expiry_date: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Shelf Life (Date)</span><Input type="date" value={String(addForm.shelf_life_date || "")} onChange={(e) => setAddForm((c) => ({ ...c, shelf_life_date: e.target.value }))} /></label>
              <label className="field"><span className="text-xs font-medium text-muted-foreground">Shelf Life Days</span><Input type="number" min="0" value={String(addForm.shelf_life_days ?? "")} onChange={(e) => setAddForm((c) => ({ ...c, shelf_life_days: e.target.value }))} /></label>
            </div>
          </div>
        </div>
      );
    };

    // ── field renderer (generic fallback) ────────────────────────────────────
    const renderField = (field: FormField, formData: WmsRow, setData: (u: (c: WmsRow) => WmsRow) => void, isEdit = false) => {
      if (field.lookup) {
        const lp = getLookupProps(field, isEdit);
        if (!lp) return null;
        return (
          <LookupField label={field.label} compact
            value={String(formData[field.name] || "")} displayValue={String(formData[`${field.name}_display`] || "")}
            valueField={lp.valueField} displayFields={lp.displayFields} columns={lp.columns} loadOptions={lp.loadOptions}
            onChange={isEdit
              ? (val, row) => {
                  if      (field.name === "prod_code")    setData((c) => ({ ...c, prod_code:   val, uom: row ? String(row["UOM_CODE"] ?? c.uom ?? "") : String(c.uom ?? "") }));
                  else if (field.name === "container_no") setData((c) => ({ ...c, container_no: val }));
                  else if (field.name === "manufacturer") setData((c) => ({ ...c, manufacturer: val, manufacturer_display: row ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}` : "" }));
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
            {field.dropdown.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </Select>
        );
      }
      if (field.name === "qty_puom") return <Input type="number" min="0" value={String(formData.qty_puom ?? "")} onChange={(e) => setData((c) => ({ ...c, ...recalcQuantity(c, "qty_puom", e.target.value) }))} />;
      if (field.name === "qty_luom") return <Input type="number" min="0" disabled={Number(formData.uom_count ?? 1) <= 1} value={String(formData.qty_luom ?? "")} onChange={(e) => setData((c) => ({ ...c, ...recalcQuantity(c, "qty_luom", e.target.value) }))} />;
      if (field.disabled || field.name === "quantity") return <Input type="number" disabled value={String(formData.quantity ?? 0)} className="bg-muted text-muted-foreground" />;
        if (field.name === "exp_date") {
    return (
      <Input
        type="date"
        min={todayDateStr}
        value={String(formData.exp_date || "")}
        onChange={(e) => setData((c) => ({ ...c, exp_date: e.target.value }))}
      />
    );
  }
      return <Input type={field.type || "text"} value={String(formData[field.name] || "")} onChange={(e) => setData((c) => ({ ...c, [field.name]: e.target.value }))} />;
    };

    const parseDate = (v: string): Date | undefined => {
  const t = v?.trim();
  if (!t) return undefined;
  const d = new Date(t);
  return isNaN(d.getTime()) ? undefined : d;
};
const parseNumber = (v: any): number | undefined => {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
};
const safeTrim = (v: any): string | undefined =>
  v === null || v === undefined ? undefined : String(v).trim();

const transformPackDetailEDI = (rawData: any[]) =>
  rawData.map((row: any, index: number) => ({
    user_id:      String(user?.USERNAME || user?.username || ""),
    company_code: companyCode,
    prin_code:    safeTrim(row["prin_code"]) || prinCode,
    job_no:       safeTrim(row["job_no"]) || jobNo,
    packdet_no:   index + 1,
    container_no: safeTrim(row["Container no"]),
    vessel_name:  safeTrim(row["Vessel name"]),
    voyage_no:    safeTrim(row["Voyage no"]),
    product_code: safeTrim(row["Product code"]) || "",
    puom:         safeTrim(row["Primary UOM"]),
    qty_puom:     parseNumber(row["Primary Qty"]),
    luom:         safeTrim(row["Lowest UOM"]),
    qty_luom:     parseNumber(row["Lowest Qty"]),
    unit_price:   parseNumber(row["Rate"]),
    curr_code:    safeTrim(row["currency"]),
    lot_no:       safeTrim(row["lot no"]),
    mfg_date:     parseDate(row["mfg date"]),
    exp_date:     parseDate(row["exp date"]),
    manu_code:    safeTrim(row["manu"]),
    origin_country: safeTrim(row["origin country"]),
    from_site:    row["site code"] !== undefined ? String(row["site code"]) : undefined,
    location_from: safeTrim(row["location code"]),
    batch_no:     safeTrim(row["BATCH_NO"]),
    po_no:        safeTrim(row["PO NO"]),
    created_by:   "SYSTEM",
    updated_by:   "SYSTEM",
  }));

const getEdiUniqueKey = (row: any) =>
  `${row.product_code || ""}|${row.container_no || ""}|${row.lot_no || ""}|${row.po_no || ""}`;

const mergeEdiValidation = (original: any[], validated: any[]) => {
  if (!validated?.length) return original;
  const map = new Map(validated.map((v) => [getEdiUniqueKey(v), v]));
  return original.map((row) => {
    const v = map.get(getEdiUniqueKey(row));
    return v ? { ...row, error_msg: v.error_msg ?? v.ERROR_MSG ?? null } : row;
  });
};

const getEdiErrorCount = () => ediTempData.filter((r) => r.error_msg).length;
const getEdiValidCount = () => ediTempData.filter((r) => !r.error_msg).length;

const getEdiErrorSummary = () => {
  const counts: Record<string, number> = {};
  ediTempData.forEach((r) => {
    if (!r.error_msg) return;
    String(r.error_msg).split(/[.;]/).map((s) => s.trim()).filter(Boolean)
      .forEach((msg) => { counts[msg] = (counts[msg] || 0) + 1; });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([message, count]) => ({ message, count }));
};

const getEdiErrorFixSuggestion = (msg: string): string => {
  if (msg.includes("Invalid PROD_CODE")) return "Product code doesn't exist — check the product master list.";
  if (msg.includes("Invalid P_UOM"))      return "Primary UOM must be a valid code (e.g. PC, BOX, KG, CTN).";
  if (msg.includes("Invalid L_UOM"))      return "Loose UOM must be a valid code (e.g. PC, BOX, KG, CTN).";
  if (msg.includes("Invalid MANU_CODE"))  return "Manufacturer code doesn't exist in the system.";
  return "Verify the data format matches system requirements.";
};

const handleDownloadEdiTemplate = () => {
  const templateData = [{
    "Product code": "BM0001", P_UOM: "PC", QTY_PUOM: "10", L_UOM: "PC", QTY_LUOM: "1",
    "Container no": "CONT001", "Vessel name": "VESSEL1", "Voyage no": "VOY001",
    "Po No": "PO001", "lot no": "LOT001", "mfg date": "2023-01-01", "exp date": "2024-01-01",
    manu: "MANU001", "origin country": "OMN", "site code": "1", "location code": "A-01-01",
    currency: "OMR", Rate: "0",
  }];
  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PackingTemplate");
  XLSX.writeFile(wb, "PackingDetails_Template.xlsx");
};



const handleEdiFileUpload = async () => {
  if (!ediImportFile) return;
  setEdiLoading(true);
  try {
    const buf = await ediImportFile.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const ediData = transformPackDetailEDI(jsonData);
    setEdiTempData(ediData);

    await api.put("/api/wms/inbound/upsertPackDetailEDIHandler", ediData);

    const userId = String(user?.USERNAME || user?.username || "");
    const query = new URLSearchParams({ job_no: jobNo, prin_code: prinCode, company_code: companyCode, user_id: userId }).toString();
    const res = await api.get(`/api/wms/inbound/getEDIPackdetHandler?${query}`);
    const validated = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    if (validated.length) setEdiTempData(mergeEdiValidation(ediData, validated));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to process EDI file");
  } finally {
    setEdiLoading(false);
  }
};

const handleEdiSave = async () => {
  setEdiLoading(true);
  try {
    const userId = String(user?.USERNAME || user?.username || "");
    await api.post("/api/wms/inbound/copyEDIToPackdetHandler", {
      login_id: userId, job_no: jobNo, prin_code: prinCode, company_code: companyCode,
    });
    toast.success("EDI data imported successfully");
    setEdiImportOpen(false); setEdiImportFile(null); setEdiTempData([]);
    await loadRows();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to save EDI data");
  } finally {
    setEdiLoading(false);
  }
};

const ediPreviewColumns = makeColumns(
  [
    { key: "product_code", label: "Product Code" },
    { key: "container_no", label: "Container No" },
    { key: "puom",         label: "P UOM" },
    { key: "qty_puom",     label: "Qty (Primary)" },
    { key: "luom",         label: "L UOM" },
    { key: "qty_luom",     label: "Qty (Lowest)" },
    { key: "batch_no",     label: "Batch No" },
    { key: "lot_no",       label: "Lot No" },
    { key: "po_no",        label: "PO No" },
    { key: "error_msg",    label: "Error" },
  ],
  false, // no checkbox column
);

    // ── render ───────────────────────────────────────────────────────────────
    return (
      <section className="grid gap-3">
        <DataTable
          key={tab}
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
                  ? "opacity-50 pointer-events-none bg-muted/40" : ""
              : undefined
          }
          getRowId={(row, index) => `${tab}_${value(row, "packdet_no") || value(row, "container_no") || value(row, "key_number") || index}`}
          onRowSelectionChange={
            (tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation")
              ? (selected) => {
                  if (tab === "quality_clearance") {
                    setSelectedRows(selected.filter((r) => String(value(r, "clearance") || "").toUpperCase() !== "Y"));
                  } else {
                    setSelectedRows(selected);
                  }
                }
              : undefined
          }
        />

        {/* ── Add Modal ── */}
        <Dialog wide open={addOpen}
          title={isTallyDetails ? "Add Tally Detail" : (config.addLabel || `Add ${config.title}`)}
          description={isTallyDetails ? "Fill in the details to add a new tally details record." : `Fill in the details to add a new ${config.title.toLowerCase()} record.`}
          onClose={() => setAddOpen(false)}
        >
          <form className="grid gap-2" onSubmit={saveAdd}>
            {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
            {isManualPutaway
              ? renderManualPutawaySections()
              : isTallyDetails
              ? renderTallySections()
              : isPackingDetails
              ? renderPackingDetailsSections()
              : (
                <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                  {(config.addFields ?? []).map((field: any) => (
                    <label key={field.name} className={field.name === "remarks" || field.name === "description1" ? "field col-span-2 md:col-span-3" : "field"}>
                      <span className="text-xs font-medium text-muted-foreground">
                        {field.label}{field.required && <strong className="text-destructive"> *</strong>}
                      </span>
                      {renderField(field, addForm, setAddForm, false)}
                    </label>
                  ))}
                </div>
              )
            }
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}><X size={15} /> Cancel</Button>
              <Button disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </Dialog>
{tab === "packing_details" && (
  <Dialog wide open={ediImportOpen} title="Import Packing Details (EDI)"
    description={ediTempData.length ? `${ediTempData.length} records parsed from file` : "Upload a .csv or .xlsx file to bulk-import packing details"}
    onClose={() => { setEdiImportOpen(false); setEdiImportFile(null); setEdiTempData([]); }}
  >
    <div className="grid gap-4">
      {!ediTempData.length ? (
        <div className="grid gap-4">
          {/* Dropzone */}
          <label
            htmlFor="edi-file-input"
            onDragOver={(e) => { e.preventDefault(); setEdiDragActive(true); }}
            onDragLeave={() => setEdiDragActive(false)}
            onDrop={(e) => {
              e.preventDefault(); setEdiDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) setEdiImportFile(file);
            }}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors
              ${ediDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20 hover:border-primary/50 hover:bg-muted/30"}`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {ediImportFile ? "Change file" : "Click to upload or drag & drop"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Supports .csv and .xlsx</p>
            </div>
            {ediImportFile && (
              <span className="mt-1 flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                <FileSpreadsheet size={13} className="text-primary" />
                {ediImportFile.name}
              </span>
            )}
            <input id="edi-file-input" type="file" accept=".csv,.xlsx" className="hidden"
              onChange={(e) => setEdiImportFile(e.target.files?.[0] || null)} />
          </label>

          <div className="flex items-center justify-between">
            <button type="button" onClick={handleDownloadEdiTemplate}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Download size={13} /> Download Template
            </button>
            <Button type="button" disabled={!ediImportFile || ediLoading} onClick={handleEdiFileUpload}>
              <Upload size={15} /> {ediLoading ? "Processing..." : "Upload & Validate"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileSpreadsheet size={16} />
            </span>
            <span className="text-sm font-semibold text-foreground">{ediTempData.length} records parsed</span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2Icon size={12} /> {getEdiValidCount()} valid
            </span>
            {getEdiErrorCount() > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                <AlertTriangle size={12} /> {getEdiErrorCount()} errors
              </span>
            )}
          </div>

          {getEdiErrorCount() > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-destructive">
                <AlertTriangle size={14} /> Validation issues found
              </div>
              <ul className="mt-1.5 grid gap-1 pl-1 text-xs text-muted-foreground">
                {getEdiErrorSummary().map((e, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="font-medium text-destructive">{e.message} ({e.count})</span>
                    <span>— {getEdiErrorFixSuggestion(e.message)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DataTable
            columns={ediPreviewColumns}
            data={ediTempData}
            title={`${ediTempData.length} Rows`}
            subtitle="EDI Preview"
            loading={ediLoading}
            height="340px"
            density="grid"
            rowClassName={(row: any) => (row.error_msg ? "bg-destructive/5" : "")}
            getRowId={(row: any, index: number) => `${row.product_code || "row"}_${index}`}
          />

          <div className="flex justify-between gap-2 pt-1">
            <button type="button" onClick={handleDownloadEdiTemplate}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Download size={13} /> Download Template
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline"
                onClick={() => { setEdiImportFile(null); setEdiTempData([]); }}>
                <X size={14} /> Start Over
              </Button>
              <Button type="button" disabled={ediLoading || getEdiValidCount() === 0} onClick={handleEdiSave}>
                <Save size={15} /> {ediLoading ? "Saving..." : `Save ${getEdiValidCount()} Valid Records`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  </Dialog>
)}
        {/* ── Edit Modal ── */}
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
                  {(config.addFields ?? []).map((field: any) => (
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
                {Number(editForm.qty_puom ?? 0) > 0 && (
                  <div className="col-span-2 mt-1 flex items-center gap-2 rounded-md bg-primary/8 border border-primary/20 px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">Expected Qty (Packed):</span>
                    <span className="font-semibold text-primary">
                      {Number(editForm.qty_puom)}
                      {editForm.p_uom ? ` ${String(editForm.p_uom)}` : ""}
                    </span>
                  </div>
                )}
              </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="field">
                      <span className="text-xs font-medium text-muted-foreground">Quantity (Primary) <strong className="text-destructive">*</strong></span>
                      <Input type="number" min="0" step="1" value={Number(editForm.qty1_arrived ?? 0)}
                        onChange={(e) => setEditForm((c: any) => ({ ...c, qty1_arrived: e.target.value === "" ? 0 : Number(e.target.value) }))} />
                    </label>
                    <label className="field">
                      <span className="text-xs font-medium text-muted-foreground">Quantity (Secondary)</span>
                      <Input type="number" min="0" step="1" disabled={Number(editForm.qty_luom ?? 0) === 0} value={Number(editForm.qty2_arrived ?? 0)}
                        onChange={(e) => setEditForm((c: any) => ({ ...c, qty2_arrived: e.target.value === "" ? 0 : Number(e.target.value) }))} />
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
              e.preventDefault(); setModalNotice(null);
              if (!clearanceForm.prod_con_acceptance.trim()) { setModalNotice("Product Condition Acceptance is required."); return; }
              setSaving(true);
              try {
                await Promise.all(selectedRows.map((r) =>
                  api.put("/api/wms/inbound/packing_details/clearance", {
                    company_code: companyCode, prin_code: prinCode, job_no: jobNo,
                    packdet_no: Number(value(r, "packdet_no")), clearance: "Y", ...clearanceForm,
                  })
                ));
                setProcessOpen(false); setModalNotice(null); setSelectedRows([]);
                setClearanceForm({ truck_condition: "", container_condition: "", container_type: "", ref_box_temp: "", prod_temp: "", prod_con_acceptance: "" });
                toast.success("Quality clearance processed successfully"); await loadRows();
              } catch (error) {
                const msg = error instanceof Error ? error.message : "Process failed";
                setModalNotice(msg); toast.error(msg);
              } finally { setSaving(false); }
            }}>
              {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
              {selectedRows.length === 0
                ? <p className="text-sm text-muted-foreground">No rows selected. Close and select rows from the table.</p>
                : (
                  <div className="grid grid-cols-2 gap-3">
                    {([ ["truck_condition","Truck Condition"], ["container_condition","Container Condition"], ["container_type","Container Type"], ["ref_box_temp","Refer Box Temperature"], ["prod_temp","Product Temperature"], ["prod_con_acceptance","Product Condition Acceptance",true] ] as [keyof typeof clearanceForm, string, boolean?][]).map(([k, label, req]) => (
                      <label key={k} className="field">
                        <span className="text-xs font-medium text-muted-foreground">{label}{req && <strong className="text-destructive"> *</strong>}</span>
                        <Input value={clearanceForm[k]} placeholder={label} onChange={(e) => setClearanceForm((c: any) => ({ ...c, [k]: e.target.value }))} />
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
  <Dialog wide open={processOpen} title="Process Putaway" description={`Selected Items: ${selectedRows.length}`}
    onClose={() => { setProcessOpen(false); setModalNotice(null); }}
  >
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault(); setModalNotice(null);
      if (!putawayForm.site_from)     { setModalNotice("Site From is required."); return; }
      if (!putawayForm.location_from) { setModalNotice("Location From is required."); return; }
      setSaving(true);
      try {
        await api.put(`/api/wms/inbound/putway_details/${encodeURIComponent(jobNo)}?prin_code=${encodeURIComponent(prinCode)}`, {
          site_from:     putawayForm.site_from,
          site_to:       putawayForm.site_from,
          location_from: putawayForm.location_from,
          location_to:   putawayForm.location_to || putawayForm.location_from,
          packdet_no:    selectedRows.map((r) => value(r, "packdet_no")),
        });
        setProcessOpen(false); setModalNotice(null); setSelectedRows([]);
setPutawayForm({ site_from: "", site_to: "", location_from: "", location_code: "", location_to: "" });
        setLocationFromOptions([]); setLocationToOptions([]);
        toast.success("Putaway processed successfully"); await loadRows();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Putaway failed";
        setModalNotice(msg); toast.error(msg);
      } finally { setSaving(false); }
    }}>
      {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
      <div className="grid grid-cols-2 gap-3">
        {/* Site From */}
        <label className="field">
          <span className="text-xs font-medium text-muted-foreground">Site From <strong className="text-destructive">*</strong></span>
          <div className="relative flex items-center">
            <Select
              value={putawayForm.site_from}
              onChange={(e) => {
                const site = e.target.value;
                setPutawayForm((c) => ({ ...c, site_from: site, location_from: "", location_to: "" }));
                setLocationFromOptions([]); setLocationToOptions([]);
                if (site) {
                  void loadLocations(site, "from");
                  void loadLocations(site, "to");
                }
              }}
              className="pr-7"
            >
              <option value="">— Select Site —</option>
              {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {putawayForm.site_from && (
              <button type="button" tabIndex={-1}
                className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/40"
                onClick={() => {
                  setPutawayForm((c) => ({ ...c, site_from: "", location_from: "", location_to: "" }));
                  setLocationFromOptions([]); setLocationToOptions([]);
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </label>

        {/* Location From */}
        <label className="field">
          <span className="text-xs font-medium text-muted-foreground">Location From <strong className="text-destructive">*</strong></span>
          <div className="relative flex items-center">
            <Select
              value={putawayForm.location_from}
              disabled={!putawayForm.site_from || locationFromOptions.length === 0}
              onChange={(e) => {
                const loc = e.target.value;
                setPutawayForm((c) => ({ ...c, location_from: loc, location_to: loc }));
              }}
              className="pr-7"
            >
              <option value="">— Select Location —</option>
              {locationFromOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {putawayForm.location_from && (
              <button type="button" tabIndex={-1}
                className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/40"
                onClick={() => setPutawayForm((c) => ({ ...c, location_from: "", location_to: "" }))}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </label>

        {/* Site To (read-only, mirrors Site From) */}
        <label className="field">
          <span className="text-xs font-medium text-muted-foreground">Site To (Auto-set to match Site From)</span>
          <div className="relative flex items-center">
            <Select
              value={putawayForm.site_to || putawayForm.site_from}
              onChange={(e) => {
                const site = e.target.value;
                setPutawayForm((c) => ({ ...c, site_to: site, location_to: "" }));
                setLocationToOptions([]);
                if (site) void loadLocations(site, "to");
              }}
              className="pr-7"
            >
              <option value="">— Select Site —</option>
              {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {(putawayForm.site_to || putawayForm.site_from) && (
              <button type="button" tabIndex={-1}
                className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/40"
                onClick={() => {
                  setPutawayForm((c) => ({ ...c, site_to: "", location_to: "" }));
                  setLocationToOptions([]);
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </label>


        {/* Location To */}
        <label className="field">
          <span className="text-xs font-medium text-muted-foreground">Location To</span>
          <div className="relative flex items-center">
            <Select
              value={putawayForm.location_to}
              disabled={!putawayForm.site_from || locationToOptions.length === 0}
              onChange={(e) => setPutawayForm((c) => ({ ...c, location_to: e.target.value }))}
              className="pr-7"
            >
              <option value="">— Select Location —</option>
              {locationToOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {putawayForm.location_to && (
              <button type="button" tabIndex={-1}
                className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/40"
                onClick={() => setPutawayForm((c) => ({ ...c, location_to: "" }))}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </label>

        <div className="col-span-2">
          <p className="text-sm text-[#4a90d9] italic">
            Note: Site To defaults to match Site From. You can override it independently.
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Selected Items: {selectedRows.length}</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={() => { setProcessOpen(false); setModalNotice(null); }}>Cancel</Button>
        <Button type="submit" disabled={saving || selectedRows.length === 0 || !putawayForm.location_from}>
          <Settings2 size={15} /> {saving ? "Processing..." : "Process Putaway"}
        </Button>
      </div>
    </form>
  </Dialog>
)}


        {/* ── HHT Putaway Modal ── */}
        {isPutawayHHT && (
          <Dialog wide open={processOpen} title="Process Putaway Details" description="Select a pallet and enter the destination location."
            onClose={() => { setProcessOpen(false); setModalNotice(null); setHhtPalletId(""); setHhtLocation(""); setHhtPalletProducts([]); setHhtLocationError(""); setHhtLocationValid(null); }}
          >
            <div className="grid gap-4 p-1">
              {modalNotice && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modalNotice}</div>}
              <label className="field">
                <span className="text-xs font-medium text-muted-foreground">Pallet ID <strong className="text-destructive">*</strong></span>
                <Select value={hhtPalletId} onChange={(e) => handleHhtPalletChange(e.target.value)}>
                  <option value="">— Select Pallet —</option>
                  {hhtAvailablePallets.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </label>
              {hhtPalletId && (
                <div className="grid gap-2">
                  <span className="text-sm font-semibold">Products in Pallet:</span>
                  <div className="max-h-52 overflow-auto rounded-md border">
                    <table className="min-w-full divide-y divide-border text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Primary Qty.</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Lowest Qty.</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total Qty.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {hhtPalletProducts.length === 0
                          ? <tr><td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">No products found for this pallet.</td></tr>
                          : hhtPalletProducts.map((p, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                              <td className="px-3 py-2">{String(value(p, "prod_name") || "")}</td>
                              <td className="px-3 py-2 text-right">{Number(value(p, "pda_qty_puom") ?? 0)}</td>
                              <td className="px-3 py-2 text-right">{Number(value(p, "pda_qty_luom") ?? 0)}</td>
                              <td className="px-3 py-2 text-right">{Number(value(p, "quantity") ?? 0)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {hhtPalletId && (
                <label className="field">
                  <span className="text-xs font-medium text-muted-foreground">Location Code <strong className="text-destructive">*</strong></span>
                  <div className="relative">
                    <Input value={hhtLocation} onChange={handleHhtLocationChange} placeholder="e.g. C2060401" autoComplete="off" style={{ textTransform: "uppercase" }}
                      className={hhtLocationValid === false ? "border-destructive pr-8" : hhtLocationValid === true ? "border-primary pr-8" : ""} />
                    {hhtLocationValid === true  && <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />}
                    {hhtLocationValid === false && <X className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />}
                  </div>
                  {hhtLocationLoading && <p className="text-xs text-muted-foreground mt-1">Loading locations...</p>}
                  {hhtLocationError  && <p className="text-xs text-destructive mt-1">{hhtLocationError}</p>}
                </label>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => { setProcessOpen(false); setModalNotice(null); setHhtPalletId(""); setHhtLocation(""); setHhtPalletProducts([]); setHhtLocationError(""); setHhtLocationValid(null); }}>
                  <X size={15} /> Cancel
                </Button>
                <Button type="button" disabled={saving || !hhtPalletId || !hhtLocation || hhtLocationValid !== true}
                  onClick={async () => {
                    setModalNotice(null);
                    if (!hhtPalletId)                    { setModalNotice("Pallet ID is required."); return; }
                    if (!hhtLocation)                    { setModalNotice("Location Code is required."); return; }
                    if (hhtLocationValid !== true)        { setModalNotice("Please enter a valid location code."); return; }
                    if (hhtPalletProducts.length === 0)  { setModalNotice("No products found for selected pallet."); return; }
                    setSaving(true);
                    try {
                      await Promise.all(hhtPalletProducts.map((p) =>
                        api.post("/api/wms/inbound/Putawaywithpalletid", {
                          prin_code: prinCode, job_no: jobNo,
                          prod_code: String(value(p, "prod_code") || ""),
                          packdet_no: String(value(p, "packdet_no") || ""),
                          pallet_id: hhtPalletId, location_from: hhtLocation.slice(2),
                        })
                      ));
                      setProcessOpen(false); setModalNotice(null);
                      setHhtPalletId(""); setHhtLocation(""); setHhtPalletProducts([]); setHhtLocationError(""); setHhtLocationValid(null);
                      toast.success("HHT Putaway processed successfully"); await loadRows();
                    } catch (error) {
                      const msg = error instanceof Error ? error.message : "Putaway failed";
                      setModalNotice(msg); toast.error(msg);
                    } finally { setSaving(false); }
                  }}>
                  <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
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
                      { packdet_no: selectedRows.map((r) => Number(value(r, "packdet_no"))) }
                    );
                    setSelectedRows([]);
                    setProcessOpen(false);
                    toast.success("Job confirmation processed successfully");
                    await loadRows();
                  } catch (error) {
                    const msg = error instanceof Error ? error.message : "Process failed";
                    setModalNotice(msg); toast.error(msg);
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
);