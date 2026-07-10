# Code Quality — TestLink Worker

---

## Maintainability Score: **45/100**

---

## Large Files Analysis

| File | Lines | Verdict |
|---|---|---|
| `api/index.js` | 660 | ❌ Too large, monolithic |
| `src/server.ts` | 735 | ❌ Too large, violates SRP |
| `js/admin.js` | 1,215 | ❌ Too large, no separation |
| `js/app.js` | 981 | ❌ Too large, all logic in one file |
| `src/scripts/migrate.ts` | 574 | ⚠️ Borderline acceptable for script |
| `css/styles.css` | 382 | ⚠️ Acceptable for a single-page app |
| `css/admin-enhancements.css` | 398 | ⚠️ Acceptable |

**Total TypeScript source lines (src/):** ~2,600  
**Total JavaScript source lines (js/):** ~2,200  
**Total Legacy JavaScript (api/):** ~660

**Analysis:** The codebase has 3 independent files that are each 500+ lines. This is a clear sign of missing modularization.

---

## Complex Functions

### server.ts — `setupRoutes()` (Lines 258-649)
- **Length:** ~391 lines
- **Responsibility:** Defines ALL route handlers, middleware, and serving logic
- **Issues:** 
  - 14+ route handlers defined in one function
  - Mixes route definition with business logic
  - Mixed language comments (Indonesian + English)
  - Cannot test individual routes

### app.js — `executeOpenLink()` (Lines 373-437)
- **Length:** ~65 lines
- **Responsibility:** Handles entire link execution flow (check block, open URL, mode handling)
- **Issues:**
  - Too many responsibilities in one function
  - Mutates global state (`data.lastIndex++`, `data.error++`)
  - Mixed concerns: API calls, UI updates, state management
  - Race condition potential with `countdownFiring` flag

### app.js — `startPingTestDetailed()` (Lines 781-845)
- **Length:** ~65 lines
- **Responsibility:** Ping test execution
- **Issues:**
  - Direct DOM manipulation mixed with business logic
  - Sequential loop (no parallelism for ping checks)
  - State mutation in global variables

---

## Duplicate Logic

### 1. URL Block Check Logic — Duplicated Across Two Files

**`api/index.js`:**
```javascript
async function resolveUrlWithRedirects(startUrl, maxMs) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), maxMs);
    ...
}
```

**`src/server.ts`:**
```typescript
async function resolveUrlWithRedirects(startUrl: string, maxMs: number): Promise<ResolveResult> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), maxMs);
    ...
}
```

**Issue:** The block checking logic is duplicated verbatim between the legacy JS and TypeScript versions (lines 94-177 in `api/index.js` vs lines 119-183 in `src/server.ts`). Any bug fix must be applied twice.

### 2. WIB Time Functions — Duplicated

**`api/index.js`:**
```javascript
function getNowWIB() { ... }
```
**`src/server.ts`:**
```typescript
function getNowWIB(): string { ... }
```

### 3. UUID Generation — Duplicated

**`api/index.js`:**
```javascript
function uuidv4() { ... }
```
**`src/server.ts`:**
```typescript
function uuidv4(): string { ... }
```

### 4. Admin Password Validation — Duplicated

**`api/index.js`:**
```javascript
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';
```
**`src/server.ts`:**
```typescript
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';
```

### 5. Static File Serving — Duplicated

Both files serve the same static assets with nearly identical code.

---

## Type Safety Analysis

### TypeScript Strict Mode: ✅ ENABLED
The `tsconfig.json` has strict mode enabled with all strict flags.

### Usage of `any`: ⚠️ FREQUENT

**Affected Files:**
- [`src/types/database.ts`](src/types/database.ts:33,56,64) — `query<T = any>` and `execute` use `any[]` for params
- [`src/database/mysql-adapter.ts`](src/database/mysql-adapter.ts:88,113) — Uses `any[]` for params
- [`src/database/sqlite-adapter.ts`](src/database/sqlite-adapter.ts:181,206) — Same issue
- [`src/utils/logger.ts`](src/utils/logger.ts:24,72) — `context?: Record<string, any>`

**Analysis:** While the generic type defaults to `any`, the actual usage in `server.ts` properly types query results (e.g., `query<Site>`, `query<Progress>`). The primary concern is parameter arrays typed as `any[]`.

### Non-null Assertions (`!`)

**Critical:** [`src/server.ts`](src/server.ts) uses `this.db!` in every route handler. This is dangerous — if `db` is null (initialization failed), this causes a runtime crash:

```typescript
const rows = await this.db!.query<KVSetting>('SELECT `key`, value FROM kv_settings');
```

If `this.db` is null, this throws `TypeError: Cannot read properties of null` — a 500 error that doesn't explain the issue.

**Recommendation:** Replace `this.db!` with early checks:
```typescript
if (!this.db) {
    return res.status(503).json({ error: 'Database not initialized' });
}
```

