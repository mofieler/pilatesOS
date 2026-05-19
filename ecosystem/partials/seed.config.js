/**
 * PM2 config — one-time database seed job
 * Intended to run manually after a fresh deploy:
 *   pm2 start ecosystem/partials/seed.config.js
 *
 * autorestart: false prevents the seed from re-running automatically.
 */

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'pilatesos-seed',
      script: 'npm',
      args: 'run db:seed',
      cwd: path.join(__dirname, '../..'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      max_restarts: 1,
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
