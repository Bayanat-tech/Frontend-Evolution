import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Users, CheckCircle2, Clock, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { pamsSelect } from '../../api/pams';
import { executeWmsInboundSql } from '../../api/wms';
import { useAuth } from '../../state/AuthContext';

interface EmployeeData {
  TOTAL_EMPLOYEES: number;
}
interface EmployeeDivision {
  DIV_CODE: string;
  DIV_NAME: string;
}
interface EmployeeDepartment {
  DEPT_CODE: string;
  DEPT_NAME: string;
}
interface EmployeeSection {
  SECTION_CODE: string;
  SECTION_NAME: string;
}
interface PeriodData {
  VALUE: string;
  LABEL: string;
}
interface ApiResponse<T> {
  success: boolean;
  data: T[];
  totalCount: number;
}
interface RatingRow {
  TOTAL_RATING: number;
  COUNT: number;
}

const RATING_CONFIG: Record<number, { label: string; color: string }> = {
  5: { label: 'Outstanding', color: '#1d4ed8' },
  4: { label: 'Exceeds', color: '#059669' },
  3: { label: 'Meets', color: '#d97706' },
  2: { label: 'Needs Improvement', color: '#ea580c' },
  1: { label: 'Poor', color: '#dc2626' },
};

const ZONE_COLORS = [
  { min: 0.5, max: 1.5, color: 'rgba(220,38,38,0.15)' },
  { min: 1.5, max: 2.5, color: 'rgba(234,88,12,0.15)' },
  { min: 2.5, max: 3.5, color: 'rgba(217,119,6,0.15)' },
  { min: 3.5, max: 4.5, color: 'rgba(5,150,105,0.15)' },
  { min: 4.5, max: 5.5, color: 'rgba(29,78,216,0.15)' },
];

function getRatingPoints(rows: RatingRow[]) {
  return rows
    .map((r) => ({ x: Number(r.TOTAL_RATING), y: Number(r.COUNT) }))
    .sort((a, b) => a.x - b.x);
}

function interpolateForFill(points: { x: number; y: number }[]) {
  if (points.length === 0) return [];
  const pts: { x: number; y: number }[] = [];
  const minX = Math.max(0.5, points[0].x - 0.25);
  const maxX = Math.min(5.5, points[points.length - 1].x + 0.25);
  for (let x = minX; x <= maxX; x += 0.02) {
    let y = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (x >= points[i].x && x <= points[i + 1].x) {
        const t = (x - points[i].x) / (points[i + 1].x - points[i].x || 1);
        y = points[i].y + (points[i + 1].y - points[i].y) * t;
        break;
      }
    }
    if (x <= points[0].x) y = points[0].y;
    if (x >= points[points.length - 1].x) y = points[points.length - 1].y;
    pts.push({ x: parseFloat(x.toFixed(2)), y });
  }
  return pts;
}

// ── Modern filter select ─────────────────────────────────────
interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { code: string; name: string }[];
  showReset?: boolean;
  onReset?: () => void;
}

const FilterSelect = ({ label, value, onChange, options, showReset, onReset }: FilterSelectProps) => (
  <div>
    <div className='flex items-center justify-between mb-1.5'>
      <label className='text-xs font-medium text-gray-500'>{label}</label>
      {showReset && onReset && (
        <button type='button' onClick={onReset} className='text-xs text-indigo-600 hover:text-indigo-800 font-medium'>
          Reset
        </button>
      )}
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className='w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors'
    >
      {options.map((opt) => (
        <option key={opt.code} value={opt.code}>{opt.name}</option>
      ))}
    </select>
  </div>
);

// ── Modern KPI card with icon + color system ─────────────────
type KpiTone = 'neutral' | 'success' | 'warning' | 'accent' | 'good' | 'bad';

