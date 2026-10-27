import { useState } from "react";
import {
  DEFAULT_API_BASE,
  getApiBase,
  loginUser,
  registerUser,
  setApiBase,
} from "../api";

export default function Login({ onSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [serverUrl, setServerUrl] = useState(() => getApiBase());
  const [showServerCfg, setShowServerCfg] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    const cleanUser = u.trim();
    if (!cleanUser || !p) {
      setErr("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    try {
      setErr(null);
      setLoading(true);
      setApiBase(serverUrl);

      const data =
        mode === "register"
          ? await registerUser(cleanUser, p)
          : await loginUser(cleanUser, p);

      onSuccess(data.token, data.username || cleanUser);
    } catch (error) {
      setErr(
        error?.message ||
          (mode === "register"
            ? "Đăng ký thất bại. Vui lòng thử tên tài khoản khác."
            : "Đăng nhập thất bại. Vui lòng kiểm tra tài khoản hoặc kết nối Server.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-login">
      <div className="card login-card">
        <div className="app-brand">E2E PERSON ALERT & FACEREC</div>
        <div className="app-name">Hệ thống Giám sát AI</div>
        <p className="app-description">
          Phát hiện người (YOLOv8), nhận diện khuôn mặt (SCRFD + ArcFace 512-D)
          và cảnh báo thời gian thực qua WebSocket.
        </p>

        <div className="auth-mode-tabs">
          <button
            type="button"
            className={
              "auth-tab-btn " + (mode === "login" ? "auth-tab-active" : "")
            }
            onClick={() => {
              setMode("login");
              setErr(null);
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={
              "auth-tab-btn " + (mode === "register" ? "auth-tab-active" : "")
            }
            onClick={() => {
              setMode("register");
              setErr(null);
            }}
          >
            Đăng ký tài khoản
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              Tên đăng nhập
            </label>
            <input
              id="login-username"
              autoComplete="username"
              placeholder="Nhập username (vd: admin)..."
              value={u}
              onChange={(e) => setU(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Mật khẩu
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              placeholder="••••••••"
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </div>

          <div className="server-config-toggle">
            <button
              type="button"
              className="btn-link"
              onClick={() => setShowServerCfg((v) => !v)}
            >
              ⚙️ Máy chủ API: <code>{serverUrl || DEFAULT_API_BASE}</code>
            </button>
          </div>

          {showServerCfg && (
            <div className="form-group server-config-box">
              <label className="form-label" htmlFor="server-url-input">
                Địa chỉ FastAPI Server (LAN / Localhost)
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  id="server-url-input"
                  placeholder="http://localhost:8000"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setServerUrl(DEFAULT_API_BASE)}
                  title="Khôi phục mặc định"
                >
                  Mặc định
                </button>
              </div>
            </div>
          )}

          {err && <div className="error-text">{err}</div>}

          <div style={{ marginTop: "1rem" }}>
            <button type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading
                ? "Đang xử lý..."
                : mode === "register"
                ? "Tạo tài khoản & Đăng nhập"
                : "Đăng nhập"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
