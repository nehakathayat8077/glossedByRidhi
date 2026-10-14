import { expect, test } from '@playwright/test';

const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const serviceId = '10000000-0000-4000-8000-000000000001';
const customer = {
  id: customerId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'customer@example.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Ridhi Sharma' },
  created_at: '2026-01-01T00:00:00.000Z',
};

async function mockCatalogAndAvailability(page) {
  await page.route(/\/rest\/v1\/services(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: serviceId,
      name: 'Classic Manicure',
      description: 'Classic service',
      price: 499,
      duration_minutes: 30,
      image_url: null,
    }]),
  }));
  await page.route(/\/rest\/v1\/designs(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route(/\/rest\/v1\/business_settings(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      working_start: '10:00:00',
      working_end: '17:00:00',
      slot_duration_minutes: 30,
      off_days: [],
    }),
  }));
  await page.route(/\/rest\/v1\/rpc\/get_booked_slots(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
}

async function signInCustomer(page) {
  await page.route(/\/auth\/v1\/token\?grant_type=password$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      user: customer,
    }),
  }));
  await page.goto('/login');
  const dialog = page.getByRole('dialog', { name: 'Welcome back' });
  await dialog.getByLabel('Email').fill(customer.email);
  await dialog.getByLabel('Password').fill('customer-password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function completeBookingForm(page) {
  await page.getByLabel('Name').last().fill('Ridhi Sharma');
  await page.getByLabel('Phone').last().fill('9876543210');
  await page.getByLabel('Email').last().fill('ridhi@example.com');
  await page.getByLabel('Preferred date').fill('2027-01-15');
  await page.getByLabel('Preferred time').selectOption('11:00');
  await page.getByLabel('Service').selectOption(serviceId);
}

test('public booking submits without claiming a customer owner', async ({ page }) => {
  await mockCatalogAndAvailability(page);
  let submittedAppointment;
  await page.route(/\/rest\/v1\/appointments(?:\?.*)?$/, async (route) => {
    const payload = route.request().postDataJSON();
    submittedAppointment = Array.isArray(payload) ? payload[0] : payload;
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/');
  await completeBookingForm(page);
  await page.getByRole('button', { name: 'Book My Appointment' }).click();

  await expect(page.getByRole('heading', { name: 'Your appointment request has been received' })).toBeVisible();
  expect(submittedAppointment).toMatchObject({
    name: 'Ridhi Sharma',
    service_id: serviceId,
  });
  expect(submittedAppointment).not.toHaveProperty('user_id');
});

test('authenticated booking leaves ownership assignment to the database', async ({ page }) => {
  await mockCatalogAndAvailability(page);
  let submittedAppointment;
  await page.route(/\/rest\/v1\/appointments(?:\?.*)?$/, async (route) => {
    const payload = route.request().postDataJSON();
    submittedAppointment = Array.isArray(payload) ? payload[0] : payload;
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });

  await signInCustomer(page);
  await page.goto('/');
  await completeBookingForm(page);
  await page.getByRole('button', { name: 'Book My Appointment' }).click();

  await expect(page.getByRole('heading', { name: 'Your appointment request has been received' })).toBeVisible();
  expect(submittedAppointment).not.toHaveProperty('user_id');
});

test('customer dashboard filters appointment history by the authenticated user', async ({ page }) => {
  await signInCustomer(page);
  let appointmentRequestUrl;
  await page.route(/\/rest\/v1\/appointments(?:\?.*)?$/, async (route) => {
    appointmentRequestUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route(/\/rest\/v1\/orders(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Welcome back, Ridhi' })).toBeVisible();
  await expect.poll(() => appointmentRequestUrl).toContain(`user_id=eq.${customerId}`);
});
