import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "../../../state/AuthContext";
import {
  getDynamicLookupaccount,
  type DynamicQueryParams,
} from "../../../api/lookups";
import { api } from "../../../api/client";
import { NewReportPage } from "../../../components/new_report_format/NewReportPage";
import { NewReportDialog } from "../../../components/new_report_format";
import type { ReportFieldConfig, ReportOption } from "../../../components/new_report_format/types";

interface PurchaseOrderReportProps {
  required_values?: {
    divCode: string;
    companyCode?: string;
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

type SupplierRow = { AC_CODE: string; AC_NAME: string };
type ProductRow = { PROD_CODE: string; PROD_NAME: string };
type DocRow = { DOC_NO: string; DOC_DATE: string; DOC_TYPE: string };
type LogoRow = { COMP_LOGO: string };

type ReportCriteria = "Summary" | "Detail";

interface Params {
  dateFrom: string;
  dateTo: string;
  docNo: string[];
  supplierCode: string[];
  productFrom: string[];
  productTo: string[];
  reportType: ReportCriteria;
  cancelledPO: boolean;
}

// ─── Helpers (same conventions as StockAgeingQuantityReport) ──────────────────

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseISODate = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

const defaultDateFrom = () => toISODate(new Date(new Date().getFullYear(), 0, 1));
const defaultDateTo = () => toISODate(new Date());

const DEFAULT_PARAMS: Params = {
  dateFrom: defaultDateFrom(),
  dateTo: defaultDateTo(),
  docNo: ["All"],
  supplierCode: ["All"],
  productFrom: ["All"],
  productTo: ["All"],
  reportType: "Summary",
  cancelledPO: false,
};

function uppercaseKeys<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out as T;
}

// Rows with a code + name pair → { value: "code::name", label: "code - name" }.
// The option value is a unique composite of code+name, mirroring the pattern
// used for principal/department/product options in the stock ageing report,
// so the same code can appear more than once under a different name.
const mapCodeNameOptions = (
  rows: Array<{ code: string; name: string }>,
): ReportOption[] => {
  const seen = new Set<string>();
  const options: ReportOption[] = [];
  rows.forEach(({ code, name }) => {
    if (!code) return;
    const value = `${code}::${name}`;
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, label: name ? `${code} - ${name}` : code });
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
};

const codeFromOptionValue = (v: string): string => v.split("::")[0];

const codesFromSelection = (values: string[]): string[] => {
  if (!values.length || values.includes("All")) return ["All"];
  const codes = new Set<string>();
  values.forEach((v) => codes.add(codeFromOptionValue(v)));
  return Array.from(codes);
};

// The Purchase Order backend endpoints take a single code per field
// (supplier_code, product_from, product_to, doc_no) rather than an array.
// Selecting a value in these multiselects still lets a user pick only one
// meaningful filter at a time; we take the first selected code when building
// the request body. If the backend is updated to accept a list, swap
// firstCodeFromSelection(...) below for codesFromSelection(...).
const firstCodeFromSelection = (values: string[]): string => {
  const codes = codesFromSelection(values);
  return codes[0] === "All" ? "All" : codes[0];
};

const reportTypeOptions: ReportOption[] = [
  { value: "Summary", label: "Summary" },
  { value: "Detail", label: "Detail" },
];

// ─── Main Component ─────────────────────────────────────────────────────────

const PurchaseOrderReport: React.FC<PurchaseOrderReportProps> = () => {
  const { user } = useAuth();
  const loginid = (user as any)?.loginid ?? "";
  const companyCode: string = ((user as any)?.company_code as string)?.trim() || "All";

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [appliedParams, setAppliedParams] = useState<Params>(DEFAULT_PARAMS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);

  // ── Report preview dialog state (raw HTML, no blob URL) ──
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportPreviewExporting, setReportPreviewExporting] = useState(false);

