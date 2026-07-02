import { postFinance } from "../../api/lookups";

// ── Types ─────────────────────────────────────────────────────────────────────

export type THrJoinHeader = {
  company_code?: string;
  doc_type?: string;
  doc_no?: number;
  doc_ref_no?: string;
  cand_no?: string;
  cand_name?: string;
  basic_sal?: number;
  desig?: string;
  hra?: number;
  join_date?: string;
  fa?: number;
  division?: string;
  ta?: number;
  bank?: string;
  branch?: string;
  tele_allow?: number;
  bank_acct_number?: string;
  gross_sal?: number;
  sign_1?: string;
  date_1?: string;
  sign_2?: string;
  date_2?: string;
  sign_3?: string;
  date_3?: string;
  sign_4?: string;
  date_4?: string;
  user_id?: string;
  user_dt?: string;
  doc_date?: string;
};

export type THrJoinDetail = {
  company_code?: string;
  pay_comp_id?: string;
  pay_comp_amt?: number;
  user_id?: string;
  user_dt?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

class HrJoinService {
  insUpdHrJoinRpt = async (params: {
    header: THrJoinHeader;
    details: THrJoinDetail[];
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.header || !Array.isArray(params.details)) return false;
      await postFinance("insUpdHrJoinRpt", {
        header: params.header,
        details: params.details,
        loginid: params.loginid,
      });
      return true;
    } catch (error) {
      console.error("Error in insUpdHrJoinRpt:", error);
      return false;
    }
  };
}

const hrJoinServiceInstance = new HrJoinService();
export default hrJoinServiceInstance;