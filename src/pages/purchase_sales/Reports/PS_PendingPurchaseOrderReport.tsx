import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../state/AuthContext";
import {
  getDynamicLookupaccount,
  type DynamicQueryParams,
} from "../../../api/lookups";
import { api } from "../../../api/client";
import { openPsReport } from "../../../components/purchase-sales/reports/psReportPreviewStore";
import { NewReportPage } from "../../../components/new_report_format/NewReportPage";
import type { ReportFieldConfig, ReportOption } from "../../../components/new_report_format/types";

interface PurchaseOrderReportProps {
  required_values?: {
    divCode: string;
    companyCode?: string;
  };
}

type SupplierRow = { AC_CODE: string; AC_NAME: string };
type ProductRow = { PROD_CODE: string; PROD_NAME: string };
type DocRow = { DOC_NO: string; DOC_DATE: string; DOC_TYPE: string };
type LogoRow = { COMP_LOGO: string };

type ReportCriteria = "Summary" | "Detail";

interface LookupRow {
  [key: string]: any;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  /** composite "code::name" value, or "" for All */
  docNo: string;
  supplierCode: string;
  productFrom: string;
  productTo: string;
  reportType: ReportCriteria;
  cancelledPO: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
// Composite value avoids collisions when the same code legitimately appears
// on multiple rows with different names.
const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): ReportOption[] => {
  const seen = new Set<string>();
  const options: ReportOption[] = [];
  rows.forEach((r) => {
    const code = getField(r, codeKey);
    const name = getField(r, nameKey);
    if (!code) return;
    const value = `${code}::${name}`;
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, label: name ? `${code} | ${name}` : code });
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
};

// Recovers the underlying code from a composite "code::name" option value.
const codeFromOptionValue = (v: string): string => v.split("::")[0];

// Resolves a single-picker value ("" or "code::name") down to a scalar code.
const codeOrAll = (v: string): string => (v ? codeFromOptionValue(v) : "All");

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

const defaultDateFrom = () =>
  toISODate(new Date(new Date().getFullYear(), 0, 1));
const defaultDateTo = () => toISODate(new Date());

const buildDefaultFilters = (): Filters => ({
  dateFrom: defaultDateFrom(),
  dateTo: defaultDateTo(),
  docNo: "",
  supplierCode: "",
  productFrom: "",
  productTo: "",
  reportType: "Summary",
  cancelledPO: false,
});

function uppercaseKeys<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out as T;
}

