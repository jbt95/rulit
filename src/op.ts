import { condition } from "./condition";
import type { Condition, ConditionMeta, ConditionTrace } from "./types";

type ConditionLabel = string | { label: string };

function resolveLabel(defaultLabel: string, label?: ConditionLabel): string {
  if (!label) {
    return defaultLabel;
  }
  return typeof label === "string" ? label : label.label;
}

/**
 * Boolean and extensibility operators for composing conditions.
 */
export const op = { and, or, not, custom, register, use, has, list };

type OperatorFactory<Facts, Args extends unknown[]> = (...args: Args) => Condition<Facts>;

const registry: Record<string, OperatorFactory<unknown, unknown[]>> = {};

/**
 * Combine conditions with logical AND.
 *
 * @example
 * ```ts
 * const combined = Rules.op.and(isAdult, isVip);
 * ```
 */
function and<Facts>(...conditions: Condition<Facts>[]): Condition<Facts>;
function and<Facts>(label: ConditionLabel, ...conditions: Condition<Facts>[]): Condition<Facts>;
function and<Facts>(...args: Array<Condition<Facts> | ConditionLabel>): Condition<Facts> {
  const { label, conditions } = splitArgs<Facts>("and", args);
  const meta: ConditionMeta<Facts> = { label, kind: "and", children: conditions };
  const cond = (facts: Facts) => {
    const children = conditions.map((cond) => cond(facts));
    const result = children.every((child) => child.result);
    return {
      label,
      result,
      op: "and",
      left: children.map((child) => child.label),
      right: undefined,
      children,
    };
  };
  cond.meta = meta;
  return cond;
}

/**
 * Combine conditions with logical OR.
 *
 * @example
 * ```ts
 * const combined = Rules.op.or(isAdult, isVip);
 * ```
 */
function or<Facts>(...conditions: Condition<Facts>[]): Condition<Facts>;
function or<Facts>(label: ConditionLabel, ...conditions: Condition<Facts>[]): Condition<Facts>;
function or<Facts>(...args: Array<Condition<Facts> | ConditionLabel>): Condition<Facts> {
  const { label, conditions } = splitArgs<Facts>("or", args);
  const meta: ConditionMeta<Facts> = { label, kind: "or", children: conditions };
  const cond = (facts: Facts) => {
    const children = conditions.map((cond) => cond(facts));
    const result = children.some((child) => child.result);
    return {
      label,
      result,
      op: "or",
      left: children.map((child) => child.label),
      right: undefined,
      children,
    };
  };
  cond.meta = meta;
  return cond;
}

/**
 * Negate a condition.
 *
 * @example
 * ```ts
 * const notVip = Rules.op.not(isVip);
 * ```
 */
function not<Facts>(conditionToNegate: Condition<Facts>): Condition<Facts>;
function not<Facts>(label: ConditionLabel, conditionToNegate: Condition<Facts>): Condition<Facts>;
function not<Facts>(
  labelOrCondition: ConditionLabel | Condition<Facts>,
  maybeCondition?: Condition<Facts>,
): Condition<Facts> {
  const label = resolveLabel(
    "not",
    typeof labelOrCondition === "function" ? undefined : labelOrCondition,
  );
  const conditionToNegate =
    typeof labelOrCondition === "function"
      ? labelOrCondition
      : (maybeCondition as Condition<Facts>);

  const meta: ConditionMeta<Facts> = {
    label,
    kind: "not",
    children: [conditionToNegate],
  };
  const cond = (facts: Facts) => {
    const child = conditionToNegate(facts);
    return {
      label,
      result: !child.result,
      op: "not",
      left: child.label,
      right: undefined,
      children: [child],
    };
  };
  cond.meta = meta;
  return cond;
}

/**
 * Create a custom condition with an optional reason code and trace details.
 *
 * @example
 * ```ts
 * const isEven = Rules.op.custom("is-even", (facts: { value: number }) => facts.value % 2 === 0);
 * ```
 */
function custom<Facts>(
  label: string,
  test: (facts: Facts) => boolean,
  options?:
    | ((facts: Facts) => Pick<ConditionTrace, "left" | "op" | "right">)
    | {
        details?: (facts: Facts) => Pick<ConditionTrace, "left" | "op" | "right">;
        reasonCode?: string;
      },
): Condition<Facts> {
  return condition(label, test, options);
}

/**
 * Register a custom operator factory by name.
 *
 * @example
 * ```ts
 * Rules.op.register("positive", () => Rules.condition("positive", (facts: { value: number }) => facts.value > 0));
 * ```
 */
function register<Facts, Args extends unknown[]>(
  name: string,
  factory: OperatorFactory<Facts, Args>,
): void {
  if (registry[name]) {
    throw new Error(`Operator "${name}" is already registered.`);
  }
  registry[name] = factory as OperatorFactory<unknown, unknown[]>;
}

/**
 * Create a condition using a registered operator.
 *
 * @example
 * ```ts
 * const positive = Rules.op.use<{ value: number }, []>("positive");
 * ```
 */
function use<Facts, Args extends unknown[]>(name: string, ...args: Args): Condition<Facts> {
  const factory = registry[name];
  if (!factory) {
    throw new Error(`Operator "${name}" is not registered.`);
  }
  return factory(...args) as Condition<Facts>;
}

/**
 * Check if a custom operator name is registered.
 *
 * @example
 * ```ts
 * if (!Rules.op.has("positive")) { ... }
 * ```
 */
function has(name: string): boolean {
  return Boolean(registry[name]);
}

/**
 * List registered operator names.
 *
 * @example
 * ```ts
 * const names = Rules.op.list();
 * ```
 */
function list(): string[] {
  return Object.keys(registry).sort();
}

function splitArgs<Facts>(
  defaultLabel: string,
  args: Array<Condition<Facts> | ConditionLabel>,
): { label: string; conditions: Condition<Facts>[] } {
  if (args.length === 0) {
    return { label: defaultLabel, conditions: [] };
  }

  const [first, ...rest] = args;
  if (typeof first === "function") {
    return { label: defaultLabel, conditions: args as Condition<Facts>[] };
  }

  const conditions = rest as Condition<Facts>[];
  return {
    label: resolveLabel(defaultLabel, first),
    conditions,
  };
}
