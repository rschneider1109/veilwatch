Veilwatch OS - Patched app.js (from your working v4.3 build)

What was added (without changing your login/UI style):
- Character Sheet tab (vitals/stats/conditions/notes/money) + Save
- DM-only: Duplicate character, Delete character (confirm)
- Inventory: row delete button
- Intel/Clues system:
  - DM: Create/Edit/Reveal/Hide/Archive
  - Player: Sees revealed clues only + search/tag/district filters + recap
  - Archived: Restore moves back to active list
- Notifications:
  - DM: "New Notification" button + notes field displayed
  - Players: "Your Requests" view shows status + DM notes
- Settings tab (DM-only):
  - Feature toggles (Shop / Intel)
  - Export/Import state JSON (DM key not importable)
  - Reset state
  - Change DM key (only if VEILWATCH_DM_KEY env is not set)
- Security: /api/state no longer returns dmKey to players
- /favicon.ico returns 204 to silence console noise

Install:
1) Backup current app.js
2) Replace with this app.js
3) Rebuild/restart docker container
4) Hard refresh (Ctrl+F5)


PATCH v4:
- Fix: refreshAll guards intel renderers (prevents renderIntelDM undefined crash).
- Fix: renderIntelPlayer/DM attached to window for safety.
- Fix: ensures server endpoints for /api/clues/* exist (prevents 404 Not Found).
- Fix: /api/state safe clone fallback if structuredClone missing.

PATCH v5:
- Fix: refreshAll guards renderSheet/renderSettings.
- Fix: Adds missing server endpoints for /api/clues/* (create/update/visibility/archive/restoreActive).
- Fix: Ensures renderSheet exists/attached to window to avoid ReferenceError.

PATCH v6:
- Fix: adds /api/settings/save endpoint (stops 404 spam; enables feature toggles + dm key UI).
- Fix: normalizes clues shape on load and before /api/state safe clone.
- Change: new clues default to visibility=revealed (players see immediately; DM can Hide).
- Fix: player intel reads clues from items/active/array.

PATCH v7:
- Adds automatic state polling every 5 seconds so Player/DM views update without manual actions.
- Forces Intel tab to render immediately when opened (no need to type/search to trigger render).
