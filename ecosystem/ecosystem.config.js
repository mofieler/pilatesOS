/**
 * PM2 Ecosystem Configuration — PilatesOS
 *
 * Modular build-up: merges partial configs so each concern
 * (web, cron, seed) lives in its own file.
 *
 * Usage:
 *   pm2 start ecosystem/ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 *
 * Individual partials can also be started standalone:
 *   pm2 start ecosystem/partials/app.config.js
 *   pm2 start ecosystem/partials/cron.config.js
 *   pm2 start ecosystem/partials/seed.config.js
 */

const appConfig = require('./partials/app.config.js');
const cronConfig = require('./partials/cron.config.js');
const seedConfig = require('./partials/seed.config.js');

module.exports = {
  apps: [
    ...appConfig.apps,
    ...cronConfig.apps,
    // Seed is intentionally omitted from the default merged config
    // because it is a one-time job. Start it manually when needed:
    //   pm2 start ecosystem/partials/seed.config.js
  ],
};
