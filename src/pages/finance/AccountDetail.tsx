import { ChangeEvent, useEffect, useRef, useState } from "react";
import { X, Shield, Activity, Upload, Plus, Loader2, FileText, Download, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../state/AuthContext";
import { cn } from "../../lib/utils";
import { uploadAccountFile } from "../../api/files";
import { getAccountTreeNode ,CreateLevel5ApprovalDetails, upsertLevel5Activities,getLevel5Activities, deleteLevel5Activity, upsertLevel5Documents, getLevel5Documents, deleteLevel5Document } from "../../api/finance";

// ─── Types ───────

type Tab = "approval" | "activities" | "documents";

type ApprovalData = {
  AC_CODE: string;
  AC_NAME: string;
  // CREATE_USER: string;
  // CREATE_DATE: string;
  AC_STATUS: string;
  APPROVED_BY: string;
  APPROVED_DATE: string;
  COMPANY_CODE: string;
  CR_NO: string;
  AC_ACTIVE: string;
};

type Activity = {
  SRNO: number;
  ACT_CODE: string;
  ACT_DESC: string;
  USER_ID: string;
  USER_DT: string;
};

type UploadedDocument = {
  srno?: number;
  doc_type: string;
  doc_path: string;
  exp_date: string;
  mandatory: string;
  user_id: string;
  user_dt: string;
  doc_name: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

// ─── Dialog ─────────────

export function AccountDetails({
  acCode,
  acName,
  onClose,
}: {
  acCode: string;
  acName: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("approval");
  const [notice, setNotice] = useState<Notice>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "approval",   label: "Approval",         icon: <Shield size={14} /> },
    { id: "activities", label: "Activities",        icon: <Activity size={14} /> },
    { id: "documents",  label: "Documents Upload",  icon: <Upload size={14} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Dialog panel */}
      <div className="relative flex w-full max-w-4xl flex-col rounded-xl border bg-card shadow-2xl"
           style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="eyebrow">Account Details</p>
            <h2 className="m-0 text-lg font-semibold tracking-tight leading-snug">
              {acName}
            </h2>
            <code className="text-xs text-muted-foreground font-mono">{acCode}</code>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b bg-muted/30 px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setNotice(null); }}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notice */}
        {notice && (
          <div className="px-5 pt-3">
            <NoticeToast notice={notice} onClose={() => setNotice(null)} />
          </div>
        )}

        {/* Tab content */}
        <div className="min-h-0 flex-1 overflow-auto">
          {activeTab === "approval" && (
            <ApprovalTab acCode={acCode} setNotice={setNotice} />
          )}
          {activeTab === "activities" && (
            <ActivitiesTab acCode={acCode} setNotice={setNotice} />
          )}
          {activeTab === "documents" && (
            <DocumentsTab acCode={acCode} setNotice={setNotice} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Approval Tab ────────

function ApprovalTab({
  acCode,
  setNotice,
}: {
  acCode: string;
  setNotice: (n: Notice) => void;
}) {
  const { user } = useAuth(); 
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [data, setData]         = useState<ApprovalData | null>(null);
  const [form, setForm]         = useState({
    cr_no:         "",
    ac_status:     "",
    ac_active:     "Y",
    approved_by:   user?.loginid,
    approved_date: "",
  });

  useEffect(() => {
  let active = true;
  (async () => {
    setLoading(true);
    try {
 
    const result = await getAccountTreeNode(5, acCode) as ApprovalData;
      if (!active) return;
      setData(result);
      setForm({
        cr_no:       result.CR_NO       || "",
        ac_status:   result.AC_STATUS   || "A",
        ac_active:   result.AC_ACTIVE   || "Y",
        approved_by: result.APPROVED_BY || "",
        approved_date: result.APPROVED_DATE
           ? new Date(result.APPROVED_DATE).toISOString().split("T")[0]  // → YYYY-MM-DD for input[type=date]
           : "",
      });
    } catch (err) {
      if (active)
        setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to load" });
    } finally {
      if (active) setLoading(false);
    }
  })();
  return () => { active = false; };
}, [acCode]);

  const handleSave = async () => {
  setSaving(true);
  try {
    await CreateLevel5ApprovalDetails({
      parameter: "PROC_UPDATE_MS_ACCODES_APPROVAL",
      loginid:   user?.loginid || "",
      val1s1:    data?.COMPANY_CODE  || "",   
      val1s2:    acCode,                       
      val1s3:    form.ac_status      || "",   
      val1s4:    form.approved_by    || "",   
      val1s5: new Date().toLocaleDateString("en-GB"), 
      val1s6:    form.cr_no          || "",   
      val1s7:    form.ac_active      || "Y",  
    });
    setNotice({ type: "success", message: "Approval details updated successfully" });
  } catch (err) {
    setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to save" });
  } finally {
    setSaving(false);
  }
 };

  if (loading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton /><Skeleton /><Skeleton /><Skeleton />
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Read-only header block */}
      <div className="mb-5 grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4">
        <ReadOnlyField label="Ac Code"     value={data?.AC_CODE   || ""} />
        <ReadOnlyField label="Ac Name"     value={data?.AC_NAME   || ""} wide />
        <ReadOnlyField label="Create User" value={data?.APPROVED_BY || ""} />
        <ReadOnlyField label="Create Date"
          value={data?.APPROVED_DATE
            ? new Date(data.APPROVED_DATE).toLocaleDateString("en-GB")
            : "—"}
        />
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <label className="field">
          <span>CR No</span>
          <Input
            value={form.cr_no}
            onChange={(e) => setForm((f) => ({ ...f, cr_no: e.target.value }))}
            placeholder="Enter CR number"
          />
        </label>

        <label className="field">
          <span>Ac Approve</span>
          <Select
            value={form.ac_active}
            onChange={(e) => setForm((f) => ({ ...f, ac_active: e.target.value }))}
          >
            <option value="">— Select —</option>
            <option value="Y">Approved</option>
            <option value="A">Not Approved</option>
          </Select>
        </label>

        <label className="field">
          <span>Ac Status</span>
          <Select
            value={form.ac_status}
            onChange={(e) => setForm((f) => ({ ...f, ac_status: e.target.value }))}
          >
            <option value="">— Select —</option>
            <option value="A">Active</option>
            <option value="C">Inactive</option>
          </Select>
        </label>


        {/* <label className="field">
          <span>Approved Date</span>
          <Input
            type="date"
            value={form.approved_date}
            onChange={(e) => setForm((f) => ({ ...f, approved_date: e.target.value }))}
          />
        </label> */}
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-end border-t pt-4">
        <Button disabled={saving} onClick={handleSave}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Activities Tab ───────────

function ActivitiesTab({
  acCode,
  setNotice,
}: {
  acCode: string;
  setNotice: (n: Notice) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [rows, setRows]         = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow]   = useState<Activity | null>(null);
  const [newAct, setNewAct]     = useState({ 
   act_code: "", act_desc: ""
 });
  const nextSrNo = rows.reduce((max, row) => Math.max(max, Number(row.SRNO) || 0), 0) + 1;
  const loginId = user?.loginid || user?.username || "";
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getLevel5Activities(acCode) as Activity[];
      setRows(data);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to load activities" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [acCode]);

  const handleAdd = async () => {
    if (!newAct.act_code.trim() || !newAct.act_desc.trim()) {
      setNotice({ type: "error", message: "Activity Code and Description are required." });
      return;
    }
    setAdding(true);
    try {
    await upsertLevel5Activities({
    company_code: user?.company_code || "",
    ac_code: acCode,
    loginid: user?.loginid || "",
    records: [{
    srno: nextSrNo,
    act_code: newAct.act_code,
    act_desc: newAct.act_desc,
    user_id: loginId || undefined,
    user_dt: today,
  }],
  });
      setNotice({ type: "success", message: "Activity added successfully" });
      setNewAct({ act_code: "", act_desc: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to add activity" });
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async () => {
    if (!editRow) return;
    if (!editRow.ACT_CODE.trim() || !editRow.ACT_DESC.trim()) {
      setNotice({ type: "error", message: "Activity Code and Description are required." });
      return;
    }
    setAdding(true);
    try {
      await upsertLevel5Activities({
        company_code: user?.company_code || "",
        ac_code: acCode,
        loginid: user?.loginid || "",
        records: [{
          srno: editRow.SRNO,
          act_code: editRow.ACT_CODE,
          act_desc: editRow.ACT_DESC,
          user_id: editRow.USER_ID || undefined,
          user_dt: editRow.USER_DT
            ? new Date(editRow.USER_DT).toISOString().split("T")[0]
            : undefined,
        }],
      });
      setNotice({ type: "success", message: "Activity updated successfully" });
      setEditRow(null);
      await load();
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to update activity" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (row: Activity) => {
    setAdding(true);
    try {
      await deleteLevel5Activity({
        company_code: user?.company_code || "",
        ac_code: acCode,
        srno: row.SRNO,
        loginid: user?.loginid || "",
      });
      if (editRow?.SRNO === row.SRNO) setEditRow(null);
      setNotice({ type: "success", message: "Activity deleted successfully" });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to delete activity" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <AccountCodeStrip acCode={acCode} />

      {/* Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} activit${rows.length === 1 ? "y" : "ies"}`}
        </p>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
          title="Add activity"
          aria-label="Add activity"
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* add form */}
      {showForm && (
  <div className="overflow-hidden rounded-lg border">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/40 text-left text-xs font-semibold">
          <th className="px-2 py-2 w-16">SR No</th>
          <th className="px-2 py-2 w-32">Activity Code</th>
          <th className="px-2 py-2">Activity Description</th>
          <th className="px-2 py-2 w-32">UserID</th>
          <th className="px-2 py-2 w-40">User Date</th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td className="p-1">
            <Input value={nextSrNo} disabled />
          </td>

          <td className="p-1">
            <Input
              value={newAct.act_code}
              onChange={(e) =>
                setNewAct((f) => ({ ...f, act_code: e.target.value }))
              }
            />
          </td>

          <td className="p-1">
            <Input
              value={newAct.act_desc}
              onChange={(e) =>
                setNewAct((f) => ({ ...f, act_desc: e.target.value }))
              }
            />
          </td>

          <td className="p-1">
            <Input value={loginId} disabled />
          </td>

          <td className="p-1">
            <Input type="date" value={today} disabled />
          </td>
        </tr>
      </tbody>
    </table>

    <div className="flex justify-end gap-2 border-t p-3">
      <Button
        variant="outline"
        onClick={() => {
          setShowForm(false);
          setNewAct({
            act_code: "",
            act_desc: "",
          });
        }}
      >
        Cancel
      </Button>

      <Button disabled={adding} onClick={handleAdd}>
        Save
      </Button>
    </div>
  </div>
  )}

   {/* Edit form */}
      {editRow && (
        <div className="overflow-hidden rounded-lg border border-primary/40">
          <div className="bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
            Editing SR#{editRow.SRNO}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold">
                <th className="px-2 py-2 w-16">SR No</th>
                <th className="px-2 py-2 w-32">Activity Code</th>
                <th className="px-2 py-2">Activity Description</th>
                <th className="px-2 py-2 w-32">UserID</th>
                <th className="px-2 py-2 w-40">User Date</th>
              </tr>
            </thead>
            <tbody>
               <tr>
                <td className="p-1"><Input value={editRow.SRNO} disabled /></td>
                <td className="p-1"><Input value={editRow.ACT_CODE} onChange={(e) => setEditRow((r) => r ? { ...r, ACT_CODE: e.target.value } : r)} /></td>
                <td className="p-1"><Input value={editRow.ACT_DESC} onChange={(e) => setEditRow((r) => r ? { ...r, ACT_DESC: e.target.value } : r)} /></td>
                <td className="p-1"><Input value={editRow.USER_ID || ""} onChange={(e) => setEditRow((r) => r ? { ...r, USER_ID: e.target.value } : r)} /></td>
                <td className="p-1">
                  <Input
                    type="date"
                    value={editRow.USER_DT ? new Date(editRow.USER_DT).toISOString().split("T")[0] : ""}
                    onChange={(e) => setEditRow((r) => r ? { ...r, USER_DT: e.target.value } : r)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-end gap-2 border-t p-3">
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button disabled={adding} onClick={handleEdit}>
              {adding ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Update"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : rows.length === 0 && !showForm && !editRow ? (
        <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed p-6 text-center">
          <div>
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
              <Activity size={17} />
            </div>
            <p className="m-0 text-sm font-medium">No activities recorded</p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">Use the plus button to add the first activity.</p>
          </div>
        </div>
      ) : rows.length === 0 ? null : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 w-12">Sr No</th>
                <th className="px-3 py-2.5 w-28">Code</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 w-28">User</th>
                <th className="px-3 py-2.5 w-32">Date</th>
                <th className="px-3 py-2.5 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.SRNO}
                  className={cn(
                    "border-b last:border-0 transition-colors hover:bg-muted/30",
                    i % 2 === 0 ? "bg-background" : "bg-muted/10"
                  )}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">{row.SRNO}</td>
                  <td className="px-3 py-2.5">
                    <code className="rounded border bg-card px-1.5 py-0.5 text-[11px] text-primary">
                      {row.ACT_CODE}
                    </code>
                  </td>
                  <td className="px-3 py-2.5">{row.ACT_DESC}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.USER_ID}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.USER_DT
                      ? new Date(row.USER_DT).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditRow(row); setShowForm(false); }}
                      className="rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
                    >
                      Edit
                    </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={adding}
                        title="Delete activity"
                        aria-label="Delete activity"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab  ────────────

function DocumentsTab({
  acCode,
  setNotice,
}: {
  acCode: string;
  setNotice: (n: Notice) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<UploadedDocument[]>([]);
  const [form, setForm] = useState({
    doc_type: "",
    exp_date: "",
    mandatory: "N",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getLevel5Documents({
        company_code: user?.company_code || "",
        ac_code: acCode,
        loginid: user?.loginid || "",
      });
      setRows(data.map(normalizeDocumentRow));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to load documents" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [acCode, user?.company_code, user?.loginid]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;
    if (!user?.company_code) {
      setNotice({ type: "error", message: "Company code is missing." });
      return;
    }
    if (!user?.loginid) {
      setNotice({ type: "error", message: "Login ID is missing." });
      return;
    }
    if (!form.doc_type.trim()) {
      setNotice({ type: "error", message: "Document type is required." });
      return;
    }

    setSaving(true);
    try {
      const uploadedRows: UploadedDocument[] = [];
      const today = new Date().toISOString().slice(0, 10);

      for (const file of files) {
        const fileUrl = await uploadAccountFile(file, acCode, form.doc_type.trim());
        uploadedRows.push({
          doc_type: limitText(form.doc_type.trim(), 10),
          doc_path: fileUrl,
          exp_date: form.exp_date || "",
          mandatory: form.mandatory || "N",
          user_id: limitText(user.loginid, 10),
          user_dt: today,
          doc_name: limitText(file.name, 80),
        });
      }

      await upsertLevel5Documents({
        company_code: user.company_code,
        ac_code: acCode,
        loginid: user.loginid,
        records: uploadedRows,
      });

      await load();
      setNotice({ type: "success", message: "Document uploaded and saved successfully." });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to upload document" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: UploadedDocument) => {
    if (!row.srno) {
      setNotice({ type: "error", message: "Document serial number is missing." });
      return;
    }

    setSaving(true);
    try {
      await deleteLevel5Document({
        company_code: user?.company_code || "",
        ac_code: acCode,
        srno: row.srno,
        loginid: user?.loginid || "",
      });
      setRows((current) => current.filter((item) => item.srno !== row.srno));
      setNotice({ type: "success", message: "Document deleted successfully." });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to delete document" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <AccountCodeStrip acCode={acCode} />

      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="grid grid-cols-[minmax(180px,1fr)_160px_130px_40px] items-end gap-3 max-md:grid-cols-1">
          <label className="field">
            <span>Document Type</span>
            <Input
              maxLength={10}
              placeholder="DOC"
              value={form.doc_type}
              onChange={(event) => setForm((current) => ({ ...current, doc_type: event.target.value.toUpperCase() }))}
            />
          </label>

          <label className="field">
            <span>Expiry Date</span>
            <Input
              type="date"
              value={form.exp_date}
              onChange={(event) => setForm((current) => ({ ...current, exp_date: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>Mandatory</span>
            <Select
              value={form.mandatory}
              onChange={(event) => setForm((current) => ({ ...current, mandatory: event.target.value }))}
            >
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </Select>
          </label>

          <input ref={inputRef} className="hidden" multiple type="file" onChange={handleUpload} />
          <Button
            disabled={saving}
            size="icon"
            type="button"
            title="Upload documents"
            aria-label="Upload documents"
            onClick={() => inputRef.current?.click()}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          </Button>
        </div>

        <div className="border-t pt-2 text-xs text-muted-foreground">
          OCI path will be saved against {acCode}. {loading ? "Loading..." : `${rows.length} document${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-[130px] place-items-center rounded-lg border text-sm text-muted-foreground">
          Loading documents...
        </div>
      ) : rows.length === 0 ? (
        <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed p-6 text-center">
          <div>
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
              <Upload size={17} />
            </div>
            <p className="m-0 text-sm font-medium">No documents uploaded</p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">Choose a document type, then use the upload icon.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Document</th>
                <th className="px-3 py-2.5 w-28">Type</th>
                <th className="px-3 py-2.5 w-28">Mandatory</th>
                <th className="px-3 py-2.5 w-32">Expiry</th>
                <th className="px-3 py-2.5 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr className="border-b last:border-0" key={`${row.doc_path}-${index}`}>
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                        <FileText size={15} />
                      </span>
                      <span className="truncate font-medium">{row.doc_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{row.doc_type}</td>
                  <td className="px-3 py-2.5">{row.mandatory === "Y" ? "Yes" : "No"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.exp_date ? new Date(row.exp_date).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost" title="Open document">
                        <a href={row.doc_path} target="_blank" rel="noreferrer"><Download size={14} /></a>
                      </Button>
                      <Button
                        disabled={saving || !row.srno}
                        size="icon"
                        type="button"
                        variant="ghost"
                        title="Delete document"
                        aria-label="Delete document"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", wide && "col-span-2")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function AccountCodeStrip({ acCode }: { acCode: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">AC Code</span>
      <code className="rounded border bg-background px-2 py-1 text-xs text-primary">{acCode}</code>
    </div>
  );
}

function normalizeDocumentRow(row: Record<string, unknown>): UploadedDocument {
  return {
    srno: numberValue(row.SRNO ?? row.srno),
    doc_type: textValue(row.DOC_TYPE ?? row.doc_type),
    doc_path: textValue(row.DOC_PATH ?? row.doc_path),
    exp_date: dateInputValue(row.EXP_DATE ?? row.exp_date),
    mandatory: textValue(row.MANDATORY ?? row.mandatory) || "N",
    user_id: textValue(row.USER_ID ?? row.user_id),
    user_dt: dateInputValue(row.USER_DT ?? row.user_dt),
    doc_name: textValue(row.DOC_NAME ?? row.doc_name),
  };
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateInputValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
