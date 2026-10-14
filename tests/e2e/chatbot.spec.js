import { expect, test } from '@playwright/test';

test('chatbot sends recent conversation history for follow-up questions', async ({ page }) => {
  const requests = [];
  const replies = [
    'Three ideas: glazed French tips, rose chrome, and sculpted floral accents.',
    'The rose chrome design has a soft pink base with a reflective, pearlescent finish.',
  ];

  await page.route('**/functions/v1/glossedbyridhi-chat', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: replies[requests.length - 1] }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Chat with GlossedByRidhi' }).click();
  const composer = page.getByRole('textbox', { name: 'Write your message' });

  await composer.fill('Suggest 3 nail designs');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(replies[0])).toBeVisible();

  await composer.fill('Tell me more about the second one.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(replies[1])).toBeVisible();

  expect(requests).toEqual([
    { message: 'Suggest 3 nail designs', history: [] },
    {
      message: 'Tell me more about the second one.',
      history: [
        { role: 'user', content: 'Suggest 3 nail designs' },
        { role: 'assistant', content: replies[0] },
      ],
    },
  ]);
});
