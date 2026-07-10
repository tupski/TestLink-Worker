# Reliability Report — TestLink Worker

---

## Failure Scenario Analysis

### F-001: Database Connection Failure on Startup

**Risk Level:** 🔴 Critical  
**Likelihood:** Medium  
**Impact:** Application fails to start

**Scenario:** MySQL server is unreachable at application startup (network issue, DB restart, misconfiguration).

**Current Behavior:** The [`start()`](src/server.ts:653-677) method throws an error and calls `process.exit(1)`. The retry mechanism in [`MySQLAdapter.initialize()`](src/database/mysql-adapter.ts:35-82) will attempt 3 retries with exponential backoff (1s, 2s, 4s).

**Analysis:**
- ✅ Retry with jitter is well-implemented
- ❌ No circuit breaker pattern — if MySQL is down, all 3 retries fire every restart
- ❌ No fallback to degraded mode (read-only cache, maintenance page)
- ❌ No health check before marking instance as healthy
- ❌ Docker restart policy not configured (no Dockerfile)

**Recommendation:** Implement circuit breaker, exponential backoff with capped retries, and a health check endpoint that checks connectivity before declaring the service healthy.

---

### F-002: SQLite Data Loss on Vercel

**Risk Level:** 🔴 Critical  
**Likelihood:** High (Vercel deployments)  
**Impact:** Complete data loss

**Scenario:** When deployed on Vercel (serverless), the SQLite database is stored in `/tmp`. Any cold start or deployment causes complete data loss.

**Current Behavior:** [`api/index.js`](api/index.js:179-199) logs: `"⚠️ Warning: Data stored in /tmp will be lost when the server restarts on Vercel."`

**Analysis:**
- ✅ Honest warning exists
- ❌ Data loss is silently accepted as "normal" — this is catastrophic for a production worker
- ❌ No backup mechanism, no external database sync
- ❌ Users may not see the warning in serverless logs

**Recommendation:** This worker must NOT run on Vercel with SQLite. Use MySQL adapter for production, or implement periodic backups to external storage.

---

### F-003: Uncaught Promise Rejections

**Risk Level:** 🟠 High  
**Likelihood:** High  
**Impact:** Silent failures, memory leaks

**Scenario:** Multiple endpoints have empty catch blocks (`catch (e) {}`) that silently swallow errors.

**Affected Files:**
- [`src/server.ts`](src/server.ts:67) — Empty catch in `resolveProjectRoot`
- [`src/server.ts`](src/server.ts:134) — Empty catch in `readResponseBodyPrefix`  
- [`src/server.ts`](src/server.ts:251) — Empty catch in `checkWithGSB` (returns false on any error)
- [`js/app.js`](js/app.js:67) — Empty catch in `loadAppSettings`
- [`js/app.js`](js/app.js:131-133) — Empty catch in refreshHistoryBadgeMeta
- [`js/app.js`](js/app.js:403) — Empty catch in executeOpenLink

**Analysis:**
- ❌ Silent error swallowing makes debugging impossible
- ❌ Network failures, JSON parse errors, and DB errors are invisible
- ❌ In Node.js, unhandled promise rejections will crash future Node versions

**Recommendation:**
1. Replace ALL empty catch blocks with at least a `console.warn` or structured logger call
2. Add a global `process.on('unhandledRejection')` handler
3. Never silently swallow errors in production code

---

### F-004: Race Condition in Progress Updates

**Risk Level:** 🟠 High  
**Likelihood:** Medium  
**Impact:** Progress data inconsistency

**Scenario:** Multiple browser tabs (or multiple devices) run the same site simultaneously. The [`finalizeAction()`](js/app.js:492-508) function sends progress updates that can overwrite each other.

**Current Behavior:** The `/api/progress` endpoint uses `ON DUPLICATE KEY UPDATE` — last writer wins.

**Analysis:**
- ❌ No device coordination — two devices checking the same site will overwrite each other's progress
- ❌ Progress is client-reported, not server-authoritative
- ❌ No server-side reconciliation of progress state

**Recommendation:**
1. Make progress server-authoritative — don't trust client-reported `lastIndex`
2. Add locking or optimistic concurrency control
3. Consider per-device progress being additive, not absolute

---

### F-005: No Connection Pool Health Monitoring

**Risk Level:** 🟠 High  
**Likelihood:** Low  
**Impact:** Connection pool exhaustion, sudden downtime

**Scenario:** Under high load, the MySQL connection pool (default 10 connections) can be exhausted. Queries will queue up to `queueLimit: 0` (unlimited queue).

**Current Behavior:** [`getPoolStats()`](src/database/mysql-adapter.ts:219-226) always returns `activeConnections: 0` and `idleConnections: 0` — these values are hardcoded, not actual pool statistics.

**Analysis:**
- ❌ Pool statistics are faked/not implemented
- ❌ No monitoring of connection pool utilization
- ❌ Unlimited queue can cause memory exhaustion (queueLimit: 0)
- ❌ No warning when pool utilization exceeds threshold
- ✅ `waitForConnections: true` prevents connection errors but at the cost of latency

