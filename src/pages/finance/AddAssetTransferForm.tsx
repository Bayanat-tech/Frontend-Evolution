import { Save, X, FileText, List, MapPinned } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { AssetTransferDetailTable } from "./AssetTransferDetailTable";

// ===================== TYPES =====================
export type TAssetTransferDetail = {
  id: string;
  serial_no: number;
  asset_id: string;
  asset_name: string;
  site_from: string;
  site_to: string;
  emp_id_from: string;
  emp_name_from: string;
  emp_id_to: string;
  emp_name_to: string;
  remarks: string;
};

export type TAssetTransferFormValues = {
  company_code: string;
  doc_type: string;
  doc_no: string;
  doc_date: string;
  site_from: string;
  site_from_name: string;
  site_to: string;
  site_to_name: string;
  remarks: string;
  confirmed: string;
  div_code: string;
  div_name: string;
  detail: TAssetTransferDetail[];
};

type TProps = {
  mode: "create" | "edit" | "view";
  doc_no?: string;
  div_code: string;
  div_name: string;
  doc_type: string;
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

// ===================== HELPERS =====================
function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateInput(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function display(code: string, name: string) {
  return code ? (name ? `${code} - ${name}` : code) : "";
}

const siteColumns = [
  { field: "site_code", header: "Location" },
  { field: "site_name", header: "Name" },
];

// ===================== MAIN COMPONENT =====================
export function AddAssetTransferForm({
  mode,
  doc_no,
  div_code,
  div_name,
  doc_type,
  companyCode,
  loginId,
  onClose,
  onSaved,
}: TProps) {
  const isReadOnly = mode === "view";
  const [activeTab, setActiveTab] = useState<"header" | "detail">("header");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [values, setValues] = useState<TAssetTransferFormValues>({
    company_code: companyCode,
    doc_type,
    doc_no: "",
    doc_date: today(),
    site_from: "",
    site_from_name: "",
    site_to: "",
    site_to_name: "",
    remarks: "",
    confirmed: "N",
    div_code,
    div_name,
    detail: [],
  });

  // ===================== LOAD EXISTING DATA =====================
  useEffect(() => {
    if (!doc_no) return;

    const loadHeader = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: "AC_ASSETS_TRANSFER",
          loginid: loginId,
          code1: companyCode,
          code2: doc_no,
          code3: doc_type,
          code4: "",
          number1: 0,
          number2: 0,
          number3: 0,
          number4: 0,
          date1: null,
          date2: null,
          date3: null,
          date4: null,
        });

        const h = res.find(
          (row) => String(getLookupValue(row, "doc_no") || "") === String(doc_no)
        );
        if (!h) return;

        setValues((prev) => ({
          ...prev,
          company_code: String(getLookupValue(h, "company_code") || prev.company_code),
          doc_no: String(getLookupValue(h, "doc_no") || prev.doc_no),
          doc_date: dateInput(getLookupValue(h, "doc_date")) || prev.doc_date,
          site_from: String(getLookupValue(h, "site_from") || prev.site_from),
          site_from_name: String(getLookupValue(h, "site_from_name") || prev.site_from_name),
          site_to: String(getLookupValue(h, "site_to") || prev.site_to),
          site_to_name: String(getLookupValue(h, "site_to_name") || prev.site_to_name),
          remarks: String(getLookupValue(h, "remarks") || prev.remarks),
          confirmed: String(getLookupValue(h, "confirmed") || prev.confirmed),
          div_code: String(getLookupValue(h, "div_code") || div_code || prev.div_code),
          div_name: String(getLookupValue(h, "div_name") || div_name || prev.div_name),
        }));
      } catch {
        // silently fail
      }
    };

    const loadDetail = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: "AC_ASSETS_TRANSFER_DET",
          loginid: loginId,
          code1: companyCode,
          code2: doc_no,
          code3: doc_type,
          code4: "",
          number1: 0,
          number2: 0,
          number3: 0,
          number4: 0,
          date1: null,
          date2: null,
          date3: null,
          date4: null,
        });

        const details: TAssetTransferDetail[] = res.map(
          (row: LookupRow, index: number) => ({
            id: `${String(getLookupValue(row, "serial_no") || index)}_${Date.now()}_${index}`,
            serial_no: Number(getLookupValue(row, "serial_no") || index + 1),
            asset_id: String(getLookupValue(row, "asset_id") || ""),
            asset_name: String(getLookupValue(row, "asset_name") || ""),
            site_from: String(getLookupValue(row, "site_from") || ""),
            site_to: String(getLookupValue(row, "site_to") || ""),
            emp_id_from: String(getLookupValue(row, "emp_id_from") || ""),
            emp_name_from: String(getLookupValue(row, "emp_name_from") || ""),
            emp_id_to: String(getLookupValue(row, "emp_id_to") || ""),
            emp_name_to: String(getLookupValue(row, "emp_name_to") || ""),
            remarks: String(getLookupValue(row, "remarks") || ""),
          })
        );

        setValues((prev) => ({ ...prev, detail: details }));
      } catch {
        // silently fail
      }
    };

    void loadHeader();
    void loadDetail();
  }, [doc_no]);

  // ===================== FIELD SETTERS =====================
  const setField = (field: keyof TAssetTransferFormValues, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const setDetail = (detail: TAssetTransferDetail[]) =>
    setValues((prev) => ({ ...prev, detail }));

  // ===================== SUBMIT =====================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!values.doc_date || !values.site_from || !values.site_to) {
      setError("Document date, Location From and Location To are required.");
      return;
    }
    if (values.detail.length === 0) {
      setError("Please add at least one detail row.");
      return;
    }

    const resolvedDivCode = values.div_code || div_code || "";
    if (!resolvedDivCode) {
      setError("Division Code is missing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await postFinance("insUpdTrAcAssetTransferBulk", {
        header: {
          company_code: companyCode,
          doc_type: values.doc_type,
          doc_no: values.doc_no || null,
          doc_date: values.doc_date,
          site_from: values.site_from,
          site_to: values.site_to,
          remarks: values.remarks,
          user_id: loginId,
          user_dt: new Date().toISOString(),
          last_serial_no: values.detail.length,
          confirmed: values.confirmed,
          div_code: resolvedDivCode,
        },
        details: values.detail.map((row, index) => ({
          company_code: companyCode,
          doc_type: values.doc_type,
          doc_no: values.doc_no || null,
          serial_no: index + 1,
          asset_id: row.asset_id,
          asset_name: row.asset_name,
          site_from: row.site_from || values.site_from,
          site_to: row.site_to || values.site_to,
          emp_id_from: row.emp_id_from,
          emp_id_to: row.emp_id_to,
          remarks: row.remarks,
          user_id: loginId,
          user_dt: new Date().toISOString(),
          div_code: resolvedDivCode,
        })),
      });

      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transfer");
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "create" ? "New Asset Transfer" : mode === "edit" ? "Edit Asset Transfer" : "View Asset Transfer";

  // ===================== RENDER =====================
  return (
    <section className="freight-airline-tariff-screen grid gap-2 freight-ui-standard freight-dense-form">
      {/* ===================== HEADER CARD (matches Prepaid Register) ===================== */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <MapPinned size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{title}</h1>
            <p className="m-0 text-xs text-slate-500">
              Doc No: {values.doc_no || "Autogenerated"} | Division: {values.div_code ? `${values.div_code} – ${values.div_name}` : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">Rows</span>
            <strong className="text-sm tabular-nums">{values.detail.length}</strong>
          </div>
          {!isReadOnly && (
            <Button
              type="submit"
              form="asset-transfer-form"
              disabled={saving}
              className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? <span className="spinner small" /> : <Save size={14} />} Save
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
            title="Close form"
            className="h-8 w-8 rounded-lg"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

      {/* ===================== FORM ===================== */}
      <form className="flex flex-col gap-2" id="asset-transfer-form" onSubmit={handleSubmit}>
        {/* ============ CARD: TAB SWITCHER ============ */}
        <div className="freight-master-form-card">
          <div className="freight-master-form-body">
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("header")}
                className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "header"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Header
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("detail")}
                className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "detail"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Details
                {values.detail.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                    {values.detail.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ============ CARD: HEADER TAB ============ */}
        <div className={`freight-master-form-card ${activeTab === "header" ? "" : "hidden"}`}>
          <div className="freight-master-form-header">
            <h3>
              <span className="freight-section-icon"><FileText size={16} /></span>
              Document Details
            </h3>
          </div>
          <div className="freight-master-form-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field
                label="Doc Date"
                type="date"
                value={values.doc_date}
                onChange={(v) => setField("doc_date", v)}
                disabled={isReadOnly}
                required
              />
              <Field
                label="Doc Type"
                value={values.doc_type}
                onChange={(v) => setField("doc_type", v)}
                disabled
              />

              <div className="freight-master-field">
                <label className="freight-master-label">
                  <span>Location From</span>
                  <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <LookupField
                  compact
                  value={values.site_from}
                  displayValue={display(values.site_from, values.site_from_name)}
                  columns={siteColumns}
                  valueField="site_code"
                  displayFields={["site_code", "site_name"]}
                  disabled={isReadOnly}
                  loadOptions={() =>
                    getDynamicLookup({
                      parameter: "AC_ASSETS_SITE",
                      code1: companyCode,
                      code2: "",
                      code3: "",
                      code4: "",
                      number1: 0,
                      number2: 0,
                      number3: 0,
                      number4: 0,
                      date1: null,
                      date2: null,
                      date3: null,
                      date4: null,
                    })
                  }
                  onChange={(value, row) => {
                    setField("site_from", value);
                    setField("site_from_name", String(getLookupValue(row || {}, "site_name") || ""));
                  }}
                />
              </div>

              <div className="freight-master-field">
                <label className="freight-master-label">
                  <span>Location To</span>
                  <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <LookupField
                  compact
                  value={values.site_to}
                  displayValue={display(values.site_to, values.site_to_name)}
                  columns={siteColumns}
                  valueField="site_code"
                  displayFields={["site_code", "site_name"]}
                  disabled={isReadOnly}
                  loadOptions={() =>
                    getDynamicLookup({
                      parameter: "AC_ASSETS_SITE",
                      code1: companyCode,
                      code2: "",
                      code3: "",
                      code4: "",
                      number1: 0,
                      number2: 0,
                      number3: 0,
                      number4: 0,
                      date1: null,
                      date2: null,
                      date3: null,
                      date4: null,
                    })
                  }
                  onChange={(value, row) => {
                    setField("site_to", value);
                    setField("site_to_name", String(getLookupValue(row || {}, "site_name") || ""));
                  }}
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2">
              <div className="freight-master-field">
                <label className="freight-master-label">Remarks</label>
                <textarea
                  className="freight-master-input min-h-[80px]"
                  value={values.remarks}
                  onChange={(e) => setField("remarks", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============ CARD: DETAIL TAB ============ */}
        <div className={`freight-master-form-card ${activeTab === "detail" ? "" : "hidden"}`}>
          <div className="freight-master-form-header">
            <h3>
              <span className="freight-section-icon"><List size={16} /></span>
              Transfer Detail Lines
              {values.detail.length > 0 && (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                  {values.detail.length}
                </span>
              )}
            </h3>
          </div>
          <div className="freight-master-form-body">
            <AssetTransferDetailTable
              details={values.detail}
              siteFrom={values.site_from}
              siteTo={values.site_to}
              companyCode={companyCode}
              loginId={loginId}
              disabled={isReadOnly}
              onChange={setDetail}
            />
          </div>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FIELD COMPONENT MATCHING PREPAID REGISTER / AIRLINE TARIFF
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "date" | "number";
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="freight-master-field">
      <label className="freight-master-label">
        <span>{label}</span>
        {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
      </label>
      <input
        className="freight-master-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}