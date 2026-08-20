import { Plus, Trash2, Save, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { executeDynamicMutation, getDynamicLookupaccount } from "../../api/lookups";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import { upsertMfBomApi, TMfBomRowPayload } from "../../api/purchaseSales";

// ════════════════════════════════════════════════════════════════════════
// SCREEN — PS_ProductBomPage — maintains the MF_BOM table (per manager's
// Main SQL): COMPANY_CODE, PRIN_CODE, PROD_CODE (parent), CHILD_PROD_CODE,
// P_UOM, P_QTY, L_UOM, L_QTY, USER_ID, USER_DT, QUANTITY, UPPP, BOM_TYPE,
// UNIT_PRICE, PRODN_REQD, PROD_LUOM_QTY.
//
// Header: Principal (required) -> Parent Product (scoped to Principal,
// legacy dropdown restricted this to CO_PACK = 'Y' products). The screen
// previously called this field "Co-packing Product" — renamed to "Parent
// Product" here since that's what it actually is (case 'p_2'/'prod_code'
// in the legacy dw code), and it's what's stored in MF_BOM.PROD_CODE.
//
// Grid: one row per MF_BOM record (Child Product Code, P_UOM/P_QTY,
// L_UOM/L_QTY, Quantity, UPPP, BOM_TYPE, Unit Price, MIS Reqd =
// PRODN_REQD, Parent Prodn LUOM QTY = PROD_LUOM_QTY). USER_ID/USER_DT are
// audit columns, not editable — not shown here.
//
// Legacy 'cbx_1' co-pack-view toggle: no UI control maps to it currently.
// Hardcoded to 'N' (non-co-pack view) everywhere below. Add a checkbox and
// wire it through if the co-pack view is actually needed.
//
// BOM_TYPE: no UI input for this — line.bom_type stays "" and is still sent
// in the Save payload to keep the backend contract unchanged.
//
// Child/Parent Product Code selection: LookupField's onChange is assumed
// to pass the selected row as an optional second argument (value, row).
// If your LookupField implementation only passes value, add a row
// parameter to its onChange signature so the Name field (and
// principal/parent product names) can auto-fill from the selected
// row — see onChange handlers below.
//
// Retrieve: still goes through getDynamicLookupaccount /
// PURCHASE_SALE_MF_BOM_RETRIEVE — no other backend file was shared for
// that route, so it's untouched.
//
// Delete: rows loaded from Retrieve are marked is_persisted = true. When
// such a row is removed, we call executeDynamicMutation with
// PURCHASE_SALE_MF_BOM_DELETE (wired to a WHEN branch in
// PROC_BUILD_DYNAMIC_DEL_PURCHASE_SALE) before removing it from local
// state. Brand-new rows (is_persisted = false) are just spliced out
// locally, since they were never saved to MF_BOM. Also untouched — no
// backend file shared for this route either.
//
// Save: wired to the real PROC_INS_UPD_MF_BOM endpoint via upsertMfBomApi
// (defined above). That proc takes an array of MF_BOM rows in one call
// (all rows must share COMPANY_CODE/PRIN_CODE/PROD_CODE, which the
// backend validates), so this replaces the old per-line
// executeDynamicMutation loop with a single request carrying every line.
// ───────────────────────────────────────────────────────────────────────

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
  row_id: string; // client-side key for React list rendering, not sent to server
  child_prod_code: string;
  name: string; // display-only, not a real MF_BOM column
  p_uom: string;
  p_qty: string;
  l_uom: string;
  l_qty: string;
  quantity: string;
  uppp: string;
  bom_type: string;
  unit_price: string;
  prodn_reqd: boolean; // "MIS Reqd" in the screenshot
  prod_luom_qty: string; // "Parent Prodn LUOM QTY" in the screenshot
  is_persisted: boolean; // true if this row already exists in MF_BOM (came from Retrieve)
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

// ─── LookupField configs — wired to the real procs added to
// PROC_BUILD_DYNAMIC_SQL_PURCHASE_SALE. ──────────────────────────────────

const PRINCIPAL_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_PRINCIPAL";
const PRINCIPAL_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "prin_code", header: "Principal Code" },
  { field: "prin_name", header: "Principal Name" },
];

const PARENT_PRODUCT_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_PARENT_PRODCODE";
const PARENT_PRODUCT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "prod_code", header: "Product Code" },
  { field: "prod_name", header: "Product Name" },
];

const CHILD_PRODUCT_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_CHILD_PRODCODE";
const CHILD_PRODUCT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "prod_code", header: "Product Code" },
  { field: "prod_name", header: "Product Name" },
];
const CHILD_PRODUCT_DISPLAY_FIELDS = ["prod_code", "prod_name"]; // renders as "CODE - NAME", same as Principal/Parent Product

const UOM_LOOKUP_PARAMETER = "PURCHASE_SALE_MF_BOM_UOM";
const UOM_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "uom_code", header: "UoM Code" },
  { field: "uom_name", header: "UoM Name" },
];

const RETRIEVE_PARAMETER = "PURCHASE_SALE_MF_BOM_RETRIEVE";

// Delete — wired to PURCHASE_SALE_MF_BOM_DELETE in
// PROC_BUILD_DYNAMIC_DEL_PURCHASE_SALE via executeDynamicMutation.
// Slot mapping: val1s1=company_code, val1s2=prin_code,
// val1s3=parent prod_code, val1s4=child_prod_code (key columns of MF_BOM).
const DELETE_PARAMETER = "PURCHASE_SALE_MF_BOM_DELETE";

