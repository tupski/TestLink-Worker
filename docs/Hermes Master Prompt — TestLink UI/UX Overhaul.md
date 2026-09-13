# TestLink — UI/UX & Admin Panel Overhaul

Repository:
https://github.com/tupski/TestLink-Worker

## Role

You are the lead engineer and UI/UX architect for this project.

Your job is to improve the existing TestLink application without changing its fundamental purpose or introducing unnecessary complexity.

Before modifying anything, inspect the existing repository, architecture, frontend behavior, API, database schema, PWA implementation, service worker, and current admin panel.

Do not assume the current implementation is wrong just because it looks old.

Preserve working behavior unless a change is explicitly required by this specification.

---

# 1. PRODUCT PURPOSE — NON-NEGOTIABLE

TestLink exists for one primary purpose:

> Open real URLs in a browser/PWA so that the URLs are actually visited and recorded in the browser's history.

The browser history is the ultimate purpose of the application.

This is NOT primarily:

* an ISP monitoring system
* an uptime monitoring system
* a ping monitoring system
* an analytics platform
* an ISP database
* a provider statistics platform
* a synthetic monitoring SaaS
* a URL crawler

Do NOT turn it into one.

The application must continue to actually open/navigate to the target URLs.

Do NOT replace real navigation with:

* fetch()
* HEAD requests
* server-side HTTP requests
* background HTTP checks
* simulated visits
* API-only validation

Those mechanisms may exist as auxiliary diagnostics, but they must never replace the real browser navigation that creates browser history entries.

---

# 2. CORE USER WORKFLOW

The primary workflow is:

1. User selects a queue/category.
2. Queue contains URLs.
3. User starts the runner.
4. TestLink opens the URLs in the browser/PWA.
5. Each URL becomes part of browser history.
6. Runner continues to the next URL according to the configured interval.
7. User can pause/resume/stop.
8. Manual mode allows the user to validate each URL manually.
9. Automatic mode minimizes the need for many Chrome tabs.

The PWA exists primarily to make this workflow practical and controlled without opening hundreds of Chrome tabs.

Preserve this behavior.

---

# 3. DO NOT OVERENGINEER ISP/NETWORK FEATURES

The current ISP/provider/network detection can remain.

However, simplify its role.

ISP/provider information is only diagnostic information.

Do NOT build:

* ISP databases
* provider history
* provider analytics
* provider dashboards
* ISP comparison charts
* ISP-specific statistics
* persistent ISP tracking

If existing code detects ISP/network information, keep it lightweight and non-blocking.

If detection fails:

> The runner must continue working normally.

Network diagnostics must never become a dependency of the runner.

---

# 4. FIRST STEP — AUDIT ONLY

Before making UI changes, inspect the entire repository.

At minimum inspect:

* index.html
* admin.html
* about.html
* manifest.webmanifest
* sw.js
* package.json
* API/server implementation
* database schema
* JavaScript files
* CSS files
* API endpoints
* authentication
* queue/category logic
* runner logic
* history logic
* PWA installation behavior
* service worker behavior
* current settings system
* current import/export behavior
* current local storage/state management

Understand how the current application works.

Do not rewrite anything during the audit.

Identify:

* what must remain unchanged
* what can be refactored
* what is UI-only
* what is tightly coupled to backend logic
* PWA risks
* navigation/history risks
* admin authentication risks
* reusable component opportunities
* duplicated UI logic
* accessibility problems
* responsive/mobile problems

Create:

`docs/UI_UX_AUDIT.md`

Include:

* Current architecture
* Current user flows
* Current admin flows
* Current PWA architecture
* Current runner behavior
* Current data model
* Current API surface
* Current UI problems
* Current UX problems
* Security concerns
* Recommended architecture
* What NOT to change

Do not start implementation until the audit is complete.

---

# 5. CHOOSE A FREE COMPONENT LIBRARY

The current UI should not be rebuilt component-by-component from scratch.

Research the existing project and select ONE primary free/open-source UI component system compatible with the existing stack.

Candidates may include:

* Preline UI
* Flowbite
* daisyUI
* Shoelace
* another mature free/open-source component system

Do not blindly choose one.

Evaluate:

