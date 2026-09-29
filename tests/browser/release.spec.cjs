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

test('Boost stays above urgent and subscribed listings; paid accounts never receive ads', async ({ page }) => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const listings = [
    { id: 1, title: 'Free listing', category: 'Help', placement_tier: 2 },
    { id: 2, title: 'Business listing', category: 'Help', placement_tier: 0 },
    { id: 3, title: 'Urgent listing', category: 'Help', urgent: true, placement_tier: 2 },
    { id: 4, title: 'Boost listing', category: 'Help', boosted_until: future, placement_tier: 2 },
    { id: 5, title: 'Plus listing', category: 'Help', placement_tier: 1 },
  ];
  await page.route('**/api/search?**', route => route.fulfill({ json: { listings, sources: {} } }));
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem('nowLocationEnabled', '0');
    window.NOW_OPPORTUNITIES = [];
    await showResults('Help');
  });
  await expect(page.locator('#resultsList .opportunity .title')).toHaveText([
    'Boost listing', 'Urgent listing', 'Business listing', 'Plus listing', 'Free listing'
  ]);
  const adStates = await page.evaluate(() => {
    window.NOW_ADS.enabled = true;
    localStorage.setItem('nowToken', 'subscriber');
    window.applyNowPlan({ plan: 'now_plus' }, 'subscriber');
    const plus = window.nowAdsAllowed();
    window.applyNowPlan({ plan: 'now_business' }, 'subscriber');
    const business = window.nowAdsAllowed();
    localStorage.setItem('nowToken', 'new-account');
    const pendingVerification = window.nowAdsAllowed();
    window.applyNowPlan({ plan: 'free' }, 'new-account');
    const free = window.nowAdsAllowed();
    return { plus, business, pendingVerification, free };
  });
  expect(adStates).toEqual({ plus: false, business: false, pendingVerification: false, free: true });
});
