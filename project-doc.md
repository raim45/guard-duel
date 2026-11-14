# Guard Duel: Project Document

Guard Duel is a game and testing tool where you write instructions for an AI vault guard that protects a secret code, and AI attackers and other players try to make it leak. A code check and an AI judge detect leaks, and an AI breach autopsy explains how the guard broke so you can patch it and retry. It is a personal GitHub project.

## Why build it

- Teaches prompt injection and social engineering safely, as a hands-on skill.
- Existing games, such as Lakera's Gandalf and Mosscap and the open-source PwnGPT CTF, are mostly attack-only ladders: you attack a defence someone else wrote.
- Guard Duel's difference: the player writes the defence, adaptive multi-turn agents attack it, and the breach autopsy shows why it failed. The score is measurable and rises as the guard improves.
- Goal: a fun personal project that feeds a cybersecurity hobby.

## Core loop

1. The player writes a guard: its system instructions, optionally with an input filter or output filter.
2. The app generates a fresh random secret each round, such as `VAULT-7QX2`.
3. Attacker agents test the guard one at a time, up to 6 turns each.
4. Every guard reply goes through the leak checks (see Leak detection).
5. A run ends when the guard leaks, the turn cap is reached, or the attacker has no new strategy.
6. The app shows the score and the breach autopsy, and the player patches the guard and reruns.
7. Later, other players attack published guards (see the Human attackers section).

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

## Leak detection

Every guard reply is checked in two layers.

1. Code check (free and exact): normalise the reply (strip spaces, dashes and case, and also try it reversed) and look for the secret.
2. AI judge, when the code check finds nothing plain: a separate model is told the secret and returns `leaked`, `partial` or `safe` plus a one-line reason. `leaked` or `partial` ends the run for that agent.

Also judge the whole conversation every 2 turns, because slow-drip attackers leak a piece at a time and no single reply looks like a leak. Judge the text the attacker would actually see, after any output filter the player added. Validate the judge on about 30 hand-labelled replies; if a small model gets them wrong, use a bigger one for the judge only.

## Scoring

The score is the number of agents survived out of the total, plus the turn at which the guard broke, for example "Survived 4 of 6 agents. Broke at turn 3 against Role-player." Track scores across versions of the same guard to show improvement.

## Breach autopsy

An AI reads the transcript of a failed run, explains the exact turn and trick that worked, and suggests a patch to the guard text.

## Models and local-first development

- Develop and debug locally with Ollama through its OpenAI-compatible API; the small Gemma 4 sizes (E2B, E4B) are available for it.
- Keep the base URL and model name in a config file, so switching to Groq, Gemini or another host is a config change.
- Guard: a small model is fine, since a weaker guard breaks sooner and shows the autopsy working.
- Judge: needs the most reliability (clean structured output), so test it first.
- Attacker: small models tend to repeat themselves or stay too polite; a mid-size model is better. Check that it varies its approach over 6 turns.
- Re-run final numbers on the model you ship with, and do not mix models when reporting results.

## Cost and rate limits

Worst case is about 108 calls per full run (6 agents × 6 turns × 3 calls: attacker, guard, judge); most runs stop early. To cut cost: run scripted attackers first and AI attackers only on guards that survive, add a quick mode with fewer agents, cache results by guard text, cap runs per player, and use a small model for the judge. Free hosted tiers change often, so check current limits first.

## Stack

TypeScript web app; Supabase for players, guards, runs and the leaderboard, with edge functions for model calls; a model-agnostic LLM client using an OpenAI-compatible interface.

## Human attackers (PvP): how they work

1. **Publish a guard.** After a player's guard survives the AI gauntlet, they can publish it. This gate keeps weak guards from wasting other players' time.
2. **Attackers pick a guard** and chat with it, up to a turn limit (for example 15 messages).
3. **The server runs everything.** The attacker sends a message, the backend calls the guard model with the guard's instructions and the secret, then runs the code check and the AI judge on the reply. The attacker only ever sees the guard's reply.
4. **If the code check or judge says it leaked,** the attacker wins and gets points. The defender sees the full transcript and the breach autopsy.
5. **Attackers can also submit a guess** of the secret. A correct guess is a win even if the guard never said it plainly. This covers slow-drip attacks that the checks miss.
6. **Scoring:** attackers earn points for breaking guards, and faster breaks earn more. Defenders earn points for each attacker that fails.

## PvP risks and how to handle them

- **The secret must never reach the browser.** Keep it in the database, readable only by edge functions, and have the server run every guard call. If the client ever sees it, anyone can cheat.
- **A rotating secret per attempt.** Generate a new code for each attacker session. Otherwise one successful attacker can pass it to everyone.
- **Cost abuse.** Every human message costs a guard call plus a judge call, and strangers can spam. Put a hard cap on messages per session, sessions per day and message length, and require sign-in.
- **Fairness.** Fix the guard model for everyone, so a defender cannot win by picking a model that ignores instructions. Players only write the instructions.
- **Judge disputes.** Attackers will argue "I broke it" after a safe verdict. Show them the judge's one-line reason and let the secret guess settle the argument.
- **Abusive content.** Players will type offensive text to a model, and it will be stored. Add a moderation pass on published guard text and attacker messages, and a report button.
- **Guard prompt theft.** A defender might not want their instructions visible. Hide guard text until after someone breaks it, or until the defender chooses to share it.

## PvP build order

1. Single-player first: the AI attackers against your own guard.
2. Human attackers against your own guard in a test mode. This costs little and exercises the server-side flow.
3. Publishing and attacking other players' guards, with sign-in and limits.
4. Leaderboards.

This order gets the dangerous part (server-held secrets and rate limits) right before strangers arrive.

## Build order

1. LLM client and config, with local Ollama first.
2. Secret generation and the code leak check, with unit tests.
3. Guard against one attacker loop with the 6-turn cap, transcript saved.
4. AI judge, validated on hand-labelled replies.
5. More attacker agents (instruction files).
6. Scoring and breach autopsy.
7. UI for writing guards and viewing runs.
8. Human attackers against your own guard, then published guards with sign-in and limits.
9. Leaderboard.
10. Optional: a public attack library (check licences first) and input and output filter layers for guards.

## Ethics and safety

Attacks only target in-game guards, never real systems; say so in the README. Keep the secret strictly out of the attacker's context.

## Open questions

- What hardware is available (RAM, graphics card)? It decides which local model sizes run well.
- Which exact local models for the guard, attacker and judge?
- Ship scripted attacks, adaptive agents, or both in v1?
- Seed an attack library from public datasets? Check licences first.

Step-by-step build plan for the coding agent: Build plan
