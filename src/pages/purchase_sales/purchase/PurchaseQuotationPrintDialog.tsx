"use client";

import React, { useState } from "react";
import { Download, FileText, Loader2, Printer, X } from "lucide-react";
import { PurchaseOrderForm } from "./Purchaseordertypes";
import {
  getPurchaseQuotationReportHtml,
  getPurchaseQuotationReportExcel,
  getPurchaseQuotationWithRatesReportHtml,
  getPurchaseQuotationWithRatesReportExcel,
  getPurchaseQuotationCompareReportHtml,
  getPurchaseQuotationCompareReportExcel,
} from "../../../api/transactions";
import { NewReportDialog } from "../../../components/new_report_format";

// The 3 report types available in the dropdown/radio group.
type PurchaseQuotationPrintReportType = "QUOTATION" | "QUOTATION_WITH_RATES" | "COMPARE_QUOTATION";

const REPORT_OPTIONS: { displayValue: string; dataValue: PurchaseQuotationPrintReportType }[] = [
  { displayValue: "Quotation", dataValue: "QUOTATION" },
  { displayValue: "Quotation With Rates", dataValue: "QUOTATION_WITH_RATES" },
  { displayValue: "Compare Quotation", dataValue: "COMPARE_QUOTATION" },
];

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

// ─── Shared styles — BISC blue theme (same palette as PO Order Register) ───

const BORDER = "#aebdce";
const BG = "#f4f7fb";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "8px 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  background: BG,
  color: "#172033",
  boxSizing: "border-box",
  outline: "none",
};

const readOnlyBoxStyle: React.CSSProperties = {
  ...inputStyle,
  color: "#172033",
  fontWeight: 500,
};

function FloatLabel({ label, required, children, bgColor = "#fff" }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  bgColor?: string;
}) {
  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <span style={{
        position: "absolute", top: -8, left: 10, fontSize: 11, color: "#61748d",
        background: bgColor, padding: "0 4px", zIndex: 1, textTransform: "uppercase",
        letterSpacing: "0.05em", fontWeight: 600,
      }}>
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {children}
    </div>
  );
}

const RadioGroup: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { displayValue: string; dataValue: string }[];
}> = ({ value, onChange, options }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "nowrap",
      alignItems: "center",
      gap: 20,
      padding: "8px 10px",
      overflowX: "auto",
    }}
  >
    {options.map((opt) => (
      <label
        key={opt.dataValue}
        onClick={() => onChange(opt.dataValue)}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          fontSize: 12,
          fontWeight: 500,
          color: "#172033",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: "999px",
            border: `2px solid ${value === opt.dataValue ? "#1d4ed8" : "#9ca3af"}`,
            flexShrink: 0,
          }}
        >
          {value === opt.dataValue && (
            <span style={{ width: 8, height: 8, borderRadius: "999px", background: "#1d4ed8" }} />
          )}
        </span>
        <span style={{ color: value === opt.dataValue ? "#1d4ed8" : "#172033" }}>
          {opt.displayValue}
        </span>
      </label>
    ))}
  </div>
);

