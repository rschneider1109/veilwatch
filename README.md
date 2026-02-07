Veilwatch Editable Repo (no base64 blob)
======================================

What this is
------------
This folder turns your working single-file stack into a normal repo you can edit.

- api/app.js  -> your actual Veilwatch server + UI (was inside APP_GZ_B64)
- api/Dockerfile, api/package.json -> builds the app image
- docker-compose.yml -> runs app + Postgres + Adminer

How to run locally
------------------
docker compose up -d --build

Open:
- http://localhost:8099/           (site)
- http://localhost:8099/api/state  (state)
- http://localhost:8099/api/health (health)
- http://localhost:8282            (Adminer DB UI)

Where to edit
-------------
Edit api/app.js

Then redeploy:
- docker compose up -d --build
or in Portainer: pull latest from GitHub + redeploy.

Veilwatch OS (Phase 2–5 + In-site Modals)
========================================

What you get
------------
Phase 2: Characters (create/select/edit/save, persists)
Phase 3: Shops (DM edit + Player buy adds to inventory + stock)
Phase 4: Notifications (Player requests + DM status)
Phase 5: Clues/Intel (DM reveal/archive; players only see revealed)
UI: Browser gray prompt boxes replaced with an in-site modal + toast.

How to run
----------
docker compose up -d --build

Open:
- http://localhost:8099/
- http://localhost:8099/api/state
- http://localhost:8099/api/health
- http://localhost:8282 (Adminer)

DM login
--------
Use the DM key set by VEILWATCH_DM_KEY in docker-compose.yml.

Notes
-----
If Postgres password changes, delete the db volume or ALTER USER inside Postgres.
