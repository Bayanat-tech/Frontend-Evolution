// "use client";

// import { useEffect, useState } from "react";
// import { FileText, RotateCcw, Printer, Loader2, Download } from "lucide-react";
// import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
// import { useAuth } from "../../../state/AuthContext";
// import { LookupField } from "../../../components/ui/LookupField";
// import { Division, taxOutInSummaryReport, taxOutInReport, getTaxInvoiceExcelReport, exportTaxInvoiceSummaryExcel } from "../../../api/transactions";
// import { FloatLabelInput } from "../../../lib/InputStyle";

// export default function TaxReportFilter() {
//     const { user } = useAuth();

//     const [group, setGroup] = useState<any[]>([]);
//     const [accounts, setAccounts] = useState<any[]>([]);
//     const [division, setDivision] = useState<Division[]>([]);
//     const [dateFrom, setDateFrom] = useState("2026-05-01");
//     const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
//     const [activeTab, setActiveTab] = useState("group");
//     const [generating, setGenerating] = useState(false);
//     const [reportError, setReportError] = useState<string | null>(null);

//     const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
//     const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
//     const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
//     const [accountLeftSelected, setAccountLeftSelected] = useState(new Set<string>());
//     const [groupSearchLeft, setGroupSearchLeft] = useState("");
//     const [accountSearchLeft, setAccountSearchLeft] = useState("");
//     const [generatingExcel, setGeneratingExcel] = useState(false);
//     const [options, setOptions] = useState({
//         taxoutsummary: true,
//         taxinsummary: false,
//         taxledgeroutreport: false,
//         taxledgerinreport: false,
//     });

//     const formatDate = (date: string) => {
//         if (!date) return "";
//         const d = new Date(date);
//         const day = String(d.getDate()).padStart(2, "0");
//         const month = String(d.getMonth() + 1).padStart(2, "0");
//         const year = d.getFullYear();
//         return `${day}-${month}-${year}`;
//     };

//     useEffect(() => {
//         if (division[0]?.div_code) {
//             fetchGroups();
//             fetchAccounts();
//         }
//     }, [division]);

//     const fetchGroups = async () => {
//         try {
//             const response = await getDynamicLookupaccount({
//                 parameter: "Account_Report_Group",
//                 code1: user?.company_code || "",
//                 code2: division[0]?.div_code || "",
//             });
//             setGroup(response || []);
//             setGroupLeftItems(response || []);
//             setGroupLeftSelected(new Set());
//         } catch (error) {
//             console.error("Group fetch error:", error);
//         }
//     };

//     const fetchAccounts = async () => {
//         try {
//             const response = await getDynamicLookupaccount({
//                 parameter: "Account_Report_AC",
//                 code1: user?.company_code || "",
//                 code2: division[0]?.div_code || "",
//             });
//             const uniqueData = Array.from(
//                 new Map(response.map((item: any) => [item.ac_code, item])).values()
//             );
//             setAccounts(uniqueData);
//             setAccountLeftItems(uniqueData);
//         } catch (error) {
//             console.error("Accounts fetch error:", error);
//         }
//     };

//     const toggleOption = (key: keyof typeof options) => {
//         setOptions((prev) => {
//             const next: Record<string, boolean> = {};
//             Object.keys(prev).forEach((k) => { next[k] = k === key; });
//             return next as typeof options;
//         });
//         setReportError(null);
//     };

//     const toggleSelection = (
//         code: string,
//         setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
//     ) => {
//         setSelected((prev) => {
//             const next = new Set(prev);
//             next.has(code) ? next.delete(code) : next.add(code);
//             return next;
//         });
//     };

//     const toggleAllSelection = (
//         items: any[],
//         selected: Set<string>,
//         setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
//         keyField: string
//     ) => {
//         const allSelected = items.length > 0 && items.every((item) => selected.has(item[keyField]));
//         setSelected(allSelected ? new Set() : new Set(items.map((item) => item[keyField])));
//     };

//     const filteredGroupLeft = groupLeftItems.filter(
//         (item) =>
//             item.l4_code?.toLowerCase().includes(groupSearchLeft.toLowerCase()) ||
//             item.description?.toLowerCase().includes(groupSearchLeft.toLowerCase())
//     );

