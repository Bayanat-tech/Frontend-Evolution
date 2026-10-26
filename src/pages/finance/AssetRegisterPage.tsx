// import type { ColumnDef } from "@tanstack/react-table";
// import { Edit2, Eye, Plus, Trash2, Boxes } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
// import { Button } from "../../components/ui/Button";
// import { DataTable } from "../../components/ui/DataTable";
// import { Dialog } from "../../components/ui/Dialog";
// import { DivisionPickerDialog } from "../../components/ui/DivisionPickerDialog";
// import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
// import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
// import { exportToCsv } from "../../components/ui/ExportCSVButton";
// import { useAuth } from "../../state/AuthContext";
// import { AddAssetRegisterForm } from "./AddAssetRegisterForm";

// // ===================== TYPES =====================
// export type TAssetRow = {
//   company_code: string;
//   asset_id: string;
//   asset_name: string;
//   site_code: string;
//   site_name: string;
//   div_code: string;
//   div_name: string;
//   asset_group_code: string;
//   asset_group_name: string;
//   asset_subgroup_code: string;
//   asset_subgroup_name: string;
//   asset_brand_code: string;
//   asset_brand_name: string;
//   asset_ac_code: string;
//   dprc_ac_code: string;
//   accudprc_ac_code: string;
//   dprc_percentage: string;
//   dprc_commence_date: string;
//   doc_type: string;
//   doc_no: string;
//   asset_properties: string;
//   purchase_date: string;
//   quantity: string;
//   price: string;
//   amount: string;
//   supplier_name: string;
//   supplier_ac_code: string;
//   supp_code: string;
//   status: string;
// };

// type TDivisionOption = {
//   div_code: string;
//   div_name: string;
// };

// type PopupState =
//   | { open: false }
//   | { open: true; mode: "create"; div_code: string; div_name: string; asset_id?: undefined }
//   | { open: true; mode: "edit"; div_code: string; div_name: string; asset_id: string }
//   | { open: true; mode: "view"; div_code: string; div_name: string; asset_id: string };

// // ===================== MAP =====================
// function num(value: unknown) {
//   const parsed = Number(value || 0);
//   return Number.isFinite(parsed) ? parsed : 0;
// }
// function money(value: unknown) {
//   return num(value).toFixed(3);
// }
// function dateInput(value: unknown) {
//   if (!value) return "";
//   const date = new Date(String(value));
//   if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
//   return date.toISOString().slice(0, 10);
// }

// const EMPTY_ASSET: TAssetRow = {
//   company_code: "", asset_id: "", asset_name: "", site_code: "", site_name: "",
//   div_code: "", div_name: "", asset_group_code: "", asset_group_name: "",
//   asset_subgroup_code: "", asset_subgroup_name: "", asset_brand_code: "", asset_brand_name: "",
//   asset_ac_code: "", dprc_ac_code: "", accudprc_ac_code: "", dprc_percentage: "0.000",
//   dprc_commence_date: "", doc_type: "", doc_no: "", asset_properties: "", purchase_date: "",
//   quantity: "1.000", price: "0.000", amount: "0.000", supplier_name: "",
//   supplier_ac_code: "", supp_code: "", status: "Y",
// };

// function mapAsset(row: LookupRow): TAssetRow {
//   return {
//     ...EMPTY_ASSET,
//     company_code: String(getLookupValue(row, "company_code") || ""),
//     asset_id: String(getLookupValue(row, "asset_id") || ""),
//     asset_name: String(getLookupValue(row, "asset_name") || ""),
//     site_code: String(getLookupValue(row, "site_code") || ""),
//     site_name: String(getLookupValue(row, "site_name") || ""),
//     div_code: String(getLookupValue(row, "div_code") || ""),
//     div_name: String(getLookupValue(row, "div_name") || ""),
//     asset_group_code: String(getLookupValue(row, "asset_group_code") || ""),
//     asset_group_name: String(getLookupValue(row, "asset_group_name") || ""),
//     asset_subgroup_code: String(getLookupValue(row, "asset_subgroup_code") || ""),
//     asset_subgroup_name: String(getLookupValue(row, "asset_subgroup_name") || ""),
//     asset_brand_code: String(getLookupValue(row, "asset_brand_code") || ""),
//     asset_brand_name: String(getLookupValue(row, "asset_brand_name") || ""),
//     asset_ac_code: String(getLookupValue(row, "asset_ac_code") || ""),
//     dprc_ac_code: String(getLookupValue(row, "dprc_ac_code") || ""),
//     accudprc_ac_code: String(getLookupValue(row, "accudprc_ac_code") || ""),
//     dprc_percentage: money(getLookupValue(row, "dprc_percentage")),
//     dprc_commence_date: dateInput(getLookupValue(row, "dprc_commence_date")),
//     doc_type: String(getLookupValue(row, "doc_type") || ""),
//     doc_no: String(getLookupValue(row, "doc_no") || ""),
//     asset_properties: String(getLookupValue(row, "asset_properties") || ""),
//     purchase_date: dateInput(getLookupValue(row, "purchase_date")),
//     quantity: money(getLookupValue(row, "quantity") || 1),
//     price: money(getLookupValue(row, "price")),
//     amount: money(getLookupValue(row, "amount")),
//     supplier_name: String(getLookupValue(row, "supplier_name") || ""),
//     supplier_ac_code: String(getLookupValue(row, "supplier_ac_code") || ""),
//     supp_code: String(getLookupValue(row, "supp_code") || ""),
//     status: String(getLookupValue(row, "status") || "Y"),
//   };
// }

// // ===================== MAIN PAGE =====================
// export function AssetRegisterPage() {
//   const { user } = useAuth();
//   const companyCode = user?.company_code || "";
//   const loginId = user?.loginid || "";

//   const [rows, setRows] = useState<TAssetRow[]>([]);
//   const [query, setQuery] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

//   // Division popup
//   const [divisionOpen, setDivisionOpen] = useState(false);
//   const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
//   const [loadingDivisions, setLoadingDivisions] = useState(false);

//   // Form popup
//   const [popup, setPopup] = useState<PopupState>({ open: false });

//   // Delete confirm
//   const [deleteTarget, setDeleteTarget] = useState<TAssetRow | null>(null);

//   // ===================== LOAD ASSETS =====================
//   const loadRows = async (clearNotice = true) => {
//     setLoading(true);
//     if (clearNotice) setNotice(null);
//     try {
//       const data = await getDynamicLookup({
//         parameter: "AC_ASSETS_register",
//         loginid: loginId,
//         code1: companyCode,
//         code2: "NULL",
//         code3: "NULL",
//         code4: "NULL",
//         number1: 0, number2: 0, number3: 0, number4: 0,
//         date1: null, date2: null, date3: null, date4: null,
//       });
//       setRows(data.map(mapAsset));
//     } catch (error) {
//       setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset register" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { void loadRows(); }, []);

//   // ===================== LOAD DIVISIONS =====================
//   const loadDivisions = async () => {
//     setLoadingDivisions(true);
//     try {
//       const data = await getDynamicLookup({
//         parameter: "Account_division",
//         loginid: loginId,
//         code1: companyCode,
//         code2: "", code3: "", code4: "",
//         number1: 0, number2: 0, number3: 0, number4: 0,
//         date1: null, date2: null, date3: null, date4: null,
//       });
//       setDivisions(
//         data.map((row) => ({
//           div_code: String(getLookupValue(row, "div_code") || ""),
//           div_name: String(getLookupValue(row, "div_name") || ""),
//         }))
//       );
//     } catch {
//       // silently fail
//     } finally {
//       setLoadingDivisions(false);
//     }
//   };

