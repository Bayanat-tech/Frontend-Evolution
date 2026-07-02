import { api } from "./client";

export type SupportAttachment = {
  ATTACHMENT_ID?: number;
  MESSAGE_ID?: number;
  FILE_NAME?: string;
  FILE_TYPE?: string;
  FILE_SIZE?: number;
  DATA_URL?: string;
  FILE_URL?: string;
  OBJECT_KEY?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  data_url?: string;
};

export type SupportTicket = {
  TICKET_ID: number;
  REQUESTER_LOGINID: string;
  REQUESTER_NAME?: string;
  ASSIGNED_TO?: string;
  SUBJECT?: string;
  MODULE_NAME?: string;
  PAGE_URL?: string;
  STATUS?: string;
  PRIORITY?: string;
  LAST_MESSAGE?: string;
  LAST_MESSAGE_AT?: string;
  CREATED_AT?: string;
  REQUESTER_IS_ONLINE?: string;
  UNREAD_COUNT?: number;
};

export type SupportMessage = {
  MESSAGE_ID: number;
  TICKET_ID: number;
  SENDER_LOGINID: string;
  SENDER_NAME?: string;
  SENDER_ROLE?: string;
  MESSAGE_TEXT?: string;
  IS_DELETED?: string;
  DELETED_BY?: string;
  DELETED_AT?: string;
  READ_AT?: string;
  CREATED_AT?: string;
  attachments?: SupportAttachment[];
};

export type SupportUser = {
  LOGINID: string;
  USERNAME?: string;
  EMAIL_ID?: string;
  COMPANY_CODE?: string;
  TENANT_ID?: string;
  LAST_SEEN_AT?: string;
  IS_ONLINE?: string;
};

function unwrap<T>(response: { data: { success?: boolean; data?: T; message?: string } }) {
  if (!response.data?.success) throw new Error(response.data?.message || "Support request failed");
  return response.data.data as T;
}

export async function supportHeartbeat() {
  return unwrap(await api.post("/api/support/heartbeat"));
}

export async function getSupportTickets(role: "user" | "admin") {
  return unwrap<SupportTicket[]>(await api.get("/api/support/tickets", { params: { role } }));
}

export async function getSupportMessages(ticketId: number, role: "user" | "admin") {
  return unwrap<SupportMessage[]>(await api.get(`/api/support/tickets/${ticketId}/messages`, { params: { role } }));
}

export async function createSupportTicket(payload: Record<string, unknown>) {
  return unwrap<{ ticketId: number; messageId: number }>(await api.post("/api/support/tickets", payload));
}

export async function sendSupportMessage(ticketId: number, payload: Record<string, unknown>, role: "user" | "admin") {
  return unwrap<{ ticketId: number; messageId: number }>(await api.post(`/api/support/tickets/${ticketId}/messages`, { ...payload, role }));
}

export async function deleteSupportMessage(ticketId: number, messageId: number, role: "user" | "admin") {
  return unwrap<{ ticketId: number; messageId: number; deleted: boolean }>(
    await api.delete(`/api/support/tickets/${ticketId}/messages/${messageId}`, { data: { role } })
  );
}

export async function updateSupportTicket(ticketId: number, payload: Record<string, unknown>, role: "user" | "admin") {
  return unwrap(await api.patch(`/api/support/tickets/${ticketId}`, { ...payload, role }));
}

export async function markSupportRead(ticketId: number) {
  return unwrap(await api.post(`/api/support/tickets/${ticketId}/read`));
}

export async function getSupportActiveUsers() {
  return unwrap<SupportUser[]>(await api.get("/api/support/active-users"));
}