//     const filteredAccountLeft = accountLeftItems.filter(
//         (item) =>
//             item.ac_code?.toLowerCase().includes(accountSearchLeft.toLowerCase()) ||
//             item.ac_name?.toLowerCase().includes(accountSearchLeft.toLowerCase())
//     );

//     const handleReset = () => {
//         setGroupLeftSelected(new Set());
//         setAccountLeftSelected(new Set());
//         setReportError(null);
//     };

//     // ── single buildParams — takes parameter string ──
//     const buildParams = (parameter: string) => ({
//         loginid: user?.loginid || user?.username || "ADMIN",
//         code1: user?.company_code || "",
//         code2: formatDate(dateFrom),
//         code3: formatDate(dateTo),
//         code4: groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(",") : "All",
//         code5: accountLeftSelected.size > 0 ? Array.from(accountLeftSelected).join(",") : "All",
//         code6: division[0]?.div_code || "",
//         parameter,
//     });
//     const handleExportExcel = async () => {
//         setReportError(null);
//         setGeneratingExcel(true);

//         try {
//             if (options.taxoutsummary) {
//                 await exportTaxInvoiceSummaryExcel(
//                     buildParams("Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_SUMMARY_REPORT")
//                 );
//             } else if (options.taxinsummary) {
//                 await exportTaxInvoiceSummaryExcel(
//                     buildParams("Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_SUMMARY_REPORT")
//                 );
//             } else if (options.taxledgeroutreport) {
//                 await getTaxInvoiceExcelReport(
//                     buildParams("Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_REPORT")
//                 );
//             } else if (options.taxledgerinreport) {
//                 await getTaxInvoiceExcelReport(
//                     buildParams("Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_REPORT")
//                 );
//             }
//         } catch (err: any) {
//             console.error(err);
//             setReportError(err.message || "Failed to generate report.");
//         } finally {
//             setGeneratingExcel(false);
//         }
//     };

//     // ── single handleGenerate ──
//     const handleGenerate = async () => {
//         if (!division[0]?.div_code) {
//             setReportError("Please select a Division before generating.");
//             return;
//         }
//         if (!Object.values(options).some(Boolean)) {
//             setReportError("Please select at least one report option.");
//             return;
//         }

//         setReportError(null);
//         setGenerating(true);

//         const reportMap: { key: keyof typeof options; parameter: string; isSummary: boolean }[] = [
//             {
//                 key: "taxledgeroutreport",
//                 parameter: "Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_REPORT",
//                 isSummary: false,
//             },
//             {
//                 key: "taxledgerinreport",
//                 parameter: "Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_REPORT",
//                 isSummary: false,
//             },
//             {
//                 key: "taxoutsummary",
//                 parameter: "Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_SUMMARY_REPORT",
//                 isSummary: true,
//             },
//             {
//                 key: "taxinsummary",
//                 parameter: "Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_SUMMARY_REPORT",
//                 isSummary: true,
//             },
//         ];

//         const errors: string[] = [];

//         for (const { key, parameter, isSummary } of reportMap) {
//             if (!options[key]) continue;
//             try {
//                 console.log("Generating:", parameter, buildParams(parameter));
//                 await (isSummary ? taxOutInSummaryReport : taxOutInReport)(buildParams(parameter));
//             } catch (err: any) {
//                 console.error(`${key} error:`, err);
//                 errors.push(key);
//             }
//         }

//         setGenerating(false);

//         if (errors.length > 0) {
//             setReportError(`Failed to open: ${errors.join(", ")}`);
//         }
//     };
//     // ── styles ──
//     const thStyle: React.CSSProperties = {
//         padding: "7px 10px", textAlign: "left", fontWeight: 500,
//         fontSize: 11, background: "#185FA5", color: "#fff",
//     };
//     const tdStyle: React.CSSProperties = {
//         padding: "6px 10px", fontSize: 11, borderBottom: "0.5px solid #e5e7eb",
//         whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0,
//     };
//     const rowStyle = (selected: boolean): React.CSSProperties => ({
//         cursor: "pointer",
//         background: selected ? "#E6F1FB" : "transparent",
//         color: selected ? "#0C447C" : "inherit",
//     });
//     const badgeStyle: React.CSSProperties = {
//         background: "#E6F1FB", color: "#0C447C", fontSize: 10,
//         fontWeight: 500, padding: "2px 8px", borderRadius: 20,
//     };
//     const fieldLabelStyle: React.CSSProperties = {
//         fontSize: 11, fontWeight: 500, color: "#6b7280",
//         marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
//     };
//     const inputStyle: React.CSSProperties = {
//         width: "100%", fontSize: 12, padding: "6px 9px",
//         border: "0.5px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827",
//     };

