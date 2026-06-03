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
    Loader2,
} from "lucide-react";

import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import {
    Division,
    openChequeMonitoringReport,
    openChequeDateWiseReport,
    openDetailDumpReport,
    openLedgerWithDetailsReport,
    openLedgerOppositeEntryReport,
    openSummaryDumpReport,
    openAccountPayeeWiseReport,

} from "../../../api/transactions";

export default function FinanceReportFilter() {
    const { user } = useAuth();

    const [group, setGroup] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [division, setDivision] = useState<Division[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("2026-05-01");
    const [dateTo, setDateTo] = useState("2026-05-27");
    const [amountFrom, setAmountFrom] = useState("");
    const [amountTo, setAmountTo] = useState("");
    const [remarks, setRemarks] = useState("");
    const [filterLedger, setFilterLedger] = useState(false);
    const [acPayee, setAcPayee] = useState("");
    const [activeTab, setActiveTab] = useState("group");

    // ── loading / error state ──────────────────────────────────────────────
    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
    const [groupRightItems, setGroupRightItems] = useState<any[]>([]);
    const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
    const [groupRightSelected, setGroupRightSelected] = useState(new Set<string>());

    const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
    const [accountRightItems, setAccountRightItems] = useState<any[]>([]);
    const [accountLeftSelected, setAccountLeftSelected] = useState(new Set<string>());
    const [accountRightSelected, setAccountRightSelected] = useState(new Set<string>());

    const [groupSearchLeft, setGroupSearchLeft] = useState("");
    const [groupSearchRight, setGroupSearchRight] = useState("");

    const [accountSearchLeft, setAccountSearchLeft] = useState("");
    const [accountSearchRight, setAccountSearchRight] = useState("");

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


    const filteredGroupLeft = groupLeftItems.filter(
        (item) =>
            item.l4_code?.toLowerCase().includes(groupSearchLeft.toLowerCase()) ||
            item.description?.toLowerCase().includes(groupSearchLeft.toLowerCase())
    );

    const filteredGroupRight = groupRightItems.filter(
        (item) =>
            item.l4_code?.toLowerCase().includes(groupSearchRight.toLowerCase()) ||
            item.description?.toLowerCase().includes(groupSearchRight.toLowerCase())
    );

    const filteredAccountLeft = accountLeftItems.filter(
        (item) =>
            item.ac_code?.toLowerCase().includes(accountSearchLeft.toLowerCase()) ||
            item.ac_name?.toLowerCase().includes(accountSearchLeft.toLowerCase())
    );

    const filteredAccountRight = accountRightItems.filter(
        (item) =>
            item.ac_code?.toLowerCase().includes(accountSearchRight.toLowerCase()) ||
            item.ac_name?.toLowerCase().includes(accountSearchRight.toLowerCase())
    );

    const handleReset = () => {
        setGroupLeftItems([...groupLeftItems, ...groupRightItems]);
        setGroupRightItems([]);
        setGroupLeftSelected(new Set());
        setGroupRightSelected(new Set());
        setAccountLeftItems([...accountLeftItems, ...accountRightItems]);
        setAccountRightItems([]);
        setAccountLeftSelected(new Set());
        setAccountRightSelected(new Set());
        setReportError(null);
    };

    // ── build shared params ────────────────────────────────────────────────
    const buildParams = () => ({
        loginid: user?.loginid || user?.username || "ADMIN",
        code1: user?.company_code || "",
        code2: division[0]?.div_code || "",
        code3: accountRightItems.map((i) => i.ac_code).join(",") || "All",
        code4: groupRightItems.map((i) => i.l4_code).join(",") || "All",
        code5: String(formatDate(dateFrom)),
        code6: String(formatDate(dateTo)),
        code7: amountFrom || "",
        code8: amountTo || "",
        // remarks / filterLedger / acPayee can be passed as extra codes if your backend supports them
        code9: acPayee || "",
        code10: filterLedger ? "Y" : "N",
        code20: "RAWSQL", // used for report-specific flags like "RAWSQL" or "DATE_WISE"
        parameter: "Account_Report_Transaction", // overridden per report
    });

    // ── generate report(s) — opens each checked option in its own tab ──────
    const handleGenerate = async () => {
        const anyChecked = Object.values(options).some(Boolean);
        if (!anyChecked) {
            setReportError("Please select at least one report option.");
            return;
        }
        if (!division[0]?.div_code) {
            setReportError("Please select a Division before generating.");
            return;
        }

        setReportError(null);
        setGenerating(true);

        const params = buildParams();

        // Map each checkbox to its API function
        const reportMap: { key: keyof typeof options; fn: (p: any) => Promise<void>; label: string }[] = [
            { key: "chequeBookMonitoring", fn: openChequeMonitoringReport, label: "Cheque Book Monitoring" },
            { key: "chequeDateWise", fn: openChequeDateWiseReport, label: "Cheque Date Wise" },
            { key: "detailDump", fn: openDetailDumpReport, label: "Detail Dump" },
            { key: "ledgerWithDetails", fn: openLedgerWithDetailsReport, label: "Ledger With Details" },
            { key: "ledgerWithOppositeEntry", fn: openLedgerOppositeEntryReport, label: "Ledger Opposite Entry" },
            { key: "summaryDump", fn: openSummaryDumpReport, label: "Summary Dump" },
            { key: "acPayeeWise", fn: openAccountPayeeWiseReport, label: "Account Payee Wise" },
        ];

        const errors: string[] = [];

        for (const { key, fn, label } of reportMap) {
            if (!options[key]) continue;
            try {
                await fn(params);
            } catch (err: any) {
                console.error(`${label} error:`, err);
                errors.push(label);
            }
        }

        // chequeDateWise — handled separately if you have a dedicated endpoint
        // currently falls back to the cheque monitoring report
        if (options.chequeDateWise) {
            try {
                await openChequeDateWiseReport({ ...params, code20: "DATE_WISE" });
            } catch (err: any) {
                errors.push("Cheque Date Wise");
            }
        }

        setGenerating(false);

        if (errors.length > 0) {
            setReportError(`Failed to open: ${errors.join(", ")}. Check console for details.`);
        }
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

    // count how many reports are selected
    const selectedCount = Object.values(options).filter(Boolean).length;

    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .tf-btn:hover { background: #f0f7ff !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .tab-btn-r { padding: 7px 18px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -0.5px; }
                .tab-btn-r.active { color: #185FA5; border-bottom-color: #185FA5; }
                .action-btn:hover { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                .action-btn-primary:disabled { background: #93c5fd !important; border-color: #93c5fd !important; cursor: not-allowed !important; }
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={fieldLabelStyle}>Report options</span>
                                {selectedCount > 0 && (
                                    <span style={badgeStyle}>{selectedCount} selected</span>
                                )}
                            </div>
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
                                <div style={{ marginBottom: 6 }}>
                                    <input
                                        type="text"
                                        placeholder="Search groups..."
                                        value={groupSearchLeft}
                                        onChange={(e) => setGroupSearchLeft(e.target.value)}
                                        style={{
                                            width: "100%",
                                            border: "0.5px solid #e5e7eb",
                                            borderRadius: 6,
                                            padding: 8,
                                            marginBottom: 8,
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available groups</span>
                                    <span style={badgeStyle}>{groupLeftItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>L4 code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {filteredGroupLeft.map((row) => (
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
                                    <input
                                        type="text"
                                        placeholder="Search groups..."
                                        value={groupSearchRight}
                                        onChange={(e) => setGroupSearchRight(e.target.value)}
                                        style={{
                                            width: "100%",
                                            border: "0.5px solid #e5e7eb",
                                            borderRadius: 6,
                                            padding: 8,
                                            marginBottom: 8,
                                        }}
                                    />
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>L4 code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {filteredGroupRight.map((row) => (
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
                                    <input
                                        type="text"
                                        placeholder="Search accounts..."
                                        value={accountSearchLeft}
                                        onChange={(e) => setAccountSearchLeft(e.target.value)}
                                        style={{
                                            width: "100%",
                                            border: "0.5px solid #e5e7eb",
                                            borderRadius: 6,
                                            padding: 8,
                                            marginBottom: 8,
                                        }}
                                    />
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>A/c code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {filteredAccountLeft.map((row) => (
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
                                    <input
                                        type="text"
                                        placeholder="Search accounts..."
                                        value={accountSearchRight}
                                        onChange={(e) => setAccountSearchRight(e.target.value)}
                                        style={{
                                            width: "100%",
                                            border: "0.5px solid #e5e7eb",
                                            borderRadius: 6,
                                            padding: 8,
                                            marginBottom: 8,
                                        }}
                                    />
                                    <table>
                                        <thead><tr><th style={{ ...thStyle, width: 90 }}>A/c code</th><th style={thStyle}>Description</th></tr></thead>
                                        <tbody>
                                            {filteredAccountRight.map((row) => (
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

                    {/* ── error banner ── */}
                    {reportError && (
                        <div style={{
                            marginTop: 12,
                            padding: "8px 14px",
                            background: "#fef2f2",
                            border: "0.5px solid #fca5a5",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "#b91c1c",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}>
                            <span>⚠</span> {reportError}
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
                        <button
                            className="action-btn-primary"
                            disabled={generating}
                            onClick={handleGenerate}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #185FA5",
                                background: "#185FA5",
                                cursor: generating ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#fff",
                                opacity: generating ? 0.75 : 1,
                            }}
                        >
                            {generating
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                                : <><Printer size={13} /> Generate report {selectedCount > 1 ? `(${selectedCount})` : ""}</>
                            }
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}