/**
 * PM2 config — isolated cron job runners
 * Each cron job is a separate PM2 instance so a crash/OOM in one
 * does not affect the web app or other cron jobs.
 *
 * Schedules are defined via PM2's cron_restart feature.
 * The runner script hits the Next.js API cron endpoints over HTTP.
 */

const path = require('path');

const CRON_RUNNER = path.join(__dirname, '../../scripts/run-cron.js');
const LOG_DIR = path.join(__dirname, '../../logs/pm2');

function cronApp(name, endpoint, schedule) {
  return {
    name: `pilatesos-cron-${name}`,
    script: CRON_RUNNER,
    args: [endpoint],
    instances: 1,
    exec_mode: 'fork',
    autorestart: false,
    max_restarts: 1,
    cron_restart: schedule,
    // cron jobs run quickly; keep logs tidy
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    out_file: path.join(LOG_DIR, `cron-${name}-out.log`),
    error_file: path.join(LOG_DIR, `cron-${name}-error.log`),
    merge_logs: false,
    kill_timeout: 30000,
    env: {
      NODE_ENV: 'development',
      TZ: 'UTC',
    },
    env_production: {
      NODE_ENV: 'production',
      TZ: 'UTC',
    },
  };
}

module.exports = {
  apps: [
    // Daily at 02:00 — expire stale credit lots
    cronApp('expiry', 'expiry-sweep', '0 2 * * *'),

    // Mondays at 06:00 — grant weekly membership credits
    cronApp('membership', 'membership-credit-grant', '0 6 * * 1'),

    // Every 5 minutes — sync external instructor calendars
    cronApp('calendar', 'calendar-sync', '*/5 * * * *'),
  ],
};
