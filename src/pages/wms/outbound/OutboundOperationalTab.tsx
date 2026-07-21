import { Ban, CheckCircle2, FileUp, PackageCheck, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
  OutboundFormFrame,
  DialogActions,
  TextField,
  DateField,
  ReadOnlyField,
  QuantityStrip,
  AvailableQuantityCard,
  ConfirmToolbar,
} from "./OutboundFormFields";
import { OutboundAcitivityBilling } from "./OutboundAcitivityBilling";

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
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [orderDialog, setOrderDialog] = useState<{
    open: boolean;
    row: WmsRow | null;
  }>({ open: false, row: null });
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    row: WmsRow | null;
  }>({ open: false, row: null });
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "order" | "detail";
    row: WmsRow;
  } | null>(null);
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
      const data = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : [];
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({
        type: "error",
        message: processMessage(`Unable to load ${config.title}.`, error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prinCode || tab === "activity_billing") return;
    void loadRows();
  }, [tab, jobNo, prinCode, loadingJob]);

  if (tab === "activity_billing") {
    return <OutboundAcitivityBilling company_code={company_code} prin_code={principalCode} job_no={jobNo}  />
  }

  if (!config)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          This outbound tab is not configured yet.
        </CardContent>
      </Card>
    );

  const selectedKeys = Object.entries(selection)
    .filter(([, selected]) => selected)
    .map(([key]) => key);

  const selectedPayloadKeys = selectedKeys.map((key) => {
    const numericKey = Number(key);
    return Number.isFinite(numericKey) ? numericKey : key;
  });

  const actionColumns = makeColumns(config.columns);
  const columns = tabRequiresSelection(tab)
    ? [
        rowNumberColumn(),
        selectionColumn(selection, setSelection, config.selectionKey),
        ...actionColumns,
      ]
    : config.editable
      ? [
          rowNumberColumn(),
          ...actionColumns,
          actionColumn(
            (row) =>
              config.kind === "order"
                ? setOrderDialog({ open: true, row })
                : setDetailDialog({ open: true, row }),
            (row) =>
              setDeleteTarget({
                kind: config.kind === "order" ? "order" : "detail",
                row,
              })
          ),
        ]
      : [rowNumberColumn(), ...actionColumns];

  const runPickAction = async (mode: "PICK" | "CONFIRM" | "CANCEL") => {
    if (!selectedKeys.length) {
      setNotice({
        type: "error",
        message: `Please select at least one row before running ${mode === "PICK" ? "picking" : mode === "CONFIRM" ? "job confirmation" : "cancel picking"}.`,
      });
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
          setNotice({
            type: "error",
            message:
              "Picking validation has issues. Review the issue list before picking.",
          });
          return;
        }
        await putWmsOutbound(
          `picking_details/pick_order/${encodeURIComponent(jobNo)}`,
          { serial_no: selectedPayloadKeys },
          {
            prin_code: prinCode,
            preference: pickPreference,
            pick: "Y",
            min_qty: leastQty ? "Y" : "N",
            exp_period: ignoreMinExp ? "0" : pickOptions.exp_period,
            pick_criteria: pickCriteria,
          }
        );
      } else if (mode === "CONFIRM") {
        const [year, month, day] = pickOptions.confirm_date.split("-");
        const formattedConfirmDate = `${day}/${month}/${year}`;

        await executeCommonProcedure({
          parameter: "SP_PICK_CONFIRM_PARENT",
          loginid: user?.loginid || "",
          val1s1: user?.company_code || "",
          val1s2: prinCode,
          val1s3: jobNo,
          val1s4: formattedConfirmDate,
          val1s5: selectedKeys.join(","),
        });
      }
      else {
        await putWmsOutbound(
          `picking_details/oubcancelPick/${encodeURIComponent(jobNo)}`,
          { serial_no: selectedPayloadKeys },
          { prin_code: prinCode, freeze: "Y   " }
        );
      }
      setNotice({
        type: "success",
        message: `${mode === "PICK" ? "Picking" : mode === "CONFIRM" ? "Job confirmation" : "Cancel picking"} completed for ${selectedKeys.length} selected row${selectedKeys.length === 1 ? "" : "s"}.`,
      });
      await loadRows(false);
    } catch (error) {
      setNotice({
        type: "error",
        message: processMessage(
          `Unable to process ${mode === "PICK" ? "picking" : mode === "CONFIRM" ? "job confirmation" : "cancel picking"} for selected rows.`,
          error
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      if (deleteTarget.kind === "order") {
        await postWmsOutbound("orders", {
          ...deleteTarget.row,
          job_no: `${value(deleteTarget.row, "job_no") || jobNo}$$$DELETE`,
        });
      } else {
        await executeCommonProcedure({
          parameter: "DELETE_TO_ORDER_DET",
          loginid: user?.loginid || "",
          val1s1:
            value(deleteTarget.row, "company_code") ||
            user?.company_code ||
            "",
          val1s2: value(deleteTarget.row, "prin_code") || prinCode,
          val1s3: value(deleteTarget.row, "job_no") || jobNo,
          val1n1: Number(value(deleteTarget.row, "serial_no") || 0),
        });
      }
      setNotice({
        type: "success",
        message:
          deleteTarget.kind === "order"
            ? "Order entry deleted successfully."
            : "Order detail deleted successfully.",
      });
      setDeleteTarget(null);
      await loadRows(false);
    } catch (error) {
      setNotice({
        type: "error",
        message: processMessage(
          deleteTarget.kind === "order"
            ? "Unable to delete order entry."
            : "Unable to delete order detail.",
          error
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {tab === "order_entry" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOrderDialog({ open: true, row: null })}
        >
          <Plus size={14} /> Add Order
        </Button>
      )}
      {tab === "order_details" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDetailDialog({ open: true, row: null })}
        >
          <Plus size={14} /> Add Detail
        </Button>
      )}
      {tab === "order_details" && (
        <EdiImportButton
          jobNo={jobNo}
          prinCode={prinCode}
          companyCode={user?.company_code || ""}
          loginid={user?.loginid || ""}
          onDone={loadRows}
          onNotice={setNotice}
        />
      )}
      {tab === "picking_details" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickModalOpen(true)}
          >
            <PackageCheck size={14} /> Pick Orders
          </Button>
          <Dialog
            open={pickModalOpen}
            title="Picking Option"
            wide
            onClose={() => setPickModalOpen(false)}
            footer={
              <>
                <Button variant="outline" onClick={() => setPickModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setPickModalOpen(false);
                    runPickAction("PICK");
                  }}
                >
                  Ok
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-6 p-2">
              {/* Preference */}
              <div>
                <p className="mb-3 text-sm font-semibold text-foreground">
                  Preference
                </p>
                <div className="grid gap-2">
                  {[
                    { label: "None", value: "job_no" },
                    { label: "Full Pallete", value: "full_pallete" },
                    { label: "Mixed Pallete", value: "mixed_pallete" },
                    { label: "Lead To Max Load", value: "lead_to_max_load" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        className="accent-primary"
                        checked={pickPreference === opt.value}
                        onChange={() => setPickPreference(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={leastQty}
                      onChange={(e) => setLeastQty(e.target.checked)}
                    />
                    Least Qty
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={ignoreMinExp}
                      onChange={(e) => setIgnoreMinExp(e.target.checked)}
                    />
                    Ignore Minimum Exp Period
                  </label>
                </div>
              </div>

              {/* Pick Criteria */}
              <div>
                <p className="mb-3 text-sm font-semibold text-foreground">
                  Pick Criteria
                </p>
                <div className="grid gap-2">
                  {[
                    { label: "FIFO", value: "fifo" },
                    { label: "FEFO", value: "fefo" },
                    { label: "Document Reference", value: "doc_ref" },
                    { label: "Lot Number", value: "lot_no" },
                    { label: "Manufacture Date", value: "production_date" },
                    { label: "Expiry Date", value: "expiry_date" },
                    { label: "LIFO", value: "lifo" },
                    { label: "LEFO", value: "lefo" },
                    { label: "Unit Price", value: "unit_price" },
                    { label: "Manufacturer", value: "manufacturer" },
                    { label: "Country of Origin", value: "country_origin" },
                    { label: "Site/Location Code", value: "location_code" },
                    { label: "WM - PICKWAVE", value: "wm_pickwave" },
                    { label: "WM - FINAL PICK WAVE", value: "wm_final_pickwave" },
                    { label: "SA - PICK WAVE", value: "sa_pickwave" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        className="accent-primary"
                        checked={pickCriteria === opt.value}
                        onChange={() => setPickCriteria(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Dialog>
        </>
      )}
      {tab === "cancel_picking" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => runPickAction("CANCEL")}
          disabled={loading}
        >
          <Ban size={14} /> Cancel Selected
        </Button>
      )}
      {tab === "job_confirmation" && (
        <ConfirmToolbar
          options={pickOptions}
          setOptions={setPickOptions}
          onConfirm={() => runPickAction("CONFIRM")}
          disabled={loading}
        />
      )}
      <Button size="sm" variant="outline" onClick={() => loadRows()}>
        <RefreshCw size={14} /> Refresh
      </Button>
    </div>
  );


  return (
    <section className="grid gap-3">
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable
        columns={columns}
        data={rows}
        subtitle={config.title}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading || loadingJob}
        height="calc(100vh - 285px)"
        minWidth={config.minWidth}
        density="grid"
        enablePagination
        pageSize={75}
        toolbar={toolbar}
        getRowId={(row, index) =>
          `${tab}_${value(row, config.selectionKey || "serial_no") || value(row, "order_no") || index}`
        }
      />

      <OrderEntryDialog
        open={orderDialog.open}
        row={orderDialog.row}
        job={job}
        onClose={() => setOrderDialog({ open: false, row: null })}
        onDone={loadRows}
        onNotice={setNotice}
      />
      <OrderDetailDialog
        open={detailDialog.open}
        row={detailDialog.row}
        job={job}
        orderRows={rows}
        onClose={() => setDetailDialog({ open: false, row: null })}
        onDone={loadRows}
        onNotice={setNotice}
      />

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === "order"
            ? "Delete Order Entry"
            : "Delete Order Detail"
        }
        description="This will remove the selected outbound row using the existing Bayanat backend procedure."
        onClose={() => setDeleteTarget(null)}
      >
        <div className="grid gap-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            {deleteTarget?.kind === "order" ? "Order No" : "Serial No"}:{" "}
            <strong className="text-foreground">
              {deleteTarget?.kind === "order"
                ? value(deleteTarget.row, "order_no")
                : value(deleteTarget?.row || {}, "serial_no")}
            </strong>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              <X size={15} /> Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={confirmDelete}
            >
              <Trash2 size={15} /> Delete
            </Button>
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

// ── OrderEntryDialog ───────────────────────────────────────────────────────────
function OrderEntryDialog({
  open,
  row,
  job,
  onClose,
  onDone,
  onNotice,
}: {
  open: boolean;
  row: WmsRow | null;
  job: WmsRow | null;
  onClose: () => void;
  onDone: () => void;
  onNotice: (notice: { type: "success" | "error"; message: string }) => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<WmsRow>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      company_code:
        value(job || {}, "company_code") || user?.company_code || "",
      prin_code: value(job || {}, "prin_code"),
      job_no: value(job || {}, "job_no"),
      curr_code: "QAR",
      ex_rate: "1",
      order_date: new Date().toISOString().slice(0, 10),
      order_due_date: new Date().toISOString().slice(0, 10),
      ...(row || {}),
    });
  }, [row, job, user?.company_code]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const missing = orderEntryFields.find(
      (field) => field.required && !String(form[field.name] || "").trim()
    );
    if (missing) {
      onNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    try {
      await postWmsOutbound("orders", form);
      onNotice({ type: "success", message: "Order entry saved successfully" });
      onClose();
      await onDone();
    } catch (error) {
      onNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save order entry",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OutboundFormFrame
      open={open}
      title={row ? "Edit Order Entry" : "Add Order Entry"}
      onClose={onClose}
      footer={
        <DialogActions
          formId="outbound-order-entry-form"
          saving={saving}
          onCancel={onClose}
          submitText={row ? "Update" : "Save Order"}
        />
      }
    >
      <form
        id="outbound-order-entry-form"
        className="grid gap-3"
        onSubmit={save}
      >
        <fieldset className="rounded-md border border-border bg-card p-2.5">
          <legend className="px-2 text-xs font-semibold text-muted-foreground">
            Order Information
          </legend>
          <div className="grid gap-2.5 lg:grid-cols-3">
            <LookupField
              label="Customer"
              value={String(form.cust_code || "")}
              displayValue={formatLookupDisplay(form, ["cust_code", "cust_name"])}
              valueField="cust_code"
              displayFields={["cust_code", "cust_name"]}
              columns={[
                { field: "cust_code", header: "Customer Code" },
                { field: "cust_name", header: "Customer Name" },
              ]}
              placeholder="Select customer"
              loadOptions={() =>
                loadOutboundCustomers(
                  value(job || {}, "company_code") || user?.company_code || "",
                  value(job || {}, "prin_code")
                )
              }
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  cust_code: selected,
                  cust_name: selectedRow
                    ? lookupText(selectedRow, "cust_name")
                    : "",
                }))
              }
            />
            <TextField
              name="order_no"
              label="Order No"
              required
              form={form}
              setForm={setForm}
            />
            <DateField
              name="order_date"
              label="Order Date"
              form={form}
              setForm={setForm}
              onPicked={(selected) =>
                setForm((current) => ({
                  ...current,
                  order_date: selected,
                  order_due_date: current.order_due_date || selected,
                }))
              }
            />
            <DateField
              name="order_due_date"
              label="Due Date"
              form={form}
              setForm={setForm}
            />
            <LookupField
              label="Currency"
              value={String(form.curr_code || "")}
              displayValue={formatLookupDisplay(form, ["curr_code", "curr_name"])}
              valueField="curr_code"
              displayFields={["curr_code", "curr_name"]}
              columns={[
                { field: "curr_code", header: "Currency Code" },
                { field: "curr_name", header: "Currency Name" },
              ]}
              placeholder="Select currency"
              loadOptions={loadCurrencies}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  curr_code: selected,
                  curr_name: selectedRow
                    ? lookupText(selectedRow, "curr_name")
                    : "",
                }))
              }
            />
            <TextField
              name="ex_rate"
              label="Exchange Rate"
              type="number"
              form={form}
              setForm={setForm}
            />
          </div>
        </fieldset>
        <fieldset className="rounded-md border border-border bg-card p-2.5">
          <legend className="px-2 text-xs font-semibold text-muted-foreground">
            Container, Timing And Reference
          </legend>
          <div className="grid gap-2.5 lg:grid-cols-4">
            {[
              "moc1","moc2","exp_container_no","exp_container_size",
              "exp_container_type","exp_container_sealno","cust_reference",
              "pack_start","pack_end","load_start","load_end",
            ].map((name) => {
              const field = orderEntryFields.find((item) => item.name === name);
              return (
                <TextField
                  key={name}
                  name={name}
                  label={field?.label || name}
                  type={field?.type || "text"}
                  form={form}
                  setForm={setForm}
                />
              );
            })}
          </div>
        </fieldset>
      </form>
    </OutboundFormFrame>
  );
}
// ── DateFieldWithClear ─────────────────────────────────────────────────────
function DateFieldWithClear({
  name,
  label,
  form,
  setForm,
  onPicked,
}: {
  name: string;
  label: string;
  form: WmsRow;
  setForm: React.Dispatch<React.SetStateAction<WmsRow>>;
  onPicked?: (selected: string) => void;
}) {
  const hasValue = Boolean(form[name]);

  return (
    <div className="relative">
      <DateField
        name={name}
        label={label}
        form={form}
        setForm={setForm}
        onPicked={onPicked}
      />
      {hasValue && (
        <button
          type="button"
          title="Clear date"
          onClick={() =>
            setForm((current) => ({
              ...current,
              [name]: "",
            }))
          }
          className="absolute right-2 top-[27px] rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
// ── OrderDetailDialog ──────────────────────────────────────────────────────────
function OrderDetailDialog({
  open,
  row,
  job,
  onClose,
  onDone,
  onNotice,
}: {
  open: boolean;
  row: WmsRow | null;
  job: WmsRow | null;
  orderRows: WmsRow[];
  onClose: () => void;
  onDone: () => void;
  onNotice: (notice: { type: "success" | "error"; message: string }) => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<WmsRow>({});
  const [saving, setSaving] = useState(false);
  const companyCode =
    value(job || {}, "company_code") || user?.company_code || "";
  const location = useLocation();
  const prinCode =
    value(job || {}, "prin_code") ||
    new URLSearchParams(location.search).get("principal_code") ||
    "";
  const jobNo = value(job || {}, "job_no");

  useEffect(() => {
    setForm({
      company_code:
        value(job || {}, "company_code") || user?.company_code || "",
      prin_code: value(job || {}, "prin_code"),
      job_no: value(job || {}, "job_no"),
      serial_no: 0,
      qty_puom: 0,
      qty_luom: 0,
      quantity: 0,
      minperiod_exppick: 0,
      ...(row || {}),
    });
  }, [row, job, user?.company_code]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const missing = orderDetailFields.find(
      (field) => field.required && !String(form[field.name] || "").trim()
    );
    if (missing) {
      onNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    try {
      await putWmsOutbound("upsertOutboundOrderDetailManualHandler", form);
      onNotice({ type: "success", message: "Order detail saved successfully" });
      onClose();
      await onDone();
    } catch (error) {
      onNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save order detail",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OutboundFormFrame
      open={open}
      title={row ? "Edit Order Detail" : "Add Order Detail"}
      onClose={onClose}
      footer={
        <DialogActions
          formId="outbound-order-detail-form"
          saving={saving}
          onCancel={onClose}
          submitText={row ? "Update" : "Save Detail"}
        />
      }
    >
      <form
        id="outbound-order-detail-form"
        className="grid gap-3"
        onSubmit={save}
      >
        {/* Order And Product */}
        <fieldset className="rounded-md border border-border bg-card p-2.5">
          <legend className="px-2 text-xs font-semibold text-muted-foreground">
            Order And Product
          </legend>
          <div className="grid gap-2.5 xl:grid-cols-[1fr_1fr_1.25fr_240px]">
            <LookupField
              label="Order No"
              value={String(form.order_no || "")}
              displayValue={formatLookupDisplay(form, ["order_no", "cust_name"])}
              valueField="order_no"
              displayFields={["order_no", "cust_name"]}
              columns={[
                { field: "order_no", header: "Order No" },
                { field: "cust_code", header: "Customer Code" },
                { field: "cust_name", header: "Customer" },
              ]}
              placeholder="Select order"
              loadOptions={() =>
                loadOrderEntryOptions(companyCode, prinCode, jobNo)
              }
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  order_no: selected,
                  cust_code: selectedRow
                    ? lookupText(selectedRow, "cust_code")
                    : "",
                  cust_name: selectedRow
                    ? lookupText(selectedRow, "cust_name")
                    : "",
                }))
              }
            />
            <ReadOnlyField
              label="Customer"
              value={formatLookupDisplay(form, ["cust_code", "cust_name"])}
            />
            <LookupField
              label="Product"
              value={String(form.prod_code || "")}
              displayValue={formatLookupDisplay(form, ["prod_code", "prod_name"])}
              valueField="prod_code"
              displayFields={["prod_code", "prod_name"]}
              columns={[
                { field: "prod_code", header: "Product Code" },
                { field: "prod_name", header: "Product" },
                { field: "p_uom", header: "P UOM" },
                { field: "l_uom", header: "L UOM" },
              ]}
              placeholder="Select product"
              loadOptions={() => loadOutboundProducts(companyCode, prinCode)}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  prod_code: selected,
                  prod_name: selectedRow
                    ? lookupText(selectedRow, "prod_name")
                    : "",
                  p_uom: selectedRow ? lookupText(selectedRow, "p_uom") : "",
                  l_uom: selectedRow ? lookupText(selectedRow, "l_uom") : "",
                  uppp: selectedRow
                    ? lookupText(selectedRow, "uppp")
                    : current.uppp,
                  act_order_qty: selectedRow
                    ? lookupText(selectedRow, "qty_avl")
                    : 0,
                  site_code: "",
                  loc_code_from: "",
                  loc_code_to: "",
                  batch_no: "",
                  lot_no: "",
                }))
              }
            />
            <AvailableQuantityCard value={Number(form.act_order_qty || 0)} />
          </div>
        </fieldset>

        {/* Stock Location */}
        <fieldset className="rounded-md border border-border bg-card p-2.5">
          <legend className="px-2 text-xs font-semibold text-muted-foreground">
            Stock Location
          </legend>
          <div className="grid gap-2.5 lg:grid-cols-5">
            <LookupField
              label="Site Code"
              value={String(form.site_code || "")}
              valueField="site_code"
              displayFields={["site_code"]}
              columns={[{ field: "site_code", header: "Site Code" }]}
              placeholder="Select site"
              disabled={!form.prod_code}
              loadOptions={() =>
                loadStockSites(
                  companyCode,
                  prinCode,
                  String(form.prod_code || "")
                )
              }
              onChange={(selected) =>
                setForm((current) => ({
                  ...current,
                  site_code: selected,
                  loc_code_from: "",
                  loc_code_to: "",
                  batch_no: "",
                  lot_no: "",
                }))
              }
            />
            <LookupField
              label="Location From"
              value={String(form.loc_code_from || "")}
              valueField="location_code"
              displayFields={["location_code"]}
              columns={[{ field: "location_code", header: "Location" }]}
              placeholder="Select location"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() =>
                loadStockLocations(
                  companyCode,
                  prinCode,
                  String(form.prod_code || ""),
                  String(form.site_code || "")
                )
              }
              onChange={(selected) =>
                setForm((current) => ({
                  ...current,
                  loc_code_from: selected,
                  loc_code_to: current.loc_code_to || selected,
                }))
              }
            />
            <LookupField
              label="Location To"
              value={String(form.loc_code_to || "")}
              valueField="location_code"
              displayFields={["location_code"]}
              columns={[{ field: "location_code", header: "Location" }]}
              placeholder="Select location"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() =>
                loadStockLocations(
                  companyCode,
                  prinCode,
                  String(form.prod_code || ""),
                  String(form.site_code || "")
                )
              }
              onChange={(selected) =>
                setForm((current) => ({ ...current, loc_code_to: selected }))
              }
            />
            <LookupField
              label="Batch No"
              value={String(form.batch_no || "")}
              valueField="batch_no"
              displayFields={["batch_no"]}
              columns={[{ field: "batch_no", header: "Batch No" }]}
              placeholder="Select batch"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() =>
                loadStockBatches(
                  companyCode,
                  String(form.prod_code || ""),
                  String(form.site_code || "")
                )
              }
              onChange={(selected) =>
                setForm((current) => ({ ...current, batch_no: selected }))
              }
            />
            <LookupField
              label="Lot No"
              value={String(form.lot_no || "")}
              valueField="lot_no"
              displayFields={["lot_no"]}
              columns={[{ field: "lot_no", header: "Lot No" }]}
              placeholder="Select lot"
              disabled={!form.site_code || !form.prod_code}
              loadOptions={() =>
                loadStockLots(
                  companyCode,
                  String(form.prod_code || ""),
                  String(form.site_code || "")
                )
              }
              onChange={(selected) =>
                setForm((current) => ({ ...current, lot_no: selected }))
              }
            />
          </div>
        </fieldset>

        {/* Dates And Conversion */}
        <fieldset className="rounded-md border border-border bg-card p-2.5">
          <legend className="px-2 text-xs font-semibold text-muted-foreground">
            Dates And Conversion
          </legend>
          <div className="grid gap-2.5 lg:grid-cols-5">
        <DateFieldWithClear
          name="production_from"
          label="Production From"
          form={form}
          setForm={setForm}
          onPicked={(selected) =>
            setForm((current) => ({
              ...current,
              production_from: selected,
              production_to: current.production_to || selected,
            }))
          }
        />
        <DateFieldWithClear
          name="production_to"
          label="Production To"
          form={form}
          setForm={setForm}
        />
        <DateFieldWithClear
          name="expiry_from"
          label="Expiry From"
          form={form}
          setForm={setForm}
          onPicked={(selected) =>
            setForm((current) => ({
              ...current,
              expiry_from: selected,
              expiry_to: current.expiry_to || selected,
            }))
          }
        />
        <DateFieldWithClear
          name="expiry_to"
          label="Expiry To"
          form={form}
          setForm={setForm}
        />
            <ReadOnlyField label="UPPP" value={String(form.uppp || "")} />
          </div>
        </fieldset>

        {/* Quantity + Salesman */}
        <div className="grid items-start gap-3 lg:grid-cols-[1fr_1.8fr]">
          <QuantityStrip form={form} setForm={setForm} />
          <div className="grid content-start gap-2.5 rounded-md border border-border bg-card p-2.5 md:grid-cols-2">
            <TextField
              name="salesman_code"
              label="Salesman"
              form={form}
              setForm={setForm}
            />
            <TextField
              name="minperiod_exppick"
              label="Min Expiry Period"
              type="number"
              form={form}
              setForm={setForm}
            />
          </div>
        </div>
      </form>
    </OutboundFormFrame>
  );
}

// ── EdiImportButton ────────────────────────────────────────────────────────────
function EdiImportButton({
  jobNo,
  prinCode,
  companyCode,
  loginid,
  onDone,
  onNotice,
}: {
  jobNo: string;
  prinCode: string;
  companyCode: string;
  loginid: string;
  onDone: () => void;
  onNotice: (notice: { type: "success" | "error"; message: string }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      await postWmsOutbound("copyEDIToOrderDetailHandler", {
        login_id: loginid,
        job_no: jobNo,
        prin_code: prinCode,
        company_code: companyCode,
        file_name: file.name,
      });
      onNotice({ type: "success", message: "EDI copy submitted successfully" });
      await onDone();
    } catch (error) {
      onNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to process EDI import",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <FileUp size={14} /> {busy ? "Importing..." : "EDI Import"}
      </Button>
    </>
  );
}