import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql } from "../../../api/wms";
import { api } from "../../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type WmsRow = Record<string, unknown>;
type NoticeState = { type: "success" | "error"; message: string } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function val(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "");
}

function formatDate(input: string) {
  if (!input || input === "N/A") return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-GB");
}

function normalizeRow(row: WmsRow): WmsRow {
  const out: WmsRow = { ...row };
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

/** Convert Date to DD/MM/YYYY string for API */
function toDdMmYyyy(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

/** Get YYYY-MM value from a Date (for month input) */
function toYyyyMm(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse YYYY-MM string to Date */
function fromYyyyMm(s: string): Date | null {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

/** Format month Date to "Apr 2026" style */
function formatMonth(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Days between two dates inclusive */
function daysBetween(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  children,
  horizontal,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  horizontal?: boolean;
}) {
  if (horizontal) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-36 shrink-0 text-xs font-semibold text-foreground">
          {label}
          {required && <strong className="text-destructive"> *</strong>}
        </span>
        <div className="flex-1">{children}</div>
      </div>
    );
  }
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label} horizontal>
      <Input readOnly className="bg-muted/40 text-sm" value={value || "—"} />
    </Field>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { label: "Active", value: "active" },
  { label: "Invoiced", value: "invoiced", disabled: true },
  { label: "Cancelled", value: "cancelled", disabled: true },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export function StorageComputationPage() {
  const { user } = useAuth();

  const [selectedTab] = useState("active");
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const raw = await executeWmsInboundSql(`
        SELECT H.*, P.PRIN_NAME
        FROM MNTSTORAGE_HDR H
        LEFT JOIN MS_PRINCIPAL P ON P.PRIN_CODE = H.PRIN_CODE
        ORDER BY H.MNTHSTORAGENO DESC
      `);
      const arr = Array.isArray(raw) ? raw : [];
      setRows(
        arr.map((row, index) => ({
          ...normalizeRow(row as WmsRow),
          _id: String(
            (row as WmsRow).MNTHSTORAGENO ??
              (row as WmsRow).mnthstorageno ??
              index
          ),
        }))
      );
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load storage computation data.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "mnthstorageno",
        header: "Storage No",
        size: 120,
        cell: ({ row }) => (
          <span className="font-semibold text-primary">
            {val(row.original, "mnthstorageno")}
          </span>
        ),
      },
      {
        id: "principal",
        header: "Principal",
        size: 280,
        cell: ({ row }) => {
          const code = val(row.original, "prin_code");
          const name = val(row.original, "prin_name");
          return [code, name].filter(Boolean).join(" - ") || "—";
        },
      },
      {
        accessorKey: "storagemonth",
        header: "Storage Month",
        size: 140,
        cell: ({ row }) => val(row.original, "storagemonth") || "—",
      },
      {
        accessorKey: "invstartdate",
        header: "Invoice Start",
        size: 130,
        cell: ({ row }) => formatDate(val(row.original, "invstartdate")),
      },
      {
        accessorKey: "invenddate",
        header: "Invoice End",
        size: 130,
        cell: ({ row }) => formatDate(val(row.original, "invenddate")),
      },
      {
        accessorKey: "nodays",
        header: "No. of Days",
        size: 110,
        cell: ({ row }) => val(row.original, "nodays") || "—",
      },
      {
        accessorKey: "chargetype",
        header: "Charge Type",
        size: 120,
        cell: ({ row }) => val(row.original, "chargetype") || "—",
      },
    ],
    []
  );

  return (
    <section className="grid gap-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            Storage Computation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage monthly storage computation records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add Storage
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Tab strip ── */}
      <div className="flex gap-2 rounded-md border bg-card p-2">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={selectedTab === tab.value ? "default" : "outline"}
            disabled={tab.disabled}
            className={tab.disabled ? "cursor-not-allowed opacity-50" : ""}
            title={tab.disabled ? "Coming soon" : ""}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ── Grid ── */}
      <DataTable
        columns={columns}
        data={rows}
        subtitle="Storage Records"
        searchPlaceholder="Search storage no, principal..."
        loading={loading}
        height="calc(100vh - 290px)"
        minWidth={1040}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => String((row as WmsRow)._id || index)}
      />

      {/* ── Add Storage Modal ── */}
      {addOpen && (
        <AddStorageModal
          open={addOpen}
          companyCode={user?.company_code || ""}
          loginId={user?.username || user?.loginid || "Admin"}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            void loadRows(false);
            setNotice({
              type: "success",
              message: "Storage computation processed successfully.",
            });
          }}
          onError={(msg) => setNotice({ type: "error", message: msg })}
        />
      )}
    </section>
  );
}

