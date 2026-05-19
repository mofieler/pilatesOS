-- ═══════════════════════════════════════════════════════════════════════════════
-- pilatesOS — Full Database Health Check
-- Run this on your VPS:  psql $DATABASE_URL -f scripts/db-health-check.sql
-- ═══════════════════════════════════════════════════════════════════════════════

\echo '╔══════════════════════════════════════════════════════════════════════════════╗'
\echo '║                    pilatesOS DB Health Check Report                          ║'
\echo '╚══════════════════════════════════════════════════════════════════════════════╝'

-- ─── 1. ENUM VALUES ───────────────────────────────────────────────────────────
\echo '\n▶ 1. ENUM VALUES'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT 'credit_type' AS enum_name, unnest(enum_range(NULL::credit_type)) AS value
UNION ALL
SELECT 'credit_transaction_type', unnest(enum_range(NULL::credit_transaction_type))
UNION ALL
SELECT 'payment_method', unnest(enum_range(NULL::payment_method))
UNION ALL
SELECT 'payment_status', unnest(enum_range(NULL::payment_status))
UNION ALL
SELECT 'credit_pack_category', unnest(enum_range(NULL::credit_pack_category));

-- ─── 2. REQUIRED COLUMNS EXIST ────────────────────────────────────────────────
\echo '\n▶ 2. REQUIRED COLUMNS (new migrations)'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
  VALUES
    ('users', 'welcome_completed_at'),
    ('class_templates', 'is_welcome_journey'),
    ('credit_purchases', 'stripe_session_id'),
    ('class_sessions', 'google_calendar_event_id'),
    ('class_sessions', 'google_calendar_id'),
    ('class_sessions', 'google_calendar_sync_error'),
    ('class_sessions', 'google_calendar_synced_at')
) AS t(table_name, column_name)
LEFT JOIN information_schema.columns c
  ON c.table_name = t.table_name
  AND c.column_name = t.column_name
WHERE c.table_schema = 'public'
ORDER BY t.table_name, t.column_name;

-- ─── 3. REQUIRED UNIQUE INDEXES ───────────────────────────────────────────────
\echo '\n▶ 3. REQUIRED UNIQUE INDEXES / CONSTRAINTS'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  t.index_name,
  CASE WHEN i.indexname IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status,
  i.indexdef
FROM (
  VALUES
    ('credit_balances_user_type_unique_idx'),
    ('credit_purchases_stripe_session_unique_idx'),
    ('users_email_unique_idx'),
    ('user_memberships_grant_sweep_idx')
) AS t(index_name)
LEFT JOIN pg_indexes i
  ON i.indexname = t.index_name
  AND i.schemaname = 'public'
ORDER BY t.index_name;

-- ─── 4. PERFORMANCE INDEXES ───────────────────────────────────────────────────
\echo '\n▶ 4. PERFORMANCE INDEXES (added in speed audit)'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  t.idx_name,
  CASE WHEN i.indexname IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
  VALUES
    ('credit_purchases_user_method_status_idx'),
    ('credit_purchases_created_at_idx'),
    ('bookings_session_status_idx'),
    ('bookings_status_created_at_idx'),
    ('bookings_booked_at_idx'),
    ('class_sessions_instructor_time_idx'),
    ('class_sessions_template_id_idx')
) AS t(idx_name)
LEFT JOIN pg_indexes i
  ON i.indexname = t.idx_name
  AND i.schemaname = 'public'
ORDER BY t.idx_name;

-- ─── 5. CREDIT INVARIANT: balance = SUM(active+unexpired lots) ────────────────
\echo '\n▶ 5. CREDIT BALANCE INVARIANT (balance must equal sum of active lots)'
\echo '────────────────────────────────────────────────────────────────────────────────'

