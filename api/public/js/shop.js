function vwShopEsc(v){
  return esc(v == null ? "" : String(v));
}

function vwShopNormalizeStock(raw){
  const s = String(raw ?? "∞").trim();
  if(!s || s === "∞") return "∞";
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? String(n) : "∞";
}

function vwShopStockLabel(raw){
  const s = vwShopNormalizeStock(raw);
  return s === "∞" ? "Stock: ∞" : "Stock: " + s;
}

function vwShopGroupItems(items){
  const map = new Map();
  (items || []).forEach(it => {
    const cat = String(it?.category || "General").trim() || "General";
    if(!map.has(cat)) map.set(cat, []);
    map.get(cat).push(it);
  });
  return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
}

function vwShopGetActiveCharacter(){
  return (typeof getChar === "function") ? getChar() : null;
}

function vwShopBuildStats(shop, grouped){
  const items = Array.isArray(shop?.items) ? shop.items : [];
  const char = vwShopGetActiveCharacter();
  return [
    { label:"Selected Shop", value: shop?.name || "--" },
    { label:"Aisles", value: String(grouped.length) },
    { label:"Items", value: String(items.length) },
    { label:"Shopping For", value: char?.name || (SESSION.role === "dm" ? "DM View" : "No Character") }
  ];
}

function vwShopRenderStats(el, shop, grouped){
  if(!el) return;
  const stats = vwShopBuildStats(shop, grouped);
  el.innerHTML = stats.map(s => (
    '<div class="shop-stat">' +
      '<div class="shop-stat-label">' + vwShopEsc(s.label) + '</div>' +
      '<div class="shop-stat-value">' + vwShopEsc(s.value) + '</div>' +
    '</div>'
  )).join('');
}

function vwShopRenderFilters(el, grouped, selectedCategory, onPick){
  if(!el) return;
  const categories = grouped.map(([cat]) => cat);
  const all = [{ id:"__all__", label:"All Aisles" }].concat(categories.map(cat => ({ id:cat, label:cat })));
  el.innerHTML = all.map(entry => (
    '<button class="shop-chip ' + (selectedCategory === entry.id ? 'active' : '') + '" data-shop-cat="' + vwShopEsc(entry.id) + '">' + vwShopEsc(entry.label) + '</button>'
  )).join('');
  el.querySelectorAll('[data-shop-cat]').forEach(btn => {
    btn.onclick = () => onPick(btn.getAttribute('data-shop-cat') || '__all__');
  });
}

function vwShopNormalizeCatalogItem(item){
  return {
    id: String(item?.id || ""),
    name: String(item?.name || "").trim(),
    category: String(item?.category || "General").trim() || "General",
    default_qty: Math.max(1, parseInt(item?.default_qty ?? 1, 10) || 1),
    default_weight: String(item?.default_weight ?? "").trim(),
    default_cost: String(item?.default_cost ?? "").trim(),
    default_notes: String(item?.default_notes ?? "").trim(),
    ammo_type: String(item?.ammo_type ?? "").trim(),
    source: String(item?.source || (item?.is_custom ? "custom" : "official")),
    is_custom: !!item?.is_custom
  };
}

async function vwShopLoadCatalogBundle(){
  if(typeof vwLoadInventoryCatalogBundle === "function"){
    try{
      const bundle = await vwLoadInventoryCatalogBundle();
      if(bundle?.items) return bundle;
    }catch(e){}
  }
  try{
    const res = await api('/api/catalog/inventory');
    if(res?.ok) return { items: res.items || [], byCategory: res.byCategory || {} };
  }catch(e){}
  return { items: [], byCategory: {} };
}

function vwShopSourceLabel(sourceType){
  return sourceType === 'custom' ? 'Custom Catalog' : 'Main Catalog';
}

function vwShopItemSourceBadge(it){
  if(it?.sourceType === 'custom') return 'Custom Catalog';
  if(it?.sourceType === 'standard' || it?.sourceType === 'official') return 'Main Catalog';
  return 'Manual Item';
}

