---
name: testlink-overhaul-2026-10
overview: "Lanjutan UI/UX overhaul TestLink Worker (fokus Admin Panel) + audit keamanan menyeluruh dan remediasi: perbaikan bug escapeHtml, dialog konfirmasi custom, state tabel yang lengkap, hardening API (validasi input, proteksi DB, anti-SSRF), test harness Node, verifikasi PWA, dan pembaruan dokumentasi (ID)."
---

**Goal:** Continue the TestLink Worker UI/UX overhaul (Admin Panel first) and complete a full security audit with in-scope remediation, without changing business logic, API contracts, DB schema, or PWA behavior.

**Confirmed decisions (user):**

1. Speedtest: keep feature and graph as-is; strengthen "Simulasi" labeling in modal, results, and chart so no number is mistaken for a real measurement.
2. All new/updated docs in Indonesian (PLAN.md, UI_UX_AUDIT.md, SECURITY_AUDIT.md, QA_REPORT.md, CHANGELOG.md).

**Verified gaps to close (from audit):**

- Broken no-op `escapeHtml` in js/app.js:13-21; ~8 unescaped innerHTML injection points (app.js:225, 260-280, 631-638, 915-919, 1101; admin.js:306, 421-428; admin-links.js hrefs unvalidated).
- 5 native `confirm()` dialogs (app.js:1108; admin.js:325, 609; admin-links.js:141, 297) + native `alert()` fallback (admin.js:139).
- Admin tables missing consistent states: Antrean has no loading state; Link Manager render has no error state; Riwayat fixed 40 rows, no pagination.
- API: no validation on POST/PUT /api/sites, PUT /api/sites/order, POST /api/progress; no interval max on PUT /api/settings; SSRF-prone /api/check-block (follows redirects, no private-IP block); express.static serves data/database.sqlite; CORS dead check (api/index.js:26-27); non-timing-safe admin compare in GET /api/settings; rate limit counts successes.
- Cleanup: unused @supabase/supabase-js dep; dead js/countdown-worker.js (verify first); sw.js precache missing icons/icon-maskable-512.png.
- No automated tests exist; scripts/qa-static.js is not wired into npm.

**Must preserve:** window.open real navigation (app.js:497), per-device progress sync, all API contracts (additive hardening only), DB schema, SW cache-shell strategy, UI language (Indonesian), design system (docs/DESIGN_SYSTEM.md, dark slate + single indigo accent, ENERGY/RHYTHM/MOTION 1).

**Deliverables:** updated PLAN.md, UI_UX_AUDIT.md, QA_REPORT.md, CHANGELOG.md; new SECURITY_AUDIT.md; lean PRD.md (or documented rationale if skipped); final 9-section report in chat; antislop Delivery Gate PASS/FAIL report.

**Stack (unchanged):** Vanilla JS ES6+, Tailwind v3 CLI build (css/tailwind-built.css), Preline UI v2, Chart.js CDN, Express 5 + sqlite3 (api/index.js), service worker sw.js, manifest.webmanifest. No bundler, no framework, no new runtime dependencies.

**Phase A. Baseline and docs (no code changes):**

