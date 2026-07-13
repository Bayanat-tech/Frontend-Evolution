import { api } from "../../api/client";

export type TGradeComponentPayload = {
  company_code?: string;
  grade_code?: string;
  pay_comp_id?: string;
  min_pay_amt?: number;
  medium_pay_amt?: number;
  max_pay_amt?: number;
  reimbursement?: string;
  min_reimb_amt?: number;
  max_reimb_amt?: number;
  remarks?: string;
  status?: string;
  approved_date?: string | null;
  approval_status?: string;
  sort_order?: number;
};

export type TGradeHeaderPayload = {
  company_code: string;
  grade_code?: string;
  grade_name: string;
  grade_short_name?: string;
  ot_eligibility?: string;
  grade_status?: string;
  airfare_entitlement?: string;
  spouse_af_entitlement?: string;
  dep_af_entitlement?: string;
  medical_entitlement?: string;
  spouse_med_entitlement?: string;
  dep_med_entitlement?: string;
  remarks?: string;
  status?: string;
  user_id?: string;
  user_dt?: string;
};

const ENDPOINT = "/api/finance/insUpdHrGrade";

class HrGradeService {
  async upsertHrGradeApi(params: {
    header: TGradeHeaderPayload;
    details: TGradeComponentPayload[];
    loginid: string;
  }): Promise<{ success: boolean; grade_code?: string; message?: string }> {
    const response = await api.post(ENDPOINT, {
      header: params.header,
      details: params.details,
    });
    const body = response.data ?? {};
    return {
      success: Boolean(body.success),
      grade_code: body.data?.grade_code,
      message: body.message,
    };
  }
}

const hrGradeServiceInstance = new HrGradeService();
export default hrGradeServiceInstance;