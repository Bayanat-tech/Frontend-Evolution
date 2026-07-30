import { useMemo } from "react";
import { api } from "../../api/client";
import { MasterField, MasterPage } from "../../components/ui/MasterPage";
import { getDynamicLookup } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";

const ProductPurchaseSales = () => {
    const { user } = useAuth();

    const fields = useMemo<MasterField[]>(() => [
        // Product Details
        { name: 'prod_code', label: 'Product Code', section: 'Product Details' },
        { name: 'prod_name', label: 'Product Name', section: 'Product Details' },
        { name: 'model_number', label: 'Model Number', section: 'Product Details' },
        { name: 'group_code', label: 'Group Code', section: 'Product Details' },
        { name: 'brand_code', label: 'Brand Code', section: 'Product Details' },
        { name: 'category_code', label: 'Category Code', section: 'Product Details' },
        { name: 'prodtype_code', label: 'Product Type Code', section: 'Product Details' },
        { name: 'season_code', label: 'Season Code', section: 'Product Details' },

        // Barcode and QR code fields
        { name: 'barcode', label: 'Barcode', section: 'Barcode and QR Code' },
        { name:'size_code', label:'Size Code', section:'Barcode and QR Code' },
        { name:'Active', label:'Active', section:'Barcode and QR Code' },
        { name:'co_packing', label:'Co Packing', section:'Barcode and QR Code' },
        { name:'product_stage', label:'Product Stage', section:'Barcode and QR Code' },

        // Unit of Measurement fields
        { name: 'uom_count', label: 'No. of UOMs', section: 'Unit of Measurement' },
        { name: 'p_uom', label: 'Primary UOM', section: 'Unit of Measurement' },
        { name: 'l_uom', label: 'Lower UOM', section: 'Unit of Measurement' },
        { name: 'uppp', label: 'UPPP', section: 'Unit of Measurement' },

        // Division fields
        { name: 'div_code', label: 'Division Code', section: 'Division' },
        { name:'color_code', label:'Color Code', section:'Division' },

        //Weight and Dimensions fields
        { name:'length', label:'Length', section:'Dimensions' },
        { name:'breadth', label:'Breadth', section:'Dimensions' },
        { name:'height', label:'Height', section:'Dimensions' },
        { name:'volume', label:'Volume', section:'Dimensions' },
        { name:'net_wt', label:'Net Weight', section:'Dimensions' },

        // Remarks field
        { name:'remarks', label:'Remarks', section:'Remarks', type: 'textarea', colSpan: 2 },

        // Additional fields
        { name:'manu_code', label:'Manufacturer Code', section:'Additional' },
        { name:'origin_country', label:'Origin Country', section:'Additional' },
        { name:'cost_rate', label:'Cost Rate Unit', section:'Additional' },
        { name:'retail_rate', label:'Retail Price', section:'Additional' },
        { name:'sales_rate', label:'Sales Rate', section:'Additional' },
        { name:'reorder_qty', label:'Reorder Qty', section:'Additional' },
        { name:'alt_prod_code', label:'Alternate Product', section:'Additional' },

        // Tax Component fields
        {name:'tx_compt_1', label:'tax Component 1', section:'Tax Component' },
        {name:'tx_compt_2', label:'tax Component 2', section:'Tax Component' },
        {name:'tx_compt_3', label:'tax Component 3', section:'Tax Component' },
        {name:'tx_compt_4', label:'tax Component 4', section:'Tax Component' },
    ],[])

    const customLoad = async () => {
        const response = await getDynamicLookup({
        parameter: "PURCHASE_SALES_MSE_PRODUCT_DATA_TABLE",
        code1: user?.company_code || "",
        });

        return {
        tableData: Array.isArray(response) ? response : [],
        };
    };

    return(
        <MasterPage
            config={{
            title: "Product",
            subtitle: "Manage Product",
            master: "product",
            keyFields: ["group_code"],
            rowIdSeparator: "_",
            fields: fields,
            fieldsPerRow:4,
            sectionsPerRow:2,
            wide: true,
            customLoad : customLoad,
            customSave: async (form, { editMode, original }) => {
                if (editMode && original) {
                await api.put(`/mse-prod-group/${original.group_code}`, form);
                } else {
                await api.post("/mse-prod-group", form);
                }
            },

            customDelete: async (row) => {
                await api.delete(`/mse-prod-group/${row.group_code}`);
            },
            }}        
      />
    )
}

export default ProductPurchaseSales;