import StatusComponent from './common_component/StatusComponent';
import { useAssetInventoryGrid } from './hooks/useAssetInventoryGrid';
import { CSSProperties, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, DialogActions, DialogContent, Menu, MenuItem } from '../../../components/mms_ui'
import AddAssetInventoryPage, { AssetInventoryFormValues } from './AddAssetInventoryPage';
import { useFormik } from 'formik';
import { delAssetInventory, inUpdAssetInventory } from './api/asset_inventory';
import { assetInventorySizeConfig, assetInventorySizeCssVars } from './config/assetInventorySizeConfig';
import { useAuth } from '../../../state/AuthContext';
import { DataTable } from '../../../components/ui/DataTable';

export default function AssetInventoryMainPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [addAssetDialogOpen, setAddAssetDialogOpen] = useState({
        open: false,
        title: ''
    });
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetRow, setDeleteTargetRow] = useState<any>(null);

    const toDateInputValue = (value: any): string | null => {
        if (!value) return null;

        // already yyyy-mm-dd
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
    };

    const getInitialValues = (): AssetInventoryFormValues => {
        if (selectedRow) {
            return {
                basicInfo: {
                    asset_type: selectedRow.asset_type ? String(selectedRow.asset_type) : (selectedRow.asset_type_name || null),
                    asset_number: selectedRow.asset_number || '',
                    asset_name: selectedRow.asset_name || '',
                    asset_category: selectedRow.asset_category || selectedRow.category || '',
                    model_make: selectedRow.model_make || selectedRow.model || '',
                    running_hours: selectedRow.running_hours ?? selectedRow.meter ?? null,
                    running_hours_unit: selectedRow.running_hours_unit || null,
                    status: selectedRow.status_code ? String(selectedRow.status_code) : (selectedRow.status || null),
                    inventory: selectedRow.inventory !== undefined && selectedRow.inventory !== null && selectedRow.inventory !== ''
                        ? Number(selectedRow.inventory)
                        : null,
                    asset_uitilization_goal: null,
                },
                maintenanceInfo: {
                    year: null,
                    manufacture: selectedRow.manufacture || '',
                    last_maintenance_reading: null,
                    last_maintenance_date: toDateInputValue(selectedRow.last_maintenance_date),
                    chassis_number: selectedRow.chassis_number || '',
                    license_plate: selectedRow.license_plate || '',
                    registration_state: selectedRow.registration_state || '',
                    registration_exp_date: toDateInputValue(selectedRow.registration_exp_date),
                },
                financialInfo: {
                    site_project: selectedRow.site_project ? String(selectedRow.site_project) : (selectedRow.site_project_name || null),
                    business_unit: selectedRow.business_unit || '',
                    asset_value: selectedRow.asset_value ?? null,
                    purchase_date: toDateInputValue(selectedRow.purchase_date),
                    warranty_date: toDateInputValue(selectedRow.warranty_date),
                    required_geo_location_while_inspection:
                        selectedRow.required_geo_location_while_inspection === true ||
                        String(selectedRow.required_geo_location_while_inspection || '').toUpperCase() === 'Y' ||
                        String(selectedRow.geo_location || '').toUpperCase() === 'Y',
                    assign_inspection_form: Array.isArray(selectedRow.inspection_form_ids)
                        ? selectedRow.inspection_form_ids.map((id: any) => String(id))
                        : [],
                },
                operationalInfo: {
                    operator_name: selectedRow.operator_name || selectedRow.operator || '',
                    maintenance_priority: selectedRow.maintenance_priority || '',
                    ownership_mode: selectedRow.ownership_mode || '',
                    asset_note: selectedRow.asset_note || '',
                    asset_image_url_path: selectedRow.asset_image_url_path || '',
                    sensor_enabled: selectedRow.sensor_enabled || '',
                    device_id: selectedRow.device_id || '',
                    sensor_asset_id: selectedRow.sensor_asset_id || '',
                }
            };
        }
        return {
            basicInfo: {
                asset_type: null,
                asset_number: '',
                asset_name: '',
                asset_category: '',
                model_make: '',
                running_hours: null,
                running_hours_unit: null,
                status: null,
                inventory: null,
                asset_uitilization_goal: null,
            },
            maintenanceInfo: {
                year: null,
                manufacture: '',
                last_maintenance_reading: null,
                last_maintenance_date: null,
                chassis_number: '',
                license_plate: '',
                registration_state: '',
                registration_exp_date: null,
            },
            financialInfo: {
                site_project: null,
                business_unit: '',
                asset_value: null,
                purchase_date: null,
                warranty_date: null,
                required_geo_location_while_inspection: false,
                assign_inspection_form: [],
            },
            operationalInfo: {
                operator_name: '',
                maintenance_priority: '',
                ownership_mode: '',
                asset_note: '',
                asset_image_url_path: '',
                sensor_enabled: '',
                device_id: '',
                sensor_asset_id: '',
            }
        };
    };

    // FIX: memoize so this object is only rebuilt when selectedRow actually
    // changes, instead of on every single render (which was feeding Formik
    // a brand-new object each time and could cascade into extra re-renders
    // whenever any state on the page changed, e.g. clicking a status card).
    const initialFormValues = useMemo(() => getInitialValues(), [selectedRow]);

    const formik = useFormik<AssetInventoryFormValues>({
        initialValues: initialFormValues,
        enableReinitialize: true,
        onSubmit: async (values, helpers) => {
            const payload = {
                asset_id: selectedRow?.asset_id,
                ...values.basicInfo,
                ...values.maintenanceInfo,
                ...values.financialInfo,
                ...values.operationalInfo
            };
            console.log('Submitting Asset Inventory Form with payload:', payload);

            await inUpdAssetInventory(payload, user?.loginid ?? '');
            await queryClient.invalidateQueries({ queryKey: ['status_based_total_count'] });
            await queryClient.invalidateQueries({ queryKey: ['asset_inventory_rows'] });
            helpers.resetForm();
            helpers.setSubmitting(false);
            setSelectedRow(null);
            setAddAssetDialogOpen({ open: false, title: '' });
        }
    });
    const {
        statusData,
        isLoading,
        statusSelected,
        setStatusSelected,
        searchText,
        setSearchText,
        filteredRows,
        columnDefs,
        actionMenuContext,
        setActionMenuContext
    } = useAssetInventoryGrid();

    const handleMenuClose = () => {
        setActionMenuContext(null);
    };

    const handleUpdate = () => {
        if (actionMenuContext?.row) {
            setSelectedRow(actionMenuContext.row);
            setAddAssetDialogOpen({ open: true, title: 'Update Asset' });
            handleMenuClose();
        }
    };

    const handleDelete = () => {
        if (actionMenuContext?.row) {
            const rowAssetId = Number(actionMenuContext.row.asset_id);
            if (!rowAssetId || Number.isNaN(rowAssetId)) {
                handleMenuClose();
                return;
            }

            setDeleteTargetRow(actionMenuContext.row);
            setDeleteConfirmOpen(true);
            handleMenuClose();
        }
    };

    const handleDeleteConfirm = async () => {
        const rowAssetId = Number(deleteTargetRow?.asset_id);
        if (!rowAssetId || Number.isNaN(rowAssetId)) {
            setDeleteConfirmOpen(false);
            setDeleteTargetRow(null);
            return;
        }

        await delAssetInventory(rowAssetId, user?.loginid ?? '');
        await queryClient.invalidateQueries({ queryKey: ['asset_inventory_rows'] });
        await queryClient.invalidateQueries({ queryKey: ['status_based_total_count'] });
        setDeleteConfirmOpen(false);
        setDeleteTargetRow(null);
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
        setDeleteTargetRow(null);
    };

    // A DOMRect-shaped stand-in so the shared Menu primitive (which only reads
    // .left/.bottom) can be positioned at the exact x/y captured when the row
    // "Action" button was clicked.
    const actionMenuAnchorRect = actionMenuContext
        ? ({ left: actionMenuContext.x, bottom: actionMenuContext.y, top: actionMenuContext.y, right: actionMenuContext.x } as DOMRect)
        : null;

    return (
        <div className="asset-inventory-size-root" style={assetInventorySizeCssVars as CSSProperties}>
            <div className="font-bold mb-3" style={{ fontSize: assetInventorySizeConfig.pageTitleFontSize }}>
                Asset Inventory {statusSelected ? `- ${statusSelected}` : ''}
            </div>

            {isLoading && (
                <div className="text-center text-gray-500 py-10 w-full h-screen flex items-center justify-center">
                   <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
            )}

            <div className="flex gap-6 flex-wrap">
                {statusData && statusData.map((item: any, index: number) => (
                    <button 
                        key={index} 
                        className="hover:pointer hover:scale-110 transition-transform"
                        onClick={() => setStatusSelected(item.status_name)}
                    >
                        <StatusComponent
                            key={index}
                            header={item.status_name || item.status_code || 'Status'}
                            icon={<i className="fas fa-car"></i>}
                            total_count={item.asset_count}
                            description={item.description}
                        />
                    </button>
                ))}
            </div>

            {statusData && (
                <>
                    <div className="flex justify-between items-center gap-2 flex-wrap mt-4">
                        <div className="flex items-center gap-2">
                            <button
                                className="h-8 rounded-[10px] px-3 font-bold text-[13px] border border-transparent bg-[#1473e6] text-white"
                                onClick={() => {
                                    setSelectedRow(null);
                                    setAddAssetDialogOpen({ open: true, title: 'Add New Asset' });
                                }}
                            >
                                + Add New Asset
                            </button>
                        </div>
                    </div>

                    {/* DataTable owns its own search box, column filters, sorting and
                        pagination, so the previous hand-rolled search input/table/
                        sort-icon/hamburger controls are replaced by these props. */}
                    <div className="mt-4">
                        <DataTable
                            columns={columnDefs}
                            data={filteredRows}
                            loading={isLoading}
                            searchValue={searchText}
                            onSearchChange={setSearchText}
                            searchPlaceholder="Search"
                            emptyText="No assets found"
                            // height={assetInventorySizeConfig.grid.tableHeight ?? 590}
                            enablePagination
                            pageSize={100}
                        />
                    </div>

                    <Menu open={Boolean(actionMenuContext)} anchorRect={actionMenuAnchorRect} onClose={handleMenuClose}>
                        <MenuItem onClick={handleUpdate} className="text-[0.95rem] font-medium">
                            ✎ Update
                        </MenuItem>
                        <MenuItem onClick={handleDelete} className="text-[0.95rem] font-medium text-[#d32f2f]">
                            🗑 Delete
                        </MenuItem>
                    </Menu>
                </>
            )}

            <Dialog
                open={addAssetDialogOpen.open}
                onClose={() => {
                    setAddAssetDialogOpen({ open: false, title: '' });
                    setSelectedRow(null);
                    formik.resetForm();
                }}
                fullWidth
                maxWidth="md"
                paperClassName="overflow-hidden"
            >
                <div
                    className="flex items-center gap-2.5 border-b border-[#2aa160] font-bold text-[#223246]"
                    style={{ padding: assetInventorySizeConfig.dialog.headerPadding, fontSize: assetInventorySizeConfig.dialog.headerFontSize }}
                >
                    <span className="text-[#2aa160] text-[1.2rem]">✔</span>
                    {addAssetDialogOpen.title}
                </div>

                <DialogContent className="p-0">
                    <AddAssetInventoryPage formik={formik} />
                </DialogContent>

                <DialogActions className="px-4 py-3">
                    <Button
                        type="submit"
                        form="asset-inventory-form"
                        disabled={formik.isSubmitting}
                        className="normal-case font-bold bg-[#0a6ed1] text-white"
                        style={{ fontSize: assetInventorySizeConfig.dialog.actionButtonFontSize }}
                    >
                        Save
                    </Button>
                    <Button
                        onClick={() => {
                            setAddAssetDialogOpen({ open: false, title: '' });
                            formik.resetForm();
                        }}
                        className="normal-case font-bold border border-[#c8d3df] text-[#243447] bg-white"
                        style={{ fontSize: assetInventorySizeConfig.dialog.actionButtonFontSize }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deleteConfirmOpen} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
                <DialogContent className="pt-4">
                    Are you sure you want to delete asset &quot;{deleteTargetRow?.asset_name || ''}&quot;?
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleDeleteCancel}
                        className="normal-case font-bold border border-[#c8d3df] text-[#243447] bg-white"
                        style={{ fontSize: assetInventorySizeConfig.dialog.actionButtonFontSize }}
                    >
                        No
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        className="normal-case font-bold bg-[#d32f2f] text-white"
                        style={{ fontSize: assetInventorySizeConfig.dialog.actionButtonFontSize }}
                    >
                        Yes, Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}