//     const selectedCount = Object.values(options).filter(Boolean).length;

//     return (
//         <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
//             <style>{`
//                 .tab-btn-r { padding: 7px 18px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -0.5px; }
//                 .tab-btn-r.active { color: #185FA5; border-bottom-color: #185FA5; }
//                 .action-btn:hover { background: #f9fafb !important; }
//                 .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
//                 .action-btn-primary:disabled { background: #93c5fd !important; border-color: #93c5fd !important; cursor: not-allowed !important; }
//                 table { width: 100%; border-collapse: collapse; table-layout: fixed; }
//                 tbody tr:last-child td { border-bottom: none !important; }
//                 tbody tr:hover td { background: #f9fafb; }
//                 @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
//             `}</style>

//             <div style={{ maxWidth: 1100, margin: "0 auto" }}>
//                 <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>

//                     {/* ── top filters ── */}
//                     <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, marginBottom: 16, alignItems: "start" }}>
//                         <div style={{ display: "grid", gap: 3 }}>
//                             <div style={{ display: "grid", gridTemplateColumns: "200px 140px 140px", gap: 12, alignItems: "start" }}>
//                                 <div style={{ position: "relative" }}>
//                                     <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: "#fff", padding: "0 4px", zIndex: 1 }}>
//                                         Division
//                                     </span>
//                                     <LookupField
//                                         label=""
//                                         value={division[0]?.div_code || ""}
//                                         displayValue={division[0]?.div_name || ""}
//                                         columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
//                                         valueField="div_code"
//                                         displayFields={["div_code", "div_name"]}
//                                         loadOptions={() => getDynamicLookup({
//                                             parameter: "Account_division",
//                                             code1: user?.company_code,
//                                             loginid: user?.loginid || user?.username || "ADMIN",
//                                         })}
//                                         onChange={(val) => setDivision([{ div_code: val, div_name: "" }])}
//                                     />
//                                 </div>
//                                 <FloatLabelInput label="From" value={dateFrom} type="date" onChange={(e) => setDateFrom(e.target.value)} />
//                                 <FloatLabelInput label="To" value={dateTo} type="date" onChange={(e) => setDateTo(e.target.value)} />
//                             </div>
//                         </div>

//                         {/* Report Options */}
//                         <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", background: "#f9fafb", alignSelf: "stretch" }}>
//                             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
//                                 <span style={fieldLabelStyle}>Report options</span>
//                                 {selectedCount > 0 && <span style={badgeStyle}>{selectedCount} selected</span>}
//                             </div>
//                             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
//                                 {([
//                                     ["taxoutsummary", "Tax Out Summary"],
//                                     ["taxinsummary", "Tax In Summary"],
//                                     ["taxledgeroutreport", "Tax Ledger Out Report"],
//                                     ["taxledgerinreport", "Tax Ledger In Report"],
//                                 ] as [keyof typeof options, string][]).map(([key, label]) => (
//                                     <label key={key} style={{
//                                         display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
//                                         padding: "6px 8px", borderRadius: 6,
//                                         border: `1px solid ${options[key] ? "#185FA5" : "#e5e7eb"}`,
//                                         background: options[key] ? "#E6F1FB" : "#fff",
//                                     }}>
//                                         <input
//                                             type="checkbox"
//                                             checked={options[key]}
//                                             onChange={() => toggleOption(key)}
//                                             style={{ accentColor: "#185FA5", cursor: "pointer", flexShrink: 0 }}
//                                         />
//                                         <span style={{ fontSize: 11, color: options[key] ? "#185FA5" : "#374151", fontWeight: options[key] ? 600 : 400, lineHeight: 1.3 }}>
//                                             {label}
//                                         </span>
//                                     </label>
//                                 ))}
//                             </div>
//                         </div>
//                     </div>

//                     <div style={{ height: "0.5px", background: "#e5e7eb", margin: "4px 0 14px" }} />

