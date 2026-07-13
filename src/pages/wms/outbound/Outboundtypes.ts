export type WmsRow = Record<string, unknown>;

export const listingTabs = [
  { label: "In Progress", value: "in_progress" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Canceled", value: "cancel" },
];

export const detailTabs = [
  { label: "Order Entry", value: "order_entry" },
  { label: "Order Details", value: "order_details" },
  { label: "Picking Details", value: "picking_details" },
  { label: "Cancel Picking", value: "cancel_picking" },
  { label: "Job Confirmation", value: "job_confirmation" },
  { label: "Activity Billing", value: "activity_billing" },
];

export const outboundJobsPath = "/workspace/wms/wms/transactions/outbound/jobs_oub";

export const jobClassLabels: Record<string, string> = {
  N: "Normal",
  NP: "Normal HHT/RFID/AR",
  M: "Manual",
  S: "Sales Return",
  SP: "Sales Return HHT/RFID/AR",
  NI: "Non-Inventory",
  CP: "Co-Packing",
  MR: "Misc Receipts",
  IWT: "Inter Warehouse Transfer",
  CD: "Cross Docking",
};

export const jobFields = [
  { name: "prin_code", label: "Principal Code", required: true },
  { name: "dept_code", label: "Department Code" },
  { name: "div_code", label: "Division Code" },
  { name: "job_class", label: "Job Class", required: true },
  { name: "job_type", label: "Job Type", required: true },
  { name: "country_origin", label: "Country Origin" },
  { name: "country_destination", label: "Country Destination" },
  { name: "port_code", label: "Port Code" },
  { name: "destination_port", label: "Destination Port" },
  { name: "transport_mode", label: "Transport Mode" },
  { name: "schedule_date", label: "Schedule Date", type: "date" },
  { name: "doc_ref", label: "Doc Ref" },
  { name: "prin_ref2", label: "Principal Ref 2" },
  { name: "description1", label: "Description" },
  { name: "remarks", label: "Remarks" },
];

export const orderEntryFields = [
  { name: "order_no", label: "Order No", required: true },
  { name: "cust_code", label: "Customer", required: true },
  { name: "order_date", label: "Order Date", type: "date" },
  { name: "order_due_date", label: "Due Date", type: "date" },
  { name: "curr_code", label: "Currency" },
  { name: "ex_rate", label: "Exchange Rate", type: "number" },
  { name: "moc1", label: "MOC 1" },
  { name: "moc2", label: "MOC 2" },
  { name: "exp_container_no", label: "Container No" },
  { name: "exp_container_size", label: "Container Size" },
  { name: "exp_container_type", label: "Container Type" },
  { name: "exp_container_sealno", label: "Seal No" },
  { name: "cust_reference", label: "Customer Ref" },
  { name: "pack_start", label: "Pack Start", type: "datetime-local" },
  { name: "pack_end", label: "Pack End", type: "datetime-local" },
  { name: "load_start", label: "Load Start", type: "datetime-local" },
  { name: "load_end", label: "Load End", type: "datetime-local" },
];

export const orderDetailFields = [
  { name: "order_no", label: "Order No", required: true },
  { name: "cust_code", label: "Customer", required: true },
  { name: "prod_code", label: "Product Code", required: true },
  { name: "prod_name", label: "Product Name" },
  { name: "site_code", label: "Site Code", required: true },
  { name: "loc_code_from", label: "Location From" },
  { name: "loc_code_to", label: "Location To" },
  { name: "p_uom", label: "P UOM" },
  { name: "qty_puom", label: "P Qty", type: "number", required: true },
  { name: "l_uom", label: "L UOM" },
  { name: "qty_luom", label: "L Qty", type: "number" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "lot_no", label: "Lot No" },
  { name: "batch_no", label: "Batch No" },
  { name: "expiry_from", label: "Expiry From", type: "date" },
  { name: "expiry_to", label: "Expiry To", type: "date" },
  { name: "production_from", label: "Production From", type: "date" },
  { name: "production_to", label: "Production To", type: "date" },
  { name: "salesman_code", label: "Salesman" },
  { name: "minperiod_exppick", label: "Min Expiry Period", type: "number" },
];