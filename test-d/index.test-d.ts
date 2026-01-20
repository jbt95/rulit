import { expectError, expectType } from "tsd";
import { Rules } from "../dist/index";

type Facts = {
  user: {
    age: number;
    tags: string[];
  };
};

type Effects = {
  fired: string[];
};

const rs = Rules.ruleset<Facts, Effects>("type-tests");
expectError(rs.compile());

const ready = rs.defaultEffects(() => ({ fired: [] }));
const factsField = ready.field();
expectType<Rules.Condition<Facts>>(factsField("user.age").gte(18));
expectError(factsField("user.missing"));

const invalidRule = ready.rule("invalid");
expectError(invalidRule.end());

const validRule = ready.rule("valid").then(({ effects }) => {
  effects.fired.push("ok");
});
expectType<typeof ready>(validRule.end());

const asyncRule = ready.rule("async").thenAsync(async ({ effects }) => {
  effects.fired.push("async");
});
expectType<typeof ready>(asyncRule.end());

const engine = ready.compile();
expectType<Promise<Rules.RunResult<Effects>>>(engine.runAsync({ facts: { user: { age: 30, tags: [] } } }));
