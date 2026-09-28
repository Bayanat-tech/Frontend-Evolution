import { FreightReportDocument } from "../../../components/freight/reportPreviewStore";

export type PayslipPreviewState = {
  id: number;
  title: string;
  document?: FreightReportDocument;
  error?: string;
};

let sequence = 0;
let state: PayslipPreviewState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const getPayslipPreview = () => state;
export const subscribePayslipPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function closePayslipPreview() { state = null; publish(); }

export function openPayslipReport(title: string) {
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