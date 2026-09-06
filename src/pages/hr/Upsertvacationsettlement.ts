import { postFinance } from "../../api/lookups";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TVacationSettlementDetail = {
    employee_id: string;
    hdr_lve_slno: string;
    lve_doc_no: string;
    company_code: string;
    user_id: string;
};

export type TVacationSettlementAction = "PROCESS" | "REVERSE" | "JV";

// ── Service ───────────────────────────────────────────────────────────────────

class VacationSettlementService {
    /**
     * Runs the requested action (Settlement Process / Reverse Settlement /
     * Process JV) against the selected leave records.
     *
     * Returns `true` on success, `false` on failure (mirrors the boolean
     * contract HrEmpDependantsPage-style pages expect).
     */
    upsertVacationSettlementApi = async (params: {
        company_code: string;
        loginid?: string;
        action: TVacationSettlementAction;
        settlement_details: TVacationSettlementDetail[];
    }): Promise<boolean> => {
        try {
            if (!params?.company_code) return false;
            if (!params?.settlement_details || !Array.isArray(params.settlement_details)) return false;
            if (params.settlement_details.length === 0) return false;

            // Mirrors insUpdHrEmployeeDependants: backend route name and payload
            // key ("details") must match whatever your controller (e.g.
            // insUpdHrVacationSettlement.ts) actually reads. Adjust the route
            // string below if your backend registers it differently
            // (see finance.routes.ts). "action" tells the backend which of the
            // three procedures to invoke:
            //   PROCESS -> Settlement Process (cb_calc in the legacy screen)
            //   REVERSE -> Reverse Settlement (cb_reverse)
            //   JV      -> Process JV
            await postFinance("insUpdHrVacationSettlement", {
                company_code: params.company_code,
                loginid: params.loginid,
                action: params.action,
                details: params.settlement_details,
            });

            return true;
        } catch (error) {
            console.error("Error in upsertVacationSettlementApi:", error);
            return false;
        }
    };
}

// ── Export singleton ──────────────────────────────────────────────────────────

const vacationSettlementServiceInstance = new VacationSettlementService();
export default vacationSettlementServiceInstance;