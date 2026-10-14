import { api } from "./client";
import type { AuthMeResponse, LoginResponse } from "../types/auth";

function getErrorMessage(error: unknown, fallback: string) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (responseData && typeof responseData === "object") {
    const data = responseData as { message?: unknown; error?: unknown };
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  }
  if (typeof responseData === "string" && responseData.trim()) return responseData;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function loginRequest(email: string, password: string) {
  try {
    const response = await api.post<LoginResponse>("/api/auth/login", {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to sign in. Please try again."));
  }
}

export async function changePasswordRequest(newPassword: string, identifier?: string) {
  try {
    const response = await api.post<{ success: boolean; message?: string }>("/api/auth/change-password", {
      newPassword,
      identifier,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to update password."));
  }
}

export async function forgotPasswordRequest(email: string) {
  try {
    const response = await api.post<{ success: boolean; message?: string }>("/api/auth/forgotPassword", {
      email,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to send password reset instructions."));
  }
}

export async function resetPasswordRequest(params: { email?: string; password: string; token?: string }) {
  try {
    const response = await api.post<{ success: boolean; message?: string }>("/api/auth/resetPassword", {
      email: params.email,
      password: params.password,
      token: params.token,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to reset password."));
  }
}

export async function meRequest() {
  try {
    const response = await api.get<AuthMeResponse>("/api/auth/me");
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load user profile."));
  }
}

export async function getCompanyLogoRequest(companyCode: string): Promise<string> {
  if (!companyCode) return "";
  try {
    const response = await api.get<{
      success: boolean;
      data?: {
        COMPANY_LOGO?: string;
        COMPANY_LOGO_AWSURL?: string;
        company_logo?: string;
        company_logo_awsurl?: string;
      };
    }>(`/api/auth/company-logo`, {
      params: { company_code: companyCode },
    });
    const d = response.data?.data;
    return (
      d?.COMPANY_LOGO ||
      d?.company_logo ||
      d?.COMPANY_LOGO_AWSURL ||
      d?.company_logo_awsurl ||
      ""
    );
  } catch {
    return "";
  }
}