//                     {/* ── tabs ── */}
//                     <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 14 }}>
//                         {["acCode", "group"].map((tab) => (
//                             <button key={tab} className={`tab-btn-r ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
//                                 {tab === "acCode" ? "A/c code" : "Group"}
//                             </button>
//                         ))}
//                     </div>

//                     {/* ── account tab ── */}
//                     {activeTab === "acCode" && (
//                         <div>
//                             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
//                                 <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Accounts</span>
//                                 <div style={{ display: "flex", gap: 8 }}>
//                                     {accountLeftSelected.size > 0 && <span style={badgeStyle}>{accountLeftSelected.size} selected</span>}
//                                     <span style={badgeStyle}>{accountLeftItems.length} total</span>
//                                 </div>
//                             </div>
//                             <div style={{ marginBottom: 8 }}>
//                                 <input type="text" placeholder="Search accounts..." value={accountSearchLeft}
//                                     onChange={(e) => setAccountSearchLeft(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
//                             </div>
//                             <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
//                                 <table>
//                                     <thead>
//                                         <tr>
//                                             <th style={{ ...thStyle, width: 36 }}>
//                                                 <input type="checkbox"
//                                                     checked={accountLeftItems.length > 0 && accountLeftItems.every(i => accountLeftSelected.has(i.ac_code))}
//                                                     onChange={() => toggleAllSelection(accountLeftItems, accountLeftSelected, setAccountLeftSelected, "ac_code")}
//                                                     style={{ accentColor: "#fff", cursor: "pointer" }} />
//                                             </th>
//                                             <th style={{ ...thStyle, width: 100 }}>A/c code</th>
//                                             <th style={thStyle}>Description</th>
//                                         </tr>
//                                     </thead>
//                                     <tbody>
//                                         {filteredAccountLeft.map((row) => (
//                                             <tr key={row.ac_code} style={rowStyle(accountLeftSelected.has(row.ac_code))}
//                                                 onClick={() => toggleSelection(row.ac_code, setAccountLeftSelected)}>
//                                                 <td style={{ ...tdStyle, width: 36 }}>
//                                                     <input type="checkbox" checked={accountLeftSelected.has(row.ac_code)}
//                                                         onChange={() => toggleSelection(row.ac_code, setAccountLeftSelected)}
//                                                         onClick={(e) => e.stopPropagation()}
//                                                         style={{ accentColor: "#185FA5", cursor: "pointer" }} />
//                                                 </td>
//                                                 <td style={tdStyle}>{row.ac_code}</td>
//                                                 <td style={tdStyle}>{row.ac_name}</td>
//                                             </tr>
//                                         ))}
//                                     </tbody>
//                                 </table>
//                             </div>
//                         </div>
//                     )}

//                     {/* ── group tab ── */}
//                     {activeTab === "group" && (
//                         <div>
//                             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
//                                 <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Groups</span>
//                                 <div style={{ display: "flex", gap: 8 }}>
//                                     {groupLeftSelected.size > 0 && <span style={badgeStyle}>{groupLeftSelected.size} selected</span>}
//                                     <span style={badgeStyle}>{groupLeftItems.length} total</span>
//                                 </div>
//                             </div>
//                             <div style={{ marginBottom: 8 }}>
//                                 <input type="text" placeholder="Search groups..." value={groupSearchLeft}
//                                     onChange={(e) => setGroupSearchLeft(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
//                             </div>
//                             <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
//                                 <table>
//                                     <thead>
//                                         <tr>
//                                             <th style={{ ...thStyle, width: 36 }}>
//                                                 <input type="checkbox"
//                                                     checked={groupLeftItems.length > 0 && groupLeftItems.every(i => groupLeftSelected.has(i.l4_code))}
//                                                     onChange={() => toggleAllSelection(groupLeftItems, groupLeftSelected, setGroupLeftSelected, "l4_code")}
//                                                     style={{ accentColor: "#fff", cursor: "pointer" }} />
//                                             </th>
//                                             <th style={{ ...thStyle, width: 100 }}>L4 code</th>
//                                             <th style={thStyle}>Description</th>
//                                         </tr>
//                                     </thead>
//                                     <tbody>
//                                         {filteredGroupLeft.map((row) => (
//                                             <tr key={row.l4_code} style={rowStyle(groupLeftSelected.has(row.l4_code))}
//                                                 onClick={() => toggleSelection(row.l4_code, setGroupLeftSelected)}>
//                                                 <td style={{ ...tdStyle, width: 36 }}>
//                                                     <input type="checkbox" checked={groupLeftSelected.has(row.l4_code)}
//                                                         onChange={() => toggleSelection(row.l4_code, setGroupLeftSelected)}
//                                                         onClick={(e) => e.stopPropagation()}
//                                                         style={{ accentColor: "#185FA5", cursor: "pointer" }} />
//                                                 </td>
//                                                 <td style={tdStyle}>{row.l4_code}</td>
//                                                 <td style={tdStyle}>{row.description}</td>
//                                             </tr>
//                                         ))}
//                                     </tbody>
//                                 </table>
//                             </div>
//                         </div>
//                     )}

