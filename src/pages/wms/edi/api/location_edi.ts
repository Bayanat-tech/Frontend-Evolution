import { api } from "../../../../api/client";

export type TMsLocationEdi = {
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

export type TMsProductEdi = {
  prin_code: string;
  prod_code: string;
  prod_name: string;
  group_code?: string;
  brand_code?: string;
  length?: number;
  breadth?: number;
  height?: number;
  volume: number;
  gross_wt?: number;
  net_wt?: number;
  p_uom: string;
  l_uom: string;
  uom_count: number;
  upp?: number;
  uppp: number;
  model_number?: string;
  sit_ind?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  company_code: string;
};

export type TTsStnDetailEdi = {
  company_code: string;
  stn_no: number;
  prin_code: string;
  prod_code?: string;
  prod_name?: string;
  site_code?: string;
  job_no?: string;
  pallet_id?: string;
  lot_no_from?: string;
  lot_no_to?: string;
  batch_no_from?: string;
  batch_no_to?: string;
  p_uom?: string;
  l_uom?: string;
  from_site?: string;
  to_site?: string;
  from_loc_start?: string;
  from_loc_end?: string;
  to_loc_start?: string;
  to_loc_end?: string;
  key_number?: string;
  quantity?: number;
  qty_puom?: number;
  qty_luom?: number;
  mfg_date_from?: string | null;
  mfg_date_to?: string | null;
  exp_date_from?: string | null;
  exp_date_to?: string | null;
  user_id?: string;
};

export type TMsSiteEdi = {
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

class EdiService {
  /* ================= BULK SITE UPSERT ================= */

  insUpdMsSiteEdiBlkApi = async (params: {
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
    } catch (error: unknown) {
      const res = extractErrorResponse(error);
      console.error('Full siteAPI Error:', error);
      return res;
    }
  };

  /* ================= BULK STN DETAIL UPSERT ================= */

  insUpdTsStnDetailEdiBlkApi = async (params: {
    rows: TTsStnDetailEdi[];
    loginid?: string;
  }): Promise<BulkApiResponse> => {
    try {
      if (!params?.rows?.length) {
        return {
          success: false,
          message: 'No STN detail records provided'
        };
      }

      const { data } = await api.post<BulkApiResponse>(
        '/api/wms/inbound/insUpdTsStnDetailEdiBulk',
        {
          rows: params.rows,
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

  /* ================= BULK PRODUCT UPSERT ================= */

  insUpdMsProductEdiBlkApi = async (params: {
    products: TMsProductEdi[];
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.products?.length) return false;

      const response = await api.post(
        '/api/wms/inbound/insUpdMsProductEdiBulk',
        {
          products: params.products,
          loginid: params.loginid
        }
      );

      return response.data?.success === true;
    } catch (error: unknown) {
      console.error('Error in insUpdMsProductEdiBulkApi:', (error as { message: string }).message);
      return false;
    }
  };

  /* ================= BULK LOCATION UPSERT ================= */

  insUpdMsLocationEdiBlkApi = async (params: {
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
}

/* ================= EXPORT SINGLETON ================= */
const ediServiceInstance = new EdiService();
export default ediServiceInstance;