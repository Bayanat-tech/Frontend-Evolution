import { api } from "./client";

type TMsSiteEdi = {
  site_code: string;
  site_ind: string;
  site_type?: string;
  site_name: string;
  site_addr1?: string;
  site_addr2?: string;
  site_addr3?: string;
  site_addr4?: string;
  city?: string;
  country_code?: string;
  contact_name?: string;
  tel_no?: string;
  charge_ind?: string;
  prin_code?: string;
  group_code?: string;
  loc_type?: string;
  company_code: string;
  div_code?: string;
  site_rpt_name?: string;
};

type TMsLocationEdi = {
  company_code: string;
  site_code: string;
  location_code: string;
  loc_desc?: string;
  loc_type?: string;
  loc_stat?: string;
  aisle: string;
  column_no: number;
  height: number;
  blockcyc?: string;
};

type BulkApiResponse = {
  success: boolean;
  message?: string;
  details?: string[];
};

function extractErrorResponse(error: unknown): BulkApiResponse {
  const err = error as any;

  const apiMessage =
    err?.response?.data?.message ||
    err?.response?.data?.Message ||
    err?.message ||
    'Something went wrong';

  const apiDetails =
    err?.response?.data?.details ??
    err?.response?.data?.Details ??
    err?.details ??
    err?.data?.details ??
    '';

  return {
    success: false,
    message: apiMessage,
    details: apiDetails
  };
}

export const insUpdMsSiteEdiBlkApi = async (params: {
    sites: TMsSiteEdi[];
    loginid?: string;
    }): Promise<BulkApiResponse> => {
    try {
        if (!params?.sites?.length) {
        return {
            success: false,
            message: 'No Site records provided'
        };
        }

        const { data } = await api.post<BulkApiResponse>(
        '/api/wms/inbound/insUpdMsSiteEdiBulk',
        {
            sites: params.sites,
            loginid: params.loginid
        }
        );

        return data;
    } 
    catch (error: unknown) {
        const res = extractErrorResponse(error);
        console.error('Full siteAPI Error:', error);
        return res;
    }
};

export const insUpdMsLocationEdiBlkApi = async (params: {
    locations?: TMsLocationEdi[];
    loginid?: string;
    }): Promise<BulkApiResponse> => {
    try {
        if (!params?.locations?.length) {
        return {
            success: false,
            message: 'No Location records provided'
        };
        }

        const { data } = await api.post<BulkApiResponse>(
        '/api/wms/inbound/insUpdMsLocationEdiBulk',
        {
            locations: params.locations,
            loginid: params.loginid
        }
        );

        return data;
    } catch (error: unknown) {
        const res = extractErrorResponse(error);
        console.error('Full API Error:', error);
        return res;
    }
};

export const uploadProductEDI = async (values: any[]) => {
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

export const getProductEDI = async () => {
try {
    const response = await api.get('api/wms/gm/product/edi');
    return response.data;
} catch (error: any) {
    throw error;
}
};

export const clearProductEDI = async () => {
    const response = await api.delete("api/wms/gm/edi/clear");
    return response.data.success;
};