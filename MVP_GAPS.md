# Pilates OS — MVP Gap Analysis & Pre-Deploy Plan

**Generated:** 2026-05-05
**Scope:** Everything needed to ship MVP to Coolify (single-VPS Pilates studio test deployment).

> Audit covered four dimensions: security, core flows, performance, deployment readiness. Findings are grouped by **must-fix-before-deploy** → **important** → **defer-to-phase-2**.

---

## 🔴 Block deploy — must fix

### MVP-1. `CancelBookingButton` uses hardcoded `mock-user-id` and fake fetch
**File:** [src/modules/users/components/CancelBookingButton.tsx](src/modules/users/components/CancelBookingButton.tsx) (lines 52–84)

The button calls `fetch('/api/bookings/cancel')` with `userId: 'mock-user-id'`. The real cancellation logic lives in [cancellation.service.ts](src/modules/booking/services/cancellation.service.ts) and is exposed via `cancelBookingAction` (server action) but is not wired up to the button.

**Fix:** Replace the fetch call with a direct invocation of the server action. Drop the `userId` field — it comes from `auth()` inside the action. Use `useTransition()` for pending state.

**Estimated effort:** 30 min.

---

### MVP-2. CSP nonce is not interpolated — security header is broken
**File:** [src/lib/security/security-headers.ts](src/lib/security/security-headers.ts) (lines 8–20)

The CSP string is built with `${nonce}` placeholders inside a non-template string, so the literal string `${nonce}` is sent in the header. CSP nonce protection is silently disabled.

**Fix:** Change the array to a proper template literal, or build the string with `String.raw` then replace `__NONCE__` placeholders post-hoc. Verify with `curl -I https://yourstudio.com | grep Content-Security-Policy` after deploy.

**Estimated effort:** 15 min.

---

### MVP-3. Login + register have no rate limiting
**Files:**
- [src/modules/users/actions/login.action.ts](src/modules/users/actions/login.action.ts)
- [src/modules/users/actions/register.action.ts](src/modules/users/actions/register.action.ts)

Auth endpoints accept unlimited attempts. The rate limiter exists in [src/lib/security/rate-limiter.ts](src/lib/security/rate-limiter.ts) and [redis-rate-limiter.ts](src/lib/security/redis-rate-limiter.ts) but is wired only on `/api/credit-purchases` and `/api/bookings/cancel`.

**Fix:** Wrap both server actions with the auth-tier rate limiter (5 attempts / 15 min by IP). Use the IP from `headers()` (Next.js 16 — must `await`). Return `RATE_LIMITED` error code on hit.

**Estimated effort:** 1 hour.

---

### MVP-4. Pay-at-studio admin flow does not auto-credit
**File:** [src/modules/billing/actions/creditPurchase.actions.ts](src/modules/billing/actions/creditPurchase.actions.ts) (around line 109)

When admin marks a `pending` purchase as `paid`, the row is updated but `creditService.addCredits()` is **not called**. Credits never land in the student's balance — the studio has to manually add them, which defeats the whole pay-at-studio flow.

**Fix:** Inside `updateCreditPurchaseAction`, when transitioning `pending → paid`, call `creditService.addCredits()` inside the same transaction. Pass the purchase id as the idempotency key (instead of `stripeCheckoutSessionId`). Revert if balance update fails.

**Estimated effort:** 1.5 hours (must be transactional + idempotent + tested).

---

### MVP-5. Waiver gate is not enforced before first booking
**Files:**
- [src/db/schema/users.schema.ts](src/db/schema/users.schema.ts) — `hasSignedWaiver` column exists ✓
- `src/modules/users/services/waiver.service.ts` — **does not exist**
- [createBooking.action.ts](src/modules/booking/actions/createBooking.action.ts) — does not check waiver

A liability gap. Either:
- **Option A (minimum):** In `createBookingAction`, return `WAIVER_REQUIRED` if `!user.hasSignedWaiver`. Gate the booking modal client-side with a redirect to `/waiver`.
- **Option B (proper):** Build `signWaiverAction` + `WaiverModal` + store IP/timestamp/version in a `waivers` table.

