import {
  Save, X, Plus, Trash2, ArrowLeft, ClipboardList, PackageCheck,
  MapPin, FileText, Activity, ShieldCheck, Sparkles, AlertTriangle,
} from "lucide-react";
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
  mode: "add" | "edit";
  editRowData?: Record<string, unknown> | null;
  onClose: (shouldRefetch?: boolean) => void;
}

const fieldClassName =
  "flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const labelCls =
  "grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label";

function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase()] = v;
  });
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

async function loadLookup(
  table: string,
  companyCode: string,
  columns: string,
  prinCode?: string
): Promise<LookupRow[]> {
  let where = `COMPANY_CODE = '${companyCode.replace(/'/g, "''")}'`;
  if (prinCode) {
    where += ` AND PRIN_CODE = '${prinCode.replace(/'/g, "''")}'`;
  }
  const rows = await executeWmsInboundSql(
    `SELECT ${columns} FROM ${table} WHERE ${where} ORDER BY 1`
  );
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as LookupRow);
}

function statusBadgeClass(status: string) {
  if (status === "A" || status === "Y")
    return "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-emerald-700";
  if (status === "C" || status === "R")
    return "inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-red-700";
  if (status === "S")
    return "inline-flex items-center rounded border border-orange-200 bg-orange-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-orange-700";
  return "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700";
}

function statusLabel(status: string) {
  if (status === "A" || status === "Y") return "Confirmed";
  if (status === "C") return "Cancelled";
  if (status === "R") return "Rejected";
  if (status === "S") return "Submitted";
  return "Draft";
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-52 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px]">
      <span className="font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </span>
  );
}

function SectionPanel({
  title,
  meta,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  icon: typeof ClipboardList;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`freight-panel overflow-hidden rounded-md border bg-background shadow-sm ${className}`}
    >
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={12} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold uppercase text-foreground">
              {title}
            </h3>
          </div>
        </div>
        {meta && <span className="text-[10px] text-muted-foreground">{meta}</span>}
      </div>
      <div className="freight-panel-body">{children}</div>
    </section>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { key: TabKey; label: string; icon: typeof ClipboardList };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`freight-workspace-tab ${active ? "active" : ""}`}
    >
      <Icon size={14} />
      {tab.label}
    </button>
  );
}

const stockCountTabs: { key: TabKey; label: string; icon: typeof ClipboardList }[] = [
  { key: "info", label: "Stock Info", icon: ClipboardList },
  { key: "principal", label: "Principal", icon: PackageCheck },
];

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

