// import { Edit2, Plus, RefreshCw, Trash2 } from "lucide-react";
// import { FormEvent, useEffect, useMemo, useState } from "react";
// import type { ColumnDef } from "@tanstack/react-table";
// import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
// import { Button } from "../../components/ui/Button";
// import { DataTable } from "../../components/ui/DataTable";
// import { Dialog } from "../../components/ui/Dialog";
// import { Input } from "../../components/ui/Input";
// import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
// import { Select } from "../../components/ui/Select";
// import { useAuth } from "../../state/AuthContext";

// type PLForm = {
//   company_code: string;
//   h_code: string;
//   pl_code: string;
//   pl_name: string;
//   pl_type: string;
//   prv_code: string;
// };

// type Editor = { mode: "create" } | { mode: "edit"; row: LookupRow } | null;

// const EMPTY_PL: PLForm = {
//   company_code: "",
//   h_code: "",
//   pl_code: "",
//   pl_name: "",
//   pl_type: "",
//   prv_code: "",
// };

// export function PLSetupPage() {
//   const { user } = useAuth();
//   const [rows, setRows] = useState<LookupRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [query, setQuery] = useState("");
//   const [editor, setEditor] = useState<Editor>(null);
//   const [deleteTarget, setDeleteTarget] = useState<LookupRow | null>(null);
//   const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

//   const loadRows = async (clearNotice = true) => {
//     setLoading(true);
//     if (clearNotice) setNotice(null);
//     try {
//       setRows(await getDynamicLookup({ parameter: "MS_AC_SETUP_PLSETUP", loginid: user?.loginid || "", code1: user?.company_code || "" }));
//     } catch (error) {
//       setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load P&L setup" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     void loadRows();
//   }, []);

//   const filteredRows = useMemo(() => {
//     const term = query.trim().toLowerCase();
//     if (!term) return rows;
//     return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)));
//   }, [rows, query]);

//   const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
//     {
//       accessorFn: (row) => String(getLookupValue(row, "h_code") || ""),
//       id: "h_code",
//       header: "H Code",
//     },
//     {
//       accessorFn: (row) => String(getLookupValue(row, "pl_code") || ""),
//       id: "pl_code",
//       header: "PL Code",
//       cell: ({ getValue }) => <span className="font-medium">{String(getValue() || "")}</span>,
//     },
//     {
//       accessorFn: (row) => String(getLookupValue(row, "pl_name") || ""),
//       id: "pl_name",
//       header: "PL Name",
//     },
//     {
//       accessorFn: (row) => String(getLookupValue(row, "pl_type") || ""),
//       id: "pl_type",
//       header: "Type",
//     },
//     {
//       accessorFn: (row) => String(getLookupValue(row, "prv_code") || ""),
//       id: "prv_code",
//       header: "Previous",
//     },
//     {
//       id: "actions",
//       header: "Actions",
//       enableSorting: false,
//       cell: ({ row }) => (
//         <div className="flex items-center gap-1">
//           <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={15} /></Button>
//           <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
//         </div>
//       ),
//     },
//   ], []);

//   const handleDelete = async () => {
//     if (!deleteTarget) return;
//     try {
//       await executeCommonProcedure({
//         parameter: "PROC_MS_AC_PLSETUP_DELETE",
//         loginid: user?.loginid || "",
//         val1s1: user?.company_code || "",
//         val1s2: String(getLookupValue(deleteTarget, "pl_code") || ""),
//       });
//       setDeleteTarget(null);
//       setNotice({ type: "success", message: "P&L setup deleted successfully" });
//       await loadRows(false);
//     } catch (error) {
//       setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete P&L setup" });
//     }
//   };

//   return (
//     <section className="grid gap-4">
//       <div className="flex flex-wrap items-center justify-between gap-4">
//         <div>
//           <p className="eyebrow">Finance Master</p>
//           <h1 className="m-0 text-2xl font-semibold tracking-tight">P&L Setup</h1>
//         </div>
//         <div className="flex items-center gap-2">
//           <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
//           <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Add P&L Setting</Button>
//         </div>
//       </div>

//       <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

//       <DataTable
//         columns={columns}
//         data={filteredRows}
//         title={loading ? "Loading" : `${filteredRows.length} Records`}
//         subtitle="Setup Records"
//         searchValue={query}
//         onSearchChange={setQuery}
//         searchPlaceholder="Search P&L setup..."
//         loading={loading}
//         emptyText="No P&L setup records found"
//         height={670}
//         density="grid"
//         getRowId={(row, index) => `${getLookupValue(row, "pl_code") || index}`}
//       />