For MVP, **Option A is sufficient** — block booking, show "Sign your waiver" CTA on dashboard, link to a static `/waiver` page that calls a one-line server action to set the flag.

**Estimated effort:** 2 hours (Option A).

---

### MVP-6. No `/api/health` endpoint — Coolify can't probe
**File:** does not exist.

Coolify's container healthcheck and the Dockerfile both need a 200-response endpoint.

**Fix:** Create `src/app/api/health/route.ts` returning `{ status: 'ok', ts: new Date().toISOString() }`. Optionally do a `SELECT 1` ping to the DB to detect connection-pool exhaustion.

**Estimated effort:** 10 min.

---

### MVP-7. No Dockerfile — Coolify cannot build the image
**File:** does not exist.

Coolify can build with Nixpacks (auto-detect), but for predictability and smaller images we want a hand-written multi-stage Dockerfile that uses Next.js standalone output.

**Fix:** See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Dockerfile + `next.config.ts` patch (`output: 'standalone'`).

**Estimated effort:** 30 min.

---

### MVP-8. `next.config.ts` is empty — build is unoptimised, external images fail
**File:** [next.config.ts](next.config.ts)

Missing `output: 'standalone'` (smaller Docker image, no copy of `node_modules`), missing `images.remotePatterns` (instructor avatars from Unsplash will throw at runtime).

**Fix:** See deployment plan for the exact config block.

**Estimated effort:** 5 min.

---

## ⚠️ Important — fix before real customers, can ship a closed beta without

### MVP-9. Audit log is console-only, never hits the database
**File:** [src/lib/security/audit-system.ts](src/lib/security/audit-system.ts)

`logFinancialEvent` is a no-op stub. For a Pilates studio handling cash + Stripe, you need a paper trail.

**Fix:** Add an `audit_logs` table to the schema (id, userId, action, resource, resourceId, details JSONB, severity, category, success, createdAt). Wire `auditLogger.log()` to insert. Index on `(userId, createdAt)`.

**Estimated effort:** 2 hours including migration.

---

### MVP-10. API routes accept JSON without Zod validation
**Files:**
- [src/app/api/credit-purchases/route.ts](src/app/api/credit-purchases/route.ts) (lines 27–34)
- [src/app/api/bookings/cancel/route.ts](src/app/api/bookings/cancel/route.ts) (lines 26–28)

`request.json()` is destructured directly. Server actions are protected by Zod, but these REST endpoints aren't.

**Fix:** Wrap each `request.json()` in a Zod `safeParse` and return 400 on failure.

**Estimated effort:** 30 min.

---

### MVP-11. Avatar `<img>` tags + missing `remotePatterns`
**Files:**
- [src/modules/booking/components/ClassSessionCard.tsx](src/modules/booking/components/ClassSessionCard.tsx) (line 98)
- [src/modules/users/components/UpcomingBookingsList.tsx](src/modules/users/components/UpcomingBookingsList.tsx) (line 74)
- Seed data uses `images.unsplash.com` URLs

Without `remotePatterns`, Next.js `<Image>` would 500 on these URLs. Today they're `<img>` so it works, but performance suffers (no LCP optimization, layout shift, no lazy loading).

**Fix:** Add `images.unsplash.com` and your future avatar host (S3/Bunny) to `next.config.ts` `remotePatterns`. Switch to `<Image fill>` with `object-cover`. Keep dimensions on the wrapper.

**Estimated effort:** 30 min.

---

### MVP-12. No structured logger — only `console.log`
**Files:** scattered (search for `console.log`)

Coolify aggregates stdout, but unstructured logs make filtering by user, request id, or severity impossible.

**Fix:** Install `pino` + `pino-pretty` (dev). Create `src/lib/logger.ts` exporting a singleton. Replace `console.log/error` in production code paths with `logger.info/error`. Defer for tests + scripts.

**Estimated effort:** 2 hours (codebase-wide replace).

---

