# Fix: "Unexpected token '<', '<!DOCTYPE'..." error on login

## Symptom

Users see `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` on the login screen
when they try to sign in, especially after the app has been idle for >15 minutes.

## Root cause

The frontend's `frontend/src/api/client.js` called `await response.json()` **unconditionally**
on every response. When the Render free-tier backend is asleep (it sleeps after ~15 min of
inactivity) and the user sends a request, Render returns its HTML "Application is starting up"
page instead of JSON. `JSON.parse('<!DOCTYPE html>...')` throws `Unexpected token '<'`,
which bubbles up to the login form's error banner.

The token-refresh hypothesis in the original bug report was a red herring: refresh-token
expiry returns a clean JSON 401, which the client already handles correctly via the
`restore()` retry path. The actual culprit was **HTML responses from a cold-starting
backend being parsed as JSON**.

## Reproduction

```bash
# Backend is asleep (free tier, 15+ min idle):
curl -sS -i -X POST https://school-management-software-2.onrender.com/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'
# → HTTP 502 (or HTML 200 with "Application is starting up" body)
# Frontend's response.json() then throws "Unexpected token '<'"
```

## Fix

Patch `frontend/src/api/client.js`:

1. **New `parseBody(response)` helper** — checks `Content-Type` before parsing.
   If the response is JSON, parse normally. If it's HTML (or any non-JSON content),
   throw a user-friendly error message instead of letting `JSON.parse` surface the
   raw syntax error.

2. **`fetchWithColdStartRetry()` wrapper** — on HTTP 502/503/504 (Render wake-up
   signals), wait 5 seconds and retry once. By the time the retry lands, Render
   has usually finished spinning up the instance.

3. **Updated timeout error message** — now mentions "backend may be starting up
   after inactivity" so users know to retry.

4. **All three fetch helpers (`api`, `apiText`, `apiBlob`) route through the new
   safe parser and cold-start retry**.

## Files changed

- `frontend/src/api/client.js` — defensive parsing + cold-start retry

## What this fix does NOT change

- JWT refresh flow is unchanged — the `restore()` path already worked correctly
  for expired refresh tokens (returns JSON 401, handled by `if(response.status===401&&retry)`).
- No backend changes — the backend already returns proper JSON for all its responses;
  the HTML came from Render's cold-start proxy, not from the app.
- No env var changes — `FRONTEND_ORIGIN`, `JWT_SECRET`, etc. are unchanged.

## Permanent fix (recommended)

Upgrade the Render backend service from the free tier to a paid tier that does not
sleep. The free tier sleeps after 15 min of inactivity and takes ~30 seconds to spin
up on the next request, during which users see the error. A paid instance (Starter,
~$7/mo) stays warm 24/7 and eliminates the cold-start window entirely.

Until that upgrade, this frontend patch ensures users see a friendly message
("The backend is starting up after inactivity…") and the app auto-retries once
after 5 seconds, masking the cold-start window for the majority of cases.

## Test plan

- [x] Verified all backend endpoints return JSON when warm
- [x] Verified the Vercel rewrite for `/api/*` correctly proxies to Render
- [x] Verified SPA deep links (`/dashboard`) correctly return `index.html` (HTML)
- [ ] Manual: leave the backend idle for >15 min, attempt login, confirm the new
      error message appears instead of the raw `Unexpected token '<'`
- [ ] Manual: confirm that after the 5-second auto-retry, the login succeeds
      (Render has woken up by then)
