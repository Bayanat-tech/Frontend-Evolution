export type FreightReportDocument = {
  html: string;
  filename?: string;
  orientation?: "portrait" | "landscape";
};

export type ReportPreviewState = {
  id: number;
  title: string;
  document?: FreightReportDocument;
  error?: string;
};

let sequence = 0;
let state: ReportPreviewState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const getReportPreview = () => state;
export const subscribeReportPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function closeReportPreview() { state = null; publish(); }

// A closed or superseded request must never reopen the viewer when its API call finishes.
export function openFreightReport(title: string) {
  const id = ++sequence;
  state = { id, title };
  publish();
  return {
    ready(document: FreightReportDocument) {
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
