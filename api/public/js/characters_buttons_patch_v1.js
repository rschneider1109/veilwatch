/**
 * characters_buttons_patch_v1.js
 * Date: 2026-02-08
 *
 * Purpose:
 * Your repo uses many files; if a character script refactor/merge caused
 * the "Character" tab buttons to stop responding (no handlers attached),
 * this patch re-attaches the expected handlers using CLICK DELEGATION.
 *
 * Works even if the buttons are created later or handlers were skipped.
 *
 * Install:
 * 1) Put this file in: api/public/js/characters_buttons_patch_v1.js
 * 2) In api/public/index.html, include it AFTER characters.js:
 *    <script src="/js/characters_buttons_patch_v1.js" defer></script>
 */

(function () {
  "use strict";

  const IDS = new Set([
    "newCharBtn",
    "addInvBtn",
    "addInvFromCatalogBtn",
    "addWeaponBtn",
    "addAbilityBtn",
    "addSpellBtn"
  ]);

  // Safe helpers
  const toast = (msg) => (window.toast ? window.toast(msg) : console.log("[toast]", msg));
  const api = (...a) => (window.api ? window.api(...a) : Promise.resolve({ ok:false, error:"api() not available" }));
  const refreshAll = () => (window.refreshAll ? window.refreshAll() : Promise.resolve());
  const getChar = () => (typeof window.getChar === "function" ? window.getChar() : null);

  function getCatalog() {
    // Prefer your existing helper if present
    if (typeof window.vwGetCatalog === "function") return window.vwGetCatalog();
    if (window.VEILWATCH_CATALOG) return window.VEILWATCH_CATALOG;
    if (typeof window.getCatalog === "function") return window.getCatalog();
    return null;
  }

  async function ensureCharacter() {
    const c = getChar();
    if (c) return c;
    toast("Create character first");
    return null;
  }

  async function onNewCharacter() {
    try {
      if (typeof window.vwNewCharacterWizard === "function") {
        const id = await window.vwNewCharacterWizard();
        if (!id) return;
        window.SESSION = window.SESSION || {};
        window.SESSION.activeCharId = id;
        toast("Character created");
        await refreshAll();
        return;
      }
      // Fallback: simple create
      const name = await window.vwModalInput?.({ title:"New Character", label:"Name", placeholder:"e.g., Mara Kincaid" });
      if (!name) return;
      const res = await api("/api/character/new", { method:"POST", body: JSON.stringify({ name }) });
      if (res && res.ok) {
        window.SESSION = window.SESSION || {};
        window.SESSION.activeCharId = res.id;
        toast("Character created");
        await refreshAll();
      } else {
        toast((res && res.error) ? res.error : "Failed to create");
      }
    } catch (e) {
      console.error(e);
      toast("Failed to create character");
    }
  }

  async function onAddInventoryRow() {
    try {
      const c = await ensureCharacter();
      if (!c) return;
      c.inventory = c.inventory || [];
      c.inventory.push({ category:"", name:"", weight:"", qty:"1", cost:"", notes:"" });
      const res = await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      if (res && res.ok) { toast("Added inventory row"); await refreshAll(); }
      else toast((res && res.error) ? res.error : "Failed");
    } catch (e) {
      console.error(e);
      toast("Failed to add inventory row");
    }
  }

  async function onAddFromCatalog() {
    try {
      const c = await ensureCharacter();
      if (!c) return;

      const cat = getCatalog();
      if (!cat) { toast("Catalog not loaded"); return; }

      const byCat = cat.inventoryItemsByCategory || cat.inventory_by_category || cat.inventory || {};
      const cats = Object.keys(byCat || {});
      if (!cats.length) { toast("No inventory catalog items"); return; }

      const chooseCat = await window.vwModalForm?.({
        title: "Add From Catalog",
        okText: "Next",
        fields: [{ key:"cat", label:"Category", type:"select", options: cats.map(x=>({ value:x, label:x })) }]
      });
      if (!chooseCat) return;

      const items = (byCat[chooseCat.cat] || []).slice();
      if (!items.length) { toast("No items in that category"); return; }

      const chooseItem = await window.vwModalForm?.({
        title: "Add From Catalog",
        okText: "Add",
        fields: [
          { key:"name", label:"Item", type:"select", options: items.map(n=>({ value:n, label:n })) },
          { key:"qty", label:"Qty", placeholder:"1" }
        ]
      });
      if (!chooseItem) return;

      c.inventory = c.inventory || [];
      c.inventory.push({ category: chooseCat.cat, name: chooseItem.name, weight:"", qty: chooseItem.qty || "1", cost:"", notes:"" });
      await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      toast("Item added");
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast("Failed to add from catalog");
    }
  }

  async function onAddWeapon() {
    try {
      const c = await ensureCharacter();
      if (!c) return;

      const cat = getCatalog();
      if (!cat) { toast("Catalog not loaded"); return; }

      const w = cat.weapons || {};
      const all = []
        .concat(w.sidearms || [])
        .concat(w.primaries || [])
        .concat(w.nonlethal || [])
        .concat(w.melee || []);

      if (!all.length) { toast("No weapons in catalog"); return; }

      const pick = await window.vwModalForm?.({
        title: "Add Weapon",
        okText: "Add",
        fields: [{ key:"weaponId", label:"Weapon", type:"select", options: all.map(x=>({ value:x.id, label:x.name })) }]
      });
      if (!pick) return;

      c.weapons = c.weapons || [];
      const wid = String(pick.weaponId || "").trim();
      if (!wid) return;

      if (typeof window.vwWeaponToRow === "function") {
        c.weapons.push(window.vwWeaponToRow(wid));
      } else {
        // Minimal fallback
        const found = all.find(x=>String(x.id)===wid);
        c.weapons.push({ id: wid, name: found?.name || wid, notes:"" });
      }

      await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      toast("Weapon added");
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast("Failed to add weapon");
    }
  }

  async function onAddAbility() {
    try {
      const c = await ensureCharacter();
      if (!c) return;

      const out = await window.vwModalForm?.({
        title:"Add Ability",
        okText:"Add",
        fields:[
          {key:"name",label:"Ability Name",placeholder:"e.g. Adrenal Spike"},
          {key:"type",label:"Type",placeholder:"passive / active / reaction"},
          {key:"hit",label:"Hit/DC",placeholder:"—"},
          {key:"effect",label:"Effect",placeholder:"Describe the effect"}
        ]
      });
      if (!out) return;

      c.abilities = c.abilities || [];
      c.abilities.push({
        id: (crypto.randomUUID?.() || ("a_" + Math.random().toString(16).slice(2))),
        name: out.name || "",
        type: out.type || "",
        hit: out.hit || "",
        effect: out.effect || ""
      });

      await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      toast("Ability added");
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast("Failed to add ability");
    }
  }

  async function onAddSpell() {
    try {
      const c = await ensureCharacter();
      if (!c) return;

      const out = await window.vwModalForm?.({
        title:"Add Spell",
        okText:"Add",
        fields:[
          {key:"name",label:"Spell Name",placeholder:"e.g. Ghost Signal"},
          {key:"level",label:"Level",placeholder:"0-9"},
          {key:"cast",label:"Cast",placeholder:"action / bonus / reaction"},
          {key:"effect",label:"Effect",placeholder:"Describe the effect"}
        ]
      });
      if (!out) return;

      c.spells = c.spells || [];
      c.spells.push({
        id: (crypto.randomUUID?.() || ("s_" + Math.random().toString(16).slice(2))),
        name: out.name || "",
        level: out.level || "",
        cast: out.cast || "",
        effect: out.effect || ""
      });

      await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      toast("Spell added");
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast("Failed to add spell");
    }
  }

  async function route(id) {
    switch (id) {
      case "newCharBtn": return onNewCharacter();
      case "addInvBtn": return onAddInventoryRow();
      case "addInvFromCatalogBtn": return onAddFromCatalog();
      case "addWeaponBtn": return onAddWeapon();
      case "addAbilityBtn": return onAddAbility();
      case "addSpellBtn": return onAddSpell();
      default: return;
    }
  }

  // Delegated click listener
  document.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!t) return;
    const id = t.id;
    if (!IDS.has(id)) return;

    // If a parent handler exists, we still run our route, but we prevent double triggers.
    e.preventDefault();
    e.stopPropagation();

    route(id);
  }, true);

  console.log("[Character Buttons Patch] active");
})();
