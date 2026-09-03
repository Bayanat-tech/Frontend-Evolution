"use client";

import React, { useState } from "react";
import { Download, FileText, Loader2, Printer, X } from "lucide-react";
import { PurchaseOrderForm } from "../../purchase_sales/purchase/Purchaseordertypes";
import {
  getSalesInvoiceReportHtml,
  getSalesInvoiceReportExcel,
  getSalesInvoiceTaxReportHtml,
  getSalesInvoiceTaxReportExcel,
  getSalesAccountDetailsReportHtml,
  getSalesAccountDetailsReportExcel,
} from "../../../api/transactions";

// The 3 report types available in the dropdown/radio group.
type SalesPrintReportType = "SI" | "SI_TAX" | "ACCOUNT";

const REPORT_OPTIONS: { displayValue: string; dataValue: SalesPrintReportType }[] = [
  { displayValue: "Sales Invoice", dataValue: "SI" },
  { displayValue: "Sales Invoice Tax", dataValue: "SI_TAX" },
  { displayValue: "Sales Account Details", dataValue: "ACCOUNT" },
];

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

// ─── Shared styles — same design system as PurchaseInvoicePrintDialog ─────

const BG = "#EEF5FD";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  background: "#fff",
  color: "#111827",
  boxSizing: "border-box",
  outline: "none",
};

const readOnlyBoxStyle: React.CSSProperties = {
  ...inputStyle,
  color: "#111827",
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
        position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280",
        background: bgColor, padding: "0 4px", zIndex: 1, textTransform: "uppercase",
        letterSpacing: "0.05em", fontWeight: 500,
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
  <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", padding: "8px 10px" }}>
    {options.map((opt) => (
      <label
        key={opt.dataValue}
        style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        <input
          type="radio"
          name="si-print-type"
          value={opt.dataValue}
          checked={value === opt.dataValue}
          onChange={() => onChange(opt.dataValue)}
          style={{ width: 16, height: 16, margin: 0, accentColor: "#185FA5", cursor: "pointer" }}
        />
        {opt.displayValue}
      </label>
    ))}
  </div>
);

export function SalesInvoicePrintDialog({
  open,
  onClose,
  form,
  companyCode,
  docType,
  defaultReportType = "SI",
}: {
  open: boolean;
  onClose: () => void;
  form: PurchaseOrderForm;
  companyCode: string;
  docType: string;
  defaultReportType?: SalesPrintReportType;
}) {
  const [reportType, setReportType] = useState<SalesPrintReportType>(defaultReportType);
  const [loadingAction, setLoadingAction] = useState<"print" | "excel" | null>(null);
  const [reportError, setReportError] = useState("");

  if (!open) return null;

  const docNo = String(form.doc_no || (form as any).si_doc_no || "");

  const buildApiParams = () => ({
    company_code: companyCode,
    doc_type: docType,
    doc_no: docNo,
  });

  const getHtmlFn = () =>
    reportType === "SI_TAX" ? getSalesInvoiceTaxReportHtml :
    reportType === "ACCOUNT" ? getSalesAccountDetailsReportHtml :
    getSalesInvoiceReportHtml;

  const getExcelFn = () =>
    reportType === "SI_TAX" ? getSalesInvoiceTaxReportExcel :
    reportType === "ACCOUNT" ? getSalesAccountDetailsReportExcel :
    getSalesInvoiceReportExcel;

  const handlePrint = async () => {
    if (!docNo) {
      setReportError("Doc No is missing — cannot fetch the report.");
      return;
    }
    setReportError("");
    setLoadingAction("print");

    const newTab = window.open("", "_blank");
    if (!newTab) {
      setLoadingAction(null);
      setReportError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
      return;
    }
    newTab.document.write("<title>Sales Invoice</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>");

    try {
      const html = await getHtmlFn()(buildApiParams());
      newTab.document.open();
      newTab.document.write(html);
      newTab.document.close();
    } catch (err: any) {
      newTab.document.open();
      newTab.document.write("<title>Sales Invoice</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>");
      newTab.document.close();
      setReportError(err?.message || "Failed to load report.");
    } finally {
      setLoadingAction(null);
    }
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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16,
      fontFamily: "system-ui, sans-serif",
    }}>
      <style>{`
        .si-print-btn-primary:hover { background: #12457f !important; }
        .si-print-btn-outline:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column",
        overflow: "hidden", background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Card header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={17} color="#185FA5" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
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
          {/* Field-row: header details, same look as PurchaseInvoicePrintDialog */}
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
                <div style={{ border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", boxSizing: "border-box" }}>
                  <RadioGroup value={reportType} onChange={(v) => setReportType(v as SalesPrintReportType)} options={REPORT_OPTIONS} />
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px", borderTop: "0.5px solid #e5e7eb" }}>
          <button onClick={onClose} className="si-print-btn-outline" style={{
            padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151",
          }}>
            <X size={13} /> Close
          </button>
          <button
            onClick={handleExcel}
            disabled={loadingAction !== null}
            className="si-print-btn-outline"
            style={{
              padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff",
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
            className="si-print-btn-primary"
            style={{
              padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5",
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
    </div>
  );
}