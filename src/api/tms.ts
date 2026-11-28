import { api } from "./client";

export interface TMSDriver {
  EMP_ID: string;
  EMP_NAME: string;
  DEPT_CODE?: string;
  GRADE_CODE?: string;
  CATEGORY_CODE?: string;
  MOBILE_NO?: string;
  PHONE_NO?: string;
  E_MAIL?: string;
  PERMANENT_ADDRESS?: string;
  DRIVING_LIC_NO?: string;
  ISSUE_PLACE?: string;
  ISSUE_DATE?: string;
  VALID_UPTO?: string;
  EMPSTATUS_CODE?: string;
}

export interface TMSVehicle {
  VEHICLE_NO: string;
  VEHICLE_REGNO?: string;
  VEHICLE_TYPE?: string;
  VTYPE_NAME?: string;
  VEHICLE_WEIGHT?: number;
  VEHICLE_VOLUME?: number;
  TRANSPORTER_CODE?: string;
  VEHICLE_DESC?: string;
}

export interface TMSTripTicket {
  DOC_TYPE: string;
  DOC_NO: number;
  DOC_DATE: string;
  CLASSIFICATION?: string;
  START_POINT?: string;
  END_POINT?: string;
  START_DATE?: string;
  CONFIRM_DATE?: string;
  START_METER_READING?: number;
  END_METER_READING?: number;
  TOTAL_KM?: number;
  EMP_ID?: string;
  DRIVER_NAME?: string;
  VEHICLE_CODE?: string;
  JOB_NO?: string;
  CUST_CODE?: string;
  BASE_AMOUNT?: number;
  ADVANCE_AMOUNT?: number;
  CONTAINER_NO?: string;
  CONFIRMED?: string;
  CANCELLED?: string;
  REMARKS?: string;
}

export interface TMSRequest {
  DOC_TYPE: string;
  DOC_NO: number;
  DOC_DATE: string;
  REQUESTED_BY?: string;
  REQUESTED_DATE?: string;
  JOB_TYPE?: string;
  DEPT_CODE?: string;
  PRIORITY?: string;
  REMARKS?: string;
  NO_OF_CONTAINER?: number;
  CONTAINER_TYPE?: string;
}

export interface TMSFuelFilling {
  DOC_NO: string;
  DOC_DATE: string;
  VEHICLE_CODE?: string;
  EMP_ID?: string;
  DRIVER_NAME?: string;
  METER_READING?: number;
  FUEL_TYPE?: string;
  QTY_GALLON?: number;
  UNIT_PRICE?: number;
  AMOUNT?: number;
  STATION_NAME?: string;
  LOCATION?: string;
  PAYMENT_MODE?: string;
  FUEL_CARD_NO?: string;
}

export interface TMSMaintenance {
  DOC_TYPE: string;
  DOC_NO: string;
  DOC_DATE: string;
  SERVICE_STATION_NAME?: string;
  VEHICLE_CODE?: string;
  CONTACT_PERSON?: string;
  PAYMENT_MODE?: string;
  SERVICE_TYPE?: string;
  EMP_ID?: string;
  DRIVER_NAME?: string;
  START_METER_READING?: number;
  END_METER_READING?: number;
  REMARKS?: string;
}

export interface TMSAccidentFine {
  DOC_TYPE: string;
  DOC_NO: string;
  DOC_DATE: string;
  VEHICLE_CODE?: string;
  EMP_ID?: string;
  DRIVER_NAME?: string;
  CLASSIFICATION?: string;
  FINE_CODE?: string;
  AMOUNT?: number;
  LOCATION?: string;
  ACCIDENT_STATUS?: string;
  ACCIDENT_DATE?: string;
  POLICE_REP_NO?: string;
  INSURANCE_CLAIM_NO?: string;
  REMARKS?: string;
}

export const tmsApi = {
  // Dashboard stats
  getDashboardStats: async () => {
    const res = await api.get("/api/tms/dashboard/stats");
    return res.data;
  },

  // Drivers
  getDrivers: async () => {
    const res = await api.get("/api/tms/drivers");
    return res.data;
  },
  saveDriver: async (data: any) => {
    const res = await api.post("/api/tms/drivers", data);
    return res.data;
  },
  deleteDriver: async (empId: string) => {
    const res = await api.delete(`/api/tms/drivers/${empId}`);
    return res.data;
  },

  // Vehicles
  getVehicles: async () => {
    const res = await api.get("/api/tms/vehicles");
    return res.data;
  },
  saveVehicle: async (data: any) => {
    const res = await api.post("/api/tms/vehicles", data);
    return res.data;
  },
  deleteVehicle: async (vehicleNo: string) => {
    const res = await api.delete(`/api/tms/vehicles/${vehicleNo}`);
    return res.data;
  },
  getVehicleTypes: async () => {
    const res = await api.get("/api/tms/vehicle-types");
    return res.data;
  },

  // Requests
  getRequests: async () => {
    const res = await api.get("/api/tms/requests");
    return res.data;
  },
  saveRequest: async (data: any) => {
    const res = await api.post("/api/tms/requests", data);
    return res.data;
  },
  deleteRequest: async (docNo: number, docType = "TR") => {
    const res = await api.delete(`/api/tms/requests/${docNo}?doc_type=${docType}`);
    return res.data;
  },

  // Trip Tickets
  getTripTickets: async () => {
    const res = await api.get("/api/tms/trip-tickets");
    return res.data;
  },
  saveTripTicket: async (data: any) => {
    const res = await api.post("/api/tms/trip-tickets", data);
    return res.data;
  },
  confirmTripTicket: async (docNo: number, data: any) => {
    const res = await api.put(`/api/tms/trip-tickets/${docNo}/confirm`, data);
    return res.data;
  },
  cancelTripTicket: async (docNo: number, data: any) => {
    const res = await api.put(`/api/tms/trip-tickets/${docNo}/cancel`, data);
    return res.data;
  },

  // Fuel Filling
  getFuelFilling: async () => {
    const res = await api.get("/api/tms/fuel-filling");
    return res.data;
  },
  saveFuelFilling: async (data: any) => {
    const res = await api.post("/api/tms/fuel-filling", data);
    return res.data;
  },
  deleteFuelFilling: async (docNo: string) => {
    const res = await api.delete(`/api/tms/fuel-filling/${docNo}`);
    return res.data;
  },

  // Maintenance
  getMaintenance: async () => {
    const res = await api.get("/api/tms/maintenance");
    return res.data;
  },
  saveMaintenance: async (data: any) => {
    const res = await api.post("/api/tms/maintenance", data);
    return res.data;
  },
  deleteMaintenance: async (docNo: string) => {
    const res = await api.delete(`/api/tms/maintenance/${docNo}`);
    return res.data;
  },

  // Accidents & Fines
  getAccidentsFines: async () => {
    const res = await api.get("/api/tms/accidents-fines");
    return res.data;
  },
  saveAccidentFine: async (data: any) => {
    const res = await api.post("/api/tms/accidents-fines", data);
    return res.data;
  },
  deleteAccidentFine: async (docNo: string) => {
    const res = await api.delete(`/api/tms/accidents-fines/${docNo}`);
    return res.data;
  },

  // Reports
  getReport: async (reportType: string, fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams();
    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    const res = await api.get(`/api/tms/reports/${reportType}?${params.toString()}`);
    return res.data;
  }
};
