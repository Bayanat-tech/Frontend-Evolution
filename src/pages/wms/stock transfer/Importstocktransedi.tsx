import { Download, RotateCcw, Save, UploadCloud, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Card, CardContent } from "../../../components/ui/Card";
import { executeCommonProcedure, getDynamicLookup } from "../../../api/lookups";
import { insUpdTsStnDetailEdiBlkApi } from "../../../api/wms";

interface ImportStockTransProps {
  stn_no: number | string;
  onClose: () => void;
  onSuccess: () => void;
}

type TStockTransEdi = {
  prin_code?: string;
  prod_code?: string;
  prod_name?: string;
  site_code?: string;
  job_no?: string;
  pallet_id?: string;
  lot_no_from?: string;
  lot_no_to?: string;
  batch_no_from?: string;
  batch_no_to?: string;
  p_uom?: string;
  l_uom?: string;
  from_site?: string;
  to_site?: string;
  from_loc_start?: string;
  from_loc_end?: string;
  to_loc_start?: string;
  to_loc_end?: string;
  key_number?: string;
  quantity?: number;
  qty_puom?: number;
  qty_luom?: number;
  error_message?: string;
};

const getSampleTemplateData = () => [
  {
    SITE_CODE: "HR",
    LOCATION_CODE: "R01-05-L2-P11",
    LOC_DESC: "HQ-R01-05-L2-P11",
    LOC_TYPE: "1",
    LOC_STAT: "M",
    AISLE: "R01",
    COLUMN_NO: "5",
    HEIGHT: 2,
  },
  {
    SITE_CODE: "A1",
    LOCATION_CODE: "062801",
    LOC_DESC: "A1-062801",
    LOC_TYPE: "1",
    LOC_STAT: "M",
    AISLE: "06",
    COLUMN_NO: "28",
    HEIGHT: 1,
  },
];

