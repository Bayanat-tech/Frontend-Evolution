import { api } from "../../../../api/client";

export const getInspectionReportHtml = async (reportId: number) => {
  const response = await api.get(`/api/mms/inspection_report/html?reportid=${reportId}`, {
    responseType: "text"
  });
  return typeof response === "string" ? response : (response as any)?.data ?? "";
};

export const getInspectionReportExcelBlob = async (reportId: number) => {
  const response = await api.get(`/api/mms/inspection_report/excel?reportid=${reportId}`, {
    responseType: "blob"
  });
  return (response as any)?.data ?? response;
};