// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Credentials come from environment variables. Never commit real passwords.
 *   ADMIN_EMAIL / ADMIN_PASSWORD   (required for logged-in tests)
 *   TEACHER_EMAIL / TEACHER_PASSWORD, PARENT_EMAIL / PARENT_PASSWORD,
 *   STUDENT_EMAIL / STUDENT_PASSWORD  (optional; skipped when missing)
 */
const ROLES = ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT'].map((r) => ({
  name: r.toLowerCase(),
  email: process.env[`${r}_EMAIL`],
  password: process.env[`${r}_PASSWORD`],
}));

// ---- Locators that match the real login form (label text from main.jsx) ----
const email = (page) => page.getByLabel('Email');
const password = (page) => page.getByLabel('Password', { exact: true });
const signIn = (page) => page.getByRole('button', { name: /^Sign in$|^Signing in/ });
const signOut = (page) => page.getByRole('button', { name: 'Sign out' });
const mainNav = (page) => page.getByRole('navigation', { name: 'Main navigation' });

async function login(page, e, p) {
  await page.goto('/');
  await email(page).fill(e);
  await password(page).fill(p);
  await signIn(page).click();
}

async function loggedIn(page) {
  await expect(signOut(page)).toBeVisible();
}

// ============================ SMOKE ============================
test.describe('Smoke', () => {
  test('login page renders without JS errors or 5xx', async ({ page }) => {
    const jsErrors = [];
    const serverErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(email(page)).toBeVisible();
    await expect(password(page)).toBeVisible();
    await expect(signIn(page)).toBeVisible();
    expect(jsErrors, jsErrors.join(' | ')).toHaveLength(0);
    expect(serverErrors, serverErrors.join(' | ')).toHaveLength(0);
  });

  test('API health endpoint is up (via Vercel rewrite to Render)', async ({ request }) => {
    const res = await request.get('/api/health', { timeout: 60_000 });
    expect(res.status()).toBe(200);
  });

  test('unknown path falls back to the app (SPA rewrite)', async ({ page }) => {
    const res = await page.goto('/students');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('password input is masked', async ({ page }) => {
    await page.goto('/');
    await expect(password(page)).toHaveAttribute('type', 'password');
  });
});

// ======================== LOGIN: NEGATIVE ========================
test.describe('Login - negative cases', () => {
  test('empty submit is blocked by required fields', async ({ page }) => {
    await page.goto('/');
    await signIn(page).click();
    await expect(email(page)).toHaveJSProperty('validity.valueMissing', true);
    await expect(signOut(page)).toHaveCount(0);
  });

  test('invalid email format is rejected', async ({ page }) => {
    await page.goto('/');
    await email(page).fill('not-an-email');
    await password(page).fill('SomePassword123!');
    await signIn(page).click();
    await expect(email(page)).toHaveJSProperty('validity.typeMismatch', true);
    await expect(signOut(page)).toHaveCount(0);
  });

  test('wrong credentials show an error and do not sign in', async ({ page }) => {
    await login(page, 'nobody@example.com', 'WrongPassword123!');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(signOut(page)).toHaveCount(0);
  });

  test('injection strings never sign in', async ({ page }) => {
    for (const p of ["' OR '1'='1", '{"$ne":null}', "admin' --"]) {
      await login(page, 'admin@example.com', p);
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(signOut(page)).toHaveCount(0);
    }
  });

  test('XSS payload in password is not executed', async ({ page }) => {
    let fired = false;
    page.on('dialog', async (d) => {
      fired = true;
      await d.dismiss();
    });
    await login(page, 'x@example.com', '<img src=x onerror=alert(1)>');
    await page.getByRole('alert').waitFor();
    expect(fired).toBe(false);
  });

  test('very long input does not crash the page', async ({ page }) => {
    await login(page, `${'a'.repeat(300)}@example.com`, 'b'.repeat(5000));
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

// ================== LOGIN: POSITIVE, ONE SET PER ROLE ==================
for (const role of ROLES) {
  test.describe(`Role: ${role.name}`, () => {
    test.skip(!role.email || !role.password, `No ${role.name.toUpperCase()}_EMAIL / _PASSWORD set`);

    test('signs in and sees a role workspace', async ({ page }) => {
      await login(page, role.email, role.password);
      await loggedIn(page);
      await expect(page.getByText(new RegExp(`${role.name} workspace`, 'i')).first()).toBeVisible();
    });

    test('every sidebar item opens without a crash or error alert', async ({ page }) => {
      const jsErrors = [];
      page.on('pageerror', (e) => jsErrors.push(e.message));
      await login(page, role.email, role.password);
      await loggedIn(page);
      const items = mainNav(page).getByRole('button');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const item = items.nth(i);
        const label = (await item.innerText()).trim();
        await item.click();
        await expect(item, `"${label}" did not become active`).toHaveAttribute('aria-current', 'page');
        await expect(page.getByRole('alert'), `"${label}" shows an error`).toHaveCount(0);
      }
      expect(jsErrors, jsErrors.join(' | ')).toHaveLength(0);
    });

    test('sign out returns to login and Back does not restore the session', async ({ page }) => {
      await login(page, role.email, role.password);
      await loggedIn(page);
      await signOut(page).click();
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await page.goBack();
      await expect(signOut(page)).toHaveCount(0);
    });
  });
}

// ============== ADMIN: USER MANAGEMENT FORM VALIDATION ==============
test.describe('Admin - Create account form', () => {
  test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, 'Admin credentials not set');

  test.beforeEach(async ({ page }) => {
    await login(page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    await loggedIn(page);
    // The admin "Manage users" screen is reached from the nav/header; try common entry points.
    const usersEntry = page.getByRole('button', { name: /manage users|users/i }).first();
    await usersEntry.click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('rejects short initial password (<12 chars)', async ({ page }) => {
    await page.getByLabel('Full name').fill('Test User');
    await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
    await page.getByLabel(/Initial password/).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByLabel(/Initial password/)).toHaveJSProperty('validity.tooShort', true);
  });

  test('rejects HTML markup in name (server validation)', async ({ page }) => {
    let fired = false;
    page.on('dialog', async (d) => {
      fired = true;
      await d.dismiss();
    });
    await page.getByLabel('Full name').fill('<script>alert(1)</script>');
    await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
    await page.getByLabel(/Initial password/).fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toBeVisible(); // README: names reject HTML markup
    expect(fired).toBe(false);
  });
});

// ======================= RESPONSIVE & HEADERS =======================
test.describe('Responsive & security headers', () => {
  test('no horizontal scroll on login page', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBeFalsy();
  });

  test('security headers from vercel.json are present', async ({ request }) => {
    const h = (await request.get('/')).headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['content-security-policy']).toContain("default-src 'self'");
  });
});
