import { strict as assert } from 'node:assert';
import test from 'node:test';
import { advanceSpawnTime } from '../src/game/core/spawnClock.ts';

test('spawn clock advances from the scheduled time, not from the late frame time', () => {
  assert.equal(advanceSpawnTime(1000, 1016, 500), 1500);
});

test('spawn clock drops excessive backlog after a long stall', () => {
  assert.equal(advanceSpawnTime(1000, 5000, 500), 5500);
});

test('spawn clock rejects non-positive intervals', () => {
  assert.throws(() => advanceSpawnTime(1000, 1016, 0), /spawn interval must be positive/);
  assert.throws(() => advanceSpawnTime(1000, 1016, -1), /spawn interval must be positive/);
});
