import type {
  ActionContext,
  Condition,
  GraphEdge,
  GraphNode,
  RulesetGraph,
  MergeStrategy,
  RuleMeta,
  RunOptions,
  RunResult,
  RuleTrace,
  ActionResult,
  AsyncActionResult,
  TelemetryAdapter,
  TelemetryAttributes,
} from "./types";
import { field as fieldFactory } from "./field";
import { explainTrace } from "./trace";
import { registry } from "./registry";

type Rule<Facts, Effects> = {
  id: string;
  priority: number;
  order: number;
  conditions: Condition<Facts>[];
  action: (ctx: ActionContext<Facts, Effects>) => AsyncActionResult<Effects>;
  meta?: RuleMeta;
};

type DefaultEffectsFactory<Effects> = () => Effects;

type Engine<Facts, Effects> = {
  run: (input: { facts: Facts } & RunOptions) => RunResult<Effects>;
  runAsync: (input: { facts: Facts } & RunOptions) => Promise<RunResult<Effects>>;
};

type RulesetBuilderWithDefaults<Facts, Effects> = RulesetBuilderImpl<Facts, Effects, true>;

type RulesetBuilder<Facts, Effects, HasDefaults extends boolean> = Omit<
  RulesetBuilderImpl<Facts, Effects, HasDefaults>,
  "compile"
> &
  (HasDefaults extends true ? { compile(): Engine<Facts, Effects> } : { compile: never });

type RuleBuilder<Facts, Effects, HasDefaults extends boolean, HasThen extends boolean> = Omit<
  RuleBuilderImpl<Facts, Effects, HasDefaults, HasThen>,
  "end"
> &
  (HasThen extends true ? { end(): RulesetBuilder<Facts, Effects, HasDefaults> } : { end: never });

class RulesetBuilderImpl<Facts, Effects, HasDefaults extends boolean> {
  private readonly name?: string;
  private readonly rules: Rule<Facts, Effects>[] = [];
  private defaultEffectsFactory?: DefaultEffectsFactory<Effects>;
  private validateFactsFn?: (facts: Facts) => void;
  private validateEffectsFn?: (effects: Effects) => void;
  private nextOrder = 0;
  private registryId?: string;
  private telemetryAdapter?: TelemetryAdapter;

  constructor(name?: string) {
    this.name = name;
  }

  /**
   * Set the default effects factory. Required before compile().
   *
   * @example
   * ```ts
   * const rs = Rules.ruleset<Facts, Effects>("rs")
   *   .defaultEffects(() => ({ flags: [] }));
   * ```
   */
  defaultEffects(factory: DefaultEffectsFactory<Effects>): RulesetBuilder<Facts, Effects, true> {
    this.defaultEffectsFactory = factory;
    return this as unknown as RulesetBuilder<Facts, Effects, true>;
  }

  /**
   * Provide a validation function for facts. Called before each run.
   *
   * @example
   * ```ts
   * const rs = Rules.ruleset<Facts, Effects>("validate")
   *   .validateFacts((facts) => {
   *     if (!facts.user) throw new Error("missing user");
   *   });
   * ```
   */
  validateFacts(validator: (facts: Facts) => void): RulesetBuilder<Facts, Effects, HasDefaults> {
    this.validateFactsFn = validator;
    return this as unknown as RulesetBuilder<Facts, Effects, HasDefaults>;
  }

  /**
   * Provide a validation function for effects. Called after default effects creation
   * and after each run completes.
   *
   * @example
   * ```ts
   * const rs = Rules.ruleset<Facts, Effects>("validate")
   *   .validateEffects((effects) => {
   *     if (!Array.isArray(effects.flags)) throw new Error("invalid effects");
   *   });
   * ```
   */
  validateEffects(
    validator: (effects: Effects) => void,
  ): RulesetBuilder<Facts, Effects, HasDefaults> {
    this.validateEffectsFn = validator;
    return this as unknown as RulesetBuilder<Facts, Effects, HasDefaults>;
  }

