# Template Hardening

This document decides what kind of real-project experience is allowed to flow back into the reusable template.

## Mental Model

The template should absorb safety rails, not finished-game complexity.

```text
Keep in template       platform boundaries, build gates, typed contracts, small pure helpers
Keep as docs/sample    object-pool discipline, lifecycle rules, tuning methods
Keep in each game      mechanics, HUD, art direction, scoring formulas, monetization choices
```

When in doubt, ask whether the next game can reuse the idea without inheriting the previous game's design.

## Must Flow Back

These are template-level capabilities:

- platform adapter contracts
- Basic/Full Launch build separation
- upload bundle checks
- dependency boundary checks
- pure rule tests
- typed scene key and payload contracts
- small pure helpers with tests, such as spawn timing
- script recipe conventions

These reduce repeated production risk without forcing a specific game design.

## May Flow Back As Optional Samples

These are useful, but only after a real game needs them:

- object-pool capacity budget tests
- pause controller skeletons
- ad lifecycle wrappers
- settings screens driven by platform capabilities
- asset pipeline recipes
- Playwright or browser smoke tests

Optional samples must be clearly labeled. Do not make every new game delete unused systems before it can start.

## Should Stay In Game Projects

Do not move these into the base template:

- concrete player controllers
- enemy, collectible, or level spawners
- combo, graze, revive, or special-skill mechanics
- HUD components for a specific mechanic
- tutorial flows
- result-page stats tied to one game
- concrete audio patches, particle effects, or camera choreography
- fixed ad cadence such as "every third run"

The template can document the pattern, but the implementation belongs to the game.

## Acceptance Test For New Template Features

Before adding a feature to the template, answer:

| Question | Required answer |
| --- | --- |
| Does it reduce a recurring setup, release, or correctness risk? | Yes |
| Can a different genre use it without deleting most of it? | Yes |
| Can it be verified by a narrow test or command? | Yes |
| Does it avoid platform or gameplay silent fallback behavior? | Yes |
| Is it smaller than the repeated manual work it replaces? | Yes |

If any answer is no, put the idea in docs or a game project instead.

## Current Backflow From Pulse Dodger

Absorbed into the template:

- managed script recipe shape
- typed scene contracts
- transition input lock
- spawn timing helper
- lifecycle and hardening documentation

Kept out of the template:

- Pulse, graze, combo, revive product flow
- concrete object spawners
- Pulse-specific HUD and tutorial
- full pause/settings UI implementation
