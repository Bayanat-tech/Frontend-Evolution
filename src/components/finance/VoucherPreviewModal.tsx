import React, { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { NewReportDialog } from "../new_report_format";
import { openDocumentReportv1 } from "../../api/transactions";

export const TRANSACTION_DOC_ROUTES: Record<string, string> = {
  BP: "/workspace/finance/finance/accounts/transactions/cheque-payment",
  BR: "/workspace/finance/finance/accounts/transactions/cheque-receipt",
  CP: "/workspace/finance/finance/accounts/transactions/petty_cash_payment",
  CR: "/workspace/finance/finance/accounts/transactions/cash-receipt",
  JV: "/workspace/finance/finance/accounts/transactions/jv",
  EJV: "/workspace/finance/finance/accounts/transactions/ejv",
  RJV: "/workspace/finance/finance/accounts/transactions/reverse_jv",
  PJV: "/workspace/finance/finance/accounts/transactions/provisional_jv",
  DN: "/workspace/finance/finance/accounts/transactions/debit-note",
  CN: "/workspace/finance/finance/accounts/transactions/credit-note",
  PI: "/workspace/finance/finance/accounts/transactions/purchase",
  SI: "/workspace/finance/finance/accounts/transactions/sales",
  SV: "/workspace/finance/finance/accounts/transactions/service_invoice",
  PO: "/workspace/finance/finance/accounts/transactions/lpo",
};

export function openTransactionScreen(docType: string, docNo: string) {
  if (!docNo) return;
  const upper = String(docType || "").toUpperCase();
  const targetRoute = TRANSACTION_DOC_ROUTES[upper];
  const url = targetRoute
    ? `${targetRoute}?doc_no=${encodeURIComponent(docNo)}`
    : `/api/finance/transactions/report/${encodeURIComponent(upper)}/${encodeURIComponent(docNo)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export interface VoucherPreviewModalProps {
  open: boolean;
  onClose: () => void;
  docType?: string | null;
  docNo?: string | null;
  title?: string;
}

export function VoucherPreviewModal({
  open,
  onClose,
  docType,
  docNo,
  title,
}: VoucherPreviewModalProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanDocType = String(docType || "").toUpperCase();
  const cleanDocNo = String(docNo || "").trim();

  useEffect(() => {
    if (!open || !cleanDocType || !cleanDocNo) {
      setHtml(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    openDocumentReportv1(cleanDocType, cleanDocNo)
      .then((data) => {
        if (!isMounted) return;
        setHtml(data);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("Failed to load voucher preview:", err);
        setError(err?.message || "Failed to load voucher preview");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, cleanDocType, cleanDocNo]);

  const dialogTitle =
    title ||
    `Voucher Preview — ${cleanDocType} ${cleanDocNo}`;

  const headerSlot = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        background: "#f0fdf4",
        borderBottom: "1px solid #bbf7d0",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 4,
            background: "#dcfce7",
            border: "1px solid #86efac",
            fontWeight: 700,
            fontSize: 11,
            color: "#15803d",
            letterSpacing: "0.02em",
          }}
        >
          <ShieldCheck size={13} />
          AUDIT VIEW (READ-ONLY)
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b" }}>
          Official Voucher: <strong>{cleanDocType} {cleanDocNo}</strong> · Verified against General Ledger
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => openTransactionScreen(cleanDocType, cleanDocNo)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 6,
            background: "#0b4ca1",
            color: "#ffffff",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            transition: "background 0.15s ease",
          }}
          title={`Open ${cleanDocType} ${cleanDocNo} in operational screen to edit or post`}
        >
          <ExternalLink size={14} />
          Open in Screen
        </button>
      </div>
    </div>
  );

  return (
    <NewReportDialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      htmlContent={html}
      loading={loading}
      error={error}
      zIndex={1150}
      onExportExcel={
        cleanDocType && cleanDocNo
          ? () => {
              window.open(
                `/api/finance/transactions/report/${encodeURIComponent(cleanDocType)}/${encodeURIComponent(cleanDocNo)}/excel`,
                "_blank"
              );
            }
          : undefined
      }
      headerSlot={headerSlot}
    />
  );
}

export default VoucherPreviewModal;
