import { expect, test } from '@playwright/test';

const customer = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'customer@example.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Ridhi Sharma' },
  created_at: '2026-01-01T00:00:00.000Z',
};

function sessionResponse(user) {
  return {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'test-refresh-token',
    user,
  };
}

async function mockSignIn(page, user = customer) {
  await page.route(/\/auth\/v1\/token\?grant_type=password$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(sessionResponse(user)),
  }));
  await page.route(/\/auth\/v1\/user(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(user),
  }));
}

async function mockAdminData(page) {
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
}

test('customer sign-up starts a session without granting an admin role', async ({ page }) => {
  let signupPayload;
  await page.route(/\/auth\/v1\/signup$/, async (route) => {
    signupPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionResponse(customer)),
    });
  });

  await page.goto('/signup');
  const dialog = page.getByRole('dialog', { name: 'Create your account' });
  await dialog.getByLabel('Full name').fill('Ridhi Sharma');
  await dialog.getByLabel('Email').fill('customer@example.com');
  await dialog.getByLabel('Password').fill('customer-password');
  await dialog.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'My account' })).toBeVisible();
  expect(signupPayload.email).toBe('customer@example.com');
  expect(signupPayload.data).toEqual({ full_name: 'Ridhi Sharma' });
  expect(signupPayload.data).not.toHaveProperty('role');
  expect(signupPayload).not.toHaveProperty('app_metadata');
});

test('customer password sign-in opens only the customer account', async ({ page }) => {
  await mockSignIn(page);
  await page.goto('/login');
  const dialog = page.getByRole('dialog', { name: 'Welcome back' });
  await dialog.getByLabel('Email').fill(customer.email);
  await dialog.getByLabel('Password').fill('customer-password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL('/');
  await page.getByRole('link', { name: 'My account' }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('heading', { name: 'Welcome back, Ridhi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toHaveCount(0);
});

test('customer session survives reload and logout returns to sign-in', async ({ page }) => {
  await mockSignIn(page);
  await page.route(/\/auth\/v1\/logout(?:\?.*)?$/, (route) => route.fulfill({ status: 204 }));
  await page.goto('/login');
  const dialog = page.getByRole('dialog', { name: 'Welcome back' });
  await dialog.getByLabel('Email').fill(customer.email);
  await dialog.getByLabel('Password').fill('customer-password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'My account' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ridhi' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ridhi' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
});

test('customer accounts cannot enter the admin dashboard', async ({ page }) => {
  await mockSignIn(page);
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(customer.email);
  await page.getByLabel('Password').fill('customer-password');
  await page.getByRole('button', { name: 'Sign in securely' }).click();

  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible();
  await expect(page.getByText('This signed-in account is not assigned the admin role.')).toBeVisible();
});

test('admin password sign-in opens the existing management dashboard', async ({ page }) => {
  await mockSignIn(page, {
    ...customer,
    email: 'admin@example.com',
    app_metadata: { provider: 'email', providers: ['email'], role: 'admin' },
  });
  await mockAdminData(page);
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('admin-password');
  await page.getByRole('button', { name: 'Sign in securely' }).click();

  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('heading', { name: 'Good day, Ridhi' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Appointments' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();

  let appointmentRequestUrl;
  await page.route(/\/rest\/v1\/appointments(?:\?.*)?$/, async (route) => {
    appointmentRequestUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.getByRole('link', { name: 'Appointments' }).click();
  await expect(page.locator('.admin-topbar h1')).toHaveText('Appointments');
  await expect.poll(() => appointmentRequestUrl).not.toBeUndefined();
  expect(appointmentRequestUrl).not.toContain('user_id=eq.');

  let orderRequestUrl;
  await page.route(/\/rest\/v1\/orders(?:\?.*)?$/, async (route) => {
    orderRequestUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.getByRole('link', { name: 'Orders' }).click();
  await expect(page.locator('.admin-topbar h1')).toHaveText('Orders');
  await expect.poll(() => orderRequestUrl).not.toBeUndefined();
  expect(orderRequestUrl).not.toContain('user_id=eq.');
});

test('admin order creation links the order through the customer account email', async ({ page }) => {
  await mockSignIn(page, {
    ...customer,
    email: 'admin@example.com',
    app_metadata: { provider: 'email', providers: ['email'], role: 'admin' },
  });
  await mockAdminData(page);

  const productId = '30000000-0000-4000-8000-000000000001';
  let createOrderPayload;
  await page.route(/\/rest\/v1\/products(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: productId, name: 'Velvet Press-ons', price: 599 }]),
  }));
  await page.route(/\/rest\/v1\/rpc\/admin_create_order(?:\?.*)?$/, async (route) => {
    createOrderPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ order_id: '11111111-1111-4111-8111-111111111111', order_total: 659 }]),
    });
  });

  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('admin-password');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page.getByRole('link', { name: 'Orders' }).click();
  await page.getByRole('button', { name: 'Create customer order' }).click();

  await page.getByLabel('Customer account email').fill('customer@example.com');
  await page.getByLabel('Customer name').fill('Ridhi Sharma');
  await page.getByLabel('Phone').fill('9876543210');
  await page.getByLabel('Delivery address').fill('221 Rose Avenue, Jaipur');
  await page.getByLabel('Product').selectOption(productId);
  await page.getByLabel('Quantity').fill('1');
  await page.getByRole('button', { name: 'Create order', exact: true }).click();

  await expect(page.getByText(/Customer order created.*payment pending/i)).toBeVisible();
  expect(createOrderPayload).toMatchObject({
    p_customer_email: 'customer@example.com',
    p_customer_name: 'Ridhi Sharma',
    p_phone: '9876543210',
    p_address: '221 Rose Avenue, Jaipur',
    p_items: [{ id: productId, qty: 1 }],
    p_payment_method: 'cod',
  });
  expect(createOrderPayload).not.toHaveProperty('user_id');
});
