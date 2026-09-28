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

test('legal pages respond and private files stay private', async () => {
  for (const path of ['/privacy', '/terms']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /text\/html/);
  }
  for (const path of ['/server.js', '/package.json', '/.env']) {
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
});
