import { useEffect, useState, useRef, useId } from "react";
import {
  buzzCamera,
  fetchRecentEvents,
  formatConfidence,
  getAlertDisplay,
  getApiBase,
  getWsUrl,
  resolveSnapshotUrl,
  streamControl,
  uploadSnapshot,
} from "../api";

function formatDuration(sec) {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function formatTimestamp(tsRaw) {
  if (typeof tsRaw === "number") {
    return new Date(tsRaw * 1000).toLocaleString("vi-VN");
  }
  if (typeof tsRaw === "string") {
    const d = new Date(tsRaw);
    return Number.isNaN(d.getTime()) ? tsRaw : d.toLocaleString("vi-VN");
  }
  return "";
}

function formatBbox(bbox) {
  if (!bbox) return null;
  let arr = bbox;
  if (typeof bbox === "string") {
    try {
      arr = JSON.parse(bbox);
    } catch {
      return bbox;
    }
  }
  if (Array.isArray(arr) && arr.length === 4) {
    return `[${arr.map((n) => Math.round(Number(n) || 0)).join(", ")}]`;
  }
  return null;
}

export default function Live({ onUnauthorized }) {
  const [cameraId, setCameraId] = useState("front_gate");
  const [streamOn, setStreamOn] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);
  const [previewOk, setPreviewOk] = useState(true);
  const [events, setEvents] = useState([]);
  const [personPresent, setPersonPresent] = useState(false);
  const [lastPersonId, setLastPersonId] = useState(null);
  const [lastConfidence, setLastConfidence] = useState(null);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionSec, setSessionSec] = useState(0);
  const [detectSec, setDetectSec] = useState(0);
  const [alertLevel, setAlertLevel] = useState("none");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const wsRef = useRef(null);
  const lastPersonRef = useRef(null);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);
  const dialogTitleId = useId();

  // Fallback light-dismiss cho <dialog closedby="any"> trên trình duyệt chưa hỗ trợ native closedBy
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener("click", handleBackdropClick);
      return () => dialog.removeEventListener("click", handleBackdropClick);
    }
  }, []);

  // Kết nối WebSocket tới /ws/alerts kèm tự động kết nối lại & heartbeat ping/pong
  useEffect(() => {
    let unmounted = false;
    let reconnectTimer = null;
    let pingInterval = null;

    function connectWs() {
      if (unmounted) return;
      const wsUrl = getWsUrl("/ws/alerts", { camera_id: cameraId });
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        try {
          ws.send(
            JSON.stringify({
              type: "subscribe",
              cameras: cameraId ? [cameraId] : [],
            })
          );
        } catch (e) {
          console.error("WS subscribe error", e);
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        wsRef.current = null;
        reconnectTimer = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        if (!unmounted) setWsConnected(false);
      };

      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;

        // Phản hồi heartbeat ping từ ConnectionManager của server
        if (msg.type === "ping") {
          try {
            ws.send(JSON.stringify({ type: "pong", ts: Date.now() / 1000 }));
          } catch {}
          return;
        }

        if (msg.type === "person_event") {
          const p = { ...(msg.payload || {}), ...msg };
          delete p.payload;

          if (cameraId && p.camera_id && p.camera_id !== cameraId) return;

          const det = typeof p.duration_sec === "number" ? p.duration_sec : 0;
          const lvl = p.alert_type || "person_alert";
          const pid = p.person_id || "Unknown";
          const conf =
            typeof p.confidence === "number" ? p.confidence : null;
          const faces = Array.isArray(p.all_faces) ? p.all_faces : [];

          setPersonPresent(true);
          setLastPersonId(pid);
          setLastConfidence(conf);
          setDetectedFaces(faces);
          setDetectSec(det);
          setAlertLevel(lvl);
          setPreviewTick((t) => t + 1);
          setPreviewOk(true);

          lastPersonRef.current = Date.now();
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

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {}
        }
      }, 15000);
    }

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [cameraId]);

  // Reload ảnh preview định kỳ khi bật livestream
  useEffect(() => {
    if (!streamOn) return;
    const id = setInterval(() => {
      setPreviewTick((t) => t + 1);
    }, 800);
    return () => clearInterval(id);
  }, [streamOn]);

  const previewUrl = `${getApiBase()}/preview/latest?camera_id=${encodeURIComponent(
    cameraId
  )}&t=${previewTick}`;

  // Đếm thời gian phiên livestream
  useEffect(() => {
    if (!streamOn || !sessionStart) return;
    const id = setInterval(() => {
      setSessionSec((Date.now() - sessionStart) / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [streamOn, sessionStart]);

  // Tải danh sách sự kiện gần đây từ /events/recent (có truyền Bearer token)
  useEffect(() => {
    let active = true;
    async function loadRecent() {
      try {
        const data = await fetchRecentEvents({
          camera_id: cameraId,
          limit: 30,
        });
        if (!active) return;
        setEvents((prev) => {
          const byId = new Map();
          for (const e of prev) {
            const key = e.evt_id || e.id;
            if (key) byId.set(key, e);
          }
          for (const e of data) {
            const key = e.evt_id || e.id;
            if (key) byId.set(key, e);
          }
          const arr = Array.from(byId.values());
          arr.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
          return arr;
        });
      } catch (e) {
        if (e?.status === 401 && onUnauthorized) {
          onUnauthorized();
        }
      }
    }

    loadRecent();
    const id = setInterval(loadRecent, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [cameraId, onUnauthorized]);

  // Tự động reset trạng thái "Đang có người" sau 8 giây không có frame mới
  useEffect(() => {
    const id = setInterval(() => {
      const last = lastPersonRef.current;
      if (!last) return;
      if (Date.now() - last >= 8000) {
        lastPersonRef.current = null;
        setPersonPresent(false);
        setDetectSec(0);
        setAlertLevel("none");
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  async function handleStart() {
    if (busy) return;
    try {
      setBusy(true);
      await streamControl("start", cameraId);
      setStreamOn(true);
      setPreviewOk(true);
      setPreviewTick((t) => t + 1);
      setSessionStart(Date.now());
      setSessionSec(0);
      setDetectSec(0);
      setAlertLevel("none");
      setPersonPresent(false);
      lastPersonRef.current = null;
    } catch (e) {
      alert("Không bật stream được: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (busy) return;
    try {
      setBusy(true);
      await streamControl("stop", cameraId);
      setStreamOn(false);
      setSessionStart(null);
      setSessionSec(0);
      setDetectSec(0);
      setAlertLevel("none");
      setPersonPresent(false);
      lastPersonRef.current = null;
    } catch (e) {
      alert("Không tắt stream được: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBuzz(targetCam = cameraId) {
    try {
      await buzzCamera(targetCam, 2000);
    } catch (e) {
      alert("Lỗi kích hoạt còi: " + e.message);
    }
  }

  async function handleUploadSnapshot(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await uploadSnapshot(cameraId, file);
      setPreviewOk(true);
      setPreviewTick((t) => t + 1);
    } catch (e) {
      alert("Không gửi được ảnh snapshot: " + e.message);
    } finally {
      setUploading(false);
      ev.target.value = "";
    }
  }

  function openEventModal(evt) {
    setSelectedEvent(evt);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }

  const alertDisplay = getAlertDisplay(alertLevel, lastPersonId);

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Giám sát Trực tiếp & Nhận diện Khuôn mặt</h1>
          <p className="page-subtitle">
            Theo dõi luồng camera thời gian thực, nhận diện khuôn mặt (Known /
            Unknown) và cảnh báo xâm nhập qua WebSocket
          </p>
        </div>
      </div>

      <div className="page-live-main">
        {/* Cột trái: Khung camera & trạng thái nhận diện */}
        <div className="card live-card">
          <div className="live-toolbar">
            <div className="camera-select-group">
              <label className="camera-label" htmlFor="live-camera-select">
                Kênh Camera
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  id="live-camera-select"
                  className="select-input"
                  value={cameraId}
                  onChange={(e) => {
                    setCameraId(e.target.value);
                    setPreviewOk(true);
                    setPreviewTick((t) => t + 1);
                  }}
                >
                  <option value="front_gate">front_gate (Cổng chính)</option>
                  <option value="back_door">back_door (Cửa sau)</option>
                  <option value="living_room">living_room (Phòng khách)</option>
                </select>
              </div>
            </div>

            <div className="live-toolbar-right">
              <span
                className={
                  "live-chip " + (wsConnected ? "live-chip-ok" : "live-chip-bad")
                }
              >
                WS: {wsConnected ? "Đã kết nối (/ws/alerts)" : "Đang kết nối lại..."}
              </span>
            </div>
          </div>

          <div className="live-preview">
            {previewOk ? (
              <img
                src={previewUrl}
                alt={`Preview ${cameraId}`}
                onError={() => setPreviewOk(false)}
              />
            ) : (
              <div className="live-preview-placeholder">
                <div>
                  <div style={{ fontSize: "1.1rem", marginBottom: 6 }}>
                    📷 Chưa có khung hình từ camera <b>{cameraId}</b>
                  </div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    Bạn có thể bấm &ldquo;📤 Gửi ảnh test (/snapshot)&rdquo; bên
                    dưới để kiểm thử pipeline YOLOv8 + FaceRec ngay lập tức.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="live-controls">
            {!streamOn ? (
              <button type="button" onClick={handleStart} disabled={busy}>
                ▶ Bắt đầu livestream
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                disabled={busy}
                className="btn-danger"
              >
                ⏹ Dừng livestream
              </button>
            )}

            <button
              type="button"
              className="btn-warning"
              onClick={() => handleBuzz(cameraId)}
            >
              🔔 Kêu còi 2s
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Đang gửi..." : "📤 Gửi ảnh test (/snapshot)"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleUploadSnapshot}
            />
          </div>

          <div className="live-status">
            <div className="live-status-row">
              <span>Trạng thái luồng:</span>
              <span
                className={
                  streamOn ? "live-pill live-pill-on" : "live-pill live-pill-off"
                }
              >
                {streamOn ? "ĐANG LIVESTREAM" : "CHẾ ĐỘ CHỜ SỰ KIỆN"}
              </span>
            </div>
            <div className="live-status-row">
              <span>Thời lượng phiên:</span>
              <b>{formatDuration(sessionSec)}</b>
            </div>
            <div className="live-status-row">
              <span>Trạng thái phát hiện:</span>
              <span
                className={
                  personPresent ? "live-text-warning" : "live-text-muted"
                }
              >
                {personPresent ? "🚨 ĐANG CÓ NGƯỜI" : "Không có người"}
              </span>
            </div>
            <div className="live-status-row">
              <span>Nhận diện khuôn mặt:</span>
              <span>
                {lastPersonId ? (
                  <span
                    className={
                      "person-badge " +
                      (lastPersonId !== "Unknown"
                        ? "person-badge-known"
                        : "person-badge-unknown")
                    }
                  >
                    {lastPersonId !== "Unknown"
                      ? `✅ ${lastPersonId}`
                      : "⚠️ Unknown (Người lạ)"}
                    {formatConfidence(lastConfidence)
                      ? ` · ${formatConfidence(lastConfidence)}`
                      : ""}
                  </span>
                ) : (
                  <span className="live-text-muted">Chưa ghi nhận</span>
                )}
              </span>
            </div>
            <div className="live-status-row">
              <span>Thời lượng xuất hiện liên tục:</span>
              <b>{formatDuration(detectSec)}</b>
            </div>
            <div className="live-status-row">
              <span>Mức cảnh báo hiện tại:</span>
              <span className={"live-alert-pill " + alertDisplay.pillClass}>
                {alertDisplay.text}
              </span>
            </div>

            {detectedFaces.length > 0 && (
              <div className="detected-faces-bar">
                <span className="detected-faces-label">
                  Khuôn mặt trong khung hình ({detectedFaces.length}):
                </span>
                <div className="detected-faces-list">
                  {detectedFaces.map((f, i) => (
                    <span
                      key={i}
                      className={
                        "face-chip " +
                        (f.status === "known"
                          ? "face-chip-known"
                          : f.status === "low_quality"
                          ? "face-chip-blur"
                          : "face-chip-unknown")
                      }
                    >
                      {f.label || "Unknown"}{" "}
                      {typeof f.similarity === "number"
                        ? `(${(f.similarity * 100).toFixed(0)}%)`
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Luồng sự kiện thời gian thực */}
        <div className="card">
          <div className="alerts-header">
            <div>
              <div className="alerts-title">Sự kiện Nhận diện Gần đây</div>
              <div className="alerts-count">
                Tổng: <b>{events.length}</b> sự kiện trên kênh{" "}
                <code>{cameraId}</code>
              </div>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="live-empty">
              Chưa có sự kiện nào cho camera này. Khi phát hiện người hoặc khuôn
              mặt, sự kiện sẽ hiển thị tức thì tại đây.
            </div>
          ) : (
            <div className="card-list live-events-scroll">
              {events.map((e) => {
                const tsText = formatTimestamp(e.ts);
                const personName = e.person_id || "Unknown";
                const isKnown = personName !== "Unknown";
                const confStr = formatConfidence(e.confidence);
                const alertDisp = getAlertDisplay(e.alert_type, personName);
                const snapFullUrl = resolveSnapshotUrl(e.snapshot_url);
                const bboxText = formatBbox(e.bbox);

                return (
                  <div
                    key={e.evt_id || e.id || e.ts}
                    className="event-card event-card-interactive"
                  >
                    {snapFullUrl && (
                      <img
                        src={snapFullUrl}
                        alt={personName}
                        className="event-thumb"
                        loading="lazy"
                        onClick={() => openEventModal(e)}
                      />
                    )}
                    <div className="event-body">
                      <div className="event-title-row">
                        <span
                          className={
                            "person-badge " +
                            (isKnown
                              ? "person-badge-known"
                              : "person-badge-unknown")
                          }
                        >
                          {isKnown ? `👤 ${personName}` : "🚨 Unknown"}
                        </span>
                        {confStr && (
                          <span className="conf-badge" title="Độ tin cậy / Cosine Similarity">
                            Độ khớp: {confStr}
                          </span>
                        )}
                      </div>

                      <div className="event-time">{tsText}</div>

                      <div className="event-meta">
                        Camera: <b>{e.camera_id || cameraId}</b>
                        {e.source ? ` · Nguồn: ${e.source}` : ""}
                        {bboxText ? ` · BBox: ${bboxText}` : ""}
                      </div>

                      <div
                        className="event-alert"
                        style={{ color: alertDisp.color }}
                      >
                        {alertDisp.text}
                      </div>

                      <div className="alert-actions">
                        <button
                          type="button"
                          className="btn-sm btn-warning"
                          onClick={() => handleBuzz(e.camera_id || cameraId)}
                        >
                          🔔 Kêu còi 2s
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          onClick={() => openEventModal(e)}
                        >
                          🔍 Chi tiết
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal xem chi tiết sự kiện (<dialog closedby="any">) */}
      <dialog
        ref={dialogRef}
        {...{ closedby: "any" }}
        aria-labelledby={dialogTitleId}
        className="event-dialog"
      >
        {selectedEvent && (
          <div className="event-dialog-content">
            <div className="event-dialog-header">
              <h2 id={dialogTitleId} className="event-dialog-title">
                Chi tiết Sự kiện Nhận diện
              </h2>
              <form method="dialog">
                <button type="submit" className="btn-secondary btn-sm">
                  ✕ Đóng
                </button>
              </form>
            </div>

            {selectedEvent.snapshot_url && (
              <div className="event-dialog-img-wrap">
                <img
                  src={resolveSnapshotUrl(selectedEvent.snapshot_url)}
                  alt="Snapshot"
                  className="event-dialog-img"
                />
              </div>
            )}

            <div className="event-dialog-grid">
              <div>
                <span className="meta-label">Mã sự kiện (evt_id):</span>
                <code>{selectedEvent.evt_id || selectedEvent.id}</code>
              </div>
              <div>
                <span className="meta-label">Thời gian:</span>
                <b>{formatTimestamp(selectedEvent.ts)}</b>
              </div>
              <div>
                <span className="meta-label">Người nhận diện:</span>
                <b>{selectedEvent.person_id || "Unknown"}</b>
              </div>
              <div>
                <span className="meta-label">Độ tin cậy (Confidence):</span>
                <b>{formatConfidence(selectedEvent.confidence) || "N/A"}</b>
              </div>
              <div>
                <span className="meta-label">Loại cảnh báo:</span>
                <b>
                  {
                    getAlertDisplay(
                      selectedEvent.alert_type,
                      selectedEvent.person_id
                    ).text
                  }
                </b>
              </div>
              <div>
                <span className="meta-label">Camera / Nguồn:</span>
                <b>
                  {selectedEvent.camera_id} ({selectedEvent.source || "esp32"})
                </b>
              </div>
              {formatBbox(selectedEvent.bbox) && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span className="meta-label">Tọa độ Bounding Box:</span>
                  <code>{formatBbox(selectedEvent.bbox)}</code>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
