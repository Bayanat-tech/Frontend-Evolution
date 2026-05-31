// "use client";

// import { useEffect, useState } from "react";
// import {
//     Search,
//     FileText,
//     RotateCcw,
//     Printer,
//     ChevronRight,
//     ChevronLeft,
//     ChevronsRight,
//     ChevronsLeft,
// } from "lucide-react";

// import { getDynamicLookup, getDynamicLookupaccount, getLookupValue } from "../../../api/lookups";
// import { useAuth } from "../../../state/AuthContext";
// import { LookupField } from "../../../components/ui/LookupField";
// import { Division } from "../../../api/transactions";

// export default function FinanceReportFilter() {
//     const { user } = useAuth();

//     const [group, setGroup] = useState<any[]>([]);
//     const [accounts, setAccounts] = useState<any[]>([]);

//     const [division, setDivision] = useState<Division[]>([]);

//     const [dateFrom, setDateFrom] = useState("2026-05-01");
//     const [dateTo, setDateTo] = useState("2026-05-27");

//     const [amountFrom, setAmountFrom] = useState("0.00");
//     const [amountTo, setAmountTo] = useState("0.00");

//     const [remarks, setRemarks] = useState("");

//     const [filterLedger, setFilterLedger] = useState(false);

//     const [acPayee, setAcPayee] = useState("");

//     const [activeTab, setActiveTab] = useState("group");

//     // GROUP STATES
//     const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
//     const [groupRightItems, setGroupRightItems] = useState<any[]>([]);

//     const [groupLeftSelected, setGroupLeftSelected] = useState(
//         new Set<string>()
//     );

//     const [groupRightSelected, setGroupRightSelected] = useState(
//         new Set<string>()
//     );

//     // ACCOUNT STATES
//     const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
//     const [accountRightItems, setAccountRightItems] = useState<any[]>([]);

//     const [accountLeftSelected, setAccountLeftSelected] = useState(
//         new Set<string>()
//     );

//     const [accountRightSelected, setAccountRightSelected] = useState(
//         new Set<string>()
//     );
// const formatDate = (date: string) => {
//     if (!date) return null;

//     const d = new Date(date);
//     const day = String(d.getDate()).padStart(2, "0");
//     const month = String(d.getMonth() + 1).padStart(2, "0");
//     const year = d.getFullYear();

//     return `${day}-${month}-${year}`;
// };
//     const [options, setOptions] = useState({
//         chequeDateWise: false,
//         chequeBookMonitoring: true,
//         ledgerWithDetails: false,
//         ledgerWithOppositeEntry: false,
//         summaryDump: false,
//         detailDump: false,
//         acPayeeWise: false,
//     });

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

//             console.log("GROUP RESPONSE", response?.length);

//             setGroup(response || []);
//             setGroupLeftItems(response || []);

//             // RESET RIGHT SIDE ALSO
//             setGroupRightItems([]);
//             setGroupLeftSelected(new Set());
//             setGroupRightSelected(new Set());

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
//                 new Map(
//                     response.map((item: any) => [item.ac_code, item])
//                 ).values()
//             );

//             console.log("ORIGINAL", response.length);
//             console.log("UNIQUE", uniqueData.length);

//             setAccounts(uniqueData);
//             setAccountLeftItems(uniqueData);

//         } catch (error) {
//             console.error("Accounts fetch error:", error);
//         }
//     };


//     const toggleOption = (key: keyof typeof options) => {
//         setOptions((prev) => ({
//             ...prev,
//             [key]: !prev[key],
//         }));
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

//     const moveToRight = (
//         leftItems: any[],
//         rightItems: any[],
//         leftSelected: Set<string>,
//         setLeftItems: any,
//         setRightItems: any,
//         setLeftSelected: any
//     ) => {
//         if (leftSelected.size === 0) return;

//         const moving = leftItems.filter((i) =>
//             leftSelected.has(i.l4_code || i.ac_code)
//         );

//         setRightItems([...rightItems, ...moving]);

//         setLeftItems(
//             leftItems.filter(
//                 (i) => !leftSelected.has(i.l4_code || i.ac_code)
//             )
//         );

//         setLeftSelected(new Set());
//     };

//     const moveToLeft = (
//         leftItems: any[],
//         rightItems: any[],
//         rightSelected: Set<string>,
//         setLeftItems: any,
//         setRightItems: any,
//         setRightSelected: any
//     ) => {
//         if (rightSelected.size === 0) return;

//         const moving = rightItems.filter((i) =>
//             rightSelected.has(i.l4_code || i.ac_code)
//         );

//         setLeftItems([...leftItems, ...moving]);

//         setRightItems(
//             rightItems.filter(
//                 (i) => !rightSelected.has(i.l4_code || i.ac_code)
//             )
//         );

//         setRightSelected(new Set());
//     };

