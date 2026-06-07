import { Save, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
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
          (row) =>
            String(getLookupValue(row, "doc_no") || "") === String(doc_no)
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

  // ===================== RENDER =====================
  return (
    <div className="flex flex-col w-full">
      {/* Doc number info */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Doc No</p>
          <p className="text-sm font-semibold">{values.doc_no || "Autogenerated"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Division</p>
          <p className="text-sm font-semibold">
            {values.div_code ? `${values.div_code} – ${values.div_name}` : "—"}
          </p>
        </div>
      </div>

      {/* ===================== TABS ===================== */}
      <div className="mb-4 flex gap-1 rounded-lg border bg-muted/40 p-1">
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

      {error && <div className="alert error mb-3">{error}</div>}

      {/* ===================== FORM ===================== */}
      <form id="asset-transfer-form" onSubmit={handleSubmit}>
        {/* ---- HEADER TAB ---- */}
        <div className={activeTab === "header" ? "grid gap-4" : "hidden"}>
          <div className="grid grid-cols-2 gap-3">
            {/* Doc Date */}
            <label className="field">
              <span>Doc Date *</span>
              <Input
                type="date"
                value={values.doc_date}
                onChange={(e) => setField("doc_date", e.target.value)}
                disabled={isReadOnly}
              />
            </label>

            {/* Doc Type (read only display) */}
            <label className="field">
              <span>Doc Type</span>
              <Input value={values.doc_type} disabled />
            </label>

            {/* Location From */}
            <LookupField
              label="Location From *"
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

            {/* Location To */}
            <LookupField
              label="Location To *"
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

          {/* Remarks */}
          <label className="field">
            <span>Remarks</span>
            <textarea
              className="ui-textarea min-h-[80px]"
              value={values.remarks}
              onChange={(e) => setField("remarks", e.target.value)}
              disabled={isReadOnly}
            />
          </label>
        </div>

        {/* ---- DETAIL TAB ---- */}
        <div className={activeTab === "detail" ? "block" : "hidden"}>
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
      </form>

      {/* ===================== FOOTER ACTIONS ===================== */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onClose}>
          <X size={15} /> Close
        </Button>
        {!isReadOnly && (
          <Button disabled={saving} type="submit" form="asset-transfer-form">
            {saving ? <span className="spinner small" /> : <Save size={15} />} Save
          </Button>
        )}
      </div>
    </div>
  );
}