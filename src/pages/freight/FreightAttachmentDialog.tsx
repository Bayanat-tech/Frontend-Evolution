import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Paperclip, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { api } from "../../api/client";
import { uploadAccountFile } from "../../api/files";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/AlertToast";

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
  const { toast } = useToast();
  const [files, setFiles] = useState<FreightAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [editName, setEditName] = useState("");
  const [previewFile, setPreviewFile] = useState<FreightAttachment | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const canUpload = Boolean(companyCode && prinCode && jobNo && !readOnly);

  const notify = (next: { type: "success" | "error"; text: string }) => {
    setNotice(next);
    if (next.type === "success") toast.success(next.text);
    else toast.error(next.text);
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load attachments." });
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
    if (oversized.length) notify({ type: "error", text: `Skipped files over 5 MB: ${oversized.map((file) => file.name).join(", ")}` });
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
      notify({ type: "success", text: "Attachments uploaded." });
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to upload attachments." });
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
      notify({ type: "success", text: "File renamed." });
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to rename file." });
    }
  };

  const deleteFile = async (file: FreightAttachment) => {
    try {
      await api.post("/api/freight/attachments/delete", attachmentKeyPayload(file, { user_id: loginId }));
      setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)));
      notify({ type: "success", text: "Attachment deleted." });
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete attachment." });
    }
  };

  const openPreview = (file: FreightAttachment) => {
    if (!fileUrl(file)) {
      notify({ type: "error", text: "No preview URL available for this attachment." });
      return;
    }
    setPreviewFile(file);
  };

  const closePreview = () => setPreviewFile(null);

  return (
    <>
      <Dialog
        open={open}
        title={title}
        description={jobNo ? `${jobNo}${context === "DOC" && docNr ? ` / Document ${docNr}` : ""}` : "Select or save the freight job first."}
        contentClassName="w-[min(94vw,760px)] max-h-[82vh]"
        onClose={onClose}
        footer={<Button variant="outline" onClick={onClose}>Close</Button>}
      >
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-secondary/30 p-2">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Paperclip size={17} /></span>
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
            <div className="grid min-h-[150px] place-items-center text-sm text-muted-foreground">Loading attachments...</div>
          ) : !files.length ? (
            <EmptyState title="No Attachments" message="Upload supporting freight documents, scans, approvals, BL/AWB copies, or customs files." />
          ) : (
            <div className="max-h-[300px] overflow-auto rounded-md border">
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
                    const url = fileUrl(file);
                    return (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={15} /></span>
                            <div className="min-w-0">
                              <p className="m-0 truncate font-medium">{attachmentName(file)}</p>
                              <p className="m-0 text-xs text-muted-foreground">{fileTypeLabel(file)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {editing ? <Input className="h-8" value={editName} onChange={(event) => setEditName(event.target.value)} /> : <span>{text(file.USER_FILE_NAME || file.ORG_FILE_NAME)}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{text(file.CONTEXT) === "DOC" ? `Document ${text(file.DOC_NR)}` : "Job"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" type="button" onClick={() => openPreview(file)} disabled={!url} title={url ? "Preview file" : "Preview unavailable"}>
                              <Eye size={14} />
                            </Button>
                            <Button size="icon" variant="ghost" type="button" disabled={!url} title={url ? "Download file" : "Download unavailable"} onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}>
                              <Download size={14} />
                            </Button>
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

      <Dialog
        open={Boolean(previewFile)}
        title={previewFile ? attachmentName(previewFile) : "Attachment Preview"}
        description={previewFile ? fileTypeLabel(previewFile) : undefined}
        contentClassName="w-[min(96vw,940px)] max-h-[90vh]"
        onClose={closePreview}
        footer={(
          <>
            {previewFile && fileUrl(previewFile) ? (
              <Button type="button" onClick={() => window.open(fileUrl(previewFile), "_blank", "noopener,noreferrer")}>
                <Download size={15} /> Download
              </Button>
            ) : null}
            <Button variant="outline" onClick={closePreview}>Close</Button>
          </>
        )}
      >
        {previewFile ? <AttachmentPreview file={previewFile} /> : null}
      </Dialog>
    </>
  );
}

function AttachmentPreview({ file }: { file: FreightAttachment }) {
  const url = fileUrl(file);
  const previewType = getPreviewType(file);

  return (
    <div className="min-h-[420px] max-h-[74vh] overflow-hidden rounded-md border bg-background text-sm">
      {previewType === "pdf" ? (
        <iframe title="freight-attachment-preview" src={url} className="h-[74vh] w-full" />
      ) : previewType === "image" ? (
        <img src={url} alt={attachmentName(file)} className="h-[74vh] w-full object-contain" />
      ) : (
        <div className="grid min-h-[260px] place-items-center p-6 text-center text-sm text-muted-foreground">
          <div>
            <FileText className="mx-auto mb-3 text-primary" size={34} />
            <p className="m-0 font-medium text-foreground">Preview is not available for this file type.</p>
            <p className="mx-auto mt-2 max-w-sm">Use Download to open the attachment in its native application.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid min-h-[160px] place-items-center rounded-md border border-dashed bg-secondary/20 p-5 text-center">
      <div>
        <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Paperclip size={18} /></div>
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

function attachmentName(file: FreightAttachment) {
  return text(file.USER_FILE_NAME || file.ORG_FILE_NAME || file.FILE_NAME) || "Attachment";
}

function fileUrl(file: FreightAttachment) {
  return text(file.AWS_FILE_LOCN);
}

function fileTypeLabel(file: FreightAttachment) {
  return text(file.FILE_TYPE || file.EXTENSIONS) || "file";
}

function getPreviewType(file: FreightAttachment) {
  const url = fileUrl(file);
  const type = fileTypeLabel(file).toLowerCase();
  if (type.includes("pdf") || /\.pdf($|\?)/i.test(url)) return "pdf";
  if (type.includes("image") || /\.(png|jpe?g|gif|bmp|webp|svg)($|\?)/i.test(url)) return "image";
  return "other";
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}
