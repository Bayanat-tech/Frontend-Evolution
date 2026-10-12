import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, FileText, RefreshCw, Save, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

type DepRow = Record<string, string | number>;

export function AssetDepreciationPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [monthYear, setMonthYear] = useState("");
  const [division, setDivision] = useState("");
  const [divisionName, setDivisionName] = useState("");
  const [docType] = useState("ADP");
  const [docNo, setDocNo] = useState("");
  const [rows, setRows] = useState<DepRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [year, month] = monthYear ? monthYear.split("-") : ["", ""];

  const columns = useMemo<ColumnDef<DepRow>[]>(() => [
    col("asset_id", "Asset ID", 130),
    col("asset_name", "Asset Name", 220),
    col("reg_no", "Reg No", 110),
    col("purchase_date", "Purchase Date", 120),
    col("quantity", "Quantity", 100),
    col("amount", "pur.Amount", 120),
    col("dprc_percentage", "Dep. %", 90),
    col("accdprc_amount", "Accu Amount", 120),
    col("dprc_amount", "Dprc Amount", 130),
    col("wd_value", "WD Value", 120),
    col("last_dprc_date", "Last Dep.", 120),
    col("div_code", "Division", 100),
  ], []);

  const retrieve = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_RETRIEVE_BUTTON",
        loginid: loginId,
        code1: companyCode,
        code2: division,
      });
      setRows(data.map(normalize));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to retrieve depreciation" });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!year || !month || !division) {
      setNotice({ type: "error", message: "Month and division are required." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await executeCommonProcedure({
        parameter: "PROC_DOC_NO_DEPRECIATION",
        loginid: loginId,
        val1s1: year,
        val1s2: month,
        val1s3: division,
        val1s4: companyCode,
        val1s5: docType,
      });
      const nextDocNo = `${year}${month}`;
      setDocNo(nextDocNo);
      setNotice({ type: "success", message: "Depreciation document generated successfully" });
      await retrieve();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save depreciation" });
    } finally {
      setLoading(false);
    }
  };

  const postJv = async () => {
    if (!docNo || !division) {
      setNotice({ type: "error", message: "Retrieve or generate a document before posting JV." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await executeCommonProcedure({
        parameter: "PROC_DEPRECIATION_JVPOST",
        loginid: loginId,
        val1s1: companyCode,
        val1s2: docType,
        val1s3: docNo,
        val1s4: division,
        val1s5: String(rows.length),
      });
      setNotice({ type: "success", message: "Depreciation JV posted successfully" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to post JV" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      {/* ===================== PAGE HEADER (matches Prepaid Register) ===================== */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <TrendingDown size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Depreciation</h1>
            <p className="m-0 text-xs text-slate-500">Asset Utility</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void retrieve()}
            className="h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <RefreshCw size={14} /> Retrieve
          </Button>
          <Button
            disabled={loading}
            onClick={() => void save()}
            className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
          >
            <Save size={14} /> Save
          </Button>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void postJv()}
            className="h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <FileText size={14} /> JV
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ===================== CARD: DEPRECIATION RUN ===================== */}
      <div className="freight-master-form-card">
        <div className="freight-master-form-header">
          <h3>
            <span className="freight-section-icon"><Calculator size={16} /></span>
            Depreciation Run
          </h3>
        </div>
        <div className="freight-master-form-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="freight-master-field">
              <label className="freight-master-label">
                <span>Month</span>
                <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>
              </label>
              <input
                className="freight-master-input"
                type="month"
                value={monthYear}
                onChange={(event) => {
                  setMonthYear(event.target.value);
                  const [y, m] = event.target.value.split("-");
                  setDocNo(y && m ? `${y}${m}` : "");
                }}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">
                <span>Division</span>
                <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>
              </label>
              <LookupField
                compact
                value={division}
                displayValue={division ? `${division}${divisionName ? ` - ${divisionName}` : ""}` : ""}
                columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "AC_ASSETS_DEPRECIATION_DIVISION_LIST",
                    loginid: loginId,
                    code1: companyCode,
                  })
                }
                onChange={(value, row) => {
                  setDivision(value);
                  setDivisionName(String(getLookupValue(row || {}, "div_name") || ""));
                }}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Doc Type</label>
              <input className="freight-master-input" value={docType} disabled readOnly />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Doc No</label>
              <input className="freight-master-input" value={docNo} disabled readOnly />
            </div>
          </div>
        </div>
      </div>

      {/* ===================== DATA TABLE ===================== */}
      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length} Rows`}
        subtitle="Depreciation Details"
        loading={loading}
        emptyText="No depreciation rows found"
        height={560}
        minWidth={1400}
        density="grid"
        getRowId={(row, index) => `${row.asset_id || "row"}_${index}`}
      />
    </section>
  );
}

function col(key: string, header: string, size: number): ColumnDef<DepRow> {
  return { accessorKey: key, header, size, cell: ({ getValue }) => <span>{String(getValue() ?? "")}</span> };
}

function normalize(row: LookupRow): DepRow {
  const output: DepRow = {};
  Object.keys(row).forEach((key) => {
    output[key.toLowerCase()] = row[key] as string | number;
  });
  return output;
}