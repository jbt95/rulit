import { describe, expect, it } from "vitest";
import { Rules } from "../index";
import { z } from "zod";

type Facts = {
  user: {
    age: number;
    tags: string[];
  };
};

type Effects = {
  fired: string[];
};

describe("ruleset engine", () => {
  class UserFacts {
    constructor(
      public age: number,
      public tags: string[],
    ) {}
  }

  class FactsContainer {
    constructor(public user: UserFacts) {}
  }

  it("orders rules by priority and insertion order", () => {
    const rs = Rules.ruleset<Facts, Effects>("order")
      .defaultEffects(() => ({ fired: [] }))
      .rule("low")
      .priority(10)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("low");
      })
      .end()
      .rule("high")
      .priority(100)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("high");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
      activation: "all",
    });

    expect(result.fired).toEqual(["high", "low"]);
    expect(result.effects.fired).toEqual(["high", "low"]);
  });

  it("keeps insertion order for equal priority", () => {
    const rs = Rules.ruleset<Facts, Effects>("stable")
      .defaultEffects(() => ({ fired: [] }))
      .rule("first")
      .priority(10)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("first");
      })
      .end()
      .rule("second")
      .priority(10)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("second");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
    });

    expect(result.fired).toEqual(["first", "second"]);
  });

  it("stops after first match when activation is first", () => {
    const rs = Rules.ruleset<Facts, Effects>("first")
      .defaultEffects(() => ({ fired: [] }))
      .rule("first")
      .priority(50)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("first");
      })
      .end()
      .rule("second")
      .priority(10)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("second");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
      activation: "first",
    });

    expect(result.fired).toEqual(["first"]);
    expect(result.effects.fired).toEqual(["first"]);
  });

  it("captures composed condition traces", () => {
    const factsField = Rules.field<Facts>();
    const isAdult = factsField("user.age").gte(18);
    const isVip = factsField("user.tags").contains("vip");

    const rs = Rules.ruleset<Facts, Effects>("trace")
      .defaultEffects(() => ({ fired: [] }))
      .rule("vip-adult")
      .when(Rules.op.and("vip-adult", isAdult, isVip))
      .then(({ effects, trace }) => {
        effects.fired.push("vip-adult");
        trace.note("trace ok");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 21, tags: ["vip"] } },
    });

    expect(result.fired).toEqual(["vip-adult"]);
    expect(result.trace[0]?.conditions[0]?.children?.length).toBe(2);
    expect(result.trace[0]?.notes).toEqual(["trace ok"]);
  });

  it("short-circuits on the first failed condition", () => {
    let hit = 0;
    const first = Rules.condition<Facts>("first", () => false);
    const second = Rules.condition<Facts>("second", () => {
      hit += 1;
      return true;
    });

    const rs = Rules.ruleset<Facts, Effects>("short-circuit")
      .defaultEffects(() => ({ fired: [] }))
      .rule("rule")
      .when(first, second)
      .then(({ effects }) => {
        effects.fired.push("rule");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
    });

    expect(result.fired).toEqual([]);
    expect(hit).toBe(0);
  });

  it("supports typed field helper for autocomplete", () => {
    const factsField = Rules.field<Facts>();

    const rs = Rules.ruleset<Facts, Effects>("typed-field")
      .defaultEffects(() => ({ fired: [] }))
      .rule("adult")
      .when(factsField("user.age").gte(18))
      .then(({ effects }) => {
        effects.fired.push("adult");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 18, tags: [] } },
    });

    expect(result.fired).toEqual(["adult"]);
  });

  it("provides a ruleset-aware field helper", () => {
    const rs = Rules.ruleset<Facts, Effects>("ruleset-field");
    const factsField = rs.field();

    const result = rs
      .defaultEffects(() => ({ fired: [] }))
      .rule("adult")
      .when(factsField("user.age").gte(18))
      .then(({ effects }) => {
        effects.fired.push("adult");
      })
      .end()
      .compile()
      .run({
        facts: { user: { age: 18, tags: [] } },
      });

    expect(result.fired).toEqual(["adult"]);
  });

  it("exposes a Rules namespace for discoverability", () => {
    const factsField = Rules.field<Facts>();
    const rs = Rules.ruleset<Facts, Effects>("namespace")
      .defaultEffects(() => ({ fired: [] }))
      .rule("adult")
      .when(factsField("user.age").gte(18))
      .then(({ effects }) => {
        effects.fired.push("adult");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 19, tags: [] } },
    });

    expect(result.fired).toEqual(["adult"]);
  });

  it("supports class instances as facts", () => {
    const rs = Rules.ruleset<FactsContainer, Effects>("class-facts")
      .defaultEffects(() => ({ fired: [] }))
      .rule("vip-adult")
      .when(Rules.field<FactsContainer>()("user.age").gte(21))
      .then(({ effects }) => {
        effects.fired.push("vip-adult");
      })
      .end();

    const result = rs.compile().run({
      facts: new FactsContainer(new UserFacts(25, ["vip"])),
    });

    expect(result.fired).toEqual(["vip-adult"]);
  });

  it("throws when compile is called without defaultEffects", () => {
    const rs = Rules.ruleset<Facts, Effects>("missing-defaults");
    const unsafe = rs as unknown as { compile: () => unknown };
    expect(() => unsafe.compile()).toThrow("defaultEffects() is required before compile().");
  });

  it("throws when rule ends without then", () => {
    const rs = Rules.ruleset<Facts, Effects>("missing-then").defaultEffects(() => ({ fired: [] }));
    const builder = rs.rule("invalid").priority(10);
    const unsafe = builder as unknown as { end: () => unknown };
    expect(() => unsafe.end()).toThrow("then() is required before end().");
  });

  it("skips disabled rules and applies tag filters", () => {
    const rs = Rules.ruleset<Facts, Effects>("filters")
      .defaultEffects(() => ({ fired: [] }))
      .rule("disabled")
      .enabled(false)
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("disabled");
      })
      .end()
      .rule("tagged")
      .tags("vip")
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("tagged");
      })
      .end();

    const excluded = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
      includeTags: ["standard"],
    });
    expect(excluded.fired).toEqual([]);

    const included = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
      includeTags: ["vip"],
    });
    expect(included.fired).toEqual(["tagged"]);
  });

  it("supports immutable effects and merge strategies", () => {
    type ComplexEffects = { stats: { count: number }; fired: string[] };
    const rs = Rules.ruleset<Facts, ComplexEffects>("immutable")
      .defaultEffects(() => ({ stats: { count: 0 }, fired: [] }))
      .rule("increment")
      .when(Rules.condition("always", () => true))
      .then(() => ({ stats: { count: 2 } }))
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
      effectsMode: "immutable",
      mergeStrategy: "deep",
    });

    expect(result.effects.stats.count).toBe(2);
  });

  it("runs validation hooks for facts and effects", () => {
    let factsChecked = 0;
    let effectsChecked = 0;

    const rs = Rules.ruleset<Facts, Effects>("validation")
      .defaultEffects(() => ({ fired: [] }))
      .validateFacts((facts) => {
        factsChecked += 1;
        if (!facts.user) {
          throw new Error("missing user");
        }
      })
      .validateEffects((effects) => {
        effectsChecked += 1;
        if (!Array.isArray(effects.fired)) {
          throw new Error("invalid effects");
        }
      })
      .rule("noop")
      .when(Rules.condition("always", () => true))
      .then(() => undefined)
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
    });

    expect(result.fired).toEqual(["noop"]);
    expect(factsChecked).toBe(1);
    expect(effectsChecked).toBe(2);
  });

  it("supports zod validation helpers", () => {
    const factsSchema = z.object({
      user: z.object({
        age: z.number(),
        tags: z.array(z.string()),
      }),
    });

    const effectsSchema = z.object({
      fired: z.array(z.string()),
    });

    const rs = Rules.ruleset<Facts, Effects>("zod")
      .defaultEffects(() => ({ fired: [] }))
      .validateFacts(Rules.zodFacts(factsSchema))
      .validateEffects(Rules.zodEffects(effectsSchema))
      .rule("adult")
      .when(Rules.condition("always", () => true))
      .then(({ effects }) => {
        effects.fired.push("adult");
      })
      .end();

    const result = rs.compile().run({
      facts: { user: { age: 20, tags: [] } },
    });

    expect(result.fired).toEqual(["adult"]);
  });
});
