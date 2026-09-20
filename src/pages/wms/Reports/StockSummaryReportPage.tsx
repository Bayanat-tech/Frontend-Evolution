import React, { useCallback, useEffect, useRef, useState } from "react";
import { openWmsReport } from "../../../components/wms/reports/wmsReportPreviewStore";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { NewReportPage } from "../../../components/new_report_format/NewReportPage";
import type { ReportFieldConfig, ReportOption } from "../../../components/new_report_format/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupRow {
  [key: string]: any;
}

interface Params {
  prin_code: string[];
  prod_code: string[];
  site_code: string[];
  location_code: string[];
  group_by: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Case-insensitive key lookup
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

// Rows with a code + name pair → { value: "code::name", label: "code - name" }
// The option value is a unique composite of code+name (not just the code),
// because the same code can legitimately appear on multiple distinct rows
// with different names (e.g. same PROD_CODE reused across different
// products in the source data). If two options shared the same `value`,
// the multi-select would visually tick both when only one was clicked.
// Use codeFromOptionValue/codesFromSelection below to recover the actual
// code(s) whenever building a SQL filter or the API payload.
const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): ReportOption[] => {
  const seen = new Set<string>();
  const options: ReportOption[] = [];
  rows.forEach((r) => {
    const code = getField(r, codeKey);
    const name = getField(r, nameKey);
    if (!code) return;
    const value = `${code}::${name}`;
    if (seen.has(value)) return; // skip exact duplicate rows only
    seen.add(value);
    options.push({ value, label: name ? `${code} - ${name}` : code });
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
};

// Recovers the underlying code from a composite "code::name" option value.
const codeFromOptionValue = (v: string): string => v.split("::")[0];

// Converts a selection array (which may hold composite option values, or
// the special "All" sentinel) into a deduped list of real codes for use in
// SQL IN-clauses and API payloads.
const codesFromSelection = (values: string[]): string[] => {
  if (!values.length || values.includes("All")) return ["All"];
  const codes = new Set<string>();
  values.forEach((v) => codes.add(codeFromOptionValue(v)));
  return Array.from(codes);
};

// Rows with only a single code column → { value: code, label: code }
const mapSingleColumnOptions = (rows: LookupRow[], codeKey: string): ReportOption[] =>
  rows
    .map((r) => getField(r, codeKey))
    .filter((v) => !!v)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));

