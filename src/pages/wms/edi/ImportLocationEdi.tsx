import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ColumnDef } from '@tanstack/react-table';
import { CloudUpload, Undo2, Loader2 } from 'lucide-react';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';
import { executeCommonProcedure, getDynamicLookup } from '../../../api/lookups';
import { useToast } from '../../../components/ui/AlertToast';
import { Button } from '../../../components/ui/Button';
import { insUpdMsLocationEdiBlkApi } from '../../../api/edi';

interface ImportLocationProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EdiRow {
  error_message?: string;
  site_code?: string;
  location_code?: string;
  loc_desc?: string;
  loc_type?: string;
  loc_stat?: string;
  aisle?: string;
  column_no?: number;
  height?: number;
}

const ImportLocationEdi: React.FC<ImportLocationProps> = ({ onClose, onSuccess }) => {
  const [excelData, setExcelData] = useState<any[]>([]);
  const [ediRows, setEdiRows] = useState<EdiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ediUploaded, setEdiUploaded] = useState(false);
  const [FileSelected, setFileSelected] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const hasErrors = ediRows.some((row) => row.error_message && row.error_message.trim() !== '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setExcelData(jsonData);
        setFileSelected(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to read Excel file');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleUploadToEDI = async () => {
    try {
      setIsLoading(true);

      const mappedLocations = excelData.map((row: any) => ({
        company_code: user?.company_code || '',
        site_code: row.SITE_CODE?.toString() || '',
        location_code: row.LOCATION_CODE?.toString() || '',
        loc_desc: row.LOC_DESC?.toString() || '',
        loc_type: row.LOC_TYPE?.toString() || '',
        loc_stat: row.LOC_STAT?.toString() || '',
        aisle: row.AISLE?.toString() || '',
        column_no: row.COLUMN_NO ? parseInt(row.COLUMN_NO) : 0,
        height: row.HEIGHT ? parseInt(row.HEIGHT) : 0,
        blockcyc: 'N'
      }));

      const result = await insUpdMsLocationEdiBlkApi({
        loginid: user?.loginid,
        locations: mappedLocations
      });

      if (result?.success) {
        await fetchEDIData();
        setEdiUploaded(true);
        toast.success(result.message || 'Locations uploaded to EDI');
      } else {
        toast.error(result?.message || 'Failed to upload locations to EDI');
        handleReset();
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong while uploading');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEDIData = async () => {
    try {
      const response: any = await getDynamicLookup({
        parameter: 'MWMS_get_Location_Edi',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? ''
      });

      if (Array.isArray(response)) {
        setEdiRows([...response]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch EDI data');
    }
  };

  useEffect(() => {
    console.log('EDI Rows:', ediRows);
  }, [ediRows]);

  const handlePostValid = async () => {
    try {
      setIsLoading(true);

      const result = await executeCommonProcedure({
        parameter: 'SP_COPY_MS_LOCATION_EDI',
        loginid: user?.loginid ?? '',
        val1s1: user?.loginid ?? '',
        val1s2: user?.company_code ?? ''
      });

      if (result) {
        await fetchEDIData();
        await handleReset();
        toast.success('Valid location records saved successfully');
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save valid records');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setExcelData([]);
    setEdiRows([]);
    setEdiUploaded(false);
    setFileSelected(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getSampleTemplateData = () => {
    return [
      {
        SITE_CODE: 'HR',
        LOCATION_CODE: 'R01-05-L2-P11',
        LOC_DESC: 'HQ-R01-05-L2-P11',
        LOC_TYPE: '1',
        LOC_STAT: 'M',
        AISLE: 'R01',
        COLUMN_NO: '5',
        HEIGHT: 2
      },
      {
        SITE_CODE: 'A1',
        LOCATION_CODE: '062801',
        LOC_DESC: 'A1-062801',
        LOC_TYPE: '1',
        LOC_STAT: 'M',
        AISLE: '06',
        COLUMN_NO: '28',
        HEIGHT: 1
      }
    ];
  };

  // Generate and download template
  const handleDownloadTemplate = () => {
    try {
      const templateData = getSampleTemplateData();
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      const colWidths = [
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 }
      ];

      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'LocationEdiTemplate');

      XLSX.writeFile(workbook, 'Location_Edi_Template.xlsx');
    } catch (error) {
      console.error('Error generating template:', error);
      toast.error('Failed to generate template. Please try again.');
    }
  };

  const ediColumns: ColumnDef<EdiRow, any>[] = [
    {
      accessorKey: 'error_message',
      header: 'Error'
    },
    {
      accessorKey: 'site_code',
      header: 'Site Code'
    },
    {
      accessorKey: 'location_code',
      header: 'Location Code'
    },
    {
      accessorKey: 'loc_desc',
      header: 'Loc Desc'
    },
    {
      accessorKey: 'loc_type',
      header: 'Loc Type'
    },
    {
      accessorKey: 'loc_stat',
      header: 'Loc Stat'
    },
    {
      accessorKey: 'aisle',
      header: 'Aisle'
    },
    {
      accessorKey: 'column_no',
      header: 'Column No'
    },
    {
      accessorKey: 'height',
      header: 'Height'
    }
  ];

  // Warn once when errored rows first appear in the grid
  useEffect(() => {
    if (ediUploaded && hasErrors) {
      toast.warning('Please fix all error records before saving.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ediUploaded, hasErrors]);

  return (
    <div className="grid w-full gap-4">
      {/* ================= Upload Section ================= */}
      {!ediUploaded && (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-[#c7d2e3] bg-[#fbfdff] p-6 text-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls"
            className="hidden"
          />

          <Button
            variant="default"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || FileSelected}
          >
            <CloudUpload size={16} className="mr-2" />
            Select Excel File
          </Button>

          {excelData.length > 0 && (
            <Button variant="default" onClick={handleUploadToEDI} disabled={isLoading || hasErrors}>
              {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {isLoading ? 'Uploading...' : 'Upload to EDI'}
            </Button>
          )}
        </div>
      )}

      {/* ================= EDI Grid Section ================= */}
      {ediUploaded && (
        <DataTable<EdiRow, any>
          columns={ediColumns}
          data={ediRows}
          density="compact"
          height={450}
          rowClassName={(row) => (row.error_message ? 'bg-[#ffe6e6]' : 'bg-[#e6ffe6]')}
          emptyText="No EDI records to display"
        />
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Undo2 size={14} className="mr-2 rotate-180" />
          Download Template
        </Button>

        {ediUploaded && (
          <div className="flex gap-2">
            <Button variant="default" onClick={handlePostValid} disabled={isLoading || hasErrors}>
              {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Save All Valid Records
            </Button>

            <Button onClick={handleReset}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportLocationEdi;