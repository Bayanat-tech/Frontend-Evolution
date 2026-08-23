import { postFinance } from "../../api/lookups";

// ── Types ─────────────────────────────────────────────────────────────────────

export type THrEmpLanguageDetail = {
  employee_id:  string;
  lang_code:    string;
  to_read:      string;
  to_write:     string;
  to_speak:     string;
  remarks:      string;
  status_flag:  string; // "A" | "I" | "D"
  company_code: string;
  user_id:      string;
};

// ── Service ───────────────────────────────────────────────────────────────────

class HrEmpLanguageService {
  /**
   * Upserts (insert/update/soft-delete via status_flag) the given
   * employee's language-skill records.
   *
   * Returns `true` on success, `false` on failure (mirrors the boolean
   * contract HrEmpLanguageSkill.tsx expects from `upsertHrEmpLanguageApi`).
   */
  upsertHrEmpLanguageApi = async (params: {
    company_code: string;
    language_details: THrEmpLanguageDetail[];
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.company_code) return false;
      if (!params?.language_details || !Array.isArray(params.language_details)) return false;

      await postFinance("upsertHrEmpLanguage", {
        company_code: params.company_code,
        language_details: params.language_details,
        loginid: params.loginid,
      });

      return true;
    } catch (error) {
      console.error("Error in upsertHrEmpLanguageApi:", error);
      return false;
    }
  };
}

// ── Export singleton ──────────────────────────────────────────────────────────

const hrEmpLanguageServiceInstance = new HrEmpLanguageService();
export default hrEmpLanguageServiceInstance;