export function PS_ProductBomPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [header, setHeader] = useState<TBomHeader>({ ...EMPTY_HEADER });
  const [lines, setLines] = useState<TBomLine[]>([makeEmptyLine()]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const setHeaderField = (field: keyof TBomHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const setLineField = (rowId: string, field: keyof TBomLine, value: unknown) =>
    setLines((prev) =>
      prev.map((line) => (line.row_id === rowId ? { ...line, [field]: value } : line)),
    );

  const addLine = () => setLines((prev) => [...prev, makeEmptyLine()]);

  // ── Remove a line. Rows that already exist in MF_BOM (is_persisted)
  // are deleted server-side first; brand-new unsaved rows are just
  // dropped from local state.
  const removeLine = async (rowId: string) => {
    if (lines.length <= 1) return;
    const line = lines.find((l) => l.row_id === rowId);
    if (!line) return;

    if (line.is_persisted) {
      setDeletingRowId(rowId);
      setNotice(null);
      try {
        await executeDynamicMutation({
          parameter: DELETE_PARAMETER,
          loginid,
          val1s1: companyCode,
          val1s2: header.principal_code,
          val1s3: header.parent_product_code,
          val1s4: line.child_prod_code,
        });
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to delete BOM line",
        });
        setDeletingRowId(null);
        return; // keep the row in the UI if the server delete failed
      }
      setDeletingRowId(null);
    }

    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.row_id !== rowId) : prev));
  };

  // ── Generic lookup loader — shared for every non-parameterized dropdown.
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

  // Parent Product lookup — scoped to Principal (P_CODE2), co-pack view
  // flag hardcoded (P_CODE4). See COPACK_VIEW_FLAG note above.
  const loadParentProductRows = useCallback(
    () =>
      header.principal_code
        ? loadLookupRows(PARENT_PRODUCT_LOOKUP_PARAMETER, header.principal_code, "NULL", COPACK_VIEW_FLAG)
        : Promise.resolve([]),
    [loadLookupRows, header.principal_code],
  );

  // Child Product lookup — scoped to Principal (P_CODE2), excludes the
  // header's Parent Product (P_CODE3), co-pack view flag hardcoded (P_CODE4).
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

  // ── Retrieve — load existing MF_BOM lines for Principal + Parent Product.
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

  // ── Save — wired to PROC_INS_UPD_MF_BOM via upsertMfBomApi (defined
  // above). The proc validates every row shares the same
  // COMPANY_CODE/PRIN_CODE/PROD_CODE, so all lines go in one call instead
  // of the old per-line executeDynamicMutation loop.
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

      // Rows saved successfully are now persisted server-side.
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
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Product BOM</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Maintain a principal's product bill of materials.
          </p>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="rounded-md border bg-card p-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-1.5 min-w-0" key="principal">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Principal:</span>
            <div className="min-w-0 flex-1">
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
                  // Principal changed — Parent Product no longer valid for it.
                  setHeaderField("parent_product_code", "");
                  setHeaderField("parent_product_name", "");
                }}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="parent_product">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Co-packing Product:</span>
            <div className="min-w-0 flex-1">
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
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t pt-2">
          <Button size="sm" variant="secondary" disabled={loading} onClick={handleRetrieve}>
            <RefreshCw size={13} /> {loading ? "Retrieving..." : "Retrieve"}
          </Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save size={13} /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Line-item grid (editable — one row per MF_BOM record) ──────── */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2 w-10">No.</th>
              <th className="p-2 min-w-[240px]">
                Product Code<span className="text-destructive">*</span>
              </th>
              <th className="p-2 min-w-[130px]">
                Parent Prodn LUOM QTY<span className="text-destructive">*</span>
              </th>
              <th className="p-2 w-24 text-center">MIS Reqd</th>
              <th className="p-2 min-w-[100px]">
                Quantity 1<span className="text-destructive">*</span>
              </th>
              <th className="p-2 min-w-[100px]">PUOM</th>
              <th className="p-2 min-w-[100px]">Quantity 2</th>
              <th className="p-2 min-w-[100px]">LUOM</th>
              <th className="p-2 min-w-[90px]">UPPP</th>
              <th className="p-2 min-w-[110px]">Unit Price</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.row_id} className="border-b">
                <td className="p-2 text-muted-foreground">{index + 1}</td>
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
                      // Still tracked for the Retrieve/Save payload, just no longer its own column.
                      setLineField(line.row_id, "name", row?.prod_name ? String(row.prod_name) : "");
                    }}
                    placeholder="Code or name"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    className="h-7 text-sm px-2"
                    value={line.prod_luom_qty}
                    onChange={(e) => setLineField(line.row_id, "prod_luom_qty", e.target.value)}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={line.prodn_reqd}
                    onChange={(e) => setLineField(line.row_id, "prodn_reqd", e.target.checked)}
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    className="h-7 text-sm px-2"
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
                    className="h-7 text-sm px-2"
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
                    className="h-7 text-sm px-2"
                    value={line.uppp}
                    onChange={(e) => setLineField(line.row_id, "uppp", e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    className="h-7 text-sm px-2"
                    value={line.unit_price}
                    onChange={(e) => setLineField(line.row_id, "unit_price", e.target.value)}
                  />
                </td>
                <td className="p-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeLine(line.row_id)}
                    disabled={deletingRowId === line.row_id}
                    className="text-destructive hover:opacity-70 disabled:opacity-40"
                    aria-label="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between p-2">
          <Button size="sm" variant="secondary" onClick={addLine}>
            <Plus size={13} /> Add Row
          </Button>
          <span className="text-sm text-muted-foreground">Total: {lines.length} rows</span>
        </div>
      </div>
    </section>
  );
}