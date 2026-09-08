import { ArrowLeft, LoaderCircle, Save, Ship, X } from "lucide-react";
import { type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { type WmsRow } from "../../../utils/inboundHelpers";
import { InboundJobCreateForm } from "./InboundJobCreateForm";

type Props = {
  form: WmsRow;
  setForm: (updater: (cur: WmsRow) => WmsRow) => void;
  companyCode: string;
  saving: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
};

export function InboundJobForm({ form, setForm, companyCode, saving, onSubmit, onClose }: Props) {
  return (
    <div className="grid gap-2.5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button type="button" size="icon" variant="ghost" title="Back" className="h-8 w-8 shrink-0" onClick={onClose}>
            <ArrowLeft size={15} />
          </Button>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Ship size={15} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="eyebrow m-0 mb-0.5 leading-none">Wms Inbound</p>
            <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Add Inbound Job</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          {/* form="inbound-job-form" targets the <form id="inbound-job-form"> rendered by
              InboundJobCreateForm below, even though this button sits outside it in the DOM. */}
          <Button type="submit" form="inbound-job-form" size="sm" disabled={saving}>
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving" : "Save Job"}
          </Button>
        </div>
      </div>

      <InboundJobCreateForm form={form} setForm={setForm} companyCode={companyCode} onSubmit={onSubmit} />
    </div>
  );
}

export default InboundJobForm;