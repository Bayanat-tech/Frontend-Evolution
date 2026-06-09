import type { ColumnDef } from "@tanstack/react-table";
import { jobClassLabels, inboundJobsPath } from "../config/staticData";

export type WmsRow = Record<string, unknown>;

// ─── value access ────────────────────────────────────────────────────────────
export function value(row: WmsRow, key: string): string {
  return String(row[key] ?? row[key.toUpperCase()] ?? "");
}

export function normalizeRow(row: WmsRow): WmsRow {
  const out: WmsRow = { ...row };
  Object.entries(row || {}).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

// ─── formatting ─────────────────────────────────────────────────────────────
export function formatDate(input: string): string {
  if (!input) return "";
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? input : d.toLocaleDateString("en-GB");
}

export function formatCellValue(row: WmsRow, key: string): string {
  const cell = value(row, key);
  return key.includes("date") ? formatDate(cell) : cell;
}

export function flagBadge(flag: string) {
  const yes = flag === "Y" || flag.toLowerCase() === "yes";
  return (
    <span className={yes ? "text-emerald-700" : "text-muted-foreground"}>
      {yes ? "Yes" : "No"}
    </span>
  );
}

// ─── predicates ──────────────────────────────────────────────────────────────
export function hasDate(input: string): boolean {
  return Boolean(input && input !== "N/A" && input !== "null");
}

export function isCanceled(row: WmsRow): boolean {
  return value(row, "canceled") === "Y" || hasDate(value(row, "cancel_date"));
}

export function filterJobByTab(row: WmsRow, tab: string): boolean {
  const canceled  = isCanceled(row);
  const confirmed = hasDate(value(row, "confirm_date"));
  if (tab === "cancel")    return canceled || hasDate(value(row, "cancel_date"));
  if (tab === "confirmed") return confirmed && !canceled;
  return !confirmed && !canceled;
}

// ─── SQL ─────────────────────────────────────────────────────────────────────
export function sqlEscape(input: string): string {
  return String(input || "").replace(/'/g, "''");
}

// ─── misc ────────────────────────────────────────────────────────────────────
export function makeEmptyJob(companyCode = "") {
  return {
    company_code:   companyCode,
    job_type:       "IMP",
    job_class:      "N",
    transport_mode: "S",
    schedule_date:  new Date().toISOString().slice(0, 10),
  };
}

export function parseInboundView(pathname: string) {
  const parts     = pathname.split("/").filter(Boolean);
  const viewIndex = parts.findIndex((p) => p.toLowerCase() === "view");
  return {
    jobNo: viewIndex >= 0 ? parts[viewIndex + 1] : "",
    tab:   viewIndex >= 0 ? parts[viewIndex + 2] : "",
  };
}

export function inboundJobDetailPath(row: WmsRow): string {
  const jobNo         = encodeURIComponent(value(row, "job_no"));
  const principalCode = encodeURIComponent(value(row, "prin_code"));
  return `${inboundJobsPath}/view/${jobNo}/shipment_details${principalCode ? `?principal_code=${principalCode}` : ""}`;
}

export function locationSearchPrincipal(job: WmsRow | null): string {
  const prin = value(job || {}, "prin_code");
  return prin ? `?principal_code=${encodeURIComponent(prin)}` : "";
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
export function JobClassPill({ code }: { code: string }) {
  const label = jobClassLabels[code] || code || "N/A";
  return (
    <span className="inline-flex max-w-[170px] items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {label}
    </span>
  );
}

// ─── column factory ───────────────────────────────────────────────────────────
export function makeColumns(
  columns: { key: string; label: string; size?: number }[],
  selectable = false,
  onEdit?: (row: WmsRow) => void,
  onDelete?: (row: WmsRow) => void,
): ColumnDef<WmsRow>[] {
  const cols: ColumnDef<WmsRow>[] = columns.map((col) => ({
    accessorKey: col.key,
    header:      col.label,
    size:        col.size || 140,
    cell:        ({ row }) => formatCellValue(row.original, col.key),
  }));

  if (onEdit || onDelete) {
    cols.push({
      id:                 "actions",
      header:             "",
      size:               80,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              className="rounded p-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              title="Edit"
              onClick={() => onEdit(row.original)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              className="rounded p-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
              onClick={() => onDelete(row.original)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
        </div>
      ),
    });
  }

  if (selectable) {
    cols.unshift({
      id:                "select",
      header:            ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      size:              40,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    });
  }

  return cols;
}

// ─── quantity recalc ─────────────────────────────────────────────────────────
export function recalcQuantity(
  formData: WmsRow,
  field: "qty_puom" | "qty_luom",
  rawValue: string,
): Partial<WmsRow> {
  const val      = rawValue.charAt(0) === "-" ? "" : rawValue;
  const uppp     = Number(formData.uppp      ?? 1);
  const uomCount = Number(formData.uom_count ?? 1);
  const qtyPuom  = field === "qty_puom" ? Number(val) : Number(formData.qty_puom ?? 0);
  const qtyLuom  = field === "qty_luom" ? Number(val) : Number(formData.qty_luom ?? 0);
  const quantity = uomCount <= 1 ? qtyPuom + qtyLuom : qtyPuom * uppp + qtyLuom;
  return { [field]: val, quantity };
}

export function stripUiFields(form: WmsRow): WmsRow {
  // 1. lowercase all keys (handles uppercase DB response keys)
  const lowercased = Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k.toLowerCase(), v])
  );

  // 2. strip UI-only / computed fields
  const {
    uom_count,
    prod_code_display,
    country_origin_display,
    manufacturer_display,
    qty_string,
    qty_arrived_string,
    qty_netarrived_string,
    qty_tally_string,
    qty_confirm_string,
    receive_qty_string,
    net_receive_string,
    prod_name,
    allocated,
    clearance,
    selected,
    updated_at,
    updated_by,
    created_at,
    created_by,
    packdet_no,
    ...payload
  } = lowercased;

  return payload;
}