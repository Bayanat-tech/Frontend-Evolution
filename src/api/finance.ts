import { api } from "./client";

export type AccountTreeNode = {
  id: string;
  label: string;
  parent_code?: string | null;
  level: number;
  children: AccountTreeNode[];
};
// Ac-Tree Level5
export type ApprovalDetail={
  parameter: string;
      loginid:string;
      val1s1: string,
      val1s2: string,
      val1s3: string,
      val1s4: string,
      val1s5: string, //date, // DD/MM/YYYY
      val1s6: string,
      val1s7: string,

}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export async function getAccountTree() {
  const response = await api.get<ApiResponse<unknown> | AccountTreeNode[]>("/api/finance/master/ac_tree");
  const body = response.data;

  if (Array.isArray(body)) {
    return normalizeAccountTree(body);
  }

  if (!body.success) {
    throw new Error(body.message || "Unable to load account tree");
  }

  return normalizeAccountTree(body.data);
}

export async function getAccountTreeNode(level: number, code: string) {
  const endpoint =
    level === 5
      ? `/api/finance/master/ac_tree/account/${encodeURIComponent(code)}`
      : `/api/finance/master/ac_tree/level${level}/${encodeURIComponent(code)}`;
  const response = await api.get<ApiResponse<Record<string, unknown>>>(endpoint);
  if (!response.data.success) throw new Error(response.data.message || "Unable to load account node");
  return response.data.data || {};
}

export async function createAccountTreeNode(level: number, payload: Record<string, unknown>) {
  const endpoint = level === 5 ? "/api/finance/master/ac_tree/account" : `/api/finance/master/ac_tree/level${level}`;
  const response = await api.post<ApiResponse<unknown>>(endpoint, payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to create account node");
  return response.data;
}

export async function updateAccountTreeNode(level: number, code: string, payload: Record<string, unknown>) {
  const endpoint =
    level === 5
      ? `/api/finance/master/ac_tree/account/${encodeURIComponent(code)}`
      : `/api/finance/master/ac_tree/level${level}/${encodeURIComponent(code)}`;
  const response = await api.put<ApiResponse<unknown>>(endpoint, payload);
  if (!response.data.success) throw new Error(response.data.message || "Unable to update account node");
  return response.data;
}

export async function deleteAccountTreeNode(level: number, code: string) {
  const endpoint = `/api/finance/master/ac_tree/level${level}/${encodeURIComponent(code)}`;
  const response = await api.delete<ApiResponse<unknown>>(endpoint);
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete account node");
  return response.data;
}

function normalizeAccountTree(raw: unknown): AccountTreeNode[] {
  const source = unwrapTreePayload(raw);
  if (!Array.isArray(source)) return [];

  return source
    .map((node, index) => normalizeAccountTreeNode(node, index))
    .filter((node): node is AccountTreeNode => Boolean(node));
}

function unwrapTreePayload(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;
  return (
    record.data ||
    record.items ||
    record.rows ||
    record.tree ||
    record.accountTree ||
    record.ac_tree ||
    []
  );
}

function normalizeAccountTreeNode(raw: unknown, index: number): AccountTreeNode | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const id = text(record.id ?? record.ID ?? record.ac_code ?? record.AC_CODE ?? record.code ?? record.CODE ?? `node-${index}`);
  const label = text(
    record.label ??
      record.LABEL ??
      record.ac_name ??
      record.AC_NAME ??
      record.description ??
      record.DESCRIPTION ??
      record.name ??
      record.NAME ??
      id,
  );
  const levelValue = record.level ?? record.LEVEL;
  const level = typeof levelValue === "number" ? levelValue : Number(levelValue || 1);
  const children = unwrapTreePayload(record.children ?? record.CHILDREN);

  return {
    id,
    label,
    parent_code: text(record.parent_code ?? record.PARENT_CODE) || null,
    level: Number.isFinite(level) ? level : 1,
    children: normalizeAccountTree(children),
  };
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}


// Ac Treee Detail(L5)
export async function getLevel5ApprovalDetails(acCode: string) {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(
    `/api/finance/transaction/level5/${encodeURIComponent(acCode)}/approval`
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load approval details");
  return response.data.data || {};
}

export async function CreateLevel5ApprovalDetails<T = Record<string, unknown>>(
  AcTree: ApprovalDetail
): Promise<T> {
  if (!AcTree?.parameter) throw new Error("parameter is required");
  
  const response = await api.post<ApiResponse<T>>(
    "/api/wms/common/procBuildCommonProcedurewmc",
    AcTree
  );
  
  if (!response.data.success)
    throw new Error(response.data.message || "Unable to save approval details");
  
  return response.data.data as T;
}

export async function getLevel5Activities(acCode: string) {
  const response = await api.get<ApiResponse<Record<string, unknown>[]>>(
    `/api/finance/master/ac_tree/getVendorActivities`,
    { params: { ac_code: acCode } }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load activities");
  return response.data.data || [];
}

export async function upsertLevel5Activities(payload: {
  company_code: string;
  ac_code: string;
  loginid: string;
  records: {
    srno?: number;
    act_code: string;
    act_desc: string;
    user_id?: string;
    user_dt?: string;
  }[];
}) {
  const response = await api.post<ApiResponse<null>>(
    `/api/finance/upsertVendorActivity`,
    payload
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to save activity");
  return response.data;
}

export async function deleteLevel5Activity(params: {
  company_code?: string;
  ac_code: string;
  srno: number;
  loginid?: string;
}) {
  const response = await api.delete<ApiResponse<unknown>>(
    `/api/finance/vendorActivity/${encodeURIComponent(params.ac_code)}/${params.srno}`,
    {
      data: {
        company_code: params.company_code,
        loginid: params.loginid,
      },
    }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete activity");
  return response.data;
}

export async function upsertLevel5Documents(payload: {
  company_code: string;
  ac_code: string;
  loginid: string;
  records: {
    srno?: number;
    doc_type?: string;
    doc_path?: string;
    exp_date?: string;
    mandatory?: string;
    user_id?: string;
    user_dt?: string;
    doc_name?: string;
  }[];
}) {
  const response = await api.post<ApiResponse<null>>(
    `/api/finance/upsertAcMasterDocsDet`,
    payload
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to save document records");
  return response.data;
}

export async function getLevel5Documents(params: {
  company_code?: string;
  ac_code: string;
  loginid?: string;
}) {
  const response = await api.get<ApiResponse<Record<string, unknown>[]>>(
    `/api/finance/acMasterDocsDet/${encodeURIComponent(params.ac_code)}`,
    {
      params: {
        company_code: params.company_code,
        loginid: params.loginid,
      },
    }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to load documents");
  return response.data.data || [];
}

export async function deleteLevel5Document(params: {
  company_code?: string;
  ac_code: string;
  srno: number;
  loginid?: string;
}) {
  const response = await api.delete<ApiResponse<unknown>>(
    `/api/finance/acMasterDocsDet/${encodeURIComponent(params.ac_code)}/${params.srno}`,
    {
      data: {
        company_code: params.company_code,
        loginid: params.loginid,
      },
    }
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete document");
  return response.data;
}
