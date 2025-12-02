import { useState } from "react";
import Login from "./pages/Login";
import Live from "./pages/Live";
import History from "./pages/History";

export default function App(){
  const [tab,setTab]=useState("live");
  const token = localStorage.getItem("token");

  if(!token) return <Login onSuccess={()=>window.location.reload()}/>;

  return (
    <div>
      <div style={{display:"flex",gap:10,padding:10}}>
        <button onClick={()=>setTab("live")}>Live</button>
        <button onClick={()=>setTab("history")}>History</button>
      </div>
      {tab==="live" && <Live/>}
      {tab==="history" && <History/>}
    </div>
  )
}
