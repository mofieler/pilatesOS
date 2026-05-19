/**
 * PM2 config — one-time database seed job
 * Intended to run manually after a fresh deploy:
 *   pm2 start ecosystem/partials/seed.config.js
 *
 * IMPORTANT: This uses the compiled seed script (scripts/seed.js) rather than
 * tsx, because tsx is a dev dependency and may not be available in the
 * production Docker container (which only copies the standalone build).
 *
 * To generate scripts/seed.js before deploying:
 *   npx tsc scripts/seed.ts --outDir scripts --esModuleInterop --module commonjs
 * Or run seed during the Docker build stage where dev dependencies exist.
 */

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'pilatesos-seed',
      script: path.join(__dirname, '../../scripts/seed.js'),
      cwd: path.join(__dirname, '../..'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      max_restarts: 1,
      kill_timeout: 30000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: path.join(__dirname, '../../logs/pm2/seed-out.log'),
      error_file: path.join(__dirname, '../../logs/pm2/seed-error.log'),
      merge_logs: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
