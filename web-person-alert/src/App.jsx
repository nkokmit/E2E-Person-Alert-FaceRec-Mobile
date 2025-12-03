// App.jsx
import { useState,useEffect  } from "react";
import Login from "./pages/Login";
import Live from "./pages/Live";
import History from "./pages/History";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("live");
  // KHÔNG lấy token từ localStorage nữa, khởi tạo luôn là null
  const [token, setToken] = useState(null);

  // Mỗi lần app load (npm run dev / F5) -> xóa token cũ đi
  useEffect(() => {
    localStorage.removeItem("token");
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  // Chưa đăng nhập -> chỉ hiển thị màn Login
  if (!token) {
    return (
      <Login
        onSuccess={(newToken) => {
          // vẫn lưu token để các API khác dùng authHeader
          localStorage.setItem("token", newToken);
          setToken(newToken);
        }}
      />
    );
  }

  // Đã đăng nhập -> hiện Live / History
  return (
    <div className="app-shell">
      {/* Thanh tab đơn giản */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 24px",
          borderBottom: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <button
          onClick={() => setTab("live")}
          style={{
            borderRadius: 999,
            paddingInline: 16,
            paddingBlock: 6,
            border:
              tab === "live" ? "1px solid #2563eb" : "1px solid transparent",
            backgroundColor: tab === "live" ? "#2563eb" : "#e5e7eb",
            color: tab === "live" ? "#ffffff" : "#111827",
          }}
        >
          Trực tiếp
        </button>
        <button
          onClick={() => setTab("history")}
          style={{
            borderRadius: 999,
            paddingInline: 16,
            paddingBlock: 6,
            border:
              tab === "history" ? "1px solid #2563eb" : "1px solid transparent",
            backgroundColor: tab === "history" ? "#2563eb" : "#e5e7eb",
            color: tab === "history" ? "#ffffff" : "#111827",
          }}
        >
          Lịch sử
        </button>

        {/* Nút Đăng xuất */}
        <button
          onClick={handleLogout}
          style={{
            marginLeft: "auto", // Đẩy nút về phía bên phải
            borderRadius: 999,
            paddingInline: 16,
            paddingBlock: 6,
            border: "1px solid #dc2626", // Border màu đỏ
            backgroundColor: "#ef4444", // Màu đỏ
            color: "#ffffff",
            fontSize: "0.9rem",
          }}
        >
          Đăng xuất
        </button>
      </div>

      {tab === "live" && <Live />}
      {tab === "history" && <History />}
    </div>
  );
}