import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { getDynamicLookup } from '../../../../../api/lookups';
import { useAuth } from '../../../../../state/AuthContext';

type ApiSectionRow = {
    inspection_form_id: number;
    header_section_id: number;
    header_section_title: string;
    under_section_id: number | null;
    under_section_title: string | null;
    type: string;
    required: string;
    sort_order: number;
    instruction: string | null;
};

export type GridRow =
    | {
          id: string;
          rowType: 'section';
          header_section_id: number;
          header_section_title: string;
      }
    | {
          id: string;
          rowType: 'item';
          inspection_form_id: number;
          header_section_id: number;
          header_section_title: string;
          under_section_id: number;
          under_section_title: string;
          type: string;
          required: string;
          sort_order: number;
          instruction: string | null;
      };

type UseSectionInspectionGridReturn = {
    columnDefs: ColumnDef<GridRow>[];
    rowData: GridRow[];
    isFetching: boolean;
    isError: boolean;
    gridData: ApiSectionRow[];
    toggleSection: (sectionId: number) => void;
    refetch: () => void;
};

type ValidApiSectionRow = Omit<ApiSectionRow, 'under_section_id' | 'under_section_title'> & {
    under_section_id: number;
    under_section_title: string;
};

const getOptionColorClass = (option: string) => {
    const key = option.trim().toUpperCase();
    const colorMap: Record<string, string> = {
        YES: 'bg-[#10b981]',
        NO: 'bg-[#ef4444]',
        NA: 'bg-[#6b7280]',
        PASS: 'bg-[#10b981]',
        FAIL: 'bg-[#ef4444]',
        OK: 'bg-[#10b981]',
        FAULTY: 'bg-[#ef4444]',
        GOOD: 'bg-[#10b981]',
        REPAIR: 'bg-[#f59e0b]',
        REPLACE: 'bg-[#6366f1]'
    };

    return colorMap[key] ?? 'bg-[#0ea5e9]';
};

const getOptionAbbr = (option: string) => {
    const key = option.trim().toUpperCase();
    const labelMap: Record<string, string> = {
        YES: 'Y',
        NO: 'N',
        NA: 'NA',
        PASS: 'P',
        FAIL: 'F',
        OK: 'O',
        FAULTY: 'F',
        GOOD: 'G',
        REPAIR: 'R',
        REPLACE: 'RP'
    };

    return labelMap[key] ?? key.slice(0, 2);
};

const isValidUnderSectionRow = (row: ApiSectionRow): row is ValidApiSectionRow => {
    return (
        row.under_section_id !== null &&
        row.under_section_id !== undefined &&
        String(row.under_section_title ?? '').trim().length > 0
    );
};