  // ── Lookup options ──
  const [supplierOptions, setSupplierOptions] = useState<ReportOption[]>([]);
  const [productOptions, setProductOptions] = useState<ReportOption[]>([]);
  const [docOptions, setDocOptions] = useState<ReportOption[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState("");

  const optionsRequestRef = useRef(0);

  const dateRangeValid = !params.dateFrom || !params.dateTo || params.dateFrom <= params.dateTo;

  const loadOptions = useCallback(async () => {
    const requestId = ++optionsRequestRef.current;
    setOptLoading(true);
    setOptError("");

    try {
      const [supplierRows, productRows, docRows, logoRows] = await Promise.all([
        getDynamicLookupaccount({
          parameter: "PENDING_PURCHASE_ORDER_SUPPLIERS",
          loginid,
          code1: companyCode,
        } as DynamicQueryParams),
        getDynamicLookupaccount({
          parameter: "PENDING_PURCHASE_ORDER_PRODUCTS",
          loginid,
          code1: companyCode,
          code2: "ALL",
        } as DynamicQueryParams),
        getDynamicLookupaccount({
          parameter: "PENDING_PURCHASE_ORDER_DOCNO",
          loginid,
          code1: companyCode,
        } as DynamicQueryParams),
        getDynamicLookupaccount({
          parameter: "PENDING_PURCHASE_ORDER_LOGO",
          loginid,
          code1: companyCode,
        } as DynamicQueryParams),
      ]);

      if (requestId !== optionsRequestRef.current) return;

      const suppliers = (supplierRows || []).map((r) => uppercaseKeys<SupplierRow>(r as Record<string, any>));
      const products = (productRows || []).map((r) => uppercaseKeys<ProductRow>(r as Record<string, any>));
      const docs = (docRows || []).map((r) => uppercaseKeys<DocRow>(r as Record<string, any>));
      const logos = (logoRows || []).map((r) => uppercaseKeys<LogoRow>(r as Record<string, any>));

      setSupplierOptions(
        mapCodeNameOptions(suppliers.map((s) => ({ code: s.AC_CODE, name: s.AC_NAME }))),
      );
      setProductOptions(
        mapCodeNameOptions(products.map((p) => ({ code: p.PROD_CODE, name: p.PROD_NAME }))),
      );
      setDocOptions(
        mapCodeNameOptions(docs.map((d) => ({ code: d.DOC_NO, name: d.DOC_TYPE }))),
      );
      setLogoUrl(logos[0]?.COMP_LOGO || "");
    } catch (e: any) {
      if (requestId !== optionsRequestRef.current) return;
      console.error("Failed to load parameter options", e);
      setOptError(e?.message ?? "Failed to load filter options");
    } finally {
      if (requestId === optionsRequestRef.current) setOptLoading(false);
    }
  }, [companyCode, loginid]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const buildBody = (p: Params) => {
    const from = parseISODate(p.dateFrom);
    const toInclusive = parseISODate(p.dateTo);
    const toExclusive = toInclusive ? addDays(toInclusive, 1) : null;

    return {
      company_code: companyCode,
      supplier_code: firstCodeFromSelection(p.supplierCode),
      product_from: firstCodeFromSelection(p.productFrom),
      product_to: firstCodeFromSelection(p.productTo),
      cancelled: p.cancelledPO ? "Y" : "N",
      doc_no: p.docNo.includes("All") ? 0 : Number(firstCodeFromSelection(p.docNo)),
      date_from: from ? toISODate(from) : null,
      date_to: toExclusive ? toISODate(toExclusive) : null,
      report_type: p.reportType,
      logo_url: logoUrl || null,
    };
  };

  // ── Fetch the report HTML and show it in the local NewReportDialog popup ──
  const handleGenerateReport = async () => {
    if (!dateRangeValid) {
      setError("Date From must be on or before Date To.");
      return;
    }

    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);

    setLoading(true);
    setError("");

    try {
      const body = buildBody(params);
      setAppliedParams({ ...params });

      const res = await api.post("/api/purchase-sales/reports/pending-po/html", body, {
        responseType: "text",
        headers: { Accept: "text/html" },
      });

      const htmlContent = typeof res.data === "string" ? res.data : String(res.data);
      setReportHtml(htmlContent);
      setHasGeneratedReport(true);
    } catch (e: any) {
      const failure = e?.response?.data?.message || e?.message || "Failed to generate report";
      setError(failure);
      setReportPreviewError(failure);
    } finally {
      setLoading(false);
    }
  };

  const closeReportPreview = () => {
    setReportPreviewOpen(false);
    setReportHtml(null);
    setReportPreviewError("");
  };

  // ── Excel export for the currently generated report ──
  const handleExportExcel = useCallback(async () => {
    setReportPreviewExporting(true);
    try {
      const body = buildBody(appliedParams);
      const res = await api.post("/api/purchase-sales/reports/pending-po/excel", body, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pending_po_${body.report_type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setReportPreviewError(e?.response?.data?.message || e?.message || "Unable to export report");
    } finally {
      setReportPreviewExporting(false);
    }
  }, [appliedParams, logoUrl]);

  const setParam = (key: string, val: any) => setParams((prev) => ({ ...prev, [key]: val }));

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setAppliedParams(DEFAULT_PARAMS);
    setHasGeneratedReport(false);
    setError("");
    setOptError("");
  };

  const fields: ReportFieldConfig[] = [
    {
      key: "supplierCode",
      label: "Supplier",
      type: "multiselect",
      options: supplierOptions,
      loading: optLoading,
    },
    {
      key: "productFrom",
      label: "Product From",
      type: "multiselect",
      options: productOptions,
      loading: optLoading,
    },
    {
      key: "productTo",
      label: "Product To",
      type: "multiselect",
      options: productOptions,
      loading: optLoading,
    },
    {
      key: "docNo",
      label: "Document No",
      type: "multiselect",
      options: docOptions,
      loading: optLoading,
    },
    {
      key: "reportType",
      label: "Report Criteria",
      type: "select",
      options: reportTypeOptions,
      placeholder: reportTypeOptions[0].label,
    },
  ];

  return (
    <>
      <NewReportPage
        title="Pending Purchase Order Report"
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
        fieldsPerRow={4}
      >
        {/* Date range + Cancelled PO toggle — bespoke to this report, no matching NewReportPage field type */}
        <div style={{ marginTop: 8 }}>
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase text-muted-foreground">
              Document Date Range
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Date From
                <input
                  type="date"
                  className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
                  value={params.dateFrom}
                  max={params.dateTo || undefined}
                  disabled={loading}
                  onChange={(e) => setParam("dateFrom", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Date To
                <input
                  type="date"
                  className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
                  value={params.dateTo}
                  min={params.dateFrom || undefined}
                  disabled={loading}
                  onChange={(e) => setParam("dateTo", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Cancelled PO
                <div
                  className="flex h-8 items-center gap-2 rounded-md px-3 shadow-sm"
                  style={{ border: "1px solid #aebdce", background: "#f4f7fb" }}
                >
                  <span
                    onClick={() => !loading && setParam("cancelledPO", !params.cancelledPO)}
                    className="inline-flex cursor-pointer select-none items-center gap-2 normal-case"
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded transition-colors"
                      style={{
                        border: `2px solid ${params.cancelledPO ? "#1d4ed8" : "#9ca3af"}`,
                        background: params.cancelledPO ? "#1d4ed8" : "transparent",
                      }}
                    />
                    <span className={`text-sm font-normal ${params.cancelledPO ? "text-blue-700" : "text-foreground"}`}>
                      Include Cancelled PO
                    </span>
                  </span>
                </div>
              </label>
            </div>
            {!dateRangeValid && (
              <div className="mt-2 text-[10px] normal-case text-red-600">
                Date From must be on or before Date To.
              </div>
            )}
          </fieldset>
        </div>

        {hasGeneratedReport && (
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                fontSize: 12,
                color: "#065f46",
                background: "#d1fae5",
                padding: "3px 10px",
                borderRadius: 12,
                fontWeight: 500,
              }}
            >
              Report generated successfully
            </span>
          </div>
        )}
      </NewReportPage>

      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title="Pending Purchase Order Report"
        htmlContent={reportHtml}
        loading={loading}
        error={reportPreviewError || null}
        onExportExcel={handleExportExcel}
        exportingExcel={reportPreviewExporting}
      />
    </>
  );
};

export default PurchaseOrderReport;