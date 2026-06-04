import { useLocation } from "react-router-dom";
import { ToastProvider } from "../../../components/ui/AlertToast";
import { InboundJobListing } from "./InboundJobListing";
import { InboundJobDetail } from "./InboundJobDetail";
import { parseInboundView } from "../../../utils/inboundHelpers";

export function WmsInboundPage() {
  const location = useLocation();
  const view     = parseInboundView(location.pathname);

  return (
    <ToastProvider>
      {view.jobNo
        ? <InboundJobDetail jobNo={view.jobNo} tab={view.tab || "shipment_details"} />
        : <InboundJobListing />
      }
    </ToastProvider>
  );
}























// import type { ColumnDef } from "@tanstack/react-table";
// import {
//   ArrowLeft, Ban, CheckCircle2, Eye, FileText, PackageCheck, Plus,
//   Printer, RefreshCw, Save, Settings2, Ship, Truck, X, ChevronDown,MapPin
// } from "lucide-react";
// import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
// import { Link, useLocation, useNavigate } from "react-router-dom";
// import { executeWmsInboundSql, getWmsInbound, patchWmsInbound, postWmsInbound } from "../../../api/wms";
// import { api } from "../../../api/client";
// import { Button } from "../../../components/ui/Button";
// import { Card, CardContent } from "../../../components/ui/Card";
// import { DataTable } from "../../../components/ui/DataTable";
// import { Dialog } from "../../../components/ui/Dialog";
// import { Input } from "../../../components/ui/Input";
// import { Select } from "../../../components/ui/Select";
// import { useAuth } from "../../../state/AuthContext";
// import { cn } from "../../../lib/utils";
// import { LookupField } from "../../../components/ui/LookupField";
// import { useToast, ToastProvider } from "../../../components/ui/AlertToast";

// type WmsRow = Record<string, unknown>;
// type DropdownOption = { value: string; label: string };

// function InboundFormFrame({
//   open, title, children, footer, onClose,
// }: {
//   open: boolean; title: string; children: React.ReactNode;
//   footer: React.ReactNode; onClose: () => void;
// }) {
//   if (!open) return null;
//   return (
//     <div
//       className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
//       onMouseDown={onClose}
//     >
//       <div
//         className="grid max-h-[92vh] w-[min(96vw,1280px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl"
//         onMouseDown={(e) => e.stopPropagation()}
//       >
//         <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
//           <div className="flex items-center gap-3">
//             <span className="h-7 w-1 rounded-full bg-primary" />
//             <div>
//               <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
//                 Inbound Job
//               </p>
//               <h2 className="m-0 text-lg font-bold text-foreground">{title}</h2>
//             </div>
//           </div>
//           <button
//             aria-label="Close"
//             type="button"
//             onClick={onClose}
//             className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
//           >
//             <X size={16} />
//           </button>
//         </div>
//         <div className="min-h-0 overflow-y-auto overflow-x-hidden bg-muted/20 p-3 text-sm">
//           {children}
//         </div>
//         <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
//           {footer}
//         </div>
//       </div>
//     </div>
//   );
// }

// async function loadInboundPrincipalLookup(companyCode: string) {
//   const data = await executeWmsInboundSql(`
//     SELECT p.PRIN_CODE, p.PRIN_NAME, p.PRIN_DEPT_CODE, p.DIV_CODE,
//            d.DEPT_NAME, v.DIV_NAME
//     FROM MS_PRINCIPAL p
//     LEFT JOIN MS_DEPARTMENT d
//       ON d.COMPANY_CODE = p.COMPANY_CODE
//      AND d.DEPT_CODE = p.PRIN_DEPT_CODE
//      AND d.DIV_CODE = p.DIV_CODE
//     LEFT JOIN MS_HR_DIVISION v
//       ON v.COMPANY_CODE = p.COMPANY_CODE
//      AND v.DIV_CODE = p.DIV_CODE
//     WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}'
//     ORDER BY p.PRIN_CODE
//   `);
//   return data.map(normalizeRow);
// }

// async function loadInboundDepartmentLookup(companyCode: string, divCode = "") {
//   const data = await executeWmsInboundSql(`
//     SELECT d.DEPT_CODE, d.DEPT_NAME, d.DIV_CODE, v.DIV_NAME
//     FROM MS_DEPARTMENT d
//     LEFT JOIN MS_HR_DIVISION v
//       ON v.COMPANY_CODE = d.COMPANY_CODE
//      AND v.DIV_CODE = d.DIV_CODE
//     WHERE d.COMPANY_CODE = '${sqlEscape(companyCode)}'
//     ${divCode ? `AND d.DIV_CODE = '${sqlEscape(divCode)}'` : ""}
//     ORDER BY d.DEPT_CODE
//   `);
//   return data.map(normalizeRow);
// }

// async function loadInboundDivisionLookup(companyCode: string) {
//   const data = await executeWmsInboundSql(`
//     SELECT DIV_CODE, DIV_NAME FROM MS_HR_DIVISION
//     WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
//     ORDER BY DIV_CODE
//   `);
//   return data.map(normalizeRow);
// }

// async function loadInboundCountryLookup() {
//   const data = await executeWmsInboundSql(
//     `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`
//   );
//   return data.map(normalizeRow);
// }

// async function loadInboundPortLookup(countryCode = "") {
//   const data = await executeWmsInboundSql(`
//     SELECT PORT_CODE, PORT_NAME, COUNTRY_CODE FROM MS_PORT
//     ${countryCode ? `WHERE COUNTRY_CODE = '${sqlEscape(countryCode)}'` : ""}
//     ORDER BY PORT_NAME
//   `);
//   return data.map(normalizeRow);
// }
// function InboundJobCreateForm({
//   form, setForm, companyCode, onSubmit,
// }: {
//   form: WmsRow;
//   setForm: (updater: (cur: WmsRow) => WmsRow) => void;
//   companyCode: string;
//   onSubmit: (e: FormEvent) => void;
// }) {
//   const set = (name: string, val: unknown) =>
//     setForm((cur) => ({ ...cur, [name]: val }));
 
//   return (
//     <form id="inbound-job-form" className="grid gap-2.5" onSubmit={onSubmit}>
 
//       {/* ── Section 1: Job Information ── */}
//       <section className="rounded-md border bg-card shadow-sm">
//         <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
//           <div className="flex items-center gap-2.5">
//             <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
//               <Ship size={16} />
//             </div>
//             <div>
//               <p className="eyebrow m-0">Job Information</p>
//               <h3 className="m-0 text-sm font-semibold">Inbound Job Creation</h3>
//             </div>
//           </div>
//           {/* <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
//             {companyCode || "Company"}
//           </span> */}
//         </div>
 
//         <div className="grid gap-2.5 p-3 md:grid-cols-4">
//           {/* Principal */}
//           <LookupField
//             label="Principal"
//             value={String(form.prin_code || "")}
//             displayValue={[form.prin_code, form.prin_name].filter(Boolean).join(" - ")}
//             valueField="prin_code"
//             displayFields={["prin_code", "prin_name"]}
//             columns={[
//               { field: "prin_code",      header: "Code" },
//               { field: "prin_name",      header: "Principal Name" },
//               { field: "prin_dept_code", header: "Department" },
//               { field: "div_code",       header: "Division" },
//             ]}
//             placeholder="Select principal"
//             loadOptions={() => loadInboundPrincipalLookup(companyCode)}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 prin_code:  val,
//                 prin_name:  row ? String(row["prin_name"]      ?? row["PRIN_NAME"]      ?? "") : cur.prin_name,
//                 dept_code:  row ? String(row["prin_dept_code"] ?? row["PRIN_DEPT_CODE"] ?? cur.dept_code ?? "") : cur.dept_code,
//                 dept_name:  row ? String(row["dept_name"]      ?? row["DEPT_NAME"]      ?? cur.dept_name ?? "") : cur.dept_name,
//                 div_code:   row ? String(row["div_code"]       ?? row["DIV_CODE"]       ?? cur.div_code  ?? "") : cur.div_code,
//                 div_name:   row ? String(row["div_name"]       ?? row["DIV_NAME"]       ?? cur.div_name  ?? "") : cur.div_name,
//               }))
//             }
//           />
 
//           {/* Department */}
//           <LookupField
//             label="Department"
//             value={String(form.dept_code || "")}
//             displayValue={[form.dept_code, form.dept_name].filter(Boolean).join(" - ")}
//             valueField="dept_code"
//             displayFields={["dept_code", "dept_name"]}
//             columns={[
//               { field: "dept_code", header: "Code" },
//               { field: "dept_name", header: "Department Name" },
//               { field: "div_code",  header: "Division" },
//             ]}
//             placeholder="Select department"
//             loadOptions={() => loadInboundDepartmentLookup(companyCode, String(form.div_code || ""))}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 dept_code: val,
//                 dept_name: row ? String(row["dept_name"] ?? row["DEPT_NAME"] ?? "") : cur.dept_name,
//                 div_code:  row ? String(row["div_code"]  ?? row["DIV_CODE"]  ?? cur.div_code ?? "") : cur.div_code,
//                 div_name:  row ? String(row["div_name"]  ?? row["DIV_NAME"]  ?? cur.div_name ?? "") : cur.div_name,
//               }))
//             }
//           />
 
//           {/* Division */}
//           <LookupField
//             label="Division"
//             value={String(form.div_code || "")}
//             displayValue={[form.div_code, form.div_name].filter(Boolean).join(" - ")}
//             valueField="div_code"
//             displayFields={["div_code", "div_name"]}
//             columns={[
//               { field: "div_code", header: "Code" },
//               { field: "div_name", header: "Division Name" },
//             ]}
//             placeholder="Select division"
//             loadOptions={() => loadInboundDivisionLookup(companyCode)}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 div_code: val,
//                 div_name: row ? String(row["div_name"] ?? row["DIV_NAME"] ?? "") : cur.div_name,
//               }))
//             }
//           />
 
//           {/* Job Classification */}
//           <label className="field">
// <span className="text-xs font-medium text-muted-foreground">
//   Job Classification <strong className="text-destructive">*</strong>
// </span>
//             <Select
//               value={String(form.job_class || "")}
//               onChange={(e) => set("job_class", e.target.value)}
//             >
//               <option value="">Select Job Classification</option>
//               {Object.entries(jobClassLabels).map(([code, label]) => (
//                 <option key={code} value={code}>{code} - {label}</option>
//               ))}
//             </Select>
//           </label>
 
//           {/* Job Type */}
//           <label className="field">
//   <span className="text-xs font-medium text-muted-foreground">
//     Job Type <strong className="text-destructive">*</strong>
//   </span>
//               <Select
//               value={String(form.job_type || "IMP")}
//               onChange={(e) => set("job_type", e.target.value)}
//             >
//               <option value="IMP">IMP - Inbound</option>
//             </Select>
//           </label>
 
//           {/* Transport Mode */}
//           <label className="field">
//             <span className="text-xs font-medium text-muted-foreground">
//               Transport Mode
//             </span>
//             <Select
//               value={String(form.transport_mode || "S")}
//               onChange={(e) => set("transport_mode", e.target.value)}
//             >
//               <option value="S">S - Sea</option>
//               <option value="A">A - Air</option>
//               <option value="R">R - Road\Land</option>
//               <option value="C">C - Courier</option>
//             </Select>
//           </label>
 
//           {/* Schedule Date */}
//           <label className="field">
//           <span className="text-xs font-medium text-muted-foreground">
//             Schedule Date
//           </span>
//             <Input
//               type="date"
//               value={String(form.schedule_date || "")}
//               onChange={(e) => set("schedule_date", e.target.value)}
//             />
//           </label>
//         </div>
//       </section>
 
//       {/* ── Section 2: Routing ── */}
//       <section className="rounded-md border bg-card shadow-sm">
//         <div className="flex items-center gap-2.5 border-b px-3 py-2">
//           <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
//             <MapPin size={16} />
//           </div>
//           <div>
//             <p className="eyebrow m-0">Routing</p>
//             <h3 className="m-0 text-sm font-semibold">Origin, Destination And Ports</h3>
//           </div>
//         </div>
 