export const useSectionInspectionGrid = (
    inspectionFormId: Number | undefined,
    onActionChange?: (action: 'update' | 'delete', rowData: any) => void
): UseSectionInspectionGridReturn => {
    const { user } = useAuth();
    const [collapsedSectionIds, setCollapsedSectionIds] = useState<number[]>([]);
    const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);

    const { data: gridData = [], isFetching, isError, refetch } = useQuery({
        queryKey: ['undersection-inspection-form', user?.loginid, inspectionFormId],
        enabled: !!inspectionFormId,
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'OX_INSPECTION_FORM_UNDER_SECTION_DATA',
                loginid: user?.loginid ?? '',
                number1: inspectionFormId ? Number(inspectionFormId) : undefined
            });

            if (Array.isArray(response)) return response;
            if (response && typeof response === 'object' && Array.isArray((response as any).data)) {
                return (response as any).data;
            }

            return [];
        }
    });

    const groupedSections = useMemo(() => {
        const rows = (gridData || []) as ApiSectionRow[];
        const grouped = new Map<number, { title: string; items: ValidApiSectionRow[] }>();

        rows.forEach((row) => {
            if (!grouped.has(row.header_section_id)) {
                grouped.set(row.header_section_id, {
                    title: row.header_section_title,
                    items: []
                });
            }

            if (isValidUnderSectionRow(row)) {
                grouped.get(row.header_section_id)?.items.push(row);
            }
        });

        return Array.from(grouped.entries()).map(([headerId, group]) => ({
            headerId,
            title: group.title,
            items: [...group.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        }));
    }, [gridData]);

    useEffect(() => {
        setCollapsedSectionIds([]);
        setHasInitializedCollapse(false);
    }, [inspectionFormId]);

    useEffect(() => {
        if (!hasInitializedCollapse && groupedSections.length > 0) {
            setCollapsedSectionIds(groupedSections.map((section) => section.headerId));
            setHasInitializedCollapse(true);
        }
    }, [groupedSections, hasInitializedCollapse]);

    const transformedRows = useMemo(() => {
        const flatRows: GridRow[] = [];

        groupedSections.forEach((section) => {
            flatRows.push({
                id: `section-${section.headerId}`,
                rowType: 'section',
                header_section_id: section.headerId,
                header_section_title: section.title
            });

            if (!collapsedSectionIds.includes(section.headerId)) {
                section.items.forEach((item) => {
                    flatRows.push({
                        id: `item-${item.header_section_id}-${item.under_section_id}`,
                        rowType: 'item',
                        inspection_form_id: item.inspection_form_id,
                        header_section_id: item.header_section_id,
                        header_section_title: item.header_section_title,
                        under_section_id: item.under_section_id,
                        under_section_title: item.under_section_title,
                        type: item.type,
                        required: item.required,
                        sort_order: item.sort_order,
                        instruction: item.instruction
                    });
                });
            }
        });

        return flatRows;
    }, [groupedSections, collapsedSectionIds]);

    const toggleSection = (sectionId: number) => {
        setCollapsedSectionIds((prev) =>
            prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
        );
    };

    const columnDefs = useMemo<ColumnDef<GridRow>[]>(
        () => [
            {
                id: 'sort_order',
                header: 'Sort',
                size: 70,
                cell: ({ row }) => (row.original.rowType === 'section' ? '' : row.original.sort_order ?? '')
            },
            {
                id: 'under_section_title',
                header: 'Section / Question',
                size: 260,
                cell: ({ row }) => {
                    const data = row.original;

                    if (data.rowType === 'section') {
                        const isCollapsed = collapsedSectionIds.includes(data.header_section_id);

                        return (
                            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                                <span className="text-[11px] text-[#4b5563] w-3">{isCollapsed ? '▶' : '▼'}</span>
                                <span>{data.header_section_title}</span>
                            </div>
                        );
                    }

                    return (
                        <div className="flex flex-col gap-0.5 pl-3.5">
                            <div className="text-xs text-[#111827] leading-snug">{data.under_section_title}</div>
                        </div>
                    );
                }
            },
            {
                id: 'type',
                header: 'Type',
                size: 150,
                cell: ({ row }) => {
                    const data = row.original;

                    if (!data || data.rowType === 'section') return '';

                    const currentType = (data.type || '').trim();
                    const upperType = currentType.toUpperCase();

                    if (upperType === 'TEXT FIELD' || upperType === 'NUMBER') {
                        return (
                            <div className="h-6 w-full border border-[#d1d5db] rounded bg-white flex items-center px-2">
                                <span className="text-[11px] text-[#9ca3af]">
                                    {upperType === 'NUMBER' ? '123...' : 'Enter text...'}
                                </span>
                            </div>
                        );
                    }

                    const options = currentType
                        .split('-')
                        .map((opt: string) => opt.trim())
                        .filter(Boolean);

                    return (
                        <div className="flex items-center gap-1.5 flex-wrap py-0.5">
                            {options.map((option: string) => (
                                <div
                                    key={option}
                                    title={option}
                                    className={`w-[22px] h-[22px] rounded text-white text-[9px] font-bold flex items-center justify-center border border-black/[0.08] select-none ${getOptionColorClass(option)}`}
                                >
                                    {getOptionAbbr(option)}
                                </div>
                            ))}
                        </div>
                    );
                }
            },
            {
                id: 'required',
                header: 'Required',
                size: 90,
                cell: ({ row }) => {
                    if (row.original.rowType === 'section') return '';
                    return row.original.required === 'Y' ? 'Yes' : 'No';
                }
            },
            {
                id: 'action',
                header: 'Action',
                size: 120,
                cell: ({ row }) => {
                    const data = row.original;

                    if (!data || data.rowType === 'section') return '';

                    return (
                        <div
                            className="w-full flex justify-start items-center"
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <select
                                className="w-full max-w-[120px] h-7 border border-[#d1d5db] rounded-md bg-white text-[#111827] text-xs px-2 outline-none cursor-pointer focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/20"
                                defaultValue=""
                                onChange={(event) => {
                                    const selectedAction = event.target.value as 'update' | 'delete';
                                    if (selectedAction && onActionChange) {
                                        onActionChange(selectedAction, data);
                                    }
                                    event.target.value = '';
                                }}
                            >
                                <option value="" disabled>
                                    Select
                                </option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                            </select>
                        </div>
                    );
                }
            }
        ],
        [collapsedSectionIds]
    );

    return {
        columnDefs,
        rowData: transformedRows,
        isFetching,
        isError,
        gridData: gridData as ApiSectionRow[],
        toggleSection,
        refetch
    };
};
