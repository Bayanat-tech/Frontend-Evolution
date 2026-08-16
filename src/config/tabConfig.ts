import { detailTabs } from "./staticData";
import {
  shipmentFormFields, packingFormFields, receivingFormFields,
  tallyFormFields, putawayFormFields, manualPutawayFormFields,
  type FormField,
} from "./formFields";
import { sqlEscape } from "../utils/inboundHelpers";

type TabSqlArgs = { companyCode: string; jobNo: string; prinCode: string };

export type TabConfig = {
  title:        string;
  minWidth:     number;
  addLabel?:    string;
  addEndpoint?: string;
  addFields?:   FormField[];
  columns:      { key: string; label: string; size?: number }[];
  sql:          (args: TabSqlArgs) => string;
};

// ─── shared SQL builders ────────────────────────────────────────────────────
const packSql = ({ companyCode, jobNo, prinCode }: TabSqlArgs) =>
  `SELECT * FROM VW_WM_INB_PACKDET_DETS
   WHERE company_code = '${sqlEscape(companyCode)}'
     AND job_no       = '${sqlEscape(jobNo)}'
     AND prin_code    = '${sqlEscape(prinCode)}'
   ORDER BY updated_at`;

// ─── column sets ────────────────────────────────────────────────────────────
export function packingColumns() {
  return [
    { key: "prod_name",   label: "Product",      size: 320 },
    { key: "qty_string",  label: "Quantity",      size: 140 },
    { key: "quantity",    label: "Net Quantity",  size: 140 },
    { key: "batch_no",    label: "Batch No",      size: 120 },
    { key: "lot_no",      label: "Lot No",        size: 120 },
    { key: "container_no", label: "Container",    size: 140 },
    { key: "po_no",       label: "PO No",         size: 120 },
    { key: "doc_ref",     label: "Doc Ref",       size: 140 },
  ];
}

export function confirmationColumns() {
  return [
    { key: "prod_name",          label: "Product",         size: 320 },
    { key: "qty_confirm_string", label: "Quantity",         size: 150 },
    { key: "receive_qty_string", label: "Arrived Qty",      size: 150 },
    { key: "net_receive_string", label: "Net Arrived Qty",  size: 160 },
    { key: "batch_no",           label: "Batch No",         size: 120 },
    { key: "lot_no",             label: "Lot No",           size: 120 },
    { key: "mfg_date",           label: "Mfg Date",         size: 120 },
    { key: "exp_date",           label: "Exp Date",         size: 120 },
    { key: "container_no",       label: "Container",        size: 140 },
    { key: "po_no",              label: "PO No",            size: 120 },
    { key: "doc_ref",            label: "BL Number",        size: 140 },
  ];
}

