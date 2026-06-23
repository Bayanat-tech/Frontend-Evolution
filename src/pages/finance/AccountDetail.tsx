import { useEffect, useState } from "react";
import { X, Shield, Activity, Upload, Plus, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../state/AuthContext";
import { cn } from "../../lib/utils";
import { getAccountTreeNode ,CreateLevel5ApprovalDetails, upsertLevel5Activities,getLevel5Activities } from "../../api/finance";

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
    // { id: "documents",  label: "Documents Upload",  icon: <Upload size={14} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Dialog panel */}
      <div className="relative flex w-full max-w-2xl flex-col rounded-xl border bg-card shadow-2xl"
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
          {/* {activeTab === "documents" && (
            <DocumentsTab />
          )} */}
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
        ac_status:   result.AC_STATUS   || "",
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
            <option value="N">Not Approved</option>
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
            <option value="I">Inactive</option>
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
   srno:"", act_code: "", act_desc: "" , user_id:"", user_dt:""
 });

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
    srno: newAct.srno ? Number(newAct.srno) : undefined,
    act_code: newAct.act_code,
    act_desc: newAct.act_desc,
    user_id: newAct.user_id || undefined,
    user_dt: newAct.user_dt || undefined,
  }],
  });
      setNotice({ type: "success", message: "Activity added successfully" });
      setNewAct({ srno:"", act_code: "", act_desc: "" , user_id:"", user_dt:"" });
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

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} activit${rows.length === 1 ? "y" : "ies"}`}
        </p>
        <Button
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={14} /> Add Activity
        </Button>
      </div>

      {/* Inline add form */}
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
            <Input
              value={newAct.srno}
              onChange={(e) =>
                setNewAct((f) => ({ ...f, srno: e.target.value }))
              }
            />
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
            <Input
              value={newAct.user_id}
              onChange={(e) =>
                setNewAct((f) => ({ ...f, user_id: e.target.value }))
              }
            />
          </td>

          <td className="p-1">
            <Input
              type="date"
              value={newAct.user_dt}
              onChange={(e) =>
                setNewAct((f) => ({ ...f, user_dt: e.target.value }))
              }
            />
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
            srno: "",
            act_code: "",
            act_desc: "",
            user_id: "",
            user_dt: "",
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

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No activities recorded for this account.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 w-12">Sr No</th>
                <th className="px-3 py-2.5 w-28">Code</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 w-28">User</th>
                <th className="px-3 py-2.5 w-32">Date</th>
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

// function DocumentsTab() {
//   return (
//     <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
//       <div className="grid h-12 w-12 place-items-center rounded-full border bg-muted text-muted-foreground">
//         <Upload size={20} />
//       </div>
//       <p className="text-sm font-medium">Documents Upload</p>
//       <p className="max-w-xs text-xs text-muted-foreground">
//         Document upload will be wired up in the next phase. The API will reuse the existing Attachments flow.
//       </p>
//     </div>
//   );
// }

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
