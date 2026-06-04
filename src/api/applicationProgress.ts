import { api } from "./client";

export type BTProjectPayload = Record<string, unknown>;

export async function saveBTProject(module: string, data: BTProjectPayload[]) {
  const response = await api.post<{ success?: boolean; message?: string; details?: string }>("/api/finance/insUpdBTProject", {
    module,
    data,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.details || response.data?.message || "Unable to save application progress");
  }
  return response.data;
}
