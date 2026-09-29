const { test, expect } = require('@playwright/test');

test('five primary screens remain usable at the device viewport', async ({ page }) => {
  await page.goto('/');
  const ids = ['home', 'explore', 'create', 'chat', 'you'];
  const nav = page.locator('.nav button');
  for (let i = 0; i < ids.length; i++) {
    await nav.nth(i).click();
    await expect(page.locator('#' + ids[i])).toHaveClass(/active/);
    await expect(nav.nth(i)).toHaveClass(/active/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, ids[i] + ' horizontal overflow').toBeLessThanOrEqual(2);
  }
  await expect(page.locator('#authBox')).toBeVisible();
  await expect(page.locator('#authEmail')).toBeVisible();
  await expect(page.locator('#authPassword')).toBeVisible();
});

test('public legal and deletion pages identify the publisher and support contact', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/support', '/delete-account']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main')).toContainText('aloe.vera225@yahoo.com');
  }
  await page.goto('/privacy');
  await expect(page.locator('main')).toContainText('Valentyn Shemeiko');
});
