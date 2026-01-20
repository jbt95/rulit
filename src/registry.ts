import type { RuleTrace, RulesetGraph, TraceRun } from "./types";

type GraphSource = {
  graph: () => RulesetGraph;
  toMermaid: () => string;
};

type RegistryEntry = {
  id: string;
  name?: string;
  createdAt: number;
  source: GraphSource;
  traces: TraceRun[];
};

type RegistryListItem = {
  id: string;
  name?: string;
  createdAt: number;
};

const entries = new Map<string, RegistryEntry>();
const nameIndex = new Map<string, string>();
let counter = 0;
let traceCounter = 0;
const traceLimit = 25;

function makeId() {
  return `ruleset-${counter++}`;
}

/**
 * In-memory registry of rulesets created in this process.
 */
export const registry = {
  /**
   * Register a ruleset in the global registry.
   *
   * @example
   * ```ts
   * const rs = Rules.ruleset<Facts, Effects>("eligibility");
   * Rules.registry.list();
   * ```
   */
  register(source: GraphSource, name?: string): string {
    const id = makeId();
    entries.set(id, { id, name, createdAt: Date.now(), source, traces: [] });
    if (name) {
      nameIndex.set(name, id);
    }
    return id;
  },

  /**
   * List all registered rulesets.
   *
   * @example
   * ```ts
   * const list = Rules.registry.list();
   * ```
   */
  list(): RegistryListItem[] {
    return Array.from(entries.values()).map(({ id, name, createdAt }) => ({
      id,
      name,
      createdAt,
    }));
  },

  /**
   * Get a graph by id or ruleset name.
   *
   * @example
   * ```ts
   * const graph = Rules.registry.getGraph("eligibility");
   * ```
   */
  getGraph(idOrName: string): RulesetGraph | undefined {
    const entry = getEntry(idOrName);
    return entry?.source.graph();
  },

  /**
   * Get Mermaid output by id or ruleset name.
   *
   * @example
   * ```ts
   * const mermaid = Rules.registry.getMermaid("eligibility");
   * ```
   */
  getMermaid(idOrName: string): string | undefined {
    const entry = getEntry(idOrName);
    return entry?.source.toMermaid();
  },

  /**
   * Record a trace run for a ruleset. Keeps a rolling window of traces.
   *
   * @example
   * ```ts
   * Rules.registry.recordTrace("eligibility", trace, fired);
   * ```
   */
  recordTrace(
    idOrName: string,
    trace: RuleTrace[],
    fired: string[],
    facts: unknown,
  ): TraceRun | undefined {
    const entry = getEntry(idOrName);
    if (!entry) {
      return undefined;
    }
    const run: TraceRun = {
      id: `trace-${traceCounter++}`,
      createdAt: Date.now(),
      facts,
      fired,
      trace,
    };
    entry.traces.push(run);
    if (entry.traces.length > traceLimit) {
      entry.traces.splice(0, entry.traces.length - traceLimit);
    }
    return run;
  },

  /**
   * List trace runs for a ruleset.
   *
   * @example
   * ```ts
   * const traces = Rules.registry.listTraces("eligibility");
   * ```
   */
  listTraces(idOrName: string): TraceRun[] {
    const entry = getEntry(idOrName);
    return entry ? [...entry.traces] : [];
  },

  /**
   * Get a trace by id for a ruleset.
   *
   * @example
   * ```ts
   * const trace = Rules.registry.getTrace("eligibility", "trace-0");
   * ```
   */
  getTrace(idOrName: string, traceId: string): TraceRun | undefined {
    const entry = getEntry(idOrName);
    return entry?.traces.find((run) => run.id === traceId);
  },

  /**
   * Clear the registry (useful in tests).
   *
   * @example
   * ```ts
   * Rules.registry.clear();
   * ```
   */
  clear(): void {
    entries.clear();
    nameIndex.clear();
    traceCounter = 0;
  },
};

function getEntry(idOrName: string): RegistryEntry | undefined {
  const byId = entries.get(idOrName);
  if (byId) {
    return byId;
  }
  const id = nameIndex.get(idOrName);
  return id ? entries.get(id) : undefined;
}