//                     {/* ── error banner ── */}
//                     {reportError && (
//                         <div style={{ marginTop: 12, padding: "8px 14px", background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: 6, fontSize: 12, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
//                             <span>⚠</span> {reportError}
//                         </div>
//                     )}

//                     {/* ── action bar ── */}
//                     <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "0.5px solid #e5e7eb" }}>
//                         <button className="action-btn" onClick={handleReset}
//                             style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}>
//                             <RotateCcw size={13} /> Reset
//                         </button>
//                         <button className="act-btn" onClick={handleExportExcel}
//                             style={{ padding: "7px 16px", border: "0.5px solid #abcae9", background: "#d2dfee", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#3a3636", opacity: generating ? 0.75 : 1 }}>

//                             {generatingExcel && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
//                             {!generatingExcel && (
//                                 <Download size={13} />

//                             )}
//                             Export Excel
//                         </button>
//                         <div style={{ width: "0.5px", background: "#e5e7eb", alignSelf: "stretch" }} />
//                         <button className="action-btn-primary" disabled={generating} onClick={handleGenerate}
//                             style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff", opacity: generating ? 0.75 : 1 }}>
//                             {generating
//                                 ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
//                                 : <><Printer size={13} /> Generate report {selectedCount > 1 ? `(${selectedCount})` : ""}</>
//                             }
//                         </button>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

"use client";

import { useEffect, useState } from "react";
import { FileText, RotateCcw, Printer, Loader2, Download } from "lucide-react";
import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { Division, taxOutInSummaryReport, taxOutInReport, getTaxInvoiceExcelReport, exportTaxInvoiceSummaryExcel } from "../../../api/transactions";
import { FloatLabelInput } from "../../../lib/InputStyle";

