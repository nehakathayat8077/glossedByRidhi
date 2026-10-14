import { expect, test } from '@playwright/test';

const productId = '20000000-0000-4000-8000-000000000001';

function customer(id, email, fullName) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: fullName },
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

async function createCustomerPage(browser, user, cartLabel, wishlist) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let loadedStateUrl;
  let savedState;

  await page.route(/\/auth\/v1\/token\?grant_type=password$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: `token-${user.id}`,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: `refresh-${user.id}`,
      user,
    }),
  }));
  await page.route(/\/auth\/v1\/user(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(user),
  }));
  await page.route(/\/rest\/v1\/customer_store_state(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      loadedStateUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: user.id,
          cart: [{ id: productId, name: cartLabel, price: 125, qty: 1 }],
          wishlist,
        }),
      });
      return;
    }
    const payload = route.request().postDataJSON();
    savedState = Array.isArray(payload) ? payload[0] : payload;
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route(/\/rest\/v1\/products(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: productId,
      name: 'Velvet Press-ons',
      description: 'A test product',
      price: 125,
      discount_percent: 0,
      image_url: null,
      stock: 5,
      is_active: true,
    }]),
  }));

  await page.goto('/login');
  const login = page.getByRole('dialog', { name: 'Welcome back' });
  await login.getByLabel('Email').fill(user.email);
  await login.getByLabel('Password').fill('customer-password');
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect.poll(() => loadedStateUrl).toContain(`user_id=eq.${user.id}`);

  return { context, page, getSavedState: () => savedState };
}

test('restores separate customer carts and wishlists from their own backend rows', async ({ browser }) => {
  const firstUser = customer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'first@example.com', 'First Customer');
  const secondUser = customer('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'second@example.com', 'Second Customer');
  const first = await createCustomerPage(browser, firstUser, 'First customer cart item', [productId]);
  const second = await createCustomerPage(browser, secondUser, 'Second customer cart item', []);

  try {
    await expect(first.page.getByRole('button', { name: 'Cart', exact: true })).toContainText('1');
    await expect(second.page.getByRole('button', { name: 'Cart', exact: true })).toContainText('1');
    await first.page.getByRole('button', { name: 'Cart', exact: true }).click();
    await expect(first.page.locator('.drawer')).toContainText('First customer cart item');
    await expect(first.page.locator('#shop .heart')).toHaveClass(/on/);
    await expect(first.page.locator('.drawer')).not.toContainText('Second customer cart item');

    await second.page.getByRole('button', { name: 'Cart', exact: true }).click();
    await expect(second.page.locator('.drawer')).toContainText('Second customer cart item');
    await expect(second.page.locator('#shop .heart')).not.toHaveClass(/on/);
    await expect(second.page.locator('.drawer')).not.toContainText('First customer cart item');

    await first.page.locator('.drawer').getByRole('button', { name: 'Close' }).click();
    await first.page.getByRole('button', { name: 'Add to Cart' }).first().click();
    await expect.poll(() => first.getSavedState()).toMatchObject({
      user_id: firstUser.id,
      cart: [{ id: productId, qty: 2 }],
      wishlist: [productId],
    });
  } finally {
    await first.context.close();
    await second.context.close();
  }
});

test('shows the signed-in customer profile from that customer auth record', async ({ page }) => {
  const user = customer('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'profile@example.com', 'Profile Customer');
  await page.route(/\/auth\/v1\/token\?grant_type=password$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'profile-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'profile-refresh-token',
      user: { ...user, user_metadata: { ...user.user_metadata, phone: '9876543210' } },
    }),
  }));
  await page.route(/\/auth\/v1\/user(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ...user, user_metadata: { ...user.user_metadata, phone: '9876543210' } }),
  }));
  await page.route(/\/rest\/v1\/customer_store_state(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user_id: user.id, cart: [], wishlist: [] }),
  }));

  await page.goto('/login');
  const login = page.getByRole('dialog', { name: 'Welcome back' });
  await login.getByLabel('Email').fill(user.email);
  await login.getByLabel('Password').fill('customer-password');
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.goto('/account');
  await page.getByRole('tab', { name: 'Profile' }).click();

  await expect(page.getByLabel('Full name')).toHaveValue('Profile Customer');
  await expect(page.getByLabel('Email')).toHaveValue('profile@example.com');
  await expect(page.getByLabel('Phone number')).toHaveValue('9876543210');
});

test('clears authenticated cart state on logout and restores the guest cart', async ({ page }) => {
  const user = customer('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'logout@example.com', 'Logout Customer');
  await page.addInitScript(({ guestCart, guestWishlist }) => {
    localStorage.setItem('glossedByRidhi-cart', JSON.stringify(guestCart));
    localStorage.setItem('glossedByRidhi-wish', JSON.stringify(guestWishlist));
  }, {
    guestCart: [{ id: productId, name: 'Guest cart item', price: 50, qty: 1 }],
    guestWishlist: [productId],
  });
  await page.route(/\/auth\/v1\/token\?grant_type=password$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'logout-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'logout-refresh-token',
      user,
    }),
  }));
  await page.route(/\/auth\/v1\/user(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(user),
  }));
  await page.route(/\/auth\/v1\/logout(?:\?.*)?$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/rest\/v1\/customer_store_state(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user_id: user.id,
      cart: [{ id: productId, name: 'Account cart item', price: 125, qty: 1 }],
      wishlist: [],
    }),
  }));
  await page.route(/\/rest\/v1\/products(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: productId,
      name: 'Velvet Press-ons',
      description: 'A test product',
      price: 125,
      discount_percent: 0,
      image_url: null,
      stock: 5,
      is_active: true,
    }]),
  }));

  await page.goto('/login');
  const login = page.getByRole('dialog', { name: 'Welcome back' });
  await login.getByLabel('Email').fill(user.email);
  await login.getByLabel('Password').fill('customer-password');
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cart', exact: true })).toContainText('1');
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(page.locator('.drawer')).toContainText('Account cart item');
  await expect(page.locator('.drawer')).not.toContainText('Guest cart item');
  await page.locator('.drawer').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'My account' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Cart', exact: true })).toContainText('1');
  await expect(page.locator('#shop .heart')).toHaveClass(/on/);
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(page.locator('.drawer')).toContainText('Guest cart item');
  await expect(page.locator('.drawer')).not.toContainText('Account cart item');
  await expect(page.locator('#shop .heart')).toHaveClass(/on/);
});
