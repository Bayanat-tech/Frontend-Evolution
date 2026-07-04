import { api } from '../../../../api/client';


class Product {
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

    insUpdMsProductEdiBlkApi = async (params: { products: any[]; loginid?: string }) => {
        try {
            if (!params?.products?.length) {
                return {
                    success: false,
                    message: 'No product records provided'
                };
            }

            const response = await api.post('/api/wms/inbound/insUpdMsProductEdiBulk', {
                products: params.products,
                loginid: params.loginid
            });

            return {
                success: response.data?.success === true,
                message: response.data?.message || 'Products uploaded to EDI'
            };
        } catch (error: any) {
            return {
                success: false,
                message: error?.message || 'Something went wrong while uploading products'
            };
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