### MVP-13. Sentry not installed — production errors are invisible
**Files:** none (placeholder envs only)

`SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are documented but no `@sentry/nextjs`, no `instrumentation.ts`.

**Fix:** `pnpm add @sentry/nextjs`, run `npx @sentry/wizard@latest -i nextjs --saas` (creates configs). Add `SENTRY_DSN` to Coolify env. Errors appear immediately in Sentry on first deploy.

**Estimated effort:** 30 min (the wizard does most of the work).

---

### MVP-14. Email integration missing
**Files:** none. `src/lib/email/` does not exist.

Booking-confirmed, booking-cancelled, instructor-cancelled-class — none are sent. Resend env vars (`RESEND_API_KEY`, `EMAIL_FROM`) are documented but unused.

**Fix for MVP:** Stub it. Create `src/lib/email/send.ts` that no-ops if `RESEND_API_KEY` is missing, otherwise sends a plain-text email. Wire 3 critical events: booking confirmed, booking cancelled by user, class cancelled by instructor (this last one is legally important — students need to know their class is gone).

For a closed beta, **you can launch without email** by relying on the `My Classes` page. For real customers, this becomes a 🔴.

**Estimated effort:** 4 hours including templates.

---

## 🟢 Defer to Phase 2 — not needed for MVP launch

| Item | Reason it can wait |
|---|---|
| Stripe checkout + webhook | Pay-at-studio covers the MVP. Stripe is marked "Coming Soon" in the UI already ([credits/page.tsx:402](src/app/(dashboard)/credits/page.tsx)). Do this once you have ≥10 paying students. |
| BullMQ + Redis worker | Make waitlist promotion synchronous in `cancelBooking` for MVP. Add async worker only when you regularly hit class capacity. |
| Admin students view | Admin can still see purchases + bookings. Per-student profile page is a nice-to-have. |
| VOD module (S3/Bunny) | Phase 3 per CLAUDE.md. Don't pay for storage you're not using. |
| Streaks + badges (gamification) | Phase 3. |
| Meta CAPI + sitemap.ts | Phase 3 SEO/marketing. |
| Robots.txt | Add a 5-line static `public/robots.txt` blocking `/admin` and `/api` — takes 2 minutes, do it before deploy. |

---

## Recommended MVP fix order (≈ 1 working day)

1. MVP-6 `/api/health` (10 min) — unblocks Coolify
2. MVP-8 `next.config.ts` (5 min) — unblocks Docker build
3. MVP-7 Dockerfile (30 min) — unblocks Coolify
4. MVP-1 CancelBookingButton (30 min) — visible bug
5. MVP-2 CSP nonce (15 min) — silent security regression
6. MVP-3 auth rate-limit (1 h) — brute-force protection
7. MVP-4 pay-at-studio auto-credit (1.5 h) — broken core flow
8. MVP-5 waiver gate, Option A (2 h) — liability
9. MVP-13 Sentry wizard (30 min) — observability before going live
10. MVP-11 avatar remotePatterns (30 min) — UX polish
11. MVP-10 API route Zod (30 min) — defence in depth
12. Smoke test on a staging branch deploy
13. Production deploy

After launch: MVP-9 audit log persistence, MVP-12 pino, MVP-14 email — cycle these in over the first 2 weeks of beta.

---

## What is already solid — don't touch

- ✓ Database schema, indexes, FK policies (RESTRICT on financial tables)
- ✓ Drizzle migrations are committed (5 migration files)
- ✓ Cancellation service: 24h rule, first-time mercy, atomic refund — fully working
- ✓ Booking service: `FOR UPDATE` lock, duplicate prevention, atomic credit debit
- ✓ Connection pool (`max: 10`) is correctly sized for MVP
- ✓ Auth.js v5 setup is secure (bcrypt, JWT, role guards in middleware)
- ✓ Soft-delete enforcement on users
- ✓ Server vs client component split is correct
- ✓ Bundle size — modular imports, no lodash, tree-shakeable lucide-react
- ✓ No N+1 queries detected — eager loading is explicit
