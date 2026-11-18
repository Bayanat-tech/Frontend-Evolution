//import { postFinance } from '../../api/lookups';

import { postFinance } from "../../../api/lookups";

/* ================= TYPES ================= */

export type THrPayComponentHeader = {
  company_code?: string;
  pay_comp_id?: string;
  pay_comp_desc?: string;
  pay_comp_short_desc?: string;
  pay_comp_type?: string;
  pay_comp_earn_ded?: string;
  attendance_dependency?: string;
  periodicity?: string;
  taxable?: string;
  round_off_to?: number;
  remarks?: string;
  status?: string;
  user_id?: string;
  user_dt?: Date | string;
  pay_comp_class?: string;
  pay_flag?: string;
  pay_comp_dependent?: string;
  pay_comp_amt?: number;
  type?: string;
  acct_code?: string;
  acct_type?: string;
  sort_order?: number;
  ref_doc_type?: string;
  ref_doc_no?: string;
  leave_paid?: string;
  salary_link?: string;
  div_code?: string;
};

export type THrPayComponentDetail = {
  company_code?: string;
  pay_comp_id?: string;
  pay_comp_id_depend?: string;
  percent?: number;
  remarks?: string;
  status_flag?: string;
  user_id?: string;
  user_dt?: Date | string;
  empr_percent?: number;
};

/* ================= SERVICE ================= */

class HrPayComponentService {
  /**
   * Insert / Update HR Pay Component (Header + Details)
   */
  insUpdHrPayComponent = async (params: {
    header: THrPayComponentHeader;
    details: THrPayComponentDetail[];
    loginid?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!params?.header || !Array.isArray(params?.details)) {
        console.warn('Invalid payload: header/details missing');

        return {
          success: false,
          message: 'Header and details required'
        };
      }

      const response = await postFinance('insUpdHrPayComponent', {
        header: params.header,
        details: params.details,
        loginid: params.loginid
      });

      return {
        success: response?.success === true,
        message: response?.message
      };
    } catch (error: any) {
      console.error('Error in insUpdHrPayComponent:', error);
      console.error('Response data:', error?.response?.data);
      console.error('Status:', error?.response?.status);

      return {
        success: false,
        message: error?.response?.data?.message || error?.message || 'API Error'
      };
    }
  };
}

/* ================= EXPORT SINGLETON ================= */

const hrPayComponentServiceInstance = new HrPayComponentService();

export default hrPayComponentServiceInstance;