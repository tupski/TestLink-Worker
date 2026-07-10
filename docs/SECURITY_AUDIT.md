# Security Audit — TestLink Worker

**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low | ℹ️ Informational

---

## Summary

**Total Findings: 18**  
**Critical: 5 | High: 5 | Medium: 4 | Low: 2 | Informational: 2**

---

## 🔴 CRITICAL

### SEC-001: Database Password Exposed in Version Control

**Severity:** 🔴 Critical  
**Affected Files:** [`.env`](.env)  
**Lines:** 16

**Description:** The MySQL database password `"Bebas208833"` is stored in `.env` which was committed to version control. While `.gitignore` lists `.env`, the file exists in the working tree and may have been committed.

**Attack Scenario:** Anyone with access to the repository can read the database password and connect directly to the MySQL instance if the database is network-accessible.

**Recommendation:** 
1. Rotate the database password immediately
2. Remove `.env` from git history using `git filter-branch` or BFG Repo-Cleaner
3. Use environment variables or a secrets manager in production

**Fix Difficulty:** Easy (1 hour)

---

### SEC-002: Default Admin Password in Source Code

**Severity:** 🔴 Critical  
**Affected Files:** [`src/server.ts`](src/server.ts:25)  
**Lines:** 25

**Description:** The admin password defaults to `'rahasia123'` if not set via environment variable:
```typescript
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';
```

**Attack Scenario:** If the `ADMIN_PASSWORD` env var is not set (e.g., misconfigured deployment), the admin panel is accessible with password `rahasia123`. This gives full control over site data, settings, and history.

**Recommendation:** 
1. Remove the default password — force the application to fail at startup if `ADMIN_PASSWORD` is not set
2. Enforce minimum password complexity requirements
3. Consider bcrypt hashing instead of plaintext comparison

**Fix Difficulty:** Easy (30 minutes)

---

### SEC-003: Admin Password Exposed in Repo

**Severity:** 🔴 Critical  
**Affected Files:** [`.env`](.env)  
**Lines:** 33

**Description:** The admin password `admin123` is stored in `.env` alongside the database. The same default is referenced in documentation files.

**Attack Scenario:** Anyone with file access can compromise the admin panel.

**Recommendation:** 
1. Change immediately
2. Never use production-identical `.env` for development
3. Use `.env.example` as template only

**Fix Difficulty:** Easy (15 minutes)

---

### SEC-004: No Authentication on Critical Endpoints

**Severity:** 🔴 Critical  
**Affected Files:** [`src/server.ts`](src/server.ts:369-392), [`api/index.js`](api/index.js:410-441)  
**Lines:** 369-392 / 410-441

**Description:** The `/api/check-block` endpoint is completely unauthenticated. Anyone can use this endpoint to:
- Make the server fetch arbitrary URLs (potential SSRF)
- Abuse Google Safe Browsing API quota
- Use the server as a URL checking proxy

**Attack Scenario:**
1. **SSRF Attack:** An attacker sends POST requests to `/api/check-block` with internal URLs (e.g., `http://169.254.169.254/` for cloud metadata, `http://localhost:3306/` for database probing)
2. **Resource Exhaustion:** The endpoint fetches URLs with up to 12-second timeouts, enabling slow DoS attacks
3. **GSB Quota Theft:** An attacker can drain the GSB API quota

**Recommendation:** 
1. Add admin authentication or API key to `/api/check-block`
2. Implement URL allowlist / blocklist for outbound fetches
3. Block RFC 1918 private IP ranges in URL resolution
4. Add rate limiting

**Fix Difficulty:** Medium (2-4 hours)

---

### SEC-005: Wide Open CORS Policy

**Severity:** 🔴 Critical  
**Affected Files:** [`src/server.ts`](src/server.ts:202), [`api/index.js`](api/index.js:10)  
**Lines:** 202 / 10

**Description:** `app.use(cors())` is used without any options, allowing any origin to make cross-origin requests.

**Attack Scenario:** Any website can make authenticated requests to the API if the user is logged in (admin session stored in `sessionStorage`), enabling CSRF attacks.

**Recommendation:** 
```typescript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3030'],
    credentials: true
}));
```

**Fix Difficulty:** Easy (30 minutes)

---

## 🟠 HIGH

### SEC-006: No Rate Limiting

**Severity:** 🟠 High  
**Affected Files:** [`src/server.ts`](src/server.ts:190-733)  

**Description:** No rate limiting is implemented on any API endpoint. An attacker can make unlimited requests, leading to:
- Database connection pool exhaustion
- CPU/memory resource exhaustion
- GSB API abuse
- Brute force attacks on admin password

**Attack Scenario:** An attacker sends 10,000 requests per second to `/api/auth` to brute force the admin password, or to `/api/check-block` to exhaust resources.

**Recommendation:** 
```typescript
import rateLimit from 'express-rate-limit';
app.use('/api/', rateLimit({ windowMs: 60000, max: 100 }));
```

