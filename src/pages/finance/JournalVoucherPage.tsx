// import type { ColumnDef } from "@tanstack/react-table";
// import { Edit2, Paperclip, Plus, RefreshCw, Save, X } from "lucide-react";
// import { FormEvent, useEffect, useMemo, useState } from "react";
// import { api } from "../../api/client";
// import { getLookupValue, LookupRow } from "../../api/lookups";
// import { Division, getDivisions, getDocAccounts, getFyPeriods, getTransactionDetail, getTransactionDocuments, getTransactionHeader, TransactionDocumentRow, upsertBulkAccountEntryApi } from "../../api/transactions";
// import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
// import { Button } from "../../components/ui/Button";
// import { CardContent, CardHeader } from "../../components/ui/Card";
// import { DataTable } from "../../components/ui/DataTable";
// import { Dialog } from "../../components/ui/Dialog";
// import { Input } from "../../components/ui/Input";
// import { LookupField } from "../../components/ui/LookupField";
// import { Select } from "../../components/ui/Select";
// import { useAuth } from "../../state/AuthContext";

// type JvLine = {
//   id: string;
//   serial_no: number;
//   ac_code: string;
//   ac_name?: string;
//   remarks?: string;
//   amount: number;
//   sign_ind: 1 | -1;
//   job_no?: string;
//   dept_code?: string;
// };

// type JvForm = {
//   doc_no?: string;
//   doc_type: "JV";
//   doc_date: string;
//   div_code: string;
//   div_name?: string;
//   curr_code: string;
//   curr_name?: string;
//   ex_rate: number;
//   remarks?: string;
//   detail: JvLine[];
// };

// const today = () => new Date().toISOString().slice(0, 10);
// const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

// export function JournalVoucherPage() {
//   const [rows, setRows] = useState<TransactionDocumentRow[]>([]);
//   const [fyPeriods, setFyPeriods] = useState<{ fy_period: string }[]>([]);
//   const [divisions, setDivisions] = useState<Division[]>([]);
//   const [fyPeriod, setFyPeriod] = useState("");
//   const [query, setQuery] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [pageIndex, setPageIndex] = useState(0);
//   const [pageSize, setPageSize] = useState(100);
//   const [totalRows, setTotalRows] = useState(0);
//   const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
//   const [editor, setEditor] = useState<{ mode: "create"; div?: Division } | { mode: "edit"; row: TransactionDocumentRow } | null>(null);
//   const [divisionPicker, setDivisionPicker] = useState(false);

//   const loadLookups = async () => {
//     const [fyData, divisionData] = await Promise.all([getFyPeriods(), getDivisions()]);
//     setFyPeriods(fyData);
//     setDivisions(divisionData);
//     setFyPeriod((current) => current || fyData[0]?.fy_period || "");
//   };

//   const loadRows = async () => {
//     if (!fyPeriod) return;
//     setLoading(true);
//     try {
//       const response = await getTransactionDocuments("JV", fyPeriod, query, pageIndex + 1, pageSize);
//       setRows(response.tableData);
//       setTotalRows(response.count || response.tableData.length);
//     } catch (error) {
//       setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vouchers" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { void loadLookups(); }, []);
//   useEffect(() => { void loadRows(); }, [fyPeriod, query, pageIndex, pageSize]);

//   const columns = useMemo<ColumnDef<TransactionDocumentRow>[]>(() => [
//     {
//       accessorKey: "doc_no",
//       header: "Doc No",
//       cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span>,
//     },
//     {
//       accessorKey: "doc_date",
//       header: "Date",
//       cell: ({ getValue }) => dateInput(getValue()),
//     },
//     { accessorKey: "remarks", header: "Description" },
//     { accessorKey: "div_code", header: "Div" },
//     { accessorKey: "amount", header: "Amount" },
//     {
//       id: "actions",
//       header: "Actions",
//       cell: ({ row }) => (
//         <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}>
//           <Edit2 size={15} />
//         </Button>
//       ),
//     },
//   ], []);

