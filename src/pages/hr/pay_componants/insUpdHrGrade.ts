import { postFinance } from '../../../api/lookups';

/* ================= TYPES ================= */

export type THrGradeComponent = {
  company_code: string;
  grade_code: string;
  pay_comp_id: string;
  min_pay_amt?: number;
  medium_pay_amt?: number;
  max_pay_amt?: number;
  reimbursement?: string;
  min_reimb_amt?: number;
  max_reimb_amt?: number;
  remarks?: string;
  status?: string;
  user_id?: string;
  user_dt?: string;
  grade_paycomp_amt?: number;
  old_grade_paycomp_amt?: number;
  arrears_posted?: string;
  arrears_amt?: number;
  approved_date?: string;
  approval_status?: string;
  old_min_pay_amt?: number;
  old_medium_pay_amt?: number;
  old_max_pay_amt?: number;
  arrears_percent?: number;
  sort_order?: number;
};

/* ================= SERVICE ================= */

class HrGradeComponentService {
  upsertHrGradeComponentApi = async (params: {
    data: THrGradeComponent[];
    loginid?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!params?.data || !Array.isArray(params.data)) {
        return { success: false, message: 'Detail rows are required' };
      }

      const response = await postFinance('insUpdHrGradeComponent', {
        details: params.data,
        loginid: params.loginid
      });

      return {
        success: response?.success === true,
        message: response?.message
      };
    } catch (error: any) {
      console.error('Error in upsertHrGradeComponentApi:', error);
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

const hrGradeComponentServiceInstance = new HrGradeComponentService();

export default hrGradeComponentServiceInstance;