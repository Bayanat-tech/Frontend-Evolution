import { ArrowLeft, LoaderCircle, Save, Ship, X } from "lucide-react";
import { type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { type WmsRow } from "../../../utils/inboundHelpers";
import { InboundJobCreateForm } from "./InboundJobCreateForm";

type Props = {
  form: any;
  setForm: (updater: (cur: WmsRow) => WmsRow) => void;
  companyCode: string;
  saving: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
};

export function InboundJobForm({ form, setForm, companyCode, saving, onSubmit, onClose }: Props) {
  const statusLabel =
    form.job_status === "A" ? "Approved"
    : form.job_status === "C" ? "Cancelled"
    : form.job_status === "R" ? "Rejected"
    : "Draft";

  return (
    <div className="grid gap-2.5">
      {/* ── Transaction Header (child-style title in parent) ── */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Ship size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-md font-semibold leading-tight text-foreground">
                {form.job_number ? `Inbound Job ${form.job_number}` : "New Inbound Job"}
              </h1>
              <span className={statusBadgeClass(form.job_status)}>{statusLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <ArrowLeft size={14} />
            List
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <X size={14} />
            Cancel
          </Button>
          <Button type="submit" form="inbound-job-form" size="sm" disabled={saving}>
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving" : "Save Job"}
          </Button>
        </div>
      </div>

      <InboundJobCreateForm
        form={form}
        setForm={setForm}
        companyCode={companyCode}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function statusBadgeClass(status?: string) {
  if (status === "A") return "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-emerald-700";
  if (status === "C") return "inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-red-700";
  if (status === "R") return "inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-red-700";
  return "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700";
}

export default InboundJobForm;