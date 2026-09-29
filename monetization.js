const PLANS = Object.freeze({
  free: Object.freeze({ limit: 5, includedBoosts: 0, ads: true, analytics: 'basic' }),
  now_plus: Object.freeze({ limit: 20, includedBoosts: 1, ads: false, analytics: 'enhanced' }),
  now_business: Object.freeze({ limit: 100, includedBoosts: 3, ads: false, analytics: 'full' })
});

function effectivePlan(user, now = Date.now()) {
  const expires = Date.parse(user?.plan_expires_at || '');
  return (user?.plan === 'now_plus' || user?.plan === 'now_business') && expires > now ? user.plan : 'free';
}

function planFeatures(user, now = Date.now()) {
  const plan = effectivePlan(user, now);
  return { plan, ...PLANS[plan] };
}

function boostRemaining(user, spent = 0, now = Date.now()) {
  const features = planFeatures(user, now);
  return user?.paid_period_key ? Math.max(0, features.includedBoosts - spent) : 0;
}

module.exports = { PLANS, effectivePlan, planFeatures, boostRemaining };