  /**
   * Attach telemetry adapter (OpenTelemetry-compatible).
   *
   * @example
   * ```ts
   * const adapter = Rules.otel.createAdapter(trace.getTracer("rulit"));
   * Rules.ruleset("rs").telemetry(adapter);
   * ```
   */
  telemetry(adapter: TelemetryAdapter): RulesetBuilder<Facts, Effects, HasDefaults> {
    this.telemetryAdapter = adapter;
    return this as unknown as RulesetBuilder<Facts, Effects, HasDefaults>;
  }

  _setRegistryId(id: string): void {
    this.registryId = id;
  }

  /**
   * Add a new rule to the ruleset.
   *
   * @example
   * ```ts
   * Rules.ruleset<Facts, Effects>("rs")
   *   .defaultEffects(() => ({ flags: [] }))
   *   .rule("vip")
   *   .when(factsField("user.tags").contains("vip"))
   *   .then(({ effects }) => effects.flags.push("vip"))
   *   .end();
   * ```
   */
  rule(id: string): RuleBuilder<Facts, Effects, HasDefaults, false> {
    return new RuleBuilderImpl(this, id) as unknown as RuleBuilder<
      Facts,
      Effects,
      HasDefaults,
      false
    >;
  }

  /**
   * Create a typed field helper bound to the facts type.
   *
   * @example
   * ```ts
   * const factsField = Rules.ruleset<Facts, Effects>("rs").field();
   * const isAdult = factsField("user.age").gte(18);
   * ```
   */
  field() {
    return fieldFactory<Facts>();
  }

  _addRule(rule: Rule<Facts, Effects>): void {
    this.rules.push(rule);
  }

  _nextOrder(): number {
    const order = this.nextOrder;
    this.nextOrder += 1;
    return order;
  }

  /**
   * Export a graph representation of the ruleset.
   *
   * @example
   * ```ts
   * const graph = ruleset.graph();
   * ```
   */
  graph(): RulesetGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const rulesetId = `ruleset:${this.name ?? "ruleset"}`;

    nodes.push({
      id: rulesetId,
      type: "ruleset",
      label: this.name ?? "ruleset",
    });

    let conditionCounter = 0;

    const visitCondition = (condition: Condition<Facts>, parentId: string) => {
      const meta = condition.meta;
      const conditionId = `condition:${conditionCounter++}`;
      nodes.push({
        id: conditionId,
        type: "condition",
        label: meta?.label ?? "condition",
        reasonCode: meta?.reasonCode,
      });
      edges.push({ from: parentId, to: conditionId });

      if (meta?.children && meta.children.length > 0) {
        for (const child of meta.children) {
          visitCondition(child, conditionId);
        }
      }
    };

    for (const rule of this.rules) {
      const ruleId = `rule:${rule.id}`;
      nodes.push({
        id: ruleId,
        type: "rule",
        label: rule.id,
        reasonCode: rule.meta?.reasonCode,
        tags: rule.meta?.tags,
        description: rule.meta?.description,
        version: rule.meta?.version,
      });
      edges.push({ from: rulesetId, to: ruleId });

      for (const condition of rule.conditions) {
        visitCondition(condition, ruleId);
      }
    }