//       {editor && (
//         <Dialog
//           open
//           title={`${editor.mode === "create" ? "Create" : "Edit"} P&L Setting`}
//           description="P&L setup details"
//           onClose={() => setEditor(null)}
//         >
//           <PLSetupEditor
//             editor={editor}
//             onClose={() => setEditor(null)}
//             onSaved={async () => {
//               setEditor(null);
//               setNotice({ type: "success", message: editor.mode === "edit" ? "P&L setup updated successfully" : "P&L setup added successfully" });
//               await loadRows(false);
//             }}
//           />
//         </Dialog>
//       )}

//       {deleteTarget && (
//         <Dialog
//           open
//           compact
//           tone="danger"
//           title="Delete P&L Setup"
//           description="This action cannot be undone."
//           onClose={() => setDeleteTarget(null)}
//           footer={
//             <>
//               <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
//               <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
              
//             </>
//           }
//         >
//           <p className="modal-copy">Delete <strong>{String(getLookupValue(deleteTarget, "pl_code") || "")}</strong>?</p>
//         </Dialog>
//       )}
//     </section>
//   );
// }

// function PLSetupEditor({ editor, onClose, onSaved }: { editor: Exclude<Editor, null>; onClose: () => void; onSaved: () => Promise<void> }) {
//   const { user } = useAuth();
//   const isEdit = editor.mode === "edit";
//   const [form, setForm] = useState<PLForm>(() => mapPLForm(editor.mode === "edit" ? editor.row : undefined, user?.company_code || ""));
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState("");

//   const setField = (field: keyof PLForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

//   const submit = async (event: FormEvent) => {
//     event.preventDefault();
//     setError("");
//     if (!form.pl_code || !form.pl_name || !form.pl_type) {
//       setError("PL Code, PL Name and PL Type are required.");
//       return;
//     }
//     try {
//       setSaving(true);
//       await postFinance("insUpdMSACPLSetup", { data: [{ ...form, company_code: user?.company_code || form.company_code }] });
//       await onSaved();
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Unable to save P&L setup");
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="flex min-h-[360px] flex-col">
//       <div className="border-b pb-3">
//         <p className="eyebrow">{isEdit ? "Modify" : "Create"}</p>
//         <h2 className="m-0 text-xl font-semibold tracking-tight">P&L Setting</h2>
//       </div>
//       <form className="grid flex-1 content-start gap-4 overflow-auto py-4" id="pl-setup-form" onSubmit={submit}>
//         {error && <div className="alert error">{error}</div>}
//         <div className="grid grid-cols-2 gap-3">
//           <label className="field">
//             <span>PL Code</span>
//             <Input value={form.pl_code} onChange={(e) => setField("pl_code", e.target.value)} disabled={isEdit} />
//           </label>
//           <label className="field">
//             <span>PL Type</span>
//             <Select value={form.pl_type} onChange={(e) => setField("pl_type", e.target.value)} disabled={isEdit}>
//               <option value="">Select type</option>
//               <option value="P">P</option>
//               <option value="L">L</option>
//               <option value="B">B</option>
//             </Select>
//           </label>
//           <label className="field">
//             <span>H Code</span>
//             <Input value={form.h_code} onChange={(e) => setField("h_code", e.target.value)} disabled={isEdit} />
//           </label>
//           <label className="field">
//             <span>Previous Code</span>
//             <Input value={form.prv_code} onChange={(e) => setField("prv_code", e.target.value)} disabled={isEdit} />
//           </label>
//         </div>
//         <label className="field">
//           <span>PL Name</span>
//           <Input value={form.pl_name} onChange={(e) => setField("pl_name", e.target.value)} />
//         </label>
//       </form>
//       <div className="flex items-center justify-end gap-2 border-t bg-card pt-4">
//         <Button variant="outline" onClick={onClose}>Close</Button>
//         <Button disabled={saving} type="submit" form="pl-setup-form">
//           {saving ? <span className="spinner small" /> : "Save"}
//         </Button>
//       </div>
//     </div>
//   );
// }

// function mapPLForm(row: LookupRow | undefined, companyCode: string): PLForm {
//   if (!row) return { ...EMPTY_PL, company_code: companyCode };
//   return {
//     company_code: String(getLookupValue(row, "company_code") || companyCode),
//     h_code: String(getLookupValue(row, "h_code") || ""),
//     pl_code: String(getLookupValue(row, "pl_code") || ""),
//     pl_name: String(getLookupValue(row, "pl_name") || ""),
//     pl_type: String(getLookupValue(row, "pl_type") || ""),
//     prv_code: String(getLookupValue(row, "prv_code") || ""),
//   };
// }
































