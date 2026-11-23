// src/pages/hr/HolidayCalendarPage.tsx
//
// Holiday Calendar — new UI (modelled on ProductWmsPage / HrEmpEducationPage):
//  • Freight-style header with Generate Calendar / Save Changes / Search
//  • Filters in a SectionPanel using the in-house Input / Select / LookupField
//  • Stat chips + DataTable with inline-editable Reason / Type / Remarks
//  • toast feedback instead of the inline alert banner
//
// Generate Calendar calls almsCommonProcedure (procBuildCommonProcedurewmc) with parameter
// SP_HR_SET_HOLIDAY_CALENDAR -> SP_HR_SET_HOLIDAY_CALENDAR(val1s1=COMPANY_CODE, val1s2=DIV_CODE, loginid).
// The stored procedure owns all the generation logic (weekly offs, existing dates, etc).

import { useCallback, useEffect, useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Filter, Save, Search as SearchIcon, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LookupField } from "../../../components/ui/LookupField";
import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/AlertToast";
import { executeWmsInboundSql } from "../../../api/wms"; // adjust path to wherever this actually lives
import { getLookupValue } from "../../../api/lookups";
import { almsCommonProcedure } from "../../../api/alms"; // adjust path/file name to wherever almsCommonProcedure lives
import { useAuth } from "../../../state/AuthContext";

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

const HOLIDAY_CALENDAR_PROC = "SP_HR_SET_HOLIDAY_CALENDAR";

// Years offered in the Year From / Year To dropdowns: current year back to 1975 (newest first).
const CURRENT_YEAR = new Date().getFullYear();
const FIRST_YEAR = 1975;
const YEAR_LIST = Array.from({ length: CURRENT_YEAR - FIRST_YEAR + 1 }, (_, i) =>
  String(CURRENT_YEAR - i),
);

function holidayTypeMeta(code: string | null) {
  return (
    HOLIDAY_TYPES.find((t) => t.code === code) ?? {
      code: code ?? "",
      label: code ?? "-",
      tone: "neutral" as const,
    }
  );
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

  // Year range -> date range: [Jan 1 of Year From, Jan 1 of Year To + 1)
  const fromYear = Number(startYear);
  const toYearExclusive = Number(endYear) + 1;
  const divFilter = divCode ? `${sqlEscape(divCode)}%` : "%";

  const typeClause = holidayType ? `AND HOLIDAY_TYPE = '${sqlEscape(holidayType)}'` : "";
  const gradeClause = gradeCode ? `AND GRADE_CODE = '${sqlEscape(gradeCode)}'` : "";

  // No trailing semicolon - the SQL runner rejects it.
  return `
    SELECT
        DATEID,
        HOLIDAY_DATE,
        HOLIDAY_REASON,
        USER_ID,
        USER_DT,
        COMPANY_CODE,
        HOLIDAY_TYPE,
        HALF_DAY,
        DIV_CODE,
        REMARKS,
        GRADE_CODE
    FROM MS_HR_HOLIDAYCALENDAR
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND HOLIDAY_DATE >= DATE '${fromYear}-01-01'
      AND HOLIDAY_DATE <  DATE '${toYearExclusive}-01-01'
      AND DIV_CODE LIKE '${divFilter}'
      ${typeClause}
      ${gradeClause}
    ORDER BY HOLIDAY_DATE
  `;
}

/* ── Generate calendar (almsCommonProcedure → SP_HR_SET_HOLIDAY_CALENDAR) ── */

async function generateHolidayCalendar(params: {
  companyCode: string;
  divCode: string;
  loginId: string;
}): Promise<void> {
  // Backend: WHEN 'SP_HR_SET_HOLIDAY_CALENDAR' THEN
  //   SP_HR_SET_HOLIDAY_CALENDAR(P_VAL1S1, P_VAL1S2, P_LOGINID)
  // Throws with the backend message if the procedure fails, so the toast shows the real error.
  await almsCommonProcedure({
    parameter: HOLIDAY_CALENDAR_PROC,
    val1s1: params.companyCode, // COMPANY_CODE
    val1s2: params.divCode, //     DIV_CODE
    loginid: params.loginId, //    USER
  });
}

function buildUpdateHolidayRowQuery(row: HolidayRow) {
  return `
    UPDATE "MS_HR_HOLIDAYCALENDAR"
    SET "HOLIDAY_TYPE" = '${sqlEscape(row.HOLIDAY_TYPE ?? "")}',
        "HOLIDAY_REASON" = '${sqlEscape(row.HOLIDAY_REASON ?? "")}',
        "REMARKS" = '${sqlEscape(row.REMARKS ?? "")}'
    WHERE "DATEID" = '${sqlEscape(row.DATEID)}'
  `;
}

/* ─────────────────────────────────────────────────────────────
   Freight building blocks (same as Grade / Product / HrMaster pages)
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
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
  tone: "neutral" | "red" | "blue" | "amber" | "green";
}) {
  const toneClasses: Record<typeof tone, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${toneClasses[tone]}`}>
      <span className="text-sm font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */
export default function HolidayCalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [divCode, setDivCode] = useState("");
  const [divDisplay, setDivDisplay] = useState("");
  const [holidayType, setHolidayType] = useState("");
  const [gradeCode, setGradeCode] = useState("");
  const [yearFrom, setYearFrom] = useState(String(CURRENT_YEAR));
  const [yearTo, setYearTo] = useState(String(CURRENT_YEAR));

  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [dirtyDateIds, setDirtyDateIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loadDivisions = useCallback(
    async (query?: string) => {
      const term = query
        ? `AND (DIV_NAME LIKE '%${sqlEscape(query)}%' OR DIV_CODE LIKE '%${sqlEscape(query)}%')`
        : "";
      const sql = `
        SELECT DIV_CODE, DIV_NAME
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
      toast.error(err instanceof Error ? err.message : "Unable to load holiday calendar");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, yearFrom, yearTo, divCode, holidayType, gradeCode]);

  useEffect(() => {
    void fetchCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateCalendar = useCallback(async () => {
    if (!companyCode || !divCode) {
      toast.warning("Select a Division before generating the calendar");
      return;
    }
    setGenerating(true);
    try {
      await generateHolidayCalendar({
        companyCode,
        divCode,
        loginId: loginid,
      });
      toast.success("Holiday calendar generated successfully");
      await fetchCalendar(); // refresh grid with whatever the SP created
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to generate calendar");
    } finally {
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, divCode, loginid, fetchCalendar]);

  const handleYearFromChange = (value: string) => {
    setYearFrom(value);
    // Year To can never be earlier than Year From
    if (Number(yearTo) < Number(value)) setYearTo(value);
  };

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
    try {
      for (const row of dirtyRows) {
        await executeWmsInboundSql(buildUpdateHolidayRowQuery(row));
      }
      setDirtyDateIds(new Set());
      toast.success(`${dirtyRows.length} change${dirtyRows.length !== 1 ? "s" : ""} saved successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, dirtyDateIds]);

  const columns = useMemo<ColumnDef<HolidayRow>[]>(
    () => [
      {
        accessorKey: "HOLIDAY_DATE",
        header: "Date",
        size: 130,
        cell: ({ row }) => formatHolidayDate(row.original.HOLIDAY_DATE),
      },
      {
        accessorKey: "HOLIDAY_REASON",
        header: "Holiday Reason",
        size: 260,
        cell: ({ row }) => (
          <Input
            type="text"
            value={row.original.HOLIDAY_REASON ?? ""}
            onChange={(e) => handleFieldChange(row.original.DATEID, "HOLIDAY_REASON", e.target.value)}
          />
        ),
      },
      {
        accessorKey: "HOLIDAY_TYPE",
        header: "Type",
        size: 200,
        cell: ({ row }) => {
          const value = row.original.HOLIDAY_TYPE ?? "NR";
          const meta = holidayTypeMeta(value);
          return (
            <Select
              value={value}
              className={`font-medium ${typeToneClasses[meta.tone]}`}
              onChange={(e) => handleTypeChange(row.original.DATEID, e.target.value)}
            >
              {HOLIDAY_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </Select>
          );
        },
      },
      {
        accessorKey: "REMARKS",
        header: "Remarks",
        size: 260,
        cell: ({ row }) => (
          <Input
            type="text"
            value={row.original.REMARKS ?? ""}
            onChange={(e) => handleFieldChange(row.original.DATEID, "REMARKS", e.target.value)}
          />
        ),
      },
      { accessorKey: "DIV_CODE", header: "Div Code", size: 110 },
      { accessorKey: "GRADE_CODE", header: "Grade", size: 110 },
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

  const dirtyCount = dirtyDateIds.size;
  const busy = loading || generating || saving;

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarDays size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Holiday Calendar</h1>
              {dirtyCount > 0 && (
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={handleGenerateCalendar} disabled={busy}>
            <Sparkles size={14} /> {generating ? "Generating" : "Generate Calendar"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchCalendar()} disabled={busy}>
            <SearchIcon size={14} /> {loading ? "Searching" : "Search"}
          </Button>
          <Button type="button" size="sm" onClick={handleSaveChanges} disabled={busy || dirtyCount === 0}>
            <Save size={14} /> {saving ? "Saving" : dirtyCount > 0 ? `Save Changes (${dirtyCount})` : "Save"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <SectionPanel title="Division, Holiday Type, Grade & Year Range" icon={Filter}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Division">
            <LookupField
              compact
              label=""
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
          </Field>

          <Field label="Holiday Type">
            <Select value={holidayType} onChange={(e) => setHolidayType(e.target.value)}>
              <option value="">All Types</option>
              {HOLIDAY_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Grade Code">
            <Input
              type="text"
              placeholder="All grades"
              value={gradeCode}
              onChange={(e) => setGradeCode(e.target.value)}
            />
          </Field>

          <Field label="Year From">
            <Select value={yearFrom} onChange={(e) => handleYearFromChange(e.target.value)}>
              {YEAR_LIST.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Year To">
            <Select value={yearTo} onChange={(e) => setYearTo(e.target.value)}>
              {YEAR_LIST.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionPanel>

      {/* Stat chips */}
      {hasSearched && !loading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <StatChip label="Total records" value={stats.total} tone="neutral" />
          <StatChip label="Normal working days" value={stats.normal} tone="green" />
          <StatChip label="Weekly offs" value={stats.weeklyOff} tone="red" />
          <StatChip label="Public holidays" value={stats.publicHoliday} tone="amber" />
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Records`}
        subtitle="Holiday Calendar"
        loading={loading}
        loaderType="circle"
        emptyText="No holidays found for this period — select a Division and use Generate Calendar if this is a new Division/Year"
        searchPlaceholder="Search date, reason, type..."
        height={520}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => row.DATEID}
        rowClassName={(row) =>
          row.HOLIDAY_TYPE === "PH"
            ? "bg-amber-50/80"
            : row.HOLIDAY_TYPE === "W1" || row.HOLIDAY_TYPE === "W2"
              ? "bg-red-50/80"
              : ""
        }
        exportFilename={`holiday-calendar-${yearFrom}-${yearTo}.csv`}
        enableExport
      />
    </section>
  );
}