//         <div className="grid gap-2.5 p-3 md:grid-cols-4">
//           {/* Origin Country */}
//           <LookupField
//             label="Origin Country"
//             value={String(form.country_origin || "")}
//             displayValue={[form.country_origin, form.country_origin_name].filter(Boolean).join(" - ")}
//             valueField="country_code"
//             displayFields={["country_code", "country_name"]}
//             columns={[
//               { field: "country_code", header: "Code" },
//               { field: "country_name", header: "Country" },
//             ]}
//             placeholder="Select origin country"
//             loadOptions={loadInboundCountryLookup}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 country_origin:      val,
//                 country_origin_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
//                 port_code:           "",
//                 port_name:           "",
//               }))
//             }
//           />
 
//           {/* Destination Country */}
//           <LookupField
//             label="Destination Country"
//             value={String(form.country_destination || "")}
//             displayValue={[form.country_destination, form.country_destination_name].filter(Boolean).join(" - ")}
//             valueField="country_code"
//             displayFields={["country_code", "country_name"]}
//             columns={[
//               { field: "country_code", header: "Code" },
//               { field: "country_name", header: "Country" },
//             ]}
//             placeholder="Select destination country"
//             loadOptions={loadInboundCountryLookup}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 country_destination:      val,
//                 country_destination_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
//                 destination_port:         "",
//                 destination_port_name:    "",
//               }))
//             }
//           />
 
//           {/* Port Of Loading */}
//           <LookupField
//             label="Port Of Loading"
//             value={String(form.port_code || "")}
//             displayValue={[form.port_code, form.port_name].filter(Boolean).join(" - ")}
//             valueField="port_code"
//             displayFields={["port_code", "port_name"]}
//             columns={[
//               { field: "port_code",    header: "Port Code" },
//               { field: "port_name",    header: "Port Name" },
//               { field: "country_code", header: "Country" },
//             ]}
//             placeholder="Select port of loading"
//             loadOptions={() => loadInboundPortLookup(String(form.country_origin || ""))}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 port_code: val,
//                 port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
//               }))
//             }
//           />
 
//           {/* Port Of Destination */}
//           <LookupField
//             label="Port Of Destination"
//             value={String(form.destination_port || "")}
//             displayValue={[form.destination_port, form.destination_port_name].filter(Boolean).join(" - ")}
//             valueField="port_code"
//             displayFields={["port_code", "port_name"]}
//             columns={[
//               { field: "port_code",    header: "Port Code" },
//               { field: "port_name",    header: "Port Name" },
//               { field: "country_code", header: "Country" },
//             ]}
//             placeholder="Select port of destination"
//             loadOptions={() => loadInboundPortLookup(String(form.country_destination || ""))}
//             onChange={(val, row) =>
//               setForm((cur) => ({
//                 ...cur,
//                 destination_port:      val,
//                 destination_port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
//               }))
//             }
//           />
//         </div>
//       </section>
 
//       {/* ── Section 3: References ── */}
//       <section className="rounded-md border bg-card shadow-sm">
//         <div className="flex items-center gap-2.5 border-b px-3 py-2">
//           <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
//             <FileText size={16} />
//           </div>
//           <div>
//             <p className="eyebrow m-0">References</p>
//             <h3 className="m-0 text-sm font-semibold">Description And Remarks</h3>
//           </div>
//         </div>
 
//         <div className="grid gap-2.5 p-3 md:grid-cols-3">
//           <label className="field">
// <span className="text-xs font-medium text-muted-foreground">Job Description</span>
//             <textarea
//               className="ui-textarea min-h-[72px] rounded-md"
//               value={String(form.description1 || "")}
//               onChange={(e) => set("description1", e.target.value)}
//               placeholder="Job description"
//             />
//           </label>
//           <label className="field">
// <span className="text-xs font-medium text-muted-foreground">Job Remarks</span>
//             <textarea
//               className="ui-textarea min-h-[72px] rounded-md"
//               value={String(form.remarks || "")}
//               onChange={(e) => set("remarks", e.target.value)}
//               placeholder="Job remarks"
//             />
//           </label>
//           <label className="field">
// <span className="text-xs font-medium text-muted-foreground">GRN Remarks</span>
//             <textarea
//               className="ui-textarea min-h-[72px] rounded-md"
//               value={String(form.grn_remarks || "")}
//               onChange={(e) => set("grn_remarks", e.target.value)}
//               placeholder="GRN remarks"
//             />
//           </label>
//         </div>
//       </section>
 
//     </form>
//   );
// }

// function useRawSqlDropdown({ sql, valueKey, labelKeys, enabled = true }: {
//   sql: string; valueKey: string; labelKeys: string[]; enabled?: boolean;
// }) {
//   const [options, setOptions] = useState<DropdownOption[]>([]);

//   useEffect(() => {
//     if (!enabled || !sql) return;
//     api.post("/api/wms/inbound/executeRawSql", { raw_sql: sql })
//       .then((response) => {
//         const data = Array.isArray(response.data?.data) ? response.data.data
//           : Array.isArray(response.data) ? response.data : [];
//         setOptions(data.map((row: Record<string, unknown>) => {
//           const get = (key: string) =>
//             String(row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()] ?? "");
//           return { value: get(valueKey), label: labelKeys.map(get).filter(Boolean).join(" - ") };
//         }));
//       })
//       .catch(() => {});
//   }, [sql, enabled]);

//   return { options };
// }

// // ---------------------------------------------------------------------------
// // Static data
// // ---------------------------------------------------------------------------
// const listingTabs = [
//   { label: "In Progress", value: "in_progress" },
//   { label: "Confirmed", value: "confirmed" },
//   { label: "Canceled", value: "cancel" },
// ];

// const jobClassLabels: Record<string, string> = {
//   N: "Normal", NP: "Normal HHT/RFID/AR", M: "Manual Putaway", S: "Sales Return",
//   SP: "Sales Return HHT/RFID/AR", NI: "Non-Inventory", CP: "Co-Packing",
//   MR: "Misc Receipts", IWT: "Inter Warehouse Transfer", CD: "Cross Docking",
// };

// const detailTabs = [
//   { label: "Shipment Details", value: "shipment_details" },
//   { label: "Packing Details", value: "packing_details" },
//   { label: "Receiving Details", value: "receiving_details" },
//   { label: "Quality Clearance", value: "quality_clearance" },
//   { label: "Tally Details", value: "tally_details" },
//   { label: "Putaway Details", value: "putway_details" },
//   { label: "Putaway Manual", value: "putway_manual" },
//   { label: "Putaway HHT/RFID/AR", value: "putway_hht" },
//   { label: "Job Confirmation", value: "job_confirmation" },
//   { label: "Activity Billing", value: "activity_billing" },
// ];

// const inboundJobsPath = "/workspace/wms/wms/transactions/inbound/jobs";

// type JobField = {
//   name: string; label: string; required?: boolean; type?: string;
//   dropdown?: "principal" | "division" | "department" | "port" | "country";
// };

// // ---------------------------------------------------------------------------
// // Add form field configs per tab

// const shipmentFormFields: FormField[] = [
//   { name: "container_no", label: "Container No", required: true },
//   { name: "vehicle_no", label: "Vehicle No", required: true },
//   { name: "vessel_name", label: "Vessel Name", required: true },
//   { name: "voyage_no", label: "Voyage No" },
//   { name: "seal_no", label: "Seal No" },
//   { name: "po_no", label: "PO No" },
//   { name: "bl_no", label: "BL No" },
// ];

// // Add a new type to FormField
// type FormField = {
//   name: string; label: string; required?: boolean; type?: string;
//   dropdown?: DropdownOption[];
//   lookup?: "product" | "container" | "country" | "manufacturer";
//   disabled?: boolean;  // ADD this
// };

// const packingFormFields: FormField[] = [
//   { name: "container_no",    label: "Container No",       required: true,  lookup: "container" },
//   { name: "prod_code",       label: "Product / SKU",      required: true,  lookup: "product" },
//   { name: "qty_puom",        label: "Quantity (Primary)",  required: true,  type: "number" },
//   { name: "qty_luom",        label: "Quantity (Lowest)",   required: true,  type: "number" },
//   { name: "quantity",        label: "Total Quantity",      type: "number",  disabled: true },  // auto-calculated
//   { name: "batch_no",        label: "Batch No" },
//   { name: "lot_no",          label: "Lot No" },
//   { name: "po_no",           label: "PO No" },
//   { name: "bl_no",           label: "BL No" },
//   { name: "doc_ref",         label: "Doc Ref" },
//   { name: "mfg_date",        label: "Production Date",    type: "date" },
//   { name: "exp_date",        label: "Expiry Date",        type: "date" },
//   { name: "country_origin",  label: "Country of Origin",  lookup: "country" },
//   { name: "manufacturer",    label: "Manufacturer",       lookup: "manufacturer" },
//   { name: "shelf_life_date", label: "Shelf Life (Date)",  type: "date" },
//   { name: "shelf_life_days", label: "Shelf Life Days",    type: "number" },
// ];


// const receivingFormFields: FormField[] = [
//   { name: "prod_code", label: "Product Code", required: true },
//   { name: "qty_arrived", label: "Arrived Qty", required: true, type: "number" },
//   { name: "uom", label: "UOM" },
//   { name: "batch_no", label: "Batch No" },
//   { name: "lot_no", label: "Lot No" },
//   { name: "po_no", label: "PO No" },
//   { name: "doc_ref", label: "Doc Ref" },
// ];


// const tallyFormFields: FormField[] = [
//   { name: "prod_code", label: "Product Code", required: true },
//   { name: "qty_tally", label: "Tally Qty", required: true, type: "number" },
//   { name: "uom", label: "UOM" },
//   { name: "batch_no", label: "Batch No" },
//   { name: "lot_no", label: "Lot No" },
//   { name: "container_no", label: "Container No" },
//   { name: "po_no", label: "PO No" },
// ];

// const putawayFormFields: FormField[] = [
//   { name: "prod_code", label: "Product Code", required: true },
//   { name: "site_to", label: "Site To", required: true },
//   { name: "location_to", label: "Location To", required: true },
//   { name: "qty_confirm", label: "Confirm Qty", required: true, type: "number" },
//   { name: "batch_no", label: "Batch No" },
//   { name: "lot_no", label: "Lot No" },
// ];

// const manualPutawayFormFields: FormField[] = [
//   { name: "prod_code", label: "Product Code", required: true },
//   { name: "site_from", label: "Site From", required: true },
//   { name: "location_from", label: "Location From", required: true },
//   { name: "site_to", label: "Site To", required: true },
//   { name: "location_to", label: "Location To", required: true },
//   { name: "qty", label: "Quantity", required: true, type: "number" },
//   { name: "batch_no", label: "Batch No" },
//   { name: "lot_no", label: "Lot No" },
// ];

// // ---------------------------------------------------------------------------
// // Page root
// // ---------------------------------------------------------------------------
// export function WmsInboundPage() {
//   const location = useLocation();
//   const view = parseInboundView(location.pathname);
//   return view.jobNo ? (
//     <InboundJobDetail jobNo={view.jobNo} tab={view.tab || "shipment_details"} />
//   ) : (
//     <InboundJobListing />
//   );
// }

// // ---------------------------------------------------------------------------
// // Listing
// // ---------------------------------------------------------------------------
// function InboundJobListing() {
//   const { user } = useAuth();
//   const { toast } = useToast(); // Add this line
//   const companyCode = user?.company_code || "";
//   const navigate = useNavigate();
// const [sortKey, setSortKey] = useState(0);

