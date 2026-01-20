import { describe, expect, it } from "vitest";
import { Rules } from "../index";

type Facts = { flag: boolean };
type Effects = { notes: string[] };

describe("trace explain", () => {
  it("renders rule and condition status", () => {
    const rs = Rules.ruleset<Facts, Effects>("trace")
      .defaultEffects(() => ({ notes: [] }))
      .rule("flagged")
      .tags("audit")
      .reasonCode("RULE_FLAG")
      .when(
        Rules.op.and(
          "flag group",
          Rules.condition("flag is true", (facts) => facts.flag, {
            details: () => ({
              left: "flag",
              op: "==",
              right: "true",
            }),
            reasonCode: "COND_FLAG",
          }),
        ),
      )
      .then(({ trace }) => {
        trace.note("flag hit");
      })
      .end();

    const result = rs.compile().run({ facts: { flag: true } });
    const output = result.explain();

    expect(output).toContain("Ruleset trace");
    expect(output).toContain("Rule flagged: matched");
    expect(output).toContain("tags: audit");
    expect(output).toContain("reason: RULE_FLAG");
    expect(output).toContain("flag is true");
    expect(output).toContain("note: flag hit");
    expect(output).toContain("reason: COND_FLAG");
    expect(output).toContain('"flag" == "true"');
  });
});
