import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '../../../../state/AuthContext';
import { getDynamicLookup } from '../../../../api/lookups';

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

type ValidApiSectionRow = Omit<ApiSectionRow, 'under_section_id' | 'under_section_title'> & {
    under_section_id: number;
    under_section_title: string;
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

/* ─── colour / label helpers ─── */
const getOptionColorClass = (option: string) => {
    const key = option.trim().toUpperCase();
    const colorMap: Record<string, string> = {
        YES: 'type-opt-yes',
        NO: 'type-opt-no',
        NA: 'type-opt-na',
        PASS: 'type-opt-pass',
        FAIL: 'type-opt-fail',
        OK: 'type-opt-ok',
        FAULTY: 'type-opt-faulty',
        GOOD: 'type-opt-good',
        REPAIR: 'type-opt-repair',
        REPLACE: 'type-opt-replace',
    };
    return colorMap[key] ?? 'type-opt-default';
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
        REPLACE: 'RP',
    };
    return labelMap[key] ?? key.slice(0, 2);
};

const isValidUnderSectionRow = (row: ApiSectionRow): row is ValidApiSectionRow =>
    row.under_section_id !== null &&
    row.under_section_id !== undefined &&
    String(row.under_section_title ?? '').trim().length > 0;

/* ─── hook ─── */
export const useSectionInspectionGrid = (
    inspectionFormId: number | undefined,
    onActionChange?: (action: 'update' | 'delete', rowData: GridRow) => void
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
                number1: inspectionFormId ? Number(inspectionFormId) : undefined,
            });
            if (Array.isArray(response)) return response;
            if (response && typeof response === 'object' && Array.isArray((response as any).data))
                return (response as any).data;
            return [];
        },
    });

    /* group by header section */
    const groupedSections = useMemo(() => {
        const rows = (gridData || []) as ApiSectionRow[];
        const grouped = new Map<number, { title: string; items: ValidApiSectionRow[] }>();

        rows.forEach((row) => {
            if (!grouped.has(row.header_section_id)) {
                grouped.set(row.header_section_id, { title: row.header_section_title, items: [] });
            }
            if (isValidUnderSectionRow(row)) {
                grouped.get(row.header_section_id)?.items.push(row);
            }
        });

        return Array.from(grouped.entries()).map(([headerId, group]) => ({
            headerId,
            title: group.title,
            items: [...group.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }));
    }, [gridData]);

    /* reset collapse state when form changes */
    useEffect(() => {
        setCollapsedSectionIds([]);
        setHasInitializedCollapse(false);
    }, [inspectionFormId]);

    useEffect(() => {
        if (!hasInitializedCollapse && groupedSections.length > 0) {
            setCollapsedSectionIds(groupedSections.map((s) => s.headerId));
            setHasInitializedCollapse(true);
        }
    }, [groupedSections, hasInitializedCollapse]);

    /* build flat row list respecting collapse */
    const transformedRows = useMemo<GridRow[]>(() => {
        const flat: GridRow[] = [];
        groupedSections.forEach((section) => {
            flat.push({
                id: `section-${section.headerId}`,
                rowType: 'section',
                header_section_id: section.headerId,
                header_section_title: section.title,
            });
            if (!collapsedSectionIds.includes(section.headerId)) {
                section.items.forEach((item) => {
                    flat.push({
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
                        instruction: item.instruction,
                    });
                });
            }
        });
        return flat;
    }, [groupedSections, collapsedSectionIds]);

    const toggleSection = (sectionId: number) =>
        setCollapsedSectionIds((prev) =>
            prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
        );

    /* ── TanStack Table ColumnDef array ── */
    const columnDefs = useMemo<ColumnDef<GridRow>[]>(
        () => [
            {
                id: 'sort_order',
                header: 'Sort',
                size: 60,
                enableColumnFilter: false,
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.rowType === 'section' ? null : (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#6b7280', fontSize: 12 }}>
                            {(row.original as any).sort_order ?? ''}
                        </span>
                    ),
            },
            {
                id: 'section_question',
                header: 'Section / Question',
                enableColumnFilter: false,
                enableSorting: false,
                cell: ({ row }) => {
                    const data = row.original;
                    if (data.rowType === 'section') {
                        const isCollapsed = collapsedSectionIds.includes(data.header_section_id);
                        return (
                            <div
                                className="inspection-section-header"
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleSection(data.header_section_id)}
                            >
                                <span className="section-accordion-icon">{isCollapsed ? '▶' : '▼'}</span>
                                <span>{data.header_section_title}</span>
                            </div>
                        );
                    }
                    return (
                        <div className="inspection-item-wrap">
                            <div className="inspection-item-title">{data.under_section_title}</div>
                            {data.instruction ? (
                                <div className="inspection-item-instruction">{data.instruction}</div>
                            ) : null}
                        </div>
                    );
                },
            },
            {
                id: 'type',
                header: 'Type',
                size: 160,
                enableColumnFilter: false,
                enableSorting: false,
                cell: ({ row }) => {
                    const data = row.original;
                    if (data.rowType === 'section') return null;

                    const currentType = (data.type || '').trim();
                    const upperType = currentType.toUpperCase();

                    if (upperType === 'TEXT FIELD' || upperType === 'NUMBER') {
                        return (
                            <div className="type-input-preview">
                                <span className="type-input-placeholder">
                                    {upperType === 'NUMBER' ? '123...' : 'Enter text...'}
                                </span>
                            </div>
                        );
                    }

                    const options = currentType
                        .split('-')
                        .map((o: string) => o.trim())
                        .filter(Boolean);

                    return (
                        <div className="type-options-wrap">
                            {options.map((option: string) => (
                                <div
                                    key={option}
                                    className={`type-option-box ${getOptionColorClass(option)}`}
                                    title={option}
                                >
                                    {getOptionAbbr(option)}
                                </div>
                            ))}
                        </div>
                    );
                },
            },
            {
                id: 'required',
                header: 'Required',
                size: 90,
                enableColumnFilter: false,
                enableSorting: false,
                cell: ({ row }) => {
                    const data = row.original;
                    if (data.rowType === 'section') return null;
                    const isRequired = data.required === 'Y';
                    return (
                        <span
                            style={{
                                display: 'inline-block',
                                borderRadius: 999,
                                padding: '2px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                background: isRequired ? '#dcfce7' : '#f3f4f6',
                                color: isRequired ? '#16a34a' : '#6b7280',
                            }}
                        >
                            {isRequired ? 'Yes' : 'No'}
                        </span>
                    );
                },
            },
            {
                id: 'action',
                header: 'Action',
                size: 110,
                enableColumnFilter: false,
                enableSorting: false,
                cell: ({ row }) => {
                    const data = row.original;
                    if (data.rowType === 'section') return null;
                    return (
                        <div
                            className="inspection-action-wrap"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <select
                                className="inspection-action-select"
                                defaultValue=""
                                onChange={(e) => {
                                    const action = e.target.value as 'update' | 'delete';
                                    if (action && onActionChange) onActionChange(action, data);
                                    e.target.value = '';
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
                },
            },
        ],
        [collapsedSectionIds, onActionChange]
    );

    return {
        columnDefs,
        rowData: transformedRows,
        isFetching,
        isError,
        gridData: gridData as ApiSectionRow[],
        toggleSection,
        refetch,
    };
};