//   const [rows, setRows] = useState<WmsRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [query, setQuery] = useState("");
//   const [activeTab, setActiveTab] = useState("in_progress");
//   const [formOpen, setFormOpen] = useState(false);
//   const [form, setForm] = useState<WmsRow>(makeEmptyJob(companyCode));
//   const [saving, setSaving] = useState(false);
//   const [cancelTarget, setCancelTarget] = useState<WmsRow | null>(null);
//   const [cancelRemarks, setCancelRemarks] = useState("");
//   // Remove the notice state since we're using toast
//   // const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

//   const { options: principalOptions } = useRawSqlDropdown({
//     sql: `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PRIN_NAME`,
//     valueKey: "PRIN_CODE", labelKeys: ["PRIN_CODE", "PRIN_NAME"], enabled: !!companyCode,
//   });
//   const { options: divisionOptions } = useRawSqlDropdown({
//     sql: `SELECT DIV_CODE, DIV_NAME FROM MS_HR_DIVISION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY DIV_NAME`,
//     valueKey: "DIV_CODE", labelKeys: ["DIV_CODE", "DIV_NAME"], enabled: !!companyCode,
//   });
//   const { options: deptOptions } = useRawSqlDropdown({
//     sql: `SELECT DEPT_CODE, DEPT_NAME FROM MS_DEPARTMENT WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY DEPT_NAME`,
//     valueKey: "DEPT_CODE", labelKeys: ["DEPT_CODE", "DEPT_NAME"], enabled: !!companyCode,
//   });
//   const { options: portOptions } = useRawSqlDropdown({
//     sql: `SELECT PORT_CODE, PORT_NAME FROM MS_PORT ORDER BY PORT_NAME`,
//     valueKey: "PORT_CODE", labelKeys: ["PORT_CODE", "PORT_NAME"], enabled: true,
//   });
//   const { options: countryOptions } = useRawSqlDropdown({
//     sql: `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`,
//     valueKey: "COUNTRY_CODE", labelKeys: ["COUNTRY_CODE", "COUNTRY_NAME"], enabled: true,
//   });

//   const dropdownMap: Record<string, DropdownOption[]> = {
//     principal: principalOptions, division: divisionOptions,
//     department: deptOptions, port: portOptions, country: countryOptions,
//   };

//   const loadRows = async () => {
//     setLoading(true);
//     try {
//       const data = await executeWmsInboundSql(
//         "SELECT * FROM VW_TI_JOB WHERE JOB_TYPE = 'IMP' ORDER BY JOB_NO DESC",
//       );
//       setRows(data.map(normalizeRow));
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : "Unable to load inbound jobs");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { void loadRows(); }, []);

//   const filteredRows = useMemo(
//     () => rows.filter((row) => filterJobByTab(row, activeTab)),
//     [rows, activeTab],
//   );

//   const columns = useMemo<ColumnDef<WmsRow>[]>(
//     () => [
//       {
//         accessorKey: "job_no", header: "Job No", size: 130,
//         cell: ({ row }) => (
//           <button
//             className="font-semibold text-primary hover:underline"
//             onClick={() => navigate(inboundJobDetailPath(row.original))}
//           >
//             {value(row.original, "job_no")}
//           </button>
//         ),
//       },
//       {
//         accessorKey: "job_class", header: "Job Class", size: 180,
//         cell: ({ row }) => <JobClassPill code={value(row.original, "job_class")} />,
//       },
//       {
//         accessorKey: "prin_name", header: "Principal Name", size: 240,
//         cell: ({ row }) => value(row.original, "prin_name"),
//       },
//       {
//         accessorKey: "job_date", header: "Job Date", size: 120,
//         cell: ({ row }) => formatDate(value(row.original, "job_date")),
//       },
//       ...(activeTab === "confirmed" ? [{
//         accessorKey: "confirm_date", header: "Confirm Date", size: 130,
//         cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "confirm_date")),
//       }] : []),
//       ...(activeTab === "cancel" ? [{
//         accessorKey: "cancel_date", header: "Cancel Date", size: 130,
//         cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "cancel_date")),
//       }] : []),
//       { accessorKey: "doc_ref", header: "Doc Ref", size: 130, cell: ({ row }) => value(row.original, "doc_ref") },
//       { accessorKey: "canceled", header: "Canceled", size: 100, cell: ({ row }) => flagBadge(value(row.original, "canceled")) },
//       { accessorKey: "invoiced", header: "Invoiced", size: 100, cell: ({ row }) => flagBadge(value(row.original, "invoiced")) },
//       {
//         accessorKey: "invoice_date", header: "Invoice Date", size: 130,
//         cell: ({ row }) => formatDate(value(row.original, "invoice_date")),
//       },
//       {
//         id: "actions", header: "Actions", size: 120, enableColumnFilter: false,
//         cell: ({ row }) => (
//           <div className="flex items-center gap-1">
//             <Button size="icon" variant="ghost" title="Open job"
//               onClick={() => navigate(`view/${value(row.original, "job_no")}/shipment_details?principal_code=${value(row.original, "prin_code")}`)}>
//               <Eye size={14} />
//             </Button>
//             {activeTab !== "cancel" && (
//               <Button size="icon" variant="ghost" title="Cancel job" onClick={() => setCancelTarget(row.original)}>
//                 <Ban size={14} />
//               </Button>
//             )}
//           </div>
//         ),
//       },
//     ],
//     [activeTab, navigate],
//   );

//   const saveJob = async (event: FormEvent) => {
//     event.preventDefault();
//     if (!String(form.prin_code || "").trim()) {
//       toast.warning("Principal is required");
//       return;
//     }
//     if (!String(form.job_class || "").trim()) {
//       toast.warning("Job Classification is required");
//       return;
//     }
//     setSaving(true);
//     try {
//       const now = new Date().toISOString();
//       const today = now.slice(0, 10);

//       const payload = {
//         job_type:            form.job_type || "IMP",
//         company_code:        form.company_code || companyCode,
//         job_date:            now,
//         job_class:           form.job_class || "N",
//         dept_code:           String(form.dept_code || ""),
//         transport_mode:      String(form.transport_mode || "S"),
//         doc_ref:             String(form.doc_ref || ""),
//         port_code:           String(form.port_code || ""),
//         description1:        String(form.description1 || ""),
//         description2:        "",
//         prin_ref1:           "",
//         prin_ref2:           String(form.prin_ref2 || ""),
//         remarks:             String(form.remarks || ""),
//         eta:                 null,
//         ata:                 null,
//         etd:                 null,
//         payment_terms:       "",
//         curr_code:           "OMR",
//         ex_rate:             1,
//         frieght_value:       0,
//         insurance_value:     0,
//         cust_code:           "",
//         container_flag:      "",
//         container:           "",
//         packdet:             "N",
//         allocated:           "N",
//         canceled:            "N",
//         confirmed:           "N",
//         grn_no:              null,
//         invoiced:            "N",
//         completed:           "",
//         exp_jobno:           "",
//         picked:              "N",
//         ordered:             "N",
//         destination_port:    String(form.destination_port || ""),
//         vessel_name:         "",
//         voyage_no:           "",
//         payableat:           "",
//         place_receipt:       "",
//         place_delivery:      "",
//         no_of_original_bl:   null,
//         broker_code:         "",
//         quotation_ref:       "",
//         be_deposits:         "",
//         ind_freight:         "",
//         country_origin:      String(form.country_origin || ""),
//         country_destination: String(form.country_destination || ""),
//         custom_recno:        "",
//         doc_ref2:            "",
//         hawb:                "",
//         reexport:            "",
//         ref_jobno:           "",
//         combined_jobno:      "",
//         carrier:             "",
//         job_lock:            "",
//         courier_code:        "",
//         delivery_point:      "",
//         div_code:            String(form.div_code || ""),
//         salesman_code:       "",
//         transit_time:        "",
//         document_check:      "",
//         delivery_remarks:    "",
//         cargo_received:      "",
//         delivered_by:        "",
//         canceled_by:         "",
//         cancel_remarks:      "",
//         send_mail:           "",
//         backlog_mail:        "",
//         dplan_flag:          "",
//         trans_batch_id:      "",
//         send_mail_dn:        "",
//         kpi_inc:             "",
//         kpi_exc_remark:      "",
//         job_category:        "N/A",
//         edit_user:           "",
//         tx_cat_code:         "",
//         bcf_code:            "",
//         request_category:    "",
//         load_point:          "",
//         updated_by:          user?.loginid || "Admin",
//         created_by:          user?.loginid || "Admin",
//         created_at:          now,
//         prin_code:           String(form.prin_code || ""),
//         schedule_date:       String(form.schedule_date || today),
//       };

//       await postWmsInbound("inboundjob", payload);
//       setFormOpen(false);
//       toast.success("Inbound job saved successfully");
//       await loadRows();
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : "Unable to save inbound job");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const confirmCancel = async () => {
//     if (!cancelTarget || !cancelRemarks.trim()) {
//       toast.warning("Please enter cancellation remarks");
//       return;
//     }
//     setSaving(true);
//     try {
//       await patchWmsInbound("canceljob", {
//         job_no: value(cancelTarget, "job_no"), 
//         prin_code: value(cancelTarget, "prin_code"), 
//         remarks: cancelRemarks,
//       });
//       setCancelTarget(null); 
//       setCancelRemarks("");
//       toast.success("Inbound job cancellation submitted");
//       await loadRows();
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : "Unable to cancel inbound job");
//     } finally { 
//       setSaving(false); 
//     }
//   };

//   return (
//     <section className="grid gap-4">
//       <div className="flex flex-wrap items-start justify-between gap-3">
//         <div>
//           <p className="eyebrow">WMS Inbound</p>
//           <h1 className="m-0 text-2xl font-semibold text-foreground">Inbound Job Listing</h1>
//           <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
//             Manage import jobs, shipment progress, receiving, putaway, confirmation, and activity billing.
//           </p>
//         </div>
//         <div className="flex flex-wrap items-center gap-2">
//           <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
//           <Button onClick={() => { setForm(makeEmptyJob(companyCode)); setFormOpen(true); }}>
//             <Plus size={15} /> Add Job
//           </Button>
//         </div>
//       </div>

//       {/* Remove the notice div since we're using toasts now */}
      
//       <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
//         {listingTabs.map((tab) => (
//           <Button key={tab.value} size="sm" variant={activeTab === tab.value ? "default" : "outline"}
//             onClick={() => setActiveTab(tab.value)}>
//             {tab.label}
//           </Button>
//         ))}
//       </div>

//       <DataTable
//         key={sortKey}
//         columns={columns} data={filteredRows}
//         title={loading ? "Loading" : `${filteredRows.length} Jobs`}
//         subtitle="Inbound Jobs" searchValue={query} onSearchChange={setQuery}
//         searchPlaceholder="Search job, principal, reference..."
//         loading={loading} height="calc(100vh - 310px)" minWidth={1380} density="grid"
//         enablePagination pageSize={50}
//         getRowId={(row, index) => String(value(row, "job_no") || index)}
//         rowClassName={(row) =>
//           isCanceled(row) ? "bg-red-50/70"
//             : hasDate(value(row, "confirm_date")) ? "bg-emerald-50/70"
//             : "bg-blue-50/50"
//         }
//       />

//       {/* Add Job Dialog */}
//       <InboundFormFrame
//         open={formOpen}
//         title="Add Inbound Job"
//         onClose={() => setFormOpen(false)}
//         footer={
//           <>
//             <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
//               <X size={15} /> Cancel
//             </Button>
//             <Button disabled={saving} form="inbound-job-form" type="submit">
//               <Save size={15} /> {saving ? "Saving..." : "Save Job"}
//             </Button>
//           </>
//         }
//       >
//         <InboundJobCreateForm
//           form={form}
//           setForm={setForm}
//           companyCode={companyCode}
//           onSubmit={saveJob}
//         />
//       </InboundFormFrame>
      
