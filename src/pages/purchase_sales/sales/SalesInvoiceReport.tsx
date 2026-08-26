import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useAuth } from "../../../state/AuthContext";

export type SalesInvoiceReportParams = {
  company_code?: string;
  doc_no: string;
  doc_type?: string;
};

/**
 * Fetch Sales Invoice HTML report.
 * Backend: POST /api/reports/sales/SINVOICE
 */
export async function fetchSalesInvoiceHtml(
  params: SalesInvoiceReportParams,
): Promise<string> {
  const { data } = await api.post<string>(
    "/api/purchase-sales/reports/sales/SINVOICE",
    {
      company_code: params.company_code,
      doc_no: params.doc_no,
      doc_type: params.doc_type || "SINVOICE",
    },
    {
      responseType: "text",
    },
  );
  return data;
}

/** Safely read a response header as string */
function getHeader(
  headers: Record<string, unknown> | undefined,
  name: string,
): string {
  if (!headers) return "";
  const raw =
    (headers as any)[name] ??
    (headers as any)[name.toLowerCase()] ??
    (headers as any)[name.toUpperCase()];

  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  if (raw == null) return "";
  return String(raw);
}

/**
 * Download Sales Invoice Excel.
 * Backend: POST /api/reports/sales/SINVOICE/excel
 */
export async function downloadSalesInvoiceExcel(
  params: SalesInvoiceReportParams,
): Promise<void> {
  const response = await api.post(
    "/api/purchase-sales/reports/sales/SINVOICE/excel",
    {
      company_code: params.company_code,
      doc_no: params.doc_no,
      doc_type: params.doc_type || "SINVOICE",
    },
    {
      responseType: "blob",
    },
  );

  const disposition = getHeader(response.headers as any, "content-disposition");
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `sinvoice_${params.doc_no}.xlsx`;

  const contentType =
    getHeader(response.headers as any, "content-type") ||
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const blob = new Blob([response.data], { type: contentType });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Props = {
  required_values: {
    doc_no: string;
    company_code?: string;
    doc_type?: string;
  };
};

export function SalesInvoiceReport({ required_values }: Props) {
  const { user } = useAuth();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!required_values?.doc_no) return;

      setLoading(true);
      setError("");
      try {
        const text = await fetchSalesInvoiceHtml({
          company_code: required_values.company_code || user?.company_code,
          doc_no: required_values.doc_no,
          doc_type: required_values.doc_type || "SINVOICE",
        });
        if (!cancelled) setHtml(text);
      } catch (e: any) {
        if (!cancelled) {
          const msg =
            e?.response?.data?.message ||
            e?.message ||
            "Unable to load invoice report";
          setError(typeof msg === "string" ? msg : "Unable to load invoice report");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    required_values?.doc_no,
    required_values?.company_code,
    required_values?.doc_type,
    user?.company_code,
  ]);

  if (loading) {
    return (
      <div className="grid h-full min-h-[400px] place-items-center text-sm text-muted-foreground">
        Loading invoice report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-full min-h-[400px] place-items-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <iframe
      title="report"
      srcDoc={html}
      className="h-full w-full min-h-[70vh] rounded border bg-white"
    />
  );
}