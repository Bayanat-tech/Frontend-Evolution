import { useLocation } from "react-router-dom";
import { parseOutboundView } from "./OutboundHelpers";
import { OutboundJobListing } from "./OutboundJobListing";
import { OutboundJobDetail } from "./OutboundJobDetail";

export function WmsOutboundPage() {
  const location = useLocation();
  const view = parseOutboundView(location.pathname);
  return view.jobNo ? (
    <OutboundJobDetail jobNo={view.jobNo} tab={view.tab || "order_entry"} />
  ) : (
    <OutboundJobListing />
  );
}






















// import type { ColumnDef } from "@tanstack/react-table";
// import { ArrowLeft, Ban, CheckCircle2, Eye, FileText, FileUp, MapPin, PackageCheck, Pencil, Plus, Printer, RefreshCw, Save, Ship, Trash2, X } from "lucide-react";
// import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
// import { Link, useLocation, useNavigate } from "react-router-dom";
// import { executeWmsInboundSql, getWmsInbound, getWmsMaster, getWmsOutbound, postWmsInbound, postWmsOutbound, putWmsInbound, putWmsOutbound } from "../../../api/wms";
// import { Button } from "../../../components/ui/Button";
// import { Card, CardContent } from "../../../components/ui/Card";
// import { DataTable } from "../../../components/ui/DataTable";
// import { Dialog } from "../../../components/ui/Dialog";
// import { Input } from "../../../components/ui/Input";
// import { LookupField } from "../../../components/ui/LookupField";
// import { NoticeToast } from "../../../components/ui/NoticeToast";
// import { Select } from "../../../components/ui/Select";
// import { executeCommonProcedure, type LookupRow } from "../../../api/lookups";
// import { useAuth } from "../../../state/AuthContext";

// type WmsRow = Record<string, unknown>;

// const listingTabs = [
//   { label: "In Progress", value: "in_progress" },
//   { label: "Confirmed", value: "confirmed" },
//   { label: "Canceled", value: "cancel" },
// ];

// const detailTabs = [
//   { label: "Order Entry", value: "order_entry" },
//   { label: "Order Details", value: "order_details" },
//   { label: "Picking Details", value: "picking_details" },
//   { label: "Cancel Picking", value: "cancel_picking" },
//   { label: "Job Confirmation", value: "job_confirmation" },
// ];

// const outboundJobsPath = "/workspace/wms/wms/transactions/outbound/jobs_oub";

// const jobClassLabels: Record<string, string> = {
//   N: "Normal",
//   NP: "Normal HHT/RFID/AR",
//   M: "Manual",
//   S: "Sales Return",
//   SP: "Sales Return HHT/RFID/AR",
//   NI: "Non-Inventory",
//   CP: "Co-Packing",
//   MR: "Misc Receipts",
//   IWT: "Inter Warehouse Transfer",
//   CD: "Cross Docking",
// };

// const jobFields = [
//   { name: "prin_code", label: "Principal Code", required: true },
//   { name: "dept_code", label: "Department Code" },
//   { name: "div_code", label: "Division Code" },
//   { name: "job_class", label: "Job Class", required: true },
//   { name: "job_type", label: "Job Type", required: true },
//   { name: "country_origin", label: "Country Origin" },
//   { name: "country_destination", label: "Country Destination" },
//   { name: "port_code", label: "Port Code" },
//   { name: "destination_port", label: "Destination Port" },
//   { name: "transport_mode", label: "Transport Mode" },
//   { name: "schedule_date", label: "Schedule Date", type: "date" },
//   { name: "doc_ref", label: "Doc Ref" },
//   { name: "prin_ref2", label: "Principal Ref 2" },
//   { name: "description1", label: "Description" },
//   { name: "remarks", label: "Remarks" },
// ];

// const orderEntryFields = [
//   { name: "order_no", label: "Order No", required: true },
//   { name: "cust_code", label: "Customer", required: true },
//   { name: "order_date", label: "Order Date", type: "date" },
//   { name: "order_due_date", label: "Due Date", type: "date" },
//   { name: "curr_code", label: "Currency" },
//   { name: "ex_rate", label: "Exchange Rate", type: "number" },
//   { name: "moc1", label: "MOC 1" },
//   { name: "moc2", label: "MOC 2" },
//   { name: "exp_container_no", label: "Container No" },
//   { name: "exp_container_size", label: "Container Size" },
//   { name: "exp_container_type", label: "Container Type" },
//   { name: "exp_container_sealno", label: "Seal No" },
//   { name: "cust_reference", label: "Customer Ref" },
//   { name: "pack_start", label: "Pack Start", type: "datetime-local" },
//   { name: "pack_end", label: "Pack End", type: "datetime-local" },
//   { name: "load_start", label: "Load Start", type: "datetime-local" },
//   { name: "load_end", label: "Load End", type: "datetime-local" },
// ];

// const orderDetailFields = [
//   { name: "order_no", label: "Order No", required: true },
//   { name: "cust_code", label: "Customer", required: true },
//   { name: "prod_code", label: "Product Code", required: true },
//   { name: "prod_name", label: "Product Name" },
//   { name: "site_code", label: "Site Code", required: true },
//   { name: "loc_code_from", label: "Location From"},
//   { name: "loc_code_to", label: "Location To" },
//   { name: "p_uom", label: "P UOM" },
//   { name: "qty_puom", label: "P Qty", type: "number", required: true },
//   { name: "l_uom", label: "L UOM" },
//   { name: "qty_luom", label: "L Qty", type: "number" },
//   { name: "quantity", label: "Quantity", type: "number" },
//   { name: "lot_no", label: "Lot No" },
//   { name: "batch_no", label: "Batch No" },
//   { name: "expiry_from", label: "Expiry From", type: "date" },
//   { name: "expiry_to", label: "Expiry To", type: "date" },
//   { name: "production_from", label: "Production From", type: "date" },
//   { name: "production_to", label: "Production To", type: "date" },
//   { name: "salesman_code", label: "Salesman" },
//   { name: "minperiod_exppick", label: "Min Expiry Period", type: "number" },
// ];

// export function WmsOutboundPage() {
//   const location = useLocation();
//   const view = parseOutboundView(location.pathname);
//   return view.jobNo ? <OutboundJobDetail jobNo={view.jobNo} tab={view.tab || "order_entry"} /> : <OutboundJobListing />;
// }

// function OutboundJobListing() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [rows, setRows] = useState<WmsRow[]>([]);
//   const [query, setQuery] = useState("");
//   const [activeTab, setActiveTab] = useState("in_progress");
//   const [loading, setLoading] = useState(true);
//   const [formOpen, setFormOpen] = useState(false);
//   const [editingJobNo, setEditingJobNo] = useState("");
//   const [form, setForm] = useState<WmsRow>(makeEmptyJob(user?.company_code));
//   const [saving, setSaving] = useState(false);
//   const [cancelTarget, setCancelTarget] = useState<WmsRow | null>(null);
//   const [cancelRemarks, setCancelRemarks] = useState("");
//   const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

//   const loadRows = async (clearNotice = true) => {
//     setLoading(true);
//     if (clearNotice) setNotice(null);
//     try {
//       const data = await executeWmsInboundSql(`SELECT * FROM VW_TI_JOB WHERE COMPANY_CODE = '${sqlEscape(user?.company_code || "")}' AND JOB_TYPE = 'EXP' ORDER BY JOB_DATE DESC, JOB_NO DESC`);
//       setRows(data.map(normalizeRow));
//     } catch (error) {
//       setNotice({ type: "error", message: processMessage("Unable to load outbound job listing.", error) });
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     void loadRows();
//   }, []);

//   const openEditJob = async (row: WmsRow) => {
//     const jobNo = value(row, "job_no");
//     setEditingJobNo(jobNo);
//     setNotice(null);
//     try {
//       const jobForm = await enrichOutboundJobFormNames(makeOutboundJobForm(row, user?.company_code), user?.company_code || "");
//       setForm(jobForm);
//     } catch {
//       setForm(makeOutboundJobForm(row, user?.company_code));
//     }
//     setFormOpen(true);
//   };

//   const filteredRows = useMemo(() => rows.filter((row) => filterJobByTab(row, activeTab)), [rows, activeTab]);
//   const columns = useMemo<ColumnDef<WmsRow>[]>(
//     () => [
//       {
//         accessorKey: "job_no",
//         header: "Job No",
//         size: 130,
//         cell: ({ row }) => (
//           <button
//             className="font-semibold text-primary hover:underline"
//             onClick={() => navigate(outboundJobDetailPath(row.original))}
//           >
//             {value(row.original, "job_no")}
//           </button>
//         ),
//       },
//       { accessorKey: "prin_name", header: "Principal Name", size: 260, cell: ({ row }) => value(row.original, "prin_name") },
//       { accessorKey: "job_class", header: "Job Class", size: 180, cell: ({ row }) => <JobClassPill code={value(row.original, "job_class")} /> },
//       { accessorKey: "job_date", header: "Job Date", size: 120, cell: ({ row }) => formatDate(value(row.original, "job_date")) },
//       ...(activeTab === "confirmed"
//         ? [{ accessorKey: "confirm_date", header: "Confirm Date", size: 130, cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "confirm_date")) }]
//         : []),
//       { accessorKey: "doc_ref", header: "Doc Ref", size: 130, cell: ({ row }) => value(row.original, "doc_ref") },
//       { accessorKey: "canceled", header: "Canceled", size: 105, cell: ({ row }) => flagBadge(value(row.original, "canceled")) },
//       { accessorKey: "invoiced", header: "Invoiced", size: 105, cell: ({ row }) => flagBadge(value(row.original, "invoiced")) },
//       { accessorKey: "invoice_date", header: "Invoice Date", size: 130, cell: ({ row }) => formatDate(value(row.original, "invoice_date")) },
//       {
//         id: "actions",
//         header: "Actions",
//         size: 125,
//         enableColumnFilter: false,
//         cell: ({ row }) => (
//           <div className="flex items-center gap-1">
//             <Button size="icon" variant="ghost" title="Open job" onClick={() => navigate(outboundJobDetailPath(row.original))}>
//               <Eye size={14} />
//             </Button>
//             <Button
//               size="icon"
//               variant="ghost"
//               title="Edit job"
//               onClick={() => void openEditJob(row.original)}
//             >
//               <Pencil size={14} />
//             </Button>
//             {canCancelOutboundJob(row.original, activeTab) && (
//               <Button size="icon" variant="ghost" title="Cancel job" onClick={() => setCancelTarget(row.original)}>
//                 <Ban size={14} />
//               </Button>
//             )}
//           </div>
//         ),
//       },
//     ],
//     [activeTab, navigate, openEditJob],
//   );

//   const saveJob = async (event: FormEvent) => {
//     event.preventDefault();
//     const missing = jobFields.find((field) => field.required && !String(form[field.name] || "").trim());
//     if (missing) {
//       setNotice({ type: "error", message: `${missing.label} is required` });
//       return;
//     }
//     setSaving(true);
//     try {
//       const departmentOk = await validateDepartmentDivision(user?.company_code || "", String(form.dept_code || ""), String(form.div_code || ""));
//       if (!departmentOk) {
//         setNotice({ type: "error", message: "Cannot save outbound job: selected Department and Division do not exist together in MS_DEPARTMENT. Please select Department again." });
//         return;
//       }
//       const payload = buildOutboundJobPayload(form, user?.company_code || "");
//       if (editingJobNo) {
//         await putWmsInbound("inboundjob", payload);
//       } else {
//         await postWmsInbound("inboundjob", payload);
//       }
//       setFormOpen(false);
//       setEditingJobNo("");
//       setNotice({ type: "success", message: editingJobNo ? `Outbound job ${editingJobNo} updated successfully.` : "Outbound job created successfully." });
//       await loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: processMessage(editingJobNo ? `Unable to update outbound job ${editingJobNo}.` : "Unable to create outbound job.", error) });
//     } finally {
//       setSaving(false);
//     }
//   };