//   const handleOpenDivisionPopup = () => {
//     setNotice(null);
//     setDivisionOpen(true);
//     void loadDivisions();
//   };

//   const handleSelectDivision = (div: TDivisionOption) => {
//     setDivisionOpen(false);
//     setPopup({ open: true, mode: "create", div_code: div.div_code, div_name: div.div_name });
//   };

//   // ===================== TABLE FILTER =====================
//   const filteredRows = useMemo(() => {
//     const term = query.trim().toLowerCase();
//     if (!term) return rows;
//     return rows.filter((row) =>
//       Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term))
//     );
//   }, [query, rows]);

//   // ===================== COLUMNS =====================
//   const columns = useMemo<ColumnDef<TAssetRow>[]>(
//     () => [
//       {
//         accessorKey: "asset_id", header: "Asset ID", size: 130,
//         cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span>,
//       },
//       { accessorKey: "asset_name", header: "Asset Name", size: 260 },
//       { accessorKey: "asset_group_code", header: "Group", size: 120 },
//       { accessorKey: "asset_subgroup_code", header: "Subgroup", size: 130 },
//       { accessorKey: "asset_brand_code", header: "Brand", size: 120 },
//       { accessorKey: "asset_ac_code", header: "Asset A/C", size: 150 },
//       { accessorKey: "purchase_date", header: "Purchase", size: 120 },
//       { accessorKey: "quantity", header: "Qty", size: 90 },
//       { accessorKey: "amount", header: "Value", size: 120 },
//       { accessorKey: "status", header: "Status", size: 90 },
//       {
//         id: "actions", header: "Actions", enableSorting: false,
//         cell: ({ row }) => (
//           <div className="flex items-center gap-1">
//             <Button size="icon" variant="ghost"
//               onClick={() => { setNotice(null); setPopup({ open: true, mode: "view", asset_id: row.original.asset_id, div_code: row.original.div_code, div_name: row.original.div_name }); }}>
//               <Eye size={15} />
//             </Button>
//             <Button size="icon" variant="ghost"
//               onClick={() => { setNotice(null); setPopup({ open: true, mode: "edit", asset_id: row.original.asset_id, div_code: row.original.div_code, div_name: row.original.div_name }); }}>
//               <Edit2 size={15} />
//             </Button>
//             <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}>
//               <Trash2 size={15} />
//             </Button>
//           </div>
//         ),
//       },
//     ],
//     []
//   );

//   // ===================== DELETE =====================
//   const deleteRow = async () => {
//     if (!deleteTarget) return;
//     try {
//       await executeDynamicDelete({
//         parameter: "AC_ASSETS_delete_asset_register",
//         loginid: loginId,
//         code1: deleteTarget.asset_id,
//         code2: companyCode,
//       });
//       setDeleteTarget(null);
//       setNotice({ type: "success", message: "Asset deleted successfully" });
//       await loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete asset" });
//     }
//   };

//   const closeForm = () => {
//     setNotice(null);
//     setPopup({ open: false });
//   };

//   const handleFormSaved = async () => {
//     setPopup({ open: false });
//     setNotice({ type: "success", message: "Asset saved successfully" });
//     await loadRows(false);
//   };

//   // ===================== INLINE EDITOR VIEW =====================
//   if (popup.open) {
//     return (
//       <AddAssetRegisterForm
//         key={`${popup.mode}_${popup.asset_id || "new"}`}
//         mode={popup.mode}
//         asset_id={popup.mode !== "create" ? popup.asset_id : undefined}
//         div_code={popup.div_code}
//         div_name={popup.div_name}
//         companyCode={companyCode}
//         loginId={loginId}
//         onClose={closeForm}
//         onSaved={handleFormSaved}
//       />
//     );
//   }

//   // ===================== LIST VIEW =====================
//   return (
//     <section className="finance-utility-page finance-list-page grid gap-4">
//       {/* Page Header - Matching Prepaid Register */}
//       <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
//         <div className="flex min-w-0 items-center gap-3">
//           <span className="tariff-page-icon">
//             <Boxes size={20} />
//           </span>
//           <div className="min-w-0">
//             <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Register</h1>
//             <p className="m-0 text-xs text-slate-500">Asset Utility</p>
//           </div>
//         </div>
//       </div>

//       <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

//       <div className="min-h-[650px]">
//         <DataTable
//           columns={columns}
//           data={filteredRows}
//           title={loading ? "Loading" : `${filteredRows.length} Records`}
//           subtitle="Assets"
//           searchValue={query}
//           onSearchChange={setQuery}
//           searchPlaceholder="Search asset id, name, account..."
//           loading={loading}
//           emptyText="No assets found"
//           height={650}
//           minWidth={1450}
//           density="grid"
//           enableExport={false}
//           actionButton={
//             <div className="flex items-center gap-2">
//               <Button
//                 type="button"
//                 className="h-8 gap-1.5 px-3.5 rounded-lg bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold cursor-pointer transition-colors"
//                 title="Create Asset"
//                 onClick={handleOpenDivisionPopup}
//               >
//                 <Plus size={14} strokeWidth={2.5} /> Add
//               </Button>
//               <FinanceListActionsMenu
//                 onExport={() =>
//                   exportToCsv(
//                     filteredRows,
//                     columns.filter((column) => column.id !== "actions"),
//                     "asset-register.csv",
//                   )
//                 }
//                 onRefresh={() => void loadRows(false)}
//               />
//             </div>
//           }
//           getRowId={(row, index) => `${row.asset_id || "new"}_${index}`}
//         />
//       </div>

//       <DivisionPickerDialog
//         open={divisionOpen}
//         divisions={divisions}
//         loading={loadingDivisions}
//         description="Choose a division to create a new asset."
//         onSelect={(div) => handleSelectDivision(div)}
//         onClose={() => setDivisionOpen(false)}
//       />

//       {deleteTarget && (
//         <Dialog
//           open
//           compact
//           tone="danger"
//           title="Delete Asset"
//           description="This action cannot be undone."
//           onClose={() => setDeleteTarget(null)}
//           footer={
//             <>
//               <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
//               <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
//             </>
//           }
//         >
//           <p className="modal-copy">Delete <strong>{deleteTarget.asset_id}</strong>?</p>
//         </Dialog>
//       )}
//     </section>
//   );
// }


import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Boxes, DollarSign, Edit2, Eye, FileText, Plus, Receipt, Save, Trash2, TrendingDown, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  executeDynamicDelete,
  executeDynamicMutationColumn90,
  getDynamicLookup,
  getLookupValue,
  LookupRow,
} from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { DivisionPickerDialog } from "../../components/ui/DivisionPickerDialog";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { formatDate } from "../../utils/date";
import { createPortal } from "react-dom";