* Vanilla JavaScript compatibility
* Tailwind compatibility
* accessibility
* dialogs/modals
* dropdowns
* tabs
* buttons
* inputs
* selects
* tables
* badges
* alerts
* toast/notifications
* pagination
* mobile behavior
* dark mode
* documentation
* bundle size
* CDN/npm suitability
* license
* long-term maintainability

Prefer the smallest practical solution.

Do NOT introduce React, Vue, Svelte, Next.js, or another frontend framework merely to obtain components.

The existing application can remain Vanilla JS if that is the most appropriate architecture.

Document the decision in:

`docs/UI_LIBRARY_DECISION.md`

Include:

* chosen library
* alternatives considered
* why it was selected
* integration strategy
* components we will use
* components we will NOT use

---

# 6. DESIGN DIRECTION

Completely refresh the visual language.

The current interface relies too heavily on:

* glassmorphism
* huge rounded corners
* excessive gradients/glows
* tiny typography
* uppercase text everywhere
* italic typography
* excessive visual effects
* too many competing cards

Move toward a clean modern utility application.

Design references may include the visual clarity of:

* Linear
* Vercel
* Raycast
* modern developer tools

Do not copy them.

Use the principles:

* clear hierarchy
* strong spacing
* readable typography
* subtle borders
* restrained radius
* minimal shadows
* clear status colors
* strong focus states
* obvious primary actions
* consistent controls
* excellent mobile usability

Recommended baseline:

Body:
14–16px

Secondary:
12–14px

Page headings:
20–28px

Card radius:
8–16px

Avoid excessive rounded/pill UI.

Avoid uppercase labels unless they genuinely improve scanning.

---

# 7. CREATE A SMALL DESIGN SYSTEM

Create reusable styles/components for:

* Button
* Icon Button
* Input
* Select
* Checkbox
* Toggle
* Badge
* Card
* Modal/Dialog
* Dropdown
* Tabs
* Toast
* Alert
* Table
* Pagination
* Empty State
* Loading State
* Error State
* Progress Bar
* Breadcrumb
* Page Header
* Sidebar
* Mobile Bottom Navigation

Do not duplicate component markup unnecessarily.

If the chosen component library already provides a component, use it instead of rebuilding it.

Create:

`docs/DESIGN_SYSTEM.md`

Define:

* typography
* spacing
* colors
* borders
* radius
* shadows
* status states
* component usage rules
* desktop/mobile behavior

---

# 8. INFORMATION ARCHITECTURE

Reorganize the application around four primary areas:

## User Application

### Runner

The main application screen.

### Queues

Manage URL groups.

### History

View TestLink's internal history.

### Settings

Application/user settings.

---

## Admin

Admin should become a proper management interface.

Recommended structure:

```text
Admin
├── Overview
├── Links
├── Queues
├── History
├── Settings
│   ├── General
│   ├── Runner
│   ├── Network
│   ├── PWA
│   ├── Notifications
│   └── Maintenance
└── System
    ├── About
    └── Database
```

Do not expose unnecessary technical complexity to normal users.

---

# 9. RUNNER UI REDESIGN

Runner is the most important screen.

Make its current state immediately obvious.

## Idle

Show:

* selected queue
* number of URLs
* runner configuration
* Start button

Example:

```text
Ready to test

124 URLs in this queue

[ Start Runner ]
```

## Running

Show:

* current URL
* progress
* completed count
* total count
* next URL
* countdown
* mode
* interval
* Pause
* Stop

Example:

```text
RUNNING

42 / 124

████████████████░░░░

Current URL
https://example.com/page

Next
https://example.com/next

Opening next URL in
08 seconds

[ Pause ] [ Stop ]
```

## Paused

Clearly show:

```text
PAUSED

42 / 124

[ Resume ] [ Stop ]
```

## Completed

Clearly show:

```text
COMPLETED

124 / 124 URLs opened

[ Run Again ]
[ Back to Queue ]
```

Do not clutter the runner with analytics.

The runner should answer:

> What is happening right now?

---

# 10. MANUAL MODE

Preserve manual validation.

Manual mode must remain simple.

Provide clear actions such as:

* Open
* Normal
* Blocked
* Error
* Skip
* Next

Use accessible visual states.

Do not hide important actions inside obscure menus.

---

# 11. AUTOMATIC MODE

Automatic mode is the primary reason the PWA exists.

Do not break it.

