import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { FaCaretDown, FaFilePdf, FaPlus, FaPrint } from 'react-icons/fa';
import AddInspectionReportPage from './AddInspectionReportPage';
import { deleteInspectionReport } from './api/inspectionReportApi';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem
} from '../../../components/mms_ui';
import { InspectionReportPreview, InspectionReportPreviewData } from './components';
import { InspectionReportMainRow } from './types/InspectionReportMainPage.types';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import { DataTable } from '../../../components/ui/DataTable';
import { getInspectionReportExcelBlob, getInspectionReportHtml } from './api/report';
import ReportDialogPage from '../../../components/ReportDialogPage';

type InspectionReportApiRow = {
  id?: number | string;
  report_number?: string;
  report_date?: string;
  report_time?: string;
  location?: string;
  asset_number?: string;
  asset_name?: string;
  inventory?: string;
  running_hours?: number | string;
  running_hours_unit?: string;
  inspection_form_id?: number | string;
  overall_condition?: string;
  asset_safe_to_use?: string;
  maintenance_required?: string;
  asset_status?: string;
  additional_note?: string;
  inspector_name?: string;
  created_by?: string;
  update_by?: string;
  created_at?: string;
};

function IframeReportRenderer({ required_values }: { required_values: { html: string } }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    const win = iframe.contentWindow as any;
    let originalPrint: (() => void) | undefined;
    if (win) {
      originalPrint = win.print;
      win.print = () => {};
    }
    doc.open();
    doc.write(required_values.html);
    doc.close();
    const restorePrint = () => { if (win && originalPrint) win.print = originalPrint; };
    if (doc.readyState === 'complete') restorePrint();
    else iframe.addEventListener('load', restorePrint, { once: true });
  }, [required_values.html]);

  return <iframe ref={iframeRef} title="report" style={{ width: '100%', minHeight: '70vh', border: 'none' }} />;
}

function getLoadingHtml(): string {
  return `<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:60vh;font-family:Arial,sans-serif;color:#1a5f4a;font-size:14px">
  <div style="text-align:center">Loading report…</div>
</body></html>`;
}

