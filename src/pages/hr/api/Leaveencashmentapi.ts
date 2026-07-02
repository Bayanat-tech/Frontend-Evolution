import { api } from "../../../api/client";
import type { LeaveEncashmentPayload } from "../leaveEncashmentHelpers";

const INS_UPD_EMP_LEAVE_ENCASHMENT_URL = "/api/finance/insUpdEmpLeaveencashment";

export type SaveLeaveEncashmentResponse = {
  success: boolean;
  message: string;
};

export const saveLeaveEncashment = async (
  payload: LeaveEncashmentPayload,
): Promise<SaveLeaveEncashmentResponse> => {
  try {
    const { data } = await api.post<SaveLeaveEncashmentResponse>(
      INS_UPD_EMP_LEAVE_ENCASHMENT_URL,
      payload,
    );

    if (!data?.success) {
      throw new Error(data?.message || "Unable to save leave encashment");
    }

    return data;
  } catch (error: any) {
    const serverMessage = error?.response?.data?.message;
    throw new Error(serverMessage || error?.message || "Unable to save leave encashment");
  }
};