const defaultHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";

export const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || `http://${defaultHost}:8000`;

export function getApiBase() {
  const saved = localStorage.getItem("api_base");
  return (saved ? saved.trim().replace(/\/+$/, "") : "") || DEFAULT_API_BASE;
}

export function setApiBase(url) {
  const clean = (url || "").trim().replace(/\/+$/, "");
  if (clean) {
    localStorage.setItem("api_base", clean);
  } else {
    localStorage.removeItem("api_base");
  }
}

// Giữ export API_BASE để tương thích ngược
export const API_BASE = getApiBase();

export function getWsUrl(path = "/ws/alerts", params = {}) {
  const base = getApiBase().replace(/^http/i, "ws");
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      search.set(k, String(v).trim());
    }
  });
  const qs = search.toString();
  return `${base}${path}${qs ? `?${qs}` : ""}`;
}

export function resolveSnapshotUrl(snapshotUrl) {
  if (!snapshotUrl) return "";
  if (/^https?:\/\//i.test(snapshotUrl)) return snapshotUrl;
  const path = snapshotUrl.startsWith("/") ? snapshotUrl : `/${snapshotUrl}`;
  return `${getApiBase()}${path}`;
}

export function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export async function loginUser(username, password) {
  const r = await fetch(`${getApiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(data.detail || "Sai tên đăng nhập hoặc mật khẩu");
  }
  return data;
}

export async function registerUser(username, password) {
  const fd = new FormData();
  fd.append("username", username);
  fd.append("password", password);

  const r = await fetch(`${getApiBase()}/auth/register`, {
    method: "POST",
    body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(data.detail || "Không thể đăng ký tài khoản");
  }
  return data;
}

export async function fetchEvents({
  page = 1,
  page_size = 20,
  start_ts,
  end_ts,
  person_id,
  camera_id,
  alert_type,
} = {}) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("page_size", String(page_size));
  if (start_ts !== undefined && start_ts !== null && start_ts !== "") {
    qs.set("start_ts", String(start_ts));
  }
  if (end_ts !== undefined && end_ts !== null && end_ts !== "") {
    qs.set("end_ts", String(end_ts));
  }
  if (person_id && person_id.trim()) {
    qs.set("person_id", person_id.trim());
  }
  if (camera_id && camera_id.trim()) {
    qs.set("camera_id", camera_id.trim());
  }
  if (alert_type && alert_type.trim()) {
    qs.set("alert_type", alert_type.trim());
  }

  const r = await fetch(`${getApiBase()}/events?${qs.toString()}`, {
    headers: authHeader(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    const err = new Error(data.detail || `Lỗi tải sự kiện (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return data;
}

export async function fetchRecentEvents({
  limit = 30,
  offset = 0,
  start_ts,
  end_ts,
  person_id,
  camera_id,
  alert_type,
} = {}) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  if (start_ts !== undefined && start_ts !== null && start_ts !== "") {
    qs.set("start_ts", String(start_ts));
  }
  if (end_ts !== undefined && end_ts !== null && end_ts !== "") {
    qs.set("end_ts", String(end_ts));
  }
  if (person_id && person_id.trim()) {
    qs.set("person_id", person_id.trim());
  }
  if (camera_id && camera_id.trim()) {
    qs.set("camera_id", camera_id.trim());
  }
  if (alert_type && alert_type.trim()) {
    qs.set("alert_type", alert_type.trim());
  }

  const r = await fetch(`${getApiBase()}/events/recent?${qs.toString()}`, {
    headers: authHeader(),
  });
  const data = await r.json().catch(() => []);
  if (!r.ok) {
    const err = new Error(data.detail || `Lỗi tải sự kiện gần đây (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchEventDetail(evtId) {
  const r = await fetch(
    `${getApiBase()}/events/${encodeURIComponent(evtId)}`,
    {
      headers: authHeader(),
    }
  );
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(data.detail || "Không tìm thấy chi tiết sự kiện");
  }
  return data.event;
}

export async function buzzCamera(cameraId, durationMs = 2000) {
  const fd = new FormData();
  fd.append("camera_id", cameraId);
  fd.append("duration_ms", String(durationMs));

  const r = await fetch(`${getApiBase()}/buzz`, {
    method: "POST",
    headers: authHeader(),
    body: fd,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Không thể kích hoạt còi báo động");
  }
  return r.json();
}

export async function streamControl(action, cameraId) {
  const fd = new FormData();
  fd.append("camera_id", cameraId);
  const endpoint = action === "start" ? "/stream/start" : "/stream/stop";

  const r = await fetch(`${getApiBase()}${endpoint}`, {
    method: "POST",
    headers: authHeader(),
    body: fd,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || `Không thể ${action} stream`);
  }
  return r.json();
}

export async function uploadSnapshot(
  cameraId,
  file,
  ingestToken = "SHARED_TOKEN_ABC"
) {
  const fd = new FormData();
  fd.append("camera_id", cameraId);
  fd.append("token", ingestToken);
  fd.append("file", file);

  const r = await fetch(`${getApiBase()}/snapshot`, {
    method: "POST",
    body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(data.detail || "Upload snapshot thất bại");
  }
  return data;
}

export function getAlertDisplay(alertType, personId) {
  switch (alertType) {
    case "face_known":
      return {
        text: personId && personId !== "Unknown"
          ? `Người quen: ${personId}`
          : "Nhận diện người quen",
        shortText: "Người quen",
        color: "#15803d",
        bg: "#dcfce7",
        border: "#86efac",
        pillClass: "live-alert-pill-known",
      };
    case "face_unknown":
      return {
        text: "CẢNH BÁO: Người lạ (Unknown Face)",
        shortText: "Người lạ",
        color: "#b91c1c",
        bg: "#fee2e2",
        border: "#fca5a5",
        pillClass: "live-alert-pill-red",
      };
    case "person_alert":
      return {
        text: "Phát hiện có người (YOLO Person)",
        shortText: "Có người",
        color: "#d97706",
        bg: "#fef3c7",
        border: "#fde68a",
        pillClass: "live-alert-pill-yellow",
      };
    case "yellow":
      return {
        text: "CẢNH BÁO VÀNG (Đứng lâu >= 15s)",
        shortText: "Cảnh báo vàng",
        color: "#b45309",
        bg: "#fefce8",
        border: "#fde68a",
        pillClass: "live-alert-pill-yellow",
      };
    case "red":
      return {
        text: "CẢNH BÁO ĐỎ (Xâm nhập >= 60s)",
        shortText: "Cảnh báo đỏ",
        color: "#dc2626",
        bg: "#fef2f2",
        border: "#fecaca",
        pillClass: "live-alert-pill-red",
      };
    default:
      return {
        text: "Bình thường",
        shortText: "Bình thường",
        color: "#16a34a",
        bg: "#ecfdf5",
        border: "#bbf7d0",
        pillClass: "live-alert-pill-none",
      };
  }
}

export function formatConfidence(conf) {
  if (typeof conf !== "number" || Number.isNaN(conf)) return null;
  const pct = conf <= 1.0 ? conf * 100 : conf;
  return `${pct.toFixed(1)}%`;
}
