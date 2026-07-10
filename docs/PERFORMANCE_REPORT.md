# Performance Report — TestLink Worker

---

## Bottleneck Analysis

### B-001: Synchronous File Operations on Startup

**Severity:** 🟡 Medium  
**Affected Files:** [`src/server.ts`](src/server.ts:64-74)  

**Description:** [`resolveProjectRoot()`](src/server.ts:63-72) uses `fs.existsSync()` to locate the project root. This blocks the event loop during startup.

**Impact:** Minor — startup latency only, but unnecessary.

**Recommendation:** Use `fs.promises.access()` or pre-configure the root path.

---

### B-002: No Query Result Pagination

**Severity:** 🟠 High  
**Affected Files:** [`src/server.ts`](src/server.ts:338,406-433)  

**Description:** The `/api/sites` endpoint loads ALL sites with ALL links into memory. If a site has thousands of links, this is transferred on every request.

**Current Code:**
```typescript
const sites = await this.db!.query<Site>('SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC');
```

**Impact:**
- Memory grows with number of sites × links
- Network payload grows unbounded
- No lazy loading for links field

**Recommendation:**
1. Implement server-side pagination for sites
2. Don't send full link text — send only link count + IDs until explicitly requested
3. Add response compression (gzip)

**Estimated Gain:** 40-60% bandwidth reduction for sites with 50+ links

---

### B-003: No Caching Layer

**Severity:** 🟠 High  
**Affected Files:** [`src/server.ts`](src/server.ts:287-300) — Settings endpoint  

**Description:** `/api/settings` queries the database on every request. Settings rarely change (only via admin panel), so this is a database roundtrip for every worker page load.

**Impact:** Unnecessary database load, especially with many concurrent workers.

**Recommendation:**
1. Cache settings in-memory with TTL (e.g., 30 seconds)
2. Invalidated cache on PUT /api/settings
3. Use ETag/If-None-Match headers for HTTP-level caching

**Estimated Gain:** 80-90% reduction in queries to kv_settings table

---

### B-004: No Connection Pool for SQLite

**Severity:** 🟡 Medium  
**Affected Files:** [`src/database/sqlite-adapter.ts`](src/database/sqlite-adapter.ts)  

**Description:** The SQLite adapter opens a single database connection. SQLite is inherently single-writer, but without WAL mode and proper connection pooling, concurrent reads block.

**Impact:**
- SQLite `serialize()` in schema creation blocks all operations
- No WAL mode — reads block writes and vice versa
- Not suitable for multi-device concurrent access

