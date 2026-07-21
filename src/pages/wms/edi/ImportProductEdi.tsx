import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ColumnDef } from '@tanstack/react-table';
import { CloudUpload, Undo2, Loader2 } from 'lucide-react';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';
import { executeCommonProcedure, getDynamicLookup } from '../../../api/lookups';
import { useToast } from '../../../components/ui/AlertToast';
import { Button } from '../../../components/ui/Button';
import { clearProductEDI, getProductEDI, uploadProductEDI } from '../../../api/edi';

interface ImportProductProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EdiRow {
  error_message?: string;
  prin_code?: string;
  prod_code?: string;
  prod_name?: string;
  group_code?: string;
  brand_code?: string;
  p_uom?: string;
  l_uom?: string;
  length?: number;
  breadth?: number;
  height?: number;
  volume?: number;
  gross_wt?: number;
  net_wt?: number;
  uom_count?: number;
  upp?: number;
  uppp?: number;
  site_ind?: string;
  model_number?: string;
}

const ImportProductEdi: React.FC<ImportProductProps> = ({ onClose, onSuccess }) => {
  const [excelData, setExcelData] = useState<any[]>([]);
  const [ediRows, setEdiRows] = useState<EdiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ediUploaded, setEdiUploaded] = useState(false);
  const [FileSelected, setFileSelected] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const hasErrors = ediRows.some((row) => row.error_message && row.error_message.trim() !== '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===============================
  // Handle File Selection
  // ===============================
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

  // ===============================
  // Upload to EDI Table
  // ===============================

  const handleUploadToEDI = async () => {
    try {
      setIsLoading(true);

      const mappedProducts = excelData.map((row: any) => ({
              prin_code: row.PRIN_CODE?.toString() || '',
              prod_code: row.PROD_CODE?.toString() || '',
              prod_name: row.PROD_NAME?.toString() || '',
              group_code: row.GROUP_CODE?.toString() || '',
              brand_code: row.BRAND_CODE?.toString() || '',
              p_uom: row.P_UOM?.toString() || '',
              l_uom: row.L_UOM?.toString(),
              length: row.LENGTH ? parseFloat(row.LENGTH) : undefined,
              breadth: row.BREADTH ? parseFloat(row.BREADTH) : undefined,
              height: row.HEIGHT ? parseFloat(row.HEIGHT) : undefined,
              volume: row.VOLUME ? parseFloat(row.VOLUME) : undefined,
              gross_wt: row.GROSS_WT ? parseFloat(row.GROSS_WT) : undefined,
              net_wt: row.NET_WT ? parseFloat(row.NET_WT) : undefined,
              uom_count: row.UOM_COUNT ? parseFloat(row.UOM_COUNT) : 1,
              upp: row.UPP ? parseFloat(row.UPP) : undefined,
              uppp: row.UPPP ? parseFloat(row.UPPP) : undefined,
              site_ind: row.SITE_IND?.toString(),
              prod_status: 'O',
              model_number: row.MODEL_NUMBER?.toString(),
      }));

      const result = await uploadProductEDI(
        mappedProducts
      );

      if (result) {
        await fetchEDIData();
        setEdiUploaded(true);
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to upload products to EDI');
    } finally {
      setIsLoading(false);
    }
  };

  // ===============================
  // Fetch EDI Data
  // ===============================
  const fetchEDIData = async () => {
    try {
      const response = await getProductEDI();
      if (response?.success) {
        setEdiRows(response.data);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  useEffect(() => {
    console.log('EDI Rows:', ediRows);
  }, [ediRows]);

  // ===============================
  // Move Valid Records to Master
  // ===============================
  const handlePostValid = async () => {
    try {
      setIsLoading(true);

      const result = await executeCommonProcedure({
        parameter: 'SP_COPY_MS_PRODUCT_EDI',
        loginid: user?.loginid ?? '',
        val1s1: user?.loginid ?? ''
      });

      if (result) {
        await fetchEDIData();
        await handleReset();
        toast.success('Valid product records saved successfully');
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save valid records');
    } finally {
      setIsLoading(false);
    }
  };

  // ===============================
  // Reset Dialog
  // ===============================
  const handleReset = async () => {
    try {
      await clearProductEDI();
    } catch (err) {
      console.error(err);
    }

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
        PRIN_CODE: '00001',
        GROUP_CODE: '00001',
        BRAND_CODE: '00001',
        P_UOM: 'CSE',
        L_UOM: 'PCS',
        UOM_COUNT: '2',
        UPPP: '10',
        UPP: '1000',
        LENGTH: '10',
        BREADTH: '12',
        HEIGHT: '14',
        VOLUME: '24',
        GROSS_WT: '12',
        NET_WT: '13',
        SITE_IND: 'DR',
        MODEL_NUMBER: 'MDL-001'
      },
      {
        PRIN_CODE: '00002',
        GROUP_CODE: '00001',
        BRAND_CODE: '00003',
        P_UOM: 'CSE',
        L_UOM: 'CSE',
        UOM_COUNT: '1',
        UPPP: '1',
        UPP: '1000',
        LENGTH: '10',
        BREADTH: '12',
        HEIGHT: '14',
        VOLUME: '24',
        GROSS_WT: '12',
        NET_WT: '13',
        SITE_IND: 'FR',
        MODEL_NUMBER: 'MDL-002'
      }
    ];
  };

  // Generate and download template
  const handleDownloadTemplate = () => {
    try {
      const templateData = getSampleTemplateData();
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // PRIN_CODE
        { wch: 10 }, // GROUP_CODE
        { wch: 10 }, // BRAND_CODE
        { wch: 10 }, // P_UOM
        { wch: 10 }, // L_UOM
        { wch: 15 }, // UOM_COUNT
        { wch: 15 }, // UPPP
        { wch: 15 }, // UPP
        { wch: 15 }, // LENGTH
        { wch: 15 }, // BREADTH
        { wch: 15 }, // HEIGHT
        { wch: 15 }, // VOLUME
        { wch: 15 }, // GROSS_WT
        { wch: 15 }, // NET_WT
        { wch: 10 }, // SITE_IND
        { wch: 15 } // MODEL_NUMBER
      ];

      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ProductEdiTemplate');

      // Save the file
      XLSX.writeFile(workbook, 'Product_Edi_Template.xlsx');
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
      accessorKey: 'prin_code',
      header: 'Principal'
    },
    {
      accessorKey: 'group_code',
      header: 'Group'
    },
    {
      accessorKey: 'brand_code',
      header: 'Brand'
    },
    {
      accessorKey: 'prod_code',
      header: 'Prod Code'
    },
    {
      accessorKey: 'prod_name',
      header: 'Prod Name'
    },
    {
      accessorKey: 'p_uom',
      header: 'P UOM'
    },
    {
      accessorKey: 'l_uom',
      header: 'L UOM'
    },
    {
      accessorKey: 'length',
      header: 'Length'
    },
    {
      accessorKey: 'breadth',
      header: 'Breadth'
    },
    {
      accessorKey: 'height',
      header: 'Height'
    },
    {
      accessorKey: 'volume',
      header: 'Volume'
    },
    {
      accessorKey: 'gross_wt',
      header: 'Gross Weight'
    },
    {
      accessorKey: 'net_wt',
      header: 'Net Weight'
    },
    {
      accessorKey: 'uom_count',
      header: 'UOM Count'
    },
    {
      accessorKey: 'upp',
      header: 'Unit Price'
    },
    {
      accessorKey: 'uppp',
      header: 'Unit Price with Packing'
    },
    {
      accessorKey: 'site_ind',
      header: 'Site Indicator'
    },
    {
      accessorKey: 'model_number',
      header: 'Model Number'
    }
  ];

  // Warn once when errored rows first appear in the grid
  useEffect(() => {
    if (ediUploaded && hasErrors) {
      toast.warning('Please fix all error records before saving.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ediUploaded, hasErrors]);

  // ===============================
  // JSX
  // ===============================
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

            <Button onClick={handleReset}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportProductEdi;