"use client";

import React, { useEffect, useState } from "react";
import { Download, FileText, Loader2, Printer, X } from "lucide-react";
import { PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";
import {
  getPurchaseInvoiceReportHtml,
  getPurchaseInvoiceReportExcel,
  getPurchaseInvoiceTaxReportHtml,
  getPurchaseInvoiceTaxReportExcel,
  getPurchaseInvoiceAccountDetailsReportHtml,
  getPurchaseInvoiceAccountDetailsReportExcel,
} from "../../../api/transactions";
import { openPurchaseReport } from "../Reports/PurchaseReportPreviewState";
import { PurchaseReportPreview } from "../Reports/Purchasereportpreview";

// The 3 report types available in the radio group.
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

// ─── Small presentational helpers (BISC royal-blue theme) ───────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function ReadOnlyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs">
      {children}
    </div>
  );
}

export function PurchaseInvoicePrintDialog({
  open,
  onClose,
  form,
  companyCode,
  docType,
  defaultReportType = "PI",
}: {
  open: boolean;
  onClose: () => void;
  form: PurchaseOrderForm;
  rows?: PurchaseOrderLineRow[];
  companyCode: string;
  docType: string;
  defaultReportType?: PrintReportType;
}) {
  const [reportType, setReportType] = useState<PrintReportType>(defaultReportType);
  const [loadingAction, setLoadingAction] = useState<"print" | "excel" | null>(null);
  const [reportError, setReportError] = useState("");

  const busy = loadingAction !== null;

  // Escape closes the dialog (ignored while a request is running)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && loadingAction === null) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, loadingAction]);

  if (!open) return null;

  const docNo = form.doc_no || form.pi_doc_no || "";

  const buildApiParams = () => ({
    company_code: companyCode,
    doc_type: docType,
    doc_no: docNo,
  });

  const getHtmlFn = () =>
    reportType === "PI_TAX" ? getPurchaseInvoiceTaxReportHtml :
      reportType === "ACCOUNT" ? getPurchaseInvoiceAccountDetailsReportHtml :
        getPurchaseInvoiceReportHtml;

  const getExcelFn = () =>
    reportType === "PI_TAX" ? getPurchaseInvoiceTaxReportExcel :
      reportType === "ACCOUNT" ? getPurchaseInvoiceAccountDetailsReportExcel :
        getPurchaseInvoiceReportExcel;

  // ── Print opens the in-app preview dialog instead of a new window ───
  const handlePrint = async () => {
    if (!docNo) {
      setReportError("Doc No is missing — cannot fetch the report.");
      return;
    }
    setReportError("");
    setLoadingAction("print");

    const reportLabel = REPORT_OPTIONS.find((o) => o.dataValue === reportType)?.displayValue || "Purchase Invoice";
    const preview = openPurchaseReport(`${reportLabel} ${docNo}`.trim());

    try {
      const html = await getHtmlFn()(buildApiParams());
      preview.ready({
        html,
        filename: `${reportType.toLowerCase()}_${docNo}_${new Date().toISOString().slice(0, 10)}`,
        orientation: reportType === "PI" ? "portrait" : "landscape",
        onExcel: async () => {
          await getExcelFn()(buildApiParams());
        },
      });
    } catch (err: any) {
      preview.fail(new Error(err?.message || "Failed to load report."));
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
    <>
      {/* Backdrop — click outside closes */}
      <div
        className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[2px] transition-all"
        onClick={() => !busy && onClose()}
      >
        {/* Card */}
        <div
          className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Royal blue header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#00378C] to-[#0c4a9e] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white shadow-xs backdrop-blur-xs">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="m-0 text-base font-semibold leading-tight tracking-tight text-white">
                  Print Preview{docNo ? ` — ${docNo}` : ""}
                </h3>
                <p className="m-0 mt-0.5 text-xs text-blue-100/80">
                  Choose a print type, then print or export to Excel
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Document details strip */}
          <div className="border-b border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Doc No">
                <ReadOnlyBox>{docNo || "—"}</ReadOnlyBox>
              </Field>
              <Field label="Date">
                <ReadOnlyBox>{formatDate(form.doc_date || form.pi_doc_date) || "—"}</ReadOnlyBox>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Party">
                <ReadOnlyBox>
                  {form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code || "—"}
                </ReadOnlyBox>
              </Field>
            </div>
          </div>

          {/* Print type — clickable cards */}
          <div className="overflow-y-auto p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Print Type</div>
            <div role="radiogroup" aria-label="Print type" className="grid gap-2 sm:grid-cols-3">
              {REPORT_OPTIONS.map((opt) => {
                const active = reportType === opt.dataValue;
                return (
                  <button
                    key={opt.dataValue}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={busy}
                    onClick={() => setReportType(opt.dataValue)}
                    className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                      busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    } ${
                      active
                        ? "border-[#00378C] bg-blue-50 text-[#00378C] shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-[#00378C] hover:bg-blue-50/50 hover:shadow-xs"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        active ? "border-[#00378C]" : "border-slate-300 group-hover:border-[#00378C]"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-[#00378C]" />}
                    </span>
                    <span className="min-w-0 leading-tight">{opt.displayValue}</span>
                  </button>
                );
              })}
            </div>

            {reportError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {reportError}
              </div>
            )}

            <p className="m-0 mt-3 text-[11px] text-slate-400">
              The live report for Doc No {docNo || "—"} is fetched from the server when you click Print or Excel.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={13} /> Close
            </button>
            <button
              type="button"
              onClick={handleExcel}
              disabled={busy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#00378C] hover:bg-blue-50 hover:text-[#00378C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "excel" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {loadingAction === "excel" ? "Exporting..." : "Excel"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={busy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#00378C] bg-[#00378C] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#002a6b] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingAction === "print" ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              {loadingAction === "print" ? "Opening..." : "Print"}
            </button>
          </div>
        </div>
      </div>

      {/* Sibling (not a child) of the backdrop, so clicks inside the preview
          never bubble up and close this dialog. */}
      <PurchaseReportPreview />
    </>
  );
}