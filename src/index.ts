import { condition as conditionFn } from "./condition";
import { field as fieldFn } from "./field";
import { op as opObj } from "./op";
import { ruleset as rulesetFn } from "./ruleset";
import { zodEffects as zodEffectsFn, zodFacts as zodFactsFn } from "./zod";
import { registry as registryObj } from "./registry";
import { createOtelAdapter } from "./otel";

export const Rules = {
  ruleset: rulesetFn,
  condition: conditionFn,
  field: fieldFn,
  op: opObj,
  registry: registryObj,
  zodFacts: zodFactsFn,
  zodEffects: zodEffectsFn,
  otel: {
    createAdapter: createOtelAdapter,
  },
};

export {
  rulesetFn as ruleset,
  conditionFn as condition,
  fieldFn as field,
  opObj as op,
  registryObj as registry,
  zodFactsFn as zodFacts,
  zodEffectsFn as zodEffects,
};
export { createOtelAdapter } from "./otel";

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