---

## Dead Code

### 1. Empty `src/routes/` Directory
The `src/routes/` directory exists but is completely empty. It appears to be intended for route modularization that was never implemented.

### 2. Unused CSS Animation `@keyframes clickZoom`
Defined in [`css/styles.css`](css/styles.css:290-294) but never referenced in the HTML or JS.

### 3. `server.js` Shim File
The [`server.js`](server.js) file is a one-liner that simply requires `api/index.js`. This is a compatibility shim that could be removed.

### 4. `about.html`, `403.html`, `404.html`, `500.html`
While these are not necessarily dead code, they add to the maintenance surface area.

---

## Naming Conventions

### Inconsistent Language Mixing

The codebase mixes Indonesian and English arbitrarily:

| Term | Language | File |
|---|---|---|
| `Situs tidak ditemukan` | Indonesian | `src/server.ts:551` |
| `Invalid data` | English | `src/server.ts:475` |
| `Endpoint-nya nyasar, nih` | Indonesian | `src/server.ts:638` |
| `Tidak ada pengaturan yang valid.` | Indonesian | `src/server.ts:308` |
| `Failed to initialize database` | English | `src/server.ts:662` |

**Recommendation:** Choose a single language for technical messages (preferably English for error messages, with user-facing messages in Indonesian).

### Variable Naming
- `mt`, `mvt`, `mvc` in [`js/app.js`](js/app.js:310-312) — unclear abbreviations
- `rk`, `rl`, etc. — cryptic short names
- `__tl_hist_seen_id`, `__linkflow_uuid` — inconsistent prefix patterns

---

## Code Smells

### S-01: `catch (e) {}` — Silent Failure (Critical)
**Files:** Multiple locations across `src/server.ts`, `api/index.js`, `js/app.js`

**Impact:** Debugging is impossible. Production issues remain invisible.

### S-02: `this.db!` — Non-null Assertions (High)
**Files:** [`src/server.ts`](src/server.ts:289,303,338,356,395,409,437,448,453,471,483,498,509,513,534,547,559,581,595,624)

**Impact:** Runtime crashes if database is not initialized.

### S-03: Global State Mutation (Medium)
**Files:** [`js/app.js`](js/app.js:13-36) — 10+ global mutable variables

**Impact:** Impossible to reason about state changes, hard to test.

### S-04: `async` functions without proper error handling (Medium)
**Files:** Multiple route handlers return promises without catching all paths.

### S-05: Magic Numbers (Low)
- 24000 (response body prefix length) — appears twice
- 12000 (timeout for URL resolution) — appears twice
- 300, 500, 12000 — truncation limits, scattered across code

---

## Comments Analysis

### Good Comments
```typescript
/**
 * Load database configuration from environment variables
 * Reads configuration from process.env and constructs a DatabaseConfig object.
 * Validates required fields based on database type.
 * @returns DatabaseConfig object populated from environment variables
 * @throws Error if required environment variables are missing or invalid
 */
```

The TypeScript code has well-documented JSDoc comments on all major functions, which is excellent.

### Unnecessary / Redundant Comments
```typescript
// Initialize database
console.log('🔌 Initializing database...');
```
The emoji + log message is redundant with the comment.

### Missing Comments
- No explanation of the business purpose of `BLOCK_PAGE_FRAGMENTS`
- No documentation of the GSB integration's throttling/rate limits
- No explanation of the synchronization strategy between worker and server

---

## Readability Issues

1. **Mixed language** — Indonesian and English comments in the same file
2. **Inconsistent formatting** — Some functions have proper JSDoc, others have inline comments
3. **Deeply nested callbacks** — `api/index.js` has callback hell patterns:
```javascript
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    db.all(`SELECT links FROM sites`, [], (err, rows) => {
        ...
        db.get(`SELECT COUNT(*) AS c FROM history`, [], (e2, hrow) => {
            ...
            db.get(`SELECT COUNT(*) AS c FROM sites`, [], (e3, srow) => {
```

4. **CSS with no BEM methodology** — Class names are mixed between Tailwind utility classes and custom classes
5. **HTML with inline event handlers** — `onclick="selectCat(...)"` patterns make refactoring difficult

---

## Code Quality Score Breakdown

| Metric | Score | Notes |
|---|---|---|
| Modularity | 30/100 | Monolithic files, dual backend |
| Type Safety | 65/100 | Strict mode on but `any` and `!` used frequently |
| Duplication | 40/100 | Major duplication between JS and TS versions |
| Naming | 55/100 | Mixed languages, some ambiguous names |
| Error Handling | 25/100 | Silent catches, no global handler |
| Testability | 10/100 | Impossible to unit test without refactoring |
| Readability | 50/100 | Mixed quality, some callbacks, some async/await |
| Documentation | 55/100 | Good JSDoc but no architecture docs |
| **Overall** | **45/100** | **Below average** |
