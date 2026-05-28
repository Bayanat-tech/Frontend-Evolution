// AppraisalSummaryReportDesign.tsx
import React, { useMemo, useEffect, useState, useRef } from "react";
import { pamsSelect } from "../../api/pams";
import { useAuth } from "../../state/AuthContext";
import { Printer } from "lucide-react";
import { Button } from "../../components/ui/Button";
// import { useReactToPrint } from "react-to-print";

interface Props {
  required_values: {
    loginid?: string;
    company_code?: string;
    period_label?: string;
  };
}

interface EmployeeSummaryRow {
  EMPLOYEE_CODE: string;
  EMPLOYEE_NAME: string;
  GRADE_CODE: string;
  GRADE_NAME: string;
  DIV_CODE: string;
  DIV_NAME: string;
  DEPT_CODE: string;
  DEPT_NAME: string;
  SECTION_CODE: string;
  SECTION_NAME: string;
  DESG_CODE: string;
  DESG_NAME: string;
  FINAL_RATING: number | string;
}

// ─────────────────────────────────────────────────────────────
// Bell Curve — SVG-based (sharp, no blur, print-safe)
// ─────────────────────────────────────────────────────────────
interface BellCurveProps {
  ratingCounts: Record<number, number>;
  total: number;
  deptDisplay: string;
}

const POINT_BG = ["#ffd6d6", "#ffe8c8", "#fffacc", "#d6f0d6", "#d0e8ff"];
const POINT_BD = ["#cc5555", "#cc8833", "#aaaa22", "#44aa44", "#3366cc"];