//       {/* Cancel Job Dialog */}
//       <Dialog open={Boolean(cancelTarget)}
//         title={`Cancel Job ${cancelTarget ? value(cancelTarget, "job_no") : ""}`}
//         description="Please enter cancellation remarks before submitting."
//         compact tone="danger" onClose={() => setCancelTarget(null)}
//         footer={
//           <>
//             <Button variant="outline" onClick={() => setCancelTarget(null)}>Close</Button>
//             <Button variant="destructive" disabled={saving || !cancelRemarks.trim()} onClick={confirmCancel}>
//               Confirm Cancel
//             </Button>
//           </>
//         }>
//         <label className="field">
//           <span>Cancel Remarks</span>
//           <Input value={cancelRemarks} onChange={(event) => setCancelRemarks(event.target.value)} placeholder="Enter reason..." />
//         </label>
//       </Dialog>
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Job Detail
// // ---------------------------------------------------------------------------
// function InboundJobDetail({ jobNo, tab }: { jobNo: string; tab: string }) {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [job, setJob] = useState<WmsRow | null>(null);
//   const [loading, setLoading] = useState(true);
//  const location = useLocation();

//    const basePath = location.pathname.split("/").slice(0, -1).join("/");

//   const loadJob = async () => {
//     setLoading(true);
//     try {
//       const data = await getWmsInbound<WmsRow>(`job/${encodeURIComponent(jobNo)}`);
//       setJob(normalizeRow(data || {}));
//     } catch {
//       try {
//         const fallback = await executeWmsInboundSql(
//           `SELECT * FROM VW_TI_JOB WHERE JOB_NO = '${sqlEscape(jobNo)}' AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`,
//         );
//         setJob(normalizeRow(fallback[0] || { job_no: jobNo }));
//       } catch {
//         setJob(normalizeRow({ job_no: jobNo }));
//       }
//     } finally { setLoading(false); }
//   };

//   useEffect(() => { void loadJob(); }, [jobNo]);

//   const availableTabs = getTabsForJob(value(job || {}, "job_class"));
//   const activeTab = availableTabs.some((item) => item.value === tab) ? tab : "shipment_details";

//   const jobStatus = isCanceled(job || {}) ? "Canceled"
//     : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress";

//   const statusColor = jobStatus === "Canceled" ? "text-red-600 bg-red-50 border-red-200"
//     : jobStatus === "Confirmed" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
//     : "text-blue-600 bg-blue-50 border-blue-200";

//   return (
//     <section className="grid gap-3">
//       {/* Header */}
// {/* Header */}
// <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
//   <div className="flex min-w-0 items-center gap-3">
//     <Button
//       size="icon"
//       variant="outline"
//       onClick={() => navigate("/workspace/wms/wms/transactions/inbound/jobs")}
//       title="Back to jobs"
//     >
//       <ArrowLeft size={16} />
//     </Button>
//     <div className="min-w-0">
//       <p className="eyebrow mb-0.5">Inbound Job</p>
//       <h1 className="m-0 truncate text-xl font-semibold leading-tight">{jobNo}</h1>
//     </div>

//     {/* Divider */}
//     <div className="hidden h-8 w-px bg-border sm:block" />

//     {/* Principal pill */}
//     {job && value(job, "prin_code") && (
//       <div className="flex flex-col gap-0.5">
//         <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Principal</span>
//         <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
//           {value(job, "prin_code")}
//           {value(job, "prin_name") ? ` · ${value(job, "prin_name")}` : ""}
//         </span>
//       </div>
//     )}

//     {/* Job Date pill */}
//     {job && value(job, "job_date") && (
//       <div className="flex flex-col gap-0.5">
//         <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Job Date</span>
//         <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
//           {formatDate(value(job, "job_date"))}
//         </span>
//       </div>
//     )}

//     {/* Divider */}
//     <div className="hidden h-8 w-px bg-border sm:block" />

//     {/* Job Class pill */}
//     {job && <JobClassPill code={value(job, "job_class")} />}

//     {/* Status pill */}
//     <span className={cn(
//       "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
//       statusColor
//     )}>
//       {jobStatus}
//     </span>
//   </div>

//   <div className="flex flex-wrap gap-2">
//     <Button size="sm" variant="outline" onClick={loadJob}><RefreshCw size={14} /> Refresh</Button>
//     <Button size="sm" variant="outline"><Printer size={14} /> Print</Button>
//   </div>
// </div>

//       {/* Tabs */}
//       <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
//         {availableTabs.map((item) => (
//           <Link
//             className={item.value === activeTab
//               ? "ui-button ui-button-default ui-button-sm whitespace-nowrap"
//               : "ui-button ui-button-outline ui-button-sm whitespace-nowrap"}
//             key={item.value}
//          to={`${basePath}/${item.value}${locationSearchPrincipal(job)}`}
//           >
//             {item.label}
//           </Link>
//         ))}
//       </div>

//       {/* Tab content */}
//       <InboundOperationalTab job={job} jobNo={jobNo} tab={activeTab} loadingJob={loading} />
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Operational Tab — with per-tab Add modal
// // ---------------------------------------------------------------------------
// function InboundOperationalTab({
//   job, jobNo, tab, loadingJob,
// }: { job: WmsRow | null; jobNo: string; tab: string; loadingJob: boolean; }) {
//   const { user } = useAuth();
//     const { toast } = useToast();
//   const prinCode = value(job || {}, "prin_code");
//   const companyCode = user?.company_code || "";
// // ADD after existing useState declarations
// const [editOpen, setEditOpen] = useState(false);
// const [editForm, setEditForm] = useState<WmsRow>({});
// const [editSaving, setEditSaving] = useState(false);
//   const [rows, setRows] = useState<WmsRow[]>([]);
//   const [query, setQuery] = useState("");
//   const [loading, setLoading] = useState(false);
//   // const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
//   const [addOpen, setAddOpen] = useState(false);
//   const [addForm, setAddForm] = useState<WmsRow>({});
//   const [saving, setSaving] = useState(false);
//   // For Quality Clearance process modal
// const [processOpen, setProcessOpen] = useState(false);
// const [sortKey, setSortKey] = useState(0);

// const [clearanceForm, setClearanceForm] = useState({
//   truck_condition: "",
//   container_condition: "",
//   container_type: "",
//   ref_box_temp: "",
//   prod_temp: "",
//   prod_con_acceptance: "",
// });
// const [putawayForm, setPutawayForm] = useState({
//   site_from: "",   site_from_name: "",
//   location_from: "", location_from_name: "",
//   site_to: "",     site_to_name: "",
//   location_to: "", location_to_name: "",
// });
// const [siteOptions,         setSiteOptions]         = useState<DropdownOption[]>([]);
// const [locationFromOptions, setLocationFromOptions] = useState<DropdownOption[]>([]);
// const [locationToOptions,   setLocationToOptions]   = useState<DropdownOption[]>([]);
// const [selectedRows, setSelectedRows] = useState<WmsRow[]>([]);
// // ADD alongside the existing notice state:
// const [modalNotice, setModalNotice] = useState<string | null>(null);
//   const config = getInboundTabConfig(tab);

// // REPLACE the getLookupProps function signature and product case:

// const getLookupProps = (field: FormField, isEditMode = false) => {
//   const formData = isEditMode ? editForm : addForm;
//   const setFormData = isEditMode ? setEditForm : setAddForm;

//   switch (field.lookup) {
//     case "product":
//       return {
//         valueField: "PROD_CODE",
//         displayFields: ["PROD_CODE", "PROD_NAME"],
//         columns: [
//           { field: "PROD_CODE", header: "Product Code" },
//           { field: "PROD_NAME", header: "Product Name" },
//           { field: "UOM_CODE",  header: "UOM" },
//         ],
//         loadOptions: async () => {
//           if (tab === "packing_details" && !formData.container_no) {
//             throw new Error("Please select a Container No. first before selecting a product.");
//           }
//           const res = await api.post("/api/wms/inbound/executeRawSql", {
//             raw_sql: `SELECT *
//                       FROM MS_PRODUCT 
//                       WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND PRIN_CODE = '${sqlEscape(prinCode)}'
//                       ORDER BY PROD_NAME`,
//           });
//           return Array.isArray(res.data?.data) ? res.data.data
//                : Array.isArray(res.data) ? res.data : [];
//         },
//         onChange: (val: string, row: Record<string, unknown> | null) => {
//           const uppp   = Number(row?.["UPPP"]      ?? row?.["uppp"]      ?? 1);
//           const uomCount = Number(row?.["UOM_COUNT"] ?? row?.["uom_count"] ?? 1);
//           const pUom   = String(row?.["UOM_CODE"]  ?? row?.["uom_code"]  ?? "");
//           const lUom   = String(row?.["L_UOM"]     ?? row?.["l_uom"]     ?? "");

//           setFormData((cur) => {
//             const qtyPuom = Number(cur.qty_puom ?? 0);
//             const qtyLuom = uomCount <= 1 ? 0 : Number(cur.qty_luom ?? 0);
//             const quantity = uomCount <= 1
//               ? qtyPuom + qtyLuom
//               : qtyPuom * uppp + qtyLuom;

//             return {
//               ...cur,
//               prod_code: val,
//               // prod_code_display: row ? `${row["PROD_CODE"] ?? ""} - ${row["PROD_NAME"] ?? ""}` : "",
//               p_uom: pUom,
//               l_uom: lUom,
//               uppp,
//               uom_count: uomCount,
//               qty_luom: uomCount <= 1 ? 0 : cur.qty_luom,
//               quantity,
//             };
//           });
//         },
//       };

// case "container": {
// const cacheKey = `wms_containers_${jobNo}_v2`;
//   return {
//     valueField: "CONTAINER_NO",
//     displayFields: ["CONTAINER_NO"],
//     columns: [
//       { field: "CONTAINER_NO", header: "Container No" },
//       { field: "VEHICLE_NO",   header: "Vehicle No" },
//       { field: "VESSEL_NAME",  header: "Vessel Name" },
//       { field: "SEAL_NO",      header: "Seal No" },
//       { field: "PO_NO",        header: "PO No" },   // ← ADD to display column too
//     ],
//     loadOptions: async () => {
//       const cached = sessionStorage.getItem(cacheKey);
//       if (cached) { try { return JSON.parse(cached); } catch { /* fall through */ } }
//       const res = await api.post("/api/wms/inbound/executeRawSql", {
//         raw_sql: `SELECT CONTAINER_NO, VEHICLE_NO, VESSEL_NAME, SEAL_NO, PO_NO  
//                   FROM TI_CONTAINER 
//                   WHERE JOB_NO = '${sqlEscape(jobNo)}' 
//                     AND PRIN_CODE = '${sqlEscape(prinCode)}' 
//                   ORDER BY CONTAINER_NO`,  // ← PO_NO added here
//       });
//       const data = Array.isArray(res.data?.data) ? res.data.data
//                  : Array.isArray(res.data) ? res.data : [];
//       sessionStorage.setItem(cacheKey, JSON.stringify(data));
//       return data;
//     },
//     onChange: (val: string, row: Record<string, unknown> | null) =>
//       setFormData((cur) => ({
//         ...cur,
//         container_no: val,
//         po_no: String(row?.["PO_NO"] ?? row?.["po_no"] ?? null),  // ← auto-set po_no
//       })),
//   };
// }

//     case "country":
//       return {
//         valueField: "COUNTRY_CODE",
//         displayFields: ["COUNTRY_CODE", "COUNTRY_NAME"],
//         columns: [
//           { field: "COUNTRY_CODE", header: "Code" },
//           { field: "COUNTRY_NAME", header: "Country" },
//         ],
//         loadOptions: async () => {
//           const res = await api.post("/api/wms/inbound/executeRawSql", {
//             raw_sql: `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`,
//           });
//           return Array.isArray(res.data?.data) ? res.data.data
//                : Array.isArray(res.data) ? res.data : [];
//         },
//         onChange: (val: string, row: Record<string, unknown> | null) =>
//           setFormData((cur) => ({
//             ...cur,
//             country_origin: val,
//             country_origin_display: row ? `${row["COUNTRY_CODE"] ?? ""} - ${row["COUNTRY_NAME"] ?? ""}` : "",
//           })),
//       };

