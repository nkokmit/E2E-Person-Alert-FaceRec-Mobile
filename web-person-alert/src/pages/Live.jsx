import { useEffect, useState } from "react";
import { API_BASE } from "../api";

async function buzz(cameraId){
  const token = localStorage.getItem("token");
  const fd = new FormData();
  fd.append("camera_id", cameraId);
  fd.append("duration_ms", "2000");
  const r = await fetch(API_BASE+"/buzz", {
    method: "POST",
    headers: { ...(token ? { "Authorization": "Bearer "+token } : {}) },
    body: fd
  });
  if(!r.ok) throw new Error("Buzz failed");
}

export default function Live(){
  const [list, setList] = useState([]);
  const [tick, setTick] = useState(0);
  const cameraId = "front_gate";

  useEffect(()=>{
    // WS: nhận cảnh báo YOLO
    const ws = new WebSocket(API_BASE.replace("http","ws")+"/stream");
    ws.onmessage = (ev)=>{
      try{
        const obj = JSON.parse(ev.data);
        if(obj.type==="person_event" && obj.payload){
          setList(l=>[obj.payload, ...l].slice(0, 100));
        }
      } catch(e){}
    };
    // Poll ảnh mới nhất để “giả live”
    const t = setInterval(()=>setTick(t=>t+1), 400); // ~2.5 fps (tăng/giảm tùy LAN)
    return ()=>{ ws.close(); clearInterval(t); };
  },[]);

  return (
    <div style={{padding:20}}>
      <h2>Live</h2>

      {/* Preview liên tục: polling frame mới nhất */}
      <div style={{marginBottom:12}}>
        <img
          src={`${API_BASE}/preview/latest?camera_id=${cameraId}&t=${tick}`}
          alt="live"
          style={{width:480, border:"1px solid #ccc"}}
        />
      </div>

      <h3>Alerts</h3>
      {list.map(e=>(
        <div key={e.evt_id} style={{border:"1px solid #ccc",marginBottom:10,padding:10, display:"flex", gap:12}}>
          <img src={API_BASE+e.snapshot_url} alt="" style={{width:160}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600}}>{e.camera_id}</div>
            <div style={{color:"#666"}}>{new Date(e.ts*1000).toLocaleString()}</div>
            <button onClick={()=>buzz(e.camera_id)}>Buzz 2s</button>
          </div>
        </div>
      ))}
    </div>
  );
}
