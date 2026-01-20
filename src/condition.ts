import type { Condition, ConditionMeta, ConditionTrace } from "./types";

type ConditionDetails<Facts> = (facts: Facts) => Pick<ConditionTrace, "left" | "op" | "right">;
type ConditionOptions<Facts> = {
  details?: ConditionDetails<Facts>;
  reasonCode?: string;
};

/**
 * Create a condition with optional trace details and a reason code.
 *
 * @example
 * ```ts
 * const isAdult = Rules.condition("is adult", (facts: Facts) => facts.user.age >= 18, {
 *   details: (facts) => ({ left: facts.user.age, op: ">=", right: 18 }),
 *   reasonCode: "AGE_18",
 * });
 * ```
 */
export function condition<Facts>(
  label: string,
  test: (facts: Facts) => boolean,
  options?: ConditionDetails<Facts> | ConditionOptions<Facts>,
): Condition<Facts> {
  const meta: ConditionMeta<Facts> = {
    label,
    reasonCode: typeof options === "object" ? options?.reasonCode : undefined,
    kind: "atomic",
  };

  const cond = (facts: Facts) => {
    const result = test(facts);
    const details = typeof options === "function" ? options : options?.details;
    const info = details ? details(facts) : undefined;
    return {
      label,
      result,
      left: info?.left,
      op: info?.op,
      right: info?.right,
      reasonCode: meta.reasonCode,
    };
  };
  cond.meta = meta;
  return cond;
}
