import { expect, test } from '@playwright/test';

test('appointment form accepts complete text and retains its draft across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name').first().fill('Ridhi Sharma');
  await page.getByLabel('Phone').first().fill('9876543210');
  await page.getByLabel('Email').fill('ridhi@example.com');
  await page.getByLabel('Preferred date').fill('2027-01-15');
  await page.getByLabel('Preferred time').fill('11:30');
  await page.getByLabel('Special request').fill('Please use a soft pink chrome finish.');
  await expect.poll(() => page.evaluate(() => {
    const saved = sessionStorage.getItem('glossedByRidhi-booking-draft');
    return saved ? JSON.parse(saved).name : null;
  })).toBe('Ridhi Sharma');

  await page.reload();

  await expect(page.getByLabel('Name').first()).toHaveValue('Ridhi Sharma');
  await expect(page.getByLabel('Phone').first()).toHaveValue('9876543210');
  await expect(page.getByLabel('Email')).toHaveValue('ridhi@example.com');
  await expect(page.getByLabel('Preferred date')).toHaveValue('2027-01-15');
  await expect(page.getByLabel('Preferred time')).toHaveValue('11:30');
  await expect(page.getByLabel('Special request')).toHaveValue('Please use a soft pink chrome finish.');
});
