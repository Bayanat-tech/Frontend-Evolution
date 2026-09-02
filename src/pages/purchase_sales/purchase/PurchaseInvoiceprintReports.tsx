"use client";

import React, { useMemo, useState } from "react";
import { FileText, Printer, X } from "lucide-react";
import { PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";
import { formatAmount } from "./Purchaseorderutils";

// The 3 report types available in the dropdown.
type PrintReportType = "PI" | "PI_TAX" | "ACCOUNT";

const REPORT_OPTIONS: { displayValue: string; dataValue: PrintReportType }[] = [
  { displayValue: "Purchase Invoice", dataValue: "PI" },
  { displayValue: "Purchase Invoice Tax", dataValue: "PI_TAX" },
  { displayValue: "Account Details", dataValue: "ACCOUNT" },
];

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

// ─── Shared styles — same design system as PrRegisterOldPage ───────────────

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
          name="pi-print-type"
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

export function PurchaseInvoicePrintDialog({
  open,
  onClose,
  form,
  rows,
  defaultReportType = "PI",
}: {
  open: boolean;
  onClose: () => void;
  form: PurchaseOrderForm;
  rows: PurchaseOrderLineRow[];
  defaultReportType?: PrintReportType;
}) {
  const [reportType, setReportType] = useState<PrintReportType>(defaultReportType);

  const totals = useMemo(() => {
    const rowsAny = rows as unknown as Record<string, number>[];
    const amount = rowsAny.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const discount = rowsAny.reduce((sum, r) => sum + (Number(r.disc_price) || 0), 0);
    const tax = rowsAny.reduce((sum, r) => sum + (Number(r.tax_amount) || 0), 0);
    return { amount, discount, tax, net: amount - discount + tax };
  }, [rows]);

  if (!open) return null;

  const handlePrint = () => window.print();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16,
      fontFamily: "system-ui, sans-serif",
    }}>
      <style>{`
        .pi-print-select:hover { border-color: #185FA5 !important; }
        .pi-print-btn-primary:hover { background: #12457f !important; }
        .pi-print-btn-outline:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
        @media print {
          body * { visibility: hidden; }
          #pi-print-area, #pi-print-area * { visibility: visible; }
          #pi-print-area { position: absolute; inset: 0; width: 100%; }
          .pi-print-no-print { display: none !important; }
        }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column",
        overflow: "hidden", background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Card header */}
        <div className="pi-print-no-print" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={17} color="#185FA5" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Print Preview {form.doc_no ? `— ${form.doc_no}` : ""}
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
          <div id="pi-print-area">

            {/* Field-row: header details, same look as PrRegisterOldPage filter row */}
            <div style={{ background: BG, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <FloatLabel label="Doc No" bgColor={BG}>
                    <div style={readOnlyBoxStyle}>{form.doc_no || form.pi_doc_no || "—"}</div>
                  </FloatLabel>
                </div>
                <div style={{ minWidth: 0 }}>
                  <FloatLabel label="Date" bgColor={BG}>
                    <div style={readOnlyBoxStyle}>{formatDate(form.doc_date || form.pi_doc_date) || "—"}</div>
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

              <div style={{ marginTop: 12 }} className="pi-print-no-print">
                <FloatLabel label="Print Type" bgColor={BG}>
                  <div style={{ border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", boxSizing: "border-box" }}>
                    <RadioGroup value={reportType} onChange={(v) => setReportType(v as PrintReportType)} options={REPORT_OPTIONS} />
                  </div>
                </FloatLabel>
              </div>
            </div>

            {/* Content field-row, title reflects the selected dropdown option */}
            <div style={{ background: BG, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
              <FloatLabel label={REPORT_OPTIONS.find((o) => o.dataValue === reportType)?.displayValue || ""} bgColor={BG}>
                <div style={{ ...inputStyle, minHeight: 40, display: "flex", alignItems: "center" }}>

                  {reportType === "PI" && (
                    <span style={{ fontWeight: 600 }}>Net Amount: {formatAmount(totals.net)}</span>
                  )}

                  {reportType === "PI_TAX" && (
                    <span style={{ fontWeight: 600 }}>Total Tax: {formatAmount(totals.tax)}</span>
                  )}

                  {reportType === "ACCOUNT" && (
                    <span style={{ fontWeight: 600 }}>
                      {form.ac_code || "—"} · {form.div_code || "—"} · {form.curr_code || "—"}
                    </span>
                  )}
                </div>
              </FloatLabel>

              {reportType === "PI_TAX" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>#</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>Item</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>Taxable Amt</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>Tax Category</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>Tax Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const r = row as unknown as Record<string, unknown>;
                      return (
                        <tr key={row.id}>
                          <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", textAlign: "center", background: "#fff" }}>{index + 1}</td>
                          <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{String(r.item_name ?? r.item_code ?? "")}</td>
                          <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", textAlign: "right", background: "#fff" }}>{String(r.amount ?? "")}</td>
                          <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{String(r.tax_cat ?? "")}</td>
                          <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", textAlign: "right", background: "#fff" }}>{String(r.tax_amount ?? "")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {reportType === "ACCOUNT" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", fontWeight: 600, background: "#fff" }}>A/c Code</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{form.ac_code || ""}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", fontWeight: 600, background: "#fff" }}>A/c Name</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{form.ac_name || ""}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", fontWeight: 600, background: "#fff" }}>Division</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{form.div_code || ""}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", fontWeight: 600, background: "#fff" }}>Currency</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{form.curr_code || ""}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", fontWeight: 600, background: "#fff" }}>Credit Period</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "4px 6px", background: "#fff" }}>{form.po_credit_period ?? ""}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <div className="pi-print-no-print" style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, marginLeft: 4 }}>
              Switch "Print Type" to preview a different report before printing.
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="pi-print-no-print" style={{
          display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px",
          borderTop: "0.5px solid #e5e7eb",
        }}>
          <button onClick={onClose} className="pi-print-btn-outline" style={{
            padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151",
          }}>
            <X size={13} /> Close
          </button>
          <button onClick={handlePrint} className="pi-print-btn-primary" style={{
            padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff",
            transition: "background 0.2s",
          }}>
            <Printer size={13} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}