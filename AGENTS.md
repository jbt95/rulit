# TypeScript Engineering Guidelines

## Best Practices

- Prefer `strict` TypeScript settings; avoid `any` and use `unknown` + narrowing.
- Model data with explicit types and discriminated unions for state machines.
- Keep public APIs small and well-typed; expose `type` and `interface` intentionally.
- Use `readonly`/`as const` to preserve literals where it improves safety.
- Favor pure functions and immutable data where possible; document mutations.
- Fail fast with clear errors; include actionable messages.
- Prefer composition over inheritance; avoid deep class hierarchies.
- Avoid side effects in constructors; keep initialization explicit.
- Treat `null`/`undefined` explicitly; prefer one sentinel per domain.
- Use `Result`-style return types for recoverable errors.

## Clean Code

- Keep functions small, single-purpose, and named for intent.
- Avoid temporal coupling; pass dependencies explicitly.
- Minimize boolean parameters; replace with options objects.
- Limit nesting; use early returns and guard clauses.
- Keep modules cohesive; avoid cyclic dependencies.
- Make control flow obvious; avoid cleverness.
- Prefer data-first APIs for readability and testability.
- Write tests that describe behavior, not implementation.
- Always update existing tests or add new ones when code changes.

## Design Patterns

- Use Builder for fluent APIs with staged typing.
- Use Strategy for pluggable behavior (operators, evaluators).
- Use Composite for condition trees and explainability.
- Use Factory for testable construction (`defaultEffects`).
- Use Adapter for integrations (Zod, frameworks).
- Use Observer/Event for tracing/logging hooks if needed.
- Use Command for rule actions (serializable if possible).

## Project Conventions

- Keep types in `src/types` when they are shared; keep module-local types inline.
- Export minimal surfaces from `src/index.ts`.
- Prefer named exports over default exports.
- Avoid re-export cycles; keep barrel files thin.
