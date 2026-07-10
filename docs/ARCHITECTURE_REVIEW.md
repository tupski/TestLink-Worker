# Architecture Review — TestLink Worker

---

## Project Structure

```
TestLink Worker/
├── api/                    # Legacy JavaScript API (Vercel deployment)
│   └── index.js            # ~660 lines, monolithic Express app
├── cloudflare/             # Cloudflare Worker reverse proxy
│   ├── worker.js
│   └── wrangler.toml
├── css/                    # Frontend styles
│   ├── styles.css          # Main app styles
│   └── admin-enhancements.css  # Admin panel enhancements
├── data/                   # SQLite database storage
├── icons/                  # PWA icons
├── js/                     # Frontend JavaScript
│   ├── admin.js            # Admin panel logic (~1215 lines)
│   ├── app.js              # Main worker app logic (~981 lines)
│   └── countdown-worker.js # Web Worker for countdown timer
├── src/                    # TypeScript backend
│   ├── index.ts            # Entry point
│   ├── server.ts           # Main server class (~735 lines)
│   ├── database/           # Database abstraction layer
│   │   ├── factory.ts      # Adapter factory (~180 lines)
│   │   ├── mysql-adapter.ts # MySQL adapter (~228 lines)
│   │   ├── sqlite-adapter.ts # SQLite adapter (~278 lines)
│   │   └── schema.ts       # MySQL schema initialization (~193 lines)
│   ├── routes/             # 🚩 EMPTY DIRECTORY
│   ├── scripts/
│   │   └── migrate.ts      # SQLite→MySQL migration (~574 lines)
│   ├── types/
│   │   └── database.ts     # TypeScript interfaces (~197 lines)
│   └── utils/
│       ├── logger.ts       # Structured logging (~199 lines)
│       └── retry.ts        # Retry logic with backoff (~203 lines)
├── .env                    # 🚩 SECRETS EXPOSED
├── .env.example            # Template environment file
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── *.html                  # Static pages
```

---

## Architecture Assessment: **55/100**

---

## Architectural Strengths ✅

### 1. Database Abstraction Layer (Well Done)
The `DatabaseAdapter` interface and factory pattern is the best-designed part of the codebase.

**Good:**
- Clean interface with `query()`, `execute()`, `beginTransaction()`, `close()`
- Factory pattern for adapter selection based on environment
- Both MySQL and SQLite implementations follow the same contract
- Transaction interface is well-designed with commit/rollback

### 2. Retry Utility (Well Done)
The retry module in [`src/utils/retry.ts`](src/utils/retry.ts) is production-quality:
- Exponential backoff with configurable multiplier
- Jitter to prevent thundering herd
- Retryable error detection using patterns
- User-friendly error messages in Indonesian
- Custom `DatabaseError` class with metadata

### 3. Logger Utility (Good Foundation)
The logger in [`src/utils/logger.ts`](src/utils/logger.ts) has:
- Singleton pattern (consistent instance)
- Level filtering (debug → error)
- Environment-aware formatting (JSON in production)
- Parameter sanitization
- Slow query detection (>1s threshold)

### 4. Graceful Shutdown Pattern (Good)
The shutdown handler properly:
- Listens for SIGTERM and SIGINT
- Closes HTTP server gracefully
- Closes database connections
- Exits cleanly

### 5. TypeScript Strict Mode (Good Foundation)
```json
{
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true
}
```

---

## Architectural Weaknesses ❌

### W-001: Dual Backend Problem (Critical)

**Issue:** The project has TWO competing backends:
1. Legacy JavaScript: [`api/index.js`](api/index.js) (660 lines)
2. TypeScript migration: [`src/server.ts`](src/server.ts) (735 lines)

**Analysis:**
- ❌ Two codebases to maintain (bug fixes needed in both)
- ❌ Route logic is duplicated across both files
- ❌ Both can be deployed, causing confusion
- ❌ Legacy code has no types, no logger, no retry logic
- ❌ API behavior may diverge between versions
- ❌ The `api/index.js` is what gets deployed to Vercel

**Recommendation:** Complete the migration to TypeScript and remove `api/index.js` from the deployment path.

---

### W-002: Monolithic Server Class (High)

**Issue:** [`src/server.ts`](src/server.ts) is a 735-line file containing:
- Server class
- All API route handlers (14+ routes)
- Helper functions (URL checking, WIB time, UUID)
- Startup and shutdown logic

**Analysis:**
- ❌ Violates Single Responsibility Principle — the class handles HTTP, routing, business logic, and database
- ❌ Hard to test — routes are private methods
- ❌ Hard to maintain — all logic in one file
- ❌ The empty [`src/routes/`](src/routes/) directory suggests an intended refactor that never happened

