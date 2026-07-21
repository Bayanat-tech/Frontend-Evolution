import { postFinance } from "../../api/lookups";

export type TExpenseMaster = {
  company_code: string;
  expense_code: string;
  expense_name?: string;
  ac_code?: string;
  user_id?: string;
  user_dt?: string | null;
};

class ExpenseMasterService {
  upsertExpenseMasterApi = async (params: {
    data: TExpenseMaster;
    loginid?: string;
  }): Promise<boolean> => {
    try {
      if (!params?.data) return false;
      await postFinance("upsertExpenseMaster", {
        ...params.data,
        loginid: params.loginid,
      });
      return true;
    } catch (error) {
      console.error("Error in upsertExpenseMasterApi:", error);
      return false;
    }
  };
}

const expenseMasterServiceInstance = new ExpenseMasterService();
export default expenseMasterServiceInstance;