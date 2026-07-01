import { postFinance } from "../../api/lookups";

// ── Types ─────────────────────────────────────────────────────────────────────

export type THrEmpEducationDetail = {
  employee_id: string;
  edu_desc_code: string;
  edu_level_code: string;
  start_date: string;
  end_date?: string | null;
  year_of_passing: number;
  studied_at: string;
  course_description?: string;
  remarks?: string;
  user_id: string;
  user_dt?: string;
  status_flag?: string;
  company_code?: string;
  edu_distinction?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

class HrEmpEducationService {
  upsertHrEmpEducationApi = async (params: {
    company_code: string;
    education_details: THrEmpEducationDetail[];
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.company_code) return false;
      if (!params?.education_details || !Array.isArray(params.education_details)) return false;

      await postFinance("upsertHrEmpEducation", {
        company_code: params.company_code,
        education_details: params.education_details,
        loginid: params.loginid,
      });

      return true;
    } catch (error) {
      console.error("Error in upsertHrEmpEducationApi:", error);
      return false;
    }
  };
}

// ── Export singleton ──────────────────────────────────────────────────────────

const hrEmpEducationServiceInstance = new HrEmpEducationService();
export default hrEmpEducationServiceInstance;