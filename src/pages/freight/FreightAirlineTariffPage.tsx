import type { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  Plane,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "../../api/client";
import { freightSelect } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";

type AirlineTariffMode = "entry" | "report";

type AirlineTariffRow = {
  AIR_TARIFF_NO?: number | string;
  COMPANY_CODE?: string;
  AIRLINE_CODE?: string;
  AIRLINE_NAME?: string;
  SOURCE?: string;
  DESTINATION?: string;
  DIRECT_VIA?: string;
  IATA_CODE?: string;
  CURR_CODE?: string;
  MINIMUM?: number | string;
  NORMAL?: number | string;
  K_45?: number | string;
  K_100?: number | string;
  K_250?: number | string;
  K_300?: number | string;
  K_500?: number | string;
  K_1000?: number | string;
  HARD_FREIGHT?: string;
  PERISHABLE?: string;
  RESTRICTION?: string;
  RESTRICTION_DET?: string;
  USER_ID?: string;
  USER_DT?: string;
  [key: string]: unknown;
};

type TariffForm = {
  company_code: string;
  air_tariff_no: string;
  airline_code: string;
  airline_name: string;
  source: string;
  destination: string;
  direct_via: string;
  iata_code: string;
  curr_code: string;
  minimum: string;
  normal: string;
  k_45: string;
  k_100: string;
  k_250: string;
  k_300: string;
  k_500: string;
  k_1000: string;
  hard_freight: string;
  perishable: string;
  restriction: string;
  restriction_det: string;
  user_id: string;
};

type Notice = { type: "success" | "error"; text: string } | null;
type EntryView = "list" | "editor";

const emptyForm = (companyCode: string, userId: string): TariffForm => ({
  company_code: companyCode,
  air_tariff_no: "",
  airline_code: "",
  airline_name: "",
  source: "",
  destination: "",
  direct_via: "",
  iata_code: "",
  curr_code: "",
  minimum: "",
  normal: "",
  k_45: "",
  k_100: "",
  k_250: "",
  k_300: "",
  k_500: "",
  k_1000: "",
  hard_freight: "N",
  perishable: "",
  restriction: "",
  restriction_det: "",
  user_id: userId,
});

const slabFields: { key: keyof TariffForm; label: string }[] = [
  { key: "minimum", label: "Minimum" },
  { key: "normal", label: "Normal" },
  { key: "k_45", label: "45 kg" },
  { key: "k_100", label: "100 kg" },
  { key: "k_250", label: "250 kg" },
  { key: "k_300", label: "300 kg" },
  { key: "k_500", label: "500 kg" },
  { key: "k_1000", label: "1000 kg" },
];

export function FreightAirlineTariffPage({ mode = "entry" }: { mode?: AirlineTariffMode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");

  const [form, setForm] = useState<TariffForm>(() => emptyForm(companyCode, userId));
  const [rows, setRows] = useState<AirlineTariffRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [entryView, setEntryView] = useState<EntryView>("list");
  const [readOnly, setReadOnly] = useState(false);
  const [filters, setFilters] = useState({
    airline_code: "All",
    airline_name: "",
    source: "All",
    destination: "All",
    iata_code: "All",
  });

  useEffect(() => {
    if (!notice) return;
    if (notice.type === "success") toast.success(notice.text);
    else toast.error(notice.text);
    setNotice(null);
  }, [notice, toast]);

  const isReport = mode === "report";
  const reportSummary = useMemo(() => {
    const airlines = new Set(rows.map((row) => text(row, "AIRLINE_CODE")).filter(Boolean)).size;
    const routes = new Set(rows.map((row) => `${text(row, "SOURCE")}->${text(row, "DESTINATION")}`).filter((route) => route !== "->")).size;
    const currencies = new Set(rows.map((row) => text(row, "CURR_CODE")).filter(Boolean)).size;
    const minRates = rows.map((row) => Number(text(row, "MINIMUM"))).filter((value) => Number.isFinite(value) && value > 0);
    const lowestMinimum = minRates.length ? Math.min(...minRates) : 0;
    return { airlines, routes, currencies, lowestMinimum };
  }, [rows]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const endpoint = isReport ? "/api/freight/airline-tariff/report" : "/api/freight/airline-tariff/list";
      const payload = isReport
        ? { company_code: companyCode, ...filters }
        : { company_code: companyCode, search: searchText };
      const response = await api.post<{ success?: boolean; data?: AirlineTariffRow[]; message?: string }>(endpoint, payload);
      setRows(response.data.data || []);
    } catch (error: any) {
      setRows([]);
      setNotice({
        type: "error",
        text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load airline tariff data.",
      });
    } finally {
      setLoading(false);
    }
  }, [companyCode, filters, isReport, searchText]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const resetForm = () => {
    setForm(emptyForm(companyCode, userId));
    setReadOnly(false);
    setNotice(null);
  };

  const openAdd = () => {
    setForm(emptyForm(companyCode, userId));
    setReadOnly(false);
    setEntryView("editor");
    setNotice(null);
  };

  const openEdit = (row: AirlineTariffRow) => {
    setForm(fromRow(row, companyCode, userId));
    setReadOnly(false);
    setEntryView("editor");
    setNotice(null);
  };

  const openView = (row: AirlineTariffRow) => {
    setForm(fromRow(row, companyCode, userId));
    setReadOnly(true);
    setEntryView("editor");
    setNotice(null);
  };

  const backToList = () => {
    setEntryView("list");
    setReadOnly(false);
    resetForm();
  };

  const saveTariff = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { air_tariff_no?: string | number }; message?: string }>(
        "/api/freight/airline-tariff/save",
        { tariff: { ...form, company_code: companyCode, user_id: userId } },
      );
      const tariffNo = response.data.data?.air_tariff_no;
      setNotice({ type: "success", text: `Airline tariff ${tariffNo || form.air_tariff_no || ""} saved.`.trim() });
      setForm((current) => ({ ...current, air_tariff_no: tariffNo ? String(tariffNo) : current.air_tariff_no }));
      await loadRows();
      setEntryView("list");
    } catch (error: any) {
      setNotice({
        type: "error",
        text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save airline tariff.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTariff = async () => {
    if (!form.air_tariff_no) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/airline-tariff/delete", { company_code: companyCode, air_tariff_no: form.air_tariff_no });
      setNotice({ type: "success", text: `Airline tariff ${form.air_tariff_no} deleted.` });
      resetForm();
      await loadRows();
      setEntryView("list");
    } catch (error: any) {
      setNotice({
        type: "error",
        text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete airline tariff.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTariffRow = async (row: AirlineTariffRow) => {
    const tariffNo = text(row, "AIR_TARIFF_NO");
    if (!tariffNo) return;
    const airline = text(row, "AIRLINE_CODE") || text(row, "AIRLINE_NAME") || "selected airline";
    if (!window.confirm(`Delete tariff ${tariffNo} for ${airline}?`)) return;

    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/airline-tariff/delete", { company_code: companyCode, air_tariff_no: tariffNo });
      setNotice({ type: "success", text: `Airline tariff ${tariffNo} deleted.` });
      if (form.air_tariff_no === tariffNo) resetForm();
      await loadRows();
    } catch (error: any) {
      setNotice({
        type: "error",
        text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete airline tariff.",
      });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<AirlineTariffRow>[]>(() => [
    { accessorKey: "AIR_TARIFF_NO", header: "Tariff No", size: 90 },
    { accessorKey: "AIRLINE_CODE", header: "Airline", size: 90 },
    { accessorKey: "AIRLINE_NAME", header: "Airline Name", size: 210 },
    { accessorKey: "SOURCE", header: "Source", size: 110 },
    { accessorKey: "DESTINATION", header: "Destination", size: 120 },
    { accessorKey: "DIRECT_VIA", header: "Direct/Via", size: 200 },
    { accessorKey: "IATA_CODE", header: "IATA", size: 90 },
    { accessorKey: "CURR_CODE", header: "Currency", size: 85 },
    { accessorKey: "MINIMUM", header: "Min", size: 80 },
    { accessorKey: "NORMAL", header: "Normal", size: 80 },
    { accessorKey: "K_45", header: "45 kg", size: 70 },
    { accessorKey: "K_100", header: "100 kg", size: 70 },
    { accessorKey: "K_250", header: "250 kg", size: 70 },
    { accessorKey: "K_300", header: "300 kg", size: 70 },
    { accessorKey: "K_500", header: "500 kg", size: 70 },
    { accessorKey: "K_1000", header: "1000 kg", size: 80 },
    { accessorKey: "HARD_FREIGHT", header: "Hard", size: 70 },
    { accessorKey: "PERISHABLE", header: "Perish", size: 70 },
    { accessorKey: "RESTRICTION", header: "Restriction", size: 20},
    { accessorKey: "RESTRICTION_DET", header: "Restriction Detail", size: 500 },
    ...(!isReport ? [{
      id: "actions",
      header: "Actions",
      size: 110,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View tariff"
            onClick={(event) => {
              event.stopPropagation();
              openView(row.original);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Edit tariff"
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row.original);
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete tariff"
            disabled={saving}
            onClick={(event) => {
              event.stopPropagation();
              void deleteTariffRow(row.original);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    } satisfies ColumnDef<AirlineTariffRow>] : []),
  ], [isReport, saving, deleteTariffRow]);

   return (
     <section className="grid gap-3">
       <div className={`rounded-md border shadow-sm ${isReport ? "overflow-hidden bg-card" : "bg-card"}`}>
        <div className={`flex flex-wrap items-center justify-between gap-3  px-4 py-3 ${isReport ? "bg-[#185FA5] text-white" : ""}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-md ${isReport ? "bg-white/15 text-white" : "bg-primary/10 text-primary"}`}>
              {isReport ? <BarChart3 className="h-5 w-5" /> : <Plane className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              {/* <div className={`text-[11px] font-bold uppercase tracking-[0.22em] ${isReport ? "text-blue-100" : "text-primary"}`}>Freight Air</div> */}
              <h1 className={`truncate text-2xl font-bold ${isReport ? "text-white" : "text-foreground"}`}>
                {isReport ? "Airline Tariff Report" : "Airline Tariff"}
              </h1>
              <p className={`text-sm ${isReport ? "text-blue-50" : "text-muted-foreground"}`}>
                {isReport ? "Filter airline rate slabs by route, carrier and validity" : "Maintain airline source, destination and weight break rates"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isReport && (
              entryView === "list" ? (
                <Button type="button" onClick={openAdd} disabled={saving}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={backToList} disabled={saving}>
                  <ArrowLeft className="h-4 w-4" /> List
                </Button>
              )
            )}
            {(isReport || entryView === "list") && (
              <Button type="button" variant={isReport ? "secondary" : "outline"} onClick={() => void loadRows()} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            )}
          </div>
        </div>

        {(notice || isReport || entryView === "editor") && (
        <div className="grid gap-3 p-3">
          {notice && (
            <div className={`rounded-md border px-3 py-2 text-sm font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
              {notice.text}
            </div>
          )}

          {isReport ? (
            <>
              <div className="grid gap-2 md:grid-cols-5">
                <ReportTile label="Rows" value={String(rows.length)} />
                <ReportTile label="Airlines" value={String(reportSummary.airlines)} />
                <ReportTile label="Routes" value={String(reportSummary.routes)} />
                <ReportTile label="Currencies" value={String(reportSummary.currencies)} />
                <ReportTile label="Lowest Min" value={reportSummary.lowestMinimum ? String(reportSummary.lowestMinimum) : "-"} />
              </div>
              <ReportFilters
                companyCode={companyCode}
                filters={filters}
                setFilters={setFilters}
                onRun={() => void loadRows()}
                loading={loading}
              />
            </>
          ) : entryView === "editor" ? (
            <form className="grid gap-3" onSubmit={saveTariff}>
              <div className="grid gap-3 ">
                <div className="rounded-md border bg-muted/20">
                  <SectionTitle title="Route and Airline" subtitle={`${form.airline_code || "Airline pending"} / ${form.source || "-"} -> ${form.destination || "-"}`} />
                  <div className="grid gap-2 p-3 md:grid-cols-4 tariff-form-fields"> 
                    <Field label="Tariff No" value={form.air_tariff_no || "Auto"} disabled onChange={() => undefined} />
                    <div className="grid gap-1 text-[11px] font-bold uppercase text-muted-foreground tariff-lookup-fix">
                      <span>Airline <span style={{ color: "#E24B4A", marginLeft: 2 }}>*</span></span>
                      <LookupField
                      label="Airline"
                      value={form.airline_code}
                      displayValue={form.airline_name}
                      required
                      compact
                      valueField="AIRLINE_CODE"
                      displayFields={["AIRLINE_CODE", "AIRLINE_NAME"]}
                      columns={[{ field: "AIRLINE_CODE", header: "Code" }, { field: "AIRLINE_NAME", header: "Airline" }]}
                      loadOptions={() => loadLookup("freight_airline", companyCode)}
                      disabled={readOnly}
                      onChange={(value, row) => updateForm(setForm, {
                        airline_code: value,
                        airline_name: text(row, "AIRLINE_NAME", "airline_name"),
                      })}
                    />
                    </div>
                    <Field label="Source" value={form.source} required disabled={readOnly} onChange={(value) => updateForm(setForm, { source: value })} />
                    <Field label="Destination" value={form.destination} required disabled={readOnly} onChange={(value) => updateForm(setForm, { destination: value })} />
                    <Field label="Direct/Via" value={form.direct_via} disabled={readOnly} onChange={(value) => updateForm(setForm, { direct_via: value })} />
                    <Field label="IATA Code" value={form.iata_code} disabled={readOnly} onChange={(value) => updateForm(setForm, { iata_code: value })} />
                    <div className="grid gap-1 text-[11px] font-bold uppercase text-muted-foreground tariff-lookup-fix">
                      <span>Currency <span style={{ color: "#E24B4A", marginLeft: 2 }}>*</span></span>
                      <LookupField
                      label="Currency"
                      value={form.curr_code}
                      compact
                      valueField="CURR_CODE"
                      displayFields={["CURR_CODE", "CURR_NAME"]}
                      columns={[{ field: "CURR_CODE", header: "Code" }, { field: "CURR_NAME", header: "Currency" }]}
                      loadOptions={() => loadLookup("freight_currency", companyCode)}
                      disabled={readOnly}
                      onChange={(value) => updateForm(setForm, { curr_code: value })}
                    />
                    </div>
                    <SelectField label="Hard Freight" value={form.hard_freight} disabled={readOnly} onChange={(value) => updateForm(setForm, { hard_freight: value })} />
                    <SelectField label="Perishable" value={form.perishable} disabled={readOnly} onChange={(value) => updateForm(setForm, { perishable: value })} />
                    <SelectField label="Restriction" value={form.restriction} disabled={readOnly} onChange={(value) => updateForm(setForm, { restriction: value })} />
                    <div className="grid gap-2 p-3 pt-0 md:grid-cols-1">
                    <Field label="Restriction Detail" value={form.restriction_det} disabled={readOnly} onChange={(value) => updateForm(setForm, { restriction_det: value })} />
                  </div>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20">
                  <SectionTitle title="Weight Breaks" subtitle={`${form.curr_code || "Currency pending"} rate slabs`} />
                  <div className="grid gap-2 p-3 sm:grid-cols-4 tariff-form-fields">
                    {slabFields.map((field) => (
                      <Field
                        key={field.key}
                        label={field.label}
                        value={form[field.key]}
                        type="number"
                        disabled={readOnly}
                        onChange={(value) => updateForm(setForm, { [field.key]: value })}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={backToList} disabled={saving}>
                  <ArrowLeft className="h-4 w-4" /> Cancel
                </Button>
                {!readOnly && (
                  <>
                    <Button type="button" variant="outline" onClick={deleteTariff} disabled={saving || !form.air_tariff_no}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                    <Button type="submit" disabled={saving}>
                      <Save className="h-4 w-4" /> Save
                    </Button>
                  </>
                )}
              </div>
            </form>
          ) : null
          }
        </div>
      )}
      </div>
    
      {(isReport || entryView === "list") && (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          density="grid"
          height={isReport ? "calc(100vh - 355px)" : "calc(100vh - 230px)"}
          minWidth={1280}
          enableExport
          exportFilename={isReport ? "airline-tariff-report.csv" : "airline-tariff.csv"}
          searchValue={isReport ? undefined : searchText}
          onSearchChange={isReport ? undefined : setSearchText}
          searchPlaceholder="Search tariff no, airline, source, destination..."
          emptyText="No airline tariff records found"
          toolbar={isReport ? (
            <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(rows)}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          ) : undefined}
        />
      )}
    </section>
  );
}

function ReportTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-[#F7FBFF] px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase text-slate-500">{label}</span>
        <FileSpreadsheet className="h-4 w-4 text-[#185FA5]" />
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function ReportFilters({
  companyCode,
  filters,
  setFilters,
  onRun,
  loading,
}: {
  companyCode: string;
  filters: { airline_code: string; airline_name: string; source: string; destination: string; iata_code: string };
  setFilters: (value: { airline_code: string; airline_name: string; source: string; destination: string; iata_code: string }) => void;
  onRun: () => void;
  loading: boolean;
}) {
  const update = (patch: Partial<typeof filters>) => setFilters({ ...filters, ...patch });
  const reset = () => setFilters({ airline_code: "All", airline_name: "", source: "All", destination: "All", iata_code: "All" });

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#E6F1FB] text-[#185FA5]">
            <Filter className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold uppercase text-slate-900">Report Filters</div>
            <div className="text-xs text-slate-500">All values are allowed for a broader tariff report.</div>
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <LookupField
          label="Airline"
          value={filters.airline_code === "All" ? "" : filters.airline_code}
          displayValue={filters.airline_name || (filters.airline_code === "All" ? "All" : filters.airline_code)}
          compact
          placeholder="All airlines"
          valueField="AIRLINE_CODE"
          displayFields={["AIRLINE_CODE", "AIRLINE_NAME"]}
          columns={[{ field: "AIRLINE_CODE", header: "Code" }, { field: "AIRLINE_NAME", header: "Airline" }]}
          loadOptions={() => loadLookup("freight_airline_tariff_airline", companyCode)}
          onChange={(value, row) => update({ airline_code: value || "All", airline_name: text(row, "AIRLINE_NAME", "airline_name") })}
        />
        <LookupField
          label="Source"
          value={filters.source === "All" ? "" : filters.source}
          displayValue={filters.source}
          compact
          placeholder="All"
          valueField="SOURCE"
          displayFields={["SOURCE"]}
          columns={[{ field: "SOURCE", header: "Source" }]}
          loadOptions={() => loadLookup("freight_airline_tariff_source", companyCode)}
          onChange={(value) => update({ source: value || "All" })}
        />
        <LookupField
          label="Destination"
          value={filters.destination === "All" ? "" : filters.destination}
          displayValue={filters.destination}
          compact
          placeholder="All"
          valueField="DESTINATION"
          displayFields={["DESTINATION"]}
          columns={[{ field: "DESTINATION", header: "Destination" }]}
          loadOptions={() => loadLookup("freight_airline_tariff_destination", companyCode)}
          onChange={(value) => update({ destination: value || "All" })}
        />
        <LookupField
          label="IATA"
          value={filters.iata_code === "All" ? "" : filters.iata_code}
          displayValue={filters.iata_code}
          compact
          placeholder="All"
          valueField="IATA_CODE"
          displayFields={["IATA_CODE"]}
          columns={[{ field: "IATA_CODE", header: "IATA" }]}
          loadOptions={() => loadLookup("freight_airline_tariff_iata", companyCode)}
          onChange={(value) => update({ iata_code: value || "All" })}
        />
        <div className="flex items-end gap-2">
          <Button type="button" onClick={onRun} disabled={loading}>
            <Search className="h-4 w-4" /> Run
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={loading}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
      <div>
        <div className="text-sm font-bold uppercase text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-bold uppercase text-muted-foreground">
      {label}
        <Input
        className="h-8 text-sm font-semibold" style={{ borderColor: "#94a3b8" }}
        value={value}
        type={type}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-[11px] font-bold uppercase text-muted-foreground">
      {label}
      <select
        className="h-8 rounded-md border border-slate-400 bg-background px-2 text-sm font-semibold text-foreground shadow-none"
        value={value || "N"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="N">No</option>
        <option value="Y">Yes</option>
      </select>
    </label>
  );
}

function fromRow(row: AirlineTariffRow, companyCode: string, userId: string): TariffForm {
  return {
    company_code: text(row, "COMPANY_CODE") || companyCode,
    air_tariff_no: text(row, "AIR_TARIFF_NO"),
    airline_code: text(row, "AIRLINE_CODE"),
    airline_name: text(row, "AIRLINE_NAME"),
    source: text(row, "SOURCE"),
    destination: text(row, "DESTINATION"),
    direct_via: text(row, "DIRECT_VIA"),
    iata_code: text(row, "IATA_CODE"),
    curr_code: text(row, "CURR_CODE"),
    minimum: text(row, "MINIMUM"),
    normal: text(row, "NORMAL"),
    k_45: text(row, "K_45"),
    k_100: text(row, "K_100"),
    k_250: text(row, "K_250"),
    k_300: text(row, "K_300"),
    k_500: text(row, "K_500"),
    k_1000: text(row, "K_1000"),
    hard_freight: text(row, "HARD_FREIGHT") || "N",
    perishable: text(row, "PERISHABLE") || "N",
    restriction: text(row, "RESTRICTION"),
    restriction_det: text(row, "RESTRICTION_DET"),
    user_id: text(row, "USER_ID") || userId,
  };
}

function updateForm(setForm: (updater: (current: TariffForm) => TariffForm) => void, patch: Partial<TariffForm>) {
  setForm((current) => ({ ...current, ...patch }));
}

async function loadLookup(parameter: string, companyCode: string, query = "") {
  return (await freightSelect<LookupRow>({ parameter, code1: companyCode, code2: query || "NULL", number1: 50 })).map((row) => normalizeLookupRow(row));
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function text(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return "";
}

function exportCsv(rows: AirlineTariffRow[]) {
  const headers = ["AIR_TARIFF_NO", "AIRLINE_CODE", "AIRLINE_NAME", "SOURCE", "DESTINATION", "DIRECT_VIA", "IATA_CODE", "CURR_CODE", "MINIMUM", "NORMAL", "K_45", "K_100", "K_250", "K_300", "K_500", "K_1000", "HARD_FREIGHT", "PERISHABLE", "RESTRICTION", "RESTRICTION_DET"];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "airline-tariff-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvValue(value: unknown) {
  const textValue = String(value ?? "");
  return /[",\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}
