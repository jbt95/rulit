# Roadmap TODOs — Async Effects + OpenTelemetry

## Goals

- Enable async rule actions and async effect handling without breaking deterministic ordering.
- Add OpenTelemetry instrumentation for rule evaluation, traces, and effects.
- Keep API changes minimal and strongly typed.

## TODO

- [ ] Define async action API surface (`thenAsync` or async `then` support) with clear typing rules.
- [ ] Add async execution mode to engine (`runAsync`) and ensure consistent ordering/rollback behavior.
- [ ] Update trace model to capture async timings and errors distinctly.
- [ ] Add OpenTelemetry adapter with spans for ruleset/run/rule/condition.
- [ ] Allow opt-in OTEL config (tracer provider, attributes, sampling) without hard dependency.
- [ ] Add docs and examples for async effects + OTEL integration.
- [ ] Add tests for async action ordering, error handling, and OTEL span emission.
