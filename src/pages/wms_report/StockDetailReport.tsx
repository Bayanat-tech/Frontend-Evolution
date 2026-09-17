import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ReportFieldConfig, ReportOption } from "../../components/new_report_format/types";
import { executeWmsInboundSql } from "../../api/wms";
import { api } from "../../api/client";
import NewReportPage from "../../components/new_report_format/NewReportPage";
import NewReportDialog from "../../components/new_report_format/NewReportDialog";


// ─── Types ────────────────────────────────────────────────────────────────────
interface LookupRow {
  [key: string]: any;
}

interface Params {
  prin_code: string[];
  job_no: string[];
  prod_code: string[];
  site_code: string[];
  location_code_from: string;
  location_code_to: string;
  group_by: string;
}

const DEFAULT_PARAMS: Params = {
  prin_code: ["All"],
  job_no: ["All"],
  prod_code: ["All"],
  site_code: ["All"],
  location_code_from: "",
  location_code_to: "",
  group_by: "",
};

// ─── Helpers (same as original) ───────────────────────────────────────────────

const getField = (row: LookupRow, ...keys: string[]): string => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return String(row[k]);
    const upper = k.toUpperCase();
    if (row[upper] !== undefined && row[upper] !== null) return String(row[upper]);
    const lower = k.toLowerCase();
    if (row[lower] !== undefined && row[lower] !== null) return String(row[lower]);
  }
  return "";
};

const mapCodeNameOptions = (
  rows: LookupRow[],
  codeKey: string,
  nameKey: string
): ReportOption[] =>
  rows
    .map((r) => {
      const code = getField(r, codeKey);
      const name = getField(r, nameKey);
      if (!code) return null;
      return { value: code, label: name ? `${code} - ${name}` : code };
    })
    .filter((o): o is ReportOption => !!o)
    .sort((a, b) => a.value.localeCompare(b.value));

const mapSingleColumnOptions = (rows: LookupRow[], codeKey: string): ReportOption[] =>
  rows
    .map((r) => getField(r, codeKey))
    .filter((v) => !!v)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));

