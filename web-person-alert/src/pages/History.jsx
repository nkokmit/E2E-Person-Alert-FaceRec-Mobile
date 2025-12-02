import { useEffect, useState } from "react";
import { API_BASE, authHeader } from "../api";

export default function History(){
  const [list,setList] = useState([]);

  useEffect(()=>{
    fetch(API_BASE+"/events/recent",{ headers: authHeader() })
      .then(r=>r.json()).then(setList);
  },[]);

  return (
    <div style={{padding:20}}>
      <h2>History</h2>
      {list.map(e=>(
        <div key={e.id} style={{border:"1px solid #ccc",marginBottom:10,padding:10}}>
          <img src={API_BASE+e.snapshot_url} alt="" style={{width:160}}/>
          <div>{e.camera_id}</div>
          <div>{ new Date(e.ts*1000).toLocaleString() }</div>
        </div>
      ))}
    </div>
  );
}
