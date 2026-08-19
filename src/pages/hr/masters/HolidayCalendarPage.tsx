// src/pages/hr/HolidayCalendarPage.tsx
import { useCallback, useEffect, useState,useMemo } from "react";
import { LookupField } from "../../../components/ui/LookupField";
import { DataTable } from "../../../components/ui/DataTable";
import { executeWmsInboundSql } from "../../../api/wms"; // adjust path to wherever this actually lives
import { LookupRow, getLookupValue } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Search as SearchIcon, SlidersHorizontal } from "lucide-react";

type HolidayRow = {
  HOLIDAY_DATE: string;
  HOLIDAY_REASON: string | null;
  COMPANY_CODE: string;
  HOLIDAY_TYPE: string | null;
  HALF_DAY: string | null;
  DIV_CODE: string;
  REMARKS: string | null;
};

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}

function buildHolidayCalendarQuery(params: {
  companyCode: string;
  startYear: string;
  endYear: string;
  divCode: string;
}) {
  const { companyCode, startYear, endYear, divCode } = params;
  const divFilter = divCode ? `'${sqlEscape(divCode)}%'` : `'%'`;

  return `
    SELECT
      "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE",
      "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_REASON",
      "MS_HR_HOLIDAYCALENDAR"."USER_ID",
      "MS_HR_HOLIDAYCALENDAR"."USER_DT",
      "MS_HR_HOLIDAYCALENDAR"."COMPANY_CODE",
      "MS_HR_HOLIDAYCALENDAR"."DATEID",
      "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_TYPE",
      "MS_HR_HOLIDAYCALENDAR"."HALF_DAY",
      "MS_HR_HOLIDAYCALENDAR"."DIV_CODE",
      "MS_HR_HOLIDAYCALENDAR"."REMARKS"
    FROM "MS_HR_HOLIDAYCALENDAR"
    WHERE ("MS_HR_HOLIDAYCALENDAR"."COMPANY_CODE" = '${sqlEscape(companyCode)}')
      AND (TO_CHAR("MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE",'YYYY') >= '${sqlEscape(startYear)}')
      AND (TO_CHAR("MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE",'YYYY') <= '${sqlEscape(endYear)}')
      AND ("MS_HR_HOLIDAYCALENDAR"."DIV_CODE" LIKE ${divFilter})
    ORDER BY "MS_HR_HOLIDAYCALENDAR"."HOLIDAY_DATE"
  `;
}

export default function HolidayCalendarPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";

  const [divCode, setDivCode] = useState("");
  const [divDisplay, setDivDisplay] = useState("");
  const [holidayType, setHolidayType] = useState("");
  const [holidayTypeDisplay, setHolidayTypeDisplay] = useState("");
  const [yearFrom, setYearFrom] = useState(String(new Date().getFullYear()));
  const [yearTo, setYearTo] = useState(String(new Date().getFullYear()));

  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(false);
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

  const loadHolidayTypes = useCallback(async (query?: string) => {
    const term = query
      ? `WHERE (LEAVE_TYPE LIKE '%${sqlEscape(query)}%' OR LEAVE_TYPE_DESC LIKE '%${sqlEscape(query)}%')`
      : "";
    const sql = `
      SELECT LEAVE_TYPE, LEAVE_TYPE_DESC -- TODO verify: only LEAVE_TYPE column was confirmed
      FROM MS_HR_LEAVE_TYPES
      ${term}
      ORDER BY LEAVE_TYPE
    `;
    return executeWmsInboundSql(sql);
  }, []);

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
      });
      const data = await executeWmsInboundSql(sql);
      setRows(data as HolidayRow[]);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load holiday calendar");
    } finally {
      setLoading(false);
    }
  }, [companyCode, yearFrom, yearTo, divCode]);

  useEffect(() => {
    fetchCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo<ColumnDef<HolidayRow>[]>(
    () => [
      { accessorKey: "HOLIDAY_DATE", header: "Date" },
      { accessorKey: "HOLIDAY_REASON", header: "Holiday Reason" },
      { accessorKey: "HOLIDAY_TYPE", header: "Type" },
      { accessorKey: "REMARKS", header: "Remarks" },
      { accessorKey: "DIV_CODE", header: "Div Code" },
    ],
    [],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const weeklyOff = rows.filter((r) => r.HOLIDAY_TYPE?.toUpperCase().includes("WEEKLY")).length;
    const publicHoliday = rows.filter((r) => r.HOLIDAY_TYPE?.toUpperCase().includes("PUBLIC")).length;
    const declared = rows.filter((r) => r.HOLIDAY_TYPE?.toUpperCase().includes("DECLARED")).length;
    return { total, weeklyOff, publicHoliday, declared };
  }, [rows]);

  return (
    <div className="grid gap-4 p-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays size={22} />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-foreground">Holiday Calendar</h1>
          <p className="m-0 text-xs text-muted-foreground">
            View declared holidays, weekly offs, and working-day exceptions by division and year
          </p>
        </div>
      </div>

      {/* Filter card */}
      <div className="overflow-hidden rounded-lg border border-[#aebbd0] bg-card shadow-[0_8px_22px_rgba(15,23,42,0.07)]">
        <div className="flex items-center gap-2 border-b border-[#c7d2e3] bg-[#f8fbff] px-4 py-3">
          <SlidersHorizontal size={15} className="text-primary" />
          <div>
            <p className="eyebrow m-0">Filters</p>
            <p className="m-0 text-xs text-muted-foreground">Division, Holiday Type & Year Range</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
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

          <LookupField
            label="Holiday Type"
            value={holidayType}
            displayValue={holidayTypeDisplay}
            columns={[
              { field: "LEAVE_TYPE", header: "Code" },
              { field: "LEAVE_TYPE_DESC", header: "Description" },
            ]}
            valueField="LEAVE_TYPE"
            displayFields={["LEAVE_TYPE_DESC"]}
            loadOptions={loadHolidayTypes}
            onChange={(value, row) => {
              setHolidayType(value);
              setHolidayTypeDisplay(row ? String(getLookupValue(row, "LEAVE_TYPE_DESC") ?? "") : "");
            }}
          />

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

        <div className="flex items-center justify-end gap-2 border-t border-[#c7d2e3] bg-[#fafbfd] px-4 py-3">
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
          <StatChip label="Weekly offs" value={stats.weeklyOff} tone="red" />
          <StatChip label="Public holidays" value={stats.publicHoliday} tone="blue" />
          <StatChip label="Declared holidays" value={stats.declared} tone="amber" />
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loaderType="circle"
        emptyText="No holidays found for this period"
        searchPlaceholder="Search date, reason, type..."
        enablePagination
        pageSize={100}
        density="compact"
        rowClassName={(row) => (row.HOLIDAY_REASON ? "bg-red-50/80" : "")}
        exportFilename={`holiday-calendar-${yearFrom}-${yearTo}`}
        enableExport
      />
    </div>
  );
}

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