//   return (
//     <section className="grid gap-4">
//       <div className="flex flex-wrap items-center justify-between gap-4">
//         <div>
//           <p className="eyebrow">Finance Transaction</p>
//           <h1 className="m-0 text-2xl font-semibold tracking-tight">Journal Voucher</h1>
//           <p className="m-0 mt-1 text-sm text-muted-foreground">General ledger voucher entry</p>
//         </div>
//         <div className="flex flex-wrap items-center justify-end gap-2">
//           <Select className="w-44" value={fyPeriod} onChange={(event) => setFyPeriod(event.target.value)}>
//             {fyPeriods.map((period) => (
//               <option key={period.fy_period} value={period.fy_period}>{period.fy_period}</option>
//             ))}
//           </Select>
//           <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
//           <Button onClick={() => setDivisionPicker(true)}><Plus size={15} /> Add Voucher</Button>
//         </div>
//       </div>

//       {notice && <div className={`alert ${notice.type}`}>{notice.message}</div>}

//       <div className="min-h-[650px]">
//         <DataTable
//           columns={columns}
//           data={rows}
//           title={loading ? "Loading" : `${totalRows.toLocaleString()} Vouchers`}
//           subtitle="JV"
//           searchValue={query}
//           onSearchChange={(value) => {
//             setQuery(value);
//             setPageIndex(0);
//           }}
//           loading={loading}
//           height={620}
//           minWidth={920}
//           density="grid"
//           enablePagination
//           manualPagination
//           manualFiltering
//           pageIndex={pageIndex}
//           pageSize={pageSize}
//           totalRows={totalRows}
//           onPageChange={setPageIndex}
//           onPageSizeChange={(nextPageSize) => {
//             setPageSize(nextPageSize);
//             setPageIndex(0);
//           }}
//         />
//       </div>

//       {editor && (
//         <div className="fixed inset-0 z-50 bg-background">
//           <JvEditor
//             editor={editor}
//             onClose={() => setEditor(null)}
//             onSaved={async (message) => {
//               setEditor(null);
//               setNotice({ type: "success", message });
//               await loadRows();
//             }}
//           />
//         </div>
//       )}

//       <Dialog
//         open={divisionPicker}
//         title="Select Division"
//         description="Choose the division before opening the voucher form."
//         onClose={() => setDivisionPicker(false)}
//         footer={<Button variant="outline" onClick={() => setDivisionPicker(false)}>Cancel</Button>}
//       >
//         <div className="grid max-h-[420px] gap-2 overflow-auto">
//           {divisions.map((division) => (
//             <button
//               key={division.div_code}
//               className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
//               onClick={() => {
//                 setDivisionPicker(false);
//                 setEditor({ mode: "create", div: division });
//               }}
//               type="button"
//             >
//               <span className="font-medium">{division.div_name}</span>
//               <span className="text-muted-foreground">{division.div_code}</span>
//             </button>
//           ))}
//         </div>
//       </Dialog>
//     </section>
//   );
// }

// function JvEditor({
//   editor,
//   onClose,
//   onSaved,
// }: {
//   editor: { mode: "create"; div?: Division } | { mode: "edit"; row: TransactionDocumentRow };
//   onClose: () => void;
//   onSaved: (message: string) => Promise<void>;
// }) {
//   const { user } = useAuth();
//   const editMode = editor.mode === "edit";
//   const [form, setForm] = useState<JvForm>(() => ({
//     doc_type: "JV",
//     doc_date: today(),
//     div_code: editor.mode === "create" ? editor.div?.div_code || "" : "",
//     div_name: editor.mode === "create" ? editor.div?.div_name || "" : "",
//     curr_code: "",
//     ex_rate: 1,
//     detail: [],
//   }));
//   const [loading, setLoading] = useState(editMode);
//   const [saving, setSaving] = useState(false);
//   const [attachmentOpen, setAttachmentOpen] = useState(false);
//   const [error, setError] = useState("");
//   const debitTotal = form.detail.reduce((sum, line) => sum + (line.sign_ind === -1 ? Number(line.amount || 0) : 0), 0);
//   const creditTotal = form.detail.reduce((sum, line) => sum + (line.sign_ind === 1 ? Number(line.amount || 0) : 0), 0);