const PurchaseOrderReport: React.FC<PurchaseOrderReportProps> = () => {
  const { user } = useAuth();
  const loginid = (user as any)?.loginid ?? "";
  const companyCode: string =
    ((user as any)?.company_code as string)?.trim() || "All";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [filters, setFilters] = useState<Filters>(buildDefaultFilters());

  const setFilter = (key: string, val: any) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  // Suppliers lookup using stored procedure
  const { data: supplierRows = [], isLoading: isSupplierLoading } = useQuery<SupplierRow[]>({
    queryKey: ["po_get_suppliers", companyCode, loginid],
    queryFn: async () => {
      const rows = await getDynamicLookupaccount({
        parameter: "PENDING_PURCHASE_ORDER_SUPPLIERS",
        loginid,
        code1: companyCode,
      } as DynamicQueryParams);
      return (rows || []).map((r) =>
        uppercaseKeys<SupplierRow>(r as Record<string, any>)
      );
    },
  });

  // Products lookup using stored procedure
  const { data: productRows = [], isLoading: isProductLoading } = useQuery<ProductRow[]>({
    queryKey: ["po_get_products", companyCode, loginid],
    queryFn: async () => {
      const rows = await getDynamicLookupaccount({
        parameter: "PENDING_PURCHASE_ORDER_PRODUCTS",
        loginid,
        code1: companyCode,
        code2: "ALL",
      } as DynamicQueryParams);
      return (rows || []).map((r) =>
        uppercaseKeys<ProductRow>(r as Record<string, any>)
      );
    },
    enabled: !!companyCode,
  });

  // Document Numbers lookup using stored procedure
  const { data: docRows = [], isLoading: isDocLoading } = useQuery<DocRow[]>({
    queryKey: ["po_get_docno", companyCode, loginid],
    queryFn: async () => {
      const rows = await getDynamicLookupaccount({
        parameter: "PENDING_PURCHASE_ORDER_DOCNO",
        loginid,
        code1: companyCode,
      } as DynamicQueryParams);
      return (rows || []).map((r) =>
        uppercaseKeys<DocRow>(r as Record<string, any>)
      );
    },
    enabled: !!companyCode,
  });

  // Company logo lookup using stored procedure (PENDING_PURCHASE_ORDER_LOGO)
  const { data: logoRows = [] } = useQuery<LogoRow[]>({
    queryKey: ["po_get_logo", companyCode, loginid],
    queryFn: async () => {
      const rows = await getDynamicLookupaccount({
        parameter: "PENDING_PURCHASE_ORDER_LOGO",
        loginid,
        code1: companyCode,
      } as DynamicQueryParams);
      return (rows || []).map((r) =>
        uppercaseKeys<LogoRow>(r as Record<string, any>)
      );
    },
    enabled: !!companyCode,
  });

  const logoUrl = logoRows[0]?.COMP_LOGO || "";

  // ── Dropdown options for the pickers
  const supplierOptions = useMemo(
    () => mapCodeNameOptions(supplierRows, "AC_CODE", "AC_NAME"),
    [supplierRows]
  );
  const productOptions = useMemo(
    () => mapCodeNameOptions(productRows, "PROD_CODE", "PROD_NAME"),
    [productRows]
  );
  const docOptions = useMemo(
    () => mapCodeNameOptions(docRows, "DOC_NO", "DOC_TYPE"),
    [docRows]
  );

  const optionsLoading = isSupplierLoading || isProductLoading || isDocLoading;

  const fields: ReportFieldConfig[] = useMemo(
    () => [
      {
        key: "dateFrom",
        toKey: "dateTo",
        label: "Date Range",
        type: "daterange",
        required: true,
      },
      {
        key: "docNo",
        label: "Document No",
        type: "select",
        options: docOptions,
        loading: isDocLoading,
        placeholder: "All",
      },
      {
        key: "supplierCode",
        label: "Supplier",
        type: "select",
        options: supplierOptions,
        loading: isSupplierLoading,
        placeholder: "All",
      },
      {
        key: "productFrom",
        label: "Product From",
        type: "select",
        options: productOptions,
        loading: isProductLoading,
        placeholder: "All",
      },
      {
        key: "productTo",
        label: "Product To",
        type: "select",
        options: productOptions,
        loading: isProductLoading,
        placeholder: "All",
      },
    ],
    [docOptions, supplierOptions, productOptions, isDocLoading, isSupplierLoading, isProductLoading]
  );

  const buildBody = (f: Filters) => {
    const from = parseISODate(f.dateFrom);
    const toInclusive = parseISODate(f.dateTo);
    const toExclusive = toInclusive ? addDays(toInclusive, 1) : null;

    const supplierCodeVal = codeOrAll(f.supplierCode);
    const productFromVal = codeOrAll(f.productFrom);
    const productToVal = codeOrAll(f.productTo);
    const docNoVal = codeOrAll(f.docNo);

    return {
      company_code: companyCode,
      supplier_code: supplierCodeVal,
      product_from: productFromVal,
      product_to: productToVal,
      cancelled: f.cancelledPO ? "Y" : "N",
      doc_no: docNoVal !== "All" ? Number(docNoVal) : 0,
      date_from: from ? toISODate(from) : null,
      date_to: toExclusive ? toISODate(toExclusive) : null,
      report_type: f.reportType,
      logo_url: logoUrl || null,
    };
  };

  // Fetch the report HTML and hand it to the shared preview dialog.
  const handleGenerate = async () => {
    setError("");
    setLoading(true);

    const preview = openPsReport("Pending Purchase Order Report");

    try {
      const body = buildBody(filters);

      const res = await api.post("/api/purchase-sales/reports/pending-po/html", body, {
        responseType: "text",
        headers: { Accept: "text/html" },
      });

      const htmlContent = typeof res.data === "string" ? res.data : String(res.data);

      preview.ready({
        html: htmlContent,
        filename: `pending_po_${body.report_type}_${new Date().toISOString().slice(0, 10)}`,
        orientation: "landscape",
        excelEndpoint: "/api/purchase-sales/reports/pending-po/excel",
        excelPayload: body,
      });
      setHasGenerated(true);
      setLastGeneratedAt(new Date());
    } catch (e: any) {
      const failure = e?.response?.data?.message || e?.message || "Failed to generate report";
      setError(failure);
      preview.fail(failure);
      setHasGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters(buildDefaultFilters());
    setHasGenerated(false);
    setLastGeneratedAt(null);
    setError("");
  };

  return (
    <NewReportPage
      title="Pending Purchase Order Report"
      fields={fields}
      values={filters}
      onChange={setFilter}
      onClearAll={handleReset}
      onGenerate={handleGenerate}
      loading={loading}
      optionsLoading={optionsLoading}
      error={error || null}
      onClearError={() => setError("")}
      reportVariantOptions={[
        { value: "Summary", label: "Summary" },
        { value: "Detail", label: "Detail" },
      ]}
      reportVariant={filters.reportType}
      onReportVariantChange={(v: string) => setFilter("reportType", v as ReportCriteria)}
      fieldsPerRow={3}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={filters.cancelledPO}
            onChange={(e) => setFilter("cancelledPO", e.target.checked)}
            style={{ accentColor: "#1e3a8a" }}
          />
          Cancelled PO
        </label>

        {logoUrl && (
          <img
            src={logoUrl}
            alt="Company Logo"
            style={{ height: 28, maxWidth: 140, objectFit: "contain" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        {hasGenerated && (
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
            Report generated{lastGeneratedAt ? ` at ${lastGeneratedAt.toLocaleTimeString()}` : ""}
          </span>
        )}
      </div>
    </NewReportPage>
  );
};

export default PurchaseOrderReport;