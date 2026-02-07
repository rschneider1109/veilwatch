const path = require("path");
const express = require("express");
const helmet = require("helmet");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[app] listening on :${PORT}`));