//     case "manufacturer":
//       return {
//         valueField: "MANU_CODE",
//         displayFields: ["MANU_CODE", "MANU_NAME"],
//         columns: [
//           { field: "MANU_CODE", header: "Code" },
//           { field: "MANU_NAME", header: "Manufacturer" },
//         ],
//         loadOptions: async () => {
//           const res = await api.post("/api/wms/inbound/executeRawSql", {
//             raw_sql: `SELECT MANU_CODE, MANU_NAME FROM MS_MANUFACTURER 
//                       WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY MANU_NAME`,
//           });
//           return Array.isArray(res.data?.data) ? res.data.data
//                : Array.isArray(res.data) ? res.data : [];
//         },
//         onChange: (val: string, row: Record<string, unknown> | null) =>
//           setFormData((cur) => ({
//             ...cur,
//             manufacturer: val,
//             manufacturer_display: row ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}` : "",
//           })),
//       };

//     default:
//       return null;
//   }
// };
// // Add this helper inside InboundOperationalTab, after getLookupProps
// const recalcQuantity = (
//   formData: WmsRow,
//   field: "qty_puom" | "qty_luom",
//   rawValue: string,
// ): Partial<WmsRow> => {
//   const val = rawValue.charAt(0) === "-" ? "" : rawValue;
//   const uppp     = Number(formData.uppp     ?? 1);
//   const uomCount = Number(formData.uom_count ?? 1);
//   const qtyPuom  = field === "qty_puom" ? Number(val) : Number(formData.qty_puom ?? 0);
//   const qtyLuom  = field === "qty_luom" ? Number(val) : Number(formData.qty_luom ?? 0);
//   const quantity  = uomCount <= 1 ? qtyPuom + qtyLuom : qtyPuom * uppp + qtyLuom;
//   return { [field]: val, quantity };
// };
//   const loadRows = useCallback(async () => {
//     if (!config || loadingJob || !prinCode) return;
//     setLoading(true);
//     // setNotice(null);
//     try {
//       const data = await executeWmsInboundSql(
//         config.sql({ companyCode, jobNo, prinCode }),
//       );
//       setRows(data.map(normalizeRow));
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : `Unable to load ${config?.title}`);
//     } finally { setLoading(false); }
//   }, [tab, jobNo, prinCode, loadingJob, companyCode]);

//   useEffect(() => { void loadRows(); }, [loadRows]);

//   // Reset form when opening
// const openAddModal = () => {
//     setAddForm({ job_no: jobNo, prin_code: prinCode, company_code: companyCode });
//     setAddOpen(true);
//   };

//   const openPutawayModal = async () => {
//     // load sites
//     try {
//       const res = await api.post("/api/wms/inbound/executeRawSql", {
//         raw_sql: `SELECT SITE_CODE, SITE_NAME FROM MS_SITE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY SITE_CODE`,
//       });
//       const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
//       setSiteOptions(data.map((r: Record<string,unknown>) => ({
//         value: String(r["SITE_CODE"] ?? r["site_code"] ?? ""),
//         label: `${r["SITE_CODE"] ?? r["site_code"]} - ${r["SITE_NAME"] ?? r["site_name"]}`,
//       })));
//     } catch { /* ignore */ }
//     setPutawayForm({ site_from: "", site_from_name: "", location_from: "", location_from_name: "", site_to: "", site_to_name: "", location_to: "", location_to_name: "" });
//     setLocationFromOptions([]);
//     setLocationToOptions([]);
//     setModalNotice(null);
//     setProcessOpen(true);
//   };

//   const loadLocations = async (siteCode: string, target: "from" | "to") => {
//     if (!siteCode) {
//       target === "from" ? setLocationFromOptions([]) : setLocationToOptions([]);
//       return;
//     }
//     try {
//       const res = await api.post("/api/wms/inbound/executeRawSql", {
//         raw_sql: `SELECT * FROM MS_LOCATION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND SITE_CODE = '${sqlEscape(siteCode)}' ORDER BY LOCATION_CODE`,
//       });
//       const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
//       const opts = data.map((r: Record<string,unknown>) => ({
//         value: String(r["LOCATION_CODE"] ?? r["location_code"] ?? ""),
//         label: `${r["LOCATION_CODE"] ?? r["location_code"]}`
//       }));
//       target === "from" ? setLocationFromOptions(opts) : setLocationToOptions(opts);
//     } catch { /* ignore */ }
//   };
// // Add this helper just above saveAdd:
// const stripUiFields = (form: WmsRow): WmsRow => {
//   const {
//     uom_count,           // UI-only (controls qty_luom disabled state)
//     prod_code_display,   // UI-only (display label)
//     country_origin_display,
//     manufacturer_display,
//     ...payload
//   } = form;
//   return payload;
// };
// const saveAdd = async (e: FormEvent) => {
//   e.preventDefault();
//   if (!config?.addEndpoint) return;
//   setModalNotice(null);  // ← clear on each attempt

//   if (tab === "packing_details") {
//     if (!addForm.container_no) {
//       setModalNotice("Container No. is required. Please select a container first.");
//       return;
//     }
//     if (!addForm.prod_code) {
//       setModalNotice("Product / SKU is required.");
//       return;
//     }
//     if (!addForm.qty_puom || Number(addForm.qty_puom) <= 0) {
//       setModalNotice("Quantity (Primary) is required and must be greater than 0.");
//       return;
//     }
//     if (addForm.qty_luom === undefined || addForm.qty_luom === "") {
//       setModalNotice("Quantity (Lowest) is required.");
//       return;
//     }
//   } else {
//     const fields = config?.addFields || [];
//     const missing = fields.find((f) => f.required && !String(addForm[f.name] || "").trim());
//     if (missing) {
//       setModalNotice(`${missing.label} is required`);
//       return;
//     }
//   }

//   setSaving(true);
//   try {
//     if (config.addEndpoint === "shipment") {
//       sessionStorage.removeItem(`wms_containers_${jobNo}_v2`);
//     }
//     await postWmsInbound(config.addEndpoint, {
//   ...stripUiFields(addForm),   // ← was: ...addForm
//       job_no: jobNo,
//       prin_code: prinCode,
//       company_code: companyCode,
//     });
//     setAddOpen(false);
//     setModalNotice(null);
//     toast.success(`${config.title} added successfully`);
//     await loadRows();
//   } catch (error) {
//     setModalNotice(error instanceof Error ? error.message : `Unable to add ${config?.title}`);
//   } finally {
//     setSaving(false);
//   }
// };

// const saveEdit = async (e: FormEvent) => {
//   e.preventDefault();
//   setModalNotice(null);

//   if (tab === "packing_details") {
//     if (!editForm.container_no) { setModalNotice("Container No. is required."); return; }
//     if (!editForm.prod_code)    { setModalNotice("Product / SKU is required."); return; }
//     if (!editForm.qty_puom || Number(editForm.qty_puom) <= 0) {
//       setModalNotice("Quantity (Primary) is required.");
//       return;
//     }
//   } else if (tab === "receiving_details") {
//     // Validate at least one quantity is positive
//     const q1 = Number(editForm.qty1_arrived);
//     const q2 = Number(editForm.qty2_arrived);
//     if (isNaN(q1) || isNaN(q2)) {
//       setModalNotice("Both quantity fields must be numbers.");
//       return;
//     }
//     if (q1 <= 0 && q2 <= 0) {
//       setModalNotice("At least one quantity must be greater than zero.");
//       return;
//     }
//   } else {
//     return;
//   }

//   setEditSaving(true);
//   try {
//     if (tab === "packing_details") {
//       await patchWmsInbound("packing_details", {
//         ...stripUiFields(editForm),
//         job_no: jobNo,
//         prin_code: prinCode,
//         company_code: companyCode,
//         packdet_no: String(editForm.packdet_no || ""),
//       });
//     } else if (tab === "receiving_details") {
//   const url = `/api/wms/inbound/packing_details/receiving?prin_code=${encodeURIComponent(prinCode)}&job_no=${encodeURIComponent(jobNo)}&packdet_no=${encodeURIComponent(String(editForm.packdet_no))}`;
//   const payload = {
//     qty1_arrived: Number(editForm.qty1_arrived),
//     qty2_arrived: Number(editForm.qty2_arrived),
//   };
//   await api.put(url, payload);
// }
//     setEditOpen(false);
//     setModalNotice(null);
//     toast.success(`${tab === "packing_details" ? "Packing detail" : "Receiving detail"} updated successfully`);
//     await loadRows();
//   } catch (error) {
//     setModalNotice(error instanceof Error ? error.message : "Unable to update record");
//   } finally {
//     setEditSaving(false);
//   }
// };
//   if (!config) return (
//     <Card><CardContent className="p-6 text-sm text-muted-foreground">This tab is not configured yet.</CardContent></Card>
//   );

//   // Action button per tab
//   const getActionButton = () => {
//     switch (tab) {
//       case "quality_clearance":
//         return (
//           <Button size="sm" variant="outline"
//             onClick={() => setProcessOpen(true)}
//             disabled={selectedRows.length === 0}>
//             <Settings2 size={14} /> Process Clearance
//           </Button>
//         );
//       case "putway_details":
//         return (
//           <Button size="sm" variant="outline"
//             onClick={openPutawayModal}
//             disabled={selectedRows.length === 0}>
//             <Truck size={14} /> Process Putaway
//           </Button>
//         );
//       case "job_confirmation":
//         return (
//           <Button size="sm" variant="outline"
//             onClick={() => setProcessOpen(true)}
//             disabled={selectedRows.length === 0}>
//             <CheckCircle2 size={14} /> Process Confirm Selected
//           </Button>
//         );
//       case "receiving_details":
//         return null
//         // return (
//         //   <Button size="sm" variant="outline" onClick={openAddModal}>
//         //     <PackageCheck size={14} /> Add Receiving
//         //   </Button>
//         // );
//       default:
//         if (config.addFields && config.addEndpoint) {
//           return (
//             <Button size="sm" variant="outline" onClick={openAddModal}>
//               <Plus size={14} /> {config.addLabel || `Add ${config.title}`}
//             </Button>
//           );
//         }
//         return null;
//     }
//   };

//   const toolbar = (
//     <div className="flex flex-wrap items-center gap-2">
//       {getActionButton()}
//       <Button size="sm" variant="outline" onClick={loadRows}><RefreshCw size={14} /> Refresh</Button>
//     </div>
//   );

// const columns = makeColumns(
//   config.columns,
//   tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation",
//   (tab === "packing_details" || tab === "receiving_details")
//     ? (row) => {
//         if (tab === "packing_details") {
//           setEditForm({
//             ...row,
//             uom_count: Number(row.uom_count ?? 1),
//             uppp: Number(row.uppp ?? 1),
//             qty_puom: Number(row.qty_puom ?? 0),
//             qty_luom: Number(row.qty_luom ?? 0),
//             quantity: Number(row.quantity ?? 0),
//           });
//         } else if (tab === "receiving_details") {
//           // Map backend fields to editForm
//           setEditForm({
//             packdet_no: row.packdet_no,
//             prod_name: row.prod_name,
//             batch_no: row.batch_no,
//             lot_no: row.lot_no,
//             po_no: row.po_no,
//             doc_ref: row.doc_ref,
//             qty1_arrived: Number(row.qty1_arrived ?? row.qty_arrived ?? 0),
//             qty2_arrived: Number(row.qty2_arrived ?? 0),
//           });
//         }
//         setEditOpen(true);
//       }
//     : undefined
// );
//   return (
//     <section className="grid gap-3">
//       {/* {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>} */}