const InspectionReportMainPage = () => {
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [showAddInspection, setShowAddInspection] = useState(false);
  const [reportRows, setReportRows] = useState<InspectionReportMainRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [previewReport, setPreviewReport] = useState<InspectionReportPreviewData | null>(null);
  const [actionAnchorRect, setActionAnchorRect] = useState<DOMRect | null>(null);
  const [selectedActionRow, setSelectedActionRow] = useState<InspectionReportMainRow | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [activeReportRow, setActiveReportRow] = useState<InspectionReportMainRow | null>(null);

  const handleOpenReport = async (row: InspectionReportMainRow) => {
    const reportId = Number(row.id);
    if (!Number.isFinite(reportId) || reportId <= 0) return;

    setActiveReportRow(row);
    setReportHtml(null);
    setReportGenerating(true);
    handleCloseActionMenu();

    try {
      const html = await getInspectionReportHtml(reportId);
      setReportHtml(html);
    } catch (error) {
      console.error('Failed to load inspection report:', error);
      setReportHtml(null);
      setActiveReportRow(null);
    } finally {
      setReportGenerating(false);
    }
  };

  const handleExcelDownload = async () => {
    if (!activeReportRow) return;
    const reportId = Number(activeReportRow.id);
    try {
      const blob = await getInspectionReportExcelBlob(reportId);
      const fileBlob = new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(fileBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inspection-report-${activeReportRow.reportNumber || reportId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download inspection report Excel:', error);
    }
  };

  const closeReportDialog = () => {
    setReportHtml(null);
    setActiveReportRow(null);
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const response = await getDynamicLookup({
        parameter: 'OX_INSPECTION_REPORT_GRID',
        loginid: user?.loginid ?? '',
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null
      });

      const rows = Array.isArray(response) ? (response as InspectionReportApiRow[]) : [];

      const mappedRows: InspectionReportMainRow[] = rows.map((row) => ({
        rowType: 'main',
        id: String(row.id ?? ''),
        reportNumber: row.report_number ?? '',
        date: row.report_date ?? '',
        time: row.report_time ?? '',
        assetNumber: row.asset_number ?? '',
        assetName: row.asset_name ?? '',
        location: row.location ?? '',
        inspector: row.inspector_name ?? '',
        inventory: row.inventory ?? '',
        runningHours: row.running_hours ?? '',
        runningHoursUnit: row.running_hours_unit ?? '',
        inspectionFormId: row.inspection_form_id ?? '',
        overallCondition: row.overall_condition ?? '',
        assetSafeToUse: row.asset_safe_to_use ?? '',
        maintenanceRequired: row.maintenance_required ?? '',
        assetStatus: row.asset_status ?? '',
        additionalNote: row.additional_note ?? '',
        createdBy: row.created_by ?? '',
        updateBy: row.update_by ?? '',
        createdAt: row.created_at ?? ''
      }));

      setReportRows(mappedRows);
    } catch (error) {
      console.error('Failed to load inspection reports:', error);
      setReportRows([]);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (!showAddInspection) {
      void loadReports();
    }
  }, [showAddInspection]);

  const handleOpenPreview = async (row: InspectionReportMainRow) => {
    const reportId = Number(row.id);

    if (!Number.isFinite(reportId) || reportId <= 0) {
      console.error('Invalid report id for header details request:', row);
      return;
    }

    try {
      const response = await getDynamicLookup({
        parameter: 'OX_INSPECTION_REPORT_HEADER_DETAILS',
        loginid: user?.loginid ?? '',
        number1: reportId,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null
      });

      const detailRows = Array.isArray(response) ? response : [];

      // Map detail rows to InspectionReportPreviewItem format
      const mappedDetailItems = detailRows.map((item: any) => ({
        headerSectionTitle: item.header_section_title || item.HEADER_SECTION_TITLE || '',
        underSectionTitle: item.under_section_title || item.UNDER_SECTION_TITLE || '',
        typeStatus: item.type_status || item.TYPE_STATUS || '',
        value: item.type_value || item.TYPE_VALUE || '',
        note: item.inspection_note || item.INSPECTION_NOTE || '',
        upload: item.upload || item.UPLOAD || ''
      }));

      setPreviewReport({
        reportNo: row.reportNumber,
        date: row.date,
        time: row.time,
        location: row.location,
        assetNumber: row.assetNumber,
        assetName: row.assetName,
        inspector: row.inspector,
        inspectionForm: String(row.inspectionFormId),
        additionalNote: row.additionalNote,
        summary: {
          overall_condition: row.overallCondition,
          asset_safe_to_use: row.assetSafeToUse as 'Yes' | 'No',
          maintenance_required: row.maintenanceRequired as 'Yes' | 'No',
          asset_status: row.assetStatus,
          maintenance_priority: 'Low'
        },
        detailItems: mappedDetailItems
      });
    } catch (error) {
      console.error('Failed to load inspection report details:', error);
    }
  };

  const handleOpenActionMenu = (event: React.MouseEvent<HTMLElement>, row: InspectionReportMainRow) => {
    setActionAnchorRect(event.currentTarget.getBoundingClientRect());
    setSelectedActionRow(row);
  };

  const handleCloseActionMenu = () => {
    setActionAnchorRect(null);
  };

  const handleOpenDeleteConfirm = () => {
    setConfirmDeleteOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseDeleteConfirm = () => {
    setConfirmDeleteOpen(false);
    setSelectedActionRow(null);
  };

  const handleDeleteRow = async () => {
    if (!selectedActionRow) return;

    try {
      const reportId = Number(selectedActionRow.id);
      const response = await deleteInspectionReport(Number.isFinite(reportId) ? reportId : 0, user?.loginid ?? '');

      if (response.success) {
        await loadReports();
      }
    } catch (error) {
      console.error('Failed to delete inspection report:', error);
    } finally {
      handleCloseDeleteConfirm();
    }
  };

  const columns = useMemo<ColumnDef<InspectionReportMainRow>[]>(
    () => [
      {
        id: 'reportNumber',
        header: 'Report Number',
        accessorKey: 'reportNumber',
        size: 190,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleOpenPreview(row.original);
            }}
            className="inline-flex items-center gap-1.5 border-none bg-transparent p-0 cursor-pointer text-[#0a6ed1] text-[12px] font-bold hover:underline"
            title="Open report"
          >
            <FaFilePdf />
            {row.original.reportNumber}
          </button>
        )
      },
      {
        id: 'date',
        header: 'Date',
        size: 180,
        accessorFn: (row) => `${row.date}\n${row.time}`,
        cell: ({ row }) => (
          <span className="whitespace-pre-line">{`${row.original.date}\n${row.original.time}`}</span>
        )
      },
      {
        id: 'assetNumber',
        header: 'Asset',
        size: 220,
        accessorFn: (row) => `${row.assetNumber}\n${row.assetName}`,
        cell: ({ row }) => (
          <span className="whitespace-pre-line">{`${row.original.assetNumber}\n${row.original.assetName}`}</span>
        )
      },
      {
        id: 'location',
        header: 'Location',
        accessorKey: 'location',
        size: 190
      },
      {
        id: 'inspector',
        header: 'Inspector',
        accessorKey: 'inspector',
        size: 180
      },
      {
        id: 'inspectionFormId',
        header: 'Inspection Form',
        accessorKey: 'inspectionFormId',
        size: 150
      },
      {
        id: 'overallCondition',
        header: 'Overall Condition',
        accessorKey: 'overallCondition',
        size: 180
      },
      {
        id: 'assetSafeToUse',
        header: 'Asset Safe To Use',
        accessorKey: 'assetSafeToUse',
        size: 200,
        cell: ({ row }) => (
          <span className="inline-block border border-[#7d8ea8] rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight text-[#6a7f99] bg-[#f3f4f6]">
            {row.original.assetSafeToUse}
          </span>
        )
      },
      {
        id: 'maintenanceRequired',
        header: 'Maintenance Required',
        accessorKey: 'maintenanceRequired',
        size: 140
      },
      {
        id: 'assetStatus',
        header: 'Asset Status',
        accessorKey: 'assetStatus',
        size: 240
      },
      {
        id: 'additionalNote',
        header: 'Additional Note',
        accessorKey: 'additionalNote',
        size: 240
      },
      {
        id: 'action',
        header: 'Action',
        enableSorting: false,
        size: 150,
        cell: ({ row }) => (
          <Button
            size="small"
            endIcon={<FaCaretDown size={12} />}
            onClick={(event) => handleOpenActionMenu(event, row.original)}
            className="bg-[#0a6ed1] text-white normal-case"
          >
            Action
          </Button>
        )
      }
    ],
    []
  );

  if (showAddInspection) {
    return <AddInspectionReportPage onBack={() => setShowAddInspection(false)} />;
  }

  return (
    <div className="font-app bg-white">
      <header className="px-3 py-1.5">
        <h1 className="m-0 text-lg font-bold text-[#243447]">Inspection History</h1>
      </header>

      <hr className="border-t border-[#d5dbe3]" />

      <div className="min-h-[42px] px-3 py-1.5 flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc]">
        <Button
          size="small"
          startIcon={<FaPlus size={11} />}
          onClick={() => setShowAddInspection(true)}
          className="normal-case bg-[#0a6ed1] text-white rounded-lg"
        >
          Start New Inspection
        </Button>
      </div>

      <div className="px-3 pb-3">
        <DataTable
          columns={columns}
          data={reportRows}
          loading={loadingReports}
          searchValue={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search"
          emptyText="No inspection reports found"
          density="compact"
        />
      </div>

      {previewReport && (
        <InspectionReportPreview open={Boolean(previewReport)} onClose={() => setPreviewReport(null)} report={previewReport} />
      )}

      {(reportHtml !== null || reportGenerating) && activeReportRow && (
        <ReportDialogPage
          title={`Inspection Report ${activeReportRow.reportNumber}`}
          Report={IframeReportRenderer}
          required_values={{ html: reportGenerating ? getLoadingHtml() : reportHtml! }}
          excel={handleExcelDownload}
          onClose={closeReportDialog}
        />
      )}

      <Menu open={Boolean(actionAnchorRect)} anchorRect={actionAnchorRect} onClose={handleCloseActionMenu}>
        <MenuItem onClick={() => selectedActionRow && handleOpenReport(selectedActionRow)}>
          <FaPrint className="mr-1.5 inline" /> Report
        </MenuItem>
        <MenuItem onClick={handleOpenDeleteConfirm}>Delete</MenuItem>
      </Menu>

      <Dialog open={confirmDeleteOpen} onClose={handleCloseDeleteConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this inspection report?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirm} className="border border-[#c8d3df] text-[#243447] bg-white">
            Cancel
          </Button>
          <Button onClick={handleDeleteRow} className="bg-[#dc2626] text-white">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default InspectionReportMainPage;