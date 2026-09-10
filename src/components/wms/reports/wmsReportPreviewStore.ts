export type WmsReportDocument = {
  html: string;
  filename?: string;
  orientation?: "portrait" | "landscape";
  // Backend Excel export — WMS reuses its existing endpoints instead of
  // deriving .xlsx client-side from the rendered HTML.
  excelEndpoint?: string;
  excelPayload?: Record<string, unknown>;
};

export type WmsReportPreviewState = {
  id: number;
  title: string;
  document?: WmsReportDocument;
  error?: string;
};

let sequence = 0;
let state: WmsReportPreviewState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const getWmsReportPreview = () => state;
export const subscribeWmsReportPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function closeWmsReportPreview() { state = null; publish(); }

// A closed or superseded request must never reopen the viewer when its API call finishes.
export function openWmsReport(title: string) {
  const id = ++sequence;
  state = { id, title };
  publish();
  return {
    ready(document: WmsReportDocument) {
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