//       <DataTable
//         key={sortKey}
//         columns={columns} data={rows}
//         title={loading ? "Loading" : `${rows.length} Rows`}
//         subtitle={config.title} searchValue={query} onSearchChange={setQuery}
//         searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
//         loading={loading || loadingJob} height="calc(100vh - 365px)"
//         minWidth={config.minWidth} density="grid" enablePagination pageSize={75}
//         toolbar={toolbar}
//         getRowId={(row, index) =>
//           `${tab}_${value(row, "packdet_no") || value(row, "container_no") || value(row, "key_number") || index}`
//         }
//         onRowSelectionChange={
//           (tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation")
//             ? setSelectedRows
//             : undefined
//         }
//       />

// {/* Add Modal */}
// <Dialog
//   wide
//   open={addOpen}
//   title={config.addLabel || `Add ${config.title}`}
//   description={`Fill in the details to add a new ${config.title.toLowerCase()} record.`}
//   onClose={() => setAddOpen(false)}
// >
//   <form className="grid gap-2" onSubmit={saveAdd}>
//         {modalNotice && (
//       <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
//         {modalNotice}
//       </div>
//     )}
//     <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
//       {(config.addFields ?? []).map((field) => (
//         <label
//           key={field.name}
//           className={
//             field.name === "remarks" || field.name === "description1"
//               ? "field col-span-2 md:col-span-3"
//               : "field"
//           }
//         >
//           <span className="text-xs font-medium text-muted-foreground">
//             {field.label}
//             {field.required && <strong className="text-destructive"> *</strong>}
//           </span>

// {field.lookup ? (() => {
//   const lp = getLookupProps(field);
//   if (!lp) return null;
//   return (
//     <LookupField
//       label={field.label}
//       compact
//       value={String(addForm[field.name] || "")}
//       displayValue={String(addForm[`${field.name}_display`] || "")}
//       valueField={lp.valueField}
//       displayFields={lp.displayFields}
//       columns={lp.columns}
//       loadOptions={lp.loadOptions}
//       onChange={lp.onChange}
//     />
//   );
// })() : field.dropdown && field.dropdown.length > 0 ? (
//   <Select
//     value={String(addForm[field.name] || "")}
//     onChange={(e) => setAddForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
//   >
//     <option value="">— Select {field.label} —</option>
//     {field.dropdown.map((opt) => (
//       <option key={opt.value} value={opt.value}>{opt.label}</option>
//     ))}
//   </Select>
// // REPLACE the Input render at the bottom of the Add Modal's field map:
// ) : field.name === "qty_puom" ? (
//   <Input
//     type="number"
//     min="0"
//     value={String(addForm.qty_puom ?? "")}
//     onChange={(e) =>
//       setAddForm((cur) => ({ ...cur, ...recalcQuantity(cur, "qty_puom", e.target.value) }))
//     }
//   />
// ) : field.name === "qty_luom" ? (
//   <Input
//     type="number"
//     min="0"
//     disabled={Number(addForm.uom_count ?? 1) <= 1}
//     value={String(addForm.qty_luom ?? "")}
//     onChange={(e) =>
//       setAddForm((cur) => ({ ...cur, ...recalcQuantity(cur, "qty_luom", e.target.value) }))
//     }
//   />
// ) : field.disabled || field.name === "quantity" ? (
//   <Input
//     type="number"
//     disabled
//     value={String(addForm.quantity ?? 0)}
//     className="bg-muted text-muted-foreground"
//   />
// ) : (
//   <Input
//     type={field.type || "text"}
//     value={String(addForm[field.name] || "")}
//     onChange={(e) => setAddForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
//   />
// )
// }
//         </label>
//       ))}
//     </div>
//     <div className="flex justify-end gap-2 pt-1">
//       <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
//         <X size={15} /> Cancel
//       </Button>
//       <Button disabled={saving} type="submit">
//         <Save size={15} /> {saving ? "Saving..." : "Save"}
//       </Button>
//     </div>
//   </form>
// </Dialog>
// {/* Edit Packing Modal */}
// {(tab === "packing_details" || tab === "receiving_details") && (
//   <Dialog
//     wide
//     open={editOpen}
//     title={tab === "packing_details" ? "Edit Packing Details" : "Edit Receiving Quantity"}
//     description={
//       tab === "packing_details"
//         ? "Update the packing detail record."
//         : "Update the arrived quantities for this product."
//     }
//     onClose={() => {
//       setEditOpen(false);
//       setModalNotice(null);
//     }}
//   >
//     <form className="grid gap-2" onSubmit={saveEdit}>
//       {modalNotice && (
//         <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
//           {modalNotice}
//         </div>
//       )}

//       {tab === "packing_details" ? (
//         // ---------- PACKING DETAILS (existing generic fields) ----------
//         <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
//           {(config.addFields ?? []).map((field) => (
//             <label
//               key={field.name}
//               className={
//                 field.name === "remarks" || field.name === "description1"
//                   ? "field col-span-2 md:col-span-3"
//                   : "field"
//               }
//             >
//               <span className="text-xs font-medium text-muted-foreground">
//                 {field.label}
//                 {field.required && <strong className="text-destructive"> *</strong>}
//               </span>

//               {field.lookup ? (() => {
//                 const lp = getLookupProps(field, true);
//                 if (!lp) return null;
//                 return (
//                   <LookupField
//                     label={field.label}
//                     compact
//                     value={String(editForm[field.name] || "")}
//                     displayValue={String(editForm[`${field.name}_display`] || "")}
//                     valueField={lp.valueField}
//                     displayFields={lp.displayFields}
//                     columns={lp.columns}
//                     loadOptions={lp.loadOptions}
//                     onChange={(val, row) => {
//                       if (field.name === "prod_code") {
//                         setEditForm((cur) => ({
//                           ...cur,
//                           prod_code: val,
//                           uom: row ? String(row["UOM_CODE"] ?? cur.uom ?? "") : String(cur.uom ?? ""),
//                         }));
//                       } else if (field.name === "container_no") {
//                         setEditForm((cur) => ({ ...cur, container_no: val }));
//                       } else if (field.name === "country_origin") {
//                         setEditForm((cur) => ({
//                           ...cur,
//                           country_origin: val,
//                           country_origin_display: row
//                             ? `${row["COUNTRY_CODE"] ?? ""} - ${row["COUNTRY_NAME"] ?? ""}`
//                             : "",
//                         }));
//                       } else if (field.name === "manufacturer") {
//                         setEditForm((cur) => ({
//                           ...cur,
//                           manufacturer: val,
//                           manufacturer_display: row
//                             ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}`
//                             : "",
//                         }));
//                       }
//                     }}
//                   />
//                 );
//               })() : field.dropdown && field.dropdown.length > 0 ? (
//                 <Select
//                   value={String(editForm[field.name] || "")}
//                   onChange={(e) =>
//                     setEditForm((cur) => ({ ...cur, [field.name]: e.target.value }))
//                   }
//                 >
//                   <option value="">— Select {field.label} —</option>
//                   {field.dropdown.map((opt) => (
//                     <option key={opt.value} value={opt.value}>
//                       {opt.label}
//                     </option>
//                   ))}
//                 </Select>
//               ) : field.name === "qty_puom" ? (
//                 <Input
//                   type="number"
//                   min="0"
//                   value={String(editForm.qty_puom ?? "")}
//                   onChange={(e) =>
//                     setEditForm((cur) => ({
//                       ...cur,
//                       ...recalcQuantity(cur, "qty_puom", e.target.value),
//                     }))
//                   }
//                 />
//               ) : field.name === "qty_luom" ? (
//                 <Input
//                   type="number"
//                   min="0"
//                   disabled={Number(editForm.uom_count ?? 1) <= 1}
//                   value={String(editForm.qty_luom ?? "")}
//                   onChange={(e) =>
//                     setEditForm((cur) => ({
//                       ...cur,
//                       ...recalcQuantity(cur, "qty_luom", e.target.value),
//                     }))
//                   }
//                 />
//               ) : field.disabled || field.name === "quantity" ? (
//                 <Input
//                   type="number"
//                   disabled
//                   value={String(editForm.quantity ?? 0)}
//                   className="bg-muted text-muted-foreground"
//                 />
//               ) : (
//                 <Input
//                   type={field.type || "text"}
//                   value={String(editForm[field.name] || "")}
//                   onChange={(e) =>
//                     setEditForm((cur) => ({ ...cur, [field.name]: e.target.value }))
//                   }
//                 />
//               )}
//             </label>
//           ))}
//         </div>
//       ) : (
//         // ---------- RECEIVING DETAILS (custom layout) ----------
//         <div className="grid gap-4">
//           {/* Read-only product information */}
//           <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 gap-3 text-sm">
//             <div>
//               <span className="block text-xs text-muted-foreground">Product</span>
//               <span className="font-medium">{String(editForm.prod_name ?? "-")}</span>
//             </div>
//             <div>
//               <span className="block text-xs text-muted-foreground">Batch No</span>
//               <span className="font-medium">{String(editForm.batch_no ?? "-")}</span>
//             </div>
//             <div>
//               <span className="block text-xs text-muted-foreground">Lot No</span>
//               <span className="font-medium">{String(editForm.lot_no ?? "-")}</span>
//             </div>
//             <div>
//               <span className="block text-xs text-muted-foreground">PO No</span>
//               <span className="font-medium">{String(editForm.po_no ?? "-")}</span>
//             </div>
//             <div>
//               <span className="block text-xs text-muted-foreground">Doc Ref</span>
//               <span className="font-medium">{String(editForm.doc_ref ?? "-")}</span>
//             </div>
//           </div>

//           {/* Editable quantity fields */}
//           <div className="grid grid-cols-2 gap-3">
//             <label className="field">
//               <span className="text-xs font-medium text-muted-foreground">
//                 Quantity (Primary) <strong className="text-destructive">*</strong>
//               </span>
//               <Input
//                 type="number"
//                 min="0"
//                 step="1"
//                 value={Number(editForm.qty1_arrived ?? 0)}
//                 onChange={(e) => {
//                   const val = e.target.value === "" ? 0 : Number(e.target.value);
//                   setEditForm((cur) => ({ ...cur, qty1_arrived: val }));
//                 }}
//               />
//             </label>
//             <label className="field">
//               <span className="text-xs font-medium text-muted-foreground">
//                 Quantity (Secondary)
//               </span>
//               <Input
//                 type="number"
//                 min="0"
//                 step="1"
//                 value={Number(editForm.qty2_arrived ?? 0)}
//                 onChange={(e) => {
//                   const val = e.target.value === "" ? 0 : Number(e.target.value);
//                   setEditForm((cur) => ({ ...cur, qty2_arrived: val }));
//                 }}
//               />
//             </label>
//           </div>

//           <div className="text-sm text-muted-foreground">
//             Total Quantity:{" "}
//             {(Number(editForm.qty1_arrived) + Number(editForm.qty2_arrived)).toFixed(0)}
//           </div>
//         </div>
//       )}

