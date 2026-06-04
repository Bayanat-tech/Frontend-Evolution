export const inboundJobsPath = "/workspace/wms/wms/transactions/inbound/jobs";

export const listingTabs = [
  { label: "In Progress", value: "in_progress" },
  { label: "Confirmed",   value: "confirmed" },
  { label: "Canceled",    value: "cancel" },
];

export const jobClassLabels: Record<string, string> = {
  N:   "Normal",
  NP:  "Normal HHT/RFID/AR",
  M:   "Manual Putaway",
  S:   "Sales Return",
  SP:  "Sales Return HHT/RFID/AR",
  NI:  "Non-Inventory",
  CP:  "Co-Packing",
  MR:  "Misc Receipts",
  IWT: "Inter Warehouse Transfer",
  CD:  "Cross Docking",
};

export const detailTabs = [
  { label: "Shipment Details",     value: "shipment_details" },
  { label: "Packing Details",      value: "packing_details" },
  { label: "Receiving Details",    value: "receiving_details" },
  { label: "Quality Clearance",    value: "quality_clearance" },
  { label: "Tally Details",        value: "tally_details" },
  { label: "Putaway Details",      value: "putway_details" },
  { label: "Putaway Manual",       value: "putway_manual" },
  { label: "Putaway HHT/RFID/AR",  value: "putway_hht" },
  { label: "Job Confirmation",     value: "job_confirmation" },
  { label: "Activity Billing",     value: "activity_billing" },
];