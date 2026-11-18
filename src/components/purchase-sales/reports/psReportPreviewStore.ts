export type PsReportDocument = {
  html: string;
  filename?: string;
  orientation?: "portrait" | "landscape";
  excelEndpoint?: string;
  excelPayload?: Record<string, unknown>;
};

export type PsReportPreviewState = {
  id: number;
  title: string;
  document?: PsReportDocument;
  error?: string;
};

let sequence = 0;
let state: PsReportPreviewState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const getPsReportPreview = () => state;
export const subscribePsReportPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function closePsReportPreview() { state = null; publish(); }

// A closed or superseded request must never reopen the viewer when its API call finishes.
export function openPsReport(title: string) {
  const id = ++sequence;
  state = { id, title };
  publish();
  return {
    ready(document: PsReportDocument) {
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
