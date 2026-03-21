(function(){
  const CART_STORAGE_KEY = "vwShopCartsV1";
  const DM_TARGET_STORAGE_KEY = "vwShopDmTargetV1";

  function esc(s){ return String(s ?? "").replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch)); }

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

  function formatMoneyValue(n){
    const num = Number(n || 0);
    const safe = Number.isFinite(num) ? Math.max(0, num) : 0;
    return safe.toFixed(2).replace(/\.00$/, "");
  }

  function formatMoneyText(n){ return "$" + formatMoneyValue(n); }

  function getTargetMoney(charObj){
    const money = (charObj?.sheet?.money && typeof charObj.sheet.money === "object") ? charObj.sheet.money : {};
    return {
      cash: parseMoney(money.cash),
      bank: parseMoney(money.bank)
    };
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
    }catch(e){ return {}; }
  }
  function writeCarts(carts){ try{ localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carts || {})); }catch(e){} }
  function readDmTargetId(){ try{ return String(localStorage.getItem(DM_TARGET_STORAGE_KEY) || "").trim(); }catch(e){ return ""; } }
  function writeDmTargetId(charId){
    try{ if(charId) localStorage.setItem(DM_TARGET_STORAGE_KEY, String(charId)); else localStorage.removeItem(DM_TARGET_STORAGE_KEY); }catch(e){}
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
      const row = { value:String(c.id), label:(c.name || "Unnamed Character") };
      if(owner) owned.push(row); else unassigned.push(row);
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

  function itemCartKey(it){ return String(it.id || it.sourceId || it.name || Math.random()); }
  function itemBundleQty(it){
    const explicit = Math.max(1, parseIntSafe(it.inventoryQty ?? it.qty ?? 1, 1));
    if(explicit > 1) return explicit;
    const inferred = inferAmmoBundleMeta(it);
    return inferred?.qty || explicit;
  }
  function itemBundleUnit(it){
    const explicit = String(it.inventoryUnit || "").trim();
    if(explicit) return explicit;
    const inferred = inferAmmoBundleMeta(it);
    return inferred?.unit || "";
  }

  function inferAmmoBundleMeta(it){
    const ammoKey = String(it?.ammo_type || '').trim().toLowerCase() || String(it?.name || '').toLowerCase();
    const table = {
      '9mm': { qty:400, unit:'rounds', invName:'9mm Ammo' },
      '.45': { qty:300, unit:'rounds', invName:'.45 Ammo' },
      '45 acp': { qty:300, unit:'rounds', invName:'.45 Ammo' },
      '.357': { qty:200, unit:'rounds', invName:'.357 Ammo' },
      '5.56': { qty:300, unit:'rounds', invName:'5.56 Ammo' },
      '556': { qty:300, unit:'rounds', invName:'5.56 Ammo' },
      '7.62': { qty:240, unit:'rounds', invName:'7.62 Ammo' },
      '762': { qty:240, unit:'rounds', invName:'7.62 Ammo' },
      '12 gauge': { qty:25, unit:'shells', invName:'12 Gauge Shells' },
      '12ga': { qty:25, unit:'shells', invName:'12 Gauge Shells' },
      'shotgun': { qty:25, unit:'shells', invName:'12 Gauge Shells' },
    };
    for(const [k,v] of Object.entries(table)){
      if(ammoKey.includes(k)) return v;
    }
    return null;
  }
  function itemInventoryName(it){
    const inferred = inferAmmoBundleMeta(it);
    if(inferred?.invName) return inferred.invName;
    return String(it?.name || 'Item');
  }
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
    if(itemStockLeft(it) !== Infinity && proposedQty > itemStockLeft(it)){ toast("Not enough stock"); return; }

    if(line){
      line.qty = proposedQty;
    }else{
      bucket.items.push({
        id: key,
        itemId: it.id || key,
        name: itemInventoryName(it) || "Item",
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
    if(maxStock !== Infinity && nextQty > maxStock){ toast("Not enough stock"); return; }
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

  let __shopCheckoutBusy = false;

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
    const money = getTargetMoney(c);

    statusEl.textContent = 'Shopping for: ' + (c.name || 'Character') + ' • ' + (shop.name || 'Shop') + ' • Cash ' + formatMoneyText(money.cash) + ' / Bank ' + formatMoneyText(money.bank);

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
    if(__shopCheckoutBusy) return;
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

    const total = lines.reduce((sum, line) => sum + (parseMoney(line.cost) * Math.max(1, parseIntSafe(line.qty, 1))), 0);
    const money = getTargetMoney(c);
    const preview = lines.map(line => (line.name || 'Item') + ' × ' + Math.max(1, parseIntSafe(line.qty, 1)) + ' (' + cartLineDisplayQty(line) + ')').join(' | ');
    const payment = await vwModalForm({
      title: 'Checkout Cart',
      okText: 'Complete Purchase',
      fields: [
        { key:'preview', label:'Cart summary', type:'static', value: preview },
        { key:'total', label:'Order total', type:'static', value: formatMoneyText(total) },
        { key:'paymentSource', label:'Pay with', type:'select', value: money.cash >= total ? 'cash' : 'bank', options:[
          { value:'cash', label:'Cash • ' + formatMoneyText(money.cash) },
          { value:'bank', label:'Bank • ' + formatMoneyText(money.bank) }
        ] }
      ]
    });
    if(!payment) return;

    const paySource = String(payment.paymentSource || 'cash');
    const available = paySource === 'bank' ? money.bank : money.cash;
    if(available < total){
      toast('You do not have enough money');
      return;
    }

    __shopCheckoutBusy = true;
    renderShopCart();
    try{
      c.inventory ||= [];
      c.sheet ||= {};
      c.sheet.money ||= { cash:'0', bank:'0' };
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

      const nextMoney = Math.max(0, available - total);
      if(paySource === 'bank') c.sheet.money.bank = formatMoneyValue(nextMoney);
      else c.sheet.money.cash = formatMoneyValue(nextMoney);

      const saveCharRes = await api('/api/character/save', { method:'POST', body: JSON.stringify({ charId:c.id, character:c }) });
      if(!saveCharRes?.ok){ toast(saveCharRes?.error || 'Failed to save inventory'); return; }

      const saveShopRes = await api('/api/shops/save', { method:'POST', body: JSON.stringify({ shops: getShopState() }) });
      if(!saveShopRes?.ok){ toast(saveShopRes?.error || 'Failed to save shop stock'); return; }

      await api('/api/notify', { method:'POST', body: JSON.stringify({ type:'Shop Checkout', detail:(shop.name || 'Shop') + ' • ' + lines.length + ' cart item(s) • ' + formatMoneyText(total) + ' from ' + paySource, from: SESSION.name || SESSION.username || 'Player' }) });

      bucket.items = [];
      writeCarts(carts);
      toast('Checkout complete');
      await refreshAll();
    } finally {
      __shopCheckoutBusy = false;
      renderShopCart();
    }
  }

  async function loadInventoryCatalogBundle(){
    try{
      const res = await api('/api/catalog/inventory');
      if(res?.ok){ return { items:Array.isArray(res.items)?res.items:[], byCategory: res.byCategory || {} }; }
    }catch(e){}
    const cat = (window.vwGetCatalog ? window.vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG));
    const raw = cat?.inventoryItemsByCategory || cat?.inventory_items_by_category || cat?.inventoryByCategory || null;
    const byCategory = {};
    if(raw && typeof raw === 'object'){
      Object.entries(raw).forEach(([category, items]) => {
        byCategory[category] = (items || []).map(it => (typeof it === 'string'
          ? { name: it, category, default_qty:1, default_weight:'', default_cost:'', default_notes:'', source:'official', is_custom:false }
          : Object.assign({ category, default_qty:1, source:'official', is_custom:false }, it)
        ));
      });
    }
    return { items:Object.values(byCategory).flat(), byCategory };
  }

  function normalizeCatalogItem(item, categoryHint){
    const category = String(item?.category || item?.item_category || item?.group || categoryHint || 'Misc').trim() || 'Misc';
    return {
      id: item?.id || '',
      name: String(item?.name ?? item ?? '').trim(),
      category,
      default_qty: Math.max(1, parseInt(item?.default_qty ?? item?.qty ?? 1, 10) || 1),
      default_weight: item?.default_weight ?? item?.weight ?? '',
      default_cost: item?.default_cost ?? item?.cost ?? '',
      default_notes: item?.default_notes ?? item?.notes ?? '',
      ammo_type: item?.ammo_type ?? '',
      source: item?.source || (item?.is_custom ? 'custom' : 'official'),
      is_custom: !!item?.is_custom
    };
  }

  async function openAddItemModal(shop){
    const bundle = await loadInventoryCatalogBundle();
    const byCategory = bundle?.byCategory || {};
    const categories = Object.keys(byCategory).sort((a,b)=>a.localeCompare(b));
    if(!categories.length){ toast('No catalog items available'); return; }
    let selectedCategory = categories[0];
    let selectedName = '';

    const ui = vwModalBaseSetup ? vwModalBaseSetup('Add Item to Shop', 'Add Item', 'Cancel') : null;
    if(!ui){ toast('Modal UI unavailable'); return; }

    function itemsForCategory(cat){ return (byCategory[cat] || []).map(it => normalizeCatalogItem(it, cat)); }
    function selectedItem(){ return itemsForCategory(selectedCategory).find(it => String(it.name) === String(selectedName)) || itemsForCategory(selectedCategory)[0] || null; }
    function render(){
      const items = itemsForCategory(selectedCategory);
      if(!selectedName || !items.some(it => String(it.name) === String(selectedName))) selectedName = items[0]?.name || '';
      const current = selectedItem();
      ui.mBody.innerHTML = `
        <div class="mini" style="margin-bottom:10px;opacity:.85">Pick an item from the inventory database. The shop will place it in its matching aisle automatically based on category.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Category</div>
            <select id="vwShopCat" class="input" style="width:100%">${categories.map(cat=>`<option value="${esc(cat)}"${cat===selectedCategory?' selected':''}>${esc(cat)}</option>`).join('')}</select>
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Item</div>
            <select id="vwShopItem" class="input" style="width:100%">${items.map(it=>`<option value="${esc(it.name)}"${String(it.name)===String(selectedName)?' selected':''}>${esc(it.name)}${it.is_custom?' • custom':''}</option>`).join('')}</select>
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Aisle</div>
            <input class="input" value="${esc(current?.category || '')}" disabled />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Source</div>
            <input class="input" value="${esc(current?.is_custom ? 'Custom Catalog' : 'Main Catalog')}" disabled />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Price ($)</div>
            <input id="vwShopCost" class="input" value="${esc(String(current?.default_cost ?? '0'))}" />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Weight</div>
            <input id="vwShopWeight" class="input" value="${esc(String(current?.default_weight ?? ''))}" />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Inventory quantity per purchase</div>
            <input id="vwShopQty" class="input" value="${esc(String(current?.default_qty ?? 1))}" />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Stock (∞ or number)</div>
            <input id="vwShopStock" class="input" value="∞" />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Inventory unit label</div>
            <input id="vwShopUnit" class="input" placeholder="rounds" />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Ammo type</div>
            <input id="vwShopAmmoType" class="input" value="${esc(String(current?.ammo_type || ''))}" placeholder="Optional" />
          </div>
        </div>
        <div style="margin-top:10px;">
          <div class="mini" style="margin-bottom:6px;opacity:.9">Notes</div>
          <input id="vwShopNotes" class="input" value="${esc(String(current?.default_notes ?? ''))}" placeholder="Optional" />
        </div>`;
      document.getElementById('vwShopCat')?.addEventListener('change', e=>{ selectedCategory = e.target.value; selectedName = ''; render(); });
      document.getElementById('vwShopItem')?.addEventListener('change', e=>{ selectedName = e.target.value; render(); });
    }
    render();

    const result = await new Promise((resolve)=>{
      function close(val){
        ui.modal.style.display = 'none';
        ui.btnOk.onclick = null;
        ui.btnCan.onclick = null;
        ui.modal.onclick = null;
        if(typeof vwSetModalOpen === 'function') vwSetModalOpen(false);
        resolve(val);
      }
      ui.btnOk.onclick = ()=>close(true);
      ui.btnCan.onclick = ()=>close(false);
      ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(false); };
      if(typeof vwSetModalOpen === 'function') vwSetModalOpen(true);
      ui.modal.style.display = 'flex';
    });
    if(!result) return;
    const current = selectedItem();
    if(!current?.name) return;
    const nextCategory = String(current.category || selectedCategory || 'Misc').trim() || 'Misc';
    const nextItem = {
      id: 'i_' + Math.random().toString(36).slice(2,8),
      sourceId: current.id || '',
      sourceType: current.is_custom ? 'custom' : 'official',
      name: current.name,
      category: nextCategory,
      cost: parseMoney(document.getElementById('vwShopCost')?.value || current.default_cost || 0),
      weight: String(document.getElementById('vwShopWeight')?.value ?? current.default_weight ?? ''),
      inventoryQty: Math.max(1, parseIntSafe(document.getElementById('vwShopQty')?.value || current.default_qty || 1, 1)),
      inventoryUnit: String(document.getElementById('vwShopUnit')?.value || '').trim(),
      ammo_type: String(document.getElementById('vwShopAmmoType')?.value || current.ammo_type || '').trim(),
      notes: String(document.getElementById('vwShopNotes')?.value || current.default_notes || '').trim(),
      stock: String(document.getElementById('vwShopStock')?.value || '∞').trim() || '∞'
    };
    shop.items = Array.isArray(shop.items) ? shop.items : [];
    shop.items.push(nextItem);
    const saveRes = await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops:getShopState()})});
    if(!saveRes?.ok){
      toast(saveRes?.error || 'Failed to save item');
      return;
    }
    toast('Item added to ' + nextCategory);
    try{ if(typeof renderShop === 'function') await renderShop(); }catch(e){}
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

  function getAisles(items){
    const map = new Map();
    (items || []).forEach(it => {
      const cat = String(it?.category || it?.item_category || it?.group || 'Misc').trim() || 'Misc';
      it.category = cat;
      if(!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    });
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }

  function renderShelfCard(currentShop, shops, it, idx){
    const soldOut = itemStockLeft(it) <= 0;
    const hasTarget = !!getShopTargetCharacter();
    const metaBits = [];
    if(it.inventoryQty) metaBits.push(String(itemBundleQty(it)) + (itemBundleUnit(it) ? ' ' + itemBundleUnit(it) : ''));
    if(it.weight) metaBits.push(String(it.weight) + ' wt');
    const sourceLabel = it.sourceType === 'custom' ? 'Custom Catalog' : (it.sourceId ? 'Main Catalog' : 'Shop Item');
    const rawStock = isInfiniteStock(it.stock) ? null : itemStockLeft(it);
    const stockLabel = rawStock == null ? '∞' : String(rawStock);
    const stockNote = rawStock != null && rawStock > 0 && rawStock <= 3 ? ' • Low' : '';
    return `
      <article class="shop-card">
        <div class="shop-card-head">
          <div>
            <div class="shop-card-title">${esc(it.name)}</div>
            <div class="shop-chip-row">
              <span class="shop-chip">${esc(it.category || 'Misc')}</span>
              ${metaBits.length ? `<span class="shop-chip">${esc(metaBits.join(' • '))}</span>` : ''}
              <span class="shop-chip">${esc(sourceLabel)}</span>
            </div>
          </div>
          <div class="shop-card-price">$${esc(parseMoney(it.cost).toFixed(2).replace(/\.00$/,''))}</div>
        </div>
        <div class="shop-card-desc">${esc(it.notes || 'Shelf item')}</div>
        <div class="shop-card-stock">Stock: ${esc(stockLabel)}${stockNote ? `<span class="mini" style="color:#f6c56f">${esc(stockNote)}</span>` : ''}</div>
        <div class="shop-card-footer">
          ${SESSION.role === 'dm' ? `
            <button class="btn smallbtn" data-act="edit">Edit</button>
            <button class="btn smallbtn" data-act="del">Del</button>
            <button class="btn smallbtn" data-act="cart" ${(!hasTarget || soldOut) ? 'disabled' : ''}>${soldOut ? 'Out of Stock' : 'Add to Cart'}</button>
          ` : `
            <button class="btn smallbtn" data-act="cart" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Out of Stock' : 'Add to Cart'}</button>
          `}
        </div>
      </article>`;
  }

  function attachShelfCardHandlers(root, currentShop, it, idx, shops){
    if(SESSION.role === 'dm'){
      root.querySelector('[data-act="edit"]')?.addEventListener('click', ()=>openEditItemModal(currentShop, it));
      root.querySelector('[data-act="del"]')?.addEventListener('click', async ()=>{
        const ok = await vwModalConfirm({ title:'Delete Item', message:'Delete "' + (it.name || 'this item') + '"?' });
        if(!ok) return;
        currentShop.items.splice(idx, 1);
        await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
        toast('Item deleted');
        await refreshAll();
      });
      root.querySelector('[data-act="cart"]')?.addEventListener('click', ()=>{ if(getShopTargetCharacter() && !soldOut) addItemToCart(it); });
    }else{
      root.querySelector('[data-act="cart"]')?.addEventListener('click', ()=>{ if(!soldOut) addItemToCart(it); });
    }
  }

  window.renderShop = async function renderShop(){
    const st = window.__STATE || {};
    const shops = getShopState();
    const feat = (st.settings?.features) || { shop:true, intel:true };
    const enabledPill = document.getElementById('shopEnabledPill');
    const body = document.getElementById('shopBody');
    const sel = document.getElementById('shopSel');
    const targetSel = document.getElementById('shopTargetSel');
    const targetWrap = document.getElementById('shopTargetWrap');
    const editBtn = document.getElementById('editShopBtn');
    const addItemBtn = document.getElementById('addShopItemBtn');
    const help = document.getElementById('shopHelpText');
    if(!enabledPill || !body || !sel) return;

    if(!feat.shop){
      enabledPill.textContent = 'Shop: Disabled';
      body.innerHTML = '<div class="mini">Shop feature is disabled.</div>';
      renderShopCart();
      return;
    }

    const enabled = !!shops.enabled;
    const currentShop = getActiveShop();
    enabledPill.textContent = enabled ? 'Shop: Enabled' : 'Shop: Disabled';

    sel.innerHTML = '';
    (shops.list || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      if(s.id === shops.activeShopId) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = async ()=>{
      if(SESSION.role === 'dm'){
        shops.activeShopId = sel.value;
        await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
        toast('Active shop set');
        await refreshAll();
      }else{
        renderShopCart();
      }
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
        targetSel.onchange = ()=>{ writeDmTargetId(targetSel.value || ''); renderShop(); };
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
    if(addItemBtn){
      addItemBtn.classList.toggle('hidden', SESSION.role !== 'dm');
      addItemBtn.onclick = ()=>{ if(currentShop) openAddItemModal(currentShop); };
    }

    body.innerHTML = '';
    if(!enabled && SESSION.role !== 'dm'){
      body.innerHTML = '<div class="mini">Shop is currently disabled.</div>';
      renderShopCart();
      return;
    }
    if(!currentShop){
      body.innerHTML = '<div class="mini">No shop selected.</div>';
      renderShopCart();
      return;
    }

    if(help){
      help.textContent = SESSION.role === 'dm'
        ? 'DM can manage shelves here and shop for any character or NPC using the Shopping For selector.'
        : 'Browse the shelves, add items to your cart, then check out when you are ready.';
    }

    const aisles = getAisles(currentShop.items || []);
    if(!aisles.length){
      body.innerHTML = '<div class="mini">This shop has no items yet.</div>';
      renderShopCart();
      return;
    }

    aisles.forEach(([category, items]) => {
      const aisle = document.createElement('section');
      aisle.className = 'shop-aisle';
      aisle.innerHTML = `
        <div class="shop-aisle-head">
          <div>
            <div class="shop-aisle-title">${esc(category).toUpperCase()}</div>
            <div class="mini">${esc(items.length)} item${items.length===1?'':'s'}</div>
          </div>
        </div>
        <div class="shop-aisle-grid"></div>`;
      const grid = aisle.querySelector('.shop-aisle-grid');
      items.forEach(it => {
        const idx = (currentShop.items || []).indexOf(it);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderShelfCard(currentShop, shops, it, idx);
        const card = wrapper.firstElementChild;
        grid.appendChild(card);
        const soldOut = itemStockLeft(it) <= 0;
        if(SESSION.role === 'dm'){
          card.querySelector('[data-act="edit"]')?.addEventListener('click', ()=>openEditItemModal(currentShop, it));
          card.querySelector('[data-act="del"]')?.addEventListener('click', async ()=>{
            const ok = await vwModalConfirm({ title:'Delete Item', message:'Delete "' + (it.name || 'this item') + '"?' });
            if(!ok) return;
            currentShop.items.splice(idx, 1);
            await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
            toast('Item deleted');
            await refreshAll();
          });
          card.querySelector('[data-act="cart"]')?.addEventListener('click', ()=>{ if(getShopTargetCharacter() && !soldOut) addItemToCart(it); });
        }else{
          card.querySelector('[data-act="cart"]')?.addEventListener('click', ()=>{ if(!soldOut) addItemToCart(it); });
        }
      });
      body.appendChild(aisle);
    });

    renderShopCart();
  };
})();