//     const moveAllToRight = (
//         leftItems: any[],
//         rightItems: any[],
//         setLeftItems: any,
//         setRightItems: any,
//         setLeftSelected: any
//     ) => {
//         setRightItems([...rightItems, ...leftItems]);

//         setLeftItems([]);

//         setLeftSelected(new Set());
//     };

//     const moveAllToLeft = (
//         leftItems: any[],
//         rightItems: any[],
//         setLeftItems: any,
//         setRightItems: any,
//         setRightSelected: any
//     ) => {
//         setLeftItems([...leftItems, ...rightItems]);

//         setRightItems([]);

//         setRightSelected(new Set());
//     };

//     return (
//         <div
//             style={{
//                 fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
//                 background: "#f0ede8",
//                 minHeight: "100vh",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 padding: "32px 16px",
//             }}
//         >
//             <style>{`
//         * {
//           box-sizing: border-box;
//         }

//         .panel {
//           background: #faf9f7;
//           border: 1.5px solid #c8c2b8;
//           border-radius: 2px;
//         }

//         .section-label {
//           font-size: 11px;
//           font-weight: 700;
//           letter-spacing: 0.1em;
//           text-transform: uppercase;
//           color: #1a3a6b;
//           margin-bottom: 10px;
//         }

//         .input-base {
//           font-size: 12px;
//           background: #fff;
//           border: 1px solid #c4bfb8;
//           padding: 5px 8px;
//           width: 100%;
//         }

//         .input-with-icon {
//           display: flex;
//           align-items: center;
//           gap: 4px;
//         }

//         .input-with-icon input {
//           flex: 1;
//         }

//         .search-btn {
//           background: #e8e4dd;
//           border: 1px solid #c4bfb8;
//           padding: 5px 7px;
//           cursor: pointer;
//         }

//         .checkbox-row {
//           display: flex;
//           align-items: center;
//           gap: 7px;
//           margin-bottom: 7px;
//         }

//         .tab-bar {
//           display: flex;
//           border-bottom: 1px solid #c8c2b8;
//         }

//         .tab-btn {
//           padding: 7px 16px;
//           border: none;
//           background: none;
//           cursor: pointer;
//           color: #888;
//         }

//         .tab-btn.active {
//           color: #1a3a6b;
//           font-weight: 600;
//           border-bottom: 2px solid #1a3a6b;
//         }

//         .table-container {
//           border: 1px solid #c8c2b8;
//           overflow: hidden;
//         }

//         .l4-table {
//           width: 100%;
//           border-collapse: collapse;
//           font-size: 11px;
//         }

//         .l4-table thead tr {
//           background: #1a3a6b;
//           color: white;
//         }

//         .l4-table th,
//         .l4-table td {
//           padding: 7px 10px;
//           border-bottom: 1px solid #ddd;
//         }

//         .l4-table tbody tr {
//           cursor: pointer;
//         }

//         .l4-table tbody tr.selected {
//           background: #1a3a6b;
//           color: white;
//         }

//         .transfer-col {
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           justify-content: center;
//           gap: 8px;
//         }

//         .transfer-btn {
//           width: 34px;
//           height: 34px;
//           border: 1px solid #c4bfb8;
//           background: white;
//           cursor: pointer;
//         }

//         .action-bar {
//           display: flex;
//           justify-content: flex-end;
//           gap: 8px;
//           margin-top: 20px;
//         }

//         .btn {
//           padding: 7px 18px;
//           border: 1px solid #c4bfb8;
//           background: white;
//           cursor: pointer;
//           display: flex;
//           align-items: center;
//           gap: 6px;
//         }

//         .btn-primary {
//           background: #1a3a6b;
//           color: white;
//         }

//         .box-label {
//           display: flex;
//           justify-content: space-between;
//           margin-bottom: 5px;
//           font-size: 10px;
//         }

//         .badge {
//           background: #1a3a6b;
//           color: white;
//           padding: 2px 8px;
//           border-radius: 10px;
//         }
//       `}</style>

//             <div style={{ width: "100%", maxWidth: 1120 }}>
//                 <div className="panel" style={{ padding: "24px 28px" }}>
//                     {/* TOP SECTION */}

//                     <div
//                         style={{
//                             display: "grid",
//                             gridTemplateColumns: "220px 1fr auto",
//                             gap: 24,
//                             marginBottom: 24,
//                         }}
//                     >
//                         {/* DIVISION + DATE */}

//                         <div>
//                             <div className="section-label">Division</div>

//                             <LookupField

//                                 label="Division *"
//                                 value={division[0]?.div_code || ""}
//                                 displayValue={division[0]?.div_name || ""}
//                                 columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
//                                 valueField="div_code"
//                                 displayFields={["div_code", "div_name"]}
//                                 // loadOptions={() => getDocAccounts(docType, "H", form.div_code)}
//                                 loadOptions={() => getDynamicLookup({
//                                     parameter: "Account_division",
//                                     code1: user?.company_code,
//                                     loginid: user?.loginid || user?.username || "ADMIN"
//                                 })}