//   useEffect(() => {
//     if (!editMode || editor.mode !== "edit") return;
//     const editRow = editor.row;
//     let mounted = true;
//     async function load() {
//       try {
//         const [header, detail] = await Promise.all([
//           getTransactionHeader(editRow.doc_no, "JV"),
//           getTransactionDetail(editRow.doc_no, editRow.div_code, "JV"),
//         ]);
//         if (mounted) setForm(mapJv(header, detail));
//       } catch (loadError) {
//         setError(loadError instanceof Error ? loadError.message : "Unable to load voucher");
//       } finally {
//         if (mounted) setLoading(false);
//       }
//     }
//     void load();
//     return () => { mounted = false; };
//   }, [editMode, editor]);

//   const updateLine = (id: string, patch: Partial<JvLine>) =>
//     setForm((current) => ({
//       ...current,
//       detail: current.detail.map((line) => line.id === id ? { ...line, ...patch } : line),
//     }));

//   const addLine = () =>
//     setForm((current) => ({
//       ...current,
//       detail: [
//         ...current.detail,
//         {
//           id: newId(),
//           serial_no: current.detail.length + 1,
//           ac_code: "",
//           amount: 0,
//           sign_ind: current.detail.length % 2 === 0 ? 1 : -1,
//         },
//       ],
//     }));

//   const removeLine = (id: string) =>
//     setForm((current) => ({
//       ...current,
//       detail: current.detail
//         .filter((line) => line.id !== id)
//         .map((line, index) => ({ ...line, serial_no: index + 1 })),
//     }));

//   const total = form.detail.reduce((sum, line) => sum + Number(line.amount || 0) * line.sign_ind, 0);

//   const submit = async (event: FormEvent) => {
//     event.preventDefault();
//     setSaving(true);
//     setError("");
//     try {
//       const payload = {
//         header: {
//           ...form,
//           company_code: user?.company_code,
//           create_user: user?.loginid,
//           edit_user: user?.loginid,
//         },
//         details: form.detail.map((line) => ({
//           ...line,
//           company_code: user?.company_code,
//           doc_type: "JV",
//           doc_no: form.doc_no || "",
//           doc_date: form.doc_date,
//           curr_code: form.curr_code,
//           ex_rate: form.ex_rate,
//           div_code: form.div_code,
//           lcur_amount: Number(line.amount || 0) * Number(form.ex_rate || 1) * Number(line.sign_ind || 1),
//         })),
//         invoiceDetails: [],
//         expenseDetails: [],
//         jobDetails: [],
//         loginid: user?.loginid || "",
//       };
//       await upsertBulkAccountEntryApi(payload);
//       await onSaved("Voucher saved successfully");
//     } catch (submitError) {
//       setError(submitError instanceof Error ? submitError.message : "Unable to save voucher");
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <form className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]" onSubmit={submit}>
//       <CardHeader className="border-b bg-primary px-5 py-2.5 text-primary-foreground shadow-sm">
//         <div className="flex min-h-12 items-center justify-between gap-4">
//           <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
//             <div>
//               <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
//                 {editMode ? "Edit Voucher" : "New Voucher"}
//               </p>
//               <h2 className="m-0 text-lg font-semibold leading-tight text-primary-foreground">Journal Voucher</h2>
//             </div>
//             <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1">
//               <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
//               <strong className="block text-sm leading-tight text-primary-foreground">{form.doc_no || "New"}</strong>
//             </div>
//             <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1">
//               <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Balance</span>
//               <strong className={`block text-sm leading-tight ${Math.abs(total) > 0.001 ? "text-red-300" : "text-green-300"}`}>
//                 {formatAmount(total)}
//               </strong>
//             </div>
//           </div>
//           <div className="flex items-center gap-2">
//             <Button type="button" variant="secondary" onClick={() => setAttachmentOpen(true)}>
//               <Paperclip size={15} /> Files
//             </Button>
//             <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={onClose}>
//               <X size={16} />
//             </Button>
//           </div>
//         </div>
//       </CardHeader>

//       <CardContent className="min-h-0 overflow-auto p-4">
//         {loading ? (
//           <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading voucher...</div>
//         ) : (
//           <div className="grid gap-4">
//             {error && <div className="alert error">{error}</div>}