// ===================== TYPES =====================
export type TAssetRow = {
  company_code: string;
  asset_id: string;
  asset_name: string;
  site_code: string;
  site_name: string;
  div_code: string;
  div_name: string;
  asset_group_code: string;
  asset_group_name: string;
  asset_subgroup_code: string;
  asset_subgroup_name: string;
  asset_brand_code: string;
  asset_brand_name: string;
  asset_ac_code: string;
  dprc_ac_code: string;
  accudprc_ac_code: string;
  dprc_percentage: string;
  dprc_commence_date: string;
  doc_type: string;
  doc_no: string;
  asset_properties: string;
  purchase_date: string;
  quantity: string;
  price: string;
  amount: string;
  supplier_name: string;
  supplier_ac_code: string;
  supp_code: string;
  status: string;
};

type TFullAssetForm = TAssetRow & {
  bar_code: string;
  emp_id: string;
  emp_name: string;
  reg_no: string;
  parent_asset: string;
  doc_serial_no: string;
  salvage_value: string;
  transporter_code: string;
  transporter_name: string;
  supp_name: string;
  exp_subtype_code: string;
  exp_subtype_description: string;
  ac_exp_code: string;
  exp_description: string;
  accudprc_amount: string;
  wd_value: string;
  last_dprc_date: string;
  ytd_dprcn: string;
  dprc_required: string;
  tax_dprc_percentage: string;
  tax_wd_value: string;
  tax_ytd_dprcn: string;
  tax_last_dprc_date: string;
  tax_accudprc_amount: string;
  sales_date: string;
  sales_amount: string;
  sales_profitloss: string;
  active_flag: string;
};

type TDivisionOption = { div_code: string; div_name: string };

type EditorState =
  | { mode: "create"; div_code: string; div_name: string; asset_id?: undefined }
  | { mode: "edit" | "view"; div_code: string; div_name: string; asset_id: string };

// ===================== HELPERS =====================
function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return num(value).toFixed(3);
}
const pad = (n: number) => String(n).padStart(2, "0");
function dateInput(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function display(code: string, name: string) {
  return code ? (name ? `${code} – ${name}` : code) : "";
}

// DB limits (MS_AC_ASSET)
const ASSET_LIMITS: Partial<Record<keyof TFullAssetForm, { max: number; label: string }>> = {
  asset_name:       { max: 100, label: "Asset Name" },
  asset_properties: { max: 200, label: "Asset Properties" },
  bar_code:         { max: 30,  label: "Bar Code" },
  reg_no:           { max: 15,  label: "Reg No" },
  parent_asset:     { max: 10,  label: "Parent Asset" },
  supplier_name:    { max: 70,  label: "Supplier Name" },
  doc_type:         { max: 5,   label: "Doc Type" },
  doc_no:           { max: 10,  label: "Doc No" },
  doc_serial_no:    { max: 10,  label: "Asset Serial No" },
};

// NUMBER(18,4) -> 14 int digits ; NUMBER(6,3) -> 3 int digits
const BIG_NUMBERS: (keyof TFullAssetForm)[] = [
  "quantity", "price", "amount", "salvage_value", "ytd_dprcn", "accudprc_amount", "wd_value",
  "tax_wd_value", "tax_ytd_dprcn", "tax_accudprc_amount", "sales_amount", "sales_profitloss",
];
const overInt = (v: unknown, intDigits: number) => Math.abs(Number(v || 0)) >= 10 ** intDigits;

function validateAsset(f: TFullAssetForm) {
  const e: Record<string, string> = {};
  const req = (k: keyof TFullAssetForm, label: string) => {
    if (!String(f[k] ?? "").trim()) e[k] = `${label} is required`;
  };

  req("asset_name", "Asset Name");
  req("asset_group_code", "Asset Group");
  req("emp_id", "Custodian");
  req("dprc_commence_date", "Dprc Commence Date");
  req("exp_subtype_code", "Exp Sub Type");
  req("ac_exp_code", "Exp Code");
  req("dprc_percentage", "Depreciation %");

  if (f.dprc_required === "Y" || num(f.dprc_percentage) > 0) {
    req("asset_ac_code", "Asset GL Account");
    req("dprc_ac_code", "Depreciation Expense GL Account");
    req("accudprc_ac_code", "Accumulated Depreciation GL Account");
  }

  if (!(num(f.quantity) > 0)) e.quantity = "Quantity must be > 0";
  if (!(num(f.price) > 0))    e.price = "Price must be > 0";
  if (!(num(f.amount) > 0))   e.amount = "Value must be > 0";

  if (!e.dprc_percentage && overInt(f.dprc_percentage, 3)) e.dprc_percentage = "Max 999.999";
  if (overInt(f.tax_dprc_percentage, 3)) e.tax_dprc_percentage = "Max 999.999";
  for (const k of BIG_NUMBERS) {
    if (!e[k] && overInt(f[k], 14)) e[k] = "Value too large (max 14 digits)";
  }

  for (const [k, l] of Object.entries(ASSET_LIMITS)) {
    const v = String((f as Record<string, unknown>)[k] ?? "");
    if (l && !e[k] && v.length > l.max) e[k] = `Max ${l.max} (${v.length})`;
  }
  if (f.doc_no && !/^\d+$/.test(f.doc_no)) e.doc_no = "Numbers only";
  if (f.doc_serial_no && !/^\d+$/.test(f.doc_serial_no)) e.doc_serial_no = "Numbers only";
  return e;
}

const scrollToFirstError = () => {
  setTimeout(() => {
    const el = document.querySelector("[data-error='true']");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
};

const EMPTY: TFullAssetForm = {
  company_code: "", asset_id: "", asset_name: "", site_code: "", site_name: "",
  div_code: "", div_name: "", asset_group_code: "", asset_group_name: "",
  asset_subgroup_code: "", asset_subgroup_name: "", asset_brand_code: "", asset_brand_name: "",
  asset_ac_code: "", dprc_ac_code: "", accudprc_ac_code: "", dprc_percentage: "0.000",
  dprc_commence_date: "", doc_type: "", doc_no: "", asset_properties: "", purchase_date: "",
  quantity: "1.000", price: "0.000", amount: "0.000", supplier_name: "",
  supplier_ac_code: "", supp_code: "", status: "Y",
  bar_code: "", emp_id: "", emp_name: "",
  reg_no: "", parent_asset: "", doc_serial_no: "",
  salvage_value: "0.000",
  transporter_code: "", transporter_name: "", supp_name: "",
  exp_subtype_code: "", exp_subtype_description: "",
  ac_exp_code: "", exp_description: "",
  accudprc_amount: "0.000", wd_value: "0.000",
  last_dprc_date: "", ytd_dprcn: "0.000", dprc_required: "Y",
  tax_dprc_percentage: "0.000", tax_wd_value: "0.000", tax_ytd_dprcn: "0.000",
  tax_last_dprc_date: "", tax_accudprc_amount: "0.000",
  sales_date: "", sales_amount: "0.000", sales_profitloss: "0.000",
  active_flag: "Y",
};

function mapAsset(row: LookupRow): TAssetRow {
  const g = (k: string) => String(getLookupValue(row, k) || "");
  return {
    ...EMPTY,
    company_code: g("company_code"), asset_id: g("asset_id"), asset_name: g("asset_name"),
    site_code: g("site_code"), site_name: g("site_name"),
    div_code: g("div_code"), div_name: g("div_name"),
    asset_group_code: g("asset_group_code"), asset_group_name: g("asset_group_name"),
    asset_subgroup_code: g("asset_subgroup_code"), asset_subgroup_name: g("asset_subgroup_name"),
    asset_brand_code: g("asset_brand_code"), asset_brand_name: g("asset_brand_name"),
    asset_ac_code: g("asset_ac_code"), dprc_ac_code: g("dprc_ac_code"), accudprc_ac_code: g("accudprc_ac_code"),
    dprc_percentage: money(getLookupValue(row, "dprc_percentage")),
    dprc_commence_date: dateInput(getLookupValue(row, "dprc_commence_date")),
    doc_type: g("doc_type"), doc_no: g("doc_no"), asset_properties: g("asset_properties"),
    purchase_date: dateInput(getLookupValue(row, "purchase_date")),
    quantity: money(getLookupValue(row, "quantity") || 1),
    price: money(getLookupValue(row, "price")),
    amount: money(getLookupValue(row, "amount")),
    supplier_name: g("supplier_name"), supplier_ac_code: g("supplier_ac_code"), supp_code: g("supp_code"),
    status: g("status") || "Y",
  };
}

// ===================== SMALL UI PIECES =====================
const ERR_CLS = "!border-rose-500 !ring-rose-400";

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <span data-error="true" className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
      <AlertCircle size={10} /> {error}
    </span>
  );
}

function Req() {
  return <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>;
}

function Field({
  label, value, onChange, onBlur, disabled, numeric, required, placeholder, className, error, maxLength,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  disabled?: boolean; numeric?: boolean; required?: boolean;
  placeholder?: string; className?: string; error?: string; maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const left = maxLength ? maxLength - value.length : 0;
  return (
    <div className={`freight-master-field relative ${className || ""}`}>
      <label className="freight-master-label">
        <span>{label}</span>
        {required && <Req />}
      </label>
      <input
        className={`freight-master-input ${numeric ? "numeric text-right tabular-nums" : ""} ${error ? ERR_CLS : ""}`}
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/[^0-9.\-]/g, "") : e.target.value)}
        onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const below = r.bottom + 4;
        setPos({ left: r.left, top: below + 36 > window.innerHeight ? r.top - 38 : below });
        setFocused(true);
        }}
        onBlur={(e) => { setFocused(false); onBlur?.(e.target.value); }}
        disabled={disabled}
      />
      {/* {focused && maxLength && !disabled && (
         <div className={`absolute left-0 top-full z-20 mt-1 w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${left <= 0 ? "bg-rose-600" : "bg-[#00378C]"}`}>
         {/* <div className={`mt-1 w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${left <= 0 ? "bg-rose-600" : "bg-[#00378C]"}`}> */}
        {/* {value.length} / {maxLength} characters ( {left} left)
        </div>
      )} */} 

    {focused && maxLength && !disabled && pos && createPortal(
  <div
    style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
    className={`pointer-events-none w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${left <= 0 ? "bg-rose-600" : "bg-[#00378C]"}`}
  >
    {value.length} / {maxLength} characters ( {left} left)
  </div>,
  document.body
)}
      <FieldError error={error} />
    </div>
  );
}

