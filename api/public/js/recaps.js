// recaps.js — DM-written session recaps for players + DM continuity notes

function vwFormatDate(ts){
  if(!ts) return '';
  try{ return new Date(Number(ts)).toLocaleString(); }catch(e){ return ''; }
}

function vwRecapItems(){
  const st = window.__STATE || {};
  const box = st.sessionRecaps || { items: [] };
  return Array.isArray(box) ? box : (box.items || []);
}

function renderPlayerRecaps(){
  const el = document.getElementById('intelRecap');
  if(!el) return;
  const items = vwRecapItems()
    .filter(r=>String(r.visibility || 'players') === 'players')
    .slice()
    .sort((a,b)=>{
      if(!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
      return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
    });

  if(!items.length){
    el.innerHTML = '<p class="muted">No session recaps have been posted yet.</p>';
    el.dataset.vwInit = '1';
    return;
  }

  el.innerHTML = items.map(r=>{
    const pin = r.pinned ? '<span class="badge">Pinned</span> ' : '';
    const when = vwFormatDate(r.updatedAt || r.createdAt);
    return ''+
      '<div class="panel" style="margin:8px 0;padding:12px;">'+
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;">'+
          '<strong>'+pin+esc(r.title || 'Session Recap')+'</strong>'+
          '<span class="mini">'+esc(when)+'</span>'+
        '</div>'+
        '<div style="white-space:pre-wrap;margin-top:8px;line-height:1.45;">'+esc(r.summary || '')+'</div>'+
      '</div>';
  }).join('');
  el.dataset.vwInit = '1';
}
window.renderPlayerRecaps = renderPlayerRecaps;

function renderDMRecaps(){
  if(SESSION.role !== 'dm') return;
  const body = document.getElementById('recapBody');
  if(!body) return;
  const items = vwRecapItems().slice().sort((a,b)=>{
    if(!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
    return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
  });

  body.innerHTML = '';
  if(!items.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No session recaps yet.</td></tr>';
    return;
  }

  items.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>'+esc(r.id)+'</td>'+
      '<td>'+esc(r.title || '')+'</td>'+
      '<td>'+esc(r.visibility || 'players')+'</td>'+
      '<td>'+(r.pinned ? 'yes' : 'no')+'</td>'+
      '<td>'+esc(vwFormatDate(r.updatedAt || r.createdAt))+'</td>'+
      '<td>'+esc((r.summary || '').slice(0,180))+(String(r.summary || '').length > 180 ? '…' : '')+'</td>'+
      '<td></td>';
    const td = tr.lastChild;
    td.innerHTML = '<button class="btn smallbtn">Edit</button> <button class="btn smallbtn">Pin</button> <button class="btn smallbtn">Delete</button>';
    const [editBtn, pinBtn, delBtn] = td.querySelectorAll('button');
    pinBtn.textContent = r.pinned ? 'Unpin' : 'Pin';

    editBtn.onclick = async ()=>{
      const result = await vwModalForm({
        title:'Edit Session Recap',
        fields:[
          {key:'title', label:'Title', value:r.title || '', placeholder:'Session title'},
          {key:'summary', label:'Player Recap', value:r.summary || '', placeholder:'What players should see', type:'textarea'},
          {key:'dmNotes', label:'DM Notes', value:r.dmNotes || '', placeholder:'Private DM continuity notes', type:'textarea'},
          {key:'visibility', label:'Visibility', value:r.visibility || 'players', type:'select', options:[{value:'players', label:'Visible to Players'}, {value:'dm', label:'DM Only'}]},
          {key:'pinned', label:'Pinned', value:r.pinned ? 'yes' : 'no', type:'select', options:[{value:'yes', label:'Yes'}, {value:'no', label:'No'}]}
        ],
        okText:'Save'
      });
      if(!result) return;
      const res = await api('/api/recaps/update', {method:'POST', body:JSON.stringify({
        id:r.id,
        title:result.title,
        summary:result.summary,
        dmNotes:result.dmNotes,
        visibility:result.visibility,
        pinned:String(result.pinned || 'no') === 'yes'
      })});
      if(res.ok){ toast('Recap saved'); await refreshAll(); }
      else toast(res.error || 'Failed');
    };

    pinBtn.onclick = async ()=>{
      const res = await api('/api/recaps/pin', {method:'POST', body:JSON.stringify({id:r.id, pinned:!r.pinned})});
      if(res.ok){ toast(r.pinned ? 'Unpinned' : 'Pinned'); await refreshAll(); }
      else toast(res.error || 'Failed');
    };

    delBtn.onclick = async ()=>{
      const ok = await vwModalConfirm({ title:'Delete Recap', message:'Delete recap #' + r.id + ' "' + (r.title || '') + '"? This cannot be undone.' });
      if(!ok) return;
      const res = await api('/api/recaps/delete', {method:'POST', body:JSON.stringify({id:r.id})});
      if(res.ok){ toast('Recap deleted'); await refreshAll(); }
      else toast(res.error || 'Failed');
    };

    body.appendChild(tr);
  });
}
window.renderDMRecaps = renderDMRecaps;

document.getElementById('dmNewRecapBtn')?.addEventListener('click', async ()=>{
  if(SESSION.role !== 'dm') return;
  const result = await vwModalForm({
    title:'New Session Recap',
    fields:[
      {key:'title', label:'Title', value:'', placeholder:'Session 1: The Blackout'},
      {key:'summary', label:'Player Recap', value:'', placeholder:'What players should see', type:'textarea'},
      {key:'dmNotes', label:'DM Notes', value:'', placeholder:'Private DM continuity notes', type:'textarea'},
      {key:'visibility', label:'Visibility', value:'players', type:'select', options:[{value:'players', label:'Visible to Players'}, {value:'dm', label:'DM Only'}]},
      {key:'pinned', label:'Pinned', value:'yes', type:'select', options:[{value:'yes', label:'Yes'}, {value:'no', label:'No'}]}
    ],
    okText:'Create'
  });
  if(!result || !String(result.title || '').trim()) return;
  const res = await api('/api/recaps/create', {method:'POST', body:JSON.stringify({
    title:result.title,
    summary:result.summary,
    dmNotes:result.dmNotes,
    visibility:result.visibility,
    pinned:String(result.pinned || 'no') === 'yes'
  })});
  if(res.ok){ toast('Recap created'); await refreshAll(); }
  else toast(res.error || 'Failed');
});
