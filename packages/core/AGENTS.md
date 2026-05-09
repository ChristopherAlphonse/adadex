# Core Guidelines

## Ownership
- `packages/core` holds framework-agnostic domain types, application logic, ports, and small adapters that stay independent of app runtimes.
- This package is the shared contract between `apps/api` and `apps/web`.

## Relevant Docs
- `docs/concepts/mental-model.md`
- `docs/concepts/coordination.md`
- `docs/concepts/runtime-and-api.md`
- `docs/reference/api.md`
- `docs/reference/filesystem-layout.md`
- Read these when changing shared domain terminology, runtime contracts, persistence-facing types, or cross-app behavior.

## Boundaries
- No React, HTTP server, PTY, process execution, filesystem persistence, or browser-specific behavior here.
- Prefer pure functions and explicit interfaces over runtime-coupled helpers.
- If logic needs app infrastructure to run, keep the interface in core and the implementation in the owning app.

## Design
- Keep the ports-and-adapters split clear:
  - `domain/` for core types and concepts
  - `application/` for use-case logic
  - `ports/` for system boundaries
  - lightweight adapters only when they stay framework-agnostic
- Avoid leaking app-specific naming or transport details into shared types unless that detail is truly part of the domain contract.

## Change Discipline
- Be cautious with exported types and functions. Changes here usually affect both apps.
- When modifying shared contracts, update the dependent call sites and add tests that pin the behavior from the core package outward.
- Prefer additive changes and normalization helpers over breaking contract churn.
