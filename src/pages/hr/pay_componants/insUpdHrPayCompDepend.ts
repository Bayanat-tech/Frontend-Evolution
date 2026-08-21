import { postFinance } from '../../../api/lookups';

/* ================= TYPES ================= */
export type THrPayCompDependHeader = {
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

export type THrPayCompDependDetail = {
  company_code?: string;
  pay_comp_id?: string;
  pay_comp_id_depend?: string;
  nationality?: string;
  age?: number;
  status?: string;
  user_id?: string;
  user_dt?: Date | string;
  remarks?: string;
  amt_limit?: number;
};

/* ================= SERVICE ================= */
class HrPayCompDependService {
  /**
   * Insert / Update HR Pay Component Dependency
   */
  insUpdHrPayCompDepend = async (params: {
    header: THrPayCompDependHeader[];
    details: THrPayCompDependDetail[];
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!Array.isArray(params.header) || params.header.length === 0 || !Array.isArray(params.details)) {
        return { success: false, message: 'Invalid header or details.' };
      }

      /* Normalize dates before sending */
      const normalizeDate = (dt: any) => (dt ? new Date(dt).toISOString() : null);

      const headerPayload = params.header.map((h) => ({
        ...h,
        user_dt: normalizeDate(h.user_dt)
      }));

      const detailsPayload = params.details.map((d) => ({
        ...d,
        user_dt: normalizeDate(d.user_dt)
      }));

      const response = await postFinance('insUpdHrPayCompDepend', {
        header: headerPayload,
        details: detailsPayload
      });

      return {
        success: response?.success === true,
        message: response?.message
      };
    } catch (error: any) {
      console.error('Error in insUpdHrPayCompDepend:', error);
      console.error('Response data:', error?.response?.data);
      console.error('Status:', error?.response?.status);

      const apiMessage = error?.response?.data?.message || error?.response?.data?.Message || error?.message || 'Something went wrong';

      return { success: false, message: apiMessage };
    }
  };
}

/* ================= EXPORT SINGLETON ================= */
const hrPayCompDependServiceInstance = new HrPayCompDependService();
export default hrPayCompDependServiceInstance;