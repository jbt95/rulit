export type ConditionTrace = {
  label: string;
  result: boolean;
  left?: unknown;
  op?: string;
  right?: unknown;
  children?: ConditionTrace[];
  reasonCode?: string;
};

export type ConditionMeta<Facts> = {
  label: string;
  reasonCode?: string;
  kind?: "atomic" | "and" | "or" | "not";
  children?: Condition<Facts>[];
};

export type RuleTrace = {
  ruleId: string;
  matched: boolean;
  conditions: ConditionTrace[];
  notes: string[];
  durationMs?: number;
  error?: string;
  meta?: RuleMeta;
  skippedReason?: string;
};

export type Condition<Facts> = ((facts: Facts) => ConditionTrace) & { meta?: ConditionMeta<Facts> };

export type ActionContext<Facts, Effects> = {
  facts: Facts;
  effects: Effects;
  trace: {
    note: (message: string) => void;
  };
};

export type RuleActivation = "all" | "first";

export type RuleMeta = {
  tags?: string[];
  description?: string;
  version?: string;
  reasonCode?: string;
  enabled?: boolean;
};

export type EffectsMode = "mutable" | "immutable";

export type MergeStrategy = "assign" | "deep";

export type RunOptions = {
  activation?: RuleActivation;
  effectsMode?: EffectsMode;
  mergeStrategy?: MergeStrategy;
  rollbackOnError?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
};

export type GraphNode = {
  id: string;
  type: "ruleset" | "rule" | "condition";
  label: string;
  reasonCode?: string;
  tags?: string[];
  description?: string;
  version?: string;
};

export type GraphEdge = {
  from: string;
  to: string;
};

export type RulesetGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type RunResult<Effects> = {
  effects: Effects;
  fired: string[];
  trace: RuleTrace[];
  explain: () => string;
};

export type TraceRun = {
  id: string;
  createdAt: number;
  facts: unknown;
  fired: string[];
  trace: RuleTrace[];
};

export type TelemetryAttributes = Record<string, unknown>;

export type TelemetrySpan = {
  end: () => void;
  recordException?: (error: unknown) => void;
  setAttribute?: (key: string, value: unknown) => void;
  setAttributes?: (attributes: TelemetryAttributes) => void;
};

export type TelemetryAdapter = {
  startSpan: (name: string, attributes?: TelemetryAttributes) => TelemetrySpan;
};

export type ActionResult<Effects> = void | Partial<Effects>;
export type AsyncActionResult<Effects> = ActionResult<Effects> | Promise<ActionResult<Effects>>;
