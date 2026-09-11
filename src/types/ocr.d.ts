declare module "tesseract.js" {
  export function recognize(
    image: unknown,
    language: string,
    options?: {
      logger?: (message: { status?: string; progress?: number }) => void;
      tessedit_pageseg_mode?: string;
      preserve_interword_spaces?: string;
    },
  ): Promise<{ data: { text: string } }>;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: { data: ArrayBuffer }): { promise: Promise<{
    numPages: number;
    getPage(pageNumber: number): Promise<{
      getViewport(options: { scale: number }): { width: number; height: number };
      render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
    }>;
  }> };
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const workerSrc: string;
  export default workerSrc;
}
