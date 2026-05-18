import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type AccountFile = {
  company_code?: string;
  companyCode?: string;
  request_number?: string;
  requestNumber?: string;
  sr_no?: number;
  srNo?: number;
  file_name?: string;
  fileName?: string;
  org_file_name?: string;
  orgFileName?: string;
  aws_file_locn?: string;
  awsFileLocn?: string;
  flow_level?: number;
  flowLevel?: number;
  modules?: string;
  updated_by?: string;
  updatedBy?: string;
  created_by?: string;
  createdBy?: string;
  extensions?: string;
  user_file_name?: string;
  userFileName?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  type?: string;
};

export type NormalizedFile = {
  company_code: string;
  request_number: string;
  sr_no?: number;
  file_name: string;
  org_file_name: string;
  aws_file_locn: string;
  flow_level: number;
  modules: string;
  updated_by?: string;
  created_by?: string;
  extensions: string;
  user_file_name: string;
  type?: string;
};

export async function getAccountFiles(requestNumber: string) {
  if (!requestNumber) return [];
  const response = await api.get<ApiResponse<AccountFile[]>>(`/api/files/accountFiles/${encodeURIComponent(requestNumber)}`);
  if (!response.data.success) throw new Error(response.data.message || "Unable to load attachments");
  return (response.data.data || []).map(normalizeFile);
}

export async function uploadAccountFile(file: File, requestNumber: string, type: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("request_number", requestNumber);
  formData.append("type", type);

  const response = await api.post<ApiResponse<string>>("/api/files/uploadFileAf", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (!response.data.success && !response.data.data) throw new Error(response.data.message || "Unable to upload file");
  return response.data.data || "";
}

export async function saveAccountFileRows(requestNumber: string, files: NormalizedFile[]) {
  if (!files.length) return { successfulRecords: [], duplicateRecords: [] };
  const response = await api.post<ApiResponse<{ successfulRecords?: Array<{ org_file_name: string; sr_no: number }>; duplicateRecords?: string[] }>>(
    "/api/finance/master/saveFile",
    { request_number: requestNumber, files },
  );
  if (!response.data.success) throw new Error(response.data.message || "Unable to save file details");
  return response.data.data || { successfulRecords: [], duplicateRecords: [] };
}

export async function renameAccountFile(requestNumber: string, awsFileLocn: string, userFileName: string) {
  const response = await api.put<ApiResponse<unknown>>("/api/files/editAFFile", {
    request_number: requestNumber,
    aws_file_locn: awsFileLocn,
    user_file_name: userFileName,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to rename file");
  return response.data;
}

export async function deleteAccountFile(requestNumber: string, srNo: number, awsFileLocn: string) {
  const response = await api.delete<ApiResponse<unknown>>(`/api/files/deleteAF/${encodeURIComponent(requestNumber)}/${srNo}`, {
    data: { aws_file_locn: awsFileLocn },
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to delete file");
  return response.data;
}

export function makeFileRow(options: {
  file: File;
  fileUrl: string;
  requestNumber: string;
  companyCode: string;
  loginId: string;
  module: string;
  type: string;
  flowLevel?: number;
}): NormalizedFile {
  return {
    company_code: options.companyCode,
    request_number: options.requestNumber,
    file_name: options.file.name,
    org_file_name: options.file.name,
    aws_file_locn: options.fileUrl,
    flow_level: options.flowLevel ?? 0,
    modules: options.module,
    updated_by: options.loginId,
    created_by: options.loginId,
    extensions: extensionFromFile(options.file),
    user_file_name: options.file.name,
    type: options.type,
  };
}

export function normalizeFile(file: AccountFile): NormalizedFile {
  return {
    company_code: text(file.company_code ?? file.companyCode),
    request_number: text(file.request_number ?? file.requestNumber),
    sr_no: numberValue(file.sr_no ?? file.srNo),
    file_name: text(file.file_name ?? file.fileName),
    org_file_name: text(file.org_file_name ?? file.orgFileName),
    aws_file_locn: text(file.aws_file_locn ?? file.awsFileLocn),
    flow_level: numberValue(file.flow_level ?? file.flowLevel) ?? 0,
    modules: text(file.modules),
    updated_by: text(file.updated_by ?? file.updatedBy),
    created_by: text(file.created_by ?? file.createdBy),
    extensions: text(file.extensions),
    user_file_name: text(file.user_file_name ?? file.userFileName ?? file.org_file_name ?? file.orgFileName),
    type: text(file.type),
  };
}

function extensionFromFile(file: File) {
  const byName = file.name.includes(".") ? file.name.split(".").pop() : "";
  return byName || file.type.split("/").pop() || "";
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}
