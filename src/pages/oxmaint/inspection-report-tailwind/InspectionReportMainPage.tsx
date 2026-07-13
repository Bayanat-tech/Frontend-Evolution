import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from '@tanstack/react-table';
import { FaCaretDown, FaFilePdf, FaPlus, FaSearch } from 'react-icons/fa';
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
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from '../../../components/mms_ui';
import { InspectionReportPreview, InspectionReportPreviewData } from './components';
import { InspectionReportMainRow } from './types/InspectionReportMainPage.types';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';

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

const InspectionReportMainPage = () => {
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [showAddInspection, setShowAddInspection] = useState(false);
  const [reportRows, setReportRows] = useState<InspectionReportMainRow[]>([]);
  const [previewReport, setPreviewReport] = useState<InspectionReportPreviewData | null>(null);
  const [actionAnchorRect, setActionAnchorRect] = useState<DOMRect | null>(null);
  const [selectedActionRow, setSelectedActionRow] = useState<InspectionReportMainRow | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadReports = async () => {
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
    }
  };

  useEffect(() => {
    if (!showAddInspection) {
      void loadReports();
    }
  }, [showAddInspection]);

  const filteredMainRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return reportRows;

    return reportRows.filter((row) =>
      [
        row.reportNumber,
        row.date,
        row.time,
        row.assetNumber,
        row.assetName,
        row.location,
        row.inspector,
        row.inventory,
        String(row.runningHours),
        row.runningHoursUnit,
        String(row.inspectionFormId),
        row.overallCondition,
        row.assetSafeToUse,
        row.maintenanceRequired,
        row.assetStatus,
        row.additionalNote,
        row.createdBy,
        row.updateBy,
        row.createdAt
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [reportRows, searchText]);

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
      },
      {
        id: 'reportNumber',
        header: 'Report Number',
        accessorKey: 'reportNumber',
        size: 190
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
      }
    ],
    []
  );

  const table = useReactTable({
    data: filteredMainRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

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

        <TextField
          size="small"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search"
          className="w-[220px] max-w-full"
          endAdornment={<FaSearch size={13} className="text-[#475569]" />}
        />
      </div>

      <div className="w-full border border-[#d8dee6] text-[12px] text-[#516b89]">
        <TableContainer>
          <Table>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b border-[#dbe3ed]">
                  {headerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      head
                      onClick={header.column.getToggleSortingHandler()}
                      className={`bg-[#f4f7fb] text-[12px] font-bold text-[#223246] ${
                        header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                      }`}
                      style={{ width: header.getSize() }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: '▲',
                          desc: '▼'
                        }[header.column.getIsSorted() as string] ?? null}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-[12px] text-[#516b89]" style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow key={`${row.id}-detail`} className="border-b border-[#e2e8f0]">
                    <TableCell colSpan={columns.length} className="py-1 px-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[#243447] text-[12px]">
                          <span className="font-bold text-[#516b89]">Inspection Form:</span>
                          <span className="font-medium">{String(row.original.inspectionFormId)}</span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 border-none bg-transparent cursor-pointer text-[#243447] text-[12px] font-bold hover:text-[#0a6ed1]"
                            onClick={() => handleOpenPreview(row.original)}
                          >
                            <FaFilePdf />
                            PDF
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[#243447] text-[12px]">
                          <span className="font-bold text-[#516b89]">Note:</span>
                          <span className="font-medium">{row.original.additionalNote || '-'}</span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {previewReport && (
        <InspectionReportPreview open={Boolean(previewReport)} onClose={() => setPreviewReport(null)} report={previewReport} />
      )}

      <Menu open={Boolean(actionAnchorRect)} anchorRect={actionAnchorRect} onClose={handleCloseActionMenu}>
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
