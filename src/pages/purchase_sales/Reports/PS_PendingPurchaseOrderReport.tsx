import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Check, Eye } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import {
  getDynamicLookupaccount,
  type DynamicQueryParams,
} from "../../../api/lookups";
import { api } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { NewReportDialog } from "../../../components/new_report_format";

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

function uppercaseKeys<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out as T;
}

// ─── Field wrapper (same as PoOrderRegisterPage) ───────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function DateField({ value, onChange, max, min }: { value: string; onChange: (v: string) => void; max?: string; min?: string }) {
  return (
    <input
      type="date"
      className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ─── Generic Search Field (autocomplete), styled like the BISC inputs ──────

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
        className="h-8 w-full rounded-md px-2 text-sm font-medium text-foreground shadow-sm"
        style={{
          border: "1px solid #aebdce",
          background: "#f4f7fb",
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "not-allowed" : "text",
          outline: "none",
          boxSizing: "border-box",
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
            border: "1px solid #aebdce",
            borderRadius: 8,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
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
              color: "#00449b",
              background: !code ? "#f4f7fb" : "transparent",
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
                background: code === s.code ? "#f4f7fb" : "transparent",
              }}
            >
              {code === s.code && <Check size={12} color="#00449b" />}
              {getDisplayText(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const PurchaseOrderReport: React.FC<PurchaseOrderReportProps> = () => {
  const { user } = useAuth();
  const loginid = (user as any)?.loginid ?? "";
  const companyCode: string =
    ((user as any)?.company_code as string)?.trim() || "All";

  const [pending, setPending] = useState<Filters>(buildDefaultFilters());
  const [applied, setApplied] = useState<Filters>(buildDefaultFilters());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Select filters and run the report.");

  // ── Report preview dialog state (backed by NewReportDialog: raw HTML, no blob URL) ──
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportPreviewExporting, setReportPreviewExporting] = useState(false);

  const setPendingField = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setPending((prev) => ({ ...prev, [key]: val }));

  const dateRangeValid = !pending.dateFrom || !pending.dateTo || pending.dateFrom <= pending.dateTo;

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

  // Fetch the report HTML and show it in the local NewReportDialog popup.
  const handleGenerate = async () => {
    if (!dateRangeValid) return;
    setLoading(true);
    setMessage("");
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);

    try {
      const body = buildBody(pending);
      setApplied({ ...pending });

      const res = await api.post("/api/purchase-sales/reports/pending-po/html", body, {
        responseType: "text",
        headers: { Accept: "text/html" },
      });

      const htmlContent = typeof res.data === "string" ? res.data : String(res.data);
      setReportHtml(htmlContent);
      setMessage("Report generated.");
    } catch (e: any) {
      const failure = e?.response?.data?.message || e?.message || "Failed to generate report";
      setReportPreviewError(failure);
      setMessage(failure);
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
  const handleReportPreviewExcel = async () => {
    setReportPreviewExporting(true);
    try {
      const body = buildBody(applied);
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
  };

  function resetFilters() {
    const d = buildDefaultFilters();
    setPending(d);
    setApplied(d);
    setMessage("Select filters and run the report.");
  }

  // Format for document number display
  const formatDocDisplay = (item: { code: string; name: string; extra?: string }) => {
    return `${item.code} | ${item.extra || ''}`;
  };

  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>Pending Purchase Order Report</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={resetFilters} />

        <div className="freight-report-fields grid gap-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Date From">
            <DateField
              value={pending.dateFrom}
              onChange={(v) => setPendingField("dateFrom", v)}
              max={pending.dateTo || undefined}
            />
          </Field>

          <Field label="Date To">
            <DateField
              value={pending.dateTo}
              onChange={(v) => setPendingField("dateTo", v)}
              min={pending.dateFrom || undefined}
            />
          </Field>

          <Field label="Document No">
            <SearchField
              options={docRows.map((d) => ({
                code: d.DOC_NO,
                name: d.DOC_NO,
                extra: d.DOC_TYPE,
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
          </Field>

          <Field label="Supplier">
            <SearchField
              options={supplierRows.map((s) => ({ code: s.AC_CODE, name: s.AC_NAME }))}
              code={pending.supplierCode}
              name={pending.supplierName}
              loading={isSupplierLoading}
              onChange={(code, name) => {
                setPendingField("supplierCode", code);
                setPendingField("supplierName", name);
              }}
            />
          </Field>

          <Field label="Product From">
            <SearchField
              options={productRows.map((p) => ({ code: p.PROD_CODE, name: p.PROD_NAME }))}
              code={pending.productFrom}
              name={pending.productFromName}
              loading={isProductLoading}
              onChange={(code, name) => {
                setPendingField("productFrom", code);
                setPendingField("productFromName", name);
              }}
              placeholder="All"
            />
          </Field>

          <Field label="Product To">
            <SearchField
              options={productRows.map((p) => ({ code: p.PROD_CODE, name: p.PROD_NAME }))}
              code={pending.productTo}
              name={pending.productToName}
              loading={isProductLoading}
              onChange={(code, name) => {
                setPendingField("productTo", code);
                setPendingField("productToName", name);
              }}
              placeholder="All"
            />
          </Field>

          <Field label="Report Criteria">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={pending.reportType}
              onChange={(e) => setPendingField("reportType", e.target.value as ReportCriteria)}
            >
              <option value="Summary">Summary</option>
              <option value="Detail">Detail</option>
            </select>
          </Field>

          <div>
            <Field label="Cancelled PO">
              <div
                className="flex min-h-[36px] items-center gap-2 rounded-md px-3 py-1.5 shadow-sm"
                style={{ border: "1px solid #aebdce", background: "#f4f7fb" }}
              >
                <label
                  onClick={() => setPendingField("cancelledPO", !pending.cancelledPO)}
                  className="inline-flex items-center gap-2 cursor-pointer select-none normal-case whitespace-nowrap"
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded transition-colors"
                    style={{
                      border: `2px solid ${pending.cancelledPO ? "#1d4ed8" : "#9ca3af"}`,
                      background: pending.cancelledPO ? "#1d4ed8" : "transparent",
                    }}
                  >
                    {pending.cancelledPO && <Check size={10} color="#fff" strokeWidth={3} />}
                  </span>
                  <span className={`text-sm font-normal ${pending.cancelledPO ? "text-blue-700" : "text-foreground"}`}>
                    Include Cancelled PO
                  </span>
                </label>
              </div>
            </Field>
          </div>
        </div>

        <div className="freight-report-actions">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !dateRangeValid}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
          </Button>
        </div>
        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title="Pending Purchase Order Report"
        htmlContent={reportHtml}
        loading={loading}
        error={reportPreviewError || null}
        onExportExcel={handleReportPreviewExcel}
        exportingExcel={reportPreviewExporting}
      />
    </section>
  );
};

export default PurchaseOrderReport;