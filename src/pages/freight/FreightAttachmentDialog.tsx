import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, FileText, Paperclip, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { api } from "../../api/client";
import { uploadAccountFile } from "../../api/files";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";

type FreightAttachmentContext = "JOB" | "DOC";

type FreightAttachment = {
  COMPANY_CODE?: string;
  PRIN_CODE?: string;
  JOB_NO?: string;
  CONTEXT?: FreightAttachmentContext;
  DOC_NR?: string;
  SR_NO?: number;
  FILE_NAME?: string;
  ORG_FILE_NAME?: string;
  AWS_FILE_LOCN?: string;
  EXTENSIONS?: string;
  USER_FILE_NAME?: string;
  MODULES?: string;
  FILE_TYPE?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  companyCode: string;
  prinCode: string;
  jobNo: string;
  docNr?: string;
  context: FreightAttachmentContext;
  loginId: string;
  readOnly?: boolean;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function FreightAttachmentDialog({ open, onClose, title, companyCode, prinCode, jobNo, docNr = "", context, loginId, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<FreightAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const canUpload = Boolean(companyCode && prinCode && jobNo && !readOnly);

  const loadFiles = async () => {
    if (!open || !jobNo) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: FreightAttachment[] }>("/api/freight/attachments/list", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
        context,
        doc_nr: context === "DOC" ? docNr : "",
      });
      setFiles(response.data.data || []);
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load attachments." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [open, companyCode, prinCode, jobNo, docNr, context]);

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || !canUpload) return;

    const oversized = selected.filter((file) => file.size > MAX_FILE_SIZE);
    const incoming = selected.filter((file) => file.size <= MAX_FILE_SIZE);
    if (oversized.length) setNotice({ type: "error", text: `Skipped files over 5 MB: ${oversized.map((file) => file.name).join(", ")}` });
    if (!incoming.length) return;

    setUploading(true);
    try {
      const savedRows: FreightAttachment[] = [];
      const requestNumber = context === "DOC" ? `${jobNo}-${docNr}` : jobNo;
      for (const file of incoming) {
        const fileUrl = await uploadAccountFile(file, requestNumber, context === "DOC" ? "FRT_JOB_DOC" : "FRT_JOB");
        const saveResponse = await api.post<{ success?: boolean; data?: { sr_no?: number } }>("/api/freight/attachments/save", {
          file: {
            company_code: companyCode,
            prin_code: prinCode,
            job_no: jobNo,
            context,
            doc_nr: context === "DOC" ? docNr : "",
            file_name: file.name,
            org_file_name: file.name,
            aws_file_locn: fileUrl,
            extensions: extensionFromFile(file),
            user_file_name: file.name,
            modules: "FREIGHT",
            file_type: context === "DOC" ? "FRT_JOB_DOC" : "FRT_JOB",
            flow_level: context === "DOC" ? 2 : 1,
            user_id: loginId,
          },
        });
        savedRows.push({
          COMPANY_CODE: companyCode,
          PRIN_CODE: prinCode,
          JOB_NO: jobNo,
          CONTEXT: context,
          DOC_NR: context === "DOC" ? docNr : "",
          SR_NO: saveResponse.data.data?.sr_no,
          FILE_NAME: file.name,
          ORG_FILE_NAME: file.name,
          AWS_FILE_LOCN: fileUrl,
          EXTENSIONS: extensionFromFile(file),
          USER_FILE_NAME: file.name,
          MODULES: "FREIGHT",
          FILE_TYPE: context === "DOC" ? "FRT_JOB_DOC" : "FRT_JOB",
        });
      }
      setFiles((current) => [...savedRows, ...current]);
      setNotice({ type: "success", text: "Attachments uploaded." });
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to upload attachments." });
    } finally {
      setUploading(false);
    }
  };

  const renameFile = async (file: FreightAttachment) => {
    if (!editName.trim()) return;
    try {
      await api.post("/api/freight/attachments/rename", attachmentKeyPayload(file, { user_file_name: editName.trim(), user_id: loginId }));
      setFiles((current) => current.map((item) => fileKey(item) === fileKey(file) ? { ...item, USER_FILE_NAME: editName.trim() } : item));
      setEditingKey("");
      setEditName("");
      setNotice({ type: "success", text: "File renamed." });
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to rename file." });
    }
  };

  const deleteFile = async (file: FreightAttachment) => {
    try {
      await api.post("/api/freight/attachments/delete", attachmentKeyPayload(file, { user_id: loginId }));
      setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)));
      setNotice({ type: "success", text: "Attachment deleted." });
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete attachment." });
    }
  };

  return (
    <Dialog open={open} wide title={title} description={jobNo ? `${jobNo}${context === "DOC" && docNr ? ` / Document ${docNr}` : ""}` : "Select or save the freight job first."} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Paperclip size={18} /></span>
            <div>
              <h3 className="m-0 text-sm font-semibold">Freight Files</h3>
              <p className="m-0 text-xs text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <input ref={inputRef} className="hidden" multiple type="file" onChange={uploadFiles} />
          <Button type="button" disabled={!canUpload || uploading} onClick={() => inputRef.current?.click()}>
            <UploadCloud size={15} /> {uploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>

        {notice && <div className={`rounded-md border px-3 py-2 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</div>}

        {!jobNo ? (
          <EmptyState title="Job Required" message="Select or save a freight job before attaching files." />
        ) : loading ? (
          <div className="grid min-h-[240px] place-items-center text-sm text-muted-foreground">Loading attachments...</div>
        ) : !files.length ? (
          <EmptyState title="No Attachments" message="Upload supporting freight documents, scans, approvals, BL/AWB copies, or customs files." />
        ) : (
          <div className="max-h-[430px] overflow-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Display Name</th>
                  <th className="px-3 py-2 text-left">Level</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const key = fileKey(file);
                  const editing = editingKey === key;
                  return (
                    <tr key={key} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={15} /></span>
                          <div className="min-w-0">
                            <p className="m-0 truncate font-medium">{text(file.ORG_FILE_NAME || file.FILE_NAME) || "Attachment"}</p>
                            <p className="m-0 text-xs text-muted-foreground">{text(file.EXTENSIONS) || "file"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {editing ? <Input className="h-8" value={editName} onChange={(event) => setEditName(event.target.value)} /> : <span>{text(file.USER_FILE_NAME || file.ORG_FILE_NAME)}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{text(file.CONTEXT) === "DOC" ? `Document ${text(file.DOC_NR)}` : "Job"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {file.AWS_FILE_LOCN && <Button asChild size="icon" variant="ghost" title="Open file"><a href={file.AWS_FILE_LOCN} target="_blank" rel="noreferrer"><Download size={14} /></a></Button>}
                          {editing ? (
                            <>
                              <Button size="sm" type="button" onClick={() => void renameFile(file)}>Save</Button>
                              <Button size="icon" type="button" variant="ghost" onClick={() => setEditingKey("")}><X size={14} /></Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" type="button" variant="ghost" onClick={() => { setEditingKey(key); setEditName(text(file.USER_FILE_NAME || file.ORG_FILE_NAME)); }} title="Rename"><Pencil size={14} /></Button>
                              <Button size="icon" type="button" variant="ghost" onClick={() => void deleteFile(file)} title="Delete"><Trash2 size={14} /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-md border border-dashed bg-secondary/20 p-8 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary"><Paperclip size={20} /></div>
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function attachmentKeyPayload(file: FreightAttachment, extra: Record<string, unknown> = {}) {
  return {
    company_code: file.COMPANY_CODE,
    prin_code: file.PRIN_CODE,
    job_no: file.JOB_NO,
    context: file.CONTEXT,
    doc_nr: file.DOC_NR,
    sr_no: file.SR_NO,
    ...extra,
  };
}

function fileKey(file: FreightAttachment) {
  return `${file.COMPANY_CODE}_${file.PRIN_CODE}_${file.JOB_NO}_${file.CONTEXT}_${file.DOC_NR || "JOB"}_${file.SR_NO || file.AWS_FILE_LOCN || file.ORG_FILE_NAME}`;
}

function extensionFromFile(file: File) {
  const byName = file.name.includes(".") ? file.name.split(".").pop() : "";
  return byName || file.type.split("/").pop() || "";
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}