//       <div className="flex justify-end gap-2 pt-1">
//         <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
//           <X size={15} /> Cancel
//         </Button>
//         <Button disabled={editSaving} type="submit">
//           <Save size={15} /> {editSaving ? "Saving..." : "Update"}
//         </Button>
//       </div>
//     </form>
//   </Dialog>
// )}
//       {/* Process Modal (Quality Clearance / Putaway / Confirmation) */}
// {/* Quality Clearance — form modal with PUT */}
//       {tab === "quality_clearance" && (
//         <Dialog
//           wide
//           open={processOpen}
//           title="Process Quality Clearance"
//           description={`Processing ${selectedRows.length} selected row(s)`}
//           onClose={() => { setProcessOpen(false); setModalNotice(null); }}
//         >
//           <form
//             className="grid gap-3"
//             onSubmit={async (e) => {
//               e.preventDefault();
//               setModalNotice(null);
//               if (!clearanceForm.prod_con_acceptance.trim()) {
//                 setModalNotice("Product Condition Acceptance is required.");
//                 return;
//               }
//               setSaving(true);
//               try {
//                 await Promise.all(
//                   selectedRows.map((r) =>
//                     api.put("/api/wms/inbound/packing_details/clearance", {
//                       company_code:        companyCode,
//                       prin_code:           prinCode,
//                       job_no:              jobNo,
//                       packdet_no:          Number(value(r, "packdet_no")),
//                       clearance:           "Y",
//                       truck_condition:     clearanceForm.truck_condition,
//                       container_condition: clearanceForm.container_condition,
//                       container_type:      clearanceForm.container_type,
//                       ref_box_temp:        clearanceForm.ref_box_temp,
//                       prod_temp:           clearanceForm.prod_temp,
//                       prod_con_acceptance: clearanceForm.prod_con_acceptance,
//                     })
//                   )
//                 );
//                 setProcessOpen(false);
//                 setModalNotice(null);
//                 setSelectedRows([]);
//                 setClearanceForm({
//                   truck_condition: "", container_condition: "", container_type: "",
//                   ref_box_temp: "", prod_temp: "", prod_con_acceptance: "",
//                 });
//                 toast.success("Quality clearance processed successfully");
//                 await loadRows();
//               } catch (error) {
//                 setModalNotice(error instanceof Error ? error.message : "Process failed");
//               } finally {
//                 setSaving(false);
//               }
//             }}
//           >
//             {modalNotice && (
//               <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
//                 {modalNotice}
//               </div>
//             )}
//             {selectedRows.length === 0 ? (
//               <p className="text-sm text-muted-foreground">
//                 No rows selected. Close and select rows from the table.
//               </p>
//             ) : (
//               <div className="grid grid-cols-2 gap-3">
//                 <label className="field">
//                   <span className="text-xs font-medium text-muted-foreground">Truck Condition</span>
//                   <Input
//                     value={clearanceForm.truck_condition}
//                     onChange={(e) => setClearanceForm((c) => ({ ...c, truck_condition: e.target.value }))}
//                     placeholder="Truck Condition"
//                   />
//                 </label>
//                 <label className="field">
//                   <span className="text-xs font-medium text-muted-foreground">Container Condition</span>
//                   <Input
//                     value={clearanceForm.container_condition}
//                     onChange={(e) => setClearanceForm((c) => ({ ...c, container_condition: e.target.value }))}
//                     placeholder="Container Condition"
//                   />
//                 </label>
//                 <label className="field">
//                   <span className="text-xs font-medium text-muted-foreground">Container Type</span>
//                   <Input
//                     value={clearanceForm.container_type}
//                     onChange={(e) => setClearanceForm((c) => ({ ...c, container_type: e.target.value }))}
//                     placeholder="Container Type"
//                   />
//                 </label>
//                 <label className="field">
//                   <span className="text-xs font-medium text-muted-foreground">Refer Box Temperature</span>
//                   <Input
//                     value={clearanceForm.ref_box_temp}
//                     onChange={(e) => setClearanceForm((c) => ({ ...c, ref_box_temp: e.target.value }))}
//                     placeholder="Refer Box Temperature"
//                   />
//                 </label>
//                 <label className="field">
//                   <span className="text-xs font-medium text-muted-foreground">Product Temperature</span>
//                   <Input
//                     value={clearanceForm.prod_temp}
//                     onChange={(e) => setClearanceForm((c) => ({ ...c, prod_temp: e.target.value }))}
//                     placeholder="Product Temperature"
//                   />
//                 </label>
//                 <label className="field">
//                   <span className="text-xs font-medium text-muted-foreground">
//                     Product Condition Acceptance <strong className="text-destructive">*</strong>
//                   </span>
//                   <Input
//                     value={clearanceForm.prod_con_acceptance}
//                     onChange={(e) => setClearanceForm((c) => ({ ...c, prod_con_acceptance: e.target.value }))}
//                     placeholder="Product Condition Acceptance"
//                   />
//                 </label>
//               </div>
//             )}
//             <div className="flex justify-end gap-2 pt-1">
//               <Button type="button" variant="outline" onClick={() => { setProcessOpen(false); setModalNotice(null); }}>
//                 Cancel
//               </Button>
//               <Button type="submit" disabled={saving || selectedRows.length === 0}>
//                 <CheckCircle2 size={15} />
//                 {saving ? "Processing..." : "Process Quality Clearance"}
//               </Button>
//             </div>
//           </form>
//         </Dialog>
//       )}

//       {/* Putaway / Job Confirmation — simple confirm dialog (unchanged) */}
// {/* Putaway Details — form modal with site/location dropdowns */}
//       {tab === "putway_details" && (
//         <Dialog
//           wide
//           open={processOpen}
//           title="Process Putaway"
//           description={`Selected Items: ${selectedRows.length}`}
//           onClose={() => { setProcessOpen(false); setModalNotice(null); }}
//         >
//           <form
//             className="grid gap-4"
//             onSubmit={async (e) => {
//               e.preventDefault();
//               setModalNotice(null);
//               if (!putawayForm.site_from)     { setModalNotice("Site From is required.");     return; }
//               // if (!putawayForm.location_from) { setModalNotice("Location From is required."); return; }
//               // if (!putawayForm.location_to)   { setModalNotice("Location To is required.");   return; }
//               setSaving(true);
//               try {
//                 await api.put(
//                   `/api/wms/inbound/putway_details/${encodeURIComponent(jobNo)}?prin_code=${encodeURIComponent(prinCode)}`,
//                   {
//                     site_from:     putawayForm.site_from,
//                     site_to:       putawayForm.site_from,   // auto-matched
//                     location_from: putawayForm.location_from,
//                     location_to:   putawayForm.location_to,
//                     packdet_no:    selectedRows.map((r) => value(r, "packdet_no")),
//                   }
//                 );
//                 setProcessOpen(false);
//                 setModalNotice(null);
//                 setSelectedRows([]);
//                 setPutawayForm({ site_from: "", site_from_name: "", location_from: "", location_from_name: "", site_to: "", site_to_name: "", location_to: "", location_to_name: "" });
//                 toast.success("Putaway processed successfully");
//                 await loadRows();
//               } catch (error) {
//                 setModalNotice(error instanceof Error ? error.message : "Putaway failed");
//               } finally { setSaving(false); }
//             }}
//           >
//             {modalNotice && (
//               <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
//                 {modalNotice}
//               </div>
//             )}

//             <div className="grid grid-cols-2 gap-3">
//               {/* Site From */}
//               <label className="field">
//                 <span className="text-xs font-medium text-muted-foreground">
//                   Site From <strong className="text-destructive">*</strong>
//                 </span>
// <Select
//                 value={putawayForm.site_from}
//                 onChange={(e) => {
//                   const v = e.target.value;
//                   setPutawayForm((c) => ({
//                     ...c,
//                     site_from: v,
//                     location_from: "",
//                     location_from_name: "",
//                     location_to: "",
//                     location_to_name: "",
//                   }));
//                   void loadLocations(v, "from");
//                   void loadLocations(v, "to");
//                 }}
//               >
//                   <option value="">— Select Site —</option>
//                   {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//                 </Select>
//               </label>

//               {/* Location From */}
//               <label className="field">
//                 <span className="text-xs font-medium text-muted-foreground">
//                   Location From <strong className="text-destructive">*</strong>
//                 </span>
//                 <Select
//                   value={putawayForm.location_from}
//                   disabled={!putawayForm.site_from}
//                   onChange={(e) => setPutawayForm((c) => ({ ...c, location_from: e.target.value }))}
//                 >
//                   <option value="">— Select Location —</option>
//                   {locationFromOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//                 </Select>
//               </label>

//               {/* Site To — auto-set, read-only */}
//               <label className="field">
//                 <span className="text-xs font-medium text-muted-foreground">
//                   Site To (Auto-set to match Site From)
//                 </span>
//                 <Select value={putawayForm.site_from} disabled>
//                   <option value="">—</option>
//                   {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//                 </Select>
//                 {putawayForm.site_from && (
//                   <span className="mt-1 text-[11px] italic text-primary">
//                     Note: Site To is automatically set to match Site From ({putawayForm.site_from})
//                   </span>
//                 )}
//               </label>

//               {/* Location To */}
//               <label className="field">
//                 <span className="text-xs font-medium text-muted-foreground">
//                   Location To <strong className="text-destructive">*</strong>
//                 </span>
//                 <Select
//                   value={putawayForm.location_to}
//                   disabled={!putawayForm.site_from}
//                   onChange={(e) => setPutawayForm((c) => ({ ...c, location_to: e.target.value }))}
//                 >
//                   <option value="">— Select Location —</option>
//                   {locationToOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//                 </Select>
//               </label>
//             </div>

//             <p className="text-sm text-muted-foreground">Selected Items: {selectedRows.length}</p>

//             <div className="flex justify-end gap-2 pt-1">
//               <Button type="button" variant="outline" onClick={() => { setProcessOpen(false); setModalNotice(null); }}>
//                 Cancel
//               </Button>
//               <Button type="submit" disabled={saving || selectedRows.length === 0}>
//                 <Settings2 size={15} />
//                 {saving ? "Processing..." : "Process Putaway"}
//               </Button>
//             </div>
//           </form>
//         </Dialog>
//       )}

//       {/* Job Confirmation — simple confirm dialog */}
//       {tab === "job_confirmation" && (
//         <Dialog
//           open={processOpen}
//           compact
//           title="Process Job Confirmation"
//           description={`Processing ${selectedRows.length} selected row(s)`}
//           onClose={() => setProcessOpen(false)}
//           footer={
//             <>
//               <Button variant="outline" onClick={() => setProcessOpen(false)}>Close</Button>
//               <Button
//                 disabled={saving}
//                 onClick={async () => {
//                   setSaving(true);
//                   try {
//                     await api.put(
//                       `/api/wms/inbound/job_confirmation/${encodeURIComponent(jobNo)}?prin_code=${encodeURIComponent(prinCode)}`,
//                       { packdet_no: selectedRows.map((r) => value(r, "packdet_no")) }
//                     );
//                     setProcessOpen(false);
//                     setSelectedRows([]);
//                     toast.success("Job confirmation processed successfully");
//                     await loadRows();
//                   } catch (error) {
//                     toast.error(error instanceof Error ? error.message : "Process failed");
//                   } finally { setSaving(false); }
//                 }}
//               >
//                 <CheckCircle2 size={15} /> {saving ? "Processing..." : "Confirm"}
//               </Button>
//             </>
//           }
//         >
//           <div className="text-sm text-muted-foreground">
//             {selectedRows.length === 0
//               ? "No rows selected. Close and select rows from the table."
//               : `You are about to process ${selectedRows.length} row(s). This action cannot be undone.`}
//           </div>
//         </Dialog>
//       )}
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Tab config
// // ---------------------------------------------------------------------------
// function getInboundTabConfig(tab: string) {
//   const packSql = ({ companyCode, jobNo, prinCode }: { companyCode: string; jobNo: string; prinCode: string }) =>
//     `SELECT * FROM VW_WM_INB_PACKDET_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`;

