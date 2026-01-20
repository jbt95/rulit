import type { ZodType } from "zod";

/**
 * Create a facts validator using a Zod schema.
 *
 * @example
 * ```ts
 * const factsSchema = z.object({ user: z.object({ age: z.number() }) });
 * const rs = Rules.ruleset<Facts, Effects>("rs").validateFacts(Rules.zodFacts(factsSchema));
 * ```
 */
export function zodFacts<Facts>(schema: ZodType<Facts>) {
  return (facts: Facts) => {
    schema.parse(facts);
  };
}

/**
 * Create an effects validator using a Zod schema.
 *
 * @example
 * ```ts
 * const effectsSchema = z.object({ flags: z.array(z.string()) });
 * const rs = Rules.ruleset<Facts, Effects>("rs").validateEffects(Rules.zodEffects(effectsSchema));
 * ```
 */
export function zodEffects<Effects>(schema: ZodType<Effects>) {
  return (effects: Effects) => {
    schema.parse(effects);
  };
}
