function renderShop(){
  const st=window.__STATE||{};
  const shops=st.shops||{};
  const feat=(st.settings?.features)||{shop:true,intel:true};
  if(!feat.shop){
    document.getElementById("shopEnabledPill").textContent = "Shop: Disabled";
    document.getElementById("shopPill").textContent = "Shop: --";
    document.getElementById("shopBody").innerHTML = '<tr><td colspan="7" class="mini">Shop feature is disabled.</td></tr>';
    return;
  }
  const enabled=!!shops.enabled;
  document.getElementById("shopEnabledPill").textContent = enabled ? "Shop: Enabled" : "Shop: Disabled";
  document.getElementById("shopPill").textContent = "Shop: " + (shops.list?.find(s=>s.id===shops.activeShopId)?.name || "--");
  const sel=document.getElementById("shopSel");
  sel.innerHTML="";
  (shops.list||[]).forEach(s=>{
    const o=document.createElement("option"); o.value=s.id; o.textContent=s.name;
    if(s.id===shops.activeShopId) o.selected=true;
    sel.appendChild(o);
  });
  sel.onchange = async ()=>{
    if(SESSION.role!=="dm"){ toast("DM only"); sel.value=shops.activeShopId; return; }
    shops.activeShopId = sel.value;
    await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
    toast("Active shop set"); await refreshAll();
  };
  // DM buttons
  document.getElementById("toggleShopBtn").onclick = async ()=>{
    if(SESSION.role!=="dm") return;
    shops.enabled = !shops.enabled;
    await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
    toast("Shop toggled"); await refreshAll();
  };
  document.getElementById("addShopBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;

  const n = await vwModalInput({
    title: "New Shop",
    label: "Shop name",
    placeholder: "e.g. Riverside Armory"
  });
  if(!n) return;

  const id=("s_"+Math.random().toString(36).slice(2,8));
  shops.list ||= [];
  shops.list.push({id:id, name:n, items:[]});
  shops.activeShopId=id;

  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Shop created"); await refreshAll();
  };
  document.getElementById("editShopBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;

  const curr=(shops.list||[]).find(s=>s.id===shops.activeShopId);
  if(!curr) return;

  const n = await vwModalInput({
    title: "Rename Shop",
    label: "Shop name",
    value: curr.name,
    placeholder: "Shop name"
  });
  if(!n) return;

  curr.name=n;
  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Shop renamed"); await refreshAll();
  };
  const body=document.getElementById("shopBody");
  body.innerHTML="";
  if(!enabled && SESSION.role!=="dm"){
    body.innerHTML = '<tr><td colspan="7" class="mini">Shop is currently disabled.</td></tr>';
    return;
  }
  const shop=(shops.list||[]).find(s=>s.id===shops.activeShopId);
  if(!shop){
    body.innerHTML = '<tr><td colspan="7" class="mini">No shop selected.</td></tr>';
    return;
  }
  (shop.items||[]).forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+esc(it.name)+'</td><td>'+esc(it.category||"")+'</td><td>$'+esc(it.cost||"")+'</td>'+
      '<td>'+esc(it.weight||"")+'</td><td>'+esc(it.notes||"")+'</td><td>'+esc(it.stock||"∞")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    if(SESSION.role==="dm"){
      td.innerHTML = '<button class="btn smallbtn">Edit</button> <button class="btn smallbtn">Del</button>';
      const [editBtn,delBtn]=td.querySelectorAll("button");
      editBtn.onclick = async ()=>{
  const result = await vwModalForm({
    title: "Edit Item",
    fields: [
      { key:"name",     label:"Item name", value: it.name || "", placeholder:"Flashlight" },
      { key:"category", label:"Category",  value: it.category || "", placeholder:"Gear" },
      { key:"cost",     label:"Cost ($)",  value: String(it.cost ?? ""), placeholder:"35" },
      { key:"weight",   label:"Weight",    value: String(it.weight ?? ""), placeholder:"1" },
      { key:"notes",    label:"Notes",     value: it.notes || "", placeholder:"Unique / special" },
      { key:"stock",    label:"Stock (∞ or number)", value: String(it.stock ?? "∞"), placeholder:"∞" },
    ],
    okText: "Save"
  });

  if(!result) return;

  Object.assign(it, {
    name: result.name,
    category: result.category,
    cost: result.cost,
    weight: result.weight,
    notes: result.notes,
    stock: result.stock
  });

  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Item saved"); await refreshAll();
  };

      delBtn.onclick = async ()=>{
  const ok = await vwModalConfirm({
    title: "Delete Item",
    message: 'Delete "' + (it.name || "this item") + '"?'
  });
  if(!ok) return;

  shop.items.splice(idx,1);
  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Item deleted"); await refreshAll();
  };

    } else {
      td.innerHTML = '<button class="btn smallbtn">Add to Inventory</button>';
      td.querySelector("button").onclick=async ()=>{
        const c=getChar();
        if(!c){ toast("Create/select character first"); return; }
        c.inventory ||= [];
        // No duplicates for unique items (very simple rule: if notes contains "Unique")
        const isUnique = String(it.notes||"").toLowerCase().includes("unique");
        if(isUnique && c.inventory.some(x=>String(x.name||"").toLowerCase()===String(it.name||"").toLowerCase())){
          toast("Already owned"); return;
        }
        c.inventory.push({category:it.category||"", name:it.name, weight:String(it.weight||""), qty:"1", cost:String(it.cost||""), notes:it.notes||""});
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        // create notification request for DM
        await api("/api/notify",{method:"POST",body:JSON.stringify({type:"Shop Purchase", detail: it.name + " ($" + it.cost + ")", from: SESSION.name||"Player"})});
        toast("Added to inventory"); await refreshAll();
      };
    }
    body.appendChild(tr);
  });

  if(SESSION.role==="dm"){
    const tr=document.createElement("tr");
    tr.innerHTML = '<td colspan="7"><button class="btn smallbtn" id="addShopItemBtn">Add Item</button></td>';
    body.appendChild(tr);
    tr.querySelector("#addShopItemBtn").onclick = async ()=>{
  const result = await vwModalForm({
    title: "Add Item",
    fields: [
      { key:"name",     label:"Item name", value:"", placeholder:"Flashlight" },
      { key:"category", label:"Category",  value:"Gear", placeholder:"Gear" },
      { key:"cost",     label:"Cost ($)",  value:"0", placeholder:"35" },
      { key:"weight",   label:"Weight",    value:"1", placeholder:"1" },
      { key:"notes",    label:"Notes",     value:"", placeholder:"Unique / special" },
      { key:"stock",    label:"Stock (∞ or number)", value:"∞", placeholder:"∞" },
    ],
    okText: "Add"
  });

  if(!result || !result.name) return;

  shop.items ||= [];
  shop.items.push({
    id:"i_"+Math.random().toString(36).slice(2,8),
    name: result.name,
    category: result.category,
    cost: result.cost,
    weight: result.weight,
    notes: result.notes,
    stock: result.stock
  });

  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Item added"); await refreshAll();
  };
  }
}

