import { api } from './client';

export type TMsPrincipal = {
  company_code: string;
  prin_code: string;
  prin_name: string;

  prin_addr1?: string;
  prin_addr2?: string;
  prin_addr3?: string;
  prin_addr4?: string;
  prin_city?: string;

  tax_country_code?: string;
  tax_country_sn?: string;

  salesman_code?: string;
  sector_code?: string;

  prin_email1?: string;
  prin_email2?: string;
  prin_email3?: string;

  prin_telno1?: string;
  prin_telno2?: string;
  prin_telno3?: string;

  prin_faxno1?: string;
  prin_faxno2?: string;
  prin_faxno3?: string;

  prin_ref1?: string;
  prin_status?: string;

  acc_email?: string;

  prin_dept_code?: string;
  prin_acref?: string;

  trn_no?: string;
  trn_exp_date?: Date | string | null;

  prin_invdate?: Date | string | null;

  curr_code?: string;

  prin_backdt?: number;

  prin_infze?: string;

  credit_limit?: number;
  creditdays?: number;
  creditdays_freight?: number;

  prin_lic_no?: string;
  prin_lic_type?: string;

  comm_reg_no?: string;
  comm_reg_exp_date?: Date | string | null;

  prin_imp_code?: string;

  parent_prin_code?: string;

  prin_cont_email1?: string;
  prin_cont_email2?: string;
  prin_cont_email3?: string;

  prin_cont_telno1?: string;
  prin_cont_telno2?: string;
  prin_cont_telno3?: string;

  prin_cont_faxno1?: string;
  prin_cont_faxno2?: string;
  prin_cont_faxno3?: string;

  prin_cont_ref1?: string;

  pick_wave?: string;
  pick_wave_qty_sort?: string;
  pick_wave_ign_min_exp?: string;

  pref_site?: string;

  pref_loc_from?: string;
  pref_loc_to?: string;

  pref_aisle_from?: string;
  pref_aisle_to?: string;

  pref_col_from?: number;
  pref_col_to?: number;

  pref_ht_from?: number;
  pref_ht_to?: number;

  prin_siteind?: string;

  service_date?: Date | string | null;

  storage_type?: string;

  default_foc?: string;

  under_value?: string;
  auto_insert_billactivity?: string;
  prin_charge?: string;
  prin_pricechk?: string;
  prin_landedpr?: string;
  auto_job?: string;
  validate_lotno?: string;
  storage_productwise?: string;

  validate_expdate?: Date | string | null;

  minperiod_exppick?: number;
  rcpt_exp_limit?: number;

  perpectual_confirm_allow?: string;

  automate_activity?: string;

  updated_at?: Date | string | null;
  updated_by?: string;

  created_by?: string;
  created_at?: Date | string | null;

  country_code?: string;

  territory_code?: string;

  dir_shpmnt?: string;

  prin_contact1?: string;
  prin_contact2?: string;
  prin_contact3?: string;

  prin_grnno?: number;

  prin_license?: string;

  div_code?: string;

  backorder_pick?: string;

  box_no?: string;

  auto_generate_product_code?: string;

  storage_slab_bill?: string;

  free_storage?: string;

  displ_siteind_faltarea?: string;

  qty_as_wt?: string;

  inb_jobwise_bill?: string;
};

class msPrincipalService {
  upsertMsPrincipalApi = async (params: {
    data: TMsPrincipal;
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.data) return false;

      const response = await api.post(
        'api/wms/inbound/upsertMsPrincipal',
        {
          ...params.data,
          loginid: params.loginid
        }
      );

      return response.data?.success === true;

    } catch (error: any) {

      console.error('Error in upsertMsPrincipalApi:', error);
      console.error('Response data:', error?.response?.data);
      console.error('Status:', error?.response?.status);

      return false;
    }
  };
}

/* ================= EXPORT SINGLETON ================= */

const msPrincipalServiceInstance = new msPrincipalService();

export default msPrincipalServiceInstance;
