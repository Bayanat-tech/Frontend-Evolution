import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft, FileText, Layers, Plus, RotateCcw, Save, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql } from "../../../api/wms";
import { api } from "../../../api/client";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type WmsRow = Record<string, unknown>;
type NoticeState = { type: "success" | "error"; message: string } | null;
type ViewMode = "list" | "editor";

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
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function toDdMmYyyy(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

function fromYyyyMm(s: string): Date | null {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function formatMonth(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function daysBetween(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

// ─── SectionPanel (Freight structure) ────────────────────────────────────────
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">
              {title}
            </h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

// ─── Field — freight-field-label styling ─────────────────────────────────────
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
    <label
      className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}
    >
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors min-h-[14px]">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StorageComputationPage() {
  const { user } = useAuth();

  const [view, setView] = useState<ViewMode>("list");
  const [selectedTab, setSelectedTab] = useState("active");
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);

  // ✅ Search state — this was missing!
  const [query, setQuery] = useState("");

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
            (row as WmsRow).MNTHSTORAGENO ?? (row as WmsRow).mnthstorageno ?? index
          ),
        })),
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

  // ✅ Client-side filter for the search bar
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [query, rows]);

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "mnthstorageno",
        header: "Storage No",
        size: 120,
        cell: ({ row }) => (
          <span className="freight-table-link font-semibold">
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
    [],
  );

  const openAdd = () => setView("editor");
  const closeForm = () => setView("list");

  const handleSuccess = () => {
    setView("list");
    void loadRows(false);
    setNotice({
      type: "success",
      message: "Storage computation processed successfully.",
    });
  };

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <AddStorageForm
        companyCode={user?.company_code || ""}
        loginId={user?.username || user?.loginid || "Admin"}
        onClose={closeForm}
        onSuccess={handleSuccess}
        onError={(msg) => setNotice({ type: "error", message: msg })}
      />
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style
     ───────────────────────────────────────────────────────── */
  const statusTabs = [
    { key: "active", label: "Active", count: rows.length, disabled: false },
    { key: "invoiced", label: "Invoiced", count: 0, disabled: true },
    { key: "cancelled", label: "Cancelled", count: 0, disabled: true },
  ];

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Storage Computation
          </h2>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Status pills (Freight style with count badge) */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {statusTabs.map((tab) => {
          const active = selectedTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => !tab.disabled && setSelectedTab(tab.key)}
              disabled={tab.disabled}
              title={tab.disabled ? "Coming soon" : ""}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#00378C] text-white shadow-sm font-semibold"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              } ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ✅ DataTable with search + toolbar */}
      <DataTable
        columns={columns}
        data={filteredRows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search storage no, principal..."
        loading={loading}
        height="calc(100dvh - 240px)"
        minWidth={1040}
        density="grid"
        enablePagination
        pageSize={50}
        enableExport
        exportFilename="wms-storage-computation-list.csv"
        getRowId={(row, index) => String((row as WmsRow)._id || index)}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Storage
            </button>
          </div>
        }
      />
    </section>
  );
}