export function PurchaseQuotationPrintDialog({
  open,
  onClose,
  form,
  companyCode,
  docType,
  defaultReportType = "QUOTATION",
}: {
  open: boolean;
  onClose: () => void;
  form: PurchaseOrderForm;
  companyCode: string;
  docType: string;
  defaultReportType?: PurchaseQuotationPrintReportType;
}) {
  const [reportType, setReportType] = useState<PurchaseQuotationPrintReportType>(defaultReportType);
  const [loadingAction, setLoadingAction] = useState<"print" | "excel" | null>(null);
  const [reportError, setReportError] = useState("");

  // ── Report preview dialog state (backed by NewReportDialog: raw HTML, no blob URL / new tab) ──
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
  const [reportPreviewExporting, setReportPreviewExporting] = useState(false);

  if (!open) return null;

  const docNo = String(form.doc_no || "");

  const buildApiParams = () => ({
    company_code: companyCode,
    doc_type: docType,
    doc_no: docNo,
  });

  const getHtmlFn = () =>
    reportType === "QUOTATION_WITH_RATES" ? getPurchaseQuotationWithRatesReportHtml :
    reportType === "COMPARE_QUOTATION" ? getPurchaseQuotationCompareReportHtml :
    getPurchaseQuotationReportHtml;

  const getExcelFn = () =>
    reportType === "QUOTATION_WITH_RATES" ? getPurchaseQuotationWithRatesReportExcel :
    reportType === "COMPARE_QUOTATION" ? getPurchaseQuotationCompareReportExcel :
    getPurchaseQuotationReportExcel;

  // ── Print now opens the in-app preview dialog instead of a new window ───
  const handlePrint = async () => {
    if (!docNo) {
      setReportError("Doc No is missing — cannot fetch the report.");
      return;
    }
    setReportError("");

    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setReportPreviewLoading(true);
    setLoadingAction("print");

    try {
      const html = await getHtmlFn()(buildApiParams());
      setReportHtml(html);
    } catch (err: any) {
      setReportPreviewError(err?.message || "Failed to load report.");
    } finally {
      setReportPreviewLoading(false);
      setLoadingAction(null);
    }
  };

  const closeReportPreview = () => {
    setReportPreviewOpen(false);
    setReportHtml(null);
    setReportPreviewError("");
  };

  const handleExcel = async () => {
    if (!docNo) {
      setReportError("Doc No is missing — cannot export the report.");
      return;
    }
    setReportError("");
    setLoadingAction("excel");
    try {
      await getExcelFn()(buildApiParams());
    } catch (err: any) {
      setReportError(err?.message || "Excel export failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Excel button inside the report-preview dialog itself
  const handleReportPreviewExcel = async () => {
    if (!docNo) return;
    setReportPreviewExporting(true);
    try {
      await getExcelFn()(buildApiParams());
    } catch (err: any) {
      setReportPreviewError(err?.message || "Excel export failed.");
    } finally {
      setReportPreviewExporting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16,
      fontFamily: "system-ui, sans-serif",
    }}>
      <style>{`
        .pq-print-btn-primary:hover { background: #002e76 !important; }
        .pq-print-btn-outline:hover { background: #EBF4FF !important; border-color: #00449b !important; color: #00449b !important; }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column",
        overflow: "hidden", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Card header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={17} color="#00449b" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#172033" }}>
              Print Preview {docNo ? `— ${docNo}` : ""}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            padding: 6, border: "none", background: "none", color: "#6b7280", cursor: "pointer",
            display: "flex", alignItems: "center",
          }}>
            <X size={17} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflow: "auto", padding: "10px 16px 16px" }}>
          {/* Field-row: header details, same look as SalesInvoicePrintDialog */}
          <div style={{ background: BG, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <FloatLabel label="Doc No" bgColor={BG}>
                  <div style={readOnlyBoxStyle}>{docNo || "—"}</div>
                </FloatLabel>
              </div>
              <div style={{ minWidth: 0 }}>
                <FloatLabel label="Date" bgColor={BG}>
                  <div style={readOnlyBoxStyle}>{formatDate(form.doc_date) || "—"}</div>
                </FloatLabel>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <FloatLabel label="Party" bgColor={BG}>
                <div style={readOnlyBoxStyle}>
                  {form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code || "—"}
                </div>
              </FloatLabel>
            </div>

            <div style={{ marginTop: 12 }}>
              <FloatLabel label="Print Type" bgColor={BG}>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 7, background: "#fff", boxSizing: "border-box" }}>
                  <RadioGroup value={reportType} onChange={(v) => setReportType(v as PurchaseQuotationPrintReportType)} options={REPORT_OPTIONS} />
                </div>
              </FloatLabel>
            </div>
          </div>

          {/* Info line — the real report data comes from the server on Print/Excel click */}
          <div style={{ background: BG, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
            <FloatLabel label="Selected Report" bgColor={BG}>
              <div style={{ ...inputStyle, minHeight: 40, display: "flex", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>
                  {REPORT_OPTIONS.find((o) => o.dataValue === reportType)?.displayValue}
                </span>
              </div>
            </FloatLabel>
          </div>

          {reportError && (
            <div style={{
              marginTop: 10, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 6, color: "#dc2626", fontSize: 12,
            }}>
              {reportError}
            </div>
          )}

          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, marginLeft: 4 }}>
            Choose a "Print Type" above, then use Print or Excel below to fetch the live report for Doc No {docNo || "—"}.
          </div>
        </div>

        {/* Action bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px", borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} className="pq-print-btn-outline" style={{
            padding: "7px 16px", border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151",
          }}>
            <X size={13} /> Close
          </button>
          <button
            onClick={handleExcel}
            disabled={loadingAction !== null}
            className="pq-print-btn-outline"
            style={{
              padding: "7px 16px", border: `1px solid ${BORDER}`, background: "#fff",
              cursor: loadingAction !== null ? "not-allowed" : "pointer", opacity: loadingAction !== null ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151",
            }}
          >
            {loadingAction === "excel" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {loadingAction === "excel" ? "Exporting..." : "Excel"}
          </button>
          <button
            onClick={handlePrint}
            disabled={loadingAction !== null}
            className="pq-print-btn-primary"
            style={{
              padding: "7px 16px", border: "1px solid #00449b", background: "#00449b",
              cursor: loadingAction !== null ? "not-allowed" : "pointer", opacity: loadingAction !== null ? 0.8 : 1,
              display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff",
              transition: "background 0.2s",
            }}
          >
            {loadingAction === "print" ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
            {loadingAction === "print" ? "Opening..." : "Print"}
          </button>
        </div>
      </div>

      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title={`Purchase Quotation ${docNo}`.trim()}
        htmlContent={reportHtml}
        loading={reportPreviewLoading}
        error={reportPreviewError || null}
        onExportExcel={handleReportPreviewExcel}
        exportingExcel={reportPreviewExporting}
      />
    </div>
  );
}