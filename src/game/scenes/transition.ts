import Phaser from 'phaser';
import { hex, THEME } from '../theme';
import type { SceneDataMap, SceneKey } from './contracts';

export const FADE_OUT_MS = 160;
export const FADE_IN_MS = 180;

type SceneKeysWithPayload = {
  [K in SceneKey]: SceneDataMap[K] extends undefined ? never : K;
}[SceneKey];

type SceneArgs<K extends SceneKey> = K extends SceneKeysWithPayload
  ? [scene: Phaser.Scene, key: K, data: SceneDataMap[K]]
  : [scene: Phaser.Scene, key: K];

export function startScene<K extends SceneKey>(...[scene, key, data]: SceneArgs<K>): void {
  scene.scene.start(key, data);
}

export function fadeToScene<K extends SceneKey>(...[scene, key, data]: SceneArgs<K>): void {
  scene.input.enabled = false;
  const color = hex(THEME.color.background);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
  scene.cameras.main.fadeOut(FADE_OUT_MS, r, g, b);
}

export function fadeInScene(scene: Phaser.Scene): void {
  const color = hex(THEME.color.background);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  scene.cameras.main.fadeIn(FADE_IN_MS, r, g, b);
}
