export type DropdownOption = { value: string; label: string };

export type FormField = {
  name:      string;
  label:     string;
  required?: boolean;
  type?:     string;
  dropdown?: DropdownOption[];
  lookup?:   "product" | "container" | "country" | "manufacturer";
  disabled?: boolean;
};

export const shipmentFormFields: FormField[] = [
  { name: "container_no", label: "Container No", required: true },
  { name: "vehicle_no",   label: "Vehicle No",   required: true },
  { name: "vessel_name",  label: "Vessel Name",  required: true },
  { name: "voyage_no",    label: "Voyage No" },
  { name: "seal_no",      label: "Seal No" },
  { name: "po_no",        label: "PO No" },
  { name: "bl_no",        label: "BL No" },
];

export const packingFormFields: FormField[] = [
  { name: "container_no",    label: "Container No",      required: true, lookup: "container" },
  { name: "prod_code",       label: "Product / SKU",     required: true, lookup: "product" },
  { name: "qty_puom",        label: "Quantity (Primary)", required: true, type: "number" },
  { name: "qty_luom",        label: "Quantity (Lowest)",  required: true, type: "number" },
  { name: "quantity",        label: "Total Quantity",     type: "number", disabled: true },
  { name: "batch_no",        label: "Batch No" },
  { name: "lot_no",          label: "Lot No" },
  { name: "po_no",           label: "PO No" },
  { name: "bl_no",           label: "BL No" },
  { name: "doc_ref",         label: "Doc Ref" },
  { name: "mfg_date",        label: "Production Date",   type: "date" },
  { name: "exp_date",        label: "Expiry Date",       type: "date" },
  { name: "manufacturer",    label: "Manufacturer",      lookup: "manufacturer" },
  { name: "shelf_life_date", label: "Shelf Life (Date)", type: "date" },
  { name: "shelf_life_days", label: "Shelf Life Days",   type: "number" },
];

export const receivingFormFields: FormField[] = [
  { name: "prod_code",   label: "Product Code", required: true },
  { name: "qty_arrived", label: "Arrived Qty",  required: true, type: "number" },
  { name: "uom",         label: "UOM" },
  { name: "batch_no",    label: "Batch No" },
  { name: "lot_no",      label: "Lot No" },
  { name: "po_no",       label: "PO No" },
  { name: "doc_ref",     label: "Doc Ref" },
];

export const tallyFormFields: FormField[] = [
  { name: "prod_code",   label: "Product Code", required: true },
  { name: "qty_tally",   label: "Tally Qty",    required: true, type: "number" },
  { name: "uom",         label: "UOM" },
  { name: "batch_no",    label: "Batch No" },
  { name: "lot_no",      label: "Lot No" },
  { name: "container_no", label: "Container No" },
  { name: "po_no",       label: "PO No" },
];

export const putawayFormFields: FormField[] = [
  { name: "prod_code",    label: "Product Code", required: true },
  { name: "site_to",      label: "Site To",      required: true },
  { name: "location_to",  label: "Location To",  required: true },
  { name: "qty_confirm",  label: "Confirm Qty",  required: true, type: "number" },
  { name: "batch_no",     label: "Batch No" },
  { name: "lot_no",       label: "Lot No" },
];

export const manualPutawayFormFields: FormField[] = [
  { name: "prod_code",     label: "Product Code",  required: true },
  { name: "site_from",     label: "Site From",     required: true },
  { name: "location_from", label: "Location From", required: true },
  { name: "site_to",       label: "Site To",       required: true },
  { name: "location_to",   label: "Location To",   required: true },
  { name: "qty",           label: "Quantity",      required: true, type: "number" },
  { name: "batch_no",      label: "Batch No" },
  { name: "lot_no",        label: "Lot No" },
];