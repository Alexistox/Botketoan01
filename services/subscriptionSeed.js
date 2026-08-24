const SubscriptionPlan = require('../models/SubscriptionPlan');

const DEFAULT_PLANS = [
  { planId: 'day', nameVi: 'Ngày', nameZh: '日卡', durationDays: 1, priceUsdt: 2 },
  { planId: 'month', nameVi: 'Tháng', nameZh: '月卡', durationDays: 30, priceUsdt: 30 },
  { planId: 'year', nameVi: 'Năm', nameZh: '年卡', durationDays: 365, priceUsdt: 300 }
];

async function seedSubscriptionPlans() {
  for (const plan of DEFAULT_PLANS) {
    await SubscriptionPlan.findOneAndUpdate(
      { planId: plan.planId },
      {
        $setOnInsert: plan,
        $set: { nameZh: plan.nameZh, nameVi: plan.nameVi }
      },
      { upsert: true, new: true }
    );
  }
}

module.exports = { seedSubscriptionPlans, DEFAULT_PLANS };