//                                 onChange={(val, displayVal) => {
//                                     setDivision([
//                                         {
//                                             div_code: val,
//                                             div_name: "",
//                                         },
//                                     ]);
//                                 }}

//                             />

//                             <div className="section-label">Date Range</div>

//                             <div
//                                 style={{
//                                     display: "grid",
//                                     gridTemplateColumns: "40px 1fr",
//                                     gap: "6px 8px",
//                                 }}
//                             >
//                                 <span>From</span>

//                                 <input
//                                     type="date"
//                                     className="input-base"
//                                     value={dateFrom}
//                                     onChange={(e) => setDateFrom(e.target.value)}
//                                 />

//                                 <span>To</span>

//                                 <input
//                                     type="date"
//                                     className="input-base"
//                                     value={dateTo}
//                                     onChange={(e) => setDateTo(e.target.value)}
//                                 />
//                             </div>
//                         </div>

//                         {/* FILTER */}

//                         <div>
//                             <div className="section-label">Filter</div>

//                             <div
//                                 style={{
//                                     display: "grid",
//                                     gridTemplateColumns: "120px 1fr",
//                                     gap: "8px 10px",
//                                 }}
//                             >
//                                 <span>Amount From:</span>

//                                 <input
//                                     className="input-base"
//                                     value={amountFrom}
//                                     onChange={(e) => setAmountFrom(e.target.value)}
//                                 />

//                                 <span>Amount To:</span>

//                                 <input
//                                     className="input-base"
//                                     value={amountTo}
//                                     onChange={(e) => setAmountTo(e.target.value)}
//                                 />

//                                 <span>Remarks:</span>

//                                 <input
//                                     className="input-base"
//                                     value={remarks}
//                                     onChange={(e) => setRemarks(e.target.value)}
//                                 />

//                                 <span></span>

//                                 <label className="checkbox-row">
//                                     <input
//                                         type="checkbox"
//                                         checked={filterLedger}
//                                         onChange={() =>
//                                             setFilterLedger(!filterLedger)
//                                         }
//                                     />

//                                     <span>Filter Ledger</span>
//                                 </label>
//                             </div>
//                         </div>

//                         {/* OPTIONS */}

//                         <div>
//                             <div className="section-label">Report Options</div>

//                             {[
//                                 ["chequeDateWise", "Cheque Date wise"],
//                                 ["chequeBookMonitoring", "Cheque Book Monitoring"],
//                                 ["ledgerWithDetails", "Ledger With Details"],
//                                 [
//                                     "ledgerWithOppositeEntry",
//                                     "Ledger With Opposite Entry",
//                                 ],
//                                 ["summaryDump", "Summary Dump"],
//                                 ["detailDump", "Detail Dump"],
//                                 ["acPayeeWise", "A/c Payee wise"],
//                             ].map(([key, label]) => (
//                                 <label className="checkbox-row" key={key}>
//                                     <input
//                                         type="checkbox"
//                                         checked={
//                                             options[key as keyof typeof options]
//                                         }
//                                         onChange={() =>
//                                             toggleOption(
//                                                 key as keyof typeof options
//                                             )
//                                         }
//                                     />

//                                     <span>{label}</span>
//                                 </label>
//                             ))}
//                         </div>
//                     </div>

//                     {/* A/C PAYEE */}

//                     <div
//                         style={{
//                             display: "flex",
//                             justifyContent: "flex-end",
//                             marginBottom: 20,
//                             gap: 10,
//                             alignItems: "center",
//                         }}
//                     >


//                         <div
//                             className="input-with-icon"
//                             style={{ width: 340 }}
//                         >
//                             <LookupField
//                                 label="Ac Payee "
//                                 value={acPayee}
//                                 displayValue={acPayee}
//                                 columns={[
//                                     { field: "ac_payee", header: "Payee" },
//                                     { field: "ac_ref", header: "Reference" }
//                                 ]}
//                                 valueField="ac_payee"
//                                 displayFields={["ac_payee", "ac_ref"]}
//                                 loadOptions={() =>
//                                     getDynamicLookupaccount({
//                                         parameter: "Account_Report_AC_PAYEE",
//                                         code1: user?.company_code,
//                                         loginid: user?.loginid || user?.username || "ADMIN"
//                                     })
//                                 }
//                                 onChange={(val) => {
//                                     setAcPayee(val);
//                                 }}
//                             />
//                             o
//                         </div>
//                     </div>

//                     {/* TABS */}

