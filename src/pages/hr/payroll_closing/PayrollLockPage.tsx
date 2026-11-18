import { Lock, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../state/AuthContext";

/* ================= TYPES ================= */

type TPayrollLock = {
  pay_month: string;
  pay_year: string;
  cutoff_date: string; // yyyy-MM-dd for the date input
  locked: boolean;
};

const EMPTY_FORM: TPayrollLock = {
  pay_month: "",
  pay_year: "",
  cutoff_date: "",
  locked: false,
};

/* ================= PAGE ================= */

export function PayrollLock() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? ""; // TODO: pass to the API calls
  const companyCode = user?.company_code ?? ""; // company is hidden, taken from session

  const [form, setForm] = useState<TPayrollLock>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const patch = (p: Partial<TPayrollLock>) => {
    setForm((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  /* ── Load current payroll ── */
  const handleLoad = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      // TODO: call the "current payroll" API / lookup for companyCode
      // const data = await ...;
      // setForm({
      //   pay_month: String(data.pay_month ?? ""),
      //   pay_year: String(data.pay_year ?? ""),
      //   cutoff_date: toApiDateInput(data.cutoff_date),
      //   locked: data.lock_flag === "Y",
      // });
      setForm({ pay_month: "10", pay_year: "2026", cutoff_date: "2026-10-23", locked: false });
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load current payroll");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode]);

  useEffect(() => {
    void handleLoad();
  }, [handleLoad]);

  /* ── Save ── */
  const handleSave = async () => {
    if (!companyCode || !dirty) {
      toast.warning("No changes to save.");
      return;
    }

    if (form.locked) {
      const ok = window.confirm(
        `Lock payroll for ${form.pay_month}/${form.pay_year}? Changes to this period will be blocked.`,
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      // TODO: call the Payroll Lock API with:
      // { company_code: companyCode, lock_flag: form.locked ? "Y" : "N", user_id: loginid }
      toast.success(form.locked ? "Payroll locked." : "Payroll unlocked.");
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update payroll lock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="freight-workspace-ui freight-dense-form freight-ui-standard grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Lock size={15} />
          </div>
          <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Payroll Lock</h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={handleLoad} disabled={loading || saving}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || loading || saving}>
            <Save size={14} /> {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Current payroll */}
      <SectionPanel title="Current Payroll" icon={Lock}>
        <div className="grid max-w-3xl gap-3 md:grid-cols-3">
          <Field label="Pay Month">
            <Input readOnly value={form.pay_month} className="h-8 bg-slate-50" />
          </Field>

          <Field label="Pay Year">
            <Input readOnly value={form.pay_year} className="h-8 bg-slate-50" />
          </Field>

          <Field label="Payroll Cutoff Date">
            <Input
              type="date"
              className="h-8"
              value={form.cutoff_date}
              disabled={loading}
              onChange={(e) => patch({ cutoff_date: e.target.value })}
            />
          </Field>
        </div>

        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={form.locked}
            disabled={loading || saving}
            onChange={(e) => patch({ locked: e.target.checked })}
          />
          Lock Payroll
        </label>
      </SectionPanel>
    </section>
  );
}

export default PayrollLock;