function vwShopDecorateItemFromCatalog(shopItem, catalogItem){
  const cat = catalogItem ? vwShopNormalizeCatalogItem(catalogItem) : null;
  const sourceType = String(shopItem?.sourceType || (cat?.is_custom ? 'custom' : (cat ? 'standard' : 'manual')));
  const category = String(shopItem?.categoryOverride || shopItem?.category || cat?.category || 'General').trim() || 'General';
  const price = String(shopItem?.priceOverride ?? shopItem?.cost ?? cat?.default_cost ?? '0').trim() || '0';
  const weight = String(shopItem?.weightOverride ?? shopItem?.weight ?? cat?.default_weight ?? '').trim();
  const notes = String(shopItem?.notesOverride ?? shopItem?.notes ?? cat?.default_notes ?? '').trim();
  return Object.assign({}, shopItem, {
    id: shopItem?.id || ('i_' + Math.random().toString(36).slice(2,8)),
    sourceType,
    sourceId: String(shopItem?.sourceId || cat?.id || ''),
    category,
    name: String(shopItem?.nameOverride || shopItem?.name || cat?.name || 'Untitled Item').trim() || 'Untitled Item',
    cost: price,
    weight,
    notes,
    stock: vwShopNormalizeStock(shopItem?.stock),
    ammoType: String(shopItem?.ammoType || cat?.ammo_type || '').trim()
  });
}

function vwShopFindCatalogMatch(bundle, shopItem){
  const items = Array.isArray(bundle?.items) ? bundle.items.map(vwShopNormalizeCatalogItem) : [];
  const sourceType = String(shopItem?.sourceType || '').trim();
  const sourceId = String(shopItem?.sourceId || '').trim();
  if(sourceId){
    const exact = items.find(it => String(it.id) === sourceId);
    if(exact) return exact;
  }
  const name = String(shopItem?.name || '').trim().toLowerCase();
  const category = String(shopItem?.category || '').trim().toLowerCase();
  return items.find(it => {
    const sourceOkay = !sourceType || (sourceType === 'custom' ? it.is_custom : !it.is_custom);
    return sourceOkay && String(it.name).trim().toLowerCase() === name && (!category || String(it.category).trim().toLowerCase() === category);
  }) || null;
}

async function vwShopPromptForItem(existing){
  const ex = existing || {};
  const result = await vwModalForm({
    title: existing ? 'Edit Item' : 'Add Item',
    fields: [
      { key:'name', label:'Item name', value: ex.name || '', placeholder:'Flashlight' },
      { key:'category', label:'Category / Aisle', value: ex.category || 'Gear', placeholder:'Gear' },
      { key:'cost', label:'Cost ($)', value: String(ex.cost ?? '0'), placeholder:'35' },
      { key:'weight', label:'Weight', value: String(ex.weight ?? ''), placeholder:'1' },
      { key:'notes', label:'Description / Notes', value: ex.notes || '', placeholder:'Short item notes' },
      { key:'stock', label:'Stock (∞ or number)', value: String(ex.stock ?? '∞'), placeholder:'∞' }
    ],
    okText: existing ? 'Save' : 'Add'
  });
  if(!result || !String(result.name || '').trim()) return null;
  return {
    id: ex.id || ('i_' + Math.random().toString(36).slice(2,8)),
    sourceType: ex.sourceType || 'manual',
    sourceId: ex.sourceId || '',
    name: String(result.name || '').trim(),
    category: String(result.category || 'General').trim() || 'General',
    cost: String(result.cost ?? '0').trim(),
    weight: String(result.weight ?? '').trim(),
    notes: String(result.notes ?? '').trim(),
    stock: vwShopNormalizeStock(result.stock)
  };
}

