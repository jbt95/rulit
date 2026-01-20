import { describe, expect, it } from "vitest";
import { Rules } from "../index";

type Facts = { user: { age: number; tags: string[] } };
type Effects = { flags: string[] };

describe("visualization", () => {
  it("exports a graph with condition nodes", () => {
    const rs = Rules.ruleset<Facts, Effects>("viz")
      .defaultEffects(() => ({ flags: [] }))
      .rule("vip-adult")
      .when(
        Rules.op.and(
          Rules.field<Facts>()("user.age").gte(18),
          Rules.field<Facts>()("user.tags").contains("vip"),
        ),
      )
      .then(({ effects }) => {
        effects.flags.push("vip-adult");
      })
      .end();

    const graph = rs.graph();
    const conditionNodes = graph.nodes.filter((node) => node.type === "condition");

    expect(conditionNodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("exports mermaid output", () => {
    const rs = Rules.ruleset<Facts, Effects>("viz")
      .defaultEffects(() => ({ flags: [] }))
      .rule("adult")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .then(({ effects }) => {
        effects.flags.push("adult");
      })
      .end();

    const mermaid = rs.toMermaid();
    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("Rule: adult");
    expect(mermaid).toContain("Condition:");
  });
});