//             <div className="grid grid-cols-3 gap-3 rounded-md border bg-card p-3 max-xl:grid-cols-2 max-md:grid-cols-1">
//               {editMode && (
//                 <Field label="Doc No">
//                   <Input disabled value={form.doc_no || ""} />
//                 </Field>
//               )}
//               <Field label="Date">
//                 <Input
//                   type="date"
//                   value={dateInput(form.doc_date)}
//                   onChange={(e) => setForm((c) => ({ ...c, doc_date: e.target.value }))}
//                 />
//               </Field>
//               <Field label="Division">
//                 <Input disabled value={`${form.div_code}${form.div_name ? ` - ${form.div_name}` : ""}`} />
//               </Field>
//               <LookupField
//                 label="Currency"
//                 value={form.curr_code}
//                 displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
//                 columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
//                 valueField="curr_code"
//                 displayFields={["curr_code", "curr_name"]}
//                 loadOptions={getCurrencyRows}
//                 onChange={(value, row) =>
//                   setForm((c) => ({
//                     ...c,
//                     curr_code: value,
//                     curr_name: text(getLookupValue(row || {}, "curr_name")),
//                   }))
//                 }
//               />
//               <Field label="Exchange Rate">
//                 <Input
//                   type="number"
//                   value={form.ex_rate}
//                   onChange={(e) => setForm((c) => ({ ...c, ex_rate: Number(e.target.value || 1) }))}
//                 />
//               </Field>
//               <label className="field col-span-2 max-md:col-span-1">
//                 <span>Remarks</span>
//                 <Input
//                   value={form.remarks || ""}
//                   onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))}
//                 />
//               </label>
//             </div>

//             <div className="rounded-md border bg-card">
//               <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-2">
//                 <div>
//                   <p className="eyebrow">Details</p>
//                   <h3 className="m-0 text-sm font-semibold">Debit / Credit Lines</h3>
//                 </div>
//                 <Button size="sm" type="button" variant="outline" onClick={addLine}>
//                   <Plus size={14} /> Add Line
//                 </Button>
//               </div>
//               <div className="max-h-[calc(100vh-480px)] overflow-auto">
//                 <table className="w-full min-w-[820px] text-sm">
//                   <thead className="sticky top-0 bg-primary text-xs text-primary-foreground">
//                     <tr>
//                       <th className="px-2 py-2 text-left">No</th>
//                       <th className="px-2 py-2 text-left">Account</th>
//                       <th className="px-2 py-2 text-left">Remarks</th>
//                       <th className="px-2 py-2 text-left">Amount</th>
//                       <th className="px-2 py-2 text-left">Type</th>
//                       <th className="px-2 py-2 text-left">Action</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {form.detail.length === 0 ? (
//                       <tr>
//                         <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>No voucher lines</td>
//                       </tr>
//                     ) : (
//                       form.detail.map((line) => (
//                         <tr className="border-t odd:bg-muted/20" key={line.id}>
//                           <td className="px-2 py-1 text-xs">{line.serial_no}</td>
//                           <td className="w-[280px] px-2 py-1">
//                             <LookupField
//                               label="Account"
//                               compact
//                               value={line.ac_code}
//                               displayValue={line.ac_name ? `${line.ac_code} - ${line.ac_name}` : line.ac_code}
//                               columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }]}
//                               valueField="ac_code"
//                               displayFields={["ac_code", "ac_name"]}
//                               loadOptions={() => getDocAccounts("JV", "D", form.div_code)}
//                               onChange={(value, row) =>
//                                 updateLine(line.id, {
//                                   ac_code: value,
//                                   ac_name: text(getLookupValue(row || {}, "ac_name")),
//                                 })
//                               }
//                             />
//                           </td>
//                           <td className="px-2 py-1">
//                             <Input
//                               value={line.remarks || ""}
//                               onChange={(e) => updateLine(line.id, { remarks: e.target.value })}
//                             />
//                           </td>
//                           <td className="w-32 px-2 py-1">
//                             <Input
//                               type="number"
//                               value={line.amount}
//                               onChange={(e) => updateLine(line.id, { amount: Number(e.target.value || 0) })}
//                             />
//                           </td>
//                           <td className="w-28 px-2 py-1">
//                             <Select
//                               value={line.sign_ind}
//                               onChange={(e) => updateLine(line.id, { sign_ind: Number(e.target.value) as 1 | -1 })}
//                             >
//                               <option value={1}>Credit</option>
//                               <option value={-1}>Debit</option>
//                             </Select>
//                           </td>
//                           <td className="px-2 py-1">
//                             <Button size="icon" type="button" variant="ghost" onClick={() => removeLine(line.id)}>
//                               <X size={14} />
//                             </Button>
//                           </td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//               <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
//                 <span className="text-muted-foreground">Balance</span>
//                 <strong className={Math.abs(total) > 0.001 ? "text-destructive" : "text-emerald-600"}>
//                   {formatAmount(total)}
//                 </strong>
//               </div>
//             </div>
//           </div>
//         )}
//       </CardContent>