// ─── Add Storage Modal ────────────────────────────────────────────────────────
function AddStorageModal({
  open,
  companyCode,
  loginId,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [processing, setProcessing] = useState(false);

  // ── Form state ──
  const [prinCode, setPrinCode] = useState("");
  const [prinName, setPrinName] = useState("");
  const [storageMonth, setStorageMonth] = useState(""); // YYYY-MM
  const [invStartDate, setInvStartDate] = useState<Date | null>(null);
  const [invEndDate, setInvEndDate] = useState<Date | null>(null);
  const [lastInvoiceDate, setLastInvoiceDate] = useState("—");

  // ── Derived ──
  const noDays = daysBetween(invStartDate, invEndDate);

  // ── Storage Charge Master data ──
  const [chargeMasterRows, setChargeMasterRows] = useState<WmsRow[]>([]);
  const [chargeMasterLoading, setChargeMasterLoading] = useState(false);

  // ── Storage Detail data ──
  const [detailRows, setDetailRows] = useState<WmsRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Auto-filled from charge master ──
  const [chargeType, setChargeType] = useState("");
  const [siteInd, setSiteInd] = useState("");
  const [chargeTime, setChargeTime] = useState("");
  const [freeStorage, setFreeStorage] = useState("");
  const [inbJobwiseBill, setInbJobwiseBill] = useState("");

  // ── Load charge master + detail when principal changes ──
  const handlePrinChange = async (code: string, name: string) => {
    setPrinCode(code);
    setPrinName(name);
    setChargeMasterRows([]);
    setDetailRows([]);
    setLastInvoiceDate("—");
    setChargeType("");
    setSiteInd("");
    setChargeTime("");
    setFreeStorage("");
    setInbJobwiseBill("");

    if (!code) return;

    setChargeMasterLoading(true);
    setDetailLoading(true);

    try {
      // Storage Charge Master
      const cmRaw = await executeWmsInboundSql(`
        SELECT SITE_IND, FOC, CHARGE_TIME, CPU, AMT_LUMPSUM
        FROM MS_STORAGE_CHARGE
        WHERE COMPANY_CODE = '${companyCode}'
          AND PRIN_CODE = '${code}'
      `);
      const cmArr = Array.isArray(cmRaw) ? cmRaw : [];
      const cmMapped = cmArr.map((r, i) => ({
        ...normalizeRow(r as WmsRow),
        _id: `scm_${i}`,
      }));
      setChargeMasterRows(cmMapped);
      if (cmMapped.length > 0) {
        setChargeType(val(cmMapped[0], "foc"));
        setSiteInd(val(cmMapped[0], "site_ind"));
        setChargeTime(val(cmMapped[0], "charge_time"));
      }
    } catch {
      setChargeMasterRows([]);
    } finally {
      setChargeMasterLoading(false);
    }

    try {
      // Storage Detail + derive last invoice date
      const detRaw = await executeWmsInboundSql(`
        SELECT
          D.STORAGE_NO, D.PRIN_CODE, P.PRIN_NAME,
          D.RCPT_DATE AS FROM_DATE, D.INV_DATE,
          D.CONFIRMED, D.CONFIRMED_DT AS DATECONFIRMED,
          D.COMPANY_CODE,
          COUNT(D.INV_DATE) AS NOS,
          SUM(D.VOLUME) AS TOT_VOLUME,
          SUM(D.AMOUNT) AS TOT_AMOUNT,
          MAX(NVL(D.CONSOLIDATED_INVNO,' ')) AS INV_NO,
          MAX(NVL(D.STORAGE_NO,0)) AS STORAGE_NO_MAX
        FROM MNSTORAGE_DET D, MS_PRINCIPAL P
        WHERE D.PRIN_CODE = '${code}'
          AND D.PRIN_CODE = P.PRIN_CODE
        GROUP BY
          D.STORAGE_NO, D.PRIN_CODE, P.PRIN_NAME,
          D.RCPT_DATE, D.INV_DATE,
          D.CONFIRMED, D.CONFIRMED_DT, D.COMPANY_CODE
        ORDER BY D.RCPT_DATE DESC
      `);
      const detArr = Array.isArray(detRaw) ? detRaw : [];
      const detMapped = detArr.map((r, i) => ({
        ...normalizeRow(r as WmsRow),
        _id: `det_${i}`,
        no: i + 1,
      }));
      setDetailRows(detMapped);

      // Derive last invoice date
      const withInv = detMapped
        .filter((r) => val(r, "inv_date"))
        .sort(
          (a, b) =>
            new Date(val(b, "inv_date")).getTime() -
            new Date(val(a, "inv_date")).getTime()
        );
      setLastInvoiceDate(
        withInv.length > 0 ? formatDate(val(withInv[0], "inv_date")) : "—"
      );
    } catch {
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }

    try {
      // Principal Master (free storage / job-wise bill flag)
      const prinMasterRaw = await executeWmsInboundSql(`
        SELECT FREE_STORAGE, INB_JOBWISE_BILL
        FROM MS_PRINCIPAL
        WHERE COMPANY_CODE = '${companyCode}'
          AND PRIN_CODE = '${code}'
      `);
      const prinMasterArr = Array.isArray(prinMasterRaw) ? prinMasterRaw : [];
      if (prinMasterArr.length > 0) {
        const p = normalizeRow(prinMasterArr[0] as WmsRow);
        setFreeStorage(val(p, "free_storage"));
        setInbJobwiseBill(val(p, "inb_jobwise_bill"));
      }
    } catch {
      setFreeStorage("");
      setInbJobwiseBill("");
    }
  };

  // ── Reset ──
  const handleReset = () => {
    setPrinCode("");
    setPrinName("");
    setStorageMonth("");
    setInvStartDate(null);
    setInvEndDate(null);
    setLastInvoiceDate("—");
    setChargeMasterRows([]);
    setDetailRows([]);
    setChargeType("");
    setSiteInd("");
    setChargeTime("")
        setFreeStorage("");
    setInbJobwiseBill("");

  };

  // ── Validation ──
  const canSubmit =
    prinCode.trim() &&
    storageMonth &&
    invStartDate &&
    invEndDate &&
    !processing;

  // ── Process ──
  const handleProcess = async () => {
    if (!canSubmit) return;
    setProcessing(true);
    try {
      const monthNum = String(fromYyyyMm(storageMonth)?.getMonth()! + 1);
      const res = await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
        parameter: "PROC_STORAGE_CALCULATION",
        loginid: loginId,
        val1s1: companyCode,
        val1s2: prinCode,
        val1s3: monthNum,
        val1s4: toDdMmYyyy(invStartDate),
        val1s5: toDdMmYyyy(invEndDate),
        val1s6: noDays,
        val1s7: chargeType,
        val1s8: siteInd,
        val1s9: chargeTime,
        vals10: 'N',
      });

      const data = res.data;
      if (data?.success === false) {
        onError(data?.message || "Process failed.");
      } else {
        onSuccess();
      }
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to process storage."
      );
    } finally {
      setProcessing(false);
    }
  };

  // ── Charge Master columns ──
  const chargeMasterCols = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      { accessorKey: "site_ind", header: "Site Ind", size: 90, cell: ({ row }) => val(row.original, "site_ind") },
      { accessorKey: "foc", header: "Foc", size: 80, cell: ({ row }) => val(row.original, "foc") },
      { accessorKey: "charge_time", header: "Charge Time", size: 110, cell: ({ row }) => val(row.original, "charge_time") },
      { accessorKey: "cpu", header: "CPU", size: 80, cell: ({ row }) => val(row.original, "cpu") },
      { accessorKey: "amt_lumpsum", header: "Amt Lumpsum", size: 120, cell: ({ row }) => val(row.original, "amt_lumpsum") },
    ],
    []
  );

  // ── Detail columns ──
  const detailCols = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      { id: "no", header: "No.", size: 52, cell: ({ row }) => row.index + 1 },
      {
        id: "principal",
        header: "Principal",
        size: 200,
        cell: ({ row }) =>
          `${val(row.original, "prin_code")} - ${val(row.original, "prin_name")}`,
      },
      {
        accessorKey: "from_date",
        header: "From Date",
        size: 110,
        cell: ({ row }) => formatDate(val(row.original, "from_date")),
      },
      {
        accessorKey: "inv_date",
        header: "Invoice Date",
        size: 110,
        cell: ({ row }) => formatDate(val(row.original, "inv_date")),
      },
      { accessorKey: "tot_volume", header: "Volume", size: 100, cell: ({ row }) => val(row.original, "tot_volume") },
      { accessorKey: "tot_amount", header: "Amount", size: 110, cell: ({ row }) => val(row.original, "tot_amount") },
      { accessorKey: "inv_no", header: "Inv. No", size: 130, cell: ({ row }) => val(row.original, "inv_no") },
      { accessorKey: "storage_no", header: "Storage No", size: 110, cell: ({ row }) => val(row.original, "storage_no") },
    ],
    []
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="grid max-h-[94vh] w-[min(96vw,1100px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Storage Computation
              </p>
              <h2 className="m-0 text-lg font-bold text-foreground">
                Add Storage
              </h2>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            type="button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 text-sm">
          <div className="grid gap-4">

            {/* ── Section 1: Left form + Right charge master ── */}
            <div className="grid gap-4 md:grid-cols-[340px_1fr]">

              {/* Left: form fields */}
              <fieldset className="rounded-md border border-border bg-card p-3">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Details
                </legend>
                <div className="grid gap-2.5">

                  {/* Principal */}
                  <LookupField
                    label="Principal"
                    required
                    value={prinCode}
                    displayValue={
                      prinCode && prinName ? `${prinCode} - ${prinName}` : prinCode
                    }
                    valueField="prin_code"
                    displayFields={["prin_code", "prin_name"]}
                    columns={[
                      { field: "prin_code", header: "Principal Code" },
                      { field: "prin_name", header: "Principal Name" },
                    ]}
                    placeholder="Select principal"
                    loadOptions={async () => {
                      const rows = await executeWmsInboundSql(
                        `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${companyCode}' ORDER BY PRIN_CODE`
                      );
                      return rows.map((r) =>
                        normalizeRow(r as WmsRow)
                      ) as WmsRow[];
                    }}
                    onChange={(selected, selectedRow) => {
                      void handlePrinChange(
                        selected,
                        selectedRow
                          ? String(
                              selectedRow["prin_name"] ??
                                selectedRow["PRIN_NAME"] ??
                                ""
                            )
                          : ""
                      );
                    }}
                  />

                  {/* Month */}
                  <Field label="Month" required horizontal>
                    <input
                      type="month"
                      className="ui-input h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={storageMonth}
                      onChange={(e) => setStorageMonth(e.target.value)}
                    />
                  </Field>

                  {/* Last Invoice Date (read-only, derived) */}
                  <ReadOnlyField label="Last Invoice Date" value={lastInvoiceDate} />

                  {/* Current Date (read-only) */}
                  <ReadOnlyField
                    label="Current Date"
                    value={new Date().toLocaleDateString("en-GB")}
                  />

                  {/* Inv Start + Inv End */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Inv Start Date" required>
                      <input
                        type="date"
                        className="ui-input h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={
                          invStartDate
                            ? invStartDate.toISOString().slice(0, 10)
                            : ""
                        }
                        onChange={(e) =>
                          setInvStartDate(
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                    </Field>
                    <Field label="Inv End Date" required>
                      <input
                        type="date"
                        className="ui-input h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={
                          invEndDate
                            ? invEndDate.toISOString().slice(0, 10)
                            : ""
                        }
                        onChange={(e) =>
                          setInvEndDate(
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                    </Field>
                  </div>

                  {/* Days (auto-calculated, editable) */}
                  <Field label="Days" horizontal>
                    <Input
                      type="number"
                      className="bg-muted/40"
                      readOnly
                      value={noDays > 0 ? String(noDays) : ""}
                      placeholder="Auto-calculated"
                    />
                  </Field>

                  {/* Storage Month display */}
                  {storageMonth && (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Storage Month:{" "}
                      <strong className="text-foreground">
                        {formatMonth(fromYyyyMm(storageMonth))}
                      </strong>
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Right: Storage Charge Master */}
              <fieldset className="rounded-md border border-border bg-card p-3">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Storage Charge Master
                </legend>
                <DataTable
                  columns={chargeMasterCols}
                  data={chargeMasterRows}
                  loading={chargeMasterLoading}
                  height="220px"
                  minWidth={500}
                  density="grid"
                  enablePagination={false}
                  searchPlaceholder=""
                  subtitle=""
                  getRowId={(row, i) =>
                    String((row as WmsRow)._id || i)
                  }
                />
                {!prinCode && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Select a principal to load charge master.
                  </p>
                )}
              </fieldset>
            </div>

            {/* ── Section 2: Storage Detail grid ── */}
            <fieldset className="rounded-md border border-border bg-card p-3">
              <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Storage Detail
              </legend>
              <DataTable
                columns={detailCols}
                data={detailRows}
                loading={detailLoading}
                height="200px"
                minWidth={900}
                density="grid"
                enablePagination={false}
                searchPlaceholder=""
                subtitle=""
                getRowId={(row, i) => String((row as WmsRow)._id || i)}
              />
              {!prinCode && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Select a principal to load storage detail.
                </p>
              )}
            </fieldset>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-between gap-2 border-t bg-card px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            onClick={handleReset}
          >
            Initialize
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={processing}
            >
              <X size={14} /> Close
            </Button>
            <Button
              size="sm"
              disabled={!canSubmit}
              onClick={handleProcess}
            >
              <Save size={14} />
              {processing ? "Processing..." : "Process"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StorageComputationPage;