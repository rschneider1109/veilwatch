(function(){
  const CART_STORAGE_KEY = "vwShopCartsV1";
  const DM_TARGET_STORAGE_KEY = "vwShopDmTargetV1";

  function getShopState(){
    const st = window.__STATE || {};
    st.shops ||= { enabled:true, activeShopId:"", list:[] };
    st.shops.list ||= [];
    return st.shops;
  }

  function getActiveShop(){
    const shops = getShopState();
    return (shops.list || []).find(s => s.id === shops.activeShopId) || (shops.list || [])[0] || null;
  }

  function parseMoney(raw){
    const n = Number(String(raw ?? "").replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function parseIntSafe(raw, fallback=0){
    const n = parseInt(String(raw ?? "").trim(), 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function isInfiniteStock(stock){
    const s = String(stock ?? "").trim().toLowerCase();
    return s === "" || s === "∞" || s === "inf" || s === "infinite";
  }

  function readCarts(){
    try{
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === "object") ? parsed : {};
    }catch(e){
      return {};
    }
  }

  function writeCarts(carts){
    try{ localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carts || {})); }catch(e){}
  }

  function readDmTargetId(){
    try{ return String(localStorage.getItem(DM_TARGET_STORAGE_KEY) || "").trim(); }catch(e){ return ""; }
  }

  function writeDmTargetId(charId){
    try{
      if(charId) localStorage.setItem(DM_TARGET_STORAGE_KEY, String(charId));
      else localStorage.removeItem(DM_TARGET_STORAGE_KEY);
    }catch(e){}
  }

  function getAllCharacters(){
    const st = window.__STATE || {};
    return Array.isArray(st.characters) ? st.characters : [];
  }

  function getShopTargetCharacter(){
    if(SESSION.role === "dm"){
      const wanted = readDmTargetId();
      return getAllCharacters().find(c => String(c.id) === wanted) || null;
    }
    return (typeof getChar === "function") ? getChar() : null;
  }

  function getShopTargetGroups(){
    const st = window.__STATE || {};
    const users = Array.isArray(st.users) ? st.users : [];
    const chars = getAllCharacters().slice();
    const owned = [];
    const unassigned = [];
    chars.forEach(c => {
      const owner = users.find(u => String(u.id) === String(c.ownerUserId || ""));
      const meta = owner ? (owner.name || owner.username || owner.email || "Player") : "Unassigned";
      const row = { value:String(c.id), label:(c.name || "Unnamed Character") + " • " + meta };
      if(owner) owned.push(row);
      else unassigned.push(row);
    });
    owned.sort((a,b)=>a.label.localeCompare(b.label));
    unassigned.sort((a,b)=>a.label.localeCompare(b.label));
    return { owned, unassigned };
  }

  function getCartBucket(charId, shopId){
    const carts = readCarts();
    carts[charId] ||= {};
    carts[charId][shopId] ||= { items: [] };
    return { carts, bucket: carts[charId][shopId] };
  }

  function getCurrentCart(){
    const c = getShopTargetCharacter();
    const shop = getActiveShop();
    if(!c || !shop) return { carts: readCarts(), bucket: { items: [] }, char: c, shop };
    const out = getCartBucket(c.id, shop.id);
    out.char = c;
    out.shop = shop;
    return out;
  }

  function itemCartKey(it){ return String(it.id || it.sourceId || it.name || Math.random()); }
  function itemBundleQty(it){ return Math.max(1, parseIntSafe(it.inventoryQty ?? it.qty ?? 1, 1)); }
  function itemBundleUnit(it){ return String(it.inventoryUnit || "").trim(); }
  function itemStockLeft(it){ return isInfiniteStock(it.stock) ? Infinity : Math.max(0, parseIntSafe(it.stock, 0)); }
  function lineStockLeft(line){
    const shop = getActiveShop();
    if(!shop) return Infinity;
    const item = (shop.items || []).find(x => String(x.id) === String(line.itemId || line.id));
    return item ? itemStockLeft(item) : 0;
  }

  function cartLineDisplayQty(line){
    const totalUnits = Math.max(1, parseIntSafe(line.qty, 1)) * itemBundleQty(line);
    const unit = itemBundleUnit(line);
    return unit ? (totalUnits + " " + unit) : String(totalUnits);
  }

  function addItemToCart(it){
    const c = getShopTargetCharacter();
    if(!c){ toast(SESSION.role === "dm" ? "Select who you are shopping for first" : "Create/select character first"); return; }
    const shop = getActiveShop();
    if(!shop){ toast("No shop selected"); return; }
    if(itemStockLeft(it) <= 0){ toast("Out of stock"); return; }

    const { carts, bucket } = getCartBucket(c.id, shop.id);
    bucket.items ||= [];
    const key = itemCartKey(it);
    let line = bucket.items.find(x => String(x.id) === String(key));
    const currentQty = line ? Math.max(1, parseIntSafe(line.qty, 1)) : 0;
    const proposedQty = currentQty + 1;
    if(itemStockLeft(it) !== Infinity && proposedQty > itemStockLeft(it)){
      toast("Not enough stock");
      return;
    }

    if(line){
      line.qty = proposedQty;
    }else{
      bucket.items.push({
        id: key,
        itemId: it.id || key,
        name: it.name || "Item",
        category: it.category || "",
        cost: parseMoney(it.cost),
        weight: it.weight ?? "",
        notes: it.notes || "",
        stock: it.stock ?? "∞",
        qty: 1,
        inventoryQty: itemBundleQty(it),
        inventoryUnit: itemBundleUnit(it),
        ammo_type: it.ammo_type || "",
      });
    }

    writeCarts(carts);
    renderShopCart();
    toast("Added to cart");
  }

  function updateCartLineQty(lineId, nextQty){
    const c = getShopTargetCharacter();
    const shop = getActiveShop();
    if(!c || !shop) return;
    const { carts, bucket } = getCartBucket(c.id, shop.id);
    bucket.items ||= [];
    const idx = bucket.items.findIndex(x => String(x.id) === String(lineId));
    if(idx < 0) return;
    if(nextQty <= 0){
      bucket.items.splice(idx, 1);
      writeCarts(carts);
      renderShopCart();
      return;
    }
    const line = bucket.items[idx];
    const maxStock = lineStockLeft(line);
    if(maxStock !== Infinity && nextQty > maxStock){
      toast("Not enough stock");
      return;
    }
    line.qty = nextQty;
    writeCarts(carts);
    renderShopCart();
  }

  function clearCurrentCart(showToast){
    const c = getShopTargetCharacter();
    const shop = getActiveShop();
    if(!c || !shop) return;
    const carts = readCarts();
    if(carts[c.id] && carts[c.id][shop.id]){
      carts[c.id][shop.id] = { items: [] };
      writeCarts(carts);
      renderShopCart();
      if(showToast) toast("Cart cleared");
    }
  }

  function renderShopCart(){
    const wrap = document.getElementById("shopCartPanel");
    const body = document.getElementById("shopCartBody");
    const totalEl = document.getElementById("shopCartTotal");
    const statusEl = document.getElementById("shopCartStatus");
    const checkoutBtn = document.getElementById("shopCheckoutBtn");
    const clearBtn = document.getElementById("shopClearCartBtn");
    if(!wrap || !body || !totalEl || !statusEl || !checkoutBtn || !clearBtn) return;

    wrap.classList.remove("hidden");

    const c = getShopTargetCharacter();
    const shop = getActiveShop();
    if(!c){
      body.innerHTML = '<div class="mini">' + (SESSION.role === "dm" ? "Select a character or NPC to shop for." : "Select a character to start shopping.") + '</div>';
      totalEl.textContent = "$0";
      statusEl.textContent = "Cart unavailable";
      checkoutBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }
    if(!shop){
      body.innerHTML = '<div class="mini">No active shop.</div>';
      totalEl.textContent = "$0";
      statusEl.textContent = "Cart unavailable";
      checkoutBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    const { bucket } = getCartBucket(c.id, shop.id);
    const items = Array.isArray(bucket.items) ? bucket.items : [];
    const total = items.reduce((sum, line) => sum + (parseMoney(line.cost) * Math.max(1, parseIntSafe(line.qty, 1))), 0);

    statusEl.textContent = (SESSION.role === 'dm' ? 'DM shopping for ' : 'Shopping as ') + (c.name || 'Character') + ' • ' + (shop.name || 'Shop');

    if(!items.length){
      body.innerHTML = '<div class="mini">Cart is empty. Add a few shelf items and they will stack here.</div>';
      totalEl.textContent = "$0";
      checkoutBtn.disabled = true;
      clearBtn.disabled = true;
    }else{
      body.innerHTML = '';
      items.forEach(line => {
        const row = document.createElement("div");
        row.className = "shop-cart-row";
        row.innerHTML =
          '<div class="shop-cart-main">' +
            '<div class="shop-cart-name">' + esc(line.name) + '</div>' +
            '<div class="mini">' + esc(line.category || "General") + ' • ' + esc(cartLineDisplayQty(line)) + '</div>' +
          '</div>' +
          '<div class="shop-cart-linecost">$' + esc((parseMoney(line.cost) * Math.max(1, parseIntSafe(line.qty,1))).toFixed(2).replace(/\.00$/,"")) + '</div>' +
          '<div class="shop-cart-controls">' +
            '<button class="btn smallbtn shop-qty-btn" data-act="dec">-</button>' +
            '<span class="shop-cart-qty">' + esc(line.qty) + '</span>' +
            '<button class="btn smallbtn shop-qty-btn" data-act="inc">+</button>' +
            '<button class="btn smallbtn shop-remove-btn" data-act="del">Remove</button>' +
          '</div>';

        row.querySelector('[data-act="dec"]').onclick = ()=>updateCartLineQty(line.id, Math.max(0, parseIntSafe(line.qty,1)-1));
        row.querySelector('[data-act="inc"]').onclick = ()=>updateCartLineQty(line.id, parseIntSafe(line.qty,1)+1);
        row.querySelector('[data-act="del"]').onclick = ()=>updateCartLineQty(line.id, 0);
        body.appendChild(row);
      });

      totalEl.textContent = "$" + total.toFixed(2).replace(/\.00$/,"");
      checkoutBtn.disabled = false;
      clearBtn.disabled = false;
    }

    clearBtn.onclick = async ()=>{
      const ok = await vwModalConfirm({ title:"Clear Cart", message:"Remove all items from this cart?" });
      if(!ok) return;
      clearCurrentCart(true);
    };
    checkoutBtn.onclick = checkoutCurrentCart;
  }

  function buildInventoryQtyString(totalQty, unit){ return unit ? (String(totalQty) + ' ' + unit) : String(totalQty); }
  function parseInventoryQtyString(raw){ const m = String(raw ?? '').trim().match(/^(\d+)/); return m ? parseInt(m[1], 10) : parseIntSafe(raw, 0); }
  function isUniqueShopItem(line){ return String(line.notes || '').toLowerCase().includes('unique'); }

  async function checkoutCurrentCart(){
    const c = getShopTargetCharacter();
    const shop = getActiveShop();
    if(!c){ toast(SESSION.role === "dm" ? "Select who you are shopping for first" : "Create/select character first"); return; }
    if(!shop){ toast("No shop selected"); return; }

    const { carts, bucket } = getCartBucket(c.id, shop.id);
    const lines = Array.isArray(bucket.items) ? bucket.items : [];
    if(!lines.length){ toast("Cart is empty"); return; }

    const shopItems = shop.items || [];
    for(const line of lines){
      const current = shopItems.find(x => String(x.id) === String(line.itemId || line.id));
      if(!current){ toast('One or more items are no longer sold here'); return; }
      const stockLeft = itemStockLeft(current);
      if(stockLeft !== Infinity && Math.max(1, parseIntSafe(line.qty,1)) > stockLeft){ toast('Not enough stock for ' + (current.name || 'item')); return; }
      if(isUniqueShopItem(line) && (c.inventory || []).some(x=>String(x.name||'').toLowerCase()===String(line.name||'').toLowerCase())){ toast((line.name || 'Unique item') + ' is already owned'); return; }
    }

    const preview = lines.map(line => '• ' + (line.name || 'Item') + ' × ' + Math.max(1, parseIntSafe(line.qty, 1)) + ' → ' + cartLineDisplayQty(line)).join('<br/>');
    const ok = await vwModalConfirm({
      title: "Checkout Cart",
      message: "Complete checkout and add these items to inventory?<br/><br/>" + preview + '<br/><br/><span class="mini">Money validation is not connected yet in this pass.</span>',
      okText: "Checkout",
      cancelText: "Back"
    });
    if(!ok) return;

    c.inventory ||= [];
    const grouped = new Map();
    lines.forEach(line => {
      const bundles = Math.max(1, parseIntSafe(line.qty, 1));
      const totalQty = bundles * itemBundleQty(line);
      const groupKey = [String(line.name || '').toLowerCase(), String(line.category || '').toLowerCase(), String(line.notes || '').toLowerCase(), String(line.weight || ''), String(line.cost || ''), String(line.inventoryUnit || '').toLowerCase(), String(line.ammo_type || '').toLowerCase()].join('|');
      const existing = grouped.get(groupKey) || { category: line.category || '', name: line.name || 'Item', weight: String(line.weight ?? ''), qtyValue: 0, cost: String(line.cost ?? ''), notes: line.notes || '', inventoryUnit: itemBundleUnit(line), ammo_type: line.ammo_type || '' };
      existing.qtyValue += totalQty;
      grouped.set(groupKey, existing);
    });

    grouped.forEach(entry => {
      const invMatch = (c.inventory || []).find(item =>
        String(item.name || '').toLowerCase() === String(entry.name || '').toLowerCase() &&
        String(item.category || '').toLowerCase() === String(entry.category || '').toLowerCase() &&
        String(item.notes || '').toLowerCase() === String(entry.notes || '').toLowerCase() &&
        String(item.weight || '') === String(entry.weight || '') &&
        String(item.ammo_type || '').toLowerCase() === String(entry.ammo_type || '').toLowerCase()
      );
      if(invMatch){
        const currentQty = parseInventoryQtyString(invMatch.qty);
        invMatch.qty = buildInventoryQtyString(currentQty + entry.qtyValue, entry.inventoryUnit);
        if(entry.ammo_type && !invMatch.ammo_type) invMatch.ammo_type = entry.ammo_type;
      }else{
        c.inventory.push({ category: entry.category, name: entry.name, weight: entry.weight, qty: buildInventoryQtyString(entry.qtyValue, entry.inventoryUnit), cost: entry.cost, notes: entry.notes, ammo_type: entry.ammo_type || '' });
      }
    });

    lines.forEach(line => {
      const current = shopItems.find(x => String(x.id) === String(line.itemId || line.id));
      if(current && !isInfiniteStock(current.stock)) current.stock = Math.max(0, itemStockLeft(current) - Math.max(1, parseIntSafe(line.qty, 1)));
    });

    const saveCharRes = await api('/api/character/save', { method:'POST', body: JSON.stringify({ charId:c.id, character:c }) });
    if(!saveCharRes?.ok){ toast(saveCharRes?.error || 'Failed to save inventory'); return; }

    await api('/api/shops/save', { method:'POST', body: JSON.stringify({ shops: getShopState() }) });
    await api('/api/notify', { method:'POST', body: JSON.stringify({ type:'Shop Checkout', detail:(shop.name || 'Shop') + ' • ' + lines.length + ' cart item(s)', from: SESSION.name || SESSION.username || 'Player' }) });

    bucket.items = [];
    writeCarts(carts);
    toast('Checkout complete');
    await refreshAll();
  }

  async function openAddItemModal(shop){
    const result = await vwModalForm({
      title: 'Add Item',
      fields: [
        { key:'name', label:'Item name', value:'', placeholder:'9mm Ammo Box' },
        { key:'category', label:'Category', value:'Ammo', placeholder:'Ammo / Gear / Medical' },
        { key:'cost', label:'Cost ($)', value:'0', placeholder:'20' },
        { key:'weight', label:'Weight', value:'1', placeholder:'1' },
        { key:'inventoryQty', label:'Inventory quantity per purchase', value:'1', placeholder:'400' },
        { key:'inventoryUnit', label:'Inventory unit label (optional)', value:'', placeholder:'rounds' },
        { key:'ammo_type', label:'Ammo type (optional)', value:'', placeholder:'9mm' },
        { key:'notes', label:'Notes', value:'', placeholder:'Unique / special' },
        { key:'stock', label:'Stock (∞ or number)', value:'∞', placeholder:'∞' }
      ],
      okText: 'Add'
    });
    if(!result || !result.name) return;
    shop.items ||= [];
    shop.items.push({
      id: 'i_' + Math.random().toString(36).slice(2,8),
      name: result.name,
      category: result.category,
      cost: parseMoney(result.cost),
      weight: result.weight,
      inventoryQty: Math.max(1, parseIntSafe(result.inventoryQty, 1)),
      inventoryUnit: String(result.inventoryUnit || '').trim(),
      ammo_type: String(result.ammo_type || '').trim(),
      notes: result.notes || '',
      stock: result.stock
    });
    await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops:getShopState()})});
    toast('Item added');
    await refreshAll();
  }

  async function openEditItemModal(shop, it){
    const result = await vwModalForm({
      title: 'Edit Item',
      fields: [
        { key:'name', label:'Item name', value:it.name || '', placeholder:'9mm Ammo Box' },
        { key:'category', label:'Category', value:it.category || '', placeholder:'Ammo / Gear / Medical' },
        { key:'cost', label:'Cost ($)', value:String(it.cost ?? ''), placeholder:'20' },
        { key:'weight', label:'Weight', value:String(it.weight ?? ''), placeholder:'1' },
        { key:'inventoryQty', label:'Inventory quantity per purchase', value:String(it.inventoryQty ?? it.qty ?? 1), placeholder:'400' },
        { key:'inventoryUnit', label:'Inventory unit label (optional)', value:String(it.inventoryUnit || ''), placeholder:'rounds' },
        { key:'ammo_type', label:'Ammo type (optional)', value:String(it.ammo_type || ''), placeholder:'9mm' },
        { key:'notes', label:'Notes', value:it.notes || '', placeholder:'Unique / special' },
        { key:'stock', label:'Stock (∞ or number)', value:String(it.stock ?? '∞'), placeholder:'∞' }
      ],
      okText: 'Save'
    });
    if(!result) return;
    Object.assign(it, {
      name: result.name,
      category: result.category,
      cost: parseMoney(result.cost),
      weight: result.weight,
      inventoryQty: Math.max(1, parseIntSafe(result.inventoryQty, 1)),
      inventoryUnit: String(result.inventoryUnit || '').trim(),
      ammo_type: String(result.ammo_type || '').trim(),
      notes: result.notes || '',
      stock: result.stock
    });
    await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops:getShopState()})});
    toast('Item saved');
    await refreshAll();
  }

  function decorateItemMeta(it){
    const bits = [];
    const qty = itemBundleQty(it);
    const unit = itemBundleUnit(it);
    if(qty || unit) bits.push(qty + (unit ? ' ' + unit : ''));
    if(it.ammo_type) bits.push(it.ammo_type);
    return bits.join(' • ');
  }

  window.renderShop = async function renderShop(){
    const st = window.__STATE || {};
    const shops = getShopState();
    const feat = (st.settings?.features) || { shop:true, intel:true };
    const enabledPill = document.getElementById('shopEnabledPill');
    const shopPill = document.getElementById('shopPill');
    const body = document.getElementById('shopBody');
    const sel = document.getElementById('shopSel');
    const targetSel = document.getElementById('shopTargetSel');
    const targetWrap = document.getElementById('shopTargetWrap');
    const editBtn = document.getElementById('editShopBtn');
    const help = document.getElementById('shopHelpText');
    if(!enabledPill || !shopPill || !body || !sel) return;

    if(!feat.shop){
      enabledPill.textContent = 'Shop: Disabled';
      shopPill.textContent = 'Shop: --';
      body.innerHTML = '<div class="shop-storefront-empty mini">Shop feature is disabled.</div>';
      renderShopCart();
      return;
    }

    const enabled = !!shops.enabled;
    const currentShop = getActiveShop();
    enabledPill.textContent = enabled ? 'Shop: Enabled' : 'Shop: Disabled';
    shopPill.textContent = 'Shop: ' + (currentShop?.name || '--');

    sel.innerHTML = '';
    (shops.list || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      if(s.id === shops.activeShopId) o.selected = true;
      sel.appendChild(o);
    });

    sel.onchange = async ()=>{
      if(SESSION.role !== 'dm') return renderShopCart();
      shops.activeShopId = sel.value;
      await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
      toast('Active shop set');
      await refreshAll();
    };

    if(targetWrap && targetSel){
      targetWrap.classList.toggle('hidden', SESSION.role !== 'dm');
      if(SESSION.role === 'dm'){
        const groups = getShopTargetGroups();
        const currentTarget = getShopTargetCharacter();
        const currentId = String(currentTarget?.id || readDmTargetId() || '');
        targetSel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Shopping For...';
        targetSel.appendChild(placeholder);
        const addGroup = (label, items)=>{
          if(!items.length) return;
          const og = document.createElement('optgroup');
          og.label = label;
          items.forEach(item=>{
            const o = document.createElement('option');
            o.value = item.value;
            o.textContent = item.label;
            if(item.value === currentId) o.selected = true;
            og.appendChild(o);
          });
          targetSel.appendChild(og);
        };
        addGroup('Player Characters', groups.owned || []);
        addGroup('Unassigned / NPCs', groups.unassigned || []);
        targetSel.value = currentId;
        targetSel.onchange = ()=>{
          writeDmTargetId(targetSel.value || '');
          renderShopCart();
        };
      }
    }

    const toggleBtn = document.getElementById('toggleShopBtn');
    const addShopBtn = document.getElementById('addShopBtn');
    if(toggleBtn){
      toggleBtn.textContent = enabled ? 'Disable Shop' : 'Enable Shop';
      toggleBtn.onclick = async ()=>{
        if(SESSION.role !== 'dm') return;
        shops.enabled = !shops.enabled;
        await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
        toast('Shop toggled');
        await refreshAll();
      };
    }
    if(addShopBtn){
      addShopBtn.onclick = async ()=>{
        if(SESSION.role !== 'dm') return;
        const n = await vwModalInput({ title:'New Shop', label:'Shop name', placeholder:'e.g. Riverside Armory' });
        if(!n) return;
        const id = 's_' + Math.random().toString(36).slice(2,8);
        shops.list ||= [];
        shops.list.push({ id, name:n, items:[] });
        shops.activeShopId = id;
        await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
        toast('Shop created');
        await refreshAll();
      };
    }
    if(editBtn){
      editBtn.classList.toggle('hidden', SESSION.role !== 'dm');
      editBtn.onclick = async ()=>{
        if(SESSION.role !== 'dm') return;
        const curr = getActiveShop();
        if(!curr) return;
        const n = await vwModalInput({ title:'Rename Shop', label:'Shop name', value:curr.name, placeholder:'Shop name' });
        if(!n) return;
        curr.name = n;
        await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
        toast('Shop renamed');
        await refreshAll();
      };
    }

    body.innerHTML = '';
    if(!enabled && SESSION.role !== 'dm'){
      body.innerHTML = '<div class="shop-storefront-empty mini">Shop is currently disabled.</div>';
      renderShopCart();
      return;
    }
    if(!currentShop){
      body.innerHTML = '<div class="shop-storefront-empty mini">No shop selected.</div>';
      renderShopCart();
      return;
    }

    if(help){
      help.textContent = SESSION.role === 'dm'
        ? 'DM can manage shelves here and shop for any character or NPC using the Shopping For selector.'
        : 'Browse the shelves, add items to your cart, then check out when you are ready.';
    }

    const items = Array.isArray(currentShop.items) ? currentShop.items.slice() : [];
    if(!items.length){
      body.innerHTML = '<div class="shop-storefront-empty mini">This shop has no items yet.' + (SESSION.role === 'dm' ? ' Use Add New Shop Item to stock the shelves.' : '') + '</div>';
      if(SESSION.role === 'dm'){
        const addWrap = document.createElement('div');
        addWrap.className = 'shop-card shop-card-add';
        addWrap.innerHTML = '<div class="shop-card-title">Add New Shop Item</div><div class="shop-card-desc">Create the first shelf item for this shop.</div><div class="shop-card-footer"><button class="btn smallbtn" id="addShopItemBtn">Add Item</button></div>';
        body.appendChild(addWrap);
        addWrap.querySelector('#addShopItemBtn').onclick = ()=>openAddItemModal(currentShop);
      }
      renderShopCart();
      return;
    }

    const groups = {};
    items.forEach((it, idx) => {
      const key = String(it.category || 'General').trim() || 'General';
      (groups[key] ||= []).push({ it, idx });
    });

    Object.keys(groups).sort((a,b)=>a.localeCompare(b)).forEach(cat => {
      const aisle = document.createElement('section');
      aisle.className = 'shop-aisle';
      const entries = groups[cat];
      aisle.innerHTML = '<div class="shop-aisle-head"><div><div class="shop-aisle-title">' + esc(cat) + '</div><div class="shop-aisle-meta">' + esc(entries.length) + ' item' + (entries.length === 1 ? '' : 's') + '</div></div></div><div class="shop-aisle-grid"></div>';
      const grid = aisle.querySelector('.shop-aisle-grid');

      entries.forEach(({it, idx}) => {
        const soldOut = itemStockLeft(it) <= 0;
        const hasTarget = !!getShopTargetCharacter();
        const card = document.createElement('article');
        card.className = 'shop-card';
        card.innerHTML =
          '<div class="shop-card-title">' + esc(it.name || 'Item') + '</div>' +
          '<div class="shop-card-price-row"><div class="shop-card-price">$' + esc(parseMoney(it.cost).toFixed(2).replace(/\.00$/,'')) + '</div><div class="shop-card-stock">Stock: ' + esc(isInfiniteStock(it.stock) ? '∞' : itemStockLeft(it)) + '</div></div>' +
          '<div class="shop-card-meta">' + esc(decorateItemMeta(it) || 'Standard shelf item') + (it.weight ? ' • ' + esc(String(it.weight)) + ' wt' : '') + '</div>' +
          '<div class="shop-card-desc">' + esc(it.notes || 'No extra notes.') + '</div>' +
          '<div class="shop-card-footer"></div>';
        const footer = card.querySelector('.shop-card-footer');
        if(SESSION.role === 'dm'){
          footer.innerHTML = '<button class="btn smallbtn">Edit</button><button class="btn smallbtn">Del</button><button class="btn smallbtn"' + ((!hasTarget || soldOut) ? ' disabled' : '') + '>' + (soldOut ? 'Out of Stock' : 'Add to Cart') + '</button>';
          const [editItemBtn, delBtn, cartBtn] = footer.querySelectorAll('button');
          editItemBtn.onclick = ()=>openEditItemModal(currentShop, it);
          delBtn.onclick = async ()=>{
            const ok = await vwModalConfirm({ title:'Delete Item', message:'Delete "' + (it.name || 'this item') + '"?' });
            if(!ok) return;
            currentShop.items.splice(idx, 1);
            await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
            toast('Item deleted');
            await refreshAll();
          };
          cartBtn.onclick = ()=>{ if(hasTarget && !soldOut) addItemToCart(it); };
        }else{
          footer.innerHTML = '<button class="btn smallbtn"' + (soldOut ? ' disabled' : '') + '>' + (soldOut ? 'Out of Stock' : 'Add to Cart') + '</button>';
          footer.querySelector('button').onclick = ()=>{ if(!soldOut) addItemToCart(it); };
        }
        grid.appendChild(card);
      });

      if(SESSION.role === 'dm'){
        const addCard = document.createElement('article');
        addCard.className = 'shop-card shop-card-add';
        addCard.innerHTML = '<div class="shop-card-title">Add Item</div><div class="shop-card-desc">Drop a new shelf item into the ' + esc(cat) + ' aisle.</div><div class="shop-card-footer"><button class="btn smallbtn">Add Item</button></div>';
        addCard.querySelector('button').onclick = ()=>openAddItemModal(currentShop);
        grid.appendChild(addCard);
      }
      body.appendChild(aisle);
    });

    renderShopCart();
  };
})();
