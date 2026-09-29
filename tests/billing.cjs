const test = require('node:test');
const assert = require('node:assert/strict');
const { planFromSubscriber, boostPurchases, fetchSubscriber } = require('../billing');
const {planFeatures, boostRemaining} = require('../monetization');

const entitlement = (product, expires) => ({product_identifier:product,expires_date:expires});

test('store status expires and refunded plans never grant access', () => {
  const now = Date.parse('2026-09-29T00:00:00Z');
  const subscriptions = {
    now_plus_monthly: { expires_date: '2026-10-01T00:00:00Z' },
    now_business_monthly: { expires_date: '2026-09-28T00:00:00Z' }
  };
  const entitlements={now_plus:entitlement('now_plus_monthly','2026-10-01T00:00:00Z'),now_business:entitlement('now_business_monthly','2026-09-28T00:00:00Z')};
  assert.equal(planFromSubscriber({ subscriptions,entitlements }, now).plan, 'now_plus');
  subscriptions.now_business_monthly.expires_date = '2026-10-02T00:00:00Z';
  entitlements.now_business.expires_date='2026-10-02T00:00:00Z';
  assert.equal(planFromSubscriber({ subscriptions,entitlements }, now).plan, 'now_business');
  subscriptions.now_business_monthly.refunded_at = '2026-09-29T00:00:00Z';
  subscriptions.now_plus_monthly.expires_date = '2026-09-28T00:00:00Z';
  assert.equal(planFromSubscriber({ subscriptions,entitlements }, now).plan, 'free');
  assert.equal(planFromSubscriber({subscriptions},now).plan,'free','unconfigured entitlement grants nothing');
});

test('paid renewal identifies a new monthly allowance, repeated sync is idempotent',()=>{
  const subscriptions={now_plus_monthly:{purchase_date:'2026-09-01T10:00:00Z',expires_date:'2026-10-01T10:00:00Z',period_type:'normal',store:'app_store'}};
  const entitlements={now_plus:entitlement('now_plus_monthly',subscriptions.now_plus_monthly.expires_date)};
  const now=Date.parse('2026-09-29T00:00:00Z');
  const september=planFromSubscriber({subscriptions,entitlements},now);
  assert.equal(september.periodKey,'now_plus_monthly:2026-09-01T10:00:00.000Z');
  assert.deepEqual(planFromSubscriber({subscriptions,entitlements},now),september);
  assert.equal(boostRemaining({plan:september.plan,plan_expires_at:september.expiresAt,paid_period_key:september.periodKey},1,now),0);
  subscriptions.now_plus_monthly.purchase_date='2026-10-01T10:00:00Z';
  subscriptions.now_plus_monthly.expires_date='2026-11-01T10:00:00Z';
  entitlements.now_plus.expires_date=subscriptions.now_plus_monthly.expires_date;
  const october=planFromSubscriber({subscriptions,entitlements},Date.parse('2026-10-02T00:00:00Z'));
  assert.notEqual(october.periodKey,september.periodKey);
  assert.equal(boostRemaining({plan:october.plan,plan_expires_at:october.expiresAt,paid_period_key:october.periodKey},0,Date.parse('2026-10-02T00:00:00Z')),1);
  subscriptions.now_plus_monthly.unsubscribe_detected_at='2026-10-02T01:00:00Z';
  assert.equal(planFromSubscriber({subscriptions,entitlements},Date.parse('2026-10-03T00:00:00Z')).plan,'now_plus','cancellation keeps benefits until expiry');
  assert.equal(planFromSubscriber({subscriptions,entitlements},Date.parse('2026-11-02T00:00:00Z')).plan,'free');
});

test('trial, promotional and grace periods do not mint unpaid renewal Boosts',()=>{
  const now=Date.parse('2026-09-29T00:00:00Z');
  const sub={expires_date:'2026-09-28T00:00:00Z',grace_period_expires_date:'2026-10-01T00:00:00Z',purchase_date:'2026-09-01T00:00:00Z',period_type:'trial',store:'app_store'};
  const e={now_plus:entitlement('now_plus_monthly','2026-10-01T00:00:00Z')};
  const state=planFromSubscriber({subscriptions:{now_plus_monthly:sub},entitlements:e},now);
  assert.equal(state.plan,'now_plus');assert.equal(state.periodKey,null);
  sub.period_type='normal';
  assert.ok(planFromSubscriber({subscriptions:{now_plus_monthly:sub},entitlements:e},now).periodKey);
  sub.store='promotional';
  assert.equal(planFromSubscriber({subscriptions:{now_plus_monthly:sub},entitlements:e},now).periodKey,null);
});

test('all approved caps, ads and included Boosts are enforced by active term',()=>{
  const now=Date.parse('2026-09-29T00:00:00Z');
  assert.deepEqual(planFeatures({plan:'free'},now),{plan:'free',limit:5,includedBoosts:0,ads:true,analytics:'basic'});
  assert.equal(planFeatures({plan:'now_plus',plan_expires_at:'2026-10-01T00:00:00Z'},now).limit,20);
  const business={plan:'now_business',plan_expires_at:'2026-10-01T00:00:00Z',paid_period_key:'business:period'};
  assert.equal(planFeatures(business,now).limit,100);
  assert.equal(planFeatures(business,now).ads,false);
  assert.equal(boostRemaining(business,2,now),1);
  assert.equal(boostRemaining(business,3,now),0);
  assert.equal(boostRemaining({...business,plan_expires_at:'2026-09-28T00:00:00Z'},0,now),0);
  assert.equal(planFeatures({...business,plan_expires_at:'2026-09-28T00:00:00Z'},now).plan,'free');
});

test('boost transactions require a stable store purchase id', () => {
  const purchases = boostPurchases({ non_subscriptions: { listing_boost: [
    { id: 'a', purchase_date: '2026-09-28T00:00:00Z' },
    { id: '', purchase_date: '2026-09-30T00:00:00Z' },
    { id: 'b', purchase_date: '2026-09-29T00:00:00Z' },
    { id: 'refunded',purchase_date:'2026-09-29T00:00:00Z',refunded_at:'2026-09-29T00:00:00Z' }
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
