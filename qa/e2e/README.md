# End-to-end tests (Playwright)

Runs against the deployed site by default (`BASE_URL` to override).

```sh
cd qa/e2e
npm install
npx playwright install chromium
ADMIN_EMAIL=you@school.com ADMIN_PASSWORD='...' npm test
npm run report
```

Optional roles: `TEACHER_*`, `PARENT_*`, `STUDENT_*` (`_EMAIL` / `_PASSWORD`). Roles without credentials are skipped.
Use a test account, not a real production admin. The backend is on Render's free tier, so the first request can be slow.
