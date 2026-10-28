import { useMemo, useRef, useState, useEffect } from "react";
import { Upload, X, Download, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";

// ─── Types ───────────────────────────────────────────────────────────
type Lookup = Record<string, any>[];

type StagedRow = {
  id: string;
  line: number;
  activity: string;
  quantity: string;
  billRate: string;
  costRate: string;
  otherServices: string;
  taxCompCat: string;
  taxCat: string;
  costTaxCompCat: string;
  costTaxCat: string;
};

export type ImportedActivity = {
  act_code: string;
  activity: string;
  quantity: number;
  bill_rate: number;
  cost_rate: number;
  other_services: string;
  TX_COMPNTCAT_CODE_1?: string;
  TX_CAT_CODE?: string;
  TX_COMPNTCAT_CODE_1_COST?: string;
  TX_CAT_CODE_COST?: string;
};

type Validated = {
  row: StagedRow;
  errors: string[];
  result: ImportedActivity | null;
};

// ─── Excel header aliases ──────────────────────────────────────────────
const ALIASES: Record<keyof Omit<StagedRow, "id" | "line">, string[]> = {
  activity: ["activity", "activitycode", "actcode", "activityname", "code"],
  quantity: ["quantity", "qty"],
  billRate: ["billrate", "rate", "bill"],
  costRate: ["costrate", "cost"],
  otherServices: ["otherservices", "description", "desc", "remarks", "otherservice"],
  taxCompCat: ["taxcomponentcategory", "taxcompcat", "taxcomponentcat", "taxcode"],
  taxCat: ["taxcategory", "taxcat"],
  costTaxCompCat: ["costtaxcompcat", "costtaxcomponentcategory", "costtaxcode"],
  costTaxCat: ["costtaxcategory", "costtaxcat"],
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s: unknown) => String(s ?? "").trim();
const num = (s: string) => Number(String(s).replace(/,/g, "").trim());

function pick(raw: Record<string, any>, aliases: string[]): string {
  const map: Record<string, any> = {};
  Object.keys(raw).forEach((k) => (map[norm(k)] = raw[k]));
  for (const a of aliases) {
    if (map[a] !== undefined && clean(map[a]) !== "") return clean(map[a]);
  }
  return "";
}

function findMatch(list: Lookup, input: string, codeField: string, nameField: string) {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  return (
    list.find((r) => String(r[codeField] ?? "").trim().toLowerCase() === t) ||
    list.find((r) => String(r[nameField] ?? "").trim().toLowerCase() === t) ||
    null
  );
}

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`);

// ─── Component ───────────────────────────────────────────────────────
export function ActivityImportDialog({
  open,
  onClose,
  activities,
  taxCompCats,
  taxCats,
  masterLoading,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  activities: Lookup;
  taxCompCats: Lookup;
  taxCats: Lookup;
  masterLoading: boolean;
  onConfirm: (rows: ImportedActivity[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Reset isAdding state when dialog opens
  useEffect(() => {
    if (open) setIsAdding(false);
  }, [open]);

  const reset = () => {
    setStaged([]);
    setFileName("");
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setParseError("");
    setParsing(true);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

      const rows: StagedRow[] = json
        .map((raw, i) => ({
          id: uid(),
          line: i + 2, 
          activity: pick(raw, ALIASES.activity),
          quantity: pick(raw, ALIASES.quantity) || "1",
          billRate: pick(raw, ALIASES.billRate),
          costRate: pick(raw, ALIASES.costRate),
          otherServices: pick(raw, ALIASES.otherServices),
          taxCompCat: pick(raw, ALIASES.taxCompCat) || "0",
          taxCat: pick(raw, ALIASES.taxCat) || "0",
          costTaxCompCat: pick(raw, ALIASES.costTaxCompCat) || "0",
          costTaxCat: pick(raw, ALIASES.costTaxCat) || "0",
        }))
        .filter((r) => r.activity || r.billRate || r.otherServices);

      if (rows.length === 0) {
        setParseError("No data rows found. Expected columns: Activity, Bill Rate, Other Services, Quantity (optional).");
      }
      setStaged(rows);
    } catch (e: any) {
      setParseError(`Could not read file: ${e?.message ?? "unknown error"}`);
      setStaged([]);
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Activity", "Bill Rate", "Other Services", "Quantity", "Tax Component Category", "Tax Category", "Cost Rate"],
      ["SOFTWARE SUPPORT SERVICES", 392955, "ARREARS FOR SOFTWARE SERVICES APRIL-2026", 1, "0", "0", 0],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activities");
    XLSX.writeFile(wb, "activity-billing-template.xlsx");
  };

  const updateRow = (id: string, field: keyof Omit<StagedRow, "id" | "line">, value: string) => {
    setStaged((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const validated: Validated[] = useMemo(() => {
    return staged.map((row) => {
      const errors: string[] = [];

      const act = findMatch(activities, row.activity, "ACTIVITY_CODE", "ACTIVITY");
      if (!row.activity) errors.push("Activity required");
      else if (!act) errors.push(`Activity not found`);

      const qty = num(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) errors.push("Qty > 0 required");

      const bill = num(row.billRate);
      if (row.billRate === "" || !Number.isFinite(bill) || bill < 0) errors.push("Bill rate invalid");

      let cost = 0;
      if (row.costRate !== "" && row.costRate !== "0") {
        cost = num(row.costRate);
        if (!Number.isFinite(cost) || cost < 0) errors.push("Cost rate invalid");
      }

      const tcc = row.taxCompCat && row.taxCompCat !== "0" ? findMatch(taxCompCats, row.taxCompCat, "TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME") : null;
      if (row.taxCompCat && row.taxCompCat !== "0" && !tcc) errors.push(`Tax comp cat not found`);

      const tc = row.taxCat && row.taxCat !== "0" ? findMatch(taxCats, row.taxCat, "TX_CAT_CODE", "TX_CAT_NAME") : null;
      if (row.taxCat && row.taxCat !== "0" && !tc) errors.push(`Tax cat not found`);

      const ctcc = row.costTaxCompCat && row.costTaxCompCat !== "0" ? findMatch(taxCompCats, row.costTaxCompCat, "TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME") : null;
      if (row.costTaxCompCat && row.costTaxCompCat !== "0" && !ctcc) errors.push(`Cost tax comp cat not found`);

      const ctc = row.costTaxCat && row.costTaxCat !== "0" ? findMatch(taxCats, row.costTaxCat, "TX_CAT_CODE", "TX_CAT_NAME") : null;
      if (row.costTaxCat && row.costTaxCat !== "0" && !ctc) errors.push(`Cost tax cat not found`);

      if (errors.length > 0 || !act) return { row, errors, result: null };

      const result: ImportedActivity = {
        act_code: String(act.ACTIVITY_CODE ?? ""),
        activity: String(act.ACTIVITY ?? ""),
        quantity: qty,
        bill_rate: bill,
        cost_rate: cost,
        other_services: row.otherServices,
      };

      if (tcc) result.TX_COMPNTCAT_CODE_1 = String(tcc.TX_COMPNTCAT_CODE);
      else if (row.taxCompCat === "0") result.TX_COMPNTCAT_CODE_1 = "0";

      if (tc) result.TX_CAT_CODE = String(tc.TX_CAT_CODE);
      else if (row.taxCat === "0") result.TX_CAT_CODE = "0";

      if (ctcc) result.TX_COMPNTCAT_CODE_1_COST = String(ctcc.TX_COMPNTCAT_CODE);
      else if (row.costTaxCompCat === "0") result.TX_COMPNTCAT_CODE_1_COST = "0";

      if (ctc) result.TX_CAT_CODE_COST = String(ctc.TX_CAT_CODE);
      else if (row.costTaxCat === "0") result.TX_CAT_CODE_COST = "0";

      return { row, errors, result };
    });
  }, [staged, activities, taxCompCats, taxCats]);

  const validRows = validated.filter((v) => v.result);
  const invalidCount = validated.length - validRows.length;

  const removeRow = (id: string) => setStaged((cur) => cur.filter((r) => r.id !== id));

  const confirm = () => {
    if (isAdding) return; // Prevent double clicks
    setIsAdding(true);
    onConfirm(validRows.map((v) => v.result!));
    reset();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-[2px]">
      <div className="grid w-full max-w-[95vw] max-h-[90vh] grid-rows-[auto_auto_1fr_auto] overflow-hidden rounded-xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Import Activities from Excel</h3>
          <Button size="icon" variant="ghost" onClick={close}>
            <X size={16} />
          </Button>
        </div>

        {/* Upload bar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing || masterLoading}>
            <Upload size={14} /> {parsing ? "Reading..." : "Choose Excel file"}
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadTemplate}>
            <Download size={14} /> Download template
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          <span className="ml-auto text-xs text-muted-foreground">
            Editable preview. You can type manually or search the dropdowns.
          </span>
        </div>

        {/* Preview */}
        <div className="overflow-auto px-5 py-3">
          {parseError && <div className="mb-2 text-sm text-destructive">{parseError}</div>}
          {masterLoading && <div className="mb-2 text-xs text-muted-foreground">Loading master data…</div>}

          {validated.length === 0 && !parseError ? (
            <div className="grid h-40 place-items-center text-sm text-muted-foreground">
              Upload a file to preview rows before adding them to the table.
            </div>
          ) : (
            validated.length > 0 && (
              <div className="min-w-[1400px]">
                <table className="w-full border-collapse text-sm whitespace-nowrap">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-16">Sr No</th>
                      <th className="px-2 py-1.5 text-left w-[250px]">Activity</th>
                      <th className="w-20 px-2 py-1.5 text-right">Qty</th>
                      <th className="w-28 px-2 py-1.5 text-right">Bill Rate</th>
                      <th className="w-[180px] px-2 py-1.5 text-left">Tax Comp Cat</th>
                      <th className="w-[180px] px-2 py-1.5 text-left">Tax Cat</th>
                      <th className="px-2 py-1.5 text-left min-w-[300px]">Other Services</th>
                      <th className="w-32 px-2 py-1.5 text-left">Status</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {validated.map(({ row, errors, result }, index) => (
                      <tr key={row.id} className={`border-b ${result ? "" : "bg-destructive/5"}`}>
                        <td className="px-2 py-1 text-xs text-muted-foreground">{index + 1}</td>
                        
                        <td className="px-2 py-1">
                          <LookupField
                            compact
                            value={row.activity}
                            displayValue={row.activity}
                            columns={[
                              { field: "ACTIVITY_CODE", header: "Code" },
                              { field: "ACTIVITY", header: "Activity" },
                            ]}
                            valueField="ACTIVITY"
                            displayFields={["ACTIVITY"]}
                            loadOptions={async (query?: string) => {
                              if (!query) return activities;
                              const term = query.toLowerCase();
                              return activities.filter(
                                (r: any) =>
                                  String(r.ACTIVITY_CODE ?? "").toLowerCase().includes(term) ||
                                  String(r.ACTIVITY ?? "").toLowerCase().includes(term)
                              );
                            }}
                            onChange={(_val: any, selectedRow: any) => {
                              updateRow(row.id, "activity", selectedRow ? String(selectedRow.ACTIVITY) : _val);
                            }}
                            placeholder="Type or select..."
                          />
                        </td>

                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="h-8 text-right text-xs"
                            value={row.quantity}
                            onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                          />
                        </td>

                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-8 text-right text-xs"
                            value={row.billRate}
                            onChange={(e) => updateRow(row.id, "billRate", e.target.value)}
                          />
                        </td>

                        <td className="px-2 py-1">
                          <LookupField
                            compact
                            value={row.taxCompCat}
                            displayValue={row.taxCompCat}
                            columns={[
                              { field: "TX_COMPNTCAT_CODE", header: "Code" },
                              { field: "TX_COMPNTCAT_NAME", header: "Name" },
                            ]}
                            valueField="TX_COMPNTCAT_CODE"
                            displayFields={["TX_COMPNTCAT_NAME"]}
                            loadOptions={async (query?: string) => {
                              if (!query) return taxCompCats;
                              const term = query.toLowerCase();
                              return taxCompCats.filter(
                                (r: any) =>
                                  String(r.TX_COMPNTCAT_CODE ?? "").toLowerCase().includes(term) ||
                                  String(r.TX_COMPNTCAT_NAME ?? "").toLowerCase().includes(term)
                              );
                            }}
                            onChange={(_val: any, selectedRow: any) => {
                              updateRow(row.id, "taxCompCat", selectedRow ? String(selectedRow.TX_COMPNTCAT_CODE) : _val);
                            }}
                            placeholder="0 or select..."
                          />
                        </td>

                        <td className="px-2 py-1">
                          <LookupField
                            compact
                            value={row.taxCat}
                            displayValue={row.taxCat}
                            columns={[
                              { field: "TX_CAT_CODE", header: "Code" },
                              { field: "TX_CAT_NAME", header: "Name" },
                            ]}
                            valueField="TX_CAT_CODE"
                            displayFields={["TX_CAT_NAME"]}
                            loadOptions={async (query?: string) => {
                              if (!query) return taxCats;
                              const term = query.toLowerCase();
                              return taxCats.filter(
                                (r: any) =>
                                  String(r.TX_CAT_CODE ?? "").toLowerCase().includes(term) ||
                                  String(r.TX_CAT_NAME ?? "").toLowerCase().includes(term)
                              );
                            }}
                            onChange={(_val: any, selectedRow: any) => {
                              updateRow(row.id, "taxCat", selectedRow ? String(selectedRow.TX_CAT_CODE) : _val);
                            }}
                            placeholder="0 or select..."
                          />
                        </td>

                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={row.otherServices}
                            onChange={(e) => updateRow(row.id, "otherServices", e.target.value)}
                            placeholder="Enter description"
                          />
                        </td>

                        <td className="px-2 py-1 text-xs">
                          {result ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 size={14} /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-start gap-1 text-destructive">
                              <AlertCircle size={14} className="mt-0.5 shrink-0" />
                              <span className="break-words max-w-[200px] whitespace-normal leading-tight">{errors.join("; ")}</span>
                            </span>
                          )}
                        </td>

                        <td className="px-1 py-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeRow(row.id)} title="Remove">
                            <X size={12} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <div className="text-xs text-muted-foreground">
            {validated.length > 0 && (
              <>
                <span className="font-medium text-green-600">{validRows.length} valid</span>
                {invalidCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-destructive">{invalidCount} with errors (will be skipped)</span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirm} disabled={validRows.length === 0 || isAdding}>
              <Plus size={14} className="mr-1" /> Add {validRows.length} row(s) to Table
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}