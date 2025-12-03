import { useEffect, useState } from "react";
import { API_BASE, authHeader } from "../api";

export default function History() {
  const [list, setList] = useState([]);

  useEffect(() => {
    fetch(API_BASE + "/events/recent", { headers: authHeader() })
      .then((r) => r.json())
      .then(setList)
      .catch((e) => console.error(e));
  }, []);

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử cảnh báo</h1>
          <p className="page-subtitle">
            Danh sách các sự kiện đã ghi nhận từ camera.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <p className="page-subtitle">
            Chưa có sự kiện nào. Khi hệ thống phát hiện người, ảnh chụp sẽ được
            lưu và hiển thị tại đây.
          </p>
        </div>
      ) : (
        <div className="card card-list">
          {list.map((e) => (
            <div key={e.id} className="event-card">
              <img
                src={API_BASE + e.snapshot_url}
                alt=""
                className="event-thumb"
              />
              <div className="event-body">
                <div className="event-camera">{e.camera_id}</div>
                <div className="event-time">
                  {new Date(e.ts * 1000).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
