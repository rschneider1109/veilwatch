/**
 * Veilwatch Catalog Helpers (Global) v1
 * Date: 2026-02-08
 *
 * Works with classic <script> tags (non-module).
 *
 * Requires:
 *   - public/js/veilwatch_catalog.js  (must set window.VEILWATCH_CATALOG)
 *
 * Provides:
 *   - window.VeilwatchCatalogHelpers = { filterSpells, filterKits, sortRecommendedFirst, ... }
 *
 * Notes:
 * - This file does NOT modify your catalog data. It's just query helpers.
 */

(function () {
  "use strict";

  function normStr(v) {
    return String(v == null ? "" : v).trim().toLowerCase();
  }

  function includesSearchText(blob, q) {
    if (!q) return true;
    return normStr(blob).includes(normStr(q));
  }

  function setHasAny(haystackSet, needles) {
    if (!haystackSet || !needles || !needles.length) return true;
    for (var i = 0; i < needles.length; i++) {
      if (haystackSet.has(needles[i])) return true;
    }
    return false;
  }

  function getCatalog() {
    var c = window.VEILWATCH_CATALOG;
    if (!c || typeof c !== "object") {
      console.warn("[Catalog Helpers] window.VEILWATCH_CATALOG not found yet. Load veilwatch_catalog.js first.");
      return null;
    }
    return c;
  }

  function buildIndexes(catalog) {
    var spellsById = new Map();
    var kitsById = new Map();
    var talentsById = new Map();
    var classesById = new Map();

    (catalog.spells || []).forEach(function (s) { if (s && s.id) spellsById.set(s.id, s); });
    (catalog.kits || []).forEach(function (k) { if (k && k.id) kitsById.set(k.id, k); });
    (catalog.talents || []).forEach(function (t) { if (t && t.id) talentsById.set(t.id, t); });
    (catalog.classes || []).forEach(function (c) { if (c && c.id) classesById.set(c.id, c); });

    return { spellsById: spellsById, kitsById: kitsById, talentsById: talentsById, classesById: classesById };
  }

  function getIndexes() {
    var c = getCatalog();
    if (!c) return null;
    // cache indexes on the catalog object (non-enumerable)
    if (!c.__vwIndexes) {
      try {
        Object.defineProperty(c, "__vwIndexes", {
          value: buildIndexes(c),
          writable: false,
          enumerable: false,
          configurable: false
        });
      } catch (_e) {
        c.__vwIndexes = buildIndexes(c);
      }
    }
    return c.__vwIndexes;
  }

  // Spell filters
  function filterSpells(query) {
    var c = getCatalog();
    if (!c) return [];
    var q = query || {};

    var tiers = (q.tier == null) ? null : (Array.isArray(q.tier) ? q.tier : [q.tier]);
    var schools = (q.school == null) ? null : (Array.isArray(q.school) ? q.school : [q.school]);
    var castTimes = (q.castTime == null) ? null : (Array.isArray(q.castTime) ? q.castTime : [q.castTime]);
    var classId = q.classId || null;

    return (c.spells || []).filter(function (s) {
      if (!s) return false;

      if (tiers && tiers.indexOf(s.tier) === -1) return false;

      if (schools) {
        var ss = schools.map(normStr);
        if (ss.indexOf(normStr(s.school)) === -1) return false;
      }

      if (castTimes) {
        var ct = castTimes.map(normStr);
        if (ct.indexOf(normStr(s.castTime)) === -1) return false;
      }

      if (q.concentration === true && s.concentration !== true) return false;
      if (q.concentration === false && s.concentration === true) return false;

      var tagSet = new Set((s.tags || []).map(normStr));
      var tagNeedles = (q.tags || []).map(normStr);
      if (!setHasAny(tagSet, tagNeedles)) return false;

      // Optional class gating if your data has it (classes/classIds/availableTo)
      if (classId) {
        var allowed = s.classes || s.classIds || s.availableTo || null;
        if (Array.isArray(allowed) && allowed.length) {
          var a2 = allowed.map(normStr);
          if (a2.indexOf(normStr(classId)) === -1) return false;
        }
      }

      var blob = [
        s.name,
        s.modernName,
        s.summary,
        s.description,
        (s.tags || []).join(" "),
        s.school,
        s.castTime
      ].join(" ");

      if (!includesSearchText(blob, q.search)) return false;

      return true;
    });
  }

  // Kit filters
  function filterKits(query) {
    var c = getCatalog();
    if (!c) return [];
    var q = query || {};
    var classId = q.classId || null;

    return (c.kits || []).filter(function (k) {
      if (!k) return false;

      var tagSet = new Set((k.tags || []).map(normStr));
      var tagNeedles = (q.tags || []).map(normStr);
      if (!setHasAny(tagSet, tagNeedles)) return false;

      if (classId) {
        var allowed = k.classes || k.classIds || null;
        if (Array.isArray(allowed) && allowed.length) {
          var a2 = allowed.map(normStr);
          if (a2.indexOf(normStr(classId)) === -1) return false;
        }
      }

      var blob = [
        k.name,
        k.summary,
        (k.items || []).join(" "),
        (k.tags || []).join(" ")
      ].join(" ");

      if (!includesSearchText(blob, q.search)) return false;

      return true;
    });
  }

  function sortRecommendedFirst(items, recommendedIds) {
    var set = (recommendedIds instanceof Set) ? recommendedIds : new Set(recommendedIds || []);
    return (items || []).slice().sort(function (a, b) {
      var aId = a && a.id;
      var bId = b && b.id;
      var ar = (aId && set.has(aId)) ? 0 : 1;
      var br = (bId && set.has(bId)) ? 0 : 1;
      if (ar !== br) return ar - br;

      var an = normStr((a && (a.name || a.modernName || aId)) || "");
      var bn = normStr((b && (b.name || b.modernName || bId)) || "");
      return an.localeCompare(bn);
    });
  }

  function getRecommendedSpellIdsForClass(classId) {
    var c = getCatalog();
    if (!c) return new Set();
    var cls = (c.classes || []).find(function (x) { return normStr(x.id) === normStr(classId); });
    var ids = (cls && (cls.recommendedSpells || cls.recommendedSpellIds)) || [];
    return new Set((ids || []).map(String));
  }

  function getRecommendedKitIdsForClass(classId, subclassId) {
    var c = getCatalog();
    if (!c) return new Set();
    var cls = (c.classes || []).find(function (x) { return normStr(x.id) === normStr(classId); });
    var base = (cls && (cls.recommendedKits || cls.recommendedKitIds)) || [];
    var sub = [];
    if (subclassId && cls && Array.isArray(cls.subclasses)) {
      var sc = cls.subclasses.find(function (s) { return normStr(s.id) === normStr(subclassId); });
      sub = (sc && (sc.recommendedKits || sc.recommendedKitIds)) || [];
    }
    return new Set([].concat(base || [], sub || []).map(String));
  }

  // Expose
  window.VeilwatchCatalogHelpers = {
    getCatalog: getCatalog,
    getIndexes: getIndexes,
    filterSpells: filterSpells,
    filterKits: filterKits,
    sortRecommendedFirst: sortRecommendedFirst,
    getRecommendedSpellIdsForClass: getRecommendedSpellIdsForClass,
    getRecommendedKitIdsForClass: getRecommendedKitIdsForClass
  };

})();
