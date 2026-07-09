import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ColumnDef } from '@tanstack/react-table';
import { CloudUpload, Undo2, Loader2 } from 'lucide-react';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';
import { useToast } from '../../../components/ui/AlertToast';
import { Button } from '../../../components/ui/Button';
import { insUpdMsSiteEdiBlkApi } from '../../../api/edi';
import { executeCommonProcedure, getDynamicLookup } from '../../../api/lookups';

interface ImportSiteProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EdiRow {
  error_message?: string;
  site_code?: string;
  site_name?: string;
  site_ind?: string;
  loc_type?: string;
  site_type?: string;
  site_addr1?: string;
  site_addr2?: string;
  site_addr3?: string;
  site_addr4?: string;
  city?: string;
  country_code?: string;
  contact_name?: string;
  tel_no?: string;
  charge_ind?: string;
  prin_code?: string;
  group_code?: string;
  div_code?: string;
  site_rpt_name?: string;
}

const ImportSiteEdi: React.FC<ImportSiteProps> = ({ onClose, onSuccess }) => {
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

      const mappedSites = excelData.map((row: any) => ({
        company_code: user?.company_code || '',
        site_code: row.SITE_CODE?.toString() || '',
        site_ind: row.SITE_IND?.toString() || '',
        site_type: row.SITE_TYPE?.toString() || '',
        site_name: row.SITE_NAME?.toString() || '',
        site_addr1: row.SITE_ADDR1?.toString() || '',
        site_addr2: row.SITE_ADDR2?.toString() || '',
        site_addr3: row.SITE_ADDR3?.toString() || '',
        site_addr4: row.SITE_ADDR4?.toString() || '',
        city: row.CITY?.toString() || '',
        country_code: row.COUNTRY_CODE?.toString() || '',
        contact_name: row.CONTACT_NAME?.toString() || '',
        tel_no: row.TEL_NO?.toString() || '',
        charge_ind: row.CHARGE_IND?.toString() || '',
        prin_code: row.PRIN_CODE?.toString() || '',
        group_code: row.GROUP_CODE?.toString() || '',
        loc_type: row.LOC_TYPE?.toString() || '',
        div_code: row.DIV_CODE?.toString() || '',
        site_rpt_name: row.SITE_RPT_NAME?.toString() || ''
      }));

      const result = await insUpdMsSiteEdiBlkApi({
        loginid: user?.loginid,
        sites: mappedSites
      });

      if (result?.success) {
        await fetchEDIData();
        setEdiUploaded(true);
        toast.success(result.message || 'Sites uploaded to EDI');
      } else {
        toast.error(result?.message || 'Failed to upload sites to EDI');
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
        parameter: 'MWMS_Get_Site_Edi',
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
        parameter: 'SP_COPY_MS_SITE_EDI',
        loginid: user?.loginid ?? '',
        val1s1: user?.loginid ?? ''
      });

      if (result) {
        await fetchEDIData();
        await handleReset();
        toast.success('Valid site records saved successfully');
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
        SITE_CODE: 'A1',
        SITE_IND: 'DR',
        SITE_TYPE: 'SPL',
        SITE_NAME: 'AMBIENT SITE',
        SITE_ADDR1: 'Plot 21',
        SITE_ADDR2: 'MIDC Area',
        SITE_ADDR3: 'Andheri East',
        SITE_ADDR4: null,
        CITY: 'Mumbai',
        COUNTRY_CODE: 'IN',
        CONTACT_NAME: 'Rajesh Sharma',
        TEL_NO: '9876543210',
        CHARGE_IND: 'Y',
        PRIN_CODE: '00001',
        GROUP_CODE: 'GRP01',
        LOC_TYPE: 'MAIN',
        DIV_CODE: 'DIV01',
        SITE_RPT_NAME: 'Mumbai Warehouse Report'
      },
      {
        SITE_CODE: 'CFSDS',
        SITE_IND: 'DR',
        SITE_TYPE: 'SPL',
        SITE_NAME: 'CFS DESPATCH SITE',
        SITE_ADDR1: 'Sector 12',
        SITE_ADDR2: 'Industrial Area',
        SITE_ADDR3: 'Noida',
        SITE_ADDR4: null,
        CITY: 'Delhi',
        COUNTRY_CODE: 'IN',
        CONTACT_NAME: 'Amit Verma',
        TEL_NO: '9898989898',
        CHARGE_IND: 'N',
        PRIN_CODE: '00002',
        GROUP_CODE: 'GRP02',
        LOC_TYPE: 'BRANCH',
        DIV_CODE: 'DIV01',
        SITE_RPT_NAME: 'Delhi Hub Report'
      }
    ];
  };

  // Generate and download template
  const handleDownloadTemplate = () => {
    try {
      const templateData = getSampleTemplateData();
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      const colWidths = [
        { wch: 12 }, // SITE_CODE
        { wch: 10 }, // SITE_IND
        { wch: 10 }, // SITE_TYPE
        { wch: 22 }, // SITE_NAME
        { wch: 18 }, // SITE_ADDR1
        { wch: 18 }, // SITE_ADDR2
        { wch: 18 }, // SITE_ADDR3
        { wch: 18 }, // SITE_ADDR4
        { wch: 14 }, // CITY
        { wch: 12 }, // COUNTRY_CODE
        { wch: 18 }, // CONTACT_NAME
        { wch: 14 }, // TEL_NO
        { wch: 10 }, // CHARGE_IND
        { wch: 12 }, // PRIN_CODE
        { wch: 12 }, // GROUP_CODE
        { wch: 10 }, // LOC_TYPE
        { wch: 10 }, // DIV_CODE
        { wch: 22 } // SITE_RPT_NAME
      ];

      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'SiteEdiTemplate');

      XLSX.writeFile(workbook, 'Site_Edi_Template.xlsx');
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
      accessorKey: 'site_name',
      header: 'Site Name'
    },
    {
      accessorKey: 'site_ind',
      header: 'Site Ind'
    },
    {
      accessorKey: 'loc_type',
      header: 'Loc Type'
    },
    {
      accessorKey: 'site_type',
      header: 'Site Type'
    },
    {
      accessorKey: 'site_addr1',
      header: 'Address 1'
    },
    {
      accessorKey: 'site_addr2',
      header: 'Address 2'
    },
    {
      accessorKey: 'site_addr3',
      header: 'Address 3'
    },
    {
      accessorKey: 'site_addr4',
      header: 'Address 4'
    },
    {
      accessorKey: 'city',
      header: 'City'
    },
    {
      accessorKey: 'country_code',
      header: 'Country Code'
    },
    {
      accessorKey: 'contact_name',
      header: 'Contact Name'
    },
    {
      accessorKey: 'tel_no',
      header: 'Tel No'
    },
    {
      accessorKey: 'charge_ind',
      header: 'Charge Ind'
    },
    {
      accessorKey: 'prin_code',
      header: 'Prin Code'
    },
    {
      accessorKey: 'group_code',
      header: 'Group Code'
    },
    {
      accessorKey: 'div_code',
      header: 'Div Code'
    },
    {
      accessorKey: 'site_rpt_name',
      header: 'Rpt Name'
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

export default ImportSiteEdi;