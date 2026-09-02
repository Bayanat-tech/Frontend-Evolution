import { postFinance } from "../../api/lookups";

// ── Types ─────────────────────────────────────────────────────────────────────

export type THrEmpDependantDetail = {
    dep_serial_number: string | number | null;
    employee_id: string;
    dep_relation: string;
    dep_name: string;
    dep_dob: string | null;
    dep_sponsored_by: string;
    ticket_eligibility: string;
    ticket_type: string;
    marstat: string;
    medical_eligible: string;
    dep_blood_group: string;
    status_flag: string; // "A" | "I" | "D"
    ppt_card: string;
    res_card: string;
    ppt_valid_from: string | null;
    ppt_valid_to: string | null;
    res_valid_from: string | null;
    res_valid_to: string | null;
    ins_card_no: string;
    ins_card_type: string;
    ins_card_issue_dt: string | null;
    isn_card_exp_dt: string | null;
    company_code: string;
    user_id: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

class HrEmpDependantsService {
    /**
     * Upserts (insert/update/soft-delete via status_flag) the given
     * employee's dependant records.
     *
     * Returns `true` on success, `false` on failure (mirrors the boolean
     * contract HrEmpDependantsPage.tsx expects from `upsertHrEmpDependantsApi`).
     */
    upsertHrEmpDependantsApi = async (params: {
        company_code: string;
        dependant_details: THrEmpDependantDetail[];
        loginid?: string;
    }): Promise<boolean> => {
        try {
            if (!params?.company_code) return false;
            if (!params?.dependant_details || !Array.isArray(params.dependant_details)) return false;

            // Mirrors insUpdHrEmpLanguages: backend route name and payload key
            // ("details") must match whatever your controller
            // (e.g. insUpdHrEmpDependants.ts) actually reads. Adjust the route
            // string below if your backend registers it differently
            // (see finance.routes.ts).
            await postFinance("insUpdHrEmployeeDependants", {
                company_code: params.company_code,
                details: params.dependant_details,
                loginid: params.loginid,
            });

            return true;
        } catch (error) {
            console.error("Error in upsertHrEmpDependantsApi:", error);
            return false;
        }
    };
}

// ── Export singleton ──────────────────────────────────────────────────────────

const hrEmpDependantsServiceInstance = new HrEmpDependantsService();
export default hrEmpDependantsServiceInstance;