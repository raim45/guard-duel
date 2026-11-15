# Guard Duel: Project Document

Guard Duel is a game where players write instructions for an AI vault guard, then try to obtain its secret through conversation or by guessing the key. A correct key guess wins. A code check records plain leaks for the guard's owner to review after the run; it does not decide the winner. AI attackers and an analyst are planned for Part 2. It is a personal GitHub project.

## Why build it

- Teaches prompt injection and social engineering safely, as a hands-on skill.
- Existing games, such as Lakera's Gandalf and Mosscap and the open-source PwnGPT CTF, are mostly attack-only ladders: you attack a defence someone else wrote.
- Guard Duel's difference: players write the defence and other players attack it. Later, adaptive multi-turn agents and an analyst will help owners test and improve guards.
- Goal: a fun personal project that feeds a cybersecurity hobby.

## Core loop

1. The player writes a guard's instructions and chooses its available toggles.
2. The app generates a fresh random secret each round, such as `VAULT-7QX2`.
3. A human attacker chats with the guard and may submit guesses, within the session limits.
4. The server checks each defender reply for plain appearances of the key.
5. A correct guess wins. Otherwise the session ends when a limit is reached.
6. After the session, the owner can review the transcript and any plain-leak flags.
7. Later, AI attackers and an analyst can test published guards and help their owners improve them.

## Attacker agents

All agents use the same model; each is a separate system-instruction file, so adding one is cheap. Attackers are never told the secret. Each gets a goal and a strategy, reads the guard's replies and adapts.

| Agent | Strategy |
| --- | --- |
| Friendly insider | Builds rapport for a few turns, then asks casually |
| Fake admin | Claims authority and urgency |
| Role-player | Sets up a story or game where revealing the code is "in character" |
| Encoder | Asks for the secret in another language, in code, or in pieces |
| Slow drip | Asks for one tiny fact at a time, such as the first character or the length |
| Pressure | Uses emotional appeals and guilt |

Hard limits keep runs from going on forever: a 6-turn cap, a per-message token cap, and an early stop if the attacker has no new strategy. Optionally, add 10 to 15 hand-written scripted attacks (4 to 6 messages each) for repeatable scoring next to the adaptive agents.

## Leak flags and wins

`plainLeakCheck` looks for direct, normalized, reversed, spaced, per-line and spelled-out forms of the key. Word keys require a whole-word match. A match creates a leak flag for the owner to review after the session. It does not end the session or award a win. Hints, translations and partial clues are not classified as leaks. The attacker wins only by submitting the correct key.

## Scoring

For human play, the outcome is a correct key guess or a guard that survived until a session limit. Part 2 can score AI agent sessions by survival and the turn of a winning guess.

## Breach autopsy

In Part 2, an AI analyst can read a failed run's transcript, winning guess and any plain-leak flags, then explain the likely technique and suggest a patch. This analysis is separate from the rules that determine a win.

## Models and local-first development

- Develop and debug locally with Ollama through its OpenAI-compatible API; the small Gemma 4 sizes (E2B, E4B) are available for it.
- Keep the base URL and model name in a config file, so switching to Groq, Gemini or another host is a config change.
- Guard: a small model is fine, since a weaker guard breaks sooner and shows the autopsy working.
- Defender: choose one hosted model for human play and record its baseline plain-request leak rate.
- Attacker: small models tend to repeat themselves or stay too polite; a mid-size model is better. Check that it varies its approach over 6 turns.
- Re-run final numbers on the model you ship with, and do not mix models when reporting results.

## Cost and rate limits

Part 2's worst case is about 72 calls per full run (6 agents × 6 turns × 2 calls: attacker and guard); most runs should stop early. To cut cost: run scripted attacks first and AI attackers only on guards that survive, add a quick mode with fewer agents, cache results by guard text, and cap runs per player. Free hosted tiers change often, so check current limits first.

## Stack

TypeScript web app; Supabase for players, guards, runs and the leaderboard, with edge functions for model calls; a model-agnostic LLM client using an OpenAI-compatible interface.

## Human attackers (PvP): how they work

1. **Publish a guard.** Players can publish a guard for others to attack. A publish gate may be added after the AI gauntlet exists.
2. **Attackers pick a guard** and chat with it, up to a turn limit (for example 15 messages).
3. **The server runs everything.** The attacker sends a message, the backend calls the guard model with its instructions and the secret, then checks the reply for a plain leak. The attacker only ever sees the guard's reply.
4. **A plain leak is recorded for the owner.** It does not end the session or award a win.
5. **Attackers submit guesses** of the secret. A correct guess wins even if the guard never said it plainly.
6. **Scoring:** attackers earn points for breaking guards, and faster breaks earn more. Defenders earn points for each attacker that fails.

## PvP risks and how to handle them

- **The secret must never reach the browser.** Keep it in the database, readable only by edge functions, and have the server run every guard call. If the client ever sees it, anyone can cheat.
- **A rotating secret per attempt.** Generate a new code for each attacker session. Otherwise one successful attacker can pass it to everyone.
- **Cost abuse.** Every human message costs a guard call, and strangers can spam. Put a hard cap on messages per session, sessions per day and message length, and require sign-in.
- **Fairness.** Fix the guard model for everyone, so a defender cannot win by picking a model that ignores instructions. Players only write the instructions.
- **Win disputes.** A correct key guess is the only win condition, so the server can verify outcomes directly.
- **Abusive content.** Players will type offensive text to a model, and it will be stored. Add a moderation pass on published guard text and attacker messages, and a report button.
- **Guard prompt theft.** A defender might not want their instructions visible. Hide guard text until after someone breaks it, or until the defender chooses to share it.

## PvP build order

1. Human attacks against guards, with server-held secrets and key guesses.
2. Publishing and attacking other players' guards, with sign-in and limits.
3. AI attackers and the analyst in Part 2.
4. Leaderboards, if wanted.

This order gets the dangerous part (server-held secrets and rate limits) right before strangers arrive.

## Build order

1. LLM gateway and config.
2. Secret generation and plain-leak detection, with unit tests.
3. Defender prompt and model baseline.
4. Turn engine with correct guesses as the win condition.
5. Database, security, API and client for human attacks.
6. Safety checks and release.
7. AI attackers, gauntlet and analyst in Part 2.

## Ethics and safety

Attacks only target in-game guards, never real systems; say so in the README. Keep the secret strictly out of the attacker's context.

## Open questions

- What hardware is available (RAM, graphics card)? It decides which local model sizes run well.
- Which exact models for the defender and Part 2 agents?
- Ship scripted attacks, adaptive agents, or both in v1?
- Seed an attack library from public datasets? Check licences first.

Step-by-step build plan for the coding agent: Build plan