- Record baseline: `npm run build:css`, `node --check` on js/*.js + api/index.js + sw.js, `node scripts/qa-static.js`, start server (`npm start`, port 3000), curl smoke on all endpoints. Capture results for before/after comparison.
- Update docs/PLAN.md with new phases 11-16 (Indonesian, same structure as Fasa 0-10). Update docs/UI_UX_AUDIT.md sections 7-8 with verified current findings. PRD.md: the project already has an equivalent spec (docs/Hermes Master Prompt + DESIGN_SYSTEM.md + PLAN.md); add a short note in PLAN.md documenting the decision not to duplicate, unless a lean PRD.md is created instead.

**Phase B. XSS and escaping (worker + admin):**

- Fix `escapeHtml` in app.js (proper `&`, `<`, `>`, `"`, `'` escaping); add `escapeAttr` for attribute-context values.
- Apply escaping at all injection points: app.js 225, 260-280 (data.name, data.id), 631-638 (url + href), 915-919 (cleanUrl), 1101 (diff links); admin.js 306 (item.action), 421-428 (data.id in onclick); admin-links.js validate href scheme (http/https only) before rendering links.
- Consolidate the two admin.js escape helpers (200-207, 318-322) into one shared, correct implementation used by worker and admin.
- Rule: never inject server data into `onclick` string attributes; attach listeners via addEventListener or data-attributes + delegation where touched.

**Phase C. Custom confirm dialog:**

- One accessible dialog component (role="alertdialog", aria-modal, focus trap, Escape closes, visible focus, matches existing Preline overlay pattern in styles.css) shared by worker and admin.
- Replace all 5 native `confirm()` + the `alert()` fallback; preserve exact confirm semantics (cancel = no-op, confirm = same callback/flow). No behavioral change beyond the dialog surface.

**Phase D. Admin panel and worker polish (against DESIGN_SYSTEM.md, antislop mode DURING):**

- Antrean tab: add loading state; standardize empty/error states with existing `.empty-state` component.
- Link Manager: add error state to render; scheme-validate rendered hrefs.
- Riwayat: add pagination consistent with the worker history modal (5/10/25 per page), keep 50-entry fetch contract.
- Speedtest: strengthen "Simulasi" labels in modal header, results card, and chart annotation (index.html:334-376, app.js:816-840). No logic change.
- Any Tailwind class additions require `npm run build:css` rerun.

**Phase E. Security remediation (api/index.js, additive):**

- Add validation helpers: POST/PUT /api/sites (name: non-empty string, length cap; links: string or array normalized, per-link format check, total size cap), PUT /api/sites/order (array of integers, bounds), POST /api/progress (device_id/site_id/last_index/normal_count/error_count numeric, non-negative, caps), PUT /api/settings interval max (e.g. 3600) with honest server-side rounding noted in UI copy if needed. All return 400 with JSON error, never 500.
- /api/check-block SSRF hardening: resolve hostname, block private/loopback/link-local/multicast ranges, cap redirect hops (manual redirect handling, max 3, re-validate each hop).
- Static serving: middleware denying `data/` paths and `*.sqlite` before express.static.
- CORS: fix dead origin check (compare full origins correctly).
- Auth: timing-safe compare for admin password checks; rate limiter counts failed attempts only (verify current behavior first, keep 429 semantics).
- Keep dev fallback password gating exactly as-is (IS_DEV_FALLBACK, localhost-only, 503 when unset); document it as accepted residual risk.
- Each fix gets a regression test (Phase G) and a SECURITY_AUDIT.md entry (severity, evidence, remediation).

**Phase F. Cleanup and PWA:**

- Verify @supabase/supabase-js unused (grep all js + api + html), then remove from package.json dependencies.
- Verify js/countdown-worker.js unreferenced (grep app.js + sw.js + html), then delete and update sw.js ASSETS.
- sw.js: add icons/icon-maskable-512.png to precache; bump cache version (testlink-v10 to v11); keep cache-first shell, /api exclusion, SKIP_WAITING + APP_UPDATED flow unchanged.
- PWA verification: manifest fields/icons valid, SW registers and updates banner works, offline shell loads; explicitly document what cannot be verified here (install prompt, standalone launch, real-device offline, cellular ISP/DNS).

**Phase G. Tests and QA (zero new deps):**

- Add test harness with Node built-in `node:test`: API tests (auth 503/401/200 paths, validation 400 cases, settings whitelist, progress validation, static deny for data/*.sqlite), unit tests for escapeHtml/escapeAttr correctness and href scheme validation.
- package.json: `"test": "node --test"`, `"qa": "node scripts/qa-static.js"` (keep existing scripts).
- Extend scripts/qa-static.js: count native confirm/alert in admin.js and admin-links.js too, flag unescaped innerHTML patterns.
- Run full gate: build:css, qa-static, node --test, node --check (all JS), curl smoke, Playwright click-through (admin login, CRUD antrean, Link Manager search/filter/pagination/bulk, settings save round-trip, history pagination; worker runner start/pause/stop, history modal, confirm dialog Escape), responsive checks 320/375/768/1024/1440. Record actual results; no unverified PASS claims.

**Phase H. Documentation and final report:**

- New docs/SECURITY_AUDIT.md: findings per severity (Critical/High/Medium/Low), evidence with file:line, remediation status, residual risks (sessionStorage password, in-memory rate limit, dev fallback gating).
- Update docs/QA_REPORT.md (new results, manual-only list), CHANGELOG.md (new entry, Keep a Changelog format), docs/UI_UX_AUDIT.md, docs/PLAN.md (mark phases done).
- Output antislop Delivery Gate PASS/FAIL report and the 9-section final report in chat (Indonesian, no em dashes in UI text, no fabricated claims).

**Constraints:** No API contract changes beyond additive validation; no DB migration; no framework/bundler; security fixes narrowly scoped; where a fix is breaking or infra-level (e.g. TLS enforcement), document instead of changing.

# Agent Extensions

- Skill: refactor-safely. Purpose: guard refactors of shared JS (escape helpers, dialog component) with dependency awareness. Expected outcome: no broken call sites, verified impact list before edits.
- Skill: antislop. Purpose: filter applied DURING all UI work; Delivery Gate run before declaring UI phases done. Expected outcome: PASS/FAIL report with evidence per phase.
- Skill: antislop-code. Purpose: keep code comments clean during edits. Expected outcome: no generic AI comments added.
- Skill: security-audit. Purpose: structure the Phase E audit and remediation workflow. Expected outcome: findings with severity, evidence, remediation, residual risks in SECURITY_AUDIT.md.
- Skill: security-review. Purpose: systematic review of auth, injection, XSS, SSRF fixes. Expected outcome: confidence-based findings list cross-checked against code.
- MCP: Playwright MCP Server. Purpose: browser click-through verification (admin CRUD, dialogs, responsive viewports, console error check). Expected outcome: recorded click-through evidence for the R-35 gate and QA report.
- SubAgent: code-explorer. Purpose: verify remaining references before deleting countdown-worker.js and supabase dep; locate any missed injection points. Expected outcome: reference lists confirming safe removal.