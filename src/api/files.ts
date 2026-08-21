import { api } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type AccountFile = {
  COMPANY_CODE?: string;
  company_code?: string;
  companyCode?: string;
  REQUEST_NUMBER?: string;
  request_number?: string;
  requestNumber?: string;
  SR_NO?: number;
  sr_no?: number;
  srNo?: number;
  FILE_NAME?: string;
  file_name?: string;
  fileName?: string;
  ORG_FILE_NAME?: string;
  org_file_name?: string;
  orgFileName?: string;
  AWS_FILE_LOCN?: string;
  aws_file_locn?: string;
  awsFileLocn?: string;
  FLOW_LEVEL?: number;
  flow_level?: number;
  flowLevel?: number;
  MODULES?: string;
  modules?: string;
  UPDATED_BY?: string;
  updated_by?: string;
  updatedBy?: string;
  CREATED_BY?: string;
  created_by?: string;
  createdBy?: string;
  EXTENSIONS?: string;
  extensions?: string;
  USER_FILE_NAME?: string;
  user_file_name?: string;
  userFileName?: string;
  CREATED_AT?: string;
  created_at?: string;
  createdAt?: string;
  UPDATED_AT?: string;
  updated_at?: string;
  updatedAt?: string;
  TYPE?: string;
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
  const response = await api.get<ApiResponse<AccountFile[]>>(`/api/files/accountFiles/${encodeProxySafePathSegment(requestNumber)}`);
  if (!response.data.success) throw new Error(response.data.message || "Unable to load attachments");
  return (response.data.data || []).map(normalizeFile);
}

export async function getFreightAccountFiles(requestNumber: string) {
  if (!requestNumber) return [];
  const response = await api.post<ApiResponse<AccountFile[]>>("/api/freight/account-attachments/list", {
    request_number: requestNumber,
  });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load freight attachments");
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
  const response = await api.delete<ApiResponse<unknown>>(`/api/files/deleteAF/${encodeProxySafePathSegment(requestNumber)}/${srNo}`, {
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
    company_code: text(file.company_code ?? file.companyCode ?? file.COMPANY_CODE),
    request_number: text(file.request_number ?? file.requestNumber ?? file.REQUEST_NUMBER),
    sr_no: numberValue(file.sr_no ?? file.srNo ?? file.SR_NO),
    file_name: text(file.file_name ?? file.fileName ?? file.FILE_NAME),
    org_file_name: text(file.org_file_name ?? file.orgFileName ?? file.ORG_FILE_NAME),
    aws_file_locn: text(file.aws_file_locn ?? file.awsFileLocn ?? file.AWS_FILE_LOCN),
    flow_level: numberValue(file.flow_level ?? file.flowLevel ?? file.FLOW_LEVEL) ?? 0,
    modules: text(file.modules ?? file.MODULES),
    updated_by: text(file.updated_by ?? file.updatedBy ?? file.UPDATED_BY),
    created_by: text(file.created_by ?? file.createdBy ?? file.CREATED_BY),
    extensions: text(file.extensions ?? file.EXTENSIONS),
    user_file_name: text(file.user_file_name ?? file.userFileName ?? file.USER_FILE_NAME ?? file.org_file_name ?? file.orgFileName ?? file.ORG_FILE_NAME),
    type: text(file.type ?? file.TYPE),
  };
}

function extensionFromFile(file: File) {
  const byName = file.name.includes(".") ? file.name.split(".").pop() : "";
  return byName || file.type.split("/").pop() || "";
}


function encodeProxySafePathSegment(value: string) {
  return encodeURIComponent(value).replace(/%2F/gi, "%252F");
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}
