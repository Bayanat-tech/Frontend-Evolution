import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../state/AuthContext';
import * as XLSX from 'xlsx';
import { CloudUpload, Upload, Download, AlertCircle, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { NoticeToast } from '../../components/ui/NoticeToast';
import { DataTable } from '../../components/ui/DataTable';
import { pamsSelect, pamsSave, pamsDelete } from '../../api/pams';
import type { ColumnDef } from '@tanstack/react-table';

interface ImportKpiEdiProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EdiRow {
  error_message?: string;
  kpi_code?: string;
  kpi_group?: string;
  kpi_activity?: string;
  weightage?: string;
  div_code?: string;
  div_name?: string;
  dept_code?: string;
  dept_name?: string;
  section_code?: string;
  section_name?: string;
  desg_code?: string;
  desg_name?: string;
  dept_head_name?: string;
  dept_head_code?: string;
  remarks?: string;
  loaded_by?: string;
  loaded_date?: string;
  company_code?: string;
}

type AnyRow = Record<string, any>;

function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normKey(k: string): string {
  return String(k || '')
    // .replace(/[\s\-]+/g, '_')
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

const ImportKpiEdi: React.FC<ImportKpiEdiProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();

  const [excelData, setExcelData] = useState<AnyRow[]>([]);
  const [ediRows, setEdiRows] = useState<EdiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ediUploaded, setEdiUploaded] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = ediRows.filter(row => !row.error_message || row.error_message.trim() === '');
  const invalidRows = ediRows.filter(row => row.error_message && row.error_message.trim() !== '');
  const hasErrors = invalidRows.length > 0;

  const fetchEDIData = async () => {
  try {
    setIsLoading(true);
    const response = await pamsSelect({
      parameter: 'get_kpi_edi',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });

    if (Array.isArray(response)) {
      const rows: EdiRow[] = response.map((row: any) => {
        // Oracle uppercase ya lowercase dono handle
        const r: any = {};
        Object.keys(row).forEach(k => { r[k.toUpperCase()] = row[k]; });

        return {
          error_message:  text(r.ERROR_MESSAGE),
          kpi_code:       text(r.KPI_CODE),
          kpi_group:      text(r.KPI_GROUP),
          kpi_activity:   text(r.KPI_ACTIVITY),
          weightage:      text(r.WEIGHTAGE),
          div_code:       text(r.DIV_CODE),
          div_name:       text(r.DIV_NAME),
          dept_code:      text(r.DEPT_CODE),
          dept_name:      text(r.DEPT_NAME),
          section_code:   text(r.SECTION_CODE),
          section_name:   text(r.SECTION_NAME),
          desg_code:      text(r.DESG_CODE),
          desg_name:      text(r.DESG_NAME),
          dept_head_name: text(r.DEPT_HEAD_NAME),
          dept_head_code: text(r.DEPT_HEAD_CODE),
          remarks:        text(r.REMARKS),
          loaded_by:      text(r.LOADED_BY),
          loaded_date:    text(r.LOADED_DATE),
          company_code:   text(r.COMPANY_CODE),
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

    // ── Fill down merged cells ──────────────────────────
    const filled: AnyRow[] = [];
    let lastMain: AnyRow = {};
    let lastKpiGroup = '';
    let lastWeightage = '';

    for (const raw of excelData) {
      const r = normalizeRow(raw);

      // Naya employee block — jab DIV_CODE aaye
      if (getVal(r, 'DIVCODE', 'DIV_CODE') !== '') {
        lastMain = { ...r };
        lastKpiGroup = getVal(r, 'KPIGROUP', 'KPI_GROUP');
        lastWeightage = getVal(r, 'WEIGHTAGE');
      } else {
        // Naya KPI_GROUP mila toh update karo
        const currentGroup = getVal(r, 'KPIGROUP', 'KPI_GROUP');
        if (currentGroup !== '') {
          lastKpiGroup = currentGroup;
          lastWeightage = getVal(r, 'WEIGHTAGE');
        }
      }

      const merged: AnyRow = { ...lastMain };
      Object.keys(r).forEach(k => {
        if (r[k] !== undefined && String(r[k]).trim() !== '') {
          merged[k] = r[k];
        }
      });
      
      merged['KPIGROUP'] = lastKpiGroup;
      merged['WEIGHTAGE'] = lastWeightage;

      if (!getVal(merged, 'KPIACTIVITY', 'KPI_ACTIVITY')) continue;

      filled.push(merged);
    }

    const mappedRows = filled.map((r) => [
      getVal(r, 'DIVCODE', 'DIV_CODE'),
      getVal(r, 'DIVNAME', 'DIV_NAME'),
      getVal(r, 'DEPTCODE', 'DEPT_CODE'),
      getVal(r, 'DEPTNAME', 'DEPT_NAME'),
      getVal(r, 'SECTIONCODE', 'SECTION_CODE'),
      getVal(r, 'SECTIONNAME', 'SECTION_NAME'),
      getVal(r, 'DESGCODE', 'DESG_CODE').replace(/\.0+$/, ''),
      getVal(r, 'DESGNAME', 'DESG_NAME'),
      getVal(r, 'KPIGROUP', 'KPI_GROUP'),
      getVal(r, 'WEIGHTAGE').replace(/\.0+$/, ''),
      getVal(r, 'KPIACTIVITY', 'KPI_ACTIVITY'),
    ].join('|'));

    const CHUNK_SIZE = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
      chunks.push(mappedRows.slice(i, i + CHUNK_SIZE));
    }

    let totalUploaded = 0;
    for (let i = 0; i < chunks.length; i++) {
      await (pamsSave as any)({
        parameter: 'kpi_edi_bulk_insert',
        loginid: user?.loginid ?? '',
        val1s1: user?.company_code ?? '',
        val1s2: chunks[i].join('||'),
      });
      totalUploaded += chunks[i].length;
      setNotice({
        type: 'info',
        message: `Uploading... ${totalUploaded}/${filled.length} rows`,
      });
    }

    await fetchEDIData();
    setEdiUploaded(true);
    setNotice({
      type: 'success',
      message: `Uploaded successfully. Rows: ${filled.length}`,
    });
  } catch (err: any) {
    setUploadError(err.message);
  } finally {
    setIsLoading(false);
  }
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
        parameter: 'sp_copy_kpi_edi',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
      });

      let resultStr = '';
      if (Array.isArray(result) && result.length > 0) {
        const firstRow = result[0] as Record<string, unknown>;
        resultStr = String(Object.values(firstRow)[0] ?? '');
      }

      if (!resultStr.toUpperCase().startsWith('ERROR')) {
        setNotice({ type: 'success', message: `Import successful! ${validRows.length} records saved to MS_EAM_KPI.` });
        setTimeout(() => {
          handleReset();
          onSuccess();
          onClose();
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

  const handleReset = () => {
    setExcelData([]);
    setEdiRows([]);
    setUploadError(null);
    setEdiUploaded(false);
    setFileSelected(false);
    setFileName('');
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          DIVCODE: '12',
          DIVNAME: 'AL MADINA LOGISTICS SERVICES COMPANY',
          DEPTCODE: '038',
          DEPTNAME: 'OIL & GAS LOGISTICS',
          SECTIONCODE: '101',
          SECTIONNAME: 'PDO- DUQM & SALALAH- OPERATION',
          DEPTHEADNAME: 'NABIL MURAD',
          DEPTHEADCODE: '2012030148',
          DESGCODE: '016',
          DESGNAME: 'Operations Supervisor',
          WEIGHTAGE: '20',
          REMARKS: '',
          KPIGROUP: 'Reports',
          KPIACTIVITY: 'Accuracy and completeness of daily truck loading reports.',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 35 },
        { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 15 },
        { wch: 25 }, { wch: 60 }, { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'KpiEdiTemplate');
      XLSX.writeFile(wb, 'KPI_EDI_Template.xlsx');
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
    // { accessorKey: 'kpi_code', header: 'KPI Code', size: 100 },
    { accessorKey: 'kpi_group', header: 'KPI Group', size: 160 },
    { accessorKey: 'kpi_activity', header: 'KPI Activity', size: 350 },
    { accessorKey: 'weightage', header: 'Weightage', size: 100 },
    { accessorKey: 'div_code', header: 'Div Code', size: 90 },
    { accessorKey: 'div_name', header: 'Division', size: 200 },
    { accessorKey: 'dept_code', header: 'Dept Code', size: 100 },
    { accessorKey: 'dept_name', header: 'Department', size: 200 },
    { accessorKey: 'section_code', header: 'Section Code', size: 110 },
    { accessorKey: 'section_name', header: 'Section Name', size: 200 },
    { accessorKey: 'desg_code', header: 'Desg Code', size: 100 },
    { accessorKey: 'desg_name', header: 'Designation', size: 200 },
    // { accessorKey: 'dept_head_name', header: 'Dept Head', size: 180 },
    // { accessorKey: 'dept_head_code', header: 'Dept Head Code', size: 140 },
    // { accessorKey: 'remarks', header: 'Remarks', size: 150 },
    { accessorKey: 'loaded_by', header: 'Loaded By', size: 120 },
    { accessorKey: 'loaded_date', header: 'Loaded Date', size: 150 },
  ];

  useEffect(() => {
    if (ediUploaded) fetchEDIData();
  }, [ediUploaded]);

  return (
    <div className="grid gap-4 p-4">
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {!ediUploaded && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center transition-all hover:border-gray-400">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls" style={{ display: 'none' }} />
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-blue-50 p-3"><FileSpreadsheet size={48} className="text-blue-500" /></div>
            <div>
              <p className="text-lg font-medium text-gray-900">Upload KPI Excel File</p>
              <p className="mt-1 text-sm text-gray-500">Upload an Excel file with KPI data to import in bulk</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="gap-2">
                <CloudUpload size={16} /> Select Excel File
              </Button>
              {/* <Button variant="ghost" onClick={handleDownloadTemplate} className="gap-2">
                <Download size={16} /> Download Template
              </Button> */}
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
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div className="flex gap-6">
              <div><span className="text-sm text-gray-500">Total</span><p className="text-2xl font-bold text-gray-900">{ediRows.length}</p></div>
              <div><span className="text-sm text-gray-500">Valid</span><p className="text-2xl font-bold text-green-600">{validRows.length}</p></div>
              <div><span className="text-sm text-gray-500">Invalid</span><p className="text-2xl font-bold text-red-600">{invalidRows.length}</p></div>
            </div>
            <Button variant="outline" onClick={handleReset}>Upload New File</Button>
          </div>

          <DataTable
            columns={columns}
            data={ediRows}
            title="KPI EDI Staging"
            subtitle="Review and validate records before saving"
            searchPlaceholder="Search records..."
            loading={isLoading}
            height={500}
            minWidth={1800}
            density="grid"
            enablePagination
            pageSize={50}
            getRowId={(row, i) => `${row.kpi_code}_${row.div_code}_${i}`}
            rowClassName={(row) => row.error_message && row.error_message.trim() !== '' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50/30 hover:bg-green-50'}
          />
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
    </div>
  );
};

export default ImportKpiEdi;