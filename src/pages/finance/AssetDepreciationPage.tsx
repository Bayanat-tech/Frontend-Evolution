import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, FileText, RefreshCw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
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
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Asset Depreciation</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" disabled={loading} onClick={() => void retrieve()}><RefreshCw size={15} /> Retrieve</Button>
          <Button disabled={loading} onClick={() => void save()}><Save size={15} /> Save</Button>
          <Button variant="secondary" disabled={loading} onClick={() => void postJv()}><FileText size={15} /> JV</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2"><Calculator size={18} /><h2 className="m-0 text-base font-semibold">Depreciation Run</h2></div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <label className="field"><span>Month</span><Input type="month" value={monthYear} onChange={(event) => { setMonthYear(event.target.value); const [y, m] = event.target.value.split("-"); setDocNo(y && m ? `${y}${m}` : ""); }} /></label>
          <LookupField label="Division" value={division} displayValue={division ? `${division}${divisionName ? ` - ${divisionName}` : ""}` : ""} columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]} valueField="div_code" displayFields={["div_code", "div_name"]} loadOptions={() => getDynamicLookup({ parameter: "AC_ASSETS_DEPRECIATION_DIVISION_LIST", loginid: loginId, code1: companyCode })} onChange={(value, row) => { setDivision(value); setDivisionName(String(getLookupValue(row || {}, "div_name") || "")); }} />
        </CardContent>
      </Card>

      <DataTable columns={columns} data={rows} title={loading ? "Loading" : `${rows.length} Rows`} subtitle="Depreciation Details" loading={loading} emptyText="No depreciation rows found" height={560} minWidth={1400} density="grid" getRowId={(row, index) => `${row.asset_id || "row"}_${index}`} />
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
