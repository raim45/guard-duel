# Instructions for Coding Agents

## Before starting

1. Read this file and `project-doc.md` for the project context.
2. Read only the current stage in `build-plan.md`, including its complete acceptance criteria and any `DESIGN ADD-ON`.
3. For client work, read the exact matching screens, components, tokens, states and design phases in `design-doc.md`. Do not treat the design doc as optional because it is large; use the stage map in the build plan to select the relevant sections.
4. Inspect `git status` and recent commits before editing. Preserve unrelated and already-dirty work.

## Which document controls what

- `build-plan.md` controls scope, game rules, data and API contracts, security, build order and acceptance checks.
- `design-doc.md` controls exact client layout, tokens, copy, component states, responsive behavior, motion, sound and design acceptance checks.
- `project-doc.md` explains product context. It does not override the current build plan.
- A stage's `DESIGN ADD-ON` is binding and supplements that stage's numbered steps. Backend stages must provide the data and state transitions that later screens need.
- If documents conflict or omit a value needed to implement a requirement, do not silently choose, skip it or invent a result. State the specific conflict or missing value and ask the user before implementing the dependent behavior.

## Fixed game rules

- The only win is a correct key guess. A plain leak flag is owner review data; it never awards a win or ends a session.
- There is no AI judge. Do not reintroduce judge prompts, verdicts, verification, cumulative judging, judge roles or judge evaluations.
- The attacker never receives the secret. During an active session, the client never receives the secret, guard orders or owner-only leak flags.
- Every session uses a fresh secret. Route all model calls through the gateway.

## Work one stage at a time

- Do not begin a later stage until the user asks. Do not add features outside the current stage.
- Before coding, summarize the stage's build-plan requirements, matching design requirements, acceptance checks and unresolved decisions.
- Keep engine and gateway code independent of UI frameworks and provider SDKs. Validate external inputs and model outputs with Zod where the plan requires it.
- For client work, implement the approved design rather than replacing it with generic components or default styling. Preserve exact copy and all listed states. Use mock data before connecting real APIs, and complete design phases in the documented order.
- At each stage end, run the actual required checks and inspect their output. A command that matches no packages or tests is not a passing check. Do not claim a test, deployment or model call succeeded unless it actually ran.

## Model evaluations

- Use mocks for development. Make real provider calls only when the user explicitly requests them.
- Run a requested evaluation once with the stated prompts, model and settings. Record actual replies, model, temperature, date and detector. Do not tune prompts or repeat runs until the result matches an expected outcome.
- Report measured results even when they do not show a difference between configurations. Never fabricate model replies, leaks or evaluation results.

## Commits

- The existing history uses one stage commit at a time, with messages such as `Stage 1: Repo setup, model gateway, smoke-test edge function` and `Stage 2: Secret service - generation, normalization, leak detection`.
- Use `Stage N: <short stage name>` for a completed stage. Do not commit unless the user asks. If asked to prepare a commit, show the exact files and command before running it.
