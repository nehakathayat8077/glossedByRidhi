# Runtime Validation Report

**Generated**: 2026-10-11  
**Target**: GlossedByRidhi customer authentication and account history

## Summary

| Step | Status | Exit Code | Details |
|------|--------|-----------|---------|
| Production build | PASS | 0 | `npm run build`; Vite completed successfully. |
| Browser E2E | PARTIAL | 0 | Three Playwright tests passed for guest redirect, editable appointment draft, and checkout auth gate/state retention. |
| Supabase integration/security | UNVERIFIED | N/A | No `.env.local`/anon key or test accounts were available, and migration 006 was not applied. |

**Overall**: NEEDS_SIGNOFF — browser presentation and client-side preservation passed, but successful Auth, database writes, ownership isolation, and admin access require live Supabase validation.

## Environment

- Docker: UNAVAILABLE — Docker CLI is not installed.
- Node.js: AVAILABLE — v24.13.0.
- Playwright: AVAILABLE — Playwright 1.64.0 and Chromium installed.
- Test server: Vite started successfully through the Playwright web-server configuration.
- Supabase test configuration: the browser tests use an intentionally invalid placeholder anon key unless a key is supplied in the test process environment. The workspace had no `.env.local`.

## Browser Test Evidence

| Test file | Result | Coverage |
|---|---|---|
| `tests/e2e/customer-auth.spec.js` | PASS | Guest `/account` redirect, signup/login routes, and visible auth failure while retaining login input. |
| `tests/e2e/appointment-auth.spec.js` | PASS | Multi-character entry into appointment fields and draft restoration after login navigation. |
| `tests/e2e/checkout-auth.spec.js` | PASS | Guest checkout redirects to sign-in while retaining cart, COD/QR choice, and delivery fields. |

Command: `npm run test:e2e` — 3 passed, 0 failed, exit code 0.

These tests use the real frontend and Playwright browser, but do not make Supabase writes. They do not prove successful signup/login or database behavior.

## Dependency Audit

`npm audit --omit=dev` exited with code 1 and reported two moderate advisories affecting the installed `react-router-dom` 6.x dependency range. The full audit also reported a high-severity Vite development-server advisory and a moderate `esbuild` advisory. No package upgrades were made because the suggested router fix is a major-version change and the Vite remediation also requires a major upgrade; those changes need a separate compatibility review.

## Unverified Flows

- Successful customer signup/login and persisted session refresh.
- Appointment insert and server-derived `user_id`.
- COD and QR/WhatsApp order inserts through the authenticated RPC.
- Customer-to-customer RLS isolation for orders and appointments.
- Admin login, order/appointment updates, and existing admin permissions.
- Migration SQL execution against the live database.

Run `supabase/migrations/202610110006_customer_accounts_and_record_ownership.sql` only after the existing migrations, including the five-argument `create_order` migration, have been applied. Then repeat live tests with separate customer accounts and the admin account.