//   const confirmCancel = async () => {
//     if (!cancelTarget || !cancelRemarks.trim()) return;
//     setSaving(true);
//     try {
//       if (hasDate(value(cancelTarget, "confirm_date")) || activeTab === "confirmed") {
//         await executeRawCommonProcedure("sp_cancel_confirmedjob_oub", {
//           loginid: user?.loginid || "",
//           val1s1: user?.company_code || "",
//           val1s2: value(cancelTarget, "prin_code"),
//           val1s3: value(cancelTarget, "job_no"),
//           val1s4: cancelRemarks,
//           val1s5: user?.loginid || "",
//         });
//       } else {
//         await executeWmsInboundSql(`
//           UPDATE TI_JOB
//           SET CANCELED = 'Y',
//               CANCEL_DATE = SYSDATE,
//               CANCELED_BY = '${sqlEscape(user?.loginid || "")}',
//               CANCEL_REMARKS = '${sqlEscape(cancelRemarks)}',
//               UPDATED_AT = SYSDATE,
//               UPDATED_BY = '${sqlEscape(user?.loginid || "")}'
//           WHERE COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'
//             AND PRIN_CODE = '${sqlEscape(value(cancelTarget, "prin_code"))}'
//             AND JOB_NO = '${sqlEscape(value(cancelTarget, "job_no"))}'
//         `);
//       }
//       setRows((currentRows) => currentRows.map((row) => (
//         value(row, "job_no") === value(cancelTarget, "job_no")
//           ? { ...row, canceled: "Y", CANCELED: "Y", cancel_date: new Date().toISOString(), CANCEL_DATE: new Date().toISOString() }
//           : row
//       )));
//       setCancelTarget(null);
//       setCancelRemarks("");
//       setNotice({ type: "success", message: `Outbound job ${value(cancelTarget, "job_no")} canceled successfully.` });
//       await loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: processMessage(`Unable to cancel outbound job ${value(cancelTarget, "job_no")}.`, error) });
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <section className="grid gap-4">
//       <div className="flex flex-wrap items-start justify-between gap-3">
//         <div>
//           <h1 className="m-0 text-2xl font-semibold text-foreground">Outbound Job Listing</h1>
//           <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage export jobs, customer orders, stock picking, cancellation, confirmation, and billing.</p>
//         </div>
//         <div className="flex flex-wrap items-center gap-2">
//           <Button variant="outline" onClick={() => loadRows()}><RefreshCw size={15} /> Refresh</Button>
//           <Button onClick={() => { setEditingJobNo(""); setForm(makeEmptyJob(user?.company_code)); setFormOpen(true); }}><Plus size={15} /> Add Job</Button>
//         </div>
//       </div>

//       <NoticeToast notice={notice} onClose={() => setNotice(null)} />

//       <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
//         {listingTabs.map((tab) => (
//           <Button key={tab.value} size="sm" variant={activeTab === tab.value ? "default" : "outline"} onClick={() => setActiveTab(tab.value)}>
//             {tab.label}
//           </Button>
//         ))}
//       </div>

//       <DataTable
//         columns={columns}
//         data={filteredRows}
//         subtitle="Outbound Jobs"
//         searchValue={query}
//         onSearchChange={setQuery}
//         searchPlaceholder="Search job, principal, reference..."
//         loading={loading}
//         height="calc(100vh - 310px)"
//         minWidth={1420}
//         density="grid"
//         enablePagination
//         pageSize={50}
//         getRowId={(row, index) => String(value(row, "job_no") || index)}
//         rowClassName={(row) => (isCanceled(row) ? "bg-red-50/70" : hasDate(value(row, "confirm_date")) ? "bg-emerald-50/70" : "bg-blue-50/50")}
//       />

//       <OutboundFormFrame
//         open={formOpen}
//         title={editingJobNo ? `Edit Outbound Job ${editingJobNo}` : "Add Outbound Job"}
//         onClose={() => { setFormOpen(false); setEditingJobNo(""); }}
//         footer={<DialogActions formId="outbound-job-form" saving={saving} onCancel={() => { setFormOpen(false); setEditingJobNo(""); }} submitText={editingJobNo ? "Update Job" : "Save Job"} />}
//       >
//         <OutboundJobCreateForm form={form} setForm={setForm} companyCode={user?.company_code || ""} onSubmit={saveJob} />
//       </OutboundFormFrame>

//       <Dialog
//         open={Boolean(cancelTarget)}
//         title={`Cancel Job ${cancelTarget ? value(cancelTarget, "job_no") : ""}`}
//         description="Please enter cancellation remarks before submitting."
//         compact
//         tone="danger"
//         onClose={() => setCancelTarget(null)}
//         footer={
//           <>
//             <Button variant="outline" onClick={() => setCancelTarget(null)}>Close</Button>
//             <Button variant="destructive" disabled={saving || !cancelRemarks.trim()} onClick={confirmCancel}>Confirm Cancel</Button>
//           </>
//         }
//       >
//         <label className="field">
//           <span>Cancel Remarks</span>
//           <Input value={cancelRemarks} onChange={(event) => setCancelRemarks(event.target.value)} placeholder="Enter reason..." />
//         </label>
//       </Dialog>
//     </section>
//   );
// }

// function OutboundJobDetail({ jobNo, tab }: { jobNo: string; tab: string }) {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const principalCode = new URLSearchParams(location.search).get("principal_code") || "";
//   const [job, setJob] = useState<WmsRow | null>(null);
//   const [loading, setLoading] = useState(true);

//   const loadJob = async () => {
//     setLoading(true);
//     try {
//       const data = await executeWmsInboundSql(
//         `SELECT * FROM TO_ORDER
//          WHERE JOB_NO       = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(principalCode)}'
//            AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`
//       );
//       setJob(normalizeRow(data[0] || { job_no: jobNo, prin_code: principalCode }));
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { void loadJob(); }, [jobNo]);

//   const activeTab = detailTabs.some((item) => item.value === tab) ? tab : "order_entry";
//   const jobClass = jobClassLabels[value(job || {}, "job_class")] || value(job || {}, "job_class") || "Normal";
//   const status = isCanceled(job || {}) ? "Canceled" : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress";
//   const jobDate = formatDate(value(job || {}, "job_date"));

//   return (
//     <section className="grid gap-3">
//       {/* ── Job Header — matching inbound style exactly ── */}
//       <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
//         <div className="flex min-w-0 items-center gap-3">
//           <Button size="icon" variant="outline" onClick={() => navigate(outboundJobsPath)} title="Back to jobs">
//             <ArrowLeft size={16} />
//           </Button>
//           <div className="min-w-0">
//             <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Outbound Job</p>
//             <h1 className="m-0 truncate text-2xl font-bold text-foreground">{jobNo}</h1>
//           </div>
//           {/* Principal chip */}
//           <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
//             <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Principal</span>
//             <span className="ml-1.5 text-sm font-bold text-foreground">
//               {value(job || {}, "prin_code") || principalCode || "-"}
//             </span>
//           </div>
//           {/* Job Date chip */}
//           {jobDate && (
//             <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
//               <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Job Date</span>
//               <span className="ml-1.5 text-sm font-bold text-foreground">{jobDate}</span>
//             </div>
//           )}
//           {/* Job Class badge */}
//           <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
//             {jobClass}
//           </span>
//           {/* Status badge */}
//           <span className={
//             status === "Canceled"
//               ? "rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700"
//               : status === "Confirmed"
//               ? "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
//               : "rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700"
//           }>
//             {status}
//           </span>
//         </div>
//         <div className="flex flex-wrap gap-2">
//           <Button size="sm" variant="outline" onClick={loadJob}><RefreshCw size={14} /> Refresh</Button>
//           <Button size="sm" variant="outline"><Printer size={14} /> Print</Button>
//         </div>
//       </div>

//       {/* ── Tab Strip ── */}
//       <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
//         {detailTabs.map((item) => (
//           <Link
//             className={item.value === activeTab ? "ui-button ui-button-default ui-button-sm" : "ui-button ui-button-outline ui-button-sm"}
//             key={item.value}
//             to={outboundJobTabPath(jobNo, item.value, job || { prin_code: principalCode } as WmsRow)}
//           >
//             {item.label}
//           </Link>
//         ))}
//       </div>

//       <OutboundOperationalTab
//         job={job}
//         jobNo={jobNo}
//         tab={activeTab}
//         loadingJob={loading}
//         principalCode={principalCode}
//       />
//     </section>
//   );
// }



// function OutboundOperationalTab({ job, jobNo, tab, loadingJob, principalCode  }: { job: WmsRow | null; jobNo: string; tab: string; loadingJob: boolean, principalCode ?: string }) {
//   const [pickModalOpen, setPickModalOpen] = useState(false);
// const [pickPreference, setPickPreference] = useState("job_no");
// const [pickCriteria, setPickCriteria] = useState("fifo");
// const [leastQty, setLeastQty] = useState(false);
// const [ignoreMinExp, setIgnoreMinExp] = useState(false);
//   const { user } = useAuth();
//   const prinCode = value(job || {}, "prin_code") || principalCode || "";
//   const [rows, setRows] = useState<WmsRow[]>([]);
//   const [query, setQuery] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
//   const [orderDialog, setOrderDialog] = useState<{ open: boolean; row: WmsRow | null }>({ open: false, row: null });
//   const [detailDialog, setDetailDialog] = useState<{ open: boolean; row: WmsRow | null }>({ open: false, row: null });
//   const [deleteTarget, setDeleteTarget] = useState<{ kind: "order" | "detail"; row: WmsRow } | null>(null);
//   const [selection, setSelection] = useState<Record<string, boolean>>({});
//   const [pickingIssues, setPickingIssues] = useState<WmsRow[]>([]);
//   const [pickingIssuesOpen, setPickingIssuesOpen] = useState(false);
//   const [pickOptions, setPickOptions] = useState({ preference: "job_no", min_qty: "N", exp_period: "0", confirm_date: new Date().toISOString().slice(0, 10) });

//   const config = getOutboundTabConfig(tab);
// const loadRows = async (clearNotice = true) => {
//   if (!config || loadingJob) return;
//   setLoading(true);
//   if (clearNotice) setNotice(null);
//   setSelection({});
//   try {
//     const res = await executeWmsInboundSql(
//       config.sql({ companyCode: user?.company_code || "", jobNo, prinCode })
//     );
//     // handle both plain array and wrapped { data: [] } response
//     const data = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
//     setRows(data.map(normalizeRow));
//   } catch (error) {
//     setNotice({ type: "error", message: processMessage(`Unable to load ${config.title}.`, error) });
//   } finally {
//     setLoading(false);
//   }
// };

// useEffect(() => {
//   if (!prinCode) return; // ← add this guard
//   void loadRows();
// }, [tab, jobNo, prinCode, loadingJob]);

//   if (!config) return <Card><CardContent className="p-6 text-sm text-muted-foreground">This outbound tab is not configured yet.</CardContent></Card>;

//   const selectedKeys = Object.entries(selection).filter(([, selected]) => selected).map(([key]) => key);
//   const selectedPayloadKeys = selectedKeys.map((key) => {
//     const numericKey = Number(key);
//     return Number.isFinite(numericKey) ? numericKey : key;
//   });
//   const actionColumns = makeColumns(config.columns);
//   const columns = tabRequiresSelection(tab)
//     ? [rowNumberColumn(), selectionColumn(selection, setSelection, config.selectionKey), ...actionColumns]
//     : config.editable
//       ? [
//           rowNumberColumn(),
//           ...actionColumns,
//           actionColumn(
//             (row) => config.kind === "order" ? setOrderDialog({ open: true, row }) : setDetailDialog({ open: true, row }),
//             (row) => setDeleteTarget({ kind: config.kind === "order" ? "order" : "detail", row }),
//           ),
//         ]
//       : [rowNumberColumn(), ...actionColumns];

