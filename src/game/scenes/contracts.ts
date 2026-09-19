import type { FinishResult } from '../core/RunState.ts';

export const SCENES = {
  Boot: 'Boot',
  Menu: 'Menu',
  Play: 'Play',
  Result: 'Result',
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];

export type ResultData = FinishResult;

export interface SceneDataMap {
  [SCENES.Boot]: undefined;
  [SCENES.Menu]: undefined;
  [SCENES.Play]: undefined;
  [SCENES.Result]: ResultData;
}

type Assert<T extends true> = T;
type ExactSceneDataMapKeys = [SceneKey] extends [keyof SceneDataMap]
  ? [keyof SceneDataMap] extends [SceneKey]
    ? true
    : false
  : false;

export type SceneDataMapCoversAllScenes = Assert<ExactSceneDataMapKeys>;
