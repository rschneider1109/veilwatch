/**
 * server_catalog_route_patch_v1.mjs
 * Date: 2026-02-08
 *
 * ESM Express router to serve catalog assets from api/public.
 *
 * Usage (in api/server.js when using ESM):
 *   import catalogRouter from "./server_catalog_route_patch_v1.mjs";
 *   app.use("/catalog", catalogRouter);
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, "public");

router.use(express.static(PUBLIC_DIR));

router.get("/", (_req, res) => {
  res.redirect("/catalog/catalog_preview_standalone_v2.html");
});

export default router;
