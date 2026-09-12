# LEGACY — netlify/functions (deprecated)

## Status: DEPRECATED — NOT USED IN PRODUCTION

This entire `netlify/functions/` directory is **no longer used in production**.

The project migrated its backend from Netlify Functions to **Vercel Functions**,
which follow the `/api/` directory convention. The active, maintained versions
of the logic in this folder now live in:

- `/api/_gas.js` (shared helper)
- `/api/check-duplicate-phone.js`
- `/api/update-lead.js`
- `/api/confirm-booking.js`

## What is inside this folder

The original Netlify function files are kept here **physically in place**, only
for historical reference:

- `_gas.js`
- `check-duplicate-phone.js`
- `update-lead.js`
- `confirm-booking.js`

> Note: the frontend now calls `/api/*` paths (see `js/main.js`), so nothing in
> this folder is reachable or invoked by the current app.

## Local development note (applies to `dev-server.js` as well)

For local development, `package.json` still defines a `dev` script that runs
`node dev-server.js`. That script was written to proxy
`/.netlify/functions/*` locally and is now **outdated**, since all routes moved
to `/api/`.

Do not rely on `dev-server.js` for local development anymore. Instead, use the
**Vercel CLI**:

```bash
vercel dev
```

`vercel dev` auto-detects the `/api` directory and serves it locally, without
needing `dev-server.js`. (Its script entry was intentionally left unchanged.)

## Do not restore this directory

Unless a future decision re-adopts Netlify, this directory should not be
re-enabled or treated as the source of truth. Keep it as reference only.