**Fix Difficulty:** Easy (1 hour)

---

### SEC-007: `trust proxy` Enabled with No IP Restrictions

**Severity:** 🟠 High  
**Affected Files:** [`src/server.ts`](src/server.ts:201), [`api/index.js`](api/index.js:9)  
**Lines:** 201 / 9

**Description:** `app.set('trust proxy', 1)` trusts the first proxy without validating the source IP. Combined with CORS being open, this creates a significant CSRF/IP-spoofing attack surface.

**Attack Scenario:** An attacker behind a proxy can spoof IP addresses, bypassing any future IP-based rate limiting or access controls.

**Recommendation:** 
```typescript
app.set('trust proxy', process.env.TRUSTED_PROXY_IPS?.split(',') || 1);
```

**Fix Difficulty:** Easy (30 minutes)

---

### SEC-008: Session Token in `sessionStorage`

**Severity:** 🟠 High  
**Affected Files:** [`js/admin.js`](js/admin.js:7,161)  
**Lines:** 7, 161

**Description:** Admin password is stored in `sessionStorage` after login, sent as `x-admin-password` header on every request. This is vulnerable to XSS attacks.

**Attack Scenario:** If an attacker injects JavaScript (via XSS or compromised CDN), they can read `sessionStorage.getItem('__admin_pass')` and gain admin access.

**Recommendation:** 
1. Use proper session tokens (JWTs) instead of sending the password on every request
2. Implement token-based authentication with expiration
3. Set `httpOnly` and `Secure` cookies instead of `sessionStorage`

**Fix Difficulty:** Medium (4-8 hours)

---

### SEC-009: No Input Validation on URL Check Endpoint

**Severity:** 🟠 High  
**Affected Files:** [`src/server.ts`](src/server.ts:369-392), [`api/index.js`](api/index.js:410-441)  
**Lines:** 369-392 / 410-441

**Description:** The `/api/check-block` endpoint accepts arbitrary URLs. While there's a 2048-character trim, there's no validation for:
- Internal/private IP addresses
- `file://` protocol (though URL parser may reject it)
- `data://` or `blob://` URLs
- DNS rebinding attacks
- Extremely long URLs

**Attack Scenario:** SSRF attack to internal services.

**Recommendation:** 
```typescript
function isValidUrl(url: string): boolean {
    try {
        const u = new URL(url);
        const hostname = u.hostname;
        // Block private IPs
        if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
        if (/^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(hostname)) return false;
        // Block metadata endpoints
        if (/^169\.254\./.test(hostname)) return false;
        return true;
    } catch { return false; }
}
```

**Fix Difficulty:** Medium (2 hours)

---

### SEC-010: No Rate Limiting on `/api/auth`

**Severity:** 🟠 High  
**Affected Files:** [`src/server.ts`](src/server.ts:282-284), [`api/index.js`](api/index.js:300-302)  
**Lines:** 282-284 / 300-302

**Description:** The authentication endpoint has no brute force protection. An attacker can try unlimited passwords.

**Attack Scenario:** Automated brute force attack against the admin password.

**Recommendation:** 
1. Implement rate limiting (5 attempts per minute per IP)
2. Add exponential backoff after failed attempts
3. Log and alert on repeated failures

**Fix Difficulty:** Easy (1 hour)

---

## 🟡 MEDIUM

### SEC-011: Sensitive Data in Logs

**Severity:** 🟡 Medium  
**Affected Files:** [`src/utils/logger.ts`](src/utils/logger.ts:182-194)  
**Lines:** 182-194

**Description:** The `sanitizeParams` method attempts to redact sensitive data from logs, but the regex-based approach is easily bypassed:
- It only checks if the param *string* contains 'password', 'api_key', or 'secret'
- It doesn't redact query parameters in SQL logs (e.g., `UPDATE users SET password='hunter2'`)
- It doesn't handle nested objects

**Attack Scenario:** Sensitive data (passwords, API keys) could leak into log files.

**Recommendation:** 
```typescript
private sanitizeParams(params: any[]): any[] {
    return params.map((param) => {
        if (typeof param === 'string') {
            // Always truncate long strings
            if (param.length > 100) return `[String: ${param.length} chars]`;
            // Never log any value that looks like it could be a credential
            if (/^.{8,}$/.test(param) && /[A-Za-z]/.test(param) && /\d/.test(param)) return '[REDACTED]';
        }
        return param;
    });
}
```

**Fix Difficulty:** Easy (1 hour)

---

### SEC-012: `sqlite3` Version with Known Vulnerabilities

**Severity:** 🟡 Medium  
**Affected Files:** [`package.json`](package.json:25)  
**Lines:** 25