// ─── Full Page Add Storage Form ──────────────────────────────────────────────
function AddStorageForm({
  companyCode,
  loginId,
  onClose,
  onSuccess,
  onError,
}: {
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [processing, setProcessing] = useState(false);

  const [prinCode, setPrinCode] = useState("");
  const [prinName, setPrinName] = useState("");
  const [storageMonth, setStorageMonth] = useState("");
  const [invStartDate, setInvStartDate] = useState<Date | null>(null);
  const [invEndDate, setInvEndDate] = useState<Date | null>(null);
  const [lastInvoiceDate, setLastInvoiceDate] = useState("—");

  const noDays = daysBetween(invStartDate, invEndDate);

  const [chargeMasterRows, setChargeMasterRows] = useState<WmsRow[]>([]);
  const [chargeMasterLoading, setChargeMasterLoading] = useState(false);
  const [detailRows, setDetailRows] = useState<WmsRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [chargeType, setChargeType] = useState("");
  const [siteInd, setSiteInd] = useState("");
  const [chargeTime, setChargeTime] = useState("");
  const [freeStorage, setFreeStorage] = useState("");
  const [inbJobwiseBill, setInbJobwiseBill] = useState("");

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

      const withInv = detMapped
        .filter((r) => val(r, "inv_date"))
        .sort(
          (a, b) =>
            new Date(val(b, "inv_date")).getTime() -
            new Date(val(a, "inv_date")).getTime(),
        );
      setLastInvoiceDate(
        withInv.length > 0 ? formatDate(val(withInv[0], "inv_date")) : "—",
      );
    } catch {
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }

    try {
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
    setChargeTime("");
    setFreeStorage("");
    setInbJobwiseBill("");
  };

  const canSubmit =
    prinCode.trim() && storageMonth && invStartDate && invEndDate && !processing;

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
        vals10: "N",
      });

      const data = res.data;
      if (data?.success === false) {
        onError(data?.message || "Process failed.");
      } else {
        onSuccess();
      }
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to process storage.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const chargeMasterCols = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      { accessorKey: "site_ind", header: "Site Ind", size: 90, cell: ({ row }) => val(row.original, "site_ind") },
      { accessorKey: "foc", header: "Foc", size: 80, cell: ({ row }) => val(row.original, "foc") },
      { accessorKey: "charge_time", header: "Charge Time", size: 110, cell: ({ row }) => val(row.original, "charge_time") },
      { accessorKey: "cpu", header: "CPU", size: 80, cell: ({ row }) => val(row.original, "cpu") },
      { accessorKey: "amt_lumpsum", header: "Amt Lumpsum", size: 120, cell: ({ row }) => val(row.original, "amt_lumpsum") },
    ],
    [],
  );

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
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page Freight style
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                New Storage
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                Draft
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={processing}>
            <ArrowLeft size={14} /> List
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={processing}>
            <RotateCcw size={14} /> Reset
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={processing}>
            <X size={14} /> Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            onClick={handleProcess}
          >
            <Save size={14} /> {processing ? "Processing" : "Process"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
          <SectionPanel title="Details" icon={FileText}>
            <div className="grid gap-3">
              <Field label="Principal" required>
                <LookupField
                  label=""
                  value={prinCode}
                  displayValue={prinCode && prinName ? `${prinCode} - ${prinName}` : prinCode}
                  valueField="prin_code"
                  displayFields={["prin_code", "prin_name"]}
                  columns={[
                    { field: "prin_code", header: "Principal Code" },
                    { field: "prin_name", header: "Principal Name" },
                  ]}
                  placeholder="Select principal"
                  loadOptions={async () => {
                    const rows = await executeWmsInboundSql(
                      `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${companyCode}' ORDER BY PRIN_CODE`,
                    );
                    return rows.map((r) => normalizeRow(r as WmsRow)) as WmsRow[];
                  }}
                  onChange={(selected, selectedRow) => {
                    void handlePrinChange(
                      selected,
                      selectedRow
                        ? String(selectedRow["prin_name"] ?? selectedRow["PRIN_NAME"] ?? "")
                        : "",
                    );
                  }}
                  compact
                />
              </Field>

              <Field label="Month" required>
                <input
                  type="month"
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px]"
                  value={storageMonth}
                  onChange={(e) => setStorageMonth(e.target.value)}
                />
              </Field>

              <Field label="Last Invoice Date">
                <Input readOnly value={lastInvoiceDate} className="bg-muted/40" />
              </Field>

              <Field label="Current Date">
                <Input readOnly value={new Date().toLocaleDateString("en-GB")} className="bg-muted/40" />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Inv Start Date" required>
                  <input
                    type="date"
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px]"
                    value={invStartDate ? invStartDate.toISOString().slice(0, 10) : ""}
                    onChange={(e) =>
                      setInvStartDate(e.target.value ? new Date(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Inv End Date" required>
                  <input
                    type="date"
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px]"
                    value={invEndDate ? invEndDate.toISOString().slice(0, 10) : ""}
                    onChange={(e) =>
                      setInvEndDate(e.target.value ? new Date(e.target.value) : null)
                    }
                  />
                </Field>
              </div>

              <Field label="Days">
                <Input
                  type="number"
                  readOnly
                  className="bg-muted/40"
                  value={noDays > 0 ? String(noDays) : ""}
                  placeholder="Auto-calculated"
                />
              </Field>

              {storageMonth && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  Storage Month:{" "}
                  <strong className="text-foreground">
                    {formatMonth(fromYyyyMm(storageMonth))}
                  </strong>
                </div>
              )}
            </div>
          </SectionPanel>

          <SectionPanel title="Storage Charge Master" icon={Layers}>
            <DataTable
              columns={chargeMasterCols}
              data={chargeMasterRows}
              loading={chargeMasterLoading}
              height="260px"
              minWidth={500}
              density="grid"
              enablePagination={false}
              searchPlaceholder=""
              subtitle=""
              getRowId={(row, i) => String((row as WmsRow)._id || i)}
            />
            {!prinCode && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Select a principal to load charge master.
              </p>
            )}
          </SectionPanel>
        </div>

        <SectionPanel title="Storage Detail" icon={Layers}>
          <DataTable
            columns={detailCols}
            data={detailRows}
            loading={detailLoading}
            height="220px"
            minWidth={900}
            density="grid"
            enablePagination={false}
            searchPlaceholder=""
            subtitle=""
            getRowId={(row, i) => String((row as WmsRow)._id || i)}
          />
          {!prinCode && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Select a principal to load storage detail.
            </p>
          )}
        </SectionPanel>
      </div>
    </section>
  );
}

export default StorageComputationPage;