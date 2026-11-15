import { useRef } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";

export function CompanyLogoField({ value, disabled, busy, onBusy, onChange, onError }: { value: string; disabled: boolean; busy: boolean; onBusy: (value: boolean) => void; onChange: (url: string) => void; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 4 * 1024 * 1024) { onError("Select a PNG or JPEG logo up to 2 MB."); return; }
    onBusy(true);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await api.post<{ success: boolean; data: string; message?: string }>("/api/files/company-logo", body, { headers: { "Content-Type": "multipart/form-data" } });
      if (!response.data.success || !response.data.data) throw new Error(response.data.message || "Logo upload failed");
      onChange(response.data.data);
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to upload logo"); }
    finally { onBusy(false); if (input.current) input.current.value = ""; }
  }
  return <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#00378C]"><ImagePlus size={17} />Company Logo</h3>
    <div className="flex flex-wrap items-center gap-5">
      <div className="flex h-28 w-60 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white p-3">
        {value ? <img src={value} alt="Company logo preview" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-500">No logo selected</span>}
      </div>
      <div className="grid gap-2">
        <p className="text-xs text-slate-500">PNG or JPEG, up to 4 MB. Used on company reports.</p>
        <div className="flex gap-2">
          <Button type="button" disabled={disabled || busy} onClick={() => input.current?.click()}><Upload size={14} />{busy ? "Uploading..." : value ? "Replace Logo" : "Upload Logo"}</Button>
          {value && <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => onChange("")}><X size={14} />Remove</Button>}
        </div>
        <p className="text-xs text-slate-500">Save the company to apply logo changes.</p>
        <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Upload company logo" disabled={disabled || busy} onChange={(event) => void upload(event.target.files?.[0])} />
      </div>
    </div>
  </section>;
}
