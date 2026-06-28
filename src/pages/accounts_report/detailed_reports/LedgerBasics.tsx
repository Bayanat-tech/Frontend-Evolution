"use client";

import { useEffect, useState } from "react";
import {
    RotateCcw,
    Printer,
    Loader2,
    Download,
} from "lucide-react";

import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import {
    Division,
    // openChequeMonitoringReport,
    openChequeDateWiseReport,
    // openDetailDumpReport,
    // openLedgerWithDetailsReport,
    // openLedgerOppositeEntryReport,
    // openSummaryDumpReport,
    openAccountPayeeWiseReport,
    exportAccountPayeeWiseExcel,
    exportChequeDateWiseExcel,
    openLedgerWithDetailsReport,
    openLedgerOppositeEntryReport,
    exportLedgerWithDetailsExcel,

} from "../../../api/transactions";
import { FloatLabelInput } from "../../../lib/InputStyle";

export default function FinanceReportFilter() {
    const { user } = useAuth();

    const [group, setGroup] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [division, setDivision] = useState<Division[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("2026-05-01");
    const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]); // default to today
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
    const [generatingExcel, setGeneratingExcel] = useState(false);

    const formatDate = (date: string) => {
        if (!date) return null;
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const [options, setOptions] = useState({
        // default to cheque date wise selected
        chequeDateWise: false,
        // chequeBookMonitoring: true,
        ledgerWithDetails: false,
        ledgerWithOppositeEntry: false,
        // summaryDump: false,
        // detailDump: false,
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
        setOptions((prev) => {
            const next: Record<string, boolean> = {};
            Object.keys(prev).forEach((k) => {
                next[k] = k === key ? !prev[key] : false;
            });
            return next as typeof prev;
        });
        setReportError(null);
    };

    const getItemKey = (item: any) => item.l4_code || item.ac_code || "";

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
        const itemKeys = new Set(items.map((item) => item[keyField]));
        const allSelected = items.length > 0 && items.every((item) => selected.has(item[keyField]));
        setSelected(allSelected ? new Set() : itemKeys);
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
        code3: Array.from(accountLeftSelected).join(",") || "All",
        code4: Array.from(groupLeftSelected).join(",") || "All",
        code5: String(formatDate(dateFrom)),
        code6: String(formatDate(dateTo)),
        code7: amountFrom || "",
        code8: amountTo || "",
        // remarks / filterLedger / acPayee can be passed as extra codes if your backend supports them
        code9: acPayee || "",
        code10: String(formatDate(dateFrom)),
        code20: "RAWSQL", // used for report-specific flags like "RAWSQL" or "DATE_WISE"
        parameter: "Account_Report_Transaction", // overridden per report
    });

    // ── generate report(s) — opens each checked option in its own tab ──────
    const handleGenerate = async () => {
        if (!division[0]?.div_code) {
            setReportError("Please select a Division before generating.");
            return;
        }

        setReportError(null);
        setGenerating(true);

        const params = buildParams();

        const anyChecked = Object.values(options).some(Boolean);

        const reportMap: { key: keyof typeof options; fn: (p: any) => Promise<void>; label: string }[] = [
            { key: "chequeDateWise", fn: openChequeDateWiseReport, label: "Cheque Date Wise" },
            { key: "ledgerWithDetails", fn: openLedgerWithDetailsReport, label: "Ledger With Details" },
            { key: "ledgerWithOppositeEntry", fn: openLedgerOppositeEntryReport, label: "Ledger Opposite Entry" },
            { key: "acPayeeWise", fn: openAccountPayeeWiseReport, label: "Account Payee Wise" },
        ];

        const errors: string[] = [];

        if (!anyChecked) {
            // default: cheque date wise
            try {
                await openChequeDateWiseReport({ ...params, code20: "DATE_WISE" });
            } catch (err: any) {
                errors.push("Cheque Date Wise");
            }
        } else {
            for (const { key, fn, label } of reportMap) {
                if (!options[key]) continue;
                try {
                    await fn(key === "ledgerWithDetails" ? { ...params, code20: "DATE_WISE" } : params);
                } catch (err: any) {
                    console.error(`${label} error:`, err);
                    errors.push(label);
                }
            }
        }

        setGenerating(false);

        if (errors.length > 0) {
            setReportError(`Failed to open: ${errors.join(", ")}. Check console for details.`);
        }
    };
    const handleExportExcel = async () => {
        setReportError(null);
        setGeneratingExcel(true);

        try {
            if (options.chequeDateWise) {
                await exportChequeDateWiseExcel(
                    buildParams()
                );
            } else if (options.ledgerWithDetails) {
                await exportLedgerWithDetailsExcel(
                    buildParams()
                );
            }else if (options.ledgerWithOppositeEntry) {
                await exportLedgerWithDetailsExcel(
                    buildParams()
                );
            }
            else if (options.acPayeeWise) {
                await exportAccountPayeeWiseExcel(
                    buildParams()
                );
            }


        } catch (err: any) {
            console.error(err);
            setReportError(err.message || "Failed to generate report.");
        } finally {
            setGeneratingExcel(false);
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
        position: "sticky",
        top: 0,
        zIndex: 1,
    };

    const tdStyle: React.CSSProperties = {
        padding: "6px 10px",
        fontSize: 11,
        borderBottom: "0.5px solid #e9e5eb",
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
                    {/* ── top filters ── */}
                    {/* ── top filters ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>

                        {/* Row 1: Parameters + Filters side by side */}
                        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>

                            {/* Left column — Parameters stacked above Report options */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                                {/* Group 1 — Parameters */}
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "180px 130px 130px",
                                    gap: 10,
                                    alignItems: "center",
                                    padding: "10px 14px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    background: "#f9fafb",
                                    position: "relative",
                                }}>
                                    <span style={{
                                        position: "absolute", top: -9, left: 12, fontSize: 10,
                                        color: "#185FA5", background: "#f9fafb", padding: "0 5px",
                                        fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                                    }}>Parameters</span>

                                    <div style={{ position: "relative" }}>
                                        <span style={{
                                            position: "absolute", top: -8, left: 10, fontSize: 11,
                                            color: "#6b7280", background: "#f9fafb", padding: "0 4px", zIndex: 1,
                                        }}>Division</span>
                                        <div style={{ borderRadius: 6, padding: "1px 0" }}>
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
                                    </div>
                                    <FloatLabelInput label="From" value={dateFrom} type="date" onChange={(e) => setDateFrom(e.target.value)} />
                                    <FloatLabelInput label="To" value={dateTo} type="date" onChange={(e) => setDateTo(e.target.value)} />
                                </div>

                                {/* Group 3 — Report options (sits below Parameters, same width) */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 20,
                                    padding: "8px 14px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    background: "#f9fafb",
                                    position: "relative",
                                }}>
                                    <span style={{
                                        position: "absolute", top: -9, left: 12, fontSize: 10,
                                        color: "#185FA5", background: "#f9fafb", padding: "0 5px",
                                        fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                                    }}>Report options</span>
                                    {([
                                        ["ledgerWithDetails", "Ledger With Details"],
                                        ["ledgerWithOppositeEntry", "Ledger With Opposite Entry"],
                                        ["acPayeeWise", "A/c payee wise"],
                                    ] as [keyof typeof options, string][]).map(([key, label]) => (
                                        <label key={key} style={{ ...checkRowStyle, marginBottom: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={options[key]}
                                                onChange={() => toggleOption(key)}
                                                style={{ accentColor: "#185FA5" }}
                                            />
                                            <span style={{ fontSize: 12 }}>{label}</span>
                                        </label>
                                    ))}
                                    {selectedCount > 0 && <span style={{ ...badgeStyle, marginLeft: "auto" }}>{selectedCount} selected</span>}
                                </div>

                            </div>

                            {/* Group 2 — Filters */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "120px 120px 1fr",
                                gridTemplateRows: "auto auto",
                                gap: 10,
                                alignItems: "center",
                                padding: "10px 14px",
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                background: "#f9fafb",
                                flex: 1,
                                position: "relative",
                            }}>
                                <span style={{
                                    position: "absolute", top: -9, left: 12, fontSize: 10,
                                    color: "#185FA5", background: "#f9fafb", padding: "0 5px",
                                    fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                                }}>Filters</span>

                                <FloatLabelInput label="Amount from" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} />
                                <FloatLabelInput label="Amount to" value={amountTo} onChange={(e) => setAmountTo(e.target.value)} />
                                <div style={{ position: "relative" }}>
                                    <span style={{
                                        position: "absolute", top: -8, left: 10, fontSize: 11,
                                        color: "#6b7280", background: "#f9fafb", padding: "0 4px", zIndex: 1,
                                    }}>A/c payee</span>
                                    <div style={{ borderRadius: 6, padding: "1px 0" }}>
                                        <LookupField
                                            label=""
                                            value={acPayee}
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
                                            multiSelect
                                        />
                                    </div>
                                </div>

                                {/* Remarks — full width */}
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <FloatLabelInput label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ── divider ── */}
                    <div style={{ height: "0.5px", background: "#e5e7eb", margin: "4px 0 14px" }} />

                    {/* ── tabs ── */}
                    <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 14 }}>
                        {["acCode", "group"].map((tab) => (
                            <button
                                key={tab}
                                className={`tab-btn-r ${activeTab === tab ? "active" : ""}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === "acCode" ? "A/c code" : "Group"}
                            </button>
                        ))}
                    </div>

                    {/* ── account tab ── */}
                    {activeTab === "acCode" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Accounts
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {accountLeftSelected.size > 0 && (
                                        <span style={badgeStyle}>{accountLeftSelected.size} selected</span>
                                    )}
                                    <span style={badgeStyle}>{accountLeftItems.length} total</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <input
                                    type="text"
                                    placeholder="Search accounts..."
                                    value={accountSearchLeft}
                                    onChange={(e) => setAccountSearchLeft(e.target.value)}
                                    style={{ ...inputStyle, fontSize: 12 }}
                                />
                            </div>
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={accountLeftItems.length > 0 && accountLeftItems.every(i => accountLeftSelected.has(i.ac_code))}
                                                    onChange={() => toggleAllSelection(accountLeftItems, accountLeftSelected, setAccountLeftSelected, "ac_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }}
                                                />
                                            </th>
                                            <th style={{ ...thStyle, width: 100 }}>A/c code</th>
                                            <th style={thStyle}>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAccountLeft.map((row) => (
                                            <tr
                                                key={row.ac_code}
                                                style={rowStyle(accountLeftSelected.has(row.ac_code))}
                                                onClick={() => toggleSelection(row.ac_code, setAccountLeftSelected)}
                                            >
                                                <td style={{ ...tdStyle, width: 36 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={accountLeftSelected.has(row.ac_code)}
                                                        onChange={() => toggleSelection(row.ac_code, setAccountLeftSelected)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ accentColor: "#185FA5", cursor: "pointer" }}
                                                    />
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
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Groups
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {groupLeftSelected.size > 0 && (
                                        <span style={badgeStyle}>{groupLeftSelected.size} selected</span>
                                    )}
                                    <span style={badgeStyle}>{groupLeftItems.length} total</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <input
                                    type="text"
                                    placeholder="Search groups..."
                                    value={groupSearchLeft}
                                    onChange={(e) => setGroupSearchLeft(e.target.value)}
                                    style={{ ...inputStyle, fontSize: 12 }}
                                />
                            </div>
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={groupLeftItems.length > 0 && groupLeftItems.every(i => groupLeftSelected.has(i.l4_code))}
                                                    onChange={() => toggleAllSelection(groupLeftItems, groupLeftSelected, setGroupLeftSelected, "l4_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }}
                                                />
                                            </th>
                                            <th style={{ ...thStyle, width: 100 }}>L4 code</th>
                                            <th style={thStyle}>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroupLeft.map((row) => (
                                            <tr
                                                key={row.l4_code}
                                                style={rowStyle(groupLeftSelected.has(row.l4_code))}
                                                onClick={() => toggleSelection(row.l4_code, setGroupLeftSelected)}
                                            >
                                                <td style={{ ...tdStyle, width: 36 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={groupLeftSelected.has(row.l4_code)}
                                                        onChange={() => toggleSelection(row.l4_code, setGroupLeftSelected)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ accentColor: "#185FA5", cursor: "pointer" }}
                                                    />
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
                        <button className="act-btn" onClick={handleExportExcel}
                            style={{ padding: "7px 16px", border: "0.5px solid #abcae9", background: "#d2dfee", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#3a3636", opacity: generating ? 0.75 : 1 }}>

                            {generatingExcel && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                            {!generatingExcel && (
                                <Download size={13} />

                            )}
                            Export Excel
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