//                     <div className="tab-bar" style={{ marginBottom: 14 }}>
//                         <button
//                             className={`tab-btn ${activeTab === "group" ? "active" : ""
//                                 }`}
//                             onClick={() => setActiveTab("group")}
//                         >
//                             Group
//                         </button>

//                         <button
//                             className={`tab-btn ${activeTab === "acCode" ? "active" : ""
//                                 }`}
//                             onClick={() => setActiveTab("acCode")}
//                         >
//                             A/c Code
//                         </button>
//                     </div>

//                     {/* GROUP TAB */}

//                     {activeTab === "group" && (
//                         <div
//                             style={{
//                                 display: "grid",
//                                 gridTemplateColumns: "1fr 52px 1fr",
//                                 gap: 10,
//                             }}
//                         >
//                             {/* LEFT */}

//                             <div>
//                                 <div className="box-label">
//                                     <span>Available Groups</span>

//                                     <span className="badge">
//                                         {groupLeftItems.length}
//                                     </span>
//                                 </div>

//                                 <div
//                                     className="table-container"
//                                     style={{ height: 220, overflowY: "auto" }}
//                                 >
//                                     <table className="l4-table">
//                                         <thead>
//                                             <tr>
//                                                 <th>L4 Code</th>
//                                                 <th>Description</th>
//                                             </tr>
//                                         </thead>

//                                         <tbody>
//                                             {groupLeftItems.map((row) => (
//                                                 <tr
//                                                     key={row.l4_code}
//                                                     className={
//                                                         groupLeftSelected.has(
//                                                             row.l4_code
//                                                         )
//                                                             ? "selected"
//                                                             : ""
//                                                     }
//                                                     onClick={() =>
//                                                         toggleSelection(
//                                                             row.l4_code,
//                                                             setGroupLeftSelected
//                                                         )
//                                                     }
//                                                 >
//                                                     <td>{row.l4_code}</td>
//                                                     <td>{row.description}</td>
//                                                 </tr>
//                                             ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>

//                             {/* BUTTONS */}

//                             <div className="transfer-col">
//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveAllToRight(
//                                             groupLeftItems,
//                                             groupRightItems,
//                                             setGroupLeftItems,
//                                             setGroupRightItems,
//                                             setGroupLeftSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronsRight size={15} />
//                                 </button>

//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveToRight(
//                                             groupLeftItems,
//                                             groupRightItems,
//                                             groupLeftSelected,
//                                             setGroupLeftItems,
//                                             setGroupRightItems,
//                                             setGroupLeftSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronRight size={15} />
//                                 </button>

//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveToLeft(
//                                             groupLeftItems,
//                                             groupRightItems,
//                                             groupRightSelected,
//                                             setGroupLeftItems,
//                                             setGroupRightItems,
//                                             setGroupRightSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronLeft size={15} />
//                                 </button>

//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveAllToLeft(
//                                             groupLeftItems,
//                                             groupRightItems,
//                                             setGroupLeftItems,
//                                             setGroupRightItems,
//                                             setGroupRightSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronsLeft size={15} />
//                                 </button>
//                             </div>

//                             {/* RIGHT */}

//                             <div>
//                                 <div className="box-label">
//                                     <span>Selected Groups</span>

//                                     <span className="badge">
//                                         {groupRightItems.length}
//                                     </span>
//                                 </div>

//                                 <div
//                                     className="table-container"
//                                     style={{ height: 220, overflowY: "auto" }}
//                                 >
//                                     <table className="l4-table">
//                                         <thead>
//                                             <tr>
//                                                 <th>L4 Code</th>
//                                                 <th>Description</th>
//                                             </tr>
//                                         </thead>

//                                         <tbody>
//                                             {groupRightItems.map((row) => (
//                                                 <tr
//                                                     key={row.l4_code}
//                                                     className={
//                                                         groupRightSelected.has(
//                                                             row.l4_code
//                                                         )
//                                                             ? "selected"
//                                                             : ""
//                                                     }
//                                                     onClick={() =>
//                                                         toggleSelection(
//                                                             row.l4_code,
//                                                             setGroupRightSelected
//                                                         )
//                                                     }
//                                                 >
//                                                     <td>{row.l4_code}</td>
//                                                     <td>{row.description}</td>
//                                                 </tr>
//                                             ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                         </div>
//                     )}

//                     {/* ACCOUNT TAB */}

//                     {activeTab === "acCode" && (
//                         <div
//                             style={{
//                                 display: "grid",
//                                 gridTemplateColumns: "1fr 52px 1fr",
//                                 gap: 10,
//                             }}
//                         >
//                             {/* LEFT */}

//                             <div>
//                                 <div className="box-label">
//                                     <span>Available Accounts</span>

//                                     <span className="badge">
//                                         {accountLeftItems.length}
//                                     </span>
//                                 </div>

