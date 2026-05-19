# PM2 Ecosystem Configuration

Modular PM2 setup for PilatesOS. Split across partial configs so each concern (web, cron, seed) can be started independently.

## Structure

```
ecosystem/
  ecosystem.config.js          # Main entry — merges app + cron partials
  partials/
    app.config.js              # Next.js web app (cluster mode)
    cron.config.js             # Cron job runners
    seed.config.js             # One-time seed job
```

## Usage

### Start everything (web + cron)

```bash
pm2 start ecosystem/ecosystem.config.js --env production
```

### Start partials individually

```bash
# Web app only
pm2 start ecosystem/partials/app.config.js --env production

# Cron jobs only
pm2 start ecosystem/partials/cron.config.js --env production

# One-time seed (run manually after fresh deploy)
pm2 start ecosystem/partials/seed.config.js
```

### Save & autostart on boot

```bash
pm2 save
pm2 startup
```

## Cron Jobs

| Name | Schedule | Endpoint | Purpose |
|------|----------|----------|---------|
| `pilatesos-cron-expiry` | Daily 02:00 | `/api/cron/expiry-sweep` | Expire stale credit lots, update balances |
| `pilatesos-cron-membership` | Mondays 06:00 | `/api/cron/membership-credit-grant` | Grant weekly membership credits |
| `pilatesos-cron-calendar` | Every 5 min | `/api/cron/calendar-sync` | Sync instructor Google Calendars |

## Environment Variables

Required for cron runners (set in your `.env.production` or server environment):

- `CRON_SECRET` — Bearer token for `/api/cron/*` authentication
- `NEXT_PUBLIC_APP_URL` — Public app URL (e.g. `https://studio.pilatesos.de`)

Optional for web app:

- `WEB_INSTANCES` — Number of cluster instances (default: `max` = all CPU cores)

## Logs

All PM2 logs are written to `logs/pm2/`:

```
logs/pm2/
  web-out.log
  web-error.log
  cron-expiry-out.log
  cron-expiry-error.log
  cron-membership-out.log
  cron-membership-error.log
  cron-calendar-out.log
  cron-calendar-error.log
  seed-out.log
  seed-error.log
```

View logs:

```bash
pm2 logs pilatesos-web
pm2 logs pilatesos-cron-expiry
```

## Reloading

Zero-downtime reload of the web app:

```bash
pm2 reload pilatesos-web
```

Restart all:

```bash
pm2 restart all
```