export default function TaxReportFilter() {
    const { user } = useAuth();

    const [group, setGroup] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [division, setDivision] = useState<Division[]>([]);
    const [dateFrom, setDateFrom] = useState("2026-05-01");
    const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
    const [activeTab, setActiveTab] = useState("group");
    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
    const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
    const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
    const [accountLeftSelected, setAccountLeftSelected] = useState(new Set<string>());
    const [groupSearchLeft, setGroupSearchLeft] = useState("");
    const [accountSearchLeft, setAccountSearchLeft] = useState("");
    const [generatingExcel, setGeneratingExcel] = useState(false);
    const [options, setOptions] = useState({
        taxoutsummary: true,
        taxinsummary: false,
        taxledgeroutreport: false,
        taxledgerinreport: false,
    });

    const formatDate = (date: string) => {
        if (!date) return "";
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    useEffect(() => {
        if (division[0]?.div_code) {
            fetchGroups();
            fetchAccounts();
        }
    }, [division]);

    const fetchGroups = async () => {
        try {
            const response = await getDynamicLookupaccount({
                parameter: "Account_Report_Group",
                code1: user?.company_code || "",
                code2: division[0]?.div_code || "",
            });
            setGroup(response || []);
            setGroupLeftItems(response || []);
            setGroupLeftSelected(new Set());
        } catch (error) {
            console.error("Group fetch error:", error);
        }
    };

    const fetchAccounts = async () => {
        try {
            const response = await getDynamicLookupaccount({
                parameter: "Account_Report_AC",
                code1: user?.company_code || "",
                code2: division[0]?.div_code || "",
            });
            const uniqueData = Array.from(
                new Map(response.map((item: any) => [item.ac_code, item])).values()
            );
            setAccounts(uniqueData);
            setAccountLeftItems(uniqueData);
        } catch (error) {
            console.error("Accounts fetch error:", error);
        }
    };

    const toggleOption = (key: keyof typeof options) => {
        setOptions((prev) => {
            const next: Record<string, boolean> = {};
            Object.keys(prev).forEach((k) => { next[k] = k === key; });
            return next as typeof options;
        });
        setReportError(null);
    };

    const toggleSelection = (
        code: string,
        setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
    ) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(code) ? next.delete(code) : next.add(code);
            return next;
        });
    };

    const toggleAllSelection = (
        items: any[],
        selected: Set<string>,
        setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
        keyField: string
    ) => {
        const allSelected = items.length > 0 && items.every((item) => selected.has(item[keyField]));
        setSelected(allSelected ? new Set() : new Set(items.map((item) => item[keyField])));
    };

    const filteredGroupLeft = groupLeftItems.filter(
        (item) =>
            item.l4_code?.toLowerCase().includes(groupSearchLeft.toLowerCase()) ||
            item.description?.toLowerCase().includes(groupSearchLeft.toLowerCase())
    );

    const filteredAccountLeft = accountLeftItems.filter(
        (item) =>
            item.ac_code?.toLowerCase().includes(accountSearchLeft.toLowerCase()) ||
            item.ac_name?.toLowerCase().includes(accountSearchLeft.toLowerCase())
    );

    const handleReset = () => {
        setGroupLeftSelected(new Set());
        setAccountLeftSelected(new Set());
        setReportError(null);
    };

    // ── single buildParams — takes parameter string ──
    const buildParams = (parameter: string) => ({
        loginid: user?.loginid || user?.username || "ADMIN",
        code1: user?.company_code || "",
        code2: formatDate(dateFrom),
        code3: formatDate(dateTo),
        code4: groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(",") : "All",
        code5: accountLeftSelected.size > 0 ? Array.from(accountLeftSelected).join(",") : "All",
        code6: division[0]?.div_code || "",
        parameter,
    });
    const handleExportExcel = async () => {
        setReportError(null);
        setGeneratingExcel(true);

        try {
            if (options.taxoutsummary) {
                await exportTaxInvoiceSummaryExcel(
                    buildParams("Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_SUMMARY_REPORT")
                );
            } else if (options.taxinsummary) {
                await exportTaxInvoiceSummaryExcel(
                    buildParams("Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_SUMMARY_REPORT")
                );
            } else if (options.taxledgeroutreport) {
                await getTaxInvoiceExcelReport(
                    buildParams("Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_REPORT")
                );
            } else if (options.taxledgerinreport) {
                await getTaxInvoiceExcelReport(
                    buildParams("Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_REPORT")
                );
            }
        } catch (err: any) {
            console.error(err);
            setReportError(err.message || "Failed to generate report.");
        } finally {
            setGeneratingExcel(false);
        }
    };

    // ── single handleGenerate ──
    const handleGenerate = async () => {
        if (!division[0]?.div_code) {
            setReportError("Please select a Division before generating.");
            return;
        }
        if (!Object.values(options).some(Boolean)) {
            setReportError("Please select at least one report option.");
            return;
        }

        setReportError(null);
        setGenerating(true);

        const reportMap: { key: keyof typeof options; parameter: string; isSummary: boolean }[] = [
            {
                key: "taxledgeroutreport",
                parameter: "Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_REPORT",
                isSummary: false,
            },
            {
                key: "taxledgerinreport",
                parameter: "Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_REPORT",
                isSummary: false,
            },
            {
                key: "taxoutsummary",
                parameter: "Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_SUMMARY_REPORT",
                isSummary: true,
            },
            {
                key: "taxinsummary",
                parameter: "Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_SUMMARY_REPORT",
                isSummary: true,
            },
        ];

        const errors: string[] = [];

        for (const { key, parameter, isSummary } of reportMap) {
            if (!options[key]) continue;
            try {
                console.log("Generating:", parameter, buildParams(parameter));
                await (isSummary ? taxOutInSummaryReport : taxOutInReport)(buildParams(parameter));
            } catch (err: any) {
                console.error(`${key} error:`, err);
                errors.push(key);
            }
        }

        setGenerating(false);

        if (errors.length > 0) {
            setReportError(`Failed to open: ${errors.join(", ")}`);
        }
    };
    // ── styles ──
    const thStyle: React.CSSProperties = {
        padding: "7px 10px", textAlign: "left", fontWeight: 500,
        fontSize: 11, background: "#185FA5", color: "#fff",
    };
    const tdStyle: React.CSSProperties = {
        padding: "6px 10px", fontSize: 11, borderBottom: "0.5px solid #e5e7eb",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0,
    };
    const rowStyle = (selected: boolean): React.CSSProperties => ({
        cursor: "pointer",
        background: selected ? "#E6F1FB" : "transparent",
        color: selected ? "#0C447C" : "inherit",
    });
    const badgeStyle: React.CSSProperties = {
        background: "#E6F1FB", color: "#0C447C", fontSize: 10,
        fontWeight: 500, padding: "2px 8px", borderRadius: 20,
    };
    const fieldLabelStyle: React.CSSProperties = {
        fontSize: 11, fontWeight: 500, color: "#6b7280",
        marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
    };
    const inputStyle: React.CSSProperties = {
        width: "100%", fontSize: 12, padding: "6px 9px",
        border: "0.5px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827",
    };

    const selectedCount = Object.values(options).filter(Boolean).length;

    return (
        <div style={{ background: "#f3f4f6", padding: "10px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .tab-btn-r { padding: 5px 16px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -0.5px; }
                .tab-btn-r.active { color: #185FA5; border-bottom-color: #185FA5; }
                .action-btn:hover { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                .action-btn-primary:disabled { background: #93c5fd !important; border-color: #93c5fd !important; cursor: not-allowed !important; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                tbody tr:last-child td { border-bottom: none !important; }
                tbody tr:hover td { background: #f9fafb; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "14px 20px" }}>

                    {/* ── top filters ── */}
                    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                        {/* Row 1: Division / From / To */}
                        <div style={{ display: "grid", gridTemplateColumns: "340px 340px 340px", gap: 12, alignItems: "start" }}>
                            <div style={{ position: "relative" }}>
                                <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: "#fff", padding: "0 4px", zIndex: 1 }}>
                                    Division
                                </span>
                                <LookupField
                                    label=""
                                    value={division[0]?.div_code || ""}
                                    displayValue={division[0]?.div_name || ""}
                                    columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
                                    valueField="div_code"
                                    displayFields={["div_code", "div_name"]}
                                    loadOptions={() => getDynamicLookup({
                                        parameter: "Account_division",
                                        code1: user?.company_code,
                                        loginid: user?.loginid || user?.username || "ADMIN",
                                    })}
                                    onChange={(val) => setDivision([{ div_code: val, div_name: "" }])}
                                />
                            </div>
                            <FloatLabelInput label="From" value={dateFrom} type="date" onChange={(e) => setDateFrom(e.target.value)} />
                            <FloatLabelInput label="To" value={dateTo} type="date" onChange={(e) => setDateTo(e.target.value)} />
                        </div>

                        {/* Row 2: Report Options — horizontal */}
                        <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", background: "#f9fafb" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={fieldLabelStyle}>Report options</span>
                                {selectedCount > 0 && <span style={badgeStyle}>{selectedCount} selected</span>}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {([
                                    ["taxoutsummary", "Tax Out Summary"],
                                    ["taxinsummary", "Tax In Summary"],
                                    ["taxledgeroutreport", "Tax Ledger Out Report"],
                                    ["taxledgerinreport", "Tax Ledger In Report"],
                                ] as [keyof typeof options, string][]).map(([key, label]) => (
                                    <label key={key} style={{
                                        display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                                        padding: "5px 12px", borderRadius: 6, flex: "1 1 0", whiteSpace: "nowrap",
                                        border: `1px solid ${options[key] ? "#185FA5" : "#e5e7eb"}`,
                                        background: options[key] ? "#E6F1FB" : "#fff",
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={options[key]}
                                            onChange={() => toggleOption(key)}
                                            style={{ accentColor: "#185FA5", cursor: "pointer", flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: 11, color: options[key] ? "#185FA5" : "#374151", fontWeight: options[key] ? 600 : 400, lineHeight: 1.3 }}>
                                            {label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ height: "0.5px", background: "#e5e7eb", margin: "2px 0 8px" }} />

                    {/* ── tabs ── */}
                    <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 8 }}>
                        {["acCode", "group"].map((tab) => (
                            <button key={tab} className={`tab-btn-r ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                                {tab === "acCode" ? "A/c code" : "Group"}
                            </button>
                        ))}
                    </div>

                    {/* ── account tab ── */}
                    {activeTab === "acCode" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Accounts</span>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {accountLeftSelected.size > 0 && <span style={badgeStyle}>{accountLeftSelected.size} selected</span>}
                                    <span style={badgeStyle}>{accountLeftItems.length} total</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                <input type="text" placeholder="Search accounts..." value={accountSearchLeft}
                                    onChange={(e) => setAccountSearchLeft(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
                            </div>
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input type="checkbox"
                                                    checked={accountLeftItems.length > 0 && accountLeftItems.every(i => accountLeftSelected.has(i.ac_code))}
                                                    onChange={() => toggleAllSelection(accountLeftItems, accountLeftSelected, setAccountLeftSelected, "ac_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }} />
                                            </th>
                                            <th style={{ ...thStyle, width: 100 }}>A/c code</th>
                                            <th style={thStyle}>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAccountLeft.map((row) => (
                                            <tr key={row.ac_code} style={rowStyle(accountLeftSelected.has(row.ac_code))}
                                                onClick={() => toggleSelection(row.ac_code, setAccountLeftSelected)}>
                                                <td style={{ ...tdStyle, width: 36 }}>
                                                    <input type="checkbox" checked={accountLeftSelected.has(row.ac_code)}
                                                        onChange={() => toggleSelection(row.ac_code, setAccountLeftSelected)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ accentColor: "#185FA5", cursor: "pointer" }} />
                                                </td>
                                                <td style={tdStyle}>{row.ac_code}</td>
                                                <td style={tdStyle}>{row.ac_name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── group tab ── */}
                    {activeTab === "group" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Groups</span>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {groupLeftSelected.size > 0 && <span style={badgeStyle}>{groupLeftSelected.size} selected</span>}
                                    <span style={badgeStyle}>{groupLeftItems.length} total</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                <input type="text" placeholder="Search groups..." value={groupSearchLeft}
                                    onChange={(e) => setGroupSearchLeft(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
                            </div>
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input type="checkbox"
                                                    checked={groupLeftItems.length > 0 && groupLeftItems.every(i => groupLeftSelected.has(i.l4_code))}
                                                    onChange={() => toggleAllSelection(groupLeftItems, groupLeftSelected, setGroupLeftSelected, "l4_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }} />
                                            </th>
                                            <th style={{ ...thStyle, width: 100 }}>L4 code</th>
                                            <th style={thStyle}>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroupLeft.map((row) => (
                                            <tr key={row.l4_code} style={rowStyle(groupLeftSelected.has(row.l4_code))}
                                                onClick={() => toggleSelection(row.l4_code, setGroupLeftSelected)}>
                                                <td style={{ ...tdStyle, width: 36 }}>
                                                    <input type="checkbox" checked={groupLeftSelected.has(row.l4_code)}
                                                        onChange={() => toggleSelection(row.l4_code, setGroupLeftSelected)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ accentColor: "#185FA5", cursor: "pointer" }} />
                                                </td>
                                                <td style={tdStyle}>{row.l4_code}</td>
                                                <td style={tdStyle}>{row.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── error banner ── */}
                    {reportError && (
                        <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: 6, fontSize: 12, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>⚠</span> {reportError}
                        </div>
                    )}

                    {/* ── action bar ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "0.5px solid #e5e7eb" }}>
                        <button className="action-btn" onClick={handleReset}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button className="act-btn" onClick={handleExportExcel}
                            style={{ padding: "7px 16px", border: "0.5px solid #abcae9", background: "#d2dfee", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#3a3636", opacity: generating ? 0.75 : 1 }}>

                            {generatingExcel && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                            {!generatingExcel && (
                                <Download size={13} />

                            )}
                            Export Excel
                        </button>
                        <div style={{ width: "0.5px", background: "#e5e7eb", alignSelf: "stretch" }} />
                        <button className="action-btn-primary" disabled={generating} onClick={handleGenerate}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff", opacity: generating ? 0.75 : 1 }}>
                            {generating
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                                : <><Printer size={13} /> Generate report {selectedCount > 1 ? `(${selectedCount})` : ""}</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}