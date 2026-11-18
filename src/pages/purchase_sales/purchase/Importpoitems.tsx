import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "../../../components/ui/Button";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { DataTable } from "../../../components/ui/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { PurchaseOrderLineRow } from "./Purchaseordertypes";
import {
    amountBeforeDiscPrice,
    computeQuantity,
    isSameUom,
    lineAmount,
    numberOrZero,
    text,
} from "./Purchaseorderutils";

type AnyRow = Record<string, any>;

interface ImportPoItemsProps {
    companyCode?: string;
    loginid?: string;
    /** Product codes already present in the document lines */
    existingCodes: string[];
    /** Header discount scope - Disc % is only taken from the file when "ITEM" */
    discountScope: string;
    onImport: (rows: Partial<PurchaseOrderLineRow>[]) => void;
    onClose: () => void;
}

type PreviewRow = {
    srno: number;
    zoneCode: string;
    prodCode: string;
    prodName: string;
    puom: string;
    luom: string;
    qtyPuom: string;
    qtyLuom: string;
    qty: string;
    rate: string;
    discPercent: string;
    taxPercent: string;
    error: string;
    parsed?: Partial<PurchaseOrderLineRow>;
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
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

function toList(res: any): AnyRow[] {
    return Array.isArray(res) ? res : res?.data ?? [];
}

const pick = (row: AnyRow, field: string) => text(getLookupValue(row || {}, field));

const KEYS_PROD = ["PROD_CODE", "PRODUCT_CODE", "ITEM_CODE", "PRODUCT", "PRODCODE"];
const KEYS_ZONE = ["ZONE_CODE", "ZONE"];
const KEYS_PQTY = ["QTY_PUOM", "PUOM_QTY", "PQTY", "PRIMARY_QTY", "QTY"];
const KEYS_LQTY = ["QTY_LUOM", "LUOM_QTY", "LQTY", "LOOSE_QTY"];
const KEYS_RATE = ["UNIT_PRICE", "ITEM_RATE", "RATE", "PRICE"];
const KEYS_DISC = ["DISC_PERCENT", "DISC_PERC", "DISC", "DISCOUNT"];
const KEYS_TAX = ["TAX_PERCENT", "TAX_PERC", "TAX", "VAT"];
const KEYS_REMARKS = ["LINE_REMARKS", "REMARKS", "REMARK"];

const MAX_ROWS = 500;

// ═════════════════════════════════════════════════════════
const ImportPoItems: React.FC<ImportPoItemsProps> = ({
    companyCode,
    loginid,
    existingCodes,
    discountScope,
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

    const [productList, setProductList] = useState<AnyRow[]>([]);
    const [zoneList, setZoneList] = useState<AnyRow[]>([]);
    const [masterLoading, setMasterLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Same lookups the table's Product / Zone fields use
    useEffect(() => {
        let alive = true;
        const lid = loginid || "ADMIN";
        Promise.all([
            Promise.resolve(getDynamicLookup({ parameter: "PS_POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: lid })),
            Promise.resolve(getDynamicLookup({ parameter: "PS_POORDER_ENTRY_ZONE_LIST", code1: companyCode, loginid: lid })),
        ])
            .then(([p, z]) => {
                if (!alive) return;
                setProductList(toList(p));
                setZoneList(toList(z));
            })
            .catch(() => {
                if (alive) setUploadError("Failed to load product / zone master.");
            })
            .finally(() => {
                if (alive) setMasterLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [companyCode, loginid]);

    const productMap = useMemo(() => {
        const m = new Map<string, AnyRow>();
        productList.forEach((p) => m.set(cleanCode(pick(p, "prod_code")), p));
        return m;
    }, [productList]);

    const zoneSet = useMemo(() => {
        const s = new Set<string>();
        zoneList.forEach((z) => s.add(cleanCode(pick(z, "zone_code"))));
        return s;
    }, [zoneList]);

    const defaultZone = useMemo(() => (zoneList[0] ? pick(zoneList[0], "zone_code") : ""), [zoneList]);

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
            const zoneRaw = cleanCode(getVal(r, KEYS_ZONE));
            const pqRaw = getVal(r, KEYS_PQTY);
            const lqRaw = getVal(r, KEYS_LQTY);
            const rateRaw = getVal(r, KEYS_RATE);
            const discRaw = getVal(r, KEYS_DISC);
            const taxRaw = getVal(r, KEYS_TAX);
            const remarks = getVal(r, KEYS_REMARKS);

            if (!prodCode && !zoneRaw && !pqRaw && !lqRaw && !rateRaw && !discRaw && !taxRaw && !remarks) return;

            const errors: string[] = [];
            const prod = prodCode ? productMap.get(prodCode) : undefined;

            if (!prodCode) errors.push("Product code is required");
            else if (!prod) errors.push(`Product ${prodCode} not found in product master`);

            if (prodCode) {
                if (seen.has(prodCode)) errors.push("Duplicate product in file");
                seen.add(prodCode);
                if (existingSet.has(prodCode)) errors.push("Product already added in this document");
            }

            // Zone: blank -> default zone, otherwise must exist
            let zoneCode = defaultZone;
            if (zoneRaw) {
                if (!zoneSet.has(zoneRaw)) errors.push(`Zone ${zoneRaw} not found`);
                else zoneCode = zoneRaw;
            }

            const puom = prod ? pick(prod, "p_uom") : "";
            const luom = prod ? pick(prod, "l_uom") : "";
            const uppp = prod ? numberOrZero(getLookupValue(prod, "uppp")) : 0;
            const sameUom = !!puom && puom.toUpperCase() === luom.toUpperCase();

            const qtyPuom = parseNum(pqRaw);
            const qtyLuomParsed = parseNum(lqRaw);
            if (qtyPuom === null) errors.push("QTY_PUOM is not a valid number");
            if (!sameUom && qtyLuomParsed === null) errors.push("QTY_LUOM is not a valid number");
            // same UOM: both fields carry the quantity, same as the table's product onChange
            const qtyLuom = sameUom ? qtyPuom ?? 0 : qtyLuomParsed ?? 0;

            let rate: number | null;
            if (rateRaw) {
                rate = parseNum(rateRaw);
                if (rate === null) errors.push("UNIT_PRICE is not a valid number");
            } else {
                rate = prod ? numberOrZero(getLookupValue(prod, "unit_price")) : 0;
            }
            if (rate !== null && rate <= 0) errors.push("Unit price must be greater than 0");

            let disc = 0;
            if (discRaw && discountScope === "ITEM") {
                const d = parseNum(discRaw);
                if (d === null) errors.push("DISC_PERCENT is not a valid number");
                else if (d < 0 || d > 100) errors.push("DISC_PERCENT must be between 0 and 100");
                else disc = d;
            }

            let tax = 0;
            if (taxRaw) {
                const t = parseNum(taxRaw);
                if (t === null) errors.push("TAX_PERCENT is not a valid number");
                else if (t < 0 || t > 100) errors.push("TAX_PERCENT must be between 0 and 100");
                else tax = t;
            }

            // Build the line exactly the way the table's onChange handlers do
            let patch: Partial<PurchaseOrderLineRow> | undefined;
            let quantity = 0;
            if (prod && qtyPuom !== null && rate !== null) {
                const base = {
                    prod_code: pick(prod, "prod_code"),
                    prod_name: pick(prod, "prod_name"),
                    p_uom: puom,
                    l_uom: luom,
                    uppp,
                    zone_code: zoneCode,
                    qty_puom: qtyPuom,
                    qty_luom: qtyLuom,
                    unit_price: rate,
                    disc_percent: 0,
                    disc_price: 0,
                    tx_compnt_perc_1: 0,
                    tx_compnt_amt_1: 0,
                    line_remarks: remarks,
                } as unknown as PurchaseOrderLineRow;

                quantity = computeQuantity(base);
                const withQty = { ...base, quantity } as PurchaseOrderLineRow;
                const discPrice = amountBeforeDiscPrice(withQty) * (disc / 100);
                const withDisc = { ...withQty, disc_percent: disc, disc_price: discPrice } as PurchaseOrderLineRow;
                const taxAmt = (Number(lineAmount(withDisc)) || 0) * (tax / 100);

                patch = {
                    ...withDisc,
                    tx_compnt_perc_1: tax,
                    tx_compnt_amt_1: taxAmt,
                    tx_compnt_1_expmt: tax > 0 ? "S" : "N",
                };

                if (quantity <= 0) errors.push("Quantity must be greater than 0");
            }

            const row: PreviewRow = {
                srno: idx + 1,
                zoneCode: zoneRaw || zoneCode,
                prodCode,
                prodName: prod ? pick(prod, "prod_name") : "",
                puom,
                luom,
                qtyPuom: pqRaw,
                qtyLuom: sameUom ? "" : lqRaw,
                qty: fmt3(quantity),
                rate: rate === null ? rateRaw : fmt3(rate),
                discPercent: discRaw,
                taxPercent: taxRaw,
                error: errors.join(". "),
            };

            if (errors.length === 0 && patch) row.parsed = patch;
            out.push(row);
        });

        return out;
    }, [rawRows, productMap, zoneSet, defaultZone, existingSet, discountScope]);

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

                const normalized = json
                    .map(normalizeRow)
                    .filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
                if (normalized.length === 0) {
                    setUploadError("No data rows found. Fill in the rows under the headers in the first sheet (row 2 onwards).");
                    return;
                }
                const first = normalized[0] ?? {};
                if (!KEYS_PROD.some((k) => k in first)) {
                    setUploadError(
                        "Required column missing. Please use the template: PROD_CODE, ZONE_CODE, QTY_PUOM, QTY_LUOM, UNIT_PRICE, DISC_PERCENT, TAX_PERCENT, REMARKS."
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
        onImport(validRows.map((r) => r.parsed!).filter(Boolean));
        onClose();
    };

    // ─────────────────────────────────────────────────────
    // Template
    // ─────────────────────────────────────────────────────
    const handleDownloadTemplate = () => {
        try {
            const ws = XLSX.utils.json_to_sheet([
                {
                    PROD_CODE: "",
                    ZONE_CODE: "",
                    QTY_PUOM: "",
                    QTY_LUOM: "",
                    UNIT_PRICE: "",
                    DISC_PERCENT: "",
                    TAX_PERCENT: "",
                    REMARKS: "",
                },
            ]);
            const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
            const yellowStyle = {
                fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
                font: { bold: true, color: { rgb: "000000" } },
            };
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c });
                if (ws[cellRef]) (ws[cellRef] as any).s = yellowStyle;
            }
            ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];

            const refRows = productList.map((p) => ({
                PROD_CODE: pick(p, "prod_code"),
                PROD_NAME: pick(p, "prod_name"),
                P_UOM: pick(p, "p_uom"),
                L_UOM: pick(p, "l_uom"),
                UPPP: numberOrZero(getLookupValue(p, "uppp")),
                UNIT_PRICE: numberOrZero(getLookupValue(p, "unit_price")),
            }));
            const wsRef = XLSX.utils.json_to_sheet(
                refRows.length > 0
                    ? refRows
                    : [{ PROD_CODE: "", PROD_NAME: "", P_UOM: "", L_UOM: "", UPPP: 0, UNIT_PRICE: 0 }]
            );
            wsRef["!cols"] = [{ wch: 18 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];

            const zoneRows = zoneList.map((z) => ({ ZONE_CODE: pick(z, "zone_code"), ZONE_NAME: pick(z, "zone_name") }));
            const wsZone = XLSX.utils.json_to_sheet(zoneRows.length > 0 ? zoneRows : [{ ZONE_CODE: "", ZONE_NAME: "" }]);
            wsZone["!cols"] = [{ wch: 14 }, { wch: 40 }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "PO_Items");
            XLSX.utils.book_append_sheet(wb, wsRef, "Products");
            XLSX.utils.book_append_sheet(wb, wsZone, "Zones");
            XLSX.writeFile(wb, "PO_Items_Template.xlsx");

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
        { accessorKey: "zoneCode", header: "Zone", size: 90 },
        { accessorKey: "prodCode", header: "Product Code", size: 130 },
        { accessorKey: "prodName", header: "Product Name", size: 260 },
        { accessorKey: "puom", header: "PUOM", size: 70 },
        { accessorKey: "qtyPuom", header: "PQTY", size: 80 },
        { accessorKey: "luom", header: "LUOM", size: 70 },
        { accessorKey: "qtyLuom", header: "LQTY", size: 80 },
        { accessorKey: "qty", header: "Net Qty", size: 100 },
        { accessorKey: "rate", header: "Unit Price", size: 100 },
        { accessorKey: "discPercent", header: "Disc %", size: 80 },
        { accessorKey: "taxPercent", header: "Tax %", size: 80 },
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
                        <h3 className="m-0 text-sm font-semibold">{hasFile ? "Review Import" : "PO Items Excel Import"}</h3>
                        <p className="m-0 text-xs text-muted-foreground">
                            {hasFile
                                ? `${preview.length} record${preview.length === 1 ? "" : "s"} · Review before adding`
                                : fileName
                                    ? `Selected: ${fileName}`
                                    : masterLoading
                                        ? "Loading product master..."
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
                    <Button variant="outline" onClick={handleDownloadTemplate} disabled={masterLoading} className="gap-2">
                        <Download size={15} /> Template
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={masterLoading}
                        className="gap-2"
                    >
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
                            Columns: <strong>PROD_CODE, QTY_PUOM, QTY_LUOM</strong> (required) ·{" "}
                            <strong>ZONE_CODE, UNIT_PRICE, DISC_PERCENT, TAX_PERCENT, REMARKS</strong> (optional). Download the
                            template for reference.
                        </p>
                        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                            <strong>Note:</strong> Blank ZONE_CODE uses the default zone. Blank UNIT_PRICE uses the product price.
                            DISC_PERCENT is applied only when discount scope is ITEM.
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
                        minWidth={1200}
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
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={masterLoading} className="gap-2">
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

export default ImportPoItems;