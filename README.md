# E2E-Person-Alert-FaceRec-Mobile (`web-person-alert`)

Ứng dụng giao diện Web / Mobile Dashboard (React 19 + Vite) kết nối trực tiếp với **[E2E-Person-Alert-FaceRec-Server](../E2E-Person-Alert-FaceRec-Server)** để giám sát camera thời gian thực, nhận diện khuôn mặt (**SCRFD + MobileFaceNet/ArcFace 512-D**), phát hiện người (**YOLOv8n**), điều khiển còi báo động và tra cứu lịch sử sự kiện.

---

## Tính năng chính (Đồng bộ với Server mới nhất)

1. **Xác thực & Quản lý Kết nối Máy chủ (`/auth/login`, `/auth/register`)**:
   - Hỗ trợ **Đăng nhập** (`POST /auth/login` JSON) và **Đăng ký tài khoản** (`POST /auth/register` `FormData`).
   - Cho phép cấu hình linh hoạt địa chỉ `API_BASE` ngay trên màn hình đăng nhập (tự động nhận diện `localhost:8000` hoặc IP LAN khi truy cập từ điện thoại).
   - Tự động đính kèm `Authorization: Bearer <token>` cho toàn bộ REST API bảo vệ (`/events`, `/events/recent`, `/events/{evt_id}`, `/buzz`, `/stream/start`, `/stream/stop`).

2. **Giám sát Trực tiếp & WebSocket Thời gian thực (`Live.jsx`)**:
   - Kết nối tới WebSocket `/ws/alerts` của `ConnectionManager` trên server:
     - Tự động gửi gói đăng ký lọc kênh camera: `{"type": "subscribe", "cameras": ["front_gate"]}`.
     - Tương thích hoàn toàn với cơ chế **Heartbeat Ping/Pong** (`15s/45s`) của server và tự động kết nối lại (auto-reconnect) khi mất mạng.
   - Hiển thị đầy đủ thông tin nhận diện khuôn mặt & phát hiện người từ `SnapshotWorker`:
     - **Danh tính (`person_id`)**: Phân biệt rõ **Người quen (`Known` - nhãn xanh)** và **Người lạ (`Unknown` - nhãn đỏ)**.
     - **Độ tin cậy (`confidence`)**: Hiển thị phần trăm tương đồng Cosine (`ArcFace`) hoặc điểm tin cậy `YOLOv8`.
     - **Phân loại cảnh báo (`alert_type`)**: Hỗ trợ đầy đủ 5 trạng thái từ server: `face_known`, `face_unknown`, `person_alert`, `yellow` ($\ge 15\text{s}$), `red` ($\ge 60\text{s}$).
     - **Danh sách khuôn mặt trong khung hình (`all_faces`)**: Hiển thị từng khuôn mặt kèm trạng thái (`known`, `unknown`, `low_quality`) và độ tương đồng.
   - Tích hợp nút **📤 Gửi ảnh test (`/snapshot`)** để tải ảnh trực tiếp lên `POST /snapshot` (`camera_id`, `token`, `file`) phục vụ kiểm thử nhanh pipeline AI.

3. **Lịch sử & Tra cứu Đa điều kiện (`History.jsx`)**:
   - Tích hợp endpoint phân trang & lọc `GET /events` của server:
     - Lọc theo tên người nhận diện (`person_id`, vd: `Hung`, `Alice`, `Unknown`).
     - Lọc theo kênh camera (`camera_id`, vd: `front_gate`, `back_door`).
     - Lọc theo loại cảnh báo (`alert_type`: `face_known`, `face_unknown`, `person_alert`, `yellow`, `red`).
     - Lọc theo khoảng thời gian (`start_ts`, `end_ts`).
     - Phân trang (`page`, `page_size`, `total`, `total_pages`).
   - Xem chi tiết từng sự kiện (`GET /events/{evt_id}`) trong hộp thoại `<dialog closedby="any">` với ảnh chụp đã vẽ sẵn Bounding Box, 5 điểm mốc khuôn mặt (Landmarks) và thanh thông tin OSD từ server.

---

## Hướng dẫn Chạy Ứng dụng

```bash
cd web-person-alert
npm install

# Chạy môi trường phát triển (mở cho cả LAN/Mobile với --host)
npm run dev -- --host

# Kiểm tra lint & build production
npm run lint
npm run build
```
