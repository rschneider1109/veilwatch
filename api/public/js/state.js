// State container + helpers (kept minimal to avoid logic changes)
window.__STATE = window.__STATE || {};

function vwSetState(st){ window.__STATE = st || {}; return window.__STATE; }
window.vwSetState = vwSetState;

function renderSettings(){
  const st=window.__STATE||{};
  if(SESSION.role!=="dm") return;

  const btnExp=document.getElementById("exportStateBtn");
  if(btnExp) btnExp.onclick = async ()=>{
    const r = await fetch("/api/state/export", { headers: { "X-DM-Key": SESSION.dmKey }});
    const txt = await r.text();
    // show in modal textarea for easy copy
    await vwModalForm({ title:"Export State (copy)", fields:[{key:"json",label:"State JSON",value:txt,type:"textarea"}], okText:"Close", cancelText:"Close" });
  };

  const btnImp=document.getElementById("importStateBtn");
  if(btnImp) btnImp.onclick = async ()=>{
    const result = await vwModalForm({ title:"Import State", fields:[{key:"json",label:"Paste JSON to import",value:"",type:"textarea"}], okText:"Import" });
    if(!result) return;
    const ok = await vwModalConfirm({ title:"Confirm Import", message:"Import will overwrite the current state. Continue?" });
    if(!ok) return;
    const res = await api("/api/state/import",{method:"POST",body:JSON.stringify({json: result.json})});
    if(res.ok){ toast("Imported"); await refreshAll(); } else toast(res.error||"Import failed");
  };

  const btnReset=document.getElementById("resetStateBtn");
  if(btnReset) btnReset.onclick = async ()=>{
    const ok = await vwModalConfirm({ title:"Reset State", message:"This resets all shops/characters/clues/notifications. Continue?" });
    if(!ok) return;
    const res = await api("/api/state/reset",{method:"POST"});
    if(res.ok){ toast("Reset"); await refreshAll(); } else toast(res.error||"Failed");
  };

  const btnKey=document.getElementById("saveDmKeyBtn");
  if(btnKey) btnKey.onclick = async ()=>{
    const nk = (document.getElementById("dmKeyNew").value||"").trim();
    if(!nk) return toast("Enter a new key");
    const res = await api("/api/settings/save",{method:"POST",body:JSON.stringify({dmKey:nk})});
    if(res.ok){ toast("DM key saved"); SESSION.dmKey = nk; await refreshAll(); }
    else toast(res.error||"Failed");
  };
}

