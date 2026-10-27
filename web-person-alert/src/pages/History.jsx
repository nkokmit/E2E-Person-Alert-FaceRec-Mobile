import { useEffect, useState, useRef, useId } from "react";
import {
  buzzCamera,
  fetchEventDetail,
  fetchEvents,
  formatConfidence,
  getAlertDisplay,
  resolveSnapshotUrl,
} from "../api";

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

export default function History({ onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bộ lọc (khớp với GET /events trên server)
  const [personFilter, setPersonFilter] = useState("");
  const [cameraFilter, setCameraFilter] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal chi tiết sự kiện (/events/{evt_id})
  const [detailEvent, setDetailEvent] = useState(null);
  const dialogRef = useRef(null);
  const dialogTitleId = useId();

  // Fallback light-dismiss cho <dialog closedby="any">
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

  async function loadPage(targetPage = page) {
    try {
      setLoading(true);
      setError(null);

      const startTs = startDate
        ? Math.floor(new Date(startDate).getTime() / 1000)
        : undefined;
      const endTs = endDate
        ? Math.floor(new Date(endDate).getTime() / 1000)
        : undefined;

      const res = await fetchEvents({
        page: targetPage,
        page_size: pageSize,
        person_id: personFilter,
        camera_id: cameraFilter,
        alert_type: alertTypeFilter,
        start_ts: Number.isNaN(startTs) ? undefined : startTs,
        end_ts: Number.isNaN(endTs) ? undefined : endTs,
      });

      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total || 0);
      setPage(res.page || targetPage);
      setTotalPages(res.total_pages || 0);
    } catch (e) {
      if (e?.status === 401 && onUnauthorized) {
        onUnauthorized();
        return;
      }
      setError(e?.message || "Không thể tải danh sách sự kiện");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleSearch = (e) => {
    e?.preventDefault();
    if (page === 1) {
      loadPage(1);
    } else {
      setPage(1);
    }
  };

  const handleResetFilters = () => {
    setPersonFilter("");
    setCameraFilter("");
    setAlertTypeFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    setTimeout(() => loadPage(1), 0);
  };

  const handleOpenDetail = async (evItem) => {
    setDetailEvent(evItem);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
    if (evItem.evt_id) {
      try {
        const fresh = await fetchEventDetail(evItem.evt_id);
        if (fresh) setDetailEvent(fresh);
      } catch {}
    }
  };

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử Cảnh báo & Tra cứu Nhận diện</h1>
          <p className="page-subtitle">
            Truy vấn lịch sử sự kiện từ SQLite (<code>GET /events</code>) với bộ
            lọc theo người nhận diện, camera, loại cảnh báo và khoảng thời gian.
          </p>
        </div>
        <div className="history-summary-pill">
          Tổng cộng: <b>{total}</b> bản ghi
        </div>
      </div>

      {/* Bộ lọc tra cứu */}
      <form className="card filter-card" onSubmit={handleSearch}>
        <div className="filter-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="filter-person">
              Người nhận diện (person_id)
            </label>
            <input
              id="filter-person"
              placeholder="VD: Hung, Alice, Unknown..."
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="filter-camera">
              Kênh Camera (camera_id)
            </label>
            <input
              id="filter-camera"
              placeholder="VD: front_gate, back_door..."
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="filter-alert-type">
              Loại cảnh báo (alert_type)
            </label>
            <select
              id="filter-alert-type"
              className="select-input"
              value={alertTypeFilter}
              onChange={(e) => setAlertTypeFilter(e.target.value)}
            >
              <option value="">-- Tất cả loại cảnh báo --</option>
              <option value="face_known">✅ Người quen (face_known)</option>
              <option value="face_unknown">🚨 Người lạ (face_unknown)</option>
              <option value="person_alert">🚶 Phát hiện người (person_alert)</option>
              <option value="yellow">⚠️ Cảnh báo vàng (&gt;= 15s)</option>
              <option value="red">🔴 Cảnh báo đỏ (&gt;= 60s)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="filter-start">
              Từ thời gian
            </label>
            <input
              id="filter-start"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="filter-end">
              Đến thời gian
            </label>
            <input
              id="filter-end"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="filter-page-size">
              Số dòng / trang
            </label>
            <select
              id="filter-page-size"
              className="select-input"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10 sự kiện</option>
              <option value={12}>12 sự kiện</option>
              <option value={20}>20 sự kiện</option>
              <option value={50}>50 sự kiện</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Đang tải..." : "🔎 Lọc kết quả"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetFilters}
          >
            ↺ Đặt lại bộ lọc
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadPage(page)}
          >
            🔄 Làm mới
          </button>
        </div>
      </form>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#fca5a5" }}>
          <div className="error-text">{error}</div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card">
          <p className="page-subtitle" style={{ margin: 0 }}>
            {loading
              ? "Đang tải dữ liệu sự kiện từ máy chủ..."
              : "Không tìm thấy sự kiện nào khớp với bộ lọc hiện tại."}
          </p>
        </div>
      ) : (
        <div className="history-grid">
          {items.map((e) => {
            const personName = e.person_id || "Unknown";
            const isKnown = personName !== "Unknown";
            const confStr = formatConfidence(e.confidence);
            const alertDisp = getAlertDisplay(e.alert_type, personName);
            const snapUrl = resolveSnapshotUrl(e.snapshot_url);
            const bboxStr = formatBbox(e.bbox);

            return (
              <div key={e.evt_id || e.id} className="card history-item-card">
                <div
                  className="history-thumb-wrap"
                  onClick={() => handleOpenDetail(e)}
                >
                  {snapUrl ? (
                    <img
                      src={snapUrl}
                      alt={personName}
                      className="history-thumb-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="history-thumb-empty">Không có ảnh</div>
                  )}
                  <span
                    className={"history-alert-tag " + alertDisp.pillClass}
                  >
                    {alertDisp.shortText}
                  </span>
                </div>

                <div className="history-item-body">
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
                      <span className="conf-badge">Độ khớp: {confStr}</span>
                    )}
                  </div>

                  <div className="event-time">
                    🕒{" "}
                    {typeof e.ts === "number"
                      ? new Date(e.ts * 1000).toLocaleString("vi-VN")
                      : e.ts}
                  </div>

                  <div className="event-meta">
                    📹 Camera: <b>{e.camera_id}</b> · Nguồn:{" "}
                    <b>{e.source || "esp32"}</b>
                  </div>

                  {bboxStr && (
                    <div className="event-meta">
                      📐 BBox: <code>{bboxStr}</code>
                    </div>
                  )}

                  <div className="alert-actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      onClick={() => handleOpenDetail(e)}
                    >
                      🔍 Xem chi tiết
                    </button>
                    <button
                      type="button"
                      className="btn-sm btn-warning"
                      onClick={() =>
                        buzzCamera(e.camera_id || "front_gate", 2000).catch(
                          (err) => alert(err.message)
                        )
                      }
                    >
                      🔔 Còi 2s
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trang trước
          </button>
          <span className="pagination-info">
            Trang <b>{page}</b> / <b>{totalPages}</b> ({total} sự kiện)
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Trang sau →
          </button>
        </div>
      )}

      {/* Modal chi tiết sự kiện (<dialog closedby="any">) */}
      <dialog
        ref={dialogRef}
        {...{ closedby: "any" }}
        aria-labelledby={dialogTitleId}
        className="event-dialog"
      >
        {detailEvent && (
          <div className="event-dialog-content">
            <div className="event-dialog-header">
              <h2 id={dialogTitleId} className="event-dialog-title">
                Chi tiết Sự kiện #{detailEvent.id || ""}
              </h2>
              <form method="dialog">
                <button type="submit" className="btn-secondary btn-sm">
                  ✕ Đóng
                </button>
              </form>
            </div>

            {detailEvent.snapshot_url && (
              <div className="event-dialog-img-wrap">
                <img
                  src={resolveSnapshotUrl(detailEvent.snapshot_url)}
                  alt="Snapshot"
                  className="event-dialog-img"
                />
              </div>
            )}

            <div className="event-dialog-grid">
              <div>
                <span className="meta-label">Mã sự kiện (evt_id):</span>
                <code>{detailEvent.evt_id}</code>
              </div>
              <div>
                <span className="meta-label">Thời gian:</span>
                <b>
                  {typeof detailEvent.ts === "number"
                    ? new Date(detailEvent.ts * 1000).toLocaleString("vi-VN")
                    : detailEvent.ts}
                </b>
              </div>
              <div>
                <span className="meta-label">Người nhận diện (person_id):</span>
                <b>{detailEvent.person_id || "Unknown"}</b>
              </div>
              <div>
                <span className="meta-label">Độ tin cậy (Confidence):</span>
                <b>{formatConfidence(detailEvent.confidence) || "N/A"}</b>
              </div>
              <div>
                <span className="meta-label">Loại cảnh báo:</span>
                <b>
                  {
                    getAlertDisplay(
                      detailEvent.alert_type,
                      detailEvent.person_id
                    ).text
                  }
                </b>
              </div>
              <div>
                <span className="meta-label">Camera / Nguồn:</span>
                <b>
                  {detailEvent.camera_id} ({detailEvent.source || "esp32"})
                </b>
              </div>
              {formatBbox(detailEvent.bbox) && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span className="meta-label">Tọa độ Bounding Box:</span>
                  <code>{formatBbox(detailEvent.bbox)}</code>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
