import { condition as conditionFn } from "./condition";
import { field as fieldFn } from "./field";
import { op as opObj } from "./op";
import { ruleset as rulesetFn } from "./ruleset";
import { zodEffects as zodEffectsFn, zodFacts as zodFactsFn } from "./zod";
import { registry as registryObj } from "./registry";
import { createOtelAdapter } from "./otel";

export namespace Rules {
  /**
   * Create a new ruleset builder.
   *
   * @example
   * ```ts
   * const rs = Rules.ruleset<Facts, Effects>("eligibility");
   * ```
   */
  export const ruleset = rulesetFn;
  /**
   * Create a condition with optional trace details and a reason code.
   *
   * @example
   * ```ts
   * const isAdult = Rules.condition("is adult", (facts: Facts) => facts.user.age >= 18);
   * ```
   */
  export const condition = conditionFn;
  /**
   * Create a typed field accessor for a facts model.
   *
   * @example
   * ```ts
   * const factsField = Rules.field<Facts>();
   * const isAdult = factsField("user.age").gte(18);
   * ```
   */
  export const field = fieldFn;
  /**
   * Boolean and extensibility operators for composing conditions.
   *
   * @example
   * ```ts
   * const combined = Rules.op.and(isAdult, isVip);
   * ```
   */
  export const op = opObj;
  /**
   * In-memory registry of rulesets created in this process.
   */
  export const registry = registryObj;
  /**
   * Create a facts validator using a Zod schema.
   *
   * @example
   * ```ts
   * const factsSchema = z.object({ user: z.object({ age: z.number() }) });
   * Rules.ruleset<Facts, Effects>("rs").validateFacts(Rules.zodFacts(factsSchema));
   * ```
   */
  export const zodFacts = zodFactsFn;
  /**
   * Create an effects validator using a Zod schema.
   *
   * @example
   * ```ts
   * const effectsSchema = z.object({ flags: z.array(z.string()) });
   * Rules.ruleset<Facts, Effects>("rs").validateEffects(Rules.zodEffects(effectsSchema));
   * ```
   */
  export const zodEffects = zodEffectsFn;
  /**
   * OpenTelemetry helpers (opt-in).
   */
  export const otel = {
    createAdapter: createOtelAdapter,
  };
  export type ActionContext<Facts, Effects> = import("./types").ActionContext<Facts, Effects>;
  export type Condition<Facts> = import("./types").Condition<Facts>;
  export type ConditionMeta<Facts> = import("./types").ConditionMeta<Facts>;
  export type ConditionTrace = import("./types").ConditionTrace;
  export type EffectsMode = import("./types").EffectsMode;
  export type MergeStrategy = import("./types").MergeStrategy;
  export type RuleActivation = import("./types").RuleActivation;
  export type RuleMeta = import("./types").RuleMeta;
  export type RulesetGraph = import("./types").RulesetGraph;
  export type GraphNode = import("./types").GraphNode;
  export type GraphEdge = import("./types").GraphEdge;
  export type RuleTrace = import("./types").RuleTrace;
  export type RunOptions = import("./types").RunOptions;
  export type RunResult<Effects> = import("./types").RunResult<Effects>;
  export type TraceRun = import("./types").TraceRun;
  export type TelemetryAdapter = import("./types").TelemetryAdapter;
  export type TelemetryAttributes = import("./types").TelemetryAttributes;
  export type Field<T, P extends import("./field").Path<T>> = import("./field").Field<T, P>;
  export type Path<T> = import("./field").Path<T>;
  export type PathValue<T, P extends import("./field").Path<T>> = import("./field").PathValue<T, P>;
}
