/**
 * veilwatch_catalog_helpers_v1.js
 * Global helper utilities for catalog querying.
 * Expects:
 *   window.VW_CHAR_CATALOG or window.VEILWATCH_CATALOG
 */
(function(){
  "use strict";
  const norm = (v)=>String(v??"").trim().toLowerCase();
  function getCatalog(){
    return window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG || null;
  }
  function sortRecommendedFirst(items, recommendedIds){
    const set = recommendedIds instanceof Set ? recommendedIds : new Set(recommendedIds||[]);
    return (items||[]).slice().sort((a,b)=>{
      const ar = set.has(a?.id) ? 0 : 1;
      const br = set.has(b?.id) ? 0 : 1;
      if(ar!==br) return ar-br;
      return norm(a?.name||a?.modernName||a?.id).localeCompare(norm(b?.name||b?.modernName||b?.id));
    });
  }
  window.VeilwatchCatalog = { getCatalog, sortRecommendedFirst };
})();
