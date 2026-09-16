import { useEffect, useState, type FormEvent } from "react";
import { getWaybillBilling, processWaybillBilling, reviewWaybillRevenue, saveWaybillBillingSettings, type WaybillBillingSettings, type WaybillRevenueRow } from "../../api/vendor";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { VendorPageHeader } from "./components";
import type { Notice } from "./vendorTypes";

const initialSettings: WaybillBillingSettings = {
  non_standard_base: null, rate_city: null, non_standard_kms: null,
  duqm_local_charge: null, duqm_frequency: null,
};
const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";
const money = (value: number | null | undefined) => value == null ? "Pending" : value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const statusLabel = (row: WaybillRevenueRow) => row.stale ? "Changed — process again" : !row.processed ? "Not processed" : row.status.replace(/_/g, " ");
const amountFields = [
  ["base_revenue", "Base Revenue"], ["kms_revenue", "Kms Revenue"],
  ["kms_chargeable", "Kms chargeable"], ["local_trip_revenue", "Additional local trip revenue"],
] as const;

export function WaybillRevenuePage() {
  const [rows, setRows] = useState<WaybillRevenueRow[]>([]);
  const [settings, setSettings] = useState<WaybillBillingSettings>(initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<WaybillRevenueRow | null>(null);
  const [manual, setManual] = useState(false);
  const [review, setReview] = useState<Record<string, string>>({});

  const reload = async () => {
    const data = await getWaybillBilling();
    setRows(data.rows); setSettings(data.settings); setSettingsDirty(false);
  };
  useEffect(() => {
    let active = true;
    getWaybillBilling().then((data) => {
      if (active) { setRows(data.rows); setSettings(data.settings); }
    }).catch((error: unknown) => {
      if (active) setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load revenue." });
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setNotice(null);
    try {
      await action(); setSelected(null);
      try { await reload(); setNotice({ type: "success", message }); }
      catch { setNotice({ type: "error", message: `${message} Refresh failed; reload before reviewing further.` }); setRows([]); }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to complete the operation." });
    } finally { setBusy(false); }
  };
  const openReview = (row: WaybillRevenueRow) => {
    setSelected(row); setManual(row.status === "NEEDS_REVIEW" || row.status === "MANUAL_VERIFIED");
    setReview({
      ...Object.fromEntries(amountFields.map(([key]) => [key, row[key] == null ? "" : String(row[key])])),
      review_note: row.review_note || "",
    });
  };
  const saveReview = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    void perform(() => reviewWaybillRevenue(selected.waybill_id, {
      ...review, source_hash: selected.source_hash, review_token: selected.review_token || "", mode: manual ? "manual" : "verify",
    }), "Revenue review saved.");
  };

  const visibleRows = rows.filter((row) => (!month || row.pickup_day?.startsWith(month)) && (
    filter === "all" || (filter === "review" && row.status === "NEEDS_REVIEW") ||
    (filter === "unprocessed" && !row.processed) ||
    (filter === "verified" && row.processed && ["VERIFIED", "MANUAL_VERIFIED"].includes(row.status))
  ));
  const verified = visibleRows.filter((row) => row.processed && ["VERIFIED", "MANUAL_VERIFIED"].includes(row.status));
  const verifiedTotal = verified.reduce((sum, row) => sum + Math.round((row.total_revenue || 0) * 1000), 0) / 1000;
  const detailPeers = selected ? rows.filter((row) => row.group_key === selected.group_key) : [];
  const exportRows = visibleRows.map((row) => ({ ...row, verification_status: statusLabel(row), review_issues: row.issues.join(" ") }));

  return <section className="grid gap-4">
    <VendorPageHeader title="Revenue table for verification"
      description="Match destinations, classify truck/day trips, calculate base and kilometre revenue, then verify each waybill."
      actions={<><Button variant="outline" disabled={busy} onClick={() => setSettingsOpen((open) => !open)}>Billing settings</Button>
        <Button disabled={busy || settingsDirty || !rows.length} onClick={() => void perform(processWaybillBilling, "All waybills processed. Review any flagged trips.")}>{busy ? "Working..." : "Process all waybills"}</Button></>}
    />
    <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
    <Card><CardContent className="grid gap-2 pt-4 text-sm">
      <p><strong>1.</strong> Match Well IDs to cities. <strong>2.</strong> Group by truck and pickup date; more than one distinct well is non-standard, including wells in the same city.</p>
      <p><strong>3–4.</strong> Apply standard/non-standard base rates. <strong>5–6.</strong> Apply kilometre rates after the 15 Km deduction. <strong>7.</strong> Review the revenue table below.</p>
      <p className="text-muted-foreground">Standard Kms = max(0, Actual Kms − Base Kms − 15). Two-drop rules and the Duqm Salt charge must be set before those trips calculate. More than two drops require team-entered amounts. Processing always includes all saved waybills; filters only change this view.</p>
    </CardContent></Card>

    {settingsOpen && <Card><CardHeader><h2 className="font-semibold">Billing settings</h2></CardHeader><CardContent>
      <form className="grid gap-4" onChange={() => setSettingsDirty(true)} onSubmit={(event) => { event.preventDefault(); void perform(() => saveWaybillBillingSettings(settings), "Billing settings saved. Process waybills to save the updated calculations."); }}>
        <p className="text-sm text-muted-foreground">The plan does not specify the two-drop formula or local-trip amount. Select the agreed rules here. Unset rules leave affected trips for review. Each kilometre component below receives its own 15 Km deduction, floored at zero.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">Non-standard base revenue
            <select className={selectClass} disabled={busy} value={settings.non_standard_base || ""} onChange={(event) => setSettings({ ...settings, non_standard_base: (event.target.value || null) as WaybillBillingSettings["non_standard_base"] })}>
              <option value="">Not agreed — team review</option><option value="PER_WAYBILL">Each waybill: its own city's non-standard rate</option><option value="ONCE_PER_TRUCK_DAY">Once per truck/day: selected city's non-standard rate</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">City used for shared two-drop charges
            <select className={selectClass} disabled={busy} value={settings.rate_city || ""} onChange={(event) => setSettings({ ...settings, rate_city: (event.target.value || null) as WaybillBillingSettings["rate_city"] })}>
              <option value="">Not agreed — team review</option><option value="FARTHEST_WELL">Well with highest Actual Kms</option><option value="HIGHEST_NON_STANDARD_RATE">City with highest non-standard base revenue</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Non-standard chargeable Kms (once per truck/day)
            <select className={selectClass} disabled={busy} value={settings.non_standard_kms || ""} onChange={(event) => setSettings({ ...settings, non_standard_kms: (event.target.value || null) as WaybillBillingSettings["non_standard_kms"] })}>
              <option value="">Not agreed — team review</option><option value="PAIR_ONLY">max(0, distance between wells − 15)</option><option value="DIVERSION_PLUS_PAIR">Selected well's diversion + max(0, distance between wells − 15)</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Duqm Salt additional local-trip charge
            <Input disabled={busy} type="number" min="0" max="99999999999.999" step="0.001" placeholder="Enter agreed local-trip rate" value={settings.duqm_local_charge ?? ""}
              onChange={(event) => setSettings({ ...settings, duqm_local_charge: event.target.value === "" ? null : Number(event.target.value) })} />
          </label>
          <label className="grid gap-1 text-sm">Duqm Salt local-trip charge frequency
            <select className={selectClass} disabled={busy} value={settings.duqm_frequency || ""} onChange={(event) => setSettings({ ...settings, duqm_frequency: (event.target.value || null) as WaybillBillingSettings["duqm_frequency"] })}>
              <option value="">Not agreed — team review</option><option value="ONCE_PER_TRUCK_DAY">One additional local trip per truck/day</option><option value="PER_WAYBILL">One additional local trip per waybill</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Equal city-selection values use the earliest saved waybill. Shared Kms appear on that row only; other rows show zero shared Kms. A pair may be entered in either direction; differing forward/reverse distances require team review.</p>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>Save billing settings</Button></div>
      </form>
    </CardContent></Card>}
    {settingsDirty && <p className="text-sm font-medium">Billing settings have unsaved changes. Save them before processing or verifying revenue.</p>}

    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">Pickup month<Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Verification status<select className={selectClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="all">All</option><option value="review">Needs team review</option><option value="unprocessed">Not processed / changed</option><option value="verified">Verified</option>
      </select></label>
      <Button variant="outline" disabled={busy} onClick={() => { setMonth(""); setFilter("all"); }}>Clear filters</Button>
      <Button variant="outline" disabled={busy} onClick={() => void perform(async () => {}, "Revenue refreshed.")}>Refresh</Button>
      <p className="text-sm">{visibleRows.length} rows · {verified.length} verified · Verified revenue: <strong>{money(verifiedTotal)}</strong></p>
    </div>
    <DataTable<(typeof exportRows)[number], unknown>
      columns={[
        { accessorKey: "waybill_load_number", header: "Load Number" },
        { accessorKey: "destination_name", header: "Destination Name" },
        { accessorKey: "scheduled_vehicle", header: "Scheduled Vehicle" },
        { accessorKey: "pickup_date", header: "Pickup Date" },
        { accessorKey: "vendor_name", header: "Vendor Name" },
        { accessorKey: "rig_id", header: "Rig ID" },
        { accessorKey: "base_revenue", header: "Base Revenue", cell: ({ row }) => money(row.original.base_revenue) },
        { accessorKey: "kms_revenue", header: "Kms Revenue", cell: ({ row }) => money(row.original.kms_revenue) },
        { accessorKey: "trip_type", header: "Trip Type" },
        { accessorKey: "kms_chargeable", header: "Kms chargeable", cell: ({ row }) => money(row.original.kms_chargeable) },
        { accessorKey: "city", header: "City" },
        { accessorKey: "drop_count", header: "Drop points" },
        { accessorKey: "local_trip_revenue", header: "Additional Local Trip", cell: ({ row }) => money(row.original.local_trip_revenue) },
        { accessorKey: "total_revenue", header: "Total Revenue", cell: ({ row }) => money(row.original.total_revenue) },
        { accessorKey: "verification_status", header: "Verification Status" },
        { accessorKey: "review_issues", header: "Review Issues" },
        { accessorKey: "review_note", header: "Review Reason" },
        { accessorKey: "reviewed_by", header: "Reviewed By" },
        { accessorKey: "reviewed_at", header: "Reviewed At" },
        { id: "actions", header: "Review", cell: ({ row }) => <Button variant="outline" disabled={busy || settingsDirty} onClick={() => openReview(row.original)}>Details / Review</Button> },
      ]}
      data={exportRows} loading={busy} height={440} minWidth={2500} enableExport exportFilename="waybill-revenue-verification.csv" emptyText="No matching waybills. Save scanned waybills in the reader first." />

    {selected && <Card><CardHeader><h2 className="font-semibold">Review load {selected.waybill_load_number} — {selected.destination_name}</h2></CardHeader><CardContent className="grid gap-3">
      <p className="text-sm">{selected.scheduled_vehicle} · {selected.pickup_date} · {selected.trip_type} · {selected.drop_count} drop point(s)</p>
      <div className="text-sm"><strong>Waybills in this truck/day:</strong> {detailPeers.map((row) => `${row.waybill_load_number} (${row.destination_name})`).join(", ")}</div>
      {selected.issues.length > 0 && <ul className="list-disc pl-5 text-sm">{selected.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      {selected.calculation.length > 0 && <ul className="list-disc pl-5 text-sm">{selected.calculation.map((line) => <li key={line}>{line}</li>)}</ul>}
      {selected.reviewed_by && <p className="text-sm">Reviewed by {selected.reviewed_by} at {selected.reviewed_at}. {selected.review_note}</p>}
      {!selected.processed && <p className="text-sm font-medium">Process all waybills before saving this review. Any previous verification was invalidated if source data changed.</p>}
      <form onSubmit={saveReview} className="grid gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} disabled={busy || !selected.processed || selected.status === "NEEDS_REVIEW"} onChange={(event) => setManual(event.target.checked)} />Enter team-reviewed amounts for this row</label>
        {manual && <>
          <p className="text-sm text-muted-foreground">Enter this row's allocation only. For multi-drop trips, distribute shared charges across the rows once. The Kms entered here must already include the applicable 15 Km deductions. Include Duqm Salt's extra charge in Additional local trip revenue.</p>
          <div className="grid gap-3 md:grid-cols-2">{amountFields.map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label} *
            <Input type="number" min="0" max="99999999999.999" step="0.001" required disabled={busy || !selected.processed} value={review[key] ?? ""} onChange={(event) => { const value = event.target.value; setReview((current) => ({ ...current, [key]: value })); }} />
          </label>)}</div>
        </>}
        <label className="grid gap-1 text-sm">{manual ? "Reason / calculation explanation *" : "Review note"}
          <textarea className="min-h-20 rounded-md border bg-background p-2" required={manual} maxLength={2000} disabled={busy || !selected.processed} value={review.review_note || ""} onChange={(event) => { const value = event.target.value; setReview((current) => ({ ...current, review_note: value })); }} />
        </label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setSelected(null)}>Close</Button><Button type="submit" disabled={busy || settingsDirty || !selected.processed}>{manual ? "Save team review" : "Verify revenue"}</Button></div>
      </form>
    </CardContent></Card>}
  </section>;
}
