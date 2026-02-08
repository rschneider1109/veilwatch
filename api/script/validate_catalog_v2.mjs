/**
 * scripts/validate_catalog_v2.mjs
 * Date: 2026-02-08
 *
 * Validates a catalog JS file that exports VEILWATCH_CATALOG (ESM).
 *
 * Run:
 *   node scripts/validate_catalog_v2.mjs public/js/veilwatch_catalog.js
 */

import path from "path";
import { pathToFileURL } from "url";

const target = process.argv[2] || "./public/js/veilwatch_catalog.js";
const abs = path.resolve(process.cwd(), target);

function fail(msg) {
  console.error("✖", msg);
  process.exitCode = 1;
}

function checkUnique(arr, label) {
  const seen = new Set();
  for (const item of arr || []) {
    const id = item?.id;
    if (!id) {
      fail(`${label} item missing id: ${JSON.stringify(item)?.slice(0, 120)}`);
      continue;
    }
    if (seen.has(id)) fail(`${label} duplicate id: ${id}`);
    seen.add(id);
  }
}

try {
  const url = pathToFileURL(abs).href;
  const mod = await import(url);
  const catalog = mod.VEILWATCH_CATALOG || mod.default || mod.catalog;

  if (!catalog) fail("Catalog missing. Export VEILWATCH_CATALOG (or default/catalog).");
  if (!catalog?.meta?.version) fail("catalog.meta.version missing.");
  if (!Array.isArray(catalog?.spells)) fail("catalog.spells must be an array.");
  if (!Array.isArray(catalog?.classes)) fail("catalog.classes must be an array.");
  if (!Array.isArray(catalog?.kits)) fail("catalog.kits must be an array.");

  checkUnique(catalog.spells, "spell");
  checkUnique(catalog.kits, "kit");
  checkUnique(catalog.talents, "talent");
  checkUnique(catalog.classes, "class");

  if (process.exitCode !== 1) console.log("✔ Catalog validation passed:", catalog.meta?.version);
} catch (err) {
  fail(err?.stack || String(err));
}