WITH lot_sums AS (
  SELECT
    user_id,
    credit_type,
    COALESCE(SUM(remaining_amount), 0) AS lot_sum
  FROM credit_lots
  WHERE status = 'active'
    AND expires_at > NOW()
  GROUP BY user_id, credit_type
),
balance_check AS (
  SELECT
    b.user_id,
    b.credit_type,
    b.balance AS cache_balance,
    COALESCE(l.lot_sum, 0) AS lot_sum,
    b.balance - COALESCE(l.lot_sum, 0) AS drift
  FROM credit_balances b
  LEFT JOIN lot_sums l
    ON l.user_id = b.user_id
    AND l.credit_type = b.credit_type

  UNION ALL

  -- Also catch users with active lots but NO balance row
  SELECT
    l.user_id,
    l.credit_type,
    0 AS cache_balance,
    l.lot_sum,
    -l.lot_sum AS drift
  FROM lot_sums l
  LEFT JOIN credit_balances b
    ON b.user_id = l.user_id
    AND b.credit_type = l.credit_type
  WHERE b.id IS NULL
)
SELECT
  user_id,
  credit_type,
  cache_balance,
  lot_sum,
  drift
FROM balance_check
WHERE drift != 0;

-- ─── 6. EXPIRED LOTS WITH NON-ZERO REMAINING ──────────────────────────────────
\echo '\n▶ 6. EXPIRED/EXHAUSTED LOTS WITH remaining_amount > 0'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT id, user_id, credit_type, status, remaining_amount, expires_at
FROM credit_lots
WHERE status IN ('expired', 'exhausted')
  AND remaining_amount > 0;

-- ─── 7. ACTIVE LOTS WITH ZERO REMAINING ───────────────────────────────────────
\echo '\n▶ 7. ACTIVE LOTS WITH remaining_amount = 0'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT id, user_id, credit_type, remaining_amount, expires_at
FROM credit_lots
WHERE status = 'active'
  AND remaining_amount = 0;

-- ─── 8. OVER-EXPIRED LOTS (remaining > original) ──────────────────────────────
\echo '\n▶ 8. LOTS WHERE remaining_amount > original_amount'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT id, user_id, credit_type, original_amount, remaining_amount
FROM credit_lots
WHERE remaining_amount > original_amount;

-- ─── 9. NEGATIVE BALANCES ─────────────────────────────────────────────────────
\echo '\n▶ 9. NEGATIVE credit_balances.balance'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT user_id, credit_type, balance
FROM credit_balances
WHERE balance < 0;

-- ─── 10. MEMBERSHIP CRON READINESS ────────────────────────────────────────────
\echo '\n▶ 10. MEMBERSHIPS: next_credit_grant_at IN THE PAST (should be granted soon)'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  um.id,
  um.user_id,
  um.status,
  um.weekly_credits,
  um.next_credit_grant_at,
  um.ends_at,
  CASE
    WHEN um.ends_at <= NOW() THEN '⚠️ SHOULD BE EXPIRED'
    ELSE '⏳ DUE FOR GRANT'
  END AS action_needed
FROM user_memberships um
WHERE um.status = 'active'
  AND um.next_credit_grant_at <= NOW()
ORDER BY um.next_credit_grant_at;

-- ─── 11. ORPHANED ROWS (FK violations) ────────────────────────────────────────
\echo '\n▶ 11. ORPHANED / DANGLING FOREIGN KEYS'
\echo '────────────────────────────────────────────────────────────────────────────────'

-- credit_lots with invalid user_id
SELECT 'credit_lots → users' AS check_name, COUNT(*) AS orphaned
FROM credit_lots cl
LEFT JOIN users u ON u.id = cl.user_id
WHERE u.id IS NULL;

-- credit_balances with invalid user_id
SELECT 'credit_balances → users' AS check_name, COUNT(*) AS orphaned
FROM credit_balances cb
LEFT JOIN users u ON u.id = cb.user_id
WHERE u.id IS NULL;

-- bookings with invalid user_id
SELECT 'bookings → users' AS check_name, COUNT(*) AS orphaned
FROM bookings b
LEFT JOIN users u ON u.id = b.user_id
WHERE u.id IS NULL;

-- bookings with invalid session_id
SELECT 'bookings → class_sessions' AS check_name, COUNT(*) AS orphaned
FROM bookings b
LEFT JOIN class_sessions s ON s.id = b.session_id
WHERE s.id IS NULL;

