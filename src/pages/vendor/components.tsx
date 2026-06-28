import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, CheckCircle2, Clock, FileText, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { cn } from "../../lib/utils";
import type { VendorStatusKey, VendorTableRow } from "./vendorTypes";

export function VendorPageHeader({
  title,
  eyebrow = "Vendor System",
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="vendor-page-header flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="m-0 text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

export function RefreshButton({ loading, onClick }: { loading?: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={loading}>
      <RefreshCw className={cn(loading && "animate-spin")} size={14} /> Refresh
    </Button>
  );
}

export function StatCard({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "good" | "warn" | "danger" }) {
  const toneClass =
    tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-primary/10 text-primary";
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent>
        <strong className={cn("inline-flex min-w-12 rounded-md px-2.5 py-1 text-lg", toneClass)}>{value}</strong>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ value }: { value: unknown }) {
  const text = String(value || "Draft").replace(/_/g, " ");
  const lower = text.toLowerCase();
  const tone =
    lower.includes("reject") ? "border-rose-200 bg-rose-50 text-rose-700" :
    lower.includes("sent") ? "border-amber-200 bg-amber-50 text-amber-700" :
    lower.includes("approve") || lower.includes("closed") ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    lower.includes("pending") || lower.includes("progress") ? "border-sky-200 bg-sky-50 text-sky-700" :
    "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize", tone)}>{text}</span>;
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly,
  required,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  options?: { label: string; value: string }[];
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-muted-foreground">{label}{required ? " *" : ""}</span>
      {options ? (
        <Select value={value} onChange={(event) => onChange(event.target.value)} disabled={readOnly} required={required}>
          <option value="">Select</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} type={type} readOnly={readOnly} required={required} />
      )}
    </label>
  );
}

export function TabStrip<T extends string>({ tabs, value, onChange }: { tabs: { label: string; value: T; icon?: VendorStatusKey }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const Icon = statusIcon(tab.icon);
        return (
          <button
            key={tab.value}
            type="button"
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold transition-colors",
              value === tab.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
            )}
            onClick={() => onChange(tab.value)}
          >
            {Icon && <Icon size={14} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function makeVendorColumns(extra?: ColumnDef<VendorTableRow>[]): ColumnDef<VendorTableRow>[] {
  return [
    {
      accessorKey: "DOC_NO",
      header: "Doc No",
      cell: ({ getValue }) => <span className="font-semibold text-primary">{String(getValue() || "")}</span>,
    },
    { accessorKey: "DOC_DATE", header: "Doc Date" },
    { accessorKey: "REF_DOC_NO", header: "Ref Doc No" },
    { accessorKey: "INVOICE_NUMBER", header: "Invoice No" },
    { accessorKey: "INVOICE_DATE", header: "Invoice Date" },
    { accessorKey: "REMARKS", header: "Remarks" },
    {
      accessorKey: "LAST_ACTION",
      header: "Last Action",
      cell: ({ getValue }) => <StatusBadge value={getValue()} />,
    },
    ...(extra || []),
  ];
}

function statusIcon(status?: VendorStatusKey) {
  if (status === "sentBack") return RotateCcw;
  if (status === "rejected") return XCircle;
  if (status === "closed") return CheckCircle2;
  if (status === "pending" || status === "inProgress" || status === "submitted") return Clock;
  if (status === "draft") return FileText;
  return AlertCircle;
}
