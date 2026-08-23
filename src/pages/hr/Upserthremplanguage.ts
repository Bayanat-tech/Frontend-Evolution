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

      // FIX: backend route is registered as "insUpdHrEmpLanguages"
      // (see finance.routes.ts), NOT "upsertHrEmpLanguage". The old name
      // here caused a 404 (Cannot POST /api/finance/upsertHrEmpLanguage)
      // since no matching route existed.
      //
      // FIX: controller (insUpdHrEmpLanguages.ts) reads `req.body?.details`,
      // NOT `req.body.language_details`. Sending the array under the wrong
      // key made the controller see an empty/undefined array and return
      // "Language details are required" even though rows were sent.
      await postFinance("insUpdHrEmpLanguages", {
        company_code: params.company_code,
        details: params.language_details,
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