-- class_sessions with invalid template_id
SELECT 'class_sessions → class_templates' AS check_name, COUNT(*) AS orphaned
FROM class_sessions s
LEFT JOIN class_templates t ON t.id = s.template_id
WHERE t.id IS NULL;

-- user_memberships with invalid user_id
SELECT 'user_memberships → users' AS check_name, COUNT(*) AS orphaned
FROM user_memberships um
LEFT JOIN users u ON u.id = um.user_id
WHERE u.id IS NULL;

-- credit_transactions with invalid user_id
SELECT 'credit_transactions → users' AS check_name, COUNT(*) AS orphaned
FROM credit_transactions ct
LEFT JOIN users u ON u.id = ct.user_id
WHERE u.id IS NULL;

-- ─── 12. STALE PENDING BOOKINGS (>30 min old, never confirmed) ────────────────
\echo '\n▶ 12. STALE PENDING BOOKINGS (payment_pending > 30 min)'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  b.id,
  b.user_id,
  b.session_id,
  b.status,
  b.booked_at,
  b.payment_status
FROM bookings b
WHERE b.status = 'pending'
  AND b.booked_at < NOW() - INTERVAL '30 minutes'
ORDER BY b.booked_at;

-- ─── 13. CLASS SESSIONS IN THE PAST STILL SCHEDULED ───────────────────────────
\echo '\n▶ 13. PAST CLASS SESSIONS STILL MARKED scheduled (not cancelled/held)'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  s.id,
  s.template_id,
  s.starts_at,
  s.ends_at,
  s.status,
  s.booked_count
FROM class_sessions s
WHERE s.starts_at < NOW()
  AND s.status = 'scheduled'
ORDER BY s.starts_at DESC
LIMIT 20;

-- ─── 14. DUPLICATE STRIPE SESSION IDs ─────────────────────────────────────────
\echo '\n▶ 14. DUPLICATE stripe_session_id IN credit_purchases'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT stripe_session_id, COUNT(*) AS cnt
FROM credit_purchases
WHERE stripe_session_id IS NOT NULL
GROUP BY stripe_session_id
HAVING COUNT(*) > 1;

-- ─── 15. USERS WITHOUT BALANCE ROWS BUT WITH ACTIVE LOTS ──────────────────────
\echo '\n▶ 15. USERS WITH ACTIVE LOTS BUT NO credit_balances ROW'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT DISTINCT
  cl.user_id,
  cl.credit_type,
  SUM(cl.remaining_amount) AS total_active
FROM credit_lots cl
WHERE cl.status = 'active'
  AND cl.expires_at > NOW()
GROUP BY cl.user_id, cl.credit_type
HAVING NOT EXISTS (
  SELECT 1 FROM credit_balances b
  WHERE b.user_id = cl.user_id
    AND b.credit_type = cl.credit_type
);

-- ─── 16. WELCOME JOURNEY FLAG CONSISTENCY ─────────────────────────────────────
\echo '\n▶ 16. WELCOME JOURNEY: templates flagged but users not completed'
\echo '────────────────────────────────────────────────────────────────────────────────'

SELECT
  ct.id AS template_id,
  ct.name,
  ct.is_welcome_journey,
  COUNT(u.id) AS users_not_completed
FROM class_templates ct
CROSS JOIN users u
WHERE ct.is_welcome_journey = TRUE
  AND u.welcome_completed_at IS NULL
  AND u.deleted_at IS NULL
GROUP BY ct.id, ct.name, ct.is_welcome_journey;

-- ─── 17. SUMMARY ──────────────────────────────────────────────────────────────
\echo '\n╔══════════════════════════════════════════════════════════════════════════════╗'
\echo '║                              SUMMARY                                         ║'
\echo '╚══════════════════════════════════════════════════════════════════════════════╝'
\echo '  • If sections 5-15 return 0 rows → everything is consistent.'
\echo '  • If section 10 shows rows → memberships need granting (cron handles this).'
\echo '  • If section 13 shows rows → past classes need status cleanup (admin action).'
\echo '  • If section 16 shows rows → expected: new users without welcome completion.'
