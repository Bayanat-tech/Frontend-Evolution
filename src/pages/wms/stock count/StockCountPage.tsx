import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, RefreshCw, ArrowLeft, ClipboardList, Calendar, MapPin, FileText, Activity, ShieldCheck, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { procBuildDynamicSqlCommonBase } from "../../../api/wms";
import StockCountForm from "./AddStockCount";
import { useAuth } from "../../../state/AuthContext";

type WmsRow = Record<string, unknown>;
type ViewMode = "list" | "editor";

function val(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? "");
}

function formatDate(input: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB");
}

/* ── Freight-style status badge ─────────────────────────────── */
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

/* ── Dense field class (matches freight) ───────────────────── */
const fieldClassName =
  "flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

/* ── Reusable form field components ────────────────────────── */
function FormInput({
  label,
  value,
  onChange,
  type = "text",
  step,
  required,
  placeholder,
  className = "",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      <span>
        {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
      </span>
      <input
        className={`${fieldClassName} ${type === "number" ? "text-right tabular-nums" : ""}`}
        value={value}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(`${label} is required`)}
        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      <span>
        {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
      </span>
      <select
        className={fieldClassName}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  compact,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      {label}
      <textarea
        className={`${fieldClassName} ${compact ? "min-h-8" : "min-h-10"} resize-y py-1`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ── Section panel (matches freight) ───────────────────────── */
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
    <section className={`freight-panel overflow-hidden rounded-md border bg-background shadow-sm ${className}`}>
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={12} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold uppercase text-foreground">{title}</h3>
          </div>
        </div>
        {meta && <span className="text-[10px] text-muted-foreground">{meta}</span>}
      </div>
      <div className="freight-panel-body">{children}</div>
    </section>
  );
}

/* ── Header chip (matches freight) ─────────────────────────── */
function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-52 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px]">
      <span className="font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </span>
  );
}

/* ── Tab button (matches freight) ──────────────────────────── */
function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { key: string; label: string; icon: typeof ClipboardList };
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

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function StockCountPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [selectedRow, setSelectedRow] = useState<WmsRow | null>(null);
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const { user } = useAuth();

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await procBuildDynamicSqlCommonBase({
        parameter: "STOCKCOUNT_document_page",
        loginid: user?.loginid || "",
      });
      const normalized = [...(data as any[])]
        .sort((a, b) => new Date(b.COUNT_DATE ?? 0).getTime() - new Date(a.COUNT_DATE ?? 0).getTime())
        .map((row) => {
          const n: WmsRow = { ...row };
          Object.entries(row).forEach(([k, v]) => {
            n[k.toLowerCase()] = v;
          });
          return n;
        });
      setRows(normalized);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load stock counts.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const openAdd = () => {
    setSelectedRow(null);
    setFormMode("add");
    setView("editor");
  };

  const openEdit = (row: WmsRow) => {
    setSelectedRow(row);
    setFormMode("edit");
    setView("editor");
  };

  const handleCloseForm = (shouldRefetch?: boolean) => {
    setView("list");
    if (shouldRefetch) {
      void loadRows(false);
      setNotice({ type: "success", message: "Stock count saved successfully." });
    }
  };

  /* ── Columns (freight-style compact) ─────────────────────── */
  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "count_no",
        header: "Count No",
        size: 120,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline text-left text-[11.5px] cursor-pointer"
            onClick={() => openEdit(row.original)}
          >
            {val(row.original, "count_no")}
          </button>
        ),
      },
      {
        accessorKey: "count_date",
        header: "Count Date",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(val(row.original, "count_date"))}
          </span>
        ),
      },
      {
        accessorKey: "confirmed",
        header: "Confirmed",
        size: 100,
        cell: ({ row }) => {
          const confirmed = val(row.original, "confirmed");
          return (
            <span className={statusBadgeClass(confirmed)}>
              {statusLabel(confirmed)}
            </span>
          );
        },
      },
      {
        accessorKey: "confirmed_date",
        header: "Confirmed Date",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(val(row.original, "confirmed_date")) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "site_code_from",
        header: "Site Code From",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-medium">
            {val(row.original, "site_code_from") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "site_code_to",
        header: "Site Code To",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-medium">
            {val(row.original, "site_code_to") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "from_location",
        header: "Location From",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {val(row.original, "from_location") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "to_location",
        header: "Location To",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {val(row.original, "to_location") || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        size: 80,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Edit count"
              onClick={() => openEdit(row.original)}
            >
              <Edit size={13} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  /* ── RENDER EDITOR (FULL PAGE) ───────────────────────────── */
  if (view === "editor") {
    return (
      <StockCountForm
        mode={formMode}
        editRowData={selectedRow}
        onClose={handleCloseForm}
      />
    );
  }

  /* ── RENDER LIST ─────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          {/* <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ClipboardList size={15} />
          </div> */}
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Stock Count Listing
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      {/* Toolbar + Table */}
      <DataTable
        columns={columns}
        data={rows}
        toolbar={
          <div className="flex items-center gap-2">
            {/* <button
              type="button"
              onClick={() => loadRows()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button> */}
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Stock Count
            </button>
          </div>
        }
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search count no, site..."
        loading={loading}
        height="calc(100dvh - 180px)"
        density="grid"
        enablePagination
        pageSize={25}
        enableExport
        exportFilename="stock-count-list.csv"
        getRowId={(row, index) => val(row, "count_no") || String(index)}
      />
    </section>
  );
}

export default StockCountPage;