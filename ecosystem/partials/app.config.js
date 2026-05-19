/**
 * PM2 config — Next.js standalone web app
 * Runs in cluster mode for load balancing across CPU cores.
 */

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'pilatesos-web',
      script: path.join(__dirname, '../../.next/standalone/server.js'),
      instances: process.env.WEB_INSTANCES || 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      merge_logs: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: path.join(__dirname, '../../logs/pm2/web-out.log'),
      error_file: path.join(__dirname, '../../logs/pm2/web-error.log'),
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      // Health-check endpoint used by Coolify / reverse proxy
      // PM2 itself does not use this, but container orchestrators do.
      // Keep the process alive unless it crashes repeatedly.
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
