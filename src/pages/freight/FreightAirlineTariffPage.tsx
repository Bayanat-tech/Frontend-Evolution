import type { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  MapPinned,
  PackageCheck,
  Coins,
  BarChart3,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  Plane,
  Plus,
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
    {
      accessorKey: "AIR_TARIFF_NO",
      header: "Tariff No",
      size: 90,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => openEdit(row.original)}
          className="font-semibold text-[#00378C] hover:underline cursor-pointer"
          title="Click to edit tariff"
        >
          {text(row.original, "AIR_TARIFF_NO")}
        </button>
      ),
    },
    { accessorKey: "AIRLINE_CODE", header: "Airline", size: 85 },
    { accessorKey: "AIRLINE_NAME", header: "Airline Name", size: 200 },
    { accessorKey: "SOURCE", header: "Source", size: 105 },
    { accessorKey: "DESTINATION", header: "Destination", size: 110 },
    { accessorKey: "DIRECT_VIA", header: "Direct/Via", size: 150 },
    { accessorKey: "IATA_CODE", header: "IATA", size: 80 },
    { accessorKey: "CURR_CODE", header: "Currency", size: 80 },
    {
      accessorKey: "MINIMUM",
      header: "Min",
      size: 75,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "NORMAL",
      header: "Normal",
      size: 75,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "K_45",
      header: "45 kg",
      size: 70,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "K_100",
      header: "100 kg",
      size: 70,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "K_250",
      header: "250 kg",
      size: 70,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "K_300",
      header: "300 kg",
      size: 70,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "K_500",
      header: "500 kg",
      size: 70,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "K_1000",
      header: "1000 kg",
      size: 75,
      cell: ({ getValue }) => <div className="text-right font-mono font-medium">{formatRate(getValue())}</div>,
    },
    {
      accessorKey: "HARD_FREIGHT",
      header: "Hard",
      size: 65,
      cell: ({ getValue }) => <div className="text-center">{String(getValue() ?? "") === "Y" ? "Yes" : "No"}</div>,
    },
    {
      accessorKey: "PERISHABLE",
      header: "Perish",
      size: 65,
      cell: ({ getValue }) => <div className="text-center">{String(getValue() ?? "") === "Y" ? "Yes" : "No"}</div>,
    },
    {
      accessorKey: "RESTRICTION",
      header: "Restriction",
      size: 85,
      cell: ({ getValue }) => <div className="text-center">{String(getValue() ?? "") === "Y" ? "Yes" : "No"}</div>,
    },
    { accessorKey: "RESTRICTION_DET", header: "Restriction Detail", size: 220 },
    ...(!isReport ? [{
      id: "actions",
      enableColumnFilter: false,
      enableSorting: false,
      header: "Actions",
      size: 105,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md transition-colors"
            title="View tariff"
            onClick={(event) => {
              event.stopPropagation();
              openView(row.original);
            }}
          >
            <Eye size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md transition-colors"
            title="Edit tariff"
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row.original);
            }}
          >
            <Edit2 size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete tariff"
            disabled={saving}
            onClick={(event) => {
              event.stopPropagation();
              void deleteTariffRow(row.original);
            }}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    } satisfies ColumnDef<AirlineTariffRow>] : []),
  ], [isReport, saving, deleteTariffRow]);

  return (
    <section className={`freight-airline-tariff-screen grid gap-2 ${entryView === "list" ? "freight-enquiry-list-screen" : "freight-ui-standard freight-dense-form"}`}>
      {/* Top Header Card */}
      <div className={`tariff-page-header flex flex-wrap items-center justify-between gap-2 ${isReport ? "bg-[#185FA5] text-white" : ""}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={`tariff-page-icon ${isReport ? "bg-white/15 text-white border-white/20" : ""}`}>
            {isReport ? <BarChart3 size={20} /> : <Plane size={20} />}
          </span>
          <div className="min-w-0">
            <h1 className={`truncate text-lg font-bold leading-tight ${isReport ? "text-white" : "text-slate-900"}`}>
              {isReport
                ? "Airline Tariff Report"
                : entryView === "editor"
                  ? form.air_tariff_no
                    ? readOnly
                      ? "View Airline Tariff"
                      : "Edit Airline Tariff"
                    : "New Airline Tariff"
                  : "Airline Tariff"}
            </h1>
          </div>
        </div>

        {/* Header Right Action: In editor mode, shows Back to List button. In list mode, Refresh and Add are removed from here. */}
        {entryView === "editor" && !isReport && (
            <div className="flex items-center gap-2">
              {!readOnly && (
                <>
                  {Boolean(form.air_tariff_no) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={deleteTariff}
                      disabled={saving}
                      className="h-8 gap-1.5 text-xs font-semibold rounded-lg text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 size={14} /> Delete
                    </Button>
                  )}
                  <Button
                    type="submit" form="airline-tariff-form"
                    disabled={saving}
                    className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
                  >
                    <Save size={14} /> Save
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" size="icon" onClick={backToList} disabled={saving} aria-label="Close tariff" title="Close tariff" className="h-8 w-8 rounded-lg"><X size={16} /></Button>
            </div>
        )}
      </div>

      {notice && (
        <div className={`rounded-md border px-3 py-2 text-sm font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
          {notice.text}
        </div>
      )}

      {isReport && (
        <div className="grid gap-3">
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
        </div>
      )}

      {entryView === "editor" && !isReport && (
        <form id="airline-tariff-form" className="flex flex-col gap-2" onSubmit={saveTariff}>
          {/* Card 1: Route and Airline */}
          <div className="freight-master-form-card">
            <div className="freight-master-form-header">
              <h3><span className="freight-section-icon"><MapPinned size={16} /></span>Route and Airline</h3>
            </div>
            <div className="freight-master-form-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                <Field
                  label="Tariff No"
                  value={form.air_tariff_no || "Auto Generated"}
                  disabled
                  onChange={() => undefined}
                />

                <div className="freight-master-field">
                  <label className="freight-master-label">
                    <span>Airline</span>
                    <span className="text-red-500 font-bold ml-0.5">*</span>
                  </label>
                  <LookupField
                    compact
                    value={form.airline_code}
                    displayValue={form.airline_name ? `${form.airline_code} - ${form.airline_name}` : form.airline_code}
                    required
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

                <Field
                  label="Source"
                  value={form.source}
                  required
                  disabled={readOnly}
                  placeholder="e.g. INDIA"
                  onChange={(value) => updateForm(setForm, { source: value.toUpperCase() })}
                />

                <Field
                  label="Destination"
                  value={form.destination}
                  required
                  disabled={readOnly}
                  placeholder="e.g. OMAN"
                  onChange={(value) => updateForm(setForm, { destination: value.toUpperCase() })}
                />

                <Field
                  label="Direct / Via"
                  value={form.direct_via}
                  disabled={readOnly}
                  placeholder="e.g. Direct / Via DXB"
                  onChange={(value) => updateForm(setForm, { direct_via: value })}
                />

                <Field
                  label="IATA Code"
                  value={form.iata_code}
                  disabled={readOnly}
                  placeholder="e.g. 123"
                  onChange={(value) => updateForm(setForm, { iata_code: value })}
                />

              </div>
            </div>
          </div>
          <div className="freight-master-form-card">
            <div className="freight-master-form-header"><h3><span className="freight-section-icon"><PackageCheck size={16} /></span>Cargo Handling</h3></div>
            <div className="freight-master-form-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <SelectField
                  label="Hard Freight"
                  value={form.hard_freight}
                  disabled={readOnly}
                  onChange={(value) => updateForm(setForm, { hard_freight: value })}
                />

                <SelectField
                  label="Perishable"
                  value={form.perishable}
                  disabled={readOnly}
                  onChange={(value) => updateForm(setForm, { perishable: value })}
                />

                <SelectField
                  label="Restriction"
                  value={form.restriction}
                  disabled={readOnly}
                  onChange={(value) => updateForm(setForm, { restriction: value })}
                />

                <Field
                  className="col-span-1 sm:col-span-3"
                  label="Restriction Detail"
                  value={form.restriction_det}
                  disabled={readOnly}
                  placeholder="Enter restriction remarks or details if applicable..."
                  onChange={(value) => updateForm(setForm, { restriction_det: value })}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Weight Breaks */}
          <div className="freight-master-form-card">
            <div className="freight-master-form-header">
              <h3><span className="freight-section-icon"><Coins size={16} /></span>Currency and Weight Breaks</h3>
            </div>
            <div className="freight-master-form-body">
              <div className="tariff-currency-row">                <div className="freight-master-field">
                  <label className="freight-master-label">
                    <span>Currency</span>
                    <span className="text-red-500 font-bold ml-0.5">*</span>
                  </label>
                  <LookupField
                    compact
                    value={form.curr_code}
                    required
                    valueField="CURR_CODE"
                    displayFields={["CURR_CODE", "CURR_NAME"]}
                    columns={[{ field: "CURR_CODE", header: "Code" }, { field: "CURR_NAME", header: "Currency" }]}
                    loadOptions={() => loadLookup("freight_currency", companyCode)}
                    disabled={readOnly}
                    onChange={(value) => updateForm(setForm, { curr_code: value })}
                  />
                </div>

</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
                {slabFields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    value={form[field.key]}
                    type="number"
                    numeric
                    placeholder="0.00"
                    disabled={readOnly}
                    onChange={(value) => updateForm(setForm, { [field.key]: value })}
                  />
                ))}
              </div>
            </div>
          </div>


        </form>
      )}

      {(isReport || entryView === "list") && (
        <DataTable
          columns={isReport ? columns : columns.filter((column) => column.id === "actions" || ("accessorKey" in column && ["AIR_TARIFF_NO", "AIRLINE_NAME", "SOURCE", "DESTINATION", "CURR_CODE", "MINIMUM", "NORMAL"].includes(String(column.accessorKey))))}
          data={rows}
          loading={loading}
          density="grid"
          height={isReport ? "calc(100dvh - 355px)" : "calc(100dvh - 180px)"}
          enableColumnFilters
          enablePagination
          pageSize={25}
          getRowId={(row) => String(row.AIR_TARIFF_NO)}
          minWidth={isReport ? 1400 : 850}
          enableExport
          exportFilename={isReport ? "airline-tariff-report.csv" : "airline-tariff.csv"}
          searchValue={isReport ? undefined : searchText}
          onSearchChange={isReport ? undefined : setSearchText}
          searchPlaceholder="Search tariff no, airline, source, destination..."
          emptyText="No airline tariff records found"
          actionButton={
            !isReport ? (
              <Button
                type="button"
                onClick={openAdd}
                disabled={saving}
                className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3.5 rounded-lg cursor-pointer transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
            ) : undefined
          }
          toolbar={
            isReport ? (
              <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(rows)}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}

function formatRate(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num === 0 ? "-" : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="freight-master-form-header">
      <h3>{title}</h3>
      {subtitle && <span className="freight-master-form-subtitle">{subtitle}</span>}
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
  placeholder,
  className,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <div className={`freight-master-field ${className || ""}`}>
      <label className="freight-master-label">
        <span>{label}</span>
        {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
      </label>
      <input
        className={`freight-master-input ${numeric ? "numeric" : ""}`}
        value={value}
        type={type}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  disabled,
  onChange,
  className,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`freight-master-field ${className || ""}`}>
      <label className="freight-master-label">{label}</label>
      <select
        className="freight-master-select"
        value={value || "N"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="N">No</option>
        <option value="Y">Yes</option>
      </select>
    </div>
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
