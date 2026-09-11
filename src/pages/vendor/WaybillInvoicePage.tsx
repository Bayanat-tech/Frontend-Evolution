import { FileText, LoaderCircle, ScanLine, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
import { recognize } from "tesseract.js";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import { getWaybillRequests, saveWaybillRequest, type WaybillRequest } from "../../api/vendor";
import { VendorPageHeader } from "./components";
import type { Notice } from "./vendorTypes";

const emptyWaybill: WaybillRequest = {
  waybill_load_number: "",
  destination_name: "",
  scheduled_vehicle: "",
  pickup_date: "",
  vendor_name: "",
  rig_id: "",
};

const fieldLabels: Array<[keyof WaybillRequest, string]> = [
  ["waybill_load_number", "Waybill # / Load number"],
  ["destination_name", "Destination name"],
  ["scheduled_vehicle", "Scheduled vehicle"],
  ["pickup_date", "Pickup date"],
  ["vendor_name", "Vendor name"],
  ["rig_id", "Rig ID"],
];

function normalizeOcrText(text: string) {
  return text.replace(/\r/g, "\n").replace(/[|]/g, "I").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

function extractValue(text: string, labels: string[]) {
  const normalized = normalizeOcrText(text);
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|");
  const match = normalized.match(new RegExp(`(?:${escaped})\\s*[:#-]?\\s*([^\\n\\r]+)`, "i"));
  return match?.[1]?.trim().replace(/\s{2,}/g, " ") || "";
}

function extractFromLines(text: string, labels: string[]) {
  const lines = normalizeOcrText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const labelPattern = new RegExp(labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|"), "i");
  const index = lines.findIndex((line) => labelPattern.test(line));
  if (index < 0) return "";
  return lines[index].replace(labelPattern, "").replace(/^[\s:#-]+/, "").trim() || lines[index + 1] || "";
}

function extractWaybillFields(text: string): WaybillRequest {
  const field = (labels: string[]) => extractValue(text, labels) || extractFromLines(text, labels);
  const exact = (pattern: RegExp) => text.match(pattern)?.[1]?.trim().replace(/\s{2,}/g, " ") || "";
  const waybillNumber =
    exact(/(?:Waybill\s*#?\s*|Load\s*Number\s*:\s*)([A-Z0-9-]+)(?:\s|$)/im) ||
    exact(/(?:Waybill\s*#?\s*)\r?\n\s*([A-Z0-9-]+)/im);
  const destination =
    exact(/Destination\s+Name\s*:\s*([^\r\n]+)/i) ||
    exact(/Destination\s+Name\s*:?\s*\r?\n\s*([^\r\n]+)/i);
  const scheduledVehicle =
    exact(/Scheduled\s+Vehicle\s*:\s*([A-Z0-9/ -]+)/i) ||
    exact(/Reported\s+Vehicle\s*:\s*Scheduled\s+Vehicle\s*:\s*([A-Z0-9/ -]+)/i);
  const pickupDate = exact(/Pickup\s+Date\s*:\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4}(?:\s+[0-9:.]+)?)/i);
  const vendor = exact(/Vendor\s+Name\s*:\s*([^\r\n]+)/i);
  const rig = exact(/Rig\s+ID\s*:\s*([^\r\n]+?)(?=\s+Remarks\b|$)/i);
  return {
    waybill_load_number: waybillNumber || field(["waybill", "load number", "load no", "load #"]),
    destination_name: destination || field(["destination name", "delivery location"]),
    scheduled_vehicle: scheduledVehicle || field(["scheduled vehicle", "vehicle no", "vehicle number"]),
    pickup_date: pickupDate || field(["pickup date", "pick up date", "pick-up date"]),
    vendor_name: vendor || field(["vendor name", "contractor", "supplier"]),
    rig_id: rig || field(["rig id", "rig no", "rig number"]),
    raw_text: text,
  };
}

async function readWaybill(file: File, onProgress: (message: string) => void) {
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const textParts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare the PDF page for OCR.");
    await page.render({ canvasContext: context, viewport }).promise;
    const originalCanvas = document.createElement("canvas");
    originalCanvas.width = canvas.width;
    originalCanvas.height = canvas.height;
    originalCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const gray = Math.round(image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114);
      const enhanced = gray > 180 ? 255 : gray < 90 ? 0 : gray;
      image.data[index] = enhanced;
      image.data[index + 1] = enhanced;
      image.data[index + 2] = enhanced;
    }
    context.putImageData(image, 0, 0);
    onProgress(`Reading page ${pageNumber} of ${pdf.numPages}...`);
    const originalResult = await recognize(originalCanvas, "eng", {
      logger: (message) => {
        if (message.status && message.progress !== undefined) {
          onProgress(`OCR original: ${message.status} ${Math.round(message.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: "11",
      preserve_interword_spaces: "1",
    });
    const enhancedResult = await recognize(canvas, "eng", {
      logger: (message) => {
        if (message.status && message.progress !== undefined) {
          onProgress(`${message.status} ${Math.round(message.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });
    const candidates = [originalResult.data.text, enhancedResult.data.text];
    textParts.push(candidates.sort((left, right) => right.length - left.length)[0]);
  }
  return textParts.join("\n");
}

export function WaybillInvoicePage() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<WaybillRequest>(emptyWaybill);
  const [rows, setRows] = useState<WaybillRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [progress, setProgress] = useState("");

  const loadRows = async () => {
    setLoading(true);
    try {
      setRows(await getWaybillRequests());
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load waybills." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  const update = (key: keyof WaybillRequest, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setNotice({ type: "error", message: "Please select a scanned PDF waybill." });
      return;
    }
    setNotice(null);
    setLoading(true);
    try {
      const rawText = await readWaybill(file, setProgress);
      const extracted = extractWaybillFields(rawText);
      const hasFields = fieldLabels.some(([key]) => String(extracted[key] || "").trim());
      setDraft({
        ...emptyWaybill,
        ...extracted,
        waybill_load_number: extracted.waybill_load_number || file.name.match(/\d{6,}/)?.[0] || "",
        file_name: file.name,
      });
      setNotice({
        type: hasFields ? "success" : "error",
        message: hasFields
          ? "OCR complete. Verify the extracted values before saving."
          : "OCR completed, but no recognizable waybill labels were found. Review the OCR text below or use a clearer scan.",
      });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to read this PDF." });
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const save = async () => {
    const missing = fieldLabels.filter(([key]) => !String(draft[key] || "").trim());
    if (missing.length) {
      setNotice({ type: "error", message: `Complete: ${missing.map(([, label]) => label).join(", ")}.` });
      return;
    }
    setLoading(true);
    try {
      await saveWaybillRequest({ ...draft, company_code: user?.company_code } as WaybillRequest);
      setDraft(emptyWaybill);
      setNotice({ type: "success", message: "Waybill saved for invoice verification." });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save waybill." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-4">
      <VendorPageHeader
        title="Waybill invoice reader"
        description="Upload a Cuetrans waybill PDF, extract the standard fields with OCR, verify them, and save the raw billing record."
        actions={<Button onClick={() => inputRef.current?.click()} disabled={loading}><UploadCloud size={15} /> Read waybill PDF</Button>}
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <input ref={inputRef} hidden type="file" accept="application/pdf" onChange={(event) => void handleFile(event.target.files?.[0])} />
      {progress && <div className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="animate-spin" size={14} /> {progress}</div>}
      {draft.raw_text && (
        <Card>
          <CardHeader><div className="text-sm font-semibold">OCR text detected</div></CardHeader>
          <CardContent>
            <textarea
              className="min-h-32 w-full rounded-md border bg-background p-2 font-mono text-xs"
              value={String(draft.raw_text)}
              readOnly
              aria-label="OCR text detected from uploaded PDF"
            />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader><div className="flex items-center gap-2 font-semibold"><ScanLine size={16} /> Review extracted fields</div></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {fieldLabels.map(([key, label]) => (
              <label key={key} className="grid gap-1 text-sm">
                <span className="font-medium text-muted-foreground">{label} *</span>
                <Input value={String(draft[key] || "")} onChange={(event) => update(key, event.target.value)} />
              </label>
            ))}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(emptyWaybill)}>Clear</Button>
              <Button onClick={() => void save()} disabled={loading}><FileText size={15} /> Save waybill</Button>
            </div>
          </CardContent>
        </Card>
        <DataTable
          columns={fieldLabels.map(([key, label]) => ({ accessorKey: key, header: label }))}
          data={rows}
          loading={loading}
          density="grid"
          height={420}
          minWidth={980}
          emptyText="No waybills saved yet"
          enableExport
          exportFilename="waybill-invoices.csv"
        />
      </div>
    </section>
  );
}