export function ImportStockTransEdi({stn_no, onClose, onSuccess }: ImportStockTransProps) {
  const { user } = useAuth();
  // const { stn_no } = useParams();
  const { toast } = useToast();

  const [excelData, setExcelData] = useState<any[]>([]);
  const [ediRows, setEdiRows] = useState<TStockTransEdi[]>([]);
  const [loading, setLoading] = useState(false);
  const [ediUploaded, setEdiUploaded] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  console.log(stn_no);

  const hasErrors = ediRows.some((row) => row.error_message && row.error_message.trim() !== "");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setExcelData(jsonData);
        setFileSelected(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to read the selected file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const fetchEDIData = async () => {
    try {
      const response: any = await getDynamicLookup({
        parameter: "MWMS_Get_StockTrans_Edi",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });
      if (Array.isArray(response)) {
        setEdiRows([...response]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load EDI preview");
    }
  };

  const handleUploadToEDI = async () => {
    setLoading(true);
    try {
      const mappedStocks = excelData.map((row: any) => ({
        company_code: user?.company_code || "",
        stn_no: Number(stn_no) || 0,
        prin_code: row.PRIN_CODE?.toString() || "",
        prod_code: row.PROD_CODE?.toString() || "",
        prod_name: row.PROD_NAME?.toString() || "",
        site_code: row.SITE_CODE?.toString() || "",
        job_no: row.JOB_NO?.toString() || "",
        pallet_id: row.PALLET_ID?.toString() || "",
        lot_no_from: row.LOT_NO_FROM?.toString() || "",
        lot_no_to: row.LOT_NO_TO?.toString() || "",
        batch_no_from: row.BATCH_NO_FROM?.toString() || "",
        batch_no_to: row.BATCH_NO_TO?.toString() || "",
        p_uom: row.P_UOM?.toString() || "",
        l_uom: row.L_UOM?.toString() || "",
        from_site: row.FROM_SITE?.toString() || "",
        to_site: row.TO_SITE?.toString() || "",
        from_loc_start: row.FROM_LOC_START?.toString() || "",
        from_loc_end: row.FROM_LOC_END?.toString() || "",
        to_loc_start: row.TO_LOC_START?.toString() || "",
        to_loc_end: row.TO_LOC_END?.toString() || "",
        mfg_date_from: row.MFG_DATE_FROM?.toString() || "",
        mfg_date_to: row.MFG_DATE_TO?.toString() || "",
        exp_date_from: row.EXP_DATE_FROM?.toString() || "",
        exp_date_to: row.EXP_DATE_TO?.toString() || "",
        key_number: row.KEY_NUMBER?.toString() || "",
        quantity: Number(row.QUANTITY) || 0,
        qty_puom: Number(row.QTY_PUOM) || 0,
        qty_luom: Number(row.QTY_LUOM) || 0,
        user_id: user?.loginid,
      }));

      const result = await insUpdTsStnDetailEdiBlkApi({
        loginid: user?.loginid,
        rows: mappedStocks,
      });

      if (result?.success) {
        await fetchEDIData();
        setEdiUploaded(true);
      } else {
        await handleReset();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload the file to EDI");
    } finally {
      setLoading(false);
    }
  };

  const handlePostValid = async () => {
    setLoading(true);
    try {
      const result = await executeCommonProcedure({
        parameter: "SP_COPY_TS_STNDETAIL_EDI",
        loginid: user?.loginid ?? "",
        val1s1: user?.loginid ?? "",
        val1s2: user?.company_code ?? "",
      });

      if (result) {
        toast.success("Records saved successfully");
        await handleReset();
        onSuccess();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save records");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setExcelData([]);
    setEdiRows([]);
    setEdiUploaded(false);
    setFileSelected(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const templateData = getSampleTemplateData();
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      worksheet["!cols"] = new Array(8).fill({ wch: 15 });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "LocationEdiTemplate");
      XLSX.writeFile(workbook, "Location_Edi_Template.xlsx");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate template");
    }
  };

  useEffect(() => {

  }, [ediRows]);

  const columns = useMemo<ColumnDef<TStockTransEdi>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.error_message ? (
            <span className="inline-flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={14} /> {row.original.error_message}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <CheckCircle2 size={14} /> OK
            </span>
          ),
        size: 220,
      },
      { accessorKey: "prin_code", header: "Principal", size: 100 },
      { accessorKey: "prod_code", header: "Product Code", size: 120 },
      { accessorKey: "prod_name", header: "Product Name", size: 160 },
      { accessorKey: "site_code", header: "Site", size: 80 },
      { accessorKey: "pallet_id", header: "Pallet ID", size: 120 },
      { accessorKey: "batch_no_from", header: "Batch From", size: 120 },
      { accessorKey: "batch_no_to", header: "Batch To", size: 120 },
      { accessorKey: "lot_no_from", header: "Lot No From", size: 120 },
      { accessorKey: "lot_no_to", header: "Lot No To", size: 120 },
      { accessorKey: "p_uom", header: "P UOM", size: 80 },
      { accessorKey: "l_uom", header: "L UOM", size: 80 },
      { accessorKey: "qty_puom", header: "Qty PUOM", size: 90 },
      { accessorKey: "qty_luom", header: "Qty LUOM", size: 90 },
      { accessorKey: "quantity", header: "Quantity", size: 90 },
      { accessorKey: "from_site", header: "From Site", size: 90 },
      { accessorKey: "to_site", header: "To Site", size: 90 },
      { accessorKey: "from_loc_start", header: "Loc From", size: 110 },
      { accessorKey: "from_loc_end", header: "Loc From end", size: 110 },
      { accessorKey: "to_loc_start", header: "Loc End From", size: 110 },
      { accessorKey: "to_loc_end", header: "Loc End To", size: 110 },
    ],
    [],
  );

  return (
    <section className="grid gap-5">
      {!ediUploaded && (
        <Card className="border-dashed">
          <CardContent className="grid place-items-center gap-4 p-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <UploadCloud size={22} className="text-muted-foreground" />
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">Upload Stock Transfer EDI File</p>
              <p className="text-xs text-muted-foreground">
                Accepts .xlsx or .xls files
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              style={{ display: "none" }}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || fileSelected}
              >
                <UploadCloud size={15} /> Select Excel File
              </Button>

              {excelData.length > 0 && (
                <Button onClick={handleUploadToEDI} disabled={loading || hasErrors}>
                  {loading ? "Uploading..." : "Upload to EDI"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {ediUploaded && (
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={columns}
            data={ediRows}
            title={`${ediRows.length.toLocaleString()} Records`}
            subtitle="Stock Transfer EDI Preview"
            loading={loading}
            emptyText="No EDI records found"
            height={450}
            minWidth={900}
            density="grid"
            getRowId={(row, index) => `${row.prin_code ?? ""}-${row.prod_code ?? ""}-${index}`}
          />
        </Card>
      )}

      {hasErrors && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          Please fix all error records before saving.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
          <Download size={15} /> Download Template
        </Button>

        {ediUploaded && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw size={15} /> Cancel
            </Button>
            <Button onClick={handlePostValid} disabled={loading || hasErrors}>
              <Save size={15} /> {loading ? "Saving..." : "Save All Valid Records"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ImportStockTransEdi;