// Escapes single quotes for safe interpolation into a SQL string literal
const sqlEscape = (v: string): string => v.replace(/'/g, "''");

// Builds a `COL IN ('a','b')` clause for a selected-values array
const inClause = (col: string, values: string[]): string => {
  if (!values.length || values.includes("All")) return "";
  const list = values.map((v) => `'${sqlEscape(v)}'`).join(",");
  return `${col} IN (${list})`;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StockSummaryReport() {
  // ── State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // ── Parameter options
  const [prinOptions, setPrinOptions] = useState<ReportOption[]>([]);
  const [prodOptions, setProdOptions] = useState<ReportOption[]>([]);
  const [siteOptions, setSiteOptions] = useState<ReportOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<ReportOption[]>([]);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string>("");

  // ── Parameter values (no job_no — summary does not filter by job)
  const [params, setParams] = useState<Params>({
    prin_code: ["All"],
    prod_code: ["All"],
    site_code: ["All"],
    location_code: ["All"],
    group_by: "",
  });

  const optionsRequestRef = useRef(0);

  // ── Cross-filtered option loader ─────────────────────────────────────────
  const loadCascadedOptions = useCallback(async (p: Params) => {
    const requestId = ++optionsRequestRef.current;
    setOptLoading(true);
    setOptError("");

    const prinFilter = inClause("PRIN_CODE", codesFromSelection(p.prin_code));
    const prodFilter = inClause("PROD_CODE", codesFromSelection(p.prod_code));
    const siteFilter = inClause("SITE_CODE", p.site_code);

    const whereExcept = (...exclude: string[]): string => {
      const all = { prin: prinFilter, prod: prodFilter, site: siteFilter };
      const clauses = Object.entries(all)
        .filter(([key]) => !exclude.includes(key))
        .map(([, clause]) => clause)
        .filter(Boolean);
      return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    };

    const sql = {
      prin: `select distinct prin_code, prin_name from VW_BOWM_STK_LEDGER ${whereExcept("prin")}`,
      prod: `select distinct PROD_CODE, PROD_NAME from VW_BOWM_STK_LEDGER ${whereExcept("prod")}`,
      site: `select distinct site_code from VW_BOWM_STK_LEDGER ${whereExcept("site")}`,
      location: `select distinct location_code from VW_BOWM_STK_LEDGER ${whereExcept()}`,
    };

    try {
      const [prinRows, prodRows, siteRows, locRows] = await Promise.all([
        executeWmsInboundSql(sql.prin),
        executeWmsInboundSql(sql.prod),
        executeWmsInboundSql(sql.site),
        executeWmsInboundSql(sql.location),
      ]);

      if (requestId !== optionsRequestRef.current) return;

      const nextPrin = mapCodeNameOptions(prinRows, "prin_code", "prin_name");
      const nextProd = mapCodeNameOptions(prodRows, "prod_code", "prod_name");
      const nextSite = mapSingleColumnOptions(siteRows, "site_code");
      const nextLocation = mapSingleColumnOptions(locRows, "location_code");

      setPrinOptions(nextPrin);
      setProdOptions(nextProd);
      setSiteOptions(nextSite);
      setLocationOptions(nextLocation);

      setParams((prev) => {
        const reset = (
          current: string[],
          validOptions: ReportOption[],
        ): string[] => {
          if (current.includes("All")) return current;
          const validValues = new Set(validOptions.map((o) => o.value));
          const stillValid = current.filter((v) => validValues.has(v));
          return stillValid.length ? stillValid : ["All"];
        };

        const siteIsSpecific = prev.site_code.length > 0 && !prev.site_code.includes("All");

        let nextLocationCode = reset(prev.location_code, nextLocation);

        if (siteIsSpecific && nextLocation.length > 0 && nextLocationCode.includes("All")) {
          // Auto-fill the location code once a specific site is selected
          nextLocationCode = [nextLocation[0].value];
        } else if (!siteIsSpecific) {
          nextLocationCode = ["All"];
        }

        return {
          ...prev,
          prin_code: reset(prev.prin_code, nextPrin),
          prod_code: reset(prev.prod_code, nextProd),
          site_code: reset(prev.site_code, nextSite),
          location_code: nextLocationCode,
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

  // ── Initial option load
  useEffect(() => {
    loadCascadedOptions(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-run the cascade live when Principal/Product/Site change
  const cascadeKey = JSON.stringify([params.prin_code, params.prod_code, params.site_code]);
  const prevCascadeKeyRef = useRef(cascadeKey);
  useEffect(() => {
    if (prevCascadeKeyRef.current === cascadeKey) return;
    prevCascadeKeyRef.current = cascadeKey;
    loadCascadedOptions(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascadeKey]);

  // ── Fetch the report HTML and publish it to the shared WMS preview
  const fetchReport = useCallback(async (p: Params) => {
    setLoading(true);
    setError("");
    const preview = openWmsReport("Stock Summary Report");

    try {
      const res = await api.post(
        "/api/wms/reports/stocksummary/html",
        {
          prin_code: codesFromSelection(p.prin_code),
          prod_code: codesFromSelection(p.prod_code),
          site_code: p.site_code.includes("All") ? ["All"] : p.site_code,
          location_code: p.location_code.includes("All") ? ["All"] : p.location_code,
          group_by: p.group_by || null,
        },
        { responseType: "text" },
      );
      preview.ready({
        html: res.data,
        filename: "stock_summary_report",
        excelEndpoint: "/api/wms/reports/stocksummary/excel",
        excelPayload: {
          prin_code: codesFromSelection(p.prin_code),
          prod_code: codesFromSelection(p.prod_code),
          site_code: p.site_code.includes("All") ? ["All"] : p.site_code,
          location_code: p.location_code.includes("All") ? ["All"] : p.location_code,
          group_by: p.group_by || null,
        },
      });
    } catch (e: any) {
      const message = e?.response?.data?.message ?? "Failed to load report. Please try again.";
      preview.fail(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Generate report
  // NOTE: Principal is now a multi-select with an "All" default (same as
  // Product/Site), so it's always populated and no longer needs a
  // "must pick one" guard before generating.
  const handleGenerateReport = () => {
    fetchReport(params);
  };

  const setParam = (key: string, val: any) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  const handleReset = () => {
    setParams({
      prin_code: ["All"],
      prod_code: ["All"],
      site_code: ["All"],
      location_code: ["All"],
      group_by: "",
    });
    setError("");
    setOptError("");
  };

  const groupByOptions: ReportOption[] = [
    { value: "group_brand", label: "Product Group → Brand" },
    { value: "principal_product", label: "Principal → Product" },
    { value: "product_group", label: "Product Group" },
    { value: "site_location", label: "Site / Location" },
  ];

  const fields: ReportFieldConfig[] = [
    {
      key: "prin_code",
      label: "Principal",
      type: "multiselect",
      options: prinOptions,
      loading: optLoading,
    },
    {
      key: "prod_code",
      label: "Product",
      type: "multiselect",
      options: prodOptions,
      loading: optLoading,
    },
    {
      key: "site_code",
      label: "Site",
      type: "multiselect",
      options: siteOptions,
      loading: optLoading,
    },
    {
      key: "location_code",
      label: "Location Code",
      type: "multiselect",
      options: locationOptions,
      loading: optLoading,
    },
    {
      key: "group_by",
      label: "Group By",
      type: "select",
      options: groupByOptions,
      loading: optLoading,
      placeholder: "No grouping",
    },
  ];

  return (
    <NewReportPage
      title="Stock Summary Report"
      fields={fields}
      values={params}
      onChange={setParam}
      onClearAll={handleReset}
      onGenerate={handleGenerateReport}
      loading={loading}
      optionsLoading={optLoading}
      error={error || optError || null}
      onClearError={() => {
        setError("");
        setOptError("");
      }}
      fieldsPerRow={3}
    />
  );
}