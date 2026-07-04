import { api } from "../client";


export type THrSalaryAdvDedHeader = {
  company_code: string;
  doc_type: string;
  doc_no?: number;

  doc_date?: string;
  ref_no?: string;

  name_from?: string;
  addr_from?: string;
  name_to?: string;
  addr_to?: string;
  lettr_subject?: string;

  remarks_1?: string;
  remarks_2?: string;
  remarks_3?: string;

  curr_code?: string;
  ex_rate?: number;
  amount?: number;

  signatory_name?: string;
  signatory_position?: string;

  user_id?: string;
  employee_id?: string;
  employee_code?: string;
  pay_comp_id?: string;

  recover_mth_amt?: number;
  recover_from_dt?: string;

  allocated_amt?: number;
  balance_amt?: number;

  deduct_from_leave?: string;
  deduct_noof_leavedays?: number;

  ref_hdr_lve_slno?: number;
  ref_leave_doc_no?: string;

  doc_status?: string;
  recovery_period?: number;

  sys_gen?: string;
  pay_month?: number;
  pay_year?: number;
};

export type THrSalaryAdvDedDetail = {
  company_code: string;
  doc_type: string;
  doc_no?: number;

  employee_id?: string;
  emplyee_code?: string;

  pay_comp_id?: string;
  recover_mth_amt?: number;
  recover_from_dt?: string;

  amount?: number;
  allocated_amt?: number;
  balance_amt?: number;

  deduct_from_leave?: string;
  deduct_noof_leavedays?: number;

  ref_leave_doc_no?: string;
  ref_hdr_lve_slno?: number;

  pay_month?: number;
  pay_year?: number;

  last_updated_by?: string;
  sys_gen?: string;
};

class HrSalaryAdvDedService {
  upsertHrSalaryAdvDed = async (params: {
    header: THrSalaryAdvDedHeader;
    details: THrSalaryAdvDedDetail[];
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params.header?.company_code || !params.header?.doc_type) {
        console.warn('Missing required header fields');
        return false;
      }

      if (!Array.isArray(params.details) || params.details.length === 0) {
        console.warn('Details are required');
        return false;
      }

      const response = await api.post('api/finance/insUpdHrSalaryAdvDed', {
        header: {
          ...params.header,
          loginid: params.loginid ?? null
        },
        details: params.details
      });

      return response.data?.success === true;
    } catch (error: any) {
      console.error('Error in upsertHrSalaryAdvDed:', error);
      console.error('Response:', error?.response?.data);
      console.error('Status:', error?.response?.status);
      return false;
    }
  };
}

const hrSalaryAdvDedServiceInstance = new HrSalaryAdvDedService();
export default hrSalaryAdvDedServiceInstance;
