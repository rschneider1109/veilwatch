/**
 * server_catalog_route_patch_v1.cjs
 * Date: 2026-02-08
 *
 * CommonJS Express router to serve catalog assets from api/public.
 *
 * Usage (in api/server.js):
 *   const catalogRouter = require("./server_catalog_route_patch_v1.cjs");
 *   app.use("/catalog", catalogRouter);
 */

const express = require("express");
const path = require("path");

const router = express.Router();

// Your repo: api/public
const PUBLIC_DIR = path.join(__dirname, "public");

router.use(express.static(PUBLIC_DIR));

router.get("/", (_req, res) => {
  res.redirect("/catalog/catalog_preview_standalone_v2.html");
});

module.exports = router;