The runner must continue navigating/opening real URLs.

The UI should make the automation state obvious:

```text
Automatic
ON

Interval
10 seconds
```

Allow:

* start
* pause
* resume
* stop
* interval adjustment where currently supported

Do not introduce background processing that bypasses browser navigation.

---

# 12. QUEUE MANAGEMENT

Rename "Category" to "Queue" if doing so does not break existing database/API compatibility.

If backend compatibility is important, use Queue in the UI while preserving existing internal naming.

Queue screen should show:

* name
* URL count
* current status
* last activity
* runner configuration
* actions

Example:

```text
Test Queues

Jakarta
124 links
Last run: 10 minutes ago

[ Open Runner ] [ ⋮ ]

General
87 links
Last run: Yesterday

[ Open Runner ] [ ⋮ ]
```

Queue settings should include only settings that already exist or are genuinely required.

Do not invent unnecessary configuration.

---

# 13. LINK MANAGER

Replace the current primitive URL management UI with a proper Link Manager.

Features:

* search
* pagination
* queue filter
* selection
* bulk actions
* add links
* TXT import
* TXT export if supported
* duplicate detection
* URL normalization where safe
* delete
* move to another queue
* copy URL
* open URL

Opening a URL from the Link Manager must still perform actual browser navigation.

Provide good empty/loading/error states.

---

# 14. HISTORY

Keep the existing internal history functionality.

Improve its UI.

Provide:

* search
* filters where supported
* pagination
* timestamp
* URL
* queue
* result/status
* clear history action where currently supported

Do not confuse internal TestLink history with browser history.

Make the distinction clear in the UI.

For example:

> TestLink History

and explanatory text:

> Your browser history contains the actual visited URLs.

Do not claim TestLink can directly manage browser history unless the browser API genuinely supports it.

---

# 15. ADMIN PANEL REDESIGN

Replace the current basic admin interface with a proper responsive admin application.

Desktop:

```text
┌──────────────────────────────────────────────┐
│ TestLink Admin                               │
├───────────────┬──────────────────────────────┤
│ Overview      │                              │
│ Links         │        Page Content          │
│ Queues        │                              │
│ History       │                              │
│               │                              │
│ Settings      │                              │
│ System        │                              │
└───────────────┴──────────────────────────────┘
```

Mobile:

Use a compact header and mobile navigation/drawer.

Admin pages should share the same design system as the main app.

---

# 16. ADMIN OVERVIEW

Keep it simple.

Useful summary:

```text
Overview

Total Links
1,284

Queues
8

History
24,892

Active Queue
Jakarta

124 links
82 completed

████████████████░░░░
```

Recent activity can be shown below.

Do NOT turn this into a giant analytics dashboard.

---

# 17. ADMIN SETTINGS

Preserve all existing settings.

Do not silently remove configuration.

Organize settings into sections:

## General

* App title
* Tagline
* Branding/content settings

## Runner

* Default interval
* runner defaults
* existing runner behavior settings

## Network

* existing network/DNS configuration

## PWA

* PWA-related configuration
* install behavior
* icons/metadata where applicable

## Notifications

* existing notification settings

## Maintenance

* maintenance mode

## Security

* admin authentication settings
* Safe Browsing API configuration

## About

* about title
* about content

Only expose settings that actually exist or are required.

---

# 18. PWA REQUIREMENTS

PWA functionality is NON-NEGOTIABLE.

Preserve and improve:

* manifest
* service worker
* installability
* icons
* standalone mode
* mobile viewport
* offline shell where appropriate
* update handling
* app launch behavior

Test:

1. browser mode
2. installed desktop PWA
3. installed mobile PWA
4. refresh during normal use
5. service worker update
6. runner behavior after PWA installation

Most importantly:

> Verify that automatic runner navigation still performs real browser/PWA navigation and does not silently become fetch-based.

Do not optimize away the navigation behavior.

---

# 19. RESPONSIVE DESIGN

Desktop and mobile are both first-class.

Desktop:

* sidebar
* wide runner workspace
* tables
* keyboard-friendly controls

Mobile:

* compact header
* bottom navigation where appropriate
* stacked controls
* touch-friendly buttons
* horizontally scrollable tables only when necessary
* no tiny text
* no desktop UI squeezed into mobile

