import { useState } from "react";
import { API_BASE } from "../api";

export default function Login({ onSuccess }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(null);

  const submit = async () => {
    try {
      setErr(null);
      const r = await fetch(API_BASE+"/auth/login", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ username:u, password:p })
      });
      if(!r.ok) throw new Error();
      const data = await r.json();
      localStorage.setItem("token", data.token);
      onSuccess();
    } catch(e){
      setErr("Login fail");
    }
  }

  return (
    <div style={{padding:20}}>
      <h2>Mini Alerts</h2>
      <input placeholder="username" value={u} onChange={e=>setU(e.target.value)}/>
      <br/>
      <input type="password" placeholder="password" value={p} onChange={e=>setP(e.target.value)}/>
      <br/>
      {err && <div style={{color:"red"}}>{err}</div>}
      <button onClick={submit}>Login</button>
    </div>
  );
}