async function vwShopOpenCatalogAddModal(defaultCategory){
  if(typeof vwModalBaseSetup !== 'function') return null;
  const bundle = await vwShopLoadCatalogBundle();
  const items = (bundle?.items || []).map(vwShopNormalizeCatalogItem);
  if(!items.length){
    toast('No inventory items found in the database');
    return null;
  }

  const allCategories = Array.from(new Set(items.map(it => it.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  let sourceMode = 'all';
  let selectedCategory = defaultCategory && allCategories.includes(defaultCategory) ? defaultCategory : (allCategories[0] || 'General');
  let selectedId = '';

  const ui = vwModalBaseSetup('Add Item to Shop', 'Add Item', 'Cancel');

  function itemsForView(){
    return items.filter(it => {
      const sourceOkay = sourceMode === 'all' || (sourceMode === 'standard' ? !it.is_custom : it.is_custom);
      const catOkay = !selectedCategory || it.category === selectedCategory;
      return sourceOkay && catOkay;
    });
  }

  function currentItem(){
    const list = itemsForView();
    if(!list.some(it => String(it.id) === String(selectedId))){
      selectedId = list[0]?.id || '';
    }
    return list.find(it => String(it.id) === String(selectedId)) || null;
  }

  function fieldValue(id){
    return String(document.getElementById(id)?.value || '').trim();
  }

  function render(){
    const visible = itemsForView();
    const current = currentItem();
    ui.mBody.innerHTML = `
      <div class="mini" style="margin-bottom:10px;opacity:.85">Pick an existing inventory item from the database, then set the shelf details for this shop.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <div class="mini" style="margin-bottom:6px;opacity:.9">Source</div>
          <select id="vwShopSourceMode" class="input" style="width:100%">
            <option value="all" ${sourceMode==='all'?'selected':''}>All Sources</option>
            <option value="standard" ${sourceMode==='standard'?'selected':''}>Main Catalog</option>
            <option value="custom" ${sourceMode==='custom'?'selected':''}>Custom Catalog</option>
          </select>
        </div>
        <div>
          <div class="mini" style="margin-bottom:6px;opacity:.9">Aisle</div>
          <select id="vwShopCategoryPick" class="input" style="width:100%">${allCategories.map(cat => `<option value="${vwShopEsc(cat)}" ${cat===selectedCategory?'selected':''}>${vwShopEsc(cat)}</option>`).join('')}</select>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div class="mini" style="margin-bottom:6px;opacity:.9">Database Item</div>
        <select id="vwShopItemPick" class="input" style="width:100%">${visible.map(it => `<option value="${vwShopEsc(it.id)}" ${String(it.id)===String(selectedId)?'selected':''}>${vwShopEsc(it.name)}${it.is_custom ? ' • custom' : ''}</option>`).join('')}</select>
      </div>
      <div class="mini" style="margin-bottom:10px;opacity:.85;border:1px solid #2b3a4d;border-radius:12px;padding:10px;">
        <div><strong>${vwShopEsc(current?.name || 'No item selected')}</strong></div>
        <div style="margin-top:4px;">Source: ${vwShopEsc(current ? vwShopSourceLabel(current.is_custom ? 'custom' : 'standard') : '--')}</div>
        <div>Default Cost: $${vwShopEsc(current?.default_cost || '0')} • Default Weight: ${vwShopEsc(current?.default_weight || '--')}</div>
        <div>Notes: ${vwShopEsc(current?.default_notes || 'No default notes')}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><div class="mini" style="margin-bottom:6px;opacity:.9">Shelf Price ($)</div><input id="vwShopPrice" class="input" value="${vwShopEsc(String(current?.default_cost || '0'))}" /></div>
        <div><div class="mini" style="margin-bottom:6px;opacity:.9">Stock</div><input id="vwShopStock" class="input" value="∞" /></div>
        <div><div class="mini" style="margin-bottom:6px;opacity:.9">Aisle Label</div><input id="vwShopAisle" class="input" value="${vwShopEsc(String(defaultCategory || current?.category || selectedCategory || 'General'))}" /></div>
        <div><div class="mini" style="margin-bottom:6px;opacity:.9">Weight</div><input id="vwShopWeight" class="input" value="${vwShopEsc(String(current?.default_weight || ''))}" /></div>
      </div>
      <div style="margin-top:10px;">
        <div class="mini" style="margin-bottom:6px;opacity:.9">Shelf Notes</div>
        <input id="vwShopNotes" class="input" value="${vwShopEsc(String(current?.default_notes || ''))}" placeholder="Optional override" />
      </div>
    `;

    document.getElementById('vwShopSourceMode')?.addEventListener('change', (e)=>{ sourceMode = e.target.value; render(); });
    document.getElementById('vwShopCategoryPick')?.addEventListener('change', (e)=>{ selectedCategory = e.target.value; render(); });
    document.getElementById('vwShopItemPick')?.addEventListener('change', (e)=>{ selectedId = e.target.value; render(); });
  }

  function close(val){
    ui.modal.style.display = 'none';
    ui.btnOk.onclick = null;
    ui.btnCan.onclick = null;
    ui.modal.onclick = null;
    if(typeof vwSetModalOpen === 'function') vwSetModalOpen(false);
    return val;
  }

  return new Promise((resolve)=>{
    ui.btnCan.onclick = ()=> resolve(close(null));
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) resolve(close(null)); };
    ui.btnOk.onclick = ()=>{
      const selected = items.find(it => String(it.id) === String(selectedId));
      if(!selected){ toast('Choose an item first'); return; }
      resolve(close({
        id: 'i_' + Math.random().toString(36).slice(2,8),
        sourceType: selected.is_custom ? 'custom' : 'standard',
        sourceId: selected.id,
        category: fieldValue('vwShopAisle') || selected.category || 'General',
        cost: fieldValue('vwShopPrice') || String(selected.default_cost || '0'),
        weight: fieldValue('vwShopWeight') || String(selected.default_weight || ''),
        notes: fieldValue('vwShopNotes') || String(selected.default_notes || ''),
        stock: vwShopNormalizeStock(fieldValue('vwShopStock')),
        ammoType: String(selected.ammo_type || '').trim()
      }));
    };
    if(typeof vwSetModalOpen === 'function') vwSetModalOpen(true);
    ui.modal.style.display = 'flex';
    render();
  });
}

async function vwShopPromptForEdit(item){
  const ex = item || {};
  const catalog = await vwShopLoadCatalogBundle();
  const linked = vwShopFindCatalogMatch(catalog, ex);
  const title = ex?.sourceId ? 'Edit Shop Shelf Item' : 'Edit Item';
  const result = await vwModalForm({
    title,
    fields: [
      { key:'name', label:'Item name', value: ex.name || linked?.name || '', placeholder:'Flashlight' },
      { key:'category', label:'Category / Aisle', value: ex.category || linked?.category || 'Gear', placeholder:'Gear' },
      { key:'cost', label:'Cost ($)', value: String(ex.cost ?? linked?.default_cost ?? '0'), placeholder:'35' },
      { key:'weight', label:'Weight', value: String(ex.weight ?? linked?.default_weight ?? ''), placeholder:'1' },
      { key:'notes', label:'Description / Notes', value: ex.notes || linked?.default_notes || '', placeholder:'Short item notes' },
      { key:'stock', label:'Stock (∞ or number)', value: String(ex.stock ?? '∞'), placeholder:'∞' }
    ],
    okText: 'Save'
  });
  if(!result || !String(result.name || '').trim()) return null;
  return Object.assign({}, ex, {
    name: String(result.name || '').trim(),
    category: String(result.category || 'General').trim() || 'General',
    cost: String(result.cost ?? '0').trim(),
    weight: String(result.weight ?? '').trim(),
    notes: String(result.notes ?? '').trim(),
    stock: vwShopNormalizeStock(result.stock)
  });
}

async function vwShopAddToInventory(item){
  const c = vwShopGetActiveCharacter();
  if(!c){ toast('Create/select character first'); return; }
  c.inventory ||= [];
  const isUnique = String(item?.notes || '').toLowerCase().includes('unique');
  const existing = c.inventory.find(x =>
    String(x?.name || '').toLowerCase() === String(item?.name || '').toLowerCase() &&
    String(x?.category || '').toLowerCase() === String(item?.category || '').toLowerCase()
  );
  if(isUnique && existing){
    toast('Already owned');
    return;
  }
  if(existing && !isUnique){
    const prev = parseInt(String(existing.qty || '1'), 10);
    existing.qty = String((Number.isFinite(prev) ? prev : 1) + 1);
    if(!String(existing.cost || '').trim()) existing.cost = String(item?.cost || '');
    if(!String(existing.weight || '').trim()) existing.weight = String(item?.weight || '');
    if(!String(existing.notes || '').trim()) existing.notes = String(item?.notes || '');
  } else {
    c.inventory.push({
      category: item?.category || '',
      name: item?.name || '',
      weight: String(item?.weight || ''),
      qty: '1',
      cost: String(item?.cost || ''),
      notes: item?.notes || '',
      ammoType: item?.ammoType || ''
    });
  }
  const res = await api('/api/character/save',{method:'POST',body:JSON.stringify({charId:c.id, character:c})});
  if(!res?.ok){ toast(res?.error || 'Failed to save character'); return; }
  await api('/api/notify',{method:'POST',body:JSON.stringify({type:'Shop Request', detail:(item?.name || 'Item') + ' added from shop', from: SESSION.name || 'Player'})});
  toast('Added to inventory');
  await refreshAll();
}

async function vwShopSave(shops){
  const res = await api('/api/shops/save',{method:'POST',body:JSON.stringify({shops})});
  if(!res?.ok && res?.error) toast(res.error);
  return res;
}

async function vwShopRunAdminAction(btn, fn){
  if(!btn || btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  try{
    await fn();
  }finally{
    btn.dataset.busy = '0';
    btn.disabled = false;
  }
}

async function renderShop(){
  const st = window.__STATE || {};
  const shops = st.shops || {};
  shops.list ||= [];
  const feat = (st.settings?.features) || { shop:true, intel:true };
  const enabled = !!shops.enabled;
  const enabledPill = document.getElementById('shopEnabledPill');
  const shopPill = document.getElementById('shopPill');
  const shopSel = document.getElementById('shopSel');
  const searchEl = document.getElementById('shopSearch');
  const aislesEl = document.getElementById('shopAisles');
  const statsEl = document.getElementById('shopStats');
  const filtersEl = document.getElementById('shopCategoryFilters');
  const legacyBody = document.getElementById('shopBody');
  const toggleBtn = document.getElementById('toggleShopBtn');
  const addShopBtn = document.getElementById('addShopBtn');
  const editShopBtn = document.getElementById('editShopBtn');
  if(legacyBody) legacyBody.innerHTML = '';

  if(!enabledPill || !shopSel || !aislesEl) return;

  const ensureActiveShopId = () => {
    if(!shops.activeShopId && shops.list.length) shops.activeShopId = shops.list[0].id;
    if(shops.activeShopId && !shops.list.some(s => s.id === shops.activeShopId)){
      shops.activeShopId = shops.list[0]?.id || null;
    }
  };
  ensureActiveShopId();

  if(toggleBtn){
    toggleBtn.textContent = enabled ? 'Disable Shop' : 'Enable Shop';
    toggleBtn.title = enabled ? 'Turn the entire shop system off for players' : 'Turn the shop system back on';
  }

  if(!feat.shop){
    enabledPill.textContent = 'Shop: Disabled';
    if(shopPill) shopPill.textContent = 'Shop: --';
    statsEl.innerHTML = '';
    filtersEl.innerHTML = '';
    aislesEl.innerHTML = '<div class="shop-empty">Shop feature is currently disabled in Settings.</div>';
    return;
  }

  enabledPill.textContent = enabled ? 'Shop: Enabled' : 'Shop: Disabled';
  const activeShop = shops.list.find(s => s.id === shops.activeShopId) || null;
  if(shopPill) shopPill.textContent = 'Shop: ' + (activeShop?.name || '--');

  shopSel.innerHTML = shops.list.map(s => '<option value="' + vwShopEsc(s.id) + '">' + vwShopEsc(s.name) + '</option>').join('');
  if(activeShop) shopSel.value = activeShop.id;
  shopSel.onchange = async () => {
    if(SESSION.role !== 'dm'){
      toast('DM only');
      if(activeShop) shopSel.value = activeShop.id;
      return;
    }
    shops.activeShopId = shopSel.value;
    await vwShopSave(shops);
    toast('Active shop set');
    await refreshAll();
  };

  if(toggleBtn) toggleBtn.onclick = async () => {
    if(SESSION.role !== 'dm') return;
    await vwShopRunAdminAction(toggleBtn, async ()=>{
      shops.enabled = !shops.enabled;
      enabledPill.textContent = shops.enabled ? 'Shop: Enabled' : 'Shop: Disabled';
      toggleBtn.textContent = shops.enabled ? 'Disable Shop' : 'Enable Shop';
      const res = await vwShopSave(shops);
      if(!res?.ok) return;
      toast(shops.enabled ? 'Shop enabled' : 'Shop disabled');
      await refreshAll();
    });
  };
  if(addShopBtn) addShopBtn.onclick = async () => {
    if(SESSION.role !== 'dm') return;
    await vwShopRunAdminAction(addShopBtn, async ()=>{
      const n = await vwModalInput({ title:'Add New Shop', label:'Shop name', placeholder:'e.g. Riverside Market' });
      if(!n || !String(n).trim()) return;
      const id = 's_' + Math.random().toString(36).slice(2,8);
      shops.list.push({ id, name:String(n).trim(), items:[] });
      shops.activeShopId = id;
      await vwShopSave(shops);
      toast('Shop created');
      await refreshAll();
    });
  };
  if(editShopBtn) editShopBtn.onclick = async () => {
    if(SESSION.role !== 'dm') return;
    await vwShopRunAdminAction(editShopBtn, async ()=>{
      const curr = shops.list.find(s => s.id === shops.activeShopId);
      if(!curr) return;
      const n = await vwModalInput({ title:'Rename Shop', label:'Shop name', value:curr.name, placeholder:'Shop name' });
      if(!n || !String(n).trim()) return;
      curr.name = String(n).trim();
      await vwShopSave(shops);
      toast('Shop renamed');
      await refreshAll();
    });
  };

  if(!activeShop){
    statsEl.innerHTML = '';
    filtersEl.innerHTML = '';
    aislesEl.innerHTML = SESSION.role === 'dm'
      ? '<div class="shop-empty">No shop exists yet. Use <strong>ADD NEW SHOP</strong> to create your first storefront.</div>'
      : '<div class="shop-empty">No shop is available yet. Ask the DM to create one.</div>';
    return;
  }

  if(!enabled && SESSION.role !== 'dm'){
    vwShopRenderStats(statsEl, activeShop, []);
    filtersEl.innerHTML = '';
    aislesEl.innerHTML = '<div class="shop-empty">The shop is currently offline. The lights are out and the checkout lanes are closed.</div>';
    return;
  }

  const rawSearch = String(searchEl?.value || '').trim().toLowerCase();
  const stateKey = '__VW_SHOP_UI';
  window[stateKey] ||= { selectedCategory:'__all__' };
  const uiState = window[stateKey];

  const bundle = await vwShopLoadCatalogBundle();
  const items = Array.isArray(activeShop.items) ? activeShop.items.map(it => vwShopDecorateItemFromCatalog(it, vwShopFindCatalogMatch(bundle, it))) : [];
  activeShop.items = items;

  const matchesSearch = (it) => {
    if(!rawSearch) return true;
    const hay = [it?.name, it?.category, it?.notes, it?.cost, it?.weight, it?.ammoType, vwShopItemSourceBadge(it)].join(' ').toLowerCase();
    return hay.includes(rawSearch);
  };

  const groupedAll = vwShopGroupItems(items);
  const filteredGroups = groupedAll
    .map(([cat, list]) => [cat, list.filter(matchesSearch)])
    .filter(([cat, list]) => list.length && (uiState.selectedCategory === '__all__' || uiState.selectedCategory === cat));

  vwShopRenderStats(statsEl, activeShop, groupedAll);
  vwShopRenderFilters(filtersEl, groupedAll, uiState.selectedCategory, async (cat) => {
    uiState.selectedCategory = cat;
    await renderShop();
  });

  if(searchEl && !searchEl.dataset.boundShopSearch){
    searchEl.dataset.boundShopSearch = '1';
    searchEl.addEventListener('input', () => renderShop());
  }

  if(!filteredGroups.length){
    aislesEl.innerHTML = '<div class="shop-empty">Nothing matches the current aisle filter or search. Try another shelf label.</div>';
    return;
  }

  aislesEl.innerHTML = '';
  filteredGroups.forEach(([category, list]) => {
    const aisle = document.createElement('section');
    aisle.className = 'shop-aisle';
    aisle.innerHTML =
      '<div class="shop-aisle-head">' +
        '<div>' +
          '<div class="shop-aisle-title">Aisle: ' + vwShopEsc(category) + '</div>' +
          '<div class="shop-aisle-meta">' +
            '<span class="badge">' + vwShopEsc(list.length) + ' item' + (list.length === 1 ? '' : 's') + '</span>' +
            '<span class="badge">' + (SESSION.role === 'dm' ? 'DM Management View' : 'Player Browsing View') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="shop-actions">' +
          (SESSION.role === 'dm' ? '<button class="btn smallbtn" data-add-in-cat="' + vwShopEsc(category) + '">Add Item to Aisle</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="shop-aisle-grid"></div>';

    const grid = aisle.querySelector('.shop-aisle-grid');
    list.forEach((it) => {
      const card = document.createElement('article');
      card.className = 'shop-card';
      const notes = String(it?.notes || '').trim();
      card.innerHTML =
        '<div class="shop-card-top">' +
          '<div>' +
            '<div class="shop-card-title">' + vwShopEsc(it?.name || 'Untitled Item') + '</div>' +
            '<div class="shop-card-meta">' +
              '<span class="badge">' + vwShopEsc(it?.category || 'General') + '</span>' +
              '<span class="badge">Wt ' + vwShopEsc(it?.weight || '--') + '</span>' +
              '<span class="badge">' + vwShopEsc(vwShopItemSourceBadge(it)) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="shop-card-price">$' + vwShopEsc(it?.cost || '0') + '</div>' +
        '</div>' +
        '<div class="shop-card-desc">' + vwShopEsc(notes || 'No item notes yet. This shelf is waiting for a label.') + '</div>' +
        '<div class="shop-card-footer">' +
          '<div class="shop-stock">' + vwShopEsc(vwShopStockLabel(it?.stock)) + '</div>' +
          '<div class="shop-actions"></div>' +
        '</div>';
      const actions = card.querySelector('.shop-actions');
      if(SESSION.role === 'dm'){
        actions.innerHTML = '<button class="btn smallbtn" data-edit-item="1">Edit</button><button class="btn smallbtn" data-del-item="1">Delete</button>';
        const editBtn = actions.querySelector('[data-edit-item]');
        const delBtn = actions.querySelector('[data-del-item]');
        editBtn.onclick = async () => {
          const updated = await vwShopPromptForEdit(it);
          if(!updated) return;
          Object.assign(it, updated);
          await vwShopSave(shops);
          toast('Item saved');
          await refreshAll();
        };
        delBtn.onclick = async () => {
          const ok = await vwModalConfirm({ title:'Delete Item', message:'Delete "' + (it?.name || 'this item') + '" from the shop shelf?' });
          if(!ok) return;
          const src = activeShop.items || [];
          const realIdx = src.indexOf(it);
          if(realIdx >= 0) src.splice(realIdx, 1);
          await vwShopSave(shops);
          toast('Item deleted');
          await refreshAll();
        };
      } else {
        actions.innerHTML = '<button class="btn smallbtn" data-buy-item="1">Add to Inventory</button>';
        actions.querySelector('[data-buy-item]').onclick = async () => {
          await vwShopAddToInventory(it);
        };
      }
      grid.appendChild(card);
    });

    if(SESSION.role === 'dm'){
      const addInCat = aisle.querySelector('[data-add-in-cat]');
      if(addInCat){
        addInCat.onclick = async () => {
          const created = await vwShopOpenCatalogAddModal(category);
          if(!created) return;
          activeShop.items ||= [];
          activeShop.items.push(created);
          await vwShopSave(shops);
          toast('Item added from database');
          await refreshAll();
        };
      }
    }

    aislesEl.appendChild(aisle);
  });

  if(SESSION.role === 'dm'){
    const quickAdd = document.createElement('div');
    quickAdd.className = 'shop-empty';
    quickAdd.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;"><div><strong>Need a new shelf item?</strong><div class="mini">Use the database picker to add a main-catalog or custom item to any aisle in this shop.</div></div><button class="btn smallbtn" id="shopQuickAddAny">Add Item From Database</button></div>';
    aislesEl.appendChild(quickAdd);
    quickAdd.querySelector('#shopQuickAddAny').onclick = async () => {
      const created = await vwShopOpenCatalogAddModal();
      if(!created) return;
      activeShop.items ||= [];
      activeShop.items.push(created);
      await vwShopSave(shops);
      toast('Item added from database');
      await refreshAll();
    };
  }
}
