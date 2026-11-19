import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3500";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestToken = error?.config?.headers?.Authorization;
    const activeToken = api.defaults.headers.common.Authorization;
    // A response from an anonymous or previous session must not clear a newer login.
    if (error?.response?.status === 401 && requestToken && requestToken === activeToken) {
      localStorage.removeItem("bayanat_service_token");
      setAuthToken(null);
    }
    return Promise.reject(error);
  },
);