**Recommendation:** Split into:
- `src/routes/sites.ts`
- `src/routes/history.ts`
- `src/routes/settings.ts`
- `src/routes/check-block.ts`
- `src/middleware/auth.ts`
- `src/services/block-checker.ts`

---

### W-003: No Separation Between API and Business Logic (High)

**Issue:** All business logic is embedded directly in route handlers. There's no service layer.

**Example:** The URL block checking logic in [`src/server.ts`](src/server.ts:156-183) is a standalone function mixed with route definitions.

**Analysis:**
- ❌ Business logic cannot be unit tested independently
- ❌ Logic is duplicated between `src/server.ts` and `api/index.js`
- ❌ No dependency injection — `TestLinkServer` class creates its own dependencies
- ❌ Database adapter is passed via `this.db!` (non-null assertion) throughout

**Recommendation:**
```typescript
// Service layer
class BlockCheckService {
    constructor(private db: DatabaseAdapter) {}
    async checkUrl(url: string): Promise<CheckResult> { ... }
}

// Controller
class SiteController {
    constructor(private siteService: SiteService) {}
    async getSites(req: Request, res: Response) { ... }
}
```

---

### W-004: Missing Domain Models (Medium)

**Issue:** The code operates directly on database rows. There are no domain models or value objects.

**Analysis:**
- ❌ No validation logic in domain objects
- ❌ Business rules scattered across route handlers
- ❌ URL normalization (adding `https://` prefix) is duplicated in multiple places
- ❌ Diff computation logic lives in route handlers, not in a dedicated service

---

### W-005: Missing Configuration Validation on Startup (Medium)

**Issue:** The application starts up without validating critical configuration:
- No check that `ADMIN_PASSWORD` is set (allows default)
- No check that MySQL config is valid (catches issues at startup)
- No check for `NODE_ENV` consistency

**Recommendation:** Add a `validateConfig()` function that runs on startup and fails fast:

```typescript
function validateConfig(): void {
    if (!process.env.ADMIN_PASSWORD) {
        throw new Error('ADMIN_PASSWORD must be set in production');
    }
    if (process.env.NODE_ENV === 'production' && process.env.DB_TYPE !== 'mysql') {
        throw new Error('Production must use MySQL, not SQLite');
    }
}
```

---

### W-006: Poor Dependency Management (Medium)

**Issue:** 
- `package-lock.json` is gitignored — no reproducible builds
- Dependencies use carets (`^`) — builds may break with minor version changes
- TypeScript 6.0.3 and Vitest 4.1.7 are pre-release versions
- No `engines.node` field in `package.json`

**Analysis:**
- Without lockfile, `npm install` can produce different `node_modules` on different machines
- Pre-release versions may have breaking changes between minor versions
- No Node.js version specification means unknown compatibility

---

### W-007: Missing API Contract Documentation (Medium)

**Issue:** There is no OpenAPI/Swagger specification for the API. The API contract is implicit in the code and may differ between the two backend implementations.

**Analysis:**
- Frontend developers must read server code to understand the API
- Changes to API can break frontend without detection
- No API versioning strategy

---

## Scalability Analysis

### Current Architecture Limits

```
Single Node.js process
├── Single event loop
│   ├── Handles all HTTP requests
│   ├── Makes outbound HTTP requests (block check)
│   └── Executes database queries
├── MySQL connection pool (max 10-50)
└── Frontend is monolithic SPA (no SSR)
```

### Scaling Bottlenecks

| Constraint | Limit | Resolution |
|---|---|---|
| Event loop CPU | 1 core | Horizontal scaling (multiple instances) |
| MySQL connections | Pool size | Increase pool, add read replicas |
| Memory | Process memory | ~500MB per instance expected |
| Network bandwidth | Server capacity | Compress responses, cache |
| SQLite writes | 1 writer | Use MySQL in production |

### Scalability Score: **25/100**

**Issues:**
- ❌ No horizontal scaling support (no stateless design)
- ❌ Session is stored in memory + `sessionStorage`
- ❌ No cache layer (Redis/Memcached)
- ❌ Database queries not optimized for scale
- ❌ No message queue for async processing
- ❌ Vercel deployment uses ephemeral `/tmp` storage

---

## Technical Debt Summary

| Item | Type | Estimated Impact |
|---|---|---|
| Dual backend (JS + TS) | Architecture | High |
| Monolithic server.ts | Architecture | High |
| Empty routes/ directory | Dead code | Low |
| 500+ line server.ts file | Maintainability | Medium |
| Silent error handling | Reliability | High |
| No tests anywwhere | Quality | Critical |
| `any` types in many places | Type safety | Medium |
| No dependency lockfile | Reproducibility | High |
| Pre-release TypeScript/Vitest | Stability | Medium |
| Hardcoded pool stats (always 0) | Correctness | Medium |
| `catch (e) {}` patterns | Reliability | High |
