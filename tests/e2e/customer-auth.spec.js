import { expect, test } from '@playwright/test';

test('guest account access redirects to customer sign-in and surfaces auth errors', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login$/);

  const dialog = page.getByRole('dialog', { name: 'Welcome back' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Create an account' }).click();
  const signup = page.getByRole('dialog', { name: 'Create your account' });
  await expect(signup.getByLabel('Full name')).toBeVisible();
  await signup.getByLabel('Full name').fill('Test Customer');
  await signup.getByLabel('Email').fill('test-customer@example.com');
  await signup.getByLabel('Password').fill('a-safe-test-password');
  await signup.getByRole('link', { name: 'Sign in', exact: true }).click();

  const login = page.getByRole('dialog', { name: 'Welcome back' });
  await login.getByLabel('Email').fill('test-customer@example.com');
  await login.getByLabel('Password').fill('intentionally-invalid-password');
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(login.getByRole('alert')).toBeVisible();
  await expect(login.getByLabel('Email')).toHaveValue('test-customer@example.com');
});
