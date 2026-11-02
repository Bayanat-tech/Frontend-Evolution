import { FileText, List, Plus, RefreshCw, RotateCcw, Save, Trash2, X, Building2, LayoutGrid, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import { upsertMfBomApi, TMfBomRowPayload } from "../../api/purchaseSales";
import type { LucideIcon } from "lucide-react";

const COPACK_VIEW_FLAG = "N"; // TODO: no UI control for legacy cbx_1 yet.

type TBomHeader = {
  principal_code: string;
  principal_name: string;
  parent_product_code: string;
  parent_product_name: string;
};

const EMPTY_HEADER: TBomHeader = {
  principal_code: "",
  principal_name: "",
  parent_product_code: "",
  parent_product_name: "",
};

type TBomLine = {
  row_id: string; 
  child_prod_code: string;
  name: string; 
  p_uom: string;
  p_qty: string;
  l_uom: string;
  l_qty: string;
  quantity: string;
  uppp: string;
  bom_type: string;
  unit_price: string;
  prodn_reqd: boolean; 
  prod_luom_qty: string; 
  is_persisted: boolean; 
  [key: string]: unknown;
};

const makeEmptyLine = (): TBomLine => ({
  row_id: crypto.randomUUID(),
  child_prod_code: "",
  name: "",
  p_uom: "",
  p_qty: "",
  l_uom: "",
  l_qty: "",
  quantity: "",
  uppp: "",
  bom_type: "",
  unit_price: "",
  prodn_reqd: false,
  prod_luom_qty: "",
  is_persisted: false,
});

// ─── LookupField configs ──────────────────────────────────
const PRINCIPAL_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_PRINCIPAL";
const PRINCIPAL_LOOKUP_COLUMNS = [
  { field: "prin_code", header: "Principal Code" },
  { field: "prin_name", header: "Principal Name" },
];

const PARENT_PRODUCT_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_PARENT_PRODCODE";
const PARENT_PRODUCT_LOOKUP_COLUMNS = [
  { field: "prod_code", header: "Product Code" },
  { field: "prod_name", header: "Product Name" },
];

const CHILD_PRODUCT_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_CHILD_PRODCODE";
const CHILD_PRODUCT_LOOKUP_COLUMNS = [
  { field: "prod_code", header: "Product Code" },
  { field: "prod_name", header: "Product Name" },
];
const CHILD_PRODUCT_DISPLAY_FIELDS = ["prod_code", "prod_name"]; 

const UOM_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_UOM";
const UOM_LOOKUP_COLUMNS = [
  { field: "uom_code", header: "UoM Code" },
  { field: "uom_name", header: "UoM Name" },
];

const RETRIEVE_PARAMETER = "PURCHASE_SALE_MF_BOM_RETRIEVE";
const DELETE_PARAMETER = "PURCHASE_SALE_MF_BOM_DELETE";

/* ─────────────────────────────────────────────────────────────
   SectionPanel — EXACT Freight structure
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — matches WmsMasterForm / Freight label styling
   ───────────────────────────────────────────────────────────── */
function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

export function PS_ProductBomPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [header, setHeader] = useState<TBomHeader>({ ...EMPTY_HEADER });
  const [lines, setLines] = useState<TBomLine[]>([makeEmptyLine()]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const setHeaderField = (field: keyof TBomHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const setLineField = (rowId: string, field: keyof TBomLine, value: unknown) =>
    setLines((prev) =>
      prev.map((line) => (line.row_id === rowId ? { ...line, [field]: value } : line)),
    );

  const addLine = () => setLines((prev) => [...prev, makeEmptyLine()]);

  const removeLine = async (rowId: string) => {
    if (lines.length <= 1) return;
    const line = lines.find((l) => l.row_id === rowId);
    if (!line) return;

    if (line.is_persisted) {
      setDeletingRowId(rowId);
      setNotice(null);
      try {
        await executeDynamicDelete({
          parameter: DELETE_PARAMETER,
          loginid,
          code1: companyCode,
          code2: header.principal_code,
          code3: header.parent_product_code,
          code4: line.child_prod_code,
        });
        setNotice({
          type: "success",
          message: `BOM line ${line.child_prod_code} deleted successfully.`,
        });
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to delete BOM line",
        });
        setDeletingRowId(null);
        return; 
      }
      setDeletingRowId(null);
    }

    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.row_id !== rowId) : prev));
  };

  const loadLookupRows = useCallback(
    async (parameter: string, code2 = "NULL", code3 = "NULL", code4 = "NULL", code5 = "NULL"): Promise<LookupRow[]> => {
      if (!companyCode) return [];
      const response = await getDynamicLookupaccount({
        parameter,
        loginid,
        code1: companyCode,
        code2,
        code3,
        code4,
        code5,
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      return Array.isArray(response) ? (response as LookupRow[]) : [];
    },
    [loginid, companyCode],
  );

  const loadParentProductRows = useCallback(
    () =>
      header.principal_code
        ? loadLookupRows(PARENT_PRODUCT_LOOKUP_PARAMETER, header.principal_code, "NULL", COPACK_VIEW_FLAG)
        : Promise.resolve([]),
    [loadLookupRows, header.principal_code],
  );

  const loadChildProductRows = useCallback(
    () =>
      header.principal_code
        ? loadLookupRows(
            CHILD_PRODUCT_LOOKUP_PARAMETER,
            header.principal_code,
            header.parent_product_code || "NULL",
            COPACK_VIEW_FLAG,
          )
        : Promise.resolve([]),
    [loadLookupRows, header.principal_code, header.parent_product_code],
  );

  const handleRetrieve = useCallback(async () => {
    if (!companyCode) return;
    if (!header.principal_code) {
      setNotice({ type: "error", message: "Principal is required" });
      return;
    }
    if (!header.parent_product_code) {
      setNotice({ type: "error", message: "Parent Product is required" });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await getDynamicLookupaccount({
        parameter: RETRIEVE_PARAMETER,
        loginid,
        code1: companyCode,
        code2: header.principal_code || "NULL",
        code3: header.parent_product_code || "NULL",
        code4: "NULL",
        code5: "NULL",
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(response) ? response : [];
      if (list.length === 0) {
        setLines([makeEmptyLine()]);
      } else {
        setLines(
          list.map((row) => ({
            row_id: crypto.randomUUID(),
            child_prod_code: String(row.child_prod_code ?? ""),
            name: String(row.name ?? ""),
            p_uom: String(row.p_uom ?? ""),
            p_qty: String(row.p_qty ?? ""),
            l_uom: String(row.l_uom ?? ""),
            l_qty: String(row.l_qty ?? ""),
            quantity: String(row.quantity ?? ""),
            uppp: String(row.uppp ?? ""),
            bom_type: String(row.bom_type ?? ""),
            unit_price: String(row.unit_price ?? ""),
            prodn_reqd: Boolean(row.prodn_reqd),
            prod_luom_qty: String(row.prod_luom_qty ?? ""),
            is_persisted: true,
          })),
        );
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load BOM data",
      });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode, header.principal_code, header.parent_product_code]);

  const handleSave = async () => {
    if (!companyCode) return;
    if (!header.principal_code) {
      setNotice({ type: "error", message: "Principal is required" });
      return;
    }
    if (!header.parent_product_code) {
      setNotice({ type: "error", message: "Parent Product is required" });
      return;
    }
    const invalidLine = lines.find(
      (l) => !l.child_prod_code || !l.prod_luom_qty || !l.p_qty,
    );
    if (invalidLine) {
      setNotice({
        type: "error",
        message: "Product Code, Parent Prodn LUOM QTY, and Quantity 1 are required on every line",
      });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const today = new Date().toISOString();

      const payload: TMfBomRowPayload[] = lines.map((line) => ({
        company_code: companyCode,
        prin_code: header.principal_code,
        prod_code: header.parent_product_code,
        child_prod_code: line.child_prod_code,
        p_uom: line.p_uom,
        p_qty: Number(line.p_qty) || 0,
        l_uom: line.l_uom,
        l_qty: Number(line.l_qty) || 0,
        user_id: loginid,
        user_dt: today,
        quantity: Number(line.quantity) || 0,
        uppp: Number(line.uppp) || 0,
        bom_type: line.bom_type,
        unit_price: Number(line.unit_price) || 0,
        prnt_p_code: header.parent_product_code,
      }));

      await upsertMfBomApi(payload);

      setLines((prev) => prev.map((l) => ({ ...l, is_persisted: true })));
      setNotice({ type: "success", message: "BOM saved successfully" });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save BOM data",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      
      {/* ── WMS-style Transaction Header ── */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                Product BOM
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                Draft
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleRetrieve}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Retrieving" : "Retrieve"}
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Notifications ── */}
      {notice && (
        <div className={`rounded-md border px-3 py-2 text-sm font-medium ${
          notice.type === "error" 
            ? "border-red-200 bg-red-50 text-red-700" 
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {notice.message}
        </div>
      )}

      {/* ── Main Form Content ── */}
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
          <div className="p-3 grid gap-3">
            
            {/* Header Section */}
            <SectionPanel title="BOM Details" icon={Building2}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                
                <Field label="Principal" required>
                  <LookupField
                    compact
                    value={header.principal_code}
                    columns={PRINCIPAL_LOOKUP_COLUMNS}
                    valueField="prin_code"
                    displayFields={["prin_code", "prin_name"]}
                    loadOptions={() => loadLookupRows(PRINCIPAL_LOOKUP_PARAMETER)}
                    onChange={(value: string, row: LookupRow | null) => {
                      setHeaderField("principal_code", value);
                      setHeaderField("principal_name", row?.prin_name ? String(row.prin_name) : "");
                      setHeaderField("parent_product_code", "");
                      setHeaderField("parent_product_name", "");
                    }}
                    placeholder="Code or name"
                  />
                </Field>

                <Field label="Co-packing Product" required>
                  <LookupField
                    compact
                    disabled={!header.principal_code}
                    value={header.parent_product_code}
                    columns={PARENT_PRODUCT_LOOKUP_COLUMNS}
                    valueField="prod_code"
                    displayFields={["prod_code", "prod_name"]}
                    loadOptions={loadParentProductRows}
                    onChange={(value: string, row: LookupRow | null) => {
                      setHeaderField("parent_product_code", value);
                      setHeaderField("parent_product_name", row?.prod_name ? String(row.prod_name) : "");
                    }}
                    placeholder={header.principal_code ? "Code or name" : "Select Principal first"}
                  />
                </Field>

              </div>
            </SectionPanel>

            {/* Line Items Section */}
            <SectionPanel 
              title="Line Items" 
              icon={LayoutGrid}
              actions={
                <Button size="sm" variant="secondary" onClick={addLine} className="h-6 text-[10px] px-2">
                  <Plus size={12} className="mr-1" /> Add Row
                </Button>
              }
            >
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/35 text-left text-[11px] font-semibold text-muted-foreground">
                      <th className="p-2 w-12 text-center">No.</th>
                      <th className="p-2 min-w-[200px]">
                        Product Code <span className="text-destructive">*</span>
                      </th>
                      <th className="p-2 min-w-[130px]">
                        Parent Prodn LUOM QTY <span className="text-destructive">*</span>
                      </th>
                      <th className="p-2 w-20 text-center">MIS Reqd</th>
                      <th className="p-2 min-w-[100px]">
                        Quantity 1 <span className="text-destructive">*</span>
                      </th>
                      <th className="p-2 min-w-[100px]">PUOM <span className="text-destructive">*</span></th>
                      <th className="p-2 min-w-[100px]">Quantity 2</th>
                      <th className="p-2 min-w-[100px]">LUOM <span className="text-destructive">*</span></th>
                      <th className="p-2 min-w-[90px]">UPPP</th>
                      <th className="p-2 min-w-[110px]">Unit Price</th>
                      <th className="p-2 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.row_id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-1 text-center text-muted-foreground text-xs">{index + 1}</td>
                        <td className="p-1">
                          <LookupField
                            compact
                            disabled={!header.principal_code}
                            value={line.child_prod_code}
                            columns={CHILD_PRODUCT_LOOKUP_COLUMNS}
                            valueField="prod_code"
                            displayFields={CHILD_PRODUCT_DISPLAY_FIELDS}
                            loadOptions={loadChildProductRows}
                            onChange={(value: string, row: LookupRow | null) => {
                              setLineField(line.row_id, "child_prod_code", value);
                              setLineField(line.row_id, "name", row?.prod_name ? String(row.prod_name) : "");
                            }}
                            placeholder="Code or name"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs px-2"
                            value={line.prod_luom_qty}
                            onChange={(e) => setLineField(line.row_id, "prod_luom_qty", e.target.value)}
                          />
                        </td>
                        <td className="p-1 text-center">
                          <input
                            type="checkbox"
                            checked={line.prodn_reqd}
                            onChange={(e) => setLineField(line.row_id, "prodn_reqd", e.target.checked)}
                            style={{ accentColor: "#00378C", width: "15px", height: "15px" }}
                            className="cursor-pointer rounded border-slate-400"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs px-2"
                            value={line.p_qty}
                            onChange={(e) => setLineField(line.row_id, "p_qty", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <LookupField
                            compact
                            value={line.p_uom}
                            columns={UOM_LOOKUP_COLUMNS}
                            valueField="uom_code"
                            displayFields={["uom_code"]}
                            loadOptions={() => loadLookupRows(UOM_LOOKUP_PARAMETER)}
                            onChange={(value) => setLineField(line.row_id, "p_uom", value)}
                            placeholder="UoM"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs px-2"
                            value={line.l_qty}
                            onChange={(e) => setLineField(line.row_id, "l_qty", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <LookupField
                            compact
                            value={line.l_uom}
                            columns={UOM_LOOKUP_COLUMNS}
                            valueField="uom_code"
                            displayFields={["uom_code"]}
                            loadOptions={() => loadLookupRows(UOM_LOOKUP_PARAMETER)}
                            onChange={(value) => setLineField(line.row_id, "l_uom", value)}
                            placeholder="UoM"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs px-2"
                            value={line.uppp}
                            onChange={(e) => setLineField(line.row_id, "uppp", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs px-2"
                            value={line.unit_price}
                            onChange={(e) => setLineField(line.row_id, "unit_price", e.target.value)}
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.row_id)}
                            disabled={deletingRowId === line.row_id}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Delete row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                <span>Total: {lines.length} rows</span>
              </div>
            </SectionPanel>

          </div>
        </div>
      </div>
    </section>
  );
}