//                                 <div
//                                     className="table-container"
//                                     style={{ height: 220, overflowY: "auto" }}
//                                 >
//                                     <table className="l4-table">
//                                         <thead>
//                                             <tr>
//                                                 <th>A/c Code</th>
//                                                 <th>Description</th>
//                                             </tr>
//                                         </thead>

//                                         <tbody>
//                                             {accountLeftItems.map((row) => (
//                                                 <tr
//                                                     key={row.ac_code}
//                                                     className={
//                                                         accountLeftSelected.has(
//                                                             row.ac_code
//                                                         )
//                                                             ? "selected"
//                                                             : ""
//                                                     }
//                                                     onClick={() =>
//                                                         toggleSelection(
//                                                             row.ac_code,
//                                                             setAccountLeftSelected
//                                                         )
//                                                     }
//                                                 >
//                                                     <td>{row.ac_code}</td>
//                                                     <td>{row.ac_name}</td>
//                                                 </tr>
//                                             ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>

//                             {/* BUTTONS */}

//                             <div className="transfer-col">
//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveAllToRight(
//                                             accountLeftItems,
//                                             accountRightItems,
//                                             setAccountLeftItems,
//                                             setAccountRightItems,
//                                             setAccountLeftSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronsRight size={15} />
//                                 </button>

//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveToRight(
//                                             accountLeftItems,
//                                             accountRightItems,
//                                             accountLeftSelected,
//                                             setAccountLeftItems,
//                                             setAccountRightItems,
//                                             setAccountLeftSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronRight size={15} />
//                                 </button>

//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveToLeft(
//                                             accountLeftItems,
//                                             accountRightItems,
//                                             accountRightSelected,
//                                             setAccountLeftItems,
//                                             setAccountRightItems,
//                                             setAccountRightSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronLeft size={15} />
//                                 </button>

//                                 <button
//                                     className="transfer-btn"
//                                     onClick={() =>
//                                         moveAllToLeft(
//                                             accountLeftItems,
//                                             accountRightItems,
//                                             setAccountLeftItems,
//                                             setAccountRightItems,
//                                             setAccountRightSelected
//                                         )
//                                     }
//                                 >
//                                     <ChevronsLeft size={15} />
//                                 </button>
//                             </div>

//                             {/* RIGHT */}

//                             <div>
//                                 <div className="box-label">
//                                     <span>Selected Accounts</span>

//                                     <span className="badge">
//                                         {accountRightItems.length}
//                                     </span>
//                                 </div>

//                                 <div
//                                     className="table-container"
//                                     style={{ height: 220, overflowY: "auto" }}
//                                 >
//                                     <table className="l4-table">
//                                         <thead>
//                                             <tr>
//                                                 <th>A/c Code</th>
//                                                 <th>Description</th>
//                                             </tr>
//                                         </thead>

//                                         <tbody>
//                                             {accountRightItems.map((row) => (
//                                                 <tr
//                                                     key={row.ac_code}
//                                                     className={
//                                                         accountRightSelected.has(
//                                                             row.ac_code
//                                                         )
//                                                             ? "selected"
//                                                             : ""
//                                                     }
//                                                     onClick={() =>
//                                                         toggleSelection(
//                                                             row.ac_code,
//                                                             setAccountRightSelected
//                                                         )
//                                                     }
//                                                 >
//                                                     <td>{row.ac_code}</td>
//                                                     <td>{row.ac_name}</td>
//                                                 </tr>
//                                             ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                         </div>
//                     )}

//                     {/* ACTIONS */}

//                     <div className="action-bar">
//                         <button className="btn">
//                             <RotateCcw size={13} /> Reset
//                         </button>

//                         <button className="btn">
//                             <FileText size={13} /> Export
//                         </button>

//                         <button
//                             className="btn btn-primary"
//                             onClick={() => {
//                                 const selectedAccounts = accountRightItems
//                                     .map((item) => item.ac_code)
//                                     .join(",");

//                                 const selectedGroups = groupRightItems
//                                     .map((item) => item.l4_code)
//                                     .join(",");

//                                 console.log({
//                                     code1: user?.company_code,
//                                     code2: division[0]?.div_code,
//                                     code3: selectedAccounts,
//                                     code4: selectedGroups,
//                                 });

//                                 getDynamicLookupaccount({
//                                     parameter: "Account_Report_Transaction",

//                                     code1: user?.company_code || "",
//                                     code2: division[0]?.div_code || "",

//                                     // AC_CODE
//                                     code3: selectedAccounts || "All",

//                                     // L4_CODE
//                                     code4: selectedGroups || "All",
//                                     code5: String(formatDate(dateFrom)),
//                                     code6: String(formatDate(dateTo)),


//                                     loginid:
//                                         user?.loginid ||
//                                         user?.username ||
//                                         "ADMIN",
//                                 });
//                             }}
//                         >
//                             <Printer size={13} /> Generate Report
//                         </button>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

"use client";

import { useEffect, useState } from "react";
import {
    FileText,
    RotateCcw,
    Printer,
    ChevronRight,
    ChevronLeft,
    ChevronsRight,
    ChevronsLeft,
    BarChart2,
} from "lucide-react";

import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { Division } from "../../../api/transactions";

export default function FinanceReportFilter() {
    const { user } = useAuth();

    const [group, setGroup] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [division, setDivision] = useState<Division[]>([]);
    const [dateFrom, setDateFrom] = useState("2026-05-01");
    const [dateTo, setDateTo] = useState("2026-05-27");
    const [amountFrom, setAmountFrom] = useState("0.00");
    const [amountTo, setAmountTo] = useState("0.00");
    const [remarks, setRemarks] = useState("");
    const [filterLedger, setFilterLedger] = useState(false);
    const [acPayee, setAcPayee] = useState("");
    const [activeTab, setActiveTab] = useState("group");

    const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
    const [groupRightItems, setGroupRightItems] = useState<any[]>([]);
    const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
    const [groupRightSelected, setGroupRightSelected] = useState(new Set<string>());

    const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
    const [accountRightItems, setAccountRightItems] = useState<any[]>([]);
    const [accountLeftSelected, setAccountLeftSelected] = useState(new Set<string>());
    const [accountRightSelected, setAccountRightSelected] = useState(new Set<string>());

    const formatDate = (date: string) => {
        if (!date) return null;
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const [options, setOptions] = useState({
        chequeDateWise: false,
        chequeBookMonitoring: true,
        ledgerWithDetails: false,
        ledgerWithOppositeEntry: false,
        summaryDump: false,
        detailDump: false,
        acPayeeWise: false,
    });

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
            setGroupRightItems([]);
            setGroupLeftSelected(new Set());
            setGroupRightSelected(new Set());
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
        setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
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

    const moveToRight = (
        leftItems: any[], rightItems: any[], leftSelected: Set<string>,
        setLeftItems: any, setRightItems: any, setLeftSelected: any
    ) => {
        if (leftSelected.size === 0) return;
        const moving = leftItems.filter((i) => leftSelected.has(i.l4_code || i.ac_code));
        setRightItems([...rightItems, ...moving]);
        setLeftItems(leftItems.filter((i) => !leftSelected.has(i.l4_code || i.ac_code)));
        setLeftSelected(new Set());
    };

    const moveToLeft = (
        leftItems: any[], rightItems: any[], rightSelected: Set<string>,
        setLeftItems: any, setRightItems: any, setRightSelected: any
    ) => {
        if (rightSelected.size === 0) return;
        const moving = rightItems.filter((i) => rightSelected.has(i.l4_code || i.ac_code));
        setLeftItems([...leftItems, ...moving]);
        setRightItems(rightItems.filter((i) => !rightSelected.has(i.l4_code || i.ac_code)));
        setRightSelected(new Set());
    };

    const moveAllToRight = (
        leftItems: any[], rightItems: any[],
        setLeftItems: any, setRightItems: any, setLeftSelected: any
    ) => {
        setRightItems([...rightItems, ...leftItems]);
        setLeftItems([]);
        setLeftSelected(new Set());
    };

    const moveAllToLeft = (
        leftItems: any[], rightItems: any[],
        setLeftItems: any, setRightItems: any, setRightSelected: any
    ) => {
        setLeftItems([...leftItems, ...rightItems]);
        setRightItems([]);
        setRightSelected(new Set());
    };

    const handleReset = () => {
        setGroupLeftItems([...groupLeftItems, ...groupRightItems]);
        setGroupRightItems([]);
        setGroupLeftSelected(new Set());
        setGroupRightSelected(new Set());
        setAccountLeftItems([...accountLeftItems, ...accountRightItems]);
        setAccountRightItems([]);
        setAccountLeftSelected(new Set());
        setAccountRightSelected(new Set());
    };

    // ── shared table styles ────────────────────────────────────────────────
    const thStyle: React.CSSProperties = {
        padding: "7px 10px",
        textAlign: "left",
        fontWeight: 500,
        fontSize: 11,
        background: "#185FA5",
        color: "#fff",
    };

    const tdStyle: React.CSSProperties = {
        padding: "6px 10px",
        fontSize: 11,
        borderBottom: "0.5px solid #e5e7eb",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 0,
    };

    const rowStyle = (selected: boolean): React.CSSProperties => ({
        cursor: "pointer",
        background: selected ? "#E6F1FB" : "transparent",
        color: selected ? "#0C447C" : "inherit",
    });

    const transferBtnStyle: React.CSSProperties = {
        width: 32,
        height: 32,
        border: "0.5px solid #d1d5db",
        background: "#fff",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#6b7280",
    };

    const badgeStyle: React.CSSProperties = {
        background: "#E6F1FB",
        color: "#0C447C",
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 20,
    };

    const fieldLabelStyle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 500,
        color: "#6b7280",
        marginBottom: 5,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        fontSize: 12,
        padding: "6px 9px",
        border: "0.5px solid #d1d5db",
        borderRadius: 6,
        background: "#fff",
        color: "#111827",
    };

    const checkRowStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 7,
        fontSize: 12,
        cursor: "pointer",
    };

    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .tf-btn:hover { background: #f0f7ff !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .tab-btn-r { padding: 7px 18px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -0.5px; }
                .tab-btn-r.active { color: #185FA5; border-bottom-color: #185FA5; }
                .action-btn:hover { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                tbody tr:last-child td { border-bottom: none !important; }
                tbody tr:hover td { background: #f9fafb; }
            `}</style>

            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                <div style={{
                    background: "#fff",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "20px 24px",
                }}>
                    {/* ── page title ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>Finance report filter</span>
                    </div>

                    {/* ── top 3-col grid ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 190px", gap: 20, marginBottom: 16 }}>

                        {/* col 1 – division + date */}
                        <div>
                            <div style={{ ...fieldLabelStyle, marginBottom: 6 }}>Division</div>
                            <div style={{ marginBottom: 14 }}>
                                <LookupField
                                    label="Division *"
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
                                    onChange={(val) => {
                                        setDivision([{ div_code: val, div_name: "" }]);
                                    }}
                                />
                            </div>

                            <div style={fieldLabelStyle}>Date range</div>
                            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", alignItems: "center", gap: "6px 8px" }}>
                                <span style={{ fontSize: 12, color: "#6b7280" }}>From</span>
                                <input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                <span style={{ fontSize: 12, color: "#6b7280" }}>To</span>
                                <input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                            </div>
                        </div>

                        {/* col 2 – filters + payee */}
                        <div>
                            <div style={fieldLabelStyle}>Filters</div>
                            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "7px 10px", alignItems: "center", marginBottom: 14 }}>
                                <span style={{ fontSize: 12, color: "#6b7280" }}>Amount from</span>
                                <input style={inputStyle} value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} />
                                <span style={{ fontSize: 12, color: "#6b7280" }}>Amount to</span>
                                <input style={inputStyle} value={amountTo} onChange={(e) => setAmountTo(e.target.value)} />
                                <span style={{ fontSize: 12, color: "#6b7280" }}>Remarks</span>
                                <input style={inputStyle} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                                <span />
                                <label style={{ ...checkRowStyle, margin: 0 }}>
                                    <input type="checkbox" checked={filterLedger} onChange={() => setFilterLedger(!filterLedger)} style={{ accentColor: "#185FA5" }} />
                                    <span style={{ fontSize: 12 }}>Filter ledger</span>
                                </label>
                            </div>

                            <div style={{ height: "0.5px", background: "#e5e7eb", margin: "14px 0" }} />

                            <div style={fieldLabelStyle}>A/c payee</div>
                            <LookupField
                                label="Ac Payee"
                                value={acPayee}
                                displayValue={acPayee}
                                columns={[{ field: "ac_payee", header: "Payee" }, { field: "ac_ref", header: "Reference" }]}
                                valueField="ac_payee"
                                displayFields={["ac_payee", "ac_ref"]}
                                loadOptions={() =>
                                    getDynamicLookupaccount({
                                        parameter: "Account_Report_AC_PAYEE",
                                        code1: user?.company_code,
                                        loginid: user?.loginid || user?.username || "ADMIN",
                                    })
                                }
                                onChange={(val) => setAcPayee(val)}
                            />
                        </div>

                        {/* col 3 – options */}
                        <div>
                            <div style={fieldLabelStyle}>Report options</div>
                            {([
                                ["chequeDateWise", "Cheque date wise"],
                                ["chequeBookMonitoring", "Cheque book monitoring"],
                                ["ledgerWithDetails", "Ledger with details"],
                                ["ledgerWithOppositeEntry", "Ledger with opposite entry"],
                                ["summaryDump", "Summary dump"],
                                ["detailDump", "Detail dump"],
                                ["acPayeeWise", "A/c payee wise"],
                            ] as [keyof typeof options, string][]).map(([key, label]) => (
                                <label key={key} style={checkRowStyle}>
                                    <input
                                        type="checkbox"
                                        checked={options[key]}
                                        onChange={() => toggleOption(key)}
                                        style={{ accentColor: "#185FA5" }}
                                    />
                                    <span style={{ fontSize: 12 }}>{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* ── divider ── */}
                    <div style={{ height: "0.5px", background: "#e5e7eb", margin: "4px 0 14px" }} />

                    {/* ── tabs ── */}
                    <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 14 }}>
                        {["group", "acCode"].map((tab) => (
                            <button
                                key={tab}
                                className={`tab-btn-r ${activeTab === tab ? "active" : ""}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === "group" ? "Group" : "A/c code"}
                            </button>
                        ))}
                    </div>

                    {/* ── group tab ── */}
                    {activeTab === "group" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 10 }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available groups</span>
                                    <span style={badgeStyle}>{groupLeftItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>L4 code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {groupLeftItems.map((row) => (
                                                <tr key={row.l4_code} style={rowStyle(groupLeftSelected.has(row.l4_code))} onClick={() => toggleSelection(row.l4_code, setGroupLeftSelected)}>
                                                    <td style={tdStyle}>{row.l4_code}</td>
                                                    <td style={tdStyle}>{row.description}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 28 }}>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToRight(groupLeftItems, groupRightItems, setGroupLeftItems, setGroupRightItems, setGroupLeftSelected)}><ChevronsRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToRight(groupLeftItems, groupRightItems, groupLeftSelected, setGroupLeftItems, setGroupRightItems, setGroupLeftSelected)}><ChevronRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToLeft(groupLeftItems, groupRightItems, groupRightSelected, setGroupLeftItems, setGroupRightItems, setGroupRightSelected)}><ChevronLeft size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToLeft(groupLeftItems, groupRightItems, setGroupLeftItems, setGroupRightItems, setGroupRightSelected)}><ChevronsLeft size={14} /></button>
                            </div>

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected groups</span>
                                    <span style={badgeStyle}>{groupRightItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>L4 code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {groupRightItems.map((row) => (
                                                <tr key={row.l4_code} style={rowStyle(groupRightSelected.has(row.l4_code))} onClick={() => toggleSelection(row.l4_code, setGroupRightSelected)}>
                                                    <td style={tdStyle}>{row.l4_code}</td>
                                                    <td style={tdStyle}>{row.description}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── account tab ── */}
                    {activeTab === "acCode" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 10 }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available accounts</span>
                                    <span style={badgeStyle}>{accountLeftItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>A/c code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {accountLeftItems.map((row) => (
                                                <tr key={row.ac_code} style={rowStyle(accountLeftSelected.has(row.ac_code))} onClick={() => toggleSelection(row.ac_code, setAccountLeftSelected)}>
                                                    <td style={tdStyle}>{row.ac_code}</td>
                                                    <td style={tdStyle}>{row.ac_name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 28 }}>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToRight(accountLeftItems, accountRightItems, setAccountLeftItems, setAccountRightItems, setAccountLeftSelected)}><ChevronsRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToRight(accountLeftItems, accountRightItems, accountLeftSelected, setAccountLeftItems, setAccountRightItems, setAccountLeftSelected)}><ChevronRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToLeft(accountLeftItems, accountRightItems, accountRightSelected, setAccountLeftItems, setAccountRightItems, setAccountRightSelected)}><ChevronLeft size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToLeft(accountLeftItems, accountRightItems, setAccountLeftItems, setAccountRightItems, setAccountRightSelected)}><ChevronsLeft size={14} /></button>
                            </div>

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected accounts</span>
                                    <span style={badgeStyle}>{accountRightItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>A/c code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {accountRightItems.map((row) => (
                                                <tr key={row.ac_code} style={rowStyle(accountRightSelected.has(row.ac_code))} onClick={() => toggleSelection(row.ac_code, setAccountRightSelected)}>
                                                    <td style={tdStyle}>{row.ac_code}</td>
                                                    <td style={tdStyle}>{row.ac_name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── action bar ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "0.5px solid #e5e7eb" }}>
                        <button className="action-btn" onClick={handleReset}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button className="action-btn"
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}>
                            <FileText size={13} /> Export
                        </button>
                        <div style={{ width: "0.5px", background: "#e5e7eb", alignSelf: "stretch" }} />
                        <button className="action-btn-primary"
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff" }}
                            onClick={() => {
                                const selectedAccounts = accountRightItems.map((i) => i.ac_code).join(",");
                                const selectedGroups = groupRightItems.map((i) => i.l4_code).join(",");
                                console.log({ code1: user?.company_code, code2: division[0]?.div_code, code3: selectedAccounts, code4: selectedGroups });
                                getDynamicLookupaccount({
                                    parameter: "Account_Report_Transaction",
                                    code1: user?.company_code || "",
                                    code2: division[0]?.div_code || "",
                                    code3: selectedAccounts || "All",
                                    code4: selectedGroups || "All",
                                    code5: String(formatDate(dateFrom)),
                                    code6: String(formatDate(dateTo)),
                                    loginid: user?.loginid || user?.username || "ADMIN",
                                });
                            }}>
                            <Printer size={13} /> Generate report
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}