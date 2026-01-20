import { Rules } from "../src/index";

export type Facts = {
  user: {
    age: number;
    tags: string[];
    country: string;
    riskScore: number;
    signupDays: number;
    purchases: number;
  };
};

export type Effects = {
  flags: string[];
  decision?: "approve" | "deny";
};

export const eligibilityRuleset = Rules.ruleset<Facts, Effects>("eligibility")
  .defaultEffects(() => ({ flags: [] }))
  .rule("trusted-vip")
  .priority(200)
  .tags("vip", "trusted")
  .reasonCode("TRUSTED_VIP")
  .when(
    Rules.op.and(
      Rules.field<Facts>()("user.tags").contains("vip"),
      Rules.field<Facts>()("user.riskScore").lt(20),
      Rules.field<Facts>()("user.purchases").gte(5),
    ),
  )
  .then(({ effects, trace }) => {
    effects.flags.push("trusted-vip");
    effects.decision = "approve";
    trace.note("Low risk VIP with purchase history.");
  })
  .end()
  .rule("vip-adult")
  .priority(100)
  .tags("vip")
  .reasonCode("VIP_ADULT")
  .when(
    Rules.op.and(
      Rules.field<Facts>()("user.age").gte(18),
      Rules.field<Facts>()("user.tags").contains("vip"),
    ),
  )
  .then(({ effects, trace }) => {
    effects.flags.push("vip-adult");
    effects.decision = "approve";
    trace.note("VIP adult approved.");
  })
  .end()
  .rule("new-user-review")
  .priority(50)
  .tags("review")
  .reasonCode("NEW_USER_REVIEW")
  .when(
    Rules.op.and(
      Rules.field<Facts>()("user.signupDays").lt(7),
      Rules.field<Facts>()("user.purchases").lt(2),
    ),
  )
  .then(({ effects, trace }) => {
    effects.flags.push("new-user-review");
    trace.note("New users require manual review.");
  })
  .end()
  .rule("high-risk")
  .priority(40)
  .tags("risk")
  .reasonCode("HIGH_RISK")
  .when(Rules.field<Facts>()("user.riskScore").gte(70))
  .then(({ effects, trace }) => {
    effects.flags.push("high-risk");
    effects.decision = "deny";
    trace.note("Risk score too high.");
  })
  .end()
  .rule("geo-blocked")
  .priority(30)
  .tags("geo")
  .reasonCode("GEO_BLOCKED")
  .when(Rules.field<Facts>()("user.country").in(["NK", "IR", "SY"]))
  .then(({ effects, trace }) => {
    effects.flags.push("geo-blocked");
    effects.decision = "deny";
    trace.note("Country is blocked.");
  })
  .end()
  .rule("reject-underage")
  .priority(10)
  .reasonCode("UNDERAGE")
  .when(Rules.field<Facts>()("user.age").lt(18))
  .then(({ effects }) => {
    effects.flags.push("underage");
    effects.decision = "deny";
  })
  .end();

export type PricingFacts = {
  cart: {
    total: number;
    items: number;
    coupon?: string;
  };
  customer: {
    tier: "standard" | "vip";
  };
};

export type PricingEffects = {
  discounts: string[];
  finalTotal: number;
};

export const pricingRuleset = Rules.ruleset<PricingFacts, PricingEffects>("pricing")
  .defaultEffects(() => ({ discounts: [], finalTotal: 0 }))
  .rule("vip-discount")
  .priority(100)
  .tags("vip")
  .reasonCode("VIP_DISCOUNT")
  .when(Rules.field<PricingFacts>()("customer.tier").eq("vip"))
  .then(({ facts, effects }) => {
    effects.discounts.push("vip-10");
    effects.finalTotal = Math.max(0, facts.cart.total * 0.9);
  })
  .end()
  .rule("bulk-discount")
  .priority(80)
  .tags("bulk")
  .reasonCode("BULK_DISCOUNT")
  .when(Rules.field<PricingFacts>()("cart.items").gte(10))
  .then(({ facts, effects }) => {
    effects.discounts.push("bulk-5");
    effects.finalTotal = Math.max(0, facts.cart.total * 0.95);
  })
  .end()
  .rule("coupon")
  .priority(60)
  .tags("coupon")
  .reasonCode("COUPON")
  .when(Rules.field<PricingFacts>()("cart.coupon").eq("SAVE10"))
  .then(({ facts, effects }) => {
    effects.discounts.push("coupon-10");
    effects.finalTotal = Math.max(0, facts.cart.total - 10);
  })
  .end();

export type FraudFacts = {
  tx: {
    amount: number;
    country: string;
    velocity: number;
  };
  account: {
    ageDays: number;
    chargebacks: number;
  };
};

export type FraudEffects = {
  flags: string[];
  decision: "allow" | "review" | "block";
};

export const fraudRuleset = Rules.ruleset<FraudFacts, FraudEffects>("fraud")
  .defaultEffects(() => ({ flags: [], decision: "allow" }))
  .rule("velocity-block")
  .priority(200)
  .tags("velocity")
  .reasonCode("VELOCITY_BLOCK")
  .when(Rules.field<FraudFacts>()("tx.velocity").gte(20))
  .then(({ effects }) => {
    effects.flags.push("velocity");
    effects.decision = "block";
  })
  .end()
  .rule("new-account-review")
  .priority(120)
  .tags("review")
  .reasonCode("NEW_ACCOUNT")
  .when(Rules.field<FraudFacts>()("account.ageDays").lt(14))
  .then(({ effects }) => {
    effects.flags.push("new-account");
    effects.decision = "review";
  })
  .end()
  .rule("chargeback-risk")
  .priority(110)
  .tags("risk")
  .reasonCode("CHARGEBACKS")
  .when(Rules.field<FraudFacts>()("account.chargebacks").gte(2))
  .then(({ effects }) => {
    effects.flags.push("chargebacks");
    effects.decision = "review";
  })
  .end()
  .rule("large-amount-review")
  .priority(90)
  .tags("amount")
  .reasonCode("LARGE_AMOUNT")
  .when(Rules.field<FraudFacts>()("tx.amount").gte(1000))
  .then(({ effects }) => {
    effects.flags.push("large-amount");
    effects.decision = "review";
  })
  .end();

const eligibilityEngine = eligibilityRuleset.compile();
eligibilityEngine.run({
  facts: {
    user: {
      age: 28,
      tags: ["vip", "trusted"],
      country: "US",
      riskScore: 12,
      signupDays: 30,
      purchases: 12,
    },
  },
});
eligibilityEngine.run({
  facts: {
    user: {
      age: 16,
      tags: ["new"],
      country: "FR",
      riskScore: 55,
      signupDays: 3,
      purchases: 1,
    },
  },
});

const pricingEngine = pricingRuleset.compile();
pricingEngine.run({
  facts: {
    cart: { total: 220, items: 11, coupon: "SAVE10" },
    customer: { tier: "vip" },
  },
});
pricingEngine.run({
  facts: {
    cart: { total: 80, items: 2 },
    customer: { tier: "standard" },
  },
});

const fraudEngine = fraudRuleset.compile();
fraudEngine.run({
  facts: {
    tx: { amount: 2200, country: "US", velocity: 12 },
    account: { ageDays: 4, chargebacks: 0 },
  },
});
fraudEngine.run({
  facts: {
    tx: { amount: 300, country: "GB", velocity: 25 },
    account: { ageDays: 180, chargebacks: 3 },
  },
});