    return { nodes, edges };
  }

  /**
   * Export a Mermaid flowchart for visualization.
   *
   * @example
   * ```ts
   * const mermaid = ruleset.toMermaid();
   * ```
   */
  toMermaid(): string {
    const graph = this.graph();
    const idMap = new Map<string, string>();
    let counter = 0;

    for (const node of graph.nodes) {
      idMap.set(node.id, `n${counter++}`);
    }

    const lines: string[] = ["flowchart TD"];

    for (const node of graph.nodes) {
      const id = idMap.get(node.id);
      if (!id) {
        continue;
      }
      const reason = node.reasonCode ? ` [reason: ${node.reasonCode}]` : "";
      const tags = node.tags?.length ? ` [tags: ${node.tags.join(", ")}]` : "";
      const label = `${capitalize(node.type)}: ${node.label}${tags}${reason}`;
      lines.push(`  ${id}["${label}"]`);
    }

    for (const edge of graph.edges) {
      const from = idMap.get(edge.from);
      const to = idMap.get(edge.to);
      if (from && to) {
        lines.push(`  ${from} --> ${to}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Compile the ruleset into an engine.
   *
   * @example
   * ```ts
   * const engine = Rules.ruleset<Facts, Effects>("rs")
   *   .defaultEffects(() => ({ flags: [] }))
   *   .compile();
   * ```
   */
  compile(this: RulesetBuilderWithDefaults<Facts, Effects>): Engine<Facts, Effects> {
    const defaultEffectsFactory = this.defaultEffectsFactory;
    if (!defaultEffectsFactory) {
      throw new Error("defaultEffects() is required before compile().");
    }

    const sortedRules = [...this.rules].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.order - b.order;
    });

    return {
      run: ({
        facts,
        activation = "all",
        effectsMode = "mutable",
        mergeStrategy = "assign",
        rollbackOnError = false,
        includeTags,
        excludeTags,
      }) => {
        return runWithSpan(
          this.telemetryAdapter,
          "rulit.run",
          rulesetSpanAttrs(this.name, this.registryId),
          () =>
          runSync({
            facts,
            activation,
            effectsMode,
            mergeStrategy,
            rollbackOnError,
            includeTags,
            excludeTags,
            rules: sortedRules,
            defaultEffectsFactory,
            validateFactsFn: this.validateFactsFn,
            validateEffectsFn: this.validateEffectsFn,
            registryId: this.registryId,
            rulesetName: this.name,
            telemetryAdapter: this.telemetryAdapter,
          }),
        );
      },
      runAsync: async ({
        facts,
        activation = "all",
        effectsMode = "mutable",
        mergeStrategy = "assign",
        rollbackOnError = false,
        includeTags,
        excludeTags,
      }) => {
        return runWithSpanAsync(
          this.telemetryAdapter,
          "rulit.run",
          rulesetSpanAttrs(this.name, this.registryId),
          () =>
            runAsync({
              facts,
              activation,
              effectsMode,
              mergeStrategy,
              rollbackOnError,
              includeTags,
              excludeTags,
              rules: sortedRules,
              defaultEffectsFactory,
              validateFactsFn: this.validateFactsFn,
              validateEffectsFn: this.validateEffectsFn,
              registryId: this.registryId,
              rulesetName: this.name,
              telemetryAdapter: this.telemetryAdapter,
            }),
        );
      },
    };
  }
}

class RuleBuilderImpl<Facts, Effects, HasDefaults extends boolean, HasThen extends boolean> {
  private readonly ruleset: RulesetBuilderImpl<Facts, Effects, HasDefaults>;
  private readonly id: string;
  private priorityValue = 0;
  private conditions: Condition<Facts>[] = [];
  private action?: (ctx: ActionContext<Facts, Effects>) => AsyncActionResult<Effects>;
  private metaValue: RuleMeta = {};

  constructor(ruleset: RulesetBuilderImpl<Facts, Effects, HasDefaults>, id: string) {
    this.ruleset = ruleset;
    this.id = id;
  }

  /**
   * Set rule priority. Higher runs first.
   *
   * @example
   * ```ts
   * rule.priority(100);
   * ```
   */
  priority(value: number): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.priorityValue = value;
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Add conditions to a rule.
   *
   * @example
   * ```ts
   * rule.when(factsField("user.age").gte(18), factsField("user.tags").contains("vip"));
   * ```
   */
  when(...conditions: Condition<Facts>[]): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.conditions = conditions;
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Set rule metadata in one call.
   *
   * @example
   * ```ts
   * rule.meta({ tags: ["vip"], version: "1.0.0", reasonCode: "VIP_RULE" });
   * ```
   */
  meta(meta: RuleMeta): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    const tags = meta.tags ?? this.metaValue.tags;
    this.metaValue = { ...this.metaValue, ...meta, tags };
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Set rule tags used for filtering.
   *
   * @example
   * ```ts
   * rule.tags("vip", "adult");
   * ```
   */
  tags(...tags: string[]): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.metaValue = { ...this.metaValue, tags };
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Set a human-readable description.
   *
   * @example
   * ```ts
   * rule.description("VIP adult rule");
   * ```
   */
  description(description: string): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.metaValue = { ...this.metaValue, description };
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Set a rule version string.
   *
   * @example
   * ```ts
   * rule.version("1.2.3");
   * ```
   */
  version(version: string): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.metaValue = { ...this.metaValue, version };
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Set a reason code for audit/explain output.
   *
   * @example
   * ```ts
   * rule.reasonCode("VIP_ADULT");
   * ```
   */
  reasonCode(reasonCode: string): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.metaValue = { ...this.metaValue, reasonCode };
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Enable or disable a rule.
   *
   * @example
   * ```ts
   * rule.enabled(false);
   * ```
   */
  enabled(enabled: boolean): RuleBuilder<Facts, Effects, HasDefaults, HasThen> {
    this.metaValue = { ...this.metaValue, enabled };
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, HasThen>;
  }

  /**
   * Set the rule action. Returning a partial effects object applies a patch.
   *
   * @example
   * ```ts
   * rule.then(({ effects }) => {
   *   effects.flags.push("vip");
   * });
   * ```
   */
  then(
    action: (ctx: ActionContext<Facts, Effects>) => ActionResult<Effects>,
  ): RuleBuilder<Facts, Effects, HasDefaults, true> {
    this.action = action;
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, true>;
  }

  /**
   * Set an async rule action. Returning a partial effects object applies a patch.
   *
   * @example
   * ```ts
   * rule.thenAsync(async ({ effects }) => {
   *   effects.flags.push("vip");
   * });
   * ```
   */
  thenAsync(
    action: (ctx: ActionContext<Facts, Effects>) => Promise<ActionResult<Effects>>,
  ): RuleBuilder<Facts, Effects, HasDefaults, true> {
    this.action = action;
    return this as unknown as RuleBuilder<Facts, Effects, HasDefaults, true>;
  }

  /**
   * Finalize the rule and return to the ruleset builder.
   *
   * @example
   * ```ts
   * ruleset.rule("vip").then(() => undefined).end();
   * ```
   */
  end(
    this: RuleBuilderImpl<Facts, Effects, HasDefaults, true>,
  ): RulesetBuilder<Facts, Effects, HasDefaults> {
    if (!this.action) {
      throw new Error("then() is required before end().");
    }

    const rule: Rule<Facts, Effects> = {
      id: this.id,
      priority: this.priorityValue,
      order: this.ruleset._nextOrder(),
      conditions: this.conditions,
      action: this.action,
      meta: Object.keys(this.metaValue).length ? this.metaValue : undefined,
    };
    this.ruleset._addRule(rule);
    return this.ruleset as unknown as RulesetBuilder<Facts, Effects, HasDefaults>;
  }
}

/**
 * Create a new ruleset builder.
 *
 * @example
 * ```ts
 * const rs = Rules.ruleset<Facts, Effects>("eligibility");
 * ```
 */
export function ruleset<Facts, Effects>(name?: string): RulesetBuilder<Facts, Effects, false> {
  const builder = new RulesetBuilderImpl<Facts, Effects, false>(name);
  const registryId = registry.register(builder, name);
  builder._setRegistryId(registryId);
  return builder as unknown as RulesetBuilder<Facts, Effects, false>;
}

function getSkipReason(
  meta: RuleMeta | undefined,
  includeTags?: string[],
  excludeTags?: string[],
): string | undefined {
  if (meta?.enabled === false) {
    return "disabled";
  }
  const tags = meta?.tags ?? [];
  if (includeTags && includeTags.length > 0 && !includeTags.some((tag) => tags.includes(tag))) {
    return "tag-filtered";
  }
  if (excludeTags && excludeTags.length > 0 && excludeTags.some((tag) => tags.includes(tag))) {
    return "tag-excluded";
  }
  return undefined;
}

function mergeEffects<Effects>(
  target: Effects,
  patch: Partial<Effects>,
  strategy: MergeStrategy,
): void {
  if (strategy === "assign") {
    Object.assign(target as Record<string, unknown>, patch as Record<string, unknown>);
    return;
  }
  deepMerge(target as Record<string, unknown>, patch as Record<string, unknown>);
}

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const current = target[key];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        target[key] = {};
      }
      deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

function cloneEffects<Effects>(effects: Effects): Effects {
  if (typeof structuredClone === "function") {
    return structuredClone(effects);
  }
  return JSON.parse(JSON.stringify(effects)) as Effects;
}

type RunInput<Facts, Effects> = {
  facts: Facts;
  activation: "all" | "first";
  effectsMode: "mutable" | "immutable";
  mergeStrategy: MergeStrategy;
  rollbackOnError: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  rules: Rule<Facts, Effects>[];
  defaultEffectsFactory: DefaultEffectsFactory<Effects>;
  validateFactsFn?: (facts: Facts) => void;
  validateEffectsFn?: (effects: Effects) => void;
  registryId?: string;
  rulesetName?: string;
  telemetryAdapter?: TelemetryAdapter;
};

function runSync<Facts, Effects>({
  facts,
  activation,
  effectsMode,
  mergeStrategy,
  rollbackOnError,
  includeTags,
  excludeTags,
  rules,
  defaultEffectsFactory,
  validateFactsFn,
  validateEffectsFn,
  registryId,
  rulesetName,
  telemetryAdapter,
}: RunInput<Facts, Effects>): RunResult<Effects> {
  validateFactsFn?.(facts);
  let effects = defaultEffectsFactory();
  validateEffectsFn?.(effects);
  const trace: RuleTrace[] = [];
  const fired: string[] = [];

  for (const rule of rules) {
    const start = Date.now();
    const ruleTrace: RuleTrace = {
      ruleId: rule.id,
      matched: false,
      conditions: [],
      notes: [],
      meta: rule.meta,
    };

    const skipReason = getSkipReason(rule.meta, includeTags, excludeTags);
    if (skipReason) {
      ruleTrace.skippedReason = skipReason;
      ruleTrace.durationMs = Date.now() - start;
      trace.push(ruleTrace);
      continue;
    }

    let matched = true;
    for (const condition of rule.conditions) {
      const conditionTrace = runWithSpan(
        telemetryAdapter,
        "rulit.condition",
        conditionSpanAttrs(rulesetName, rule, condition),
        () => condition(facts),
      );
      ruleTrace.conditions.push(conditionTrace);
      if (!conditionTrace.result) {
        matched = false;
        break;
      }
    }

    ruleTrace.matched = matched;
    if (matched) {
      const workingEffects =
        effectsMode === "immutable" ? cloneEffects(effects) : (effects as Effects);
      const ctx: ActionContext<Facts, Effects> = {
        facts,
        effects: workingEffects,
        trace: {
          note: (message: string) => {
            ruleTrace.notes.push(message);
          },
        },
      };
      try {
        const patch = runWithSpan(
          telemetryAdapter,
          "rulit.rule",
          ruleSpanAttrs(rulesetName, rule),
          () => rule.action(ctx),
        );
        if (isPromise(patch)) {
          throw new Error("Async rule action detected. Use runAsync().");
        }
        if (patch && typeof patch === "object") {
          mergeEffects(workingEffects, patch, mergeStrategy);
        }
        if (effectsMode === "immutable") {
          effects = workingEffects;
        }
      } catch (error) {
        ruleTrace.error = String(error);
        ruleTrace.notes.push(`error: ${String(error)}`);
        if (!rollbackOnError) {
          throw error;
        }
        if (effectsMode === "immutable") {
          effects = effects;
        }
      }
      fired.push(rule.id);
    }

    ruleTrace.durationMs = Date.now() - start;
    trace.push(ruleTrace);

    if (matched && activation === "first") {
      break;
    }
  }

  validateEffectsFn?.(effects);
  if (registryId) {
    registry.recordTrace(registryId, trace, fired, facts);
  }
  return {
    effects,
    fired,
    trace,
    explain: () => explainTrace(trace, rulesetName),
  };
}

async function runAsync<Facts, Effects>({
  facts,
  activation,
  effectsMode,
  mergeStrategy,
  rollbackOnError,
  includeTags,
  excludeTags,
  rules,
  defaultEffectsFactory,
  validateFactsFn,
  validateEffectsFn,
  registryId,
  rulesetName,
  telemetryAdapter,
}: RunInput<Facts, Effects>): Promise<RunResult<Effects>> {
  validateFactsFn?.(facts);
  let effects = defaultEffectsFactory();
  validateEffectsFn?.(effects);
  const trace: RuleTrace[] = [];
  const fired: string[] = [];

  for (const rule of rules) {
    const start = Date.now();
    const ruleTrace: RuleTrace = {
      ruleId: rule.id,
      matched: false,
      conditions: [],
      notes: [],
      meta: rule.meta,
    };

    const skipReason = getSkipReason(rule.meta, includeTags, excludeTags);
    if (skipReason) {
      ruleTrace.skippedReason = skipReason;
      ruleTrace.durationMs = Date.now() - start;
      trace.push(ruleTrace);
      continue;
    }

    let matched = true;
    for (const condition of rule.conditions) {
      const conditionTrace = runWithSpan(
        telemetryAdapter,
        "rulit.condition",
        conditionSpanAttrs(rulesetName, rule, condition),
        () => condition(facts),
      );
      ruleTrace.conditions.push(conditionTrace);
      if (!conditionTrace.result) {
        matched = false;
        break;
      }
    }

    ruleTrace.matched = matched;
    if (matched) {
      const workingEffects =
        effectsMode === "immutable" ? cloneEffects(effects) : (effects as Effects);
      const ctx: ActionContext<Facts, Effects> = {
        facts,
        effects: workingEffects,
        trace: {
          note: (message: string) => {
            ruleTrace.notes.push(message);
          },
        },
      };
      try {
        const patch = await runWithSpanAsync(
          telemetryAdapter,
          "rulit.rule",
          ruleSpanAttrs(rulesetName, rule),
          () => rule.action(ctx),
        );
        if (patch && typeof patch === "object") {
          mergeEffects(workingEffects, patch, mergeStrategy);
        }
        if (effectsMode === "immutable") {
          effects = workingEffects;
        }
      } catch (error) {
        ruleTrace.error = String(error);
        ruleTrace.notes.push(`error: ${String(error)}`);
        if (!rollbackOnError) {
          throw error;
        }
        if (effectsMode === "immutable") {
          effects = effects;
        }
      }
      fired.push(rule.id);
    }

    ruleTrace.durationMs = Date.now() - start;
    trace.push(ruleTrace);

    if (matched && activation === "first") {
      break;
    }
  }

  validateEffectsFn?.(effects);
  if (registryId) {
    registry.recordTrace(registryId, trace, fired, facts);
  }
  return {
    effects,
    fired,
    trace,
    explain: () => explainTrace(trace, rulesetName),
  };
}

function isPromise(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === "function";
}

function runWithSpan<T>(
  adapter: TelemetryAdapter | undefined,
  name: string,
  attributes: TelemetryAttributes,
  fn: () => T,
): T {
  if (!adapter) {
    return fn();
  }
  const span = adapter.startSpan(name, attributes);
  try {
    const result = fn();
    span.end();
    return result;
  } catch (error) {
    span.recordException?.(error);
    span.end();
    throw error;
  }
}

async function runWithSpanAsync<T>(
  adapter: TelemetryAdapter | undefined,
  name: string,
  attributes: TelemetryAttributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!adapter) {
    return await fn();
  }
  const span = adapter.startSpan(name, attributes);
  try {
    const result = await fn();
    span.end();
    return result;
  } catch (error) {
    span.recordException?.(error);
    span.end();
    throw error;
  }
}

function rulesetSpanAttrs(name?: string, registryId?: string): TelemetryAttributes {
  return {
    "rulit.ruleset": name ?? registryId ?? "ruleset",
  };
}

function ruleSpanAttrs<Facts, Effects>(
  rulesetName: string | undefined,
  rule: Rule<Facts, Effects>,
): TelemetryAttributes {
  return {
    "rulit.ruleset": rulesetName ?? "ruleset",
    "rulit.rule_id": rule.id,
  };
}

function conditionSpanAttrs<Facts, Effects>(
  rulesetName: string | undefined,
  rule: Rule<Facts, Effects>,
  condition: Condition<Facts>,
): TelemetryAttributes {
  return {
    "rulit.ruleset": rulesetName ?? "ruleset",
    "rulit.rule_id": rule.id,
    "rulit.condition": condition.meta?.label ?? "condition",
  };
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