function DateField({
  label, value, onChange, disabled, required, error, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; required?: boolean; error?: string; className?: string;
}) {
  return (
    <div className={`freight-master-field ${className || ""}`}>
      <label className="freight-master-label">
        <span>{label}</span>
        {required && <Req />}
      </label>
      <BiscDatePicker compact disabled={disabled} value={value} error={Boolean(error)} onChange={onChange} />
      <FieldError error={error} />
    </div>
  );
}

function LookupBlock({
  label, required, error, className, children,
}: { label: string; required?: boolean; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`freight-master-field ${className || ""}`}>
      <label className="freight-master-label">
        <span>{label}</span>
        {required && <Req />}
      </label>
      {children}
      <FieldError error={error} />
    </div>
  );
}

function FormCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="freight-master-form-card">
      <div className="freight-master-form-header">
        <h3>
          <span className="freight-section-icon">{icon}</span>
          {title}
        </h3>
      </div>
      <div className="freight-master-form-body">{children}</div>
    </div>
  );
}

// ===================== MAIN PAGE (LIST) =====================
export function AssetRegisterPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<TAssetRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [divisionOpen, setDivisionOpen] = useState(false);
  const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TAssetRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_register",
        loginid: loginId,
        code1: companyCode,
        code2: "NULL", code3: "NULL", code4: "NULL",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      setRows(
        data
         .map(mapAsset).sort((a, b) =>
          b.asset_id.localeCompare(a.asset_id, undefined, { numeric: true, sensitivity: "base",
       })
     )
    );
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset register" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  const loadDivisions = async () => {
    setLoadingDivisions(true);
    try {
      const data = await getDynamicLookup({
        parameter: "Account_division",
        loginid: loginId,
        code1: companyCode,
        code2: "", code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      setDivisions(data.map((row) => ({
        div_code: String(getLookupValue(row, "div_code") || ""),
        div_name: String(getLookupValue(row, "div_name") || ""),
      })));
    } catch {
      // silently fail
    } finally {
      setLoadingDivisions(false);
    }
  };

  // client-side filter: AC_ASSETS_register returns the full set in one call
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  const openRow = (row: TAssetRow, mode: "edit" | "view") => {
    setNotice(null);
    setEditor({ mode, asset_id: row.asset_id, div_code: row.div_code, div_name: row.div_name });
  };

  const columns = useMemo<ColumnDef<TAssetRow>[]>(() => [
    {
      accessorKey: "asset_id",
      header: () => <div className="font-bold">Asset ID</div>,
      size: 110,
      cell: ({ row, getValue }) => (
        <button
          type="button"
          onClick={() => openRow(row.original, "edit")}
          className="doc-no-link text-primary font-semibold hover:underline cursor-pointer text-left bg-transparent border-none p-0"
          title={`Open ${String(getValue() || "")}`}
        >
          {String(getValue() || "")}
        </button>
      ),
    },
    { accessorKey: "asset_name", header: "Asset Name", size: 280 },
    { accessorKey: "asset_group_code", header: "Group", size: 100 },
    { accessorKey: "asset_subgroup_code", header: "Subgroup", size: 110 },
    { accessorKey: "asset_brand_code", header: "Brand", size: 100 },
    { accessorKey: "asset_ac_code", header: "Asset A/C", size: 120 },
    {
      accessorKey: "purchase_date",
      header: () => <div className="text-center w-full font-bold">Purchase</div>,
      size: 110,
      cell: ({ getValue }) => <div className="text-center">{formatDate(getValue())}</div>,
    },
    {
      accessorKey: "quantity",
      header: () => <div className="text-right w-full font-bold">Qty</div>,
      size: 80,
      cell: ({ getValue }) => <div className="text-right font-mono tabular-nums">{String(getValue() || "0.000")}</div>,
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right w-full font-bold">Value</div>,
      size: 130,
      cell: ({ getValue }) => (
        <div className="text-right font-mono tabular-nums font-semibold text-slate-800">{String(getValue() || "0.000")}</div>
      ),
    },
    // {
    //   accessorKey: "status",
    //   header: () => <div className="text-center w-full font-bold">Status</div>,
    //   size: 90,
    //   cell: ({ getValue }) => {
    //     const active = String(getValue() || "Y") === "Y";
    //     return (
    //       <div className="flex justify-center">
    //         <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
    //           {active ? "Active" : "Inactive"}
    //         </span>
    //       </div>
    //     );
    //   },
    // },
    {
      id: "actions",
      header: () => <div className="text-center w-full font-bold">Actions</div>,
      enableSorting: false,
      size: 130,
      minSize: 130,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="icon" variant="ghost" title="View" onClick={() => openRow(row.original, "view")}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" title="Edit" onClick={() => openRow(row.original, "edit")}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], []);

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "AC_ASSETS_delete_asset_register",
        loginid: loginId,
        code1: deleteTarget.asset_id,
        code2: companyCode,
      });
      const id = deleteTarget.asset_id;
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Asset ${id} deleted successfully` });
      await loadRows(false);
    } catch (error: any) {
      setDeleteTarget(null);
      setNotice({
        type: "error",
        message: error?.response?.data?.message || (error instanceof Error ? error.message : "Unable to delete asset"),
      });
    }
  };

  return (
    <section className={`${editor ? "finance-document-editing" : "finance-utility-page"} finance-list-page grid gap-4`}>
      {!editor && (
        <>
          <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="tariff-page-icon"><Boxes size={20} /></span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Register</h1>
                 </div>
            </div>
          </div>

          <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

          <div className="finance-list-table-wrap">
            <DataTable
              columns={columns}
              data={filteredRows}
              title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
              subtitle="Assets"
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search asset id, name, account..."
              loading={loading}
              emptyText="No assets found"
              height={620}
              minWidth={1300}
              density="grid"
              enableExport={false}
              actionButton={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    className="h-8 gap-1.5 px-3.5 rounded-lg bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold cursor-pointer transition-colors"
                    title="Create Asset"
                    onClick={() => { setNotice(null); setDivisionOpen(true); void loadDivisions(); }}
                  >
                    <Plus size={14} strokeWidth={2.5} /> Add
                  </Button>
                  <FinanceListActionsMenu
                    onExport={() => exportToCsv(filteredRows, columns.filter((c) => c.id !== "actions"), "asset-register.csv")}
                    onRefresh={() => void loadRows(false)}
                  />
                </div>
              }
              getRowId={(row, index) => `${row.asset_id || "new"}_${index}`}
            />
          </div>
        </>
      )}

      {editor && (
        <div className="finance-document-editor flex flex-col w-full h-full min-w-0 min-h-0">
          <AssetEditor
            key={`${editor.mode}_${editor.asset_id || "new"}`}
            editor={editor}
            companyCode={companyCode}
            loginId={loginId}
            onClose={() => { setNotice(null); setEditor(null); }}
            onSaved={async (message) => {
              setEditor(null);
              setNotice({ type: "success", message });
              await loadRows(false);
            }}
          />
        </div>
      )}

      <DivisionPickerDialog
        open={divisionOpen}
        divisions={divisions}
        loading={loadingDivisions}
        description="Choose a division to create a new asset."
        onSelect={(div) => {
          setDivisionOpen(false);
          setNotice(null);
          setEditor({ mode: "create", div_code: div.div_code, div_name: div.div_name });
        }}
        onClose={() => setDivisionOpen(false)}
      />

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Asset"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.asset_id}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

// ===================== EDITOR (FORM) =====================
function AssetEditor({
  editor, companyCode, loginId, onClose, onSaved,
}: {
  editor: EditorState;
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { mode, asset_id, div_code, div_name } = editor;
  const isReadOnly = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(asset_id));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [propsFocus, setPropsFocus] = useState(false);
  const [form, setForm] = useState<TFullAssetForm>({ ...EMPTY, company_code: companyCode, div_code, div_name });

  // ----- load existing -----
  useEffect(() => {
    if (!asset_id) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: "AC_ASSETS_register",
          loginid: loginId,
          code1: companyCode,
          code2: asset_id,
          code3: "NULL", code4: "NULL",
          number1: 0, number2: 0, number3: 0, number4: 0,
          date1: null, date2: null, date3: null, date4: null,
        });
        const h = res.find((row) => String(getLookupValue(row, "asset_id") || "") === String(asset_id));
        if (!h || !mounted) return;
        const g = (field: string) => String(getLookupValue(h, field) || "");
        setForm({
          ...EMPTY,
          company_code: g("company_code") || companyCode,
          asset_id: g("asset_id"),
          asset_name: g("asset_name"),
          site_code: g("site_code"), site_name: g("site_name"),
          div_code: g("div_code") || div_code, div_name: g("div_name") || div_name,
          asset_group_code: g("asset_group_code"), asset_group_name: g("asset_group_name"),
          asset_subgroup_code: g("asset_subgroup_code"), asset_subgroup_name: g("asset_subgroup_name"),
          asset_brand_code: g("asset_brand_code"), asset_brand_name: g("asset_brand_name"),
          bar_code: g("bar_code"),
          emp_id: g("emp_id"), emp_name: g("emp_name"),
          reg_no: g("reg_no"),
          parent_asset: g("parent_asset"),
          doc_serial_no: g("doc_serial_no"),
          asset_properties: g("asset_properties"),
          status: g("status") || "Y",
          active_flag: g("active_flag") || "Y",
          purchase_date: dateInput(g("purchase_date")),
          doc_type: g("doc_type"), doc_no: g("doc_no"),
          quantity: money(getLookupValue(h, "quantity") || 1),
          price: money(getLookupValue(h, "price")),
          amount: money(getLookupValue(h, "amount")),
          salvage_value: money(getLookupValue(h, "salvage_value")),
          supplier_name: g("supplier_name"),
          supplier_ac_code: g("supplier_ac_code"),
          supp_code: g("supp_code"), supp_name: g("supp_name"),
          transporter_code: g("transporter_code"), transporter_name: g("transporter_name"),
          exp_subtype_code: g("exp_subtype_code"), exp_subtype_description: g("exp_subtype_description"),
          ac_exp_code: g("ac_exp_code"), exp_description: g("exp_description"),
          asset_ac_code: g("asset_ac_code"),
          dprc_ac_code: g("dprc_ac_code"),
          accudprc_ac_code: g("accudprc_ac_code"),
          dprc_percentage: money(getLookupValue(h, "dprc_percentage")),
          dprc_commence_date: dateInput(g("dprc_commence_date")),
          last_dprc_date: dateInput(g("last_dprc_date")),
          ytd_dprcn: money(getLookupValue(h, "ytd_dprcn")),
          accudprc_amount: money(getLookupValue(h, "accudprc_amount")),
          wd_value: money(getLookupValue(h, "wd_value")),
          dprc_required: g("dprc_required") || "Y",
          tax_dprc_percentage: money(getLookupValue(h, "tax_dprc_percentage")),
          tax_wd_value: money(getLookupValue(h, "tax_wd_value")),
          tax_ytd_dprcn: money(getLookupValue(h, "tax_ytd_dprcn")),
          tax_last_dprc_date: dateInput(g("tax_last_dprc_date")),
          tax_accudprc_amount: money(getLookupValue(h, "tax_accudprc_amount")),
          sales_date: dateInput(g("sales_date")),
          sales_amount: money(getLookupValue(h, "sales_amount")),
          sales_profitloss: money(getLookupValue(h, "sales_profitloss")),
        });
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load asset");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [asset_id]);

  // ----- auto amount -----
  useEffect(() => {
    const amount = (num(form.quantity) * num(form.price)).toFixed(3);
    if (form.amount !== amount) setForm((p) => ({ ...p, amount }));
  }, [form.quantity, form.price]);

  const set = (field: keyof TFullAssetForm, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };
  const fmt = (field: keyof TFullAssetForm, v: string) => set(field, money(v));
  const lim = (f: keyof TFullAssetForm) => ASSET_LIMITS[f]?.max;
  const limErr = (f: keyof TFullAssetForm) => {
    const l = ASSET_LIMITS[f];
    const v = String(form[f] ?? "");
    return l && v.length > l.max ? `Max ${l.max} (${v.length})` : undefined;
  };

  const loader = (parameter: string) => () =>
    getDynamicLookup({
      parameter,
      loginid: loginId,
      code1: companyCode,
      code2: "", code3: "", code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    });

  // ----- submit -----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const errs = validateAsset(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setError(
        Object.keys(errs).some((k) => /Max|too large/.test(errs[k]))
          ? "Please correct the highlighted fields (limit exceeded / invalid values)."
          : "Kindly fill in the missing fields."
      );
      scrollToFirstError();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: any = await executeDynamicMutationColumn90({
        parameter: "ms_ac_asset_register_ins_upd",
        loginid: loginId,
        val1s1: companyCode,
        val1s2: isEdit ? form.asset_id : "",
        val1s3: form.asset_name,
        val1s4: form.asset_group_code,
        val1s5: form.dprc_commence_date,
        val1s6: form.sales_date,
        val1s7: form.purchase_date,
        val1s8: form.status,
        val1s9: form.site_code,
        val1s10: form.div_code,
        val1s11: form.asset_ac_code,
        val1s12: form.asset_brand_code,
        val1s14: form.bar_code,
        val1s15: form.emp_id,
        val1s16: form.asset_properties,
        val1s17: form.reg_no,
        val1s18: form.parent_asset,
        val1s19: form.asset_subgroup_code,
        val1s20: form.supp_code,
        val1s21: form.supplier_name,
        val1s22: form.doc_type,
        val1s23: form.transporter_code,
        val1s25: form.dprc_ac_code,
        val1s26: form.accudprc_ac_code,
        val1s27: form.ac_exp_code,
        val1s28: form.exp_subtype_code,
        val1s29: form.last_dprc_date,
        val1s30: form.tax_last_dprc_date,
        val1s31: form.active_flag,
        val1s32: form.sales_profitloss,
        val1s33: form.ytd_dprcn,
        val1s34: form.accudprc_amount,
        val1s35: form.wd_value,
        val1s36: form.dprc_percentage,
        val1s37: form.doc_no,
        val1s38: form.sales_amount,
        val1s42: form.quantity,
        val1s43: form.price,
        val1s44: form.amount,
        val1s45: form.salvage_value,
        val1s47: form.doc_serial_no,
        val1s48: form.tax_dprc_percentage,
        val1s50: form.tax_wd_value,
        val1s51: form.tax_ytd_dprcn,
        val1s52: form.tax_accudprc_amount,
      } as any);

      const savedId = String(
        result?.asset_id ?? result?.data?.asset_id ?? result?.data?.[0]?.asset_id ?? form.asset_id ?? ""
      ).trim();

      await onSaved(
        `Asset ${isEdit ? "updated" : "created"} successfully${savedId ? ` — Asset ID: ${savedId}` : ""}`
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        (err instanceof Error ? err.message : "Unable to save asset")
      );
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create" ? "New Asset" : mode === "edit" ? "Edit Asset" : "View Asset";

  return (
    <section
      className="freight-airline-tariff-screen flex flex-col gap-2 freight-ui-standard freight-dense-form h-full min-h-0 p-2"
      style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "none", marginLeft: 0 }}
    >
      <div
        className="tariff-page-header flex flex-wrap items-center justify-between gap-2 shrink-0"
        style={{ height: "auto", minHeight: 56, maxHeight: "none", overflow: "visible" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon"><FileText size={20} /></span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{title}</h1>
            <p className="m-0 text-xs text-slate-500">
              Asset ID: {form.asset_id || "Autogenerated"} 
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">Dprc %</span>
            <strong className="text-sm tabular-nums">{form.dprc_percentage || "0.000"}</strong>
          </div>
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">WD Value</span>
            <strong className="text-sm tabular-nums">{form.wd_value || "0.000"}</strong>
          </div>
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">Value</span>
            <strong className="text-sm tabular-nums">{form.amount || "0.000"}</strong>
          </div>
          {!isReadOnly && (
            <Button
              type="submit"
              form="asset-register-form"
              disabled={saving || loading}
              className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? <span className="spinner small" /> : <Save size={14} />}
              {saving ? "Saving..." : isEdit ? "Update" : "Save"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
            title="Close form"
            className="h-8 w-8 rounded-lg"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      {loading ? (
        <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading asset...</div>
      ) : (
        <form className="flex flex-col gap-2" id="asset-register-form" onSubmit={handleSubmit} noValidate>
          {/* ============ CARD 1: ASSET DETAILS ============ */}
          <FormCard icon={<FileText size={16} />} title="Asset Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-2">
              <LookupBlock label="Location (Site)">
                <LookupField
                  compact
                  value={form.site_code}
                  displayValue={display(form.site_code, form.site_name)}
                  columns={[{ field: "site_code", header: "Site" }, { field: "site_name", header: "Name" }]}
                  valueField="site_code" displayFields={["site_code", "site_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_site_code")}
                  onChange={(value, row) => {
                    set("site_code", value);
                    set("site_name", String(getLookupValue(row || {}, "site_name") || ""));
                  }}
                />
              </LookupBlock>

              <div className="freight-master-field">
                <label className="freight-master-label"><span>Division</span></label>
                <input className="freight-master-input" value={display(form.div_code, form.div_name)} disabled readOnly />
              </div>

              <Field label="Asset Name" required value={form.asset_name} maxLength={lim("asset_name")}
                error={fieldErrors.asset_name || limErr("asset_name")}
                onChange={(v) => set("asset_name", v)} disabled={isReadOnly}
                className="col-span-1 sm:col-span-2" />

              <LookupBlock label="Asset Group" required error={fieldErrors.asset_group_code} className="col-span-1 ">
                <LookupField
                  compact
                  value={form.asset_group_code}
                  displayValue={display(form.asset_group_code, form.asset_group_name)}
                  columns={[{ field: "asset_group_code", header: "Group" }, { field: "asset_group_name", header: "Name" }]}
                  valueField="asset_group_code" displayFields={["asset_group_code", "asset_group_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_group_code")}
                  onChange={(value, row) => {
                    set("asset_group_code", value);
                    set("asset_group_name", String(getLookupValue(row || {}, "asset_group_name") || ""));
                  }}
                />
              </LookupBlock>

              <Field label="Bar Code" value={form.bar_code} maxLength={lim("bar_code")} error={limErr("bar_code")}
                onChange={(v) => set("bar_code", v)} disabled={isReadOnly} />

              {/* <div className="freight-master-field">
                <label className="freight-master-label"><span>Status</span></label>
                <Select className="freight-master-select" value={form.status} onChange={(e) => set("status", e.target.value)} disabled={isReadOnly}>
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </Select>
              </div> */}

              <LookupBlock label="Custodian (Employee)" required error={fieldErrors.emp_id}>
                <LookupField
                  compact
                  value={form.emp_id}
                  displayValue={display(form.emp_id, form.emp_name)}
                  columns={[{ field: "emp_id", header: "Emp ID" }, { field: "emp_name", header: "Name" }]}
                  valueField="emp_id" displayFields={["emp_id", "emp_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_Emp_Id")}
                  onChange={(value, row) => {
                    set("emp_id", value);
                    set("emp_name", String(getLookupValue(row || {}, "emp_name") || ""));
                  }}
                />
              </LookupBlock>

              <div className="freight-master-field relative col-span-1 sm:col-span-2 lg:col-span-4 2xl:col-span-3">
                <label className="freight-master-label"><span>Asset Properties</span></label>
                <textarea
                  className={`freight-master-input min-h-[60px] ${limErr("asset_properties") ? ERR_CLS : ""}`}
                  value={form.asset_properties}
                  maxLength={lim("asset_properties")}
                  onChange={(e) => set("asset_properties", e.target.value)}
                  onFocus={() => setPropsFocus(true)}
                  onBlur={() => setPropsFocus(false)}
                  disabled={isReadOnly}
                />
                {propsFocus && !isReadOnly && (
                  <div className={`absolute left-0 top-full z-20 mt-1 w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${form.asset_properties.length >= 200 ? "bg-rose-600" : "bg-[#00378C]"}`}>
                   {/* <div className={`mt-1 w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${form.asset_properties.length >= 200 ? "bg-rose-600" : "bg-[#00378C]"}`}>  */}
                  {form.asset_properties.length} / 200 characters ( {200 - form.asset_properties.length} left)
                  </div>
                )}
                <FieldError error={limErr("asset_properties")} />
              </div>

              <Field label="Reg No" value={form.reg_no} maxLength={lim("reg_no")} error={limErr("reg_no")}
                onChange={(v) => set("reg_no", v)} disabled={isReadOnly} />

              {/* <Field label="Parent Asset" value={form.parent_asset} maxLength={lim("parent_asset")} error={limErr("parent_asset")}
                onChange={(v) => set("parent_asset", v)} disabled={isReadOnly} /> */}

              <LookupBlock label="Asset Subgroup">
                <LookupField
                  compact
                  value={form.asset_subgroup_code}
                  displayValue={display(form.asset_subgroup_code, form.asset_subgroup_name)}
                  columns={[{ field: "asset_subgroup_code", header: "Subgroup" }, { field: "asset_subgroup_name", header: "Name" }]}
                  valueField="asset_subgroup_code" displayFields={["asset_subgroup_code", "asset_subgroup_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_Subgroup_code")}
                  onChange={(value, row) => {
                    set("asset_subgroup_code", value);
                    set("asset_subgroup_name", String(getLookupValue(row || {}, "asset_subgroup_name") || ""));
                  }}
                />
              </LookupBlock>

              <Field label="Asset Serial No" numeric value={form.doc_serial_no} maxLength={lim("doc_serial_no")}
                error={fieldErrors.doc_serial_no || limErr("doc_serial_no")}
                onChange={(v) => set("doc_serial_no", v)} disabled={isReadOnly} />

              <LookupBlock label="Asset Brand">
                <LookupField
                  compact
                  value={form.asset_brand_code}
                  displayValue={display(form.asset_brand_code, form.asset_brand_name)}
                  columns={[{ field: "asset_brand_code", header: "Brand" }, { field: "asset_brand_name", header: "Name" }]}
                  valueField="asset_brand_code" displayFields={["asset_brand_code", "asset_brand_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_Brand_code")}
                  onChange={(value, row) => {
                    set("asset_brand_code", value);
                    set("asset_brand_name", String(getLookupValue(row || {}, "asset_brand_name") || ""));
                  }}
                />
              </LookupBlock>

            </div>
          </FormCard>

          {/* ============ CARD 1b: PURCHASE DETAILS ============ */}
          <FormCard icon={<Boxes size={16} />} title="Purchase Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-2">
              <Field label="Supplier Name" value={form.supplier_name} maxLength={lim("supplier_name")} error={limErr("supplier_name")}
                onChange={(v) => set("supplier_name", v)} disabled={isReadOnly} />

              <LookupBlock label="Supplier Code">
                <LookupField
                  compact
                  value={form.supp_code}
                  displayValue={display(form.supp_code, form.supp_name)}
                  columns={[{ field: "supp_code", header: "Code" }, { field: "supp_name", header: "Name" }]}
                  valueField="supp_code" displayFields={["supp_code", "supp_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_supp_code")}
                  onChange={(value, row) => {
                    set("supp_code", value);
                    set("supp_name", String(getLookupValue(row || {}, "supp_name") || ""));
                  }}
                />
              </LookupBlock>

              <DateField label="Purchase Date" value={form.purchase_date}
                onChange={(v) => set("purchase_date", v)} disabled={isReadOnly} />

              {/* <Field label="Doc Type" value={form.doc_type} maxLength={lim("doc_type")} error={limErr("doc_type")}
                onChange={(v) => set("doc_type", v)} disabled={isReadOnly} /> */}

              <Field label="Doc No" numeric value={form.doc_no} maxLength={lim("doc_no")}
                error={fieldErrors.doc_no || limErr("doc_no")}
                onChange={(v) => set("doc_no", v)} disabled={isReadOnly} />

              <Field label="Quantity" required numeric value={form.quantity} error={fieldErrors.quantity}
                onChange={(v) => set("quantity", v)} onBlur={(v) => fmt("quantity", v)} disabled={isReadOnly} />

              <Field label="Price" required numeric value={form.price} error={fieldErrors.price}
                onChange={(v) => set("price", v)} onBlur={(v) => fmt("price", v)} disabled={isReadOnly} />

              <Field label="Value (Auto)" required numeric value={form.amount} error={fieldErrors.amount}
                onChange={(v) => set("amount", v)} disabled />

              <Field label="Salvage Value" numeric value={form.salvage_value} error={fieldErrors.salvage_value}
                onChange={(v) => set("salvage_value", v)} onBlur={(v) => fmt("salvage_value", v)} disabled={isReadOnly} />

              <LookupBlock label="Transporter Code">
                <LookupField
                  compact
                  value={form.transporter_code}
                  displayValue={display(form.transporter_code, form.transporter_name)}
                  columns={[{ field: "transporter_code", header: "Code" }, { field: "transporter_name", header: "Name" }]}
                  valueField="transporter_code" displayFields={["transporter_code", "transporter_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_transporter_code")}
                  onChange={(value, row) => {
                    set("transporter_code", value);
                    set("transporter_name", String(getLookupValue(row || {}, "transporter_name") || ""));
                  }}
                />
              </LookupBlock>
            </div>
          </FormCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
          {/* ============ CARD 2: DEPRECIATION DETAILS (left) ============ */}
          <FormCard icon={<TrendingDown size={16} />} title="Depreciation Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3 gap-2">
              <Field label="DPRC Percentage" required numeric value={form.dprc_percentage} error={fieldErrors.dprc_percentage}
                onChange={(v) => set("dprc_percentage", v)} onBlur={(v) => fmt("dprc_percentage", v)} disabled={isReadOnly} />

              <DateField label="DPRC Commence Date" required value={form.dprc_commence_date} error={fieldErrors.dprc_commence_date}
                onChange={(v) => set("dprc_commence_date", v)} disabled={isReadOnly} />

              <DateField label="Last DPRC Date" value={form.last_dprc_date}
                onChange={(v) => set("last_dprc_date", v)} disabled={isReadOnly} />

              <Field label="YTD DPRCN" numeric value={form.ytd_dprcn} error={fieldErrors.ytd_dprcn}
                onChange={(v) => set("ytd_dprcn", v)} onBlur={(v) => fmt("ytd_dprcn", v)} disabled={isReadOnly} />

              <Field label="AccuDPRC Amount" numeric value={form.accudprc_amount} error={fieldErrors.accudprc_amount}
                onChange={(v) => set("accudprc_amount", v)} onBlur={(v) => fmt("accudprc_amount", v)} disabled={isReadOnly} />

              <Field label="WD Value" numeric value={form.wd_value} error={fieldErrors.wd_value}
                onChange={(v) => set("wd_value", v)} onBlur={(v) => fmt("wd_value", v)} disabled={isReadOnly} />

              <LookupBlock
                label="Asset AC Code"
                required={form.dprc_required === "Y" || num(form.dprc_percentage) > 0}
                error={fieldErrors.asset_ac_code}
              >
                <LookupField
                  compact
                  value={form.asset_ac_code}
                  displayValue={form.asset_ac_code}
                  columns={[{ field: "ac_code", header: "A/C Code" }, { field: "ac_name", header: "A/C Name" }]}
                  valueField="ac_code" displayFields={["ac_code", "ac_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
                  onChange={(value) => set("asset_ac_code", value)}
                />
              </LookupBlock>

              <LookupBlock
                label="DPRC AC Code"
                required={form.dprc_required === "Y" || num(form.dprc_percentage) > 0}
                error={fieldErrors.dprc_ac_code}
              >
                <LookupField
                  compact
                  value={form.dprc_ac_code}
                  displayValue={form.dprc_ac_code}
                  columns={[{ field: "ac_code", header: "A/C Code" }, { field: "ac_name", header: "A/C Name" }]}
                  valueField="ac_code" displayFields={["ac_code", "ac_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
                  onChange={(value) => set("dprc_ac_code", value)}
                />
              </LookupBlock>

              <LookupBlock
                label="AccuDPRC AC Code"
                required={form.dprc_required === "Y" || num(form.dprc_percentage) > 0}
                error={fieldErrors.accudprc_ac_code}
              >
                <LookupField
                  compact
                  value={form.accudprc_ac_code}
                  displayValue={form.accudprc_ac_code}
                  columns={[{ field: "ac_code", header: "A/C Code" }, { field: "ac_name", header: "A/C Name" }]}
                  valueField="ac_code" displayFields={["ac_code", "ac_name"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
                  onChange={(value) => set("accudprc_ac_code", value)}
                />
              </LookupBlock>

              <LookupBlock label="Exp Subtype Code" required error={fieldErrors.exp_subtype_code}>
                <LookupField
                  compact
                  value={form.exp_subtype_code}
                  displayValue={display(form.exp_subtype_code, form.exp_subtype_description)}
                  columns={[{ field: "exp_subtype_code", header: "Code" }, { field: "exp_subtype_description", header: "Description" }]}
                  valueField="exp_subtype_code" displayFields={["exp_subtype_code", "exp_subtype_description"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_EXPSUBTYPE")}
                  onChange={(value, row) => {
                    set("exp_subtype_code", value);
                    set("exp_subtype_description", String(getLookupValue(row || {}, "exp_subtype_description") || ""));
                  }}
                />
              </LookupBlock>

              <LookupBlock label="AC Exp Code" required error={fieldErrors.ac_exp_code}>
                <LookupField
                  compact
                  value={form.ac_exp_code}
                  displayValue={display(form.ac_exp_code, form.exp_description)}
                  columns={[{ field: "exp_code", header: "Code" }, { field: "exp_description", header: "Description" }]}
                  valueField="exp_code" displayFields={["exp_code", "exp_description"]}
                  disabled={isReadOnly}
                  loadOptions={loader("AC_ASSETS_exp_code")}
                  onChange={(value, row) => {
                    set("ac_exp_code", value);
                    set("exp_description", String(getLookupValue(row || {}, "exp_description") || ""));
                  }}
                />
              </LookupBlock>
            </div>
          </FormCard>

          <div className="flex flex-col gap-2">
          {/* ============ CARD 3: TAX DEPRECIATION DETAILS (right, top) ============ */}
          <FormCard icon={<Receipt size={16} />} title="Tax Depreciation Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3 gap-2">
              <Field label="Tax DPRC Percentage" numeric value={form.tax_dprc_percentage} error={fieldErrors.tax_dprc_percentage}
                onChange={(v) => set("tax_dprc_percentage", v)} onBlur={(v) => fmt("tax_dprc_percentage", v)} disabled={isReadOnly} />

              <Field label="Tax WD Value" numeric value={form.tax_wd_value} error={fieldErrors.tax_wd_value}
                onChange={(v) => set("tax_wd_value", v)} onBlur={(v) => fmt("tax_wd_value", v)} disabled={isReadOnly} />

              <Field label="Tax AccuDPRC Amount" numeric value={form.tax_accudprc_amount} error={fieldErrors.tax_accudprc_amount}
                onChange={(v) => set("tax_accudprc_amount", v)} onBlur={(v) => fmt("tax_accudprc_amount", v)} disabled={isReadOnly} />

              <DateField label="Tax Last DPRC Date" value={form.tax_last_dprc_date}
                onChange={(v) => set("tax_last_dprc_date", v)} disabled={isReadOnly} />

              <Field label="Tax YTD DPRCN" numeric value={form.tax_ytd_dprcn} error={fieldErrors.tax_ytd_dprcn}
                onChange={(v) => set("tax_ytd_dprcn", v)} onBlur={(v) => fmt("tax_ytd_dprcn", v)} disabled={isReadOnly} />
            </div>
          </FormCard>

          {/* ============ CARD 4: SALES DETAILS (right, bottom) ============ */}
          <FormCard icon={<DollarSign size={16} />} title="Sales Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2">
              <DateField label="Sales Date" value={form.sales_date}
                onChange={(v) => set("sales_date", v)} disabled={isReadOnly} />

              <Field label="Sales Amount" numeric value={form.sales_amount} error={fieldErrors.sales_amount}
                onChange={(v) => set("sales_amount", v)} onBlur={(v) => fmt("sales_amount", v)} disabled={isReadOnly} />

              <Field label="Sales Profit/Loss" numeric value={form.sales_profitloss} error={fieldErrors.sales_profitloss}
                onChange={(v) => set("sales_profitloss", v)} onBlur={(v) => fmt("sales_profitloss", v)} disabled={isReadOnly} />

              <div className="freight-master-field">
                <label className="freight-master-label"><span>Active Flag</span></label>
                <Select className="freight-master-select" value={form.active_flag} onChange={(e) => set("active_flag", e.target.value)} disabled={isReadOnly}>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </Select>
              </div>
            </div>
          </FormCard>
          </div>
          </div>
        </form>
      )}
      </div>
    </section>
  );
}