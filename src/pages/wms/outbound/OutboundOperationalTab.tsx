import { Ban, CheckCircle2, FileUp, PackageCheck, Plus, RefreshCw, Trash2, X, ArrowLeft, Save, Package, Hash, MapPin, FileText, CalendarDays, Truck } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  executeWmsInboundSql,
  postWmsOutbound,
  putWmsOutbound,
} from "../../../api/wms";
import { executeCommonProcedure } from "../../../api/lookups";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import type { WmsRow } from "./Outboundtypes";
import { orderEntryFields, orderDetailFields } from "./Outboundtypes";
import {
  normalizeRow,
  value,
  lookupText,
  formatLookupDisplay,
  processMessage,
  sqlEscape,
  tabRequiresSelection,
} from "./OutboundHelpers";
import {
  loadOutboundCustomers,
  loadCurrencies,
  loadOrderEntryOptions,
  loadOutboundProducts,
  loadStockSites,
  loadStockLocations,
  loadStockBatches,
  loadStockLots,
} from "./OutboundLookups";
import {
  makeColumns,
  rowNumberColumn,
  selectionColumn,
  actionColumn,
  pickingIssueColumns,
  getOutboundTabConfig,
} from "./OutboundColumns";
import {
  ConfirmToolbar,
} from "./OutboundFormFields";
import { OutboundAcitivityBilling } from "./OutboundAcitivityBilling";

// ── Freight-style UI Helpers ──────────────────────────────────────────────────
const FreightPanel = ({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) => (
  <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm mb-2">
    <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-primary text-white">
          <Icon size={10} />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[10px] font-semibold uppercase tracking-wider text-foreground">{title}</h3>
        </div>
      </div>
    </div>
    <div className="freight-panel-body p-2.5">{children}</div>
  </section>
);

const LabelText = ({ text, required }: { text: string, required?: boolean }) => (
  <span style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: "4px" }}>
    <span>{text}</span>
    {required && <span style={{ color: "#dc2626" }}>*</span>}
  </span>
);

