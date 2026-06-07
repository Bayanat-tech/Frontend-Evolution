"use client";

import React, { useEffect, useState } from "react";
import {
    Printer,
    RotateCcw,
    ChevronRight,
    ChevronLeft,
    ChevronsRight,
    ChevronsLeft,
    BarChart2,
} from "lucide-react";

import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
// import ReportDialogPage from "report/ReportDialogPage";
import PeriodWiseReport from "./PeriodWiseReport";

// ─── Helper ───────────────────────────────────────────────────────────────────
const getRowKey = (row: any, tab: "acCode" | "group" | "salesman"): string => {
    if (tab === "acCode") return String(row.ac_code ?? "");
    if (tab === "salesman") return String(row.salesman_code ?? "");
    return String(row.l4_code ?? "");
};

const DEFAULT_AGES = [30, 60, 90, 120, 180, 365];
const today = new Date().toISOString().split("T")[0];

// ─── Shared styles (same palette as FinanceReportFilter) ─────────────────────
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

const rowStyle = (sel: boolean): React.CSSProperties => ({
    cursor: "pointer",
    background: sel ? "#E6F1FB" : "transparent",
    color: sel ? "#0C447C" : "inherit",
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
    boxSizing: "border-box",
};

const badgeStyle: React.CSSProperties = {
    background: "#E6F1FB",
    color: "#0C447C",
    fontSize: 10,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 20,
};

const radioLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
};

const checkRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12,
    cursor: "pointer",
};

const fieldsetStyle: React.CSSProperties = {
    border: "0.5px solid #d1d5db",
    borderRadius: 6,
    padding: "6px 12px 10px",
    margin: 0,
};

const legendStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#6b7280",
    padding: "0 4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