export function StockCountForm({ mode, editRowData, onClose }: StockCountFormProps) {
  const { user } = useAuth();
  const isAddMode = mode === "add";
  const isEditMode = mode === "edit";

  const [tab, setTab] = useState<TabKey>("info");
  const [form, setForm] = useState({ ...emptyForm });
  const [countNo, setCountNo] = useState(getValue(editRowData, "count_no"));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [prinData, setPrinData] = useState<PrincipalRow[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const companyCode = user?.company_code || "";

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

  useEffect(() => {
    const load = async () => {
      if (!isEditMode || !countNo || !companyCode) return;
      try {
        const data = await getStockCountPrincipals(companyCode, countNo);
        setPrinData(
          (data as any[]).map((r) => ({
            prin_code: getValue(r, "prin_code"),
            prin_name: getValue(r, "prin_name"),
          }))
        );
      } catch {
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

    const payloadCountNo = isEditMode ? editCountNo : isSubmitted ? countNo : "";

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
          if ((result as any)?.count_no) setCountNo((result as any).count_no);
          setTab("principal");
        } else {
          onClose(true);
          return;
        }
      } else {
        setNotice({ type: "error", message: "Failed to save stock count." });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Error saving stock count.",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = isSubmitted || isEditMode ? "A" : "N";

  return (
    <form
      className="freight-dense-form freight-ui-standard freight-enquiry-editor grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ClipboardList size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                {isEditMode
                  ? `Stock Count ${countNo}`
                  : isSubmitted
                    ? `Stock Count ${countNo}`
                    : "New Stock Count"}
              </h1>
              <span className={statusBadgeClass(currentStatus)}>
                {statusLabel(currentStatus)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => onClose()}>
            <ArrowLeft size={14} />
            List
          </Button>
          {notice && (
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {notice.message}
            </span>
          )}
          <HeaderChip
            label="Site"
            value={`${form.site_from || "-"} → ${form.site_to || "-"}`}
          />
          <HeaderChip label="Principals" value={String(prinData.length)} />
          <Button type="submit" size="sm" disabled={saving}>
            <Save size={14} />
            {saving ? "Saving" : isEditMode ? "Save" : "Submit"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onClose(isSubmitted || isEditMode)}
          >
            <X size={14} />
            {isSubmitted || isEditMode ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
        <div className="freight-tabs-list flex overflow-x-auto">
          {stockCountTabs.map((t) => {
            const disabled = t.key === "principal" && isAddMode && !isSubmitted;
            return (
              <button
                key={t.key}
                type="button"
                disabled={disabled}
                aria-pressed={tab === t.key}
                onClick={() => {
                  if (disabled) {
                    setNotice({
                      type: "error",
                      message: "Submit the stock count first to add principals.",
                    });
                    return;
                  }
                  setTab(t.key);
                }}
                className={`freight-workspace-tab ${tab === t.key ? "active" : ""} ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="freight-tabs-panel border-t p-2.5">
          {tab === "info" && (
            <div className="grid gap-2.5 lg:grid-cols-12">
              <div className="lg:col-span-12 rounded-md border bg-card p-2.5">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="lg:col-span-2">
                    <LookupField
                      label="Principal *"
                      value={form.prin_code}
                      valueField="prin_code"
                      displayFields={["prin_code", "prin_name"]}
                      columns={[
                        { field: "prin_code", header: "Principal Code" },
                        { field: "prin_name", header: "Principal Name" },
                      ]}
                      placeholder="Select principal"
                      placeholderClassName="!text-[10px] italic font-bold" // <-- Added italic
                      loadOptions={principalLoader}
                      onChange={(selected) =>
                        setForm((prev) => ({
                          ...prev,
                          prin_code: selected,
                          group_from: "",
                          group_to: "",
                          brand_from: "",
                          brand_to: "",
                          product_from: "",
                          product_to: "",
                        }))
                      }
                    />
                  </div>
                  <label className={labelCls}>
                    Master Count No.
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.master_count_no}
                      onChange={(e) => setField("master_count_no", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Parent Count No.
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.parent_count_no}
                      onChange={(e) => setField("parent_count_no", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Count Type
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.count_type}
                      onChange={(e) => setField("count_type", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Child Count
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.child_count}
                      onChange={(e) => setField("child_count", e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <SectionPanel
                className="lg:col-span-6 lg:text-sm"
                icon={PackageCheck}
                title="Product Preferences"
                meta={form.prin_code ? `Principal ${form.prin_code}` : undefined}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <LookupField
                    label="Group From"
                    value={form.group_from}
                    valueField="group_code"
                    displayFields={["group_code", "group_name"]}
                    columns={[
                      { field: "group_code", header: "Code" },
                      { field: "group_name", header: "Name" },
                    ]}
                    placeholder="Select Group From"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={groupLoader}
                    onChange={(v) => setField("group_from", v)}
                  />
                  <LookupField
                    label="Group To"
                    value={form.group_to}
                    valueField="group_code"
                    displayFields={["group_code", "group_name"]}
                    columns={[
                      { field: "group_code", header: "Code" },
                      { field: "group_name", header: "Name" },
                    ]}
                    placeholder="Select Group To"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={groupLoader}
                    onChange={(v) => setField("group_to", v)}
                  />
                  <LookupField
                    label="Brand From"
                    value={form.brand_from}
                    valueField="brand_code"
                    displayFields={["brand_code", "brand_name"]}
                    columns={[
                      { field: "brand_code", header: "Code" },
                      { field: "brand_name", header: "Name" },
                    ]}
                    placeholder="Select Brand From"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={brandLoader}
                    onChange={(v) => setField("brand_from", v)}
                  />
                  <LookupField
                    label="Brand To"
                    value={form.brand_to}
                    valueField="brand_code"
                    displayFields={["brand_code", "brand_name"]}
                    columns={[
                      { field: "brand_code", header: "Code" },
                      { field: "brand_name", header: "Name" },
                    ]}
                    placeholder="Select Brand To"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={brandLoader}
                    onChange={(v) => setField("brand_to", v)}
                  />
                  <LookupField
                    label="Product From"
                    value={form.product_from}
                    valueField="prod_code"
                    displayFields={["prod_code", "prod_name"]}
                    columns={[
                      { field: "prod_code", header: "Code" },
                      { field: "prod_name", header: "Name" },
                    ]}
                    placeholder="Select Product From"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={productLoader}
                    onChange={(v) => setField("product_from", v)}
                  />
                  <LookupField
                    label="Product To"
                    value={form.product_to}
                    valueField="prod_code"
                    displayFields={["prod_code", "prod_name"]}
                    columns={[
                      { field: "prod_code", header: "Code" },
                      { field: "prod_name", header: "Name" },
                    ]}
                    placeholder="Select Product To"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={productLoader}
                    onChange={(v) => setField("product_to", v)}
                  />
                </div>
              </SectionPanel>

              <SectionPanel
                className="lg:col-span-6"
                icon={MapPin}
                title="Location Preferences"
                meta={`${form.site_from || "-"} → ${form.site_to || "-"}`}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <LookupField
                    label="Site From"
                    value={form.site_from}
                    valueField="site_code"
                    displayFields={["site_code", "site_name"]}
                    columns={[
                      { field: "site_code", header: "Code" },
                      { field: "site_name", header: "Name" },
                    ]}
                    placeholder="Select Site From"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={siteLoader}
                    onChange={(v) => setField("site_from", v)}
                  />
                  <LookupField
                    label="Site To"
                    value={form.site_to}
                    valueField="site_code"
                    displayFields={["site_code", "site_name"]}
                    columns={[
                      { field: "site_code", header: "Code" },
                      { field: "site_name", header: "Name" },
                    ]}
                    placeholder="Select Site To"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={siteLoader}
                    onChange={(v) => setField("site_to", v)}
                  />
                  <LookupField
                    label="Location From"
                    value={form.location_from}
                    valueField="location_code"
                    displayFields={["location_code"]}
                    columns={[{ field: "location_code", header: "Code" }]}
                    placeholder="Select Location From"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={locationLoader}
                    onChange={(v) => setField("location_from", v)}
                  />
                  <LookupField
                    label="Location To"
                    value={form.location_to}
                    valueField="location_code"
                    displayFields={["location_code"]}
                    columns={[{ field: "location_code", header: "Code" }]}
                    placeholder="Select Location To"
                    placeholderClassName="!text-[10px] italic" // <-- Added italic
                    loadOptions={locationLoader}
                    onChange={(v) => setField("location_to", v)}
                  />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className={labelCls}>
                    Aisle From
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.aisle_from}
                      onChange={(e) => setField("aisle_from", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Aisle To
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.aisle_to}
                      onChange={(e) => setField("aisle_to", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Column From
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.col_from}
                      onChange={(e) => setField("col_from", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Column To
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.col_to}
                      onChange={(e) => setField("col_to", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Height From
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.height_from}
                      onChange={(e) => setField("height_from", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Height To
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.height_to}
                      onChange={(e) => setField("height_to", e.target.value)}
                    />
                  </label>
                </div>
              </SectionPanel>

              <SectionPanel
                className="lg:col-span-12"
                icon={FileText}
                title="Additional Details"
                meta={form.remarks ? "Remarks added" : "Pending"}
              >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  <label className={labelCls}>
                    Counted By
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.counted_by}
                      onChange={(e) => setField("counted_by", e.target.value)}
                    />
                  </label>
                  <label className={`${labelCls} lg:col-span-2`}>
                    Remarks
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.remarks}
                      onChange={(e) => setField("remarks", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    AMLS Rep
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.amls_rep}
                      onChange={(e) => setField("amls_rep", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    AMLS Rep Designation
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.amls_rep_designation}
                      onChange={(e) => setField("amls_rep_designation", e.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    Client Rep
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.client_rep}
                      onChange={(e) => setField("client_rep", e.target.value)}
                    />
                  </label>
                  <label className={`${labelCls} lg:col-span-2`}>
                    Client Rep Designation
                    <Input
                      className="h-7 text-[11px] placeholder:text-[10px] placeholder:italic"
                      value={form.client_rep_designation}
                      onChange={(e) => setField("client_rep_designation", e.target.value)}
                    />
                  </label>
                </div>
              </SectionPanel>
            </div>
          )}

          {tab === "principal" && (
            <section className="grid gap-3">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newIndex = prinData.length;
                    setPrinData((prev) => [...prev, { prin_code: "", prin_name: "" }]);
                    setEditIndex(newIndex);
                  }}
                >
                  <Plus size={14} /> Add Row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={selectedRows.length === 0}
                  onClick={() => {
                    setPrinData((prev) =>
                      prev.filter((_, idx) => !selectedRows.includes(idx.toString()))
                    );
                    setSelectedRows([]);
                  }}
                >
                  <Trash2 size={14} /> Delete Selected ({selectedRows.length})
                </Button>
              </div>

              <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-inner">
                <table className="w-full border-collapse text-[11.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                      <th className="w-10 border-r border-slate-200 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={prinData.length > 0 && selectedRows.length === prinData.length}
                          onChange={(e) =>
                            setSelectedRows(
                              e.target.checked ? prinData.map((_, i) => i.toString()) : []
                            )
                          }
                        />
                      </th>
                      <th className="border-r border-slate-200 px-2 py-1.5 text-left">
                        Principal Code
                      </th>
                      <th className="px-2 py-1.5 text-left">Principal Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prinData.map((item, index) => (
                      <tr
                        key={index}
                        className={
                          selectedRows.includes(index.toString())
                            ? "bg-blue-50"
                            : "hover:bg-slate-50/80"
                        }
                      >
                        <td className="border-r border-slate-200 px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(index.toString())}
                            onChange={() => {
                              const idxStr = index.toString();
                              setSelectedRows((prev) =>
                                prev.includes(idxStr)
                                  ? prev.filter((i) => i !== idxStr)
                                  : [...prev, idxStr]
                              );
                            }}
                          />
                        </td>
                        <td
                          className="border-r border-slate-200 px-2 py-1 cursor-pointer"
                          onClick={() => setEditIndex(index)}
                        >
                          {editIndex === index ? (
                            <LookupField
                              value={item.prin_code}
                              valueField="prin_code"
                              displayFields={["prin_code", "prin_name"]}
                              columns={[
                                { field: "prin_code", header: "Principal Code" },
                                { field: "prin_name", header: "Principal Name" },
                              ]}
                              placeholderClassName="!text-[10px] italic" // <-- Added italic
                              loadOptions={principalLoader}
                              onChange={(selected, selectedRow) => {
                                const updated = [...prinData];
                                updated[index] = {
                                  prin_code: selected,
                                  prin_name: selectedRow
                                    ? String(selectedRow["prin_name"] ?? "")
                                    : "",
                                };
                                setPrinData(updated);
                                setEditIndex(null);
                              }}
                            />
                          ) : (
                            <span className="text-[11.5px] font-medium text-foreground">
                              {item.prin_code || "Click to select"}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-[11.5px] text-foreground">
                          {item.prin_name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </form>
  );
}

export default StockCountForm;