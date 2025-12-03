import { useState } from "react";
import { API_BASE } from "../api";

export default function Login({ onSuccess }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    try {
      setErr(null);
      setLoading(true);
      const r = await fetch(API_BASE + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();

      onSuccess(data.token);
    } catch (e) {
      setErr("Đăng nhập thất bại. Vui lòng kiểm tra lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-login">
      <div className="card login-card">
        <div className="app-brand">HỆ THỐNG GIÁM SÁT</div>
        <div className="app-name">Mini Alerts</div>
        <p className="app-description">
          Đăng nhập để xem camera trực tiếp, lịch sử cảnh báo và điều khiển
          còi/buzzer.
        </p>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Tên đăng nhập</label>
            <input
              placeholder="Nhập username..."
              value={u}
              onChange={(e) => setU(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input
              type="password"
              placeholder="••••••••"
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </div>

          {err && <div className="error-text">{err}</div>}

          <div style={{ marginTop: "0.9rem" }}>
            <button type="submit" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