Test at approximately:

* 320px
* 375px
* 390px
* 768px
* 1024px
* 1440px

---

# 20. ACCESSIBILITY

Improve:

* keyboard navigation
* focus indicators
* button labels
* aria labels
* modal focus management
* color contrast
* form labels
* status announcements where appropriate
* reduced-motion support

Do not rely on color alone to communicate status.

---

# 21. UX STATES

Every important screen must handle:

* loading
* empty
* success
* error
* disabled
* offline/network failure

Do not leave blank white/dark screens.

Examples:

```text
No queues yet

Create your first queue to start testing URLs.

[ Create Queue ]
```

and:

```text
Unable to load links

Check your connection and try again.

[ Retry ]
```

---

# 22. FRONTEND ARCHITECTURE

Do not create one enormous JavaScript file.

Organize reusable UI and application logic sensibly.

Possible structure:

```text
js/
├── app/
│   ├── router.js
│   ├── state.js
│   └── api.js
│
├── runner/
│   ├── runner.js
│   ├── runner-state.js
│   └── navigation.js
│
├── components/
│   ├── button.js
│   ├── modal.js
│   ├── toast.js
│   ├── table.js
│   └── ...
│
├── pages/
│   ├── runner.js
│   ├── queues.js
│   ├── links.js
│   ├── history.js
│   └── settings.js
│
└── admin/
    ├── overview.js
    ├── links.js
    ├── queues.js
    ├── history.js
    └── settings.js
```

Adapt this to the actual repository.

Do not force this exact structure if the existing architecture suggests something better.

---

# 23. BACKEND RULE

Do NOT rewrite the backend simply because the frontend is being redesigned.

Existing API contracts should be preserved whenever practical.

Only modify backend code when required for:

* UI requirements
* correctness
* missing CRUD functionality
* security
* proper persistence
* compatibility

Avoid unnecessary database migrations.

Avoid unnecessary framework migrations.

---

# 24. ADMIN AUTHENTICATION SECURITY

Audit the current admin authentication carefully.

If the application currently relies on a static password header or a hardcoded fallback credential, remove insecure production defaults.

Do not leave a known default password in production code.

Prefer a proper session-based authentication approach appropriate to the existing architecture.

Do not break local development unnecessarily.

Document authentication changes.

---

# 25. PERFORMANCE

The application must remain lightweight.

Avoid:

* giant frontend frameworks
* unnecessary dependencies
* huge UI libraries
* unnecessary animation
* excessive JavaScript
* unnecessary API requests

Prefer:

* existing dependencies
* tree-shakeable packages where applicable
* lazy initialization
* event delegation
* efficient DOM updates
* CSS over JavaScript for simple effects

The app should feel instant.

---

# 26. IMPLEMENTATION PHASES

Do NOT attempt everything in one uncontrolled edit.

Implement in phases.

## Phase 0 — Audit

Create:

```text
docs/UI_UX_AUDIT.md
docs/UI_LIBRARY_DECISION.md
docs/DESIGN_SYSTEM.md
```

No major UI changes yet.

---

## Phase 1 — Foundation

Implement:

* selected component library
* design tokens
* typography
* spacing
* colors
* reusable components
* responsive primitives

Verify the application still works.

---

## Phase 2 — App Shell

Implement:

* desktop sidebar
* mobile header/navigation
* page layout
* global toast/dialog system
* responsive structure

Do not change runner behavior yet.

---

## Phase 3 — Runner Redesign

Redesign the primary runner UI.

Preserve:

* manual mode
* automatic mode
* interval
* pause
* resume
* stop
* actual URL navigation
* progress
* existing validation behavior

This is the highest-priority user-facing phase.

---

## Phase 4 — Queue & Link Management

Implement:

* Queue UI
* Link Manager
* import TXT
* bulk actions
* search
* pagination
* empty/error states

Preserve existing backend behavior where possible.

---

## Phase 5 — History

Redesign internal TestLink history.

Keep it clearly separate from browser history.

---

## Phase 6 — Admin Panel

Completely redesign admin.html.

Implement:

* Overview
* Links
* Queues
* History
* Settings
* System

Use the same component system.

---

## Phase 7 — Settings

Reorganize existing settings.

Do not remove existing functionality.

Make settings easier to understand.

---