const TONE_STYLES: Record<KpiTone, { bg: string; icon: string; text: string }> = {
  neutral: { bg: 'bg-indigo-50', icon: 'text-indigo-600', text: 'text-indigo-700' },
  success: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-700' },
  accent: { bg: 'bg-violet-50', icon: 'text-violet-600', text: 'text-violet-700' },
  good: { bg: 'bg-teal-50', icon: 'text-teal-600', text: 'text-teal-700' },
  bad: { bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-700' },
};

interface KpiCardProps {
  label: string;
  value: string | number;
  tone: KpiTone;
  icon: React.ReactNode;
}
const KpiCard = ({ label, value, tone, icon }: KpiCardProps) => {
  const s = TONE_STYLES[tone];
  return (
    <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow'>
      <div className='flex items-start justify-between'>
        <div>
          <div className='text-xs font-medium text-gray-500 uppercase tracking-wide'>{label}</div>
          <div className={`text-2xl font-semibold mt-1.5 ${s.text}`}>{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg}`}>
          <div className={s.icon}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

const PanelHeader = ({ title }: { title: string }) => (
  <div className='flex items-center gap-2 mb-4'>
    <div className='w-1 h-4 bg-indigo-600 rounded-full' />
    <div className='text-sm font-semibold text-gray-800'>{title}</div>
  </div>
);

const PamsDashboard = () => {
  const { user } = useAuth();
  const [ddepartment, setDdepartment] = useState<string>('All');
  const [ddivision, setDdivision] = useState<string>('All');
  const [dsection, setDsection] = useState<string>('All');
  const [dperiod, setDperiod] = useState<string>('');

  const { data: Total_Employees } = useQuery<EmployeeData[]>({
    queryKey: ['total_employees', ddivision, ddepartment, dsection],
    queryFn: () =>
      pamsSelect<EmployeeData>({
        parameter: 'employee_hierarchy_total',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: ddivision,
        code3: ddepartment,
        code4: dsection,
      }),
  });

  const { data: Division } = useQuery<EmployeeDivision[]>({
    queryKey: ['division'],
    queryFn: () =>
      pamsSelect<EmployeeDivision>({
        parameter: 'employee_division',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
      }),
  });

  const { data: Department } = useQuery<EmployeeDepartment[]>({
    queryKey: ['department'],
    queryFn: () =>
      pamsSelect<EmployeeDepartment>({
        parameter: 'employee_department',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: ddivision,
      }),
  });

  const { data: Section } = useQuery<EmployeeSection[]>({
    queryKey: ['section'],
    queryFn: () =>
      pamsSelect<EmployeeSection>({
        parameter: 'employee_section',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: ddivision,
        code3: ddepartment,
      }),
  });

  const { data: PeriodResponse } = useQuery<ApiResponse<PeriodData> | null>({
    queryKey: ['period'],
    queryFn: async () => {
      const sql = `
        SELECT PERIOD_NUMBER AS VALUE,
        TO_CHAR(PERIOD_FROM_DATE,'DD-MON-YYYY') || ' - ' ||
        TO_CHAR(PERIOD_TO_DATE,'DD-MON-YYYY') AS LABEL
        FROM MS_KPI_PERIOD
        WHERE company_code = '${user?.company_code}'
        ORDER BY PERIOD_NUMBER DESC
      `;
      const response = await executeWmsInboundSql(sql);
      return response as unknown as ApiResponse<PeriodData> | null;
    },
  });
  const Period: any = PeriodResponse ?? [];

  useEffect(() => {
    if (Period.length > 0 && !dperiod) {
      setDperiod(String(Period[0].VALUE));
    }
  }, [Period]);

  const { data: FinalApprovedRes } = useQuery({
    queryKey: ['final_approved', ddivision, ddepartment, dsection, dperiod],
    enabled: !!Division && !!Department && !!Section && !!dperiod,
    queryFn: async () => {
      const sql = `
        SELECT COUNT(*) AS total_final_approved
        FROM VW_PAMS_DASH_BOARD
        WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}')
        AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}')
        AND ('${dsection}' = 'All' OR section_code = '${dsection}')
        AND PERIOD_NUMBER = '${dperiod}'
        AND NVL(FINAL_APPROVED,'No') = 'YES'
      `;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: Pending_Appraisals } = useQuery({
    queryKey: ['pending_appraisals', ddivision, ddepartment, dsection, dperiod],
    enabled: !!ddivision && !!ddepartment && !!dsection && !!dperiod,
    queryFn: async () => {
      const sql = `
        SELECT COUNT(*) AS total_pending_appraisals
        FROM VW_PAMS_DASH_BOARD
        WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}')
        AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}')
        AND ('${dsection}' = 'All' OR section_code = '${dsection}')
        AND PERIOD_NUMBER = '${dperiod}'
        AND LAST_ACTION <> 'SAVE AS DRAFT'
        AND NVL(FINAL_APPROVED,'No') <> 'YES'
      `;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: Ratings } = useQuery({
    queryKey: ['ratings', ddivision, ddepartment, dsection, dperiod],
    enabled: !!Division && !!Department && !!Section && !!dperiod,
    queryFn: async () => {
      const sql = `
        SELECT
          COUNT(*) AS total_employees,
          ROUND(AVG(TOTAL_RATING), 2) AS avg_rating,
          SUM(CASE WHEN TOTAL_RATING >= 4 THEN 1 ELSE 0 END) AS top_performers,
          SUM(CASE WHEN TOTAL_RATING <= 2 THEN 1 ELSE 0 END) AS low_performers,
          ROUND((SUM(CASE WHEN TOTAL_RATING >= 4 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100, 2) AS top_performers_pct,
          ROUND((SUM(CASE WHEN TOTAL_RATING <= 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100, 2) AS low_performers_pct
        FROM VW_PAMS_DASH_BOARD
        WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}')
        AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}')
        AND ('${dsection}' = 'All' OR section_code = '${dsection}')
        AND PERIOD_NUMBER = '${dperiod}'
        AND NVL(FINAL_APPROVED,'No') = 'YES'
      `;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: RatingDistribution } = useQuery({
    queryKey: ['rating_distribution', ddivision, ddepartment, dsection, dperiod],
    enabled: !!ddivision && !!ddepartment && !!dsection && !!dperiod,
    queryFn: async () => {
      const sql = `
        SELECT
          TOTAL_RATING,
          COUNT(*) AS COUNT
        FROM VW_PAMS_DASH_BOARD
        WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}')
        AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}')
        AND ('${dsection}' = 'All' OR section_code = '${dsection}')
        AND PERIOD_NUMBER = '${dperiod}'
        AND NVL(FINAL_APPROVED,'No') = 'YES'
        AND TOTAL_RATING IS NOT NULL
        GROUP BY TOTAL_RATING
        ORDER BY TOTAL_RATING
      `;
      return (await executeWmsInboundSql(sql)) as unknown as RatingRow[] | null;
    },
  });

  const { data: DeptHistogram } = useQuery({
    queryKey: ['dept_histogram', ddivision, ddepartment, dsection, dperiod],
    enabled: !!ddivision && !!ddepartment && !!dsection && !!dperiod,
    queryFn: async () => {
      const sql = `
      SELECT
        DEPT_NAME,
        ROUND(AVG(TOTAL_RATING), 2) AS AVG_RATING,
        COUNT(*) AS EMP_COUNT
      FROM VW_PAMS_DASH_BOARD
      WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}')
      AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}')
      AND ('${dsection}' = 'All' OR SECTION_CODE = '${dsection}')
      AND PERIOD_NUMBER = '${dperiod}'
      AND NVL(FINAL_APPROVED,'No') = 'YES'
      AND TOTAL_RATING IS NOT NULL
      GROUP BY DEPT_NAME
      ORDER BY AVG_RATING DESC
    `;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: SectionHistogram } = useQuery({
    queryKey: ['section_histogram', ddivision, ddepartment, dsection, dperiod],
    enabled: !!ddivision && !!ddepartment && !!dsection && !!dperiod,
    queryFn: async () => {
      const sql = `
        SELECT
          SECTION_NAME,
          ROUND(AVG(TOTAL_RATING), 2) AS AVG_RATING,
          COUNT(*) AS EMP_COUNT
        FROM VW_PAMS_DASH_BOARD
        WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}')
        AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}')
        AND ('${dsection}' = 'All' OR SECTION_CODE = '${dsection}')
        AND PERIOD_NUMBER = '${dperiod}'
        AND NVL(FINAL_APPROVED,'No') = 'YES'
        AND TOTAL_RATING IS NOT NULL
        GROUP BY SECTION_NAME
        ORDER BY AVG_RATING DESC
      `;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: AppraisalStatus } = useQuery({
    queryKey: ['appraisal_status', ddivision, ddepartment, dsection, dperiod],
    enabled: !!ddivision && !!ddepartment && !!dsection && !!dperiod,
    queryFn: async () => {
      const sql = `
      SELECT
        SUM(CASE WHEN NVL(FINAL_APPROVED,'No') = 'YES' THEN 1 ELSE 0 END) AS COMPLETED,
        SUM(CASE WHEN NVL(FINAL_APPROVED,'No') <> 'YES'
              AND LAST_ACTION <> 'SAVE AS DRAFT'
              AND REVIEW_DATE IS NOT NULL THEN 1 ELSE 0 END) AS IN_PROGRESS,
        SUM(CASE WHEN (LAST_ACTION = 'SAVE AS DRAFT'
              OR REVIEW_DATE IS NULL)
              AND NVL(FINAL_APPROVED,'No') <> 'YES' THEN 1 ELSE 0 END) AS PENDING,
        COUNT(*) AS TOTAL
      FROM VW_PAMS_DASH_BOARD
      WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}')
      AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}')
      AND ('${dsection}' = 'All' OR SECTION_CODE = '${dsection}')
      AND PERIOD_NUMBER = '${dperiod}'
    `;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: TopEmployees } = useQuery({
    queryKey: ['top_employees', ddivision, ddepartment, dsection, dperiod],
    enabled: !!ddivision && !!ddepartment && !!dsection && !!dperiod,
    queryFn: async () => {
      const sql = `
      SELECT
        ROWNUM AS RANK,
        EMPLOYEE_NAME,
        DEPT_NAME,
        TOTAL_RATING
      FROM (
        SELECT
          EMPLOYEE_NAME,
          DEPT_NAME,
          TOTAL_RATING
        FROM VW_PAMS_DASH_BOARD
        WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}')
        AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}')
        AND ('${dsection}' = 'All' OR SECTION_CODE = '${dsection}')
        AND PERIOD_NUMBER = '${dperiod}'
        AND NVL(FINAL_APPROVED,'No') = 'YES'
        AND TOTAL_RATING IS NOT NULL
        ORDER BY TOTAL_RATING DESC
      )
      WHERE ROWNUM <= 5
    `;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const distRows = (RatingDistribution as RatingRow[]) ?? [];
  const ratingPoints = getRatingPoints(distRows);
  const totalCount = distRows.reduce((sum, r) => sum + Number(r.COUNT), 0);

  const legendItems = [1, 2, 3, 4, 5].map((rating) => {
    const bucketRows = distRows.filter((r) => Math.round(Number(r.TOTAL_RATING)) === rating);
    const count = bucketRows.reduce((sum, r) => sum + Number(r.COUNT), 0);
    const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(0) + '%' : '0%';
    return {
      num: String(rating),
      label: RATING_CONFIG[rating].label,
      color: RATING_CONFIG[rating].color,
      pct,
      count,
    };
  });

  useEffect(() => {
    if (!RatingDistribution) return;

    const drawCharts = () => {
      const Chart = (window as any).Chart;
      if (!Chart) return;

      const maxCount = Math.max(...ratingPoints.map((p) => p.y), 1);
      const fillPoints = interpolateForFill(ratingPoints);

      const multiColorFill = {
        id: 'multiColorFill',
        beforeDatasetsDraw(chart: any) {
          const { ctx, scales: { x, y } } = chart;
          if (chart.canvas.id !== 'bellChart') return;
          ZONE_COLORS.forEach(({ min, max, color }) => {
            const seg = fillPoints.filter((p: any) => p.x >= min && p.x <= max);
            if (!seg.length) return;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x.getPixelForValue(seg[0].x), y.getPixelForValue(0));
            seg.forEach((p: any) => ctx.lineTo(x.getPixelForValue(p.x), y.getPixelForValue(p.y)));
            ctx.lineTo(x.getPixelForValue(seg[seg.length - 1].x), y.getPixelForValue(0));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          });
        },
      };

      const deptRows = (DeptHistogram as any[]) ?? [];
      const sectionRows = (SectionHistogram as any[]) ?? [];

      const deptLabels = deptRows.map((r: any) => r.DEPT_NAME ?? '');
      const deptValues = deptRows.map((r: any) => Number(r.AVG_RATING));
      const sectionLabels = sectionRows.map((r: any) => r.SECTION_NAME ?? '');
      const sectionValues = sectionRows.map((r: any) => Number(r.AVG_RATING));

      const allDeptVals = deptValues.length ? deptValues : [3];
      const allSectionVals = sectionValues.length ? sectionValues : [3];
      const deptMin = Math.max(0, Math.floor(Math.min(...allDeptVals) - 0.5));
      const deptMax = Math.min(5, Math.ceil(Math.max(...allDeptVals) + 0.5));
      const sectionMin = Math.max(0, Math.floor(Math.min(...allSectionVals) - 0.5));
      const sectionMax = Math.min(5, Math.ceil(Math.max(...allSectionVals) + 0.5));

      const bellCanvas = document.getElementById('bellChart') as HTMLCanvasElement;
      const deptCanvas = document.getElementById('deptChart') as HTMLCanvasElement;
      const sectionCanvas = document.getElementById('sectionChart') as HTMLCanvasElement;

      if (!bellCanvas || !deptCanvas || !sectionCanvas) return;

      Chart.getChart(bellCanvas)?.destroy();
      Chart.getChart(deptCanvas)?.destroy();
      Chart.getChart(sectionCanvas)?.destroy();

      Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";

      new Chart(bellCanvas, {
        type: 'line',
        plugins: [multiColorFill],
        data: {
          datasets: [
            {
              type: 'line',
              label: 'Trend',
              data: ratingPoints,
              borderColor: '#4338ca',
              borderWidth: 2.5,
              pointRadius: 0,
              tension: 0.25,
              fill: false,
              parsing: false,
              order: 2,
            },
            {
              type: 'scatter',
              label: 'Composite scores',
              data: ratingPoints,
              backgroundColor: '#1e1b4b',
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBorderColor: '#fff',
              pointBorderWidth: 1.5,
              parsing: false,
              order: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1f2937',
              padding: 10,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                label: (ctx: any) => ` Score ${ctx.parsed.x}: ${ctx.parsed.y} employees`,
              },
            },
          },
          // ── CHANGED: axes now visible with titles ──
          scales: {
            x: {
              type: 'linear',
              min: 0.5,
              max: 5.5,
              title: {
                display: true,
                text: 'Rating Score',
                color: '#6b7280',
                font: { size: 12, weight: '600' },
              },
              afterBuildTicks: (axis: any) => {
                axis.ticks = [1, 2, 3, 4, 5].map((v) => ({ value: v }));
              },
              ticks: {
                font: { size: 11 },
                color: '#9ca3af',
              },
              grid: { display: false },
              border: { display: true, color: '#e5e7eb' },
            },
            y: {
              display: true,
              min: 0,
              max: maxCount * 1.25,
              title: {
                display: true,
                text: 'No. of Employees',
                color: '#6b7280',
                font: { size: 12, weight: '600' },
              },
              ticks: {
                stepSize: Math.max(1, Math.ceil(maxCount / 5)),
                font: { size: 11 },
                color: '#9ca3af',
                precision: 0,
              },
              grid: { color: 'rgba(0,0,0,0.05)' },
              border: { display: true, color: '#e5e7eb' },
            },
          },
        },
      });

      const topLabelsPlugin = {
        id: 'topLabels',
        afterDatasetsDraw(chart: any) {
          const { ctx, data } = chart;
          const sourceRows = chart.canvas.id === 'deptChart' ? deptRows : sectionRows;
          data.datasets[0].data.forEach((val: number, i: number) => {
            const bar = chart.getDatasetMeta(0).data[i];
            const count = sourceRows[i]?.EMP_COUNT ?? 0;
            ctx.save();
            ctx.fillStyle = '#374151';
            ctx.font = '600 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(Number(val).toFixed(1), bar.x, bar.y - 14);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '400 10px sans-serif';
            ctx.fillText(`(${count})`, bar.x, bar.y - 4);
            ctx.restore();
          });
        },
      };

      new Chart(deptCanvas, {
        type: 'bar',
        plugins: [topLabelsPlugin],
        data: {
          labels: deptLabels.length ? deptLabels : ['No Data'],
          datasets: [
            {
              data: deptValues.length ? deptValues : [0],
              backgroundColor: '#4f46e5',
              borderRadius: 6,
              barThickness: 32,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1f2937',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx: any) => {
                  const row = deptRows[ctx.dataIndex];
                  return [' Avg Rating: ' + Number(ctx.parsed.y).toFixed(1), ` Employees: ${row?.EMP_COUNT ?? 0}`];
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 30 },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              min: deptMin,
              max: deptMax,
              ticks: { stepSize: 0.5, font: { size: 11 }, color: '#9ca3af', callback: (v: any) => (+v).toFixed(1) },
              grid: { color: 'rgba(0,0,0,0.05)' },
              border: { display: false },
            },
          },
          layout: { padding: { top: 20 } },
        },
      });

      new Chart(sectionCanvas, {
        type: 'bar',
        plugins: [topLabelsPlugin],
        data: {
          labels: sectionLabels.length ? sectionLabels : ['No Data'],
          datasets: [
            {
              data: sectionValues.length ? sectionValues : [0],
              backgroundColor: '#059669',
              borderRadius: 6,
              barThickness: 32,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1f2937',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx: any) => {
                  const row = sectionRows[ctx.dataIndex];
                  return [` Avg Rating: ${Number(ctx.parsed.y).toFixed(1)}`, ` Employees: ${row?.EMP_COUNT ?? 0}`];
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 30 },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              min: sectionMin,
              max: sectionMax,
              ticks: { stepSize: 0.5, font: { size: 11 }, color: '#9ca3af', callback: (v: any) => (+v).toFixed(1) },
              grid: { color: 'rgba(0,0,0,0.05)' },
              border: { display: false },
            },
          },
          layout: { padding: { top: 20 } },
        },
      });

      const pieCanvas = document.getElementById('pieChart') as HTMLCanvasElement;
      if (pieCanvas) {
        Chart.getChart(pieCanvas)?.destroy();

        const statusRow = (AppraisalStatus as any[])?.[0] ?? {};
        const completed = Number(statusRow.COMPLETED ?? 0);
        const inProgress = Number(statusRow.IN_PROGRESS ?? 0);
        const pending = Number(statusRow.PENDING ?? 0);
        const total = Number(statusRow.TOTAL ?? 1);

        const completedPct = Math.round((completed / total) * 100);
        const inProgressPct = Math.round((inProgress / total) * 100);
        const pendingPct = Math.round((pending / total) * 100);

        new Chart(pieCanvas, {
          type: 'doughnut',
          data: {
            labels: [`Completed ${completedPct}%`, `In Progress ${inProgressPct}%`, `Pending ${pendingPct}%`],
            datasets: [
              {
                data: [completed, inProgress, pending],
                backgroundColor: ['#4f46e5', '#059669', '#d97706'],
                borderWidth: 3,
                borderColor: '#fff',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1f2937',
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: (ctx: any) => {
                    const pct = Math.round((ctx.parsed / total) * 100);
                    return ` ${ctx.label.split(' ')[0]}: ${ctx.parsed} (${pct}%)`;
                  },
                },
              },
            },
          },
        });
      }

      // ── NEW: rating range breakdown doughnut (1-5) ──
      const ratingRangeCanvas = document.getElementById('ratingRangeChart') as HTMLCanvasElement;
      if (ratingRangeCanvas) {
        Chart.getChart(ratingRangeCanvas)?.destroy();

        new Chart(ratingRangeCanvas, {
          type: 'doughnut',
          data: {
            labels: legendItems.map((r) => `${r.num} - ${r.label}`),
            datasets: [
              {
                data: legendItems.map((r) => r.count),
                backgroundColor: legendItems.map((r) => r.color),
                borderWidth: 3,
                borderColor: '#fff',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1f2937',
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} (${legendItems[ctx.dataIndex].pct})`,
                },
              },
            },
          },
        });
      }
    };

    if ((window as any).Chart) {
      drawCharts();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      script.onload = () => drawCharts();
      document.head.appendChild(script);
    }
  }, [RatingDistribution, DeptHistogram, SectionHistogram, AppraisalStatus]);

  const statusRow = (AppraisalStatus as any[])?.[0] ?? {};
  const totalStatus = Number(statusRow.TOTAL ?? 1);

  return (
    <div className='p-4 bg-gray-50 min-h-screen'>
      <div className='mb-5'>
        <h3 className='text-xl font-semibold text-gray-900'>Appraisal management dashboard</h3>
        <p className='text-sm text-gray-500 mt-0.5'>Track appraisal completion, ratings, and team performance</p>
      </div>

      <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5'>
        <div className='grid grid-cols-4 gap-3'>
          <FilterSelect
            label='Division'
            value={ddivision}
            onChange={setDdivision}
            options={[
              { code: 'All', name: 'All Divisions' },
              ...(Division ?? []).map((d) => ({ code: d.DIV_CODE, name: d.DIV_NAME })),
            ]}
            showReset={ddivision !== 'All'}
            onReset={() => setDdivision('All')}
          />

          <FilterSelect
            label='Department'
            value={ddepartment}
            onChange={setDdepartment}
            options={[
              { code: 'All', name: 'All Departments' },
              ...(Department ?? []).map((d) => ({ code: d.DEPT_CODE, name: d.DEPT_NAME })),
            ]}
            showReset={ddepartment !== 'All'}
            onReset={() => setDdepartment('All')}
          />

          <FilterSelect
            label='Section'
            value={dsection}
            onChange={setDsection}
            options={[
              { code: 'All', name: 'All Sections' },
              ...(Section ?? []).map((s) => ({ code: s.SECTION_CODE, name: s.SECTION_NAME })),
            ]}
            showReset={dsection !== 'All'}
            onReset={() => setDsection('All')}
          />

          <FilterSelect
            label='Period'
            value={dperiod}
            onChange={setDperiod}
            options={Period.map((p: PeriodData) => ({ code: p.VALUE, name: p.LABEL }))}
            showReset={Period.length > 0 && dperiod !== Period[0].VALUE}
            onReset={() => setDperiod(Period[0].VALUE)}
          />
        </div>
      </div>

      <div className='grid grid-cols-6 gap-3 mb-5'>
        <KpiCard label='Total Employees' value={Total_Employees?.[0]?.TOTAL_EMPLOYEES || 0} tone='neutral' icon={<Users size={18} />} />
        <KpiCard label='Completed' value={(FinalApprovedRes as any)?.[0]?.TOTAL_FINAL_APPROVED || 0} tone='success' icon={<CheckCircle2 size={18} />} />
        <KpiCard label='Pending' value={(Pending_Appraisals as any)?.[0]?.TOTAL_PENDING_APPRAISALS || 0} tone='warning' icon={<Clock size={18} />} />
        <KpiCard label='Avg Rating' value={`${(Ratings as any)?.[0]?.AVG_RATING || 0} /5`} tone='accent' icon={<Star size={18} />} />
        <KpiCard label='Top Performers' value={`${(Ratings as any)?.[0]?.TOP_PERFORMERS_PCT || 0}%`} tone='good' icon={<TrendingUp size={18} />} />
        <KpiCard label='Low Performers' value={`${(Ratings as any)?.[0]?.LOW_PERFORMERS_PCT || 0}%`} tone='bad' icon={<TrendingDown size={18} />} />
      </div>

      <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5'>
        <PanelHeader title='Performance distribution' />

        <div style={{ position: 'relative', width: '100%', height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <canvas id='bellChart'></canvas>
        </div>

        <div className='flex justify-center gap-4 flex-wrap mt-4 pt-4 border-t border-gray-100'>
          {legendItems.map((r) => (
            <div key={r.num} className='flex flex-col items-center gap-0.5'>
              <span className='text-sm font-bold' style={{ color: r.color }}>{r.num}</span>
              <span className='text-xs text-gray-400'>{r.label}</span>
              <div className='flex flex-row items-center'>
                <span className='text-xs font-semibold' style={{ color: r.color }}>{r.pct}</span>
                <span className='text-gray-400 font-normal ml-1'>({r.count})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── NEW: rating range breakdown panel ── */}
      <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5'>
        <PanelHeader title='Rating range breakdown' />
        <div className='flex gap-5 items-center'>
          <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
            <canvas id='ratingRangeChart'></canvas>
            <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
              <div className='text-xl font-semibold text-gray-900'>{totalCount}</div>
              <div className='text-xs text-gray-400'>Rated</div>
            </div>
          </div>
          <div className='flex flex-col gap-3 flex-1'>
            {legendItems.map((r) => (
              <div key={r.num} className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='w-2.5 h-2.5 rounded-full' style={{ backgroundColor: r.color }} />
                  <span className='text-sm text-gray-600'>{r.num} — {r.label}</span>
                </div>
                <div className='text-right'>
                  <span className='text-sm font-semibold' style={{ color: r.color }}>{r.pct}</span>
                  <span className='text-xs text-gray-400 ml-1'>({r.count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4 mb-5'>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-5'>
          <PanelHeader title='Department performance' />
          {(DeptHistogram as any[])?.length === 0 && (
            <div className='flex items-center justify-center h-48 text-sm text-gray-400'>No data available</div>
          )}
          <div style={{ position: 'relative', width: '100%', height: '240px' }}>
            <canvas id='deptChart'></canvas>
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-5'>
          <PanelHeader title='Section performance' />
          {(SectionHistogram as any[])?.length === 0 && (
            <div className='flex items-center justify-center h-48 text-sm text-gray-400'>No data available</div>
          )}
          <div style={{ position: 'relative', width: '100%', height: '240px' }}>
            <canvas id='sectionChart'></canvas>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-5'>
          <PanelHeader title='Appraisal status' />
          <div className='flex gap-5 items-center'>
            <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
              <canvas id='pieChart'></canvas>
              <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
                <div className='text-xl font-semibold text-gray-900'>{totalStatus}</div>
                <div className='text-xs text-gray-400'>Total</div>
              </div>
            </div>

            <div className='flex flex-col gap-3 flex-1'>
              {[
                { label: 'Completed', color: '#4f46e5', value: statusRow.COMPLETED ?? 0 },
                { label: 'In Progress', color: '#059669', value: statusRow.IN_PROGRESS ?? 0 },
                { label: 'Pending', color: '#d97706', value: statusRow.PENDING ?? 0 },
              ].map((item) => (
                <div key={item.label} className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-2.5 h-2.5 rounded-full' style={{ backgroundColor: item.color }} />
                    <span className='text-sm text-gray-600'>{item.label}</span>
                  </div>
                  <div className='text-right'>
                    <span className='text-sm font-semibold' style={{ color: item.color }}>
                      {Math.round((Number(item.value) / totalStatus) * 100)}%
                    </span>
                    <span className='text-xs text-gray-400 ml-1'>({item.value})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-5'>
          <PanelHeader title='Top rated employees' />
          <table className='w-full text-sm'>
            <thead>
              <tr>
                <th className='text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide'>Rank</th>
                <th className='text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide'>Employee</th>
                <th className='text-center pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide'>Department</th>
                <th className='text-center pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide'>Rating</th>
              </tr>
            </thead>
            <tbody>
              {(TopEmployees as any[])?.length > 0 ? (
                (TopEmployees as any[]).map((emp: any, i: number) => (
                  <tr key={i} className='border-t border-gray-50 hover:bg-gray-50 transition-colors'>
                    <td className='py-2.5'>
                      <div className='w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center justify-center'>
                        {i + 1}
                      </div>
                    </td>
                    <td className='py-2.5 font-medium text-gray-800'>{emp.EMPLOYEE_NAME}</td>
                    <td className='py-2.5 text-center text-gray-500 text-xs'>{emp.DEPT_NAME}</td>
                    <td className='py-2.5 text-center'>
                      <span className='font-semibold text-indigo-700'>{Number(emp.TOTAL_RATING).toFixed(1)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className='py-6 text-center text-gray-400 text-xs'>
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PamsDashboard;