//       <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
//         <div className="text-sm text-muted-foreground">
//           Balance{" "}
//           <strong className={Math.abs(total) > 0.001 ? "text-destructive" : "text-emerald-600"}>
//             {formatAmount(total)}
//           </strong>
//         </div>
//         <div className="flex items-center gap-2">
//           <Button disabled={saving} type="button" variant="outline" onClick={onClose}>Close</Button>
//           <Button disabled={saving || loading || form.detail.length < 2 || debitTotal !== creditTotal} type="submit">
//             <Save size={15} /> {saving ? "Saving..." : "Save"}
//           </Button>
//         </div>
//       </div>

//       <AttachmentDialog
//         open={attachmentOpen}
//         onClose={() => setAttachmentOpen(false)}
//         requestNumber={form.doc_no || ""}
//         title="Journal Voucher Attachments"
//         module="JV"
//         type="Journal Voucher"
//         companyCode={user?.company_code || ""}
//         loginId={user?.loginid || user?.username || ""}
//         flowLevel={2}
//       />
//     </form>
//   );
// }

// function Field({ label, children }: { label: string; children: React.ReactNode }) {
//   return (
//     <label className="field">
//       <span>{label}</span>
//       {children}
//     </label>
//   );
// }

// function mapJv(headerRaw: Record<string, unknown>, detailRaw: Record<string, unknown>[]): JvForm {
//   const h = lower(headerRaw);
//   return {
//     doc_no: text(h.doc_no),
//     doc_type: "JV",
//     doc_date: dateInput(h.doc_date),
//     div_code: text(h.div_code),
//     div_name: text(nested(headerRaw, ["Division", "div_name"]) ?? h.div_name),
//     curr_code: text(h.curr_code),
//     curr_name: text(nested(headerRaw, ["Currency", "curr_name"]) ?? h.curr_name),
//     ex_rate: Number(h.ex_rate || 1),
//     remarks: text(h.remarks),
//     detail: detailRaw.map((raw, index) => {
//       const r = lower(raw);
//       return {
//         id: newId(),
//         serial_no: Number(r.serial_no || index + 1),
//         ac_code: text(r.ac_code),
//         ac_name: text(nested(raw, ["Account", "ac_name"]) ?? r.ac_name),
//         remarks: text(r.remarks),
//         amount: Math.abs(Number(r.amount || 0)),
//         sign_ind: Number(r.sign_ind || 1) as 1 | -1,
//         job_no: text(r.job_no),
//         dept_code: text(r.dept_code),
//       };
//     }),
//   };
// }

// async function getCurrencyRows(): Promise<LookupRow[]> {
//   const response = await api.get("/api/wms/currency", { params: { page: 1, limit: 1000 } });
//   if (!response.data.success) throw new Error(response.data.message || "Unable to load currencies");
//   return response.data.data?.tableData || response.data.data || [];
// }

// function lower(raw: Record<string, unknown>) {
//   return Object.fromEntries(Object.entries(raw || {}).map(([key, value]) => [key.toLowerCase(), value]));
// }

// function nested(source: Record<string, unknown>, path: string[]) {
//   return path.reduce<unknown>(
//     (current, key) => (!current || typeof current !== "object" ? undefined : (current as Record<string, unknown>)[key]),
//     source,
//   );
// }

// function text(value: unknown) {
//   return value === null || value === undefined ? "" : String(value);
// }

// function dateInput(value: unknown) {
//   if (!value) return "";
//   const date = new Date(String(value));
//   return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
// }

// function formatAmount(value: number) {
//   const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
//   return value < 0 ? `(${amount})` : amount;
// }