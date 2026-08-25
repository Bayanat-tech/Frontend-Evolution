import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../../../api/client"; // adjust path if your axios instance lives elsewhere

/**
 * Renders the Sales Delivery Note HTML report inside an iframe.
 * Used by ReportDialogPage — Print looks up iframe[title="report"].
 *
 * required_values expects:
 *   company_code?: string
 *   doc_type?: string   (default "SDN")
 *   doc_no: string
 */
export function SalesDNReport({
  required_values,
}: {
  required_values: {
    company_code?: string;
    doc_type?: string;
    doc_no: string | number;
  };
}) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!required_values?.doc_no) {
        setError("Document number is required");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setHtml("");

      try {
        const { data } = await api.post<string>(
          "/api/purchase-sales/reports/sales/SDN",
          {
            company_code: required_values.company_code,
            doc_type: required_values.doc_type || "SDN",
            doc_no: required_values.doc_no,
          },
          {
            // backend returns raw HTML string
            responseType: "text",
            headers: { Accept: "text/html" },
          },
        );

        if (mounted) setHtml(typeof data === "string" ? data : String(data ?? ""));
      } catch (e: unknown) {
        if (!mounted) return;
        const msg =
          (e as any)?.response?.data?.message ||
          (e instanceof Error ? e.message : "Unable to load Delivery Note report");
        setError(typeof msg === "string" ? msg : "Unable to load Delivery Note report");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [
    required_values?.company_code,
    required_values?.doc_type,
    required_values?.doc_no,
  ]);

  if (loading) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Delivery Note report…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <iframe
      title="report"
      srcDoc={html}
      className="h-full w-full min-h-[420px] rounded border border-slate-200 bg-white"
      sandbox="allow-same-origin allow-modals allow-scripts"
    />
  );
}

/** Trigger Excel download for a Sales Delivery Note via axios. */
export async function downloadSalesDNExcel(params: {
  company_code?: string;
  doc_type?: string;
  doc_no: string | number;
}): Promise<void> {
  const res = await api.post(
    "/api/purchase-sales/reports/sales/SDN/excel",
    {
      company_code: params.company_code,
      doc_type: params.doc_type || "SDN",
      doc_no: params.doc_no,
    },
    {
      responseType: "blob",
    },
  );

  const blob =
    res.data instanceof Blob
      ? res.data
      : new Blob([res.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

  const disposition = res.headers?.["content-disposition"] as string | undefined;
  const filename =
    disposition?.match(/filename="?([^";]+)"?/)?.[1] ||
    `delivery_note_${params.doc_no}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}