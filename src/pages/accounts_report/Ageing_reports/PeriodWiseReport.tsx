"use client";

import React, { useEffect, useState } from "react";
import {
    Printer,
    RotateCcw,
    BarChart2,
    Loader2,
    Download,
} from "lucide-react";

import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { exportDueDetailExcel, exportDueSummaryExcel, exportInvDetailExcel, exportInvSummaryExcel, exportOutstandingListExcel, openDuedatewiseDetailReport, openDuedatewiseSummaryReport, openInvdatewiseDetailReport, openInvdatewiseSummaryReport, openOutstandingListReport } from "../../../api/transactions";

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

    // ── Group list + selection state ──────────────────────────────────────────
    const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
    const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
    const [groupSearchLeft, setGroupSearchLeft] = useState("");

    // ── Account list + selection state ────────────────────────────────────────
    const [accountLeftItems, setAccountLeftItems] = useState<any[]>([]);
    const [accountLeftSelected, setAccountLeftSelected] = useState(new Set<string>());
    const [accountSearchLeft, setAccountSearchLeft] = useState("");

    // ── Salesman list + selection state ───────────────────────────────────────
    const [salesmanLeftItems, setSalesmanLeftItems] = useState<any[]>([]);
    const [salesmanLeftSelected, setSalesmanLeftSelected] = useState(new Set<string>());
    const [salesmanSearchLeft, setSalesmanSearchLeft] = useState("");

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
     const [generatingExcel, setGeneratingExcel] = useState(false);


    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);


    const handleGenerate = async () => {
        if (!division) {
            setReportError("Please select a Division before generating.");
            return;
        }
        setReportError(null);
        setGenerating(true);
        try {
            const params = {
                parameter: outstandingList
                    ? "Account_Report_VW_PERIODWISE_OUTSTD_LIST"
                    : dateType === "due" && option === "summary"
                        ? "Account_Report_VW_PERIODWISE_DUEDATE_SUMMARY"
                        : dateType === "due" && option === "detail"
                            ? "Account_Report_VW_PERIODWISE_DUEDATE_DETAIL"
                            : option === "summary"
                                ? "Account_Report_VW_PERIODWISE_INV_SUMMARY"
                                : "Account_Report_VW_PERIODWISE_INV_DETAIL",
                loginid: user?.loginid || user?.username || "ADMIN",
                code1: user?.company_code || "",
                code2: division,
                code3: accountLeftSelected.size > 0 ? Array.from(accountLeftSelected).join(",") : "All",
                code4: groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(",") : "All",
                code5: salesmanLeftSelected.size > 0 ? Array.from(salesmanLeftSelected).join(",") : "All",
                code6: formatDateOracle(asOnDate),
                code7: dateType,
                code8: option,
                code9: String(ages[0]),
                code10: String(ages[1]),
                code11: String(ages[2]),
                code12: String(ages[3]),
                code13: String(ages[4]),
                code14: String(ages[5]),
                code15: String(outstandingList),
                code16: String(salesmanWise),
            };

            if (outstandingList) {
                await openOutstandingListReport(params);
            } else if (dateType === "due" && option === "summary") {
                await openDuedatewiseSummaryReport(params);
            } else if (dateType === "due" && option === "detail") {
                await openDuedatewiseDetailReport(params);
            } else if (option === "summary") {
                await openInvdatewiseSummaryReport(params);
            } else {
                await openInvdatewiseDetailReport(params);
            }

        } catch (err: any) {
            setReportError("Failed to generate report. Check console.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

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

    useEffect(() => {
        if (!division) return;

        setGroupLeftItems([]);
        setGroupLeftSelected(new Set());
        setAccountLeftItems([]);
        setAccountLeftSelected(new Set());
        setSalesmanLeftItems([]);
        setSalesmanLeftSelected(new Set());
        setFetchedTabs(new Set());

        // Fetch active tab immediately
        if (activeTab === "acCode") fetchAccounts(division);
        else if (activeTab === "group") fetchGroups(division);
        else if (activeTab === "salesman") fetchSalesman(division);
    }, [division]);

    // ── When tab changes: fetch that tab's data if not yet fetched ────────────
    useEffect(() => {
        if (!division) return;
        if (fetchedTabs.has(activeTab)) return;

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
            setGroupLeftSelected(new Set());
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
            setAccountLeftSelected(new Set());
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
            setSalesmanLeftSelected(new Set());
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

    // ── Selection helpers ─────────────────────────────────────────────────────
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

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = () => {
        setGroupLeftSelected(new Set());
        setAccountLeftSelected(new Set());
        setSalesmanLeftSelected(new Set());
        setAges(DEFAULT_AGES);
        setOutstandingList(false);
        setSalesmanWise(false);
        setDateType("inv");
        setOption("detail");
        setAsOnDate(today);
        setReportError(null);
    };

    //  const handleExportExcel = async () => {
    // if (!division) {
    //     setReportError("Please select a Division before exporting.");
    //     return;
    // }
    // setReportError(null);
    // setGeneratingExcel(true);
    // try {
    //     const params = {
    //         loginid: user?.loginid || user?.username || "ADMIN",
    //         code1: user?.company_code || "",
    //         code2: division,
    //         code3: accountLeftSelected.size > 0 ? Array.from(accountLeftSelected).join(",") : "All",
    //         code4: groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(",") : "All",
    //         code5: salesmanLeftSelected.size > 0 ? Array.from(salesmanLeftSelected).join(",") : "All",
    //         code6: formatDateOracle(asOnDate),
    //         code7: dateType,
    //         code8: option,
    //         code9: String(ages[0]),
    //         code10: String(ages[1]),
    //         code11: String(ages[2]),
    //         code12: String(ages[3]),
    //         code13: String(ages[4]),
    //         code14: String(ages[5]),
    //         code15: String(outstandingList),
    //         code16: String(salesmanWise),
    //     };

    //     let url = "";
    //     if (outstandingList) {
    //         url = "/api/periodwise-outstanding-excel";
    //     } else if (dateType === "due" && option === "summary") {
    //         url = "/api/periodwise-due-summary-excel";
    //     } else if (dateType === "due" && option === "detail") {
    //         url = "/api/periodwise-due-detail-excel";
    //     } else if (option === "summary") {
    //         url = "/api/periodwise-inv-summary-excel";
    //     } else {
    //         url = "/api/periodwise-inv-detail-excel";
    //     }

    //     const response = await fetch(url, {
    //         method: "POST",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify(params),
    //     });

    //     if (!response.ok) throw new Error("Server error: " + response.status);

    //     const blob = await response.blob();
    //     const link = document.createElement("a");
    //     link.href = URL.createObjectURL(blob);
    //     link.download = `PeriodWise_${outstandingList ? "Outstanding" : dateType === "due" ? "Due" : "Inv"}_${option}_${formatDateOracle(asOnDate)}.xlsx`;
    //     link.click();
    //     URL.revokeObjectURL(link.href);

    // } catch (err: any) {
    //     setReportError(err.message || "Failed to export Excel.");
    // } finally {
    //     setGeneratingExcel(false);
    // }
    //     };




    const handleExportExcel = async () => {
    if (!division) {
        setReportError("Please select a Division before exporting.");
        return;
    }
    setReportError(null);
    setGeneratingExcel(true);
    try {
        const params = {


             parameter: outstandingList
                    ? "Account_Report_VW_PERIODWISE_OUTSTD_LIST"
                    : dateType === "due" && option === "summary"
                        ? "Account_Report_VW_PERIODWISE_DUEDATE_SUMMARY"
                        : dateType === "due" && option === "detail"
                            ? "Account_Report_VW_PERIODWISE_DUEDATE_DETAIL"
                            : option === "summary"
                                ? "Account_Report_VW_PERIODWISE_INV_SUMMARY"
                                : "Account_Report_VW_PERIODWISE_INV_DETAIL",
                loginid: user?.loginid || user?.username || "ADMIN",
            //loginid: user?.loginid || user?.username || "ADMIN",
            code1: user?.company_code || "",
            code2: division,
            code3: accountLeftSelected.size > 0 ? Array.from(accountLeftSelected).join(",") : "All",
            code4: groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(",") : "All",
            code5: salesmanLeftSelected.size > 0 ? Array.from(salesmanLeftSelected).join(",") : "All",
            code6: formatDateOracle(asOnDate),
            code7: dateType,
            code8: option,
            code9: String(ages[0]),
            code10: String(ages[1]),
            code11: String(ages[2]),
            code12: String(ages[3]),
            code13: String(ages[4]),
            code14: String(ages[5]),
            code15: String(outstandingList),
            code16: String(salesmanWise),
        };

        if (outstandingList) {
            await exportOutstandingListExcel(params);
        } else if (dateType === "due" && option === "summary") {
            await exportDueSummaryExcel(params);
        } else if (dateType === "due" && option === "detail") {
            await exportDueDetailExcel(params);
        } else if (option === "summary") {
            await exportInvSummaryExcel(params);
        } else {
            await exportInvDetailExcel(params);
        }

    } catch (err: any) {
        setReportError(err.message || "Failed to export Excel.");
    } finally {
        setGeneratingExcel(false);
    }
};

    

    // ── Filtered lists ────────────────────────────────────────────────────────
    const filteredGroupLeft = groupLeftItems.filter(
        (i) => i.l4_code?.toLowerCase().includes(groupSearchLeft.toLowerCase()) ||
            i.description?.toLowerCase().includes(groupSearchLeft.toLowerCase())
    );
    const filteredAccountLeft = accountLeftItems.filter(
        (i) => i.ac_code?.toLowerCase().includes(accountSearchLeft.toLowerCase()) ||
            i.ac_name?.toLowerCase().includes(accountSearchLeft.toLowerCase())
    );
    const filteredSalesmanLeft = salesmanLeftItems.filter(
        (i) => i.salesman_code?.toLowerCase().includes(salesmanSearchLeft.toLowerCase()) ||
            i.salesman_name?.toLowerCase().includes(salesmanSearchLeft.toLowerCase())
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
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
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
        ac_codes: accountLeftSelected.size > 0 ? Array.from(accountLeftSelected).join(",") : "All",
        l4_codes: groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(",") : "All",
        salesman_codes: salesmanLeftSelected.size > 0 ? Array.from(salesmanLeftSelected).join(",") : "All",
    };

    const isDisabledByOutstanding = outstandingList;
    const isDisabledBySalesman = salesmanWise;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ background: "#f3f4f6", padding: "4px 8px", fontFamily: "system-ui, sans-serif" }}>
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
                 @keyframes spin { to { transform: rotate(360deg); } }
                  .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
            `}</style>

            <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>

                {/* ══ Card 1: Filters ══════════════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "3px 3px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>Period wise report filter</span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "flex-start" }}>

                        {/* Col 1: Date type + As on date + Division */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 260, flex: "1 1 260px" }}>
                            <div style={{ position: "relative" }}>
                                <div style={{ ...fieldLabelStyle, marginBottom: 1 }}>Division</div>
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
                        </div>

                        {/* Col 2: Option + Checkboxes */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 220, flex: "1 1 200px" }}>

                            {/* INV / Due date radio */}
                            <div>
                                <div style={{ ...fieldLabelStyle, marginBottom: 1 }}>Date type</div>
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

                            <fieldset style={fieldsetStyle}>
                                <legend style={legendStyle}>Option</legend>
                                <div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
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
                                <div style={{ ...fieldLabelStyle, marginBottom: 1 }}>Options</div>
                                <div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
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
                            <div style={{ ...fieldLabelStyle, marginBottom: 1 }}>Age periods</div>
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

                    {reportError && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 6, padding: "6px 12px" }}>
                            {reportError}
                        </div>
                    )}
                </div>

                {/* ══ Card 2: A/c Code / Group / Salesman list ══════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "0px 10px" }}>

                    {/* Tabs */}
                    <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 10 }}>
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

                    {/* ── A/c Code tab ── */}
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
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 150, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={accountLeftItems.length > 0 && accountLeftItems.every((i) => accountLeftSelected.has(i.ac_code))}
                                                    onChange={() => toggleAllSelection(accountLeftItems, accountLeftSelected, setAccountLeftSelected, "ac_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }}
                                                />
                                            </th>
                                            <th style={{ ...thStyle, width: 100 }}>A/c Code</th>
                                            <th style={thStyle}>AC Name</th>
                                            <th style={{ ...thStyle, width: 70 }}>Currency</th>
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
                                                <td style={tdStyle}>{row.curr_code}</td>
                                            </tr>
                                        ))}
                                        {filteredAccountLeft.length === 0 && (
                                            <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                                {division ? "No data" : "Select a division first"}
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Group tab ── */}
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
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 150, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={groupLeftItems.length > 0 && groupLeftItems.every((i) => groupLeftSelected.has(i.l4_code))}
                                                    onChange={() => toggleAllSelection(groupLeftItems, groupLeftSelected, setGroupLeftSelected, "l4_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }}
                                                />
                                            </th>
                                            <th style={{ ...thStyle, width: 100 }}>L4 Code</th>
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
                                        {filteredGroupLeft.length === 0 && (
                                            <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                                {division ? "No data" : "Select a division first"}
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Salesman tab ── */}
                    {activeTab === "salesman" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Salesman
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {salesmanLeftSelected.size > 0 && (
                                        <span style={badgeStyle}>{salesmanLeftSelected.size} selected</span>
                                    )}
                                    <span style={badgeStyle}>{salesmanLeftItems.length} total</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <input
                                    type="text"
                                    placeholder="Search salesman..."
                                    value={salesmanSearchLeft}
                                    onChange={(e) => setSalesmanSearchLeft(e.target.value)}
                                    style={{ ...inputStyle, fontSize: 12 }}
                                />
                            </div>
                            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 150, overflowY: "auto" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 36 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={salesmanLeftItems.length > 0 && salesmanLeftItems.every((i) => salesmanLeftSelected.has(i.salesman_code))}
                                                    onChange={() => toggleAllSelection(salesmanLeftItems, salesmanLeftSelected, setSalesmanLeftSelected, "salesman_code")}
                                                    style={{ accentColor: "#fff", cursor: "pointer" }}
                                                />
                                            </th>
                                            <th style={{ ...thStyle, width: 110 }}>Salesman Code</th>
                                            <th style={thStyle}>Salesman Name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSalesmanLeft.map((row) => (
                                            <tr
                                                key={row.salesman_code}
                                                style={rowStyle(salesmanLeftSelected.has(row.salesman_code))}
                                                onClick={() => toggleSelection(row.salesman_code, setSalesmanLeftSelected)}
                                            >
                                                <td style={{ ...tdStyle, width: 36 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={salesmanLeftSelected.has(row.salesman_code)}
                                                        onChange={() => toggleSelection(row.salesman_code, setSalesmanLeftSelected)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ accentColor: "#185FA5", cursor: "pointer" }}
                                                    />
                                                </td>
                                                <td style={tdStyle}>{row.salesman_code}</td>
                                                <td style={tdStyle}>{row.salesman_name}</td>
                                            </tr>
                                        ))}
                                        {filteredSalesmanLeft.length === 0 && (
                                            <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                                {division ? "No data" : "Select a division first"}
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                              className="action-btn action-btn-excel"
                            onClick={handleReset}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>

                        <button
                             className="action-btn action-btn-excel"
                            onClick={handleExportExcel}
                            disabled={generatingExcel}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: generatingExcel ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: generatingExcel ? 0.7 : 1 }}
                        >
                            <Download size={13} /> {generatingExcel ? "Exporting..." : "Export Excel"}
                        </button>


                        <button
                            className="action-btn-primary"
                            onClick={handleGenerate}
                            disabled={generating}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff", opacity: generating ? 0.7 : 1 }}
                        >
                            {generating
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                                : <><Printer size={13} /> Generate report</>
                            }
                        </button>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default PeriodWisePage;