## Phase 8 — PWA Polish

Audit and improve:

* manifest
* icons
* service worker
* install experience
* standalone layout
* mobile layout
* update handling

Verify real browser navigation still works.

---

## Phase 9 — Security & Cleanup

Audit:

* admin auth
* hardcoded credentials
* exposed secrets
* API validation
* CORS
* error handling
* input validation

Remove dead code.

Remove duplicated CSS/JS.

Remove obsolete UI.

---

## Phase 10 — QA

Test:

### Runner

* manual mode
* automatic mode
* pause
* resume
* stop
* countdown
* queue progression
* invalid URL
* blocked URL
* failed navigation
* browser history behavior

### Queue

* create
* edit
* delete
* import
* URL count

### History

* recording
* pagination
* filtering
* clearing

### Admin

* authentication
* CRUD
* settings
* mobile layout

### PWA

* install
* launch
* refresh
* service worker
* update
* mobile
* desktop

---

# 27. DOCUMENTATION

Maintain:

```text
README.md
docs/UI_UX_AUDIT.md
docs/UI_LIBRARY_DECISION.md
docs/DESIGN_SYSTEM.md
docs/PLAN.md
CHANGELOG.md
```

Create `docs/PLAN.md` before implementation.

Track completed phases.

---

# 28. GIT WORKFLOW

Before implementation:

```bash
git status
git branch
git log --oneline -10
```

Create a dedicated branch:

```text
redesign-v2
```

Commit logically.

Suggested commits:

```text
docs: add UI UX audit
docs: define UI library and design system
feat: add UI foundation
feat: redesign application shell
feat: redesign runner
feat: redesign queue and link manager
feat: redesign history
feat: redesign admin panel
feat: reorganize settings
feat: polish PWA experience
fix: harden admin authentication
chore: cleanup frontend architecture
```

Do not create meaningless micro-commits.

---

# 29. IMPORTANT GUARDRAILS

DO NOT:

* migrate to React without strong justification
* rewrite the backend unnecessarily
* replace browser navigation with fetch
* remove PWA functionality
* remove browser-history behavior
* build ISP analytics
* build provider databases
* add unnecessary monitoring features
* add unnecessary charts
* add unnecessary authentication complexity
* introduce paid dependencies
* use a paid UI library
* build every UI component manually when an appropriate free component exists
* redesign functionality merely for visual reasons
* delete existing settings
* silently change runner semantics

DO:

* inspect first
* reuse existing functionality
* improve UX
* use a free component system
* keep the application lightweight
* make mobile excellent
* make the runner extremely clear
* make admin feel like a real application
* preserve browser navigation/history behavior
* preserve PWA behavior
* test after every major phase

---

# 30. DEFINITION OF DONE

The project is complete when:

1. The application looks substantially more modern and professional.
2. The runner is easier to understand and operate.
3. Automatic mode still opens real URLs.
4. URLs still enter browser history.
5. PWA installation still works.
6. Mobile UX is genuinely usable.
7. Admin panel is substantially improved.
8. Links are easier to manage.
9. Queues are easier to manage.
10. Existing settings remain available.
11. ISP/network detection remains lightweight.
12. No unnecessary monitoring/analytics system has been introduced.
13. UI uses a free reusable component system.
14. No major framework migration was performed without justification.
15. Existing functionality remains intact.
16. Authentication does not rely on an insecure hardcoded production credential.
17. No obvious loading/empty/error state is missing.
18. README and project documentation reflect the new architecture.

---

# FINAL INSTRUCTION

Work like a senior engineer, not an autonomous code generator.

Inspect before editing.

Understand before refactoring.

Prefer the smallest change that achieves the desired UX.

If an existing implementation already satisfies a requirement, keep it.

If a proposed change could affect browser navigation, browser history, PWA behavior, or runner timing, stop and inspect the implementation carefully before modifying it.

Do not invent requirements.

Do not expand the product scope.

The goal is NOT to make TestLink a bigger system.

The goal is to make the existing TestLink product:

> simpler, cleaner, faster, easier to operate, and much better designed.

Start with Phase 0 only.

After completing the audit and documentation, report:

* architecture findings
* UI/UX findings
* selected component library
* migration risks
* exact implementation plan
* files expected to change

Do not begin Phase 1 until the audit is complete.