const BellCurveChart: React.FC<BellCurveProps> = ({ ratingCounts, deptDisplay }) => {
  const countData = useMemo(
    () => [1, 2, 3, 4, 5].map((r) => ratingCounts[r] ?? 0),
    [ratingCounts]
  );

  const W = 700;
  const H = 230;
  const PAD = { top: 40, right: 30, bottom: 52, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxCount = Math.max(...countData, 1);
  const yMax = maxCount + 1;

  const xMin = 0;
  const xMax = 5;
  const xRange = xMax - xMin;

  const toX = (val: number) => PAD.left + ((val - xMin) / xRange) * chartW;
  const toY = (val: number) => PAD.top + chartH - (val / yMax) * chartH;

  const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i);
  const xTicks = [0, 1, 2, 3, 4, 5];

  const dataPoints = countData.map((count, i) => ({
    x: toX(i + 1),
    y: toY(count),
    count,
    grade: i + 1,
  }));

  const allPts = [
    { x: toX(0), y: toY(0) },
    ...dataPoints.map((p) => ({ x: p.x, y: p.y })),
    { x: toX(5), y: toY(0) },
  ];

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
  const fillPath =
    linePath +
    ` L ${allPts[allPts.length - 1].x.toFixed(2)} ${baseline.toFixed(2)}` +
    ` L ${allPts[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`;

  const titleText = `${deptDisplay ? deptDisplay + "  \u2014  " : ""}Grade Distribution Bell Curve`;

  return (
    <div style={{ marginTop: 10, pageBreakInside: "avoid", border: "1px solid #cccccc", background: "#ffffff", lineHeight: 0 }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", background: "#ffffff" }}>
        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
        <text x={W / 2} y={20} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={10} fontWeight="bold" fill="#000000">{titleText}</text>
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)} stroke="#e0e0e0" strokeWidth={0.5} />
            <text x={PAD.left - 5} y={toY(v) + 3} textAnchor="end" fontFamily="Arial, sans-serif" fontSize={8} fill="#555555">{v}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={`x-${v}`}>
            <text x={toX(v)} y={PAD.top + chartH + 13} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={7.5} fill="#333333">{v}</text>
            <line x1={toX(v)} y1={PAD.top + chartH} x2={toX(v)} y2={PAD.top + chartH + 4} stroke="#aaaaaa" strokeWidth={0.5} />
          </g>
        ))}
        <path d={fillPath} fill="rgba(192,57,43,0.08)" />
        <path d={linePath} fill="none" stroke="#c0392b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        {dataPoints.map((pt, i) => (
          <g key={`pt-${i}`}>
            <circle cx={pt.x} cy={pt.y} r={6} fill={POINT_BG[i]} />
            <circle cx={pt.x} cy={pt.y} r={6} fill="none" stroke={POINT_BD[i]} strokeWidth={1.5} />
          </g>
        ))}
        <polyline points={`${PAD.left},${PAD.top} ${PAD.left},${PAD.top + chartH} ${PAD.left + chartW},${PAD.top + chartH}`} fill="none" stroke="#888888" strokeWidth={0.8} />
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Report Content (printable area)
// ─────────────────────────────────────────────────────────────
const ReportContent = React.forwardRef<HTMLDivElement, {
  employees: EmployeeSummaryRow[];
  ratingCounts: Record<number, number>;
  deptDisplay: string;
  total: number;
}>(({ employees, ratingCounts, deptDisplay, total }, ref) => (
  <div
    ref={ref}
    style={{ background: "#fff", padding: 20, width: "100%", boxSizing: "border-box", overflow: "hidden" }}
  >
    <style>{`
      .asr-wrap { font-family: Arial, sans-serif; font-size: 8.5px; color: #000; }
      .asr-header { display: flex; align-items: center; margin-bottom: 12px; }
      .asr-title-block { flex: 1; text-align: center; }
      .asr-title-block .main-title { font-size: 13px; font-weight: bold; }
      .asr-tbl { width: 100%; border-collapse: collapse; font-size: 8.5px; font-family: Arial, sans-serif; table-layout: auto; }
      .asr-tbl td, .asr-tbl th { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; line-height: 1.4; white-space: nowrap; }
      .asr-tbl .c-header { font-weight: bold; background-color: #c0c0c0; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .asr-tbl .c-subheader { font-weight: bold; background-color: #d8d8d8; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .asr-tbl .c-center { text-align: center; }
      .asr-tbl .c-right  { text-align: right; }
      .asr-tbl .c-bold   { font-weight: bold; }
      .asr-tbl .c-total  { font-weight: bold; background-color: #efefef; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .asr-tbl .c-sum-hdr { font-weight: bold; background-color: #f5c97a; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .asr-tbl .c-sum-lbl { font-weight: bold; background-color: #fdebc8; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .asr-tbl .r1 { background-color:#ffd6d6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .asr-tbl .r2 { background-color:#ffe8c8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .asr-tbl .r3 { background-color:#fffacc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .asr-tbl .r4 { background-color:#d6f0d6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .asr-tbl .r5 { background-color:#d0e8ff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .asr-tbl .c-check  { font-size: 10px; font-weight: bold; line-height: 1; }
      .asr-tbl .c-nowrap { white-space: nowrap; }
      .asr-tbl .c-perf   { width: 28px; min-width: 28px; max-width: 28px; text-align: center; }
      .asr-sec { margin-top: 8px; }
      @media print {
        @page { size: A4 landscape; margin: 10mm 8mm; }
        body * { visibility: hidden; }
        .asr-wrap, .asr-wrap * { visibility: visible; }
        .asr-wrap { position: absolute; top: 0; left: 0; width: 100%; }
      }
    `}</style>

    <div className="asr-wrap">

      {/* ── Logo + Title ── */}
      <div className="asr-header">
        <div style={{ flexShrink: 0, width: 187, height: 68 }}>
          <svg width="187" height="68" viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
            <rect x="0"   y="0" width="40"  height="80" fill="#F7941D" />
            <rect x="40"  y="0" width="155" height="80" fill="#008B9B" />
            <text x="117" y="17" fill="#fff"    fontSize="10.5" fontFamily="Arial" textAnchor="middle" fontWeight="bold">المدينة</text>
            <text x="117" y="34" fill="#fff"    fontSize="16"   fontFamily="Arial" textAnchor="middle" fontWeight="bold">al madina</text>
            <text x="117" y="50" fill="#F7941D" fontSize="10"   fontFamily="Arial" textAnchor="middle" fontWeight="bold" letterSpacing="2.5">LOGISTICS</text>
            <text x="117" y="62" fill="#fff"    fontSize="8.5"  fontFamily="Arial" textAnchor="middle">اللوجستية</text>
            <text x="117" y="74" fill="#fff"    fontSize="7"    fontFamily="Arial" textAnchor="middle">خدمات لوجستية فائقة</text>
            <polygon points="185,14 204,40 185,66" fill="#F7941D" />
            <polygon points="174,19 191,40 174,61" fill="#F7941D" opacity="0.5" />
          </svg>
        </div>
        <div className="asr-title-block">
          <div className="main-title">
            Appraisal Summary{deptDisplay ? ` — ${deptDisplay} DEPARTMENT` : ""}
          </div>
        </div>
      </div>

      {/* ── Main Employee Table ── */}
      <table className="asr-tbl">
        <colgroup>
          <col style={{ width: "40px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "52px" }} />
          <col style={{ width: "52px" }} />
          <col style={{ width: "52px" }} />
          <col style={{ width: "52px" }} />
          <col style={{ width: "52px" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c-header" rowSpan={2}>SL.No</th>
            <th className="c-header" rowSpan={2}>Emp No</th>
            <th className="c-header" rowSpan={2}>Name</th>
            <th className="c-header c-nowrap" rowSpan={2}>Division</th>
            <th className="c-header" rowSpan={2}>Department</th>
            <th className="c-header" rowSpan={2}>Section</th>
            <th className="c-header" rowSpan={2}>Position</th>
            <th className="c-subheader" colSpan={5}>Performance</th>
          </tr>
          <tr>
            {[1, 2, 3, 4, 5].map((r) => (
              <th key={r} className="c-subheader c-perf">{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            const rating = Number(emp.FINAL_RATING);
            return (
              <tr key={`${emp.EMPLOYEE_CODE}-${idx}`}>
                <td className="c-center">{idx + 1}</td>
                <td className="c-center">{emp.EMPLOYEE_CODE}</td>
                <td>{emp.EMPLOYEE_NAME}</td>
                <td>{emp.DIV_NAME  || emp.DIV_CODE}</td>
                <td>{emp.DEPT_NAME || emp.DEPT_CODE}</td>
                <td>{emp.SECTION_NAME || emp.SECTION_CODE}</td>
                <td>{emp.DESG_NAME}</td>
                {[1, 2, 3, 4, 5].map((r) => (
                  <td key={r} className={`c-center c-perf${rating === r ? ` r${r}` : ""}`}>
                    {rating === r ? <span className="c-check">✔</span> : ""}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr>
            <td colSpan={7} className="c-total c-right" style={{ paddingRight: 8 }}>
              Total Staff Appraised:&nbsp;<strong>{total}</strong>
            </td>
            {[1, 2, 3, 4, 5].map((r) => (
              <td key={r} className="c-total c-center">{ratingCounts[r]}</td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* ── Grade Summary Table ── */}
      <table className="asr-tbl asr-sec">
        <thead>
          <tr>
            <th className="c-sum-hdr" style={{ textAlign: "left", width: "28%" }}>Grade</th>
            {[1, 2, 3, 4, 5].map((r) => (
              <th key={r} className="c-sum-hdr c-center">{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="c-sum-lbl">Grades Achieved</td>
            {[1, 2, 3, 4, 5].map((r) => (
              <td key={r} className={`c-center c-bold${ratingCounts[r] > 0 ? ` r${r}` : ""}`}>
                {ratingCounts[r]}
              </td>
            ))}
          </tr>
          <tr>
            <td className="c-sum-lbl">Total Appraised Staff</td>
            {[1, 2, 3, 4, 5].map((r) => (
              <td key={r} className="c-center">{total}</td>
            ))}
          </tr>
          <tr>
            <td className="c-sum-lbl">Grade %</td>
            {[1, 2, 3, 4, 5].map((r) => (
              <td key={r} className="c-center">
                {total > 0 ? ((ratingCounts[r] / total) * 100).toFixed(2) + "%" : "0.00%"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* ── Bell Curve ── */}
      <BellCurveChart ratingCounts={ratingCounts} total={total} deptDisplay={deptDisplay} />

      {/* ── Legend ── */}
      <table className="asr-tbl asr-sec">
        <tbody>
          <tr>
            <td className="c-bold" style={{ width: "14%" }}>Rating Scale:</td>
            <td>
              1 = Unsatisfactory &nbsp;&nbsp;&nbsp;
              2 = Below Expectations &nbsp;&nbsp;&nbsp;
              3 = Meets Expectations &nbsp;&nbsp;&nbsp;
              4 = Above Expectations &nbsp;&nbsp;&nbsp;
              5 = Exceptional
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Signatures ── */}
      <table className="asr-tbl asr-sec">
        <tbody>
          <tr>
            <td className="c-bold" style={{ width: "18%" }}>Prepared By:</td>
            <td style={{ width: "32%" }}>&nbsp;</td>
            <td className="c-bold" style={{ width: "18%" }}>Reviewed By:</td>
            <td style={{ width: "32%" }}>&nbsp;</td>
          </tr>
          <tr>
            <td className="c-bold">Signature &amp; Date:</td>
            <td>&nbsp;</td>
            <td className="c-bold">Signature &amp; Date:</td>
            <td>&nbsp;</td>
          </tr>
        </tbody>
      </table>

    </div>
  </div>
));

ReportContent.displayName = "ReportContent";

// ─────────────────────────────────────────────────────────────
// Main Page Component (wrapper with breadcrumb + print button)
// ─────────────────────────────────────────────────────────────
const AppraisalSummaryReportDesign: React.FC<Props> = ({ required_values }) => {
  const { user } = useAuth();
  const { company_code = "" } = required_values;
  const loginid = required_values.loginid || user?.loginid || user?.username || "";
  const companyCode = company_code || user?.company_code || "";

  const reportRef = useRef<HTMLDivElement>(null);
  const fileName = `Appraisal-Summary-Report-${new Date().toISOString().slice(0, 10)}`;

  const printStyles = `
    @page { margin: 10mm 8mm; size: A4 landscape; }
    * { box-sizing: border-box; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0; padding: 0;
      font-family: Arial, sans-serif;
      background: #fff;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  `;

//   const handlePrint = useReactToPrint({
//     contentRef: reportRef,
//     documentTitle: fileName,
//     pageStyle: printStyles,
//   });

  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!loginid) return;
    setIsFetching(true);
    pamsSelect({
      parameter: "appraisal_summary_by_login",
      loginid,
      code1: companyCode,
    })
      .then((response) => setRawData(response as Record<string, unknown>[]))
      .catch(() => setRawData([]))
      .finally(() => setIsFetching(false));
  }, [loginid, companyCode]);

  const employees: EmployeeSummaryRow[] = useMemo(
    () =>
      rawData.map((r) => ({
        EMPLOYEE_CODE:  String(r.EMPLOYEE_CODE  ?? r.employee_code  ?? ""),
        EMPLOYEE_NAME:  String(r.EMPLOYEE_NAME  ?? r.employee_name  ?? ""),
        GRADE_CODE:     String(r.GRADE_CODE     ?? r.grade_code     ?? ""),
        GRADE_NAME:     String(r.GRADE_NAME     ?? r.grade_name     ?? ""),
        DIV_CODE:       String(r.DIV_CODE       ?? r.div_code       ?? ""),
        DIV_NAME:       String(r.DIV_NAME       ?? r.div_name       ?? ""),
        DEPT_CODE:      String(r.DEPT_CODE      ?? r.dept_code      ?? ""),
        DEPT_NAME:      String(r.DEPT_NAME      ?? r.dept_name      ?? ""),
        SECTION_CODE:   String(r.SECTION_CODE   ?? r.section_code   ?? ""),
        SECTION_NAME:   String(r.SECTION_NAME   ?? r.section_name   ?? ""),
        DESG_CODE:      String(r.DESG_CODE      ?? r.desg_code      ?? ""),
        DESG_NAME:      String(r.DESG_NAME      ?? r.desg_name      ?? ""),
        FINAL_RATING:   (r.FINAL_RATING ?? r.final_rating ?? "") as string | number,
      })),
    [rawData]
  );

  const ratingCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    employees.forEach((e) => {
      const r = Number(e.FINAL_RATING);
      if (r >= 1 && r <= 5) c[r]++;
    });
    return c;
  }, [employees]);

  const deptDisplay = useMemo(
    () => (employees.length > 0 ? employees[0].DEPT_NAME : ""),
    [employees]
  );

  const total = employees.length;

    function handlePrint(): void {
        throw new Error("Function not implemented.");
    }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

  {/* ── Breadcrumb + Title ── */}
  <div style={{ padding: "12px 24px", borderBottom: "1px solid #e0e0e0" }}>
    <nav aria-label="breadcrumb" style={{ marginBottom: 4, fontSize: 13, color: "#666" }}>
      <a href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Home</a>
      <span style={{ margin: "0 6px" }}>›</span>
      <a href="/pams/masters" style={{ color: "inherit", textDecoration: "none" }}>Master</a>
      <span style={{ margin: "0 6px" }}>›</span>
      <a href="/pams/masters/gm" style={{ color: "inherit", textDecoration: "none" }}>General Master</a>
      <span style={{ margin: "0 6px" }}>›</span>
      <span style={{ color: "#000" }}>Appraisal Summary Report</span>
    </nav>
    <h6 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Appraisal Summary Report</h6>
  </div>

  {/* ── Report Preview Area ── */}
  <div style={{ padding: 16, backgroundColor: "#eef1f5", flex: 1, minHeight: 0, overflow: "auto" }}>
    {isFetching ? (
      <div style={{ padding: 24 }}>Loading…</div>
    ) : !employees.length ? (
      <div style={{ padding: 24 }}>No data found for your department.</div>
    ) : (
      <div style={{ background: "#fff", minWidth: 900, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
        <ReportContent
          ref={reportRef}
          employees={employees}
          ratingCounts={ratingCounts}
          deptDisplay={deptDisplay}
          total={total}
        />
      </div>
    )}
  </div>

  {/* ── Print Button ── */}
  <div
    style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid #e0e0e0" }}
    className="no-print"
  >
    <Button variant="default" size="default" onClick={() => handlePrint()}>
      <Printer size={16} />
      Print
    </Button>
  </div>

</div>
  );
};

export default AppraisalSummaryReportDesign;