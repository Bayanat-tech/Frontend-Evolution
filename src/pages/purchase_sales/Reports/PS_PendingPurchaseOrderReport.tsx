import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RotateCcw,
  BarChart2,
  Eye,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import {
  getDynamicLookupaccount,
  type DynamicQueryParams,
} from "../../../api/lookups";
import { api } from "../../../api/client";
import { openPsReport } from "../../../components/purchase-sales/reports/psReportPreviewStore";
import { MultiSelectField } from "../../../components/ui/MultiSelectField";

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

interface Option {
  value: string;
  label: string;
}

interface LookupRow {
  [key: string]: any;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  docNo: string[];
  supplierCode: string[];
  productFrom: string[];
  productTo: string[];
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
const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): Option[] => {
  const seen = new Set<string>();
  const options: Option[] = [];
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

// Converts a selection array (composite values, or the "All" sentinel) into
// a deduped list of real codes.
const codesFromSelection = (values: string[]): string[] => {
  if (!values.length || values.includes("All")) return ["All"];
  const codes = new Set<string>();
  values.forEach((v) => codes.add(codeFromOptionValue(v)));
  return Array.from(codes);
};

// These four fields are single-value pickers (Doc No, Supplier, and the two
// range endpoints Product From/To) rendered with MultiSelectField for visual
// consistency with Stock Summary. Since MultiSelectField itself supports
// multiple selections, this clips any selection down to just the most
// recently picked value so the field still behaves as a single picker.
const enforceSingle = (prevArr: string[], nextArr: string[]): string[] => {
  if (!nextArr.length) return ["All"];
  if (nextArr.includes("All") && !prevArr.includes("All")) return ["All"];
  if (nextArr.length === 1) return nextArr;
  const added = nextArr.find((v) => !prevArr.includes(v));
  return added ? [added] : [nextArr[nextArr.length - 1]];
};

// Resolves a single-picker selection array down to one scalar code (or "All").
const singleCode = (arr: string[]): string => {
  const codes = codesFromSelection(arr);
  if (!codes.length || codes.includes("All")) return "All";
  return codes[0];
};

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
  docNo: ["All"],
  supplierCode: ["All"],
  productFrom: ["All"],
  productTo: ["All"],
  reportType: "Summary",
  cancelledPO: false,
});

const BG = "#EEF5FD";

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 12,
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function FloatLabel({
  label,
  required,
  children,
  bgColor = "#fff",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  bgColor?: string;
}) {
  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <span
        style={{
          position: "absolute",
          top: -8,
          left: 10,
          fontSize: 11,
          color: "#6b7280",
          background: bgColor,
          padding: "0 4px",
          zIndex: 1,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
      >
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {children}
    </div>
  );
}

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
  const [pending, setPending] = useState<Filters>(buildDefaultFilters());
  const [applied, setApplied] = useState<Filters>(buildDefaultFilters());

  const setPendingField = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setPending((prev) => ({ ...prev, [key]: val }));

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

  // ── Dropdown options for the MultiSelectField pickers
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

  const buildBody = (f: Filters) => {
    const from = parseISODate(f.dateFrom);
    const toInclusive = parseISODate(f.dateTo);
    const toExclusive = toInclusive ? addDays(toInclusive, 1) : null;

    const supplierCodeVal = singleCode(f.supplierCode);
    const productFromVal = singleCode(f.productFrom);
    const productToVal = singleCode(f.productTo);
    const docNoVal = singleCode(f.docNo);

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
      const body = buildBody(pending);
      setApplied({ ...pending });

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
    const d = buildDefaultFilters();
    setPending(d);
    setApplied(d);
    setHasGenerated(false);
    setLastGeneratedAt(null);
    setError("");
  };

  const row2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  return (
    <div
      style={{
        background: "#f3f4f6",
        padding: "6px 10px",
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
      }}
    >
      <style>{`
        .action-btn-primary:hover { background: #1e40af !important; }
        .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
        .field-row { background: #EEF5FD; border-radius: 8px; padding: 10px 12px; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Parameters */}
        <div
          style={{
            background: "#fff",
            border: "0.5px solid #e5e7eb",
            borderRadius: 12,
            padding: "8px 12px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart2 size={17} color="#185FA5" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Pending Purchase Order Report
              </span>
              {hasGenerated && (
                <span
                  style={{
                    fontSize: 10,
                    background: "#d1fae5",
                    color: "#065f46",
                    padding: "2px 10px",
                    borderRadius: 12,
                    fontWeight: 500,
                  }}
                >
                  Report Generated
                </span>
              )}
            </div>

            {/* Company logo preview, pulled via PENDING_PURCHASE_ORDER_LOGO */}
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Company Logo"
                style={{
                  height: 32,
                  maxWidth: 160,
                  objectFit: "contain",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>

          {error && (
            <div
              style={{
                marginBottom: 10,
                padding: "8px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                color: "#dc2626",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="field-row" style={row2}>
              <FloatLabel label="Date From" bgColor={BG} required>
                <input
                  type="date"
                  value={pending.dateFrom}
                  onChange={(e) => setPendingField("dateFrom", e.target.value)}
                  style={inputBaseStyle}
                />
              </FloatLabel>
              <FloatLabel label="Date To" bgColor={BG} required>
                <input
                  type="date"
                  value={pending.dateTo}
                  onChange={(e) => setPendingField("dateTo", e.target.value)}
                  style={inputBaseStyle}
                />
              </FloatLabel>
            </div>

            <div className="field-row" style={row2}>
              <FloatLabel label="Document No" bgColor={BG}>
                <MultiSelectField
                  label=""
                  options={docOptions}
                  value={pending.docNo}
                  onChange={(v: string[]) =>
                    setPendingField("docNo", enforceSingle(pending.docNo, v))
                  }
                  loading={isDocLoading}
                />
              </FloatLabel>
              <FloatLabel label="Supplier" bgColor={BG}>
                <MultiSelectField
                  label=""
                  options={supplierOptions}
                  value={pending.supplierCode}
                  onChange={(v: string[]) =>
                    setPendingField("supplierCode", enforceSingle(pending.supplierCode, v))
                  }
                  loading={isSupplierLoading}
                />
              </FloatLabel>
            </div>

            <div className="field-row" style={row2}>
              <FloatLabel label="Product From" bgColor={BG}>
                <MultiSelectField
                  label=""
                  options={productOptions}
                  value={pending.productFrom}
                  onChange={(v: string[]) =>
                    setPendingField("productFrom", enforceSingle(pending.productFrom, v))
                  }
                  loading={isProductLoading}
                />
              </FloatLabel>
              <FloatLabel label="Product To" bgColor={BG}>
                <MultiSelectField
                  label=""
                  options={productOptions}
                  value={pending.productTo}
                  onChange={(v: string[]) =>
                    setPendingField("productTo", enforceSingle(pending.productTo, v))
                  }
                  loading={isProductLoading}
                />
              </FloatLabel>
            </div>

            <div className="field-row" style={row2}>
              <FloatLabel label="Report Criteria" bgColor={BG} required>
                <select
                  value={pending.reportType}
                  onChange={(e) =>
                    setPendingField(
                      "reportType",
                      e.target.value as ReportCriteria
                    )
                  }
                  style={{ ...inputBaseStyle, cursor: "pointer" }}
                >
                  <option value="Summary">Summary</option>
                  <option value="Detail">Detail</option>
                </select>
              </FloatLabel>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingTop: 8,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pending.cancelledPO}
                    onChange={(e) =>
                      setPendingField("cancelledPO", e.target.checked)
                    }
                    style={{ accentColor: "#185FA5" }}
                  />
                  Cancelled PO
                </label>
              </div>
            </div>
          </div>

          {/* Status bar when report is generated */}
          {hasGenerated && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 12, color: "#065f46" }}>
                  Report generated successfully at {lastGeneratedAt?.toLocaleTimeString()}
                </span>
              </div>
              <button
                onClick={() => {
                  setError("The report is available in the preview dialog.");
                }}
                style={{
                  padding: "4px 12px",
                  background: "#185FA5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Eye size={12} /> Open Report
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 10,
              paddingTop: 8,
              borderTop: "0.5px solid #e5e7eb",
            }}
          >
            <button
              className="action-btn-excel"
              onClick={handleReset}
              disabled={loading}
              style={{
                padding: "7px 16px",
                border: "0.5px solid #d1d5db",
                background: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                borderRadius: 6,
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>

            <button
              className="action-btn-primary"
              onClick={handleGenerate}
              disabled={loading}
              style={{
                padding: "7px 16px",
                border: "0.5px solid #185FA5",
                background: loading ? "#94a3b8" : "#185FA5",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                borderRadius: 6,
                color: "#fff",
              }}
            >
              {loading ? (
                "Generating..."
              ) : (
                <>
                  <Eye size={13} /> Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderReport;