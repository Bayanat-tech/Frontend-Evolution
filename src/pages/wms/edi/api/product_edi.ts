import { api } from '../../../../api/client';

type ProductEdiBulkResponse = {
    success: boolean;
    message?: string;
    details?: string[];
};

type ProductEdiBulkRow = {
    company_code: string;
    prin_code: string;
    prod_code: string;
    prod_name: string;
    group_code?: string;
    brand_code?: string;
    p_uom: string;
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
    prod_status?: string;
    model_number?: string;
};

class Product {
    insUpdMsProductEdiBlkApi = async (params: {
        loginid?: string;
        products: ProductEdiBulkRow[];
    }): Promise<ProductEdiBulkResponse> => {
        try {
            if (!params?.products?.length) {
                return { success: false, message: 'No Product records provided' };
            }

            const { data } = await api.post<ProductEdiBulkResponse>(
                '/api/wms/inbound/insUpdMsProductEdiBulk',
                {
                    products: params.products,
                    loginid: params.loginid
                }
            );

            return data;
        } catch (error: unknown) {
            const err = error as any;
            return {
                success: false,
                message: err?.response?.data?.message || err?.message || 'Something went wrong',
                details: err?.response?.data?.details || err?.details
            };
        }
    };

    uploadProductEDI = async (values: any[]) => {
        try {
        const response = await api.post('api/wms/gm/product/edi/upload', values);
        if (response.data.success) {
            return response.data.success;
        }
        } catch (error: unknown) {
        const knownError = error as { message: string };
        throw error;
        }
    };

    getProductEDI = async () => {
    try {
        const response = await api.get('api/wms/gm/product/edi');
        return response.data;
    } catch (error: any) {
        throw error;
    }
    };

    clearProductEDI = async () => {
        const response = await api.delete("api/wms/gm/edi/clear");
        return response.data.success;
    };
}

const productServiceInstance = new Product();
export default productServiceInstance;
