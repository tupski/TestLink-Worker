# Security Secret Rotation — Sprint 1

**Date:** 2026-07-10  
**Severity:** 🔴 CRITICAL — Immediate rotation required  

---

## Summary

The following credentials were discovered in source code or committed files and **must be rotated immediately**. Even if passwords have been changed since, the old values may still be cached in browser sessions, CI logs, or git history.

---

## Credentials Requiring Rotation

### 1. MySQL Database Password

| Field | Value |
|---|---|
| **Password** | `Bebas208833` |
| **Found in** | [`.env`](.env:16) (committed to repository) |
| **Username** | `testlink_user` |
| **Database** | `testlink_db` |
| **Host** | `127.0.0.1` (local) |

**Risk:** Anyone with repository access can connect to the MySQL database.

**Action:**
1. Change the MySQL password for `testlink_user@127.0.0.1`
2. Update the new password in deployment environment variables (NOT in `.env`)
3. If this password was used on any cloud database, rotate immediately

---

### 2. Admin Panel Password

| Field | Value |
|---|---|
| **Password** | `admin123` |
| **Found in** | [`.env`](.env:33) |
| **Also found as** | Documentation files, CARA_JALANKAN.md |
| **Also found as** | Setup scripts (`setup.bat` references it) |

**Risk:** Admin panel access is public with this default password.

**Action:**
1. Set a new strong admin password (min 16 chars, mixed case + numbers + symbols)
2. Update `ADMIN_PASSWORD` in production environment
3. DO NOT commit the new password to any file

---

### 3. Hardcoded Fallback Password (Source Code)

| Field | Value |
|---|---|
| **Password** | `rahasia123` |
| **Found in** | [`src/server.ts`](src/server.ts:25) (removed in Sprint 1) |
| **Also in** | [`api/index.js`](api/index.js:279) (removed in Sprint 1) |

**Risk:** If `ADMIN_PASSWORD` env var was not set, this fallback was used silently.

**Action:**
1. This is now fixed — the application **fails at startup** if `ADMIN_PASSWORD` is missing
2. Ensure the env var is set in all environments

---

### 4. Google Safe Browsing API Key (if configured)

| Field | Value |
|---|---|
| **Location** | Not found in code, but stored in `kv_settings` table |
| **Risk** | GSB API key stored in DB without encryption |

**Action:**
1. If you have a GSB API key configured in settings, consider rotating it
2. Future: Store in environment variable, not database

---

## Git History Cleanup

The `.env` file is now properly gitignored. However, if it was committed in the past:

```bash
# WARNING: This rewrites git history
# Use BFG Repo-Cleaner or git filter-branch

# Example with BFG:
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

## Verification Checklist

- [ ] MySQL password rotated
- [ ] Admin password rotated
- [ ] GSB API key rotated (if applicable)
- [ ] New passwords set in production environment variables
- [ ] `.env` removed from git history (if previously committed)
- [ ] Documentation updated to reference env vars only, never real passwords
- [ ] All team members informed to update their local `.env` files

---

## Post-Rotation Actions

1. **Monitor for unauthorized access** — Check database access logs, admin panel access logs
2. **Rotate again if any suspicion** — If you suspect credentials were compromised, rotate again
3. **Enforce password policy** — New passwords should be:
   - Minimum 20 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - NOT used anywhere else
   - Stored in a password manager
