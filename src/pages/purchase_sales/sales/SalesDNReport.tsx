import { api } from "../../../api/client"; // adjust path if your axios instance lives elsewhere

/**
 * Fetches the Sales Delivery Note report HTML directly (no iframe capture needed —
 * the HTML is fed straight into the common PurchaseReportPreview viewer).
 *
 * params expects:
 *   company_code?: string
 *   doc_type?: string   (default "SDN")
 *   doc_no: string | number
 */
export async function getSalesDNReportHtml(params: {
  company_code?: string;
  doc_type?: string;
  doc_no: string | number;
}): Promise<string> {
  const { data } = await api.post<string>(
    "/api/purchase-sales/reports/sales/SDN",
    {
      company_code: params.company_code,
      doc_type: params.doc_type || "SDN",
      doc_no: params.doc_no,
    },
    {
      // backend returns raw HTML string
      responseType: "text",
      headers: { Accept: "text/html" },
    },
  );

  return typeof data === "string" ? data : String(data ?? "");
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