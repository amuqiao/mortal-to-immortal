# Runtime Lifecycle

This document records the runtime safety rules that real Phaser + CrazyGames projects should copy before adding pause menus, ads, hitstop, slow motion, or global listeners.

## Mental Model

There are three different clocks and ownership zones:

```text
platform lifecycle    CrazyGames gameplay/loading/ad signals
scene lifecycle       Phaser scene create/update/shutdown
effect lifecycle      tweens, physics timeScale, camera effects, audio mute
```

Do not let one zone silently control another. Pause, ads, hitstop, and slow motion should each have a clear owner and a paired restore path.

## Platform Signals

Call platform lifecycle methods when player state changes:

```text
loadingStart -> loadingStop
gameplayStart -> gameplayStop
```

Rules:

- Call `gameplayStart()` when the player can actively play.
- Call `gameplayStop()` when paused, in menus, in result screens, during ads, or after the run is finished.
- Keep these calls near the scene state transition, not inside pure rules.
- Do not call `window.CrazyGames.SDK` from scenes; go through `platform()`.

## Pause

A pause implementation should own these four things:

```text
input that triggers pause
gameplayStop/gameplayStart pair
Phaser state that is paused
shutdown cleanup for listeners
```

Minimum rules:

- ESC, pause buttons, blur, and visibility changes must not register duplicate global listeners.
- Any listener registered on `scene.game.events` must be removed on `Phaser.Scenes.Events.SHUTDOWN`.
- Pause UI clicks must not pass through into the game below.
- Resume should give the game a short buffer when the gameplay needs one; do not scatter bare delay numbers across scenes.

## Ads

Ads are not just UI. They interrupt gameplay.

Wrap ad calls like this:

```ts
audio.setAdMuted(true);
scene.scene.pause();
try {
  const rewarded = await platform().showRewarded('reason', {
    onStarted: () => {},
    onFinished: () => {},
  });
  return rewarded;
} finally {
  scene.scene.resume();
  audio.setAdMuted(false);
}
```

Rules:

- Mute audio before an ad starts.
- Pause gameplay before awaiting an ad.
- Restore in `finally`, not only in success branches.
- Reward only when `showRewarded()` returns `true`.
- Basic Launch builds must hide or disable ad UI if `platform().capabilities.rewardedAds` is false.

## Hitstop And Slow Motion

Hitstop and slow motion should not fight with pause.

Rules:

- Avoid shared boolean switches such as global `pauseAll()` as the only restore mechanism for short hitstop effects.
- Prefer scoped numeric time scales for effects that must restore independently.
- Use an unscaled time source for restore timing when the effect itself changes timer speed.
- Keep effect helpers out of `src/game/core`; core rules must stay Node-testable.

## Capability Driven UI

UI should read platform capabilities instead of relying on release-time manual edits.

Examples:

- If `platformProvidesAudioToggle` is true, do not show a second in-game audio toggle.
- If `platformProvidesLoadingUI` is true, the game should send loading signals rather than drawing a duplicate platform-like loader.
- If `rewardedAds` is false, do not show a revive or reward button.

## QA Checklist Additions

Before submission, manually check:

- Pause/resume calls platform lifecycle once per transition.
- Blur or hidden tab does not let gameplay continue behind a paused state.
- Ad success and ad error both restore gameplay and audio.
- Basic Launch has no visible ad-only controls.
- Scene shutdown does not leave duplicate listeners for the next run.
