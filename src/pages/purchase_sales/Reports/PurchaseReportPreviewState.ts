export type PurchaseReportDocument = {
  html: string;
  company?: { name: string; address: string[]; logo: string };
  filename?: string;
  orientation?: "portrait" | "landscape";
  onExcel?: () => Promise<void> | void;
   stripChrome?: boolean;   
};

export type PurchaseReportPreviewState = {
  id: number;
  title: string;
  document?: PurchaseReportDocument;
  error?: string;
};

let sequence = 0;
let state: PurchaseReportPreviewState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const getPurchaseReportPreview = () => state;
export const subscribePurchaseReportPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function closePurchaseReportPreview() { state = null; publish(); }

// A closed or superseded request must never reopen the viewer when its API call finishes.
export function openPurchaseReport(title: string) {
  const id = ++sequence;
  state = { id, title };
  publish();
  return {
    ready(document: PurchaseReportDocument) {
      if (state?.id !== id) return;
      state = { id, title, document };
      publish();
    },
    fail(error: unknown) {
      if (state?.id !== id) return;
      state = { id, title, error: error instanceof Error ? error.message : String(error) };
      publish();
    },
  };
}


