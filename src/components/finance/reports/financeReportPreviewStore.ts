export type FinanceReportDocument = {
  html: string;
  filename?: string;
  orientation?: "portrait" | "landscape";
  excelEndpoint?: string;
  excelPayload?: Record<string, unknown>;
};

export type FinanceReportPreviewState = {
  id: number;
  title: string;
  document?: FinanceReportDocument;
  error?: string;
};

let sequence = 0;
let state: FinanceReportPreviewState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const getFinanceReportPreview = () => state;
export const subscribeFinanceReportPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function closeFinanceReportPreview() { state = null; publish(); }

// A closed or superseded request must never reopen the viewer when its API call finishes.
export function openFinanceReport(title: string) {
  const id = ++sequence;
  state = { id, title };
  publish();
  return {
    ready(document: FinanceReportDocument) {
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
