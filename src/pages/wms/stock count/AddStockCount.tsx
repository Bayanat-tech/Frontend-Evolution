import { Save, X, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { executeWmsInboundSql, getStockCountPrincipals, saveStockCount } from "../../../api/wms";
import type { LookupRow } from "../../../api/lookups";

type TabKey = "info" | "principal";

type PrincipalRow = {
  prin_code: string;
  prin_name: string;
};

interface StockCountFormProps {
  open: boolean;
  mode: "add" | "edit";
  editRowData?: Record<string, unknown> | null;
  onClose: (shouldRefetch?: boolean) => void;
}

function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

function getValue(obj: any, ...keys: string[]) {
  if (!obj) return "";
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined && v !== null) return String(v);
  }
  return "";
}

async function loadLookup(table: string, companyCode: string, columns: string, prinCode?: string): Promise<LookupRow[]> {
  let where = `COMPANY_CODE = '${companyCode.replace(/'/g, "''")}'`;
  if (prinCode) {
    where += ` AND PRIN_CODE = '${prinCode.replace(/'/g, "''")}'`;
  }
  const rows = await executeWmsInboundSql(
    `SELECT ${columns} FROM ${table} WHERE ${where} ORDER BY 1`
  );
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as LookupRow);
}

const emptyForm = {
  prin_code: "",
  master_count_no: "",
  parent_count_no: "",
  count_type: "",
  child_count: "",
  group_from: "",
  group_to: "",
  brand_from: "",
  brand_to: "",
  product_from: "",
  product_to: "",
  site_from: "",
  site_to: "",
  location_from: "",
  location_to: "",
  aisle_from: "",
  aisle_to: "",
  col_from: "",
  col_to: "",
  height_from: "",
  height_to: "",
  counted_by: "",
  remarks: "",
  amls_rep: "",
  amls_rep_designation: "",
  client_rep: "",
  client_rep_designation: "",
};

// Shared compact label style used across the form
const labelCls = "text-[10.5px] font-medium leading-none text-muted-foreground";

