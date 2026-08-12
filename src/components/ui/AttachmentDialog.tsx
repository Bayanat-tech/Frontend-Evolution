import { Download, FileText, Paperclip, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAccountFile,
  getAccountFiles,
  makeFileRow,
  NormalizedFile,
  renameAccountFile,
  saveAccountFileRows,
  uploadAccountFile,
} from "../../api/files";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Input } from "./Input";
import { NoticeToast } from "./NoticeToast";

type AttachmentDialogProps = {
  open: boolean;
  onClose: () => void;
  requestNumber?: string;
  relatedRequestNumbers?: string[];
  title?: string;
  module: string;
  type: string;
  companyCode: string;
  loginId: string;
  flowLevel?: number;
  readOnly?: boolean;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function AttachmentDialog({
  open,
  onClose,
  requestNumber,
  relatedRequestNumbers = [],
  title = "Attachments",
  module,
  type,
  companyCode,
  loginId,
  flowLevel = 0,
  readOnly,
}: AttachmentDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<NormalizedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const canUpload = Boolean(requestNumber && companyCode && loginId && !readOnly);
  const relatedKey = useMemo(() => relatedRequestNumbers.filter(Boolean).join("|"), [relatedRequestNumbers]);
  const allRequestNumbers = useMemo(
    () => Array.from(new Set([requestNumber, ...relatedRequestNumbers].filter(Boolean) as string[])),
    [relatedKey, requestNumber]
  );

  const fileCount = files.length;
  const totalSizeLabel = useMemo(() => `${fileCount} file${fileCount === 1 ? "" : "s"}`, [fileCount]);

  const loadFiles = async () => {
    if (!open || !requestNumber) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const groups = await Promise.all(allRequestNumbers.map((item) => getAccountFiles(item)));
      setFiles(groups.flat());
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load attachments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [open, requestNumber, relatedKey]);

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || !requestNumber) return;

    const oversized = selected.filter((file) => file.size > MAX_FILE_SIZE);
    const incoming = selected.filter((file) => file.size <= MAX_FILE_SIZE);
    const existingNames = new Set(files.filter((file) => isPrimaryFile(file, requestNumber)).map((file) => `${file.request_number}:${file.org_file_name}`.toLowerCase()));
    const unique = incoming.filter((file) => !existingNames.has(`${requestNumber}:${file.name}`.toLowerCase()));

    if (oversized.length) {
      setNotice({ type: "error", message: `Skipped files over 5 MB: ${oversized.map((file) => file.name).join(", ")}` });
    }
    if (!unique.length) {
      if (!oversized.length) setNotice({ type: "error", message: "Selected files are already attached." });
      return;
    }

    setUploading(true);
    try {
      const rows: NormalizedFile[] = [];
      for (const file of unique) {
        const fileUrl = await uploadAccountFile(file, requestNumber, type);
        rows.push(makeFileRow({ file, fileUrl, requestNumber, companyCode, loginId, module, type, flowLevel }));
      }
      const saved = await saveAccountFileRows(requestNumber, rows);
      const srNos = new Map<string, number>((saved.successfulRecords || []).map((item) => [item.org_file_name, item.sr_no]));
      const withSrNo = rows.map((row) => ({ ...row, sr_no: srNos.get(row.org_file_name) || row.sr_no }));
      setFiles((current) => [...withSrNo, ...current]);
      setNotice({ type: "success", message: "Attachments uploaded successfully." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to upload attachments" });
    } finally {
      setUploading(false);
    }
  };

  const beginRename = (file: NormalizedFile) => {
    setEditingKey(fileKey(file));
    setEditName(file.user_file_name || file.org_file_name);
  };

  const saveRename = async (file: NormalizedFile) => {
    if (!requestNumber || !file.aws_file_locn || !editName.trim()) return;
    try {
      await renameAccountFile(requestNumber, file.aws_file_locn, editName.trim());
      setFiles((current) => current.map((item) => fileKey(item) === fileKey(file) ? { ...item, user_file_name: editName.trim() } : item));
      setEditingKey("");
      setEditName("");
      setNotice({ type: "success", message: "File name updated." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to rename file" });
    }
  };

  const removeFile = async (file: NormalizedFile) => {
    if (!requestNumber || !file.sr_no || !file.aws_file_locn) return;
    try {
      await deleteAccountFile(requestNumber, file.sr_no, file.aws_file_locn);
      setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)));
      setNotice({ type: "success", message: "Attachment deleted." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete file" });
    }
  };

  return (
    <Dialog
      open={open}
      wide
      title={title}
      description={requestNumber ? `Linked to ${requestNumber}${relatedRequestNumbers.length ? " with source files shown" : ""}` : "Save the record first, then attach files."}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Paperclip size={18} />
            </span>
            <div>
              <h3 className="m-0 text-sm font-semibold">Document Files</h3>
              <p className="m-0 text-xs text-muted-foreground">{requestNumber ? totalSizeLabel : "No document number available yet"}</p>
            </div>
          </div>
          <input ref={inputRef} className="hidden" multiple type="file" onChange={handleFileInput} />
          <Button disabled={!canUpload || uploading} type="button" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={15} /> {uploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>

        <NoticeToast notice={notice} onClose={() => setNotice(null)} />

        {!requestNumber ? (
          <EmptyAttachmentState title="Save Required" message="Attachments need a saved document or account code before upload." />
        ) : loading ? (
          <div className="grid min-h-[260px] place-items-center text-sm text-muted-foreground">Loading attachments...</div>
        ) : files.length === 0 ? (
          <EmptyAttachmentState title="No Attachments" message="Upload supporting documents, invoices, approvals, or scanned files." />
        ) : (
          <div className="max-h-[430px] overflow-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Display Name</th>
                  <th className="px-3 py-2 text-left">Module</th>
                  <th className="px-3 py-2 text-left">Document</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const key = fileKey(file);
                  const editing = editingKey === key;
                  const primary = isPrimaryFile(file, requestNumber);
                  return (
                    <tr className="border-t" key={key}>
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <FileText size={15} />
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate font-medium">{file.org_file_name || file.file_name || "Attachment"}</p>
                            <p className="m-0 text-xs text-muted-foreground">{file.extensions || "file"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <Input className="h-8" value={editName} onChange={(event) => setEditName(event.target.value)} />
                        ) : (
                          <span className="block max-w-[260px] truncate">{file.user_file_name || file.org_file_name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{file.modules || module}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "inline-flex max-w-[220px] items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                          primary ? "bg-secondary text-secondary-foreground" : "border-blue-200 bg-blue-50 text-blue-700"
                        )}>
                          {primary ? "Current" : `Source: ${file.request_number}`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {file.aws_file_locn && (
                            <Button asChild size="icon" variant="ghost" title="Open file">
                              <a href={file.aws_file_locn} target="_blank" rel="noreferrer"><Download size={14} /></a>
                            </Button>
                          )}
                          {!readOnly && primary && editing ? (
                            <>
                              <Button size="sm" type="button" onClick={() => void saveRename(file)}>Save</Button>
                              <Button size="icon" type="button" variant="ghost" onClick={() => setEditingKey("")}><X size={14} /></Button>
                            </>
                          ) : !readOnly && primary ? (
                            <>
                              <Button size="icon" type="button" variant="ghost" onClick={() => beginRename(file)} title="Rename"><Pencil size={14} /></Button>
                              <Button
                                className={cn(!file.sr_no && "opacity-50")}
                                size="icon"
                                type="button"
                                variant="ghost"
                                onClick={() => void removeFile(file)}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </>
                          ) : !primary ? (
                            <span className="self-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Reference</span>
                          ) : null}
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

function EmptyAttachmentState({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center rounded-md border border-dashed bg-secondary/20 p-8 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary">
          <Paperclip size={20} />
        </div>
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function fileKey(file: NormalizedFile) {
  return `${file.request_number}_${file.sr_no || file.aws_file_locn || file.org_file_name}`;
}

function isPrimaryFile(file: NormalizedFile, requestNumber?: string) {
  return Boolean(requestNumber && file.request_number === requestNumber);
}
