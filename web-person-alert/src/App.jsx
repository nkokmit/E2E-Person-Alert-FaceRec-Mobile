import { useState } from "react";
import Login from "./pages/Login";
import Live from "./pages/Live";
import History from "./pages/History";
import { getApiBase } from "./api";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("live");
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [username, setUsername] = useState(
    () => localStorage.getItem("username") || ""
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUsername("");
  };

  if (!token) {
    return (
      <Login
        onSuccess={(newToken, user) => {
          localStorage.setItem("token", newToken);
          if (user) localStorage.setItem("username", user);
          setToken(newToken);
          setUsername(user || "");
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-brand">
          <span className="brand-dot" />
          <span className="brand-title">E2E FaceRec Alert</span>
        </div>

        <nav className="app-topbar-nav">
          <button
            type="button"
            onClick={() => setTab("live")}
            className={
              "nav-tab-btn " + (tab === "live" ? "nav-tab-active" : "")
            }
          >
            📹 Trực tiếp (Live)
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={
              "nav-tab-btn " + (tab === "history" ? "nav-tab-active" : "")
            }
          >
            🗂️ Lịch sử & Tra cứu
          </button>
        </nav>

        <div className="app-topbar-right">
          <span className="server-badge" title="Địa chỉ Server đang kết nối">
            {getApiBase()}
          </span>
          {username && <span className="user-badge">👤 {username}</span>}
          <button
            type="button"
            onClick={handleLogout}
            className="btn-danger btn-sm"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {tab === "live" && <Live onUnauthorized={handleLogout} />}
      {tab === "history" && <History onUnauthorized={handleLogout} />}
    </div>
  );
}
