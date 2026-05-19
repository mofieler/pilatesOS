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
  process.exit(1);
}

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');

if (!CRON_SECRET) {
  console.error('[cron-runner] Error: CRON_SECRET env var is missing');
  process.exit(1);
}

if (!BASE_URL) {
  console.error('[cron-runner] Error: NEXT_PUBLIC_APP_URL env var is missing');
  process.exit(1);
}

const url = `${BASE_URL}/api/cron/${endpointName}`;

async function run() {
  const start = Date.now();
  console.log(`[cron-runner] ${endpointName} | start | ${new Date().toISOString()}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[cron-runner] ${endpointName} | ERROR | HTTP ${res.status} | ${duration}ms | ${body.slice(0, 500)}`);
      process.exit(1);
    }

    const body = await res.json().catch(() => ({}));
    console.log(`[cron-runner] ${endpointName} | OK | HTTP ${res.status} | ${duration}ms |`, JSON.stringify(body));
    process.exit(0);
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[cron-runner] ${endpointName} | EXCEPTION | ${duration}ms |`, err.message);
    process.exit(1);
  }
}

run();
