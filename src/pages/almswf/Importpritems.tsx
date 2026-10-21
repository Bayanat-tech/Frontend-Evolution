import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Paperclip,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { DataTable } from "../../components/ui/DataTable";
import type { ColumnDef } from "@tanstack/react-table";

type AnyRow = Record<string, any>;

export type PrImportRow = {
  prodCode: string;
  qtyPuom: number;
  qtyLuom: number;
  rate: number;
  capex: "Y" | "N";
  supplierCode: string;
};

interface ImportPrItemsProps {
  productCodes: AnyRow[];
  supplierList: AnyRow[];
  /** Product codes already present in the document lines */
  existingCodes: string[];
  /** Supplier users (ESHRAQ / SHAHAB) must give SUPPLIER_CODE */
  requireSupplier: boolean;
  /** Level-1 users must give a quantity > 0 */
  requireQty: boolean;
  onImport: (rows: PrImportRow[]) => void;
  onClose: () => void;
}

type PreviewRow = {
  srno: number;
  prodCode: string;
  prodName: string;
  puom: string;
  luom: string;
  qtyPuom: string;
  qtyLuom: string;
  qty: string;
  rate: string;
  capex: string;
  supplierCode: string;
  error: string;
  parsed?: PrImportRow;
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normKey(k: string): string {
  return String(k || "")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .trim()
    .toUpperCase();
}

function normalizeRow(row: AnyRow): AnyRow {
  const out: AnyRow = {};
  Object.keys(row || {}).forEach((k) => {
    out[normKey(k)] = row[k];
  });
  return out;
}

function getVal(row: AnyRow, keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function cleanCode(v: unknown): string {
  return text(v).replace(/\.0+$/, "").toUpperCase();
}

/** blank -> 0, valid number -> number, invalid -> null */
function parseNum(raw: string): number | null {
  if (!raw) return 0;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmt3(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const KEYS_PROD = ["PROD_CODE", "PRODUCT_CODE", "ITEM_CODE", "PRODUCT", "PRODCODE"];
const KEYS_PQTY = ["QTY_PUOM", "PUOM_QTY", "PQTY", "PRIMARY_QTY", "QTY"];
const KEYS_LQTY = ["QTY_LUOM", "LUOM_QTY", "LQTY", "LOOSE_QTY"];
const KEYS_RATE = ["UNIT_PRICE", "ITEM_RATE", "RATE", "PRICE"];
const KEYS_CAPEX = ["CAPEX", "CAPEX_Y_N", "IS_CAPEX"];
const KEYS_SUPPLIER = ["SUPPLIER_CODE", "SUPPLIER", "SUPPLIERCODE", "AC_CODE"];

const MAX_ROWS = 500;

// ═════════════════════════════════════════════════════════
const ImportPrItems: React.FC<ImportPrItemsProps> = ({
  productCodes,
  supplierList,
  existingCodes,
  requireSupplier,
  requireQty,
  onImport,
  onClose,
}) => {
  const [rawRows, setRawRows] = useState<AnyRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const productMap = useMemo(() => {
    const m = new Map<string, AnyRow>();
    productCodes.forEach((p) => m.set(cleanCode(p.PROD_CODE), p));
    return m;
  }, [productCodes]);

  const supplierMap = useMemo(() => {
    const m = new Map<string, AnyRow>();
    supplierList.forEach((s) => m.set(cleanCode(s.SUPPLIER_CODE), s));
    return m;
  }, [supplierList]);

  const existingSet = useMemo(
    () => new Set(existingCodes.map((c) => cleanCode(c)).filter(Boolean)),
    [existingCodes]
  );

  // ─────────────────────────────────────────────────────
  // Validation (staging preview)
  // ─────────────────────────────────────────────────────
  const preview = useMemo<PreviewRow[]>(() => {
    const seen = new Set<string>();
    const out: PreviewRow[] = [];

    rawRows.forEach((r, idx) => {
      const prodCode = cleanCode(getVal(r, KEYS_PROD));
      const pqRaw = getVal(r, KEYS_PQTY);
      const lqRaw = getVal(r, KEYS_LQTY);
      const rateRaw = getVal(r, KEYS_RATE);
      const capexRaw = getVal(r, KEYS_CAPEX);
      const supRaw = cleanCode(getVal(r, KEYS_SUPPLIER));

      if (!prodCode && !pqRaw && !lqRaw && !rateRaw && !capexRaw && !supRaw) return;

      const errors: string[] = [];
      const prod = prodCode ? productMap.get(prodCode) : undefined;

      if (!prodCode) errors.push("Product code is required");
      else if (!prod) errors.push(`Product ${prodCode} not found in product master`);

      if (prodCode) {
        if (seen.has(prodCode)) errors.push("Duplicate product in file");
        seen.add(prodCode);
        if (existingSet.has(prodCode)) errors.push("Product already added in this document");
      }

      const puom = text(prod?.P_UOM);
      const luom = text(prod?.L_UOM);
      const sameUom = !!puom && puom.toUpperCase() === luom.toUpperCase();
      const uppp = Number(prod?.UPPP) || 0;

      const qtyPuom = parseNum(pqRaw);
      const qtyLuomParsed = parseNum(lqRaw);
      if (qtyPuom === null) errors.push("QTY_PUOM is not a valid number");
      if (!sameUom && qtyLuomParsed === null) errors.push("QTY_LUOM is not a valid number");
      const qtyLuom = sameUom ? 0 : qtyLuomParsed ?? 0;

      const qty = sameUom ? qtyPuom ?? 0 : (qtyPuom ?? 0) * uppp + qtyLuom;
      if (requireQty && qty <= 0 && qtyPuom !== null) {
        errors.push("Quantity must be greater than 0");
      }

      let rate: number | null;
      if (rateRaw) {
        rate = parseNum(rateRaw);
        if (rate === null) errors.push("UNIT_PRICE is not a valid number");
      } else {
        rate = Number(prod?.BASE_PRICE) || 0;
      }
      if (rate !== null && rate <= 0) errors.push("Unit price must be greater than 0");

      let capex: "Y" | "N" | "" = "";
      const cx = capexRaw.toUpperCase();
      if (cx === "Y" || cx === "YES") capex = "Y";
      else if (cx === "N" || cx === "NO") capex = "N";
      else errors.push("CAPEX is required (Y / N)");

      let supplierCode = "";
      if (requireSupplier) {
        if (!supRaw) errors.push("Supplier code is required");
        else if (!supplierMap.get(supRaw)) errors.push(`Supplier ${supRaw} not found`);
        else supplierCode = supRaw;
      }

      const row: PreviewRow = {
        srno: idx + 1,
        prodCode,
        prodName: text(prod?.PROD_NAME),
        puom,
        luom,
        qtyPuom: pqRaw,
        qtyLuom: sameUom ? "" : lqRaw,
        qty: fmt3(qty),
        rate: rate === null ? rateRaw : fmt3(rate),
        capex: capex || capexRaw,
        supplierCode: requireSupplier ? supplierCode || supRaw : "",
        error: errors.join(". "),
      };

      if (errors.length === 0 && capex && rate !== null && qtyPuom !== null) {
        row.parsed = {
          prodCode: text(prod?.PROD_CODE),
          qtyPuom,
          qtyLuom,
          rate,
          capex,
          supplierCode,
        };
      }
      out.push(row);
    });

    return out;
  }, [rawRows, productMap, supplierMap, existingSet, requireSupplier, requireQty]);

  const validRows = preview.filter((r) => !r.error);
  const invalidRows = preview.filter((r) => r.error);
  const hasErrors = invalidRows.length > 0;

  // ─────────────────────────────────────────────────────
  // File select
  // ─────────────────────────────────────────────────────
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setFileName(file.name);
    setRawRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as AnyRow[];

        if (json.length === 0) {
          setUploadError("Excel file is empty");
          return;
        }
        if (json.length > MAX_ROWS) {
          setUploadError(`File has more than ${MAX_ROWS} rows.`);
          return;
        }

        const normalized = json.map(normalizeRow);
        const first = normalized[0] ?? {};
        const hasProd = KEYS_PROD.some((k) => k in first);
        if (!hasProd) {
          setUploadError(
            "Required column missing. Please use the template: PROD_CODE, QTY_PUOM, QTY_LUOM, UNIT_PRICE, CAPEX" +
              (requireSupplier ? ", SUPPLIER_CODE." : ".")
          );
          return;
        }

        setRawRows(normalized);
        setNotice({
          type: "info",
          message: `${normalized.length} rows loaded from "${file.name}". Review the status below.`,
        });
      } catch (err: any) {
        setUploadError("Failed to parse Excel file: " + (err?.message || err));
      }
    };
    reader.onerror = () => setUploadError("Failed to read file");
    reader.readAsArrayBuffer(file);
  };

  const handleReset = () => {
    setRawRows([]);
    setFileName("");
    setUploadError(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─────────────────────────────────────────────────────
  // Add valid lines to the document
  // ─────────────────────────────────────────────────────
  const handleAddValid = () => {
    if (validRows.length === 0) {
      setUploadError("No valid records to add.");
      return;
    }
    const rows = validRows.map((r) => r.parsed!).filter(Boolean);
    onImport(rows);
    onClose();
  };

  // ─────────────────────────────────────────────────────
  // Template
  // ─────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    try {
      const sample: Record<string, string> = {
        PROD_CODE: "",
        QTY_PUOM: "",
        QTY_LUOM: "",
        UNIT_PRICE: "",
        CAPEX: "",
      };
      if (requireSupplier) sample.SUPPLIER_CODE = "";

      const ws = XLSX.utils.json_to_sheet([sample]);
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      const yellowStyle = {
        fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
        font: { bold: true, color: { rgb: "000000" } },
      };
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[cellRef]) (ws[cellRef] as any).s = yellowStyle;
      }
      ws["!cols"] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 10 },
        ...(requireSupplier ? [{ wch: 18 }] : []),
      ];

      // Reference sheet with the product master
      const refRows = productCodes.map((p) => ({
        PROD_CODE: text(p.PROD_CODE),
        PROD_NAME: text(p.PROD_NAME),
        P_UOM: text(p.P_UOM),
        L_UOM: text(p.L_UOM),
        UPPP: Number(p.UPPP) || 0,
        BASE_PRICE: Number(p.BASE_PRICE) || 0,
      }));
      const wsRef = XLSX.utils.json_to_sheet(
        refRows.length > 0
          ? refRows
          : [{ PROD_CODE: "", PROD_NAME: "", P_UOM: "", L_UOM: "", UPPP: 0, BASE_PRICE: 0 }]
      );
      wsRef["!cols"] = [{ wch: 18 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PR_Items");
      XLSX.utils.book_append_sheet(wb, wsRef, "Products");
      XLSX.writeFile(wb, "PR_Items_Template.xlsx");

      setNotice({ type: "success", message: "Template downloaded." });
    } catch (err: any) {
      setUploadError("Failed to generate template: " + (err?.message || err));
    }
  };

  // ─────────────────────────────────────────────────────
  // Columns
  // ─────────────────────────────────────────────────────
  const columns: ColumnDef<PreviewRow>[] = [
    {
      accessorKey: "error",
      header: "Status",
      size: 300,
      cell: ({ row }) => {
        const error = row.original.error;
        if (error) {
          return (
            <div className="flex items-start gap-2 text-red-600">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              <span className="text-xs font-medium leading-snug whitespace-normal">{error}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Valid</span>
          </div>
        );
      },
    },
    { accessorKey: "srno", header: "Row", size: 60 },
    { accessorKey: "prodCode", header: "Product Code", size: 130 },
    { accessorKey: "prodName", header: "Product Name", size: 260 },
    { accessorKey: "puom", header: "PUOM", size: 70 },
    { accessorKey: "qtyPuom", header: "PQTY", size: 80 },
    { accessorKey: "luom", header: "LUOM", size: 70 },
    { accessorKey: "qtyLuom", header: "LQTY", size: 80 },
    { accessorKey: "qty", header: "Req Qty", size: 100 },
    { accessorKey: "rate", header: "Unit Price", size: 100 },
    { accessorKey: "capex", header: "CAPEX", size: 80 },
    ...(requireSupplier
      ? [{ accessorKey: "supplierCode", header: "Supplier", size: 120 } as ColumnDef<PreviewRow>]
      : []),
  ];

  const hasFile = rawRows.length > 0;

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <FileSpreadsheet size={18} />
          </span>
          <div>
            <h3 className="m-0 text-sm font-semibold">
              {hasFile ? "Review Import" : "PR Items Excel Import"}
            </h3>
            <p className="m-0 text-xs text-muted-foreground">
              {hasFile
                ? `${preview.length} record${preview.length === 1 ? "" : "s"} · Review before adding`
                : fileName
                  ? `Selected: ${fileName}`
                  : "Upload an Excel file to add item lines in bulk"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
            <Download size={15} /> Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Paperclip size={15} /> {hasFile ? "Select Another" : "Select Excel"}
          </Button>
          {hasFile && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <Trash2 size={15} /> Discard
            </Button>
          )}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {!hasFile && (
        <div className="grid min-h-[220px] place-items-center rounded-md border border-dashed bg-secondary/20 p-8 text-center">
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary">
              <Upload size={20} />
            </div>
            <h3 className="m-0 text-base font-semibold">Upload Item Lines</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Columns required:{" "}
              <strong>
                PROD_CODE, QTY_PUOM, QTY_LUOM, UNIT_PRICE, CAPEX
                {requireSupplier ? ", SUPPLIER_CODE" : ""}
              </strong>
              . Download the template for reference.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              <strong>Note:</strong> CAPEX must be <strong>Y</strong> or <strong>N</strong>. UNIT_PRICE is
              optional — the product base price is used when it is blank.
            </p>
          </div>
        </div>
      )}

      {hasFile && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
            <div className="flex gap-6">
              <div>
                <span className="text-xs text-muted-foreground">Total</span>
                <p className="m-0 text-2xl font-bold text-foreground">{preview.length}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Valid</span>
                <p className="m-0 text-2xl font-bold text-green-600">{validRows.length}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Invalid</span>
                <p className="m-0 text-2xl font-bold text-red-600">{invalidRows.length}</p>
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={preview}
            title="Import Preview"
            subtitle="Review and validate before adding"
            searchPlaceholder="Search records..."
            loading={false}
            height={380}
            minWidth={1100}
            density="grid"
            enablePagination
            pageSize={50}
            getRowId={(row, i) => `${row.srno}_${i}`}
            rowClassName={(row) =>
              row.error ? "bg-red-50 hover:bg-red-100" : "bg-green-50/30 hover:bg-green-50"
            }
          />
        </div>
      )}

      {uploadError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
            <div className="whitespace-pre-line text-sm text-red-700">{uploadError}</div>
          </div>
        </div>
      )}

      {hasErrors && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-yellow-700" />
            <div className="text-sm text-yellow-800">
              {invalidRows.length} record(s) have validation errors. Please fix the Excel and select it
              again. All errors are shown in the <strong>Status</strong> column above.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
          <Download size={14} /> Download Template
        </Button>

        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={handleAddValid}
            disabled={!hasFile || hasErrors || validRows.length === 0}
            className="gap-2"
          >
            <CheckCircle size={16} />
            Add Valid Lines ({validRows.length})
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportPrItems;