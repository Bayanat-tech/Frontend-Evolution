import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RotateCcw,
  Printer,
  Check,
  FileText,
  Download,
  BarChart2,
  Eye,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import {
  getDynamicLookupaccount,
  type DynamicQueryParams,
} from "../../../api/lookups";
import { api } from "../../../api/client";

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

interface Filters {
  dateFrom: string;
  dateTo: string;
  docNo: string;
  docNoName: string;
  supplierCode: string;
  supplierName: string;
  productFrom: string;
  productFromName: string;
  productTo: string;
  productToName: string;
  reportType: ReportCriteria;
  cancelledPO: boolean;
}

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
  docNoName: "",
  supplierCode: "",
  supplierName: "",
  productFrom: "",
  productFromName: "",
  productTo: "",
  productToName: "",
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

// Generic Search Field component
const SearchField: React.FC<{
  options: Array<{ code: string; name: string; extra?: string }>;
  code: string;
  name: string;
  onChange: (code: string, name: string) => void;
  loading?: boolean;
  placeholder?: string;
  displayFormat?: (item: { code: string; name: string; extra?: string }) => string;
}> = ({
  options,
  code,
  name,
  onChange,
  loading,
  placeholder = "All",
  displayFormat,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q)
    );
  }, [options, query]);

  const getDisplayText = (item: { code: string; name: string; extra?: string }) => {
    if (displayFormat) {
      return displayFormat(item);
    }
    return `${item.code} | ${item.name}`;
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={open ? query : name || code}
        placeholder={loading ? "Loading…" : placeholder}
        disabled={loading}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          ...inputBaseStyle,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "not-allowed" : "text",
        }}
      />
      {open && !loading && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            zIndex: 50,
            maxHeight: 220,
            overflowY: "auto",
            padding: 4,
          }}
        >
          <div
            onClick={() => {
              onChange("", "");
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              fontSize: 12,
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
              color: "#185FA5",
              background: !code ? "#EEF5FD" : "transparent",
            }}
          >
            {!code && <Check size={12} />} All
          </div>
          {filtered.map((s) => (
            <div
              key={s.code}
              onClick={() => {
                onChange(s.code, s.name);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                fontSize: 12,
                borderRadius: 4,
                cursor: "pointer",
                color: "#374151",
                background: code === s.code ? "#EEF5FD" : "transparent",
              }}
            >
              {code === s.code && <Check size={12} color="#185FA5" />}
              {getDisplayText(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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

  const reportWindowRef = useRef<Window | null>(null);

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

  const buildBody = (f: Filters) => {
    const from = parseISODate(f.dateFrom);
    const toInclusive = parseISODate(f.dateTo);
    const toExclusive = toInclusive ? addDays(toInclusive, 1) : null;

    return {
      company_code: companyCode,
      supplier_code: f.supplierCode || "All",
      product_from: f.productFrom || "All",
      product_to: f.productTo || "All",
      cancelled: f.cancelledPO ? "Y" : "N",
      doc_no: f.docNo ? Number(f.docNo) : 0,
      date_from: from ? toISODate(from) : null,
      date_to: toExclusive ? toISODate(toExclusive) : null,
      report_type: f.reportType,
      logo_url: logoUrl || null,
    };
  };

  // ── Fetch the report HTML from the API and open it in a new browser tab
  const handleGenerate = async () => {
    setError("");
    setLoading(true);

    const newTab = window.open("", "_blank");
    if (!newTab) {
      setLoading(false);
      setError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
      return;
    }
    newTab.document.write(
      "<title>Pending Purchase Order Report</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>"
    );

    try {
      const body = buildBody(pending);
      setApplied({ ...pending });

      const res = await api.post("/api/purchase-sales/reports/pending-po/html", body, {
        responseType: "text",
        headers: { Accept: "text/html" },
      });

      const htmlContent = typeof res.data === "string" ? res.data : String(res.data);

      newTab.document.open();
      newTab.document.write(htmlContent);
      newTab.document.close();

      reportWindowRef.current = newTab;
      setHasGenerated(true);
      setLastGeneratedAt(new Date());
    } catch (e: any) {
      newTab.document.open();
      newTab.document.write(
        "<title>Pending Purchase Order Report</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>"
      );
      newTab.document.close();
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to generate report"
      );
      setHasGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleExcel = async () => {
    setError("");
    setLoading(true);
    try {
      const body = buildBody(hasGenerated ? applied : pending);
      const res = await api.post("/api/purchase-sales/reports/pending-po/excel", body, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pending_po_${body.report_type}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Excel export failed"
      );
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

  // ── Print (targets the most recently opened report tab)
  const handlePrint = () => {
    if (reportWindowRef.current && !reportWindowRef.current.closed) {
      reportWindowRef.current.focus();
      reportWindowRef.current.print();
    } else {
      setError("No open report tab to print. Generate the report again.");
    }
  };

  const row2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  // Format for document number display
  const formatDocDisplay = (item: { code: string; name: string; extra?: string }) => {
    return `${item.code} | ${item.extra || ''}`;
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
                <SearchField
                  options={docRows.map(d => ({
                    code: d.DOC_NO,
                    name: d.DOC_NO,
                    extra: d.DOC_TYPE
                  }))}
                  code={pending.docNo}
                  name={pending.docNoName}
                  loading={isDocLoading}
                  onChange={(code, name) => {
                    setPendingField("docNo", code);
                    setPendingField("docNoName", name);
                  }}
                  placeholder="All"
                  displayFormat={formatDocDisplay}
                />
              </FloatLabel>
              <FloatLabel label="Supplier" bgColor={BG}>
                <SearchField
                  options={supplierRows.map(s => ({ code: s.AC_CODE, name: s.AC_NAME }))}
                  code={pending.supplierCode}
                  name={pending.supplierName}
                  loading={isSupplierLoading}
                  onChange={(code, name) => {
                    setPendingField("supplierCode", code);
                    setPendingField("supplierName", name);
                  }}
                />
              </FloatLabel>
            </div>

            <div className="field-row" style={row2}>
              <FloatLabel label="Product From" bgColor={BG}>
                <SearchField
                  options={productRows.map(p => ({ code: p.PROD_CODE, name: p.PROD_NAME }))}
                  code={pending.productFrom}
                  name={pending.productFromName}
                  loading={isProductLoading}
                  onChange={(code, name) => {
                    setPendingField("productFrom", code);
                    setPendingField("productFromName", name);
                  }}
                  placeholder="All"
                />
              </FloatLabel>
              <FloatLabel label="Product To" bgColor={BG}>
                <SearchField
                  options={productRows.map(p => ({ code: p.PROD_CODE, name: p.PROD_NAME }))}
                  code={pending.productTo}
                  name={pending.productToName}
                  loading={isProductLoading}
                  onChange={(code, name) => {
                    setPendingField("productTo", code);
                    setPendingField("productToName", name);
                  }}
                  placeholder="All"
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
                  if (reportWindowRef.current && !reportWindowRef.current.closed) {
                    reportWindowRef.current.focus();
                  } else {
                    setError("Report tab is closed. Please generate again.");
                  }
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
              className="action-btn-excel"
              onClick={handleExcel}
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
              <Download size={13} /> Excel
            </button>

            <button
              className="action-btn-excel"
              onClick={handlePrint}
              disabled={loading || !hasGenerated}
              style={{
                padding: "7px 16px",
                border: "0.5px solid #d1d5db",
                background: "#fff",
                cursor:
                  loading || !hasGenerated ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                borderRadius: 6,
                opacity: !hasGenerated ? 0.5 : 1,
              }}
            >
              <Printer size={13} /> Print
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