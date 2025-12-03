// src/pages/Live.jsx
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "../api";

const CAMERA_ID = "front_gate";

// Gọi còi (buzz) 2s
async function buzz(cameraId) {
  const token = localStorage.getItem("token");
  const fd = new FormData();
  fd.append("camera_id", cameraId);
  fd.append("duration_ms", "2000");

  const r = await fetch(API_BASE + "/buzz", {
    method: "POST",
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: fd,
  });

  if (!r.ok) throw new Error("Buzz failed");
}

// Bật / tắt stream: gọi /stream/start hoặc /stream/stop
async function streamControl(action, cameraId) {
  const token = localStorage.getItem("token");
  const fd = new FormData();
  fd.append("camera_id", cameraId);

  const endpoint = action === "start" ? "/stream/start" : "/stream/stop";

  const r = await fetch(API_BASE + endpoint, {
    method: "POST",
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: fd,
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.error("Stream control failed:", r.status, txt);
    throw new Error(`Stream ${action} failed`);
  }
}

// Định dạng số giây thành mm:ss
function formatDuration(sec) {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

// Map alert_level -> text + màu
function getAlertDisplay(level) {
  switch (level) {
    case "yellow":
      return { text: "CẢNH BÁO VÀNG (>= 15s)", color: "#d97706" }; // cam
    case "red":
      return { text: "CẢNH BÁO ĐỎ (>= 60s)", color: "#dc2626" }; // đỏ
    default:
      return { text: "Bình thường", color: "#16a34a" }; // xanh lá
  }
}

export default function Live() {
  const [streamOn, setStreamOn] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [events, setEvents] = useState([]);
  const [personPresent, setPersonPresent] = useState(false);

  // Thời lượng phiên livestream
  const [sessionStart, setSessionStart] = useState(null); // ms
  const [sessionSec, setSessionSec] = useState(0);

  // Thời lượng phát hiện người liên tục để tính alert
  const [detectSec, setDetectSec] = useState(0);
  const [alertLevel, setAlertLevel] = useState("none");

  const [busy, setBusy] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  // --- Kết nối WebSocket tới /stream để nghe person_event ---
  useEffect(() => {
    const wsUrl = API_BASE.replace(/^http/, "ws") + "/stream";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log("[WS] connected");
      try {
        ws.send(
          JSON.stringify({
            type: "hello",
            from: "live_ui",
            camera_id: CAMERA_ID,
          })
        );
      } catch (e) {
        console.error("ws send hello error", e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
      console.log("[WS] closed");
    };

    ws.onerror = (e) => {
      console.error("WebSocket error", e);
      setWsConnected(false);
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        // có thể là "ping" hoặc string khác -> bỏ qua
        return;
      }
      if (!msg || typeof msg !== "object") return;

      // Debug (nếu cần xem trong DevTools):
      // console.log("[WS msg]", msg);

      if (msg.type === "person_event") {
        const p = msg.payload || {};
        if (p.camera_id !== CAMERA_ID) return;

        // Backend đã tính sẵn duration_sec & alert_type
        const det = typeof p.duration_sec === "number" ? p.duration_sec : 0;
        const lvl = p.alert_type || "none";

        setPersonPresent(true);
        setDetectSec(det);
        setAlertLevel(lvl);

        // Lưu event lịch sử (theo evt_id)
        if (p.evt_id) {
          setEvents((prev) => {
            const idx = prev.findIndex((e) => e.evt_id === p.evt_id);
            if (idx === -1) return [p, ...prev];
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...p };
            return copy;
          });
        }
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send("ping");
        } catch (e) {
          console.error("ws ping error", e);
        }
      }
    }, 10000);

    return () => {
      clearInterval(pingInterval);
      try {
        ws.close();
      } catch {}
    };
  }, []);

  // --- Khi đang stream, auto tăng previewTick để reload ảnh ---
  useEffect(() => {
    if (!streamOn) return;
    const id = setInterval(() => {
      setPreviewTick((t) => t + 1);
    }, 700);
    return () => clearInterval(id);
  }, [streamOn]);

  // Mỗi lần tick đổi -> cập nhật URL hình preview
  useEffect(() => {
    const url =
      API_BASE +
      `/preview/latest?camera_id=${encodeURIComponent(
        CAMERA_ID
      )}&t=${previewTick}`;
    setPreviewUrl(url);
  }, [previewTick]);

  // --- Timer 1s: chỉ cập nhật thời lượng phiên livestream ---
  useEffect(() => {
    if (!streamOn || !sessionStart) return;

    const id = setInterval(() => {
      const now = Date.now();
      setSessionSec((now - sessionStart) / 1000);
    }, 1000);

    return () => clearInterval(id);
  }, [streamOn, sessionStart]);

  // --- Tải sự kiện gần đây từ backend (lịch sử) ---
  useEffect(() => {
    async function fetchEvents() {
      try {
        const r = await fetch(API_BASE + "/events/recent");
        if (!r.ok) return;
        const data = await r.json();
        if (Array.isArray(data)) {
          setEvents((prev) => {
            const byId = new Map();
            for (const e of prev) {
              if (e.evt_id) byId.set(e.evt_id, e);
            }
            for (const e of data) {
              if (e.evt_id) byId.set(e.evt_id, e);
            }
            const arr = Array.from(byId.values());
            arr.sort((a, b) => {
              const ta = a.ts || 0;
              const tb = b.ts || 0;
              return tb - ta;
            });
            return arr;
          });
        }
      } catch (e) {
        console.error("fetch events error:", e);
      }
    }

    fetchEvents();
    const id = setInterval(fetchEvents, 10000);
    return () => clearInterval(id);
  }, []);

  // --- Bắt đầu stream ---
  async function handleStart() {
    if (busy) return;
    try {
      setBusy(true);
      await streamControl("start", CAMERA_ID);
      setStreamOn(true);

      // Reset trạng thái phiên & cảnh báo
      const now = Date.now();
      setSessionStart(now);
      setSessionSec(0);
      setDetectSec(0);
      setAlertLevel("none");
      setPersonPresent(false);
    } catch (e) {
      console.error(e);
      alert("Không bật stream được: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // --- Dừng stream + lưu phiên vào danh sách sự kiện local ---
  async function handleStop() {
    if (busy) return;
    try {
      setBusy(true);
      await streamControl("stop", CAMERA_ID);

      if (sessionStart) {
        const now = new Date();
        const localEvt = {
          id: "session-" + now.getTime(),
          evt_id: null,
          camera_id: CAMERA_ID,
          ts: now.toISOString(),
          duration_sec: sessionSec,
          alert_type: alertLevel,
          source: "manual_session",
          label: "Phiên livestream (tắt stream)",
        };
        setEvents((prev) => [localEvt, ...prev]);
      }

      // Reset state
      setStreamOn(false);
      setSessionStart(null);
      setSessionSec(0);
      setDetectSec(0);
      setAlertLevel("none");
      setPersonPresent(false);
    } catch (e) {
      console.error(e);
      alert("Không tắt stream được: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const alertDisplay = getAlertDisplay(alertLevel);

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Giám sát camera</h1>
          <p className="page-subtitle">
            Theo dõi livestream và cảnh báo khi phát hiện người liên tục
          </p>
        </div>
      </div>

      <div className="page-live-main">
        {/* Cột trái: livestream */}
        <div className="card live-card">
          <div className="live-toolbar">
            <div>
              <div className="camera-label">Camera</div>
              <div className="camera-id">{CAMERA_ID}</div>
            </div>
            <div className="live-toolbar-right">
              <span
                className={
                  "live-chip " + (wsConnected ? "live-chip-ok" : "live-chip-bad")
                }
              >
                WS: {wsConnected ? "Đã kết nối" : "Mất kết nối"}
              </span>
            </div>
          </div>

          <div className="live-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="preview" />
            ) : (
              <div className="live-preview-placeholder">
                Chưa có hình ảnh từ camera
              </div>
            )}
          </div>

          <div className="live-controls">
            {!streamOn ? (
              <button onClick={handleStart} disabled={busy}>
                ▶ Bắt đầu livestream
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={busy}
                style={{ backgroundColor: "#ef4444", borderColor: "#ef4444" }}
              >
                ⏹ Dừng livestream
              </button>
            )}

            <button onClick={() => buzz(CAMERA_ID)}>🔔 Kêu còi 2s</button>
          </div>

          <div className="live-status">
            <div className="live-status-row">
              <span>Trạng thái:</span>
              <span
                className={
                  streamOn ? "live-pill live-pill-on" : "live-pill live-pill-off"
                }
              >
                {streamOn ? "ĐANG LIVESTREAM" : "ĐÃ TẮT"}
              </span>
            </div>
            <div className="live-status-row">
              <span>Phiên livestream:</span>
              <span>{formatDuration(sessionSec)}</span>
            </div>
            <div className="live-status-row">
              <span>Phát hiện người liên tục:</span>
              <span>{formatDuration(detectSec)}</span>
            </div>
            <div className="live-status-row">
              <span>Trạng thái người:</span>
              <span
                className={personPresent ? "live-text-warning" : "live-text-muted"}
              >
                {personPresent ? "ĐANG CÓ NGƯỜI" : "Không có"}
              </span>
            </div>
            <div className="live-status-row">
              <span>Cảnh báo:</span>
              <span className={"live-alert-pill live-alert-pill-" + alertLevel}>
                {alertDisplay.text}
              </span>
            </div>
          </div>
        </div>

        {/* Cột phải: lịch sử sự kiện */}
        <div className="card">
          <div className="alerts-header">
            <div>
              <div className="alerts-title">Lịch sử sự kiện</div>
              <div className="alerts-count">
                Tổng: {events.length} sự kiện
              </div>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="live-empty">Chưa có sự kiện nào.</div>
          ) : (
            <div className="card-list">
              {events.map((e) => {
                const tsRaw = e.ts;
                let tsText = "";
                if (typeof tsRaw === "number") {
                  tsText = new Date(tsRaw * 1000).toLocaleString();
                } else if (typeof tsRaw === "string") {
                  const d = new Date(tsRaw);
                  tsText = isNaN(d.getTime()) ? tsRaw : d.toLocaleString();
                }

                const dur = e.duration_sec ?? e.duration ?? 0;
                const alertDisp = getAlertDisplay(e.alert_type);

                const label =
                  e.label ||
                  (e.alert_type === "red"
                    ? "Cảnh báo đỏ"
                    : e.alert_type === "yellow"
                    ? "Cảnh báo vàng"
                    : "Sự kiện");

                return (
                  <div
                    key={e.id || e.evt_id || tsRaw}
                    className="event-card"
                  >
                    {e.snapshot_url && (
                      <img
                        src={API_BASE + e.snapshot_url}
                        alt="snapshot"
                        className="event-thumb"
                      />
                    )}
                    <div className="event-body">
                      <div className="event-camera">{label}</div>
                      <div className="event-time">{tsText}</div>
                      <div className="event-meta">
                        Camera: <b>{e.camera_id || CAMERA_ID}</b> · Thời lượng:{" "}
                        <b>{formatDuration(dur)}</b>
                      </div>
                      <div
                        className="event-alert"
                        style={{ color: alertDisp.color }}
                      >
                        {alertDisp.text}
                      </div>
                      <div className="alert-actions">
                        <button onClick={() => buzz(e.camera_id || CAMERA_ID)}>
                          🔔 Kêu còi 2s
                        </button>
                        {e.snapshot_url && (
                          <a
                            href={API_BASE + e.snapshot_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem ảnh sự kiện
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