// ─── Component ────────────────────────────────────────────────────────────────
const PeriodWisePage: React.FC = () => {
    const { user } = useAuth();

    // ── Division state ────────────────────────────────────────────────────────
    const [divisionList, setDivisionList] = useState<any[]>([]);
    const [division, setDivision] = useState("");
    const [divisionDisplay, setDivisionDisplay] = useState("");
    const [divisionSearch, setDivisionSearch] = useState("");
    const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);

    // ── Group transfer state (same pattern as FinanceReportFilter) ────────────
    const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
    const [groupRightItems, setGroupRightItems] = useState<any[]>([]);
    const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
    const [groupRightSelected, setGroupRightSelected] = useState(new Set<string>());
    const [groupSearchLeft, setGroupSearchLeft] = useState("");
    const [groupSearchRight, setGroupSearchRight] = useState("");

    // ── Account transfer state ────────────────────────────────────────────────
    const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
    const [accountRightItems, setAccountRightItems] = useState<any[]>([]);
    const [accountLeftSelected, setAccountLeftSelected] = useState(new Set<string>());
    const [accountRightSelected, setAccountRightSelected] = useState(new Set<string>());
    const [accountSearchLeft, setAccountSearchLeft] = useState("");
    const [accountSearchRight, setAccountSearchRight] = useState("");

    // ── Salesman transfer state ───────────────────────────────────────────────
    const [salesmanLeftItems, setSalesmanLeftItems] = useState<any[]>([]);
    const [salesmanRightItems, setSalesmanRightItems] = useState<any[]>([]);
    const [salesmanLeftSelected, setSalesmanLeftSelected] = useState(new Set<string>());
    const [salesmanRightSelected, setSalesmanRightSelected] = useState(new Set<string>());
    const [salesmanSearchLeft, setSalesmanSearchLeft] = useState("");
    const [salesmanSearchRight, setSalesmanSearchRight] = useState("");

    // ── Filter/report state ───────────────────────────────────────────────────
    const [dateType, setDateType] = useState<"inv" | "due">("inv");
    const [asOnDate, setAsOnDate] = useState<string>(today);
    const [option, setOption] = useState<"summary" | "detail">("detail");
    const [ages, setAges] = useState<number[]>(DEFAULT_AGES);
    const [outstandingList, setOutstandingList] = useState(false);
    const [salesmanWise, setSalesmanWise] = useState(false);
    const [activeTab, setActiveTab] = useState<"acCode" | "group" | "salesman">("acCode");
    const [reportOpen, setReportOpen] = useState(false);

    // ── Track which tabs have been fetched (reset on division change) ─────────
    const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());

    // ── Fetch division list on mount ──────────────────────────────────────────
    useEffect(() => {
        const fetchDivisions = async () => {
            try {
                const response = await getDynamicLookup({
                    parameter: "Account_division",
                    code1: user?.company_code || "",
                    loginid: user?.loginid || user?.username || "ADMIN",
                });
                setDivisionList(response || []);
            } catch (error) {
                console.error("Division fetch error:", error);
            }
        };
        fetchDivisions();
    }, []);

    // ── When division changes: reset all tab data + fetched flags,
    //    then fetch whichever tab is currently active ──────────────────────────
    useEffect(() => {
        if (!division) return;

        // Reset everything
        setGroupLeftItems([]); setGroupRightItems([]);
        setGroupLeftSelected(new Set()); setGroupRightSelected(new Set());
        setAccountLeftItems([]); setAccountRightItems([]);
        setAccountLeftSelected(new Set()); setAccountRightSelected(new Set());
        setSalesmanLeftItems([]); setSalesmanRightItems([]);
        setSalesmanLeftSelected(new Set()); setSalesmanRightSelected(new Set());
        setFetchedTabs(new Set());

        // Fetch active tab immediately
        if (activeTab === "acCode") fetchAccounts(division);
        else if (activeTab === "group") fetchGroups(division);
        else if (activeTab === "salesman") fetchSalesman(division);
    }, [division]);

    // ── When tab changes: fetch that tab's data if not yet fetched ────────────
    useEffect(() => {
        if (!division) return;
        if (fetchedTabs.has(activeTab)) return; // already fetched, skip

        if (activeTab === "acCode") fetchAccounts(division);
        else if (activeTab === "group") fetchGroups(division);
        else if (activeTab === "salesman") fetchSalesman(division);
    }, [activeTab]);

    const fetchGroups = async (div: string) => {
        try {
            const response = await getDynamicLookupaccount({
                parameter: "Account_Report_Group",
                code1: user?.company_code || "",
                code2: div,
            });
            setGroupLeftItems(response || []);
            setGroupRightItems([]);
            setGroupLeftSelected(new Set());
            setGroupRightSelected(new Set());
            setFetchedTabs((prev) => new Set(prev).add("group"));
        } catch (error) {
            console.error("Group fetch error:", error);
        }
    };

    const fetchAccounts = async (div: string) => {
        try {
            const response = await getDynamicLookupaccount({
                parameter: "Account_Report_AC",
                code1: user?.company_code || "",
                code2: div,
            });
            const uniqueData = Array.from(
                new Map(response.map((item: any) => [item.ac_code, item])).values()
            );
            setAccountLeftItems(uniqueData as any[]);
            setAccountRightItems([]);
            setAccountLeftSelected(new Set());
            setAccountRightSelected(new Set());
            setFetchedTabs((prev) => new Set(prev).add("acCode"));
        } catch (error) {
            console.error("Account fetch error:", error);
        }
    };

    const fetchSalesman = async (div: string) => {
        try {
            const response = await getDynamicLookupaccount({
                parameter: "Account_Report_Salesman",
                code1: user?.company_code || "",
                code2: div,
            });
            setSalesmanLeftItems(response || []);
            setSalesmanRightItems([]);
            setSalesmanLeftSelected(new Set());
            setSalesmanRightSelected(new Set());
            setFetchedTabs((prev) => new Set(prev).add("salesman"));
        } catch (error) {
            console.error("Salesman fetch error:", error);
        }
    };

    // ── Age handler ───────────────────────────────────────────────────────────
    const handleAgeChange = (index: number, value: string) => {
        const num = parseInt(value, 10);
        setAges((prev) => {
            const updated = [...prev];
            updated[index] = isNaN(num) ? 0 : num;
            return updated;
        });
    };

    // ── Generic transfer helpers ──────────────────────────────────────────────
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
        keyField: string,
        setLeftItems: any, setRightItems: any, setLeftSelected: any
    ) => {
        if (leftSelected.size === 0) return;
        const moving = leftItems.filter((i) => leftSelected.has(i[keyField]));
        setRightItems([...rightItems, ...moving]);
        setLeftItems(leftItems.filter((i) => !leftSelected.has(i[keyField])));
        setLeftSelected(new Set());
    };

    const moveToLeft = (
        leftItems: any[], rightItems: any[], rightSelected: Set<string>,
        keyField: string,
        setLeftItems: any, setRightItems: any, setRightSelected: any
    ) => {
        if (rightSelected.size === 0) return;
        const moving = rightItems.filter((i) => rightSelected.has(i[keyField]));
        setLeftItems([...leftItems, ...moving]);
        setRightItems(rightItems.filter((i) => !rightSelected.has(i[keyField])));
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

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = () => {
        setGroupLeftItems([...groupLeftItems, ...groupRightItems]);
        setGroupRightItems([]);
        setGroupLeftSelected(new Set());
        setGroupRightSelected(new Set());
        setAccountLeftItems([...accountLeftItems, ...accountRightItems]);
        setAccountRightItems([]);
        setAccountLeftSelected(new Set());
        setAccountRightSelected(new Set());
        setSalesmanLeftItems([...salesmanLeftItems, ...salesmanRightItems]);
        setSalesmanRightItems([]);
        setSalesmanLeftSelected(new Set());
        setSalesmanRightSelected(new Set());
        setAges(DEFAULT_AGES);
        setOutstandingList(false);
        setSalesmanWise(false);
        setDateType("inv");
        setOption("detail");
        setAsOnDate(today);
    };

    // ── Filtered lists ────────────────────────────────────────────────────────
    const filteredGroupLeft = groupLeftItems.filter(
        (i) => i.l4_code?.toLowerCase().includes(groupSearchLeft.toLowerCase()) ||
               i.description?.toLowerCase().includes(groupSearchLeft.toLowerCase())
    );
    const filteredGroupRight = groupRightItems.filter(
        (i) => i.l4_code?.toLowerCase().includes(groupSearchRight.toLowerCase()) ||
               i.description?.toLowerCase().includes(groupSearchRight.toLowerCase())
    );
    const filteredAccountLeft = accountLeftItems.filter(
        (i) => i.ac_code?.toLowerCase().includes(accountSearchLeft.toLowerCase()) ||
               i.ac_name?.toLowerCase().includes(accountSearchLeft.toLowerCase())
    );
    const filteredAccountRight = accountRightItems.filter(
        (i) => i.ac_code?.toLowerCase().includes(accountSearchRight.toLowerCase()) ||
               i.ac_name?.toLowerCase().includes(accountSearchRight.toLowerCase())
    );
    const filteredSalesmanLeft = salesmanLeftItems.filter(
        (i) => i.salesman_code?.toLowerCase().includes(salesmanSearchLeft.toLowerCase()) ||
               i.salesman_name?.toLowerCase().includes(salesmanSearchLeft.toLowerCase())
    );
    const filteredSalesmanRight = salesmanRightItems.filter(
        (i) => i.salesman_code?.toLowerCase().includes(salesmanSearchRight.toLowerCase()) ||
               i.salesman_name?.toLowerCase().includes(salesmanSearchRight.toLowerCase())
    );

    const filteredDivisions = divisionList.filter((d: any) =>
        `${d.div_code} ${d.div_name}`.toLowerCase().includes(divisionSearch.toLowerCase())
    );

    // ── Date format helpers ───────────────────────────────────────────────────
    const formatDateDisplay = (date: string) => {
        if (!date) return "";
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    };
    const formatDateOracle = (date: string) => {
        if (!date) return "";
        const d = new Date(date);
        const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
        return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    // ── Report values (same logic as original) ────────────────────────────────
    const reportValues = {
        loginid: user?.loginid || user?.username || "ADMIN",
        company_code: user?.company_code || "",
        date_type: dateType,
        as_on_date: formatDateDisplay(asOnDate),
        as_on_date_iso: asOnDate,
        as_on_date_oracle: formatDateOracle(asOnDate),
        option,
        age1: ages[0], age2: ages[1], age3: ages[2],
        age4: ages[3], age5: ages[4], age6: ages[5],
        outstanding_list: outstandingList,
        salesman_wise: salesmanWise,
        division: division || "All",
        ac_codes: accountRightItems.length > 0 ? accountRightItems.map((r) => r.ac_code).join(",") : "All",
        l4_codes: groupRightItems.length > 0 ? groupRightItems.map((r) => r.l4_code).join(",") : "All",
        salesman_codes: salesmanRightItems.length > 0 ? salesmanRightItems.map((r) => r.salesman_code).join(",") : "All",
    };

    const isDisabledByOutstanding = outstandingList;
    const isDisabledBySalesman = salesmanWise;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif", minHeight: "100%" }}>
            <style>{`
                .tf-btn:hover { background: #f0f7ff !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .tab-btn-r { padding: 7px 18px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -0.5px; }
                .tab-btn-r.active { color: #185FA5; border-bottom-color: #185FA5; }
                .action-btn:hover { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                tbody tr:last-child td { border-bottom: none !important; }
                tbody tr:hover td { background: #f9fafb; }
                input[type=number]::-webkit-inner-spin-button { opacity: 1; }
                .div-option:hover { background: #f0f7ff; }
            `}</style>

            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ══ Card 1: Filters ══════════════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>Period wise report filter</span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                        {/* Col 1: Date type + As on date + Division */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 260, flex: "1 1 260px" }}>

                            {/* INV / Due date radio */}
                            <div>
                                <div style={fieldLabelStyle}>Date type</div>
                                <div style={{ display: "flex", gap: 16 }}>
                                    {([["inv", "INV Date wise"], ["due", "Due Date wise"]] as const).map(([val, lbl]) => (
                                        <label
                                            key={val}
                                            style={{
                                                ...radioLabelStyle,
                                                opacity: (isDisabledByOutstanding || isDisabledBySalesman) ? 0.45 : 1,
                                                cursor: (isDisabledByOutstanding || isDisabledBySalesman) ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="dateType"
                                                value={val}
                                                checked={dateType === val}
                                                disabled={isDisabledByOutstanding || isDisabledBySalesman}
                                                onChange={() => setDateType(val)}
                                                style={{ accentColor: "#185FA5" }}
                                            />
                                            {lbl}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* As on date */}
                            <fieldset style={fieldsetStyle}>
                                <legend style={legendStyle}>Date</legend>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, color: "#6b7280" }}>As on</span>
                                    <input
                                        type="date"
                                        value={asOnDate}
                                        onChange={(e) => setAsOnDate(e.target.value)}
                                        style={{ ...inputStyle, width: 160 }}
                                    />
                                </div>
                            </fieldset>

                            {/* Division searchable dropdown */}
                            <div style={{ position: "relative" }}>
                                <div style={fieldLabelStyle}>Division</div>
                                <input
                                    type="text"
                                    placeholder="Search division..."
                                    value={divisionSearch !== "" ? divisionSearch : divisionDisplay}
                                    onChange={(e) => {
                                        setDivisionSearch(e.target.value);
                                        setShowDivisionDropdown(true);
                                    }}
                                    onFocus={() => setShowDivisionDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDivisionDropdown(false), 150)}
                                    style={inputStyle}
                                />
                                {showDivisionDropdown && filteredDivisions.length > 0 && (
                                    <div style={{
                                        position: "absolute", zIndex: 100, top: "calc(100% + 2px)", left: 0, right: 0,
                                        background: "#fff", border: "0.5px solid #d1d5db", borderRadius: 6,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto",
                                    }}>
                                        {filteredDivisions.map((d: any) => (
                                            <div
                                                key={d.div_code}
                                                className="div-option"
                                                style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
                                                onMouseDown={() => {
                                                    setDivision(d.div_code);
                                                    setDivisionDisplay(`${d.div_code} - ${d.div_name}`);
                                                    setDivisionSearch("");
                                                    setShowDivisionDropdown(false);
                                                }}
                                            >
                                                <span style={{ fontWeight: 500 }}>{d.div_code}</span>
                                                <span style={{ color: "#6b7280", marginLeft: 6 }}>{d.div_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Col 2: Option + Checkboxes */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 200, flex: "1 1 200px" }}>

                            <fieldset style={fieldsetStyle}>
                                <legend style={legendStyle}>Option</legend>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {([["summary", "Summary"], ["detail", "Detail"]] as const).map(([val, lbl]) => (
                                        <label
                                            key={val}
                                            style={{
                                                ...radioLabelStyle,
                                                opacity: isDisabledByOutstanding ? 0.45 : 1,
                                                cursor: isDisabledByOutstanding ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="option"
                                                value={val}
                                                checked={option === val}
                                                disabled={isDisabledByOutstanding}
                                                onChange={() => setOption(val)}
                                                style={{ accentColor: "#185FA5" }}
                                            />
                                            {lbl}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <div>
                                <div style={fieldLabelStyle}>Options</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <label style={{
                                        ...checkRowStyle,
                                        opacity: isDisabledBySalesman ? 0.45 : 1,
                                        cursor: isDisabledBySalesman ? "not-allowed" : "pointer",
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={outstandingList}
                                            disabled={isDisabledBySalesman}
                                            onChange={(e) => {
                                                setOutstandingList(e.target.checked);
                                                if (e.target.checked) setSalesmanWise(false);
                                            }}
                                            style={{ accentColor: "#185FA5" }}
                                        />
                                        Outstanding list
                                    </label>
                                    <label style={{
                                        ...checkRowStyle,
                                        opacity: isDisabledByOutstanding ? 0.45 : 1,
                                        cursor: isDisabledByOutstanding ? "not-allowed" : "pointer",
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={salesmanWise}
                                            disabled={isDisabledByOutstanding}
                                            onChange={(e) => {
                                                setSalesmanWise(e.target.checked);
                                                if (e.target.checked) {
                                                    setDateType("inv");
                                                    setOutstandingList(false);
                                                }
                                            }}
                                            style={{ accentColor: "#185FA5" }}
                                        />
                                        Salesman wise
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Col 3: Age periods */}
                        <div style={{ minWidth: 220, flex: "1 1 220px" }}>
                            <div style={fieldLabelStyle}>Age periods</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                                {ages.map((age, idx) => (
                                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 12, color: "#6b7280", minWidth: 42, textAlign: "right" }}>
                                            Age {idx + 1}:
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={age}
                                            onChange={(e) => handleAgeChange(idx, e.target.value)}
                                            style={{ ...inputStyle, width: 64, textAlign: "right", padding: "4px 8px" }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══ Card 2: Transfer tables ══════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>

                    {/* Tabs */}
                    <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 14 }}>
                        {([["acCode", "A/c Code"], ["group", "Group"], ["salesman", "Salesman"]] as [typeof activeTab, string][]).map(([tab, label]) => (
                            <button
                                key={tab}
                                className={`tab-btn-r ${activeTab === tab ? "active" : ""}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ── Group tab ── */}
                    {activeTab === "group" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 10 }}>
                            {/* Available groups */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available groups</span>
                                    <span style={badgeStyle}>{groupLeftItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                    <input
                                        type="text"
                                        placeholder="Search groups..."
                                        value={groupSearchLeft}
                                        onChange={(e) => setGroupSearchLeft(e.target.value)}
                                        style={{ width: "100%", border: "none", borderBottom: "0.5px solid #e5e7eb", padding: "5px 9px", fontSize: 12, boxSizing: "border-box", outline: "none" }}
                                    />
                                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                        <table>
                                            <thead><tr><th style={{ ...thStyle, width: 90 }}>L4 Code</th><th style={thStyle}>Description</th></tr></thead>
                                            <tbody>
                                                {filteredGroupLeft.map((row) => (
                                                    <tr key={row.l4_code} style={rowStyle(groupLeftSelected.has(row.l4_code))} onClick={() => toggleSelection(row.l4_code, setGroupLeftSelected)}>
                                                        <td style={tdStyle}>{row.l4_code}</td>
                                                        <td style={tdStyle}>{row.description}</td>
                                                    </tr>
                                                ))}
                                                {filteredGroupLeft.length === 0 && (
                                                    <tr><td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: "16px" }}>No data</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Arrows */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 28 }}>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToRight(groupLeftItems, groupRightItems, setGroupLeftItems, setGroupRightItems, setGroupLeftSelected)}><ChevronsRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToRight(groupLeftItems, groupRightItems, groupLeftSelected, "l4_code", setGroupLeftItems, setGroupRightItems, setGroupLeftSelected)}><ChevronRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToLeft(groupLeftItems, groupRightItems, groupRightSelected, "l4_code", setGroupLeftItems, setGroupRightItems, setGroupRightSelected)}><ChevronLeft size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToLeft(groupLeftItems, groupRightItems, setGroupLeftItems, setGroupRightItems, setGroupRightSelected)}><ChevronsLeft size={14} /></button>
                            </div>

                            {/* Selected groups */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected groups</span>
                                    <span style={badgeStyle}>{groupRightItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                    <input
                                        type="text"
                                        placeholder="Search groups..."
                                        value={groupSearchRight}
                                        onChange={(e) => setGroupSearchRight(e.target.value)}
                                        style={{ width: "100%", border: "none", borderBottom: "0.5px solid #e5e7eb", padding: "5px 9px", fontSize: 12, boxSizing: "border-box", outline: "none" }}
                                    />
                                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                        <table>
                                            <thead><tr><th style={{ ...thStyle, width: 90 }}>L4 Code</th><th style={thStyle}>Description</th></tr></thead>
                                            <tbody>
                                                {filteredGroupRight.map((row) => (
                                                    <tr key={row.l4_code} style={rowStyle(groupRightSelected.has(row.l4_code))} onClick={() => toggleSelection(row.l4_code, setGroupRightSelected)}>
                                                        <td style={tdStyle}>{row.l4_code}</td>
                                                        <td style={tdStyle}>{row.description}</td>
                                                    </tr>
                                                ))}
                                                {filteredGroupRight.length === 0 && (
                                                    <tr><td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: "16px" }}>No data</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── A/c Code tab ── */}
                    {activeTab === "acCode" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 10 }}>
                            {/* Available accounts */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available accounts</span>
                                    <span style={badgeStyle}>{accountLeftItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                    <input
                                        type="text"
                                        placeholder="Search accounts..."
                                        value={accountSearchLeft}
                                        onChange={(e) => setAccountSearchLeft(e.target.value)}
                                        style={{ width: "100%", border: "none", borderBottom: "0.5px solid #e5e7eb", padding: "5px 9px", fontSize: 12, boxSizing: "border-box", outline: "none" }}
                                    />
                                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                        <table>
                                            <thead><tr><th style={{ ...thStyle, width: 90 }}>A/c Code</th><th style={thStyle}>AC Name</th><th style={{ ...thStyle, width: 70 }}>Currency</th></tr></thead>
                                            <tbody>
                                                {filteredAccountLeft.map((row) => (
                                                    <tr key={row.ac_code} style={rowStyle(accountLeftSelected.has(row.ac_code))} onClick={() => toggleSelection(row.ac_code, setAccountLeftSelected)}>
                                                        <td style={tdStyle}>{row.ac_code}</td>
                                                        <td style={tdStyle}>{row.ac_name}</td>
                                                        <td style={tdStyle}>{row.curr_code}</td>
                                                    </tr>
                                                ))}
                                                {filteredAccountLeft.length === 0 && (
                                                    <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: "16px" }}>No data</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Arrows */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 28 }}>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToRight(accountLeftItems, accountRightItems, setAccountLeftItems, setAccountRightItems, setAccountLeftSelected)}><ChevronsRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToRight(accountLeftItems, accountRightItems, accountLeftSelected, "ac_code", setAccountLeftItems, setAccountRightItems, setAccountLeftSelected)}><ChevronRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToLeft(accountLeftItems, accountRightItems, accountRightSelected, "ac_code", setAccountLeftItems, setAccountRightItems, setAccountRightSelected)}><ChevronLeft size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToLeft(accountLeftItems, accountRightItems, setAccountLeftItems, setAccountRightItems, setAccountRightSelected)}><ChevronsLeft size={14} /></button>
                            </div>

                            {/* Selected accounts */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected accounts</span>
                                    <span style={badgeStyle}>{accountRightItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                    <input
                                        type="text"
                                        placeholder="Search accounts..."
                                        value={accountSearchRight}
                                        onChange={(e) => setAccountSearchRight(e.target.value)}
                                        style={{ width: "100%", border: "none", borderBottom: "0.5px solid #e5e7eb", padding: "5px 9px", fontSize: 12, boxSizing: "border-box", outline: "none" }}
                                    />
                                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                        <table>
                                            <thead><tr><th style={{ ...thStyle, width: 90 }}>A/c Code</th><th style={thStyle}>AC Name</th><th style={{ ...thStyle, width: 70 }}>Currency</th></tr></thead>
                                            <tbody>
                                                {filteredAccountRight.map((row) => (
                                                    <tr key={row.ac_code} style={rowStyle(accountRightSelected.has(row.ac_code))} onClick={() => toggleSelection(row.ac_code, setAccountRightSelected)}>
                                                        <td style={tdStyle}>{row.ac_code}</td>
                                                        <td style={tdStyle}>{row.ac_name}</td>
                                                        <td style={tdStyle}>{row.curr_code}</td>
                                                    </tr>
                                                ))}
                                                {filteredAccountRight.length === 0 && (
                                                    <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: "16px" }}>No data</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Salesman tab ── */}
                    {activeTab === "salesman" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 10 }}>
                            {/* Available salesman */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available salesman</span>
                                    <span style={badgeStyle}>{salesmanLeftItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                    <input
                                        type="text"
                                        placeholder="Search salesman..."
                                        value={salesmanSearchLeft}
                                        onChange={(e) => setSalesmanSearchLeft(e.target.value)}
                                        style={{ width: "100%", border: "none", borderBottom: "0.5px solid #e5e7eb", padding: "5px 9px", fontSize: 12, boxSizing: "border-box", outline: "none" }}
                                    />
                                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                        <table>
                                            <thead><tr><th style={{ ...thStyle, width: 110 }}>Salesman Code</th><th style={thStyle}>Salesman Name</th></tr></thead>
                                            <tbody>
                                                {filteredSalesmanLeft.map((row) => (
                                                    <tr key={row.salesman_code} style={rowStyle(salesmanLeftSelected.has(row.salesman_code))} onClick={() => toggleSelection(row.salesman_code, setSalesmanLeftSelected)}>
                                                        <td style={tdStyle}>{row.salesman_code}</td>
                                                        <td style={tdStyle}>{row.salesman_name}</td>
                                                    </tr>
                                                ))}
                                                {filteredSalesmanLeft.length === 0 && (
                                                    <tr><td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: "16px" }}>No data</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Arrows */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 28 }}>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToRight(salesmanLeftItems, salesmanRightItems, setSalesmanLeftItems, setSalesmanRightItems, setSalesmanLeftSelected)}><ChevronsRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToRight(salesmanLeftItems, salesmanRightItems, salesmanLeftSelected, "salesman_code", setSalesmanLeftItems, setSalesmanRightItems, setSalesmanLeftSelected)}><ChevronRight size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveToLeft(salesmanLeftItems, salesmanRightItems, salesmanRightSelected, "salesman_code", setSalesmanLeftItems, setSalesmanRightItems, setSalesmanRightSelected)}><ChevronLeft size={14} /></button>
                                <button className="tf-btn" style={transferBtnStyle} onClick={() => moveAllToLeft(salesmanLeftItems, salesmanRightItems, setSalesmanLeftItems, setSalesmanRightItems, setSalesmanRightSelected)}><ChevronsLeft size={14} /></button>
                            </div>

                            {/* Selected salesman */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected salesman</span>
                                    <span style={badgeStyle}>{salesmanRightItems.length}</span>
                                </div>
                                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                    <input
                                        type="text"
                                        placeholder="Search salesman..."
                                        value={salesmanSearchRight}
                                        onChange={(e) => setSalesmanSearchRight(e.target.value)}
                                        style={{ width: "100%", border: "none", borderBottom: "0.5px solid #e5e7eb", padding: "5px 9px", fontSize: 12, boxSizing: "border-box", outline: "none" }}
                                    />
                                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                        <table>
                                            <thead><tr><th style={{ ...thStyle, width: 110 }}>Salesman Code</th><th style={thStyle}>Salesman Name</th></tr></thead>
                                            <tbody>
                                                {filteredSalesmanRight.map((row) => (
                                                    <tr key={row.salesman_code} style={rowStyle(salesmanRightSelected.has(row.salesman_code))} onClick={() => toggleSelection(row.salesman_code, setSalesmanRightSelected)}>
                                                        <td style={tdStyle}>{row.salesman_code}</td>
                                                        <td style={tdStyle}>{row.salesman_name}</td>
                                                    </tr>
                                                ))}
                                                {filteredSalesmanRight.length === 0 && (
                                                    <tr><td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: "16px" }}>No data</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn"
                            onClick={handleReset}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button
                            className="action-btn-primary"
                            onClick={() => setReportOpen(true)}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff" }}
                        >
                            <Printer size={13} /> Generate report
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Report Dialog ── */}
            {/* {reportOpen && (
                <ReportDialogPage
                    Report={PeriodWiseReport}
                    required_values={reportValues}
                    title="Period Wise Report"
                    onClose={() => setReportOpen(false)}
                />
            )} */}
        </div>
    );
};

export default PeriodWisePage;