//------------PLSetupPage.tsx----------


"use client";

import React, { useEffect, useState } from "react";
import { Save, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";


// TODO: point this at your real save/delete endpoint module once it exists,
// e.g. import { savePLSetup, deletePLSetup } from "../../../api/masters";

// ─── Row type (maps to WMSTST.MS_AC_PLSETUP) ──────────────────────────────────
interface PLSetupRow {
    company_code: string;
    pl_code: string;
    pl_name: string;
    pl_type: "H" | "D";
    h_code: string;
    prv_code: string;
}

// Local editable row = server row + UI bookkeeping
interface EditableRow extends PLSetupRow {
    rowId: string;       // stable client key (pl_code for existing rows, generated for new ones)
    isNew: boolean;       // not yet saved
    isDirty: boolean;       // edited since load/last save
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

// ─── Component ─────────────────────────────────────────────────────────────────
const PLSetupPage: React.FC = () => {
    const { user } = useAuth();
    const companyCode = user?.company_code || "";

    const [items, setItems] = useState<EditableRow[]>([]);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // ── Fetch list via getDynamicLookup, same call shape as PeriodWisePage divisions ──
    const fetchPLSetup = async () => {
        setLoading(true);
        setPageError(null);
        try {
            const response = await getDynamicLookup({
                parameter: "MS_AC_SETUP_PLSETUP",
                code1: companyCode,
                loginid: user?.loginid || user?.username || "ADMIN",
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
            setPageError("Failed to load P&L setup. Check console.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPLSetup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Row editing helpers ──────────────────────────────────────────────────────
    const updateRow = (rowId: string, patch: Partial<EditableRow>) => {
        setItems((prev) =>
            prev.map((r) => (r.rowId === rowId ? { ...r, ...patch, isDirty: true } : r))
        );
    };

    
    // ── Add new row (client-only until saved) ─────────────────────────────────
    const handleAddRow = () => {
        const row = emptyRow(companyCode);
        setItems((prev) => [row, ...prev]);
        setSelectedRowId(row.rowId);
        setStatusMessage(null);
    };

    // ── Save ─────────────────────────────────────────────────────────────────────
    
    const handleSave = async () => {
        setPageError(null);
        setStatusMessage(null);

        const dirtyRows = items.filter((r) => r.isDirty);
        if (dirtyRows.length === 0) {
            setStatusMessage("Nothing to save.");
            return;
        }

        const invalid = dirtyRows.find((r) => !r.pl_code.trim() || !r.pl_name.trim());
        if (invalid) {
            setPageError("Each row needs both a Code and a Description before saving.");
            return;
        }

        setSaving(true);
        try {
            const payload = dirtyRows.map((r) => ({
                COMPANY_CODE: r.company_code,
                PL_CODE: r.pl_code.trim(),
                PL_NAME: r.pl_name.trim(),
                PL_TYPE: r.pl_type,
                H_CODE: r.h_code,
                PRV_CODE: r.prv_code,
            }));

            // ── PLACEHOLDER: wire this to your real save API ──
            // await savePLSetup({ records: payload });
            console.log("Save payload (wire to your API):", payload);

            setStatusMessage(
                dirtyRows.length === 1 ? "Saved 1 row." : `Saved ${dirtyRows.length} rows.`
            );
            await fetchPLSetup();
            setSelectedRowId(null);
        } catch (error) {
            console.error("P&L setup save error:", error);
            setPageError("Save failed. Check console.");
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ───────────────────────────────────────────────────────────────────
    // TODO: replace the body of this call with your real delete endpoint, e.g.:
    //   await deletePLSetup({ companyCode, plCode: row.pl_code });
    const handleDelete = async () => {
        if (!selectedRowId) {
            setPageError("Select a row first to delete it.");
            return;
        }

        const row = items.find((r) => r.rowId === selectedRowId);
        if (!row) return;

        if (row.isNew) {
            setItems((prev) => prev.filter((r) => r.rowId !== row.rowId));
            setSelectedRowId(null);
            setStatusMessage("Row removed.");
            return;
        }

        const confirmed = window.confirm(
            `Delete P&L code "${row.pl_code} — ${row.pl_name}"? This cannot be undone.`
        );
        if (!confirmed) return;

        setDeleting(true);
        setPageError(null);
        setStatusMessage(null);
        try {
            // ── PLACEHOLDER: wire this to your real delete API ──
            // await deletePLSetup({ companyCode: row.company_code, plCode: row.pl_code });
            console.log("Delete payload (wire to your API):", {
                COMPANY_CODE: row.company_code,
                PL_CODE: row.pl_code,
            });

            setItems((prev) => prev.filter((r) => r.rowId !== row.rowId));
            setSelectedRowId(null);
            setStatusMessage("Row deleted.");
        } catch (error) {
            console.error("P&L setup delete error:", error);
            setPageError("Delete failed. Check console.");
        } finally {
            setDeleting(false);
        }
    };

    // ── Filtered list ────────────────────────────────────────────────────────────
    const filteredItems = items.filter(
        (i) =>
            i.pl_code.toLowerCase().includes(search.toLowerCase()) ||
            i.pl_name.toLowerCase().includes(search.toLowerCase())
    );

    const dirtyCount = items.filter((r) => r.isDirty).length;

    // ─── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{ background: "#f3f4f6", padding: "4px 8px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                tbody tr:last-child td { border-bottom: none !important; }
                tbody tr:hover td { background: #f9fafb; }
                .action-btn:hover { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                .action-btn-danger:hover { background: #fef2f2 !important; border-color: #dc2626 !important; color: #dc2626 !important; }
                .cell-input:focus { border-color: #185FA5 !important; background: #fff !important; outline: none; }
                .add-row-btn:hover { background: #f0f7ff !important; border-color: #185FA5 !important; }
            `}</style>

            <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "10px 10px" }}>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            P&amp;L Setup
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {dirtyCount > 0 && (
                                <span style={{ ...badgeStyle, background: "#FEF3C7", color: "#92400E" }}>
                                    {dirtyCount} unsaved
                                </span>
                            )}
                            <span style={badgeStyle}>{items.length} total</span>
                        </div>
                    </div>

                    {/* Search + Add row, side by side */}
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
                                fontSize: 12, fontWeight: 500, color: "#185FA5",
                                background: "#fff", border: "0.5px solid #d1d5db", borderRadius: 6,
                                cursor: "pointer", padding: "6px 14px", whiteSpace: "nowrap",
                            }}
                        >
                            + Add row
                        </button>
                    </div>

                    <div style={{ border: "0.5px solid #e5e7eb", borderRadius: 6, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
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
                                            <tr
                                                key={row.rowId}
                                                style={rowStyle(isSelected)}
                                                onClick={() => setSelectedRowId(row.rowId)}
                                            >
                                                <td style={tdStyle}>
                                                    <input
                                                        className="cell-input"
                                                        type="text"
                                                        value={row.pl_code}
                                                        disabled={!row.isNew}
                                                        placeholder="e.g. 30007"
                                                        onChange={(e) => updateRow(row.rowId, { pl_code: e.target.value })}
                                                        onClick={(e) => e.stopPropagation()}
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
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={cellInputStyle}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <select
                                                        value={row.pl_type}
                                                        onChange={(e) =>
                                                            updateRow(row.rowId, { pl_type: e.target.value as "H" | "D" })
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
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

                    {/* Status / error */}
                    <div style={{ minHeight: 20, marginTop: 8 }}>
                        {pageError && (
                            <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 6, padding: "6px 12px" }}>
                                {pageError}
                            </div>
                        )}
                        {!pageError && statusMessage && (
                            <div style={{ fontSize: 12, color: "#15803d", background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 6, padding: "6px 12px" }}>
                                {statusMessage}
                            </div>
                        )}
                    </div>

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn-danger"
                            onClick={handleDelete}
                            disabled={!selectedRowId || deleting || saving}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #fecaca", background: "#fff",
                                cursor: (!selectedRowId || deleting || saving) ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6,
                                color: "#dc2626", opacity: (!selectedRowId || deleting || saving) ? 0.5 : 1,
                            }}
                        >
                            {deleting
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Deleting...</>
                                : <><Trash2 size={13} /> Delete</>
                            }
                        </button>
                        <button
                            className="action-btn-primary"
                            onClick={handleSave}
                            disabled={saving || loading}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5",
                                cursor: (saving || loading) ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6,
                                color: "#fff", opacity: (saving || loading) ? 0.7 : 1,
                            }}
                        >
                            {saving
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving...</>
                                : <><Save size={13} /> Save</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PLSetupPage;