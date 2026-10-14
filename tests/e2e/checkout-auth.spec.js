import { expect, test } from '@playwright/test';

const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const customer = {
  id: customerId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'customer@example.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Aarav Sharma' },
  created_at: '2026-01-01T00:00:00.000Z',
};

test('checkout requires sign-in and preserves cart and delivery details for resumption', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();

  await page.getByLabel('Name').last().fill('Aarav Sharma');
  await page.getByLabel('Phone').last().fill('9876543210');
  await page.getByLabel('Delivery address').fill('221 Rose Avenue, Jaipur');
  await page.getByLabel('Payment method').selectOption('qr_whatsapp');
  await page.getByRole('button', { name: 'Place order request' }).click();

  const dialog = page.getByRole('dialog', { name: 'Welcome back' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Your checkout will continue after you sign in.')).toBeVisible();
  await expect(page.getByLabel('Name').last()).toHaveValue('Aarav Sharma');
  await expect(page.getByLabel('Phone').last()).toHaveValue('9876543210');
  await expect(page.getByLabel('Delivery address')).toHaveValue('221 Rose Avenue, Jaipur');
  await expect(page.getByLabel('Payment method')).toHaveValue('qr_whatsapp');
  await expect(page.locator('.drawer .line')).toHaveCount(1);
});

test('authenticated checkout saves through the RPC and the order appears in that customer account', async ({ page }) => {
  const productId = '30000000-0000-4000-8000-000000000001';
  const orderId = '11111111-1111-4111-8111-111111111111';
  let orderRpcPayload;
  let orderRpcAuthorization;
  let orderHistoryUrl;

  await page.route(/\/auth\/v1\/token\?grant_type=password$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'customer-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'customer-refresh-token',
      user: customer,
    }),
  }));
  await page.route(/\/auth\/v1\/user(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(customer),
  }));
  await page.route(/\/rest\/v1\/customer_store_state(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user_id: customerId, cart: [], wishlist: [] }),
  }));
  await page.route(/\/rest\/v1\/products(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: productId,
      name: 'Velvet Press-ons',
      description: 'A test product',
      price: 599,
      discount_percent: 0,
      image_url: null,
      stock: 5,
      is_active: true,
    }]),
  }));
  await page.route(/\/rest\/v1\/rpc\/create_order(?:\?.*)?$/, async (route) => {
    orderRpcPayload = route.request().postDataJSON();
    orderRpcAuthorization = route.request().headers().authorization;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ order_id: orderId, order_total: 659 }]),
    });
  });
  await page.route(/\/rest\/v1\/orders(?:\?.*)?$/, async (route) => {
    orderHistoryUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: orderId,
        user_id: customerId,
        items: [{ id: productId, name: 'Velvet Press-ons', qty: 1, unit_price: 599, line_total: 599 }],
        total: 659,
        status: 'new',
        payment_method: 'qr_whatsapp',
        payment_status: 'pending',
        created_at: '2026-10-14T10:00:00.000Z',
      }]),
    });
  });
  await page.route(/\/rest\/v1\/appointments(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));

  await page.goto('/login');
  const login = page.getByRole('dialog', { name: 'Welcome back' });
  await login.getByLabel('Email').fill(customer.email);
  await login.getByLabel('Password').fill('customer-password');
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await page.getByLabel('Name').last().fill('Aarav Sharma');
  await page.getByLabel('Phone').last().fill('9876543210');
  await page.getByLabel('Delivery address').fill('221 Rose Avenue, Jaipur');
  await page.getByLabel('Payment method').selectOption('qr_whatsapp');
  await page.getByRole('button', { name: 'Place order request' }).click();

  await expect(page.getByText(new RegExp(`Order ${orderId.slice(0, 8)} is saved for ₹659`))).toBeVisible();
  expect(orderRpcAuthorization).toContain('customer-access-token');
  expect(orderRpcPayload).toMatchObject({
    p_customer_name: 'Aarav Sharma',
    p_phone: '9876543210',
    p_address: '221 Rose Avenue, Jaipur',
    p_payment_method: 'qr_whatsapp',
    p_items: [{ id: productId, qty: 1 }],
  });
  expect(orderRpcPayload).not.toHaveProperty('user_id');

  await page.goto('/account');
  await expect.poll(() => orderHistoryUrl).toContain(`user_id=eq.${customerId}`);
  await page.getByRole('tab', { name: 'My Orders' }).click();
  await expect(page.getByRole('heading', { name: `#${orderId}` })).toBeVisible();
  await expect(page.getByText('Velvet Press-ons × 1')).toBeVisible();
  await expect(page.getByText('₹659')).toBeVisible();
  await expect(page.getByText('QR / WhatsApp')).toBeVisible();
  await expect(page.getByText('Payment pending')).toBeVisible();
  await expect(page.getByText('Order · 14 Oct 2026')).toBeVisible();
});
