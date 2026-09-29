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

test('own listing Boost, statistics, paid badge and safe ad placements',async({page})=>{
  let plan='free';
  const listing={id:321,user_id:42,title:'QA own listing',status:'active',category:'Help',location:'Bergen',view_count:7,contact_count:3,favorites_count:2};
  await page.route('**/api/me',route=>route.fulfill({json:{user:{id:42,email:'qa@example.invalid',display_name:'QA',plan,company_name:'QA AS'},listings:[listing],benefits:{plan,ads:plan==='free',limit:plan==='free'?5:plan==='now_plus'?20:100,analytics:plan==='free'?'basic':plan==='now_plus'?'enhanced':'full',boosts_remaining:plan==='free'?0:plan==='now_plus'?1:3,referral_boosts:0}}}));
  await page.route('**/api/me/referrals',route=>route.fulfill({json:{code:'NOWQA',count:0}}));
  await page.route('**/api/me/jobs',route=>route.fulfill({json:{jobs:[]}}));
  await page.route('**/api/me/favorites',route=>route.fulfill({json:{listings:[]}}));
  await page.route('**/api/me/trust',route=>route.fulfill({json:{score:50,completed:0,rating:0,reviews:0}}));
  await page.route('**/api/me/notifications',route=>route.fulfill({json:{unread:0}}));
  await page.route('**/api/me/business/analytics',route=>route.fulfill({json:{analytics:{active_listings:1,views:7,contacts:3,favorites:2}}}));
  await page.addInitScript(()=>localStorage.setItem('nowToken','qa-token'));
  await page.goto('/');
  await page.locator('.nav button').nth(4).click();
  await expect(page.locator('#accountContent')).toContainText('QA own listing');
  await expect(page.locator('#accountContent button').filter({hasText:'Boost'})).toHaveCount(1);
  await expect(page.locator('#accountContent')).toContainText('Views: 7');
  await expect(page.locator('#accountContent')).not.toContainText('Contacts: 3');
  for(const next of ['now_plus','now_business']){
    plan=next;await page.evaluate(()=>loadAccount());
    await expect(page.locator('#accountName')).toContainText(next==='now_plus'?'PLUS':'BUSINESS');
    await expect(page.locator('#accountContent')).toContainText('Contacts: 3');
    await expect(page.locator('#accountContent')).toContainText('Favorites: 2');
    expect(await page.evaluate(()=>{window.NOW_ADS.enabled=true;return window.nowAdsAllowed()})).toBe(false);
  }
  await expect(page.locator('#businessCard')).toBeVisible();
  plan='free';await page.evaluate(()=>loadAccount());
  expect(await page.evaluate(()=>{window.NOW_ADS.enabled=true;return window.nowAdsAllowed()})).toBe(true);
  await page.locator('.nav button').nth(2).click();
  expect(await page.evaluate(()=>window.nowAdsAllowed())).toBe(false);
  await page.locator('.nav button').nth(3).click();
  expect(await page.evaluate(()=>window.nowAdsAllowed())).toBe(false);
});
