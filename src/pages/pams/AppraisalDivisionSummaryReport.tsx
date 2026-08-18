// AppraisalDivisionSummaryReport.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import { pamsSelect } from "../../api/pams";
import { useAuth } from "../../state/AuthContext";
import { Printer, Search, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { LookupField } from "../../components/ui/LookupField";
import type { LookupRow } from "../../api/lookups";

// ─── Types ───────────────────────────────────────────────────
interface SummaryRow {
    DIV_CODE: string; DIV_NAME: string;
    DEPT_CODE: string; DEPT_NAME: string;
    DESG_CODE: string; DESG_NAME: string;
    R1: number; R2: number; R3: number; R4: number; R5: number;
    TOTAL: number;
    EMPLOYEE_NAMES?: string;
    PENDING_EMPLOYEE_NAMES?: string;
    COMPLETED?: number;
    PENDING?: number;
}
interface DropdownItem {
    code: string;
    name: string;
}

// ─── Bell Curve ───────────────────────────────────────────────
const POINT_BG = ["#ffd6d6", "#ffe8c8", "#fffacc", "#d6f0d6", "#d0e8ff"];
const POINT_BD = ["#cc5555", "#cc8833", "#aaaa22", "#44aa44", "#3366cc"];

const BellCurveChart: React.FC<{ ratingCounts: Record<number, number> }> = ({ ratingCounts }) => {
    const countData = [1, 2, 3, 4, 5].map(r => ratingCounts[r] ?? 0);
    const W = 700, H = 230;
    const PAD = { top: 40, right: 30, bottom: 52, left: 44 };
    const chartW = W - PAD.left - PAD.right, chartH = H - PAD.top - PAD.bottom;
    const maxCount = Math.max(...countData, 1), yMax = maxCount + 1;

    const toX = (v: number) => PAD.left + (v / 5) * chartW;
    const toY = (v: number) => PAD.top + chartH - (v / yMax) * chartH;

    const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i);
    const xTicks = [0, 1, 2, 3, 4, 5];

    const dataPoints = countData.map((count, i) => ({ x: toX(i + 1), y: toY(count) }));
    const allPts = [{ x: toX(0), y: toY(0) }, ...dataPoints, { x: toX(5), y: toY(0) }];

    const buildPath = (pts: { x: number; y: number }[]) => {
        let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
        for (let i = 1; i < pts.length; i++) {
            const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(2);
            d += ` C ${cpx} ${pts[i - 1].y.toFixed(2)}, ${cpx} ${pts[i].y.toFixed(2)}, ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
        }
        return d;
    };
    const linePath = buildPath(allPts);
    const baseline = toY(0);
    const fillPath = linePath
        + ` L ${allPts[allPts.length - 1].x.toFixed(2)} ${baseline.toFixed(2)}`
        + ` L ${allPts[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`;

    return (
        <div style={{ marginTop: 10, pageBreakInside: "avoid", border: "1px solid #ccc", background: "#fff", lineHeight: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
                <rect x={0} y={0} width={W} height={H} fill="#fff" />
                <text x={W / 2} y={20} textAnchor="middle" fontFamily="Arial" fontSize={10} fontWeight="bold" fill="#000">Grade Distribution Bell Curve</text>
                {yTicks.map(v => (
                    <g key={v}>
                        <line x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)} stroke="#e0e0e0" strokeWidth={0.5} />
                        <text x={PAD.left - 5} y={toY(v) + 3} textAnchor="end" fontFamily="Arial" fontSize={8} fill="#555">{v}</text>
                    </g>
                ))}
                {xTicks.map(v => (
                    <g key={v}>
                        <text x={toX(v)} y={PAD.top + chartH + 13} textAnchor="middle" fontFamily="Arial" fontSize={8} fill="#333">{v}</text>
                        <line x1={toX(v)} y1={PAD.top + chartH} x2={toX(v)} y2={PAD.top + chartH + 4} stroke="#aaa" strokeWidth={0.5} />
                    </g>
                ))}
                <path d={fillPath} fill="rgba(192,57,43,0.08)" />
                <path d={linePath} fill="none" stroke="#c0392b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                {dataPoints.map((pt, i) => (
                    <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r={6} fill={POINT_BG[i]} />
                        <circle cx={pt.x} cy={pt.y} r={6} fill="none" stroke={POINT_BD[i]} strokeWidth={1.5} />
                    </g>
                ))}
                <polyline points={`${PAD.left},${PAD.top} ${PAD.left},${PAD.top + chartH} ${PAD.left + chartW},${PAD.top + chartH}`} fill="none" stroke="#888" strokeWidth={0.8} />
            </svg>
        </div>
    );
};

// ─── Report Design (printable area) ──────────────────────────
const ReportDesign = React.forwardRef<HTMLDivElement, {
    rows: SummaryRow[];
    filters: { div: string; dept: string; period: string };
    filterLabels: { div: string; dept: string; period: string };
}>(({ rows, filters, filterLabels }, ref) => {
    const totals = useMemo(() => ({
        R1: rows.reduce((s, r) => s + Number(r.R1), 0),
        R2: rows.reduce((s, r) => s + Number(r.R2), 0),
        R3: rows.reduce((s, r) => s + Number(r.R3), 0),
        R4: rows.reduce((s, r) => s + Number(r.R4), 0),
        R5: rows.reduce((s, r) => s + Number(r.R5), 0),
        TOTAL: rows.reduce((s, r) => s + Number(r.TOTAL), 0),
        PENDING: rows.reduce((s, r) => s + Number(r.PENDING || 0), 0),
        COMPLETED: rows.reduce((s, r) => s + Number(r.COMPLETED || 0), 0),
    }), [rows]);

    const ratingCounts: Record<number, number> = {
        1: totals.R1, 2: totals.R2, 3: totals.R3, 4: totals.R4, 5: totals.R5,
    };

    const filterLabel = [
        filters.div !== "ALL" && `Division: ${filterLabels.div || filters.div}`,
        filters.dept !== "ALL" && `Dept: ${filterLabels.dept || filters.dept}`,
        filters.period !== "ALL" && `Period: ${filterLabels.period || filters.period}`,
        filters.period === "ALL" && `Period: All (Cumulative)`,
    ].filter(Boolean).join("  |  ");

    return (
        <div
            ref={ref}
            style={{ background: "#fff", padding: 20, width: "100%", boxSizing: "border-box" }}
        >
            <style>{`
                .rpt{font-family:Arial,sans-serif;font-size:8.5px;color:#000;}
                .rpt-tbl{width:100%;border-collapse:collapse;font-size:8.5px;font-family:Arial,sans-serif;}
                .rpt-tbl td,.rpt-tbl th{border:1px solid #000;padding:2px 4px;vertical-align:middle;white-space:nowrap;}
                .rpt-tbl td.wrap{white-space:normal;word-break:break-word;}
                .hdr{font-weight:bold;background:#c0c0c0;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .shdr{font-weight:bold;background:#d8d8d8;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .ctr{text-align:center;} .bold{font-weight:bold;}
                .tot{font-weight:bold;background:#ffff00;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .sh{font-weight:bold;background:#f5c97a;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .sl{font-weight:bold;background:#fdebc8;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .r1{background:#ffd6d6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .r2{background:#ffe8c8;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .r3{background:#fffacc;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .r4{background:#d6f0d6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .r5{background:#d0e8ff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .sec{margin-top:8px;}
                @media print{
                    @page{size:A4 landscape;margin:10mm 8mm;}
                    body *{visibility:hidden;}
                    .rpt,.rpt *{visibility:visible;}
                    .rpt{position:absolute;top:0;left:0;width:100%;}
                }
            `}</style>
            <div className="rpt">
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ flexShrink: 0, width: 187, height: 68 }}>
                        <svg width="187" height="68" viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
                            <rect x="0" y="0" width="40" height="80" fill="#F7941D" />
                            <rect x="40" y="0" width="155" height="80" fill="#008B9B" />
                            <text x="117" y="17" fill="#fff" fontSize="10.5" fontFamily="Arial" textAnchor="middle" fontWeight="bold">المدينة</text>
                            <text x="117" y="34" fill="#fff" fontSize="16" fontFamily="Arial" textAnchor="middle" fontWeight="bold">al madina</text>
                            <text x="117" y="50" fill="#F7941D" fontSize="10" fontFamily="Arial" textAnchor="middle" fontWeight="bold" letterSpacing="2.5">LOGISTICS</text>
                            <text x="117" y="62" fill="#fff" fontSize="8.5" fontFamily="Arial" textAnchor="middle">اللوجستية</text>
                            <text x="117" y="74" fill="#fff" fontSize="7" fontFamily="Arial" textAnchor="middle">خدمات لوجستية فائقة</text>
                            <polygon points="185,14 204,40 185,66" fill="#F7941D" />
                            <polygon points="174,19 191,40 174,61" fill="#F7941D" opacity="0.5" />
                        </svg>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: "bold" }}>Appraisal Summary Report — Division Wise</div>
                        {filterLabel && <div style={{ fontSize: 9, color: "#555", marginTop: 3 }}>{filterLabel}</div>}
                    </div>
                </div>

                {/* Main Table */}
                <table className="rpt-tbl">
                    <thead>
                        <tr>
                            <th className="hdr" rowSpan={2}>SL.No</th>
                            <th className="hdr" rowSpan={2}>Division</th>
                            <th className="hdr" rowSpan={2}>Department</th>
                            <th className="hdr" rowSpan={2}>Designation</th>
                            <th className="hdr" rowSpan={2}>Pending Employee</th>
                            <th className="shdr" colSpan={5}>Rating</th>
                            <th className="hdr" rowSpan={2}>Total</th>
                        </tr>
                        <tr>{[1, 2, 3, 4, 5].map(r => <th key={r} className="shdr" style={{ width: 48 }}>{r}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx}>
                                <td className="ctr">{idx + 1}</td>
                                <td>{row.DIV_NAME || row.DIV_CODE}</td>
                                <td>{row.DEPT_NAME || row.DEPT_CODE}</td>
                                <td>{row.DESG_NAME || row.DESG_CODE}</td>
                                <td className="wrap">{row.PENDING_EMPLOYEE_NAMES || "-"}</td>
                                {[row.R1, row.R2, row.R3, row.R4, row.R5].map((v, i) => (
                                    <td key={i} className={`ctr bold${Number(v) > 0 ? ` r${i + 1}` : ""}`}>{Number(v) || ""}</td>
                                ))}
                                <td className="ctr bold">{row.TOTAL}</td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={5} className="tot" style={{ textAlign: "right", paddingRight: 8 }}>Total</td>
                            {[totals.R1, totals.R2, totals.R3, totals.R4, totals.R5].map((v, i) => (
                                <td key={i} className="tot ctr">{v}</td>
                            ))}
                            <td className="tot ctr">{totals.TOTAL}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Grade Summary */}
                <table className="rpt-tbl sec">
                    <thead>
                        <tr>
                            <th className="sh" style={{ textAlign: "left", width: "28%" }}>Grade</th>
                            {[1, 2, 3, 4, 5].map(r => <th key={r} className="sh ctr">{r}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="sl">Grades Achieved</td>
                            {[totals.R1, totals.R2, totals.R3, totals.R4, totals.R5].map((v, i) => (
                                <td key={i} className={`ctr bold${v > 0 ? ` r${i + 1}` : ""}`}>{v}</td>
                            ))}
                        </tr>
                        <tr>
                            <td className="sl">Total Appraisals</td>
                            {[1, 2, 3, 4, 5].map(r => <td key={r} className="ctr">{totals.TOTAL}</td>)}
                        </tr>
                        <tr>
                            <td className="sl">Grade %</td>
                            {[totals.R1, totals.R2, totals.R3, totals.R4, totals.R5].map((v, i) => (
                                <td key={i} className="ctr">
                                    {totals.TOTAL > 0 ? ((v / totals.TOTAL) * 100).toFixed(2) + "%" : "0.00%"}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>

                <BellCurveChart ratingCounts={ratingCounts} />

                {/* Legend */}
                <table className="rpt-tbl sec">
                    <tbody>
                        <tr>
                            <td className="bold" style={{ width: "14%" }}>Rating Scale:</td>
                            <td>1 = Unsatisfactory &nbsp;&nbsp; 2 = Below Expectations &nbsp;&nbsp; 3 = Meets Expectations &nbsp;&nbsp; 4 = Above Expectations &nbsp;&nbsp; 5 = Exceptional</td>
                        </tr>
                    </tbody>
                </table>

                {/* Signatures */}
                <table className="rpt-tbl sec">
                    <tbody>
                        <tr>
                            <td className="bold" style={{ width: "18%" }}>Prepared By:</td>
                            <td style={{ width: "32%" }}>&nbsp;</td>
                            <td className="bold" style={{ width: "18%" }}>Reviewed By:</td>
                            <td style={{ width: "32%" }}>&nbsp;</td>
                        </tr>
                        <tr>
                            <td className="bold">Signature &amp; Date:</td>
                            <td>&nbsp;</td>
                            <td className="bold">Signature &amp; Date:</td>
                            <td>&nbsp;</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
});
ReportDesign.displayName = "ReportDesign";

// ─── Helper: Fetch dropdown items via pamsSelect ──────────────
const fetchDropdown = async (
    parameter: string,
    loginid: string,
    company_code: string,
    code2 = "ALL",
    code3 = "ALL"
): Promise<DropdownItem[]> => {
    try {
        const res = await pamsSelect({
            parameter,
            loginid,
            code1: company_code,
            code2,
            code3,
        });
        if (!Array.isArray(res)) return [];
        return (res as Record<string, unknown>[]).map((r) => ({
            code: String(r.DIV_CODE ?? r.DEPT_CODE ?? ""),
            name: String(r.DIV_NAME ?? r.DEPT_NAME ?? ""),
        }));
    } catch {
        return [];
    }
};

// ─── Fetch periods (separate shape: PERIOD_NUMBER + dates) ───
interface PeriodItem {
    code: string;
    label: string;
}
const fetchPeriods = async (loginid: string, company_code: string): Promise<PeriodItem[]> => {
    try {
        const res = await pamsSelect({ parameter: "period", loginid, code1: company_code });
        if (!Array.isArray(res)) return [];
        return (res as Record<string, unknown>[]).map((r) => ({
            code: String(r.PERIOD_NUMBER ?? ""),
            label: String(r.PERIOD_NUMBER ?? "")
                + (r.PERIOD_FROM_DATE ? ` (${r.PERIOD_FROM_DATE} to ${r.PERIOD_TO_DATE})` : ""),
        }));
    } catch {
        return [];
    }
};

// ─── Convert DropdownItem[] → LookupRow[] for LookupField ────
const toLookupRows = (items: DropdownItem[]): LookupRow[] =>
    items.map(i => ({ CODE: i.code, NAME: i.name } as unknown as LookupRow));

// ─── Main Page ────────────────────────────────────────────────
const AppraisalDivisionSummaryReport = () => {
    const { user } = useAuth();
    const reportRef = useRef<HTMLDivElement>(null);

    const company_code = user?.company_code ?? "";
    const loginid = user?.loginid ?? user?.username ?? "";

    // ── Filter codes (sent to API) ────────────────────────────
    const [div, setDiv]   = useState("ALL");
    const [dept, setDept] = useState("ALL");
    const [period, setPeriod] = useState("ALL");

    // ── Filter display names (shown in report header) ─────────
    const [divLabel, setDivLabel]   = useState("All");
    const [deptLabel, setDeptLabel] = useState("All");

    // ── Dropdown option lists ──────────────────────────────────
    const [divOptions, setDivOptions]   = useState<DropdownItem[]>([{ code: "ALL", name: "All" }]);
    const [deptOptions, setDeptOptions] = useState<DropdownItem[]>([{ code: "ALL", name: "All" }]);
    const [periodOptions, setPeriodOptions] = useState<PeriodItem[]>([{ code: "ALL", label: "All Periods (Cumulative)" }]);

    const [reportData, setReportData]     = useState<SummaryRow[]>([]);
    const [isFetching, setIsFetching]     = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);

    // ── Fetch divisions + periods on mount ─────────────────────
    useEffect(() => {
        if (!loginid) return;
        fetchDropdown("report_divisions", loginid, company_code)
            .then(data => {
                // Ensure "ALL" is always present
                const allOption = { code: "ALL", name: "All" };
                setDivOptions([allOption, ...data]);
            });
        fetchPeriods(loginid, company_code)
            .then(data => {
                // Ensure "ALL" is always present
                const allPeriod = { code: "ALL", label: "All Periods (Cumulative)" };
                setPeriodOptions([allPeriod, ...data]);
            });
    }, [loginid, company_code]);

    // ── Cascade: departments when div changes ─────────────────
    useEffect(() => {
        if (!loginid) return;
        fetchDropdown("report_departments", loginid, company_code, div)
            .then(data => {
                // Ensure "ALL" is always present
                const allOption = { code: "ALL", name: "All" };
                setDeptOptions([allOption, ...data]);
            });
        setDept("ALL");
        setDeptLabel("All");
    }, [div, loginid, company_code]);

    // ── Generate report ───────────────────────────────────────
    const handleGenerate = async () => {
        if (!loginid) return;
        setIsFetching(true);
        setHasGenerated(true);
        try {
            const res = await pamsSelect({
                parameter: "appraisal_summary_division_wise",
                loginid,
                code1: company_code,
                code2: div,
                code3: dept,
                code4: period,
            });
            setReportData(Array.isArray(res) ? (res as unknown) as SummaryRow[] : []);
        } catch {
            setReportData([]);
        } finally {
            setIsFetching(false);
        }
    };

    // ── Print ─────────────────────────────────────────────────
    const fileName = `Appraisal-Division-Summary-${new Date().toISOString().slice(0, 10)}`;
    const printStyles = `
        @page{margin:10mm 8mm;size:A4 landscape;}
        *{box-sizing:border-box;}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0;font-family:Arial,sans-serif;background:#fff;}
        thead{display:table-header-group;}
    `;
    const handlePrint = () => {
        const style = document.createElement("style");
        style.innerHTML = printStyles;
        document.head.appendChild(style);
        document.title = fileName;
        window.print();
        document.head.removeChild(style);
    };

    // ── LookupField columns config ────────────────────────────
    const lookupColumns = [
        { field: "CODE", header: "Code" },
        { field: "NAME", header: "Name" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            {/* ── Breadcrumb + Title ── */}
            <div style={{ padding: "12px 24px", borderBottom: "1px solid #e0e0e0" }}>
                <nav aria-label="breadcrumb" style={{ marginBottom: 4, fontSize: 13, color: "#666" }}>
                    <a href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Home</a>
                    <span style={{ margin: "0 6px" }}>›</span>
                    <a href="/pams/masters" style={{ color: "inherit", textDecoration: "none" }}>Master</a>
                    <span style={{ margin: "0 6px" }}>›</span>
                    <span style={{ color: "#000" }}>Appraisal Division Summary Report</span>
                </nav>
                <h6 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Appraisal Division Summary Report</h6>
            </div>

            {/* ── Filter Bar ── */}
            <div style={{
                padding: "12px 24px",
                borderBottom: "1px solid #e0e0e0",
                background: "#fafafa",
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "flex-end",
            }}>
                {/* Period Dropdown */}
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                        Period
                    </label>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #d1d5db",
                            borderRadius: "6px", fontSize: "13px", background: "#fff", color: "#111827",
                        }}
                    >
                        {periodOptions.map((p, idx) => (
                            <option key={idx} value={p.code}>{p.label}</option>
                        ))}
                    </select>
                </div>

                {/* Division Lookup */}
                <div style={{ flex: 1, minWidth: 160 }}>
                    <LookupField
                        label="Division"
                        value={div === "ALL" ? "" : div}
                        displayValue={divLabel}
                        columns={lookupColumns}
                        valueField="CODE"
                        displayFields={["CODE", "NAME"]}
                        loadOptions={() => Promise.resolve(toLookupRows(divOptions))}
                        onChange={(val, row) => {
                            if (!val || val === "ALL") {
                                setDiv("ALL"); setDivLabel("All");
                            } else {
                                setDiv(val);
                                setDivLabel(row ? String((row as Record<string, unknown>).NAME ?? val) : val);
                            }
                        }}
                        placeholder="All Divisions"
                    />
                </div>

                {/* Department Lookup */}
                <div style={{ flex: 1, minWidth: 160 }}>
                    <LookupField
                        label="Department"
                        value={dept === "ALL" ? "" : dept}
                        displayValue={deptLabel}
                        columns={lookupColumns}
                        valueField="CODE"
                        displayFields={["CODE", "NAME"]}
                        loadOptions={() => Promise.resolve(toLookupRows(deptOptions))}
                        onChange={(val, row) => {
                            if (!val || val === "ALL") {
                                setDept("ALL"); setDeptLabel("All");
                            } else {
                                setDept(val);
                                setDeptLabel(row ? String((row as Record<string, unknown>).NAME ?? val) : val);
                            }
                        }}
                        placeholder="All Departments"
                    />
                </div>

                <Button
                    variant="default"
                    size="default"
                    disabled={isFetching}
                    onClick={handleGenerate}
                >
                    {isFetching
                        ? <><Loader2 size={15} className="animate-spin" />Loading...</>
                        : <><Search size={15} />Generate Report</>
                    }
                </Button>
            </div>

            {/* ── Report Preview ── */}
            <div style={{ padding: 16, backgroundColor: "#eef1f5", flex: 1, minHeight: 0, overflow: "auto" }}>
                {!hasGenerated ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888", fontSize: 14 }}>
                        Select filters and click Generate to view report
                    </div>
                ) : isFetching ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888", fontSize: 14 }}>
                        Loading…
                    </div>
                ) : reportData.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888", fontSize: 14 }}>
                        No data found for selected filters.
                    </div>
                ) : (
                    <div style={{ background: "#fff", minWidth: 1200, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                        <ReportDesign
                            ref={reportRef}
                            rows={reportData}
                            filters={{ div, dept, period }}
                            filterLabels={{
                                div: divLabel,
                                dept: deptLabel,
                                period: periodOptions.find(p => p.code === period)?.label || period,
                            }}
                        />
                    </div>
                )}
            </div>

            {/* ── Print Button ── */}
            <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid #e0e0e0" }}
                className="no-print"
            >
                <Button
                    variant="default"
                    size="default"
                    disabled={!reportData.length}
                    onClick={handlePrint}
                >
                    <Printer size={16} />
                    Print
                </Button>
            </div>

        </div>
    );
};

export default AppraisalDivisionSummaryReport;