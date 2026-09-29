const test = require('node:test');
const assert = require('node:assert/strict');

const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const get = path => fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });

test('public app and health respond', async () => {
  const [home, health] = await Promise.all([get('/'), get('/health')]);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(await home.text(), /id="home"/);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
});

test('public data and release configuration have expected shapes', async () => {
  for (const [path, key] of [
    ['/app-config', 'products'],
    ['/api/sources?country=NO', 'sources'],
    ['/api/listings', 'listings'],
    ['/api/search?country=NO&category=Help', 'listings'],
    ['/api/plans', 'plans'],
    ['/api/ads/config', 'enabled'],
    ['/api/connectors?country=NO', 'connectors'],
    ['/api/community/messages', 'messages'],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    const body = await response.json();
    assert.ok(Object.hasOwn(body, key), path + ': missing ' + key);
  }
});

test('NOW 1.0 product IDs, prices and allowances stay fixed',async()=>{
  const plans=await (await get('/api/plans?country=NO')).json();
  assert.equal(plans.plans.free.active_listing_limit,5);
  assert.deepEqual([plans.plans.plus.price,plans.plans.plus.active_listing_limit,plans.plans.plus.included_boosts_per_paid_month],[59,20,1]);
  assert.deepEqual([plans.plans.business.price,plans.plans.business.active_listing_limit,plans.plans.business.included_boosts_per_paid_month],[130,100,3]);
  assert.deepEqual([plans.plans.boost.price,plans.plans.boost.duration_hours,plans.plans.boost.consumable],[19,72,true]);
  assert.equal(plans.plans.plus.entitlement,'now_plus');
  assert.equal(plans.plans.business.entitlement,'now_business');
  const config=await (await get('/app-config')).json();
  assert.deepEqual(config.products,{plus:'now_plus_monthly',business:'now_business_monthly',boost:'listing_boost'});
  const ads=await (await get('/api/ads/config')).json();
  assert.deepEqual(ads.hideForPlans,['now_plus','now_business']);
  assert.ok(ads.rules.excludedScreens.includes('chat'));
  assert.ok(ads.rules.excludedScreens.includes('create'));
});

test('legal pages respond and private files stay private', async () => {
  for (const path of ['/privacy', '/terms', '/support', '/delete-account']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /text\/html/);
  }
  const privacy = await (await get('/privacy')).text();
  assert.match(privacy, /aloe\.vera225@yahoo\.com/);
  assert.match(privacy, /Valentyn Shemeiko/);
  assert.doesNotMatch(privacy, /will be finalized before public store submission|pre-release version/);
  for (const path of ['/server.js', '/billing.js', '/package.json', '/.env']) {
    assert.equal((await get(path)).status, 404, path);
  }
});

test('unauthenticated account access and deletion are rejected', async () => {
  assert.equal((await get('/api/me')).status, 401);
  const response = await fetch(new URL('/api/me/account', base), {
    method: 'DELETE', signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 401);
});

test('Norway job search excludes Germany-only Arbeitnow listings', async () => {
  const response = await get('/api/search?country=NO&category=Earn');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.listings));
  assert.equal(body.listings.filter(item => item.source === 'Arbeitnow').length, 0);
  for (const item of body.listings.filter(item => item.source === 'Jobicy')) {
    assert.match(String(item.location).toLowerCase(), /norway|norge|europe|emea|anywhere|worldwide|global/);
  }
});
