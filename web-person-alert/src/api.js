export const API_BASE = "http://192.168.115.105:8000";

export function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": "Bearer " + token } : {};
}