// ─── tab config map ──────────────────────────────────────────────────────────
const tabConfigs: Record<string, TabConfig> = {
  shipment_details: {
    title: "Shipment Details", minWidth: 1060,
    addLabel: "Add Shipment", addEndpoint: "shipment_details",
    addFields: shipmentFormFields,
    sql: ({ jobNo, prinCode }) =>
      `SELECT * FROM TI_CONTAINER
       WHERE PRIN_CODE = '${sqlEscape(prinCode)}'
         AND JOB_NO    = '${sqlEscape(jobNo)}'`,
    columns: [
      { key: "container_no", label: "Container No", size: 150 },
      { key: "vehicle_no",   label: "Vehicle No",   size: 130 },
      { key: "vessel_name",  label: "Vessel Name",  size: 150 },
      { key: "voyage_no",    label: "Voyage No",    size: 130 },
      { key: "seal_no",      label: "Seal No",      size: 130 },
      { key: "po_no",        label: "PO No",        size: 130 },
      { key: "bl_no",        label: "BL No",        size: 130 },
    ],
  },

  packing_details: {
    title: "Packing Details", minWidth: 1280,
    addLabel: "Add Packing Details", addEndpoint: "packing_details",
    addFields: packingFormFields,
    sql: packSql,
    columns: packingColumns(),
  },

  receiving_details: {
    title: "Receiving Details", minWidth: 1320,
    addLabel: "Add Receiving", addEndpoint: "receiving",
    addFields: receivingFormFields,
    sql: packSql,
    columns: [
      { key: "prod_name",             label: "Product",         size: 320 },
      { key: "qty_string",            label: "Quantity",         size: 150 },
      { key: "quantity",              label: "Net Quantity",     size: 140 },
      { key: "qty_arrived_string",    label: "Arrived Qty",      size: 150 },
      { key: "qty_netarrived_string", label: "Net Arrived Qty",  size: 160 },
      { key: "batch_no",              label: "Batch No",         size: 120 },
      { key: "lot_no",                label: "Lot No",           size: 120 },
      { key: "po_no",                 label: "PO No",            size: 120 },
      { key: "doc_ref",               label: "Doc Ref",          size: 140 },
    ],
  },

  quality_clearance: {
    title: "Quality Clearance", minWidth: 1200,
    sql: packSql,
    columns: [
      { key: "prod_name",   label: "Product",   size: 320 },
      { key: "qty_string",  label: "Quantity",  size: 140 },
      { key: "clearance",   label: "Clearance", size: 120 },
      { key: "batch_no",    label: "Batch No",  size: 120 },
      { key: "lot_no",      label: "Lot No",    size: 120 },
      { key: "container_no", label: "Container", size: 140 },
      { key: "po_no",       label: "PO No",     size: 120 },
      { key: "doc_ref",     label: "Doc Ref",   size: 140 },
    ],
  },

tally_details: {
  title: "Tally Details", minWidth: 1260,
  addLabel: "Add Tally", addEndpoint: "tally",
  addFields: tallyFormFields,
  sql: ({ companyCode, jobNo, prinCode }) =>
    `SELECT * FROM VW_WM_INB_TALLY_DETAIL
     WHERE company_code = '${sqlEscape(companyCode)}'
       AND job_no       = '${sqlEscape(jobNo)}'
       AND prin_code    = '${sqlEscape(prinCode)}'
     ORDER BY seq_number`,
  columns: [
    { key: "prod_name",              label: "Product",         size: 280 },
    { key: "prod_code",              label: "Product Code",    size: 140 },
    { key: "receive_qty_string",     label: "Received Qty",    size: 180 },
    { key: "net_receive_qty_string", label: "Net Received Qty",size: 180 },
    { key: "batch_no",               label: "Batch No",        size: 120 },
    { key: "lot_no",                 label: "Lot No",          size: 120 },
    { key: "pallet_id",              label: "Pallet ID",       size: 120 },
    { key: "container_no",           label: "Container",       size: 140 },
    { key: "po_no",                  label: "PO No",           size: 120 },
    { key: "mfg_date",               label: "Mfg Date",        size: 110 },
    { key: "exp_date",               label: "Exp Date",        size: 110 },
  ],
},

  putway_details: {
    title: "Putaway Details", minWidth: 1280,
    sql: packSql,
    columns: [
      { key: "prod_name",          label: "Product",     size: 320 },
      { key: "qty_string",         label: "Quantity",    size: 150 },
      { key: "qty_arrived_string", label: "Arrived Qty", size: 150 },
      { key: "clearance",          label: "Clearance",   size: 110 },
      { key: "allocated",          label: "Allocated",   size: 100 },
      { key: "batch_no",           label: "Batch No",    size: 120 },
      { key: "lot_no",             label: "Lot No",      size: 120 },
      { key: "container_no",       label: "Container",   size: 140 },
      { key: "po_no",              label: "PO No",       size: 120 },
      { key: "doc_ref",            label: "Doc Ref",     size: 140 },
    ],
  },

  putway_manual: {
    title: "Putaway Manual", minWidth: 1280,
    addLabel: "Add Manual Putaway", addEndpoint: "upsertPutawaymanualHandler",
    addFields: manualPutawayFormFields,
    sql: ({ companyCode, jobNo, prinCode }) =>
      `SELECT * FROM VW_WM_INB_TT_BATCH_DETS
       WHERE company_code = '${sqlEscape(companyCode)}'
         AND job_no       = '${sqlEscape(jobNo)}'
         AND prin_code    = '${sqlEscape(prinCode)}'
       ORDER BY updated_at`,
    columns: confirmationColumns(),
  },

  putway_hht: {
    title: "Putaway HHT/RFID/AR", minWidth: 1280,
    addLabel: "Process HHT Putaway", addEndpoint: "hhtputaway",
    addFields: putawayFormFields,
    sql: ({ companyCode, jobNo, prinCode }) =>
      `SELECT * FROM VW_WM_INB_TT_BATCH_DETS
       WHERE company_code = '${sqlEscape(companyCode)}'
         AND job_no       = '${sqlEscape(jobNo)}'
         AND prin_code    = '${sqlEscape(prinCode)}'
       ORDER BY updated_at`,
    columns: confirmationColumns(),
  },

  job_confirmation: {
    title: "Job Confirmation", minWidth: 1380,
    sql: ({ companyCode, jobNo, prinCode }) =>
      `SELECT * FROM VW_WM_INB_TT_BATCH_DETS
       WHERE confirmed    = 'N'
         AND company_code = '${sqlEscape(companyCode)}'
         AND job_no       = '${sqlEscape(jobNo)}'
         AND prin_code    = '${sqlEscape(prinCode)}'
       ORDER BY updated_at`,
    columns: confirmationColumns(),
  },

};

export function getInboundTabConfig(tab: string): TabConfig | undefined {
  return tabConfigs[tab];
}

export function getTabsForJob(jobClass: string) {
  const allowed: Record<string, string[]> = {
    M:  ["shipment_details", "putway_manual", "job_confirmation", "activity_billing"],
    NP: ["shipment_details", "packing_details", "quality_clearance", "tally_details", "putway_hht", "job_confirmation", "activity_billing"],
    NI: ["activity_billing"],
    N:  ["shipment_details", "packing_details", "receiving_details", "quality_clearance", "putway_details", "job_confirmation", "activity_billing"],
  };
  const list = allowed[jobClass];
  return list ? detailTabs.filter((t) => list.includes(t.value)) : detailTabs;
}