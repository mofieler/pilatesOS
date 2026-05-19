#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# pilatesOS — Production Smoke Test
# Run this after every deploy to verify critical paths.
#
# Usage:
#   CRON_SECRET=xxx AUTH_SECRET=xxx ./scripts/smoke-test.sh
#
# Exits with code 0 if everything is green, 1 otherwise.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="${BASE_URL:-https://paquita.pilateq.de}"
CRON_SECRET="${CRON_SECRET:-}"
AUTH_SECRET="${AUTH_SECRET:-}"

PASS=0
FAIL=0

function ok()  { echo "  ✅ $1"; ((PASS++)); }
function err() { echo "  ❌ $1"; ((FAIL++)); }

function http_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

function http_body() {
  curl -s "$@"
}

# ─── 1. Health Check ──────────────────────────────────────────────────────────
echo "▶ 1. Health Check"
STATUS=$(http_status "${BASE_URL}/api/health")
if [ "$STATUS" = "200" ]; then ok "Health endpoint returns 200"
else err "Health endpoint returned $STATUS"; fi

# ─── 2. Public pages ──────────────────────────────────────────────────────────
echo "▶ 2. Public Pages"
for path in / /login /book /datenschutz /impressum; do
  STATUS=$(http_status "${BASE_URL}${path}")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ]; then ok "${path} → ${STATUS}"
  else err "${path} → ${STATUS}"; fi
done

# ─── 3. Cron auth guards ──────────────────────────────────────────────────────
echo "▶ 3. Cron Auth Guards (no secret = 401)"
for path in /api/cron/expiry-sweep /api/cron/membership-credit-grant /api/cron/calendar-sync; do
  STATUS=$(http_status -X POST "${BASE_URL}${path}")
  if [ "$STATUS" = "401" ]; then ok "${path} → 401 Unauthorized"
  else err "${path} → ${STATUS} (expected 401)"; fi
done

# ─── 4. Cron auth with valid secret ───────────────────────────────────────────
if [ -n "$CRON_SECRET" ]; then
  echo "▶ 4. Cron Jobs with CRON_SECRET"

  # Expiry sweep (idempotent — running twice is safe)
  BODY=$(http_body -X POST "${BASE_URL}/api/cron/expiry-sweep" \
    -H "Authorization: Bearer ${CRON_SECRET}")
  if echo "$BODY" | grep -q '"success":true'; then ok "expiry-sweep → success"
  else err "expiry-sweep → $BODY"; fi

  # Membership grant
  BODY=$(http_body -X POST "${BASE_URL}/api/cron/membership-credit-grant" \
    -H "Authorization: Bearer ${CRON_SECRET}")
  if echo "$BODY" | grep -q '"ok":true'; then ok "membership-credit-grant → ok"
  else err "membership-credit-grant → $BODY"; fi

  # Calendar sync
  BODY=$(http_body -X POST "${BASE_URL}/api/cron/calendar-sync" \
    -H "Authorization: Bearer ${CRON_SECRET}")
  if echo "$BODY" | grep -q '"ok":true'; then ok "calendar-sync → ok"
  else err "calendar-sync → $BODY"; fi
else
  echo "▶ 4. Cron Jobs — SKIPPED (set CRON_SECRET to test)"
fi

# ─── 5. API auth guards ───────────────────────────────────────────────────────
echo "▶ 5. API Auth Guards (no session = 401/403)"
for path in /api/admin/purchases /api/credit-packages; do
  STATUS=$(http_status "${BASE_URL}${path}")
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "307" ]; then
    ok "${path} → ${STATUS} (protected)"
  else
    err "${path} → ${STATUS} (expected 401/403)"
  fi
done

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
printf  "║  PASS: %-3d  FAIL: %-3d                                                      ║\n" "$PASS" "$FAIL"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
