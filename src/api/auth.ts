import { api } from "./client";
import type { AuthMeResponse, LoginResponse } from "../types/auth";

export async function loginRequest(email: string, password: string) {
  const response = await api.post<LoginResponse>("/api/auth/login", {
    email,
    password,
  });
  return response.data;
}

export async function meRequest() {
  const response = await api.get<AuthMeResponse>("/api/auth/me");
  return response.data;
}
