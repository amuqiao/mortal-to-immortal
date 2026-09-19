# Architecture Notes

This starter has one job: provide a reusable Phaser + CrazyGames spine without carrying one game's business logic into the next project.

## Mental Model

```text
index.html
-> src/main.ts
-> platform init
-> loading overlay
-> Phaser game
-> scenes
-> core rules
```

Keep these boundaries:

| Layer | Owns | Must not own |
| --- | --- | --- |
| `src/main.ts` | Browser bootstrap, platform init, loading overlay | Gameplay rules |
| `src/platform/` | CrazyGames/Web adapters | Phaser scenes or game logic |
| `src/game/main.ts` | Phaser config and scene order | Platform SDK calls |
| `src/game/scenes/` | Per-frame orchestration and Phaser objects | SDK globals |
| `src/game/core/` | Pure rules and state transitions | Browser, Phaser, platform SDK |
| `scripts/` | Build, package, upload-folder checks | Gameplay behavior |

## Scene Contracts

Scene keys and scene payloads live in `src/game/scenes/contracts.ts`.

Use:

```text
fadeToScene(this, SCENES.Result, result)
startScene(this, SCENES.Menu)
```

Avoid direct string keys such as `this.scene.start('Result', data)`. The contract file is the single place that says which scene accepts which payload shape. The transition helper also disables input during camera fade-out, so one fast double click cannot start the same scene twice.

## Spawn Timing

Use `advanceSpawnTime(nextAt, now, interval)` for timer-like spawning. It advances from the scheduled timestamp, not from the late frame timestamp, so spawn cadence does not drift with refresh rate. If a scene stalls for too long, it drops the backlog instead of burst-spawning several waves.

## Script Layers

Keep scripts layered:

```text
npm scripts -> scripts/run.sh -> focused leaf scripts -> scripts/lib/common.sh
```

`scripts/run.sh` is the stable human-facing recipe entrypoint. Leaf scripts such as `scripts/dev.sh` own one thing and should fail loudly on invalid runtime state. Runtime PID, port, and log files belong in `.run/`.

See `../scripts/README.md` for recipe naming, exit codes, runtime files, and extension rules.

## Runtime Lifecycle

Pause, ads, hitstop, slow motion, and global listeners are runtime concerns, not pure rules. Keep those systems out of `src/game/core`, and pair every pause/mute/listener action with a restore or cleanup path.

See `runtime-lifecycle.md` for the reusable lifecycle rules.

## Why Phaser 3

This template intentionally uses Phaser 3.90.0. The official Vite template may track newer Phaser releases, but the Phaser 3 ecosystem has broader examples and matches the proven Pulse Dodger path used for CrazyGames submission practice.

## Platform Adapter

Game code calls:

```text
platform().gameplayStart()
platform().gameplayStop()
platform().save(key, value)
platform().showRewarded(reason, hooks)
```

Game code does not call:

```text
window.CrazyGames.SDK...
```

That is the part you reuse when publishing to another platform: add a new adapter and keep gameplay mostly unchanged.