//   const configs: Record<string, {
//     title: string; minWidth: number; addLabel?: string; addEndpoint?: string;
//     addFields?: FormField[];
//     columns: { key: string; label: string; size?: number }[];
//     sql: (args: { companyCode: string; jobNo: string; prinCode: string }) => string;
//   }> = {
//     shipment_details: {
//       title: "Shipment Details", minWidth: 1060,
//       addLabel: "Add Shipment", addEndpoint: "shipment_details", addFields: shipmentFormFields,
//       sql: ({ jobNo, prinCode }) =>
//         `SELECT * FROM TI_CONTAINER WHERE PRIN_CODE = '${sqlEscape(prinCode)}' AND JOB_NO = '${sqlEscape(jobNo)}'`,
//       columns: [
//         { key: "container_no", label: "Container No", size: 150 },
//         { key: "vehicle_no", label: "Vehicle No", size: 130 },
//         { key: "vessel_name", label: "Vessel Name", size: 150 },
//         { key: "voyage_no", label: "Voyage No", size: 130 },
//         { key: "seal_no", label: "Seal No", size: 130 },
//         { key: "po_no", label: "PO No", size: 130 },
//         { key: "bl_no", label: "BL No", size: 130 },
//       ],
//     },
//     packing_details: {
//       title: "Packing Details", minWidth: 1280,
//       addLabel: "Add Packing Details", addEndpoint: "packing_details", addFields: packingFormFields,
//       sql: packSql, columns: packingColumns(),
//     },
//     receiving_details: {
//       title: "Receiving Details", minWidth: 1320,
//       addLabel: "Add Receiving", addEndpoint: "receiving", addFields: receivingFormFields,
//       sql: packSql,
//       columns: [
//         { key: "prod_name", label: "Product", size: 320 },
//         { key: "qty_string", label: "Quantity", size: 150 },
//         { key: "quantity", label: "Net Quantity", size: 140 },
//         { key: "qty_arrived_string", label: "Arrived Qty", size: 150 },
//         { key: "qty_netarrived_string", label: "Net Arrived Qty", size: 160 },
//         { key: "batch_no", label: "Batch No", size: 120 },
//         { key: "lot_no", label: "Lot No", size: 120 },
//         { key: "po_no", label: "PO No", size: 120 },
//         { key: "doc_ref", label: "Doc Ref", size: 140 },
//       ],
//     },
//     quality_clearance: {
//       title: "Quality Clearance", minWidth: 1200,
//       sql: packSql,
//       columns: [
//         { key: "prod_name", label: "Product", size: 320 },
//         { key: "qty_string", label: "Quantity", size: 140 },
//         { key: "clearance", label: "Clearance", size: 120 },
//         { key: "batch_no", label: "Batch No", size: 120 },
//         { key: "lot_no", label: "Lot No", size: 120 },
//         { key: "container_no", label: "Container", size: 140 },
//         { key: "po_no", label: "PO No", size: 120 },
//         { key: "doc_ref", label: "Doc Ref", size: 140 },
//       ],
//     },
//     tally_details: {
//       title: "Tally Details", minWidth: 1260,
//       addLabel: "Add Tally", addEndpoint: "tally", addFields: tallyFormFields,
//       sql: ({ companyCode, jobNo, prinCode }) =>
//         `SELECT * FROM VW_WM_INB_TT_TALLY_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
//       columns: [
//         { key: "prod_name", label: "Product", size: 320 },
//         { key: "qty_tally_string", label: "Tally Qty", size: 150 },
//         { key: "qty_string", label: "Pack Qty", size: 150 },
//         { key: "batch_no", label: "Batch No", size: 120 },
//         { key: "lot_no", label: "Lot No", size: 120 },
//         { key: "container_no", label: "Container", size: 140 },
//         { key: "po_no", label: "PO No", size: 120 },
//       ],
//     },
// putway_details: {
//       title: "Putaway Details", minWidth: 1280,
//       sql: packSql,
//       columns: [
//         { key: "prod_name",          label: "Product",       size: 320 },
//         { key: "qty_string",         label: "Quantity",      size: 150 },
//         { key: "qty_arrived_string", label: "Arrived Qty",   size: 150 },
//         { key: "clearance",          label: "Clearance",     size: 110 },
//         { key: "allocated",          label: "Allocated",     size: 100 },
//         { key: "batch_no",           label: "Batch No",      size: 120 },
//         { key: "lot_no",             label: "Lot No",        size: 120 },
//         { key: "container_no",       label: "Container",     size: 140 },
//         { key: "po_no",              label: "PO No",         size: 120 },
//         { key: "doc_ref",            label: "Doc Ref",       size: 140 },
//       ],
//     },
//     putway_manual: {
//       title: "Putaway Manual", minWidth: 1280,
//       addLabel: "Add Manual Putaway", addEndpoint: "manualputaway", addFields: manualPutawayFormFields,
//       sql: ({ companyCode, jobNo, prinCode }) =>
//         `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
//       columns: confirmationColumns(),
//     },
//     putway_hht: {
//       title: "Putaway HHT/RFID/AR", minWidth: 1280,
//       addLabel: "Process HHT Putaway", addEndpoint: "hhtputaway", addFields: putawayFormFields,
//       sql: ({ companyCode, jobNo, prinCode }) =>
//         `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
//       columns: confirmationColumns(),
//     },
//     job_confirmation: {
//       title: "Job Confirmation", minWidth: 1380,
//       sql: ({ companyCode, jobNo, prinCode }) =>
//         `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE confirmed = 'N' AND company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
//       columns: confirmationColumns(),
//     },
//     activity_billing: {
//       title: "Activity Billing", minWidth: 1180,
//       sql: ({ companyCode, jobNo, prinCode }) =>
//         `SELECT * FROM VW_WM_INB_ACTIVITY_BILLING WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}'`,
//       columns: [
//         { key: "activity_code", label: "Activity Code", size: 150 },
//         { key: "activity_name", label: "Activity Name", size: 260 },
//         { key: "charge_code", label: "Charge Code", size: 140 },
//         { key: "qty", label: "Qty", size: 100 },
//         { key: "rate", label: "Rate", size: 100 },
//         { key: "amount", label: "Amount", size: 120 },
//       ],
//     },
//   };

//   return configs[tab];
// }

// function packingColumns() {
//   return [
//     { key: "prod_name", label: "Product", size: 320 },
//     { key: "qty_string", label: "Quantity", size: 140 },
//     { key: "quantity", label: "Net Quantity", size: 140 },
//     { key: "batch_no", label: "Batch No", size: 120 },
//     { key: "lot_no", label: "Lot No", size: 120 },
//     { key: "container_no", label: "Container", size: 140 },
//     { key: "po_no", label: "PO No", size: 120 },
//     { key: "doc_ref", label: "Doc Ref", size: 140 },
//   ];
// }

// function confirmationColumns() {
//   return [
//     { key: "prod_name", label: "Product", size: 320 },
//     { key: "qty_confirm_string", label: "Quantity", size: 150 },
//     { key: "receive_qty_string", label: "Arrived Qty", size: 150 },
//     { key: "net_receive_string", label: "Net Arrived Qty", size: 160 },
//     { key: "batch_no", label: "Batch No", size: 120 },
//     { key: "lot_no", label: "Lot No", size: 120 },
//     { key: "mfg_date", label: "Mfg Date", size: 120 },
//     { key: "exp_date", label: "Exp Date", size: 120 },
//     { key: "container_no", label: "Container", size: 140 },
//     { key: "po_no", label: "PO No", size: 120 },
//     { key: "doc_ref", label: "BL Number", size: 140 },
//   ];
// }

// function getTabsForJob(jobClass: string) {
//   if (jobClass === "M")
//     return detailTabs.filter((tab) =>
//       ["shipment_details", "putway_manual", "job_confirmation", "activity_billing"].includes(tab.value));
//   if (jobClass === "NP")
//     return detailTabs.filter((tab) =>
//       ["shipment_details", "packing_details", "quality_clearance", "tally_details", "putway_hht", "job_confirmation", "activity_billing"].includes(tab.value));
//   if (jobClass === "N")
//     return detailTabs.filter((tab) =>
//       ["shipment_details", "packing_details", "receiving_details", "quality_clearance", "putway_details", "job_confirmation", "activity_billing"].includes(tab.value));
//   return detailTabs;
// }

// // ---------------------------------------------------------------------------
// // Column factory — optional checkbox column for selectable tabs
// // ---------------------------------------------------------------------------
// function makeColumns(
//   columns: { key: string; label: string; size?: number }[],
//   selectable = false,
//   onEdit?: (row: WmsRow) => void,  // ADD this parameter
// ): ColumnDef<WmsRow>[] {
//   const cols: ColumnDef<WmsRow>[] = columns.map((col) => ({
//     accessorKey: col.key,
//     header: col.label,
//     size: col.size || 140,
//     cell: ({ row }) => formatCellValue(row.original, col.key),
//   }));

//   // ADD edit actions column when onEdit is provided
//   if (onEdit) {
//     cols.push({
//       id: "actions",
//       header: "",
//       size: 60,
//       enableColumnFilter: false,
//       cell: ({ row }) => (
//         <button
//           className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
//           onClick={() => onEdit(row.original)}
//         >
//           Edit
//         </button>
//       ),
//     });
//   }

//   if (selectable) {
//     cols.unshift({
//       id: "select",
//       header: ({ table }) => (
//         <input
//           type="checkbox"
//           className="rounded border-input"
//           checked={table.getIsAllPageRowsSelected()}
//           onChange={table.getToggleAllPageRowsSelectedHandler()}
//         />
//       ),
//       size: 40,
//       enableColumnFilter: false,
//       cell: ({ row }) => (
//         <input
//           type="checkbox"
//           className="rounded border-input"
//           checked={row.getIsSelected()}
//           onChange={row.getToggleSelectedHandler()}
//         />
//       ),
//     });
//   }

//   return cols;
// }

// // ---------------------------------------------------------------------------
// // Helpers
// // ---------------------------------------------------------------------------
// function parseInboundView(pathname: string) {
//   const parts = pathname.split("/").filter(Boolean);
//   const viewIndex = parts.findIndex((p) => p.toLowerCase() === "view");
//   return {
//     jobNo: viewIndex >= 0 ? parts[viewIndex + 1] : "",
//     tab: viewIndex >= 0 ? parts[viewIndex + 2] : "",
//   };
// }

// function inboundJobDetailPath(row: WmsRow) {
//   const jobNo = encodeURIComponent(value(row, "job_no"));
//   const principalCode = encodeURIComponent(value(row, "prin_code"));
//   return `${inboundJobsPath}/view/${jobNo}/shipment_details${principalCode ? `?principal_code=${principalCode}` : ""}`;
// }

// function filterJobByTab(row: WmsRow, tab: string) {
//   const canceled = isCanceled(row);
//   const confirmed = hasDate(value(row, "confirm_date"));
//   if (tab === "cancel") return canceled || hasDate(value(row, "cancel_date"));
//   if (tab === "confirmed") return confirmed && !canceled;
//   return !confirmed && !canceled;
// }

// function makeEmptyJob(companyCode?: string) {
//   return {
//     company_code: companyCode || "", job_type: "IMP", job_class: "N",
//     transport_mode: "S", schedule_date: new Date().toISOString().slice(0, 10),
//   };
// }

// function JobClassPill({ code }: { code: string }) {
//   const label = jobClassLabels[code] || code || "N/A";
//   return (
//     <span className="inline-flex max-w-[170px] items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
//       {label}
//     </span>
//   );
// }

// function flagBadge(flag: string) {
//   const yes = flag === "Y" || flag.toLowerCase() === "yes";
//   return <span className={yes ? "text-emerald-700" : "text-muted-foreground"}>{yes ? "Yes" : "No"}</span>;
// }

// function normalizeRow(row: WmsRow) {
//   const normalized: WmsRow = { ...row };
//   Object.entries(row || {}).forEach(([key, v]) => { normalized[key.toLowerCase()] = v; });
//   return normalized;
// }

// function value(row: WmsRow, key: string) {
//   return String(row[key] ?? row[key.toUpperCase()] ?? "");
// }

// function formatCellValue(row: WmsRow, key: string) {
//   const cell = value(row, key);
//   if (key.includes("date")) return formatDate(cell);
//   return cell;
// }

// function formatDate(input: string) {
//   if (!input) return "";
//   const date = new Date(input);
//   if (Number.isNaN(date.getTime())) return input;
//   return date.toLocaleDateString("en-GB");
// }

// function hasDate(input: string) {
//   return Boolean(input && input !== "N/A" && input !== "null");
// }

// function isCanceled(row: WmsRow) {
//   return value(row, "canceled") === "Y" || hasDate(value(row, "cancel_date"));
// }

// function sqlEscape(input: string) {
//   return String(input || "").replace(/'/g, "''");
// }

// function locationSearchPrincipal(job: WmsRow | null) {
//   const prin = value(job || {}, "prin_code");
//   return prin ? `?principal_code=${encodeURIComponent(prin)}` : "";
// }