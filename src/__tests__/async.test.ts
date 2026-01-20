import { describe, expect, it } from "vitest";
import { Rules } from "../index";

type Facts = { user: { age: number } };
type Effects = { flags: string[] };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("async effects", () => {
  it("runs async actions in deterministic order", async () => {
    const rs = Rules.ruleset<Facts, Effects>("async")
      .defaultEffects(() => ({ flags: [] }))
      .rule("first")
      .priority(20)
      .when(Rules.field<Facts>()("user.age").gte(18))
      .thenAsync(async ({ effects }) => {
        await delay(5);
        effects.flags.push("first");
      })
      .end()
      .rule("second")
      .priority(10)
      .when(Rules.field<Facts>()("user.age").gte(18))
      .thenAsync(async ({ effects }) => {
        await delay(1);
        effects.flags.push("second");
      })
      .end();

    const result = await rs.compile().runAsync({ facts: { user: { age: 21 } } });
    expect(result.effects.flags).toEqual(["first", "second"]);
  });

  it("throws when running async action via run()", () => {
    const rs = Rules.ruleset<Facts, Effects>("async-sync")
      .defaultEffects(() => ({ flags: [] }))
      .rule("first")
      .when(Rules.field<Facts>()("user.age").gte(18))
      .thenAsync(async ({ effects }) => {
        effects.flags.push("first");
      })
      .end();

    expect(() => rs.compile().run({ facts: { user: { age: 22 } } })).toThrow(
      "Async rule action detected. Use runAsync().",
    );
  });
});
