import { describe, expect, it, beforeEach } from "vitest";
import { Rules } from "../index";
import { buildHtml } from "../cli/ui";

type Facts = { user: { age: number } };
type Effects = { flags: string[] };

describe("cli ui", () => {
  beforeEach(() => {
    Rules.registry.clear();
  });

  it("renders mermaid blocks for registered rulesets", () => {
    const rs = Rules.ruleset<Facts, Effects>("cli-test").defaultEffects(() => ({ flags: [] }));
    rs.rule("adult")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .then(({ effects }) => {
        effects.flags.push("adult");
      })
      .end();

    const html = buildHtml();
    expect(html).toContain("mermaid");
    expect(html).toContain("cli-test");
    expect(html).toContain("JSON graph");
  });
});