**Recommendation:**
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-64000; -- 64MB cache
```

**Estimated Gain:** 200-500% improvement in concurrent read throughput

---

### B-005: Inefficient Link Counting

**Severity:** 🔵 Low  
**Affected Files:** [`src/server.ts`](src/server.ts:338-342)  

**Description:** Admin stats endpoint loads ALL links from all sites, then splits and counts them in application code. For thousands of links, this is wasteful.

**Current Code:**
```typescript
const sites = await this.db!.query<{ links: string }>('SELECT links FROM sites');
sites.forEach((row) => {
    linkCount += row.links.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
});
```

**Recommendation:** Compute link count at INSERT time and store in a `link_count` column, or use a database-side computation.

**Estimated Gain:** Negligible for small datasets, significant (50%+) for 10,000+ links

---

### B-006: No Response Compression

**Severity:** 🔵 Low  
**Affected Files:** [`src/server.ts`](src/server.ts:200-204)  

**Description:** Express is used without compression middleware. JSON responses containing many links can be large.

**Impact:** Increased bandwidth usage, slower page loads for workers.

**Recommendation:** Add `compression` middleware.

**Estimated Gain:** 60-70% reduction in JSON response size

---

### B-007: `Math.random()` in UUID Generation

**Severity:** ℹ️ Informational  
**Affected Files:** [`src/server.ts`](src/server.ts:91-97)  

**Description:** Custom UUID implementation uses `Math.random()` which is slower than `crypto.randomUUID()`.

**Impact:** Negligible for individual UUIDs, but unnecessary technical debt.

**Recommendation:** Replace with `crypto.randomUUID()` (available in Node 19+) or the `uuid` package.

---

### B-008: 200ms Interval for Countdown Timer

**Severity:** 🔵 Low  
**Affected Files:** [`js/app.js`](js/app.js:120)  

**Description:** The countdown timer fires every 200ms via `setInterval`. This is 5 draws/second on the main thread just for a countdown display.

**Impact:** Minimal, but unnecessary CPU usage when the countdown is visible.

**Recommendation:** Use 1000ms interval with a `requestAnimationFrame` for the display update.

---

### B-009: Full Site List Re-render on Every Progress Update

**Severity:** 🟡 Medium  
**Affected Files:** [`js/app.js`](js/app.js:504)  

**Description:** After every single link test, [`finalizeAction()`](js/app.js:492-508) calls `renderSiteList()` which rebuilds the entire UI for all sites.

**Impact:** 
- DOM thrashing on every link test (potentially every 3-5 seconds)
- Complete re-render of all site cards, even though only one card changed
- Memory allocations for all DOM elements on each render

**Recommendation:**
1. Update only the affected site card's DOM
2. Use virtual DOM diffing or targeted DOM updates
3. Batch progress updates

**Estimated Gain:** 80-95% reduction in DOM manipulation per link test

---

## Memory Analysis

### Memory Allocation Hotspots

| Operation | Allocation | Frequency | Risk |
|---|---|---|---|
| Link text splitting | Grows with site size | Per request | Medium |
| JSON.parse response body | Up to 24KB per URL | Per check-block | Low |
| History selection (no LIMIT in query) | Grows with history size | Per request | Medium |
| Settings database query | ~1KB | Per page load | Low |
| Site list with all links | Grows with sites × links | Per page load | **High** |

### Memory Leak Risk: Zero

The TypeScript codebase has no obvious memory leak patterns. All database connections are properly released, timers are cleared, and there are no global accumulators.

However, the SQLite's `serialize()` method in the legacy `api/index.js` may queue operations indefinitely under heavy load.

---

## Concurrency Analysis

### MySQL Connection Pool

```
Pool Size: 10 (configurable)
Queue: Unlimited (queueLimit: 0)
```

**Risk:** Under high traffic, the unlimited queue can grow indefinitely, consuming memory. Connections are held for the duration of queries + GSB API calls (up to 12 seconds each).

### Request Processing

Express runs on a single thread. All database operations are async and non-blocking. However:

1. `/api/check-block` holds an HTTP connection open for up to 12 seconds
2. GSB API calls have no timeout and can hold connections indefinitely
3. Each worker device polls `/api/sites` and `/api/history` periodically
4. With 100 devices, this is 200 concurrent API requests minimum

### Concurrent Device Limit Estimation

| Scenario | Max Devices | Bottleneck |
|---|---|---|
| SQLite, Vercel | ~10 | SQLite serialization, /tmp storage |
| MySQL, 10 pool | ~50 | Connection pool saturation |
| MySQL, 50 pool | ~200 | Event loop saturation (GBS API calls) |
| MySQL, 50 pool + caching | ~500+ | Network bandwidth |

---

## Docker Image Size

**Current Status:** No Dockerfile exists. Estimated container image size for Node.js 20 + built application: **~250MB**

**Optimization Potential:**
- Multi-stage build could reduce to **~120MB**
- Alpine base could reduce to **~80MB**
- Removing devDependencies could reduce to **~60MB**

---

## Optimization Opportunities Summary

| Priority | Optimization | Expected Impact | Effort |
|---|---|---|---|
| P1 | Add query result caching | 80-90% reduction in DB reads | 2 hours |
| P1 | Enable SQLite WAL mode | 200-500% concurrent read improvement | 15 minutes |
| P1 | Implement response compression | 60-70% bandwidth reduction | 30 minutes |
| P2 | Add server-side pagination for sites | 40-60% bandwidth reduction | 4 hours |
| P2 | Targeted DOM updates (no full re-render) | 80-95% less DOM thrashing | 4 hours |
| P2 | Add GSB fetch timeout | Prevent indefinite connection hold | 15 minutes |
| P2 | Batch progress updates | 60-80% fewer API calls | 2 hours |
| P3 | Replace Math.random() UUID | Minor | 15 minutes |
| P3 | Compute link count at INSERT | 50% less processing for stats | 1 hour |

---

## Performance Score: **50/100**

**What's Good:**
- ✅ Asynchronous database operations (non-blocking I/O)
- ✅ Prepared statements (query plan caching)
- ✅ Connection pooling for MySQL
- ✅ Indexes on frequently queried columns
- ✅ Slow query detection and logging

**What's Missing:**
- ❌ No caching layer
- ❌ No response compression
- ❌ SQLite doesn't use WAL mode
- ❌ No pagination for site lists
- ❌ Complete DOM re-rendering on every update
- ❌ No batch processing for progress updates
- ❌ Real pool statistics not implemented (hardcoded values)
