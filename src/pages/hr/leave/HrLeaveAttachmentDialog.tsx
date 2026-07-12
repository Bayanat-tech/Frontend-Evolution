import { Download, Eye, FileText, Loader2, Paperclip, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  deleteHrEmployeeFile,
  getHrEmployeeFiles,
  renameHrEmployeeFile,
  saveHrLeaveFiles,
  uploadHrEmployeeAttachment,
} from "../../../api/hr";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";

type HrLeaveAttachmentDialogProps = {
  open: boolean;
  requestNumber: string;
  companyCode: string;
  loginId: string;
  onClose: () => void;
};

type HrFile = {
  company_code: string;
  request_number: string;
  sr_no: number;
  file_name: string;
  org_file_name: string;
  aws_file_locn: string;
  flow_level: number;
  modules: string;
  extensions: string;
  user_file_name: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function HrLeaveAttachmentDialog({ open, requestNumber, companyCode, loginId, onClose }: HrLeaveAttachmentDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<HrFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [editName, setEditName] = useState("");
  const [previewFile, setPreviewFile] = useState<HrFile | null>(null);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loadFiles = async () => {
    if (!open || !requestNumber) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      setFiles(await getHrEmployeeFiles(requestNumber));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load attachments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [open, requestNumber]);

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || !requestNumber) return;

    const oversized = selected.filter((file) => file.size > MAX_FILE_SIZE);
    const incoming = selected.filter((file) => file.size <= MAX_FILE_SIZE);
    const existingNames = new Set(files.map((file) => file.org_file_name.toLowerCase()));
    const unique = incoming.filter((file) => !existingNames.has(file.name.toLowerCase()));

    if (oversized.length) {
      setNotice({ type: "error", message: `Skipped files over 5 MB: ${oversized.map((file) => file.name).join(", ")}` });
    }
    if (!unique.length) {
      if (!oversized.length) setNotice({ type: "error", message: "Selected files are already attached." });
      return;
    }

    setUploading(true);
    try {
      const rows = [];
      for (const file of unique) {
        const fileUrl = await uploadHrEmployeeAttachment(requestNumber, file);
        rows.push(makeHrFileRow({ file, fileUrl, requestNumber, companyCode, loginId }));
      }
      await saveHrLeaveFiles(requestNumber, rows);
      await loadFiles();
      setNotice({ type: "success", message: "Attachments uploaded successfully." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to upload attachments" });
    } finally {
      setUploading(false);
    }
  };

  const beginRename = (file: HrFile) => {
    setEditingKey(fileKey(file));
    setEditName(file.user_file_name || file.org_file_name);
  };

  const saveRename = async (file: HrFile) => {
    if (!requestNumber || !file.aws_file_locn || !editName.trim()) return;
    try {
      await renameHrEmployeeFile(requestNumber, file.aws_file_locn, editName.trim());
      setFiles((current) => current.map((item) => fileKey(item) === fileKey(file) ? { ...item, user_file_name: editName.trim() } : item));
      setEditingKey("");
      setEditName("");
      setNotice({ type: "success", message: "File name updated." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to rename file" });
    }
  };

  const removeFile = async (file: HrFile) => {
    if (!requestNumber || !file.sr_no) return;
    try {
      await deleteHrEmployeeFile(requestNumber, file.sr_no);
      setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)));
      setNotice({ type: "success", message: "Attachment deleted." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete file" });
    }
  };

  return (
    <>
      <Dialog
        open={open}
        title="Leave Attachments"
        description={requestNumber ? `Linked to request ${requestNumber}` : "Save draft first, then attach files."}
        contentClassName="hr-attachment-modal"
        onClose={onClose}
        footer={<Button variant="outline" onClick={onClose}>Close</Button>}
      >
        <div className="hr-attachment-dialog">
          <div className="hr-attachment-toolbar">
            <div className="hr-attachment-title">
              <span><Paperclip size={18} /></span>
              <div>
                <h3>Document Files</h3>
                <p>{requestNumber ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No request number available"}</p>
              </div>
            </div>
            <input ref={inputRef} className="hidden" multiple type="file" onChange={handleFileInput} />
            <Button disabled={!requestNumber || uploading} type="button" onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" size={15} /> : <UploadCloud size={15} />}
              {uploading ? "Uploading..." : "Upload Files"}
            </Button>
          </div>

          <NoticeToast notice={notice} onClose={() => setNotice(null)} />

          {!requestNumber ? (
            <EmptyAttachmentState title="Save Required" message="Save as draft first to generate a request number." />
          ) : loading ? (
            <div className="hr-attachment-empty">Loading attachments...</div>
          ) : files.length === 0 ? (
            <EmptyAttachmentState title="No Attachments" message="Upload supporting documents for this leave request." />
          ) : (
            <div className="hr-attachment-table-wrap">
              <table className="hr-attachment-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Display Name</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const key = fileKey(file);
                    const editing = editingKey === key;
                    return (
                      <tr key={key}>
                        <td>
                          <div className="hr-attachment-file">
                            <span><FileText size={15} /></span>
                            <div>
                              <strong>{file.org_file_name || file.file_name || "Attachment"}</strong>
                              <small>{file.aws_file_locn}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {editing ? (
                            <Input className="h-8" value={editName} onChange={(event) => setEditName(event.target.value)} />
                          ) : (
                            file.user_file_name || file.org_file_name
                          )}
                        </td>
                        <td><Badge variant="outline">{file.extensions || "file"}</Badge></td>
                        <td>
                          <div className="hr-attachment-actions">
                            {file.aws_file_locn ? (
                              <>
                                <Button size="icon" variant="ghost" type="button" title="Preview file" onClick={() => setPreviewFile(file)}>
                                  <Eye size={14} />
                                </Button>
                                <Button asChild size="icon" variant="ghost" title="Download file">
                                  <a href={file.aws_file_locn} target="_blank" rel="noreferrer"><Download size={14} /></a>
                                </Button>
                              </>
                            ) : null}
                            {editing ? (
                              <>
                                <Button size="sm" type="button" onClick={() => void saveRename(file)}>Save</Button>
                                <Button size="icon" type="button" variant="ghost" onClick={() => setEditingKey("")}><X size={14} /></Button>
                              </>
                            ) : (
                              <>
                              <Button size="icon" type="button" variant="ghost" onClick={() => beginRename(file)} title="Rename">
                                <Pencil size={14} />
                              </Button>
                              <Button size="icon" type="button" variant="ghost" onClick={() => void removeFile(file)} title="Delete">
                                <Trash2 size={14} />
                              </Button>
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
        title={previewFile ? getFileName(previewFile) : "Attachment Preview"}
        description={previewFile ? getFileType(previewFile) : undefined}
        contentClassName="vendor-attachment-preview-dialog"
        onClose={() => setPreviewFile(null)}
        footer={(
          <>
            {previewFile?.aws_file_locn ? (
              <Button type="button" onClick={() => window.open(previewFile.aws_file_locn, "_blank", "noopener,noreferrer")}>
                <Download size={15} /> Download
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
          </>
        )}
      >
        {previewFile ? (
          <div className="min-h-[520px] max-h-[78vh] overflow-hidden rounded-md border bg-background text-sm">
            {getPreviewType(previewFile) === "pdf" ? (
              <iframe title="attachment-preview" src={previewFile.aws_file_locn} className="h-[78vh] w-full" />
            ) : getPreviewType(previewFile) === "image" ? (
              <img src={previewFile.aws_file_locn} alt={getFileName(previewFile)} className="h-[78vh] w-full object-contain" />
            ) : (
              <div className="grid min-h-[260px] place-items-center p-6 text-center text-sm text-muted-foreground">
                <div>
                  <p>No preview available for this file type.</p>
                  <a href={previewFile.aws_file_locn} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                    Open in new tab
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function EmptyAttachmentState({ title, message }: { title: string; message: string }) {
  return (
    <div className="hr-attachment-empty">
      <Paperclip size={22} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function makeHrFileRow(options: { file: File; fileUrl: string; requestNumber: string; companyCode: string; loginId: string }) {
  return {
    company_code: options.companyCode,
    request_number: options.requestNumber,
    file_name: options.file.name,
    org_file_name: options.file.name,
    aws_file_locn: options.fileUrl,
    flow_level: 0,
    modules: "hr",
    updated_by: options.loginId,
    created_by: options.loginId,
    extensions: extensionFromFile(options.file),
    user_file_name: options.file.name,
    type: "Employees",
  };
}

function extensionFromFile(file: File) {
  const byName = file.name.includes(".") ? file.name.split(".").pop() : "";
  return byName || file.type.split("/").pop() || "";
}

function getFileName(file: HrFile) {
  return file.user_file_name || file.org_file_name || file.file_name || "Attachment";
}

function getFileType(file: HrFile) {
  return file.extensions || file.file_name.split(".").pop() || "";
}

function getPreviewType(file: HrFile) {
  const type = getFileType(file).toLowerCase();
  const url = file.aws_file_locn.toLowerCase();
  if (type.includes("pdf") || url.endsWith(".pdf")) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].some((item) => type.includes(item) || url.endsWith(`.${item}`))) return "image";
  return "other";
}

function fileKey(file: HrFile) {
  return `${file.request_number}_${file.sr_no || file.aws_file_locn || file.org_file_name}`;
}