//   const runPickAction = async (mode: "PICK" | "CONFIRM" | "CANCEL") => {
//     if (!selectedKeys.length) {
//       setNotice({ type: "error", message: `Please select at least one row before running ${mode === "PICK" ? "picking" : mode === "CONFIRM" ? "job confirmation" : "cancel picking"}.` });
//       return;
//     }
//     setLoading(true);
//     try {
//       if (mode === "PICK") {
//         const issueRows = await executeWmsInboundSql(`SELECT * FROM VW_PICK_QTY_BALANCE WHERE JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}'`);
//         if (issueRows.length) {
//           setPickingIssues(issueRows.map(normalizeRow));
//           setPickingIssuesOpen(true);
//           setNotice({ type: "error", message: "Picking validation has issues. Review the issue list before picking." });
//           return;
//         }
//       await putWmsOutbound(
//         `picking_details/pick_order/${encodeURIComponent(jobNo)}`,
//         { serial_no: selectedPayloadKeys },
//         {
//           prin_code:  prinCode,
//           preference: pickPreference,
//           pick:       "Y",
//           min_qty:    leastQty ? "Y" : "N",
//           exp_period: ignoreMinExp ? "0" : pickOptions.exp_period,
//           pick_criteria: pickCriteria,
//         }
//       );

//       } else if (mode === "CONFIRM") {
//         await putWmsOutbound(`picking_details/confirm_order/${encodeURIComponent(jobNo)}`, { serial_no: selectedPayloadKeys }, { prin_code: prinCode, confirm_date: pickOptions.confirm_date });
//       } else {
//         await putWmsOutbound(`picking_details/oubcancelPick/${encodeURIComponent(jobNo)}`, { serial_no: selectedPayloadKeys }, { prin_code: prinCode, freeze: "Y   " });
//       }
//       setNotice({ type: "success", message: `${mode === "PICK" ? "Picking" : mode === "CONFIRM" ? "Job confirmation" : "Cancel picking"} completed for ${selectedKeys.length} selected row${selectedKeys.length === 1 ? "" : "s"}.` });
//       await loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: processMessage(`Unable to process ${mode === "PICK" ? "picking" : mode === "CONFIRM" ? "job confirmation" : "cancel picking"} for selected rows.`, error) });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const confirmDelete = async () => {
//     if (!deleteTarget) return;
//     setLoading(true);
//     try {
//       if (deleteTarget.kind === "order") {
//         await postWmsOutbound("orders", {
//           ...deleteTarget.row,
//           job_no: `${value(deleteTarget.row, "job_no") || jobNo}$$$DELETE`,
//         });
//       } else {
//         await executeCommonProcedure({
//           parameter: "DELETE_TO_ORDER_DET",
//           loginid: user?.loginid || "",
//           val1s1: value(deleteTarget.row, "company_code") || user?.company_code || "",
//           val1s2: value(deleteTarget.row, "prin_code") || prinCode,
//           val1s3: value(deleteTarget.row, "job_no") || jobNo,
//           val1n1: Number(value(deleteTarget.row, "serial_no") || 0),
//         });
//       }
//       setNotice({ type: "success", message: deleteTarget.kind === "order" ? "Order entry deleted successfully." : "Order detail deleted successfully." });
//       setDeleteTarget(null);
//       await loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: processMessage(deleteTarget.kind === "order" ? "Unable to delete order entry." : "Unable to delete order detail.", error) });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const toolbar = (
//     <div className="flex flex-wrap items-center gap-2">
//       {tab === "order_entry" && <Button size="sm" variant="outline" onClick={() => setOrderDialog({ open: true, row: null })}><Plus size={14} /> Add Order</Button>}
//       {tab === "order_details" && <Button size="sm" variant="outline" onClick={() => setDetailDialog({ open: true, row: null })}><Plus size={14} /> Add Detail</Button>}
//       {tab === "order_details" && <EdiImportButton jobNo={jobNo} prinCode={prinCode} companyCode={user?.company_code || ""} loginid={user?.loginid || ""} onDone={loadRows} onNotice={setNotice} />}
// {tab === "picking_details" && (
//   <>
//     <Button size="sm" variant="outline" onClick={() => setPickModalOpen(true)}>
//       <PackageCheck size={14} /> Pick Orders
//     </Button>
//     <Dialog
//       open={pickModalOpen}
//       title="Picking Option"
//       wide
//       onClose={() => setPickModalOpen(false)}
//       footer={
//         <>
//           <Button variant="outline" onClick={() => setPickModalOpen(false)}>Cancel</Button>
//           <Button onClick={() => { setPickModalOpen(false); runPickAction("PICK"); }}>Ok</Button>
//         </>
//       }
//     >
//       <div className="grid grid-cols-2 gap-6 p-2">
//         {/* Preference */}
//         <div>
//           <p className="mb-3 text-sm font-semibold text-foreground">Preference</p>
//           <div className="grid gap-2">
//             {[
//               { label: "None",            value: "job_no" },
//               { label: "Full Pallete",    value: "full_pallete" },
//               { label: "Mixed Pallete",   value: "mixed_pallete" },
//               { label: "Lead To Max Load",value: "lead_to_max_load" },
//             ].map((opt) => (
//               <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
//                 <input
//                   type="radio"
//                   className="accent-primary"
//                   checked={pickPreference === opt.value}
//                   onChange={() => setPickPreference(opt.value)}
//                 />
//                 {opt.label}
//               </label>
//             ))}
//           </div>
//           <div className="mt-4 grid gap-2">
//             <label className="flex items-center gap-2 text-sm cursor-pointer">
//               <input type="checkbox" className="accent-primary" checked={leastQty} onChange={(e) => setLeastQty(e.target.checked)} />
//               Least Qty
//             </label>
//             <label className="flex items-center gap-2 text-sm cursor-pointer">
//               <input type="checkbox" className="accent-primary" checked={ignoreMinExp} onChange={(e) => setIgnoreMinExp(e.target.checked)} />
//               Ignore Minimum Exp Period
//             </label>
//           </div>
//         </div>

//         {/* Pick Criteria */}
//         <div>
//           <p className="mb-3 text-sm font-semibold text-foreground">Pick Criteria</p>
//           <div className="grid gap-2">
//             {[
//               { label: "FIFO",               value: "fifo" },
//               { label: "FEFO",               value: "fefo" },
//               { label: "Document Reference", value: "doc_ref" },
//               { label: "Lot Number",         value: "lot_no" },
//               { label: "Manufacture Date",   value: "production_date" },
//               { label: "Expiry Date",        value: "expiry_date" },
//               { label: "LIFO",               value: "lifo" },
//               { label: "LEFO",               value: "lefo" },
//               { label: "Unit Price",         value: "unit_price" },
//               { label: "Manufacturer",       value: "manufacturer" },
//               { label: "Country of Origin",  value: "country_origin" },
//               { label: "Site/Location Code", value: "location_code" },
//               { label: "WM - PICKWAVE",      value: "wm_pickwave" },
//               { label: "WM - FINAL PICK WAVE", value: "wm_final_pickwave" },
//               { label: "SA - PICK WAVE",     value: "sa_pickwave" },
//             ].map((opt) => (
//               <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
//                 <input
//                   type="radio"
//                   className="accent-primary"
//                   checked={pickCriteria === opt.value}
//                   onChange={() => setPickCriteria(opt.value)}
//                 />
//                 {opt.label}
//               </label>
//             ))}
//           </div>
//         </div>
//       </div>
//     </Dialog>
//   </>
// )}      {tab === "cancel_picking" && <Button size="sm" variant="outline" onClick={() => runPickAction("CANCEL")} disabled={loading}><Ban size={14} /> Cancel Selected</Button>}
//       {tab === "job_confirmation" && <ConfirmToolbar options={pickOptions} setOptions={setPickOptions} onConfirm={() => runPickAction("CONFIRM")} disabled={loading} />}
//       <Button size="sm" variant="outline" onClick={() => loadRows()}><RefreshCw size={14} /> Refresh</Button>
//     </div>
//   );

//   return (
//     <section className="grid gap-3">
//       <NoticeToast notice={notice} onClose={() => setNotice(null)} />
//       <DataTable
//         columns={columns}
//         data={rows}
//         subtitle={config.title}
//         searchValue={query}
//         onSearchChange={setQuery}
//         searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
//         loading={loading || loadingJob}
//         height="calc(100vh - 285px)"
//         minWidth={config.minWidth}
//         density="grid"
//         enablePagination
//         pageSize={75}
//         toolbar={toolbar}
//         getRowId={(row, index) => `${tab}_${value(row, config.selectionKey || "serial_no") || value(row, "order_no") || index}`}
//       />
//       <OrderEntryDialog open={orderDialog.open} row={orderDialog.row} job={job} onClose={() => setOrderDialog({ open: false, row: null })} onDone={loadRows} onNotice={setNotice} />
//       <OrderDetailDialog open={detailDialog.open} row={detailDialog.row} job={job} orderRows={rows} onClose={() => setDetailDialog({ open: false, row: null })} onDone={loadRows} onNotice={setNotice} />
//       <Dialog
//         open={Boolean(deleteTarget)}
//         title={deleteTarget?.kind === "order" ? "Delete Order Entry" : "Delete Order Detail"}
//         description="This will remove the selected outbound row using the existing Bayanat backend procedure."
//         onClose={() => setDeleteTarget(null)}
//       >
//         <div className="grid gap-4">
//           <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
//             {deleteTarget?.kind === "order" ? "Order No" : "Serial No"}:{" "}
//             <strong className="text-foreground">{deleteTarget?.kind === "order" ? value(deleteTarget.row, "order_no") : value(deleteTarget?.row || {}, "serial_no")}</strong>
//           </div>
//           <div className="flex justify-end gap-2">
//             <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}><X size={15} /> Cancel</Button>
//             <Button type="button" variant="destructive" disabled={loading} onClick={confirmDelete}><Trash2 size={15} /> Delete</Button>
//           </div>
//         </div>
//       </Dialog>
//       <Dialog open={pickingIssuesOpen} title="Picking Validation Issues" description="These rows need quantity or manufacturing/expiry review before picking." wide onClose={() => setPickingIssuesOpen(false)}>
//         <DataTable
//           columns={makeColumns(pickingIssueColumns())}
//           data={pickingIssues}
//           subtitle="Validation"
//           height={420}
//           minWidth={1500}
//           density="grid"
//           enablePagination
//           pageSize={50}
//           searchPlaceholder="Search validation issues..."
//         />
//       </Dialog>
//     </section>
//   );
// }

