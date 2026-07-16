import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useAssetInventoryRows, useStatusBasedTotalCount } from '../api/asset_inventory';

export type AssetInventoryGridRow = {
  asset_id?: string | number;
  asset_type?: string | number | null;
  asset_type_name?: string;
  status_code?: string | number | null;
  site_project?: string | number | null;
  site_project_name?: string;
  business_unit?: string;
  asset_value?: number | null;
  purchase_date?: string | null;
  warranty_date?: string | null;
  inspection_form_ids?: string[];
  inspection_form_names?: string[];
  asset_number: string;
  category: string;
  category_type: string;
  asset_name: string;
  location: string;
  model: string;
  meter: number;
  status: string;
  operator: string;
};

export type ActionMenuContext = {
  row: AssetInventoryGridRow;
  x: number;
  y: number;
};
const EMPTY_ROWS: AssetInventoryGridRow[] = []; // module-level so it's the SAME reference every render

export const useAssetInventoryGrid = () => {
  const [statusSelected, setStatusSelected] = useState<string | null>(null);
  console.log('statusSelected', statusSelected);
  const [searchText, setSearchText] = useState('');
  const [actionMenuContext, setActionMenuContext] = useState<ActionMenuContext | null>(null);
  const { data: statusData, isLoading: isStatusLoading } = useStatusBasedTotalCount();
  const { data: assetInventoryRowData = EMPTY_ROWS, isLoading: isGridLoading } =
    useAssetInventoryRows(statusSelected);
  const filteredRows = useMemo(() => {
    const rows = assetInventoryRowData as AssetInventoryGridRow[];

    if (!searchText.trim()) return rows;

    const key = searchText.toLowerCase();
    return rows.filter((row: AssetInventoryGridRow) =>
      [
        row.asset_number,
        row.category,
        row.asset_name,
        row.location,
        row.model,
        row.status,
        row.operator,
        row.asset_type_name,
        row.site_project_name,
        row.business_unit
      ]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [assetInventoryRowData, searchText]);

  const columnDefs = useMemo<ColumnDef<AssetInventoryGridRow>[]>(
    () => [
      {
        id: 'action',
        header: 'Action',
        size: 150,
        cell: ({ row }) => (
          <button
            className="bg-[#1473e6] text-white border-none rounded-xl px-2.5 py-1 my-0.5 mx-1 text-xs font-bold leading-tight"
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuContext({
                row: row.original,
                x: e.currentTarget.getBoundingClientRect().left,
                y: e.currentTarget.getBoundingClientRect().bottom
              });
            }}
          >
            ↗ Action
          </button>
        )
      },
      {
        id: 'icon',
        header: '',
        size: 95,
        cell: () => (
          <div className="w-[34px] h-[34px] rounded-full bg-[#d6ebf8] text-[#1473e6] flex items-center justify-center text-base">
            ⬡
          </div>
        )
      },
      {
        id: 'asset_number',
        header: 'Asset Number',
        accessorKey: 'asset_number',
        size: 170
      },
      {
        id: 'category',
        header: 'Category',
        size: 220,
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight gap-1">
            <div>{row.original.category}</div>
            <span
              className={`w-fit px-2 py-px rounded-full text-[10px] font-bold ${
                row.original.category_type === 'ASSET'
                  ? 'border border-[#f59e0b] text-[#d97706] bg-[#fffbeb]'
                  : 'border border-[#ec4899] text-[#be185d] bg-[#fdf2f8]'
              }`}
            >
              {row.original.category_type}
            </span>
          </div>
        )
      },
      { id: 'asset_name', header: 'Asset Name', accessorKey: 'asset_name', size: 220 },
      { id: 'location', header: 'Location', accessorKey: 'location', size: 210 },
      { id: 'model', header: 'Model', accessorKey: 'model', size: 150 },
      {
        id: 'meter',
        header: 'Meter',
        size: 150,
        cell: ({ row }) => `${row.original.meter} Hours`
      },
      {
        id: 'status',
        header: 'Status',
        size: 170,
        cell: ({ row }) => {
          const value = row.original.status;
          const isAvailable = value === 'AVAILABLE';
          return (
            <span
              className={`w-fit px-2 py-px my-0.5 rounded-full text-[10px] font-bold leading-tight ${
                isAvailable
                  ? 'border border-[#2f7b44] text-[#2f7b44] bg-[#e9f7df]'
                  : 'border border-[#f59e0b] text-[#d97706] bg-[#ffefc2]'
              }`}
            >
              {value === 'MAINTENANCE' ? 'MAINTENANC...' : value}
            </span>
          );
        }
      },
      { id: 'operator', header: 'Operator', accessorKey: 'operator', size: 140 }
    ],
    []
  );

  return {
    statusData,
    isLoading: isStatusLoading || isGridLoading,
    statusSelected,
    setStatusSelected,
    searchText,
    setSearchText,
    filteredRows,
    columnDefs,
    actionMenuContext,
    setActionMenuContext
  };
};
