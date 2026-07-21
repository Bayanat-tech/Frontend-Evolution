import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../state/AuthContext';
import * as XLSX from 'xlsx';
import { CloudUpload, Upload, Download, AlertCircle, CheckCircle, XCircle, FileSpreadsheet, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { NoticeToast } from '../../../components/ui/NoticeToast';
import { DataTable } from '../../../components/ui/DataTable';
import { pamsSelect, pamsSave, pamsDelete } from '../../../api/pams';
import type { ColumnDef } from '@tanstack/react-table';
import { upsertBulkExcelBudgetEntryApi } from '../../../api/transactions';
import { getDynamicLookup } from '../../../api/lookups';
import { api } from '../../../api/client';


export interface ImportedBudgetRow {
  cost_code: string;
  cost_name: string;
  month_budget: string;
  budget_year: string;
  requested_amt: number;
  approved_amt: number;
}

interface ImportBudgetEdiProps {
  requestNumber: string;
  onClose: () => void;
  onSuccess: (importedRows: ImportedBudgetRow[]) => void | Promise<void>;
}

interface EdiRow {
  error_message?: string;
  div_code?: string;
  cost_code?: string;
  curr_code?: string;
  equal_amount?: string;
  total_amount?: string;
  from_date?: string;
  to_date?: string;
  request_number?: string;
  loaded_by?: string;
  loaded_date?: string;
  company_code?: string;
}

// --- NEW: separate view for the loaded/expanded monthly data (does not affect EdiRow above) ---
interface LoadedBudgetRow {
  div_code?: string;
  cost_code?: string;
  company_code?: string;
  user_dt?: string;
  user_id?: string;
  month_date?: string;
  month_budget?: string;
  budget_year?: string;
  request_number?: string;
  requested_amt?: string;
  approved_amt?: string;
  final_approved?: string;
  requested_date?: string;
}

type AnyRow = Record<string, any>;

function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normKey(k: string): string {
  return String(k || '')
    .replace(/__+/g, '_')
    .trim()
    .toUpperCase();
}

function normalizeRow(row: AnyRow): AnyRow {
  const out: AnyRow = {};
  Object.keys(row || {}).forEach((k) => {
    out[normKey(k)] = row[k];
  });
  return out;
}

function getVal(row: AnyRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// Excel serial date -> DD-MON-YYYY (Oracle friendly). Passes through if already a date-like string.
function formatExcelDate(v: string): string {
  if (!v) return '';
  const trimmed = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const dd = String(parsed.d).padStart(2, '0');
      const mon = months[parsed.m - 1];
      return `${dd}-${mon}-${parsed.y}`;
    }
  }
  return trimmed;
}
function formatExcelDateISO(v: string): string {
  if (!v) return '';
  const trimmed = String(v).trim();

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) {
      const yyyy = String(parsed.y).padStart(4, '0');
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // If it's already DD-MON-YYYY (e.g. "01-JUN-2025"), convert it to ISO too
  const ddMonYyyy = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMonYyyy) {
    const MONTHS: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    };
    const [, dd, mon, yyyy] = ddMonYyyy;
    const mm = MONTHS[mon.toUpperCase()];
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }

  return trimmed;
}

