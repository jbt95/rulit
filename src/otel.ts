import type { TelemetryAdapter, TelemetryAttributes, TelemetrySpan } from "./types";

type OtelSpanLike = {
  end: () => void;
  recordException?: (error: unknown) => void;
  setAttribute?: (key: string, value: unknown) => void;
  setAttributes?: (attributes: Record<string, unknown>) => void;
};

type OtelTracerLike = {
  startSpan: (name: string, options?: { attributes?: Record<string, unknown> }) => OtelSpanLike;
};

/**
 * Create a telemetry adapter from an OpenTelemetry tracer.
 *
 * @example
 * ```ts
 * import { trace } from "@opentelemetry/api";
 * const adapter = Rules.otel.createAdapter(trace.getTracer("rulit"));
 * Rules.ruleset("rs").telemetry(adapter);
 * ```
 */
export function createOtelAdapter(tracer: OtelTracerLike): TelemetryAdapter {
  return {
    startSpan(name: string, attributes?: TelemetryAttributes): TelemetrySpan {
      const span = tracer.startSpan(name, { attributes });
      if (attributes) {
        span.setAttributes?.(attributes);
      }
      return span;
    },
  };
}