// function OrderEntryDialog({ open, row, job, onClose, onDone, onNotice }: { open: boolean; row: WmsRow | null; job: WmsRow | null; onClose: () => void; onDone: () => void; onNotice: (notice: { type: "success" | "error"; message: string }) => void }) {
//   const { user } = useAuth();
//   const [form, setForm] = useState<WmsRow>({});
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     setForm({
//       company_code: value(job || {}, "company_code") || user?.company_code || "",
//       prin_code: value(job || {}, "prin_code"),
//       job_no: value(job || {}, "job_no"),
//       curr_code: "QAR",
//       ex_rate: "1",
//       order_date: new Date().toISOString().slice(0, 10),
//       order_due_date: new Date().toISOString().slice(0, 10),
//       ...(row || {}),
//     });
//   }, [row, job, user?.company_code]);

//   const save = async (event: FormEvent) => {
//     event.preventDefault();
//     const missing = orderEntryFields.find((field) => field.required && !String(form[field.name] || "").trim());
//     if (missing) {
//       onNotice({ type: "error", message: `${missing.label} is required` });
//       return;
//     }
//     setSaving(true);
//     try {
//       await postWmsOutbound("orders", form);
//       onNotice({ type: "success", message: "Order entry saved successfully" });
//       onClose();
//       await onDone();
//     } catch (error) {
//       onNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save order entry" });
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <OutboundFormFrame
//       open={open}
//       title={row ? "Edit Order Entry" : "Add Order Entry"}
//       onClose={onClose}
//       footer={<DialogActions formId="outbound-order-entry-form" saving={saving} onCancel={onClose} submitText={row ? "Update" : "Save Order"} />}
//     >
//       <form id="outbound-order-entry-form" className="grid gap-3" onSubmit={save}>
//         <fieldset className="rounded-md border border-border bg-card p-2.5">
//           <legend className="px-2 text-xs font-semibold text-muted-foreground">Order Information</legend>
//           <div className="grid gap-2.5 lg:grid-cols-3">
//             <LookupField
//               label="Customer"
//               value={String(form.cust_code || "")}
//               displayValue={formatLookupDisplay(form, ["cust_code", "cust_name"])}
//               valueField="cust_code"
//               displayFields={["cust_code", "cust_name"]}
//               columns={[{ field: "cust_code", header: "Customer Code" }, { field: "cust_name", header: "Customer Name" }]}
//               placeholder="Select customer"
//               loadOptions={() => loadOutboundCustomers(value(job || {}, "company_code") || user?.company_code || "", value(job || {}, "prin_code"))}
//               onChange={(selected, selectedRow) => setForm((current) => ({ ...current, cust_code: selected, cust_name: selectedRow ? lookupText(selectedRow, "cust_name") : "" }))}
//             />
//             <TextField name="order_no" label="Order No" required form={form} setForm={setForm} />
//             <DateField name="order_date" label="Order Date" form={form} setForm={setForm} onPicked={(selected) => setForm((current) => ({ ...current, order_date: selected, order_due_date: current.order_due_date || selected }))} />
//             <DateField name="order_due_date" label="Due Date" form={form} setForm={setForm} />
//             <LookupField
//               label="Currency"
//               value={String(form.curr_code || "")}
//               displayValue={formatLookupDisplay(form, ["curr_code", "curr_name"])}
//               valueField="curr_code"
//               displayFields={["curr_code", "curr_name"]}
//               columns={[{ field: "curr_code", header: "Currency Code" }, { field: "curr_name", header: "Currency Name" }]}
//               placeholder="Select currency"
//               loadOptions={loadCurrencies}
//               onChange={(selected, selectedRow) => setForm((current) => ({ ...current, curr_code: selected, curr_name: selectedRow ? lookupText(selectedRow, "curr_name") : "" }))}
//             />
//             <TextField name="ex_rate" label="Exchange Rate" type="number" form={form} setForm={setForm} />
//           </div>
//         </fieldset>
//         <fieldset className="rounded-md border border-border bg-card p-2.5">
//           <legend className="px-2 text-xs font-semibold text-muted-foreground">Container, Timing And Reference</legend>
//           <div className="grid gap-2.5 lg:grid-cols-4">
//             {["moc1", "moc2", "exp_container_no", "exp_container_size", "exp_container_type", "exp_container_sealno", "cust_reference", "pack_start", "pack_end", "load_start", "load_end"].map((name) => {
//               const field = orderEntryFields.find((item) => item.name === name);
//               return <TextField key={name} name={name} label={field?.label || name} type={field?.type || "text"} form={form} setForm={setForm} />;
//             })}
//           </div>
//         </fieldset>
//       </form>
//     </OutboundFormFrame>
//   );
// }

// function OrderDetailDialog({ open, row, job, onClose, onDone, onNotice }: { open: boolean; row: WmsRow | null; job: WmsRow | null; orderRows: WmsRow[]; onClose: () => void; onDone: () => void; onNotice: (notice: { type: "success" | "error"; message: string }) => void }) {
//   const { user } = useAuth();
//   const [form, setForm] = useState<WmsRow>({});
//   const [saving, setSaving] = useState(false);
//   const companyCode = value(job || {}, "company_code") || user?.company_code || "";
// const location = useLocation();
// const prinCode = value(job || {}, "prin_code") || new URLSearchParams(location.search).get("principal_code") || "";
//   const jobNo = value(job || {}, "job_no");

//   useEffect(() => {
//     setForm({
//       company_code: value(job || {}, "company_code") || user?.company_code || "",
//       prin_code: value(job || {}, "prin_code"),
//       job_no: value(job || {}, "job_no"),
//       serial_no: 0,
//       qty_puom: 0,
//       qty_luom: 0,
//       quantity: 0,
//       minperiod_exppick: 0,
//       ...(row || {}),
//     });
//   }, [row, job, user?.company_code]);

//   const save = async (event: FormEvent) => {
//     event.preventDefault();
//     const missing = orderDetailFields.find((field) => field.required && !String(form[field.name] || "").trim());
//     if (missing) {
//       onNotice({ type: "error", message: `${missing.label} is required` });
//       return;
//     }
//     setSaving(true);
//     try {
//       await putWmsOutbound("upsertOutboundOrderDetailManualHandler", form);
//       onNotice({ type: "success", message: "Order detail saved successfully" });
//       onClose();
//       await onDone();
//     } catch (error) {
//       onNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save order detail" });
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <OutboundFormFrame
//       open={open}
//       title={row ? "Edit Order Detail" : "Add Order Detail"}
//       onClose={onClose}
//       footer={<DialogActions formId="outbound-order-detail-form" saving={saving} onCancel={onClose} submitText={row ? "Update" : "Save Detail"} />}
//     >
//       <form id="outbound-order-detail-form" className="grid gap-3" onSubmit={save}>
//         <fieldset className="rounded-md border border-border bg-card p-2.5">
//           <legend className="px-2 text-xs font-semibold text-muted-foreground">Order And Product</legend>
//           <div className="grid gap-2.5 xl:grid-cols-[1fr_1fr_1.25fr_240px]">
//             <LookupField
//               label="Order No"
//               value={String(form.order_no || "")}
//               displayValue={formatLookupDisplay(form, ["order_no", "cust_name"])}
//               valueField="order_no"
//               displayFields={["order_no", "cust_name"]}
//               columns={[{ field: "order_no", header: "Order No" }, { field: "cust_code", header: "Customer Code" }, { field: "cust_name", header: "Customer" }]}
//               placeholder="Select order"
//               loadOptions={() => loadOrderEntryOptions(companyCode, prinCode, jobNo)}
//               onChange={(selected, selectedRow) => setForm((current) => ({ ...current, order_no: selected, cust_code: selectedRow ? lookupText(selectedRow, "cust_code") : "", cust_name: selectedRow ? lookupText(selectedRow, "cust_name") : "" }))}
//             />
//             <ReadOnlyField label="Customer" value={formatLookupDisplay(form, ["cust_code", "cust_name"])} />
//             <LookupField
//               label="Product"
//               value={String(form.prod_code || "")}
//               displayValue={formatLookupDisplay(form, ["prod_code", "prod_name"])}
//               valueField="prod_code"
//               displayFields={["prod_code", "prod_name"]}
//               columns={[{ field: "prod_code", header: "Product Code" }, { field: "prod_name", header: "Product" }, { field: "p_uom", header: "P UOM" }, { field: "l_uom", header: "L UOM" }]}
//               placeholder="Select product"
//               loadOptions={() => loadOutboundProducts(companyCode, prinCode)}
//               onChange={(selected, selectedRow) => setForm((current) => ({
//                 ...current,
//                 prod_code: selected,
//                 prod_name: selectedRow ? lookupText(selectedRow, "prod_name") : "",
//                 p_uom: selectedRow ? lookupText(selectedRow, "p_uom") : "",
//                 l_uom: selectedRow ? lookupText(selectedRow, "l_uom") : "",
//                 uppp: selectedRow ? lookupText(selectedRow, "uppp") : current.uppp,
//                 site_code: "",
//                 loc_code_from: "",
//                 loc_code_to: "",
//                 batch_no: "",
//                 lot_no: "",
//               }))}
//             />
//             <AvailableQuantityCard value={Number(form.act_order_qty || 0)} />
//           </div>
//         </fieldset>
//         <fieldset className="rounded-md border border-border bg-card p-2.5">
//           <legend className="px-2 text-xs font-semibold text-muted-foreground">Stock Location</legend>
//           <div className="grid gap-2.5 lg:grid-cols-5">
//             <LookupField
//               label="Site Code"
//               value={String(form.site_code || "")}
//               valueField="site_code"
//               displayFields={["site_code"]}
//               columns={[{ field: "site_code", header: "Site Code" }]}
//               placeholder="Select site"
//               disabled={!form.prod_code}
//               loadOptions={() => loadStockSites(companyCode, prinCode, String(form.prod_code || ""))}
//               onChange={(selected) => setForm((current) => ({ ...current, site_code: selected, loc_code_from: "", loc_code_to: "", batch_no: "", lot_no: "" }))}
//             />
//             <LookupField
//               label="Location From"
//               value={String(form.loc_code_from || "")}
//               valueField="location_code"
//               displayFields={["location_code"]}
//               columns={[{ field: "location_code", header: "Location" }]}
//               placeholder="Select location"
//               disabled={!form.site_code || !form.prod_code}
//               loadOptions={() => loadStockLocations(companyCode, prinCode, String(form.prod_code || ""), String(form.site_code || ""))}
//               onChange={(selected) => setForm((current) => ({ ...current, loc_code_from: selected, loc_code_to: current.loc_code_to || selected }))}
//             />
//             <LookupField
//               label="Location To"
//               value={String(form.loc_code_to || "")}
//               valueField="location_code"
//               displayFields={["location_code"]}
//               columns={[{ field: "location_code", header: "Location" }]}
//               placeholder="Select location"
//               disabled={!form.site_code || !form.prod_code}
//               loadOptions={() => loadStockLocations(companyCode, prinCode, String(form.prod_code || ""), String(form.site_code || ""))}
//               onChange={(selected) => setForm((current) => ({ ...current, loc_code_to: selected }))}
//             />
//             <LookupField
//               label="Batch No"
//               value={String(form.batch_no || "")}
//               valueField="batch_no"
//               displayFields={["batch_no"]}
//               columns={[{ field: "batch_no", header: "Batch No" }]}
//               placeholder="Select batch"
//               disabled={!form.site_code || !form.prod_code}
//               loadOptions={() => loadStockBatches(companyCode, String(form.prod_code || ""), String(form.site_code || ""))}
//               onChange={(selected) => setForm((current) => ({ ...current, batch_no: selected }))}
//             />
//             <LookupField
//               label="Lot No"
//               value={String(form.lot_no || "")}
//               valueField="lot_no"
//               displayFields={["lot_no"]}
//               columns={[{ field: "lot_no", header: "Lot No" }]}
//               placeholder="Select lot"
//               disabled={!form.site_code || !form.prod_code}
//               loadOptions={() => loadStockLots(companyCode, String(form.prod_code || ""), String(form.site_code || ""))}
//               onChange={(selected) => setForm((current) => ({ ...current, lot_no: selected }))}
//             />
//           </div>
//         </fieldset>
//         <fieldset className="rounded-md border border-border bg-card p-2.5">
//           <legend className="px-2 text-xs font-semibold text-muted-foreground">Dates And Conversion</legend>
//           <div className="grid gap-2.5 lg:grid-cols-5">
//             <DateField name="production_from" label="Production From" form={form} setForm={setForm} onPicked={(selected) => setForm((current) => ({ ...current, production_from: selected, production_to: current.production_to || selected }))} />
//             <DateField name="production_to" label="Production To" form={form} setForm={setForm} />
//             <DateField name="expiry_from" label="Expiry From" form={form} setForm={setForm} onPicked={(selected) => setForm((current) => ({ ...current, expiry_from: selected, expiry_to: current.expiry_to || selected }))} />
//             <DateField name="expiry_to" label="Expiry To" form={form} setForm={setForm} />
//             <ReadOnlyField label="UPPP" value={String(form.uppp || "")} />
//           </div>
//         </fieldset>
//         <div className="grid items-start gap-3 lg:grid-cols-[1fr_1.8fr]">
//           <QuantityStrip form={form} setForm={setForm} />
//           <div className="grid content-start gap-2.5 rounded-md border border-border bg-card p-2.5 md:grid-cols-2">
//             <TextField name="salesman_code" label="Salesman" form={form} setForm={setForm} />
//             <TextField name="minperiod_exppick" label="Min Expiry Period" type="number" form={form} setForm={setForm} />
//           </div>
//         </div>
//       </form>
//     </OutboundFormFrame>
//   );
// }

// function EdiImportButton({ jobNo, prinCode, companyCode, loginid, onDone, onNotice }: { jobNo: string; prinCode: string; companyCode: string; loginid: string; onDone: () => void; onNotice: (notice: { type: "success" | "error"; message: string }) => void }) {
//   const fileRef = useRef<HTMLInputElement>(null);
//   const [busy, setBusy] = useState(false);
//   const importFile = async (file: File) => {
//     setBusy(true);
//     try {
//       await postWmsOutbound("copyEDIToOrderDetailHandler", { login_id: loginid, job_no: jobNo, prin_code: prinCode, company_code: companyCode, file_name: file.name });
//       onNotice({ type: "success", message: "EDI copy submitted successfully" });
//       await onDone();
//     } catch (error) {
//       onNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to process EDI import" });
//     } finally {
//       setBusy(false);
//     }
//   };
//   return (
//     <>
//       <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} />
//       <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><FileUp size={14} /> {busy ? "Importing..." : "EDI Import"}</Button>
//     </>
//   );
// }

// function PickToolbar({ options, setOptions, onPick, disabled }: { options: { preference: string; min_qty: string; exp_period: string }; setOptions: (options: { preference: string; min_qty: string; exp_period: string; confirm_date: string }) => void; onPick: () => void; disabled: boolean }) {
//   return (
//     <div className="flex flex-wrap items-center gap-2">
//       <Select className="h-8 w-36 text-xs" value={options.preference} onChange={(event) => setOptions({ ...options, preference: event.target.value, confirm_date: " " })}>
//         <option value="job_no">Job</option>
//         <option value="order_no">Order</option>
//         <option value="prod_code">Product</option>
//         <option value="location_code">Location</option>
//         <option value="lot_no">Lot</option>
//         <option value="expiry_date">Expiry</option>
//         <option value="production_date">Production</option>
//       </Select>
//       <Select className="h-8 w-28 text-xs" value={options.min_qty} onChange={(event) => setOptions({ ...options, min_qty: event.target.value, confirm_date: " " })}>
//         <option value="N">Full Qty</option>
//         <option value="Y">Min Qty</option>
//       </Select>
//       <Input className="h-8 w-28 text-xs" value={options.exp_period} onChange={(event) => setOptions({ ...options, exp_period: event.target.value, confirm_date: " " })} placeholder="Exp Days" />
//       <Button size="sm" variant="outline" disabled={disabled} onClick={onPick}><PackageCheck size={14} /> Pick Selected</Button>
//     </div>
//   );
// }

// function ConfirmToolbar({ options, setOptions, onConfirm, disabled }: { options: { preference: string; min_qty: string; exp_period: string; confirm_date: string }; setOptions: (options: { preference: string; min_qty: string; exp_period: string; confirm_date: string }) => void; onConfirm: () => void; disabled: boolean }) {
//   return (
//     <div className="flex flex-wrap items-center gap-2">
//       <Input className="h-8 w-36 text-xs" type="date" value={options.confirm_date} onChange={(event) => setOptions({ ...options, confirm_date: event.target.value })} />
//       <Button size="sm" variant="outline" disabled={disabled} onClick={onConfirm}><CheckCircle2 size={14} /> Confirm Selected</Button>
//     </div>
//   );
// }

// function OutboundFormFrame({ open, title, children, footer, onClose }: { open: boolean; title: string; children: ReactNode; footer: ReactNode; onClose: () => void }) {
//   if (!open) return null;
//   return (
//     <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]" onMouseDown={onClose}>
//       <div
//         className="outbound-form-compact grid max-h-[92vh] w-[min(96vw,1280px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl"
//         onMouseDown={(event) => event.stopPropagation()}
//       >
//         <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
//           <div className="flex items-center gap-3">
//             <span className="h-7 w-1 rounded-full bg-primary" />
//             <div>
//               <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Outbound Job</p>
//               <h2 className="m-0 text-lg font-bold text-foreground">{title}</h2>
//             </div>
//           </div>
//           <button
//             aria-label="Close"
//             className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
//             type="button"
//             onClick={onClose}
//           >
//             <X size={16} />
//           </button>
//         </div>
//         <div className="min-h-0 overflow-y-auto overflow-x-hidden bg-muted/20 p-3 text-sm">{children}</div>
//         <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">{footer}</div>
//       </div>
//     </div>
//   );
// }

// function OutboundJobCreateForm({ form, setForm, companyCode, onSubmit }: { form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void; companyCode: string; onSubmit: (event: FormEvent) => void }) {
//   const jobClass = String(form.job_class || "N");
//   const transportMode = String(form.transport_mode || "S");
//   const setValue = (name: string, fieldValue: unknown) => setForm((current) => ({ ...current, [name]: fieldValue }));

//   return (
//     <form id="outbound-job-form" className="outbound-job-create grid gap-2.5" onSubmit={onSubmit}>
//       <section className="rounded-md border bg-card shadow-sm">
//         <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
//           <div className="flex items-center gap-2.5">
//             <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
//               <Ship size={16} />
//             </div>
//             <div>
//               <p className="eyebrow m-0">Job Information</p>
//               <h3 className="m-0 text-sm font-semibold">Outbound Job Creation</h3>
//             </div>
//           </div>
//           <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
//             {companyCode || "Company"}
//           </span>
//         </div>
//         <div className="grid gap-2.5 p-3 md:grid-cols-4">
//             <LookupField
//               label="Principal Code"
//               value={String(form.prin_code || "")}
//               displayValue={formatLookupDisplay(form, ["prin_code", "prin_name"])}
//               valueField="prin_code"
//               displayFields={["prin_code", "prin_name"]}
//               columns={[{ field: "prin_code", header: "Principal Code" }, { field: "prin_name", header: "Principal Name" }, { field: "prin_dept_code", header: "Department" }, { field: "div_code", header: "Division" }]}
//               placeholder="Select principal"
//               loadOptions={() => loadOutboundPrincipalLookup(companyCode)}
//               onChange={(selected, selectedRow) => setForm((current) => ({
//                 ...current,
//                 prin_code: selected,
//                 prin_name: selectedRow ? lookupText(selectedRow, "prin_name") : "",
//                 div_code: selectedRow ? lookupText(selectedRow, "div_code") || current.div_code : current.div_code,
//                 div_name: selectedRow ? lookupText(selectedRow, "div_name") || current.div_name : current.div_name,
//                 dept_code: selectedRow ? lookupText(selectedRow, "prin_dept_code") || current.dept_code : current.dept_code,
//                 dept_name: selectedRow ? lookupText(selectedRow, "dept_name") || current.dept_name : current.dept_name,
//                 curr_code: selectedRow ? lookupText(selectedRow, "curr_code") || current.curr_code || "OMR" : current.curr_code || "OMR",
//                 ex_rate: current.ex_rate || 1,
//               }))}
//             />
//             <LookupField
//               label="Department"
//               value={String(form.dept_code || "")}
//               displayValue={formatLookupDisplay(form, ["dept_code", "dept_name"])}
//               valueField="dept_code"
//               displayFields={["dept_code", "dept_name"]}
//               columns={[{ field: "dept_code", header: "Department Code" }, { field: "dept_name", header: "Department Name" }, { field: "div_code", header: "Division" }]}
//               placeholder="Select department"
//               loadOptions={() => loadDepartmentLookup(companyCode, String(form.div_code || ""))}
//               onChange={(selected, selectedRow) => setForm((current) => ({ ...current, dept_code: selected, dept_name: selectedRow ? lookupText(selectedRow, "dept_name") : "", div_code: selectedRow ? lookupText(selectedRow, "div_code") || current.div_code : current.div_code, div_name: selectedRow ? lookupText(selectedRow, "div_name") || current.div_name : current.div_name }))}
//             />
//             <LookupField
//               label="Division"
//               value={String(form.div_code || "")}
//               displayValue={formatLookupDisplay(form, ["div_code", "div_name"])}
//               valueField="div_code"
//               displayFields={["div_code", "div_name"]}
//               columns={[{ field: "div_code", header: "Division Code" }, { field: "div_name", header: "Division Name" }, { field: "country_code", header: "Country" }]}
//               placeholder="Select division"
//               loadOptions={() => loadWmsMasterLookup("division")}
//               onChange={(selected, selectedRow) => setForm((current) => ({ ...current, div_code: selected, div_name: selectedRow ? lookupText(selectedRow, "div_name") : "" }))}
//             />
//             <label className="field">
//               <span>Job Class <strong className="text-destructive">*</strong></span>
//               <Select value={jobClass} onChange={(event) => setValue("job_class", event.target.value)}>
//                 <option value="">Select Job Class</option>
//                 {Object.entries(jobClassLabels).map(([code, label]) => <option value={code} key={code}>{code} - {label}</option>)}
//               </Select>
//             </label>
//             <label className="field">
//               <span>Job Type <strong className="text-destructive">*</strong></span>
//               <Select value={String(form.job_type || "EXP")} onChange={(event) => setValue("job_type", event.target.value)}>
//                 <option value="EXP">EXP - Export</option>
//               </Select>
//             </label>
//             <label className="field">
//               <span>Transport Mode</span>
//               <Select value={transportMode} onChange={(event) => setValue("transport_mode", event.target.value)}>
//                 <option value="S">S - Sea</option>
//                 <option value="A">A - Air</option>
//                 <option value="R">R - Road</option>
//                 <option value="C">C - Courier</option>
//               </Select>
//             </label>
//             <DateField name="schedule_date" label="Schedule Date" form={form} setForm={setForm} />
//             <TextField name="doc_ref" label="Doc Ref" form={form} setForm={setForm} />
//             <TextField name="prin_ref2" label="Principal Ref 2" form={form} setForm={setForm} />
//           </div>
//       </section>

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
//           <LookupField
//             label="Country Origin"
//             value={String(form.country_origin || "")}
//             displayValue={formatLookupDisplay(form, ["country_origin", "country_origin_name"])}
//             valueField="country_code"
//             displayFields={["country_code", "country_name"]}
//             columns={[{ field: "country_code", header: "Country Code" }, { field: "country_name", header: "Country Name" }]}
//             placeholder="Select origin"
//             loadOptions={() => loadWmsMasterLookup("country")}
//             onChange={(selected, selectedRow) => setForm((current) => ({ ...current, country_origin: selected, country_origin_name: selectedRow ? lookupText(selectedRow, "country_name") : "" }))}
//           />
//           <LookupField
//             label="Country Destination"
//             value={String(form.country_destination || "")}
//             displayValue={formatLookupDisplay(form, ["country_destination", "country_destination_name"])}
//             valueField="country_code"
//             displayFields={["country_code", "country_name"]}
//             columns={[{ field: "country_code", header: "Country Code" }, { field: "country_name", header: "Country Name" }]}
//             placeholder="Select destination"
//             loadOptions={() => loadWmsMasterLookup("country")}
//             onChange={(selected, selectedRow) => setForm((current) => ({ ...current, country_destination: selected, country_destination_name: selectedRow ? lookupText(selectedRow, "country_name") : "" }))}
//           />
//           <LookupField
//             label="Port Code"
//             value={String(form.port_code || "")}
//             displayValue={formatLookupDisplay(form, ["port_code", "port_name"])}
//             valueField="port_code"
//             displayFields={["port_code", "port_name"]}
//             columns={[{ field: "port_code", header: "Port Code" }, { field: "port_name", header: "Port Name" }, { field: "country_code", header: "Country" }]}
//             placeholder="Select port"
//             loadOptions={loadPortLookup}
//             onChange={(selected, selectedRow) => setForm((current) => ({ ...current, port_code: selected, port_name: selectedRow ? lookupText(selectedRow, "port_name") : "" }))}
//           />
//           <LookupField
//             label="Destination Port"
//             value={String(form.destination_port || "")}
//             displayValue={formatLookupDisplay(form, ["destination_port", "destination_port_name"])}
//             valueField="port_code"
//             displayFields={["port_code", "port_name"]}
//             columns={[{ field: "port_code", header: "Port Code" }, { field: "port_name", header: "Port Name" }, { field: "country_code", header: "Country" }]}
//             placeholder="Select destination port"
//             loadOptions={loadPortLookup}
//             onChange={(selected, selectedRow) => setForm((current) => ({ ...current, destination_port: selected, destination_port_name: selectedRow ? lookupText(selectedRow, "port_name") : "" }))}
//           />
//         </div>
//       </section>

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
//         <div className="grid gap-2.5 p-3 md:grid-cols-4">
//           <label className="field md:col-span-2">
//             <span>Description</span>
//             <Input value={String(form.description1 || "")} onChange={(event) => setValue("description1", event.target.value)} placeholder="Short job description" />
//           </label>
//           <label className="field md:col-span-2">
//             <span>Remarks</span>
//             <textarea className="ui-textarea min-h-[58px] rounded-md" value={String(form.remarks || "")} onChange={(event) => setValue("remarks", event.target.value)} placeholder="Operational remarks for this outbound job" />
//           </label>
//         </div>
//       </section>
//     </form>
//   );
// }

// function AvailableQuantityCard({ value }: { value: number }) {
//   return (
//     <div className="self-stretch overflow-hidden rounded-sm border border-primary bg-primary/5">
//       <div className="bg-primary px-3 py-2 text-center text-sm font-bold text-primary-foreground">Available Quantity</div>
//       <div className="grid min-h-[52px] place-items-center px-3 py-2">
//         <span className="text-2xl font-black leading-none text-primary">{Number(value || 0).toLocaleString()}</span>
//       </div>
//     </div>
//   );
// }

// function QuantityPanel({ title, form, setForm, editable }: { title: string; form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void; editable?: boolean }) {
//   const pUom = String(form.p_uom || "");
//   const lUom = String(form.l_uom || pUom || "");
//   return (
//     <fieldset className="rounded-md border border-border bg-card p-2.5">
//       <legend className="px-2 text-xs font-semibold text-muted-foreground">{title}</legend>
//       <div className="grid gap-2.5">
//         <QuantityInput
//           disabled={!editable}
//           label={editable ? "Primary Quantity" : "Actual Primary Quantity"}
//           name="qty_puom"
//           unit={pUom}
//           form={form}
//           setForm={setForm}
//         />
//         <QuantityInput
//           disabled={!editable || pUom === lUom}
//           label={editable ? "Lowest Quantity" : "Actual Lowest Quantity"}
//           name="qty_luom"
//           unit={lUom}
//           form={form}
//           setForm={setForm}
//         />
//         <QuantityInput
//           disabled={!editable}
//           label={editable ? "Total Quantity" : "Actual Quantity"}
//           name="quantity"
//           unit={lUom}
//           form={form}
//           setForm={setForm}
//         />
//       </div>
//     </fieldset>
//   );
// }

// function QuantityStrip({ form, setForm }: { form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void }) {
//   const pUom = String(form.p_uom || "");
//   const lUom = String(form.l_uom || pUom || "");
//   return (
//     <fieldset className="rounded-md border border-border bg-card p-2.5">
//       <legend className="px-2 text-xs font-semibold text-muted-foreground">Quantity</legend>
//       <div className="grid gap-2 md:grid-cols-3">
//         <QuantityInput label="Primary" name="qty_puom" unit={pUom} form={form} setForm={setForm} />
//         <QuantityInput label="Lowest" name="qty_luom" unit={lUom} form={form} setForm={setForm} disabled={pUom === lUom} />
//         <QuantityInput label="Total" name="quantity" unit={lUom} form={form} setForm={setForm} />
//       </div>
//       <div className="mt-2 grid gap-2 md:grid-cols-3">
//         <QuantityInput label="Actual Primary" name="qty_puom" unit={pUom} form={form} setForm={setForm} disabled />
//         <QuantityInput label="Actual Lowest" name="qty_luom" unit={lUom} form={form} setForm={setForm} disabled />
//         <QuantityInput label="Actual Total" name="quantity" unit={lUom} form={form} setForm={setForm} disabled />
//       </div>
//     </fieldset>
//   );
// }

// function QuantityInput({ label, name, unit, form, setForm, disabled }: { label: string; name: string; unit: string; form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void; disabled?: boolean }) {
//   return (
//     <label className="field">
//       <span>{label}</span>
//       <div className="flex h-10 overflow-hidden rounded-md border bg-background">
//         <Input
//           disabled={disabled}
//           className="h-10 rounded-none border-0 text-right shadow-none focus-visible:ring-0"
//           type="number"
//           value={String(form[name] || "")}
//           onChange={(event) => {
//             const next = { ...form, [name]: event.target.value };
//             setForm(() => next);
//             if (name === "qty_puom" || name === "qty_luom") recalcQuantity(next, setForm);
//           }}
//         />
//         <span className="grid min-w-14 place-items-center border-l bg-muted/50 px-3 text-sm font-semibold text-muted-foreground">{unit || "-"}</span>
//       </div>
//     </label>
//   );
// }

// function FormGrid({ fields, form, setForm }: { fields: { name: string; label: string; type?: string; required?: boolean }[]; form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void }) {
//   return (
//     <div className="rounded-md border bg-card">
//       <div className="border-b p-3">
//         <p className="eyebrow">Details</p>
//         <h3 className="m-0 text-base font-semibold">Basic Information</h3>
//       </div>
//       <div className="grid gap-3 p-3 md:grid-cols-3">
//         {fields.map((field) => (
//           <label className="field" key={field.name}>
//             <span>{field.label}{field.required && <strong className="text-destructive"> *</strong>}</span>
//             <Input type={field.type || "text"} value={String(form[field.name] || "")} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} />
//           </label>
//         ))}
//       </div>
//     </div>
//   );
// }

// function TextField({ name, label, form, setForm, type = "text", required, onChanged }: { name: string; label: string; form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void; type?: string; required?: boolean; onChanged?: (next: WmsRow) => void }) {
//   return (
//     <label className="field">
//       <span>{label}{required && <strong className="text-destructive"> *</strong>}</span>
//       <Input
//         type={type}
//         value={String(form[name] || "")}
//         onChange={(event) => {
//           const next = { ...form, [name]: event.target.value };
//           setForm(() => next);
//           onChanged?.(next);
//         }}
//       />
//     </label>
//   );
// }

// function DateField({ name, label, form, setForm, onPicked }: { name: string; label: string; form: WmsRow; setForm: (updater: (current: WmsRow) => WmsRow) => void; onPicked?: (value: string) => void }) {
//   return (
//     <label className="field">
//       <span>{label}</span>
//       <Input
//         type="date"
//         value={toDateInputValue(String(form[name] || ""))}
//         onChange={(event) => {
//           if (onPicked) onPicked(event.target.value);
//           else setForm((current) => ({ ...current, [name]: event.target.value }));
//         }}
//       />
//     </label>
//   );
// }

// function ReadOnlyField({ label, value }: { label: string; value: string }) {
//   return (
//     <label className="field">
//       <span>{label}</span>
//       <Input readOnly className="bg-muted/40" value={value || ""} />
//     </label>
//   );
// }

// function DialogActions({ saving, onCancel, submitText, formId }: { saving: boolean; onCancel: () => void; submitText: string; formId?: string }) {
//   return (
//     <div className="flex justify-end gap-2">
//       <Button type="button" variant="outline" onClick={onCancel}><X size={15} /> Cancel</Button>
//       <Button disabled={saving} form={formId} type="submit"><Save size={15} /> {saving ? "Saving..." : submitText}</Button>
//     </div>
//   );
// }

// function makeColumns(columns: { key: string; label: string; size?: number }[]): ColumnDef<WmsRow>[] {
//   return columns.map((column) => ({
//     accessorKey: column.key,
//     header: column.label,
//     size: column.size || 140,
//     cell: ({ row }) => formatCellValue(row.original, column.key),
//   }));
// }

// function rowNumberColumn(): ColumnDef<WmsRow> {
//   return {
//     id: "row_no",
//     header: "No",
//     size: 56,
//     enableColumnFilter: false,
//     cell: ({ row }) => row.index + 1,
//   };
// }

// function selectionColumn(selection: Record<string, boolean>, setSelection: (next: Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>)) => void, selectionKey = "serial_no"): ColumnDef<WmsRow> {
//   return {
//     id: "select",
//     header: "Select",
//     size: 70,
//     enableColumnFilter: false,
//     cell: ({ row }) => {
//       const id = value(row.original, selectionKey) || value(row.original, "serial_no") || value(row.original, "key_number") || row.id;
//       return (
//         <input
//           type="checkbox"
//           className="h-4 w-4 accent-primary"
//           checked={Boolean(selection[id])}
//           onChange={(event) => setSelection((current) => ({ ...current, [id]: event.target.checked }))}
//         />
//       );
//     },
//   };
// }

// function actionColumn(onEdit: (row: WmsRow) => void, onDelete?: (row: WmsRow) => void): ColumnDef<WmsRow> {
//   return {
//     id: "actions",
//     header: "Actions",
//     size: 105,
//     enableColumnFilter: false,
//     cell: ({ row }) => (
//       <div className="flex items-center gap-1">
//         <Button size="icon" variant="ghost" title="Edit" onClick={() => onEdit(row.original)}>
//           <Pencil size={14} />
//         </Button>
//         {onDelete && (
//           <Button size="icon" variant="ghost" title="Delete" onClick={() => onDelete(row.original)}>
//             <Trash2 size={14} />
//           </Button>
//         )}
//       </div>
//     ),
//   };
// }

// function getOutboundTabConfig(tab: string) {
//   const orderWhere = ({ companyCode, jobNo, prinCode }: { companyCode: string; jobNo: string; prinCode: string }) =>
//     `COMPANY_CODE = '${sqlEscape(companyCode)}' AND JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}'`;
//   const configs: Record<string, { title: string; minWidth: number; kind?: "order" | "detail"; editable?: boolean; selectionKey?: string; columns: { key: string; label: string; size?: number }[]; sql: (args: { companyCode: string; jobNo: string; prinCode: string }) => string }> = {
//     order_entry: {
//       title: "Order Entry",
//       minWidth: 1900,
//       kind: "order",
//       editable: true,
//       sql: (args) => `SELECT * FROM TO_ORDER WHERE ${orderWhere(args)} ORDER BY ORDER_NO`,
//       columns: [
//         { key: "order_no", label: "Order No", size: 150 },
//         { key: "cust_code", label: "Customer", size: 150 },
//         { key: "order_date", label: "Order Date", size: 120 },
//         { key: "order_due_date", label: "Due Date", size: 120 },
//         { key: "curr_code", label: "Currency", size: 120 },
//         { key: "ex_rate", label: "Exchange Rate", size: 130 },
//         { key: "moc1", label: "MOC 1", size: 100 },
//         { key: "moc2", label: "MOC 2", size: 100 },
//         { key: "exp_container_no", label: "Container No", size: 160 },
//         { key: "exp_container_size", label: "Container Size", size: 140 },
//         { key: "exp_container_type", label: "Container Type", size: 140 },
//         { key: "exp_container_sealno", label: "Seal No", size: 140 },
//         { key: "cust_reference", label: "Customer Ref", size: 170 },
//         { key: "pack_start", label: "Pack Start", size: 150 },
//         { key: "pack_end", label: "Pack End", size: 150 },
//         { key: "load_start", label: "Load Start", size: 150 },
//         { key: "load_end", label: "Load End", size: 150 },
//       ],
//     },
//     order_details: {
//       title: "Order Details",
//       minWidth: 2100,
//       kind: "detail",
//       editable: true,
//       sql: (args) => `SELECT * FROM VW_TO_ORDER_DET WHERE ${orderWhere(args)} ORDER BY ORDER_NO, SERIAL_NO`,
//       columns: orderDetailColumns(),
//     },
//     picking_details: {
//       title: "Picking Details",
//       minWidth: 2100,
//       selectionKey: "serial_no",
//       sql: ({ jobNo, prinCode }) => `SELECT * FROM VW_WM_OUB_TO_PICK WHERE JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' ORDER BY ORDER_NO, SERIAL_NO`,
//       columns: pickingColumns(),
//     },
//     cancel_picking: {
//       title: "Cancel Picking",
//       minWidth: 2100,
//       selectionKey: "key_number",
//       sql: ({ jobNo, prinCode }) => `SELECT * FROM VW_WM_OUB_PICK_TO_CONFIRM WHERE CONFIRMED = 'N' AND JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' ORDER BY ORDER_NO, KEY_NUMBER`,
//       columns: confirmPickColumns(),
//     },
//     job_confirmation: {
//       title: "Job Confirmation",
//       minWidth: 2100,
//       selectionKey: "key_number",
//       sql: ({ companyCode, jobNo, prinCode }) =>
//         `SELECT * FROM VW_WM_OUB_PICK_TO_CONFIRM WHERE JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' AND COMPANY_CODE = '${sqlEscape(companyCode)}' AND SELECTED = 'N' AND CONFIRMED = 'N' AND CONFIRM_DATE IS NULL ORDER BY ORDER_NO, KEY_NUMBER`,
//       columns: confirmPickColumns(),
//     },
//     activity_billing: {
//       title: "Activity Billing",
//       minWidth: 1180,
//       sql: ({ jobNo, prinCode }) => `
//         SELECT
//           tid.PRIN_CODE,
//           tid.JOB_NO,
//           tid.ACT_CODE,
//           tid.ACT_CODE || '-' || ma.ACTIVITY AS ACTIVITY,
//           tid.QUANTITY,
//           tid.BILL_RATE,
//           tid.BILL,
//           tid.COST_RATE,
//           tid.COST,
//           tid.OTHER_SERVICES
//         FROM TN_INVOICE_DET tid
//         JOIN MS_ACTIVITY ma
//           ON tid.ACT_CODE = ma.ACTIVITY_CODE
//         WHERE tid.PRIN_CODE = ${Number(prinCode) || 0}
//           AND tid.JOB_NO = '${sqlEscape(jobNo)}'
//       `,
//       columns: [
//         { key: "act_code", label: "Activity Code", size: 150 },
//         { key: "activity", label: "Activity", size: 280 },
//         { key: "quantity", label: "Quantity", size: 120 },
//         { key: "bill_rate", label: "Bill Rate", size: 120 },
//         { key: "bill", label: "Bill", size: 120 },
//         { key: "cost_rate", label: "Cost Rate", size: 120 },
//         { key: "cost", label: "Cost", size: 120 },
//         { key: "other_services", label: "Other Services", size: 200 },
//       ],
//     },
//   };
//   return configs[tab];
// }

// function orderDetailColumns() {
//   return [
//     { key: "order_no", label: "Order No", size: 150 },
//     { key: "cust_name", label: "Customer", size: 220 },
//     { key: "prod_name", label: "Product", size: 340 },
//     { key: "site_code", label: "Site Code", size: 110 },
//     { key: "loc_code_from", label: "Location From", size: 150 },
//     { key: "loc_code_to", label: "Location To", size: 150 },
//     { key: "quantity", label: "Quantity", size: 120 },
//     { key: "batch_no", label: "Batch No", size: 140 },
//     { key: "lot_no", label: "Lot No", size: 140 },
//     { key: "production_from", label: "Production From", size: 150 },
//     { key: "production_to", label: "Production To", size: 150 },
//     { key: "expiry_from", label: "Expiry From", size: 140 },
//     { key: "expiry_to", label: "Expiry To", size: 140 },
//     { key: "act_order_qty", label: "Actual Qty", size: 130 },
//   ];
// }

// function pickingColumns() {
//   return [
//     { key: "order_no", label: "Order No", size: 150 },
//     { key: "cust_name", label: "Customer", size: 220 },
//     { key: "prod_name", label: "Product", size: 340 },
//     { key: "site_code", label: "Site", size: 100 },
//     { key: "lot_no", label: "Lot No", size: 140 },
//     { key: "loc_code_from", label: "Location From", size: 150 },
//     { key: "loc_code_to", label: "Location To", size: 150 },
//     { key: "quantity", label: "Quantity", size: 120 },
//     { key: "production_from", label: "Production From", size: 150 },
//     { key: "production_to", label: "Production To", size: 150 },
//     { key: "expiry_from", label: "Expiry From", size: 140 },
//     { key: "expiry_to", label: "Expiry To", size: 140 },
//     { key: "act_order_qty", label: "Actual Qty", size: 130 },
//   ];
// }

// function confirmPickColumns() {
//   return [
//     { key: "order_no", label: "Order No", size: 150 },
//     { key: "cust_name", label: "Customer", size: 220 },
//     { key: "prod_name", label: "Product", size: 340 },
//     { key: "site_code", label: "Site Code", size: 110 },
//     { key: "location_code", label: "Location From", size: 150 },
//     { key: "loc_code_to", label: "Location To", size: 150 },
//     { key: "quantity", label: "Quantity", size: 120 },
//     { key: "batch_no", label: "Batch No", size: 140 },
//     { key: "lot_no", label: "Lot No", size: 140 },
//   ];
// }

// function pickingIssueColumns() {
//   return [
//     { key: "company_code", label: "Company", size: 110 },
//     { key: "prin_code", label: "Principal", size: 120 },
//     { key: "job_no", label: "Job No", size: 130 },
//     { key: "prod_code", label: "Product Code", size: 160 },
//     { key: "qty_puom", label: "Qty PUOM", size: 130 },
//     { key: "p_uom", label: "P UOM", size: 100 },
//     { key: "qty_luom", label: "Qty LUOM", size: 130 },
//     { key: "quantity", label: "Quantity", size: 130 },
//     { key: "l_uom", label: "L UOM", size: 100 },
//     { key: "expiry_from", label: "Expiry From", size: 140 },
//     { key: "expiry_to", label: "Expiry To", size: 140 },
//     { key: "production_from", label: "Production From", size: 150 },
//     { key: "production_to", label: "Production To", size: 150 },
//     { key: "batch_no", label: "Batch No", size: 130 },
//     { key: "loc_code_from", label: "Loc From", size: 130 },
//     { key: "loc_code_to", label: "Loc To", size: 130 },
//     { key: "pick_qty_status", label: "Pick Qty Status", size: 150 },
//     { key: "check_mfg_exp", label: "Mfg/Exp Check", size: 240 },
//   ];
// }

// function OutboundTabSummary({ tab, rows, selectedCount, loading }: { tab: string; rows: WmsRow[]; selectedCount: number; loading: boolean }) {
//   const totalQty = rows.reduce((sum, row) => sum + Number(value(row, "quantity") || value(row, "act_order_qty") || 0), 0);
//   const titleByTab: Record<string, string> = {
//     order_entry: "Customer orders attached to this outbound job.",
//     order_details: "Product, location, lot and quantity lines for picking.",
//     picking_details: "Select eligible rows, choose picking preference, then pick orders.",
//     cancel_picking: "Selected picked rows can be released back for picking.",
//     job_confirmation: "Confirm picked rows to complete outbound processing.",
//     activity_billing: "Review billing activities generated for the outbound job.",
//   };
//   return (
//     <div className="grid gap-2 rounded-md border bg-card p-2 md:grid-cols-4">
//       <Info label="Rows" value={loading ? "Loading" : String(rows.length)} />
//       <Info label="Selected" value={String(selectedCount)} />
//       <Info label="Quantity" value={Number.isFinite(totalQty) ? totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "0"} />
//       <div className="rounded-md border bg-background px-3 py-2">
//         <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Workflow</span>
//         <strong className="mt-1 block truncate text-sm">{titleByTab[tab] || "Outbound workflow"}</strong>
//       </div>
//     </div>
//   );
// }

// function tabRequiresSelection(tab: string) {
//   return ["picking_details", "cancel_picking", "job_confirmation"].includes(tab);
// }

// function processMessage(prefix: string, error: unknown) {
//   if (!(error instanceof Error) || !error.message) return prefix;
//   const clean = error.message.replace(/\s+/g, " ").trim();
//   return `${prefix} ${clean}`;
// }

// async function executeRawCommonProcedure(parameter: string, payload: Record<string, unknown>) {
//   await executeCommonProcedure({ parameter, ...payload });
// }

// function parseOutboundView(pathname: string) {
//   const parts = pathname.split("/").filter(Boolean);
//   const viewIndex = parts.findIndex((part) => part.toLowerCase() === "view");
//   return {
//     jobNo: viewIndex >= 0 ? parts[viewIndex + 1] : "",
//     tab: viewIndex >= 0 ? parts[viewIndex + 2] : "",
//   };
// }

// function outboundJobDetailPath(row: WmsRow) {
//   const jobNo = encodeURIComponent(value(row, "job_no"));
//   const principalCode = encodeURIComponent(value(row, "prin_code"));
//   return `${outboundJobsPath}/view/${jobNo}/order_entry${principalCode ? `?principal_code=${principalCode}` : ""}`;
// }

// function outboundJobTabPath(jobNo: string, tab: string, job: WmsRow | null) {
//   const encodedJobNo = encodeURIComponent(jobNo);
//   const prin = value(job || {}, "prin_code");
//   return `${outboundJobsPath}/view/${encodedJobNo}/${tab}${prin ? `?principal_code=${encodeURIComponent(prin)}` : ""}`;
// }

// function filterJobByTab(row: WmsRow, tab: string) {
//   const canceled = isCanceled(row);
//   const confirmed = hasDate(value(row, "confirm_date")) || hasDate(value(row, "confirmed_date"));
//   if (tab === "cancel") return canceled || hasDate(value(row, "cancel_date"));
//   if (tab === "confirmed") return confirmed && !canceled;
//   return !confirmed && !canceled;
// }

// function canCancelOutboundJob(row: WmsRow, activeTab: string) {
//   if (activeTab === "cancel") return false;
//   if (activeTab === "confirmed") return true;
//   return Number(value(row, "oub_cnt_cancel") || 0) === 0 && !hasDate(value(row, "confirm_date")) && value(row, "canceled") !== "Y";
// }

// function makeEmptyJob(companyCode?: string) {
//   return {
//     company_code: companyCode || "",
//     job_type: "EXP",
//     job_class: "N",
//     transport_mode: "S",
//     curr_code: "OMR",
//     ex_rate: 1,
//     schedule_date: new Date().toISOString().slice(0, 10),
//   };
// }

// function makeOutboundJobForm(row: WmsRow, companyCode?: string) {
//   const normalized = normalizeRow(row);
//   return {
//     ...makeEmptyJob(companyCode),
//     ...normalized,
//     company_code: value(normalized, "company_code") || companyCode || "",
//     job_no: value(normalized, "job_no"),
//     prin_code: value(normalized, "prin_code"),
//     prin_name: value(normalized, "prin_name"),
//     dept_code: value(normalized, "dept_code"),
//     dept_name: value(normalized, "dept_name"),
//     div_code: value(normalized, "div_code"),
//     div_name: value(normalized, "div_name"),
//     job_class: value(normalized, "job_class") || "N",
//     job_type: value(normalized, "job_type") || "EXP",
//     transport_mode: value(normalized, "transport_mode") || "S",
//     schedule_date: toDateInputValue(value(normalized, "schedule_date") || value(normalized, "job_date")),
//     job_date: toDateInputValue(value(normalized, "job_date") || value(normalized, "schedule_date")),
//   };
// }

// async function enrichOutboundJobFormNames(form: WmsRow, companyCode: string) {
//   const deptCode = value(form, "dept_code");
//   const divCode = value(form, "div_code");
//   if ((!deptCode && !divCode) || (value(form, "dept_name") && value(form, "div_name"))) return form;

//   const rows = await executeWmsInboundSql(`
//     SELECT d.DEPT_NAME, v.DIV_NAME
//     FROM MS_DEPARTMENT d
//     LEFT JOIN MS_HR_DIVISION v
//       ON v.COMPANY_CODE = d.COMPANY_CODE
//      AND v.DIV_CODE = d.DIV_CODE
//     WHERE d.COMPANY_CODE = '${sqlEscape(companyCode)}'
//       ${deptCode ? `AND d.DEPT_CODE = '${sqlEscape(deptCode)}'` : ""}
//       ${divCode ? `AND d.DIV_CODE = '${sqlEscape(divCode)}'` : ""}
//     FETCH FIRST 1 ROWS ONLY
//   `);
//   const names = normalizeRow(rows[0] || {});
//   return {
//     ...form,
//     dept_name: value(form, "dept_name") || value(names, "dept_name"),
//     div_name: value(form, "div_name") || value(names, "div_name"),
//   };
// }

// function buildOutboundJobPayload(form: WmsRow, companyCode: string) {
//   const allowedFields = new Set([
//     "company_code",
//     "job_no",
//     ...jobFields.map((field) => field.name),
//   ]);
//   const payload: WmsRow = {};

//   allowedFields.forEach((field) => {
//     if (field in form) payload[field] = form[field];
//   });

//   payload.company_code = form.company_code || companyCode;
//   payload.job_type = "EXP";
//   payload.job_class = payload.job_class || "N";
//   payload.transport_mode = payload.transport_mode || "S";
//   payload.schedule_date = payload.schedule_date || new Date().toISOString().slice(0, 10);
//   payload.job_date = payload.job_date || payload.schedule_date || new Date().toISOString().slice(0, 10);
//   payload.curr_code = payload.curr_code || "OMR";
//   payload.ex_rate = payload.ex_rate || 1;

//   Object.keys(payload).forEach((key) => {
//     if (payload[key] === undefined) delete payload[key];
//   });

//   return payload;
// }

// function JobClassPill({ code }: { code: string }) {
//   const label = jobClassLabels[code] || code || "N/A";
//   return <span className="inline-flex max-w-[170px] items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{label}</span>;
// }

// function Info({ label, value: infoValue }: { label: string; value: string }) {
//   return (
//     <div className="rounded-md border bg-background px-3 py-2">
//       <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
//       <strong className="mt-1 block truncate text-sm">{infoValue || "-"}</strong>
//     </div>
//   );
// }

// function flagBadge(flag: string) {
//   const yes = flag === "Y" || flag.toLowerCase() === "yes";
//   return <span className={yes ? "text-emerald-700" : "text-muted-foreground"}>{yes ? "Yes" : "No"}</span>;
// }

// function normalizeRow(row: WmsRow) {
//   const normalized: WmsRow = { ...row };
//   Object.entries(row || {}).forEach(([key, rowValue]) => {
//     normalized[key.toLowerCase()] = rowValue;
//   });
//   return normalized;
// }

// function normalizeLookupRows(rows: unknown): LookupRow[] {
//   if (!Array.isArray(rows)) return [];
//   return rows.map((row) => normalizeRow((row || {}) as WmsRow) as LookupRow);
// }

// function value(row: WmsRow, key: string) {
//   return String(row[key] ?? row[key.toUpperCase()] ?? "");
// }

// function lookupText(row: LookupRow | WmsRow, key: string) {
//   return String(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "");
// }

// function formatLookupDisplay(row: WmsRow, keys: string[]) {
//   return keys.map((key) => String(row[key] || "")).filter(Boolean).join(" - ");
// }

// function formatCellValue(row: WmsRow, key: string) {
//   const cell = value(row, key);
//   if (key.includes("date") || key.includes("_from") || key.includes("_to") || key.endsWith("_start") || key.endsWith("_end")) return formatDate(cell);
//   return cell;
// }

// function formatDate(input: string) {
//   if (!input) return "";
//   const date = new Date(input);
//   if (Number.isNaN(date.getTime())) return input;
//   return date.toLocaleDateString("en-GB");
// }

// function toDateInputValue(input: string) {
//   if (!input) return "";
//   if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
//   const date = new Date(input);
//   if (Number.isNaN(date.getTime())) return "";
//   return date.toISOString().slice(0, 10);
// }

// function recalcQuantity(next: WmsRow, setForm: (updater: (current: WmsRow) => WmsRow) => void) {
//   const primary = Number(next.qty_puom || 0);
//   const lowest = Number(next.qty_luom || 0);
//   const uppp = Number(next.uppp || 0);
//   if (!Number.isFinite(primary) || !Number.isFinite(lowest)) return;
//   const quantity = uppp > 0 ? Math.round(primary * uppp + lowest) : primary + lowest;
//   setForm(() => ({ ...next, quantity }));
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

// async function loadOutboundCustomers(companyCode: string, prinCode: string) {
//   const rows = await executeWmsInboundSql(
//     `SELECT * FROM MS_CUSTOMER
//      WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
//        AND PRIN_CODE    = '${sqlEscape(prinCode)}'`
//   );
//   return normalizeLookupRows(rows);
// }
// async function loadCurrencies() {
//   const response = await getWmsMaster("currency", { page: 1, limit: 100000 });
//   return normalizeLookupRows(response.tableData);
// }

// async function loadWmsMasterLookup(master: string) {
//   const heavyLookupLimits: Record<string, number> = {
//     port: 500,
//     principal: 1000,
//   };
//   const response = await getWmsMaster(master, { page: 1, limit: heavyLookupLimits[master] || 100000 });
//   return normalizeLookupRows(response.tableData);
// }

// async function loadOutboundPrincipalLookup(companyCode: string) {
//   const rows = await executeWmsInboundSql(`
//     SELECT
//       p.PRIN_CODE,
//       p.PRIN_NAME,
//       p.PRIN_DEPT_CODE,
//       p.DIV_CODE,
//       p.CURR_CODE,
//       d.DEPT_NAME,
//       v.DIV_NAME
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
//   return normalizeLookupRows(rows);
// }

// async function loadDepartmentLookup(companyCode: string, divCode: string) {
//   const rows = await executeWmsInboundSql(`
//     SELECT d.DEPT_CODE, d.DEPT_NAME, d.DIV_CODE, v.DIV_NAME
//     FROM MS_DEPARTMENT d
//     LEFT JOIN MS_HR_DIVISION v
//       ON v.COMPANY_CODE = d.COMPANY_CODE
//      AND v.DIV_CODE = d.DIV_CODE
//     WHERE d.COMPANY_CODE = '${sqlEscape(companyCode)}'
//       ${divCode ? `AND d.DIV_CODE = '${sqlEscape(divCode)}'` : ""}
//     ORDER BY d.DEPT_CODE
//   `);
//   return normalizeLookupRows(rows);
// }

// async function validateDepartmentDivision(companyCode: string, deptCode: string, divCode: string) {
//   if (!deptCode || !divCode) return true;
//   const rows = await executeWmsInboundSql(`
//     SELECT DEPT_CODE
//     FROM MS_DEPARTMENT
//     WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
//       AND DEPT_CODE = '${sqlEscape(deptCode)}'
//       AND DIV_CODE = '${sqlEscape(divCode)}'
//       FETCH FIRST 1 ROWS ONLY
//   `);
//   return rows.length > 0;
// }

// async function loadPortLookup() {
//   const response = await getWmsMaster("port", { page: 1, limit: 500 });
//   return normalizeLookupRows(response.tableData);
// }

// async function loadOrderEntryOptions(companyCode: string, prinCode: string, jobNo: string) {
//   const rows = await executeWmsInboundSql(`SELECT * FROM TO_ORDER WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' AND JOB_NO = '${sqlEscape(jobNo)}' ORDER BY ORDER_NO`);
//   return normalizeLookupRows(rows);
// }

// async function loadOutboundProducts(companyCode: string, prinCode: string) {
//   const rows = await getWmsInbound<LookupRow[]>("getddPrinceProduct", { company_code: companyCode, prin_code: prinCode });
//   return normalizeLookupRows(rows);
// }

// async function loadStockSites(companyCode: string, prinCode: string, prodCode: string) {
//   const rows = await executeWmsInboundSql(`
//     SELECT DISTINCT TT_STKLED.SITE_CODE
//     FROM TT_STKLED
//     WHERE TT_STKLED.COMPANY_CODE = '${sqlEscape(companyCode)}'
//       AND TT_STKLED.PRIN_CODE = '${sqlEscape(prinCode)}'
//       AND TT_STKLED.PROD_CODE = '${sqlEscape(prodCode)}'
//       AND NVL(TT_STKLED.FREEZE_FLAG,'N') = 'N'
//       AND TT_STKLED.QTY_AVL > 0
//       AND SITE_CODE IN (
//         SELECT SITE_CODE FROM MS_SITE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND PICKING_OUT = 'Y'
//       )
//     ORDER BY TT_STKLED.SITE_CODE
//   `);
//   return normalizeLookupRows(rows);
// }

// async function loadStockLocations(companyCode: string, prinCode: string, prodCode: string, siteCode: string) {
//   const rows = await executeWmsInboundSql(`
//     SELECT DISTINCT TT_STKLED.LOCATION_CODE
//     FROM TT_STKLED
//     WHERE TT_STKLED.COMPANY_CODE = '${sqlEscape(companyCode)}'
//       AND TT_STKLED.PRIN_CODE = '${sqlEscape(prinCode)}'
//       AND TT_STKLED.PROD_CODE = '${sqlEscape(prodCode)}'
//       AND NVL(TT_STKLED.FREEZE_FLAG,'N') = 'N'
//       AND NVL(TT_STKLED.SITE_CODE,'') = '${sqlEscape(siteCode)}'
//       AND TT_STKLED.QTY_AVL > 0
//     ORDER BY TT_STKLED.LOCATION_CODE
//   `);
//   return normalizeLookupRows(rows);
// }

// async function loadStockBatches(companyCode: string, prodCode: string, siteCode: string) {
//   const rows = await executeWmsInboundSql(`
//     SELECT DISTINCT BATCH_NO
//     FROM TT_STKLED
//     WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
//       AND PROD_CODE = '${sqlEscape(prodCode)}'
//       AND SITE_CODE = '${sqlEscape(siteCode)}'
//       AND QTY_AVL > 0
//       AND BATCH_NO IS NOT NULL
//     ORDER BY BATCH_NO
//   `);
//   return normalizeLookupRows(rows);
// }

// async function loadStockLots(companyCode: string, prodCode: string, siteCode: string) {
//   const rows = await executeWmsInboundSql(`
//     SELECT DISTINCT LOT_NO
//     FROM TT_STKLED
//     WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
//       AND PROD_CODE = '${sqlEscape(prodCode)}'
//       AND SITE_CODE = '${sqlEscape(siteCode)}'
//       AND LOT_NO IS NOT NULL
//     ORDER BY LOT_NO
//   `);
//   return normalizeLookupRows(rows);
// }

// async function loadOutboundAvailableQuantity({
//   companyCode,
//   prinCode,
//   prodCode,
//   siteCode,
//   locationFrom,
//   locationTo,
//   batchNo,
//   lotNo,
//   productionFrom,
//   productionTo,
//   expiryFrom,
//   expiryTo,
// }: {
//   companyCode: string;
//   prinCode: string;
//   prodCode: string;
//   siteCode: string;
//   locationFrom: string;
//   locationTo: string;
//   batchNo: string;
//   lotNo: string;
//   productionFrom: string;
//   productionTo: string;
//   expiryFrom: string;
//   expiryTo: string;
// }) {
//   const response = await postWmsOutbound("getTotalAvailableQty", {
//     company_code: companyCode,
//     prin_code: prinCode,
//     prod_code: prodCode,
//     site_code: siteCode,
//     location_from: locationFrom,
//     location_to: locationTo,
//     batch: batchNo,
//     lot_no: lotNo,
//     mfg_date_from: productionFrom,
//     mfg_date_to: productionTo,
//     exp_date_from: expiryFrom,
//     exp_date_to: expiryTo,
//   }) as unknown as { TOT_AVL_QTY?: number | string; data?: { TOT_AVL_QTY?: number | string } };

//   return Number(response.TOT_AVL_QTY ?? response.data?.TOT_AVL_QTY ?? 0);
// }

// function locationSearchPrincipal(job: WmsRow | null) {
//   const prin = value(job || {}, "prin_code"); 
//   return prin ? `?principal_code=${encodeURIComponent(prin)}` : "";
// }

// function transportModeLabel(mode: string) {
//   const labels: Record<string, string> = { S: "Sea", A: "Air", R: "Road", C: "Courier" };
//   return labels[mode] || mode || "Sea";
// }