**Recommendation:**
1. Use `pool.poolstats()` from mysql2 to get real pool metrics
2. Implement pool health monitoring
3. Alert when pool utilization > 80%
4. Set a reasonable `queueLimit` (e.g., 100)

---

### F-006: No Graceful Degradation for Downstream API Failures

**Risk Level:** 🟡 Medium  
**Likelihood:** Medium  
**Impact:** Failed URL checks, degraded UX

**Scenario:** The `/api/check-block` endpoint calls external APIs (Google Safe Browsing) and fetches target URLs. If these external services are slow or down, the endpoint degrades.

**Current Behavior:** 
- GSB check silently fails (returns false) on any error
- URL fetch has a 12-second timeout
- No caching of results

**Analysis:**
- ❌ No timeout on GSB API call (can hang forever)
- ❌ No caching of block check results (same URL checked repeatedly)
- ❌ No fallback if primary check service is down
- ❌ Missing circuit breaker for external dependencies

**Recommendation:**
1. Add timeout to GSB fetch
2. Cache block check results (TTL: 5 minutes)
3. Implement circuit breaker for external services
4. Return cached/stale results when services are down

---

### F-007: Crash on Invalid JSON Body

**Risk Level:** 🟡 Medium  
**Likelihood:** Low  
**Impact:** 500 error, potential crash

**Scenario:** Client sends malformed JSON in request body.

**Current Behavior:** Express JSON body parser will throw on invalid JSON. Without a global error handler, this can crash the process.

**Analysis:**
- ❌ No global Express error handler registered
- ❌ `express.json()` may throw uncaught errors
- ❌ Many endpoints use `this.db!` (non-null assertion) — if db is null, crash

**Recommendation:**
```typescript
this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, path: req.path });
    res.status(500).json({ error: 'Internal server error' });
});
```

---

## Idempotency Analysis

### Site Creation (`POST /api/sites`)
- ✅ UUID v4 generated server-side — idempotent at creation
- ❌ No duplicate detection by name — same site name can be created multiple times
- ❌ No request idempotency key support

### Progress Update (`POST /api/progress`)
- ❌ **NOT idempotent** — Last writer wins, no version/sequence tracking
- ❌ Client sends absolute `lastIndex` — if two requests are in flight, one overwrites the other

### Settings Update (`PUT /api/settings`)
- ❌ **NOT idempotent** — Direct upsert with no validation of previous state
- ❌ No version tracking for conflict detection

### Site Delete (`DELETE /api/sites/:id`)
- ✅ Idempotent — delete ignores if already deleted (row count may differ)
- ✅ Transaction wraps all operations

---

## Crash Scenarios

### Database Connection Lost Mid-Operation
- ❌ MySQL adapter uses `pool.execute()` which returns a connection from the pool
- If a connection is lost mid-query, mysql2 throws an error caught by the adapter
- The retry utility only triggers on startup, not on mid-operation failures
- ❌ No mechanism to reestablish connection pool mid-operation

### Server Process Terminated Unexpectedly (SIGKILL)
- ❌ No mechanism to recover in-progress operations
- Progress is client-reported and stored in DB — in-flight updates are lost
- ❌ No WAL mode for SQLite (data integrity on crash)
- ❌ No transaction journal for MySQL beyond default InnoDB doublewrite

### Out of Memory (OOM)
- ❌ No memory limits configured (no Docker, no `--max-old-space-size` Node flag)
- Processing thousands of links could cause OOM
- The `resolveUrlWithRedirects` function reads full response bodies for up to 24KB per URL
- ❌ No streaming/batch processing for large link sets

---

## Worker Stability Score: **4/10**

### What's Working:
1. ✅ Graceful shutdown with SIGTERM/SIGINT handling
2. ✅ Connection pooling with configurable limits
3. ✅ Retry logic with exponential backoff and jitter
4. ✅ Transaction support for critical operations
5. ✅ Prepared statements prevent SQL injection

### What's Missing:
1. ❌ No circuit breaker for external dependencies
2. ❌ No health monitoring / alerting
3. ❌ No crash recovery mechanism
4. ❌ Silent error handling hides failures
5. ❌ No graceful degradation mode
6. ❌ Race conditions in progress updates
7. ❌ No idempotency for critical operations
8. ❌ No connection pool health monitoring

---

## Production Failure Scenarios (Categorized)

| Scenario | Likelihood | Impact | Priority |
|---|---|---|---|
| Database unreachable on startup | Medium | High | P0 |
| SQLite data loss on Vercel | High | Critical | P0 |
| Connection pool exhaustion | Low | High | P1 |
| Race condition in progress sync | High | Medium | P1 |
| Silent error swallowing | High | Medium | P1 |
| Uncaught JSON parse error | Low | Medium | P2 |
| GSB API timeout | Medium | Low | P2 |
| OOM on large link processing | Low | High | P2 |
| Cross-device progress conflict | High | Medium | P1 |
| Auth bypass (default password) | Medium | Critical | P0 |
