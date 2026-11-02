// src/pages/hr/payunits/PayUnitsPage.tsx
//
// Pay Units — new UI (modelled on ProductWmsPage):
//  • List view  : DataTable with Refresh / Create Pay Unit inside the toolbar
//  • Editor view: full-page Freight-style header (List / Close / Attach / Save)
//                 hosting AddPayUnitsForm (Save + Attach triggered via ref)
//  • Create flow: "Create Pay Unit" → DivisionPickerDialog → editor
//  • Feedback   : toast; delete uses a confirm Dialog (no window.confirm)

import {
  ArrowLeft, Edit2, Eye, FileText, Paperclip, Plus, RefreshCw, Save, Trash2, X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { executeDynamicDelete, getDynamicLookup } from '../../../api/lookups';
import AddPayUnitsForm, { type PayUnitFormHandle } from './AddPayUnitsForm';
import { useToast } from '../../../components/ui/AlertToast';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { DivisionPickerDialog } from '../../../components/ui/DivisionPickerDialog';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

export type TPayUnitsHeader = {
  PAY_COMP_ID: string;
  PAY_COMP_DESC: string;
  PAY_COMP_SHORT_DESC?: string;
  COMPANY_CODE: string;
  DIV_CODE?: string;
  DIV_NAME?: string;
};

type EditorMode = 'add' | 'edit' | 'view';

type EditorState = {
  mode: EditorMode;
  data: Partial<TPayUnitsHeader>;
};

const PayUnitsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? '';
  const loginid = user?.loginid ?? '';
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [openDivision, setOpenDivision] = useState(false);

  // view state
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editor, setEditor] = useState<EditorState>({ mode: 'add', data: {} });
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TPayUnitsHeader | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save / Attach buttons can trigger it
  const formRef = useRef<PayUnitFormHandle>(null);

  // ===================== FETCH DATA =====================
  const {
    data: payUnitsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['pay-units-header', companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_PAY_UNITS',
        code1: companyCode,
        code2: loginid
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData: TPayUnitsHeader[] = rawRows.map(uppercaseKeys).map((row: any) => ({
        PAY_COMP_ID: row.PAY_COMP_ID,
        PAY_COMP_DESC: row.PAY_COMP_DESC,
        PAY_COMP_SHORT_DESC: row.PAY_COMP_SHORT_DESC,
        COMPANY_CODE: row.COMPANY_CODE,
        DIV_CODE: row.DIV_CODE,
        DIV_NAME: row.DIV_NAME ?? ''
      }));

      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  useEffect(() => {
    if (isError) toast.error(error instanceof Error ? error.message : 'Unable to load pay units');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  // ===================== FILTER DATA =====================
  const filteredData = useMemo(() => {
    const rows = payUnitsData?.tableData ?? [];
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      [row.PAY_COMP_ID, row.PAY_COMP_DESC, row.PAY_COMP_SHORT_DESC].some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(trimmed)
      )
    );
  }, [payUnitsData?.tableData, query]);

  // ==========fetch Division==================
  const { data: divisionData, isLoading: isLoadingDivision } = useQuery({
    queryKey: ['division', companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'Account_division',
        code1: companyCode,
        code2: loginid
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData = rawRows.map(uppercaseKeys);
      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  // ===================== NAVIGATION =====================
  const openEditor = (mode: EditorMode, data: Partial<TPayUnitsHeader> = {}) => {
    setEditor({ mode, data });
    setView('editor');
  };

  const handleCloseEditor = () => {
    setView('list');
    setEditor({ mode: 'add', data: {} });
  };

  const handleSaved = () => {
    handleCloseEditor();
    void queryClient.invalidateQueries({ queryKey: ['pay-units-header', companyCode] });
  };

  const handleSelectDivision = (divCode: string, divName: string) => {
    setOpenDivision(false);
    openEditor('add', { DIV_CODE: divCode, DIV_NAME: divName });
  };

  // ===================== HEADER ACTIONS =====================
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  // ===================== DELETE =====================
  const requestDelete = (row: TPayUnitsHeader) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: 'PAY_COMP_UNITS_delete',
        loginid,
        code1: deleteTarget.COMPANY_CODE,
        code2: deleteTarget.PAY_COMP_ID
      });
      toast.success('Pay unit deleted successfully');
      setDeleteOpen(false);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['pay-units-header', companyCode] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete pay unit');
    } finally {
      setDeleting(false);
    }
  };

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<TPayUnitsHeader>[]>(
    () => [
      { accessorKey: 'PAY_COMP_ID', header: 'Pay Component ID', size: 150 },
      { accessorKey: 'PAY_COMP_DESC', header: 'Description', size: 300 },
      { accessorKey: 'PAY_COMP_SHORT_DESC', header: 'Short Description', size: 220 },
      {
        id: 'actions',
        header: 'Actions',
        size: 120,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor('view', row.original)}
              title="View pay unit"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor('edit', row.original)}
              title="Edit pay unit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => requestDelete(row.original)}
              title="Delete pay unit"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header
     ───────────────────────────────────────────────────────── */
  if (view === 'editor') {
    const isView = editor.mode === 'view';
    const title =
      editor.mode === 'add' ? 'New Pay Unit' : editor.mode === 'edit' ? 'Edit Pay Unit' : 'View Pay Unit';
    const badge = editor.mode === 'add' ? 'Draft' : editor.mode === 'edit' ? 'Editing' : 'View only';

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{title}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {editor.data.PAY_COMP_ID && (
                  <span className="text-xs text-muted-foreground">{editor.data.PAY_COMP_ID}</span>
                )}
                {editor.data.DIV_CODE && (
                  <span className="text-xs text-muted-foreground">
                    Division: {editor.data.DIV_CODE}
                    {editor.data.DIV_NAME ? ` - ${editor.data.DIV_NAME}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Attach / Save (Save hidden in view mode) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => formRef.current?.attach()}
              disabled={saving}
            >
              <Paperclip size={14} /> Attach
            </Button>
            {!isView && (
              <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving' : 'Save'}
              </Button>
            )}
          </div>
        </div>

        {/* Form content — ref lets the header Save / Attach trigger the form */}
        <AddPayUnitsForm
          ref={formRef}
          key={editor.data.PAY_COMP_ID || 'new'}
          onClose={(refetch) => (refetch ? handleSaved() : handleCloseEditor())}
          isEdit={editor.mode !== 'add'}
          isViewMode={isView}
          pay_comp_id={editor.data.PAY_COMP_ID || undefined}
          div_code={editor.data.DIV_CODE || undefined}
          div_name={editor.data.DIV_NAME || undefined}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title only — buttons live inside the DataTable toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: '18px', letterSpacing: '-0.01em', fontWeight: 600 }}
          >
            Pay Units
          </h2>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        title={isLoading ? 'Loading' : `${filteredData.length.toLocaleString()} Records`}
        subtitle="Pay Unit List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search pay component ID, description..."
        loading={isLoading || isFetching}
        emptyText="No pay units found"
        height={560}
        minWidth={800}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => row.PAY_COMP_ID || `temp-${index}`}
        enableExport
        exportFilename="hr-pay-units-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setOpenDivision(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Create Pay Unit
            </button>
          </div>
        }
      />

      <DivisionPickerDialog
        open={openDivision}
        divisions={divisionData?.tableData ?? []}
        loading={isLoadingDivision}
        description="Choose a division to continue."
        onSelect={(item, code, name) =>
          handleSelectDivision(code || item.DIV_CODE || item.div_code, name || item.DIV_NAME || item.div_name)
        }
        onClose={() => setOpenDivision(false)}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        title="Delete Pay Unit"
        description={
          deleteTarget ? `Delete ${deleteTarget.PAY_COMP_ID} - ${deleteTarget.PAY_COMP_DESC}?` : undefined
        }
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={deleting} variant="destructive" onClick={confirmDelete}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">Are you sure you want to delete this record?</p>
      </Dialog>
    </section>
  );
};

export default PayUnitsPage;