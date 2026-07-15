"use client";

import React, { useEffect, useState } from "react";
import { Save, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup, executeCommonProcedure, postFinance } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";

interface PLSetupRow {
  company_code: string;
  pl_code: string;
  pl_name: string;
  pl_type: "H" | "D";
  h_code: string;
  prv_code: string;
}

interface EditableRow extends PLSetupRow {
  rowId: string;
  isNew: boolean;
  isDirty: boolean;
}

const makeRowId = () => `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyRow = (companyCode: string): EditableRow => ({
  rowId: makeRowId(),
  company_code: companyCode,
  pl_code: "",
  pl_name: "",
  pl_type: "D",
  h_code: "",
  prv_code: "",
  isNew: true,
  isDirty: true,
});

const thStyle: React.CSSProperties = {
  padding: "7px 10px",
  textAlign: "left",
  fontWeight: 500,
  fontSize: 11,
  background: "#185FA5",
  color: "#fff",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  borderBottom: "0.5px solid #e5e7eb",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 0,
};

const rowStyle = (sel: boolean): React.CSSProperties => ({
  cursor: "pointer",
  background: sel ? "#E6F1FB" : "transparent",
  color: sel ? "#0C447C" : "inherit",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "6px 9px",
  border: "0.5px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  color: "#111827",
  boxSizing: "border-box",
};

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 11,
  padding: "4px 6px",
  border: "0.5px solid transparent",
  borderRadius: 4,
  background: "transparent",
  color: "#111827",
  boxSizing: "border-box",
};

const badgeStyle: React.CSSProperties = {
  background: "#E6F1FB",
  color: "#0C447C",
  fontSize: 10,
  fontWeight: 500,
  padding: "2px 8px",
  borderRadius: 20,
};

const PLSetupPage: React.FC = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || user?.username || "ADMIN";

  const [items, setItems] = useState<EditableRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditableRow | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [pendingDirtyRows, setPendingDirtyRows] = useState<EditableRow[]>([]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchPLSetup = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await getDynamicLookup({
        parameter: "MS_AC_SETUP_PLSETUP",
        code1: companyCode,
        loginid: loginId,
      });

      const rows: EditableRow[] = (response || []).map((r: any) => ({
        rowId: String(r.pl_code ?? r.PL_CODE ?? ""),
        company_code: r.company_code ?? r.COMPANY_CODE ?? companyCode,
        pl_code: String(r.pl_code ?? r.PL_CODE ?? ""),
        pl_name: r.pl_name ?? r.PL_NAME ?? "",
        pl_type: (r.pl_type ?? r.PL_TYPE) === "H" ? "H" : "D",
        h_code: r.h_code ?? r.H_CODE ?? "",
        prv_code: r.prv_code ?? r.PRV_CODE ?? "",
        isNew: false,
        isDirty: false,
      }));

      setItems(rows);
    } catch (error) {
      console.error("P&L setup fetch error:", error);
      setNotice({ type: "error", message: "Failed to load P&L setup. Check console." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPLSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Row editing ──────────────────────────────────────────────────────────────
  const updateRow = (rowId: string, patch: Partial<EditableRow>) => {
    setItems((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch, isDirty: true } : r)));
  };

  const handleAddRow = () => {
    const row = emptyRow(companyCode);
    setItems((prev) => [row, ...prev]);
    setSelectedRowId(row.rowId);
    setNotice(null);
  };

  // ── Save — step 1: validate + open dialog ───────────────────────────────────
  const handleSaveClick = () => {
    setNotice(null);

    const dirtyRows = items.filter((r) => r.isDirty);
    if (dirtyRows.length === 0) {
      setNotice({ type: "success", message: "Nothing to save." });
      return;
    }

    const invalid = dirtyRows.find((r) => !r.pl_code.trim() || !r.pl_name.trim());
    if (invalid) {
      setNotice({ type: "error", message: "Each row needs both a Code and a Description before saving." });
      return;
    }

    setPendingDirtyRows(dirtyRows);
    setSaveConfirmOpen(true);
  };

  // ── Save — step 2: confirmed ─────────────────────────────────────────────────
  const handleSaveConfirm = async () => {
    setSaveConfirmOpen(false);
    setSaving(true);
    try {
      for (const row of pendingDirtyRows) {
        await postFinance("upsertPLSetup", {
          company_code: row.company_code,
          pl_code: row.pl_code.trim(),
          pl_name: row.pl_name.trim(),
          pl_type: row.pl_type,
          h_code: row.h_code,
          prv_code: row.prv_code,
          loginid: loginId,
        });
      }

      setNotice({
        type: "success",
        message: pendingDirtyRows.length === 1 ? "P&L code saved successfully." : `${pendingDirtyRows.length} P&L codes saved successfully.`,
      });
      await fetchPLSetup(false);
      setSelectedRowId(null);
    } catch (error: any) {
      console.error("P&L setup save error:", error);
      setNotice({ type: "error", message: error?.message || "Save failed. Check console." });
    } finally {
      setSaving(false);
      setPendingDirtyRows([]);
    }
  };

  // ── Delete — step 1: open dialog ────────────────────────────────────────────
  const handleDeleteClick = () => {
    if (!selectedRowId) {
      setNotice({ type: "error", message: "Select a row first to delete it." });
      return;
    }

    const row = items.find((r) => r.rowId === selectedRowId);
    if (!row) return;

    if (row.isNew) {
      setItems((prev) => prev.filter((r) => r.rowId !== row.rowId));
      setSelectedRowId(null);
      setNotice({ type: "success", message: "Row removed." });
      return;
    }

    setDeleteTarget(row);
  };

  // ── Delete — step 2: confirmed ───────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setNotice(null);
    try {
      await executeCommonProcedure({
        parameter: "PROC_MS_AC_PLSETUP_DELETE",
        loginid: loginId,
        val1s1: deleteTarget.company_code,
        val1s2: deleteTarget.pl_code,
      });

      setItems((prev) => prev.filter((r) => r.rowId !== deleteTarget.rowId));
      setSelectedRowId(null);
      setDeleteTarget(null);
      setNotice({ type: "success", message: "P&L code deleted successfully." });
    } catch (error: any) {
      console.error("P&L setup delete error:", error);
      setDeleteTarget(null);
      setNotice({ type: "error", message: error?.message || "Delete failed. Check console." });
    } finally {
      setDeleting(false);
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.pl_code.toLowerCase().includes(search.toLowerCase()) ||
      i.pl_name.toLowerCase().includes(search.toLowerCase()),
  );

  const dirtyCount = items.filter((r) => r.isDirty).length;

  return (
    <div style={{ background: "#f3f4f6", padding: "4px 8px", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        tbody tr:last-child td { border-bottom: none !important; }
        tbody tr:hover td { background: #f9fafb; }
        .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
        .action-btn-danger:hover { background: #fef2f2 !important; border-color: #dc2626 !important; color: #dc2626 !important; }
        .cell-input:focus { border-color: #185FA5 !important; background: #fff !important; outline: none; }
        .add-row-btn:hover { background: #f0f7ff !important; border-color: #185FA5 !important; }
      `}</style>

      <div style={{ margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "10px 10px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              P&amp;L Setup
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {dirtyCount > 0 && (
                <span style={{ ...badgeStyle, background: "#FEF3C7", color: "#92400E" }}>{dirtyCount} unsaved</span>
              )}
              <span style={badgeStyle}>{items.length} total</span>
            </div>
          </div>

          {/* Search + Add */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Search P&L codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, fontSize: 12, flex: 1 }}
            />
            <button
              className="add-row-btn"
              onClick={handleAddRow}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#185FA5",
                background: "#fff",
                border: "0.5px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                padding: "6px 14px",
                whiteSpace: "nowrap",
              }}
            >
              + Add row
            </button>
          </div>

          {/* Table */}
          <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 440, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 110 }}>Code</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, width: 100 }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                      <Loader2 size={13} style={{ animation: "spin 1s linear infinite", marginRight: 6, verticalAlign: "middle" }} />
                      Loading...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                      No P&amp;L codes found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((row) => {
                    const isSelected = row.rowId === selectedRowId;
                    return (
                      <tr key={row.rowId} style={rowStyle(isSelected)} onMouseDown={() => setSelectedRowId(row.rowId)}>
                        <td style={tdStyle}>
                          <input
                            className="cell-input"
                            type="text"
                            value={row.pl_code}
                            disabled={!row.isNew}
                            placeholder="e.g. 30007"
                            onChange={(e) => updateRow(row.rowId, { pl_code: e.target.value })}
                            onFocus={() => setSelectedRowId(row.rowId)}
                            style={{
                              ...cellInputStyle,
                              fontFamily: "monospace",
                              color: row.isNew ? "#111827" : "#6b7280",
                            }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            className="cell-input"
                            type="text"
                            value={row.pl_name}
                            placeholder="Description"
                            onChange={(e) => updateRow(row.rowId, { pl_name: e.target.value })}
                            onFocus={() => setSelectedRowId(row.rowId)}
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={tdStyle}>
                          <select
                            value={row.pl_type}
                            onChange={(e) => updateRow(row.rowId, { pl_type: e.target.value as "H" | "D" })}
                            onFocus={() => setSelectedRowId(row.rowId)}
                            style={{ ...cellInputStyle, cursor: "pointer" }}
                          >
                            <option value="H">Head</option>
                            <option value="D">Detail</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Alert */}
          <div style={{ marginTop: 8 }}>
            <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
          </div>

          {/* Action bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
            <button
              className="action-btn-danger"
              onClick={handleDeleteClick}
              disabled={!selectedRowId || deleting || saving}
              style={{
                padding: "7px 16px",
                border: "0.5px solid #fecaca",
                background: "#fff",
                cursor: !selectedRowId || deleting || saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                borderRadius: 6,
                color: "#dc2626",
                opacity: !selectedRowId || deleting || saving ? 0.5 : 1,
              }}
            >
              {deleting ? (
                <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Deleting...</>
              ) : (
                <><Trash2 size={13} /> Delete</>
              )}
            </button>
            <button
              className="action-btn-primary"
              onClick={handleSaveClick}
              disabled={saving || loading}
              style={{
                padding: "7px 16px",
                border: "0.5px solid #185FA5",
                background: "#185FA5",
                cursor: saving || loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                borderRadius: 6,
                color: "#fff",
                opacity: saving || loading ? 0.7 : 1,
              }}
            >
              {saving ? (
                <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving...</>
              ) : (
                <><Save size={13} /> Save</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Save confirmation Dialog ──────────────────────────────────────────── */}
      {saveConfirmOpen && (
        <Dialog
          open
          compact
          title="Save Changes"
          description="The following changes will be written to the database."
          onClose={() => setSaveConfirmOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setSaveConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveConfirm()}>
                Save
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            Save <strong>{pendingDirtyRows.length} {pendingDirtyRows.length === 1 ? "row" : "rows"}</strong>? This will write the changes to the database.
          </p>
        </Dialog>
      )}

      {/* ── Delete confirmation Dialog ────────────────────────────────────────── */}
      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete P&L Code"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteConfirm()}>
                Delete
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            Delete <strong>{deleteTarget.pl_code} — {deleteTarget.pl_name}</strong>?
          </p>
        </Dialog>
      )}
    </div>
  );
};

export default PLSetupPage;