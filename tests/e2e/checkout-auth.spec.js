import { expect, test } from '@playwright/test';

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
