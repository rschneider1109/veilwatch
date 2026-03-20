(function(){
  const CART_STORAGE_KEY = "vwShopCartsV1";

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

  function getCartBucket(charId, shopId){
    const carts = readCarts();
    carts[charId] ||= {};
    carts[charId][shopId] ||= { items: [] };
    return { carts, bucket: carts[charId][shopId] };
  }

  function getCurrentCart(){
    const c = getChar?.();
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
    const c = getChar?.();
    if(!c){ toast("Create/select character first"); return; }
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
    const c = getChar?.();
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
    const c = getChar?.();
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

    if(SESSION.role === "dm"){
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");

    const c = getChar?.();
    const shop = getActiveShop();
    if(!c){
      body.innerHTML = '<div class="mini">Select a character to start shopping.</div>';
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

    statusEl.textContent = 'Shopping as ' + (c.name || 'Character') + ' • ' + (shop.name || 'Shop');

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
    const c = getChar?.();
    const shop = getActiveShop();
    if(!c){ toast("Create/select character first"); return; }
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
    const editBtn = document.getElementById('editShopBtn');
    const help = document.getElementById('shopHelpText');
    if(!enabledPill || !shopPill || !body || !sel) return;

    if(!feat.shop){
      enabledPill.textContent = 'Shop: Disabled';
      shopPill.textContent = 'Shop: --';
      body.innerHTML = '<tr><td colspan="8" class="mini">Shop feature is disabled.</td></tr>';
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
      body.innerHTML = '<tr><td colspan="8" class="mini">Shop is currently disabled.</td></tr>';
      renderShopCart();
      return;
    }
    if(!currentShop){
      body.innerHTML = '<tr><td colspan="8" class="mini">No shop selected.</td></tr>';
      renderShopCart();
      return;
    }

    if(help){
      help.textContent = SESSION.role === 'dm'
        ? 'DM can manage shelves here. Players now add items to a cart and check out later.'
        : 'Browse the shelves, add items to your cart, then check out when you are ready.';
    }

    (currentShop.items || []).forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(it.name) + '</td>' +
        '<td>' + esc(it.category || '') + '</td>' +
        '<td>$' + esc(parseMoney(it.cost).toFixed(2).replace(/\.00$/,'')) + '</td>' +
        '<td>' + esc(it.weight || '') + '</td>' +
        '<td>' + esc(decorateItemMeta(it) || '—') + '</td>' +
        '<td>' + esc(it.notes || '') + '</td>' +
        '<td>' + esc(isInfiniteStock(it.stock) ? '∞' : itemStockLeft(it)) + '</td>' +
        '<td></td>';
      const td = tr.lastChild;
      if(SESSION.role === 'dm'){
        td.innerHTML = '<button class="btn smallbtn">Edit</button> <button class="btn smallbtn">Del</button>';
        const [editItemBtn, delBtn] = td.querySelectorAll('button');
        editItemBtn.onclick = ()=>openEditItemModal(currentShop, it);
        delBtn.onclick = async ()=>{
          const ok = await vwModalConfirm({ title:'Delete Item', message:'Delete "' + (it.name || 'this item') + '"?' });
          if(!ok) return;
          currentShop.items.splice(idx, 1);
          await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
          toast('Item deleted');
          await refreshAll();
        };
      }else{
        const soldOut = itemStockLeft(it) <= 0;
        td.innerHTML = '<button class="btn smallbtn"' + (soldOut ? ' disabled' : '') + '>' + (soldOut ? 'Out of Stock' : 'Add to Cart') + '</button>';
        td.querySelector('button').onclick = ()=>{ if(!soldOut) addItemToCart(it); };
      }
      body.appendChild(tr);
    });

    if(SESSION.role === 'dm'){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8"><button class="btn smallbtn" id="addShopItemBtn">Add Item</button></td>';
      body.appendChild(tr);
      tr.querySelector('#addShopItemBtn').onclick = ()=>openAddItemModal(currentShop);
    }

    renderShopCart();
  };
})();
