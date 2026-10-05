// Grade Pay Unit page — new UI
//  • Division picker first, then a full-page Freight-style editor
//  • Header owns Change Division / Attach / Save; the form owns the logic
//  • Header Save calls formRef.current?.save()

import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Loader2, Paperclip, Save } from "lucide-react";
import { useRef, useState } from "react";
import { getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DivisionPickerDialog } from "../../../components/ui/DivisionPickerDialog";
import { useAuth } from "../../../state/AuthContext";
import { AddGradePayUnitForm, type GradePayUnitFormHandle } from "./AddGradePayUnitForm";

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) out[key.toUpperCase()] = row[key];
  return out as T;
}

const GradePayUnitPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [openDivision, setOpenDivision] = useState(true);
  const [selectedDiv, setSelectedDiv] = useState<{ div_code: string; div_name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const formRef = useRef<GradePayUnitFormHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Divisions ── */
  const { data: divisionData, isLoading: isLoadingDivision } = useQuery({
    queryKey: ["division", companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: "Account_division",
        code1: companyCode,
        code2: loginid,
      });
      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      return { tableData: rawRows.map(uppercaseKeys) };
    },
    enabled: !!companyCode,
  });

  const handleSelectDivision = (div_code: string, div_name: string) => {
    setSelectedDiv({ div_code, div_name });
    setOpenDivision(false);
  };

  /* ── Header Save ── */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  /* ── Attach ── */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const divisionPicker = (
    <DivisionPickerDialog
      open={openDivision}
      divisions={divisionData?.tableData ?? []}
      loading={isLoadingDivision}
      description="Choose a division to continue."
      onSelect={(item, code, name) =>
        handleSelectDivision(code || item.DIV_CODE || item.div_code, name || item.DIV_NAME || item.div_name)
      }
      onClose={() => setOpenDivision(false)}
    />
  );

  /* ── No division chosen yet ── */
  if (!selectedDiv) {
    return (
      <section className="freight-workspace-ui freight-ui-standard grid gap-2">
        <div className="grid place-items-center gap-3 rounded-md border bg-card px-4 py-12 text-center shadow-sm">
          <h2 className="m-0 text-lg font-semibold text-foreground">Grade Pay Unit</h2>
          <p className="m-0 text-sm text-muted-foreground">Choose a division to manage its grade pay units.</p>
          <Button type="button" size="sm" onClick={() => setOpenDivision(true)}>
            <Building2 size={14} /> Select Division
          </Button>
        </div>
        {divisionPicker}
      </section>
    );
  }

  /* ── Editor ── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Grade Pay Unit</h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                Editing
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedDiv.div_code}
                {selectedDiv.div_name ? ` - ${selectedDiv.div_name}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpenDivision(true)}
            disabled={saving}
          >
            <Building2 size={14} /> Change Division
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            <Paperclip size={14} /> Attach
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
          <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <AddGradePayUnitForm
        key={selectedDiv.div_code}
        ref={formRef}
        divCode={selectedDiv.div_code}
        divName={selectedDiv.div_name}
      />

      {divisionPicker}
    </section>
  );
};

export default GradePayUnitPage;