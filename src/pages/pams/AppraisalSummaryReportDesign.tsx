// AppraisalSummaryReportDesign.tsx
import React, { useMemo, useEffect, useState, useRef } from "react";
import { pamsSelect } from "../../api/pams";
import { useAuth } from "../../state/AuthContext";
import { Printer } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface Props {
  required_values: {
    loginid?: string;
    company_code?: string;
    period_label?: string;
  };
}

interface DivisionSummaryRow {
  DIV_CODE: string;
  DIV_NAME: string;
  DEPT_CODE: string;
  DEPT_NAME: string;
  SECTION_CODE: string;
  SECTION_NAME: string;
  DESG_CODE: string;
  DESG_NAME: string;
  R1: number;
  R2: number;
  R3: number;
  R4: number;
  R5: number;
  TOTAL: number;
}

interface DeptGroup {
  deptCode: string;
  deptName: string;
  r1: number; r2: number; r3: number; r4: number; r5: number;
  total: number;
}

interface DivGroup {
  divCode: string;
  divName: string;
  depts: DeptGroup[];
  r1: number; r2: number; r3: number; r4: number; r5: number;
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Bell Curve
// ─────────────────────────────────────────────────────────────
const POINT_BG = ["#ffd6d6", "#ffe8c8", "#fffacc", "#d6f0d6", "#d0e8ff"];
const POINT_BD = ["#cc5555", "#cc8833", "#aaaa22", "#44aa44", "#3366cc"];

const BellCurveChart: React.FC<{ ratingCounts: Record<number, number>; total: number }> = ({ ratingCounts }) => {
  const countData = useMemo(() => [1, 2, 3, 4, 5].map((r) => ratingCounts[r] ?? 0), [ratingCounts]);
  const W = 700, H = 230;
  const PAD = { top: 40, right: 30, bottom: 52, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxCount = Math.max(...countData, 1);
  const yMax = maxCount + 1;
  const toX = (v: number) => PAD.left + (v / 5) * chartW;
  const toY = (v: number) => PAD.top + chartH - (v / yMax) * chartH;
  const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i);
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
  const fillPath = linePath + ` L ${allPts[allPts.length - 1].x.toFixed(2)} ${baseline.toFixed(2)} L ${allPts[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`;

  return (
    <div style={{ marginTop: 10, pageBreakInside: "avoid", border: "1px solid #ccc", background: "#fff", lineHeight: 0 }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", background: "#fff" }}>
        <rect x={0} y={0} width={W} height={H} fill="#fff" />
        <text x={W / 2} y={20} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={10} fontWeight="bold" fill="#000">Grade Distribution Bell Curve</text>
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)} stroke="#e0e0e0" strokeWidth={0.5} />
            <text x={PAD.left - 5} y={toY(v) + 3} textAnchor="end" fontFamily="Arial, sans-serif" fontSize={8} fill="#555">{v}</text>
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={`x-${v}`}>
            <text x={toX(v)} y={PAD.top + chartH + 13} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={7.5} fill="#333">{v}</text>
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


const ReportContent = React.forwardRef<HTMLDivElement, {
  divGroups: DivGroup[];
  grandTotal: { r1: number; r2: number; r3: number; r4: number; r5: number; total: number };
  overallRatingCounts: Record<number, number>;
}>(({ divGroups, grandTotal, overallRatingCounts }, ref) => {
  const RC = [1, 2, 3, 4, 5] as const;

  return (
    <div
      ref={ref}
      style={{ background: "#fff", padding: 20, width: "100%", boxSizing: "border-box" }}
    >
      <style>{`
        .asr-wrap { font-family: Arial, sans-serif; font-size: 8.5px; color: #000; }
        .asr-header { display: flex; align-items: center; margin-bottom: 12px; }
        .asr-title-block { flex: 1; text-align: center; }
        .asr-title-block .main-title { font-size: 13px; font-weight: bold; }

        /* ── Core table reset ── */
        .asr-tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5px;
          font-family: Arial, sans-serif;
          table-layout: fixed;
        }
        .asr-tbl td, .asr-tbl th {
          border: 1px solid #000;
          padding: 3px 5px;
          vertical-align: middle;
          line-height: 1.45;
          overflow: hidden;
          white-space: nowrap;
        }

        /* ── Header styles ── */
        .asr-tbl .c-header    { font-weight: bold; background-color: #c0c0c0; text-align: center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .c-subheader { font-weight: bold; background-color: #d8d8d8; text-align: center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

        /* ── Alignment helpers ── */
        .asr-tbl .c-center { text-align: center; }
        .asr-tbl .c-right  { text-align: right;  }
        .asr-tbl .c-bold   { font-weight: bold;  }
        .asr-tbl .c-wrap   { white-space: normal; }

        /* ── Row colour bands ── */
        .asr-tbl .td-div    { font-weight: bold; background-color: #dce8f5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .td-divtot { font-weight: bold; background-color: #c8dcf0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .td-grand  { font-weight: bold; background-color: #b0cce6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .td-tot    { font-weight: bold; background-color: #efefef; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

        /* ── Summary table ── */
        .asr-tbl .c-sum-hdr { font-weight: bold; background-color: #f5c97a; text-align: center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .c-sum-lbl { font-weight: bold; background-color: #fdebc8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

        /* ── Rating colour cells ── */
        .asr-tbl .r1 { background-color:#ffd6d6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .r2 { background-color:#ffe8c8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .r3 { background-color:#fffacc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .r4 { background-color:#d6f0d6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .asr-tbl .r5 { background-color:#d0e8ff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

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
              <rect x="0"  y="0" width="40"  height="80" fill="#F7941D" />
              <rect x="40" y="0" width="155" height="80" fill="#008B9B" />
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
            <div className="main-title">Appraisal Summary Report — By Division &amp; Department</div>
          </div>
        </div>

        <table className="asr-tbl">
          <colgroup>
            <col style={{ width: "36px"  }} />
            <col style={{ width: "160px" }} />
            <col style={{ width: "180px" }} />
            <col style={{ width: "40px"  }} />
            <col style={{ width: "40px"  }} />
            <col style={{ width: "40px"  }} />
            <col style={{ width: "40px"  }} />
            <col style={{ width: "40px"  }} />
            <col style={{ width: "52px"  }} />
          </colgroup>

          <thead>
            <tr>
              <th className="c-header" rowSpan={2}>SL.</th>
              <th className="c-header" rowSpan={2}>Division</th>
              <th className="c-header" rowSpan={2}>Department</th>
              <th className="c-subheader" colSpan={5}>Performance Grade</th>
              <th className="c-header" rowSpan={2}>Total</th>
            </tr>
            <tr>
              {RC.map((r) => <th key={r} className="c-subheader c-center" style={{ width: 40 }}>{r}</th>)}
            </tr>
          </thead>

          <tbody>
            {divGroups.map((div, dIdx) => {
              const span = div.depts.length + 1;
              return (
                <React.Fragment key={div.divCode}>
                  {div.depts.map((dept, depIdx) => (
                    <tr key={dept.deptCode}>
                      {depIdx === 0 && (
                        <td className="td-div c-center" rowSpan={span} style={{ verticalAlign: "middle" }}>
                          {dIdx + 1}
                        </td>
                      )}
                      {depIdx === 0 && (
                        <td className="td-div c-bold c-wrap" rowSpan={span} style={{ verticalAlign: "middle" }}>
                          {div.divName || div.divCode}
                        </td>
                      )}
                      <td className="c-wrap">{dept.deptName || dept.deptCode}</td>
                      {RC.map((r) => {
                        const v = dept[`r${r}` as "r1" | "r2" | "r3" | "r4" | "r5"];
                        return (
                          <td key={r} className={`c-center${v > 0 ? ` r${r}` : ""}`}>{v}</td>
                        );
                      })}
                      <td className="c-center c-bold">{dept.total}</td>
                    </tr>
                  ))}

                  <tr>
                    <td colSpan={1} className="td-divtot c-right c-bold" style={{ paddingRight: 8 }}>
                      Division Total
                    </td>
                    {RC.map((r) => {
                      const v = div[`r${r}` as "r1" | "r2" | "r3" | "r4" | "r5"];
                      return (
                        <td key={r} className={`td-divtot c-center${v > 0 ? ` r${r}` : ""}`}>{v}</td>
                      );
                    })}
                    <td className="td-divtot c-center c-bold">{div.total}</td>
                  </tr>
                </React.Fragment>
              );
            })}

            <tr>
              <td colSpan={3} className="td-grand c-bold c-right" style={{ paddingRight: 8 }}>
                Grand Total
              </td>
              {RC.map((r) => {
                const v = overallRatingCounts[r] ?? 0;
                return <td key={r} className={`td-grand c-center${v > 0 ? ` r${r}` : ""}`}>{v}</td>;
              })}
              <td className="td-grand c-center c-bold">{grandTotal.total}</td>
            </tr>
          </tbody>
        </table>

        <table className="asr-tbl asr-sec">
          <thead>
            <tr>
              <th className="c-sum-hdr" style={{ textAlign: "left", width: "28%" }}>Grade</th>
              {RC.map((r) => <th key={r} className="c-sum-hdr c-center">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="c-sum-lbl">Grades Achieved</td>
              {RC.map((r) => (
                <td key={r} className={`c-center c-bold${(overallRatingCounts[r] ?? 0) > 0 ? ` r${r}` : ""}`}>
                  {overallRatingCounts[r] ?? 0}
                </td>
              ))}
            </tr>
            <tr>
              <td className="c-sum-lbl">Total Appraised Staff</td>
              {RC.map((r) => <td key={r} className="c-center">{grandTotal.total}</td>)}
            </tr>
            <tr>
              <td className="c-sum-lbl">Grade %</td>
              {RC.map((r) => (
                <td key={r} className="c-center">
                  {grandTotal.total > 0
                    ? (((overallRatingCounts[r] ?? 0) / grandTotal.total) * 100).toFixed(2) + "%"
                    : "0.00%"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <BellCurveChart ratingCounts={overallRatingCounts} total={grandTotal.total} />

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
  );
});

ReportContent.displayName = "ReportContent";

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
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; margin:0; padding:0; font-family:Arial,sans-serif; background:#fff; }
    thead { display: table-header-group; }
  `;

  const handlePrint = () => {
    if (!reportRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>${fileName}</title><style>${printStyles}</style></head><body>${reportRef.current.outerHTML}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!loginid) return;
    setIsFetching(true);
    pamsSelect({
      parameter: "appraisal_summary_division_wise",
      loginid,
      code1: companyCode,
      code2: "ALL",
      code3: "ALL",
      code4: "ALL",
    })
      .then((r) => setRawData(r as Record<string, unknown>[]))
      .catch(() => setRawData([]))
      .finally(() => setIsFetching(false));
  }, [loginid, companyCode]);

  const rawRows: DivisionSummaryRow[] = useMemo(
    () =>
      rawData.map((r) => ({
        DIV_CODE:     String(r.DIV_CODE     ?? r.div_code     ?? ""),
        DIV_NAME:     String(r.DIV_NAME     ?? r.div_name     ?? ""),
        DEPT_CODE:    String(r.DEPT_CODE    ?? r.dept_code    ?? ""),
        DEPT_NAME:    String(r.DEPT_NAME    ?? r.dept_name    ?? ""),
        SECTION_CODE: String(r.SECTION_CODE ?? r.section_code ?? ""),
        SECTION_NAME: String(r.SECTION_NAME ?? r.section_name ?? ""),
        DESG_CODE:    String(r.DESG_CODE    ?? r.desg_code    ?? ""),
        DESG_NAME:    String(r.DESG_NAME    ?? r.desg_name    ?? ""),
        R1:    Number(r.R1    ?? r.r1    ?? 0),
        R2:    Number(r.R2    ?? r.r2    ?? 0),
        R3:    Number(r.R3    ?? r.r3    ?? 0),
        R4:    Number(r.R4    ?? r.r4    ?? 0),
        R5:    Number(r.R5    ?? r.r5    ?? 0),
        TOTAL: Number(r.TOTAL ?? r.total ?? 0),
      })),
    [rawData]
  );

  const divGroups: DivGroup[] = useMemo(() => {
    const divMap = new Map<string, DivGroup>();
    rawRows.forEach((row) => {
      if (!divMap.has(row.DIV_CODE)) {
        divMap.set(row.DIV_CODE, { divCode: row.DIV_CODE, divName: row.DIV_NAME, depts: [], r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, total: 0 });
      }
      const div = divMap.get(row.DIV_CODE)!;
      let dept = div.depts.find((d) => d.deptCode === row.DEPT_CODE);
      if (!dept) {
        dept = { deptCode: row.DEPT_CODE, deptName: row.DEPT_NAME, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, total: 0 };
        div.depts.push(dept);
      }
      dept.r1 += row.R1; dept.r2 += row.R2; dept.r3 += row.R3; dept.r4 += row.R4; dept.r5 += row.R5; dept.total += row.TOTAL;
      div.r1  += row.R1; div.r2  += row.R2; div.r3  += row.R3; div.r4  += row.R4; div.r5  += row.R5; div.total  += row.TOTAL;
    });
    return Array.from(divMap.values());
  }, [rawRows]);

  const grandTotal = useMemo(() => ({
    r1: divGroups.reduce((s, d) => s + d.r1, 0),
    r2: divGroups.reduce((s, d) => s + d.r2, 0),
    r3: divGroups.reduce((s, d) => s + d.r3, 0),
    r4: divGroups.reduce((s, d) => s + d.r4, 0),
    r5: divGroups.reduce((s, d) => s + d.r5, 0),
    total: divGroups.reduce((s, d) => s + d.total, 0),
  }), [divGroups]);

  const overallRatingCounts: Record<number, number> = useMemo(() => ({
    1: grandTotal.r1, 2: grandTotal.r2, 3: grandTotal.r3, 4: grandTotal.r4, 5: grandTotal.r5,
  }), [grandTotal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
      <div style={{ padding: 16, backgroundColor: "#eef1f5", flex: 1, minHeight: 0, overflow: "auto" }}>
        {isFetching ? (
          <div style={{ padding: 24 }}>Loading…</div>
        ) : !divGroups.length ? (
          <div style={{ padding: 24 }}>No data found.</div>
        ) : (
          <div style={{ background: "#fff", minWidth: 800, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
            <ReportContent
              ref={reportRef}
              divGroups={divGroups}
              grandTotal={grandTotal}
              overallRatingCounts={overallRatingCounts}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid #e0e0e0" }} className="no-print">
        <Button variant="default" size="default" onClick={handlePrint}>
          <Printer size={16} />
          Print
        </Button>
      </div>

    </div>
  );
};
export default AppraisalSummaryReportDesign;