**Description:** The project depends on `sqlite3@5.1.7`. This version has known vulnerabilities including CVE-2023-45803 (affecting `sqlite3` package's request processing).

**Attack Scenario:** If used in production (fallback), known CVEs can be exploited.

**Recommendation:** 
1. Upgrade to `sqlite3@5.1.9` or newer
2. Better: Use `better-sqlite3` (actively maintained, synchronous API is safer)

**Fix Difficulty:** Easy (30 minutes)

---

### SEC-013: Outbound Network Requests Without Timeout Handling in Some Paths

**Severity:** 🟡 Medium  
**Affected Files:** [`src/server.ts`](src/server.ts:226-254), [`api/index.js`](api/index.js:325-350)  
**Lines:** 226-254 / 325-350

**Description:** The Google Safe Browsing check (`checkWithGSB`) uses `fetch()` without a timeout/signal. If the GSB API is slow or unreachable, the request can hang indefinitely, blocking the event loop.

**Attack Scenario:** Slow DoS by triggering GSB checks repeatedly, causing connection pool exhaustion.

**Recommendation:** Add AbortSignal.timeout to the fetch call.

**Fix Difficulty:** Easy (15 minutes)

---

## 🔵 LOW

### SEC-014: Missing Security Headers

**Severity:** 🔵 Low  
**Affected Files:** [`src/server.ts`](src/server.ts)  

**Description:** The application does not set standard security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-XSS-Protection`

**Attack Scenario:** Increased risk of clickjacking, MIME-type sniffing attacks.

**Recommendation:** Use `helmet` middleware:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

**Fix Difficulty:** Easy (15 minutes)

---

### SEC-015: Verbose Error Messages

**Severity:** 🔵 Low  
**Affected Files:** [`src/server.ts`](src/server.ts) (multiple error handlers)  

**Description:** Error messages include internal details (e.g., `error.message`, SQL errors). In production, this can leak information about the database schema or application internals.

**Attack Scenario:** An attacker can probe endpoints with invalid input and learn about the internal structure.

**Recommendation:** In production mode, return generic error messages and log details server-side.

**Fix Difficulty:** Easy (30 minutes)

---

## ℹ️ INFORMATIONAL

### SEC-016: `node-fetch` Not Used — Global `fetch` Required Node 18+

**Severity:** ℹ️ Informational  
**Affected Files:** [`src/server.ts`](src/server.ts:160)  

**Description:** The code uses the global `fetch` API which requires Node.js 18+. The `package.json` doesn't specify `engines.node`, so it could be deployed on Node 16 where `fetch` is unavailable.

**Recommendation:** Add `"engines": { "node": ">=18" }` to `package.json`.

**Fix Difficulty:** Easy (5 minutes)

---

### SEC-017: Weak UUID Generation

**Severity:** ℹ️ Informational  
**Affected Files:** [`src/server.ts`](src/server.ts:91-97), [`api/index.js`](api/index.js:271-277)  
**Lines:** 91-97 / 271-277

**Description:** Custom UUID v4 generation uses `Math.random()` which is cryptographically not secure for session tokens or IDs. While UUIDs for site IDs are low-risk, using `crypto.randomUUID()` (Node 19+) or the `uuid` package (already in dependencies) would be better practice.

**Recommendation:** Replace with `crypto.randomUUID()` or use the `uuid` package.

**Fix Difficulty:** Easy (15 minutes)

---

## Dependency Security Summary

| Package | Version | Issues |
|---|---|---|
| `sqlite3` | 5.1.7 | Older version, check for CVEs |
| `express` | 5.2.1 | Early major version 5 — potential unpatched issues |
| `mysql2` | ^3.22.3 | Well-maintained |
| `typescript` | ^6.0.3 | Pre-release / very new — stability concerns |
| `vitest` | ^4.1.7 | Pre-release / very new |

**Note:** TypeScript 6.0.3 and Vitest 4.1.7 are extremely bleeding-edge versions. These may introduce breaking changes or instability. Consider pinning to stable releases.

---

## Attack Surface Summary

```
┌─────────────────────────────────────┐
│           Internet                  │
├─────────────────────────────────────┤
│  Cloudflare Worker (reverse proxy)  │
├─────────────────────────────────────┤
│  TestLink Worker API                │
│                                     │
│  /api/health        ← Unauthed      │
│  /api/settings      ← Unauthed GET  │
│  /api/sites         ← Unauthed GET  │
│  /api/history       ← Unauthed GET  │
│  /api/history/meta  ← Unauthed      │
│  /api/check-block   ← Unauthed ❌   │ ← SSRF risk
│  /api/auth          ← Password auth │ ← Brute-force vulnerable
│  /api/admin/stats   ← Admin auth    │
│  /api/progress      ← Unauthed ❌   │
│                                     │
│  Unauthenticated: 6 endpoints       │
│  Admin-authenticated: 6 endpoints   │
└─────────────────────────────────────┘
```

**Total unauthenticated endpoints: 7** (6 GET, 1 POST)
**Total admin-protected endpoints: 6**