const sqlEscape = (v: string): string => v.replace(/'/g, "''");

const inClause = (col: string, values: string[]): string => {
  if (!values.length || values.includes("All")) return "";
  const list = values.map((v) => `'${sqlEscape(v)}'`).join(",");
  return `${col} IN (${list})`;
};

const buildPayload = (p: Params) => ({
  prin_code: p.prin_code.includes("All") ? ["All"] : p.prin_code,
  job_no: p.job_no.includes("All") ? ["All"] : p.job_no,
  prod_code: p.prod_code.includes("All") ? ["All"] : p.prod_code,
  site_code: p.site_code.includes("All") ? ["All"] : p.site_code,
  location_code_from: p.location_code_from || null,
  location_code_to: p.location_code_to || null,
  group_by: p.group_by || null,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockDetailReport() {
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  // Dialog / preview
  const [dialogOpen, setDialogOpen] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<Record<string, string | number>>({});

  // Options
  const [prinOptions, setPrinOptions] = useState<ReportOption[]>([]);
  const [jobOptions, setJobOptions] = useState<ReportOption[]>([]);
  const [prodOptions, setProdOptions] = useState<ReportOption[]>([]);
  const [siteOptions, setSiteOptions] = useState<ReportOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<ReportOption[]>([]);

  const optionsRequestRef = useRef(0);

  // ── Cascaded option loader (unchanged logic) ──────────────────────────────
  const loadCascadedOptions = useCallback(async (p: Params) => {
    const requestId = ++optionsRequestRef.current;
    setOptLoading(true);
    setOptError(null);

    const prinFilter = inClause("PRIN_CODE", p.prin_code);
    const jobFilter = inClause("JOB_NO", p.job_no);
    const prodFilter = inClause("PROD_CODE", p.prod_code);
    const siteFilter = inClause("SITE_CODE", p.site_code);

    const whereExcept = (...exclude: string[]): string => {
      const all = { prin: prinFilter, job: jobFilter, prod: prodFilter, site: siteFilter };
      const clauses = Object.entries(all)
        .filter(([key]) => !exclude.includes(key))
        .map(([, clause]) => clause)
        .filter(Boolean);
      return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    };

    const sql = {
      prin: `select distinct prin_code, prin_name from VW_BOWM_STK_LEDGER ${whereExcept("prin")}`,
      job: `select distinct(JOB_NO) from VW_BOWM_STK_LEDGER ${whereExcept("job")}`,
      prod: `select distinct PROD_CODE, PROD_NAME from VW_BOWM_STK_LEDGER ${whereExcept("prod")}`,
      site: `select distinct site_code from VW_BOWM_STK_LEDGER ${whereExcept("site")}`,
      location: `select distinct location_code from VW_BOWM_STK_LEDGER ${whereExcept()}`,
    };

    try {
      const [prinRows, jobRows, prodRows, siteRows, locRows] = await Promise.all([
        executeWmsInboundSql(sql.prin),
        executeWmsInboundSql(sql.job),
        executeWmsInboundSql(sql.prod),
        executeWmsInboundSql(sql.site),
        executeWmsInboundSql(sql.location),
      ]);

      if (requestId !== optionsRequestRef.current) return;

      const nextPrin = mapCodeNameOptions(prinRows, "prin_code", "prin_name");
      const nextJob = mapSingleColumnOptions(jobRows, "job_no");
      const nextProd = mapCodeNameOptions(prodRows, "prod_code", "prod_name");
      const nextSite = mapSingleColumnOptions(siteRows, "site_code");
      const nextLocation = mapSingleColumnOptions(locRows, "location_code");

      setPrinOptions(nextPrin);
      setJobOptions(nextJob);
      setProdOptions(nextProd);
      setSiteOptions(nextSite);
      setLocationOptions(nextLocation);

      setParams((prev) => {
        const reset = (current: string[], validOptions: ReportOption[]): string[] => {
          if (current.includes("All")) return current;
          const validValues = new Set(validOptions.map((o) => o.value));
          const stillValid = current.filter((v) => validValues.has(v));
          return stillValid.length ? stillValid : ["All"];
        };

        const validLocations = new Set(nextLocation.map((o) => o.value));
        const nextFrom =
          prev.location_code_from && !validLocations.has(prev.location_code_from)
            ? ""
            : prev.location_code_from;
        const nextTo =
          prev.location_code_to && !validLocations.has(prev.location_code_to)
            ? ""
            : prev.location_code_to;

        return {
          ...prev,
          prin_code: reset(prev.prin_code, nextPrin),
          job_no: reset(prev.job_no, nextJob),
          prod_code: reset(prev.prod_code, nextProd),
          site_code: reset(prev.site_code, nextSite),
          location_code_from: nextFrom,
          location_code_to: nextTo,
        };
      });
    } catch (e: any) {
      if (requestId !== optionsRequestRef.current) return;
      console.error("Failed to load parameter options", e);
      setOptError(e?.message ?? "Failed to load filter options");
    } finally {
      if (requestId === optionsRequestRef.current) setOptLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCascadedOptions(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cascadeKey = JSON.stringify([
    params.prin_code,
    params.job_no,
    params.prod_code,
    params.site_code,
  ]);
  const prevCascadeKeyRef = useRef(cascadeKey);
  useEffect(() => {
    if (prevCascadeKeyRef.current === cascadeKey) return;
    prevCascadeKeyRef.current = cascadeKey;
    loadCascadedOptions(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascadeKey]);

  // ── Field config for NewReportPage (Freight-style layout) ─────────────────
  const fields: ReportFieldConfig[] = useMemo(
    () => [
      // Row 1 — three equal columns like Freight (Principal | Job No | Department)
      {
        key: "prin_code",
        label: "Principal",
        type: "multiselect",
        options: prinOptions,
        loading: optLoading,
        required: true,
        colSpan: 4,
      },
      {
        key: "job_no",
        label: "Job No",
        type: "multiselect",
        options: jobOptions,
        loading: optLoading,
        colSpan: 4,
      },
      {
        key: "prod_code",
        label: "Product",
        type: "multiselect",
        options: prodOptions,
        loading: optLoading,
        colSpan: 4,
      },
      // Row 2
      {
        key: "site_code",
        label: "Site",
        type: "multiselect",
        options: siteOptions,
        loading: optLoading,
        colSpan: 4,
      },
      {
        key: "location_code_from",
        label: "Location From",
        type: "select",
        options: locationOptions,
        loading: optLoading,
        placeholder: "Select start location",
        colSpan: 4,
      },
      {
        key: "location_code_to",
        label: "Location To",
        type: "select",
        options: locationOptions,
        loading: optLoading,
        placeholder: "Select end location",
        colSpan: 4,
      },
      // Row 3
      {
        key: "group_by",
        label: "Group By",
        type: "select",
        options: [
          { value: "group_brand", label: "Product Group → Brand" },
          { value: "principal_product", label: "Principal → Product" },
          { value: "product_group", label: "Product Group" },
          { value: "site_location", label: "Site / Location" },
        ],
        placeholder: "No grouping",
        colSpan: 4,
      },
    ],
    [prinOptions, jobOptions, prodOptions, siteOptions, locationOptions, optLoading]
  );

  // Map Params → flat values object expected by NewReportPage
  const values: Record<string, any> = {
    prin_code: params.prin_code,
    job_no: params.job_no,
    prod_code: params.prod_code,
    site_code: params.site_code,
    location_code_from: params.location_code_from,
    location_code_to: params.location_code_to,
    group_by: params.group_by,
  };

  const handleChange = (key: string, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearAll = () => {
    setParams({ ...DEFAULT_PARAMS });
    setError(null);
    setHtmlContent(null);
  };

  // ── Generate → open dialog with HTML ──────────────────────────────────────
  const handleGenerate = async () => {
    if (!params.prin_code.length) {
      setError("Please select a Principal before generating.");
      return;
    }

    setLoading(true);
    setError(null);
    setDialogOpen(true);
    setHtmlContent(null);

    try {
      const res = await api.post(
        "/api/wms/reports/stockdetails/html",
        buildPayload(params),
        { responseType: "text" }
      );

      setHtmlContent(res.data);
      setReportMeta({
        companyName: "Stock Detail Report",
        generatedAt: new Date().toLocaleString(),
        user: "Admin",
        period: "Selected filters",
      });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load report. Please try again.");
      setHtmlContent(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Excel export (same endpoint as before) ────────────────────────────────
  const handleExcel = async () => {
    setExporting(true);
    try {
      const res = await api.post(
        "/api/wms/reports/stockdetails/excel",
        buildPayload(params),
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_detail_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleOpenInNewWindow = () => {
    if (!htmlContent) return;
    const w = window.open("", "_blank");
    if (!w) {
      setError("Pop-up blocked. Allow pop-ups to open the report in a new window.");
      return;
    }
    w.document.open();
    w.document.write(htmlContent);
    w.document.close();
  };

  return (
    <>
      <NewReportPage
        fieldsPerRow={3}
        title="Stock Detail Report"
        fields={fields}
        values={values}
        onChange={handleChange}
        onClearAll={handleClearAll}
        onGenerate={handleGenerate}
        loading={loading}
        optionsLoading={optLoading}
        error={error || optError}
        onClearError={() => {
          setError(null);
          setOptError(null);
        }}
      />

      <NewReportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Stock Detail Report"
        htmlContent={htmlContent}
        loading={loading}
        error={error}
        meta={reportMeta}
        onExportExcel={handleExcel}
        exportingExcel={exporting}
        onOpenInNewWindow={handleOpenInNewWindow}
      />
    </>
  );
}