import { postFinance } from "../../api/lookups";

export type THrIntEvalForm = {
  company_code: string;
  doc_type: string;
  doc_no?: number;
  doc_ref_no?: string;
  cand_no?: string;
  cand_name?: string;
  pos_appl_for?: string;
  dept?: string;
  intvr_name?: string;
  intrvw_date?: string | null;
  hire_flag?: string;
  spec_job_skill?: string;
  rel_job_exp?: string;
  rel_edu_training?: string;
  initiative?: string;
  comm_skills?: string;
  attitude?: string;
  interest_comp_pos?: string;
  pos_points?: string;
  neg_points?: string;
  obs_comment?: string;
  sign_4?: string;
  user_id?: string;
  user_dt?: string | null;
  doc_date?: string | null;
};

class hrIntEvalFormService {
  upsertHrIntEvalFormApi = async (params: {
    data: THrIntEvalForm;
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.data) return false;
      await postFinance("upsertHrIntEvalForm", {
        ...params.data,
        loginid: params.loginid,
      });
      return true;
    } catch (error) {
      console.error("Error in upsertHrIntEvalFormApi:", error);
      return false;
    }
  };
}

const hrIntEvalFormServiceInstance = new hrIntEvalFormService();
export default hrIntEvalFormServiceInstance;