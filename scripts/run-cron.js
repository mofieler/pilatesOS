#!/usr/bin/env node
/**
 * Generic PM2 cron runner for Next.js API cron endpoints.
 *
 * Usage:
 *   node scripts/run-cron.js expiry-sweep
 *   node scripts/run-cron.js membership-credit-grant
 *   node scripts/run-cron.js calendar-sync
 *
 * Environment variables required:
 *   CRON_SECRET            — Bearer token for Authorization header
 *   NEXT_PUBLIC_APP_URL    — Base URL of the PilatesOS instance
 *                             (e.g. https://studio.pilatesos.de)
 */

const endpointName = process.argv[2];

if (!endpointName) {
  console.error('[cron-runner] Error: endpoint name required');
  console.error('[cron-runner] Usage: node scripts/run-cron.js <endpoint-name>');
  process.exitCode = 1;
  return;
}

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');

if (!CRON_SECRET) {
  console.error('[cron-runner] Error: CRON_SECRET env var is missing');
  process.exitCode = 1;
  return;
}

if (!BASE_URL) {
  console.error('[cron-runner] Error: NEXT_PUBLIC_APP_URL env var is missing');
  process.exitCode = 1;
  return;
}

const url = `${BASE_URL}/api/cron/${endpointName}`;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

async function fetchWithRetry(attempt = 1) {
  const start = Date.now();
  console.log(`[cron-runner] ${endpointName} | attempt ${attempt}/${MAX_RETRIES} | start | ${new Date().toISOString()}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const duration = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[cron-runner] ${endpointName} | HTTP ${res.status} | ${duration}ms | ${body.slice(0, 500)}`);

      // Retry on 5xx or 429 (rate limited / server busy)
      if ((res.status >= 500 || res.status === 429) && attempt < MAX_RETRIES) {
        console.log(`[cron-runner] ${endpointName} | retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return fetchWithRetry(attempt + 1);
      }

      process.exitCode = 1;
      return;
    }

    const body = await res.json().catch(() => ({}));
    console.log(`[cron-runner] ${endpointName} | OK | HTTP ${res.status} | ${duration}ms |`, JSON.stringify(body));
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[cron-runner] ${endpointName} | EXCEPTION | ${duration}ms |`, err.message);

    // Retry on network errors (ECONNREFUSED, timeout, etc.)
    if (attempt < MAX_RETRIES) {
      console.log(`[cron-runner] ${endpointName} | retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return fetchWithRetry(attempt + 1);
    }

    process.exitCode = 1;
  }
}

fetchWithRetry();
