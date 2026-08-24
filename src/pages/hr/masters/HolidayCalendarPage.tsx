// src/pages/hr/HolidayCalendarPage.tsx
import { useCallback, useEffect, useState, useMemo } from "react";
import { LookupField } from "../../../components/ui/LookupField";
import { DataTable } from "../../../components/ui/DataTable";
import { executeWmsInboundSql } from "../../../api/wms"; // adjust path to wherever this actually lives
import { LookupRow, getLookupValue } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Search as SearchIcon, SlidersHorizontal, Sparkles, Save } from "lucide-react";

type HolidayRow = {
  DATEID: string;
  HOLIDAY_DATE: string;
  HOLIDAY_REASON: string | null;
  COMPANY_CODE: string;
  HOLIDAY_TYPE: string | null;
  HALF_DAY: string | null;
  DIV_CODE: string;
  REMARKS: string | null;
  GRADE_CODE: string | null;
};

// Confirmed from MS_HR_HOLIDAYCALENDAR sample data (NR, W1, W2) + legacy screen (Public Holiday).
// Run `SELECT DISTINCT HOLIDAY_TYPE FROM MS_HR_HOLIDAYCALENDAR` against prod/test to confirm
// there isn't a 5th code (e.g. DH for a company-declared holiday distinct from PH).
const HOLIDAY_TYPES = [
  { code: "NR", label: "Normal Working Day", tone: "neutral" as const },
  { code: "W1", label: "Weekly Off 1", tone: "red" as const },
  { code: "W2", label: "Weekly Off 2", tone: "red" as const },
  { code: "PH", label: "Public Holiday", tone: "amber" as const },
];

function holidayTypeMeta(code: string | null) {
  return HOLIDAY_TYPES.find((t) => t.code === code) ?? { code: code ?? "", label: code ?? "-", tone: "neutral" as const };
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}

function formatHolidayDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function buildHolidayCalendarQuery(params: {
  companyCode: string;
  startYear: string;
  endYear: string;
  divCode: string;
  holidayType: string;
  gradeCode: string;
}) {
  const { companyCode, startYear, endYear, divCode, holidayType, gradeCode } = params;
  const divFilter = divCode ? `'${sqlEscape(divCode)}%'` : `'%'`;

  const typeClause = holidayType
    ? `AND ("MS_HR_HOLIDAYCALENDAR"."HOLIDAY_TYPE" = '${sqlEscape(holidayType)}')`
    : "";
  const gradeClause = gradeCode
    ? `AND ("MS_HR_HOLIDAYCALENDAR"."GRADE_CODE" = '${sqlEscape(gradeCode)}')`
    : "";

  return `
    SELECT
      "MS_HR_HOLIDAYCALENDAR"."DATEID",
      "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE",
      "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_REASON",
      "MS_HR_HOLIDAYCALENDAR"."USER_ID",
      "MS_HR_HOLIDAYCALENDAR"."USER_DT",
      "MS_HR_HOLIDAYCALENDAR"."COMPANY_CODE",
      "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_TYPE",
      "MS_HR_HOLIDAYCALENDAR"."HALF_DAY",
      "MS_HR_HOLIDAYCALENDAR"."DIV_CODE",
      "MS_HR_HOLIDAYCALENDAR"."REMARKS",
      "MS_HR_HOLIDAYCALENDAR"."GRADE_CODE"
    FROM "MS_HR_HOLIDAYCALENDAR"
    WHERE ("MS_HR_HOLIDAYCALENDAR"."COMPANY_CODE" = '${sqlEscape(companyCode)}')
      AND (TO_CHAR("MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE",'YYYY') >= '${sqlEscape(startYear)}')
      AND (TO_CHAR("MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE",'YYYY') <= '${sqlEscape(endYear)}')
      AND ("MS_HR_HOLIDAYCALENDAR"."DIV_CODE" LIKE ${divFilter})
      ${typeClause}
      ${gradeClause}
    ORDER BY "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE"
  `;
}

// TODO: replace with the real proc call once confirmed. This mirrors the anonymous-block
// pattern used elsewhere in the codebase (e.g. SP_WM_ADJUSTMNT_PROCESS) but the actual
// proc name/signature for populating a year of holiday rows needs to come from you/DBA.
function buildGenerateCalendarBlock(params: {
  companyCode: string;
  divCode: string;
  yearFrom: string;
  yearTo: string;
}) {
  const { companyCode, divCode, yearFrom, yearTo } = params;
  return `
    BEGIN
      SP_HR_HOLIDAYCALENDAR_GENERATE(
        P_COMPANY_CODE => '${sqlEscape(companyCode)}',
        P_DIV_CODE     => '${sqlEscape(divCode)}',
        P_YEAR_FROM    => '${sqlEscape(yearFrom)}',
        P_YEAR_TO      => '${sqlEscape(yearTo)}'
      );
    END;
  `;
}