// ── OutboundOperationalTab ─────────────────────────────────────────────────────
export function OutboundOperationalTab({
  job,
  jobNo,
  tab,
  loadingJob,
  principalCode,
}: {
  job: WmsRow | null;
  jobNo: string;
  tab: string;
  loadingJob: boolean;
  principalCode: string;
}) {
  const [viewMode, setViewMode] = useState<"list" | "add_order" | "edit_order" | "add_detail" | "edit_detail">("list");
  const [form, setForm] = useState<WmsRow>({});
  const [saving, setSaving] = useState(false);
  const [modalNotice, setModalNotice] = useState<string | null>(null);

  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [pickPreference, setPickPreference] = useState("job_no");
  const [pickCriteria, setPickCriteria] = useState("fifo");
  const [leastQty, setLeastQty] = useState(false);
  const [ignoreMinExp, setIgnoreMinExp] = useState(false);
  const { user } = useAuth();
  const company_code = user?.company_code || "";
  const prinCode = value(job || {}, "prin_code") || principalCode || "";
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "order" | "detail"; row: WmsRow; } | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [pickingIssues, setPickingIssues] = useState<WmsRow[]>([]);
  const [pickingIssuesOpen, setPickingIssuesOpen] = useState(false);
  const [pickOptions, setPickOptions] = useState({
    preference: "job_no",
    min_qty: "N",
    exp_period: "0",
    confirm_date: new Date().toISOString().slice(0, 10),
  });

  const config = getOutboundTabConfig(tab);

  const loadRows = async (clearNotice = true) => {
    if (!config || loadingJob || tab === "activity_billing") return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    setSelection({});
    try {
      const res = await executeWmsInboundSql(
        config.sql({ companyCode: user?.company_code || "", jobNo, prinCode })
      );
      const data = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: processMessage(`Unable to load ${config.title}.`, error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prinCode || tab === "activity_billing") return;
    setViewMode("list"); // Reset to list when tab changes
    void loadRows();
  }, [tab, jobNo, prinCode, loadingJob]);

  if (tab === "activity_billing") {
    return <OutboundAcitivityBilling company_code={company_code} prin_code={principalCode} job_no={jobNo} />;
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">This outbound tab is not configured yet.</CardContent>
      </Card>
    );
  }

  const selectedKeys = Object.entries(selection).filter(([, selected]) => selected).map(([key]) => key);
  const selectedPayloadKeys = selectedKeys.map((key) => {
    const numericKey = Number(key);
    return Number.isFinite(numericKey) ? numericKey : key;
  });

  // ── Open Form Handlers ───────────────────────────────────────────────────
  const openOrderForm = (row: WmsRow | null) => {
    setModalNotice(null);
    if (row) {
      setForm({ ...row });
      setViewMode("edit_order");
    } else {
      setForm({
        company_code: value(job || {}, "company_code") || user?.company_code || "",
        prin_code: value(job || {}, "prin_code"),
        job_no: value(job || {}, "job_no"),
        curr_code: "QAR",
        ex_rate: "1",
        order_date: new Date().toISOString().slice(0, 10),
        order_due_date: new Date().toISOString().slice(0, 10),
      });
      setViewMode("add_order");
    }
  };

  const openDetailForm = (row: WmsRow | null) => {
    setModalNotice(null);
    if (row) {
      setForm({ ...row });
      setViewMode("edit_detail");
    } else {
      setForm({
        company_code: value(job || {}, "company_code") || user?.company_code || "",
        prin_code: value(job || {}, "prin_code"),
        job_no: value(job || {}, "job_no"),
        serial_no: 0,
        qty_puom: 0,
        qty_luom: 0,
        quantity: 0,
        minperiod_exppick: 0,
      });
      setViewMode("add_detail");
    }
  };

  // ── Save Handler ─────────────────────────────────────────────────────────
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setModalNotice(null);
    const isOrder = viewMode.includes("order");
    const fieldsToValidate = isOrder ? orderEntryFields : orderDetailFields;
    
    const missing = fieldsToValidate.find((field) => field.required && !String(form[field.name] || "").trim());
    if (missing) {
      setModalNotice(`${missing.label} is required`);
      return;
    }

    setSaving(true);
    try {
      if (isOrder) {
        await postWmsOutbound("orders", form);
        setNotice({ type: "success", message: "Order entry saved successfully" });
      } else {
        await putWmsOutbound("upsertOutboundOrderDetailManualHandler", form);
        setNotice({ type: "success", message: "Order detail saved successfully" });
      }
      setViewMode("list");
      await loadRows();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to save record";
      setModalNotice(msg);
      setNotice({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Action Toolbar (Freight Style) ────────────────────────────────────────
  const renderActionButton = (onClick: () => void, icon: React.ReactNode, label: string, disabled = false, variant: "primary" | "outline" = "primary") => {
    const baseClass = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
    const variantClass = variant === "primary"
      ? "bg-[#00378C] text-white hover:opacity-90 font-semibold"
      : "border border-border bg-card text-foreground hover:bg-secondary font-medium";
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={`${baseClass} ${variantClass}`}>
        {icon} {label}
      </button>
    );
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {tab === "order_entry" && renderActionButton(() => openOrderForm(null), <Plus size={14} />, "Add Order")}
      {tab === "order_details" && (
        <>
          {renderActionButton(() => openDetailForm(null), <Plus size={14} />, "Add Detail")}
          {/* Keep EDI Import if needed in the future, currently not in the provided file but good to keep structure */}
        </>
      )}
      {tab === "picking_details" && renderActionButton(() => setPickModalOpen(true), <PackageCheck size={14} />, "Pick Orders", false, "outline")}
      {tab === "cancel_picking" && renderActionButton(() => runPickAction("CANCEL"), <Ban size={14} />, "Cancel Selected", loading, "outline")}
      {tab === "job_confirmation" && renderActionButton(() => runPickAction("CONFIRM"), <CheckCircle2 size={14} />, "Process Confirm", loading, "outline")}
      {/* {renderActionButton(() => loadRows(), <RefreshCw size={14} />, "Refresh", false, "outline")} */}
    </div>
  );

  // ── Pick Action (Unchanged) ──────────────────────────────────────────────
  const runPickAction = async (mode: "PICK" | "CONFIRM" | "CANCEL") => {
    if (!selectedKeys.length) {
      setNotice({ type: "error", message: `Please select at least one row before running action.` });
      return;
    }
    setLoading(true);
    try {
      if (mode === "PICK") {
        const issueRows = await executeWmsInboundSql(
          `SELECT * FROM VW_PICK_QTY_BALANCE WHERE JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}'`
        );
        if (issueRows.length) {
          setPickingIssues(issueRows.map(normalizeRow));
          setPickingIssuesOpen(true);
          setNotice({ type: "error", message: "Picking validation has issues. Review the issue list before picking." });
          return;
        }
        await putWmsOutbound(`picking_details/pick_order/${encodeURIComponent(jobNo)}`, { serial_no: selectedPayloadKeys }, {
          prin_code: prinCode, preference: pickPreference, pick: "Y", min_qty: leastQty ? "Y" : "N", exp_period: ignoreMinExp ? "0" : pickOptions.exp_period, pick_criteria: pickCriteria,
        });
      } else if (mode === "CONFIRM") {
        const [year, month, day] = pickOptions.confirm_date.split("-");
        const formattedConfirmDate = `${day}/${month}/${year}`;
        await executeCommonProcedure({
          parameter: "SP_PICK_CONFIRM_PARENT", loginid: user?.loginid || "", val1s1: user?.company_code || "", val1s2: prinCode, val1s3: jobNo, val1s4: formattedConfirmDate, val1s5: selectedKeys.join(","),
        });
      } else {
        await putWmsOutbound(`picking_details/oubcancelPick/${encodeURIComponent(jobNo)}`, { serial_no: selectedPayloadKeys }, { prin_code: prinCode, freeze: "Y   " });
      }
      setNotice({ type: "success", message: `${mode === "PICK" ? "Picking" : mode === "CONFIRM" ? "Job confirmation" : "Cancel picking"} completed.` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: processMessage(`Unable to process action.`, error) });
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Action (Unchanged) ────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      if (deleteTarget.kind === "order") {
        await postWmsOutbound("orders", { ...deleteTarget.row, job_no: `${value(deleteTarget.row, "job_no") || jobNo}$$$DELETE` });
      } else {
        await executeCommonProcedure({
          parameter: "DELETE_TO_ORDER_DET", loginid: user?.loginid || "", val1s1: value(deleteTarget.row, "company_code") || user?.company_code || "", val1s2: value(deleteTarget.row, "prin_code") || prinCode, val1s3: value(deleteTarget.row, "job_no") || jobNo, val1n1: Number(value(deleteTarget.row, "serial_no") || 0),
        });
      }
      setNotice({ type: "success", message: `${deleteTarget.kind === "order" ? "Order entry" : "Order detail"} deleted successfully.` });
      setDeleteTarget(null);
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: processMessage(`Unable to delete.`, error) });
    } finally {
      setLoading(false);
    }
  };

  // ── Columns setup ────────────────────────────────────────────────────────
  const actionColumns = makeColumns(config.columns);
  const columns = tabRequiresSelection(tab)
    ? [rowNumberColumn(), selectionColumn(selection, setSelection, config.selectionKey), ...actionColumns]
    : config.editable
      ? [
          rowNumberColumn(),
          ...actionColumns,
          actionColumn(
            (row) => (config.kind === "order" ? openOrderForm(row) : openDetailForm(row)),
            (row) => setDeleteTarget({ kind: config.kind === "order" ? "order" : "detail", row })
          ),
        ]
      : [rowNumberColumn(), ...actionColumns];

  // ── Full Page Form Rendering ─────────────────────────────────────────────
  const renderHeader = (title: string, icon: any) => (
    <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1 shadow-sm">
      <div className="flex min-w-0 py-2 items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setViewMode("list")}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <div style={{ display: "grid", placeItems: "center", width: "24px", height: "24px", borderRadius: "6px", backgroundColor: "rgba(0, 55, 140, 0.08)", color: "#00378C", flexShrink: 0 }}>
            {icon}
          </div>
          <h1 style={{ margin: 0, fontSize: "15px", fontWeight: 600, lineHeight: 1.2, color: "#0f172a" }}>{title}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {modalNotice && <span className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{modalNotice}</span>}
        <Button type="button" size="sm" variant="outline" onClick={() => setViewMode("list")}><X size={14} /> Cancel</Button>
        <Button type="submit" size="sm" form="outbound-form" disabled={saving}><Save size={14} /> {saving ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  );

  const renderOrderEntryForm = () => (
    <>
      <FreightPanel icon={FileText} title="Order Information">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 items-start">
          <label className="field">
            <LabelText text="Customer" required />
            <LookupField
              label="Customer" compact
              value={String(form.cust_code || "")}
              displayValue={formatLookupDisplay(form, ["cust_code", "cust_name"])}
              valueField="cust_code"
              displayFields={["cust_code", "cust_name"]}
              columns={[{ field: "cust_code", header: "Customer Code" }, { field: "cust_name", header: "Customer Name" }]}
              placeholder="Select customer"
              loadOptions={() => loadOutboundCustomers(value(job || {}, "company_code") || user?.company_code || "", value(job || {}, "prin_code"))}
              onChange={(selected, selectedRow) => setForm((current) => ({ ...current, cust_code: selected, cust_name: selectedRow ? lookupText(selectedRow, "cust_name") : "" }))}
            />
          </label>
          <label className="field">
            <LabelText text="Order No" required />
            <Input className="h-8 text-xs" value={String(form.order_no || "")} onChange={e => setForm(c => ({ ...c, order_no: e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Order Date" />
            <Input type="date" className="h-8 text-xs" value={String(form.order_date || "")} onChange={e => setForm(c => ({ ...c, order_date: e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Due Date" />
            <Input type="date" className="h-8 text-xs" value={String(form.order_due_date || "")} onChange={e => setForm(c => ({ ...c, order_due_date: e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Currency" />
            <LookupField
              label="Currency" compact
              value={String(form.curr_code || "")}
              displayValue={formatLookupDisplay(form, ["curr_code", "curr_name"])}
              valueField="curr_code"
              displayFields={["curr_code", "curr_name"]}
              columns={[{ field: "curr_code", header: "Currency Code" }, { field: "curr_name", header: "Currency Name" }]}
              placeholder="Select currency"
              loadOptions={loadCurrencies}
              onChange={(selected, selectedRow) => setForm((current) => ({ ...current, curr_code: selected, curr_name: selectedRow ? lookupText(selectedRow, "curr_name") : "" }))}
            />
          </label>
          <label className="field">
            <LabelText text="Exchange Rate" />
            <Input type="number" className="h-8 text-xs" value={String(form.ex_rate || "")} onChange={e => setForm(c => ({ ...c, ex_rate: e.target.value }))} />
          </label>
        </div>
      </FreightPanel>
      <FreightPanel icon={Truck} title="Container, Timing And Reference">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 items-start">
          {["moc1","moc2","exp_container_no","exp_container_size","exp_container_type","exp_container_sealno","cust_reference","pack_start","pack_end","load_start","load_end"].map((name) => {
            const field = orderEntryFields.find((item) => item.name === name);
            return (
              <label key={name} className="field">
                <LabelText text={field?.label || name} />
                <Input type={field?.type || "text"} className="h-8 text-xs" value={String(form[name] || "")} onChange={e => setForm(c => ({ ...c, [name]: e.target.value }))} />
              </label>
            );
          })}
        </div>
      </FreightPanel>
    </>
  );

  const renderOrderDetailForm = () => (
    <>
      <FreightPanel icon={Package} title="Order And Product">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 items-start">
          <label className="field">
            <LabelText text="Order No" />
            <LookupField
              label="Order No" compact
              value={String(form.order_no || "")}
              displayValue={formatLookupDisplay(form, ["order_no", "cust_name"])}
              valueField="order_no"
              displayFields={["order_no", "cust_name"]}
              columns={[{ field: "order_no", header: "Order No" }, { field: "cust_code", header: "Customer Code" }, { field: "cust_name", header: "Customer" }]}
              placeholder="Select order"
              loadOptions={() => loadOrderEntryOptions(company_code, prinCode, jobNo)}
              onChange={(selected, selectedRow) => setForm((current) => ({ ...current, order_no: selected, cust_code: selectedRow ? lookupText(selectedRow, "cust_code") : "", cust_name: selectedRow ? lookupText(selectedRow, "cust_name") : "" }))}
            />
          </label>
          <label className="field">
            <LabelText text="Customer" />
            <Input disabled className="h-8 text-xs bg-muted" value={formatLookupDisplay(form, ["cust_code", "cust_name"])} />
          </label>
          <label className="field">
            <LabelText text="Product" />
            <LookupField
              label="Product" compact
              value={String(form.prod_code || "")}
              displayValue={formatLookupDisplay(form, ["prod_code", "prod_name"])}
              valueField="prod_code"
              displayFields={["prod_code", "prod_name"]}
              columns={[{ field: "prod_code", header: "Product Code" }, { field: "prod_name", header: "Product" }, { field: "p_uom", header: "P UOM" }, { field: "l_uom", header: "L UOM" }]}
              placeholder="Select product"
              loadOptions={() => loadOutboundProducts(company_code, prinCode)}
              onChange={(selected, selectedRow) => setForm((current) => ({ ...current, prod_code: selected, prod_name: selectedRow ? lookupText(selectedRow, "prod_name") : "", p_uom: selectedRow ? lookupText(selectedRow, "p_uom") : "", l_uom: selectedRow ? lookupText(selectedRow, "l_uom") : "", uppp: selectedRow ? lookupText(selectedRow, "uppp") : current.uppp, act_order_qty: selectedRow ? lookupText(selectedRow, "qty_avl") : 0, site_code: "", loc_code_from: "", loc_code_to: "", batch_no: "", lot_no: "" }))}
            />
          </label>
          <label className="field">
            <LabelText text="Available Qty" />
            <Input disabled className="h-8 text-xs bg-muted" value={String(form.act_order_qty || 0)} />
          </label>
        </div>
      </FreightPanel>

      <FreightPanel icon={MapPin} title="Stock Location">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-3 items-start">
          <label className="field">
            <LabelText text="Site Code" />
            <LookupField
              label="Site Code" compact
              value={String(form.site_code || "")}
              valueField="site_code"
              displayFields={["site_code"]}
              columns={[{ field: "site_code", header: "Site Code" }]}
              placeholder="Select site"
              disabled={!form.prod_code}
              loadOptions={() => loadStockSites(company_code, prinCode, String(form.prod_code || ""))}
              onChange={(selected) => setForm((current) => ({ ...current, site_code: selected, loc_code_from: "", loc_code_to: "", batch_no: "", lot_no: "" }))}
            />
          </label>
          <label className="field">
            <LabelText text="Location From" />
            <LookupField
              label="Location From" compact
              value={String(form.loc_code_from || "")}
              valueField="location_code"
              displayFields={["location_code"]}
              columns={[{ field: "location_code", header: "Location" }]}
              placeholder="Select location"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() => loadStockLocations(company_code, prinCode, String(form.prod_code || ""), String(form.site_code || ""))}
              onChange={(selected) => setForm((current) => ({ ...current, loc_code_from: selected, loc_code_to: current.loc_code_to || selected }))}
            />
          </label>
          <label className="field">
            <LabelText text="Location To" />
            <LookupField
              label="Location To" compact
              value={String(form.loc_code_to || "")}
              valueField="location_code"
              displayFields={["location_code"]}
              columns={[{ field: "location_code", header: "Location" }]}
              placeholder="Select location"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() => loadStockLocations(company_code, prinCode, String(form.prod_code || ""), String(form.site_code || ""))}
              onChange={(selected) => setForm((current) => ({ ...current, loc_code_to: selected }))}
            />
          </label>
          <label className="field">
            <LabelText text="Batch No" />
            <LookupField
              label="Batch No" compact
              value={String(form.batch_no || "")}
              valueField="batch_no"
              displayFields={["batch_no"]}
              columns={[{ field: "batch_no", header: "Batch No" }]}
              placeholder="Select batch"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() => loadStockBatches(company_code, String(form.prod_code || ""), String(form.site_code || ""))}
              onChange={(selected) => setForm((current) => ({ ...current, batch_no: selected }))}
            />
          </label>
          <label className="field">
            <LabelText text="Lot No" />
            <LookupField
              label="Lot No" compact
              value={String(form.lot_no || "")}
              valueField="lot_no"
              displayFields={["lot_no"]}
              columns={[{ field: "lot_no", header: "Lot No" }]}
              placeholder="Select lot"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() => loadStockLots(company_code, String(form.prod_code || ""), String(form.site_code || ""))}
              onChange={(selected) => setForm((current) => ({ ...current, lot_no: selected }))}
            />
          </label>
        </div>
      </FreightPanel>

      <FreightPanel icon={CalendarDays} title="Dates And Conversion">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-3 items-start">
          <label className="field">
            <LabelText text="Production From" />
            <Input type="date" className="h-8 text-xs" value={String(form.production_from || "")} onChange={e => setForm(c => ({ ...c, production_from: e.target.value, production_to: c.production_to || e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Production To" />
            <Input type="date" className="h-8 text-xs" value={String(form.production_to || "")} onChange={e => setForm(c => ({ ...c, production_to: e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Expiry From" />
            <Input type="date" className="h-8 text-xs" value={String(form.expiry_from || "")} onChange={e => setForm(c => ({ ...c, expiry_from: e.target.value, expiry_to: c.expiry_to || e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Expiry To" />
            <Input type="date" className="h-8 text-xs" value={String(form.expiry_to || "")} onChange={e => setForm(c => ({ ...c, expiry_to: e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="UPPP" />
            <Input disabled className="h-8 text-xs bg-muted" value={String(form.uppp || "")} />
          </label>
        </div>
      </FreightPanel>

      <FreightPanel icon={Hash} title="Quantity + Salesman">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 items-start">
          <label className="field">
            <LabelText text="Salesman" />
            <Input className="h-8 text-xs" value={String(form.salesman_code || "")} onChange={e => setForm(c => ({ ...c, salesman_code: e.target.value }))} />
          </label>
          <label className="field">
            <LabelText text="Min Expiry Period" />
            <Input type="number" className="h-8 text-xs" value={String(form.minperiod_exppick || "")} onChange={e => setForm(c => ({ ...c, minperiod_exppick: e.target.value }))} />
          </label>
        </div>
      </FreightPanel>
    </>
  );

  if (viewMode !== "list") {
    const isOrder = viewMode.includes("order");
    return (
      <section className="grid gap-3 freight-dense-form freight-ui-standard p-1">
        {renderHeader(isOrder ? (viewMode === "add_order" ? "Add Order Entry" : "Edit Order Entry") : (viewMode === "add_detail" ? "Add Order Detail" : "Edit Order Detail"), <Package size={14} />)}
        <div className="freight-form-card rounded-md border bg-card shadow-sm p-2">
          <form id="outbound-form" onSubmit={handleSave} className="grid gap-2">
            {isOrder ? renderOrderEntryForm() : renderOrderDetailForm()}
          </form>
        </div>
      </section>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable
        key={tab}
        columns={columns}
        data={rows}
        subtitle={config.title}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading || loadingJob}
        height="calc(100dvh - 180px)"
        minWidth={config.minWidth}
        density="grid"
        enablePagination
        pageSize={25}
        enableExport
        exportFilename={`outbound-${tab}-list.csv`}
        toolbar={toolbar}
        getRowId={(row, index) =>
          `${tab}_${value(row, config.selectionKey || "serial_no") || value(row, "order_no") || index}`
        }
      />

      {/* Picking Option Dialog */}
      <Dialog
        open={pickModalOpen}
        title="Picking Option"
        wide
        onClose={() => setPickModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPickModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { setPickModalOpen(false); runPickAction("PICK"); }}>Ok</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-6 p-2">
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Preference</p>
            <div className="grid gap-2">
              {[{ label: "None", value: "job_no" }, { label: "Full Pallete", value: "full_pallete" }, { label: "Mixed Pallete", value: "mixed_pallete" }, { label: "Lead To Max Load", value: "lead_to_max_load" }].map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" className="accent-primary" checked={pickPreference === opt.value} onChange={() => setPickPreference(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={leastQty} onChange={(e) => setLeastQty(e.target.checked)} /> Least Qty
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={ignoreMinExp} onChange={(e) => setIgnoreMinExp(e.target.checked)} /> Ignore Minimum Exp Period
              </label>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Pick Criteria</p>
            <div className="grid gap-2">
              {[{ label: "FIFO", value: "fifo" }, { label: "FEFO", value: "fefo" }, { label: "Document Reference", value: "doc_ref" }, { label: "Lot Number", value: "lot_no" }, { label: "Manufacture Date", value: "production_date" }, { label: "Expiry Date", value: "expiry_date" }, { label: "LIFO", value: "lifo" }, { label: "LEFO", value: "lefo" }, { label: "Unit Price", value: "unit_price" }, { label: "Manufacturer", value: "manufacturer" }, { label: "Country of Origin", value: "country_origin" }, { label: "Site/Location Code", value: "location_code" }, { label: "WM - PICKWAVE", value: "wm_pickwave" }, { label: "WM - FINAL PICK WAVE", value: "wm_final_pickwave" }, { label: "SA - PICK WAVE", value: "sa_pickwave" }].map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" className="accent-primary" checked={pickCriteria === opt.value} onChange={() => setPickCriteria(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "order" ? "Delete Order Entry" : "Delete Order Detail"}
        description="This will remove the selected outbound row using the existing Bayanat backend procedure."
        onClose={() => setDeleteTarget(null)}
      >
        <div className="grid gap-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            {deleteTarget?.kind === "order" ? "Order No" : "Serial No"}:{" "}
            <strong className="text-foreground">
              {deleteTarget?.kind === "order" ? value(deleteTarget.row, "order_no") : value(deleteTarget?.row || {}, "serial_no")}
            </strong>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}><X size={15} /> Cancel</Button>
            <Button type="button" variant="destructive" disabled={loading} onClick={confirmDelete}><Trash2 size={15} /> Delete</Button>
          </div>
        </div>
      </Dialog>

      {/* Picking Issues Dialog */}
      <Dialog
        open={pickingIssuesOpen}
        title="Picking Validation Issues"
        description="These rows need quantity or manufacturing/expiry review before picking."
        wide
        onClose={() => setPickingIssuesOpen(false)}
      >
        <DataTable
          columns={makeColumns(pickingIssueColumns())}
          data={pickingIssues}
          subtitle="Validation"
          height={420}
          minWidth={1500}
          density="grid"
          enablePagination
          pageSize={50}
          searchPlaceholder="Search validation issues..."
        />
      </Dialog>
    </section>
  );
}