const ImportBudgetEdi: React.FC<ImportBudgetEdiProps> = ({ requestNumber, onClose, onSuccess }) => {
  const { user } = useAuth();

  const [excelData, setExcelData] = useState<AnyRow[]>([]);
  const [ediRows, setEdiRows] = useState<EdiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ediUploaded, setEdiUploaded] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // --- NEW: state for the separate loaded-data view ---
  const [showLoadedData, setShowLoadedData] = useState(false);
  const [loadedRows, setLoadedRows] = useState<LoadedBudgetRow[]>([]);
  const [loadedDataLoading, setLoadedDataLoading] = useState(false);

  const updateLoadedRow = (rowIndex: number, field: keyof LoadedBudgetRow, value: string) => {
    setLoadedRows((prev) => prev.map((row, idx) => idx === rowIndex ? { ...row, [field]: value } : row));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = ediRows.filter(row => !row.error_message || row.error_message.trim() === '');
  const invalidRows = ediRows.filter(row => row.error_message && row.error_message.trim() !== '');
  const hasErrors = invalidRows.length > 0;

  const fetchEDIData = async () => {
    try {
      setIsLoading(true);
      const response = await getDynamicLookup({
        parameter: 'MS_BUDGET_TEMP_LOAD',
        code1: user?.company_code ?? '',
      });

      if (Array.isArray(response)) {
        const rows: EdiRow[] = response.map((row: any) => {
          const r: any = {};
          Object.keys(row).forEach(k => { r[k.toUpperCase()] = row[k]; });

          return {
            error_message: text(r.ERROR_MESSAGE),
            div_code: text(r.DIV_CODE),
            cost_code: text(r.COST_CODE),
            curr_code: text(r.CURR_CODE),
            equal_amount: text(r.EQUAL_AMOUNT),
            total_amount: text(r.TOTAL_AMOUNT),
            from_date: text(r.FROM_DATE),
            to_date: text(r.TO_DATE),
            request_number: text(r.REQUEST_NUMBER || requestNumber),
            loaded_by: text(r.LOADED_BY),
            loaded_date: text(r.LOADED_DATE),
            company_code: user?.company_code ?? '',
          };
        });
        setEdiRows(rows);
      } else {
        setEdiRows([]);
      }
    } catch (err: any) {
      setUploadError('Failed to fetch staged data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };



  // --- NEW: fetch the expanded monthly rows for the separate loaded-data view ---
  const fetchLoadedBudgetData = async () => {
    try {
      setLoadedDataLoading(true);
      const response = await getDynamicLookup({
        parameter: 'MS_BUDGET_TEMP_LOAD',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
      });

      if (Array.isArray(response)) {
        const rows: LoadedBudgetRow[] = response.map((row: any) => {
          const r: any = {};
          Object.keys(row).forEach(k => { r[k.toUpperCase()] = row[k]; });
          return {
            div_code: text(r.DIV_CODE),
            cost_code: text(r.COST_CODE),
            company_code: user?.company_code || '',
            user_dt: text(r.USER_DT),
            user_id: text(r.USER_ID),
            month_date: text(r.MONTH_DATE),
            month_budget: text(r.MONTH_BUDGET),
            budget_year: text(r.BUDGET_YEAR),
            request_number: text(r.REQUEST_NUMBER || requestNumber),
            requested_amt: text(r.REQUESTED_AMT),
            approved_amt: text(r.APPROVED_AMT),
            final_approved: text(r.FINAL_APPROVED),
            requested_date: text(r.REQUESTED_DATE),
          };
        });
        setLoadedRows(rows);
      } else {
        setLoadedRows([]);
      }
    } catch (err: any) {
      setUploadError('Failed to fetch loaded data: ' + err.message);
    } finally {
      setLoadedDataLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setFileName(file.name);
    setFileSelected(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as AnyRow[];

        if (json.length === 0) {
          setUploadError('Excel file is empty');
          return;
        }
        if (json.length > 5000) {
          setUploadError('File has more than 5000 rows.');
          return;
        }

        const normalized = json.map(normalizeRow);
        console.log('Uploaded Excel data:', normalized);
        setExcelData(normalized);
        setFileSelected(true);
        setNotice({ type: 'info', message: `${normalized.length} rows loaded from "${file.name}". Click "Upload to EDI" to continue.` });
      } catch (err: any) {
        setUploadError('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.onerror = () => setUploadError('Failed to read file');
    reader.readAsArrayBuffer(file);
  };

  const CHUNK_SIZE = 100;

  const handleUploadToEDI = async () => {
    try {
      setIsLoading(true);
      setUploadError(null);

      const filled: AnyRow[] = excelData
        .map(normalizeRow)
        .filter((r) => getVal(r, "DIVCODE", "DIV_CODE") !== "");

      const mappedRows: Record<string, unknown>[] = filled.map((r) => ({
        div_code: getVal(r, "DIVCODE", "DIV_CODE"),
        cost_code: getVal(r, "COSTCODE", "COST_CODE"),
        curr_code: getVal(r, "CURRCODE", "CURR_CODE"),
        equal_amount: Number(
          getVal(r, "EQUALAMOUNT", "EQUAL_AMOUNT").replace(/\.0+$/, "")
        ),
        total_amount: Number(
          getVal(r, "TOTALAMOUNT", "TOTAL_AMOUNT").replace(/\.0+$/, "")
        ),
        from_date: formatExcelDateISO(getVal(r, "FROMDATE", "FROM_DATE")),
        to_date: formatExcelDateISO(getVal(r, "TODATE", "TO_DATE")),
        request_number: requestNumber || getVal(r, "REQUESTNUMBER", "REQUEST_NUMBER"),
        Company_code: user?.company_code || '',
      }));

      const chunks: Record<string, unknown>[][] = [];

      for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
        chunks.push(mappedRows.slice(i, i + CHUNK_SIZE));
      }

      let totalUploaded = 0;

      for (const chunk of chunks) {
        await upsertBulkExcelBudgetEntryApi({
          details: chunk,
        });

        totalUploaded += chunk.length;

        setNotice({
          type: "info",
          message: `Uploading... ${totalUploaded}/${mappedRows.length} rows`,
        });
      }

      await fetchEDIData();

      setEdiUploaded(true);

      setNotice({
        type: "success",
        message: `Uploaded successfully. Rows: ${mappedRows.length}`,
      });

      // NEW: open the separate loaded-data view without touching the existing success card/flow above
      await fetchLoadedBudgetData();
      setShowLoadedData(true);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetImportState = () => {
    setExcelData([]);
    setEdiRows([]);
    setUploadError(null);
    setEdiUploaded(false);
    setFileSelected(false);
    setFileName('');
    setNotice(null);
    setShowLoadedData(false);
    setLoadedRows([]);
    setLoadedDataLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    resetImportState();
  };

  const closeImportDialog = (importedRows: ImportedBudgetRow[] = []) => {
    resetImportState();
    void onSuccess(importedRows);
    onClose();
  };

  const handlePostValid = async () => {
    if (validRows.length === 0) {
      setUploadError('No valid records to post.');
      return;
    }

    try {
      setIsLoading(true);
      setNotice(null);

      const result = await pamsSelect({
        parameter: 'PROC_COPY_TEMP_LOAD_BUDGET',
        loginid: user?.loginid ?? '',
        val1s1: user?.loginid ?? ''
      });

      let resultStr = '';
      if (Array.isArray(result) && result.length > 0) {
        const firstRow = result[0] as Record<string, unknown>;
        resultStr = String(Object.values(firstRow)[0] ?? '');
      }

      if (!resultStr.toUpperCase().startsWith('ERROR')) {
        setNotice({ type: 'success', message: `Import successful! ${validRows.length} records saved.` });
        const importedRows: ImportedBudgetRow[] = (loadedRows.length > 0
          ? loadedRows.map((row) => ({
              cost_code: row.cost_code || '',
              cost_name: '',
              month_budget: row.month_budget || '',
              budget_year: row.budget_year || '',
              requested_amt: Number(row.requested_amt || 0),
              approved_amt: Number(row.approved_amt || 0),
            }))
          : validRows.map((row) => ({
              cost_code: row.cost_code || '',
              cost_name: '',
              month_budget: '',
              budget_year: requestNumber || '',
              requested_amt: Number(row.equal_amount || 0),
              approved_amt: Number(row.total_amount || 0),
            }))
        );
        setTimeout(() => {
          closeImportDialog(importedRows);
        }, 2000);
      } else {
        setUploadError('Copy failed: ' + resultStr);
      }
    } catch (err: any) {
      setUploadError('Failed to save records: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    try {
      await api.post("/api/wms/common/procBuildCommonProcedurewmc", {
        parameter: "PROC_COPY_TEMP_LOAD_BUDGET",
        loginid: user?.loginid ?? '',
        val1s1: user?.loginid ?? ''
      });

      setNotice({ type: 'success', message: 'Budget data saved successfully.' });
      const importedRows: ImportedBudgetRow[] = (loadedRows.length > 0
        ? loadedRows.map((row) => ({
            cost_code: row.cost_code || '',
            cost_name: '',
            month_budget: row.month_budget || '',
            budget_year: row.budget_year || '',
            requested_amt: Number(row.requested_amt || 0),
            approved_amt: Number(row.approved_amt || 0),
          }))
        : validRows.map((row) => ({
            cost_code: row.cost_code || '',
            cost_name: '',
            month_budget: '',
            budget_year: requestNumber || '',
            requested_amt: Number(row.equal_amount || 0),
            approved_amt: Number(row.total_amount || 0),
          }))
      );
      setTimeout(() => {
        closeImportDialog(importedRows);
      }, 1000);
    } catch (err: any) {
      setUploadError('Failed to process records: ' + err.message);
    }
  }


  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          DIV_CODE: '10',
          COST_CODE: 'COST001',
          CURR_CODE: 'AED',
          EQUAL_AMOUNT: '1000.00',
          TOTAL_AMOUNT: '1000.00',
          FROM_DATE: '01-JAN-2026',
          TO_DATE: '31-DEC-2026',
          REQUEST_NUMBER: 'REQ0001',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BudgetEdiTemplate');
      XLSX.writeFile(wb, 'BUDGET_EDI_Template.xlsx');
      setNotice({ type: 'success', message: 'Template downloaded successfully.' });
    } catch {
      setUploadError('Failed to generate template.');
    }
  };

  const columns: ColumnDef<EdiRow>[] = [
    {
      accessorKey: 'error_message',
      header: 'Status',
      size: 200,
      cell: ({ row }) => {
        const error = row.original.error_message;
        if (error && error.trim() !== '') {
          return <div className="flex items-center gap-2 text-red-600"><XCircle size={16} /><span className="text-sm font-medium">{error}</span></div>;
        }
        return <div className="flex items-center gap-2 text-green-600"><CheckCircle size={16} /><span className="text-sm font-medium">Valid</span></div>;
      },
    },
    { accessorKey: 'div_code', header: 'Div Code', size: 100 },
    { accessorKey: 'cost_code', header: 'Cost Code', size: 150 },
    { accessorKey: 'curr_code', header: 'Currency', size: 100 },
    { accessorKey: 'equal_amount', header: 'Equal Amount', size: 130 },
    { accessorKey: 'total_amount', header: 'Total Amount', size: 130 },
    { accessorKey: 'from_date', header: 'From Date', size: 120 },
    { accessorKey: 'to_date', header: 'To Date', size: 120 },
    { accessorKey: 'request_number', header: 'Request Number', size: 150 },
    { accessorKey: 'loaded_by', header: 'Loaded By', size: 120 },
    { accessorKey: 'loaded_date', header: 'Loaded Date', size: 150 },
  ];

  // --- NEW: columns for the separate loaded-data (monthly breakdown) view ---
  const loadedDataColumns: ColumnDef<LoadedBudgetRow>[] = [
    { accessorKey: 'cost_code', header: 'Cost Code', size: 90 },
    { accessorKey: 'month_budget', header: 'Month', size: 60 },
    { accessorKey: 'budget_year', header: 'Year', size: 60 },
    {
      accessorKey: 'requested_amt',
      header: 'Requested Amt',
      size: 130,
      cell: ({ row }) => (
        <input
          className="finance-amount-cell w-40 px-2 py-1 border rounded text-sm"
          type="number"
          style={{ textAlign: "right" }}
          step="0.001"
          value={row.original.requested_amt ?? ''}
          onChange={(event) => updateLoadedRow(row.index, 'requested_amt', event.target.value)}
        />
      ),
    },
  ];

  useEffect(() => {
    if (ediUploaded) fetchEDIData();
  }, [ediUploaded]);

  console.log('ediRows:', ediRows);

  return (
    <div className="grid gap-4 p-4">
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {!ediUploaded && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center transition-all hover:border-gray-400">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls" style={{ display: 'none' }} />
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-blue-50 p-3"><FileSpreadsheet size={48} className="text-blue-500" /></div>
            <div>
              <p className="text-lg font-medium text-gray-900">Upload Budget Excel File</p>
              <p className="mt-1 text-sm text-gray-500">Upload an Excel file with Budget data to import in bulk</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="gap-2">
                <CloudUpload size={16} /> Select Excel File
              </Button>
            </div>
            {fileName && <div className="mt-2 text-sm text-gray-600">Selected: <span className="font-medium">{fileName}</span></div>}
            {fileSelected && excelData.length > 0 && (
              <div className="mt-4 w-full max-w-md rounded-lg bg-blue-50 p-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <CheckCircle size={18} /><span className="font-medium">{excelData.length} rows loaded</span>
                  </div>
                  <Button onClick={handleUploadToEDI} disabled={isLoading} className="gap-2">
                    {isLoading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Uploading...</> : <><Upload size={16} />Upload to EDI Staging</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {ediUploaded && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle size={40} className="text-green-600" />
              <p className="text-lg font-semibold text-green-800">File uploaded successfully</p>
              <p className="text-sm text-green-700">{ediRows.length} row(s) staged for import.</p>
            </div>
            <div className="mt-4 flex justify-center gap-6">
              <div><span className="text-sm text-gray-500">Total</span><p className="text-2xl font-bold text-gray-900">{ediRows.length}</p></div>
              <div><span className="text-sm text-gray-500">Valid</span><p className="text-2xl font-bold text-green-600">{validRows.length}</p></div>
              <div><span className="text-sm text-gray-500">Invalid</span><p className="text-2xl font-bold text-red-600">{invalidRows.length}</p></div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Button variant="outline" onClick={handleReset}>Upload New File</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
          <Download size={14} /> Download Template
        </Button>
        {ediUploaded && (
          <div className="flex gap-3">
            <Button
              variant="default"
              onClick={handlePostValid}
              disabled={isLoading || hasErrors || validRows.length === 0}
              className="gap-2"
            >
              {isLoading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Processing...</> : <><CheckCircle size={16} />Save Valid Records ({validRows.length})</>}
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={isLoading}>Cancel</Button>
          </div>
        )}
        {!ediUploaded && <Button variant="ghost" onClick={onClose}>Close</Button>}
      </div>

      {uploadError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-700">{uploadError}</div>
          </div>
        </div>
      )}

      {hasErrors && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-yellow-700" />
            <div className="text-sm text-yellow-800">
              {invalidRows.length} record(s) have validation errors. Please fix and re-upload.
            </div>
          </div>
        </div>
      )}

      {/* NEW: separate overlay showing the expanded monthly loaded data. Does not replace anything above. */}
      {showLoadedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-6xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm text-gray-500">Monthly allocation breakdown staged for this request</p>
                <p>Request Number: {requestNumber}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowLoadedData(false)}>
                <XCircle size={18} />
              </Button>
            </div>
            <div className="p-4">
              <DataTable
                columns={loadedDataColumns}
                data={loadedRows}
                title="Loaded Budget Data"
                subtitle=""
                searchPlaceholder="Search records..."
                loading={loadedDataLoading}
                height={430}
                minWidth={100}
                density="grid"
                enablePagination
                pageSize={50}
                getRowId={(row, i) => `${row.div_code}_${row.cost_code}_${row.month_budget}_${row.budget_year}_${i}`}
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-4 py-3">
              {/* <Button variant="outline" color='primary' onClick={handleProcess}>
                {isLoading ? 'Saving...' : 'Save'}
              </Button> */}
              <Button color='primary' onClick={handleProcess}><Save size={15} /> {isLoading ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={() => setShowLoadedData(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportBudgetEdi;