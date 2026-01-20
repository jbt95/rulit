import { describe, expect, it } from "vitest";
import { Rules } from "../index";

type Facts = { user: { age: number } };
type Effects = { flags: string[] };

describe("telemetry adapter", () => {
  it("emits spans for run, rule, and condition", () => {
    const spans: { name: string; attrs?: Record<string, unknown>; ended: boolean }[] = [];
    const adapter: Rules.TelemetryAdapter = {
      startSpan: (name, attributes) => {
        const span = { name, attrs: attributes, ended: false };
        spans.push(span);
        return {
          end: () => {
            span.ended = true;
          },
          recordException: () => undefined,
        };
      },
    };

    const rs = Rules.ruleset<Facts, Effects>("telemetry")
      .defaultEffects(() => ({ flags: [] }))
      .telemetry(adapter)
      .rule("adult")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .then(({ effects }) => {
        effects.flags.push("adult");
      })
      .end();

    rs.compile().run({ facts: { user: { age: 20 } } });

    const names = spans.map((span) => span.name);
    expect(names).toContain("rulit.run");
    expect(names).toContain("rulit.rule");
    expect(names).toContain("rulit.condition");
    expect(spans.every((span) => span.ended)).toBe(true);
  });
});