// TODO: same caveat — confirm the real update proc/endpoint. A client-built UPDATE per row
// is fine for a first pass consistent with this file's existing style, but this should move
// behind a proper API route so you're not shipping raw SQL from the browser long-term.
function buildUpdateHolidayRowQuery(row: HolidayRow) {
  return `
    UPDATE "MS_HR_HOLIDAYCALENDAR"
    SET "HOLIDAY_TYPE" = '${sqlEscape(row.HOLIDAY_TYPE ?? "")}',
        "HOLIDAY_REASON" = '${sqlEscape(row.HOLIDAY_REASON ?? "")}',
        "REMARKS" = '${sqlEscape(row.REMARKS ?? "")}'
    WHERE "DATEID" = '${sqlEscape(row.DATEID)}'
  `;
}

export default function HolidayCalendarPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";

  const [divCode, setDivCode] = useState("");
  const [divDisplay, setDivDisplay] = useState("");
  const [holidayType, setHolidayType] = useState("");
  const [gradeCode, setGradeCode] = useState("");
  const [yearFrom, setYearFrom] = useState(String(new Date().getFullYear()));
  const [yearTo, setYearTo] = useState(String(new Date().getFullYear()));

  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [dirtyDateIds, setDirtyDateIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const loadDivisions = useCallback(
    async (query?: string) => {
      const term = query
        ? `AND (DIV_NAME LIKE '%${sqlEscape(query)}%' OR DIV_CODE LIKE '%${sqlEscape(query)}%')`
        : "";
      const sql = `
        SELECT DIV_CODE, DIV_NAME -- TODO verify actual column names on MS_HR_DIVISION
        FROM MS_HR_DIVISION
        WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ${term}
        ORDER BY DIV_CODE
      `;
      return executeWmsInboundSql(sql);
    },
    [companyCode],
  );

  const fetchCalendar = useCallback(async () => {
    if (!companyCode || !yearFrom || !yearTo) return;
    setLoading(true);
    setError("");
    try {
      const sql = buildHolidayCalendarQuery({
        companyCode,
        startYear: yearFrom,
        endYear: yearTo,
        divCode,
        holidayType,
        gradeCode,
      });
      const data = await executeWmsInboundSql(sql);
      setRows(data as HolidayRow[]);
      setDirtyDateIds(new Set());
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load holiday calendar");
    } finally {
      setLoading(false);
    }
  }, [companyCode, yearFrom, yearTo, divCode, holidayType, gradeCode]);

  useEffect(() => {
    fetchCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateCalendar = useCallback(async () => {
    if (!companyCode || !divCode || !yearFrom || !yearTo) {
      setError("Select Division and Year range before generating");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const block = buildGenerateCalendarBlock({ companyCode, divCode, yearFrom, yearTo });
      await executeWmsInboundSql(block);
      await fetchCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate calendar");
    } finally {
      setGenerating(false);
    }
  }, [companyCode, divCode, yearFrom, yearTo, fetchCalendar]);

  const handleTypeChange = useCallback((dateId: string, newType: string) => {
    setRows((prev) => prev.map((r) => (r.DATEID === dateId ? { ...r, HOLIDAY_TYPE: newType } : r)));
    setDirtyDateIds((prev) => new Set(prev).add(dateId));
  }, []);

  const handleFieldChange = useCallback(
    (dateId: string, field: "HOLIDAY_REASON" | "REMARKS", value: string) => {
      setRows((prev) => prev.map((r) => (r.DATEID === dateId ? { ...r, [field]: value } : r)));
      setDirtyDateIds((prev) => new Set(prev).add(dateId));
    },
    [],
  );

  const handleSaveChanges = useCallback(async () => {
    const dirtyRows = rows.filter((r) => dirtyDateIds.has(r.DATEID));
    if (dirtyRows.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (const row of dirtyRows) {
        await executeWmsInboundSql(buildUpdateHolidayRowQuery(row));
      }
      setDirtyDateIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
  }, [rows, dirtyDateIds]);

  const columns = useMemo<ColumnDef<HolidayRow>[]>(
    () => [
      {
        accessorKey: "HOLIDAY_DATE",
        header: "Date",
        cell: ({ row }) => formatHolidayDate(row.original.HOLIDAY_DATE),
      },
      {
        accessorKey: "HOLIDAY_REASON",
        header: "Holiday Reason",
        cell: ({ row }) => (
          <input
            type="text"
            value={row.original.HOLIDAY_REASON ?? ""}
            onChange={(e) => handleFieldChange(row.original.DATEID, "HOLIDAY_REASON", e.target.value)}
            className="h-7 w-full rounded-md border border-gray-300 bg-background px-2 text-xs"
          />
        ),
      },
      {
        accessorKey: "HOLIDAY_TYPE",
        header: "Type",
        cell: ({ row }) => {
          const value = row.original.HOLIDAY_TYPE ?? "NR";
          const meta = holidayTypeMeta(value);
          return (
            <select
              value={value}
              onChange={(e) => handleTypeChange(row.original.DATEID, e.target.value)}
              className={`h-7 rounded-md border px-2 text-xs font-medium ${typeToneClasses[meta.tone]}`}
            >
              {HOLIDAY_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        accessorKey: "REMARKS",
        header: "Remarks",
        cell: ({ row }) => (
          <input
            type="text"
            value={row.original.REMARKS ?? ""}
            onChange={(e) => handleFieldChange(row.original.DATEID, "REMARKS", e.target.value)}
            className="h-7 w-full rounded-md border border-gray-300 bg-background px-2 text-xs"
          />
        ),
      },
      { accessorKey: "DIV_CODE", header: "Div Code" },
      { accessorKey: "GRADE_CODE", header: "Grade" },
    ],
    [handleTypeChange, handleFieldChange],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const weeklyOff = rows.filter((r) => r.HOLIDAY_TYPE === "W1" || r.HOLIDAY_TYPE === "W2").length;
    const publicHoliday = rows.filter((r) => r.HOLIDAY_TYPE === "PH").length;
    const normal = rows.filter((r) => r.HOLIDAY_TYPE === "NR").length;
    return { total, weeklyOff, publicHoliday, normal };
  }, [rows]);

  return (
    <div className="grid gap-2 p-3">
      {/* Page header — compact, no title */}
      {/* <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays size={16} />
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          View declared holidays, weekly offs, and working-day exceptions by division and year
        </p>
      </div> */}

      {/* Filter card */}
      <div className="overflow-hidden rounded-lg border border-[#aebbd0] bg-card shadow-[0_8px_22px_rgba(15,23,42,0.07)]">
        <div className="flex items-center gap-2 border-b border-[#c7d2e3] bg-[#f8fbff] px-3 py-2">
          <SlidersHorizontal size={14} className="text-primary" />
          <div>
            <p className="eyebrow m-0">Filters</p>
            <p className="m-0 text-xs text-muted-foreground">Division, Holiday Type, Grade & Year Range</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <LookupField
            label="Division"
            value={divCode}
            displayValue={divDisplay}
            columns={[
              { field: "DIV_CODE", header: "Code" },
              { field: "DIV_NAME", header: "Name" },
            ]}
            valueField="DIV_CODE"
            displayFields={["DIV_NAME"]}
            loadOptions={loadDivisions}
            onChange={(value, row) => {
              setDivCode(value);
              setDivDisplay(row ? String(getLookupValue(row, "DIV_NAME") ?? "") : "");
            }}
          />

          <label className="field">
            <span>Holiday Type</span>
            <select
              className="h-9 rounded-md border border-gray-400 bg-background px-3 text-sm"
              value={holidayType}
              onChange={(e) => setHolidayType(e.target.value)}
            >
              <option value="">All Types</option>
              {HOLIDAY_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Grade Code</span>
            <input
              className="h-9 rounded-md border border-gray-400 bg-background px-3 text-sm"
              type="text"
              placeholder="All grades"
              value={gradeCode}
              onChange={(e) => setGradeCode(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Year From</span>
            <input
              className="h-9 rounded-md border border-gray-400 bg-background px-3 text-sm"
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Year To</span>
            <input
              className="h-9 rounded-md border border-gray-400 bg-background px-3 text-sm"
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#c7d2e3] bg-[#fafbfd] px-3 py-2">
          <button
            type="button"
            onClick={handleGenerateCalendar}
            disabled={generating}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
          >
            <Sparkles size={14} />
            {generating ? "Generating..." : "Generate Calendar"}
          </button>

          {dirtyDateIds.size > 0 && (
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? "Saving..." : `Save Changes (${dirtyDateIds.size})`}
            </button>
          )}

          <button
            type="button"
            onClick={fetchCalendar}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <SearchIcon size={14} />
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Stat chips */}
      {hasSearched && !loading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <StatChip label="Total records" value={stats.total} tone="neutral" />
          <StatChip label="Normal working days" value={stats.normal} tone="neutral" />
          <StatChip label="Weekly offs" value={stats.weeklyOff} tone="red" />
          <StatChip label="Public holidays" value={stats.publicHoliday} tone="amber" />
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loaderType="circle"
        emptyText="No holidays found for this period — try Generate Calendar if this is a new Division/Year"
        searchPlaceholder="Search date, reason, type..."
        enablePagination
        pageSize={100}
        density="compact"
        rowClassName={(row) =>
          row.HOLIDAY_TYPE === "PH" ? "bg-amber-50/80" : row.HOLIDAY_TYPE === "W1" || row.HOLIDAY_TYPE === "W2" ? "bg-red-50/80" : ""
        }
        exportFilename={`holiday-calendar-${yearFrom}-${yearTo}`}
        enableExport
      />
    </div>
  );
}

const typeToneClasses: Record<"neutral" | "red" | "amber", string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
};

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "red" | "blue" | "amber";
}) {
  const toneClasses: Record<typeof tone, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClasses[tone]}`}>
      <span className="text-sm font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}