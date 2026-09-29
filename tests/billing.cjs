const test = require('node:test');
const assert = require('node:assert/strict');
const { planFromSubscriber, boostPurchases, fetchSubscriber } = require('../billing');

test('store status expires and refunded plans never grant access', () => {
  const now = Date.parse('2026-09-29T00:00:00Z');
  const subscriptions = {
    now_plus_monthly: { expires_date: '2026-10-01T00:00:00Z' },
    now_business_monthly: { expires_date: '2026-09-28T00:00:00Z' }
  };
  assert.equal(planFromSubscriber({ subscriptions }, now).plan, 'now_plus');
  subscriptions.now_business_monthly.expires_date = '2026-10-02T00:00:00Z';
  assert.equal(planFromSubscriber({ subscriptions }, now).plan, 'now_business');
  subscriptions.now_business_monthly.refunded_at = '2026-09-29T00:00:00Z';
  subscriptions.now_plus_monthly.expires_date = '2026-09-28T00:00:00Z';
  assert.equal(planFromSubscriber({ subscriptions }, now).plan, 'free');
});

test('boost transactions require a stable store purchase id', () => {
  const purchases = boostPurchases({ non_subscriptions: { listing_boost: [
    { id: 'a', purchase_date: '2026-09-28T00:00:00Z' },
    { id: '', purchase_date: '2026-09-30T00:00:00Z' },
    { id: 'b', purchase_date: '2026-09-29T00:00:00Z' }
  ] } });
  assert.deepEqual(purchases.map(p => p.id), ['b', 'a']);
});

test('server verification uses its secret key and a fixed user id', async () => {
  const subscriber = await fetchSubscriber(42, 'server-key', async (url, options) => {
    assert.equal(url, 'https://api.revenuecat.com/v1/subscribers/now-user-42');
    assert.equal(options.headers.Authorization, 'Bearer server-key');
    return { ok: true, json: async () => ({ subscriber: { subscriptions: {} } }) };
  });
  assert.deepEqual(subscriber, { subscriptions: {} });
});
