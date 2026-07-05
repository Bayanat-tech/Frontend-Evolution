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
