import { ReactNode } from "react";
import { ArrowLeft, Save, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import type { WmsRow } from "./Outboundtypes";
import { toDateInputValue, recalcQuantity } from "./OutboundHelpers";

// ── OutboundFormFrame ──────────────────────────────────────────────────────────
export function OutboundFormFrame({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    // Fixed + full-viewport so it visually covers the listing underneath (no
    // conditional render needed in the screen file) — but no backdrop dim, no
    // blur, no centered card: it fills the screen like an actual page.
    <div className="outbound-form-compact absolute inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto grid max-w-[1400px] gap-2.5 p-3 md:p-4">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              aria-label="Back"
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft size={15} />
            </button>
            <span className="h-7 w-1 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 leading-tight">
              <p className="m-0 mb-0.5 text-[11px] font-bold uppercase leading-none tracking-[0.18em] text-primary">
                Outbound Job
              </p>
              <h1 className="m-0 truncate text-lg font-semibold leading-tight text-foreground">{title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {footer}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── DialogActions ──────────────────────────────────────────────────────────────
export function DialogActions({
  saving,
  onCancel,
  submitText,
  formId,
}: {
  saving: boolean;
  onCancel: () => void;
  submitText: string;
  formId?: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        <X size={15} /> Cancel
      </Button>
      <Button disabled={saving} form={formId} type="submit">
        <Save size={15} /> {saving ? "Saving..." : submitText}
      </Button>
    </div>
  );
}

// ── TextField ──────────────────────────────────────────────────────────────────
export function TextField({
  name,
  label,
  form,
  setForm,
  type = "text",
  required,
  onChanged,
}: {
  name: string;
  label: string;
  form: WmsRow;
  setForm: (updater: (current: WmsRow) => WmsRow) => void;
  type?: string;
  required?: boolean;
  onChanged?: (next: WmsRow) => void;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      <Input
        type={type}
        value={String(form[name] || "")}
        onChange={(event) => {
          const next = { ...form, [name]: event.target.value };
          setForm(() => next);
          onChanged?.(next);
        }}
      />
    </label>
  );
}

// ── DateField ──────────────────────────────────────────────────────────────────
export function DateField({
  name,
  label,
  form,
  setForm,
  onPicked,
}: {
  name: string;
  label: string;
  form: WmsRow;
  setForm: (updater: (current: WmsRow) => WmsRow) => void;
  onPicked?: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input
        type="date"
        value={toDateInputValue(String(form[name] || ""))}
        onChange={(event) => {
          if (onPicked) onPicked(event.target.value);
          else setForm((current) => ({ ...current, [name]: event.target.value }));
        }}
      />
    </label>
  );
}

// ── ReadOnlyField ──────────────────────────────────────────────────────────────
export function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input readOnly className="bg-muted/40" value={value || ""} />
    </label>
  );
}

// ── QuantityInput ──────────────────────────────────────────────────────────────
export function QuantityInput({
  label,
  name,
  unit,
  form,
  setForm,
  disabled,
}: {
  label: string;
  name: string;
  unit: string;
  form: WmsRow;
  setForm: (updater: (current: WmsRow) => WmsRow) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="flex h-10 overflow-hidden rounded-md border bg-background">
        <Input
          disabled={disabled}
          className="h-10 rounded-none border-0 text-right shadow-none focus-visible:ring-0"
          type="number"
          value={String(form[name] || "")}
          onChange={(event) => {
            const next = { ...form, [name]: event.target.value };
            setForm(() => next);
            if (name === "qty_puom" || name === "qty_luom")
              recalcQuantity(next, setForm);
          }}
        />
        <span className="grid min-w-14 place-items-center border-l bg-muted/50 px-3 text-sm font-semibold text-muted-foreground">
          {unit || "-"}
        </span>
      </div>
    </label>
  );
}

// ── QuantityStrip ──────────────────────────────────────────────────────────────
export function QuantityStrip({
  form,
  setForm,
}: {
  form: WmsRow;
  setForm: (updater: (current: WmsRow) => WmsRow) => void;
}) {
  const pUom = String(form.p_uom || "");
  const lUom = String(form.l_uom || pUom || "");
  return (
    <fieldset className="rounded-md border border-border bg-card p-2.5">
      <legend className="px-2 text-xs font-semibold text-muted-foreground">
        Quantity
      </legend>
      <div className="grid gap-2 md:grid-cols-3">
        <QuantityInput label="Primary" name="qty_puom" unit={pUom} form={form} setForm={setForm} />
        <QuantityInput label="Lowest" name="qty_luom" unit={lUom} form={form} setForm={setForm} disabled={pUom === lUom} />
        <QuantityInput label="Total" name="quantity" unit={lUom} form={form} setForm={setForm} />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <QuantityInput label="Actual Primary" name="qty_puom" unit={pUom} form={form} setForm={setForm} disabled />
        <QuantityInput label="Actual Lowest" name="qty_luom" unit={lUom} form={form} setForm={setForm} disabled />
        <QuantityInput label="Actual Total" name="quantity" unit={lUom} form={form} setForm={setForm} disabled />
      </div>
    </fieldset>
  );
}

// ── AvailableQuantityCard ──────────────────────────────────────────────────────
export function AvailableQuantityCard({ value }: { value: number }) {
  return (
    <div className="self-stretch overflow-hidden rounded-sm border border-primary bg-primary/5">
      <div className="bg-primary px-3 py-2 text-center text-sm font-bold text-primary-foreground">
        Available Quantity
      </div>
      <div className="grid min-h-[52px] place-items-center px-3 py-2">
        <span className="text-2xl font-black leading-none text-primary">
          {Number(value || 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ── Info ───────────────────────────────────────────────────────────────────────
export function Info({ label, value: infoValue }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm">{infoValue || "-"}</strong>
    </div>
  );
}

// ── JobClassPill ───────────────────────────────────────────────────────────────
export function JobClassPill({ code }: { code: string }) {
  const labels: Record<string, string> = {
    N: "Normal", NP: "Normal HHT/RFID/AR", M: "Manual",
    S: "Sales Return", SP: "Sales Return HHT/RFID/AR",
    NI: "Non-Inventory", CP: "Co-Packing", MR: "Misc Receipts",
    IWT: "Inter Warehouse Transfer", CD: "Cross Docking",
  };
  const label = labels[code] || code || "N/A";
  return (
    <span className="inline-flex max-w-[170px] items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {label}
    </span>
  );
}

// ── ConfirmToolbar ─────────────────────────────────────────────────────────────
export function ConfirmToolbar({
  options,
  setOptions,
  onConfirm,
  disabled,
}: {
  options: { preference: string; min_qty: string; exp_period: string; confirm_date: string };
  setOptions: (options: { preference: string; min_qty: string; exp_period: string; confirm_date: string }) => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={disabled} onClick={onConfirm}>
        Confirm Selected
      </Button>
    </div>
  );
}