export function StockCountForm({ open, mode, editRowData, onClose }: StockCountFormProps) {
  const { user } = useAuth();
  const isAddMode = mode === "add";
  const isEditMode = mode === "edit";

  const [tab, setTab] = useState<TabKey>("info");
  const [form, setForm] = useState({ ...emptyForm });
  const [countNo, setCountNo] = useState(getValue(editRowData, "count_no"));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [prinData, setPrinData] = useState<PrincipalRow[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const companyCode = user?.company_code || "";

  // Prefill form when editing
  useEffect(() => {
    if (!isEditMode || !editRowData) return;
    setForm({
      prin_code: getValue(editRowData, "prin_code"),
      master_count_no: getValue(editRowData, "master_count_no"),
      parent_count_no: getValue(editRowData, "parent_count_no"),
      count_type: getValue(editRowData, "count_type"),
      child_count: getValue(editRowData, "child_count"),
      group_from: getValue(editRowData, "group_from", "prod_group_from"),
      group_to: getValue(editRowData, "group_to", "prod_group_to"),
      brand_from: getValue(editRowData, "brand_from", "prod_brand_from"),
      brand_to: getValue(editRowData, "brand_to", "prod_brand_to"),
      product_from: getValue(editRowData, "product_from", "prod_code_from"),
      product_to: getValue(editRowData, "product_to", "prod_code_to"),
      site_from: getValue(editRowData, "site_from", "site_code_from"),
      site_to: getValue(editRowData, "site_to", "site_code_to"),
      location_from: getValue(editRowData, "location_from", "from_location"),
      location_to: getValue(editRowData, "location_to", "to_location"),
      aisle_from: getValue(editRowData, "aisle_from"),
      aisle_to: getValue(editRowData, "aisle_to"),
      col_from: getValue(editRowData, "col_from"),
      col_to: getValue(editRowData, "col_to"),
      height_from: getValue(editRowData, "height_from"),
      height_to: getValue(editRowData, "height_to"),
      counted_by: getValue(editRowData, "counted_by"),
      remarks: getValue(editRowData, "remarks"),
      amls_rep: getValue(editRowData, "amls_rep"),
      amls_rep_designation: getValue(editRowData, "amls_rep_designation"),
      client_rep: getValue(editRowData, "client_rep"),
      client_rep_designation: getValue(editRowData, "client_rep_designation"),
    });
    setCountNo(getValue(editRowData, "count_no"));
  }, [isEditMode, editRowData]);

  // Load principal detail rows for edit mode
  useEffect(() => {
    const load = async () => {
      if (!isEditMode || !countNo || !companyCode) return;
      try {
        const data = await getStockCountPrincipals(companyCode, countNo);
        setPrinData((data as any[]).map((r) => ({
          prin_code: getValue(r, "prin_code"),
          prin_name: getValue(r, "prin_name"),
        })));
      } catch (error) {
        setNotice({ type: "error", message: "Unable to load principal rows for this count." });
      }
    };
    void load();
  }, [isEditMode, countNo, companyCode]);

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const principalLoader = useMemo(
    () => () => loadLookup("MS_PRINCIPAL", companyCode, "PRIN_CODE, PRIN_NAME"),
    [companyCode]
  );
  const groupLoader = useMemo(
    () => () => loadLookup("MS_PRODGROUP", companyCode, "GROUP_CODE, GROUP_NAME", form.prin_code),
    [companyCode, form.prin_code]
  );
  const brandLoader = useMemo(
    () => () => loadLookup("MS_PRODBRAND", companyCode, "BRAND_CODE, BRAND_NAME", form.prin_code),
    [companyCode, form.prin_code]
  );
  const productLoader = useMemo(
    () => () => loadLookup("MS_PRODUCT", companyCode, "PROD_CODE, PROD_NAME", form.prin_code),
    [companyCode, form.prin_code]
  );
  const siteLoader = useMemo(
    () => () => loadLookup("MS_SITE", companyCode, "SITE_CODE, SITE_NAME"),
    [companyCode]
  );
  const locationLoader = useMemo(
    () => () => loadLookup("MS_LOCATION", companyCode, "LOCATION_CODE"),
    [companyCode]
  );

  const handleSubmit = async () => {
    if (!companyCode) {
      setNotice({ type: "error", message: "Company code not found." });
      return;
    }
    if (!form.prin_code) {
      setNotice({ type: "error", message: "Principal is not selected." });
      return;
    }
    const editCountNo = (countNo || "").trim();
    if (isEditMode && !editCountNo) {
      setNotice({ type: "error", message: "Count No is required in edit mode." });
      return;
    }

    const payloadCountNo = isEditMode ? editCountNo : (isSubmitted ? countNo : "");

    setSaving(true);
    try {
      const headerData = {
        prin_code: form.prin_code,
        master_count_no: form.master_count_no,
        parent_count_no: form.parent_count_no,
        company_code: companyCode,
        count_no: payloadCountNo,
        count_type: form.count_type,
        counted_by: form.counted_by,
        remarks: form.remarks,
        prod_group_from: form.group_from,
        prod_group_to: form.group_to,
        prod_brand_from: form.brand_from,
        prod_brand_to: form.brand_to,
        prod_code_from: form.product_from,
        prod_code_to: form.product_to,
        site_code_from: form.site_from,
        site_code_to: form.site_to,
        from_location: form.location_from,
        to_location: form.location_to,
        aisle_from: form.aisle_from,
        aisle_to: form.aisle_to,
        col_from: form.col_from,
        col_to: form.col_to,
        height_from: form.height_from,
        height_to: form.height_to,
        user_id: user?.loginid,
        count_date: new Date().toISOString(),
        amls_rep: form.amls_rep,
        amls_des: form.amls_rep_designation,
        client_rep: form.client_rep,
        client_des: form.client_rep_designation,
      };

      const detailsData = prinData.map((prin) => ({
        company_code: companyCode,
        count_no: payloadCountNo,
        prin_code: prin.prin_code,
        user_id: user?.loginid,
        user_dt: new Date().toISOString(),
      }));

      const result = await saveStockCount({
        headers: [headerData],
        details: detailsData,
        loginid: user?.loginid || "",
      });

      if (result) {
        if (isAddMode) {
          setIsSubmitted(true);
          if ((result as any)?.count_no) {
            setCountNo((result as any).count_no);
          }
          setTab("principal");
        } else {
          onClose(true);
          return;
        }
      } else {
        setNotice({ type: "error", message: "Failed to save stock count." });
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Error saving stock count." });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      onMouseDown={() => onClose()}
    >
      <div
        className="grid w-[min(97vw,1320px)] max-h-[94vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Stock Count</p>
              <h2 className="m-0 text-base font-bold text-foreground">
                {isEditMode ? `Edit Count: ${countNo}` : isSubmitted ? `Count No: ${countNo}` : "Add Stock Count"}
              </h2>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            onClick={() => onClose()}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b bg-muted/20 px-4 pt-1.5">
          <button
            className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${tab === "info" ? "border border-b-0 bg-card text-primary" : "text-muted-foreground"}`}
            onClick={() => setTab("info")}
          >
            Stock Info
          </button>
          <button
            className={`rounded-t-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${tab === "principal" ? "border border-b-0 bg-card text-primary" : "text-muted-foreground"}`}
            onClick={() => setTab("principal")}
            disabled={isAddMode && !isSubmitted}
          >
            Principal
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto bg-muted/20 p-3">
          <NoticeToast notice={notice} onClose={() => setNotice(null)} />

          {tab === "info" && (
            <div className="grid gap-2.5 text-xs">
              {/* Row 1: Principal + count meta fields all in one row */}
              <div className="grid grid-cols-6 gap-2 items-end">
                <div className="col-span-2">
                  <LookupField
                    label="Principal"
                    value={form.prin_code}
                    valueField="prin_code"
                    displayFields={["prin_code", "prin_name"]}
                    columns={[
                      { field: "prin_code", header: "Principal Code" },
                      { field: "prin_name", header: "Principal Name" },
                    ]}
                    placeholder="Select principal"
                    loadOptions={principalLoader}
                    onChange={(selected) => setForm((prev) => ({
                      ...prev,
                      prin_code: selected,
                      group_from: "",
                      group_to: "",
                      brand_from: "",
                      brand_to: "",
                      product_from: "",
                      product_to: "",
                    }))}
                  />
                </div>
                <label className="grid gap-1">
                  <span className={labelCls}>Master Count No.</span>
                  <Input className="h-8 text-xs" value={form.master_count_no} onChange={(e) => setField("master_count_no", e.target.value)} />
                </label>
                <label className="grid gap-1">
                  <span className={labelCls}>Parent Count No.</span>
                  <Input className="h-8 text-xs" value={form.parent_count_no} onChange={(e) => setField("parent_count_no", e.target.value)} />
                </label>
                <label className="grid gap-1">
                  <span className={labelCls}>Count Type</span>
                  <Input className="h-8 text-xs" value={form.count_type} onChange={(e) => setField("count_type", e.target.value)} />
                </label>
                <label className="grid gap-1">
                  <span className={labelCls}>Child Count</span>
                  <Input className="h-8 text-xs" value={form.child_count} onChange={(e) => setField("child_count", e.target.value)} />
                </label>
              </div>

              {/* Product + Location Preferences side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-card p-2.5">
                  <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Product Preferences</p>
                  <div className="grid grid-cols-2 gap-2">
                    <LookupField label="Group From" value={form.group_from} valueField="group_code" displayFields={["group_code", "group_name"]}
                      columns={[{ field: "group_code", header: "Code" }, { field: "group_name", header: "Name" }]}
                      placeholder={form.prin_code ? undefined : "Select principal first"}
                      loadOptions={groupLoader} onChange={(v) => setField("group_from", v)} />
                    <LookupField label="Group To" value={form.group_to} valueField="group_code" displayFields={["group_code", "group_name"]}
                      columns={[{ field: "group_code", header: "Code" }, { field: "group_name", header: "Name" }]}
                      placeholder={form.prin_code ? undefined : "Select principal first"}
                      loadOptions={groupLoader} onChange={(v) => setField("group_to", v)} />
                    <LookupField label="Brand From" value={form.brand_from} valueField="brand_code" displayFields={["brand_code", "brand_name"]}
                      columns={[{ field: "brand_code", header: "Code" }, { field: "brand_name", header: "Name" }]}
                      placeholder={form.prin_code ? undefined : "Select principal first"}
                      loadOptions={brandLoader} onChange={(v) => setField("brand_from", v)} />
                    <LookupField label="Brand To" value={form.brand_to} valueField="brand_code" displayFields={["brand_code", "brand_name"]}
                      columns={[{ field: "brand_code", header: "Code" }, { field: "brand_name", header: "Name" }]}
                      placeholder={form.prin_code ? undefined : "Select principal first"}
                      loadOptions={brandLoader} onChange={(v) => setField("brand_to", v)} />
                    <LookupField label="Product From" value={form.product_from} valueField="prod_code" displayFields={["prod_code", "prod_name"]}
                      columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }]}
                      placeholder={form.prin_code ? undefined : "Select principal first"}
                      loadOptions={productLoader} onChange={(v) => setField("product_from", v)} />
                    <LookupField label="Product To" value={form.product_to} valueField="prod_code" displayFields={["prod_code", "prod_name"]}
                      columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }]}
                      placeholder={form.prin_code ? undefined : "Select principal first"}
                      loadOptions={productLoader} onChange={(v) => setField("product_to", v)} />
                  </div>
                </div>

                <div className="rounded-md border bg-card p-2.5">
                  <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Location Preferences</p>
                  <div className="grid grid-cols-2 gap-2">
                    <LookupField label="Site From" value={form.site_from} valueField="site_code" displayFields={["site_code", "site_name"]}
                      columns={[{ field: "site_code", header: "Code" }, { field: "site_name", header: "Name" }]}
                      loadOptions={siteLoader} onChange={(v) => setField("site_from", v)} />
                    <LookupField label="Site To" value={form.site_to} valueField="site_code" displayFields={["site_code", "site_name"]}
                      columns={[{ field: "site_code", header: "Code" }, { field: "site_name", header: "Name" }]}
                      loadOptions={siteLoader} onChange={(v) => setField("site_to", v)} />
                    <LookupField label="Location From" value={form.location_from} valueField="location_code" displayFields={["location_code"]}
                      columns={[{ field: "location_code", header: "Code" }]}
                      loadOptions={locationLoader} onChange={(v) => setField("location_from", v)} />
                    <LookupField label="Location To" value={form.location_to} valueField="location_code" displayFields={["location_code"]}
                      columns={[{ field: "location_code", header: "Code" }]}
                      loadOptions={locationLoader} onChange={(v) => setField("location_to", v)} />
                  </div>

                  {/* Aisle / Column / Height packed 3x2 inside the same card */}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="grid gap-1">
                      <span className={labelCls}>Aisle From</span>
                      <Input className="h-8 text-xs" value={form.aisle_from} onChange={(e) => setField("aisle_from", e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className={labelCls}>Aisle To</span>
                      <Input className="h-8 text-xs" value={form.aisle_to} onChange={(e) => setField("aisle_to", e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className={labelCls}>Column From</span>
                      <Input className="h-8 text-xs" value={form.col_from} onChange={(e) => setField("col_from", e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className={labelCls}>Column To</span>
                      <Input className="h-8 text-xs" value={form.col_to} onChange={(e) => setField("col_to", e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className={labelCls}>Height From</span>
                      <Input className="h-8 text-xs" value={form.height_from} onChange={(e) => setField("height_from", e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className={labelCls}>Height To</span>
                      <Input className="h-8 text-xs" value={form.height_to} onChange={(e) => setField("height_to", e.target.value)} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Reps / remarks — last row, 6 across */}
              <div className="rounded-md border bg-card p-2.5">
                <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Additional Details</p>
                <div className="grid grid-cols-6 gap-2">
                  <label className="grid gap-1">
                    <span className={labelCls}>Counted By</span>
                    <Input className="h-8 text-xs" value={form.counted_by} onChange={(e) => setField("counted_by", e.target.value)} />
                  </label>
                  <label className="grid gap-1 col-span-2">
                    <span className={labelCls}>Remarks</span>
                    <Input className="h-8 text-xs" value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className={labelCls}>AMLS Rep</span>
                    <Input className="h-8 text-xs" value={form.amls_rep} onChange={(e) => setField("amls_rep", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className={labelCls}>AMLS Rep Designation</span>
                    <Input className="h-8 text-xs" value={form.amls_rep_designation} onChange={(e) => setField("amls_rep_designation", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className={labelCls}>Client Rep</span>
                    <Input className="h-8 text-xs" value={form.client_rep} onChange={(e) => setField("client_rep", e.target.value)} />
                  </label>
                  <label className="grid gap-1 col-span-2">
                    <span className={labelCls}>Client Rep Designation</span>
                    <Input className="h-8 text-xs" value={form.client_rep_designation} onChange={(e) => setField("client_rep_designation", e.target.value)} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === "principal" && (
            <div className="grid gap-3 mt-1">
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const newIndex = prinData.length;
                    setPrinData((prev) => [...prev, { prin_code: "", prin_name: "" }]);
                    setEditIndex(newIndex);
                  }}
                >
                  <Plus size={14} /> Add Row
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selectedRows.length === 0}
                  onClick={() => {
                    setPrinData((prev) => prev.filter((_, idx) => !selectedRows.includes(idx.toString())));
                    setSelectedRows([]);
                  }}
                >
                  <Trash2 size={14} /> Delete Selected ({selectedRows.length})
                </Button>
              </div>

              <div className="overflow-hidden rounded-md border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="w-10 border-r px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={prinData.length > 0 && selectedRows.length === prinData.length}
                          onChange={(e) => setSelectedRows(e.target.checked ? prinData.map((_, i) => i.toString()) : [])}
                        />
                      </th>
                      <th className="border-r px-2 py-1.5 text-left">Principal Code</th>
                      <th className="px-2 py-1.5 text-left">Principal Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prinData.map((item, index) => (
                      <tr key={index} className={selectedRows.includes(index.toString()) ? "bg-blue-50" : ""}>
                        <td className="border-r px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(index.toString())}
                            onChange={() => {
                              const idxStr = index.toString();
                              setSelectedRows((prev) => prev.includes(idxStr) ? prev.filter((i) => i !== idxStr) : [...prev, idxStr]);
                            }}
                          />
                        </td>
                        <td className="border-r px-2 py-1 cursor-pointer" onClick={() => setEditIndex(index)}>
                          {editIndex === index ? (
                            <LookupField
                              value={item.prin_code}
                              valueField="prin_code"
                              displayFields={["prin_code", "prin_name"]}
                              columns={[
                                { field: "prin_code", header: "Principal Code" },
                                { field: "prin_name", header: "Principal Name" },
                              ]}
                              loadOptions={principalLoader}
                              onChange={(selected, selectedRow) => {
                                const updated = [...prinData];
                                updated[index] = {
                                  prin_code: selected,
                                  prin_name: selectedRow ? String(selectedRow["prin_name"] ?? "") : "",
                                };
                                setPrinData(updated);
                                setEditIndex(null);
                              }}
                            />
                          ) : (
                            item.prin_code || "Click to select"
                          )}
                        </td>
                        <td className="px-2 py-1">{item.prin_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-4 py-2.5">
          <Button type="button" variant="outline" size="sm" onClick={() => onClose(isSubmitted || isEditMode)}>
            <X size={14} /> {isSubmitted || isEditMode ? "Close" : "Cancel"}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={handleSubmit}>
            <Save size={14} /> {saving ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StockCountForm;