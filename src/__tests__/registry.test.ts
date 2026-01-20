import { describe, expect, it, beforeEach } from "vitest";
import { Rules } from "../index";

type Facts = { user: { age: number } };
type Effects = { flags: string[] };

describe("registry", () => {
  beforeEach(() => {
    Rules.registry.clear();
  });

  it("stores created rulesets", () => {
    const rs = Rules.ruleset<Facts, Effects>("registry-test").defaultEffects(() => ({ flags: [] }));
    rs.rule("adult")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .then(({ effects }) => {
        effects.flags.push("adult");
      })
      .end();

    const list = Rules.registry.list();
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("registry-test");
  });

  it("exports graphs by name", () => {
    const rs = Rules.ruleset<Facts, Effects>("registry-graph").defaultEffects(() => ({
      flags: [],
    }));
    rs.rule("adult")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .then(({ effects }) => {
        effects.flags.push("adult");
      })
      .end();

    const graph = Rules.registry.getGraph("registry-graph");
    expect(graph?.nodes.length).toBeGreaterThan(0);
    expect(graph?.edges.length).toBeGreaterThan(0);
  });

  it("records traces from engine runs", () => {
    const rs = Rules.ruleset<Facts, Effects>("registry-trace").defaultEffects(() => ({
      flags: [],
    }));
    rs.rule("adult")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .then(({ effects }) => {
        effects.flags.push("adult");
      })
      .end();

    const engine = rs.compile();
    engine.run({ facts: { user: { age: 20 } } });

    const traces = Rules.registry.listTraces("registry-trace");
    expect(traces.length).toBe(1);
    expect(traces[0]?.trace[0]?.ruleId).toBe("adult");
  });
});
